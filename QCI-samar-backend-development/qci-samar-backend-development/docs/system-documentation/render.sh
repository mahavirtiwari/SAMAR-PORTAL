#!/usr/bin/env bash
# Render this document's Mermaid sources with the Webority brand palette plus a
# local CSS override for edge/message label contrast.
#
# The skill's render-diagrams.sh has no --cssFile hook, and mermaid derives
# edge-label text colour from primaryTextColor (white on our palette), so labels
# render white on lavender without the override.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/diagrams"
MMDC="$HOME/.claude/skills/webority/scripts/node_modules/.bin/mmdc"
CSS="$DIR/brand-overrides.css"
WIDTH="${1:-1200}"
SCALE="${2:-3}"

BROWSER=""
for cand in \
  "$LOCALAPPDATA/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files/Microsoft/Edge/Application/msedge.exe"; do
  if [[ -n "$cand" && -x "$cand" ]]; then BROWSER="$cand"; break; fi
done
[[ -n "$BROWSER" ]] || { echo "No Chrome/Edge found" >&2; exit 1; }

CFG="$(mktemp)"
trap 'rm -f "$CFG"' EXIT
printf '{ "executablePath": "%s", "args": ["--no-sandbox"] }\n' "$(cygpath -m "$BROWSER")" > "$CFG"

shopt -s nullglob
for src in "$DIR"/*.mmd; do
  out="${src%.mmd}.png"
  echo "  $(basename "$src") -> $(basename "$out")"
  "$MMDC" --input "$src" --output "$out" \
    --width "$WIDTH" --scale "$SCALE" \
    --backgroundColor white \
    --cssFile "$CSS" \
    --puppeteerConfigFile "$CFG" >/dev/null
done
echo "Done."
