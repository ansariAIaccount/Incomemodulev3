# PCS Loan Module — Documentation Index

**V4.67 · 16 October 2026**

A private-credit loan accounting sub-ledger. Loan terms and cashflows go in —
built in the module or imported from a servicing system — IFRS 9 (and US GAAP
CECL, Canadian ASPE, AASB) is applied, and balanced journal entries come out
for FIS Investran.

There are 25 documents across the repo. This page tells you which one you
want.

### One thing to get straight first: the repo is nested twice

```
Incomemodulev3/                     ← repo root. Scripts and newer docs live here.
├── deploy.sh  check-manifest.sh  DEPLOYMENT.md
├── db/                             ← schema rebuild kit (generators + auth shim)
├── EIR-*.md  ECL-*.md  PortF-feed-contract-v0.4/0.5.md
└── Incomemodulev3/                 ← the APPLICATION. This is what deploys.
    ├── loan-module-v4-builder.html  loan-module-engine.js  …
    ├── tests/   server/   server-ingest/
    ├── PortF-feed-contract-v0.1/0.2/0.3.md
    └── Handover Docs/              ← you are here
```

`./deploy.sh` and `./check-manifest.sh` are run **from the repo root**, and
they operate on the inner directory. Paths in these documents are relative to
the document, so `../` is the application and `../../` is the repo root.

---

## Start here

**Day one, whatever your role:** [HANDOVER.md](HANDOVER.md). Architecture,
what to deploy, configuration, security, known defects. Read §9 (credentials)
before you do anything else.

Then, by what you are about to touch:

| You are going to… | Read |
|---|---|
| change a calculation | **[ENGINE-GUIDE.md](ENGINE-GUIDE.md)** |
| change the UI | **[FRONTEND-GUIDE.md](FRONTEND-GUIDE.md)** |
| verify a change | **[TESTING.md](TESTING.md)** |
| understand the data model | **[SCHEMA-REFERENCE.md](SCHEMA-REFERENCE.md)** |
| **rebuild the database elsewhere** | **[../../db/README.md](../../db/README.md)** |
| deploy | **[../../DEPLOYMENT.md](../../DEPLOYMENT.md)** + HANDOVER §6 |

Each of the three guides opens with the traps that cost a day. They are there
because they are not discoverable by reading the code.

---

## The handover pack (this folder)

| File | What it is |
|---|---|
| `HANDOVER.md` | The overview. Architecture, deploy, config, security, defects, workspace configuration |
| `HANDOVER.pdf` · `SCHEMA-REFERENCE.pdf` | The same two documents, for sending on. **Generated — never edit.** Run `./build-pdfs.sh` after changing either `.md`, or the PDF goes stale and contradicts the source. |
| `build-pdfs.sh` · `pdf-header.tex` | Regenerate the two PDFs (pandoc + xelatex), with a layout check that fails loudly on a line running off the page |
| `ENGINE-GUIDE.md` | `loan-module-engine.js` — the daily loop, the row contract, three structural traps, recipes |
| `FRONTEND-GUIDE.md` | `loan-module-v4-builder.html` — state, IIFE scoping, the four-step nav registration, the read-only gate |
| `TESTING.md` | The 50-case harness, how to add a case, what is **not** covered |
| `SCHEMA-REFERENCE.md` | 80 tables, 69 enums, 112 migrations, RLS model |
| `package-for-handover.sh` | Extracts only what runs, leaving the repo's accumulated debris behind |
| `zip-js.sh` | Zips the seven JS files, with a vintage check that refuses a stale engine |

---

## Accounting references

The authority for *why* a number is what it is. Written against specific deals,
so they double as worked examples.

| File | Covers |
|---|---|
| `../../EIR-calculation-reference.md` | Effective interest rate — the core method |
| `../../EIR-external-deals-reference.md` | EIR on imported deals, where the cashflows are given rather than modelled |
| `../../ECL-calculation-reference.md` | Expected credit losses — staging, PD × LGD, posting |
| `../../ECL-Smokey-calculation-reference.md` | The same, traced through one real deal |
| `../../Smokey-accounting-walkthrough.md` | Every calculation PCS performs on one external deal, end to end |
| `../BARRENJOEY_ACCOUNTING_VALIDATION.md` | Validation of engine output against an independent model |
| `../COVENANTS_CHEATSHEET.md` | Covenant types, triggers, consequences |

