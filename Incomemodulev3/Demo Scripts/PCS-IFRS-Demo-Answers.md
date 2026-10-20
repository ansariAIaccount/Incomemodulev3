# IFRS Accounting — Demo Answer Book

## PCS Loan Module · questions clients ask, and how to answer them

**Version** V4.62 · 8 October 2026 · **For the presenter.** Not a client handout.

### How to use this

Every question is numbered **Q1** to **Q256**. Search for the number, or for a keyword — the questions are written in the words a client would actually use, not in standard-speak, so searching *"why is the fee not income"* or *"ten percent"* will land you on the right entry.

Each answer has three parts:

- **Answer** — what to say, in plain language.
- **Standard** — the paragraph, for when someone wants the citation.
- **In PCS** — what the system actually does. Where it does not do something, that is stated.

**Appendix A** indexes IFRS paragraph references to question numbers — use it when a client opens with *"how do you handle B5.4.7?"*
**Appendix B** is a one-page formula card.
**Appendix C** lists the things to be careful about. Read it before every demo.

---

# 1 · Scope, classification and measurement

**Q1 · What is this module, in accounting terms?**
**Answer.** It is the sub-ledger for a private-credit loan book. It takes the contractual and cash facts about a loan, applies IFRS 9 to them, and produces balanced journal entries for the general ledger. It is not a pricing tool and not a servicing system.
**In PCS.** Loans are either built in the module or imported from a servicing system. Either way the accounting treatment, the journals and the posting are PCS's.

**Q2 · Which IFRS standards are in scope?**
**Answer.** Principally IFRS 9 *Financial Instruments* — classification, measurement, impairment, modification and derecognition. IFRS 15 applies to service fees that are not part of the lending yield. IFRS 7 governs the disclosures the data has to support. IFRS 13 matters only where fair value is used.
**Standard.** IFRS 9 · IFRS 15 · IFRS 7 · IFRS 13.

**Q3 · How is a loan classified on initial recognition?**
**Answer.** Two tests. The business model test asks what the entity intends to do with the asset — hold it to collect contractual cash flows, hold to collect and sell, or neither. The SPPI test asks whether the contractual cash flows are solely payments of principal and interest. Hold-to-collect plus SPPI gives amortised cost, which is where nearly all private credit sits.
**Standard.** IFRS 9 §4.1.1 – §4.1.2A.
**In PCS.** Classification is recorded on the deal. Amortised cost is the default for a term loan and drives the whole EIR and impairment path.

**Q4 · What is the SPPI test actually testing?**
**Answer.** Whether the return is consistent with a basic lending arrangement. Interest can compensate for the time value of money, credit risk, other basic lending risks, costs and a profit margin. What breaks SPPI is exposure to something else — equity returns, commodity prices, a borrower's EBITDA — or leverage that amplifies variability.
**Standard.** IFRS 9 §4.1.3, §B4.1.7 – §B4.1.26.

**Q5 · Does a margin ratchet break SPPI?**
**Answer.** Usually not. A margin that steps with leverage or a credit rating is compensation for credit risk, which is exactly what interest is for. A margin that steps with the borrower's revenue or profit is harder, because that is participation in performance rather than compensation for risk. It is a judgement and it should be documented at origination.
**Standard.** IFRS 9 §B4.1.9A – §B4.1.13.
**In PCS.** Ratchets are modelled on the component with tiers. The SPPI conclusion is recorded on the deal; PCS does not form the judgement for you.

**Q6 · Does an ESG margin adjustment break SPPI?**
**Answer.** Generally no, where the adjustment is small and the rate remains consistent with basic lending. The common view is that a de minimis ESG step is not a breach. Where the adjustment is large enough to change the character of the return, it needs analysis.
**Standard.** IFRS 9 §B4.1.7A, §B4.1.9A.
**In PCS.** An ESG adjustment in basis points sits on the interest component and flows into the rate.

**Q7 · What if the loan fails SPPI?**
**Answer.** It is measured at fair value through profit or loss. No EIR, no amortised cost, no ECL — fair value movements go straight to P&L.
**Standard.** IFRS 9 §4.1.4.
**In PCS.** The classification is recorded. The amortised-cost machinery — EIR solving, ECL — is not the right path for an FVTPL asset and should not be relied on for one.

**Q8 · What is a loan measured at on day one?**
**Answer.** Fair value plus, for assets not at FVTPL, directly attributable transaction costs. For a loan originated at par with an arm's-length rate, fair value is normally the amount advanced.
**Standard.** IFRS 9 §5.1.1.
**In PCS.** The consideration paid and transaction costs are captured per tranche and both enter the EIR solve.

**Q9 · What if we buy a loan at a discount?**
**Answer.** It is recognised at what you paid. The discount is not income on day one — it is unwound into interest income over the life through the effective interest rate. If the discount is there because the asset is credit-impaired, the POCI rules apply instead.
**Standard.** IFRS 9 §5.1.1, §B5.4.1 · POCI at §5.5.13.
**In PCS.** Consideration paid is a tranche field; the EIR is solved against it. Credit-impaired-at-acquisition is a separate flag — see Q103.

**Q10 · Amortised cost, gross carrying amount, net carrying amount — what is the difference?**
**Answer.** Gross carrying amount is the amortised cost before deducting the loss allowance. Amortised cost — often called net carrying amount in practice — is gross less the allowance. Interest is calculated on the gross figure in Stages 1 and 2, and on the net figure in Stage 3.
**Standard.** IFRS 9 Appendix A definitions · §5.4.1.
**In PCS.** Both are reported as separate columns on the Cashflow tab. Net = gross less the ECL allowance.

**Q11 · Why report both gross and net?**
**Answer.** Because they answer different questions. The borrower owes the gross amount regardless of what we expect to recover. The net amount is our expectation. Collapsing them into one figure loses the distinction an auditor and a credit committee both need.

**Q12 · Can one portfolio hold loans under different frameworks?**
**Answer.** Yes, and in a multi-jurisdiction fund structure it usually does.
**In PCS.** The accounting framework is a property of the deal, not a system setting. IFRS, US GAAP (CECL), Canadian ASPE and AASB are supported, and the GL mapping is held per framework so the same business event lands in the right account for each.

---

# 2 · Effective interest rate

**Q13 · What is the effective interest rate?**
**Answer.** The rate that discounts the estimated future cash receipts over the expected life of the asset back to its gross carrying amount. It is the loan's true yield once fees, discounts and transaction costs are taken into account — not the headline coupon.
**Standard.** IFRS 9 Appendix A.

**Q14 · Why not just use the coupon?**
**Answer.** Because the coupon is only part of what we earn. An arrangement fee received at the start, a discount on purchase, and transaction costs incurred are all part of the economics of the lending. Recognising the fee as income on day one and the coupon over the life would front-load profit and misstate every period after.

**Q15 · What goes into the EIR calculation?**
**Answer.** The amount advanced or paid, all contractual interest and principal flows, fees that are integral to the yield, points paid or received, and directly attributable transaction costs. Expected credit losses are excluded — except for POCI assets.
**Standard.** IFRS 9 §B5.4.1, §B5.4.7.
**In PCS.** The EIR is solved numerically against the actual cashflow schedule, with integral fees and transaction costs folded into the solve.

**Q16 · Over what period — contractual or expected life?**
**Answer.** Expected life, where it can be estimated reliably. Where it cannot, the full contractual term is used. For a loan with a realistic expectation of early repayment, expected life is the better estimate and is what the standard asks for.
**Standard.** IFRS 9 §B5.4.1 – §B5.4.4.
**In PCS.** The schedule drives it. An expected redemption date can be stated per tranche.

**Q17 · How do you compute an EIR on a floating-rate loan?**
**Answer.** You cannot know future resets, so the EIR is computed using the current rate and re-estimated when the rate resets. The carrying amount is not restated for the change — the revised EIR applies prospectively.
**Standard.** IFRS 9 §B5.4.5.
**In PCS.** Two policies are supported and the choice is explicit: revise the EIR at each reset, or hold the original EIR and let the rate change flow through interest. House policy is revision at each reset. It is stored per deal in Accounting Treatment, not assumed.

**Q18 · Why does the policy choice matter?**
**Answer.** It changes the pattern of income between periods, though not the total over the life. Auditors will want to see it applied consistently across the book and documented. Having it as a visible per-deal setting rather than a hidden default is the point.

**Q19 · What is the EIR on a revolving facility?**
**Answer.** Harder, because the balance moves with drawings and the expected life is uncertain. In practice the fee deferral period and the amortisation basis need an explicit policy — commonly the facility term.
**In PCS.** A revolver cost-deferral basis is configurable on the deal; the default is maturity.

