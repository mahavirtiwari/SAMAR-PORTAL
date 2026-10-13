# -*- coding: utf-8 -*-
"""Shared building blocks for the SAMAR document family.

build_docx.py            the full internal User Manual (all nine roles)
build_assessor_docx.py   the public Assessor Handbook
build_applicant_docx.py  the public Applicant Handbook

All three render identically, in the format of the client's QCI Applicant
Manual, because they draw on this module. Screenshots are addressed by explicit
filename rather than by sequence, so one capture library (screenshots/) serves
every document and no screen is captured twice.
"""

import os
import math
import tempfile
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement, parse_xml
from PIL import Image as PILImage

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO_DIR = os.path.join(HERE, "logos")
SAMAR = os.path.join(LOGO_DIR, "logo_samar.png")
COVER_BG = os.path.join(LOGO_DIR, "cover_background.jpg")
HEADER_LOGOS = os.path.join(LOGO_DIR, "header_logos.png")
HEADER_CORNER = os.path.join(LOGO_DIR, "header_corner.png")
FOOTER_CORNER = os.path.join(LOGO_DIR, "footer_corner.png")
FIGURES_DIR = os.path.join(HERE, "figures")

SHOTS_DIR = os.environ.get("SAMAR_SHOTS_DIR", os.path.join(HERE, "screenshots"))
OUT_DIR = os.environ.get("SAMAR_OUT_DIR", os.path.join(os.path.expanduser("~"), "Downloads"))

# Colours of the QCI Applicant Manual the client issued as the format.
BAR = "1F487C"
HEAD_BLUE = RGBColor(0x36, 0x5F, 0x91)
TITLE_BLUE = RGBColor(0x48, 0x7D, 0xB8)
HEADER_RULE = "1F487C"
FOOTER_RULE = "497DBA"
PAGE_BOX = "006FC0"
CELL_TINT = "F8F8F9"
GREY = RGBColor(0x55, 0x60, 0x70)
BLACK = RGBColor(0x00, 0x00, 0x00)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

PAGE_W = Cm(21.0)
PAGE_H = Cm(29.7)
MARGIN_X = Cm(1.27)
TEXT_W_CM = 21.0 - 2 * 1.27
# Table widths across the scripts were drawn for a 17.2 cm text block.
TABLE_SCALE = TEXT_W_CM / 17.2


def _shade(el_pr, fill):
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill)
    el_pr.append(shd)


def _field(run, instr):
    f1 = OxmlElement('w:fldChar')
    f1.set(qn('w:fldCharType'), 'begin')
    it = OxmlElement('w:instrText')
    it.set(qn('xml:space'), 'preserve')
    it.text = instr
    f2 = OxmlElement('w:fldChar')
    f2.set(qn('w:fldCharType'), 'separate')
    f3 = OxmlElement('w:fldChar')
    f3.set(qn('w:fldCharType'), 'end')
    run._r.append(f1)
    run._r.append(it)
    run._r.append(f2)
    run._r.append(f3)


def _outline(paragraph, level):
    """Word's TOC field collects paragraphs by outline level, so the banners and
    part titles carry one although they are not Heading styles."""
    ol = OxmlElement('w:outlineLvl')
    ol.set(qn('w:val'), str(level))
    paragraph._p.get_or_add_pPr().append(ol)


# The letterhead is built the way the client's manual builds it: every piece is
# a drawing anchored to the page, behind the text, so none of it moves with the
# body or takes up a line.

_NS = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
       'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
       'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
       'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" '
       'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
       'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
       'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"')

_draw_id = [1000]


def _anchor(x, y, cx, cy, graphic, z, name):
    """z orders the drawings (higher is in front). Word renumbers small
    relativeHeight values on save and can invert them, which hid the cover logo
    behind the background, so z is spread over the range Word itself writes."""
    _draw_id[0] += 1
    z = 251650000 + z * 1024
    return ('<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="%d" behindDoc="1" '
            'locked="1" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/>'
            '<wp:positionH relativeFrom="page"><wp:posOffset>%d</wp:posOffset></wp:positionH>'
            '<wp:positionV relativeFrom="page"><wp:posOffset>%d</wp:posOffset></wp:positionV>'
            '<wp:extent cx="%d" cy="%d"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>'
            '<wp:docPr id="%d" name="%s"/><wp:cNvGraphicFramePr/>%s</wp:anchor>'
            % (z, x, y, cx, cy, _draw_id[0], name, graphic))


def _run_with(paragraph, drawing, shape=False):
    if shape:
        drawing = '<mc:AlternateContent><mc:Choice Requires="wps">%s</mc:Choice></mc:AlternateContent>' % drawing
    paragraph._p.append(parse_xml('<w:r %s><w:rPr><w:noProof/></w:rPr>%s</w:r>' % (_NS, drawing)))


