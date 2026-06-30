# Covenants Capabilities Cheatsheet

**Module:** PCS Loan Module V3 — Covenants  
**Scope:** Stage 0 setup → Engine reaction → DB persistence → UI surfacing  
**Date:** 2026-06-30

---

## 1. What this gives you in plain English

A **covenant** is a financial promise a borrower makes in a loan agreement — e.g. "I will keep my leverage below 4x." When the borrower's reported value crosses the line, the lender has contractual rights: charge more interest, accelerate the loan, force a credit-risk re-stage for accounting, etc.

This module lets you:

1. **Define covenants** on any loan (Stage 0 of the builder)
2. **Record the latest observation** ("they reported 4.10x on April 15")
3. **The engine compares** observation vs threshold, decides whether it's breached
4. **The engine auto-applies the consequences** you configured (extra margin, ECL re-stage, mandatory prepayment)
5. **The DB records every breach + cure cycle** with timestamps for the audit trail
6. **The UI shows you everywhere it matters** — Dashboard banner, Stage 2 evidence pack, Stage 0 history accordion

Nothing happens in the background — everything fires when you click **Run Accounting**.

---

## 2. Where covenants live in the system

| Layer | What lives there |
|---|---|
| **DB table `covenants`** | Definition: name, threshold, direction, KPI, test frequency, consequences, latest reading |
| **DB table `covenant_breach_log`** | Every breach + cure cycle as separate rows. Idempotent on (covenant_id, breach_date). |
| **Stage 0 UI** | Editable cards — full CRUD. Each card shows a "Breach history" accordion. |
| **Engine (`loan-module-engine.js`)** | `applyCovenantSideEffects(instr)` evaluates breaches; `buildSchedule()` adjusts coupon rate / ECL stage / synthesises prepayment events. |
| **Dashboard** | Red breach banner showing live engine-detected breaches with consequence chips. |
| **Stage 2 evidence pack** | "Covenant-Driven Adjustments" collapsible panel with framework-specific §-citations. |

---

## 3. Anatomy of a single covenant

When you click "Add covenant" in Stage 0, you fill in these fields:

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | text | yes | — | Human label, e.g. "Total Net Leverage Ratio" |
| `category` | enum | yes | `maintenance` | maintenance / incurrence / operating / information / sustainability / borrowingBase |
| `kpiMetric` | enum | yes | `leverageRatio` | leverageRatio · interestCoverage · dscr · icr · currentRatio · minNetWorth · capexLimit · restrictedPayments · borrowingBase · esgScore · none |
| `direction` | enum | yes | `max` | `max` (must not exceed) or `min` (must not fall below) |
| `threshold` | number | yes | — | The line in the sand. e.g. 4.00 |
| `unit` | text | optional | — | Just a display label: `x`, `%`, `USD m`, `pts` |
| `testFrequency` | enum | yes | `quarterly` | monthly · quarterly · semiAnnual · annual · event · adHoc |
| `firstTestDate` | date | optional | — | First reporting date the covenant becomes live |
| `nextTestDate` | date | optional | — | When the next reading is due |
| `curePeriodDays` | int | optional | 0 | Grace window after breach before consequences fire |
| `equityCureAvailable` | bool | optional | false | Sponsor can cure via equity injection |
| `consequenceOnBreach` | enum | yes | `sicrTrigger` | **The trigger for engine behaviour — see §5** |
| `breachStepUpBps` | int | optional | 0 | If consequence is `marginStepUp`, how many bps to add to the coupon |
| `lastReportedValue` | number | optional | null | **The observation that drives breach detection** |
| `lastReportedDate` | date | optional | null | When that reading was taken — used as the breach date |
| `creditAgreementSection` | text | optional | — | Reference for paper trail, e.g. `§8.1(a)` |
| `notes` | text | optional | — | Free-form |

---

## 4. The five things `consequenceOnBreach` can be

This single dropdown drives the entire engine behaviour. Pick wisely.

### `notice` (default for compliance-only covenants)
- Tagged in DB, shown on Dashboard, no engine adjustments
- Use for information covenants or things you only want recorded

### `marginStepUp`
- Engine adds `breachStepUpBps` to the daily coupon rate from `breachDate` onwards
- Stacks additively across multiple breached covenants
- JE memo on interest accrual: `"Interest Adjustment for YYYY-MM-DD — includes covenant-breach step-up +XXXbps"`
- Set `breachStepUpBps` field to control the size (e.g. 75 = +0.75%)

