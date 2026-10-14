#!/usr/bin/env bash
#
# Build a clean handover package from the working repo.
#
# WHY THIS EXISTS
# ---------------
# The repo is a working demo tree, not a deliverable. It contains committed
# node_modules, API probe scratch files, sample PDFs, two superseded builder
# versions and a stale publish script. Handing it over as-is makes a developer's
# first job "work out what of this is real", which is the worst possible first
# impression of a codebase.
#
# This copies ONLY what runs, plus the scripts and docs needed to build, deploy
# and understand it. It never copies .env.
#
# USAGE
#   ./package-for-handover.sh ~/pcs-loan-module-handover
#
set -euo pipefail

REPO="${REPO:-$HOME/Documents/GitHub/Incomemodulev3}"
SRC="$REPO/Incomemodulev3"
OUT="${1:-$HOME/pcs-loan-module-handover}"

[ -d "$SRC" ] || { echo "Source not found: $SRC" >&2; echo "Set REPO=/path/to/Incomemodulev3" >&2; exit 1; }

echo "Source : $SRC"
echo "Output : $OUT"
echo

rm -rf "$OUT"
mkdir -p "$OUT/app" "$OUT/server" "$OUT/scripts" "$OUT/docs"

# ── 1 · The application ─────────────────────────────────────────────────────
# These eight files ARE the application. The browser loads nothing else from
# our own origin. A ninth, build-manifest.json, lets the running page report
# which of them is stale.
APP_FILES="
loan-module-v4-builder.html
loan-module-engine.js
loan-module-instruments.js
loan-module-analytics.js
portf-excel-parser.js
demo-assistant-kb.js
demo-assistant-kb-ifrs.js
demo-assistant-system-prompt.js
build-manifest.json
"
echo "── application"
MISSING=""
for f in $APP_FILES; do
  if [ -f "$SRC/$f" ]; then cp "$SRC/$f" "$OUT/app/"; printf '   %s\n' "$f"
  else MISSING="$MISSING $f"; fi
done
[ -z "$MISSING" ] || { echo "ABORT — missing from source:$MISSING" >&2; exit 1; }

# ── 2 · The server-side proxy (optional at runtime, required to post to DIU) ──
# No node_modules: the lockfile is authoritative and `npm ci` rebuilds it.
# No .env, ever — see SECURITY in HANDOVER.md.
echo "── server"
for f in server.js package.json package-lock.json .env.example README.md .gitignore; do
  [ -f "$SRC/server/$f" ] && { cp "$SRC/server/$f" "$OUT/server/"; printf '   %s\n' "$f"; }
done
if [ -f "$SRC/server/.env" ]; then
  echo "   (.env found in source and deliberately NOT copied)"
fi

# ── 3 · Build and release scripts ───────────────────────────────────────────
echo "── scripts"
for f in deploy.sh check-manifest.sh; do
  [ -f "$REPO/$f" ] && { cp "$REPO/$f" "$OUT/scripts/"; printf '   %s\n' "$f"; }
done
if [ -f "$REPO/.githooks/pre-commit" ]; then
  mkdir -p "$OUT/scripts/githooks"
  cp "$REPO/.githooks/pre-commit" "$OUT/scripts/githooks/"
  printf '   githooks/pre-commit\n'
fi

# ── 4 · Reference documentation that belongs with the code ──────────────────
echo "── docs"
for f in PortF-feed-contract-v0.3.md INVESTRAN_REFERENCE_DATA_SPEC.md \
         RW_REPORT_BUILD_SPEC.md INVESTRAN_DIU_QUESTIONS.md \
         DIU_PROXY_QUICKSTART.md COVENANTS_CHEATSHEET.md README.md; do
  [ -f "$SRC/$f" ] && { cp "$SRC/$f" "$OUT/docs/"; printf '   %s\n' "$f"; }
done
# Handover docs produced alongside this script
HERE="$(cd "$(dirname "$0")" && pwd)"
for f in HANDOVER.md SCHEMA-REFERENCE.md; do
  [ -f "$HERE/$f" ] && { cp "$HERE/$f" "$OUT/"; printf '   %s (root)\n' "$f"; }
done

# ── 5 · A .gitignore so the next repo does not repeat this one's mistakes ────
cat > "$OUT/.gitignore" <<'GITEOF'
node_modules/
.env
.env.local
*.log
.DS_Store
# API probe output — scratch, never source
server/rw-result-*.json
server/diu-validation-*.json
server/meta-*.json
server/swagger-*.json
GITEOF
printf '   .gitignore\n'

# ── 6 · Verify the copy is internally consistent ────────────────────────────
echo
echo "── verifying"
cd "$OUT/app"
TAG=$(grep -o 'loan-module-engine\.js?v=[0-9.]*' loan-module-v4-builder.html | head -1 | sed 's/.*v=//')
VER=$(grep -o 'PCS_VERSION_MINOR = [0-9]*' loan-module-v4-builder.html | head -1 | sed 's/.*= //')
MAJ=$(grep -o 'PCS_VERSION_MAJOR = [0-9]*' loan-module-v4-builder.html | head -1 | sed 's/.*= //')
echo "   version in page : V$MAJ.$VER"
echo "   cache-buster tag: $TAG"
if [ "$TAG" != "$MAJ.$VER" ]; then
  echo "   WARNING: cache-buster and version disagree. A browser can be served a"
  echo "            stale engine while the page reports the new version. Run the"
  echo "            pre-commit hook or fix the ?v= tags before deploying."
fi
SCRIPTS=$(grep -c '<script src="[a-z]' loan-module-v4-builder.html || true)
echo "   local <script> tags: $SCRIPTS (each must be in app/)"
for s in $(grep -o '<script src="[a-z0-9.-]*\.js' loan-module-v4-builder.html | sed 's/.*"//'); do
  [ -f "$s" ] || echo "   MISSING: $s is referenced but not in the package"
done

echo
echo "Package built: $OUT"
echo "Next: read HANDOVER.md, then rotate the credentials it lists."