def _pic(paragraph, path, x, y, cx, cy, z):
    rid, _ = paragraph.part.get_or_add_image(path)
    g = ('<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
         '<pic:nvPicPr><pic:cNvPr id="0" name="%s"/><pic:cNvPicPr/></pic:nvPicPr>'
         '<pic:blipFill><a:blip r:embed="%s"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
         '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="%d" cy="%d"/></a:xfrm>'
         '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>'
         % (os.path.basename(path), rid, cx, cy))
    _run_with(paragraph, '<w:drawing>%s</w:drawing>' % _anchor(x, y, cx, cy, g, z, os.path.basename(path)))


def _shape(paragraph, x, y, cx, cy, sppr, z, name, txbx="", anchor="t"):
    g = ('<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">'
         '<wps:wsp><wps:cNvSpPr%s/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="%d" cy="%d"/></a:xfrm>%s</wps:spPr>'
         '%s<wps:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="%s"><a:noAutofit/></wps:bodyPr>'
         '</wps:wsp></a:graphicData></a:graphic>'
         % (' txBox="1"' if txbx else '', cx, cy, sppr,
            '<wps:txbx><w:txbxContent>%s</w:txbxContent></wps:txbx>' % txbx if txbx else '', anchor))
    _run_with(paragraph, '<w:drawing>%s</w:drawing>' % _anchor(x, y, cx, cy, g, z, name), shape=True)


def _rule(paragraph, y, width, color, z):
    sppr = ('<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/>'
            '<a:pathLst><a:path w="%d" h="9525"><a:moveTo><a:pt x="0" y="0"/></a:moveTo>'
            '<a:lnTo><a:pt x="%d" y="0"/></a:lnTo></a:path></a:pathLst></a:custGeom>'
            '<a:ln w="28575"><a:solidFill><a:srgbClr val="%s"/></a:solidFill></a:ln>' % (width, width, color))
    _shape(paragraph, 0, y, width, 9525, sppr, z, "Rule")


def _text_run(text, color="000000", font="Arial", size=22, field=None):
    rpr = '<w:rPr><w:rFonts w:ascii="%s" w:hAnsi="%s" w:cs="%s"/><w:color w:val="%s"/><w:sz w:val="%d"/></w:rPr>' % (
        font, font, font, color, size)
    if field:
        return ('<w:r>%s<w:fldChar w:fldCharType="begin"/></w:r><w:r>%s<w:instrText xml:space="preserve"> %s </w:instrText></w:r>'
                '<w:r>%s<w:fldChar w:fldCharType="separate"/></w:r><w:r>%s<w:t>1</w:t></w:r>'
                '<w:r>%s<w:fldChar w:fldCharType="end"/></w:r>' % (rpr, rpr, field, rpr, rpr, rpr))
    return '<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>' % (rpr, text)


_PRINT_DIR = tempfile.mkdtemp(prefix="samar-shots-")


def _print_copy(path, width_cm, dpi=200):
    """A screenshot as embedded: resampled to 200 dpi at its printed width and
    stored as JPEG, so the Word file and its PDF stay small enough to download.
    The committed capture keeps its full resolution."""
    im = PILImage.open(path).convert("RGB")
    target = int(width_cm / 2.54 * dpi)
    if im.width > target:
        im = im.resize((target, round(im.height * target / im.width)), PILImage.LANCZOS)
    out = os.path.join(_PRINT_DIR, os.path.splitext(os.path.basename(path))[0] + ".jpg")
    im.save(out, quality=88, optimize=True)
    return out


def _anchor_paragraph(story):
    """The paragraph that carries a story's anchored drawings: it holds no text
    and is one twip high, so it adds nothing to the header or footer height."""
    p = story.paragraphs[0]
    pPr = p._p.get_or_add_pPr()
    sp = OxmlElement('w:spacing')
    sp.set(qn('w:before'), '0')
    sp.set(qn('w:after'), '0')
    sp.set(qn('w:line'), '14')
    sp.set(qn('w:lineRule'), 'exact')
    pPr.append(sp)
    return p


