---
title: "PCS Loan Module — Demo Script"
subtitle: "Five worked IFRS 9 examples — modifications, POCI and integral fees"
author: "FIS Private Capital Suite · Loan Module V4.17"
date: "2 October 2026"
---

# How to use this document

Five internally-built deals, all IFRS. The first three demonstrate different
kinds of change to contractual cash flows; the fourth demonstrates a purchased
credit-impaired asset, measured on an entirely different basis; the fifth shows
what happens to a fee that is integral to the effective rate, including the
awkward case where it arrives before the loan does. All are saved in the
workspace and ready to open — no import step, no file to load.

Each section gives you: the business story, the exact screens to open in order,
what to point at on each screen, and the accounting outcome to land. The figures
quoted are the ones the module produces, verified against the engine.

Total running time, all five deals, roughly **60 minutes**. Deal 1 alone is a
workable 12-minute demo if that is all you have; deals 1 and 4 together make the
strongest 25-minute pairing, because they contrast the two completely different
ways IFRS 9 handles a distressed borrower. Deal 5 is the one to lead with for a
finance audience that cares about revenue recognition rather than credit.

| | Deal code | Shows |
|---|---|---|
| **1** | `DEMO-MOD-S3` | Coupon increase, maturity extension, amendment fee, PIK year, Stage 3 |
| **2** | `DEMO-DEFER-PIK` | Twelve-month principal holiday; cash coupon splits to cash + PIK; EAD grows |
| **3** | `DEMO-FORGIVE-S3` | Principal forgiveness, extension, covenant reset, fee into EIR |
| **4** | `DEMO-POCI` | Distressed secondary purchase; credit-adjusted EIR; no day-one allowance |
| **5** | `DEMO-FEES-EIR` | Integral fees; a fee received before drawdown; deferred fee liability |
| **6** | `DEMO-HAIRCUT-SALE` | Haircut, extension and repricing, then the position is sold and derecognised |

Deals 3 and 6 pair well: the same haircut, but deal 6 carries on to the disposal
six months later, so the audience sees a measurement loss and a derecognition
loss side by side on one position.

**Before you start.** Open the module, confirm the version banner reads V4.17 or
later, and check the Active Deal dropdown lists all five deal names. If a deal
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
Pre-modification gross carrying amount         98,000,000
Solved effective rate                              9.3859%
PIK element added for the discount basis         + 11.00%
Original effective rate used                      20.3860%

Revised contractual cash flows:
  Amendment fee, 1 Jul 2025, at t=0              2,000,000
  Quarterly interest at 11% to 31 Dec 2030
  PIK capitalising into the balance quarterly
  Principal repayment, 31 Dec 2030

Modification GAIN                                 8,033,913
PV change against carrying amount                   +8.17%
```

**Three things to say, in this order:**

**It is a gain, not a loss, and that surprises people.** The borrower is in
difficulty, so the instinct is to expect a write-down. But the lenders have
negotiated a *better* deal for themselves: a higher margin, for longer, plus a
fee. Discounted at the old 9% rate, that stream is worth more than par. The
credit deterioration is real — it just shows up in the ECL, not here. Two
separate effects, two separate places in the accounts. Conflating them is one of
the commonest errors in practice.

**The discount rate is not the coupon, and that catches people out.** The module
solved an effective rate of 9.3859% on the cash coupon, then added the 11% PIK
element because the cash flows being discounted include interest that
capitalises. Rate and cash flows have to be on the same basis. Discounting a
stream that compounds at cash plus PIK by the cash rate alone prices a 20%
instrument at 9% — which, before this was corrected, reported a gain of 66.3m on
this very deal.

**At 8.17% this one sits under the threshold.** §B5.4.6 treats a PV change of 10%
or more as substantial, requiring derecognition rather than re-measurement.
Deal 1 is comfortably inside it; deal 3, at −13.21%, is not. Use the pair to show
that the test is applied and reported, not assumed.

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
Original effective rate (6% cash + 4% PIK)                     10.00%

PV of revised cash flows at 10%                            80,393,618
Modification GAIN                                             393,618
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

**Point at:** the forgiveness event, 1 January 2026, 15,000,000.

**Say:** note what this is *not*. It is not a repayment — no cash arrives. The
balance falls from 100,000,000 to 85,000,000 because the lender has given up the
right to collect it. If this were booked as a repayment the loss would vanish and
the accounts would show a loan that paid down normally.

**It is also not a write-off, and that distinction is the point of the screen.**
IFRS 9 §5.4.4 writes off a gross amount the entity has no reasonable expectation
of recovering, taken against the loss allowance. This is nothing of the kind: the
lender *chose* to forgive, as one term in a negotiated package. That makes it a
change to the contractual cash flows — §5.4.3 — and its whole effect belongs in
the modification gain or loss.

**Worth saying plainly:** the module used to do both, and the result was wrong in
a way that looked reasonable. The carrying amount fell by the forgiven principal,
and the modification then measured only what was left — a 3.3m loss on a 15m
concession. It was caught by running this deal end to end against the demo
script. Now the balance falls here and the carrying amount is moved by the
modification, once.

## Screen 3 · The fee

**Open:** the Fees card.

**Point at:** 850,000 — 1% of the *restructured* 85,000,000, not the original
100,000,000 — dated 1 January 2026, flagged IFRS9-EIR.

**Say:** priced off the facility going forward. And like deal 1's fee, it goes
into the effective rate, not to income on receipt.

## Screen 4 · The modification build-up

**Open:** Run Accounting → Evidence Pack, modification panel.

```
Pre-modification gross carrying amount                    99,342,380
Original EIR (solved)                                        8.6603%
Forgiven within the restructuring                       (15,000,000)