**Q20 · What happens to the EIR when terms change?**
**Answer.** It depends on whether the change is a modification or a derecognition. On a non-substantial modification the original EIR is kept and used to re-discount the revised flows. On a substantial modification the old asset goes and the new one gets its own EIR.
**Standard.** IFRS 9 §5.4.3 · derecognition §3.2.3.
**In PCS.** Non-substantial is handled fully. Read Q127 before promising the substantial path.

**Q21 · Is the EIR recalculated when expected cash flows change?**
**Answer.** For an ordinary asset, no — you adjust the gross carrying amount to the present value of the revised flows at the *original* EIR and the difference goes to P&L. The exception is a floating-rate reset, and POCI assets where revisions to expected credit losses adjust the carrying amount.
**Standard.** IFRS 9 §B5.4.6 · §5.4.3 · POCI §5.5.14.

**Q22 · Can you show me the EIR the system solved?**
**Answer.** Yes, and the screen says whether it is a solved EIR or just the coupon.
**In PCS.** This was deliberate. A field showing a rate is useless if you cannot tell whether it was calculated or defaulted — the distinction is on screen.

**Q23 · What if there is not enough information to solve an EIR?**
**Answer.** The system refuses and says why, rather than returning the coupon dressed up as a yield.
**In PCS.** The refusal carries the reason — for example a POCI asset with no lifetime ECL at acquisition entered.

**Q24 · Can we override the EIR?**
**Answer.** Yes, and the override is recorded as an override rather than silently replacing the solved figure.

**Q25 · Does the EIR change when the loan draws down in stages?**
**Answer.** The EIR is solved against the schedule of actual and expected flows, so a multi-draw facility is handled by the schedule rather than by a special rule. Each drawdown changes the balance the rate applies to.
**In PCS.** Hamilton draws twelve times across eighteen months; the schedule carries each one and the solve sees them all.

**Q26 · How do you handle a loan with no stated coupon — a pure discount instrument?**
**Answer.** All of the return is in the discount, so the whole yield comes out of the EIR. There is no cash interest, and the income is accretion of the carrying amount toward face.

**Q27 · Is interest accrued daily or at the coupon date?**
**Answer.** Income is recognised as it is earned, and the period in which it is recognised should match the reporting cycle and the contractual accrual frequency. Daily measurement with periodic recognition is the normal pattern.
**In PCS.** Each component states its accrual frequency and income is recognised in that period. Daily rows from a feed are the supporting detail behind a coupon period, not separate economic events.

**Q28 · What day-count conventions are supported?**
**Answer.** ACT/360, ACT/365, ACT/ACT, 30/360 and 30E/360.
**In PCS.** It is a required field on the deal. Sterling facilities are ACT/365; using ACT/360 instead overstates annual interest by about 1.4%, which is why a blank day count blocks the import rather than defaulting.

---

# 3 · Fees and transaction costs

**Q29 · When is a fee income and when is it part of the yield?**
**Answer.** The question is what the fee is compensation for. A fee that is part of the return on lending — arrangement, origination, upfront — is integral to the EIR: it goes into the carrying amount and is released into interest income over the life. A fee for performing a distinct service — agency, monitoring, administration — is IFRS 15 revenue, recognised as the service is performed.
**Standard.** IFRS 9 §B5.4.1 – §B5.4.3 · IFRS 15.

**Q30 · Why is my arrangement fee not income when I receive it?**
**Answer.** Because you did not earn three-quarters of a million pounds for arranging a signature. You earned it for putting capital at risk for ten years. Recognising it on day one would report profit you have not yet earned and understate yield in every year after.
**Standard.** IFRS 9 §B5.4.1.

**Q31 · How does PCS decide which treatment applies?**
**Answer.** It does not decide. The classification is stated on the fee — the Yield Integral field — and where it is not stated, PCS records the fee, keeps it out of the EIR, and warns you that it did.
**In PCS.** This is deliberate. "Arrangement and agency fee" is genuinely ambiguous, and an inference that silently moves reported yield is the kind of thing found out about eighteen months later.

**Q32 · Is a commitment fee integral or a service fee?**
**Answer.** It depends on whether the facility is expected to be drawn. If drawdown is probable, the fee is compensation for the ongoing lending involvement and is deferred into the EIR of the resulting loan. If drawdown is not probable, it is recognised over the commitment period as a service fee.
**Standard.** IFRS 9 §B5.4.2(a) · §B5.4.3.
**In PCS.** The classification is stated per fee, not inferred from the word "commitment".

**Q33 · What about a fee on an undrawn facility that is never drawn?**
**Answer.** It is recognised over the commitment period. There is no loan to fold it into.

**Q34 · How is an exit or prepayment fee treated?**
**Answer.** It is a contractual cash flow of the loan and should be included in the expected flows for the EIR where it is probable. If it only crystallises on an event that is not expected, it is recognised when it occurs.

**Q35 · What is a transaction cost for this purpose?**
**Answer.** An incremental cost directly attributable to acquiring or originating the asset — one that would not have been incurred had the transaction not happened. External legal and due diligence costs usually qualify. Internal overhead, general administration and costs of unsuccessful deals do not.
**Standard.** IFRS 9 Appendix A · §B5.4.8.
**In PCS.** Transaction costs are captured per tranche and enter the EIR solve as a reduction of the yield.

**Q36 · Do transaction costs increase or decrease the carrying amount?**
**Answer.** For a financial asset they increase it. You paid them to acquire the asset, so they are part of what the asset cost you, and they reduce the yield over the life.
**Standard.** IFRS 9 §5.1.1.

**Q37 · What if a fee is received before the loan draws?**
**Answer.** There is no asset yet to add it to, so it sits as a deferred liability until drawdown and is released into the carrying amount when the loan is recognised.
**In PCS.** A deferred fee liability account is used and released on drawdown. The Hamilton arrangement fee follows this path.

**Q38 · How is the integral fee released — straight-line or effective interest?**
**Answer.** Effective interest. Straight-line is a simplification the standard does not permit for this, and it misstates the pattern of income on anything other than a bullet at a constant rate.
**In PCS.** Accretion is on an effective-interest basis.

**Q39 · Can a single fee be split between IFRS 9 and IFRS 15?**
**Answer.** In principle yes, where it genuinely compensates for two distinct things, but the split has to be supportable. In practice it is better to have the fee letter identify the components.

**Q40 · How do you treat a fee paid to a third party — an arranger or adviser?**
**Answer.** If it is incremental and directly attributable to originating the asset, it is a transaction cost and reduces the yield. If it is for a service we would have bought anyway, it is an expense.

**Q41 · What about agency fees we earn as facility agent?**
**Answer.** That is a service, performed over time, and it is IFRS 15 revenue. It is not part of the lending yield — we would earn it whether or not we held the loan.

**Q42 · Monitoring fee — IFRS 9 or IFRS 15?**
**Answer.** Normally IFRS 15. We are performing covenant checks and reporting each quarter and recognising the fee as we perform them.
**In PCS.** Smokey carries one, marked not integral, and it is the clean contrast to its arrangement fee.

**Q43 · What happens if we classify a fee wrongly?**
**Answer.** The reported yield moves. An integral fee wrongly treated as revenue front-loads income and understates the EIR for the whole life; the reverse defers income that should have been taken. Both are restatements if material.

**Q44 · Can we change the classification after the fact?**
**Answer.** It is corrected at source and re-imported, and the EIR is re-solved. It is not a toggle inside PCS, because the yield-defining decision should live in one place.

---

# 4 · Drawdowns, commitments and undrawn exposure

**Q45 · How is a drawdown recognised?**
**Answer.** It is the recognition of a financial asset. Debit the loan, credit cash.
**In PCS.** DR 141000 Investments at Cost, CR 111000 Cash, dated on the drawdown date. Drawdowns are never aggregated into accrual periods — they are dated events where money actually moved.

**Q46 · Is an undrawn commitment on the balance sheet?**
**Answer.** The commitment itself is not recognised as an asset, but it is in scope for impairment. Expected credit losses on loan commitments are provided for.
**Standard.** IFRS 9 §2.1(g), §5.5.20.

**Q47 · How do you measure ECL on an undrawn commitment?**
**Answer.** You estimate the portion expected to be drawn before default — a credit conversion factor — and measure the loss on that exposure. The provision is a liability, not a deduction from a loan that does not exist yet.
**Standard.** IFRS 9 §B5.5.30 – §B5.5.31.
**In PCS.** An EAD credit conversion factor is a field on the deal. Confirm the client's basis — whether the factor applies to the committed amount or to the undrawn portion — before quoting a figure.

**Q48 · What balance does a commitment fee accrue on?**
**Answer.** The undrawn balance. It is the price of holding capital available. As the facility draws, interest rises and the commitment fee falls.
**In PCS.** Balance basis is a stated field per fee — principal balance, unfunded balance, principal plus capitalised, or unfunded net of capitalisations. PCS derives the balance from the movements rather than taking it on trust.

