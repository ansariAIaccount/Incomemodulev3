#!/usr/bin/env bash
# build-pdfs.sh — regenerate the demo-script PDFs from their markdown.
#
#   ./build-pdfs.sh
#
# The markdown is the source of truth. PDFs are generated, never edited.
# These three scripts lived only in a working folder outside the repo until
# 2026-10-20, which is why the dev team could not find them (open question
# Q-003). Committing the markdown and generating the PDFs stops them drifting
# the way HANDOVER.pdf did between 12 and 16 October.
#
# Needs pandoc and xelatex:
#   apt-get install pandoc texlive-xetex texlive-fonts-extra
set -euo pipefail
cd "$(dirname "$0")"
for f in *.md; do
  [ "$f" = "README.md" ] && continue   # repo doc, not a demo script
  b="${f%.md}"
  pandoc "$f" -o "$b.pdf" --pdf-engine=xelatex -H pdf-header.tex \
    -V geometry:margin=2cm -V colorlinks=true -V linkcolor=blue -V urlcolor=blue
  printf '%-46s %s pages\n' "$b.pdf" "$(pdfinfo "$b.pdf" | awk '/^Pages/{print $2}')"
done
python3 - <<'PY'
import subprocess, glob, sys
bad = False
for p in sorted(glob.glob("*.pdf")):
    t = subprocess.run(["pdftotext","-layout",p,"-"],capture_output=True,text=True).stdout
    for i, pg in enumerate(t.split("\f"), 1):
        mx = max((len(l) for l in pg.split("\n")), default=0)
        if mx > 120:
            print(f"  WARN {p} page {i}: line of {mx} chars — check for overflow"); bad = True
print("  layout check: clean" if not bad else "  layout check: see warnings")
PY