### `sicrTrigger`
- Engine escalates `inst.ifrs.ecLStage` from 1 to 2 for every day after `breachDate`
- ECL calculation switches from 12-month expected loss to lifetime expected loss
- For Cascade Capital (USGAAP, $20M, PD=0.5%, LGD=35%): peak allowance goes from ~$35k (Stage 1) to ~$135k (Stage 2) — a **4.5x jump**
- JE memo on ECL provision: `"ASC 326 CECL provision for YYYY-MM-DD — SICR triggered by covenant breach (ASC 326-20-30-2)"`
- Framework-aware citation: IFRS 9 §B5.5.17(k) / ASC 326-20-30-2 / AASB 9 §B5.5.17 / ASPE 3856.16

### `mandatoryPrepayment` / `acceleration` / `eventOfDefault`
- Engine synthesises a `mandatoryPrepayment` event into the principal schedule at `breachDate + curePeriodDays`
- Event amount = full outstanding balance at trigger date (acceleration)
- Existing Tier 2 #16 handler picks it up, generates the cash-leg JE pair
- Stops further interest accrual past acceleration date (balance = 0)
- JE memo on the prepayment: `"Mandatory prepayment YYYY-MM-DD (covenantBreach)"`

### `defaultInterest`
- Reserved for future expansion — currently treated like `notice`
- Use the `defaultEvents[]` table for default rate uplifts today

---

## 5. How a breach actually gets detected

The engine runs this loop **every time you click Run Accounting**:

```
For each covenant in inst.covenants[]:
  val = lastReportedValue
  thr = threshold
  
  If direction == 'max':  breached = (val > thr)
  If direction == 'min':  breached = (val < thr)
  If direction == 'eq':   breached = (val != thr)
  
  If breached:
    breachDate = lastReportedDate ?? lastTestDate ?? nextTestDate ?? settle
    curePeriodEndDate = breachDate + curePeriodDays
    Tag covenant with status='breached', store on M.schedule.covenants
    Apply consequences to coupon / ECL / principal schedule
  Else:
    Tag covenant with status='compliant' (or 'headroomWarning' if <10% buffer)
```

**Headroom warning:** if the value is within 10% of the threshold without breaching, the covenant is tagged `status='headroomWarning'` and the Dashboard shows an amber chip (`WATCH`).

---

## 6. How to set up a covenant — step by step

### Setup in the UI

1. **Stage 0** tab
2. Scroll to the **Covenants & Reporting** section (purple-tinted)
3. Click **+ Add covenant**
4. Fill in:
   - Name: "Total Net Leverage Ratio"
   - Category: maintenance
   - KPI: leverageRatio
   - Direction: max
   - Threshold: 4.00
   - Unit: x
   - Test Frequency: quarterly
   - On Breach: marginStepUp
   - Step-Up (bps): 75
   - Latest Value: 2.80 (initially compliant)
   - As Of: 2026-04-15
   - Credit Agreement Ref: §8.1(a)
5. Autosave kicks in (1.5s after last edit). The chip in the header should go green: `Saved`.

### Bonus — DB-direct setup (for bulk loads or scripted demos)

```sql
INSERT INTO covenants (
  deal_id, covenant_no, name, category, kpi_metric, direction,
  threshold, unit, test_frequency, cure_period_days,
  consequence_on_breach, breach_step_up_bps,
  last_reported_value, last_reported_date,
  credit_agreement_section, notes
) VALUES (
  '<deal-uuid>', 1, 'Total Net Leverage Ratio', 'maintenance', 'leverageRatio', 'max',
  4.00, 'x', 'quarterly', 0,
  'marginStepUp', 75,
  2.80, '2026-04-15',
  '§8.1(a)', 'Initial setup'
);
```

---

## 7. How to test a breach

### In the UI (recommended)

1. Make sure a deal with a covenant is loaded (try Cascade Capital or Cypress Distressed)
2. Stage 0 → covenant card → change **Latest Value** to push it past the threshold
3. Wait 1.5s for autosave (or click Save to DB)
4. Stage 2 tab → **Run Accounting**
5. Toast says `Breach log · 1 active · 0 cured`
6. **Dashboard tab** → scroll to Covenants → red banner appears
7. **Stage 2 evidence pack** → expand "Covenant-Driven Adjustments"
8. **Stage 0 covenant card** → expand "Breach history (1)"

### In DevTools console (faster for iteration)

```js
B.covenants[0].lastReportedValue = 4.10;
B.covenants[0].lastReportedDate = '2026-04-15';
window.registerBuilderInstrument();   // re-project B → inst
runAccounting();
```

To cure: set value back to compliant and re-run.

