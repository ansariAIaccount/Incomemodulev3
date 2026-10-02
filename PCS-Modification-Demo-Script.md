---
title: "PCS Loan Module — Demo Script"
subtitle: "Four worked IFRS 9 examples — modifications and POCI"
author: "FIS Private Capital Suite · Loan Module V4.14"
date: "2 October 2026"
---

# How to use this document

Four internally-built deals, all IFRS. The first three demonstrate different
kinds of change to contractual cash flows; the fourth demonstrates a purchased
credit-impaired asset, which is measured on an entirely different basis. All are
saved in the workspace and ready to open — no import step, no file to load.

Each section gives you: the business story, the exact screens to open in order,
what to point at on each screen, and the accounting outcome to land. The figures
quoted are the ones the module produces, verified against the engine.

Total running time, all four deals, roughly **50 minutes**. Deal 1 alone is a
workable 12-minute demo if that is all you have; deals 1 and 4 together make the
strongest 25-minute pairing, because they contrast the two completely different
ways IFRS 9 handles a distressed borrower.

| | Deal code | Shows |
|---|---|---|
| **1** | `DEMO-MOD-S3` | Coupon increase, maturity extension, amendment fee, PIK year, Stage 3 |
| **2** | `DEMO-DEFER-PIK` | Twelve-month principal holiday; cash coupon splits to cash + PIK; EAD grows |
| **3** | `DEMO-FORGIVE-S3` | Principal forgiveness, extension, covenant reset, fee into EIR |
| **4** | `DEMO-POCI` | Distressed secondary purchase; credit-adjusted EIR; no day-one allowance |

**Before you start.** Open the module, confirm the version banner reads V4.14 or
later, and check the Active Deal dropdown lists all four deal names. If a deal
is missing, the workspace connection has dropped — reconnect before you begin
rather than mid-demo.

---

# The one idea the whole demo rests on

Say this once at the start and refer back to it. Everything else is detail.

> When a borrower gets into difficulty and the terms change, the lender does not
> simply carry on. IFRS 9 §5.4.3 requires the gross carrying amount to be
> recalculated as **the present value of the revised contractual cash flows,
> discounted at the original effective interest rate** — and the difference goes
> straight to profit or loss.
>
> Two words carry the weight. *Revised*: the new cash flows, on their new dates.
> *Original*: the old rate, held deliberately, because the rate is what the
> lender locked in at inception and the modification is a change to the cash
> flows, not to the pricing of the original bargain.

The follow-up question from any auditor in the room will be: *how do you know
that number is right?* The answer in this module is that it is derived and shown
as a build-up, not typed in. That is the single most important thing to
demonstrate.

---

# Deal 1 — Amendment, extension and a PIK year

**`DEMO-MOD-S3` · Atlas Industrial Holdings · USD 100,000,000**

## The story

A five-year term loan drawn at par on 1 January 2024, paying SOFR plus 5%,
maturing 31 December 2028. Eighteen months in, the borrower hits a liquidity
wall. The lenders agree a package: the margin rises to SOFR plus 7%, maturity
extends two years to 31 December 2030, the lenders take a 2% amendment fee, and
the first post-amendment year of interest is paid in kind rather than cash.

Four things change at once, and each one moves the cash flows in a different
direction. That is the point of this deal — it is the realistic case, not the
textbook one.

## Screen 1 · Loan Builder — Deal Setup

**Open:** Stage 0 · Loan Builder, Deal Setup card.

**Point at:** the maturity date, 31 December 2030.

**Say:** this is the loan as it stands today, after the amendment. The original
maturity is not lost — it is recorded on the modification event, which we come
to. The Builder always shows current terms; history lives in the events.

## Screen 2 · Loan Builder — Tranche A, interest components

**Open:** same screen, scroll to the Tranche A card, expand Interest Components.

**Point at:** there are **two** components, not one.

| Component | Settlement | 1 Jan 24 – 30 Jun 25 | 1 Jul 25 – 30 Jun 26 | From 1 Jul 26 |
|---|---|---|---|---|
| Cash margin over SOFR | cash | +500 bps | **−400 bps** | +700 bps |
| PIK margin | capitalised | 0 bps | **+1100 bps** | 0 bps |

