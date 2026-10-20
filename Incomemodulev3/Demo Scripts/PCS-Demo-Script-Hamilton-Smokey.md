# PCS Loan Module — Demo Script

## Hamilton / Sheaf Energy Ltd · External Deal Smokey
### 45 minutes, accounting-led

**Version:** V4.60 · 8 October 2026
**Audience:** fund accountants, financial controllers, loan operations
**Figures:** every number below was read from the live system on 8 October 2026. Where a figure is expected to move, it is marked.

---

## Before you start — five-minute pre-flight

Run this the morning of the demo, not the night before. An external deal's figures change when a snapshot is re-imported.

| Check | Expected | Why it matters |
|---|---|---|
| Page title reads **V4.60** | `PCS Loan Module · V4.60` | V4.59 and earlier post one journal pair per feed row. Hamilton produces 14,628 lines instead of 164 and the demo collapses. |
| Hamilton loads with **3,652** cashflow rows | Cashflow tab row count | Confirms the current snapshot is the 8 Oct import, not an earlier one. |
| Hamilton accounting run returns **164 JE rows, balanced** | Accounting tab | This is the headline number for the whole first half. |
| Smokey loads with **87** cashflow rows and **93** events | Cashflow and Lifecycle tabs | Smokey is the period-level feed; 87 rows is correct, not truncated. |
| Smokey accounting run completes | Accounting tab | Smokey's stored run predates the V4.60 changes. **Re-run it before the demo** so what you show matches what the engine now does. |

### Two things to steer around

Both are real and both are logged. Neither stops the demo, but do not walk into them unprepared.

1. **Smokey's final repayment does not post.** The feed carries 37 principal payments totalling £58,345,261.74. The ledger posts 36, totalling £31,346,389.39, stopping at 30 December 2033. The missing entry is the maturity balloon of £26,998,872.35 on 27 March 2034 — the last date in the feed. Consequence: Smokey's carrying value does not reach nil. If you show a full-life carrying value curve, it ends on a stub. Show the first seven years instead, or acknowledge it.
2. **Smokey's PIK capitalisations do not journalise.** The feed carries 39 capitalisation events totalling £8,345,261.74; no PIK journal lines are produced. Demonstrate PIK as *deal mechanics* on the Lifecycle tab, not as journal entries.

If someone asks directly, the honest answer is better than a deflection: *"That's a known posting gap on the feed's final period — it's logged and it doesn't affect the accruals or the impairment you've just seen."*

---

## Running order

| | Minutes | Segment | The point being made |
|---|---|---|---|
| 1 | 0–4 | Why this exists | Two systems, one loan |
| 2 | 4–10 | Hamilton — deal setup | What PCS accepts and what it refuses to guess |
| 3 | 10–18 | Hamilton — components | Accrual frequency is an accounting decision |
| 4 | 18–26 | Hamilton — the accounting run | 3,652 rows become 164 journal lines |
| 5 | 26–31 | Hamilton — impairment, live | Parameters in, ECL out |
| 6 | 31–41 | Smokey — the harder deal | PIK, fee classification, real ECL movement |
| 7 | 41–45 | GL mapping and close | The chart is the client's, not ours |

---

# 1 · Why this exists
### 0:00 – 0:04 · no system, just talk

**Say this.** A private-credit loan gets calculated in one system and accounted for in another. The servicing system knows what the borrower owes — interest to the penny, every day. The accounting system needs something different: an effective interest rate, an impairment allowance, a modification gain or loss, and journal entries that balance in a chart of accounts.

Those are not the same question, and the gap between them is where the errors live. Either the figures are right and the accounting is wrong, or the accounting is right for a schedule that has since been restated and nobody noticed.

**The one sentence to land.** *PortF calculates. PCS accounts. PCS never writes back.* If PortF says a day accrued £870.03, PCS posts £870.03 — it does not form a second opinion. What PCS owns is everything PortF has no view on: the EIR, the impairment, the journal, the ledger.

**Set up the two deals.**

> *"I've got two live deals. Hamilton is a £60 million amortising facility against a UK battery storage project — it sends us a daily cashflow file, 3,652 rows. Smokey is a £50 million ten-year loan to an energy infrastructure developer, with PIK — it sends us 87 period rows. Same contract, two very different files, and I want to show you that the accounting comes out right either way."*

---

# 2 · Hamilton — deal setup
### 0:04 – 0:10 · Deal Setup tab