**Q49 · What if a movement is missing from the feed?**
**Answer.** Every subsequent balance is wrong, so every subsequent accrual is wrong. This is why the file is required to carry every movement without exception, and why balance checkpoints exist.
**In PCS.** Periodic checkpoints in the file are compared against the balances the movements imply. A drift becomes an immediate, located mismatch instead of silent compounding.

**Q50 · How are repayments accounted for?**
**Answer.** They reduce the carrying amount. Debit cash, credit the loan. They are not income.

**Q51 · What about a prepayment with a penalty?**
**Answer.** The principal reduces the carrying amount; the penalty is a cash flow of the instrument. If it was in the expected flows it is already in the EIR; if not, it is recognised when it arises.

**Q52 · How is a partial repayment of a multi-draw facility allocated?**
**Answer.** By the contract. Where lots are tracked separately, the allocation follows the facility agreement's order of application.
**In PCS.** Drawdown lots are carried for traceability; journals aggregate to the tranche.

---

# 5 · PIK and capitalised interest

**Q53 · What is PIK and how is it accounted for?**
**Answer.** Payment in kind — interest the borrower does not pay in cash, added to principal instead. It is still interest income when it accrues. The accounting difference is that it is not settled in cash; it increases the carrying amount of the loan.
**In PCS.** DR the loan asset, CR interest income. There is no receivable raised and cleared, because nothing was ever receivable in cash.

**Q54 · Is PIK income recognised even though no cash is received?**
**Answer.** Yes. Revenue recognition does not depend on cash. The borrower's obligation has increased and we have earned the return.

**Q55 · Does PIK compound?**
**Answer.** Normally yes — once capitalised it forms part of the principal, and interest accrues on the larger balance.

**Q56 · How do you prove the PIK arithmetic to an auditor?**
**Answer.** Drawn plus capitalised should equal principal repaid over the life.
**In PCS.** On Smokey: £50,000,000 drawn, £8,345,261.74 capitalised, £58,345,261.74 repaid across the life. The capitalised interest is repaid as principal, because that is what it became.

**Q57 · Does PIK affect the ECL?**
**Answer.** Yes — it increases the exposure at default, so the allowance rises with the capitalised balance.

**Q58 · Is there a credit-risk concern with PIK?**
**Answer.** Commercially yes, and it is worth saying so. PIK means the borrower is not generating the cash to service the debt, which is normal during construction and a warning sign afterwards. Whether it indicates a significant increase in credit risk is a judgement.

**Q59 · Can a loan have both cash and PIK interest?**
**Answer.** Yes, and split structures are common — a cash margin plus a PIK margin.
**In PCS.** Settlement type is stated per component: cash, capitalised or PIK.

**Q60 · What if the borrower elects PIK only in some periods?**
**Answer.** A toggle election is handled as the schedule describes it, period by period.

---

# 6 · Floating rates, RFRs and forecast curves

**Q61 · Which benchmark rates are supported?**
**Answer.** Compounded-in-arrears risk-free rates — SONIA, SOFR, ESTR, TONA, SARON — and forward-looking term rates including Term SOFR, EURIBOR, BBSW and BBSY, plus fixed.

**Q62 · What is the difference between a compounded RFR and a term rate?**
**Answer.** A term rate is known at the start of the period — you know on day one what you will be paid. A compounded RFR is only known at the end, because it is built from daily fixings observed across the period. That changes when the amount is knowable, not how it is accounted for.

**Q63 · What are lookback, lockout and observation shift?**
**Answer.** Mechanisms that make a compounded rate knowable slightly before the period ends, so the payment can be settled on time. Lookback observes rates from a few days earlier; lockout freezes the rate for the final days; observation shift moves the whole observation window. They change the rate, so they are not cosmetic.
**In PCS.** All three are stated per component. Where a floating component does not state them, PCS warns that the compounded rate cannot be reproduced — the amounts can be recorded but not checked.

**Q64 · Does the benchmark reform affect our accounting?**
**Answer.** The transition reliefs in IFRS 9 and IFRS 7 allowed changes to the basis required by reform to be treated as a floating-rate reset rather than a modification. Most books are through this now, but legacy instruments can still carry fallback language.
**Standard.** IFRS 9 §5.4.5 – §5.4.9 (Phase 2 amendments).

**Q65 · Where do the actual rates come from?**
**Answer.** Published fixings, loaded into the module per index.

**Q66 · What happens beyond the last published fixing?**
**Answer.** You need a forward view. Without one, the rate is held flat at the last actual — which is shown as *held-flat* on the schedule, labelled as an assumption rather than presented as an observation.
**In PCS.** Rate provenance is tracked per day: actual, forecast, held-flat or base.

**Q67 · Why does the provenance matter?**
**Answer.** Because an assumption that looks like a fact is the thing that causes trouble at audit. A number labelled "forecast" invites a question about the curve; the same number unlabelled invites nothing.

**Q68 · Can we load a forecast curve?**
**Answer.** Yes, per index and per scenario, with an as-of date and a source note.

**Q69 · What is the difference between a benchmark curve and an all-in curve?**
**Answer.** A benchmark curve is the bare index, and the deal's margin is added to it. An all-in curve is the finished coupon with a margin already inside it. Loading one as the other either double-counts the margin or omits it.
**In PCS.** The basis is stated on the curve. On an all-in curve the engine does not add the deal margin or any ESG adjustment for the days the curve covers, and the screen says so prominently.

**Q70 · What is the risk with an all-in curve?**
**Answer.** It embeds one margin, so it is only valid for deals carrying that same margin. Applying it to a deal on a different margin is wrong in exactly the way the basis flag exists to prevent.

**Q71 · What happens at the changeover from actual to forecast?**
**Answer.** For a compounded rate, an observation window straddling the changeover mixes actual days with forecast days — so rates within about one tenor of the cutover are a blend. That is not an error, but it should not be described as either purely actual or purely forecast.

**Q72 · What if the forecast curve does not continue from the last actual?**
**Answer.** A large step at the cutover usually means an all-in curve has been loaded as a benchmark. PCS checks for this and warns where the step exceeds 50 basis points.

**Q73 · What happens when actuals replace a forecast?**
**Answer.** The previously reported figure was an estimate and the actual is now known. The difference is a restatement of the affected period, and it should be visible rather than absorbed.
**In PCS.** A restatement panel shows the delta when actuals replace forecast.

**Q74 · Can we see the loaded forecast rates?**
**Answer.** Yes — the full curve is listed with a chart of its shape above it.
**In PCS.** All points are shown, scrollable, with the first and last dates and the high and low. The chart is plotted against date rather than row index, so weekend gaps are not compressed.

---

# 7 · Impairment — ECL fundamentals

**Q75 · What is the expected credit loss model?**
**Answer.** A forward-looking model. You recognise expected losses before they are incurred, rather than waiting for evidence of a loss event. For a performing loan you provide for losses expected from defaults in the next twelve months; once credit risk has increased significantly you provide for losses expected over the whole life.
**Standard.** IFRS 9 §5.5.1 – §5.5.5.

**Q76 · Why recognise a loss on a loan that is performing?**
**Answer.** Because a portfolio of loans like this one produces losses, and the expected value of them is a real cost of lending. The alternative — recognising nothing until a borrower misses a payment — overstates profit in the good years and concentrates the loss in one period.

**Q77 · How is ECL measured?**
**Answer.** An unbiased, probability-weighted amount determined by evaluating a range of outcomes, discounted for the time value of money, using reasonable and supportable information about past events, current conditions and forecast conditions.
**Standard.** IFRS 9 §5.5.17.

**Q78 · What are PD, LGD and EAD?**
**Answer.** Probability of default — the likelihood the borrower fails to pay. Loss given default — the proportion not recovered after enforcing security. Exposure at default — the amount outstanding when that happens. The product of the three is the expected loss.

**Q79 · Show me the arithmetic.**
**Answer.** Exposure × probability of default × loss given default.
**In PCS, Smokey.** £50,000,000 × 0.50% × 30% = £75,000. That is the allowance at full exposure, and it is checkable on the back of an envelope.

**Q80 · What is the exact formula used for each stage?**
**Answer.**
- Stage 1, twelve-month ECL: annual PD × LGD × balance.
- Stage 2, lifetime ECL: min(1, annual PD × years remaining) × LGD × balance.
- Stage 3, lifetime ECL measured on the net carrying amount, being gross less the existing allowance.

**Q81 · Where do the PD and LGD come from?**
**Answer.** The client's own credit process. They are inputs, not something a sub-ledger should invent — a rating model, agency mapping, internal scorecard or external benchmark.
**In PCS.** They are fields on the deal. If they are not supplied, nothing is measured and no impairment is posted.

**Q82 · What happens if they are left blank?**
**Answer.** No allowance is recognised, and the absence is visible rather than reported as zero. A zero that was assumed looks exactly like a zero that was calculated, and only one of them is a fact.