**Say:** this is how the module represents a coupon that changes both its *rate*
and its *settlement basis* over time. The spread schedule on each component is
date-windowed. During the PIK year the cash component is suppressed to nil and
the capitalised component carries the whole 11% — SOFR at 4% plus the new 7%
margin. On 1 July 2026 it reverses and interest goes back to cash.

**Why this matters:** a single component carries one settlement type for its
whole life. Modelling a bounded PIK holiday needs two components with
complementary windows. Mention this if anyone asks how they would set it up
themselves — it is the one piece of structure that is not obvious.

## Screen 3 · Loan Builder — Fees

**Open:** the Fees card.

**Point at:** Amendment fee, USD 2,000,000, one-off, payment date 1 July 2025,
IFRS treatment **IFRS9-EIR**.

**Say:** the fee is not income on the day it arrives. It is a cash flow between
the borrower and the lender, so under §B5.4.6 it belongs in the recalculation.
Watch the treatment flag — if it were marked as payment for a service it would
be IFRS 15 revenue and would stay out of the effective rate entirely. One
dropdown, two completely different income profiles.

## Screen 4 · Accounting Treatment overrides

**Open:** Stage 2 · Accounting Treatment.

**Point at, in this order:**

1. **ECL Stage = 3.** Credit-impaired. The borrower's difficulty is severe
   enough that default is no longer a probability, it is a condition.
2. **PD 100% · LGD 40%.** At Stage 3 the probability term drops out and the
   allowance is driven by loss given default.
3. **Stage 3 interest on net carrying amount.** Interest is recognised on the
   amount net of the allowance, not the gross balance — §5.4.1(b).
4. **Modification default treatment = non-substantial.** This is the policy
   switch that decides whether the loan is derecognised or re-measured.

**Say:** these four fields change the answer more than anything else on the
screen. Everything above them describes the loan; these describe our judgement
about it.

## Screen 5 · Run accounting

**Open:** Stage 2 · Run & JEs. Press **Run Accounting**.

While it runs, set up the next screen verbally: *what we are about to look at is
the one number the whole restructuring turns on.*

## Screen 6 · The modification build-up — the centrepiece

**Open:** the Evidence Pack, modification panel.

**This is the moment the demo exists for.** The module derives the gain or loss
rather than accepting it:

```
Pre-modification gross carrying amount        100,000,000
Original EIR (SOFR 4% + 500bps)                     9.00%

Revised contractual cash flows, discounted at 9%:
  Amendment fee, 1 Jul 2025, at t=0              2,000,000
  Quarterly interest at 11% to 31 Dec 2030     (21 payments)
  Principal repayment, 31 Dec 2030             100,000,000
                                        PV =   112,022,928

Modification GAIN                                12,022,928
PV change against carrying amount                  +12.02%
```

**Three things to say, in this order:**

**It is a gain, not a loss, and that surprises people.** The borrower is in
difficulty, so the instinct is to expect a write-down. But the lenders have
negotiated a *better* deal for themselves: a higher margin, for longer, plus a
fee. Discounted at the old 9% rate, that stream is worth more than par. The
credit deterioration is real — it just shows up in the ECL, not here. Two
separate effects, two separate places in the accounts. Conflating them is one of
the commonest errors in practice.

**The 12.02% is over the threshold.** §B5.4.6 treats a PV change of 10% or more
as substantial, which means derecognition of the old asset and recognition of a
new one — not the re-measurement we have just performed. The deal is configured
as non-substantial and the module has told us that is questionable. Use this
deliberately: *the system did not quietly do what it was told; it showed us the
test and left the judgement with us.*

**Every input is on the screen.** The rate used, the flows discounted, the dates.
If an auditor asks how the figure was arrived at, this panel is the answer.
Contrast with what the module did before V4.13 — it took the number on trust.

## Screen 7 · Journal entries

**Open:** Run & JEs, journal table. Filter to 1 July 2025.

| | DR | CR |
|---|---|---|
| Modification gain | 15000 Loan Asset Adjustment | 44000 Modification Gain (IFRS 9 §5.4.3) |

**Say:** the carrying amount of the asset goes up and the gain goes to P&L. One
entry, one date, fully traceable back to the build-up we just looked at.

## Screen 8 · ECL

**Open:** the ECL Calculation Trace panel.

**Point at:** the step change in the allowance at 1 July 2025 when the deal moves
to Stage 3, and the period-by-period table below it.

