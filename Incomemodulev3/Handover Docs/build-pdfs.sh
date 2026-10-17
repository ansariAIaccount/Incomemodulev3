#!/usr/bin/env bash
# build-pdfs.sh — regenerate HANDOVER.pdf and SCHEMA-REFERENCE.pdf from the .md
#
#   ./build-pdfs.sh
#
# Run this whenever either Markdown file changes. A stale PDF sitting beside a
# fresh Markdown is worse than no PDF: it looks authoritative and is wrong, and
# that is exactly what happened between 12 and 16 October 2026.
#
# Needs pandoc and xelatex. On Debian/Ubuntu:
#   apt-get install pandoc texlive-xetex texlive-fonts-extra
#
# pdf-header.tex does two things that matter:
#   * maps the emoji used in the docs to plain text, because the DejaVu fonts
#     have no glyphs for them and xelatex renders a missing glyph as nothing at
#     all — silently dropping a ⚠ from a warning;
#   * turns on fvextra line breaking inside code blocks. Without it the long
#     `create type … as enum (…)` lines in SCHEMA-REFERENCE run straight off
#     the right edge of the page and the last few values are simply not there.
set -euo pipefail
cd "$(dirname "$0")"

for f in HANDOVER SCHEMA-REFERENCE; do
  pandoc "$f.md" -o "$f.pdf" \
    --pdf-engine=xelatex \
    -H pdf-header.tex \
    -V geometry:margin=2cm \
    -V colorlinks=true -V linkcolor=blue -V urlcolor=blue \
    --toc --toc-depth=2
  printf '%-20s %s pages\n' "$f.pdf" "$(pdfinfo "$f.pdf" | awk '/^Pages/{print $2}')"
done

# Cheap regression check: no page should carry a line wider than the text block.
# Catches a reintroduced overflow without anyone having to look at the PDF.
python3 - <<'PY'
import subprocess, sys
bad = False
for f in ("HANDOVER", "SCHEMA-REFERENCE"):
    txt = subprocess.run(["pdftotext", "-layout", f + ".pdf", "-"],
                         capture_output=True, text=True).stdout
    for i, pg in enumerate(txt.split("\f"), 1):
        mx = max((len(l) for l in pg.split("\n")), default=0)
        if mx > 120:
            print(f"  WARN {f}.pdf page {i}: line of {mx} chars — check for overflow")
            bad = True
print("  layout check: clean" if not bad else "  layout check: see warnings above")
PY
