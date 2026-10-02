# ECL for *External Deal Smokey* — calculation reference

**Deal** External Deal Smokey · Facility B – 100% · Haventus (Ardersier)
**Deal id** `8b612c58-1a25-4013-9001-53844ffc14f6`
**Snapshot** `SPSMOKEY015-XLS-20261001192324` (received 2026‑10‑01 19:23)
**Accounting run** `RUN-20261002124809-2963` — 2026‑10‑02 12:48, 548 JE rows, balanced at 144,070,947.18, status Draft
**Framework** IFRS 9 · GBP · ACT/360 · monthly accrual
**Document date** 2026‑10‑02

Every figure in this document was read from the database for that run. Nothing is
illustrative.

---

## 1. Summary

Smokey is a **Stage 1** exposure. Under IFRS 9 §5.5.5 a Stage 1 loss allowance is
measured at **12‑month expected credit loss**, which PCS computes as

```
allowance target = outstanding balance × PD(12m) × LGD
                 = balance × 0.005 × 0.30
                 = balance × 0.0015          (15 basis points)
```

| | |
|---|---|
| Opening allowance | 0.00 |
| Charges to P&L (17 postings) | **75,000.00** |
| Reversals to P&L (30 postings) | **47,019.59** |
| Closing allowance at 2034‑01‑27 | **27,980.41** |
| Peak allowance (2025‑12‑27) | **75,000.00** = 0.15% × 50,000,000 |

The allowance tracks the drawn balance exactly: across all 47 reporting dates the
closing allowance equals `balance × 0.0015` to within **one penny** (rounding only).
Section 4 shows the reconciliation line by line.

---

## 2. Inputs, and where each one comes from

| Input | Value for Smokey | Source |
|---|---|---|
| PD annual (12‑month) | **0.50%** | Accounting Treatment overrides |
| LGD | **30%** | Accounting Treatment overrides |
| ECL stage | **unset → 1** | Accounting Treatment overrides |
| Compute ECL | **true** | Accounting Treatment overrides |
| Q‑factor / macro overlay | unset | Accounting Treatment overrides — **not applied, see §6** |
| Outstanding balance (EAD) | per day, 0 → 50,000,000 → 18,653,610 | **PortF feed** |
| Maturity (for Stage 2 only) | 2034‑03‑27 | **PortF feed** |
| POCI flag | null (not impaired) | **PortF feed** |
| Covenant SICR trigger | none configured | Builder covenants |

The two numbers that drive the entire result — PD and LGD — are **PCS‑side
assumptions, not PortF data**. They are currently the module's seeded defaults
(0.005 / 0.30), stored against this deal in `treatment_overrides` since
2026‑09‑25. They are not Smokey's credit assessment. See §7.

---

## 3. The calculation, step by step

The engine walks the exposure **day by day** (`buildSchedule`,
`loan-module-engine.js` ~line 1966). On each day:

**Step 1 — resolve the stage.**
```
stage = overrides.ecl_stage || 1
if (a covenant with consequence = sicrTrigger is breached) and stage < 2:
    stage = 2                      // IFRS 9 §B5.5.17(k); escalation only, never reversal
```
Smokey: no stage set, no SICR covenant → **stage 1 every day**.

**Step 2 — stop if any input is zero.**
```
if PD == 0 or LGD == 0 or balance == 0:  no ECL today
```
This is why nothing posts before the first drawdown.

**Step 3 — measure the target allowance for today's stage.**

| Stage | Target |
|---|---|
| 1 | `balance × PD_annual × LGD` |
| 2 | `balance × min(1, PD_annual × years_to_maturity) × LGD` |
| 3 | `(balance − allowance) × lifetime_PD × LGD + allowance`, capped at balance |

Smokey uses the Stage 1 line throughout: `balance × 0.005 × 0.30`.