**Say:** this is where the credit deterioration lands. The modification gain and
the impairment charge are independent — one reflects the revised bargain, the
other reflects the borrower's capacity to honour it. A room that understands why
those are separate has understood IFRS 9 modification accounting.

---

# Deal 2 — Payment deferral and a PIK split

**`DEMO-DEFER-PIK` · Northwind Logistics Group · USD 100,000,000**

## The story

A five-year amortising loan drawn 1 January 2025, repaying 5,000,000 a quarter,
paying a 10% cash coupon. One year in, with 20,000,000 repaid, the borrower asks
for breathing room. Two concessions on 1 January 2026: no principal payments for
twelve months, and the 10% cash coupon splits into 6% cash plus 4% paid in kind.

Neither concession changes the rate. Both change *when* the lender sees the
money. This deal exists to show that timing alone moves the numbers.

## Screen 1 · Loan Builder — the repayment schedule

**Open:** Stage 0 · Loan Builder, Tranche A, Paydowns card.

**Point at:** the gap.

```
2025-03-31   5,000,000          2027-03-31   6,666,667
2025-06-30   5,000,000          2027-06-30   6,666,667
2025-09-30   5,000,000              …
2025-12-31   5,000,000          2029-12-31   6,666,667
             ↑  nothing at all in 2026  ↑
```

**Say:** sixteen instalments, not twenty. 20,000,000 paid before the amendment,
nothing for a year, then the remaining 80,000,000 across twelve larger payments.
The total repaid is identical. Only the dates moved — and that is enough to
change the present value.

## Screen 2 · Loan Builder — the two components

**Open:** Interest Components on the same tranche.

| Component | Base | Settlement | 2025 | From 2026 |
|---|---|---|---|---|
| Cash coupon | FIXED 6% | cash | +400 bps → **10%** | +0 bps → **6%** |
| PIK coupon | FIXED 0% | capitalised | 0 bps → **0%** | +400 bps → **4%** |

**Say:** the all-in rate is 10% throughout. Nothing about the pricing changed.
What changed is that four points of it now accrue to principal instead of
arriving as cash. Point at the settlement type column — that single field is the
whole modification.

## Screen 3 · Run accounting, then the modification build-up

**Open:** Run & JEs → Run Accounting → Evidence Pack, modification panel.

```
Pre-modification carrying amount (balance at 1 Jan 2026)   80,000,000
Original EIR                                                   10.00%

PV of revised cash flows at 10%                            80,392,742
Modification GAIN                                             392,742
PV change                                                      +0.49%
```

**Say:** essentially a wash — half a percent. And that is the correct answer.
The lender still earns 10% on every dollar outstanding; the deferral keeps more
principal outstanding for longer, and the PIK accretion compounds into a larger
final repayment. Discounted at the same 10%, those effects very nearly cancel.

**The teaching point:** a concession that *feels* generous can be close to
value-neutral in present-value terms, and the only way to know is to do the
arithmetic. Well under the 10% threshold, so non-substantial treatment is
clearly right here — unlike deal 1.

## Screen 4 · The balance path — where the real story is

**Open:** the Cashflow tab, balance chart.

**Point at:** the balance *rising* through 2026 while no principal is repaid.

**Say:** this is the point your credit team will care about more than the gain.
On a 100,000,000 balance, a year of 4% PIK adds 4,000,000. The borrower now owes
104,000,000, not 100,000,000.

## Screen 5 · ECL — exposure at default

**Open:** the ECL Calculation Trace.

**Point at:** the allowance rising during the PIK period even though the stage
does not change and the PD and LGD are untouched.

**Say:** Stage 2, lifetime ECL, PD 5%, LGD 40% — all constant. The allowance
grows purely because exposure at default grows. Deferring cash and capitalising
interest increases the amount at risk, and the ECL follows automatically. This
is the clearest illustration in the whole demo of why the modules have to be
joined up: a change made for liquidity reasons raises the impairment charge
without anyone touching a credit parameter.

---

# Deal 3 — Principal forgiveness and a covenant reset

**`DEMO-FORGIVE-S3` · Caledon Specialty Materials · USD 100,000,000**

## The story

