#!/usr/bin/env bash
# Run this from inside a local clone of https://github.com/ansariAIaccount/Incomemodulev3
# It copies the V3 files in, commits, and pushes.
set -e
SRC_DIR="$(dirname "$0")"
DEST_DIR="${1:-$(pwd)}"
echo "Copying V3 files from $SRC_DIR to $DEST_DIR..."
cp "$SRC_DIR/loan-module-v3-builder.html"        "$DEST_DIR/"
cp "$SRC_DIR/loan-module-engine.js"              "$DEST_DIR/"
cp "$SRC_DIR/loan-module-instruments.js"         "$DEST_DIR/"
cp "$SRC_DIR/demo-assistant-kb.js"               "$DEST_DIR/"
cp "$SRC_DIR/demo-assistant-system-prompt.js"    "$DEST_DIR/"
cp "$SRC_DIR/README.md"                          "$DEST_DIR/"
cd "$DEST_DIR"
git add loan-module-v3-builder.html loan-module-engine.js loan-module-instruments.js \
        demo-assistant-kb.js demo-assistant-system-prompt.js README.md
git commit -m "feat(v3): Supabase-backed loan module (Save to DB, multi-backend DB settings, cashflow schedules)"
git push origin main
