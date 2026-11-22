#!/usr/bin/env bash
# Merge a record into data/applications.json (optional), copy resume and
# screenshot assets, then commit and push.
#
# Usage:
#   ./update.sh /path/to/record.json
#   ./update.sh                 # commit and push the current tree
#   ./update.sh --no-push ...   # skip git push (still commits if needed)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

NO_PUSH=0
RECORD=""
for arg in "$@"; do
  case "$arg" in
    --no-push) NO_PUSH=1 ;;
    --help|-h)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      if [[ -n "$RECORD" ]]; then
        echo "Unexpected argument: $arg" >&2
        exit 2
      fi
      RECORD="$arg"
      ;;
  esac
done


write_b64() {
  python3 - "$1" << 'PY'
import base64, pathlib, sys
path = pathlib.Path(sys.argv[1])
out = path.with_name(path.name + ".b64")
out.write_bytes(base64.b64encode(path.read_bytes()))
print(f"Wrote {out}")
PY
}

phone_pattern='(\+[0-9]{1,3}[ .-]?)?\(?[0-9]{2,4}\)?[ .-][0-9]{3,4}[ .-][0-9]{3,4}|\+[0-9]{8,}'

copy_resume() {
  local id="$1" src="$2"
  local dest="$ROOT/resumes/$id/resume.pdf"
  if [[ ! -f "$src" ]]; then
    echo "Resume not found: $src" >&2
    exit 1
  fi
  if command -v pdftotext >/dev/null 2>&1; then
    if pdftotext "$src" - | grep -Eqi "$phone_pattern"; then
      echo "Refusing to copy $src: a phone number was found in the PDF." >&2
      exit 1
    fi
  else
    echo "Warning: pdftotext not found; skipped phone check on $src" >&2
  fi
  mkdir -p "$ROOT/resumes/$id"
  cp "$src" "$dest"
  echo "Copied resume -> resumes/$id/resume.pdf"
  write_b64 "$dest"
}


copy_screenshot() {
  local id="$1" src="$2"
  local dest_dir="$ROOT/screenshots/$id"
  local dest="$dest_dir/confirmation.webp"
  if [[ ! -f "$src" ]]; then
    echo "Screenshot not found: $src" >&2
    exit 1
  fi
  mkdir -p "$dest_dir"
  python3 - "$src" "$dest" << 'PY'
import sys
from PIL import Image

src, dest = sys.argv[1], sys.argv[2]
im = Image.open(src)
if im.mode == "RGBA":
    bg = Image.new("RGB", im.size, (255, 255, 255))
    bg.paste(im, mask=im.split()[-1])
    im = bg
else:
    im = im.convert("RGB")
max_w = 1200
if im.width > max_w:
    im = im.resize((max_w, int(im.height * max_w / im.width)), Image.Resampling.LANCZOS)
im.save(dest, "WEBP", quality=82, method=6)
print(f"Wrote screenshot -> {dest}")
PY
  echo "Note: check the screenshot for phone numbers, email, address, or salary asks before pushing."
  write_b64 "$dest"
}


if [[ -n "$RECORD" ]]; then
  if [[ ! -f "$RECORD" ]]; then
    echo "Record file not found: $RECORD" >&2
    exit 1
  fi
  python3 - "$ROOT" "$RECORD" << 'PY'
import json, os, sys

root, record_path = sys.argv[1], sys.argv[2]
data_path = os.path.join(root, "data", "applications.json")

with open(record_path, encoding="utf-8") as f:
    record = json.load(f)

if "applications" in record and isinstance(record["applications"], list):
    incoming = record["applications"]
    updated = record.get("updated")
else:
    incoming = [record]
    updated = record.get("dataUpdated") or record.get("updated")

required = ["id"]
for item in incoming:
    missing = [key for key in required if not item.get(key)]
    if missing:
        raise SystemExit(f"Record missing required field(s): {', '.join(missing)}")