Load `SPHAMILTONSP013`. The banner across the top is the first thing to point at.

**On screen.** `external · SPHAMILTONSP013` and the snapshot timestamp.

**Say this.** Every screen on this deal tells you where the data came from and when. That matters because the figures are not ours — if somebody asks in three months why interest income moved, the first question is always *which version of the file are we looking at*, and the answer is on the screen rather than in somebody's inbox.

### Field by field

| Field | Value | Business meaning | What the system does with it |
|---|---|---|---|
| Deal Name | Hamilton / Sheaf Energy Ltd | Display only | Never keyed on. A rename does not create a second deal. |
| Deal ID / GUID | SPHamiltonSP013 | The immutable identity | Snapshot diffing keys on this. If it changed between imports, every restatement would read as new business. |
| Agent | NatWest | Facility agent | Carried for reporting; no accounting effect. |
| Currency | GBP | Deal currency | Must be explicit. Never inferred from a symbol — a blank currency blocks the import. |
| Accounting Framework | IFRS | Which rulebook applies | Drives the ECL model, the modification test, and which GL mapping column is used. A property of the deal, not a system setting. |
| Settlement date | 1 Nov 2023 | Facility start | Day one of the accrual clock. |
| Maturity | 30 Jun 2035 | Contractual end | Note: the ledger stops where the *feed* stops, not here. |
| Day count | ACT/365 | GBP convention | Sterling facilities are ACT/365, not ACT/360. Getting this wrong moves annual interest by about 1.4%. |
| Committed | £60,000,000 | Facility size | The base the commitment fee is charged on, via the unfunded balance. |
| Facility | Facility A, amortising loan | Repayment shape | Descriptive here; the actual profile comes from the movements. |

**The point to make.** Everything on this screen is read-only. Deny by default — a field added to this form next quarter is locked until somebody explicitly opens it. The reason is simple: if a user could edit a figure PortF owns, the two systems would disagree and neither would know.

**If asked — "what if the file is wrong?"** It gets corrected in PortF and re-sent. PCS will show you the difference against the previous snapshot. What PCS will not do is let somebody quietly patch it here, because then the correction exists in one system only.

---

# 3 · Hamilton — components
### 0:10 – 0:18 · Components / Fees tab

This is the heart of the first half. Slow down here.

**On screen.** Three components.

| | C1 Interest | F1 Commitment Fee | F2 Arrangement Fee |
|---|---|---|---|
| Posting type | interest | fee | fee |
| Interest type | SONIA | — | — |
| Rate | from the feed | 1.05% | flat |
| Balance basis | Principal Balance | **Unfunded Balance** | — |
| Accrual frequency | **Semi-annual** | **Quarterly** | One-off |
| First settlement | 29 Sep 2024 | 3 Mar 2025 | 3 Dec 2023 |
| Settlement type | Cash | Cash | Cash |
| Yield integral | — | **Yes** | **Yes** |

### Balance basis — the business distinction

**Say this.** Look at the two bases. Interest is charged on what the borrower has actually drawn. The commitment fee is charged on what they have *not* drawn — the money we are holding available for them. Those move in opposite directions over a construction drawdown: as the facility draws, interest rises and the commitment fee falls.

That is why the fee cannot be a percentage of the loan balance. It is a percentage of the undrawn commitment, and PCS derives that balance itself from the movements rather than taking it on trust.

### Accrual frequency — the accounting decision

**Say this.** This is the field that does the most work on this screen, and it is worth being explicit about why.

The file sends us interest daily — 2,741 separate rows. But the facility pays semi-annually. So: do we recognise interest income 2,741 times, or 23 times?

The answer is 23. The daily rows are *supporting detail* — the arithmetic behind each coupon period — not 2,741 separate economic events. A lender recognising interest income on a day with no coupon, no cash and no contractual event is not describing anything that happened.

**The system part.** Each component carries its own accrual frequency, and the two on this deal differ — interest semi-annual, commitment fee quarterly. PCS groups the received rows into the period each component's own file nominates, anchored on its stated first settlement date. The daily detail is retained and visible; what changes is the period in which income is recognised.

> **Hold this number up.** 3,652 rows in. 23 interest accruals and 12 fee accruals out. Not one penny moves — a period's accrual is the exact sum of its daily rows. What changes is the granularity, and it changes to the one the file asked for.