class Manual(object):
    """A SAMAR document on the QCI letterhead, laid out as the client's Applicant Manual."""

    def __init__(self, doc_title, version_label):
        """doc_title: 'Applicant Handbook'; version_label: 'Version 1 / 23-09-2026'.
        Together they form the footer line, as on the QCI Applicant Manual."""
        self.doc = Document()
        self.doc_title = doc_title
        self.version_label = version_label
        self._step_no = 0
        self._shot_no = 0
        self._current_part = "Front matter"
        self.shots = []          # (figure no, part, caption, filename, present?)

        cp = self.doc.core_properties
        cp.title = "SAMAR Portal - " + doc_title
        cp.author = "Quality Council of India"
        cp.comments = ""

        styles = self.doc.styles
        st = styles['Normal']
        st.font.name = 'Arial'
        st.font.size = Pt(11)
        for name, bold, size, indent in (('toc 1', True, 11, 0), ('toc 2', False, 10.5, 0.6)):
            s = styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
            s.base_style = st
            s.font.bold = bold
            s.font.size = Pt(size)
            s.paragraph_format.left_indent = Cm(indent)
            s.paragraph_format.space_before = Pt(5)
            s.paragraph_format.space_after = Pt(0)

        sec = self.doc.sections[0]
        sec.page_height = PAGE_H
        sec.page_width = PAGE_W
        sec.top_margin = Cm(3.4)
        sec.bottom_margin = Cm(2.6)
        sec.left_margin = MARGIN_X
        sec.right_margin = MARGIN_X
        sec.header_distance = Cm(0.5)
        sec.footer_distance = Cm(0.5)
        sec.different_first_page_header_footer = True
        self._letterhead(sec)
        self._cover_art(sec)

    def _letterhead(self, sec):
        """The running header and footer of the client's manual, piece for piece:
        the blue corner at the top right with the DRDO and QCI pair below it and a
        navy rule across the page; the corner at the bottom left, a blue rule, the
        title / version line and the page number in a blue box. Positions are the
        client's Letter-size ones carried to A4: pieces on the right keep their
        distance from the right edge, pieces in the footer from the bottom edge."""
        W, H = PAGE_W, PAGE_H
        hp = _anchor_paragraph(sec.header)
        cw, ch = 1594424, 352124
        _pic(hp, HEADER_CORNER, W - cw, 0, cw, ch, 10)
        lw, lh = PILImage.open(HEADER_LOGOS).size
        ly_h = 501650
        ly_w = int(ly_h * lw / lh)
        _pic(hp, HEADER_LOGOS, W - 471464 - ly_w, 439419, ly_w, ly_h, 11)
        _rule(hp, 1076383, W, HEADER_RULE, 12)

        fp = _anchor_paragraph(sec.footer)
        fw, fh = 2441430, 721076
        _pic(fp, FOOTER_CORNER, 0, H - fh, fw, fh, 10)
        _rule(fp, H - 781122, W, FOOTER_RULE, 11)
        bw, bh = 329565, 296545
        bx, by = W - 866267, H - 738674
        _shape(fp, bx, by, bw, bh, '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
               '<a:solidFill><a:srgbClr val="%s"/></a:solidFill><a:ln><a:noFill/></a:ln>' % PAGE_BOX, 12, "Page box")
        _shape(fp, bx, by, bw, bh, '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln>',
               13, "Page number",
               txbx='<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>%s</w:p>'
                    % _text_run("", color="FFFFFF", font="Courier New", field="PAGE"),
               anchor="ctr")
        tw = 3600000
        _shape(fp, bx - 712343 - tw, by, tw, bh, '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln>',
               14, "Footer title",
               txbx='<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="0"/></w:pPr>%s</w:p>'
                    % _text_run("%s / %s" % (self.doc_title, self.version_label)),
               anchor="ctr")

    def _cover_art(self, sec):
        """The cover page, held in the first-page header so it sits behind the title:
        the client's cover background (old QCI and DRDO marks and the blue shapes,
        with the retired SAMAR seal removed) and the current SAMAR logo placed where
        the seal was."""
        W, H = PAGE_W, PAGE_H
        cp = _anchor_paragraph(sec.first_page_header)
        _pic(cp, COVER_BG, 0, 0, W, H, 1)
        logo = PILImage.open(SAMAR)
        # A third of the page width, the size of the seal on the client's cover.
        cx = int(W * 0.34)
        cy = int(cx * logo.height / logo.width)
        # Embedded at 300 dpi for its printed width; the committed file is larger.
        target = int(cx / 360000 / 2.54 * 300)
        small = os.path.join(_PRINT_DIR, "logo_samar.png")
        logo.resize((target, round(logo.height * target / logo.width)), PILImage.LANCZOS).save(small, optimize=True)
        _pic(cp, small, (W - cx) // 2, int(H * 0.16), cx, cy, 2)
        _anchor_paragraph(sec.first_page_footer)

    # ---- text blocks ----

    def banner(self, text, toc=1):
        """A section heading as the client's manual draws it: white bold Arial on a
        full-width navy bar. toc: outline level for the Contents (0 = part-level
        entry, 1 = section, None = not listed)."""
        self._step_no = 0        # every procedure restarts its numbering
        p = self.doc.add_paragraph()
        _shade(p._p.get_or_add_pPr(), BAR)
        if toc is not None:
            _outline(p, toc)
        pf = p.paragraph_format
        pf.space_before = Pt(12)
        pf.space_after = Pt(8)
        pf.keep_with_next = True     # a heading must never be stranded at the foot of a page
        r = p.add_run(text)
        r.bold = True
        r.font.color.rgb = WHITE
        r.font.size = Pt(12)
        return p

    def sub(self, text):
        p = self.doc.add_paragraph()
        pf = p.paragraph_format
        pf.space_before = Pt(8)
        pf.space_after = Pt(3)
        pf.keep_with_next = True
        r = p.add_run(text)
        r.bold = True
        r.font.size = Pt(11)
        r.font.color.rgb = BLACK
        return p

    def body(self, text, size=11, italic=False, color=None, space=6):
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        r = p.add_run(text)
        r.font.size = Pt(size)
        r.italic = italic
        if color:
            r.font.color.rgb = color
        p.paragraph_format.space_after = Pt(space)
        return p

    def step(self, text):
        self._step_no += 1
        p = self.doc.add_paragraph()
        pf = p.paragraph_format
        pf.left_indent = Cm(0.95)
        pf.first_line_indent = Cm(-0.6)
        pf.space_after = Pt(3)
        p.add_run("%d.  " % self._step_no).bold = True
        p.add_run(text)
        return p

    def bullet(self, text):
        self.doc.add_paragraph(text, style='List Bullet')

    def bullets(self, items):
        for b in items:
            self.bullet(b)

    def validation(self, text):
        p = self.doc.add_paragraph()
        pf = p.paragraph_format
        pf.left_indent = Cm(0.9)
        pf.space_after = Pt(4)
        r = p.add_run(text)
        r.italic = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = GREY

    def note(self, text):
        t = self.doc.add_table(rows=1, cols=1)
        # A callout must not be clipped mid-sentence by a page break; it moves
        # whole to the next page instead.
        t.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
        cell = t.cell(0, 0)
        _shade(cell._tc.get_or_add_tcPr(), CELL_TINT)
        tcPr = cell._tc.get_or_add_tcPr()
        borders = OxmlElement('w:tcBorders')
        e = OxmlElement('w:left')
        e.set(qn('w:val'), 'single')
        e.set(qn('w:sz'), '24')
        e.set(qn('w:color'), BAR)
        borders.append(e)
        tcPr.append(borders)
        p = cell.paragraphs[0]
        r = p.add_run(text)
        r.font.size = Pt(10.5)
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)

    def code(self, text, caption=None):
        """Monospaced block for commands and payloads. Kept whole across pages."""
        if caption:
            p = self.doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.keep_with_next = True
            r = p.add_run(caption)
            r.bold = True
            r.font.size = Pt(9.5)
            r.font.color.rgb = BLACK
        t = self.doc.add_table(rows=1, cols=1)
        t.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
        cell = t.cell(0, 0)
        _shade(cell._tc.get_or_add_tcPr(), "F4F6F8")
        first = True
        for line in text.strip('\n').split('\n'):
            p = cell.paragraphs[0] if first else cell.add_paragraph()
            first = False
            pf = p.paragraph_format
            pf.space_before = Pt(0)
            pf.space_after = Pt(0)
            r = p.add_run(line)
            r.font.name = 'Consolas'
            r.font.size = Pt(8.5)
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)

    # ---- tables ----

    def simple_table(self, headers, rows, sizes=None, fs=10.5):
        # The sentence introducing a table stays on the table's page.
        self.doc.paragraphs[-1].paragraph_format.keep_with_next = True
        t = self.doc.add_table(rows=1, cols=len(headers))
        t.style = 'Table Grid'
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        hdr = t.rows[0].cells
        for i, h in enumerate(headers):
            _shade(hdr[i]._tc.get_or_add_tcPr(), BAR)
            run = hdr[i].paragraphs[0].add_run(h)
            run.bold = True
            run.font.color.rgb = WHITE
            run.font.size = Pt(fs)
        # A table that runs over a page break repeats its header, so no page ever
        # opens with unlabelled columns.
        trPr = t.rows[0]._tr.get_or_add_trPr()
        th = OxmlElement('w:tblHeader')
        th.set(qn('w:val'), 'true')
        trPr.append(th)
        # Word keeps a row with the next one only through keep-with-next on the
        # row's paragraphs. The header row is always kept with the first data row,
        # so it is never left alone at the foot of a page; a short table is kept
        # whole.
        keep_rows = len(rows) if len(rows) <= 8 else 1
        for c in t.rows[0].cells:
            c.paragraphs[0].paragraph_format.keep_with_next = True
        for k, row in enumerate(rows):
            r_ = t.add_row()
            cantsplit = OxmlElement('w:cantSplit')
            r_._tr.get_or_add_trPr().append(cantsplit)
            cells = r_.cells
            for i, v in enumerate(row):
                cp = cells[i].paragraphs[0]
                cp.add_run(str(v)).font.size = Pt(fs)
                if k < keep_rows - 1:
                    cp.paragraph_format.keep_with_next = True
        if sizes:
            for r_ in t.rows:
                for i, w in enumerate(sizes):
                    r_.cells[i].width = Cm(w * TABLE_SCALE)
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)
        return t

    def menu_table(self, rows):
        """rows = [(menu label, sub-item or '', purpose)]

        A role whose menu has no sub-items gets a two-column table; an empty
        Sub-menu column would otherwise consume a quarter of the width.
        """
        if any((r[1] or "").strip() for r in rows):
            self.simple_table(["Menu", "Sub-menu", "Purpose"], rows, sizes=[4.2, 4.6, 8.4], fs=10)
        else:
            self.simple_table(["Menu", "Purpose"], [[r[0], r[2]] for r in rows],
                              sizes=[5.0, 12.2], fs=10)

    def process_flow(self):
        """The six-step certification flow, as the diagram in the client's manual."""
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(8)
        p.add_run().add_picture(os.path.join(FIGURES_DIR, "process-flow.jpeg"), width=Cm(11.5))

    def role_card(self, who, can, cannot):
        t = self.doc.add_table(rows=3, cols=2)
        t.style = 'Table Grid'
        for i, (lbl, val) in enumerate([("Intended user", who),
                                        ("Functions permitted", can),
                                        ("Functions not permitted", cannot)]):
            c0 = t.cell(i, 0)
            _shade(c0._tc.get_or_add_tcPr(), CELL_TINT)
            r0 = c0.paragraphs[0].add_run(lbl)
            r0.bold = True
            r0.font.size = Pt(10)
            r0.font.color.rgb = BLACK
            c1 = t.cell(i, 1)
            if isinstance(val, list):
                first = True
                for v in val:
                    p = c1.paragraphs[0] if first else c1.add_paragraph()
                    p.add_run("•  " + v).font.size = Pt(10)
                    first = False
            else:
                c1.paragraphs[0].add_run(val).font.size = Pt(10)
            t.rows[i].cells[0].width = Cm(3.8 * TABLE_SCALE)
            t.rows[i].cells[1].width = Cm(13.4 * TABLE_SCALE)
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)

    # ---- structure ----

    def divider(self, part, title, strap=""):
        """Opens a Part on a fresh page as a heading block; the body follows on the
        same page, matching the page structure of the issued handbooks."""
        self._current_part = "%s: %s" % (part, title)
        p = self.doc.add_paragraph()
        # Page-break-before rather than a break paragraph: when the previous Part
        # ends at the foot of a page, a break paragraph spills onto a page of its
        # own and leaves it blank.
        p.paragraph_format.page_break_before = True
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        _outline(p, 0)
        r = p.add_run("%s: %s" % (part, title))
        r.bold = True
        r.font.size = Pt(14)
        r.font.color.rgb = HEAD_BLUE
        if strap:
            p3 = self.doc.add_paragraph()
            p3.paragraph_format.space_after = Pt(6)
            p3.paragraph_format.keep_with_next = True
            r3 = p3.add_run(strap)
            r3.font.size = Pt(10.5)
            r3.font.color.rgb = GREY
            r3.italic = True

    def page_break(self):
        self.doc.add_page_break()

    def cover(self, title):
        """The cover title, live text in blue Calibri as on the client's cover.
        The background and the SAMAR logo come from the first-page header."""
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        # Places the title at 14.4 cm from the top of the page, below the logo.
        p.paragraph_format.space_before = Cm(14.4 - 3.4)
        r = p.add_run(title)
        r.font.name = 'Calibri'
        r.font.size = Pt(48)
        r.font.color.rgb = TITLE_BLUE

    def contents(self):
        """A Word TOC field over the outline levels set by divider() and banner().
        Word fills it on the first field update (export_pdf.ps1 does this before
        exporting), so the page numbers follow the final pagination."""
        self.doc.add_page_break()
        p = self.doc.add_paragraph()
        p.paragraph_format.space_after = Pt(8)
        r = p.add_run("Table of Contents")
        r.bold = True
        r.font.size = Pt(12)
        r.font.color.rgb = HEAD_BLUE
        p = self.doc.add_paragraph()
        r = p.add_run()
        _field(r, 'TOC \\o "1-2" \\h \\z \\u')

    # ---- screenshots ----

    def _emit_shots(self, paths):
        """Landscape captures run the full text width with no caption, as in the
        client's manual; portrait (mobile) captures are laid two to a row so a slot
        of many phone screens stays compact."""
        i = 0
        while i < len(paths):
            w, h = PILImage.open(paths[i]).size
            if w >= h or w >= 1000:
                # A tall browser capture is still a web page, not a phone screen:
                # it is shown alone, as wide as a 16 cm height allows.
                p = self.doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(6); p.paragraph_format.space_after = Pt(8)
                width_cm = min(TEXT_W_CM, 16.0 * w / h)
                p.add_run().add_picture(_print_copy(paths[i], width_cm), width=Cm(width_cm))
                i += 1
            else:
                group = []
                while i < len(paths):
                    gw, gh = PILImage.open(paths[i]).size
                    if gw >= gh or gw >= 1000:
                        break
                    group.append(paths[i]); i += 1
                nrows = int(math.ceil(len(group) / 2.0))
                t = self.doc.add_table(rows=nrows, cols=2); t.alignment = WD_TABLE_ALIGNMENT.CENTER
                for k, gp in enumerate(group):
                    cp = t.cell(k // 2, k % 2).paragraphs[0]; cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    cp.add_run().add_picture(_print_copy(gp, 6.2), width=Cm(6.2))
                self.doc.add_paragraph().paragraph_format.space_after = Pt(2)

    def placeholder(self, fname, cap):
        """Insert the slot's screenshot(s) from SHOTS_DIR; otherwise draw the capture box.

        A slot may carry one file (<fname>) or several (<base>.png, <base>_2.png, ...).
        The filenames are explicit so one capture library serves the master manual
        and both public handbooks.
        """
        self._shot_no += 1
        n = self._shot_no
        base = fname[:-4] if fname.lower().endswith(".png") else fname
        cands = [fname] + ["%s_%d.png" % (base, k) for k in range(2, 40)]
        paths = [os.path.join(SHOTS_DIR, c) for c in cands
                 if os.path.isfile(os.path.join(SHOTS_DIR, c))]
        self.shots.append((n, self._current_part, cap, fname, bool(paths)))

        if paths:
            self._emit_shots(paths)
            return

        t = self.doc.add_table(rows=1, cols=1)
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = t.cell(0, 0)
        _shade(cell._tc.get_or_add_tcPr(), "F4F8FC")
        tcPr = cell._tc.get_or_add_tcPr()
        borders = OxmlElement('w:tcBorders')
        for edge in ('top', 'left', 'bottom', 'right'):
            e = OxmlElement('w:' + edge)
            e.set(qn('w:val'), 'dashed')
            e.set(qn('w:sz'), '12')
            e.set(qn('w:color'), '1B6CB5')
            borders.append(e)
        tcPr.append(borders)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run("[  %s  ]" % fname)
        r.bold = True
        r.font.color.rgb = HEAD_BLUE
        r.font.size = Pt(11)
        p2 = cell.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r2 = p2.add_run(cap)
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = GREY
        for pp in (p, p2):
            pp.paragraph_format.space_before = Pt(10)
            pp.paragraph_format.space_after = Pt(10)
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)

    # ---- output ----

    def save(self, out, checklist_path=None, checklist_title=None):
        self.doc.save(out)
        have = sum(1 for s in self.shots if s[4])
        print("saved:", out)
        print("  paragraphs: %d   tables: %d" % (len(self.doc.paragraphs), len(self.doc.tables)))
        print("  screenshots: %d/%d present" % (have, len(self.shots)))
        for n, part, cap, fname, ok in self.shots:
            if not ok:
                print("    missing: %s  (%s)" % (fname, cap))
        if checklist_path:
            with open(checklist_path, "w", encoding="utf-8") as f:
                f.write("# %s: screenshot checklist\n\n" % checklist_title)
                f.write("Save each screenshot under the **exact filename** given below, in this folder\n\n"
                        "    %s\n\nand then re-run the build script. Any file that is present is inserted "
                        "automatically; any file that is absent retains its dashed capture box, so that the "
                        "document remains buildable at every stage of the capture exercise.\n\n" % SHOTS_DIR)
                f.write("Filenames are shared with the full User Manual, so a screen captured once serves "
                        "every document.\n\n")
                f.write("Capture at a width of **1600 pixels or more**, at 100%% browser zoom, with no real "
                        "organisation or personal data displayed on screen.\n\n")
                f.write("| Fig | File | Part | Screen to be captured | Present |\n")
                f.write("|-----|------|------|-----------------------|:-------:|\n")
                for n, part, cap, fname, ok in self.shots:
                    f.write("| %d | `%s` | %s | %s | %s |\n"
                            % (n, fname, part, cap, "yes" if ok else "-"))
            print("  checklist:", checklist_path)