**Step 4 — the day's charge is the movement, not the level.**
```
daily change = target − allowance_carried_forward
allowance   += daily change
```
A positive change is an impairment charge; a negative one is a reversal. A day on
which the balance does not move produces a change of zero and **no journal entry
at all** — which is why there is no posting anywhere in 2026 (§5).

**Step 5 — collapse to reporting dates.**
`splitECLByReportingPeriod` aggregates the daily movements to one entry per
reporting date (IFRS 9 §5.5.1 measures the allowance *at each reporting date*).
Smokey's reporting dates follow the 27th, monthly through the drawdown phase and
quarterly thereafter.

**Step 6 — post.**

| Direction | DR | CR |
|---|---|---|
| Charge | 470000 Impairment Expense (ECL) | 145000 Loan Loss Allowance (Contra‑Asset) |
| Reversal | 145000 Loan Loss Allowance Reversal | 470000 Impairment Reversal (ECL) |

---

## 4. Period‑by‑period reconciliation

All 47 ECL journal pairs in the run. `Target` is `balance × 0.0015` computed
independently from the drawdown and repayment legs of the same run; `Δ` is the
difference against the allowance PCS actually carried.

| Reporting date | Balance | Opening | Movement | Closing | Target | Δ |
|---|---|---|---|---|---|---|
| 2024‑08‑27 | 2,974,038 | 0.00 | +4,461.06 | 4,461.06 | 4,461.06 | 0.00 |
| 2024‑09‑27 | 9,166,339 | 4,461.06 | +9,288.45 | 13,749.51 | 13,749.51 | 0.00 |
| 2024‑10‑27 | 12,475,584 | 13,749.51 | +4,963.87 | 18,713.38 | 18,713.38 | 0.00 |
| 2024‑11‑27 | 17,172,630 | 18,713.38 | +7,045.57 | 25,758.95 | 25,758.94 | 0.01 |
| 2024‑12‑27 | 21,589,058 | 25,758.95 | +6,624.64 | 32,383.59 | 32,383.59 | 0.00 |
| 2025‑01‑27 | 23,356,969 | 32,383.59 | +2,651.87 | 35,035.46 | 35,035.45 | 0.01 |
| 2025‑02‑27 | 25,905,203 | 35,035.46 | +3,822.35 | 38,857.81 | 38,857.80 | 0.01 |
| 2025‑03‑27 | 29,391,612 | 38,857.81 | +5,229.61 | 44,087.42 | 44,087.42 | 0.00 |
| 2025‑04‑27 | 32,304,313 | 44,087.42 | +4,369.05 | 48,456.47 | 48,456.47 | 0.00 |
| 2025‑05‑27 | 35,213,983 | 48,456.47 | +4,364.51 | 52,820.98 | 52,820.97 | 0.01 |
| 2025‑06‑27 | 38,244,025 | 52,820.98 | +4,545.06 | 57,366.04 | 57,366.04 | 0.00 |
| 2025‑07‑27 | 40,048,544 | 57,366.04 | +2,706.78 | 60,072.82 | 60,072.82 | 0.00 |
| 2025‑08‑27 | 41,484,302 | 60,072.82 | +2,153.64 | 62,226.46 | 62,226.45 | 0.01 |
| 2025‑09‑27 | 42,237,324 | 62,226.46 | +1,129.53 | 63,355.99 | 63,355.99 | 0.00 |
| 2025‑10‑27 | 42,367,652 | 63,355.99 | +195.49 | 63,551.48 | 63,551.48 | 0.00 |
| 2025‑11‑27 | 42,732,821 | 63,551.48 | +547.75 | 64,099.23 | 64,099.23 | 0.00 |
| **2025‑12‑27** | **50,000,000** | 64,099.23 | +10,900.77 | **75,000.00** | 75,000.00 | 0.00 |
| *2026* | *50,000,000 flat* | — | *no movement* | *75,000.00* | — | — |
| 2027‑04‑27 | 48,689,653.68 | 75,000.00 | −1,965.52 | 73,034.48 | 73,034.48 | 0.00 |
| 2027‑07‑27 | 47,412,066.01 | 73,034.48 | −1,916.38 | 71,118.10 | 71,118.10 | 0.00 |
| 2027‑10‑27 | 46,166,418.04 | 71,118.10 | −1,868.47 | 69,249.63 | 69,249.63 | 0.00 |
| 2028‑01‑27 | 44,951,911.27 | 69,249.63 | −1,821.76 | 67,427.87 | 67,427.87 | 0.00 |
| 2028‑04‑27 | 43,767,767.16 | 67,427.87 | −1,776.22 | 65,651.65 | 65,651.65 | 0.00 |
| 2028‑07‑27 | 42,613,226.66 | 65,651.65 | −1,731.81 | 63,919.84 | 63,919.84 | 0.00 |
| 2028‑10‑27 | 40,390,014.60 | 63,919.84 | −3,334.82 | 60,585.02 | 60,585.02 | 0.00 |
| 2029‑01‑27 | 38,276,573.64 | 60,585.02 | −3,170.16 | 57,414.86 | 57,414.86 | 0.00 |
| 2029‑04‑27 | 36,267,483.83 | 57,414.86 | −3,013.63 | 54,401.23 | 54,401.23 | 0.00 |
| 2029‑07‑27 | 34,357,592.83 | 54,401.23 | −2,864.84 | 51,536.39 | 51,536.39 | 0.00 |
| 2029‑09‑27 | 33,438,306.69 | 51,536.39 | −1,378.93 | 50,157.46 | 50,157.46 | 0.00 |
| 2029‑10‑27 | 32,542,002.70 | 50,157.46 | −1,344.46 | 48,813.00 | 48,813.00 | 0.00 |
| 2030‑01‑27 | 31,668,106.31 | 48,813.00 | −1,310.84 | 47,502.16 | 47,502.16 | 0.00 |
| 2030‑04‑27 | 29,985,309.57 | 47,502.16 | −2,524.20 | 44,977.96 | 44,977.96 | 0.00 |
| 2030‑06‑27 | 29,175,330.51 | 44,977.96 | −1,214.97 | 43,762.99 | 43,763.00 | −0.01 |
| 2030‑07‑27 | 28,385,600.92 | 43,762.99 | −1,184.59 | 42,578.40 | 42,578.40 | 0.00 |
| 2030‑10‑27 | 27,615,614.57 | 42,578.40 | −1,154.98 | 41,423.42 | 41,423.42 | 0.00 |
| 2031‑01‑27 | 26,864,877.88 | 41,423.42 | −1,126.11 | 40,297.31 | 40,297.32 | −0.01 |
| 2031‑04‑27 | 26,132,909.61 | 40,297.31 | −1,097.95 | 39,199.36 | 39,199.36 | 0.00 |
| 2031‑07‑27 | 25,419,240.55 | 39,199.36 | −1,070.50 | 38,128.86 | 38,128.86 | 0.00 |
| 2031‑10‑27 | 24,723,413.21 | 38,128.86 | −1,043.74 | 37,085.12 | 37,085.12 | 0.00 |
| 2032‑01‑27 | 24,044,981.56 | 37,085.12 | −1,017.65 | 36,067.47 | 36,067.47 | 0.00 |
| 2032‑04‑27 | 23,383,510.70 | 36,067.47 | −992.21 | 35,075.26 | 35,075.27 | −0.01 |
| 2032‑07‑27 | 22,738,576.61 | 35,075.26 | −967.40 | 34,107.86 | 34,107.86 | 0.00 |
| 2032‑10‑27 | 22,109,765.87 | 34,107.86 | −943.22 | 33,164.64 | 33,164.65 | −0.01 |
| 2033‑01‑27 | 21,496,675.40 | 33,164.64 | −919.64 | 32,245.00 | 32,245.01 | −0.01 |
| 2033‑04‑27 | 20,898,912.19 | 32,245.00 | −896.64 | 31,348.36 | 31,348.37 | −0.01 |
| 2033‑07‑27 | 20,316,093.06 | 31,348.36 | −874.23 | 30,474.13 | 30,474.14 | −0.01 |
| 2033‑10‑27 | 19,747,844.41 | 30,474.13 | −852.37 | 29,621.76 | 29,621.77 | −0.01 |
| 2034‑01‑27 | 18,653,610.61 | 29,621.76 | −1,641.35 | **27,980.41** | 27,980.42 | −0.01 |