An 8.5% fixed-rate term loan drawn 1 January 2024, originally maturing 31
December 2028. At the December 2025 covenant test the borrower reports leverage
of 5.6x against a 4.0x limit — a clear breach. The restructuring agreed on 1
January 2026 has three parts: 15,000,000 of principal is forgiven outright, the
maturity extends two years, and the leverage covenant resets to 6.0x in exchange
for a 1% amendment fee on the restructured principal.

## Screen 1 · Covenants

**Open:** Stage 0 · Loan Builder, Covenants card.

**Point at:** both covenants are on the deal.

| | Threshold | Last reported | Consequence |
|---|---|---|---|
| Leverage ratio (original) | max 4.0x | **5.6x** | SICR trigger |
| Leverage ratio (reset) | max 6.0x | — | SICR trigger |

**Say:** the breach is recorded, not just the fix. The original covenant shows
5.6x against a 4.0x limit — that is the event that forced everyone to the table.
Both carry a SICR trigger, so a breach moves the deal from Stage 1 to Stage 2
automatically under §B5.5.17(k), before anyone exercises judgement.

**The covenant reset itself changes no cash flows.** It is a concession on terms.
Make that explicit, because it is the contrast that makes the next two screens
land.

## Screen 2 · The forgiveness

**Open:** Stage 2 · Lifecycle Events.

**Point at:** `writeOff`, 1 January 2026, 15,000,000.

**Say:** note what this is *not*. It is not a repayment. No cash arrives. The
balance falls from 100,000,000 to 85,000,000 because the lender has given up the
right to collect it. If this were booked as a repayment the loss would vanish and
the accounts would show a loan that paid down normally. The distinction between
a receipt and a release is the whole of this screen.

## Screen 3 · The fee

**Open:** the Fees card.

**Point at:** 850,000 — 1% of the *restructured* 85,000,000, not the original
100,000,000 — dated 1 January 2026, flagged IFRS9-EIR.

**Say:** priced off the facility going forward. And like deal 1's fee, it goes
into the effective rate, not to income on receipt.

## Screen 4 · The modification build-up

**Open:** Run Accounting → Evidence Pack, modification panel.

```
Pre-modification gross carrying amount                   100,000,000
Original EIR                                                   8.50%
Forgiven at the modification date                       (15,000,000)

PV of revised cash flows at 8.5%:
  Amendment fee, 1 Jan 2026, at t=0                          850,000
  Quarterly interest at 8.5% on 85,000,000 to Dec 2030
  Principal repayment, 31 Dec 2030                        85,000,000
                                                 PV =     86,747,847

Modification LOSS                                       (13,252,153)
PV change                                                    −13.25%
```

**Three things to say:**

**The loss is not 15,000,000.** That is the number everyone in the room expects,
and it is wrong. The forgiveness costs 15,000,000 of principal, but the lender
gets 850,000 of fee and two extra years of 8.5% interest on the remaining
85,000,000. Net, the loss is 13.25m. Anyone who booked the headline forgiveness
figure would have overstated the charge by nearly 1.75m.

**This one also breaches the 10% test**, at −13.25%. Same conversation as deal 1,
opposite direction — and here the case for derecognition is considerably
stronger, because a partial forgiveness is close to the paradigm of an
extinguished original asset.

**Compare it with deal 2.** Same module, same method, same discount approach —
+0.49% on a timing change, −13.25% on a forgiveness. The method does not care
what kind of concession it is; it discounts whatever the revised cash flows turn
out to be. That consistency is what makes it defensible.

## Screen 5 · Journals

**Open:** Run & JEs, filtered to 1 January 2026.

| | DR | CR |
|---|---|---|
| Modification loss | 44000 Modification Gain / Loss | 15000 Loan Asset Adjustment |

Plus the write-off entries routing the forgiven principal against the allowance
(145000) with any residual to impairment expense (470000).

**Say:** the allowance is used before the expense line is touched. If the deal
had been carrying a large enough Stage 3 allowance, part of this forgiveness
would already have been provided for and the P&L hit would be correspondingly
smaller. That is the reward for provisioning early.

## Screen 6 · ECL and the close

**Open:** the ECL Calculation Trace.

**Point at:** Stage 3, PD 100%, LGD 45%, and the allowance measured on the
*net* carrying amount.