**Q83 · How often is ECL re-measured?**
**Answer.** At every reporting date.
**In PCS.** The allowance is re-measured per reporting period and the movement — not the balance — goes to P&L.

**Q84 · Does the allowance only ever go up?**
**Answer.** No. As a loan amortises the exposure falls, so the required allowance falls with it and the excess is released. Impairment is not a provision you take once and forget.
**In PCS, Smokey.** £75,000 established across 17 entries and £47,019.59 released across 30, as the principal repays.

**Q85 · Is a release a gain?**
**Answer.** It is a credit to the same impairment line, not a separate gain. The P&L shows the net movement in the allowance for the period.

**Q86 · How is the allowance presented on the balance sheet?**
**Answer.** As a deduction from the gross carrying amount of the asset. It is a contra-asset — it does not reduce the loan itself.
**In PCS.** DR 470000 Impairment Expense, CR 145000 Loan Loss Allowance.

**Q87 · How do you incorporate forward-looking information?**
**Answer.** Through the parameters. A macro overlay weight can scale the measured loss to reflect a scenario view.
**In PCS.** A macro overlay weight is available on the deal.

**Q88 · Do you support multiple economic scenarios?**
**Answer.** The measurement basis is a probability-weighted outcome. In practice most private-credit books use a single scenario with an overlay rather than a full multi-scenario engine — confirm what the client's auditor expects before promising more.

**Q89 · Is ECL discounted?**
**Answer.** The standard requires the time value of money to be reflected, discounting at the effective interest rate. For a short-dated exposure the effect is small; over ten years it is not.
**Standard.** IFRS 9 §5.5.17(b), §B5.5.44.

**Q90 · What discount rate is used for undrawn commitments?**
**Answer.** The rate that reflects the current market assessment of the time value of money and the risks specific to the cash flows, where the EIR cannot be determined.
**Standard.** IFRS 9 §B5.5.47.

**Q91 · Does ECL affect interest income?**
**Answer.** Not in Stages 1 and 2 — interest is calculated on the gross carrying amount regardless of the allowance. It does in Stage 3.
**Standard.** IFRS 9 §5.4.1.

**Q92 · Can we see how the ECL figure was arrived at?**
**Answer.** Yes — there is a calculation trace.
**In PCS.** The trace shows the inputs and the resulting allowance. A period-by-period table inside the trace is on the backlog.

---

# 8 · Staging and significant increase in credit risk

**Q93 · What are the three stages?**
**Answer.** Stage 1 is performing: twelve-month ECL, interest on gross. Stage 2 is a significant increase in credit risk since initial recognition: lifetime ECL, interest still on gross. Stage 3 is credit-impaired: lifetime ECL, interest on the net carrying amount.
**Standard.** IFRS 9 §5.5.3, §5.5.5, §5.4.1(b).

**Q94 · What counts as a significant increase in credit risk?**
**Answer.** A significant increase in the risk of a default occurring over the expected life, assessed by comparing risk at the reporting date with risk at initial recognition. It is relative, not absolute — a loan that was always risky has not deteriorated merely by remaining risky.
**Standard.** IFRS 9 §5.5.9.

**Q95 · What indicators does the standard list?**
**Answer.** Among others: actual or expected changes in external or internal credit rating, adverse changes in business or economic conditions, changes in the value of collateral, expected forbearance, and actual or expected significant changes in operating results.
**Standard.** IFRS 9 §B5.5.17.

**Q96 · Is there a bright line?**
**Answer.** There is a rebuttable presumption that credit risk has increased significantly when payments are more than 30 days past due. It can be rebutted with reasonable and supportable information.
**Standard.** IFRS 9 §5.5.11.

**Q97 · Does a covenant breach move a loan to Stage 2?**
**Answer.** It is a presumptive indicator, not an automatic rule. The entity decides which breaches are significant.
**In PCS.** Covenants carry a configurable consequence. Where `sicrTrigger` is set, a breach moves the deal to Stage 2 — the client opts in rather than the system assuming.

**Q98 · Can a loan move back from Stage 2 to Stage 1?**
**Answer.** Yes. Staging is symmetrical — if the increase in credit risk reverses, the asset returns to twelve-month ECL.

**Q99 · Is there a low credit risk exemption?**
**Answer.** Yes, an entity may assume credit risk has not increased significantly where the asset is determined to have low credit risk at the reporting date. It is optional and is often not taken for private credit, where investment-grade equivalence is rare.
**Standard.** IFRS 9 §5.5.10.

**Q100 · Does the module decide the stage?**
**Answer.** It can be set directly, or driven from days past due and covenant status. It is not inferred from the deal's economics.

**Q101 · How do you evidence the staging decision to an auditor?**
**Answer.** The inputs and the trigger are recorded on the deal. The thing an auditor is testing is whether the policy was applied consistently, so the value is in the policy being visible per deal rather than embedded in code.

**Q102 · What about a portfolio-level assessment?**
**Answer.** The standard permits collective assessment where shared risk characteristics exist and individual information is not available without undue cost. This module is deal-level; a collective overlay is a reporting-layer decision.
**Standard.** IFRS 9 §B5.5.1 – §B5.5.6.

---

# 9 · Credit-impaired, POCI, write-off and recovery

**Q103 · What makes an asset credit-impaired?**
**Answer.** One or more events have occurred that have a detrimental impact on the estimated future cash flows — significant financial difficulty, a breach of contract such as default or past due, a concession granted for economic or legal reasons relating to the borrower's difficulty, probable bankruptcy, or the disappearance of an active market.
**Standard.** IFRS 9 Appendix A.

**Q104 · How does interest work in Stage 3?**
**Answer.** The effective interest rate is applied to the amortised cost — gross less the allowance — rather than to the gross amount. You stop accruing income on the part you do not expect to collect.
**Standard.** IFRS 9 §5.4.1(b).
**In PCS.** A per-deal flag for Stage 3 interest on net.

**Q105 · What is POCI?**
**Answer.** Purchased or originated credit-impaired. An asset that was already credit-impaired when you acquired it — typically bought at a deep discount reflecting the credit position.
**Standard.** IFRS 9 §5.5.13 – §5.5.14, §B5.4.7.

**Q106 · Why does POCI need different treatment?**
**Answer.** Because you priced the expected losses when you bought it. If you then also recognised a loss allowance on day one, you would be providing twice for the same thing. Instead the expected losses go into the rate.

**Q107 · What is a credit-adjusted effective interest rate?**
**Answer.** The rate that discounts the *expected* cash flows — contractual less expected credit losses — back to what you paid. It is lower than an ordinary EIR on the same instrument, and the gap is exactly the overstatement that POCI treatment avoids.
**Standard.** IFRS 9 Appendix A, §B5.4.7.
**In PCS.** The credit-adjusted EIR is solved against consideration paid and expected flows. The ordinary EIR is also computed and shown, so the difference is visible.

**Q108 · Does a POCI asset have stages?**
**Answer.** No. There is no Stage 1, 2 or 3 and no SICR assessment. It starts impaired and remains POCI for life.

**Q109 · What is recognised in P&L on a POCI asset afterwards?**
**Answer.** Only *changes* in lifetime expected credit losses since initial recognition — favourable as well as unfavourable. A favourable change is a gain.
**Standard.** IFRS 9 §5.5.14.

**Q110 · What input does POCI need?**
**Answer.** The lifetime expected credit loss at acquisition. It is the fund's own credit view and cannot be inferred.
**In PCS.** Without it, the EIR solve refuses and says why rather than falling back to an ordinary EIR.

**Q111 · When do you write a loan off?**
**Answer.** When there is no reasonable expectation of recovering the asset, in whole or in part. Write-off is a derecognition event.
**Standard.** IFRS 9 §5.4.4.

**Q112 · Is a write-off a loss in the period it happens?**
**Answer.** Only to the extent it exceeds the allowance already carried. Writing off an amount fully provided for is a balance sheet movement — the allowance is applied against the asset and nothing hits P&L. Any excess is an expense.
**In PCS.** The split is explicit: allowance applied, and residual expense where the write-off exceeds it.

**Q113 · What if we recover an amount previously written off?**
**Answer.** It is recognised in P&L when recovered, as a reversal of impairment.

**Q114 · Does write-off mean we stop pursuing the borrower?**
**Answer.** No, and this is worth saying. Write-off is an accounting conclusion about recoverability, not a legal waiver. Enforcement can continue.

---

# 10 · Modification, forbearance and derecognition

**Q115 · What happens when we amend a loan?**
**Answer.** First decide whether the amendment is substantial. If it is, the old asset is derecognised and a new one recognised. If it is not, the asset stays on the books and its carrying amount is adjusted.
**Standard.** IFRS 9 §3.2.3 · §5.4.3.

