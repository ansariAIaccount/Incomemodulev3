/* ============================================================
   Loan Assistant Knowledge Base
   ------------------------------------------------------------
   Offline Q&A pairs covering Accounting / IFRS 9 / IFRS 13 /
   IFRS 15 / ECL / loan-module workflow. Loaded by the chat
   panel in loan-module-integration-layer.html — keyword-scored
   search returns the best 3 matches per query.

   Each entry has:
     id           — stable identifier
     q            — canonical question form
     tags         — keywords for fuzzy matching (be generous)
     answer       — 1-3 paragraph plain-English answer
     demoSteps    — array of numbered click instructions
     deal         — suggested seed instrument id (or null)
     section      — UI panel where the feature lives
     followUps    — related Q&A ids
   ============================================================ */

const FAQ_KB = [

// ─────── ACCOUNTING FUNDAMENTALS ───────

{ id:'arch-overview',
  q:'What is the architecture? Who owns what between PortF, PCS, and Workday?',
  tags:['architecture','portf','pcs','investran','workday','system','owner','ims','difference'],
  answer:'Three systems with clear ownership: <strong>PortF</strong> is the System of Record (deal capture, contractual cashflows, ratchets, drawdowns, workflows). <strong>PCS / Investran</strong> is the IFRS-aligned accounting sub-ledger (EIR, amortised cost, ECL, journals, disclosures). <strong>Workday</strong> is the General Ledger (posts batches, returns actuals). The integration layer orchestrates all three with full reconciliation back to PortF.',
  demoSteps:[
    'Open the page header. The architecture line right under the title spells this out.',
    'Show the 5 stage cards top-to-bottom: PortF Inbound → PCS Accounting → Workday Push → Workday Actuals → Reconciliation + Feedback.',
    'Mention each stage\'s role briefly — every stage has a clear owner.'
  ],
  deal:null,
  section:'Page header',
  followUps:['accounting-owns','demo-quickstart'] },

{ id:'accounting-owns',
  q:'What does the accounting system own that IMS does not?',
  tags:['accounting','owns','ims','responsibility','what','difference','vs'],
  answer:'Per the requirements: accounting owns the <strong>financial-statement representation</strong> of the loan. That covers EIR, amortised cost, fee amortisation, accounting accruals, journals, impairment reserve (ECL), and IFRS disclosures. IMS owns the commercial reality — deal terms, ratchets, drawdowns, covenant tracking, borrower monitoring. Stage 2 covers all 7 things accounting must own + all 6 fields it stores (Original EIR, Deferred fee balance, Carrying value, Accrued interest receivable, ECL reserve, Net carrying value).',
  demoSteps:[
    'Open Stage 2 KPI strip — Receivables (113000) + ECL Allowance (145000) cards prove we hold the balances.',
    'Open the Evidence Pack → Carrying Value Waterfall: opening carrying → drawdowns − repayments + EIR + OID + PIK + mod + hedge + FX → closing.',
    'Below the waterfall: the Deferred Fee Memo and ECL Memo show the 6 stored fields.'
  ],
  deal:'voltGuarantee',
  section:'Stage 2 KPIs + Evidence Pack',
  followUps:['eir-vs-coupon','ecl-formula','carrying-value'] },

{ id:'how-engine-generates-jes',
  q:'How does the engine generate journal entries?',
  tags:['journal','je','generate','accounting','dr','cr','double-entry','create','make'],
  answer:'On every Run Accounting click, the engine: (1) rebuilds the daily schedule from the current instrument state, (2) summarises the period, (3) generates balanced DR-CR pairs for each economic event (drawdowns, interest accrual, fee accrual, ECL, modification, hedge MTM), and (4) maps each transaction type to the Investran chart account. Every JE pair is balance-checked — Σ DR = Σ CR. If they go out of balance the green chip flips to red and Stage 3 push is blocked.',
  demoSteps:[
    'Pick Libra 2, run accounting → 18 JE rows produced.',
    'Open the journal table. Find pairs: Loan Drawdown DR 141000 / Loan Drawdown — Cash CR 111000.',
    'Look at the bottom-right balance chip — green "balanced" with the DR/CR totals.'
  ],
  deal:'libra2',
  section:'Stage 2 journal table',
  followUps:['why-18-jes','workday-push'] },

{ id:'why-18-jes',
  q:'Why does Libra 2 only have 18 JE entries?',
  tags:['18','je','libra','count','number','rows','expected','correct'],
  answer:'Because the engine summarises 2,559 daily schedule rows into period-end totals. Each event becomes a balanced DR-CR pair — 9 economic events × 2 sides = 18 rows: drawdowns (×2 events × 2 sides = 4), interest accrual (2), interest cash settlement (2), arrangement fee accrual (2), arrangement fee cash receipt (2), commitment fee accrual (2), commitment fee cash receipt (2), ECL impairment (2). Volt has 58 because it has more drawdowns/repayments and quarterly fee periods.',
  demoSteps:[
    'Pick Libra 2 → Run Accounting. Note "18 JE rows" in the KPI strip.',
    'Pick Volt → Run Accounting → 58 JEs. Same engine, more drawdowns + per-period fee accruals.',
    'Both deals have ~2,500-4,400 daily rows — the JE count reflects events, not days.'
  ],
  deal:'libra2',
  section:'Stage 2 KPIs',
  followUps:['daily-schedule','how-engine-generates-jes'] },

{ id:'demo-quickstart',
  q:'How do I do a quick 60-second demo of the whole pipeline?',
  tags:['quickstart','60','seconds','quick','demo','pipeline','tour','elevator'],
  answer:'Pick Libra 2 → Stage 1 button "Use Active Deal as Sample" → Stage 2 "Run Accounting" → Stage 3 "Push DIU to Workday" → Stage 4 "Synthesise Sample (with variances)" → Stage 5 "Run Reconciliation". Done — full 5-stage pipeline demoed in 60 seconds. Then click "Send Feedback to PortF" for the recon-breaks JSON.',
  demoSteps:[
    'Pick Libra 2 in the Active Deal dropdown.',
    'Stage 1 → Use Active Deal as Sample.',
    'Stage 2 → Run Accounting.',
    'Stage 3 → Push DIU to Workday.',
    'Stage 4 → Synthesise Sample (with variances).',
    'Stage 5 → Run Reconciliation → Send Feedback to PortF.'
  ],
  deal:'libra2',
  section:'All 5 stages',
  followUps:['arch-overview','demo-deal-recommendations'] },

{ id:'demo-deal-recommendations',
  q:'Which deal should I use to demo each capability?',
  tags:['deal','demo','best','recommend','volt','libra','suffolk'],
  answer:'<strong>Libra 2</strong> for depth — clean amortised cost loan with 2 IFRS 15 fees + ECL Stage 1, perfect for showing the journal mechanics. <strong>Volt</strong> for breadth — 4 fees (interest + guarantee + commitment + arrangement), 6 drawdowns, deferred fee accretion of £1.92m. <strong>Libra 3</strong> for hedge accounting (Cash Flow Hedge layered on Libra 2). <strong>Suffolk Solar</strong> for multi-tranche EIR aggregation. <strong>XYZ Buyout / ABCDEF Series C</strong> for FVTPL equity. <strong>Northwind</strong> for revolver with non-use fee.',
  demoSteps:[
    'Stakeholder = auditor / PwC: use Libra 2.',
    'Stakeholder = PortF deal team: use Volt (rich fee structure).',
    'Stakeholder = Risk: use Libra 2 + manually flip ECL Stage 1→2→3.',
    'Stakeholder = Workday team: any deal — focus is on Stage 3 output format.'
  ],
  deal:null,
  section:'Active Deal dropdown',
  followUps:['demo-quickstart'] },

// ─────── EIR ───────

{ id:'eir-vs-coupon',
  q:'What is the difference between EIR and coupon rate?',
  tags:['eir','coupon','rate','difference','effective','interest','vs','what'],
  answer:'<strong>Coupon rate</strong> is the contractual rate on the face — the interest the borrower pays in cash. <strong>EIR (Effective Interest Rate)</strong> is the IRR that NPVs all contractual cashflows including upfront fees, OID, and amendments to zero, against the carrying value. EIR is fundamentally an accounting construct (IFRS 9 §B5.4) — it ensures interest income is recognised on a level-yield basis even when fees are paid upfront. For a deal drawn at par with no upfront fees, EIR = coupon. For one with a £2m arrangement fee on £100m, EIR > coupon.',
  demoSteps:[
    'Pick Libra 2 → Run Accounting. EIR card shows "9.2500% (coupon, no amort)" — drawn at par, EIR = coupon.',
    'Pick Volt → EIR shows "5.5900%" with breakdown "SONIA 4.7500% + margin 0.8400% = 5.5900%".',
    'Volt has £1.92m of deferred fees being accreted into income via dailyEIRAccretion. See the Carrying Value Waterfall.'
  ],
  deal:'voltGuarantee',
  section:'Stage 2 IFRS detail strip',
  followUps:['eir-formula','deferred-fees'] },

{ id:'eir-formula',
  q:'How is EIR calculated?',
  tags:['eir','formula','calculate','calculation','irr','yield','solve','compute'],
  answer:'EIR is the discount rate that solves: PV(all expected cashflows from the asset) = Carrying value at recognition. The engine handles 5 coupon families: Fixed (uses coupon.fixedRate), legacy Floating (floatingRate + spread), RFR-driven SONIA/SOFR/EURIBOR/etc (rfr.baseRate + marginSchedule + ESG adjustments), multi-tranche (face-weighted across child tranches), and multi-underlying guarantee (face-weighted across underlyings).',
  demoSteps:[
    'Switch through 4 deals: Alliance (Fixed 12%), Volt (SONIA + 84bps = 5.59%), Libra 2 (SONIA + 450bps = 9.25%), Suffolk Solar (multi-tranche 7.375%).',
    'For each, the EIR breakdown line shows the composition.',
    'For RFR deals, the engine reads rfr.baseRate AND finds the current period in marginSchedule.'
  ],
  deal:'libra2',
  section:'Stage 2 EIR card',
  followUps:['eir-vs-coupon','eir-recompute-on-mod','sonia-rfr'] },

{ id:'sonia-rfr',
  q:'How does the engine handle SONIA / SOFR / RFR-based interest?',
  tags:['sonia','sofr','rfr','floating','margin','schedule','ratchet','base'],
  answer:'For RFR families (SONIA / SOFR / ESTR / EURIBOR / FED / TONA), the engine reads <code>rfr.baseRate</code> for the index level (e.g. 4.75% SONIA) and finds the current period in <code>marginSchedule[]</code> for the contractual margin (e.g. 84 bps). All-in rate = base + margin. ESG adjustments and ratchets are applied on top. For a deal where margin steps up at anniversary, the daily Rate column in the schedule shows the rate stepping at each window boundary.',
  demoSteps:[
    'Pick Libra 2. EIR breakdown reads "SONIA 4.7500% + margin 4.5000% = 9.2500%".',
    'Open "View daily schedule" → "All days" → scan the Rate column. It steps up at 1y / 2y anniversaries per the margin schedule.',
    'Volt has a fixed +84 bps margin (no schedule).'
  ],
  deal:'libra2',
  section:'Stage 2 EIR + Daily Schedule',
  followUps:['eir-formula','rate-resets'] },

{ id:'eir-recompute-on-mod',
  q:'When is EIR re-computed?',
  tags:['eir','recompute','recalculate','modification','substantial','change','reset','update'],
  answer:'Per IFRS 9 §5.4.3: when a contract is <strong>substantially modified</strong> (≥10% PV change by default), the original asset is derecognised and a new instrument is recognised — meaning a <strong>new EIR</strong> from the modification date forward. For non-substantial mods, the original EIR is kept, and the carrying value is adjusted with a P&L gain/loss. The Treatment panel exposes "Re-compute EIR on substantial modification" as a yes/no policy.',
  demoSteps:[
    'Treatment panel → Modification Policy section. "Re-compute EIR on substantial mod" defaults to Yes.',
    'Below it, click "+ Substantial mod" → injects an event at mid-life with a +75bps spread bump.',
    'Engine re-runs. Modification History panel in Evidence Pack shows EIR before/after table.'
  ],
  deal:'libra2',
  section:'Treatment panel + Modification History',
  followUps:['modification','eir-formula'] },

// ─────── ECL ───────

{ id:'ecl-formula',
  q:'How is ECL calculated? What is the formula?',
  tags:['ecl','formula','calculate','expected','credit','loss','pd','lgd','ead','compute'],
  answer:'ECL = PD × LGD × EAD × stage_curve × macro_overlay, then discounted at the original EIR. PD (probability of default) and LGD (loss given default) come from Risk. EAD = drawn balance + undrawn × CCF (credit conversion factor). Stage 1 uses 12-month PD; Stage 2 / 3 use lifetime. Macro overlay is the forward-looking adjustment (default 1.0 = neutral). The engine posts gross EL; the new ECL Calculation Trace panel in the Evidence Pack shows the discounted PV side-by-side with the actual posting.',
  demoSteps:[
    'Pick Libra 2 → Run Accounting.',
    'Open Evidence Pack → "IFRS 9 ECL Calculation Trace".',
    'Walk the table top-to-bottom: PD 0.5% × LGD 40% × EAD £25m × stage 1.0 × overlay 1.0 = EL £50,000. Discount factor 0.7336 → Discounted PV £36,680. Actual posted £50,000.',
    'The variance row explains the engine posts gross EL (discounting is for IFRS 13 disclosure only).'
  ],
  deal:'libra2',
  section:'Evidence Pack → ECL Calculation Trace',
  followUps:['ecl-stage','dpd-trigger','covenant-breach'] },

{ id:'ecl-stage',
  q:'What is the difference between Stage 1, 2, 3 ECL?',
  tags:['ecl','stage','1','2','3','difference','migration','sicr','12-month','lifetime'],
  answer:'<strong>Stage 1</strong> — performing assets with no significant increase in credit risk; book 12-month ECL. <strong>Stage 2</strong> — Significant Increase in Credit Risk (SICR) triggered; book lifetime ECL but interest still accrued on gross. <strong>Stage 3</strong> — credit-impaired (default observed); book lifetime ECL AND interest accrues on net of allowance. POCI is a fourth category — Purchased or Originated Credit Impaired — with EIR computed on initial fair value.',
  demoSteps:[
    'Pick Libra 2 → Run Accounting (Stage 1 default, ECL ≈ £42,500).',
    'Treatment panel → "ECL Stage" dropdown → change to Stage 2. Auto re-run. ECL jumps to ~£185k.',
    'Change to Stage 3. Treatment panel "Stage 3 interest base" lets you flip Gross / Net of allowance.',
    'Evidence Pack → ECL Templates panel shows the canonical JE pattern for each stage transition.'
  ],
  deal:'libra2',
  section:'Treatment panel + ECL Templates',
  followUps:['sicr','dpd-trigger','poci'] },

{ id:'sicr',
  q:'What triggers SICR? How does Stage 1 → 2 migration work?',
  tags:['sicr','significant','increase','credit','risk','stage','1','2','migration','trigger'],
  answer:'SICR = Significant Increase in Credit Risk, the trigger for moving from Stage 1 (12-month ECL) to Stage 2 (lifetime ECL). The engine has 4 SICR triggers, hierarchy: (1) Watchlist override forces Stage 2 manually, (2) DPD ≥ Stage 3 threshold forces Stage 3, (3) DPD ≥ Stage 2 threshold forces Stage 2, (4) Covenant breach forces Stage 2 if currently Stage 1. When auto-migration fires, an amber banner shows the reason.',
  demoSteps:[
    'Treatment panel → set "Current DPD" to 45 → tab out.',
    'Amber banner appears: "ECL Stage auto-migrated 1 → 2. DPD 45 ≥ Stage 2 threshold (30) — SICR." ECL allowance jumps.',
    'Reset DPD to 0, set "Covenant breach status" to Yes → migrates again with reason "Covenant breach flagged — SICR (qualitative trigger)".',
    'Try DPD = 120 → migrates to Stage 3 (≥ 90 day threshold).'
  ],
  deal:'libra2',
  section:'Treatment panel auto-migration banner',
  followUps:['ecl-stage','dpd-trigger','covenant-breach'] },

{ id:'dpd-trigger',
  q:'How does DPD (days past due) affect ECL Stage?',
  tags:['dpd','days','past','due','threshold','stage','migration','delinquency'],
  answer:'IFRS 9 §B5.5.20 establishes the 30-day rebuttable presumption — if a borrower is 30+ days past due, presume SICR has happened (move to Stage 2). Default is also presumed at 90 days past due (Stage 3). Both thresholds are configurable per deal in the Treatment panel. The Current DPD field on the deal flows daily from the IMS / PortF feed; the engine auto-migrates Stage when the threshold is crossed.',
  demoSteps:[
    'Treatment panel: "DPD trigger Stage 1 → 2" defaults to 30, "Stage 2 → 3" defaults to 90 (rebuttable).',
    '"Current DPD" lets you simulate the IMS feed.',
    'Type Current DPD = 35 → auto-migrates to Stage 2 with reason banner.',
    'Type 95 → migrates to Stage 3.'
  ],
  deal:'libra2',
  section:'Treatment panel',
  followUps:['sicr','ecl-stage','covenant-breach'] },

{ id:'covenant-breach',
  q:'How does a covenant breach affect ECL?',
  tags:['covenant','breach','sicr','qualitative','watchlist','trigger','stage'],
  answer:'A covenant breach is a qualitative SICR trigger — when set to Yes on the Treatment panel, the engine auto-migrates ECL Stage from 1 to 2. DPD-based triggers take priority (quantitative beats qualitative). Note that breach status comes from the IMS feed; PCS just consumes it. The Modification Policy section also lets you log the resulting amendment as a modificationEvent if the breach is cured by a waiver/restructure.',
  demoSteps:[
    'Pick Libra 2 → Run Accounting (Stage 1).',
    'Treatment panel → "Covenant breach status" → Yes — triggers SICR (Stage 1 → 2).',
    'Engine auto-runs. Banner: "ECL Stage auto-migrated 1 → 2. Covenant breach flagged — SICR (qualitative trigger)."',
    'ECL allowance jumps from £42,500 to ~£185,000.'
  ],
  deal:'libra2',
  section:'Treatment panel auto-migration',
  followUps:['sicr','dpd-trigger','modification'] },

{ id:'poci',
  q:'What is POCI?',
  tags:['poci','purchased','originated','credit','impaired','poci','distressed','lifetime'],
  answer:'POCI = Purchased or Originated Credit-Impaired. Special IFRS 9 category for assets that were credit-impaired at recognition (e.g. distressed-debt purchases). EIR is computed on the initial fair value (not face), embedding the lifetime expected credit loss into the yield. ECL allowance is then booked only on subsequent <em>changes</em> in lifetime ECL, not the original.',
  demoSteps:[
    'Treatment panel → Credit Risk & ECL Detail section → "POCI flag" → Yes.',
    'EIR card now uses the credit-adjusted EIR (lower than coupon) when computeEIR() runs.',
    'ECL Templates panel in the Evidence Pack covers POCI-specific entries.'
  ],
  deal:'libra2',
  section:'Treatment panel POCI flag',
  followUps:['ecl-stage','eir-formula'] },

{ id:'ecl-discount',
  q:'Does the engine discount ECL using the original EIR?',
  tags:['ecl','discount','eir','present','value','pv','discounted'],
  answer:'The engine posts <strong>gross expected loss</strong> as the ECL allowance. The new ECL Calculation Trace panel in the Evidence Pack shows the explicit discount step (PV = EL / (1+EIR)^remaining_life) for IFRS 13 §93 disclosure. If you want the engine to post the discounted figure rather than the gross, that\'s a one-line change in <code>buildSchedule()</code>. Auditors typically want both — the gross to stress-test, the PV for the impairment posting.',
  demoSteps:[
    'Open Evidence Pack → "IFRS 9 ECL Calculation Trace".',
    'Read the table: EL = £50,000. Discount factor 0.7336 (mid-life). Discounted PV = £36,680. Actual posted = £50,000.',
    'The variance row explains the engine posts gross — the discount column is disclosure.'
  ],
  deal:'libra2',
  section:'Evidence Pack → ECL Calculation Trace',
  followUps:['ecl-formula','eir-vs-coupon'] },

{ id:'macro-overlay',
  q:'What is the macro overlay weight?',
  tags:['macro','overlay','weight','probability','forward','scenario','adjustment','pessimistic','optimistic'],
  answer:'The forward-looking adjustment per IFRS 9 §B5.5.4. Default 1.0 = neutral. 1.20 = pessimistic (e.g. recession-weighted), 0.80 = optimistic. Multiplies the base PD × LGD × EAD result. Used to incorporate macro scenarios that aren\'t fully captured in the borrower-specific PD.',
  demoSteps:[
    'Treatment panel → "Macro overlay weight" — default 1.00.',
    'Set to 1.20 → ECL allowance scales up 20%.',
    'Set to 0.80 → scales down 20%.',
    'The Evidence Pack ECL Trace shows the multiplicand explicitly in the formula trace.'
  ],
  deal:'libra2',
  section:'Treatment panel + ECL Trace',
  followUps:['ecl-formula','ecl-stage'] },

// ─────── IFRS 9 OTHER ───────

{ id:'sppi',
  q:'What is the SPPI test?',
  tags:['sppi','test','solely','payments','principal','interest','classification','§4.1.2'],
  answer:'SPPI = Solely Payments of Principal and Interest. The IFRS 9 §4.1.2 cashflow test. If a deal\'s contractual cashflows are NOT solely P&I (e.g. revenue-linked, payment-in-kind with leverage, equity-like features), the deal fails SPPI and is forced to FVTPL regardless of business model. The Treatment panel exposes "SPPI test" as a passes/fails dropdown.',
  demoSteps:[
    'Pick Libra 2 → Treatment panel → "SPPI test" defaults to "Passes — interest is solely P&I".',
    'Change to "Fails" → engine forces classification to FVTPL.',
    'Capability Card "Initial recognition" updates to show the SPPI status with the classification.',
    'Reset to passes.'
  ],
  deal:'libra2',
  section:'Treatment panel',
  followUps:['classification','business-model'] },

{ id:'classification',
  q:'What is the difference between AmortisedCost, FVOCI, and FVTPL?',
  tags:['amortised','cost','fvoci','fvtpl','classification','difference','what','vs'],
  answer:'<strong>AmortisedCost</strong> — held to collect contractual cashflows; SPPI passes; held at amortised cost on B/S. Most NWF loans fall here. <strong>FVOCI</strong> — held to collect AND sell; SPPI passes; held at fair value, with unrealised gains/losses through OCI. <strong>FVTPL</strong> — anything else (failed SPPI, traded business model, designated at FVTPL); held at fair value, all changes through P&L. Classification is set in the Treatment panel.',
  demoSteps:[
    'Treatment panel → "IFRS 9 Classification" dropdown.',
    'Default for most deals: AmortisedCost.',
    'Switch to FVOCI → engine routes hedge effectiveness through OCI.',
    'Switch to FVTPL → all MTM goes through P&L. FV Sensitivities panel becomes mandatory disclosure.'
  ],
  deal:'libra2',
  section:'Treatment panel + Capability Cards',
  followUps:['sppi','business-model','fv-level'] },

{ id:'business-model',
  q:'What is the business model test?',
  tags:['business','model','test','hold','collect','sell','classification','test'],
  answer:'The IFRS 9 §4.1.1 business-model test. Determines classification together with SPPI. Three options: <strong>HoldToCollect</strong> (collect contractual cashflows only — drives AmortisedCost), <strong>HoldToCollectAndSell</strong> (mix of holding + selling — drives FVOCI), <strong>Other</strong> (e.g. trading — drives FVTPL).',
  demoSteps:[
    'Treatment panel → "Business model" dropdown.',
    'Most NWF deals: HoldToCollect.',
    'For an FVOCI deal, switch to HoldToCollectAndSell → classification card updates.'
  ],
  deal:'libra2',
  section:'Treatment panel',
  followUps:['classification','sppi'] },

{ id:'modification',
  q:'How does modification accounting work? Substantial vs non-substantial?',
  tags:['modification','mod','§5.4.3','substantial','non-substantial','derecognise','gain','loss'],
  answer:'IFRS 9 §5.4.3. <strong>Substantial modification</strong> (≥10% PV change at original EIR by default — the threshold is policy-configurable): derecognise the original asset, recognise a new instrument with a NEW EIR from mod date forward. Booking is to 442000 Modification G/L. <strong>Non-substantial</strong>: keep the original EIR, adjust the carrying value with a P&L gain or loss for the PV difference, post to 442000.',
  demoSteps:[
    'Treatment panel → Modification Policy section → "Substantial-mod PV threshold" defaults to 0.10 (10%).',
    'Below the policy controls: "+ Non-substantial mod" injects a £10k gain mid-life.',
    'Engine re-runs, JE pair appears: DR 442000 / CR Loan asset (or vice versa for loss).',
    'Modification History panel logs the run with EIR before/after table.'
  ],
  deal:'libra2',
  section:'Treatment panel + Modification History',
  followUps:['eir-recompute-on-mod','covenant-breach','mod-edit'] },

{ id:'mod-edit',
  q:'Can I edit the gain/loss or reason of modification events?',
  tags:['modification','edit','update','change','gain','loss','reason','date'],
  answer:'Yes — every cell in the modification events list is inline editable. Click in the Date / Type / Gain-Loss / Reason field, change it, tab out → engine re-runs immediately. The chip flips to "1 event · edited" and the run logs as treatment-overridden in Modification History.',
  demoSteps:[
    'Treatment panel → "+ Non-substantial mod" → row appears with default values.',
    'Click in the Gain/Loss cell, change to -25000 → tab out.',
    'Click in the Reason cell, type "Forbearance during Q3 covenant breach" → tab out.',
    'Engine re-runs. Modification History panel logs the new run flagged "override".'
  ],
  deal:'libra2',
  section:'Treatment panel modification events table',
  followUps:['modification','eir-recompute-on-mod'] },

{ id:'hedge-cfh-fvh',
  q:'How does hedge accounting work? CFH vs FVH?',
  tags:['hedge','cfh','fvh','cash flow','fair value','§6','accounting','derivative','mtm','effective','ineffective'],
  answer:'IFRS 9 §6. <strong>Cash Flow Hedge (CFH)</strong>: hedging variability of expected future cashflows. Effective portion goes to OCI (360000), reclassified to P&L when hedged item affects earnings. Ineffective portion goes straight to P&L (451000). <strong>Fair Value Hedge (FVH)</strong>: hedging fair value risk. Both the derivative MTM and the hedged item\'s FV change post to P&L (452000) — they should offset within effectiveness bounds. The engine has both via Libra 3 (CFH layered on Libra 2).',
  demoSteps:[
    'Pick Libra 3 → Run Accounting.',
    'JE rows include: DR/CR 146000 Derivative Assets / 360000 Cash Flow Hedge Reserve (OCI) for effective portion.',
    'And 451000 Hedge Ineffectiveness P&L for the ineffective portion.',
    'Capability card "Hedge accounting" lights green for Libra 3.'
  ],
  deal:'libra3',
  section:'Stage 2 journals + Capability Cards',
  followUps:['classification','modification'] },

// ─────── IFRS 13 ───────

{ id:'fv-level',
  q:'What is the Fair Value hierarchy? Level 1 vs 2 vs 3?',
  tags:['fv','fair value','hierarchy','level','1','2','3','ifrs','13','§72','difference'],
  answer:'IFRS 13 §72 hierarchy of inputs to fair value. <strong>Level 1</strong>: quoted prices in active markets for identical assets (most reliable). <strong>Level 2</strong>: observable inputs other than quoted prices — e.g. yield curves, comparable transactions, observable spreads. <strong>Level 3</strong>: unobservable inputs — DCF / model-based pricing where you can\'t observe key inputs (private credit typically here). §93(d) requires sensitivity to each significant unobservable input for Level 3.',
  demoSteps:[
    'Treatment panel → "Fair Value Level" dropdown.',
    'Switch to Level 1 → Sensitivities panel shows price-volatility shocks (±10/±25%).',
    'Switch to Level 2 → ±50/±100 bps rate shocks + ±50 bps spread shocks + observable inputs disclosure.',
    'Switch to Level 3 → ±150 bps stress + ±200 bps illiquidity premium + recovery rate + significant unobservable inputs (PD, LGD live).'
  ],
  deal:'libra2',
  section:'Treatment panel + Evidence Pack FV Sensitivities',
  followUps:['fv-sensitivities','classification','ifrs-7-25'] },

{ id:'fv-sensitivities',
  q:'How are FV sensitivities computed?',
  tags:['fv','sensitivity','sensitivities','duration','approximation','rate','spread','shock'],
  answer:'Linear modified-duration approximation: ΔFV ≈ −Modified Duration × Δyield × Carrying. Modified Duration ≈ life × 0.6 as a heuristic for bullet loans. The shock set differs by FV Level: Level 1 = price shocks (no rate sensitivity needed — price is observable). Level 2 = standard ±50/±100 bps rate + ±50 bps spread. Level 3 = bigger stress shocks (±150 bps rate, ±100 bps spread, ±200 bps illiquidity premium, ±5% recovery rate).',
  demoSteps:[
    'Run Accounting on Libra 2.',
    'Treatment panel → set FV Level to Level 2 → engine re-runs.',
    'Open Evidence Pack → "Fair Value Sensitivities (IFRS 13 §93)".',
    'Read the 6-shock table + the "Key inputs disclosure" beneath (yield curve / spread / FX rate sources).'
  ],
  deal:'libra2',
  section:'Evidence Pack → FV Sensitivities',
  followUps:['fv-level','ifrs-7-25'] },

{ id:'ifrs-7-25',
  q:'What is IFRS 7 §25? Why does it apply to amortised-cost deals?',
  tags:['ifrs','7','§25','disclosure','amortised','cost','fair value','note','amortised'],
  answer:'IFRS 7 §25 requires entities to disclose the fair value of every class of financial asset and liability in such a way that it can be compared to its carrying amount. Even though amortised-cost assets aren\'t held at FV on the balance sheet, the FV must be disclosed in the notes — with the same Level tagging that on-balance-sheet FV deals carry. So setting FV Level on a Libra 2 (AmortisedCost) flows into the disclosure note, not the balance sheet.',
  demoSteps:[
    'Pick Libra 2 (AmortisedCost) → Treatment panel → set FV Level to Level 2.',
    'Stage 2 IFRS detail strip → FV field reads "Disclosure-only · Level 2".',
    'Note line below: "Amortised cost on balance sheet · IFRS 7 §25 FV note tagged Level 2".',
    'Capability Card "Fair value: hierarchy, sensitivities" lights green with the same level.'
  ],
  deal:'libra2',
  section:'Stage 2 FV display + Capability Cards',
  followUps:['fv-level','classification'] },

// ─────── IFRS 15 ───────

{ id:'fee-treatment',
  q:'How are fees treated? IFRS 9 EIR vs IFRS 15 over-time vs point-in-time?',
  tags:['fee','treatment','ifrs','9','15','eir','over time','point in time','difference','arrangement','commitment'],
  answer:'<strong>IFRS 9 §B5.4 EIR</strong>: directly attributable origination fees go INTO the EIR — capitalised into yield, recognised over the life of the asset. Default for arrangement / origination fees. <strong>IFRS 15 over-time</strong>: service-based fees recognised as the service is provided over time. Default for commitment / guarantee / management fees. <strong>IFRS 15 point-in-time</strong>: fees for one-off services. Default for dividend equity, restructuring fees. Each fee in the Treatment panel has its own dropdown to override.',
  demoSteps:[
    'Pick Volt → Run Accounting.',
    'Open Stage 2 "View fee specifications + engine-computed totals" — 2 fees with their IFRS treatment chips.',
    'Treatment panel → Per-fee IFRS 15 treatment section → toggle Volt Guarantee Fee from "IFRS 15 over time" to "IFRS 9 EIR".',
    'Engine re-runs. Fee now routes to 421000 Investment Interest Income (capitalised) instead of 492300 Guarantee Fee Income.'
  ],
  deal:'voltGuarantee',
  section:'Treatment panel + Fee Specifications',
  followUps:['fee-gl-routing','deferred-fees'] },

{ id:'fee-gl-routing',
  q:'Which GL account does each fee type go to?',
  tags:['fee','gl','account','route','arrangement','commitment','guarantee','management','dividend','492100','492200','492300','492400','492500'],
  answer:'Per-fee dedicated accounts in the Investran chart: <strong>492100</strong> Arrangement Fee Income (one-off, IFRS 15 point-in-time or IFRS 9 EIR-included), <strong>492200</strong> Commitment Fee Income (IFRS 15 over time, on undrawn), <strong>492300</strong> Guarantee Fee Income (IFRS 15 over time, on covered tranche), <strong>492400</strong> Management Fee Income (split investment-period vs post-investment), <strong>492500</strong> Dividend Income Equity (IFRS 15 point-in-time). EIR-capitalised fees route to <strong>421000</strong> Investment Interest Income (rolled into yield).',
  demoSteps:[
    'Pick Volt → Run Accounting.',
    'Journal table → look for transaction types: "Guarantee Fee Income (IFRS 15)" → 492300; "NWF Commitment Fee Income (IFRS 15)" → 492200.',
    'For Libra 2: "Arrangement Fee Income (IFRS 15)" → 492100.',
    'Pick ABCDEF Series C → "Dividend Income (IFRS 15)" → 492500.'
  ],
  deal:'voltGuarantee',
  section:'Stage 2 journal table',
  followUps:['fee-treatment','gl-coverage'] },

{ id:'deferred-fees',
  q:'What is a deferred fee balance?',
  tags:['deferred','fee','balance','amortisation','eir','accretion','§b5.4','remaining'],
  answer:'When a fee is "directly attributable" (IFRS 9 §B5.4), it goes into the EIR — paid as cash on day 1 but recognised as income over the asset\'s life. The unrecognised portion is the <strong>deferred fee balance</strong>. For Volt with a £1.92m arrangement fee at signing: day-1 carrying value = −£1.92m (the fee is held as a contra to the asset). The engine accretes it to income via dailyEIRAccretion. By maturity, deferred remaining = £0.',
  demoSteps:[
    'Pick Volt → Run Accounting.',
    'Open Evidence Pack → Carrying Value Waterfall.',
    'See the "− Deferred fees at recognition (IFRS 9 EIR)" line: −£1,919,562.',
    'Below the waterfall, the new "Memo — Deferred Fee Balance" block shows: Original £1,919,562 − Accretion to date £1,920,438 = Remaining £0 (fully amortised).'
  ],
  deal:'voltGuarantee',
  section:'Evidence Pack → Carrying Waterfall',
  followUps:['carrying-value','fee-treatment','eir-vs-coupon'] },

// ─────── CARRYING VALUE / WATERFALL ───────

{ id:'carrying-value',
  q:'What is carrying value? How is it tracked?',
  tags:['carrying','value','amortised','cost','book','balance','waterfall'],
  answer:'Per IAS 1 §54, carrying value is the asset\'s book value on the balance sheet. For amortised-cost assets, it\'s opening recognition (price/face) ± all subsequent EIR accretion, OID amortisation, PIK capitalisation, modification gains/losses, hedge P&L, FX. ECL allowance is presented separately as a contra-asset (memo). The Carrying Value Waterfall in the Evidence Pack itemises every movement from opening to closing.',
  demoSteps:[
    'Pick Volt → Run Accounting.',
    'Evidence Pack → "Subsequent Measurement — Carrying Value Waterfall".',
    'Read each line: Opening principal balance £0 → − Deferred fees £1.92m → = Opening carrying (gross) −£1.92m → + Drawdowns £800m − Repayments £755m + EIR accretion £1.92m → = Closing carrying value (gross) £44.4m.',
    'Memo block below: Closing gross £44.4m − ECL allowance £70k = Net carrying £44.37m.'
  ],
  deal:'voltGuarantee',
  section:'Evidence Pack → Carrying Value Waterfall',
  followUps:['deferred-fees','ecl-formula','net-carrying'] },

{ id:'net-carrying',
  q:'What is net carrying value?',
  tags:['net','carrying','value','allowance','contra','asset','presentation'],
  answer:'Net carrying value = Gross carrying value − ECL allowance. Per IFRS 9 §5.5 the allowance is presented as a separate contra-asset, so the balance sheet shows: Loan asset (gross) at line A, less Loan loss allowance at line B, equals Net loans at line C. The Carrying Value Waterfall in the Evidence Pack shows this explicitly in the ECL memo block under the waterfall.',
  demoSteps:[
    'Pick Volt → Run Accounting.',
    'Open Evidence Pack → Carrying Value Waterfall.',
    'Memo block: "Closing carrying value (gross) £44,444,883 − ECL allowance (£70,000) = Net carrying value £44,374,883".'
  ],
  deal:'voltGuarantee',
  section:'Evidence Pack',
  followUps:['carrying-value','ecl-formula'] },

// ─────── DEMO MECHANICS ───────

{ id:'pik-toggle',
  q:'How do I demo PIK (payment in kind)?',
  tags:['pik','payment in kind','toggle','enable','rate','capitalisation','frequency'],
  answer:'PIK is contractual data — interest that capitalises into the loan balance instead of paying cash. The Treatment panel\'s "PIK Interest (contractual override)" section lets you toggle PIK on/off, set the rate, and pick capitalisation frequency. When enabled, daily PIK accrues on the drawn balance and capitalises into 141000 Investments at Cost on the chosen frequency.',
  demoSteps:[
    'Pick Libra 2 → Run Accounting (PIK off by default; Total PIK life = £0).',
    'Treatment panel → "PIK Interest" section → enable PIK, rate 0.03 (3%), Quarterly frequency.',
    'Tab out → engine re-runs. Total PIK (life) jumps to £4.47m. Total Interest also rises (PIK accrues on growing balance).',
    'Daily Schedule view → "Daily PIK" + "PIK Capit." columns now show non-zero values.',
    'New JE rows: "Investment accretion - PIK interest" → 141000.',
    'Reset PIK → engine reverts.'
  ],
  deal:'libra2',
  section:'Treatment panel PIK section',
  followUps:['demo-deal-recommendations','daily-schedule'] },

{ id:'daily-schedule',
  q:'How do I view the daily schedule? What columns are exported?',
  tags:['daily','schedule','view','columns','csv','json','download','export','47','filter'],
  answer:'Stage 2 → "View daily schedule" expand. Three filter modes: "Material events only" (default — drawdowns, fees, capitalisations, PIK, ECL movements), "All days", "Month-end days only". Preview shows 17 columns: Date, Balance, Drawn, Draw, Repay, Rate, Daily Interest, Daily PIK, PIK Capit., Daily Fees, EIR Accret., Carrying, ECL Alw., ECL Δ, Mod G/L, FX, Hedge P&L. Download Full CSV exports all 47 engine fields.',
  demoSteps:[
    'Run Accounting on Libra 2.',
    'Expand "View daily schedule" — defaults to material events, ~631 of 2,559 rows.',
    'Switch filter to "All days" → 2,559 rows.',
    'Switch to "Month-end days only" → ~84 rows.',
    'Click "Download Full CSV" → schedule-libra2-2026-05-09.csv with all 47 columns.'
  ],
  deal:'libra2',
  section:'Stage 2 Daily Schedule view',
  followUps:['why-18-jes','how-engine-generates-jes'] },

{ id:'rate-resets',
  q:'How are rate resets handled?',
  tags:['rate','reset','margin','schedule','ratchet','esg','sonia','floating'],
  answer:'For RFR deals (SONIA/SOFR/etc), the engine reads marginSchedule[] for windowed margin steps and applies them per day. ESG-linked ratchets adjust the spread by configurable bps when sustainability KPIs hit. Modification events can also reset spread mid-life. The Daily Schedule\'s currentRate column shows the resolved rate per day — easy way to verify resets are being applied.',
  demoSteps:[
    'Pick Libra 2 → Run Accounting.',
    'Open "View daily schedule" → "All days".',
    'Scan the Rate column. Note where rate changes (margin step at 1y / 2y anniversary).',
    'For modification-triggered reset: inject "+ Substantial mod" → rate steps from mod date forward.'
  ],
  deal:'libra2',
  section:'Stage 2 Daily Schedule',
  followUps:['sonia-rfr','modification'] },

// ─────── WORKFLOW / OUTPUT ───────

{ id:'workday-push',
  q:'How does the Workday GL push work?',
  tags:['workday','push','diu','gl','batch','external','key','idempotent','retry'],
  answer:'Stage 3 wraps the journals into a FIS Investran DIU batch envelope. Each batch carries: deterministic externalKey (lmil-{deal}-{period}-{rowsHash}), batchId, balanced check (Σ DR = Σ CR), template metadata. Workday treats matching externalKeys as idempotent — re-posting the same batch is a no-op rather than a duplicate. Retries are safe.',
  demoSteps:[
    'After Run Accounting (Stage 2), Stage 3 enables.',
    'Click "Push DIU to Workday".',
    'See: Batch ID (WD-20260509-LIBRA2-XXXX), externalKey (lmil-libra2-...), Rows (18), Balance £39.4m / £39.4m green chip.',
    'Click "Download CSV" for the slim Workday CSV. Or "Filled DIU XLSX" for the 2-tab deliverable.'
  ],
  deal:'libra2',
  section:'Stage 3',
  followUps:['diu-output','external-key'] },

{ id:'diu-output',
  q:'What is in the Filled DIU XLSX?',
  tags:['diu','xlsx','output','tab','gl','portfolio','position','column','allocation','le domain'],
  answer:'Two tabs. <strong>GL tab</strong> (25 columns) — every JE row with effectiveDate, glDate (= effectiveDate by default in AUTO mode), transactionType, account, glAccountName, amounts (rounded to 2dp), allocationRule = "No Allocation", leDomain = "NWF", deal, issuer (= deal), Security (= position renamed), incomeSecurity, batchId, etc. <strong>PortfolioPosition tab</strong> (15 columns) matches the DIU Sec master template: Legal Entity ID, Legal Entity, Legal Entity Domain, Deal, Deal Type, Issuer, Issuer Linked Organization, Security, Security Type, etc.',
  demoSteps:[
    'After Run Accounting → Stage 2 → click "Filled DIU XLSX".',
    'Open the downloaded file. Two tabs.',
    'GL tab: 18-58 rows depending on deal, all unicode sanitised, money rounded to 2dp.',
    'PortfolioPosition tab: 1 row per security (multi-tranche/multi-underlying expand into multiple rows).'
  ],
  deal:'voltGuarantee',
  section:'Stage 2 → Filled DIU XLSX',
  followUps:['workday-push','external-key','gl-coverage'] },

{ id:'external-key',
  q:'What is the externalKey and why does it matter?',
  tags:['external','key','idempotent','retry','duplicate','batch','workday','deterministic'],
  answer:'A deterministic hash that lets Workday treat re-posts of identical batches as idempotent. Format: <code>lmil-{deal-id}-{period}-{rowsHash}</code>. The rows hash is djb2 over date|transactionType|amount|account for every row. Two identical batches = same key. Any change to the journals = different key = treated as a new batch. Retries after a network failure are safe.',
  demoSteps:[
    'Stage 3 → Push DIU to Workday → externalKey shown.',
    'Run Accounting again with no changes → same externalKey (deterministic).',
    'Toggle PIK on → re-push → different externalKey (rowsHash changed).'
  ],
  deal:'libra2',
  section:'Stage 3',
  followUps:['workday-push','diu-output'] },

{ id:'gl-coverage',
  q:'Are there any GL gaps? What does the coverage chip mean?',
  tags:['gl','coverage','gap','chip','green','amber','investran','chart','transaction','type'],
  answer:'After NewReport(4) updates, 218 of 220 generated JE rows across all 13 seed instruments map to dedicated Investran transaction types. Only 2 entries flag — both Non-Use Fee Receivable on the Northwind revolver (DR-side falls back to "Other receivable" because Investran chart doesn\'t have a dedicated transtype yet). The coverage chip below the journal table reads green when 100% clean, amber when one or more transtypes fall back to placeholders.',
  demoSteps:[
    'Pick Libra 2 → Run Accounting → coverage chip "All N transaction types map cleanly".',
    'Pick Northwind → Run Accounting → coverage chip "X clean · 2 gaps".',
    'See gl-account-gaps.md for the full inventory and ask-list to Investran admins.'
  ],
  deal:'libra2',
  section:'Stage 2 below journal table',
  followUps:['diu-output'] },

{ id:'reconciliation',
  q:'How does reconciliation work?',
  tags:['reconciliation','recon','tied','break','within','tolerance','workday','actual','feedback'],
  answer:'Stage 5 compares PCS-expected cash legs against Workday actual settlements line by line. Three buckets: <strong>tied</strong> (Δ within £1 absolute tolerance), <strong>within</strong> (Δ ≤ 0.5% break threshold), <strong>break</strong> (Δ > 0.5% OR row missing OR status CANCELLED/FAILED). Stage 5 generates the PortF feedback JSON automatically — even a clean recon sends a "RECONCILED" confirmation.',
  demoSteps:[
    'Run accounting → Push to Workday → Stage 4 "Synthesise Sample (with variances)".',
    'Stage 5 → Run Reconciliation.',
    'KPI strip: 3 tied / 0 within / 2 breaks / Total |Δ| £437.5k / Net variance −£500.',
    'Recon table shows each line with PCS Expected / Workday Actual / Δ / status chip / reason.',
    'Click "Send Feedback to PortF" → portf-feedback-{deal}-{date}.json downloads.'
  ],
  deal:'libra2',
  section:'Stages 4 + 5',
  followUps:['multi-period-recon','feedback'] },

{ id:'multi-period-recon',
  q:'Can I run reconciliation for multiple periods?',
  tags:['multiple','periods','batch','quarterly','monthly','close','periodic','q1','q2','recon'],
  answer:'Yes — Stage 4 maintains a list of actuals batches (one per period), and Stage 5 reconciles per batch. Each batch has its own period, batch ID, source, recon status. Click a batch row in Stage 4 to switch view in Stage 5. PortF feedback is sent per batch. So a deal can have Q1 2026, Q2 2026, Q3 2026 batches all in one session.',
  demoSteps:[
    'Stage 4 → Synthesise Sample → first batch B1 added.',
    'Synthesise again → B2 added (re-uses Volt for demo).',
    'Click B1 row → Stage 5 view switches to B1\'s recon.',
    'Click B2 row → Stage 5 switches.',
    'Each batch has its own recon chip (tied/breaks count) in the batch list.'
  ],
  deal:'libra2',
  section:'Stages 4 + 5',
  followUps:['reconciliation','session-save'] },

{ id:'session-save',
  q:'Can I save and resume a session?',
  tags:['save','session','load','resume','localStorage','export','import','json'],
  answer:'Yes. Top-right header has Save Session + Load Session buttons. Save captures every M.* state field plus the active deal\'s IFRS / fees / PIK / modificationEvents — restorable with full Stage 1-5 state. Saved to localStorage (per-device). Also exports as JSON file. Multiple Stage 4/5 batches per deal preserved so monthly close workflow works.',
  demoSteps:[
    'Top-right header → click "Save Session".',
    'Modal opens with current stage, deal name, label input. Default label includes deal + stage + date.',
    'Type a label → Save → toast "Saved session". Or "Export to file" for a JSON.',
    'Reload page → click "Load Session" → list shows all saves grouped by deal.',
    'Click Load → entire pipeline state restores including all batches.'
  ],
  deal:null,
  section:'Top-right header',
  followUps:['multi-period-recon'] },

// ─────── DISCLOSURES / EVIDENCE PACK ───────

{ id:'evidence-pack',
  q:'What is the Evidence Pack?',
  tags:['evidence','pack','disclosure','panel','section','audit','seven','panels'],
  answer:'7 collapsible panels in Stage 2 covering the NWF accounting agenda end-to-end: (A) Month-End Close + Run Metadata, (B) Carrying Value Waterfall (IAS 1 §54), (C) Period-on-Period Variance Walk, (D) FV Sensitivities (IFRS 13 §93) by Level, (E) ECL Journal Templates (IFRS 9 §5.5), (E-bis) ECL Calculation Trace (PD × LGD × EAD × discount), (F) Modification History + Audit Run History.',
  demoSteps:[
    'Run Accounting on Libra 2.',
    'Scroll to "Accounting Evidence Pack" section.',
    'Click each panel header to expand: 7 panels available.',
    'Each panel populates with live data from the engine — re-renders on any treatment change.'
  ],
  deal:'libra2',
  section:'Stage 2 Evidence Pack',
  followUps:['carrying-value','ecl-formula','fv-sensitivities','modification','month-end'] },

{ id:'month-end',
  q:'How does the month-end close workflow work?',
  tags:['month','end','close','workflow','draft','reviewed','approved','posted','sign-off','approval','locked'],
  answer:'Sequential 4-state gate: <strong>Draft → Reviewed → Approved → Posted</strong>. Reviewer button enabled only at Draft, Approve only at Reviewed, Post only at Approved. In production each step requires a different user (segregation of duties). When period reaches Posted: all 4 chips green, action buttons replaced with "Unlock period" + "Start new versioned run" + green Period Locked banner. Re-runs always available — they create a new versioned Draft.',
  demoSteps:[
    'Run Accounting → Status = Draft.',
    'Evidence Pack → "Month-End Close" panel expanded.',
    'Click "Reviewer sign-off" → Reviewed (Draft chip green).',
    'Click "Approve" → Approved.',
    'Click "Post (lock period)" → all 4 chips green + Period Locked banner. Action buttons replaced.'
  ],
  deal:'libra2',
  section:'Evidence Pack → Month-End Close',
  followUps:['evidence-pack','run-history'] },

{ id:'run-history',
  q:'Where is the audit trail of runs?',
  tags:['audit','trail','run','history','version','user','timestamp','log','immutable'],
  answer:'Evidence Pack → Modification History + Audit Run History panel. Last 10 runs across all deals, with run ID, deal, version, when, user, status (Draft/Reviewed/Approved/Posted), JE rows, treatment-policy flag (default vs override). Each Run Accounting click appends a new row. The current run highlights blue.',
  demoSteps:[
    'Run Accounting on Libra 2 → entry logged.',
    'Make a treatment override (e.g. flip ECL Stage to 2) → engine re-runs.',
    'New row in run history flagged "override" (amber chip).',
    'Pick Volt → Run Accounting → entry logged for Volt.',
    'Modification History panel shows last 10 runs across both deals.'
  ],
  deal:null,
  section:'Evidence Pack → Modification History',
  followUps:['evidence-pack','month-end','session-save'] },

{ id:'pop-variance',
  q:'How is the period-on-period variance walk computed?',
  tags:['pop','period','variance','walk','rate','balance','days','modification','decompose'],
  answer:'Decomposes ΔInterest between two halves of the schedule into named drivers: Rate effect ≈ ΔRate × Bal × Days/365 · Balance effect ≈ Rate × ΔBal × Days/365 · Day-count effect ≈ Rate × Bal × ΔDays/365 · Modification effect ≈ Σ daily mod gain (B − A) · Cross/mix residual = total Δ minus named effects. Useful when leadership asks "why did interest income jump £400k between Q3 and Q4?".',
  demoSteps:[
    'Run Accounting on Libra 2.',
    'Evidence Pack → "Period-on-Period Explainability" panel.',
    'See the 5-row decomposition: Rate, Balance, Day-count, Modification, Cross/mix residual = Total ΔInterest.',
    'For a deal with margin step-ups, the Rate effect dominates.'
  ],
  deal:'libra2',
  section:'Evidence Pack → PoP Variance',
  followUps:['evidence-pack','rate-resets'] },

{ id:'fee-specs',
  q:'How do I see fee specifications in detail?',
  tags:['fee','specs','specification','detail','breakdown','total','accrued','panel'],
  answer:'Stage 2 has a "View fee specifications + engine-computed totals" collapsible section below the journal table. Each fee shows: Name, Kind, Mode, Frequency, Basis, Rate, IFRS Treatment chip (colour-coded), Accrued (life). Totals row at the bottom. The IFRS treatment column links to the GL routing — you can see at a glance which fee is hitting which 492x00 account.',
  demoSteps:[
    'Pick Volt → Run Accounting.',
    'Below the journal table, expand "View fee specifications + engine-computed totals".',
    'See 2 fees: Volt Guarantee Fee (1.67%, covered, IFRS15-overTime, £24m) and NWF Commitment Fee (0.29%, unfunded, IFRS15-overTime, £2.5m).',
    'Pick Libra 2 → 2 fees: Arrangement Fee (IFRS9-EIR) + Commitment Fee (IFRS15-overTime).'
  ],
  deal:'voltGuarantee',
  section:'Stage 2 → Fee Specifications',
  followUps:['fee-treatment','fee-gl-routing'] },

{ id:'capability-cards',
  q:'What do the capability cards show?',
  tags:['capability','card','grid','ifrs','green','amber','gray','status'],
  answer:'10 cards in Stage 2 showing IFRS-aligned accounting capabilities for the active deal. Each card has icon + title + description + status chip (green = active, amber = overridden, gray = not applicable). Covers: Accounting determined from deal record · Initial recognition (AmortisedCost vs FVTPL) · Fees (EIR vs IFRS 15) · EIR calculation · Subsequent measurement / monthly posting · FX revaluation · Fair Value hierarchy · IFRS 9 staging (12-mo / lifetime / Stage 3) · Modifications · Journal export to Workday + reconciliation.',
  demoSteps:[
    'Pick Volt → Run Accounting.',
    'Top of Stage 2 → "IFRS-Aligned Accounting Capabilities" grid — 10 cards.',
    'Active cards green, dormant cards gray.',
    'Toggle a treatment override (e.g. FV Level) → relevant card flips amber with "overridden" tag.'
  ],
  deal:'voltGuarantee',
  section:'Stage 2 capability grid',
  followUps:['evidence-pack'] },

// ─────── PORTF / EXCEL / JSON ───────

{ id:'load-excel',
  q:'How do I load a deal from a PortF Excel file?',
  tags:['load','excel','portf','xlsx','import','upload','setup','metadata','fees'],
  answer:'Stage 1 → "Load Excel from PortF" button. Pick a .xlsx file. The parser reads: setup metadata (rows 1-15, cols A:B — Company / Debt Type / Loan Start / Loan End / Day Count / Total Commitment / Currency / Legal Entity / LEID / Position / Income Security / etc.), per-fee setup blocks (cols H+ onwards — one column per fee with Name / Posting Type / Calc Basis / Rate / Frequency / etc.), and the daily data table (row 17 onwards). When the Excel maps to a brand-new deal (no seed match), a synthetic instrument is created automatically.',
  demoSteps:[
    'Stage 1 → click "Load Excel from PortF".',
    'Pick portf-cashflow-volt-example.xlsx (or any conforming file).',
    '"View loaded setup info" panel populates with 15 fields with source badges.',
    '"View loaded fees" panel shows each fee with full spec.',
    'Active-deal dropdown auto-syncs to the resolved deal.'
  ],
  deal:null,
  section:'Stage 1',
  followUps:['load-json','setup-info-source','portf-template'] },

{ id:'load-json',
  q:'How do I load a deal from PortF JSON?',
  tags:['load','json','portf','import','paste','upload'],
  answer:'Stage 1 → "Load JSON from PortF" button. Paste JSON or upload a .json file. The schema requires instrument.id (matching a seed), settlementDate, maturityDate, currency, faceValue, commitment, accrualSchedule[] with per-row balance/draw/paydown/currentRate/dailyInterest/dailyFees/dailyPik. Optional fees[] for the fees panel.',
  demoSteps:[
    'Stage 1 → "Load JSON from PortF" → modal opens.',
    'Paste contents of portf-cashflow-libra-2-converted.json (or upload).',
    'Click "Load & Apply".',
    '"View loaded setup info" + "View loaded fees" populate from the JSON.'
  ],
  deal:null,
  section:'Stage 1',
  followUps:['load-excel','portf-template'] },

{ id:'portf-template',
  q:'Is there a canonical PortF Excel template?',
  tags:['template','canonical','portf','excel','format','specification','guide'],
  answer:'Yes — portf-cashflow-template.xlsx is the blank template. portf-cashflow-volt-example.xlsx is a populated example. PORTF-EXCEL-TEMPLATE-GUIDE.md is the field-by-field specification (15 metadata fields, fee block layout, data table, pitfalls). Hand the template + guide to PortF and they can produce conforming files.',
  demoSteps:[
    'Stage 1 → "Sample Excel" button downloads the blank template directly.',
    'Open it — see rows 1-15 setup, rows 1-9 placeholder fees in cols H/J/L, data table at row 17.',
    'See the canonical Volt example for a populated reference.'
  ],
  deal:null,
  section:'Stage 1 + project files',
  followUps:['load-excel','setup-info-source'] },

{ id:'setup-info-source',
  q:'How do I tell where setup info came from?',
  tags:['setup','source','badge','excel','seed','synthetic','provenance','pull'],
  answer:'After loading PortF data, the "View loaded setup info" panel shows every field with a source badge: <strong>Excel ✱</strong> (green) = directly from the Excel/JSON, <strong>Seed •</strong> (blue) = from the matched seed instrument record, <strong>Synthetic 🆕</strong> (amber) = inferred placeholder when the source didn\'t carry the field.',
  demoSteps:[
    'Stage 1 → load any deal.',
    'Expand "View loaded setup info".',
    'Each row has a Source column with the badge.',
    'For a fully-populated PortF Excel, all required fields read "Excel ✱". For a seed-loaded deal via "Use Active Deal as Sample", they all read "Seed •".'
  ],
  deal:null,
  section:'Stage 1 setup panel',
  followUps:['load-excel','portf-template'] },

// ─────── COMPLIANCE / GAP ANALYSIS ───────

{ id:'gap-analysis',
  q:'Are there any gaps in our accounting coverage?',
  tags:['gap','coverage','analysis','missing','requirements','assessment'],
  answer:'After the latest gap closure: <strong>0 gaps</strong>. We cover all 7 capabilities Accounting must own (EIR / amortised cost / fee amortisation / accruals / journals / impairment / disclosures), all 6 fields it stores (Original EIR / Deferred fee balance / Carrying value / Accrued interest / ECL reserve / Net carrying), and all 3 ECL workflow steps. Collateral remains correctly out of scope (IMS responsibility per the requirements).',
  demoSteps:[
    'See the gap-analysis section in the Demo Guide for the full table.',
    'Show: Receivables KPI in Stage 2 strip (Gap #2 fix).',
    'Show: Carrying Waterfall Deferred Fee Memo (Gap #1 fix).',
    'Show: DPD auto-migration banner (Gap #3 fix).',
    'Show: Covenant breach SICR trigger (Gap #4 fix).',
    'Show: ECL Calculation Trace panel (Gap #5 fix).'
  ],
  deal:'libra2',
  section:'Stage 2 + Evidence Pack',
  followUps:['accounting-owns','ecl-formula','sicr','dpd-trigger'] }

];

// Make available globally for the chat panel
if(typeof window !== 'undefined'){ window.FAQ_KB = FAQ_KB; }