**Close on this:** three restructurings, three completely different outcomes —
a 12m gain, a half-percent wash, a 13m loss. None of them was typed in. Each is
derived from the revised cash flows and the original effective rate, with the
build-up on screen and every input traceable to a field somebody filled in.

---

# Deal 4 — A distressed purchase, and why POCI is different

**`DEMO-POCI` · Meridian Steelworks (in restructuring) · par USD 100,000,000**

## The story

A direct lending fund buys a loan in the secondary market on 1 January 2026.
Par value 100,000,000, contractual coupon 8%, maturing 31 December 2031. The
borrower is in serious difficulty — leverage at 8.2x against a 4.5x covenant,
interest cover at 0.9x against a 2.0x minimum, both subsisting breaches. The fund
pays **60,000,000**.

The 40,000,000 discount is not a bargain and it is not a liquidity premium. It is
the fund's own estimate of what it does not expect to collect. That single fact
changes the accounting completely.

## Lead with the contrast, not the mechanics

This is the deal where you should state the conclusion first, because the whole
section is counter-intuitive until the audience sees why.

> Deals 1 to 3 were loans we already held when the borrower got into trouble. We
> had an original effective rate, and we measured the change against it. This
> loan arrived *already* impaired. There is no "before". IFRS 9 therefore treats
> it as a different kind of asset from the day it is recognised — and the
> differences are absolute, not matters of degree.

| | An ordinary loan | A POCI asset |
|---|---|---|
| Effective rate | discounts **contractual** cash flows | discounts cash flows **expected to be collected** |
| Day-one allowance | 12-month ECL raised immediately | **none at all** |
| Stages | 1 → 2 → 3, with SICR assessment | **no stages, ever** |
| What hits P&L | the ECL level | only the **change** in lifetime ECL since acquisition |

## Screen 1 · Loan Builder — the purchase facts

**Open:** Stage 0 · Loan Builder, Tranche A card.

**Point at, in this order:**

| Field | Value |
|---|---|
| Face value | 100,000,000 |
| Consideration paid | **60,000,000** |
| Credit impaired at acquisition | **Yes** |

**Say:** three fields, and the third one changes everything the module does with
the other two. Without that flag the engine treats this as an ordinary loan
bought at a deep discount and accretes the whole 40,000,000 into interest income
over six years. With it, the engine takes a completely different path.

## Screen 2 · Covenants — the evidence of impairment

**Open:** the Covenants card.

| | Threshold | Last reported | Status |
|---|---|---|---|
| Leverage ratio | max 4.50x | **8.20x** | breached |
| Interest cover ratio | min 2.00x | **0.90x** | breached |

**Say:** this is the documentary support for the POCI classification. "Credit
impaired at acquisition" is not a label the fund chooses for convenience — §5.5.13
requires objective evidence, and subsisting covenant breaches of this magnitude
are exactly that. Interest cover below 1.0x means earnings do not cover the
interest bill. The auditor will ask what justified the classification; this
screen is the answer.

## Screen 3 · Accounting Treatment — the one input that cannot be inferred

**Open:** Stage 2 · Accounting Treatment.

**Point at:** **Lifetime ECL at acquisition = 40,000,000**, and at **ECL Stage,
which is blank**.

**Say two things.**

**The stage is deliberately empty.** A POCI asset has no stage. If you find
yourself asking whether this loan is Stage 2 or Stage 3, the question does not
apply — it is POCI, and it stays POCI until it is derecognised, however much the
borrower recovers.

**The lifetime ECL is an input, not a derivation.** The module will not infer it
from the 40,000,000 discount, and this is worth dwelling on. A discount to par
can be credit, it can be illiquidity, it can be a motivated seller. Assuming the
whole discount is credit would manufacture the single most important input to the
calculation. So the engine requires it, and refuses to produce a rate without it:

> *"Credit-impaired at acquisition, but no lifetime expected credit loss was
> stated at the acquisition date… a discount to par may be credit, liquidity or a
> bargain, and assuming it is all credit would invent the number the whole
> calculation depends on."*

If anyone in the room has seen a system quietly default this to the discount,
that is the moment to mention it.

## Screen 4 · Run accounting, then the credit-adjusted EIR

**Open:** Run & JEs → Run Accounting → Evidence Pack, EIR panel.

**This is the centrepiece of deal 4.**

