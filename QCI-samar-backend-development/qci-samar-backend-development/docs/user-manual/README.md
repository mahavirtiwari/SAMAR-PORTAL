---
title: "User Manual Toolkit"
category: "documentation"
tags: ["user-manual", "handbook", "docx", "documentation"]
last_updated: "2026-09-23"
version: "1.2"
---

# User Manual Toolkit

Source for the SAMAR end-user documents. The `.docx` files are **generated**: they are not edited by hand and are not committed. Edit the scripts here and rebuild.

## The three documents

| Script | Produces | Audience | Screenshots used |
|---|---|---|---|
| `build_docx.py` | `SAMAR Portal - User Manual.docx` | Internal: all nine roles | `shot-01` to `shot-34` |
| `build_assessor_docx.py` | `SAMAR Portal - Assessor Handbook.docx` | Public: empanelled assessors | `shot-01` to `03`, `shot-13` to `18` |
| `build_applicant_docx.py` | `SAMAR Portal - Applicant Handbook.docx` | Public: applicant organisations | `shot-01` to `shot-12` |

All three are laid out in the format of the QCI Applicant Manual that the client issued: its cover, its running header and footer, navy section bars, justified Arial body text, full-width screenshots without captions and a "Table of Contents" page. The User Manual and the Assessor Handbook share Part 1 (general information, the eight roles and the authorisation matrix) from `samar_common.py`, so that wording cannot drift. The Applicant Handbook is deliberately short, in the spirit of the client's manual: it carries its own six-section Part 1 and drops the role matrix, the authorisation matrix, the role cards, the field-format tables and the glossary. About SAMAR is the client's own wording, held once in `about_samar()` and used by all three.

## The letterhead

Every piece of the letterhead is a drawing anchored to the page, as in the client's file, so none of it moves with the text:

- **Cover** (first-page header): `logos/cover_background.jpg` is the client's cover background carried to A4, with its original QCI and DRDO marks and blue shapes kept and the retired SAMAR seal removed. `logos/logo_samar.png`, the current SAMAR 2.0 logo, is placed where the seal was. The title is live text in blue Calibri.
- **Running header**: `logos/header_corner.png` at the top right, `logos/header_logos.png` (the DRDO and QCI pair, built from the current logo files) below it, and a navy rule across the page.
- **Running footer**: `logos/footer_corner.png` at the bottom left, a blue rule, the "Title / Version / date" line and the page number in a blue box.

The corner shapes are the client's own images. Positions are the client's Letter-size ones carried to A4, measured from the nearer page edge. `figures/process-flow.jpeg` is the client's six-step certification diagram, used by `process_flow()`.

## Files

| File | Purpose |
|---|---|
| `samar_common.py` | The `Manual` class (page setup, cover and letterhead, headings, tables, callouts, part headings, the Contents field, screenshot placeholders) plus the shared blocks (About SAMAR, Part 1, Appendix A, the glossary) |
| `roles_data.py` | The eight-role matrix and the authorisation matrix, derived from the backend `RoleSeeder`, route middleware and policies |
| `build_docx.py` | User Manual |
| `build_assessor_docx.py` | Assessor Handbook |
| `build_applicant_docx.py` | Applicant Handbook |
| `logos/` | Cover background, current SAMAR logo, header logo pair, header and footer corner shapes |
| `figures/` | Fixed diagrams (the certification process flow) |
| `screenshots/` | The committed screenshot library the builds read (see below) |
| `export_pdf.sh` | Mac export through Word: fills the Contents, saves the docx, writes the PDF beside it |
| `export_pdf.ps1` | The same export on Windows |

## Building

Requires `python-docx` and `Pillow`:

```bash
pip install python-docx pillow
cd docs/user-manual
python build_docx.py
python build_assessor_docx.py
python build_applicant_docx.py
```

Each script writes its `.docx` to `~/Downloads` (override with `SAMAR_OUT_DIR`) and prints which screenshots are still missing.

Then export through Word, which fills the Contents:

```bash
bash export_pdf.sh "$HOME/Downloads/SAMAR Portal - Applicant Handbook.docx" \
                   "$HOME/Downloads/SAMAR Portal - Assessor Handbook.docx" \
                   "$HOME/Downloads/SAMAR Portal - User Manual.docx"
```

`export_pdf.sh` needs Microsoft Word. The builds embed each screenshot resampled to 200 dpi at its printed width, so the Word files and PDFs stay small enough to serve as downloads while the committed captures keep full resolution.

## Screenshots

All three documents draw on one capture library, addressed **by filename**, so each screen is captured once and appears in every document that references it. The library is committed at `screenshots/` (override with `SAMAR_SHOTS_DIR`).

Drop in `shot-NN.png` (or `shot-NN_2.png`, `_3` and so on for a slot with several captures) and re-run the build. A file that is present is inserted automatically at full text width; a file that is absent keeps its dashed capture box, so every document is buildable at any stage of the capture exercise. Portrait phone screens are laid two to a row; a tall browser capture is shown alone, up to 16 cm high.

Each build writes its own checklist into that folder (`SCREENSHOT-CHECKLIST.md`, `-ASSESSOR.md`, `-APPLICANT.md`) listing the exact filenames still wanted.

Capture at 1600px wide or more, 100% browser zoom, with no real organisation or personal data on screen.

## Conventions

- **Formal register throughout**: these are government-facing documents. Impersonal constructions ("the fee is to be remitted"), no contractions, British spelling.
- **Headings** carry keep-with-next; **tables** repeat their header row across page breaks and their rows do not split; **callout boxes** do not split. Do not remove these: they were added to fix real pagination defects.
- **Section numbering** is written into the banner text by hand (`m.banner("2.4  Creating an application")`); it is not automatic. Renumber the whole Part when inserting a section, and check any cross-references ("paragraph 2.5").
- **The Contents** is a Word TOC field over outline levels: `divider()` titles and `banner(..., toc=0)` are part-level entries, ordinary banners are section entries, `toc=None` keeps a banner out. It is empty until Word updates it; the export scripts do that.
- **The version** appears in the footer of every page, from the one `VERSION` constant in each script. The number is named by the product owner, never bumped in passing.

## Verifying a change

Export to PDF and read the pages, rather than trusting the `.docx`. Pagination defects (stranded headings, split callouts, tables losing their header row) are only visible once rendered. Render the PDF to page images (PyMuPDF) and check every page: cover logo and title, header corner, logo pair and rule, footer line and page box, no stray branding, no old seal.

## Related

- [Documentation index](../INDEX.md)
- [Authorization / RBAC](../20-features/22-authorization-rbac.md): the source of truth for the role definitions in `roles_data.py`