# Source path fields are for the shell script, not the public JSON
sources = {}
for item in incoming:
    sources[item["id"]] = {
        "resumeSource": item.pop("resumeSource", None) or item.pop("resumeSrc", None),
        "screenshotSource": item.pop("screenshotSource", None) or item.pop("screenshotSrc", None),
    }

os.makedirs(os.path.dirname(data_path), exist_ok=True)
if os.path.exists(data_path):
    with open(data_path, encoding="utf-8") as f:
        data = json.load(f)
else:
    data = {"updated": "", "applications": []}

apps = data.setdefault("applications", [])
by_id = {app.get("id"): i for i, app in enumerate(apps)}

from datetime import date
data["updated"] = updated or date.today().isoformat()

for item in incoming:
    item_id = item["id"]
    if sources[item_id]["resumeSource"]:
        item["resume"] = f"resumes/{item_id}/resume.pdf"
    if sources[item_id]["screenshotSource"]:
        item["screenshot"] = f"screenshots/{item_id}/confirmation.webp"
    if item_id in by_id:
        merged = dict(apps[by_id[item_id]])
        merged.update({k: v for k, v in item.items() if v is not None})
        apps[by_id[item_id]] = merged
        print(f"Updated record {item_id}")
    else:
        apps.append(item)
        print(f"Added record {item_id}")

    if sources[item_id]["resumeSource"]:
        print(f"RESUME_SOURCE {item_id}={sources[item_id]['resumeSource']}")
    if sources[item_id]["screenshotSource"]:
        print(f"SCREENSHOT_SOURCE {item_id}={sources[item_id]['screenshotSource']}")

with open(data_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("Wrote data/applications.json")
PY

  # Copy any assets the record pointed at
  while IFS= read -r line; do
    if [[ "$line" == RESUME_SOURCE* ]]; then
      id="${line#RESUME_SOURCE }"
      src="${id#*=}"
      id="${id%%=*}"
      copy_resume "$id" "$src"
    elif [[ "$line" == SCREENSHOT_SOURCE* ]]; then
      id="${line#SCREENSHOT_SOURCE }"
      src="${id#*=}"
      id="${id%%=*}"
      copy_screenshot "$id" "$src"
    fi
  done < <(python3 - "$ROOT" "$RECORD" << 'PY'
# Re-emit source lines only (merge already happened). Read the original record again.
import json, os, sys
record_path = sys.argv[2]
with open(record_path, encoding="utf-8") as f:
    record = json.load(f)
incoming = record["applications"] if "applications" in record and isinstance(record.get("applications"), list) else [record]
for item in incoming:
    item_id = item.get("id")
    resume = item.get("resumeSource") or item.get("resumeSrc")
    shot = item.get("screenshotSource") or item.get("screenshotSrc")
    if resume:
        print(f"RESUME_SOURCE {item_id}={resume}")
    if shot:
        print(f"SCREENSHOT_SOURCE {item_id}={shot}")
PY
)
fi

if [[ ! -d "$ROOT/.git" ]]; then
  echo "No git repository in $ROOT; files were updated locally only."
  exit 0
fi

git add -A
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  if [[ -n "$RECORD" ]]; then
    msg="Update application record"
    # Prefer a more specific message when a single id is present
    id_guess="$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('id') or (d['applications'][0]['id'] if 'applications' in d and d['applications'] else ''))" "$RECORD" 2>/dev/null || true)"
    if [[ -n "${id_guess:-}" ]]; then
      msg="Update ${id_guess}"
    fi
  else
    msg="Update application tracker"
  fi
  git commit -m "$msg"
fi

if [[ "$NO_PUSH" -eq 1 ]]; then
  echo "Skipped push (--no-push)."
  exit 0
fi

if git remote get-url origin >/dev/null 2>&1; then
  git push origin HEAD
  echo "Pushed to origin."
else
  echo "No git remote named origin; skipped push."
fi