```
Par / face value                                     100,000,000
Consideration paid                                    60,000,000
Lifetime ECL at acquisition                           40,000,000
Expected principal recovery                           60,000,000
Contractual coupon                                          8.00%
Horizon                                     31 Dec 2031 (6.08 yrs)

Cash flows EXPECTED to be collected, discounted to 60,000,000:
  Interest at 8% on par, years 1 to 6
  Expected principal recovery at maturity               60,000,000

CREDIT-ADJUSTED EIR                                        13.34%
Ordinary EIR on contractual flows would be                 19.92%
```

**Three things to say:**

**The gap between the two rates is the entire point.** 19.92% is what the module
would have reported if it discounted the contractual cash flows — the 100,000,000
the fund is legally owed. 13.34% is what it reports when it discounts the
60,000,000 it actually expects. The difference is not a rounding convention; it
is the difference between treating a credit loss as yield and treating it as a
credit loss.

**Quantify it, because the number lands.** Over the life of this asset the
ordinary method would accrete the full 40,000,000 discount into interest income —
roughly 4,000,000 a year of revenue that does not exist. The fund's income
statement would show a book yielding 20% on a loan that is not paying.

**And the error never self-corrects.** It is not a timing difference that washes
out at maturity. The income is recognised, and then the asset is written down
later — so profit is overstated in the early years and the loss is taken as a
surprise at the end. That is why the module refused to guess before V4.14 rather
than producing a plausible figure.

## Screen 5 · The balance sheet — note what is *not* there

**Open:** the ECL Calculation Trace panel. Scroll to the acquisition date.

**Point at:** the allowance on 1 January 2026, and on every day of 2026 and 2027.
It is **zero**.

**Say:** on an ordinary loan of this quality you would expect a substantial
day-one allowance — Stage 3, lifetime ECL, a large charge the moment it hits the
books. There is none here, and that is not an omission. §5.5.13 forbids it. The
expected losses are already in the price the fund paid and already embedded in
the 13.34% rate. Raising an allowance as well would charge for the same losses
twice and depress the carrying amount below what the fund paid for the asset on
the day it bought it.

**The carrying amount opens at 60,000,000 and stays there.** Interest income at
13.34% on 60,000,000 is almost exactly the 8,000,000 of cash coupon received, so
there is minimal accretion. The fund paid 60, expects 60 back, and earns 13.34%
on its money in the meantime. The balance sheet says precisely that.

## Screen 6 · Scenario A — the borrower improves

**Open:** the ECL Calculation Trace, and scroll to 1 January 2028.

The deal carries one revision: two years after purchase, the fund's credit
process revises lifetime expected losses **down from 40,000,000 to 25,000,000**.

```
Lifetime ECL at acquisition                           40,000,000
Lifetime ECL at 1 Jan 2028                            25,000,000
Cumulative change since acquisition                  (15,000,000)

Allowance carried                                    (15,000,000)
P&L effect                           impairment GAIN  15,000,000
```

| | DR | CR |
|---|---|---|
| Impairment gain | 145000 Loan Loss Allowance | 470000 Impairment / ECL Expense |

**Three things to say:**

**Only the change goes to P&L, never the level.** The fund still expects to lose
25,000,000 on this loan. It does not book a 25,000,000 allowance — that loss was
priced in at acquisition. It books the 15,000,000 *improvement*. This is the
single most common point of confusion with POCI, so say it twice if you need to.

**The allowance goes negative, and that is correct.** §5.5.14 requires favourable
changes in lifetime expected losses to be recognised as an impairment gain *even
where they exceed the amount previously recognised in the allowance*. Carrying a
negative allowance looks strange on a trial balance; in presentation it is an
addition to the gross carrying amount rather than a contra-asset. Flag it as a
presentation question for the reporting team, not a calculation error.

**No stage moved, because there are no stages.** On deals 1 to 3 an improvement
of this magnitude would have triggered a transfer back toward Stage 1 and a
different measurement basis. Here nothing moves. The asset is POCI on the day it
is bought and POCI on the day it is repaid.

## Screen 7 · Scenario B — the borrower deteriorates

**Say, without changing the deal:** change the revision from 25,000,000 to
50,000,000 and the module books the mirror image.

```
Lifetime ECL at acquisition                           40,000,000
Lifetime ECL at 1 Jan 2028                            50,000,000
Cumulative change since acquisition                   10,000,000

P&L effect                           impairment LOSS  10,000,000
```