PV of revised cash flows at 8.6603%:
  Amendment fee, 1 Jan 2026, at t=0                          850,000
  Quarterly interest at 8.5% on 85,000,000 to Dec 2030
  Principal repayment, 31 Dec 2030                        85,000,000
                                                 PV =     86,220,347

Modification LOSS                                       (13,122,033)
PV change                                                    −13.21%

Balance after the restructuring                           85,000,000
Carrying amount after                                     86,221,691
```

**Four things to say:**

**The loss is not 15,000,000.** That is the number everyone in the room expects,
and it is wrong. The forgiveness costs 15,000,000 of principal, but the lender
gets 850,000 of fee and two extra years of 8.5% interest on the remaining
85,000,000. Net, the loss is 13.1m. Anyone booking the headline forgiveness
figure would have overstated the charge by nearly 1.9m.

**The carrying amount is not 100,000,000 either.** It is 99,342,380, because the
850,000 amendment fee was deferred and has been accreting since the deal was
written. Small, but it is the sort of detail that decides whether a reviewer
trusts the rest of the number — and it is why the figure is 13.12m rather than
the round 13.25m you would get by assuming par.

**This one also breaches the 10% test**, at −13.21%. Same conversation as deal 1,
opposite direction — and here the case for derecognition is considerably
stronger, because a partial forgiveness is close to the paradigm of an
extinguished original asset.

**The carrying amount after ties to the present value.** 86,221,691 against a PV
of 86,220,347 — the 1,344 is a single day of accretion between the measurement
and the next schedule row. If those two numbers did not tie, the modification
would not have been applied correctly, so it is a check worth doing out loud.

**Compare it with deal 2.** Same module, same method, same discount approach —
+0.49% on a timing change, −13.25% on a forgiveness. The method does not care
what kind of concession it is; it discounts whatever the revised cash flows turn
out to be. That consistency is what makes it defensible.

## Screen 5 · Journals

**Open:** Run & JEs, filtered to 1 January 2026.

| | DR | CR |
|---|---|---|
| Modification loss | 44000 Modification Gain / Loss | 15000 Loan Asset Adjustment |

**One entry, and only one.** Point at what is *absent*: there are no write-off
journals. No 145000 allowance consumption, no 470000 impairment residual. The
forgiveness is not being written off against the allowance — it is a renegotiated
cash flow, and the modification entry carries its entire effect.

**Say:** this matters for anyone reconciling the impairment note. A reader who
expects a 15,000,000 movement through the allowance will not find one, and should
not. The allowance reflects expected credit losses on what is still owed; the
concession reduced what is owed.

**If someone asks why it is not against the allowance:** because the lender had
not given up hope of recovery — it gave up the right. Those are different events
with different standards behind them, and the one that applies here is §5.4.3.

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

# Deal 5 — Fees integral to the effective rate

**`DEMO-FEES-EIR` · Pennine Infrastructure Partners · USD 100,000,000**

## The story

A 100,000,000 facility is committed on 1 January 2026 at 8% fixed, maturing 28
February 2031. The borrower pays a 2% arrangement fee — 2,000,000 — on the
commitment date. The facility is not drawn until **1 March**.

Two months in which the lender holds the borrower's money and has made no loan.
That gap is the entire reason this deal exists.

## The idea to state first

> A fee like this is not a sale. The lender has not delivered a service for
> 2,000,000 — it has reduced the price of the loan it is about to make. IFRS 9
> says so by folding the fee into the effective interest rate: the lender
> advances 100,000,000 but is economically out only 98,000,000, and the
> difference is earned as interest over five years, not as revenue in one day.

Then the awkward question: **what is the fee on 15 January, when the money has
arrived and the loan has not?** Not income — the yield has not been earned. Not a
contra against the loan — there is no loan. It is a liability. That is the one
point this deal exists to demonstrate, and most systems get it wrong by netting
it against a nil asset and showing a negative loan balance.

## Screen 1 · Loan Builder — the timeline

**Open:** Stage 0 · Loan Builder, Deal Setup and the Tranche A drawdown card.

**Point at three dates:**

| | |
|---|---|
| Commitment / signing | 1 January 2026 |
| Arrangement fee received | **1 January 2026** |
| First drawdown | **1 March 2026** |
| Maturity | 28 February 2031 |

**Say:** note that drawn-at-inception is zero and there is a single drawdown
event two months later. The module treats this as a delayed-draw facility — the
loan asset does not exist until 1 March, and everything that happens before then
has to be accounted for without one.

## Screen 2 · The fee, and the one field that changes everything

**Open:** the Fees card.

| Field | Value |
|---|---|
| Label | Arrangement fee (2% of commitment) |
| Kind | arrangement |
| Amount | 2,000,000 one-off |
| Payment date | 1 January 2026 |
| **IFRS treatment** | **IFRS9-EIR** |

**Say:** that last field is the whole decision. Set it to `IFRS9-EIR` and the fee
is integral to the yield — it reduces the carrying amount and accretes back over
the life. Set it to `IFRS15-overTime` and it is payment for a service, recognised
as revenue, and it never touches the effective rate.

**Make the contrast concrete:** the same 2,000,000 is either 2,000,000 of income
in January 2026, or 48 basis points of extra yield spread across five years.
Same cash, same contract, completely different income statement. Origination,
arrangement and underwriting fees are normally the first; a genuine advisory or
agency fee is the second.

## Screen 3 · The undrawn period — the journals most systems get wrong

**Open:** Run & JEs. Press **Run Accounting**, then filter the journal table to
1 January 2026.

| | DR | CR |
|---|---|---|
| Fee received | **111000** Cash 2,000,000 | **211000** Deferred Fee Liability 2,000,000 |

**Say three things:**

**Not income.** The lender has not yet earned anything. Recognising revenue here
would book a return on a loan that has not been made.

**Not a contra-asset either.** There is no loan asset on 1 January. Netting the
fee against it would produce a carrying amount of *minus* 2,000,000 — a negative
loan on the balance sheet, which is not conservative, it is impossible.

**So it is a liability.** Cash the lender holds against a commitment it has not
yet funded. Account 211000. Open the Cashflow tab and point at the carrying
amount through January and February: it is **zero**, not negative.

**Worth saying out loud:** this was a real gap in the module until this release.
The chart of accounts had no deferred fee liability at all, and the fee netted
against a nil asset from day one. It was found by building this very deal.

## Screen 4 · Drawdown — the release

**Open:** the same journal table, filtered to 1 March 2026.

| | DR | CR |
|---|---|---|
| Release on drawdown | **211000** Deferred Fee Liability 2,000,000 | **141000** Loan Asset 2,000,000 |

Alongside it, the drawdown itself: DR 141000 Loan Asset 100,000,000 / CR 111000
Cash 100,000,000.

**Say:** the liability is extinguished against the asset it was always going to
attach to. Net effect on the balance sheet:

```
Loan principal advanced                 100,000,000
Less deferred arrangement fee           (2,000,000)
Amortised cost at 1 March 2026           98,000,877
```

That is your Example 1, to the dollar. The 877 is two months of day-count
rounding on the ACT/360 basis, not an error — point at it before someone else
does.

## Screen 5 · The EIR build-up

**Open:** the Evidence Pack, EIR panel.

```
Amount advanced                              100,000,000
Yield-integral fees                          (2,000,000)
Opening carrying amount at drawdown           98,000,877