```js
B.covenants[0].lastReportedValue = 2.80;
window.registerBuilderInstrument();
runAccounting();
```

---

## 8. What happens when a breach is detected

The cascade of effects all fire on **one Run Accounting click**:

| Layer | Effect | Visible where |
|---|---|---|
| **Engine — coupon rate** | Adds `breachStepUpBps / 10000` to daily rate for breached `marginStepUp` covenants. Stacks additively. | Stage 1 cashflow table interest column rises; Stage 2 JE memo includes `+XXXbps` suffix |
| **Engine — ECL** | If any breached covenant has `sicrTrigger`, forces stage = 2 (lifetime ECL) from breach date | Stage 2 ECL JEs change, peak allowance rises ~4-5x |
| **Engine — principal schedule** | If `mandatoryPrepayment` consequence, synthesises a `mandatoryPrepayment` event at `breachDate + curePeriodDays` for the full balance | Stage 1 cashflow table shows early payoff; Dashboard ladder shows acceleration bar |
| **DB — covenant_breach_log** | Inserts a row with status='active', breach_value, consequence_applied[], detected_at | `SELECT * FROM covenant_breach_log WHERE covenant_id = '...'` |
| **DB — JE memos** | Every affected JE row carries framework-tagged citation in `transaction_comments` | `SELECT transaction_comments FROM journal_entries WHERE ...` |
| **Dashboard banner** | Red strip below Covenants chip row listing each breached covenant + chips for each consequence applied | Dashboard tab → Covenants & Maintenance Tests section |
| **Stage 2 evidence pack** | New collapsible panel "Covenant-Driven Adjustments" with full §-citation table | Stage 2 tab → Accounting Evidence Pack → expand panel (only shows when ≥1 breach) |
| **Stage 0 history accordion** | "Breach history (N)" collapsible on each covenant card showing every breach + cure cycle ever recorded | Stage 0 → Covenants section → covenant card bottom |

---

## 9. What happens when a breach cures (value goes back to compliant)

1. Set `lastReportedValue` back inside the threshold
2. Run Accounting
3. Toast says `Breach log · 0 active · 1 cured`
4. DB row toggles: `status='active'` → `status='cured'`, populates `cure_date`, `cure_value`, `cured_at`
5. Engine drops the margin step-up, ECL collapses back to Stage 1 build-up, synthesised mandatoryPrepayment event is stripped
6. Dashboard banner disappears, Stage 2 evidence panel auto-hides
7. Stage 0 history accordion now shows the cycle as `cured` (green chip)

**The breach is not forgotten** — the row stays in `covenant_breach_log` permanently for audit. A future breach (same covenant, different `lastReportedDate`) creates a fresh row.

---

## 10. Two demo deals already loaded — try these

### Cascade Capital Term Loan (`CASCADE_001`)
- Simple case, USGAAP, $20M, 5yr
- 1 covenant: Total Net Leverage Ratio · max 4.00x · currently 2.80x (compliant)
- Use for: solo breach testing, ECL Stage 1 ↔ 2 transition, margin step-up validation
- Try: set lastReportedValue=4.10 → run → see all the effects

### Cypress Distressed Loan (`CYPRESS_001`)
- Stressed case, USGAAP, $50M, 5yr
- **5 covenants, 3 already breached** out of the box:
  - Leverage 6.80x vs 5.00x max → `sicrTrigger` + 150bps
  - ICR 1.80x vs 2.50x min → `marginStepUp` +75bps
  - DSCR 0.95x vs 1.20x min → `mandatoryPrepayment` (60-day cure)
  - Liquidity $7M vs $5M min → compliant
  - ESG Score 75 vs 70 min → compliant
- Use for: multi-breach stacking demo, total margin step-up = 225bps, banner with multiple rows, evidence pack with multi-citation table
- Just load → Run Accounting → everything lights up

---

## 11. Quick verification queries (Supabase SQL editor)