| | DR | CR |
|---|---|---|
| Impairment loss | 470000 Impairment / ECL Expense | 145000 Loan Loss Allowance |

**Say:** symmetric, and measured the same way. The fund expected to lose
40,000,000; it now expects 50,000,000; the additional 10,000,000 is the charge.
Not 50,000,000 — the first 40,000,000 was paid for in the purchase price.

If you want to run this live, change the figure in Accounting Treatment and
re-run. Nothing else on the deal needs to move, which is itself a useful thing to
demonstrate: the credit-adjusted rate is **not** re-solved. §B5.4.7 fixes it at
initial recognition; later changes in expectation flow through impairment, not
through the yield.

## Screen 8 · Close on the comparison

Put deal 1 and deal 4 side by side. Same borrower profile — severe financial
difficulty, covenant breaches, high probability of default. Completely different
accounting.

| | Deal 1 — held, then modified | Deal 4 — purchased impaired |
|---|---|---|
| Effective rate | 9.00%, original, held | 13.34%, credit-adjusted |
| Day-one allowance | yes, Stage 3 | **none** |
| Stage | 3 | **n/a** |
| Distress recognised via | ECL charge | the **price paid** |
| Later changes | stage transfers and ECL | change in lifetime ECL only |

**Close on this:** IFRS 9 does not have one answer for distressed debt. It has
two, and which one applies turns on a single question — *was it impaired when we
recognised it?* The module asks that question once, on the tranche, and
everything downstream follows from the answer.

---

# Appendix A — What to do when someone challenges a number

**"Why is deal 1 a gain when the borrower is distressed?"**
Because modification accounting measures the change in the *bargain*, not the
change in the *borrower*. The lenders improved their terms. Credit deterioration
is measured separately, in the ECL. Show both panels side by side.

**"Where does the original EIR come from?"**
It is the rate solved at initial recognition and held. Open the EIR Trace in the
Evidence Pack — it shows the cash flows, the bisection iterations and the
converged rate. On a loan drawn at par with no fees, the EIR equals the coupon
and the module says so explicitly rather than presenting a coupon as a solved
rate.

**"Two of your three deals breach the 10% test. Isn't the configuration wrong?"**
The configuration says non-substantial; the module says the test is breached.
That disagreement is deliberate and visible. Substantial treatment requires
derecognition and recognition of a new financial asset, which is a different
workflow — the module flags when you are in that territory rather than deciding
for you.

**"Can I see the cash flows that were discounted?"**
Yes — the build-up lists them with dates and amounts. For deal 1 that is 23
flows: the fee at t=0, twenty-one quarterly coupons, and the principal.

**"What if we want to override the derived figure?"**
A supplied value still takes precedence. The derivation runs anyway and both are
reported, with the difference shown. The system will not silently prefer one
over the other.

**"On deal 4, why is there no allowance on day one? That loan is clearly bad."**
Because the fund already paid for the badness. It bought a 100,000,000 claim for
60,000,000 precisely because 40,000,000 is not expected to arrive. Raising an
allowance as well would charge for the same loss twice and carry the asset below
what was paid for it on the day of purchase. §5.5.13 is explicit.

**"Deal 4's allowance goes negative. Is that a bug?"**
No — §5.5.14 requires favourable changes in lifetime expected losses to be
recognised as a gain even where they exceed the amount previously recognised.
The presentation question (contra-asset versus an addition to gross carrying
amount) is for the reporting team; the measurement is correct.

**"Why doesn't the credit-adjusted rate get re-solved when expectations change?"**
§B5.4.7 fixes it at initial recognition. Later changes in expected cash flows run
through impairment, not through the yield. If the rate moved as well, the same
change in expectation would be counted twice.

**"Where did the 40,000,000 expected loss come from?"**
From the fund's own underwriting, entered in Accounting Treatment. The module
will not infer it from the purchase discount and refuses to produce a rate
without it — a discount to par may be credit, liquidity or a bargain.

# Appendix B — Known limitations, state them before you are asked

Credibility is cheaper to keep than to recover. If any of these are likely to
come up, say them first.