**Q116 · How do you decide whether a modification is substantial?**
**Answer.** This is the question to get right, and it is where many answers are loose. **IFRS 9 does not prescribe a 10% test for financial assets.** The 10% test in §B3.3.6 applies to financial *liabilities*. For assets the standard requires judgement as to whether the contractual cash flows are substantially different.
In practice many entities apply the 10% threshold by analogy, supported by qualitative factors — a change of currency, a change of counterparty, the introduction of equity conversion, a change that would breach SPPI. That is an accepted approach but it is a policy choice, and it should be documented as one rather than presented as a requirement of the standard.
**Standard.** IFRS 9 §3.2.3, §5.4.3 · §B3.3.6 (liabilities) · IFRS 9 §B5.5.25 on modification and SICR.

**Q117 · So what does PCS do?**
**Answer.** It computes the present value of the revised cash flows discounted at the **original** effective interest rate, compares it with the pre-modification carrying amount, and reports the percentage change against a threshold. The threshold is configurable per deal.
**Be careful here.** The number is the input to a judgement, not the judgement. If a client asks whether the system decides, the honest answer is that it measures and reports, and the policy decides.

**Q118 · Why discount at the original EIR?**
**Answer.** Because on a non-substantial modification the asset is not derecognised, so its yield does not change. Using a new rate would change the yield and bury the loss in future interest rather than recognising it now.
**Standard.** IFRS 9 §5.4.3.

**Q119 · Where does the modification gain or loss go?**
**Answer.** Immediately to profit or loss.
**In PCS.** DR 141000 Investments at Cost / CR 440000 Modification Gain-Loss for a gain; the reverse for a loss. Both directions use the same account pair, which is correct — it is one line that nets.

**Q120 · Does a modification reset the staging?**
**Answer.** No. A modified asset that was in Stage 2 does not return to Stage 1 merely because it was amended. The standard specifically warns against this — the risk comparison remains against initial recognition of the original asset.
**Standard.** IFRS 9 §B5.5.25 – §B5.5.27.

**Q121 · What is forbearance?**
**Answer.** A concession granted because the borrower is in financial difficulty — a payment holiday, an interest deferral, a covenant waiver. It is usually an indicator of significant increase in credit risk, and often of credit impairment.

**Q122 · How is a payment deferral accounted for?**
**Answer.** The deferred amount is still owed, so it remains an asset. If the deferral changes the timing of flows materially, it is a modification and the carrying amount is re-measured at the original EIR.
**In PCS.** Forbearance posts within accounts receivable — the deferred interest remains an amount owed to us rather than being routed to an income account.

**Q123 · Does granting a concession automatically mean Stage 3?**
**Answer.** A concession granted for reasons relating to the borrower's financial difficulty is one of the credit-impaired indicators, so it usually does. A commercial renegotiation not driven by difficulty does not.

**Q124 · What happens on debt forgiveness?**
**Answer.** The forgiven amount is derecognised. Where an allowance was held against it, the allowance is applied; any excess is a loss.

**Q125 · How is a debt-for-equity swap treated?**
**Answer.** The loan is derecognised and equity is recognised at fair value, with the difference to P&L.
**In PCS.** The loan is derecognised and the equity taken on is recognised at fair value.

**Q126 · How is a loan sale accounted for?**
**Answer.** If substantially all risks and rewards transfer, the asset is derecognised and the difference between consideration and carrying amount is a gain or loss. A partial sale of a fully proportionate share derecognises only that proportion.
**Standard.** IFRS 9 §3.2.3 – §3.2.9.
**In PCS.** Both full and proportionate partial sales are handled, with the derecognition latched so it cannot reverse.

**Q127 · What happens on a substantial modification — honestly?**
**Answer.** **Be careful with this one.** The test is performed and the result reported, and the revised terms apply forward from the modification date. Full derecognition and re-recognition as two separate instruments — old asset off, new asset on with its own EIR — is not completed within a single run; the event is logged and surfaced for the ledger.
If a client's scenario depends on substantial-modification accounting, treat it as a design discussion rather than a demo step.

**Q128 · What about the interaction between modification and ECL?**
**Answer.** A modification changes the expected cash flows, so it changes the ECL. It does not reset the credit risk comparison.

**Q129 · How do you handle an extension of maturity?**
**Answer.** It is a change to the timing of cash flows and feeds the modification assessment. An extension is often the most valuable concession in a restructuring, so it should not be treated as administrative.

**Q130 · Can a modification be a derecognition even below the quantitative threshold?**
**Answer.** Yes — qualitative factors can be decisive on their own. A change of borrower, a change of currency, or a change that breaks SPPI would each point to derecognition regardless of the percentage.

---

# 11 · Presentation and disclosure

**Q131 · Where does interest income appear?**
**Answer.** As revenue, calculated using the effective interest method. Interest revenue calculated using the effective interest method is a required line item.
**Standard.** IAS 1 §82(a) · IFRS 9 §5.4.1.

**Q132 · Is the impairment charge separately presented?**
**Answer.** Yes — impairment losses, including reversals, determined in accordance with IFRS 9 §5.5 are a separate line.
**Standard.** IAS 1 §82(ba).

**Q133 · What disclosures does IFRS 7 require around ECL?**
**Answer.** Among others: the inputs, assumptions and techniques used to measure ECL and to determine significant increases in credit risk; a reconciliation of the loss allowance from opening to closing by stage; gross carrying amount by credit risk grade; and the effect of modifications.
**Standard.** IFRS 7 §35F – §35N.

**Q134 · Does the module produce those disclosures?**
**Answer.** It produces the underlying data — allowance movements by period, staging, gross and net carrying amounts, modification gains and losses. The disclosure note itself is assembled in the reporting layer. Be clear about this boundary.

**Q135 · Can we get an allowance roll-forward?**
**Answer.** The movements are posted per period and are extractable: opening, charge, release, write-off applied, closing.

**Q136 · How is accrued interest presented?**
**Answer.** As a receivable, separately from the loan principal, until settled.
**In PCS.** DR 113000 Accounts Receivable on accrual, cleared to cash on settlement — so a real receivable exists between accrual and payment rather than netting to nothing.

**Q137 · What about foreign currency loans?**
**Answer.** The loan is a monetary item, retranslated at the closing rate with differences in P&L. The currency is explicit at deal and tranche level and never inferred.
**Standard.** IAS 21.

**Q138 · How is a participation or syndicated share presented?**
**Answer.** At our share. Journals are allocated by participation percentage across legal entities.

---

# 12 · Journals, GL and the ledger

**Q139 · Do the journals balance?**
**Answer.** Every batch balances. Debits equal credits at batch level and it is verified before anything is submitted.

**Q140 · Whose chart of accounts is used?**
**Answer.** The client's. PCS ships a mapping screen, not a chart. Every debit and credit is configured against the client's own accounts, held per framework.

**Q141 · What happens if I change an account in the mapping?**
**Answer.** Re-run the accounting and the journals follow. The mapping is read fresh at the start of every run — it is configuration, not a report of what the engine decided.

**Q142 · Can I enter an account that does not exist?**
**Answer.** No. The code is validated against the real chart and the save is refused with the code named. A mapping screen that accepted a typo and then posted to it would be worse than no mapping screen.

**Q143 · What are the main account pairs?**
**Answer.**

| Event | DR | CR |
|---|---|---|
| Drawdown | Investments at Cost | Cash |
| Interest accrual | Accounts Receivable | Interest Income |
| Interest settlement | Cash | Accounts Receivable |
| Fee accrual (service) | Accounts Receivable | Fee Income |
| PIK capitalisation | Investments at Cost | Interest Income |
| ECL charge | Impairment Expense | Loan Loss Allowance |
| ECL release | Loan Loss Allowance | Impairment Expense |
| Write-off | Loan Loss Allowance | Investments at Cost |
| Modification gain | Investments at Cost | Modification Gain/Loss |
| Repayment | Cash | Investments at Cost |

**Q144 · How do the journals reach the ledger?**
**Answer.** As a batch through Investran's Data Import Utility, with a deterministic external key so a re-run after a failure cannot double-post.

**Q145 · What happens if a posting fails?**
**Answer.** The batch carries an error list and a trace id, and the run exits non-zero. Re-running submits the same key, which the ledger rejects as a duplicate, and the status is re-polled.

**Q146 · Can we post to a prior period?**
**Answer.** The GL date can match each row's effective date or a single close date can be applied to the whole batch. Any change to a period already posted is flagged before the accounting re-runs.

---

# 13 · Other frameworks

**Q147 · What is different under US GAAP?**
**Answer.** CECL. There is no staging and no twelve-month measurement — lifetime expected credit loss is recognised from origination on every asset.
**Standard.** ASC 326-20.

**Q148 · Does that mean a bigger allowance?**
**Answer.** On a performing loan, usually yes, because IFRS 9 would hold only twelve months of expected loss until credit risk increases significantly.

