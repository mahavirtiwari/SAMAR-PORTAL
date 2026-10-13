#!/usr/bin/env bash
# Finalize the built .docx for delivery:
#   1. Bake the table-of-contents — docx-js emits a TOC field with no computed
#      result, so Word shows it blank until the field is updated. Open in Word,
#      update all fields + the TOC, and SAVE, so the delivered file displays the
#      contents on open without the reader pressing F9.
#   2. Produce a tracked-changes review copy by comparing a baseline .docx
#      against the finalized one (Word Legal Blackline / CompareDocuments), so a
#      reviewer sees every change as accept/reject revisions. The clean customer
#      copy is left without revisions.
#
# Usage: bash finalize.sh <doc.docx> [baseline.docx]
#   - With no baseline: just bakes the TOC in place.
#   - With a baseline: also writes <doc>-changes.docx (tracked changes vs baseline).
set -euo pipefail

DOC="${1:?usage: finalize.sh <doc.docx> [baseline.docx]}"
BASE="${2:-}"

DOC_WIN="$(cygpath -w "$(readlink -f "$DOC")")"
CHANGES_WIN=""
BASE_WIN=""
if [[ -n "$BASE" ]]; then
  BASE_WIN="$(cygpath -w "$(readlink -f "$BASE")")"
  CHANGES_WIN="${DOC_WIN%.docx}-changes.docx"
fi

powershell -NoProfile -NonInteractive -Command "
  \$w = New-Object -ComObject Word.Application
  \$w.Visible = \$false
  \$w.DisplayAlerts = 0
  try {
    # --- 1. bake TOC into the delivered file ---
    \$d = \$w.Documents.Open('$DOC_WIN', \$false, \$false)
    try { \$d.Fields.Update() | Out-Null } catch {}
    for (\$i = 1; \$i -le \$d.TablesOfContents.Count; \$i++) { \$d.TablesOfContents.Item(\$i).Update() }
    \$d.Repaginate()
    \$d.Save()

    # --- 2. tracked-changes review copy vs baseline ---
    if ('$BASE_WIN' -ne '') {
      \$base = \$w.Documents.Open('$BASE_WIN', \$false, \$true)
      # CompareDocuments(original=base, revised=finalized) -> new doc with revisions
      \$cmp = \$w.CompareDocuments(\$base, \$d, 2, 1, \$true, \$true, \$false)
      \$cmp.SaveAs2('$CHANGES_WIN', 16)
      \$cmp.Close(\$false)
      \$base.Close(\$false)
    }
    \$d.Close(\$false)
  } finally { \$w.Quit() }
" >/dev/null

echo "baked TOC: $DOC"
[[ -n "$BASE" ]] && echo "tracked-changes copy: ${DOC%.docx}-changes.docx (compared vs $BASE)"