# ---------------------------------------------------------------------------
# Blocks common to every document, so the wording never drifts between them.
# ---------------------------------------------------------------------------

def about_samar(m):
    """The client's own wording for About SAMAR, used verbatim in every document."""
    m.body("System for Advanced Maturity Assessment and Rating (SAMAR) is a benchmark to measure the maturity of defence "
           "manufacturing and service enterprises. Developed by the Quality Council of India (QCI), the certification is "
           "applicable to start-up, micro, small, medium, and large enterprises.")
    m.body("SAMAR is an outcome of the collaboration between Defence Research and Development Organisation (DRDO) and Quality "
           "Council of India (QCI) to strengthen the defence ecosystem in the country with an objective to further the vision of "
           "making India self-reliant in defence manufacturing and services.")


def part_general_information(m, roles_intro, support_para, unavailability_note=None):
    """Part 1: General Information. Identical in all three documents except for
    the two sentences that differ by audience."""
    from roles_data import ROLE_MATRIX, CAP_HEADERS, CAP_ROWS, CAP_LEGEND

    m.divider("Part 1", "General Information", "Applicable to all users, irrespective of role")

    m.banner("1.1  About SAMAR")
    about_samar(m)
    m.body("SAMAR is accessed through a web portal on a desktop or laptop computer. Assessors are additionally provided a mobile "
           "application, which is designed to function without an internet connection at the assessment site.")

    m.banner("1.2  The eight user roles")
    m.body(roles_intro)
    m.simple_table(["Role", "Designation", "Scope of visibility"],
                   [[a, b, c] for a, b, c in ROLE_MATRIX], sizes=[4.0, 6.4, 6.8], fs=10)
    m.note("The role assigned to a user is displayed alongside the user's name at the top-right of every screen. In the event of an "
           "incorrect role assignment, the SAMAR Operations team is to be intimated. A second account must not be created.")

    m.banner("1.3  Authorisation matrix")
    m.body("The following matrix provides a consolidated statement of the functions permitted to each role. Each column represents a "
           "role and each row a function. It is reproduced here so that the reader may ascertain which office is to be approached in "
           "respect of any given matter.")
    m.simple_table(CAP_HEADERS, CAP_ROWS, sizes=[6.0, 1.15, 1.35, 1.35, 1.3, 1.3, 1.1, 1.3, 1.3], fs=8.5)
    m.body(CAP_LEGEND, size=9, italic=True, color=GREY)

    m.banner("1.4  Logging in")
    m.step("Open the SAMAR portal in a web browser.")
    m.step("Enter the SAMAR ID together with the password.")
    m.validation("Validation: Both fields are mandatory. Passwords are case-sensitive.")
    m.step("Enter the characters shown in the captcha image. Select the refresh icon beside it for a new image.")
    m.validation("Validation: The captcha is not case-sensitive and is valid for five minutes. After an unsuccessful "
                 "attempt a new image is shown and is to be entered afresh.")
    m.step("Select Login.")
    m.step("If prompted, enter the six-digit one-time password (OTP) sent to the registered email address and proceed.")
    m.validation("Validation: The OTP is valid for a limited period. Select Resend if it has lapsed.")
    m.placeholder("shot-01.png", "Login screen: SAMAR ID, password, captcha, Login button")
    m.body("The login screen accepts the following, and validates them as shown.")
    m.simple_table(["Field", "Requirement"], [
        ["SAMAR ID", "Required. This is the login identifier issued to the user (not the email address). Format: "
                     "SAMAR-DDMMYY-N, for example SAMAR-080125-123."],
        ["Password", "Required. 7 to 20 characters. Case-sensitive."],
        ["Captcha", "Required on the web portal. The five characters shown in the image; not case-sensitive. The "
                    "mobile application does not ask for it."],
    ], sizes=[4.0, 13.2], fs=10)
    m.body("During login you may encounter the following messages.")
    m.simple_table(["Situation", "Message shown on screen"], [
        ["A new OTP is requested", "\"A new OTP has been sent to your registered email.\""],
        ["Repeated unsuccessful login attempts",
         "\"Too many login attempts. Please wait a few minutes and try again.\" Login is paused briefly before it "
         "may be tried again."],
        ["Login could not be completed", "\"Unable to log in. Please try again or contact support.\""],
    ], sizes=[6.0, 11.2], fs=10)

    m.banner("1.5  Password reset")
    m.step("On the login screen, select Forgot Password.")
    m.step("Enter your SAMAR ID and the captcha characters, and select Send OTP. A six-digit OTP is sent to your "
           "registered email address.")
    m.step("Enter and confirm a new password, and log in again.")
    m.placeholder("shot-02.png", "Forgot Password and Set New Password screens")
    m.body("The password-reset screens accept the following.")
    m.simple_table(["Field", "Requirement"], [
        ["SAMAR ID", "Required. Format: SAMAR-DDMMYY-N (for example SAMAR-080125-123)."],
        ["Captcha", "Required. The five characters shown in the image; not case-sensitive."],
        ["OTP", "Required. 6 digits, numbers only. Sent to the registered email address; valid for a limited "
                "period and may be resent after 120 seconds."],
        ["New Password", "Required. 7 to 20 characters."],
        ["Confirm Password", "Required. Must match the new password."],
    ], sizes=[4.0, 13.2], fs=10)

    m.banner("1.6  Single active session")
    m.body("For reasons of security, each user account is restricted to one active session per platform: the web "
           "portal and the mobile application are counted separately. Logging in again on the same platform "
           "terminates the previous session on it; a web session and a mobile session may be held at the same "
           "time. If a user is notified of a login that was not initiated by them, the user should log in again "
           "and change the password immediately. Should the occurrence be repeated, the matter is to be reported "
           "to the SAMAR Operations team.")

    m.banner("1.7  The profile menu")
    m.body("Select the user name displayed at the top-right of any screen. The following options are available to every role:")
    m.bullets(["View Profile: displays the user's registered particulars.",
               "Change Password: permits a new password to be set while logged in.",
               "Logout: terminates the session. Confirmation is sought before the session is closed."])
    if unavailability_note:
        m.body(unavailability_note)
    m.placeholder("shot-03.png", "Profile menu in the page header")

    m.banner("1.8  Assistance and support")
    m.body(support_para)
    m.note("Should a maintenance notice be displayed, the system is temporarily unavailable on account of planned maintenance. "
           "Users are requested to attempt access subsequently. No saved data is lost during maintenance.")


