#!/usr/bin/env bash
#
# Zip the application's JavaScript straight from the repo.
#
# WHY A SCRIPT AND NOT JUST `zip *.js`
# ------------------------------------
# There are older copies of several of these files in other folders — the
# Cowork folder holds a loan-module-engine.js from June that is half the size
# of the real one and contains none of the current fixes. Zipping the wrong
# directory produces an archive that looks complete and ships stale logic,
# which is the single most expensive mistake this project has already made
# twice. So this script takes the repo path explicitly, checks every file is
# present before it writes anything, and prints enough for you to confirm the
# vintage before you send it.
#
# USAGE
#   ./zip-js.sh                      # writes pcs-loan-module-js.zip here
#   ./zip-js.sh ~/somewhere/out.zip
#
set -euo pipefail

REPO="${REPO:-$HOME/Documents/GitHub/Incomemodulev3}"
SRC="$REPO/Incomemodulev3"
OUT="${1:-$(pwd)/pcs-loan-module-js.zip}"

[ -d "$SRC" ] || { echo "Source not found: $SRC" >&2
                   echo "Set REPO=/path/to/Incomemodulev3 and re-run." >&2; exit 1; }

# Every .js the browser loads from our own origin. Keep in step with the
# <script src> tags in loan-module-v4-builder.html.
FILES="
loan-module-engine.js
loan-module-instruments.js
loan-module-analytics.js
portf-excel-parser.js
demo-assistant-kb.js
demo-assistant-kb-ifrs.js
demo-assistant-system-prompt.js
"

echo "Source: $SRC"
echo

MISSING=""
for f in $FILES; do [ -f "$SRC/$f" ] || MISSING="$MISSING $f"; done
if [ -n "$MISSING" ]; then
  echo "ABORT — not found in source:$MISSING" >&2
  echo "Nothing written. Check REPO points at the working repo." >&2
  exit 1
fi

# Vintage check. These four markers were added at different points this week;
# an engine missing them is not the current one however plausible its name.
echo "Engine vintage check (loan-module-engine.js):"
for m in _acqConsideration AMORT_TYPES bandBpsOn rfrForecastIsAllIn; do
  n=$(grep -c -- "$m" "$SRC/loan-module-engine.js" || true)
  if [ "$n" -gt 0 ]; then printf '   ok      %s\n' "$m"
  else                    printf '   MISSING %s   <- stale engine, do not ship\n' "$m"; fi
done
echo

rm -f "$OUT"
( cd "$SRC" && zip -q -X "$OUT" $FILES )

echo "Contents:"
unzip -l "$OUT" | sed -n '4,$p' | head -n -2 | awk '{printf "   %-36s %9s bytes\n", $4, $1}'
echo
echo "Written: $OUT"
echo "Total:   $(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT") bytes"
echo
echo "Note: this is JavaScript only. The application does not run without"
echo "loan-module-v4-builder.html — use package-for-handover.sh for the"
echo "complete deployable set."