**Q149 · Is there a CECL equivalent of Stage 3 interest on net?**
**Answer.** Non-accrual practice serves a similar function but is driven by regulatory and policy conventions rather than a single standard paragraph.

**Q150 · How are fees treated under US GAAP?**
**Answer.** Similarly in effect — origination fees and direct costs are deferred and recognised over the life as a yield adjustment.
**Standard.** ASC 310-20.

**Q151 · What about ASPE?**
**Answer.** Canadian ASPE uses an incurred-loss approach rather than expected loss. The trigger is objective evidence of impairment.

**Q152 · And AASB?**
**Answer.** AASB 9 mirrors IFRS 9. The Australian-specific handling in the module concerns GST and franking rather than measurement.

**Q153 · Can the same deal be reported under two frameworks?**
**Answer.** The framework is a property of the deal. Parallel reporting of one deal under two bases is a structural question — raise it as a design discussion rather than answering yes on the spot.

**Q154 · Which framework should a client choose?**
**Answer.** Not our decision. It follows the reporting entity's requirements and its auditor's expectations.

---

# 14 · External feeds, data and controls

**Q155 · Where do the numbers come from?**
**Answer.** For an imported deal, from the servicing system — and they are posted as received, never recalculated. PCS owns the accounting, not the arithmetic of what the borrower owes.

**Q156 · Why not recalculate as a check?**
**Answer.** Two systems computing the same number to slightly different conventions will differ in the last penny every day, forever, and the reconciliation would never end. What PCS does check is internal consistency — the balance checkpoints in the file against the balances the movements imply.

**Q157 · What if the file is wrong?**
**Answer.** It is corrected at source and re-sent. PCS shows the difference against the previous snapshot. Nobody can quietly patch it in PCS, because then the correction would exist in one system only.

**Q158 · What validation is applied?**
**Answer.** A blank value blocks the import only where it would change a number — currency, framework, day count, deal structure, interest type. Descriptive gaps are imported with a warning. The asymmetry is deliberate.

**Q159 · How do you detect a restatement?**
**Answer.** Each import is a complete snapshot, diffed against the last on immutable identifiers. There is no restatement marker in the file.

**Q160 · What if an identifier changes between imports?**
**Answer.** Every snapshot would read as a wholesale replacement and a restatement would be indistinguishable from new business. This is why identity has to be stable, and it is the single most important thing to agree with a data provider.

**Q161 · How far does the ledger run?**
**Answer.** To the end of the data received, not to contractual maturity. A period the servicer has not sent is a period PCS has nothing to say about.

**Q162 · Can two people run the accounting at once?**
**Answer.** No — one run per deal at a time, against a payload snapshot taken at the start, so a concurrent edit cannot change a run mid-flight.

**Q163 · Is there an audit trail?**
**Answer.** Runs are retained with their inputs, and a run can be re-executed against any stored snapshot. Nothing is destructive.

**Q164 · Who can change the accounting treatment?**
**Answer.** Treatment overrides are per deal and persisted. On an imported deal the contractual data is read-only — deny by default, so a field added later is locked until explicitly opened.

---

# 15 · Awkward questions, answered honestly

These are the ones that decide credibility. A confident wrong answer costs more than an honest incomplete one.

**Q165 · Is this an audited or certified calculation engine?**
**Answer.** It implements IFRS 9 and produces an auditable trail of inputs, policy choices and outputs. It is not a substitute for the client's own controls or for their auditor's testing, and nobody should say it is.

**Q166 · Will our auditor accept this?**
**Answer.** Auditors test policy and evidence, not software. What the module provides is the evidence — the inputs, the policy settings per deal, the calculation trace and the journals. The policy decisions remain the client's.

**Q167 · Does the system make the accounting judgements?**
**Answer.** No, and that is deliberate. Whether a fee is integral, whether a modification is substantial, which stage applies, what PD to use — those are stated as inputs. The system measures and reports; it does not conclude.

**Q168 · What does the system refuse to do?**
**Answer.** Guess. A blank day count blocks an import. A missing PD means no allowance rather than a zero. An unstated fee classification keeps the fee out of the yield and says so. A rate beyond the last fixing is labelled held-flat, not presented as an observation.

**Q169 · Is the 10% test a requirement?**
**Answer.** Not for financial assets. See Q116 — this is the single most common place to be loosely wrong, and getting it right in front of a technical accountant is worth more than any feature.

**Q170 · Can you handle a scenario I have not mentioned?**
**Answer.** Better to say "let me check and come back with a precise answer" than to improvise. Private credit has a long tail — tranching with different seniorities, cross-currency structures, NAV facilities, rated note feeders — and the honest limits are easier to defend than an optimistic yes.

**Q171 · What is on the roadmap?**
**Answer.** Do not improvise a roadmap in a demo. Note the question and route it.

**Q172 · How do you handle hedge accounting?**
**Answer.** Hedge designation is captured at a basic level — designation type and dates. Full hedge effectiveness testing and the associated documentation are not the module's purpose. Treat it as a design discussion.

**Q173 · What about fair value disclosures for amortised cost assets?**
**Answer.** IFRS 7 requires fair value disclosure for assets carried at amortised cost. That is a valuation exercise outside this module's measurement path.
**Standard.** IFRS 7 §25 – §29.

**Q174 · Does this replace our existing sub-ledger?**
**Answer.** It is a loan accounting sub-ledger that posts into the client's general ledger. Whether it replaces something is a scoping conversation, not a demo answer.

**Q175 · Can we see the code or the calculation logic?**
**Answer.** The calculation traces show the inputs and the arithmetic for EIR and ECL. Deeper assurance is a due diligence conversation.

**Q176 · Something on screen looks wrong — what do I say?**
**Answer.** Say so. *"That doesn't look right to me either — let me take it away and come back with an explanation."* Every attempt to explain away an on-screen anomaly in real time makes it worse, and the room can usually tell.

---

# 16 · Interest mechanics and edge cases

**Q177 · What happens on a leap day?**
**Answer.** Under ACT/365 the year still divides by 365, so a leap year accrues 366 days of interest — slightly more than a full year's nominal rate. Under ACT/ACT the denominator follows the actual year. This is a convention question, not a judgement, and the day count field settles it.

**Q178 · Is interest accrued on the drawdown date itself?**
**Answer.** Follows the facility agreement. The common convention is interest from and including the drawdown date, to but excluding the repayment date. The period start and end on each cashflow row make the convention explicit rather than inferred.

**Q179 · What if a payment date falls on a weekend or holiday?**
**Answer.** The business day convention — following, modified following, preceding — determines the adjusted date, and whether interest accrues over the shift depends on whether the convention is "adjusted" or "unadjusted".
**In PCS.** A holiday calendar is stated per facility: none, US Federal, UK Bank, TARGET or Australian Notional.

**Q180 · What is a rate floor and how is it accounted for?**
**Answer.** A contractual minimum on the reference rate. It is simply part of the rate calculation. A floor at zero prevents a negative benchmark reducing the margin.
**In PCS.** Floor and cap are per component in basis points.

**Q181 · Does a floor break SPPI?**
**Answer.** Generally no. A floor or cap on interest is consistent with basic lending — it limits variability rather than introducing exposure to something other than credit and time value.
**Standard.** IFRS 9 §B4.1.11(b).

**Q182 · What happens if the benchmark goes negative?**
**Answer.** Without a floor, the all-in rate falls. Whether it can go below zero is a contract question. Most modern facilities floor the benchmark at zero.

**Q183 · How is default interest treated?**
**Answer.** It is interest income when it accrues, but recoverability matters — a borrower in default may not pay it. If collection is not probable the recognition should reflect that, and in Stage 3 the interest calculation is on the net carrying amount anyway.
**In PCS.** Default interest has its own business event and its own income account, so it can be reported separately from contractual interest.

**Q184 · Why report default interest separately?**
**Answer.** Because it tells a different story. A rising default interest line is a credit signal, and burying it inside ordinary interest income hides it.

**Q185 · How is a margin ratchet applied mid-period?**
**Answer.** The margin changes from the effective date of the step. Where the step falls inside an accrual period, the period carries two margins and the calculation is split at the changeover.
**In PCS.** Margins are held as dated bands with explicit start and end dates. The band covering a given day is the one applied — a change mid-period is not smoothed across the whole period.

**Q186 · Does a margin change count as a modification?**
**Answer.** Not where it is the contract operating as written — a ratchet stepping on a leverage test is the agreement doing what it always said it would. A negotiated margin change outside the existing terms is a modification.

**Q187 · How is interest on a multi-currency facility handled?**
**Answer.** Each currency is its own exposure with its own benchmark, retranslated at the closing rate. The currency is explicit at deal and tranche level.
**Standard.** IAS 21.

**Q188 · What is the accounting for a utilisation fee?**
**Answer.** A fee that steps with how much of the facility is drawn. It is normally a service-style fee recognised over the period, but if it is effectively part of the lending return the integral test applies.

