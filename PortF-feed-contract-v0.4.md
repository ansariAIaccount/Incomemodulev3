# PortF → PCS feed contract v0.4

**Status:** draft for PortF review
**Supersedes:** v0.3 (Sept 2026)
**Change:** PortF sends *amounts and movements*. PCS derives balances and rates.

---

## Why this changed

v0.3 asked PortF for the balance and the rate alongside every amount. Checking
our numbers against those only verifies PortF's arithmetic — if we accept their
balance and their rate, `balance × rate × days` must reproduce their amount, and
we have learned nothing.

Under v0.4, PortF sends what happened and what it cost. PCS derives the balance
from the movements and the rate from the terms, computes the amount, and compares
it to theirs. That is an independent recalculation, and a difference is
meaningful.

It also collapses the workbook. A Suffolk tranche sheet goes from 50 columns to
7, and 50 tranches no longer mean 50 worksheets.

---

## The three rules

1. **One vocabulary.** Every governed field is validated against `Lookup values`.
   Anything not on the list stops the import. This has not changed and should not.
2. **One identity.** Every deal, tranche and component carries a stable ID that
   survives a rename. Names are labels, not keys.
3. **Nothing inferred.** If PortF does not state it, PCS does not guess it. Where
   a value is genuinely derived (a balance), it is derived from stated movements,
   never estimated.

---

## Workbook shape

| Sheet | Contents |
|---|---|
| `Loan info` | Deal and facility terms. No cashflows. |
| `Tranches` | One row per tranche. |
| `Components` | One row per interest component and per fee. |
| `Movements` | One row per movement. |
| `Cashflows` | One row per component per period — amount only. |
| `Balance checkpoints` | Periodic balances, for verification only. |
| `Lookup values` | The closed vocabulary. |

Headers are matched by label, not position, so column order may vary. Sheet names
tolerate minor variation (`Tranche 1` / `Tranches` / `T1`).

---

## Cashflows

```
Period Start | Period End | Tranche ID | Component ID | Posting Type | Settlement Type | Amount
```

- **Amount only.** No rate column, no balance column.
- **Period Start and Period End are required.** This is the single largest source
  of unexplained differences today. On the Suffolk file, 210 rows do not reconcile
  to the calendar because we are inferring the period from one date — one row
  implies a period 30× longer than its dates suggest.
- **One row per component.** A single amount covering a fixed and a floating
  component cannot be checked or reported, and will not be apportioned by
  guesswork. On Suffolk this affects 189 rows.
- **Posting Type and Settlement Type are explicit.** They are no longer implied by
  which block a column sits in.

## Movements

```
Date | Tranche ID | Movement Type | Amount
```

Every movement, without exception: initial purchase, each drawdown, each principal
payment, each capitalisation.

Balances are cumulative. A movement that never reaches us corrupts the balance
from that date forward, and every later period then compares against a wrong
number. This sheet is now load-bearing in a way the old balance columns were not.

## Balance checkpoints

```
Date | Tranche ID | Principal Balance | Unfunded Balance | Principal + Capitalised | Unfunded (Net of capitalisations)
```

Periodic only — quarter-end or each payment date. This is the safety net for the
risk the previous section introduces: without it, a missing movement produces
silent drift; with it, the drift surfaces as a dated mismatch at the next
checkpoint.

## Components

Carries the terms PCS needs to derive the rate: interest type, base value, terms,
accrual frequency, balance basis, and — for any compounded RFR component —
**lookback, lockout and observation shift**.

A compounded SONIA rate cannot be reproduced without those three. They are blank
on every Suffolk component today.

---

## Still required from PortF

1. **Period start and end** on every cashflow row.
2. **One row per component** — no combined fixed + floating lines.
3. **Lookback, lockout, observation shift** for floating components, plus whether
   PortF compounds daily SONIA or uses the BoE published Compounded Index.
4. **Deal and tranche GUIDs.** They exist in PortF; they are not in the export.
5. **Rounding rule** — per period or carried, half-up or bankers.
6. **Date format** stated once, per sender. `08/04/2024` is ambiguous and will not
   be guessed.
7. **Every movement**, per the Movements sheet.

Dropped from v0.3, no longer needed under this model:
- More decimal places on the rate
- Which balance the rate was applied to *(now stated once per component, not per row)*

---

## Acceptance status per row

Every imported cashflow row carries one of:

| Status | Meaning |
|---|---|
| `full` | Movements and terms are sufficient — PCS can recalculate and check the amount. |
| `flat` | Amount only by design, e.g. a fee with no rate. Recorded, not checkable. |
| `unverified` | Amount only where a rate should exist. Imported and flagged. |

This is what lets the feed be flexible about shape without becoming dishonest
about what has actually been verified. A file of the older, payment-list shape
still imports — every row simply lands as `unverified`, and the UI says so.

---

## Template defects to correct

These are in the Excel template itself, not in PCS:

- `Day Count Convention` lists `ACT/360` twice and omits `ACT/365`. PCS accepts
  `ACT/365` as the intended second value, with a warning.
- `Frequency` spells Monthly as `Montly`. Both spellings accepted, with a warning.
- The fee block says `Arrangeement Fee` where the cashflow header says
  `Arrangement Fee`. **Not** fuzzy-matched — names are keys, and guessing that two
  differently-spelled fees are the same thing misattributes money.

---

## Open on the PCS side

- A workbook that yields zero cashflow rows currently imports as a success. It
  should be an error. Suffolk silently drops 80 commitment-fee rows totalling
  £1,311,139,547 as a warning today.
- Floating components cannot be checked until daily SONIA fixings are loaded.
- The engine does not yet honour per-component settlement type, so a genuinely
  PIK deal would compare incorrectly (#202).
- Only elapsed periods are reconcilable. Suffolk runs to 2063; everything beyond
  today is forecast on both sides, and comparing forecasts compares assumptions.
