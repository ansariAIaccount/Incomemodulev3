#!/bin/sh
#
# Verify build-manifest.json matches the files in the tree.
#
# WHY THIS EXISTS
# ---------------
# The manifest is written by .githooks/pre-commit, which runs on a developer's
# machine. Hooks are not cloned with a repo and are not enforced by the server,
# so a commit made on a laptop where the hook was never installed produces a
# manifest describing an older build — while the app keeps reporting the
# version label the HTML carries. The page then looks current and runs stale
# logic. That has already happened here: cache-busters sat at ?v=4.4 while the
# version said 4.8, and two accounting fixes were silently absent in a live
# environment.
#
# This script is the backstop. Run it in CI on every build. It does not fix
# anything; it fails loudly, which is the point.
#
# USAGE
#   ./check-manifest.sh            # from the repo root
#
# EXIT CODES
#   0  manifest matches every deployable file
#   1  a file's hash differs, is missing, or the manifest itself is absent
#
set -e

SRC="Incomemodulev3"
MANIFEST="$SRC/build-manifest.json"

DEPLOYABLES="loan-module-v4-builder.html
portf-excel-parser.js
loan-module-engine.js
loan-module-instruments.js
loan-module-analytics.js
demo-assistant-kb.js
demo-assistant-system-prompt.js"

# Same 16-char truncated sha256 the hook and the runtime check use. Keep these
# three in step — a different digest here would report false failures.
sha_of() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -c1-16
  else openssl dgst -sha256 "$1" | sed -E 's/.*= *//' | cut -c1-16
  fi
}

if [ ! -f "$MANIFEST" ]; then
  echo "FAIL: $MANIFEST is missing. The pre-commit hook did not run on the"
  echo "      commit being built. See DEPLOYMENT.md section 5."
  exit 1
fi

FAILED=0
for f in $DEPLOYABLES; do
  if [ ! -f "$SRC/$f" ]; then
    echo "FAIL: $f is missing from the source tree."
    FAILED=1
    continue
  fi
  ACTUAL=$(sha_of "$SRC/$f")
  # Read the value without needing jq — the manifest is written by the hook in
  # a fixed one-key-per-line shape, so a line match is reliable here.
  EXPECTED=$(grep "\"$f\"" "$MANIFEST" | sed -E 's/.*: *"([0-9a-f]+)".*/\1/')
  if [ -z "$EXPECTED" ]; then
    echo "FAIL: $f is not listed in the manifest."
    FAILED=1
  elif [ "$ACTUAL" != "$EXPECTED" ]; then
    echo "FAIL: $f  manifest=$EXPECTED  actual=$ACTUAL"
    FAILED=1
  else
    echo "ok:   $f  $ACTUAL"
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo
  echo "The manifest does not describe this tree. Do NOT deploy."
  echo "Fix: on the developer machine, run"
  echo "     git config core.hooksPath .githooks"
  echo "then re-commit. The hook regenerates the manifest and the cache-busters."
  exit 1
fi

VER=$(grep '"version"' "$MANIFEST" | sed -E 's/.*: *"([^"]+)".*/\1/')
echo
echo "Manifest matches the tree. Version $VER — safe to deploy."
