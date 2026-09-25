# Expected credit losses — how PCS calculates and posts ECL

**Module:** PCS Loan Module V4
**Applies to:** internally built deals and externally imported (PortF) deals alike
**Frameworks:** IFRS 9 · ASC 326 (CECL) · AASB 9 · ASPE 3856
**Status:** current as at V4.1

---

## 1. Scope

ECL is **PCS's own calculation**. No external system supplies it — PortF sends
cashflows, movements and terms, but never a loss allowance. This is true for
imported deals as much as internal ones: an imported deal's interest comes from
the feed, its allowance comes from here.

Two separate things happen, and they are described separately below because
they failed separately:

- **Measurement** — a loss allowance recomputed for every day of the schedule
- **Posting** — one journal entry per reporting date, for the *movement* in
  that allowance

---

## 2. Inputs

All three live on the instrument's `ifrs` block, set in the Accounting
Treatment panel and persisted to `treatment_overrides`.

| Field | Meaning | Notes |
|---|---|---|
| `ifrs.pdAnnual` | Annual probability of default | Decimal, e.g. `0.005` = 0.5% |
| `ifrs.lgd` | Loss given default | Decimal, e.g. `0.3` = 30% |
| `ifrs.ecLStage` | Stage 1, 2 or 3 | Defaults to 1 |
| `ifrs.computeECL` | Off switch | ECL is skipped when explicitly `false` |

Derived per day from the schedule:

| Value | Source |
|---|---|
| `balance` | Outstanding principal that day, walked from the movements |
| `yearsRemaining` | `(maturity − today) / 365`, floored at 0 |
| `eclAllowance` | Running allowance, carried on every schedule row |

**If `pdAnnual` or `lgd` is zero, or the balance is zero, no allowance is
raised.** A deal with no PD/LGD set produces no ECL at all — silently. That is
a deliberate "nothing stated, nothing assumed" position, but it does mean an
unpopulated Treatment panel yields a clean-looking run with no allowance.

---

## 3. Measurement — daily

Computed inside `buildSchedule` (`loan-module-engine.js`). For each day:

```
Stage 1   target = balance × pdAnnual × lgd                    (12-month ECL)

Stage 2   lifetimePD = min(1, pdAnnual × yearsRemaining)
          target = balance × lifetimePD × lgd                  (lifetime ECL)

Stage 3   netCarrying = max(0, balance − allowance)
          target = netCarrying × lifetimePD × lgd + allowance
          target = min(balance, target)                        (clamped)

dailyChange = target − allowance
allowance  += dailyChange
```

The allowance is a **target-seeking balance**, not an accumulation: each day it
moves to whatever the stage formula says it should be. It therefore falls as
the balance amortises and — in Stage 2 — as remaining life shortens.

### Worked check

Ferhat Float example, forced to Stage 2, PD 0.5%, LGD 30%:

| | |
|---|---|
| Date | 2028-08-06 |
| Maturity | 2029-09-07 |
| Balance | 25,000,000 |
| Years remaining | 1.0877 |
| lifetimePD | 0.005 × 1.0877 = **0.005438** |
| Allowance | 25,000,000 × 0.005438 × 0.3 = **£40,787.67** |
| Engine produced | **£40,787.67** ✅ |

The same loan at Stage 1 would carry 25,000,000 × 0.005 × 0.3 = **£37,500**,
flat, because the Stage 1 formula has no remaining-life term.

> A flat allowance is not evidence of a broken model. A Stage 1 bullet with a
> constant balance *should* produce a constant allowance. This was misread
> once during development — a flat £30,000 over eight years was taken as proof
> the measurement was static, when it was the correct answer for that loan.

---

## 4. Stage determination and SICR

Starting stage comes from `ifrs.ecLStage`. It is then escalated — never
de-escalated — by covenant-driven SICR:

- A breached covenant with `consequence = sicrTrigger` moves Stage 1 → Stage 2
  from the breach date onward
- A manual Stage 3 always wins
- Memos on the resulting journals carry the citation: IFRS 9 §B5.5.17(k),
  ASC 326-20-30-2, AASB 9 §B5.5.17 or ASPE 3856.16 as appropriate

Stage migration is a step change in the allowance, because Stage 2 switches the
measurement from 12-month to lifetime.

---

## 5. Events that release or consume the allowance

Handled in the engine's event loop, not by the stage formula:

| Event | Effect |
|---|---|
| **Cure** | Releases `min(allowance, releaseAmount)` back to P&L |
| **Stage cure** | Same mechanic, tracked separately in the roll-forward |
| **Write-off** | Consumes the allowance first; only the residual hits P&L |
| **Derecognition / sale** | Releases the whole remaining allowance |
| **Participation sale** | Releases pro-rata to the fraction sold |

---