Contractual coupon                                8.0000%
EFFECTIVE INTEREST RATE                           8.4855%
```

**Say:** 48 basis points, and those 48 basis points *are* the fee. The lender
quotes 8% and earns 8.4855%, because it put out 98 and gets back 100 while
collecting 8% on the full 100 throughout.

**If anyone asks why the rate is not simply 8% plus 2% divided by 5:** because the
fee is earned on a compounding basis over a declining investment horizon, not
spread straight-line. The difference is small here and large on a longer or
amortising deal — which is the reason to solve it rather than approximate it.

## Screen 6 · The accretion — where the fee actually goes

**Open:** the Cashflow tab, carrying value column or chart.

| Date | Carrying amount |
|---|---|
| 28 Feb 2026 (undrawn) | 0 |
| 1 Mar 2026 (drawdown) | 98,000,877 |
| 1 Mar 2027 | 98,335,253 |
| 1 Mar 2029 | 99,097,951 |
| 28 Feb 2031 (maturity) | **100,000,000** |

**Say:** this curve is the fee being recognised. Interest income each period is
the carrying amount times 8.4855%, while cash received is the principal times
8.00%. The gap — a few hundred thousand a year — is accreted into the carrying
amount, and by maturity it has climbed exactly to par. No residual, no plug.

**The sanity check to offer unprompted:** total interest income over the life
equals the cash coupons plus 2,000,000. The fee is not created or destroyed, only
re-timed. That is the test to apply to any system claiming to do EIR.

## Screen 7 · Example 2 — the commitment fee variant

**Say, without changing the deal:** a commitment fee on an undrawn facility —
1% a year on 200,000,000, say — runs through the same machinery, but the trigger
is a judgement rather than a date.

| If drawdown is… | Treatment |
|---|---|
| **probable** | the fee compensates for a loan about to be made — defer it, and fold it into the EIR when the facility is drawn, exactly as above |
| **not probable** | the fee compensates for standing ready — recognise it over the commitment period under IFRS 15 |

**Say:** the module does not make that judgement for you, and should not. You
express it with the same IFRS treatment flag from Screen 2. Flag it `IFRS9-EIR`
and the deferred fee liability path runs; flag it `IFRS15-overTime` and it is
recognised as non-use fee income over the commitment period.

**Flag the limitation honestly:** the deferred path currently handles **one-off**
fees. A commitment fee that accrues periodically across an undrawn period is
recognised as income rather than deferred. If you need that, model it as a
one-off at the point the undrawn period ends, and say so.

## Screen 8 · Close

Three numbers, in this order:

- **2,000,000** — what the borrower paid
- **nil** — what hit the income statement in January
- **48 basis points** — how it is actually earned, over five years

**Close on this:** the fee never becomes revenue. It becomes yield. The only
question a system has to answer correctly is *where it sits in the meantime* —
and the answer is a liability, not income and not a negative asset.

---

# Deal 6 — Haircut, then sell the position

**`DEMO-HAIRCUT-SALE` · ABC Manufacturing · Private Credit Fund A · USD 100,000,000**

## The story

A 100,000,000 senior term loan drawn 1 January 2024 at SOFR + 600bps, maturing
2028. By late 2025 the borrower has liquidity problems and is breaching
covenants — leverage 6.8x against a 4.0x limit, interest cover 1.1x against a
2.0x minimum. The position is Stage 3.

**1 January 2026 — the lender restructures.** Forgive 15,000,000 of principal,
extend maturity two years to 2030, raise the margin to SOFR + 850bps, and take a
0.85m amendment fee.

**1 July 2026 — the lender gives up.** Six months later Fund A sells the whole
position to Distressed Debt Fund B for 80,000,000 and walks away.

## Why this deal exists

Deal 3 showed a restructuring. This one shows what happens *afterwards*, and the
point is that these are **two separate accounting events with two separate
losses**, six months apart, measured on completely different bases.

> The restructuring is a **measurement** question: the asset stays on the balance
> sheet and is re-measured at the present value of the revised cash flows.
>
> The sale is a **derecognition** question: the asset leaves the balance sheet
> entirely and the loss is simply proceeds less carrying amount.
>
> Nobody should be able to sit through this deal and still think a forgiveness
> and a disposal are the same kind of event.

## Screen 1 · The covenants that forced it

**Open:** Stage 0 · Loan Builder, Covenants card.

| | Threshold | Last reported | Status |
|---|---|---|---|
| Leverage ratio | max 4.00x | **6.80x** | breached |
| Interest cover ratio | min 2.00x | **1.10x** | breached |

**Say:** both breached at the December 2025 test, both carrying a SICR trigger.
This is the documentary record of why the lender came to the table — and under
§B5.5.17(k) it is also what moves the deal out of Stage 1 before anyone exercises
judgement.

## Screen 2 · The restructuring — four changes at once

**Open:** the Tranche card, the spread schedule, and the Fees card.

| | Before | After |
|---|---|---|
| Principal | 100,000,000 | **85,000,000** |
| Margin | SOFR + 600bps | **SOFR + 850bps** |
| Maturity | 31 Dec 2028 | **31 Dec 2030** |
| Amendment fee | — | **850,000** |

**Say:** note the direction of travel. The lender gives up 15m of principal but
takes a higher margin for longer plus a fee. Those pull in opposite directions,
which is exactly why the loss is not simply the forgiveness.

## Screen 3 · The haircut — the number everyone gets wrong

**Open:** Run & JEs → Run Accounting → Evidence Pack, modification panel.

```
Pre-restructuring carrying amount          99,393,095
Original effective rate                       10.0000%
Forgiven in the restructuring             (15,000,000)

