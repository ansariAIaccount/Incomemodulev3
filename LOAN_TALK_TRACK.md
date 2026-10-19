# Talk track — PCS Loan Module

**Deck:** `PCS-Loan-Module.pptx` · 16 slides · ~20 minutes, leaving room for the live demo.

Same shape as the Real Estate talk track, so the two present as a pair. The
lines below are what to *say*, not what to read. If you only get through half
of it, slides 2, 3, 8 and 14 are the four that matter.

---

## 1 · Opener — Private credit, natively in Investran *(45 sec)*

> "Most loan accounting in this room happens in a workbook.
>
> Not because anyone chose that. Because the arithmetic is daily, the
> standards are specific, and no system was offering to do it where the fund
> actually reports."

Don't sell yet. Name the thing everyone recognises.

---

## 2 · Why we built this *(2 min)*

> "Four numbers.
>
> **4.5 trillion.** Private credit AUM forecast by 2030, more than double 2024.
> This is the fastest-growing private asset class and the one with the most
> arithmetic behind it.
>
> **43%.** In a survey of managers your size, 43% said more than half their
> non-investment staff do oversight or replication. Re-keying.
>
> **47%.** Nearly half report three or more days late because of it.
>
> **Six.** Core systems at the average large administrator.
>
> But here's the one that should actually worry you, and it isn't on the slide.
> Loan accounting is daily — accrual, amortisation, allowance — and it is
> overwhelmingly done in workbooks that nobody can audit and one person can
> maintain.
>
> The exposure isn't a licence cost. It's a number in the NAV that cannot be
> re-derived once the person who built it has left."

**Land the read-through line.** Pause after "has left."

**On the numbers** — the 43% and 47% are from a survey of managers with $2bn+
AUM across PE, private debt, real estate, infrastructure and hedge. Their peer
group, not a vendor claim. Say so if challenged.

---

## 3 · What it covers *(1.5 min)*

> "Scope before features.
>
> Six rows, and the labels are the same on both sides: instruments, interest,
> yield, impairment, lifecycle, output. Left is the core. Right is what the same
> engine also does.
>
> Four frameworks — IFRS 9, CECL, AASB, ASPE. And here's the point: the
> framework is a property of the *fund*, not of the module. A multi-strategy
> administrator runs funds reporting under different standards from the same
> deal data. So one loan produces IFRS 9 numbers for one investor and CECL
> numbers for another, from one schedule."

**If asked which is best supported** — IFRS 9 is the deepest and most tested.
Say that plainly rather than claiming parity you'd have to defend.

---

## 4 · The five steps *(1.5 min)*

> "Loan builder, lifecycle events, cashflow, accounting, dashboard. Same
> pipeline shape as the real estate module — if you know one, you know the other.
>
> Two things to hold onto.
>
> The daily row is the contract. The schedule is one object per calendar day
> with about ninety fields, and every downstream surface reads that same row. So
> there is one version of a day, not four.
>
> And a deal can be built here or imported from a servicing system. Same engine
> either way."

This is the map for the demo. Say you'll walk it left to right.

---

## 5 · Loan builder *(1 min)*

> "The credit agreement modelled, not summarised. Deal, facility, tranches,
> fees — including the ordered history of maturity extensions, so a date that
> moved can be explained rather than just observed.
>
> The one to call out is covenants. A threshold, a direction, a test frequency,
> and *what happens on breach* — margin step-up, credit-risk re-stage, mandatory
> prepayment.
>
> A covenant that only raises an alert leaves the accounting consequence to be
> remembered by a person. Here the breach changes the coupon, the stage and the
> schedule on the next run. And the breach and its cure are both logged, with
> dates."

---

## 6 · Cashflow *(1.5 min)*

> "One row per calendar day, settlement to maturity. Not per period — per day.
> Because that's how interest accrues, and anything coarser is an approximation
> you'll be asked to justify.
>
> Four day-count conventions, compounded RFR for floating coupons, holiday
> calendars per deal."

**The story worth telling here.** Seven Australian deals once rolled against a
holiday calendar that didn't exist in the engine — and looked completely normal
doing it. Calendars are now rows in a table, so a new jurisdiction is data
rather than a deploy. Telling that story makes everything else on the slide
more believable, not less.

