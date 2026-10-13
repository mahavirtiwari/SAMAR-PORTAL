#!/usr/bin/env bash
# Build the QCI SAMAR Technical System Documentation end to end.
#
#   bash make.sh            build + both delivery gates
#   bash make.sh --no-qa    build only
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
OUT="$PWD/QCI-SAMAR-Technical-System-Documentation.docx"
SKILL="$HOME/.claude/skills/webority/scripts"

_tmp="$(node -e 'process.stdout.write(require("os").tmpdir())')"
export DOCX_BUILD_DIR="$(cygpath -m "$(mktemp -d "$(cygpath -u "$_tmp")/webority_docx_build.XXXXXX")")"

echo "1/4 authoring"
node build.js >/dev/null

echo "2/4 layout fixes"
python fix-layout.py "$(cygpath -u "$DOCX_BUILD_DIR")/body_only.docx"

echo "3/4 template injection"
bash "$SKILL/inject-and-pack.sh" "$OUT" 2>&1 | grep -E "space_after|sectPr count|numIds|refs resolve|built:"

if [[ "${1:-}" == "--no-qa" ]]; then exit 0; fi

echo "4/4 delivery gates"
bash "$SKILL/check-content.sh" "$OUT" --type=srs 2>&1 | tail -3
rm -rf qa
bash "$SKILL/visual-qa.sh" "$OUT" qa 2>&1 | head -2