```sql
-- All covenants on a deal with current breach state
SELECT name, direction, threshold, last_reported_value,
       consequence_on_breach, breach_step_up_bps
FROM covenants
WHERE deal_id = (SELECT id FROM deals WHERE deal_code = 'CYPRESS_001');

-- Active breaches across all deals
SELECT c.name AS covenant, d.name AS deal,
       l.breach_date, l.breach_value, l.threshold_at_breach,
       l.consequence_applied, l.status
FROM covenant_breach_log l
JOIN covenants c ON c.id = l.covenant_id
JOIN deals d ON d.id = l.deal_id
WHERE l.status = 'active'
ORDER BY l.breach_date DESC;

-- Full breach + cure history for one covenant
SELECT breach_date, status, breach_value, cure_date, cure_value,
       margin_step_up_bps, sicr_triggered, prepayment_triggered
FROM covenant_breach_log
WHERE covenant_id = (SELECT id FROM covenants WHERE name = 'Total Net Leverage Ratio' LIMIT 1)
ORDER BY breach_date DESC;

-- JE rows tagged with covenant-driven side effects
SELECT effective_date, transaction_type, transaction_comments
FROM journal_entries
WHERE transaction_comments ILIKE '%covenant%'
   OR transaction_comments ILIKE '%SICR%'
   OR transaction_comments ILIKE '%step-up%'
ORDER BY effective_date DESC
LIMIT 20;
```

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Edits to `B.covenants[0].lastReportedValue` in console don't change engine output | `runAccounting` reads from `inst.covenants`, not `B.covenants` | Call `window.registerBuilderInstrument()` BEFORE `runAccounting()` |
| Dashboard banner doesn't appear | No active breach in current engine output | Confirm `M.schedule.covenants[0].status === 'breached'`. Headroom warnings don't trigger the banner. |
| "Breach history (N)" accordion missing on Stage 0 card | Covenant was just created and breach hasn't been written to DB yet | Run Accounting first — `syncBreachLog` writes on each run |
| `syncBreachLog` reports `inserted: 0` for a clearly-breached covenant | Covenant has no DB `id` (manually-typed, never saved) | Click Save to DB on Stage 0 first to mint the covenant UUID |
| Multiple breaches but only one chip on Dashboard banner | Consequence chips render per-covenant in their own row | Scroll down — each breached covenant gets its own block in the banner |
| Stage 2 evidence panel empty | Panel only shows when there are breaches in M.schedule.covenants | Re-run accounting after triggering the breach |
| Margin step-up doesn't show in JE memo | The JE batch covers a period with NO step-up active | Step-up memo only appears on periods where `covenantMarginStepUpBpsMax > 0`. Confirm the JE's effectiveDate is after the breachDate. |

---

## 13. Glossary

| Term | Definition |
|---|---|
| **Breach** | Reported value crosses the threshold in the wrong direction |
| **Cure period** | Grace window after breach before consequences fire — default 0 (immediate) |
| **Cure** | Value returns inside the threshold; resolves the breach |
| **Equity cure** | Sponsor injects equity to fix a financial covenant breach |
| **Headroom** | Distance between current value and threshold, as percentage |
| **Headroom warning** | Within 10% of threshold but not yet breached |
| **SICR** | "Significant Increase in Credit Risk" — IFRS 9 §5.5 / ASC 326 trigger to lifetime ECL |
| **ECL** | Expected Credit Loss — IFRS 9 / CECL provision against the loan |
| **EIR** | Effective Interest Rate — IFRS 9 / ASC 310-20 yield on the carrying amount |
| **DSCR** | Debt Service Coverage Ratio = cash available / debt service |
| **ICR** | Interest Coverage Ratio = EBITDA / interest expense |
| **Leverage Ratio** | Net debt / EBITDA |
| **Margin step-up** | Contractual rate increase imposed on breach |
| **Mandatory prepayment** | Lender forces full or partial repayment |
| **Acceleration** | Full balance becomes immediately due (typical event of default) |
| **SLL** | Sustainability-Linked Loan — pricing tied to ESG KPI |

---

## 14. Reference — files & line numbers

| What | Where |
|---|---|
| `applyCovenantSideEffects(instr)` function | `loan-module-engine.js:680` |
| Engine wiring in `buildSchedule()` | `loan-module-engine.js:854` |
| Margin step-up logic | `loan-module-engine.js:~1517` |
| SICR auto-migration | `loan-module-engine.js:~1591` |
| Mandatory prepayment synthesis | `loan-module-engine.js:~866` |
| Framework-aware JE memos | `loan-module-engine.js:~2731, ~2628` |
| `syncBreachLog` write path | `loan-module-v3-builder.html:~2977` |
| `fetchUserDeals` read-back | `loan-module-v3-builder.html:~3768` |
| Dashboard banner render | `loan-module-v3-builder.html:~12515` |
| Stage 2 evidence panel | `loan-module-v3-builder.html:~1934` (HTML), `~9723` (renderer) |
| Stage 0 history accordion | `loan-module-v3-builder.html:~14819` |
| DB table `covenants` | Supabase project `prljhhyfgzipjnfpztfu` |
| DB table `covenant_breach_log` | Same |