Worked example — 2025‑12‑27, the peak:

```
balance          50,000,000.00      (fully drawn)
target           50,000,000 × 0.005 × 0.30  =  75,000.00
allowance b/f                            64,099.23
movement         75,000.00 − 64,099.23  =  10,900.77   charge

DR 470000 Impairment Expense (ECL)          10,900.77
CR 145000 Loan Loss Allowance (Contra)      10,900.77
```

---

## 5. Two features of this result worth understanding

**Nothing posts in 2026.** The balance reaches 50,000,000 on 2025‑12‑27 and stays
there until the first repayment on 2027‑04‑27. The target allowance is a function
of the balance only, so it does not move, so there is no movement to book. The
ledger is correct but reads as a 16‑month gap. If a reporting‑date entry is wanted
every period regardless of movement, that is a change to
`splitECLByReportingPeriod`, not to the measurement.

**The allowance falls as the loan amortises.** 30 of the 47 postings are
reversals. That is the arithmetic consequence of a Stage 1 allowance proportional
to the drawn balance: as principal is repaid, exposure falls and the allowance is
released to P&L. It is not a credit‑quality improvement and should not be
described as one in commentary.

---

## 6. Which Accounting Treatment overrides change the ECL result

Read from `treatment_overrides` for this deal and traced into the engine.