---

## 7 · Effective interest *(1.5 min)*

> "The effective rate discounts expected cashflows back to the amount *actually
> invested*. Not to face, and not from the coupon.
>
> Consideration paid, less yield-integral fees received, plus directly
> attributable transaction costs. Solve the rate so that rolling forward daily
> lands on the balance outstanding at the end of expected life.
>
> And a loan bought at par with no fees has an effective rate equal to its
> coupon. That's the correct answer, not a fallback — and the module says so
> explicitly, so you're never left wondering whether the solve ran."

**If pressed on limits** — on imported deals the rate isn't yet solved against
received cashflows. It's a known limitation, written down. Say it before someone
finds it.

---

## 8 · Expected credit losses *(2.5 min — the important one)*

> "This is where most systems stop, so let me be specific about three things.
>
> **PCS calculates it. Nobody supplies it.** The servicing feed sends cashflows,
> movements and terms. It never sends a loss allowance. An imported deal's
> interest comes from the feed; its allowance is computed here, on the same basis
> as an internal one.
>
> **Measurement and posting are separate.** The allowance is recomputed for
> every day of the schedule. The journal is one entry per reporting date, for the
> *movement*. They're separate because they're different problems — and because
> they failed separately.
>
> **And the inputs are kept, not just the answer.**" *(point at the trace)*
> "Every row carries the balance, the years remaining, the probability and the
> loss given default that produced that day's allowance.
>
> An allowance you cannot decompose is an allowance you cannot defend. Your
> auditor will ask. This answers."

**Slow down here.** This is the slide that convinces credit and audit people.

---

## 9 · Lifecycle events *(1.5 min)*

> "Eight event types on one page, and the reason they're on one page is that
> they interact.
>
> A prepayment after a covenant breach. A modification on a loan already in
> stage 2. A recovery on a position you'd partly sold. These are exactly the
> cases that break a spreadsheet, because in a workbook they're three tabs that
> don't know about each other.
>
> Here they go into one register, get applied in date order, and land in the
> same daily schedule.
>
> And the notices — drawdown, interest, repayment — are generated from that
> schedule as PDFs. So the document the borrower receives and the number in the
> ledger cannot drift apart."

---

## 10 · Journals and the chart of accounts *(1.5 min)*

> "Balanced journals, generated from the same daily rows that produce everything
> else. Interest aggregates expand per coupon period, so a posted line still
> traces to the days behind it.
>
> On the chart of accounts — the engine emits a business event, and you map each
> event, per framework, to an account that already exists in your ledger.
> Nothing has to be added to Investran for this to post.
>
> And mapping applies on the push only. Every screen and every export stays in
> the module's own chart — so a mapping mistake can't corrupt the books."

---

## 11 · Integration *(1.5 min)*

> "In from the servicer through the PortF feed — terms, cashflows, movements,
> on a versioned workbook contract. Out to Investran through DIU, with the token
> held server-side rather than in the browser.
>
> One thing I want to flag because it's a control, not a feature: an imported
> deal is **read-only by default**. Deny by default, with an explicit allowlist.
>
> We tried a blacklist first. Twenty-four controls had escaped it — including
> Save, which would have written our version of the deal over theirs.
>
> One carve-out: the fee's accounting treatment stays editable, because whether
> a fee sits inside the yield is the fund's judgement, not the servicer's data."

---

## 12 · Across the book *(1 min)*

> "Portfolio, watchlist, regulatory scope — Form PF, AIFMD, Y-14Q resolved per
> deal and per fund. Waterfall and borrowing base alongside.
>
> The point isn't that these exist. It's that they run from the same daily
> schedule as the ledger. Normally each one is a separate extract into a separate
> model, reconciled by hand at quarter end. Run from the same source, they can't
> disagree — because they aren't a copy."

---

## 13 · Controls *(1 min)*

> "The questions you'll be asked: 80 tables, row-level security on every one,
> 236 policies. Three access predicates — admin, team, per-deal assignment. The
> Investran token lives on the server, never in the browser.
>
> On the public key — access control is row-level security, not key secrecy.
> That's only true while RLS is on every table. It is, and there's a verifier
> that re-proves the schema rather than asserting it.
>
> And runs are kept, not overwritten. A prior period can be reproduced, not
> recomputed and hoped over."