**The derivation assumes contractual cash flows, not expected ones.** IFRS 9
§5.4.3 is framed in terms of revised *contractual* cash flows for a
non-substantial modification, which is what is implemented. Stage 3 measurement
on an expected-cash-flow basis is handled in the ECL engine, separately.

**Interest is projected at the rate in force after the modification.** On a
floating deal the module revises the EIR at each reset under the workspace
policy, but the modification-date projection uses the post-modification rate
held flat. On a deal with a steep forward curve that is an approximation.

**The 10% test is reported, not enforced.** Nothing stops you running
non-substantial treatment on a deal that breaches it.

**PIK capitalisation may not reach the principal roll-forward on every path.**
If a balance looks lower than the PIK accrual implies, that is the cause. It is
a known open item.

**Deal 1's PIK year relies on two components with complementary date windows.**
It produces the right answer, but it is a modelling convention rather than a
first-class feature. Date-windowed settlement types are on the roadmap.

**On deal 4, interest is projected at the full contractual rate and the whole
expected shortfall is taken against principal.** This is a deliberate choice: the
lifetime ECL supplied *is* the expected shortfall, so haircutting projected
interest as well would make total expected losses exceed the figure entered and
contradict the number the rate is solved against. A fund that also expects to
lose interest should express that by raising the lifetime ECL. Say so if anyone
asks how the expected cash flows were built.

**The credit-adjusted EIR is solved on an annual projection.** Same approximation
as the ordinary EIR display path — adequate on a bullet, less so on a
heavily amortising distressed asset with an irregular recovery profile.

**The POCI ECL revisions are dated facts, not a model.** The module does not
project how expectations will evolve; it records the restatements the credit team
makes and books the change. That is the right division of labour, but it does
mean a deal with no revisions entered will show no impairment movement at all.

# Appendix C — Reference

| Deal | Code | UUID |
|---|---|---|
| Stage 3 Modification Example | `DEMO-MOD-S3` | `e76df246-7a75-473a-b2c4-cfafc19c170e` |
| Payment Deferral and PIK Split Example | `DEMO-DEFER-PIK` | `fed30745-39b8-421d-a658-11b051473b7d` |
| Principal Forgiveness and Extension Example | `DEMO-FORGIVE-S3` | `d9db5e2d-ed68-472d-a056-f384d82e856e` |
| POCI Distressed Purchase Example | `DEMO-POCI` | `f0ef9565-8fdc-49ad-9dc4-6fe681903f2b` |

**Modification figures, as produced by the engine at V4.14**

| Deal | Pre-mod carrying | Original EIR | PV revised | Gain / (loss) | PV change | Flows |
|---|---|---|---|---|---|---|
| 1 | 100,000,000 | 9.00% | 112,022,928 | **12,022,928** | +12.02% | 23 |
| 2 | 80,000,000 | 10.00% | 80,392,742 | **392,742** | +0.49% | 28 |
| 3 | 100,000,000 | 8.50% | 86,747,847 | **(13,252,153)** | −13.25% | 21 |

**POCI figures — deal 4**

| | |
|---|---|
| Par / consideration | 100,000,000 / 60,000,000 |
| Lifetime ECL at acquisition | 40,000,000 |
| Expected principal recovery | 60,000,000 |
| Contractual coupon | 8.00% |
| **Credit-adjusted EIR** | **13.34%** |
| Ordinary EIR would have been | 19.92% |
| Day-one allowance | **nil** |
| Scenario A — ECL 40M → 25M | impairment **gain 15,000,000** |
| Scenario B — ECL 40M → 50M | impairment **loss 10,000,000** |

**Standards cited**

| Reference | Subject |
|---|---|
| IFRS 9 §5.4.3 | Modification of contractual cash flows — recalculate at the original EIR |
| IFRS 9 §B5.4.6 | Fees between borrower and lender; the 10% substantial-modification test |
| IFRS 9 §5.4.1(b) | Stage 3 — interest on the net carrying amount |
| IFRS 9 §5.5.17(k) | Covenant breach as a qualitative SICR indicator |
| IFRS 9 §B5.4.1 | Effective interest rate |
| IFRS 9 §5.5.13 | POCI — no day-one loss allowance |
| IFRS 9 §5.5.14 | POCI — only cumulative changes in lifetime ECL go to P&L, including gains |
| IFRS 9 §B5.4.7 | Credit-adjusted effective interest rate, fixed at initial recognition |
