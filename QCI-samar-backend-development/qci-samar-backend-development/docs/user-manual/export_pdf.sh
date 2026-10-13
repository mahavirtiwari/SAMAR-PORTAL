#!/bin/bash
# Export built manuals to PDF through Microsoft Word on a Mac, filling the Contents
# first. The Mac counterpart of export_pdf.ps1.
#
#   bash export_pdf.sh "$HOME/Downloads/SAMAR Portal - Applicant Handbook.docx" [...]
#
# Needs Microsoft Word, and python3 with PyMuPDF (pip install pymupdf).
# Word is sandboxed: a file outside its container raises an access prompt that
# blocks scripting, so each docx is exported from inside the container and the
# results are copied back beside the original. The docx is saved back with the
# Contents filled in.
set -euo pipefail

WORK="$HOME/Library/Containers/com.microsoft.Word/Data/samar-export"
mkdir -p "$WORK"

for SRC in "$@"; do
    DIR="$(cd "$(dirname "$SRC")" && pwd)"
    NAME="$(basename "$SRC" .docx)"
    cp "$SRC" "$WORK/$NAME.docx"
    osascript - "$WORK/$NAME.docx" "$WORK/$NAME.pdf" <<'APPLESCRIPT'
on run argv
    set docPath to item 1 of argv
    set pdfPath to item 2 of argv
    tell application "Microsoft Word"
        set nm to do shell script "basename " & quoted form of docPath
        open POSIX file docPath
        set d to missing value
        repeat 120 times
            try
                set d to document nm
                exit repeat
            end try
            delay 1
        end repeat
        if d is missing value then error "document did not open: " & nm
        -- Word answers "missing value" for a document it has not finished loading.
        delay 3
        -- Not "update field": on a TOC field that raises a modal dialog.
        update table of contents 1 of d
        repaginate d
        -- Filling the Contents moves the pages after it; a second pass settles the numbers.
        update table of contents 1 of d
        save d
        save as d file name pdfPath file format format PDF
        close d saving no
    end tell
end run
APPLESCRIPT
    python3 - "$WORK/$NAME.pdf" "$DIR/$NAME.pdf" <<'PY'
import sys, io, pymupdf
from PIL import Image
# Word stores some large pictures (the cover background) losslessly, several MB
# each. Only those are re-encoded as JPEG; nothing is resampled, so the small
# header and footer images are left exactly as Word wrote them.
d = pymupdf.open(sys.argv[1])
done = set()
for page in d:
    for info in page.get_images(full=True):
        xref, smask, w = info[0], info[1], info[2]
        if xref in done or smask or w < 1000 or d.xref_get_key(xref, "Filter")[1] != "/FlateDecode":
            continue
        pix = pymupdf.Pixmap(d, xref)
        if pix.alpha or pix.n != 3:
            continue
        buf = io.BytesIO()
        Image.frombytes("RGB", (pix.width, pix.height), pix.samples).save(buf, "JPEG", quality=88)
        page.replace_image(xref, stream=buf.getvalue())
        done.add(xref)
d.save(sys.argv[2], garbage=4, deflate=True)
PY
    cp "$WORK/$NAME.docx" "$DIR/$NAME.docx"
    echo "exported: $DIR/$NAME.pdf"
done