**Q189 · How do you handle interest capitalised during construction?**
**Answer.** From the lender's side it is PIK — income earned, added to principal. Borrower-side capitalisation into the cost of an asset under IAS 23 is a different question and not this module's concern.

**Q190 · What if the borrower overpays?**
**Answer.** The excess is either applied against future obligations or refundable. It is not income.

---

# 17 · Collateral, security and recovery

**Q191 · Does collateral affect the ECL?**
**Answer.** Yes, through loss given default. Security reduces the expected loss because it increases expected recovery. The cash flows expected from realising collateral are part of the measurement.
**Standard.** IFRS 9 §B5.5.55.

**Q192 · Is collateral recognised as an asset?**
**Answer.** Not while the borrower holds it. It affects measurement of the loan, not the balance sheet directly, until it is taken into possession.

**Q193 · How do you set LGD for a secured loan?**
**Answer.** From the client's recovery experience and the security position — seniority, asset type, enforceability, time to realise. A senior secured position over a contracted infrastructure asset supports a materially lower LGD than an unsecured position. It is a credit input, not an accounting one.

**Q194 · What happens when we take possession of collateral?**
**Answer.** The loan is derecognised to the extent satisfied and the asset is recognised at fair value. Any shortfall is a loss.

**Q195 · Does a guarantee reduce ECL?**
**Answer.** An integral credit enhancement — one that is part of the contractual terms and not separately recognised — is included in the expected cash flows.
**Standard.** IFRS 9 §B5.5.55.

**Q196 · What about a credit default swap we bought separately?**
**Answer.** That is a separate instrument, accounted for in its own right, not netted against the loan's ECL.

**Q197 · How is a shared security package across tranches handled?**
**Answer.** Recovery expectations should reflect the waterfall. A junior tranche behind a senior claim has a higher LGD even against the same asset.

**Q198 · Does an intercreditor arrangement change the accounting?**
**Answer.** Not the measurement basis, but it changes expected recovery and therefore LGD, and it may affect whether a restructuring is substantial.

---

# 18 · Period close and operations

**Q199 · What is the month-end process?**
**Answer.** Run the accounting for the period, review the journals, approve, and post the batch to the ledger. The run is repeatable against the same snapshot until it is approved.

**Q200 · Can we re-run after posting?**
**Answer.** Yes, but any change to a period already posted is flagged before the run proceeds. Re-posting is a reverse-and-repost decision, not a silent overwrite.

**Q201 · How do you handle a late-arriving fixing?**
**Answer.** The period was reported with a forecast or held-flat rate; when the actual arrives it replaces it and the difference is a restatement of that period, shown as a delta.

**Q202 · What if a prior-period error is found?**
**Answer.** Materiality determines whether it is corrected prospectively or restated under IAS 8. The module provides the before-and-after; the judgement is the entity's.
**Standard.** IAS 8.

**Q203 · Is there a lock after close?**
**Answer.** A posted period is flagged, and a change affecting it surfaces before the accounting re-runs. A hard lock is a control the client configures in their ledger.

**Q204 · How long does a run take?**
**Answer.** Depends on the schedule length. A ten-year quarterly deal is seconds; a forty-year daily feed is longer. The run is single-flight per deal.

**Q205 · Can several people work at once?**
**Answer.** Yes, on different deals. One accounting run per deal at a time, against a payload snapshot taken at the start.

**Q206 · What is retained for audit?**
**Answer.** The run with its inputs and outputs, the snapshot it was based on, the treatment settings in force, and the journals. A run can be re-executed against any stored snapshot.

**Q207 · How do you evidence that the ledger agrees with the sub-ledger?**
**Answer.** Batch-level balancing before submission, and the ledger's own acceptance of the batch with a row count. The reconciliation is the batch, not a separate exercise.

---

# 19 · Data quality and controls

**Q208 · What stops someone entering a wrong GL account?**
**Answer.** The code is validated against the chart and the save is refused with the code named.

**Q209 · What stops a bad rate?**
**Answer.** A rate above 1 is rejected as a percentage entered in a decimal field. Rates are carried at full precision — rounding a 45bp fee to four decimal places distorts it by about 0.74%.

**Q210 · What stops a bad date?**
**Answer.** Ambiguous or unreadable dates are reported with their cell reference rather than dropped. Where a file uses text dates, the reading is inferred and the inference is stated — ISO dates remove the question.

**Q211 · What happens to a row that cannot be read?**
**Answer.** It is reported, not silently discarded. Dropping money quietly is the failure mode the validation exists to prevent.

**Q212 · Can a user change a figure the servicer sent?**
**Answer.** No. Imported deals are read-only — deny by default, so a field added later is locked until explicitly opened.

**Q213 · Who can change the accounting treatment?**
**Answer.** Treatment settings are per deal and persisted with a timestamp.

**Q214 · How do you know which version of a file you are looking at?**
**Answer.** The snapshot id and timestamp are on every affected screen.

**Q215 · What if two files for the same deal disagree?**
**Answer.** The later snapshot is current and the earlier is retained. The difference is a diff, not a merge conflict to resolve by hand.

**Q216 · Is there segregation between preparing and approving?**
**Answer.** Runs carry a status — draft, approved, posted — with the approval recorded. How that maps to the client's own segregation policy is a configuration conversation.

---

# 20 · Questions from a credit or investment audience

**Q217 · Does the accounting affect what we can distribute?**
**Answer.** Distributable reserves follow accounting profit in most structures, so yes — an impairment charge reduces what can be distributed even though no cash has been lost.

**Q218 · Does an ECL charge mean we expect to lose money on this deal?**
**Answer.** No, and this is worth saying carefully. It means that across a population of loans with these characteristics, some proportion defaults. The charge is the expected value, not a prediction about this borrower.

**Q219 · Why does our yield look lower than the coupon?**
**Answer.** Because transaction costs reduce it and the EIR spreads fee income rather than taking it upfront. The EIR is the honest yield; the coupon is only part of it.

**Q220 · Why did income move when nothing happened on the deal?**
**Answer.** Usually a rate reset, a change from forecast to actual rates, or an amortisation step changing the balance. The rate provenance on the schedule tells you which.

**Q221 · Our IRR and your EIR do not agree — why?**
**Answer.** They are different measures. IRR is usually computed on cash to and from the fund, often including fees paid to the manager and timing of capital calls. EIR is an instrument-level accounting yield on the asset. They should not be expected to match.

**Q222 · Does PIK flatter our reported income?**
**Answer.** It increases reported income without cash, which is a fair criticism and worth meeting head-on. The accounting is correct — the income is earned — but a reader should look at cash interest separately, which is why cash and capitalised settlement are distinguished rather than merged.

**Q223 · How does this affect NAV?**
**Answer.** Amortised cost less allowance is the carrying amount feeding NAV for a loan held at amortised cost. A fair value NAV is a different basis.

**Q224 · What does the auditor usually challenge first?**
**Answer.** In practice: the staging decisions, the PD and LGD inputs and their support, whether forward-looking information was genuinely incorporated, and the modification conclusions. The module's answer to all four is that the inputs and the policy are recorded per deal rather than embedded.

---

# 21 · Scenario walk-throughs

**Q225 · A borrower misses a payment. What happens?**
**Answer.** Days past due start running. At 30 days there is a rebuttable presumption of significant increase in credit risk, moving to Stage 2 and lifetime ECL. At 90 days there is a rebuttable presumption of default. If credit-impaired, Stage 3 and interest on the net carrying amount.
**Standard.** IFRS 9 §5.5.11 · §B5.5.37.

**Q226 · A covenant is breached but payments continue. What happens?**
**Answer.** A breach is an indicator, not an automatic stage move. If the client's policy treats that covenant as a SICR trigger, it moves to Stage 2.

**Q227 · We agree a payment holiday. What happens?**
**Answer.** It is forbearance. It is a concession for financial difficulty, so it points to credit impairment, and the change in timing feeds the modification assessment.

**Q228 · We extend maturity by two years at the same margin. What happens?**
**Answer.** The revised cash flows are discounted at the original EIR and compared with the carrying amount. Whether that is substantial is a judgement supported by the measurement. If not substantial, the difference is a modification loss recognised now.

**Q229 · We write off half the loan. What happens?**
**Answer.** The written-off amount is derecognised. Where an allowance is held it is applied first; any excess is an expense. The remaining balance continues to accrue.

**Q230 · The borrower repays early. What happens?**
**Answer.** The carrying amount is reduced by the repayment. Any unamortised fee balance is released, because the life the fee was being spread over has ended.

**Q231 · We sell the loan at a discount. What happens?**
**Answer.** Derecognition. The difference between consideration and carrying amount — which is net of allowance — is a gain or loss on sale.

