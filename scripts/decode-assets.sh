#!/usr/bin/env bash
# Decode resume and screenshot sidecars (*.b64) into the files the site links to.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
found=0
while IFS= read -r -d '' f; do
  out="${f%.b64}"
  python3 - "$f" "$out" << 'PY'
import base64, sys, pathlib
src, dest = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
dest.write_bytes(base64.b64decode(src.read_text()))
PY
  echo "Decoded $out"
  found=1
done < <(find "$ROOT" \( -name '*.pdf.b64' -o -name '*.webp.b64' \) -print0)

if [[ "$found" -eq 0 ]]; then
  echo "No .b64 assets found."
fi