### Yield integral — the IFRS 9 question

**Say this.** Both fees here are marked Yield Integral = Yes. That is an accounting judgement with real consequences, and it is one PCS refuses to infer.

An arrangement fee is part of what we earn for lending the money. Under IFRS 9 §B5.4.1 it is not revenue when it is received — it goes into the carrying amount and is released into interest income across the life of the loan through the effective interest rate.

A fee for performing a service is different. That is IFRS 15, and it is recognised as the service is performed.

**Why PCS will not guess.** The word "fee" tells you nothing. "Arrangement and agency fee" is genuinely ambiguous — part yield, part service. If PCS inferred it from the name and got it wrong, the reported yield would move and nothing on screen would say why. So the file states it, and where it does not, PCS records the fee, keeps it out of the EIR, and warns you that it did.

You will see the other side of this on Smokey in twenty minutes.

**If asked — "what happens if we disagree with the classification?"** It is changed in the file and re-imported, and the EIR is re-solved. It is not a toggle in PCS, because that would put the yield-defining decision in two places.

---

# 4 · Hamilton — the accounting run
### 0:18 – 0:26 · Accounting tab

Press **Run & JEs**. While it runs, explain what it is doing.

**Say this.** Three things happen in order. PCS solves the effective interest rate against the cashflows we were actually sent — including the two integral fees, because they are part of the return. It measures impairment under IFRS 9. Then it generates journal entries, maps each one to the client's chart of accounts, and splits by legal entity.

**On screen when it finishes.**

| | |
|---|---|
| Journal entries | **164 rows, balanced** |
| Total debits / credits | £74,646,992.66 each |
| Interest (life) | £7,541,995.92 |
| Fees (life) | £1,778,730.37 |
| Drawdowns | £56,005,540.08 |

### Walk the journal register

**Interest — 23 periods.** 92 lines, four per period.

```
DR  113000  Accounts Receivable            ← the borrower owes us
CR  421000  Investment Interest Income     ← we earned it

DR  111000  Cash                           ← they paid
CR  113000  Accounts Receivable            ← receivable cleared
```

**Say this.** That is the shape every accountant in the room is checking for. Income recognised when earned, a receivable raised, cash applied against the receivable when it arrives. Between the accrual and the payment there is a real asset on the balance sheet.

**Point at the receivable deliberately.** Until recently this deal posted the accrual and the settlement on the same day, every day, so the receivable was raised and cleared within one date and never carried a balance. It netted to the right income, but any balance sheet struck mid-period showed nothing receivable. It now behaves as it should.

**Fees — 12 periods.** 48 lines. Eleven quarterly commitment fee accruals plus the one-off arrangement fee.

```
DR  113000  Accounts Receivable
CR  492000  Fee Income
DR  111000  Cash
CR  113000  Accounts Receivable
```

**Drawdowns — 12 events.** 24 lines.

```
DR  141000  Investments at Cost           ← the loan asset grows
CR  111000  Cash                          ← our money goes out
```

**Say this.** Note what drawdowns are *not*. They are not aggregated into periods — each one keeps its own date, because a drawdown is a dated event where money actually moved, not accrual detail. Aggregating it would move real cash to a date it did not happen on. Accruals aggregate; events do not.

**Arithmetic to say out loud.** 23 interest periods × 4 lines = 92. 12 fee periods × 4 = 48. 12 drawdowns × 2 = 24. Ninety-two plus forty-eight plus twenty-four is 164. Every line is accounted for and the batch balances.

**If asked — "where is the principal repayment?"** The feed carries a single principal payment at maturity. Be straight: on this snapshot it does not appear in the journals, and that is logged. It does not affect the interest, the fees or the drawdowns on screen.

---

# 5 · Hamilton — impairment, live
### 0:26 – 0:31 · Treatment overrides

This is the best interactive moment in the demo. Do it live.

**Open Treatment overrides.** Point out that *Compute ECL* is ticked, but **PD and LGD are both empty**.

**Say this.** The system is being asked to measure expected credit loss and has not been told the two parameters it needs. Notice what it does not do: it does not assume a default rate, and it does not quietly post zero and call that an answer. There is no impairment line in the journals we just looked at, because nothing has been measured.

That is deliberate. A zero that was assumed looks exactly like a zero that was calculated, and only one of them is a fact.

**Now enter the parameters.** Use a defensible pair and say where they come from.

