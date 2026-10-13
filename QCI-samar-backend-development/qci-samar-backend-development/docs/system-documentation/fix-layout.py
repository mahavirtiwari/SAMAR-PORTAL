"""Post-process body_only.docx before template injection.

Three defects are fixed here, all of which come from the fact that the build
pipeline injects only document.xml and numbering.xml - styles.xml stays as the
template's, so the skill's documentStyles never actually apply.

1. Heading3 bullets. The template's Heading3 style carries
   <w:numPr><w:numId w:val="2"/></w:numPr>, and numId 2 is the bullet list
   docx-js generates. Every level-3 heading therefore renders with a stray
   bullet. Setting numId 0 explicitly on the paragraph cancels the inherited
   numbering (0 is the OOXML "no numbering" sentinel).

2. Orphaned headings. Nothing sets keepNext, so a heading can sit alone at the
   foot of a page with its content overleaf. keepNext binds it to what follows.

3. Headings hard against a table. space_after_tables.py deliberately skips
   inserting a gap when a heading follows a table, on the assumption that the
   heading's style carries generous before-spacing. The template's does not, so
   those headings sit ~2mm below the rule. An explicit before-spacing is added
   to any heading that directly follows a table.

Usage: python fix-layout.py <path-to-body_only.docx>
"""
import re
import shutil
import sys
import zipfile

HEADING_STYLES = ("Heading1", "Heading2", "Heading3")
NO_NUMBERING = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr>'


def patch(xml: str) -> tuple[str, dict]:
    counts = {"unbulleted": 0, "keepnext": 0, "after_table": 0, "leadin": 0}
    out = []
    pos = 0
    prev_was_table = False

    blocks = list(re.finditer(r"<w:tbl>.*?</w:tbl>|<w:p\b(?:[^>]*)>.*?</w:p>|<w:p\b[^>]*/>", xml, re.S))
    next_is_table = [
        (i + 1 < len(blocks) and blocks[i + 1].group(0).startswith("<w:tbl>"))
        for i in range(len(blocks))
    ]

    for idx, m in enumerate(blocks):
        out.append(xml[pos:m.start()])
        block = m.group(0)
        pos = m.end()

        if block.startswith("<w:tbl>"):
            out.append(block)
            prev_was_table = True
            continue

        style = re.search(r'<w:pStyle w:val="(Heading[123])"/>', block)
        if style:
            sid = style.group(1)

            # 1. cancel inherited numbering on Heading3
            if sid == "Heading3" and "<w:numPr>" not in block:
                block = block.replace('<w:pStyle w:val="Heading3"/>',
                                      '<w:pStyle w:val="Heading3"/>' + NO_NUMBERING, 1)
                counts["unbulleted"] += 1

            # 2. keep the heading with the content that follows it
            if "<w:keepNext/>" not in block:
                block = block.replace(f'<w:pStyle w:val="{sid}"/>',
                                      f'<w:pStyle w:val="{sid}"/><w:keepNext/>', 1)
                counts["keepnext"] += 1

            # 3. give the heading air when it directly follows a table
            if prev_was_table:
                sp = re.search(r"<w:spacing\b[^/]*/>", block)
                if sp:
                    tag = sp.group(0)
                    if "w:before=" in tag:
                        new = re.sub(r'w:before="\d+"', 'w:before="360"', tag)
                    else:
                        new = tag.replace("<w:spacing", '<w:spacing w:before="360"')
                    block = block.replace(tag, new, 1)
                else:
                    block = block.replace(f'<w:pStyle w:val="{sid}"/>',
                                          f'<w:pStyle w:val="{sid}"/><w:spacing w:before="360"/>', 1)
                counts["after_table"] += 1

        else:
            # A lead-in sentence ("Who can move an application:") stranded at the
            # foot of a page while its table starts overleaf reads as a mistake.
            # Bind any paragraph that immediately precedes a table to it.
            if next_is_table[idx] and "<w:keepNext/>" not in block:
                if "<w:pPr>" in block:
                    block = block.replace("<w:pPr>", "<w:pPr><w:keepNext/>", 1)
                else:
                    block = re.sub(r"(<w:p\b[^>]*>)", r"\1<w:pPr><w:keepNext/></w:pPr>", block, count=1)
                counts["leadin"] += 1

        out.append(block)
        prev_was_table = False

    out.append(xml[pos:])
    return "".join(out), counts


def main() -> None:
    src = sys.argv[1]
    tmp = src + ".tmp"
    with zipfile.ZipFile(src) as zin:
        names = zin.namelist()
        data = {n: zin.read(n) for n in names}

    xml = data["word/document.xml"].decode("utf-8")
    patched, counts = patch(xml)
    data["word/document.xml"] = patched.encode("utf-8")

    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            zout.writestr(n, data[n])
    shutil.move(tmp, src)

    print(
        "fix-layout: {unbulleted} heading(s) unbulleted, "
        "{keepnext} keepNext added, {after_table} heading(s) spaced off a table, {leadin} lead-in(s) bound to their table".format(**counts)
    )


if __name__ == "__main__":
    main()