def appendix_stages(m, new_page=True):
    if new_page:
        m.page_break()
    m.banner("Appendix A: Application and assessment stages", toc=0)
    m.body("Every application and assessment proceeds through the stages set out below. The nomenclature is uniform across all roles.")
    m.simple_table(["Stage displayed", "Meaning", "Action rests with"], [
        ["Draft", "Under preparation; not yet submitted.", "Enterprise / Unit Admin"],
        ["Approval pending", "Submitted and awaiting the decision of DRDO.", "DRDO Admin"],
        ["Payment pending", "Approved and awaiting remittance of the fee.", "Enterprise / Unit Admin"],
        ["Payment completed", "Fee received; the assessment record has been created.", "Operations Manager"],
        ["Allocation pending", "Awaiting allotment of an assessor team and a date.", "Operations Manager"],
        ["Scheduled", "Assessor team and date confirmed.", "Assessor"],
        ["In progress", "The assessment is being conducted.", "Assessor"],
        ["Quality check", "Submitted and under review by QCI.", "Operations Manager"],
        ["Quality check feedback", "Returned to the assessor with observations.", "Assessor"],
        ["Ready for committee review", "Cleared quality check; awaiting the rating committee.", "Operations Admin"],
        ["Committee review scheduled", "Listed for a committee meeting.", "Operations Admin"],
        ["Committee review feedback", "Clarification sought by the committee.", "Assessor"],
        ["Certified", "Successfully concluded; the certificate has been issued.", "-"],
        ["Rejected", "Not proceeded with. The reasons may be ascertained from the SAMAR Operations team.", "-"],
    ], sizes=[4.6, 8.2, 4.4], fs=10)