**If you are reading one accounting document, make it
`Smokey-accounting-walkthrough.md`.** It is the only one that follows a single
deal through every stage, and it will teach you the data model faster than the
schema reference will.

---

## Integration

### PortF — the inbound feed

The contract has five versions and **they are in two different directories**,
which is a trap of its own:

| Version | Location |
|---|---|
| v0.1 | `../PortF-feed-contract-v0.1.md` |
| v0.2 | `../PortF-feed-contract-v0.2.md` |
| v0.3 | `../PortF-feed-contract-v0.3.md` |
| v0.4 | `../../PortF-feed-contract-v0.4.md` |
| **v0.5 (current)** | `../../PortF-feed-contract-v0.5-EIR.md` |

Also: `../../PortF-data-requirements-v0.5.md` (what PCS needs and why) and
`../../PortF-open-questions.md` (unresolved items — read before a PortF call).

The reader is `portf-excel-parser.js`, which handles v0.3 through v0.5.

### Investran — the outbound push

| File | Covers |
|---|---|
| `../DIU_PROXY_QUICKSTART.md` | Running the proxy |
| `../server/README.md` | The proxy itself — OAuth, multipart upload, DIU job lifecycle |
| `../INVESTRAN_DIU_QUESTIONS.md` | Open questions on the DIU REST API |
| `../INVESTRAN_REFERENCE_DATA_SPEC.md` | Reference data to pull before creating transactions |
| `../RW_REPORT_BUILD_SPEC.md` | Report Wizard build spec |
| `../server-ingest/README.md` | The ingestion service |

---

## Demo material

| File | For |
|---|---|
| `../../PCS-Modification-Demo-Script.md` | Modification and impairment |
| `../BARRENJOEY_DEMO_SCRIPT.md` | The Barrenjoey RFP walkthrough |
| `PCS-Demo-Script-POCI-Three-Scenarios.pdf` * | POCI across three recovery outcomes |
| `PCS-Demo-Script-Hamilton-Smokey.pdf` * | 45-minute accounting demo |
| `PCS-IFRS-Demo-Answers.pdf` * | 256 IFRS Q&A, searchable, for live questions |

\* These live in the author's working folder rather than the repo. If they did
not come with the handover, ask for them — the IFRS answer book in particular
is the same corpus the in-app offline assistant uses
(`demo-assistant-kb-ifrs.js`).

---

## What is deliberately not here

**No API documentation for the engine**, because it has no API — it is a set of
top-level functions in one file, documented in ENGINE-GUIDE.md.

**No component documentation**, because there are no components. See
FRONTEND-GUIDE.md §1 for why one file.

**No CI configuration.** There is none. TESTING.md ends with the pipeline worth
adding first.

**No runbook.** Operational procedures — rotating the Investran token,
diagnosing a failed DIU push, restoring a stale accounting run — are
distributed across HANDOVER §4, §9 and the proxy README rather than collected.
Worth writing if this goes to a team that will operate it as well as build it.

---

## Reading order for a new developer

1. `HANDOVER.md` §1–3 — what this is, what deploys
2. **Rotate the credentials** (§9). Do not defer this.
3. `node tests/engine-harness.js && node tests/regression-harness.js` — 50/50 is your baseline
4. Serve the app, open `loan-module-v4-builder.html`, load `DEMO-POCI`
5. `Smokey-accounting-walkthrough.md` — follow one deal end to end
6. `ENGINE-GUIDE.md` or `FRONTEND-GUIDE.md`, depending on your first ticket
7. `HANDOVER.md` §11 — the defect list, and the pattern underneath it

Expect step 5 to take a while. It is the step that makes the rest cheap.
