#!/bin/sh
#
# Copy everything the PCS Loan Module needs, and nothing else.
#
#   ./deploy.sh /path/to/webroot/pocs/pe-loan-integration
#
# The app is EIGHT files. Copying some of them leaves the page looking
# current — correct version label, no errors — while behaving like an older
# build. That is how two accounting fixes went missing: the HTML shipped, the
# engine beside it did not, and nothing said so until the numbers were wrong.
#
# This script copies all of them, then prints the hashes so you can compare
# against what the browser reports.
#
set -e

DEST="$1"
SRC="$(cd "$(dirname "$0")" && pwd)/Incomemodulev3"

if [ -z "$DEST" ]; then
  echo "usage: ./deploy.sh <destination-directory>" >&2
  echo "   eg: ./deploy.sh /var/www/pocs/pe-loan-integration" >&2
  exit 1
fi
[ -d "$DEST" ] || { echo "deploy: destination not found: $DEST" >&2; exit 1; }

FILES="loan-module-v4-builder.html
portf-excel-parser.js
loan-module-engine.js
loan-module-instruments.js
loan-module-analytics.js
demo-assistant-kb.js
demo-assistant-system-prompt.js
build-manifest.json"

sha_of() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -c1-16
  else openssl dgst -sha256 "$1" | sed -E 's/.*= *//' | cut -c1-16
  fi
}

# Check everything exists BEFORE copying anything. A half-finished copy is the
# exact state this script exists to prevent.
MISSING=""
for f in $FILES; do
  [ -f "$SRC/$f" ] || MISSING="$MISSING $f"
done
if [ -n "$MISSING" ]; then
  echo "deploy: ABORTED — missing from $SRC:$MISSING" >&2
  [ -f "$SRC/build-manifest.json" ] || \
    echo "        (build-manifest.json is written by .githooks/pre-commit — commit once, or it is optional)" >&2
  exit 1
fi

echo "Deploying to $DEST"
echo
for f in $FILES; do
  cp "$SRC/$f" "$DEST/$f"
  printf '  %-34s %s\n' "$f" "$(sha_of "$SRC/$f")"
done

echo
if [ -f "$SRC/build-manifest.json" ]; then
  VER=$(grep '"version"' "$SRC/build-manifest.json" | head -1 | sed -E 's/.*"version" *: *"([^"]*)".*/\1/')
  echo "Deployed $VER · $(echo "$FILES" | wc -l | tr -d ' ') files"
else
  echo "Deployed $(echo "$FILES" | wc -l | tr -d ' ') files"
fi
echo
echo "Now hard-reload the page (Cmd/Ctrl+Shift+R)."
echo "If anything did not make it, a red banner appears at the top of the screen"
echo "naming the file. For detail, run in the console:  await pcsVersion()"