PV of revised cash flows at the original rate:
  Amendment fee, 1 Jan 2026, at t=0             850,000
  Quarterly interest at SOFR+850bps on 85,000,000
  Principal repayment, 31 Dec 2030           85,000,000
                                   PV =      87,041,465

MODIFICATION LOSS                          (12,351,629)
PV change                                      −12.43%
```

| | DR | CR |
|---|---|---|
| **1 Jan 2026** | 442000 Modification Loss (IFRS 9) | 141000 Loan Asset |
| | 12,351,629 | 12,351,629 |

**Three things to say:**

**The loss is 12.35m, not 15m.** The principal forgiven is 15,000,000. The loss
recognised is 12,351,629, because the lender also gained two extra years at a
250bp higher margin and an 850,000 fee. Anyone booking the headline haircut
overstates the charge by 2.6m.

**Nothing goes through the allowance.** Look at what is absent — no write-off
entry, no 145000 movement. A negotiated concession is a §5.4.3 modification, not
a §5.4.4 write-off. The lender gave up the *right* to collect, not *hope* of
collecting.

**The entry is dated 1 January 2026.** Until this release the module posted it at
the end of the modelling horizon — a restructuring agreed in January 2026
appeared in the ledger dated December 2030, four years out and in the wrong
reporting period. Worth saying plainly: it was found by building this deal.

## Screen 4 · Six months of carrying the restructured loan

**Open:** the Cashflow tab, carrying value column.

| Date | Balance | Carrying amount | ECL allowance |
|---|---|---|---|
| 31 Dec 2025 | 100,000,000 | 99,393,095 | 45,000,000 |
| 2 Jan 2026 | 85,000,000 | 87,042,131 | 38,250,000 |
| 30 Jun 2026 | 85,000,000 | 87,101,657 | 38,250,000 |

**Say two things.**

**The carrying amount ties to the PV.** 87,042,131 against a measured PV of
87,041,465 — a day of accretion apart. If those did not tie, the modification
would not have been applied correctly, so it is worth checking out loud.

**The allowance is 45% of exposure, not 100%.** Stage 3, LGD 45%: 45,000,000 on
100m before, 38,250,000 on 85m after. The allowance follows the exposure down
because the forgiveness reduced what is owed.

## Screen 5 · The sale — derecognition

**Open:** Stage 2 · Lifecycle Events, then the journal table filtered to
1 July 2026.

```
Carrying amount at the sale date            87,101,657
Proceeds from Distressed Debt Fund B        80,000,000
LOSS ON DISPOSAL                            (7,101,657)
```

| | DR | CR |
|---|---|---|
| Cash received | **111000** Cash 80,000,000 | |
| Loss on disposal | **442000** Realized Loss on Loan Sale 7,101,657 | |
| Asset derecognition | | **141000** Loan Asset 87,101,657 |
| Allowance released | **145000** Loan Loss Allowance 38,250,000 | **470000** Impairment 38,250,000 |

**Four things to say:**

**This is the entry your note sketched**, and it balances: cash in, loss to P&L,
asset out. The asset leg appears as two rows — 80,000,000 against the proceeds
and 7,101,657 residual — which together derecognise the whole 87,101,657.

**The allowance comes back.** 38,250,000 of accumulated impairment is released on
the same date, because the credit exposure left with the asset. A reviewer who
expects the allowance to simply vanish should see it reversed through P&L, not
written off.

**The balance sheet is clean afterwards.** Balance nil, carrying amount nil,
allowance nil, and it stays that way to the end of the schedule. Until this
release the sold position carried 546,714 the day after it was sold — the
unamortised amendment fee was being crystallised into a loan that no longer
existed. Also found by building this deal.

**Substantially all risks and rewards transferred**, so §3.2.3 gives full
derecognition. If the fund had retained a first-loss piece or a repurchase
obligation the answer would be different and the asset would stay on balance
sheet — worth saying, because it is the question an auditor will ask next.

## Screen 6 · Close — two losses, two bases

Put the whole life on one line:

| Date | Event | Loss | Measured as |
|---|---|---|---|
| 1 Jan 2026 | Restructuring | **12,351,629** | carrying amount less PV of revised cash flows at the original EIR |
| 1 Jul 2026 | Sale | **7,101,657** | carrying amount less proceeds |
| | **Total** | **19,453,286** | |

**Close on this:** the lender forgave 15,000,000 and ultimately lost 19,453,286.
Neither number is the other, and neither is reachable by arithmetic on the
headline. One is a present-value measurement at a rate fixed years earlier; the
other is a cash comparison on the day of sale. A system that cannot tell those
two apart will get both wrong.

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

**"On deal 5, why 98,000,877 rather than exactly 98,000,000?"**
Day-count. The 877 is two months of ACT/360 rounding between the commitment date
and the drawdown. Point at it before someone else does — an unexplained 877 looks
like a defect, an explained one looks like precision.

**"Could we just recognise the arrangement fee as revenue? It is cash in hand."**
Only if it is payment for a separate service. An arrangement, origination or
underwriting fee is compensation for making the loan, so IFRS 9 §B5.4.1 treats it
as part of the yield. The test is whether the lender would still be owed the fee
if no loan were ever made.

**"Is the deferred fee liability a real account or a presentation device?"**
A real liability for as long as the facility is undrawn. The lender holds cash
against a loan it has not yet funded. Once drawn it is released against the asset
and never appears again.

**"What if the facility is never drawn?"**
Then the fee was earned for standing ready, not for lending, and it is IFRS 15
income over the commitment period. The deferred fee liability would be released
to income rather than against an asset. The module does not currently automate
that release — it is a manual judgement at the point the commitment lapses.

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

**The deferred fee path handles one-off fees only.** A commitment fee accruing
periodically across an undrawn period is recognised as income rather than
deferred into the EIR. Model it as a one-off at the end of the undrawn period if
the deferral matters.

**An undrawn facility that is never drawn does not release its deferred fee
automatically.** The liability stays until someone decides whether the commitment
lapsed, which is a judgement rather than a date.

**Deal 1's PIK runs for the whole life in the measurement, not just the
amendment year.** The two-component structure bounds the PIK year correctly for
interest accrual, but the tranche-level PIK rate the engine measures against has
no end date. So the modification derivation projects — and discounts at — PIK for
the full remaining term. The figure is internally consistent, and it is the right
order of magnitude, but a bounded PIK window would produce a smaller gain. Say so
if anyone asks why the discount rate is 20%.

**Deal 5's effective rate is solved from the first drawdown, not from signing.**
That is correct — nothing is invested before then — but it means a facility with
several staggered draws anchors on the first one. On a genuinely laddered
drawdown profile the rate is an approximation.

# Appendix C — Reference

| Deal | Code | UUID |
|---|---|---|
| Stage 3 Modification Example | `DEMO-MOD-S3` | `e76df246-7a75-473a-b2c4-cfafc19c170e` |
| Payment Deferral and PIK Split Example | `DEMO-DEFER-PIK` | `fed30745-39b8-421d-a658-11b051473b7d` |
| Principal Forgiveness and Extension Example | `DEMO-FORGIVE-S3` | `d9db5e2d-ed68-472d-a056-f384d82e856e` |
| POCI Distressed Purchase Example | `DEMO-POCI` | `f0ef9565-8fdc-49ad-9dc4-6fe681903f2b` |
| Integral Fees and Deferred Fee Example | `DEMO-FEES-EIR` | `0a8f90f9-f7c4-4297-baeb-b1bbf0679a3e` |
| Restructuring, Haircut and Transfer Example | `DEMO-HAIRCUT-SALE` | `db489322-ef29-4fe2-9fdf-5f9163f385a8` |

**Modification figures, as produced by the engine at V4.17**

| Deal | Pre-mod carrying | Original EIR | PV revised | Gain / (loss) | PV change | Flows |
|---|---|---|---|---|---|---|
| 1 | 98,000,000 | 20.386%¹ | 106,033,913 | **8,033,913** | +8.17% | 23 |
| 2 | 80,000,000 | 10.00%¹ | 80,393,618 | **393,618** | +0.49% | 28 |
| 3 | 99,342,380 | 8.6603% | 86,220,347 | **(13,122,033)** | −13.21% | 21 |
| 6 | 99,393,095 | 10.0000%¹ | 87,041,465 | **(12,351,629)** | −12.43% | 23 |

**Deal 6 — the disposal, six months after the restructuring**

| | |
|---|---|
| Carrying amount at 1 Jul 2026 | 87,101,657 |
| Proceeds | 80,000,000 |
| **Loss on disposal** | **(7,101,657)** |
| ECL allowance released | 38,250,000 |
| Carrying amount after derecognition | **0** |
| Total loss across both events | **(19,453,286)** |

¹ On a deal where interest settles in kind, the discount rate is the solved
effective rate plus the PIK element, because the cash flows being discounted
include interest that capitalises. Rate and cash flows must be on the same basis.

**ECL allowances at peak exposure — all five verified at V4.20**

| Deal | Stage | LGD | Peak allowance | % of exposure |
|---|---|---|---|---|
| 1 | 3 | 40% | 40,000,000 | 40.0% |
| 2 | 2 | 40% | 10,000,000 | 10.0% |
| 3 | 3 | 45% | 45,000,000 | 45.0% |
| 4 | POCI | — | 0 at acquisition | 0% |
| 5 | 1 | 30% | 150,000 | 0.15% |

Every batch balances and nothing is unmapped.

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

**Integral fee figures — deal 5**

| | |
|---|---|
| Facility / drawdown | 100,000,000 · 1 Mar 2026 (committed 1 Jan 2026) |
| Arrangement fee | 2,000,000, `IFRS9-EIR` |
| Carrying amount while undrawn | **0** — fee held as a liability, not netted |
| Amortised cost at drawdown | **98,000,877** |
| Contractual coupon | 8.0000% |
| **Effective interest rate** | **8.4855%** |
| Carrying amount at maturity | 100,000,000 — fee fully accreted |

| Date | | DR | CR |
|---|---|---|---|
| 1 Jan 2026 | fee received | 111000 Cash | 211000 Deferred Fee Liability |
| 1 Mar 2026 | release | 211000 Deferred Fee Liability | 141000 Loan Asset |

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
| IFRS 9 §B5.4.1 | Fees integral to the effective rate — origination, arrangement, underwriting |
| IFRS 9 §B5.4.2 | Fees that are NOT integral — recognised under IFRS 15 |
| IFRS 15 | Commitment fees where drawdown is not probable — revenue over the commitment period |
| IFRS 9 §3.2.3 | Derecognition on transfer of substantially all risks and rewards |
| IFRS 9 §5.4.4 | Write-off — no reasonable expectation of recovery (contrast with §5.4.3) |
