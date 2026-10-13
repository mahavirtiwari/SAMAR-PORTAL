{{--
    In-document paginator. wkhtmltopdf runs this before painting (the generator waits on
    window.status). It packs every .pdf-flow into fixed-size .pdf-page elements by measured height,
    splitting a .pdf-splittable block's table by row, and a row by words, when the block does not
    fit, then writes the true page index into every footer. Runs on wkhtmltopdf's 2012-era WebKit:
    ES5 only.
--}}
<script type="text/javascript">
(function () {
    var STATUS = 'paginated';

    function hasClass(el, name) {
        return (' ' + el.className + ' ').indexOf(' ' + name + ' ') !== -1;
    }

    function childElements(el, className) {
        var out = [], i, nodes = el.childNodes;
        for (i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType === 1 && (!className || hasClass(nodes[i], className))) {
                out.push(nodes[i]);
            }
        }
        return out;
    }

    // The print pass re-flows text slightly differently from the screen layout this script
    // measures (an instrumented 232-page render put the printed bottom within 13px of the
    // measured one on every page), so a block must fit with this many px to spare or it moves to
    // the next page.
    var PRINT_REFLOW_MARGIN_PX = 32;

    // Measured from the last block's bottom edge, not scrollHeight: on an overflow:hidden box
    // scrollHeight never reads below clientHeight, so a margin subtracted from it would flag an
    // almost-empty page as full.
    function overflows(body) {
        var last = body.lastChild;
        while (last && last.nodeType !== 1) { last = last.previousSibling; }
        if (!last) { return false; }
        return last.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom - PRINT_REFLOW_MARGIN_PX;
    }

    function newPage(template, before) {
        var page = template.cloneNode(true);
        page.className = 'pdf-page';
        before.parentNode.insertBefore(page, before);
        return { page: page, body: childElements(page, 'pdf-page-body')[0] };
    }

    function tbodyOf(block) {
        var tables = block.getElementsByTagName('tbody');
        return tables.length ? tables[0] : null;
    }

    function markContinued(block) {
        var marks = block.getElementsByTagName('strong'), i;
        for (i = 0; i < marks.length; i++) {
            if (hasClass(marks[i], 'pdf-contd') && !marks[i].getAttribute('data-contd')) {
                marks[i].setAttribute('data-contd', '1');
                marks[i].appendChild(document.createTextNode(' (contd.)'));
            }
        }
    }

    function cellText(cell) {
        return cell.textContent !== undefined ? cell.textContent : cell.innerText;
    }

    function setCellText(cell, text) {
        while (cell.firstChild) { cell.removeChild(cell.firstChild); }
        cell.appendChild(document.createTextNode(text));
    }

    function units(text, byCharacter) {
        var parts = byCharacter ? text.split('') : text.split(/\s+/), out = [], i;
        for (i = 0; i < parts.length; i++) {
            if (parts[i]) { out.push(parts[i]); }
        }
        return out;
    }

    // Splits a row that is taller than an empty page: every text cell keeps the largest leading
    // share of its words that still fits, the rest goes into a continuation row (first cell, the
    // serial number, repeated) placed back at the head of source for the next page. When not even
    // one word per cell fits (a single unbroken string taller than a page) the split is redone by
    // character. The row is already appended to the page's clone table when this is called.
    // Returns false when nothing fits, in which case the row stays whole.
    function splitRow(row, source, body, byCharacter) {
        var cells = childElements(row, null), i, cellUnits = [], longest = 0, glue = byCharacter ? '' : ' ';
        for (i = 1; i < cells.length; i++) {
            cellUnits[i] = units(cellText(cells[i]), byCharacter);
            if (cellUnits[i].length > longest) { longest = cellUnits[i].length; }
        }
        if (longest < 2) { return false; }

        function keepCount(i, share) {
            return Math.min(cellUnits[i].length, Math.ceil(cellUnits[i].length * share / longest));
        }
        function apply(share) {
            for (i = 1; i < cells.length; i++) {
                setCellText(cells[i], cellUnits[i].slice(0, keepCount(i, share)).join(glue));
            }
        }

        var lo = 1, hi = longest - 1, mid, fit = 0;
        while (lo <= hi) {
            mid = Math.floor((lo + hi) / 2);
            apply(mid);
            if (overflows(body)) { hi = mid - 1; } else { fit = mid; lo = mid + 1; }
        }
        if (fit === 0) {
            apply(longest);
            return byCharacter ? false : splitRow(row, source, body, true);
        }

        apply(fit);
        var rest = row.cloneNode(true), restCells = childElements(rest, null);
        for (i = 1; i < cells.length; i++) {
            setCellText(restCells[i], cellUnits[i].slice(keepCount(i, fit)).join(glue));
        }
        source.insertBefore(rest, source.firstChild);
        return true;
    }

    // Moves as many rows of block's table as fit into a clone placed on the page.
    // Returns true when at least one row was placed; the block keeps the remaining rows.
    function placeRows(block, body, force) {
        var source = tbodyOf(block);
        if (!source) { return false; }
        var rows = childElements(source, null);
        if (!rows.length) { return false; }

        var clone = block.cloneNode(true);
        var target = tbodyOf(clone);
        while (target.firstChild) { target.removeChild(target.firstChild); }
        body.appendChild(clone);

        var placed = 0, i;
        for (i = 0; i < rows.length; i++) {
            target.appendChild(rows[i]);
            if (overflows(body)) {
                if (placed === 0 && force) {
                    splitRow(rows[i], source, body, false);
                    placed = 1;
                    break;
                }
                source.insertBefore(rows[i], source.firstChild);
                break;
            }
            placed++;
        }

        if (placed === 0) {
            body.removeChild(clone);
            return false;
        }
        if (childElements(source, null).length) {
            markContinued(block);
        }
        return true;
    }

    function paginateFlow(flow, template) {
        var blocks = childElements(flow, 'pdf-block');
        var current = newPage(template, flow);
        var i, block, pageHasContent = false;

        for (i = 0; i < blocks.length; i++) {
            block = blocks[i];
            current.body.appendChild(block);
            if (!overflows(current.body)) {
                pageHasContent = true;
                continue;
            }
            current.body.removeChild(block);

            if (hasClass(block, 'pdf-splittable') && tbodyOf(block) && childElements(tbodyOf(block), null).length) {
                if (pageHasContent) {
                    placeRows(block, current.body, false);
                }
                while (childElements(tbodyOf(block), null).length) {
                    current = newPage(template, flow);
                    pageHasContent = true;
                    placeRows(block, current.body, true);
                }
                continue;
            }

            if (pageHasContent) {
                current = newPage(template, flow);
            }
            current.body.appendChild(block);
            pageHasContent = true;
        }

        flow.parentNode.removeChild(flow);
    }

    function numberPages() {
        var pages = document.getElementsByTagName('div'), i, n = 0, spans, j;
        for (i = 0; i < pages.length; i++) {
            if (!hasClass(pages[i], 'pdf-page')) { continue; }
            n++;
            spans = pages[i].getElementsByTagName('span');
            for (j = 0; j < spans.length; j++) {
                if (hasClass(spans[j], 'page-number')) {
                    spans[j].innerHTML = 'Page ' + n;
                }
            }
        }
    }

    function paginate() {
        try {
            var template = document.getElementById('pdf-page-template');
            var flows = [], divs = document.getElementsByTagName('div'), i;
            for (i = 0; i < divs.length; i++) {
                if (hasClass(divs[i], 'pdf-flow')) { flows.push(divs[i]); }
            }
            for (i = 0; i < flows.length; i++) {
                paginateFlow(flows[i], template);
            }
            template.parentNode.removeChild(template);
            numberPages();
        } catch (e) {
            document.title = 'PAGINATION ERROR: ' + e;
        }
        window.status = STATUS;
    }

    // The report's web font (Inter) loads asynchronously and lands after this script first runs,
    // so packing straight away measures every cell in the fallback font. Inter is wider, the
    // print pass wraps more lines, and full pages lose their last rows under overflow:hidden.
    // Each probe pair compares one Inter weight against the fallback; packing starts only once
    // every weight measures differently, or the wait times out and the title records it.
    var FONT_WAIT_LIMIT_MS = 8000, FONT_POLL_MS = 50;
    var PROBE_TEXT = 'The quick brown fox jumps over the lazy dog 0123456789 ========== WWWWWWWWWW';

    function fontProbes() {
        var weights = [400, 500, 600, 700, 800], holder = document.createElement('div'), pairs = [], i;
        holder.style.cssText = 'position:absolute;left:-10000px;top:0;white-space:nowrap;visibility:hidden;font-size:11pt;';
        for (i = 0; i < weights.length; i++) {
            var web = document.createElement('span'), fallback = document.createElement('span');
            web.style.cssText = 'font-family:Inter;font-weight:' + weights[i] + ';';
            fallback.style.cssText = 'font-family:Arial,sans-serif;font-weight:' + weights[i] + ';';
            web.appendChild(document.createTextNode(PROBE_TEXT));
            fallback.appendChild(document.createTextNode(PROBE_TEXT));
            holder.appendChild(web);
            holder.appendChild(fallback);
            pairs.push([web, fallback]);
        }
        document.body.appendChild(holder);
        return { holder: holder, pairs: pairs };
    }

    function fontsReady(probes) {
        var i;
        for (i = 0; i < probes.pairs.length; i++) {
            if (probes.pairs[i][0].getBoundingClientRect().width === probes.pairs[i][1].getBoundingClientRect().width) {
                return false;
            }
        }
        return true;
    }

    var probes = fontProbes(), started = new Date().getTime();

    function waitForFonts() {
        if (fontsReady(probes)) {
            probes.holder.parentNode.removeChild(probes.holder);
            paginate();
            return;
        }
        if (new Date().getTime() - started > FONT_WAIT_LIMIT_MS) {
            document.title = 'PAGINATION WARNING: web font not ready after ' + FONT_WAIT_LIMIT_MS + 'ms';
            probes.holder.parentNode.removeChild(probes.holder);
            paginate();
            return;
        }
        setTimeout(waitForFonts, FONT_POLL_MS);
    }

    waitForFonts();
})();
</script>