GLOSSARY_ALL = [
    ["SAMAR", "The certification scheme and the online system supporting it."],
    ["SAMAR ID", "The unique reference number of a user, to be quoted in all correspondence."],
    ["Enterprise", "The organisation applying for certification."],
    ["Unit", "A single site or factory of the organisation. Each unit is certified separately."],
    ["Application", "A request for the certification of one unit."],
    ["Assessment", "The on-site examination conducted by an assessor against the application."],
    ["Allocation", "The allotment of an assessor team and a date to an assessment."],
    ["Lead assessor", "The assessor who apportions the parameters and makes the final submission."],
    ["Co-assessor", "An assessor who responds to the parameters apportioned to them."],
    ["Parameter", "An area against which the unit is assessed, comprising a set of questions."],
    ["Evidence", "A photograph or file attached in support of a response."],
    ["Quality check (QC)", "The review by QCI of a submitted assessment prior to its placement before the committee."],
    ["Rating committee (RC)", "The panel that reviews the assessment and determines the rating."],
    ["Certification", "The recording of the committee's decision, upon which the certificate is issued."],
    ["Renewal", "A fresh application made prior to the expiry of a certificate, from a pre-filled copy."],
    ["OTP", "A six-digit one-time password despatched by email for verification of identity."],
    ["Synchronisation", "The transmission of data recorded on a mobile device to the SAMAR system."],
    ["Maintenance mode", "A planned period during which access is restricted to the System Admin."],
]


def appendix_glossary(m, terms=None, new_page=True):
    if new_page:
        m.page_break()
    m.banner("Appendix B: Glossary of terms", toc=0)
    m.simple_table(["Term", "Meaning"], terms or GLOSSARY_ALL, sizes=[4.6, 12.6])
