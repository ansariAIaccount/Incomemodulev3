# Demo Scripts

Client-facing demo scripts for the PCS Loan Module, and the checks to run
before presenting them.

**The markdown is the source of truth. The PDFs are generated — never edit a
PDF.** Run `./build-pdfs.sh` after changing any `.md`.

| File | What it is |
|---|---|
| `PCS-Demo-Script-POCI-Three-Scenarios.md` | Three POCI recovery scenarios (`DEMO-POCI`, `-MID`, `-PAR`). Figures regenerated 20 Oct 2026 against the corrected engine. |
| `POCI-verification-card.md` | Two-page pre-demo check for the three POCI deals. Run it before presenting. |
| `PCS-Demo-Script-Hamilton-Smokey.md` | The 45-minute accounting walkthrough. |
| `PCS-IFRS-Demo-Answers.md` | Searchable IFRS Q&A reference for questions from the floor. |
| `build-pdfs.sh` · `pdf-header.tex` | Regenerate all PDFs, with a layout check that fails loudly on a line running off the page. |

## Why these are in the repo now

They were not. They lived only in a working folder outside the repository, so
the dev team could see them referenced and could not open them — that was open
question **Q-003**. Committing the markdown and generating the PDFs fixes it
and stops the drift that hit `HANDOVER.pdf`, which sat four days stale beside
an updated markdown source and contradicted it.

## Before you present anything

Figures in a demo script are only true of a particular build. The POCI figures
are correct as of **V4.69**; before that build they were not, and the script
says so in its own closing section.

Run `POCI-verification-card.md` first. It takes two minutes and it tells you
which of three failure modes you are in rather than just that something looks
off.

## Known issues these scripts work around

- **#71** — the maturity leg repays face value. Correct on `DEMO-POCI`, wrong
  on `-MID` and `-PAR`. The POCI script says where to stop.
- **#72** — POCI deals display "Stage 1". A display default; POCI has no
  stages.

Both are still open. If either is fixed, the scripts need regenerating and the
verification card's expected figures need rechecking.