- **PD (annual): 0.005** — 50 basis points, consistent with an investment-grade-equivalent infrastructure borrower with contracted revenues.
- **LGD: 0.30** — 30%, reflecting a senior secured position over a physical asset with a strong recovery history.

Save. Re-run the accounting.

**Say this while it runs.** IFRS 9 requires loss to be recognised before it is incurred. We are not waiting for a missed payment; we are recognising, from day one, that a portfolio of loans like this one produces losses, and reserving the expected value of them.

The arithmetic is deliberately simple to follow: exposure × probability of default × loss given default.

**On screen.** An impairment expense appears, with its paired allowance:

```
DR  470000  Impairment Expense (ECL)
CR  145000  Loan Loss Allowance (Contra-Asset)
```

**Say this.** The allowance is a contra-asset — it sits against the loan, it does not reduce the loan itself. The gross carrying amount is still what the borrower owes; the net is what we expect to collect. Both are reported, as separate columns, because they answer different questions. The borrower owes the gross figure regardless of what we think we will recover.

**If asked — "how do you handle stages?"** Three-stage under IFRS 9: twelve-month expected loss while credit risk has not significantly increased, lifetime loss once it has, and once credit-impaired the interest itself is calculated on the net carrying amount rather than the gross under §5.4.1(b). The stage can be set directly or driven from days past due and covenant status.

---

# 6 · Smokey — the harder deal
### 0:31 – 0:41 · load SPSMOKEY015

**Say this to transition.** Hamilton was the clean case. Smokey is the one that looks like real life: PIK, a mix of fee types that get different accounting, and an actual impairment movement over time.

### The file is shaped completely differently

| | Hamilton | Smokey |
|---|---|---|
| Cashflow rows | 3,652 | **87** |
| Row grain | one day each | **true periods** |
| Events | 13 | **93** |
| Day count | ACT/365 | ACT/360 |
| Committed | £60,000,000 | £50,000,000 |
| Term | Nov 2023 – Jun 2035 | Mar 2024 – Mar 2034 |
| Balance checkpoints | 3,234 | 27 |

**Say this.** Eighty-seven rows against three and a half thousand, and both produce correct accounting. Smokey's provider sends period-level rows already — quarterly, with start and end dates stated. Hamilton's sends daily detail. PCS does not have a preferred shape; it has a stated accrual frequency per component, and it recognises income in that period whichever way the file arrives.

### Fee classification — the contrast to Hamilton

**On screen.** Four components, and this is the slide to linger on.

| | Type | Frequency | Yield integral | Treatment |
|---|---|---|---|---|
| C1 Interest | SONIA | Quarterly | — | Interest income |
| F1 Arrangement fee | fee | One-off | **Yes** | **IFRS 9** — into the carrying amount, released through the EIR |
| F2 Monitoring fee | fee | Quarterly | **No** | **IFRS 15** — recognised as the service is performed |
| F3 Commitment fee | fee | Quarterly | *not stated* | Recorded, kept out of the EIR, **and PCS warns you** |

**Say this.** Three fees, three different answers, and the difference is accounting substance rather than naming.

The arrangement fee is £750,000 received once, at the start. We did not earn three-quarters of a million pounds on day one for arranging a signature — we earned it for putting ten years of capital at risk. So it goes into the carrying amount and comes back out through the effective interest rate across the life.

The monitoring fee is the opposite. We are performing a service each quarter — covenant checks, reporting, administration — and we recognise the fee as we perform it. That is IFRS 15, and it stays out of the yield.

Now the third one. The commitment fee does not state its classification, so PCS has recorded it, kept it out of the EIR, and told you it did. Open the validation panel and read the warning aloud:

> *"fee 'Commitment Fee' does not state Yield Integral. PCS cannot tell whether it forms part of the yield or is payment for a service, so it will be recorded but kept out of the effective interest rate."*

**Say this.** That is the behaviour I would want you to judge the system on. It could have guessed from the word "commitment". It would have been right most of the time. But "most of the time" on a yield calculation is not a standard anybody can audit, and a silent inference that moves reported income is the thing you find out about eighteen months later.

### PIK — the mechanics

**On screen.** Lifecycle tab: 17 drawdowns totalling £50,000,000, and **39 capitalisation events totalling £8,345,261.74**.

**Say this.** PIK is interest the borrower does not pay in cash — it is added to the principal and the borrower then pays interest on the larger balance. It is common where cash flow is tight early, as it is during construction.

