# QCI SAMAR - Technical System Documentation

Source for the client-facing technical documentation delivered to Quality Council of India. The `.docx` is a build artefact: **edit the sources here and rebuild, never edit the Word file directly** - the next build would overwrite it.

## Rebuild

```bash
bash make.sh            # build + both delivery gates
bash make.sh --no-qa    # build only
```

Output: `QCI-SAMAR-Technical-System-Documentation.docx` (71 pages).

## Layout

| Path | What it is |
|---|---|
| `build.js` | Assembles the document: cover, document control, contents, then each section in order. |
| `src/01-intro.js` … `src/11-appendices.js` | One module per section. Each exports a function returning an array of docx elements. This is where the prose lives. |
| `src/_step.js` | Numbered-step helper (see "Why the extra scripts" below). |
| `diagrams/*.mmd` | Mermaid sources for the 8 figures. |
| `diagrams/*.png` | Rendered figures. Committed so the document rebuilds without Chrome or the Mermaid CLI. |
| `diagrams/brand-overrides.css` | CSS applied at render time; required, see below. |
| `render.sh` | Re-renders every `.mmd` to `.png`. Only needed if you change a diagram. |
| `fix-layout.py` | Post-processing pass over the generated document. Required. |
| `make.sh` | The whole pipeline. |
| `visual-qa.sh` | Renders the finished document to per-page PNGs for inspection. |

## Editing

**Text**: edit the relevant `src/*.js` and rebuild. Prose lives in `H.p(...)`, tables in `H.makeTable(headers, rows, widths)`.

**Table column widths must sum to 9746** (the A4 content width in DXA). A build with mismatched widths renders a table that overflows the margin. Check with:

```bash
node -e "const s=require('fs').readFileSync('src/03-functional.js','utf8');
for(const m of s.matchAll(/\[\s*((?:\d+\s*,\s*)+\d+)\s*\]/g)){
  const n=m[1].split(',').map(Number); const t=n.reduce((a,b)=>a+b,0);
  if(t!==9746 && n.every(x=>x>200)) console.log('BAD',n,t);}"
```

**Diagrams**: edit the `.mmd`, run `bash render.sh`, then rebuild. Requires Chrome or Edge installed.

**No curly quotes or em dashes** anywhere in `src/`. They break the build (the pipeline's Python pass reads the XML as cp1252 on Windows) and the content gate rejects em dashes in client-facing documents.

## Why the extra scripts

The skill's pipeline injects only `document.xml` and `numbering.xml` into the brand template - `styles.xml` stays as the template's. Three consequences are handled by `fix-layout.py`, and it must run between authoring and injection:

1. The template's `Heading3` style carries a `numPr` pointing at the bullet list, so every level-3 heading renders with a stray bullet. The pass cancels it with `numId 0`.
2. Nothing sets `keepNext`, so headings orphan at page feet and lead-in sentences separate from the tables they introduce.
3. `space_after_tables.py` skips inserting a gap when a heading follows a table, assuming the heading style carries before-spacing. The template's does not.

`diagrams/brand-overrides.css` is likewise not optional. Mermaid derives edge-label text colour and sequence-diagram arrow colour from `primaryTextColor`, which is white on the Webority palette - **without the override every sequence diagram renders with invisible white-on-white arrows**.

## Fonts

Josefin Sans must be installed, as **static instances with flattened vertical metrics**. The variable build from the google/fonts repo declares `usWinAscent 1242` against a 1000-unit em, which makes Word slice the footer on every page and misrender `f` as `t` inside table cells. See the project memory note `josefin-sans-static-not-variable`.

## Gates

Both run in `make.sh` and both must pass before the document goes out:

- `check-content.sh` - banned phrases, em dashes, currency and date formats, table layout. Expect `0 issues`; the single SRS warning is a false positive from passing `--type=srs`, which is the nearest available type.
- `visual-qa.sh` - renders every page to `qa/page-*.png`. Inspect them, ideally via a subagent so the images stay out of the main context. Structural validation does not catch layout defects.

## Provenance

Every statement was verified against the source of the four repositories rather than taken from their existing documentation, which in a number of places describes behaviour the code does not have.

Version 0.1, 22-Jul-2026. Reissue as 1.0 once reviewed - update the row in `build.js`.