### Applied — these change the number

| Override | Column | Effect |
|---|---|---|
| Compute ECL | `compute_ecl` | Master switch. `false` suppresses all ECL measurement and postings. |
| PD annual | `pd_annual` | Linear multiplier on the allowance. Zero ⇒ no ECL at all. |
| LGD | `lgd` | Linear multiplier. Zero ⇒ no ECL at all. |
| ECL stage | `ecl_stage` | Selects the formula (12‑month vs lifetime vs net‑carrying). The single largest lever — see sensitivity below. |
| Allowance reversal amount / date | `allowance_reversal_amount`, `allowance_reversal_date` | Transtype #23: a model‑recalibration release with no stage change, posted on that date. |
| Covenant breach with `sicrTrigger` | configured on the covenant, not this page | Escalates Stage 1 → 2 from the breach date onward. Escalation only; never de‑escalates. |

### Present on the page but **not** applied to ECL

| Override | Column | Status |
|---|---|---|
| Q‑factor / macro overlay | `q_factor`, `macro_overlay_weight` | **Not read by the ECL formula.** Displayed in the capability badge and named in a code comment, but the measurement at `loan-module-engine.js` ~1984 uses only PD × LGD × balance. Setting it has no effect on the allowance. |
| EAD / CCF | `ead_ccf` | **Not read.** Undrawn commitment is not brought into exposure, so no ECL is held against the unfunded portion. |
| DPD buckets | `dpd_current`, `dpd_to_stage2`, `dpd_to_stage3` | **Not read.** Days‑past‑due does not drive stage migration; only `ecl_stage` and the covenant SICR trigger do. |
| Watchlist | `watchlist` | **Not read** by the ECL formula. |
| POCI | `poci_flag` | Affects EIR construction (credit‑adjusted rate), **not** the ECL formula. IFRS 9 §5.5.13 requires POCI allowances to be measured as *cumulative changes* in lifetime ECL since acquisition; PCS does not implement that distinct basis. |
| Stage 3 interest on net | `stage3_interest_on_net` | Affects interest recognition under Stage 3, not the allowance. |
| Suspended | `suspended` | Affects accrual, not the allowance. |