The arithmetic is worth saying aloud because it is the check an accountant will do: drawn £50,000,000, capitalised £8,345,261.74, and the principal repayments across the life total £58,345,261.74. Fifty plus eight-point-three-four-five is fifty-eight-point-three-four-five. The capitalised interest is repaid as principal, because that is what it became.

> **Steer here.** Show this on the Lifecycle tab as deal mechanics. The capitalisation events do not currently produce journal lines — that is logged. Do not open the journal register looking for them.

### The accounting run

**On screen** (re-run before the demo — the stored run predates V4.60):

| | |
|---|---|
| Journal entries | ~548 rows, balanced |
| Interest (life) | £29,576,624.64 |
| Fees (life) | £1,724,644.46 |
| Drawdowns | £50,000,000.00 |

**Say this.** Interest of £29.6 million on a £50 million facility over ten years. That is a 5.9% average all-in on the drawn balance — and because this is PIK, part of it is compounding.

### Impairment that actually moves

This is the strongest accounting moment in the deck, because the allowance is not static.

**On screen.** Treatment overrides: **PD 0.50%, LGD 30%**. Journal register: impairment expense £75,000 established across 17 entries, and £47,019.59 released across 30.

**Say this — do the arithmetic out loud.** £50 million exposure, 0.5% probability of default, 30% loss given default. Fifty million times half a percent is two hundred and fifty thousand; thirty percent of that is seventy-five thousand pounds. That is the allowance at full exposure, and you can check it on the back of an envelope.

Then watch what happens as the loan amortises. As principal is repaid, the exposure falls, so the required allowance falls with it, and the excess is released back through the P&L — £47,019.59 of it across thirty reporting dates. Impairment is not a provision you take once and forget. It is re-measured every reporting date against the exposure that actually exists, and it moves in both directions.

**If asked — "is the release a gain?"** It is a credit to the same impairment expense line, not a separate gain. The P&L shows the net movement in the allowance for the period, which is what IFRS 9 asks for.

---

# 7 · GL mapping and close
### 0:41 – 0:45 · Configuration → General Ledger Mapping

**Say this.** Everything you have seen posts to a chart of accounts. It is not our chart — it is yours.

**On screen.** The mapping screen: one row per business event, with a debit and a credit account, held per accounting framework.

| Business event | DR | CR |
|---|---|---|
| Drawdown | 141000 Investments at Cost | 111000 Cash |
| Interest accrual | 113000 Accounts Receivable | 421000 Investment Interest Income |
| Commitment fee | 113000 Accounts Receivable | 492200 Commitment Fee Income |
| ECL impairment | 470000 Impairment Expense | 145000 Loan Loss Allowance |
| Loan restructuring | 141000 Investments at Cost | 440000 Modification Gain/Loss |

**Say this.** Two things about this screen are worth a minute.

First, it is held **per framework**. The same business event posts to the account each framework requires, so an IFRS deal and a US GAAP deal in the same portfolio each land where they should without anybody re-keying.

Second — change an account here, re-run the accounting, and the journals follow. The mapping is read fresh at the start of every run. It is configuration, not a report of what the engine decided.

**Demonstrate it if there is time.** Change one account code, re-run Hamilton, show the journal line move. It takes ninety seconds and it is more convincing than any assurance.

**A detail worth mentioning.** An account code typed here is validated against the real chart. If it is not an account that exists, the save is refused with the code named. A mapping screen that accepted a typo and then posted to it would be worse than no mapping screen at all.

### Closing

**Say this.** Two deals, very different files. One sends daily detail, one sends periods. One has PIK, one amortises. One has three fees with three different accounting treatments.

What they have in common is that the accounting judgement sat in one place throughout. The servicing system calculated what the borrower owes. PCS decided what that means under IFRS 9 — when income is recognised, which fees belong in the yield, what the loss allowance should be — and produced balanced journals in your chart of accounts.

Nothing was inferred that could have been stated, and where something had to be inferred, the system said so on screen.

---

## Appendix A — verified figures

Read from the live system, 8 October 2026.

### Hamilton / Sheaf Energy Ltd — SPHAMILTONSP013