**Q232 · We buy a distressed loan at 60 cents. What happens?**
**Answer.** If it is credit-impaired at acquisition it is POCI: a credit-adjusted EIR is solved against the 60, the lifetime ECL at acquisition is an input, and no day-one allowance is recognised. If it is not credit-impaired, it is an ordinary asset bought at a discount and the discount unwinds through the EIR.

**Q233 · We convert debt to equity. What happens?**
**Answer.** The loan is derecognised and equity recognised at fair value, with the difference to P&L.

**Q234 · Interest is deferred and capitalised for two years, then cash-pays. What happens?**
**Answer.** PIK during the deferral, increasing the carrying amount, then cash interest with a receivable raised and cleared. Settlement type per component carries this.

**Q235 · The facility is never drawn and expires. What happens?**
**Answer.** No loan was ever recognised. Commitment fees were recognised over the commitment period, and any ECL provision on the commitment is released.

**Q236 · A tranche is repaid in full. What happens?**
**Answer.** The carrying amount goes to nil, any remaining allowance is released, and any unamortised fee is taken. A residual balance after full repayment is an error — see Appendix C.

---

# 22 · Terminology quick answers

**Q237 · Amortised cost.** The amount at initial recognition, less principal repayments, plus or minus cumulative amortisation of any difference between that initial amount and the maturity amount using the effective interest method, adjusted for the loss allowance.

**Q238 · Gross carrying amount.** Amortised cost before adjusting for the loss allowance.

**Q239 · Effective interest method.** The method of calculating amortised cost and allocating interest income over the relevant period.

**Q240 · Loss allowance.** The accumulated impairment provision for expected credit losses.

**Q241 · Credit loss.** The difference between contractual cash flows due and cash flows expected to be received, discounted at the original EIR.

**Q242 · 12-month expected credit losses.** The portion of lifetime ECL representing losses from default events possible within twelve months after the reporting date — not the losses expected in twelve months.

**Q243 · Lifetime expected credit losses.** ECL from all possible default events over the expected life.

**Q244 · Default.** Not defined in IFRS 9. The entity applies a definition consistent with internal credit risk management, with a rebuttable presumption that default occurs no later than 90 days past due.
**Standard.** IFRS 9 §B5.5.37.

**Q245 · Past due.** A financial asset is past due when a counterparty has failed to make a payment when contractually due.

**Q246 · Modification.** A change to contractual cash flows that does not result in derecognition.

**Q247 · Derecognition.** Removal of a previously recognised asset from the statement of financial position.

**Q248 · POCI.** Purchased or originated credit-impaired financial asset.

**Q249 · SICR.** Significant increase in credit risk since initial recognition.

**Q250 · EAD.** Exposure at default — the amount expected to be outstanding when default occurs.

**Q251 · CCF.** Credit conversion factor — the proportion of an undrawn commitment expected to be drawn before default.

**Q252 · Yield integral.** The module's field recording whether a fee forms part of the lending return and belongs in the EIR.

**Q253 · Held-flat.** The module's label for a rate carried forward from the last actual fixing because no forward view was loaded. An assumption, labelled as one.

**Q254 · All-in curve.** A forecast rate series that already includes a margin, as distinct from a bare benchmark.

**Q255 · Balance checkpoint.** A periodic balance stated in an incoming file, compared against the balance the movements imply, so drift surfaces immediately.

**Q256 · Snapshot.** A complete picture of an imported deal at a point in time, retained and diffed against its predecessor.

---

# Appendix A · IFRS paragraph index

Search this when a client opens with a paragraph reference.

| Reference | Subject | Questions |
|---|---|---|
| IFRS 9 §2.1(g) | Loan commitments in scope | Q46 |
| IFRS 9 §3.2.3 – §3.2.9 | Derecognition of financial assets | Q115, Q126, Q130 |
| IFRS 9 §4.1.1 – §4.1.2A | Classification | Q3, Q12 |
| IFRS 9 §4.1.3, §B4.1.7 – §B4.1.26 | SPPI | Q4, Q5, Q6 |
| IFRS 9 §4.1.4 | FVTPL on SPPI failure | Q7 |
| IFRS 9 §5.1.1 | Initial measurement | Q8, Q9, Q36 |
| IFRS 9 §5.4.1 | Interest revenue, EIR on gross | Q91, Q131 |
| IFRS 9 §5.4.1(b) | Stage 3 interest on net | Q93, Q104 |
| IFRS 9 §5.4.3 | Modification without derecognition | Q20, Q115, Q117, Q118, Q119 |
| IFRS 9 §5.4.4 | Write-off | Q111, Q112 |
| IFRS 9 §5.4.5 – §5.4.9 | Benchmark reform (Phase 2) | Q64 |
| IFRS 9 §5.5.1 – §5.5.5 | ECL model, 12-month vs lifetime | Q75, Q93 |
| IFRS 9 §5.5.9 | SICR assessment | Q94 |
| IFRS 9 §5.5.10 | Low credit risk exemption | Q99 |
| IFRS 9 §5.5.11 | 30 days past due presumption | Q96 |
| IFRS 9 §5.5.13 – §5.5.14 | POCI | Q9, Q105, Q109 |
| IFRS 9 §5.5.17 | ECL measurement basis | Q77, Q89 |
| IFRS 9 §5.5.20 | ECL on loan commitments | Q46 |
| IFRS 9 §B3.3.6 | 10% test — **liabilities only** | Q116, Q169 |
| IFRS 9 §B5.4.1 – §B5.4.3 | Fees integral to EIR | Q15, Q29, Q30, Q32 |
| IFRS 9 §B5.4.5 | Floating-rate EIR revision | Q17 |
| IFRS 9 §B5.4.6 | Revised estimates of cash flows | Q21 |
| IFRS 9 §B5.4.7 | Credit-adjusted EIR | Q15, Q105, Q107 |
| IFRS 9 §B5.4.8 | Transaction costs | Q35 |
| IFRS 9 §B5.5.17 | SICR indicators | Q95, Q97 |
| IFRS 9 §B5.5.25 – §B5.5.27 | Modification and SICR | Q116, Q120 |
| IFRS 9 §B5.5.30 – §B5.5.31 | ECL on undrawn commitments | Q47 |
| IFRS 9 §B5.5.44, §B5.5.47 | Discounting ECL | Q89, Q90 |
| IFRS 9 Appendix A | EIR, credit-impaired, amortised cost definitions | Q10, Q13, Q103, Q107 |
| IFRS 7 §25 – §29 | Fair value disclosure | Q173 |
| IFRS 7 §35F – §35N | Credit risk disclosures | Q133 |
| IAS 1 §82(a), §82(ba) | Interest revenue and impairment line items | Q131, Q132 |
| IAS 21 | Foreign currency monetary items | Q137 |
| IFRS 15 | Service fee revenue | Q2, Q29, Q41, Q42 |
| ASC 326-20 | CECL | Q147 |
| ASC 310-20 | US GAAP loan fees | Q150 |

---

# Appendix B · Formula card

**Effective interest rate.** The rate *r* such that the present value of all expected cash flows, discounted at *r*, equals the net amount advanced — consideration paid, plus transaction costs, less integral fees received.

**Expected credit loss.**

| Stage | Measurement |
|---|---|
| Stage 1 | annual PD × LGD × balance |
| Stage 2 | min(1, annual PD × years remaining) × LGD × balance |
| Stage 3 | lifetime ECL on net carrying amount (gross − existing allowance) |
| POCI | no stages; changes in lifetime ECL since acquisition only |

**Worked example — Smokey.** £50,000,000 × 0.50% × 30% = **£75,000** at full exposure.

**Carrying amounts.** Net carrying amount = gross carrying amount − loss allowance.

**Modification.** PV change = (PV of revised flows at the **original** EIR − pre-modification carrying amount) ÷ pre-modification carrying amount.

**PIK proof.** Drawn + capitalised = principal repaid over the life. *Smokey:* £50,000,000 + £8,345,261.74 = £58,345,261.74.

---

# Appendix C · Read before every demo

| | Point | Why |
|---|---|---|
| 1 | The 10% test is **not** an IFRS 9 requirement for financial assets | Q116. The most likely place to be caught out by a technical accountant. |
| 2 | Substantial modification does not complete full derecognition and re-recognition | Q127. Do not demo a scenario that depends on it. |
| 3 | Smokey's final balloon repayment does not post | Carrying value does not reach nil. Avoid a full-life carrying value chart. |
| 4 | Smokey's PIK capitalisations do not journalise | Show PIK on the Lifecycle tab, not the journal register. |
| 5 | Hamilton has no PD or LGD stored | This is a feature of the demo — enter them live and re-run. |
| 6 | PCS does not form accounting judgements | Q167. Say this early; it is a strength, not a limitation. |
| 7 | Disclosure notes are assembled in the reporting layer | Q134. Do not promise the note itself. |
| 8 | "Let me come back to you" is an acceptable answer | Q170, Q176. |