---

## 14 · How we know it works *(1 min — the second important one)*

> "50 automated cases across two harnesses, all green on the current build, run
> against the shipped engine file rather than a copy of it.
>
> But the cases I'd point at aren't the totals — they're the invariants. Every
> journal balances. Every effective date falls inside settlement and maturity.
> ACT/360 accrues more than ACT/365. An empty instrument returns nothing rather
> than throwing. Those hold for *any* deal, not one.
>
> And the output was reconciled to a separately built model on a live deal.
> Agreement between two methods is worth considerably more than agreement with
> yourself."

---

## 15 · The assistant *(1 min)*

> "There's an assistant in the module carrying 256 IFRS questions in its own
> corpus — offline. No network, no API key. Which is the condition most client
> sites actually impose.
>
> And it reads the loaded deal. So 'why did the allowance move in March' is
> answered from the run on screen, not from general knowledge about IFRS 9.
>
> The hardest moment in a loan review isn't producing a number. It's explaining
> it to someone who will challenge it."

---

## 16 · Roadmap *(1 min, then hand to the demo)*

> "What's built is tested. What isn't, I'll name.
>
> External-deal EIR isn't yet solved against received cashflows. The
> modification 10% test is measured and reported but doesn't yet drive the
> classification. The purchased-asset disposal leg still repays at face.
>
> Those are on a defect list that's carried forward honestly, and closing it
> comes before scaling.
>
> Let me show you it running."

**Naming two real defects on stage buys more credibility than any claim of
completeness.** It also means nobody can produce one as a gotcha.

---

# Questions you should expect

**"Does it replace our servicing system?"**
> No, and I won't claim it does. It's a sub-ledger. Servicing — borrower
> contact, notices going out, cash actually moving — stays where it is. This
> takes the terms and cashflows and produces the accounting.

**"Which framework is it actually best at?"**
> IFRS 9. CECL, AASB and ASPE run the same engine path with their own staging
> rules and memos. If you report under one of those three, I'd want a session
> on your specific treatments before I'd tell you it's finished.

**"What about our chart of accounts?"**
> Slide 10. You map our business events to your accounts; nothing changes in
> Investran.

**"Who can see which deals?"**
> Slide 13. Row-level security, three predicates, per-deal assignment.

**"How does this relate to the real estate module?"**
> Same shell, same pipeline shape, same Investran integration pattern. Separate
> modules sharing no files. If you know one, you can operate the other.

**"Can we see an infrastructure or real estate deal in it?"**
> Different module — and there's a deck for it. Don't demo one from the other.

---

# Before you go on — setup

1. Serve the app and open `loan-module-v4-builder.html`. There's no index page;
   the builder *is* the entry point.
2. Sign in. Confirm the build stamp matches what you expect — the page reports
   a stale deploy against `build-manifest.json`.
3. Load `DEMO-POCI`, or the deal you plan to walk.
4. Sanity check: Cashflow shows daily rows, Accounting shows journals that
   balance, Dashboard shows the covenant banner if your deal has a breach.
5. If you want the DIU push live, the proxy must be running and PCS Sync must
   have pulled reference data first — otherwise lookups won't resolve.

**Run the harness before you travel:**

```bash
cd Incomemodulev3/tests
node engine-harness.js && node regression-harness.js   # expect 50/50
```

Two green runs before and after any change is the cheapest evidence you have.
Knowing it's green that morning is worth the thirty seconds.

---

# Demo order (after slide 16)

1. **Loan builder** — the deal, then open covenants and show a consequence
2. **Lifecycle events** — the register, in date order
3. **Cashflow** — the daily grid, then open one row's detail
4. **Accounting** — EIR, then the ECL trace *(the money shot)*
5. **Journals** — balanced, mapped, then the DIU batch

If you're short on time, cut 1 and 5. The daily row and the ECL trace are what
people remember.

---

# One caution

Known defect #71 — a purchased credit-impaired loan carried at accreted
consideration still posts a repayment at full face. `DEMO-POCI-MID` and
`DEMO-POCI-PAR` both expose it.

**Don't walk a POCI deal to maturity on stage.** Demo POCI acquisition and
measurement, which are correct and genuinely impressive, and stop before the
disposal.