| | |
|---|---|
| Snapshot | SPHAMILTONSP013-XLS-20261008110943 |
| Framework / currency / day count | IFRS · GBP · ACT/365 |
| Term | 1 Nov 2023 – 30 Jun 2035 |
| Committed | £60,000,000 |
| Cashflow rows | 3,652 (all single-day periods) |
| Interest, life | £7,541,995.92 over 2,741 daily rows → **23 semi-annual accruals** |
| Commitment fee, life | £1,178,730.37 over 910 daily rows → **11 quarterly accruals** |
| Arrangement fee | £600,000.00, one event, 3 Dec 2023 |
| Drawdowns | £56,005,540.08 across 12 events |
| Journal entries | **164 rows, balanced**, DR = CR = £74,646,992.66 |
| ECL | none — PD and LGD not set |
| Balance checkpoints | 3,234 |

### External Deal Smokey — SPSMOKEY015

| | |
|---|---|
| Snapshot | SPSMOKEY015-XLS-20261001192324 |
| Counterparty / agent | Haventus (Ardersier) · M&G Trustee Company Limited |
| Framework / currency / day count | IFRS · GBP · ACT/360 |
| Term | 27 Mar 2024 – 27 Mar 2034 |
| Committed | £50,000,000 |
| Cashflow rows | 87 (true periods) |
| Interest, life | £29,576,624.64 over 39 quarterly rows |
| Arrangement fee | £750,000.00 — IFRS 9, integral |
| Monitoring fee | £300,164.31 over 40 rows — IFRS 15, not integral |
| Commitment fee | £674,480.15 over 7 rows — classification not stated, warned |
| Drawdowns | £50,000,000.00 across 17 events |
| PIK capitalisations | £8,345,261.74 across 39 events |
| Principal repayments, per feed | £58,345,261.74 across 37 events |
| ECL parameters | PD 0.50% · LGD 30% |
| ECL established / released | £75,000.00 / £47,019.59 |
| Journal entries | 548 rows, balanced (**re-run before demo**) |
| Balance checkpoints | 27 |

---

## Appendix B — known gaps, stated plainly

For your own awareness. Do not volunteer these; answer honestly if asked.

| # | Gap | Effect on the demo |
|---|---|---|
| 1 | Smokey's final principal repayment (£26,998,872.35, 27 Mar 2034) does not post. 36 of 37 events journalise. | Carrying value does not reach nil. Avoid a full-life carrying value chart for Smokey. |
| 2 | Smokey's 39 PIK capitalisation events produce no journal lines. | Show PIK on the Lifecycle tab, not the journal register. |
| 3 | Hamilton's single principal payment does not post. | Do not promise a repayment journal on Hamilton. |
| 4 | Hamilton has no PD or LGD stored. | This is segment 5. It is a feature of the demo, not a problem — enter them live. |
| 5 | Smokey's stored accounting run predates V4.60. | Re-run before the demo so the figures on screen match the current engine. |

---

## Appendix C — questions you should expect

**"Why don't you recalculate the interest yourselves, as a check?"**
We could, and it would create a reconciliation task that never ends. Two systems calculating the same number to different conventions will differ in the last penny, every day, forever. The division of labour is deliberate: they calculate, we account. What we do check is internal consistency — the balance checkpoints in the file are compared against the balances the movements imply, and a drift is reported immediately rather than compounding silently.

**"What happens when a prior period is restated?"**
The file arrives as a complete snapshot and PCS compares it against the previous one on immutable identifiers. Where a restated period has already been posted to the ledger, the recommended treatment is reverse and re-post rather than a delta entry, because it leaves a complete audit trail of what was reported and what replaced it.

**"Can we use this for deals we manage ourselves?"**
Yes, and they sit in the same portfolio. Internally managed deals are built in the module and PCS projects the full schedule, applies its own rate curves and runs its own fee engine. External deals are read-only and post what was received. Both roll up together.

**"How do you handle a modification?"**
PCS re-discounts the revised cashflows at the original effective interest rate and applies the 10% test under IFRS 9 §5.4.3. Below the threshold it is a modification — the carrying amount is adjusted and the difference goes to modification gain or loss. Above it the asset is derecognised and a new one recognised. The judgement is PCS's; the revised terms come from the servicer.

**"What if the file has an error?"**
It depends on whether the missing value would change a number. A blank currency or day count blocks the import outright, because defaulting them would silently misstate every figure in the file. A blank fee type or holiday calendar is imported with a warning, because the amounts still post correctly and rejecting a whole deal over a descriptive field helps nobody.