## 6. Posting — one entry per reporting date

`splitECLByReportingPeriod` (`loan-module-engine.js`) takes the daily allowance
series and posts the **movement** at each reporting date.

- **Grid:** monthly by default. Override with
  `window.__ECL_REPORTING_FREQ = 'quarterly' | 'semi-annual' | 'annual'`.
  Deliberately *not* tied to coupon frequency — when you report is an
  accounting policy, not a property of the loan's payment terms.
- Period ends step from the schedule's first date; **the last schedule date is
  always included**, even as a partial period, because that is where the
  release to zero on repayment lands.
- A period end falling on a non-schedule day (weekend, holiday roll) walks back
  up to 7 days for the most recent allowance held.
- Movements of **≤ £0.005 produce no entry**. A flat allowance yields one entry
  when it is first raised and nothing after — not a run of zero-value rows.

```
delta = allowance(period end) − allowance(previous period end)

delta > 0   DR  Impairment Expense (ECL)             70100 → 470000
            CR  Loan Loss Allowance (Contra-Asset)   15500 → 145000

delta < 0   CR  Impairment Reversal (ECL)            70100 → 470000
            DR  Loan Loss Allowance Reversal         15500 → 145000
```

### GL mapping (verified)

| Transaction type | Account | Investran GL |
|---|---|---|
| Impairment Expense (ECL) | 470000 | Impairment / ECL Expense (IFRS 9 §5.5) |
| Impairment Reversal (ECL) | 470000 | Impairment / ECL Expense (IFRS 9 §5.5) |
| Loan Loss Allowance (Contra-Asset) | 145000 | Loan Loss Allowance – IFRS 9 ECL |
| Loan Loss Allowance Reversal | 145000 | Loan Loss Allowance – IFRS 9 ECL |

### Ordering

The splitter runs **before** the "Generate up until" filter. This matters: the
allowance must be re-dated to a reporting date before rows after the cut-off
are dropped, or a close deletes the entry instead of keeping it.

---

## 7. Worked example — Stage 2, full term

Same deal, run to maturity on a monthly grid:

| | |
|---|---|
| Reporting periods | 99 |
| Journal rows | 198 (one DR/CR pair per period) |
| First entry | 2026-10-23 — provision £244,935 |
| Subsequent | Monthly releases as remaining life shortens |
| Closing allowance | £86 |
| Cumulative P&L charge | £85 |

**The roll-forward ties:** the sum of every movement equals the closing
allowance, within £1 across 99 periods (see §9 on rounding).

---

## 8. Internal versus external deals

Identical. ECL is computed from the same schedule and posted by the same
splitter regardless of source.

The one difference is historical and worth knowing: when external deals were
first switched to posting only what the feed supplies, ECL fell out entirely —
the feed carries no ECL because ECL is ours. For a period, imported deals
showed an allowance on the KPI card and had **nothing in the ledger**. That is
fixed; the splitter now generates the entries whether or not an aggregate pair
existed to replace.

---

## 9. Known limitations

1. **Rounding drift.** Each period's delta is rounded to 2dp, so across ~99
   periods the cumulative charge can differ from the closing allowance by a
   pound or two (£85 vs £86 above). Truing up the final period to the closing
   balance would make it tie exactly; not currently done.
2. **Deal-level, not tranche-level.** One allowance per deal, driven by the
   deal's total balance. A deal whose tranches carry genuinely different credit
   risk cannot express that.
3. **No PD/LGD ⇒ no ECL, silently.** An unpopulated Treatment panel produces a
   run with no allowance and no warning on screen.
4. **Stage 3 interest.** IFRS 9 5.4.1(b) requires interest on a credit-impaired
   asset to accrue on the carrying amount **net** of the allowance. The ECL
   measurement uses net carrying, but whether the interest calculation does has
   not been verified — treat Stage 3 interest income as unconfirmed.
5. **POCI.** Purchased or originated credit-impaired assets require a
   credit-adjusted EIR with lifetime losses built into the yield from the
   outset. PCS refuses rather than approximating — see the EIR reference.

---

## 10. Where the code lives

| Concern | Location |
|---|---|
| Daily measurement | `loan-module-engine.js` — inside `buildSchedule` |
| Release / write-off events | `loan-module-engine.js` — event loop |
| Aggregate posting (legacy) | `loan-module-engine.js` — `generateDIU` |
| Per-period posting | `loan-module-engine.js` — `splitECLByReportingPeriod` |
| GL mapping | `loan-module-engine.js` — `INVESTRAN_GL` + `applyInvestranGLMapping` |
| Run wiring | `loan-module-v4-builder.html` — `runAccountingImpl` |

Field values persist to `treatment_overrides`; posted rows to
`journal_entries`; the daily allowance to `cashflow_schedules`.
