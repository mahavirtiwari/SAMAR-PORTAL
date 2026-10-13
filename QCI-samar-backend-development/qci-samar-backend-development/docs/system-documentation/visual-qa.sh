#!/usr/bin/env bash
# Local visual gate for this document.
#
# The skill's visual-qa.sh requires LibreOffice, which is not installed on this
# machine. Microsoft Word is, and it is the renderer the client will actually use,
# so fidelity here is better than the LibreOffice path. PDF is rasterised with
# PyMuPDF (already present) rather than poppler.
#
# Usage: bash visual-qa.sh <input.docx> [out-dir]
set -euo pipefail

IN="${1:?usage: visual-qa.sh <input.docx> [out-dir]}"
OUT="${2:-$(dirname "$IN")/qa}"

IN_WIN="$(cygpath -w "$(readlink -f "$IN")")"
PDF_WIN="${IN_WIN%.docx}.pdf"

rm -rf "$OUT"; mkdir -p "$OUT"

powershell -NoProfile -NonInteractive -Command "
  \$w = New-Object -ComObject Word.Application
  \$w.Visible = \$false
  \$w.DisplayAlerts = 0
  try {
    \$d = \$w.Documents.Open('$IN_WIN', \$false, \$true)
    \$d.ExportAsFixedFormat('$PDF_WIN', 17)
    \$d.Close(\$false)
  } finally { \$w.Quit() }
" >/dev/null

PDF_UNIX="$(cygpath -u "$PDF_WIN")"
[[ -f "$PDF_UNIX" ]] || { echo 'PDF export failed' >&2; exit 1; }

OUT_WIN="$(cygpath -m "$(readlink -f "$OUT")")"
python - "$PDF_WIN" "$OUT_WIN" <<'PY'
import sys, fitz
pdf, out = sys.argv[1], sys.argv[2]
doc = fitz.open(pdf)
for i, page in enumerate(doc, 1):
    page.get_pixmap(dpi=110).save(f"{out}/page-{i:03d}.png")
print(f"pages: {len(doc)}")
PY

echo "PDF:    $PDF_UNIX"
echo "Images: $OUT"