These are gaps against the UI's implied capability, not defects in the arithmetic
above. They matter because a reviewer who sets a Q‑factor of 1.2 will reasonably
expect the allowance to rise by 20%, and it will not.

### Stage sensitivity for Smokey

At the 2025‑12‑27 peak (balance 50,000,000, 8.25 years to the 2034‑03‑27 maturity):

| Stage | Formula | Allowance |
|---|---|---|
| 1 (current) | 50m × 0.005 × 0.30 | **75,000** |
| 2 | 50m × min(1, 0.005 × 8.25) × 0.30 | **618,750** |
| 3 | lifetime on net carrying | ≈ 618,750 rising toward the gross balance |

A single stage change multiplies the allowance by roughly **8×**. This is the one
field to get right.

---

## 7. What PortF supplies that changes the ECL result

PortF sends **no credit‑risk parameters**. The feed changes the ECL only by
changing the exposure the formula is applied to, and the horizon it is applied
over.

| PortF input | Sheet | How it reaches the ECL |
|---|---|---|
| Drawdown rows (`posting_type = drawdown`) | Cashflows | Raise the balance ⇒ raise the allowance target |
| Repayment rows (`posting_type = repayment`) | Cashflows | Reduce the balance ⇒ release allowance |
| Capitalisation / PIK rows | Cashflows | Raise the balance ⇒ raise the target |
| Last cashflow date | Cashflows | Ends the schedule, so the last reporting date measured |
| Maturity / Loan End Date | Loan Info | `years_to_maturity` — **Stage 2 and 3 only**; no effect while Stage 1 |
| Total Commitment | Loan Info | The figure ECL is measured against for undrawn exposure *in principle*; see the `ead_ccf` gap above |
| Credit Impaired at Acquisition | Tranches | Sets POCI, which affects EIR, not the allowance (§6) |

Smokey's values: committed 50,000,000 · drawn peak 50,000,000 · maturity
2034‑03‑27 · POCI null.

**Not supplied by PortF at all:** PD, LGD, stage, internal or external rating,
days past due, watchlist status, forward‑looking macro scenario. Every one of
these is a PCS‑side input. A PortF re‑import therefore cannot change Smokey's
credit assumptions — it can only move the balance they are applied to.

---

## 8. Open items

1. **PD and LGD are seeded defaults, not Smokey's credit assessment.** 0.50% /
   30% have been carried since the deal was created. They need to be confirmed or
   replaced before any ECL figure from this deal is reported.
2. **Stage is unset.** It defaults to 1. If Smokey should be Stage 2, the
   allowance is understated by roughly 8× (§6).
3. **Q‑factor, EAD/CCF and DPD are inert.** Either wire them into the measurement
   or remove them from the overrides page, because a reviewer will otherwise
   assume they are doing something.
4. **No ECL on the undrawn commitment.** IFRS 9 §5.5.20 requires a loss allowance
   on loan commitments. With `ead_ccf` unread, nothing is held against the
   unfunded balance during the 2024–2027 availability period, when Smokey's
   undrawn exposure peaked near 47m.
5. **No postings in 2026.** Correct under a movements‑only convention, but worth a
   deliberate decision rather than an emergent one.

---

### Sources

- `loan-module-engine.js` — `buildSchedule` ECL block (~1966), `splitECLByReportingPeriod` (~4150), `INVESTRAN_GL`, `applyInvestranGLMapping`
- `portf-excel-parser.js` — Tranches reader (~1126), facility/commitment checks (~1596)
- Database: `external_snapshots`, `treatment_overrides`, `accounting_runs`, `journal_entries` for run `RUN-20261002124809-2963`
