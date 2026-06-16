/* Loan Module Integration Layer — Instrument dataset
   Mirrors INSTRUMENTS in income-calculator.html
   Last sync: 2026-05-08 */
const INSTRUMENTS = [
  {
    id:'alliance',
    positionId:'POS-FCP1-ALLIANCE-CN', securityId:'SEC-ALLIANCE-2019-CN',
    legalEntity:'FIS Capital Partners I', leid: 7,
    deal:'Alliance Manufacturing',
    position:'FCP-I 100% holding · Alliance CN',
    incomeSecurity:'Alliance Manufacturing Convertible Note (12% / 14% PIK)',
    faceValue: 25000000,
    purchasePrice: 25000000, // at par
    commitment: 25000000,
    settlementDate: '2019-01-15',
    maturityDate:   '2020-03-05',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis: 'ACT/360',
    coupon: { type:'Fixed', fixedRate: 0.12, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:true, rate: 0.14, capitalizationFrequency: 'Monthly' },
    principalRepayment: 'AtMaturity',
    principalSchedule: [
      { date:'2019-01-15', type:'initial', amount: 25000000 }
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    type:'pikNoteFixed',
    preset:'Alliance Manufacturing · Interest + PIK @ par'
  },
  {
    id:'discountBond',
    positionId:'POS-FCP1-COPPERLEAF', securityId:'SEC-COPPERLEAF-2030-SRNOTE',
    legalEntity:'FIS Capital Partners I', leid: 7,
    deal:'Copperleaf Capital',
    position:'FCP-I 100% holding · Copperleaf bond',
    incomeSecurity:'Copperleaf 8% Senior Notes 2030 (Discount Bond)',
    faceValue: 10000000,
    purchasePrice: 9_250_000,      // bought at discount
    commitment: 10_000_000,
    settlementDate: '2024-06-01',
    maturityDate:   '2030-06-01',
    dayBasis: '30/360',
    coupon: { type:'Fixed', fixedRate: 0.08, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate: 0, capitalizationFrequency: 'Monthly' },
    principalRepayment: 'AtMaturity',
    principalSchedule: [
      { date:'2024-06-01', type:'initial', amount: 10_000_000 }
    ],
    amortization: { method:'effectiveInterestPrice' },  // solve EIR from price
    nonUseFee: { enabled:false, rate:0 },
    type:'discountAmort',
    preset:'Copperleaf 8% · Discount Bond (Effective Interest)'
  },
  {
    id:'floatingLoan',
    positionId:'POS-FCP2-ORION-TLB', securityId:'SEC-ORION-TLB-2024',
    legalEntity:'FIS Capital Partners II', leid: 11,
    deal:'Orion Industrial',
    position:'FCP-II £40m Position · Orion TL-B',
    incomeSecurity:'Orion Industrial Term Loan B (SOFR + 575 bps)',
    faceValue: 40_000_000,
    purchasePrice: 40_000_000,
    commitment: 40_000_000,
    settlementDate: '2024-09-15',
    maturityDate:   '2031-09-15',
    dayBasis: 'ACT/360',
    coupon: { type:'Floating', fixedRate: 0, floatingRate: 0.051, spread: 0.0575, floor: 0.08, cap: 0.14 },
    pik: { enabled:false, rate:0 },
    principalRepayment: 'Scheduled',
    principalSchedule: [
      { date:'2024-09-15', type:'initial', amount: 40_000_000 },
      { date:'2025-03-31', type:'paydown', amount:  1_000_000 },
      { date:'2025-09-30', type:'paydown', amount:  1_000_000 },
      { date:'2026-03-31', type:'paydown', amount:  1_000_000 },
    ],
    amortization: { method:'straightLine' },
    nonUseFee: { enabled:false, rate:0 },
    type:'floatingCapsFloors',
    preset:'Orion TL-B · Floating + Caps/Floors'
  },
  {
    // ----------------------------------------------------------------
    // Same Orion TL-B security as above, held by FCP-I in a separate
    // £20m secondary purchase. Demonstrates that ONE security can have
    // MULTIPLE positions across different LEs (the canonical fund-admin
    // multi-LE syndicate model). Both positions share securityId
    // 'SEC-ORION-TLB-2024' but have distinct positionIds, ownership %,
    // settlement dates, and cost bases.
    // ----------------------------------------------------------------
    id:'floatingLoanFCP1',
    positionId:'POS-FCP1-ORION-TLB',  securityId:'SEC-ORION-TLB-2024',  // ← same security as floatingLoan
    legalEntity:'FIS Capital Partners I', leid: 7,
    deal:'Orion Industrial',
    position:'FCP-I £20m Position · Orion TL-B (Secondary)',
    incomeSecurity:'Orion Industrial Term Loan B (SOFR + 575 bps)',
    faceValue: 20_000_000,
    purchasePrice: 19_700_000,            // bought at 98.5 (secondary)
    commitment: 20_000_000,
    settlementDate: '2025-03-15',         // FCP-I bought in 6m after FCP-II's primary
    maturityDate:   '2031-09-15',
    dayBasis: 'ACT/360',
    coupon: { type:'Floating', fixedRate: 0, floatingRate: 0.051, spread: 0.0575, floor: 0.08, cap: 0.14 },
    pik: { enabled:false, rate:0 },
    principalRepayment: 'Scheduled',
    principalSchedule: [
      { date:'2025-03-15', type:'initial', amount: 20_000_000 },
      { date:'2025-09-30', type:'paydown', amount:    500_000 },  // pro-rata
      { date:'2026-03-31', type:'paydown', amount:    500_000 }
    ],
    amortization: { method:'effectiveInterestPrice' },  // accrete the discount over life
    nonUseFee: { enabled:false, rate:0 },
    type:'floatingCapsFloors',
    preset:'Orion TL-B (FCP-I £20m Secondary @ 98.5)'
  },
  {
    id:'revolver',
    positionId:'POS-FCO3-NORTHWIND-RCF', securityId:'SEC-NORTHWIND-RCF-2025',
    legalEntity:'FIS Credit Opps III', leid: 22,
    deal:'Northwind Ventures',
    position:'FCO-III 100% holding · Northwind RCF',
    incomeSecurity:'Northwind Revolving Credit Facility (£50m commitment)',
    faceValue: 15_000_000, // drawn at settle
    purchasePrice: 15_000_000,
    commitment: 50_000_000,
    settlementDate: '2025-01-15',
    maturityDate:   '2029-01-15',
    dayBasis: 'ACT/365',
    coupon: { type:'Fixed', fixedRate: 0.095 },
    pik: { enabled:false, rate:0 },
    principalRepayment: 'Scheduled',
    principalSchedule: [
      { date:'2025-01-15', type:'initial', amount: 15_000_000 },
      { date:'2025-05-01', type:'draw',    amount: 10_000_000 },
      { date:'2025-09-01', type:'paydown', amount:  5_000_000 },
      { date:'2026-03-01', type:'draw',    amount:  7_500_000 },
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:true, rate: 0.005 }, // 50 bps on undrawn
    type:'nonUseFeeFacility',
    preset:'Northwind RCF · Revolver + Non-use Fee'
  },
  {
    // Direct lending / private credit unitranche term loan — the bread-and-butter
    // middle-market financing: 1L unitranche, floating SOFR + 600 with a 1% floor,
    // 1% OID at issue, optional 2% PIK toggle (quarterly cap), 1%/yr amortization,
    // bullet at maturity. Mirrors what a BDC or direct-lending fund would book.
    id:'privateCredit',
    positionId:'POS-DL4-MERIDIAN', securityId:'SEC-MERIDIAN-UNITRANCHE-2025',
    legalEntity:'FIS Direct Lending Fund IV', leid: 31,
    deal:'Meridian Healthcare Services',
    position:'DL-IV 100% holding · Meridian Unitranche',
    incomeSecurity:'Meridian Unitranche Term Loan (SOFR + 600, 1% OID, 2% PIK)',
    faceValue: 35_000_000,
    purchasePrice: 34_650_000, // 99.0 — 100 bps OID
    commitment: 35_000_000,
    settlementDate: '2025-03-15',
    maturityDate:   '2031-03-15',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis: 'ACT/360',
    coupon: {
      type:'Floating',
      fixedRate: 0,
      floatingRate: 0.0520,   // SOFR base
      spread: 0.0600,         // 600 bps
      floor: 0.0100,          // 1% SOFR floor
      cap: null
    },
    pik: { enabled:true, rate: 0.0200, capitalizationFrequency: 'Quarterly' },
    principalRepayment: 'Scheduled',
    principalSchedule: [
      { date:'2025-03-15', type:'initial',  amount: 35_000_000 },
      { date:'2026-03-15', type:'paydown',  amount:    350_000 }, // 1%/yr mandatory amort
      { date:'2027-03-15', type:'paydown',  amount:    350_000 },
      { date:'2028-03-15', type:'paydown',  amount:    350_000 },
      { date:'2029-03-15', type:'paydown',  amount:    350_000 },
      { date:'2030-03-15', type:'paydown',  amount:    350_000 },
      // Bullet of remaining principal at maturity
    ],
    amortization: { method:'effectiveInterestPrice' }, // accrete OID over life
    nonUseFee: { enabled:false, rate:0 },
    type:'pikNoteVar',
    preset:'Meridian Unitranche · Private Credit (SOFR + 600, 1% OID, 2% PIK)'
  },
  {
    // ----------------------------------------------------------------
    // Libra 2 / SP023 — UK GBP infrastructure facility, IFRS 9/15 worked example
    // Source: NEW INCOME Calculation requirements.xlsx · Debt Example sheet.
    //
    // £25M HSBC Facility B4 (100%), Compounded SONIA + ratcheted Margin
    // signed 8 Oct 2024, term 10 Oct 2031, ACT/365, modified following.
    // - Arrangement fee 1.75% paid 13/10/2024 (IFRS 9 - capitalised into EIR)
    // - Commitment fee 0.35% on undrawn, paid quarterly (IFRS 15 - over time)
    // - ESG margin adjustment of -2.5 bps from 22 May 2025 onwards
    // - Margin ratchet schedule (bps): 400 → 425 → 450 → 450 → 475 → 500 → 525
    // - Two drawdowns: £15M actual on 17/2/2026 and £10M forecast on 30/6/2026
    // ----------------------------------------------------------------
    id:'libra2',
    positionId:'POS-NWF-LIBRA2-100', securityId:'SEC-LIBRA2-HSBC-FACB4',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Libra 2',
    position:'NWF 100% Bilateral Position · Libra 2',
    incomeSecurity:'HSBC Facility B4 — Libra 2 (Compounded SONIA + Ratcheted Margin)',
    counterpartyId:'SP023',
    transactionId:'SP023',
    bilateralFlag:'Bilateral',
    agentName:'HSBC Bank',
    currency:'GBP',
    faceValue: 25_000_000,
    purchasePrice: 25_000_000,
    commitment: 25_000_000,
    settlementDate: '2024-10-08',           // signing date
    availabilityEnd: '2029-10-10',
    maturityDate:   '2031-10-10',           // termination date
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis: 'ACT/365',
    businessDayConvention: 'modifiedFollowing',
    holidayCalendar: 'ukBank',
    skipHolidays: false,
    coupon: {
      type:'SONIA',                          // Compounded RFR + Margin
      fixedRate: 0,
      floatingRate: 0,                       // resolved from rfr.baseRate at runtime
      spread: 0,                             // margin comes from marginSchedule
      floor: null, cap: null
    },
    rfr: {
      index: 'SONIA',
      baseRate: 0.0475,                      // illustrative SONIA fix (4.75%) — replace with feed
      lookbackDays: 5,                       // 5 RFR Banking Days
      rounding: 5                            // 5 decimal places
    },
    marginSchedule: [
      { from:'2024-10-08', to:'2025-03-17', marginBps: 400 },
      { from:'2025-03-18', to:'2025-05-21', marginBps: 425 },
      { from:'2025-05-22', to:'2026-03-17', marginBps: 450 },
      { from:'2026-03-18', to:'2027-03-17', marginBps: 450 },
      { from:'2027-03-18', to:'2028-03-17', marginBps: 475 },
      { from:'2028-03-18', to:'2029-03-17', marginBps: 500 },
      { from:'2029-03-18', to:'2030-03-21', marginBps: 525 },
      { from:'2030-03-22', to:'2031-10-10', marginBps: 525 }
    ],
    esgAdjustment: { from:'2025-05-22', deltaBps: -2.5 },   // ESG margin reduction
    pik: { enabled:false, rate:0, capitalizationFrequency:'Monthly' },
    principalRepayment: 'AtMaturity',          // bullet
    principalSchedule: [
      // Drawdowns per the contractual schedule from
      // NEW INCOME Calculation requirements.xlsx · Debt Example sheet:
      //   - SP023_4: £15M actual drawdown on 17 Feb 2026
      //   - SP023_1: £10M forecasted drawdown on 30 Jun 2026
      // Each carries its own status flag (actual vs forecast) for downstream
      // forecast-vs-contractual reporting (scenario #33).
      { date:'2026-02-17', type:'draw', amount: 15_000_000, drawdownId:'SP023_4', status:'actual'   },
      { date:'2026-06-30', type:'draw', amount: 10_000_000, drawdownId:'SP023_1', status:'forecast' }
    ],
    // Drawn at par (PP = face). The deferred arrangement fee is recognised
    // via the IFRS 9 EIR accretion mechanism (separate from amortization),
    // so no discount/premium amortization is needed here.
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    // ---- Multiple fees — IFRS 9 / IFRS 15 aware ----------------------
    fees: [
      {
        id:'arrangement',
        kind:'arrangement',
        label:'Arrangement Fee',
        mode:'percent',                       // 1.75% × commitment = £437,500
        rate: 0.0175,
        base:'commitment',
        frequency:'oneOff',
        paymentDate:'2024-10-13',
        // Reference SP023 software recognises this on payment date (point-in-time)
        // rather than capitalising into EIR. Switch to IFRS15-pointInTime to tie.
        ifrs:'IFRS15-pointInTime',
        notes:'1.75% × £25M commitment = £437,500 paid 13/10/2024. Recognised on payment date (IFRS 15 point-in-time) — matches reference software.'
      },
      {
        id:'commitment',
        kind:'commitment',
        label:'Commitment Fee',
        // UK loan convention: commitment fee = 35% × current margin × undrawn × dcf.
        // The "0.35" in the requirements sheet means 35% (of margin), not 0.35% flat.
        // Engine resolves margin from the marginSchedule + ESG adjustment for each day.
        mode:'marginLinked',
        marginMultiple: 0.35,
        base:'undrawn',
        frequency:'quarterly',
        paymentSchedule:'lastDayOfEach3MonthPeriod',
        accrueFrom:'2024-10-08',
        accrueTo:'2029-10-10',                 // through availability period
        ifrs:'IFRS15-overTime',
        notes:'35% of margin × undrawn commitment × dcf. Ratchets and ESG adjustment flow through automatically.'
      }
    ],
    // ---- IFRS 9 classification ---------------------------------------
    ifrs: {
      ifrs9Classification:'AmortisedCost',
      sppiPassed: true,
      businessModel:'HoldToCollect',
      ecLStage: 1,
      pdAnnual: 0.005,
      lgd: 0.40
    },
    type:'simpleDaily',                      // base type; SONIA coupon driven by ratchet table
    preset:'Libra 2 · GBP SONIA + Ratcheted Margin (IFRS 9/15 fees)'
  },
  {
    // ----------------------------------------------------------------
    // Libra 3 — same underlying loan structure as Libra 2, with an
    // IFRS 9 §6 Cash Flow Hedge applied. Demonstrates hedge accounting:
    //   - Pay-fixed receive-floating GBP IRS converting the SONIA
    //     exposure to a synthetic-fixed-rate position
    //   - 95% effective per IFRS 9 §6.4 prospective testing
    //   - Effective portion → 35000 Cash Flow Hedge Reserve (OCI)
    //   - Ineffective portion → 45100 Hedge Ineffectiveness P&L
    //   - Reclassification on each settlement date drains the reserve
    //     to P&L matching the hedged cashflow as it occurs
    // Libra 2 stays as the original requirements XLSX example (no hedge);
    // Libra 3 demonstrates the hedge accounting capability separately.
    // ----------------------------------------------------------------
    id:'libra3',
    positionId:'POS-NWF-LIBRA3-100', securityId:'SEC-LIBRA3-HSBC-FACB4-CFH',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Libra 3',
    position:'NWF 100% Bilateral Position · Libra 3 (with CFH)',
    incomeSecurity:'HSBC Facility B4 — Libra 3 (Compounded SONIA + Ratcheted Margin · CFH IRS)',
    counterpartyId:'SP024', transactionId:'SP024',
    bilateralFlag:'Bilateral', agentName:'HSBC Bank', currency:'GBP',
    faceValue: 25_000_000, purchasePrice: 25_000_000, commitment: 25_000_000,
    settlementDate: '2024-10-08', availabilityEnd: '2029-10-10', maturityDate: '2031-10-10',
    accrualDayCountExclusive: false, paydateDayCountInclusive: true, interestPreviousDay: false,
    dayBasis: 'ACT/365', businessDayConvention:'modifiedFollowing',
    holidayCalendar: 'ukBank', skipHolidays: false,
    coupon: { type:'SONIA', fixedRate: 0, floatingRate: 0, spread: 0, floor: null, cap: null },
    rfr: { index:'SONIA', baseRate: 0.0475, lookbackDays: 5, rounding: 5 },
    marginSchedule: [
      { from:'2024-10-08', to:'2025-03-17', marginBps: 400 },
      { from:'2025-03-18', to:'2025-05-21', marginBps: 425 },
      { from:'2025-05-22', to:'2026-03-17', marginBps: 450 },
      { from:'2026-03-18', to:'2027-03-17', marginBps: 450 },
      { from:'2027-03-18', to:'2028-03-17', marginBps: 475 },
      { from:'2028-03-18', to:'2029-03-17', marginBps: 500 },
      { from:'2029-03-18', to:'2030-03-21', marginBps: 525 },
      { from:'2030-03-22', to:'2031-10-10', marginBps: 525 }
    ],
    esgAdjustment: { from:'2025-05-22', deltaBps: -2.5 },
    pik: { enabled:false, rate:0, capitalizationFrequency:'Monthly' },
    principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-02-17', type:'draw', amount: 15_000_000, drawdownId:'SP024_4', status:'actual'   },
      { date:'2026-06-30', type:'draw', amount: 10_000_000, drawdownId:'SP024_1', status:'forecast' }
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    fees: [
      { id:'arrangement', kind:'arrangement', label:'Arrangement Fee',
        mode:'percent', rate: 0.0175, base:'commitment',
        frequency:'oneOff', paymentDate:'2024-10-13',
        ifrs:'IFRS15-pointInTime' },
      { id:'commitment', kind:'commitment', label:'Commitment Fee',
        mode:'marginLinked', marginMultiple: 0.35, base:'undrawn',
        frequency:'quarterly', paymentSchedule:'lastDayOfEach3MonthPeriod',
        accrueFrom:'2024-10-08', accrueTo:'2029-10-10',
        ifrs:'IFRS15-overTime' }
    ],
    ifrs: {
      ifrs9Classification:'AmortisedCost', sppiPassed:true,
      businessModel:'HoldToCollect',
      ecLStage: 1, pdAnnual: 0.005, lgd: 0.40
    },
    // ---- IFRS 9 hedge accounting (§6) — Cash Flow Hedge ---------------
    hedge: {
      type:'CFH',
      notional: 25_000_000,
      fixedRate: 0.0500,                       // pay-fixed leg
      floatingRate: 0.0475,                    // receive-floating SONIA leg
      effectivenessRatio: 0.95,                // 95% effective per IFRS 9 §6.4
      fairValueSchedule: [
        { date:'2024-10-08', mtm:        0 },
        { date:'2025-06-30', mtm:  250_000 },
        { date:'2026-06-30', mtm:  600_000 },
        { date:'2027-06-30', mtm:  850_000 },
        { date:'2028-06-30', mtm:  400_000 },
        { date:'2029-06-30', mtm: -150_000 },
        { date:'2030-06-30', mtm: -350_000 },
        { date:'2031-06-30', mtm: -500_000 },
        { date:'2031-10-10', mtm:        0 }
      ],
      settlementDates: [
        '2025-06-30','2025-12-30','2026-06-30','2026-12-30',
        '2027-06-30','2027-12-30','2028-06-30','2028-12-30',
        '2029-06-30','2029-12-30','2030-06-30','2030-12-30',
        '2031-06-30','2031-10-10'
      ]
    },
    type:'simpleDaily',
    preset:'Libra 3 · Same as Libra 2 + IFRS 9 Cash Flow Hedge (95% effective IRS)'
  },
  {
    // ----------------------------------------------------------------
    // Volt — financial guarantee on a £1bn underlying loan (covered £800m)
    // Source: NEW INCOME Calculation requirements.xlsx · Guarantee Example
    //
    // Single guarantee covering an underlying loan from Bank of America.
    // Income to NWF = guarantee fee on drawn covered portion + NWF commitment
    // fee on undrawn covered portion + arrangement fee (IFRS 9, capitalised).
    // Underlying loan: SONIA + 0.84% margin per annum, scheduled repayments.
    // ----------------------------------------------------------------
    id:'voltGuarantee',
    positionId:'POS-NWF-VOLT-GUAR', securityId:'SEC-VOLT-GP017-FINGUAR',
    instrumentKind:'guarantee',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Volt',
    position:'NWF Guarantor Position · Volt covered tranche',
    incomeSecurity:'Volt Financial Guarantee on £1bn BoA Loan (£800m covered)',
    counterpartyId:'CP0112',
    transactionId:'GP017 & GP018',
    bilateralFlag:'Bilateral',
    agentName:'Bank of America',
    currency:'GBP',
    // For a guarantee instrument we treat:
    //   faceValue / commitment = total facility (£1bn)
    //   coveredAmount          = guaranteed portion (£800m)
    faceValue:    1_000_000_000,
    purchasePrice: 0,                          // no principal investment
    commitment:   1_000_000_000,
    coveredAmount: 800_000_000,
    settlementDate: '2025-12-18',              // signing
    availabilityEnd:'2028-12-18',              // 36-month availability
    maturityDate:   '2037-12-17',              // termination
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis: 'ACT/365',
    businessDayConvention:'modifiedFollowing',
    holidayCalendar:'ukBank',
    skipHolidays:false,
    // Underlying-loan coupon — informational here; income is driven by fees.
    coupon: { type:'SONIA', fixedRate:0, floatingRate:0, spread: 0.0084, floor:null, cap:null },
    rfr: { index:'SONIA', baseRate: 0.0475, lookbackDays: 5, rounding: 5 },
    marginSchedule: [
      // Underlying loan margin = 0.84% flat for covered tranche
      { from:'2025-12-18', to:'2037-12-17', marginBps: 84 }
    ],
    pik: { enabled:false, rate:0 },
    principalRepayment:'Scheduled',
    // Covered-tranche disbursement schedule + 18-tranche repayment ladder
    // Drawdown profile: 6 ratable tranches of £133,333,333.33 (= £800m / 6)
    // over the 3-year availability period — matches the reference SP023 ledger.
    // The contractual disbursement table from the requirements sheet has 3
    // lumpy tranches (£400m + £200m + £200m); the reference software books
    // them ratably across the 6 interest periods.
    principalSchedule: [
      { date:'2026-06-30', type:'draw', amount: 133_333_333.33, status:'actual'   },
      { date:'2026-12-31', type:'draw', amount: 133_333_333.33, status:'actual'   },
      { date:'2027-06-30', type:'draw', amount: 133_333_333.33, status:'forecast' },
      { date:'2027-12-31', type:'draw', amount: 133_333_333.33, status:'forecast' },
      { date:'2028-06-30', type:'draw', amount: 133_333_333.33, status:'forecast' },
      { date:'2028-12-29', type:'draw', amount: 133_333_333.35, status:'forecast' },
      // Repayments — 18 × £44,444,444.44 = £800m (matches reference ledger
      // exactly; contractual amounts are slightly different at £44,444,800
      // per period but the reference uses round £800m / 18).
      { date:'2029-06-29', type:'repayment', amount: 44_444_444.44 },
      { date:'2029-12-31', type:'repayment', amount: 44_444_444.44 },
      { date:'2030-06-28', type:'repayment', amount: 44_444_444.44 },
      { date:'2030-12-31', type:'repayment', amount: 44_444_444.44 },
      { date:'2031-06-30', type:'repayment', amount: 44_444_444.44 },
      { date:'2031-12-31', type:'repayment', amount: 44_444_444.44 },
      { date:'2032-05-28', type:'repayment', amount: 44_444_444.44 },
      { date:'2032-12-31', type:'repayment', amount: 44_444_444.44 },
      { date:'2033-06-30', type:'repayment', amount: 44_444_444.44 },
      { date:'2033-12-30', type:'repayment', amount: 44_444_444.44 },
      { date:'2034-06-30', type:'repayment', amount: 44_444_444.44 },
      { date:'2034-12-29', type:'repayment', amount: 44_444_444.44 },
      { date:'2035-06-29', type:'repayment', amount: 44_444_444.44 },
      { date:'2035-12-31', type:'repayment', amount: 44_444_444.44 },
      { date:'2036-06-30', type:'repayment', amount: 44_444_444.44 },
      { date:'2036-12-31', type:'repayment', amount: 44_444_444.44 },
      { date:'2037-06-30', type:'repayment', amount: 44_444_444.44 },
      { date:'2037-12-19', type:'repayment', amount: 44_444_444.52 }
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    fees: [
      {
        id:'arrangement',
        kind:'arrangement',
        label:'Arrangement Fee',
        mode:'percent',                       // 0.24% × covered (£800m) = £1.92m
        rate: 0.0024,
        base:'covered',
        frequency:'oneOff',
        paymentDate:'2025-12-30',
        ifrs:'IFRS9-EIR',
        notes:'0.24% of covered portion paid 30/12/2025 — IFRS 9 deferred and accreted.'
      },
      {
        id:'guarantee',
        kind:'guarantee',
        label:'Guarantee Fee',
        mode:'percent',                       // 0.5% p.a. × drawn covered amount
        rate: 0.005,
        base:'drawn',                          // engine maps drawn = current loan balance
        frequency:'semiAnnual',
        paymentSchedule:'lastDayOfInterestPeriod',
        accrueFrom:'2026-04-01',               // accrual starts at first drawdown
        accrueTo:'2037-12-17',
        ifrs:'IFRS15-overTime',
        notes:'0.5% p.a. on drawn covered portion. Paid every 6m on last day of interest period.'
      },
      {
        id:'nwfCommitment',
        kind:'commitment',
        label:'NWF Commitment Fee',
        mode:'percent',                       // 35% × guarantee fee = 0.175% × undrawn
        rate: 0.00175,
        base:'undrawn',                        // undrawn portion of covered tranche
        frequency:'semiAnnual',
        paymentSchedule:'every6mFromSigning',
        accrueFrom:'2025-12-18',
        accrueTo:'2028-12-18',                 // through availability period
        ifrs:'IFRS15-overTime',
        notes:'35% of guarantee fee × undrawn covered portion. IFRS 15 — over time during availability.'
      }
    ],
    ifrs: {
      ifrs9Classification:'AmortisedCost',     // financial guarantee accounted at amortised cost
      sppiPassed:true,
      businessModel:'HoldToCollect',
      ecLStage: 1,
      pdAnnual: 0.0035,
      lgd: 0.45
    },
    type:'simpleDaily',
    preset:'Volt · £1bn Financial Guarantee (covered £800m, IFRS 9/15 fees)'
  },
  {
    // ----------------------------------------------------------------
    // XYZ Buyout Fund — LP commitment to a renewable infrastructure fund
    // Source: NEW INCOME Calculation requirements.xlsx · Equity Example #1
    //
    // £50m commitment to a closed-end LP. Capital calls staggered over 3
    // years, fund term 10y + 2y extension. Income to the LP comes via:
    //   - distributions (modelled as paydowns / not income)
    //   - dividend income (one-off recognition events)
    //   - capital gains at exit (not modelled here)
    // GP charges:
    //   - 1.75% management fee p.a. on committed during years 1-5
    //   - 1.25% management fee p.a. on invested cost from year 5 onwards
    //   - 8% IRR preferred return (out of scope for this calculator)
    // Note: management fees are an EXPENSE to the LP, modelled as
    // negative-rate "fees" so the calculator surfaces them with their
    // own line. IFRS 9 / 15 classification is "FVTPL — equity at fair value"
    // since SPPI fails for equity (no contractual cashflows).
    // ----------------------------------------------------------------
    id:'xyzBuyoutFund',
    positionId:'POS-NWFE-XYZ-LP', securityId:'SEC-XYZ-BUYOUT-LPINT',
    instrumentKind:'equity-fund',
    legalEntity:'NWF Renewable Equity', leid: 51,
    deal:'XYZ Buyout Fund (GBP)',
    position:'NWFE LP Subscription · £50m commitment',
    incomeSecurity:'XYZ Buyout Fund (GBP) — Limited Partnership Interest',
    generalPartner:'WXY Partners LLP',
    fundType:'LP / Closed-end',
    sectorFocus:'Solar, Fibre Infrastructure',
    currency:'GBP',
    faceValue:    50_000_000,                  // commitment
    purchasePrice: 50_000_000,
    commitment:   50_000_000,
    settlementDate:'2026-01-15',               // first close (illustrative)
    availabilityEnd:'2031-01-15',              // 5-year investment period
    maturityDate:   '2038-01-15',              // 10y term + assume 2y extension exercised
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis: 'ACT/365',
    coupon: { type:'Fixed', fixedRate:0, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    principalRepayment:'Scheduled',
    // Capital calls staggered over 3 years; distributions in years 7-10
    principalSchedule: [
      // Capital calls (drawdowns from LP perspective)
      { date:'2026-03-31', type:'draw',    amount: 12_500_000, status:'actual'   },  // 25%
      { date:'2026-09-30', type:'draw',    amount: 10_000_000, status:'forecast' },  // 20%
      { date:'2027-06-30', type:'draw',    amount: 12_500_000, status:'forecast' },  // 25%
      { date:'2027-12-31', type:'draw',    amount:  7_500_000, status:'forecast' },  // 15%
      { date:'2028-06-30', type:'draw',    amount:  5_000_000, status:'forecast' },  // 10%
      { date:'2028-12-31', type:'draw',    amount:  2_500_000, status:'forecast' },  // 5%
      // Realisations (distributions back to LP — illustrative)
      { date:'2032-12-31', type:'paydown', amount: 10_000_000 },
      { date:'2034-12-31', type:'paydown', amount: 20_000_000 },
      { date:'2036-12-31', type:'paydown', amount: 20_000_000 },
      { date:'2037-12-31', type:'paydown', amount: 10_000_000 }
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    fees: [
      // 1.75% on COMMITTED during the 5-year investment period
      {
        id:'mgmtFeeInvestmentPeriod',
        kind:'other',
        label:'Management Fee (Investment Period)',
        mode:'percent',
        rate: 0.0175,
        base:'commitment',
        frequency:'quarterly',
        accrueFrom:'2026-01-15',
        accrueTo:'2031-01-15',
        ifrs:'IFRS15-overTime',
        notes:'1.75% p.a. on committed capital during 5-year investment period (expense to LP).'
      },
      // 1.25% on INVESTED COST after the investment period
      {
        id:'mgmtFeePostInvestment',
        kind:'other',
        label:'Management Fee (Post-Investment)',
        mode:'percent',
        rate: 0.0125,
        base:'drawn',                          // drawn balance ≈ invested cost
        frequency:'quarterly',
        accrueFrom:'2031-01-16',
        accrueTo:'2038-01-15',
        ifrs:'IFRS15-overTime',
        notes:'1.25% p.a. on invested cost from year 5 onwards (step-down).'
      }
    ],
    ifrs: {
      ifrs9Classification:'FVTPL',             // equity instruments fail SPPI
      sppiPassed:false,
      businessModel:'Other',
      ecLStage: null,                          // not applicable for FVTPL equity
      pdAnnual: null,
      lgd: null,
      fairValueLevel:'Level 3',                // private fund interest
      navFrequency:'Quarterly',
      preferredReturn: 0.08,
      gpCarry: 0.20
    },
    type:'simpleDaily',
    preset:'XYZ Buyout Fund · £50m LP Commitment (Renewables, 1.75/1.25% mgmt fee)'
  },
  {
    // ----------------------------------------------------------------
    // ABCDEF Software Ltd — Series C direct equity stake
    // Source: NEW INCOME Calculation requirements.xlsx · Equity Example #2
    //
    // £100m ordinary shares for 9.09% post-money. Pre-money £120m fully
    // diluted. Non-cumulative, as-declared dividends. 10y trade-sale exit.
    // Quarterly fair value updates (Level 3 — comparable transactions).
    // For the income calculator we model:
    //   - Initial drawdown = £100m investment
    //   - Dividends as point-in-time IFRS 15 fee recognition events
    //   - No coupon, no maturity-based amortization (FVTPL equity)
    // ----------------------------------------------------------------
    id:'abcdefSeriesC',
    positionId:'POS-NWFE-ABCDEF-SC', securityId:'SEC-ABCDEF-SERIES-C-ORD',
    instrumentKind:'equity-direct',
    legalEntity:'NWF Renewable Equity', leid: 51,
    deal:'ABCDEF Software Ltd',
    position:'NWFE Series C Subscription · £100m · 9.09% post-money',
    incomeSecurity:'ABCDEF Software Ltd — Series C Ordinary Shares',
    counterpartyId:'ABCDEF-LTD',
    currency:'GBP',
    faceValue:    100_000_000,                 // committed = invested
    purchasePrice: 100_000_000,
    commitment:   100_000_000,
    settlementDate:'2026-04-01',
    maturityDate:   '2036-04-01',              // 10y trade-sale horizon
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis: 'ACT/365',
    coupon: { type:'Fixed', fixedRate:0, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-04-01', type:'initial', amount: 100_000_000 }
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    fees: [
      // Illustrative declared dividend events — point-in-time IFRS 15 recognition
      {
        id:'dividend2027',
        kind:'other',
        label:'Dividend Income FY2027',
        mode:'flat',
        amount: 750_000,
        frequency:'oneOff',
        paymentDate:'2027-09-30',
        ifrs:'IFRS15-pointInTime',
        notes:'Non-cumulative, as-declared. Recognised when right to receive established.'
      },
      {
        id:'dividend2028',
        kind:'other',
        label:'Dividend Income FY2028',
        mode:'flat',
        amount: 1_250_000,
        frequency:'oneOff',
        paymentDate:'2028-09-28',
        ifrs:'IFRS15-pointInTime'
      },
      {
        id:'dividend2030',
        kind:'other',
        label:'Dividend Income FY2030',
        mode:'flat',
        amount: 2_000_000,
        frequency:'oneOff',
        paymentDate:'2030-09-30',
        ifrs:'IFRS15-pointInTime'
      }
    ],
    capTable: {
      preMoneyValuation: 120_000_000,
      postMoneyOwnership: 0.0909,
      founders: 0.45,
      existingInvestors: 0.359,
      esopUnallocated: 0.10
    },
    ifrs: {
      ifrs9Classification:'FVTPL',             // SPPI fails — ordinary shares
      sppiPassed:false,
      businessModel:'Other',
      ecLStage: null,
      pdAnnual: null,
      lgd: null,
      fairValueLevel:'Level 3',                // private company, market-comparables
      navFrequency:'Quarterly',
      protectiveProvisions:['M&A','New Senior Securities','Budget >10% Variance','Related-Party Tx'],
      boardRights:'1 observer seat (no vote)'
    },
    type:'simpleDaily',
    preset:'ABCDEF Series C · £100m direct equity (9.09% post-money, FVTPL Level 3)'
  },
  {
    // ----------------------------------------------------------------
    // Suffolk Solar — multi-tranche infrastructure loan (Fixed + Floating)
    // Demonstrates scenario #10: fixed + floating tranches in one transaction.
    // £100m total facility split 50/50:
    //   - Tranche A: £50m fixed at 6.5% over 7 years (30/360)
    //   - Tranche B: £50m SONIA + 350 bps over 7 years (ACT/365)
    // ----------------------------------------------------------------
    id:'suffolkMultiTranche',
    positionId:'POS-NWF-SUFFOLK-MT', securityId:'SEC-SUFFOLK-SOLAR-MT',
    instrumentKind:'loan',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Suffolk Solar Phase 2',
    position:'NWF 100% Bilateral Position · Suffolk Solar',
    incomeSecurity:'Suffolk Solar Multi-Tranche Facility (£50m Fixed + £50m SONIA)',
    currency:'GBP',
    faceValue:    100_000_000,
    purchasePrice: 100_000_000,
    commitment:   100_000_000,
    settlementDate:'2026-01-15',
    maturityDate:   '2033-01-15',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    holidayCalendar:'ukBank',
    skipHolidays:false,
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed:true, businessModel:'HoldToCollect', ecLStage:1, pdAnnual:0.005, lgd:0.40 },
    // ---- TRANCHES ----
    tranches: [
      {
        id:'trancheA-fixed',
        label:'Tranche A · Fixed',
        faceValue: 50_000_000,
        purchasePrice: 50_000_000,
        commitment:    50_000_000,
        coupon: { type:'Fixed', fixedRate: 0.065, floatingRate:0, spread:0, floor:null, cap:null },
        dayBasis: '30/360',
        principalRepayment:'AtMaturity',
        principalSchedule: [
          { date:'2026-01-15', type:'initial', amount: 50_000_000 }
        ]
      },
      {
        id:'trancheB-floating',
        label:'Tranche B · SONIA + 350',
        faceValue: 50_000_000,
        purchasePrice: 50_000_000,
        commitment:    50_000_000,
        coupon: { type:'SONIA', fixedRate:0, floatingRate:0, spread: 0.0350, floor:null, cap:null },
        rfr: { index:'SONIA', baseRate: 0.0475, lookbackDays: 5, rounding: 5 },
        marginSchedule: [
          { from:'2026-01-15', to:'2033-01-15', marginBps: 350 }
        ],
        dayBasis: 'ACT/365',
        principalRepayment:'AtMaturity',
        principalSchedule: [
          { date:'2026-01-15', type:'initial', amount: 50_000_000 }
        ]
      }
    ],
    preset:'Suffolk Solar · £100m Multi-Tranche (£50m Fixed 6.5% + £50m SONIA+350)'
  },
  {
    // ----------------------------------------------------------------
    // Volt Multi-Loan — financial guarantee covering MULTIPLE underlying loans
    // Demonstrates scenario G1: single guarantee, multiple underlyings.
    // Total covered amount £600m across two underlying loans:
    //   - Underlying 1: £400m, SONIA + 0.84% margin (covered tranche)
    //   - Underlying 2: £200m, Fixed 5.5% (covered tranche)
    // Single guarantee fee structure applies to both.
    // ----------------------------------------------------------------
    id:'voltMultiLoan',
    positionId:'POS-NWF-VOLT-MLG', securityId:'SEC-VOLT-GP022-MULTILOAN',
    instrumentKind:'guarantee',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Volt — Multi-Loan Guarantee',
    position:'NWF Guarantor Position · Volt multi-loan covered',
    incomeSecurity:'Volt Multi-Loan Financial Guarantee (£600m covered, 2 underlyings)',
    counterpartyId:'CP0112',
    transactionId:'GP022',
    bilateralFlag:'Bilateral',
    agentName:'Bank of America',
    currency:'GBP',
    faceValue:    750_000_000,
    purchasePrice: 0,
    commitment:   750_000_000,
    coveredAmount: 600_000_000,
    settlementDate:'2026-01-15',
    availabilityEnd:'2029-01-15',
    maturityDate:   '2036-01-15',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis:'ACT/365',
    holidayCalendar:'ukBank',
    skipHolidays:false,
    coupon: { type:'Fixed', fixedRate:0, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed:true, businessModel:'HoldToCollect', ecLStage:1, pdAnnual:0.0035, lgd:0.45 },
    // ---- UNDERLYING LOANS (each contributes to the aggregate covered drawn) ----
    underlyingLoans: [
      {
        id:'underlying1-sonia',
        label:'Underlying 1 · SONIA + 84',
        faceValue: 400_000_000,
        commitment: 400_000_000,
        coveredAmount: 400_000_000,
        coupon: { type:'SONIA', fixedRate:0, floatingRate:0, spread: 0.0084, floor:null, cap:null },
        rfr: { index:'SONIA', baseRate: 0.0475, lookbackDays: 5, rounding: 5 },
        marginSchedule: [{ from:'2026-01-15', to:'2036-01-15', marginBps: 84 }],
        dayBasis: 'ACT/365',
        principalRepayment:'Scheduled',
        principalSchedule: [
          { date:'2026-06-30', type:'draw',      amount: 100_000_000, status:'actual'   },
          { date:'2027-06-30', type:'draw',      amount: 150_000_000, status:'forecast' },
          { date:'2028-06-30', type:'draw',      amount: 150_000_000, status:'forecast' },
          { date:'2031-06-30', type:'repayment', amount: 100_000_000 },
          { date:'2033-06-30', type:'repayment', amount: 150_000_000 },
          { date:'2036-01-15', type:'repayment', amount: 150_000_000 }
        ]
      },
      {
        id:'underlying2-fixed',
        label:'Underlying 2 · Fixed 5.5%',
        faceValue: 200_000_000,
        commitment: 200_000_000,
        coveredAmount: 200_000_000,
        coupon: { type:'Fixed', fixedRate: 0.055, floatingRate:0, spread:0, floor:null, cap:null },
        dayBasis: '30/360',
        principalRepayment:'AtMaturity',
        principalSchedule: [
          { date:'2026-12-31', type:'draw',      amount: 200_000_000, status:'actual'   },
          { date:'2036-01-15', type:'repayment', amount: 200_000_000 }
        ]
      }
    ],
    fees: [
      {
        id:'arrangement',
        kind:'arrangement',
        label:'Arrangement Fee',
        mode:'percent',
        rate: 0.0024,
        base:'covered',
        frequency:'oneOff',
        paymentDate:'2026-01-30',
        ifrs:'IFRS15-pointInTime',
        notes:'0.24% × £600m covered = £1.44m on payment date.'
      },
      {
        id:'guarantee',
        kind:'guarantee',
        label:'Guarantee Fee',
        mode:'percent',
        rate: 0.005,
        base:'drawn',
        frequency:'semiAnnual',
        accrueFrom:'2026-06-30',
        accrueTo:'2036-01-15',
        ifrs:'IFRS15-overTime',
        // FEE-RATE RATCHET: 0.5% for first 5 years, then steps to 0.6% from 2031
        feeRateSchedule: [
          { from:'2026-06-30', to:'2030-12-31', rate: 0.0050 },
          { from:'2031-01-01', to:'2036-01-15', rate: 0.0060 }
        ],
        notes:'0.5% p.a. on drawn aggregate covered, ratcheting to 0.6% from 2031.'
      }
    ],
    preset:'Volt Multi-Loan · £600m covered across 2 underlyings (SONIA + Fixed)'
  },
  {
    // ----------------------------------------------------------------
    // Aurora Renewables — multi-tranche infrastructure loan
    // Demo example for EIR-at-tranche-level: each tranche has a different
    // coupon AND an EIR-included arrangement fee, so EIR > coupon on each
    // tranche and the deal-level number is a face-weighted aggregate.
    // £120m total: Senior £80m fixed 5.75% + Mezz £40m fixed 9.25%, 5Y bullet.
    // ----------------------------------------------------------------
    id:'auroraMultiTranche',
    positionId:'POS-NWF-AURORA-MT', securityId:'SEC-AURORA-RENEW-MT',
    instrumentKind:'loan',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Aurora Renewables Phase 1',
    position:'NWF 100% Bilateral Position · Aurora Renewables',
    incomeSecurity:'Aurora Renewables Multi-Tranche Facility (£80m Senior 5.75% + £40m Mezz 9.25%)',
    currency:'GBP',
    faceValue:    120_000_000,
    purchasePrice: 120_000_000,
    commitment:   120_000_000,
    settlementDate:'2026-03-01',
    maturityDate:   '2031-03-01',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    holidayCalendar:'ukBank',
    skipHolidays:false,
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    coupon: { type:'Fixed', fixedRate:0, floatingRate:0, spread:0, floor:null, cap:null },
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed:true, businessModel:'HoldToCollect', ecLStage:1, pdAnnual:0.005, lgd:0.40 },
    tranches: [
      {
        id:'auroraSenior',
        label:'Senior tranche · 5.75% fixed',
        faceValue: 80_000_000,
        purchasePrice: 80_000_000,
        commitment:    80_000_000,
        coupon: { type:'Fixed', fixedRate: 0.0575, floatingRate:0, spread:0, floor:null, cap:null },
        dayBasis: '30/360',
        principalRepayment:'AtMaturity',
        principalSchedule: [
          { date:'2026-03-01', type:'initial', amount: 80_000_000 }
        ],
        fees: [
          {
            id:'auroraSeniorArrangement',
            kind:'arrangement',
            label:'Senior Arrangement Fee',
            mode:'flat',
            amount: 400_000,
            base:'face',
            frequency:'oneOff',
            paymentDate:'2026-03-01',
            ifrs:'IFRS9-EIR',
            notes:'£400k arrangement fee on senior tranche. EIR-included per IFRS 9 §B5.4 — spread over life via EIR accretion.'
          }
        ]
      },
      {
        id:'auroraMezz',
        label:'Mezz tranche · 9.25% fixed',
        faceValue: 40_000_000,
        purchasePrice: 40_000_000,
        commitment:    40_000_000,
        coupon: { type:'Fixed', fixedRate: 0.0925, floatingRate:0, spread:0, floor:null, cap:null },
        dayBasis: '30/360',
        principalRepayment:'AtMaturity',
        principalSchedule: [
          { date:'2026-03-01', type:'initial', amount: 40_000_000 }
        ],
        fees: [
          {
            id:'auroraMezzArrangement',
            kind:'arrangement',
            label:'Mezz Arrangement Fee',
            mode:'flat',
            amount: 600_000,
            base:'face',
            frequency:'oneOff',
            paymentDate:'2026-03-01',
            ifrs:'IFRS9-EIR',
            notes:'£600k arrangement fee on mezz tranche. EIR-included — spread over life via EIR accretion. Mezz fee is larger because the tranche is junior.'
          }
        ]
      }
    ],
    preset:'Aurora Renewables Phase 1 · £120m Multi-Tranche (Senior 5.75% + Mezz 9.25%, both with EIR-incl. fees)'
  },
  {
    // ----------------------------------------------------------------
    // Helios Solar Bridge — clean RFR bilateral
    // Demo example for EIR-on-floating-rate: SONIA + ratcheted margin,
    // no EIR-included fees (so EIR is constructed compositionally each
    // period rather than bisection-solved). The 3-period margin ratchet
    // makes the period-by-period EIR construction visible in the trace.
    // £30m bilateral, 5Y bullet, SONIA + 275/300/325 bps ratchet.
    // ----------------------------------------------------------------
    id:'heliosBridge',
    positionId:'POS-NWF-HELIOS-RFR', securityId:'SEC-HELIOS-SOLAR-BRIDGE',
    instrumentKind:'loan',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Helios Solar Bridge',
    position:'NWF 100% Bilateral Position · Helios Solar Bridge',
    incomeSecurity:'Helios Solar Bridge Facility (£30m, Compounded SONIA + Ratcheted Margin)',
    counterpartyId:'HEL001',
    transactionId:'HEL001',
    bilateralFlag:'Bilateral',
    agentName:'Barclays Bank',
    currency:'GBP',
    faceValue:    30_000_000,
    purchasePrice: 30_000_000,
    commitment:   30_000_000,
    settlementDate:'2026-04-15',
    availabilityEnd:'2027-04-15',
    maturityDate:   '2031-04-15',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis:'ACT/365',
    businessDayConvention:'modifiedFollowing',
    holidayCalendar:'ukBank',
    skipHolidays:false,
    coupon: {
      type:'SONIA',
      fixedRate: 0,
      floatingRate: 0,
      spread: 0,
      floor: null, cap: null
    },
    rfr: {
      index: 'SONIA',
      baseRate: 0.0475,                      // illustrative SONIA fix (4.75%)
      lookbackDays: 5,
      rounding: 5
    },
    marginSchedule: [
      { from:'2026-04-15', to:'2028-04-14', marginBps: 275 },   // Years 1-2: 2.75%
      { from:'2028-04-15', to:'2030-04-14', marginBps: 300 },   // Years 3-4: 3.00%
      { from:'2030-04-15', to:'2031-04-15', marginBps: 325 }    // Year 5:    3.25%
    ],
    pik: { enabled:false, rate:0, capitalizationFrequency:'Monthly' },
    principalRepayment: 'AtMaturity',
    principalSchedule: [
      { date:'2026-04-15', type:'draw', amount: 30_000_000, drawdownId:'HEL001_D1', status:'forecast' }
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    fees: [
      {
        id:'heliosCommitment',
        kind:'commitment',
        label:'Commitment Fee',
        mode:'marginLinked',
        marginMultiple: 0.35,
        base:'undrawn',
        frequency:'quarterly',
        paymentSchedule:'lastDayOfEach3MonthPeriod',
        accrueFrom:'2026-04-15',
        accrueTo:'2027-04-15',
        ifrs:'IFRS15-overTime',
        notes:'35% of margin × undrawn commitment × dcf. IFRS 15 over-time recognition — not EIR-included.'
      }
    ],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed:true, businessModel:'HoldToCollect', ecLStage:1, pdAnnual:0.0040, lgd:0.40 },
    type:'simpleDaily',
    preset:'Helios Solar Bridge · £30m Bilateral SONIA + Ratcheted Margin (275/300/325 bps), 5Y bullet'
  },
  {
    // ----------------------------------------------------------------
    // Pacific Energy Bridge — USD-denominated bilateral with FX revaluation
    // Demo example for multi-currency + daily FX revaluation (IAS 21 monetary
    // item translation + IFRS 9 carrying value in functional currency).
    //   • $50m face · 5.00% USD fixed coupon · 5Y bullet · ACT/360
    //   • Reporting/functional currency: GBP
    //   • fxRateSchedule[] supplies GBP-per-USD fixings — the engine reads
    //     these step-effective and computes dailyFXGain = balance × (rate_t - rate_{t-1})
    //   • Journals carry originalAmount (USD), amountLE (GBP), fx (rate)
    // ----------------------------------------------------------------
    id:'pacificEnergyBridge',
    positionId:'POS-NWF-PACIFIC-FX', securityId:'SEC-PACIFIC-ENERGY-USD',
    instrumentKind:'loan',
    legalEntity:'NWF Renewable Equity', leid: 44,
    deal:'Pacific Energy Bridge',
    position:'NWF 100% Bilateral Position · Pacific Energy USD',
    incomeSecurity:'Pacific Energy Bridge Facility (USD 50m, 5.00% fixed, GBP reporting)',
    counterpartyId:'PAC001',
    transactionId:'PAC001',
    bilateralFlag:'Bilateral',
    agentName:'Citi New York',
    currency:'USD',                          // INSTRUMENT currency
    faceValue:    50_000_000,                // USD
    purchasePrice: 50_000_000,
    commitment:   50_000_000,
    settlementDate:'2026-05-01',
    availabilityEnd:'2026-05-01',
    maturityDate:   '2031-05-01',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis:'ACT/360',                      // USD convention
    businessDayConvention:'modifiedFollowing',
    holidayCalendar:'usFederal',
    skipHolidays:false,
    coupon: { type:'Fixed', fixedRate: 0.0500, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-05-01', type:'draw', amount: 50_000_000, drawdownId:'PAC001_D1', status:'forecast' }
    ],
    // ---- FX RATE SCHEDULE (instrument currency USD → functional GBP) ----
    // Step-effective: each fixing applies from its date forward until the next.
    // GBP-per-USD: 0.79 means $1.00 = £0.79 (i.e. $50m books at £39.5m).
    fxRateSchedule: [
      { date:'2026-05-01', rate: 0.7900, note:'Initial spot at signing — illustrative' },
      { date:'2026-12-31', rate: 0.7750, note:'Year-end FY26 reporting fixing' },
      { date:'2027-06-30', rate: 0.7600, note:'H1 FY27 — USD weakening' },
      { date:'2027-12-31', rate: 0.7850, note:'Year-end FY27 — USD strengthening' },
      { date:'2028-06-30', rate: 0.8000, note:'H1 FY28' },
      { date:'2028-12-31', rate: 0.7950, note:'Year-end FY28' },
      { date:'2029-06-30', rate: 0.7800, note:'H1 FY29' },
      { date:'2029-12-31', rate: 0.7650, note:'Year-end FY29 — material GBP gain' },
      { date:'2030-06-30', rate: 0.7700, note:'H1 FY30' },
      { date:'2030-12-31', rate: 0.7850, note:'Year-end FY30' },
      { date:'2031-05-01', rate: 0.7900, note:'Maturity — close to initial' }
    ],
    fees: [
      {
        id:'pacificArrangement',
        kind:'arrangement',
        label:'Arrangement Fee',
        mode:'flat',
        amount: 250_000,                   // USD 250k — EIR-included
        base:'face',
        frequency:'oneOff',
        paymentDate:'2026-05-01',
        ifrs:'IFRS9-EIR',
        notes:'USD 250k arrangement fee paid at signing. EIR-included per IFRS 9 §B5.4 — accreted over 5Y via EIR. FX-translated to GBP at the day-1 fixing (0.7900).'
      }
    ],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed:true, businessModel:'HoldToCollect', ecLStage:1, pdAnnual:0.0060, lgd:0.45 },
    preset:'Pacific Energy Bridge · USD 50m Bilateral 5.00% Fixed 5Y bullet · GBP reporting + FX revaluation'
  },
  {
    // ----------------------------------------------------------------
    // Hudson Manufacturing Senior Notes — USD bilateral booked under US GAAP
    // Demo example for US GAAP CECL impairment (ASC 326) — lifetime expected
    // credit loss recognised from day 1, no IFRS-9-style stage migration.
    //   • $40m senior secured bullet · 5.75% fixed coupon · 5-year · ACT/360
    //   • US borrower, USD reporting, NWF books under US GAAP
    //   • ECL drivers: PD 0.60% annual · LGD 35% · Q-factor 110% (qualitative
    //     overlay for forward-looking macro)
    //   • Per ASC 326-20, the engine should compute a LIFETIME ECL from day 1,
    //     not a 12-month ECL. The CECL Trace panel surfaces the math.
    // ----------------------------------------------------------------
    id:'hudsonSeniorNotes',
    positionId:'POS-NWF-HUDSON-USG', securityId:'SEC-HUDSON-MFG-USG',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Hudson Manufacturing Senior Notes',
    position:'NWF 100% Bilateral Position · Hudson Manufacturing',
    incomeSecurity:'Hudson Manufacturing Senior Secured Notes (USD 40m, 5.75% fixed, OID + EIR fee · US GAAP / CECL)',
    counterpartyId:'HUD001',
    transactionId:'HUD001',
    bilateralFlag:'Bilateral',
    agentName:'JPMorgan New York',
    currency:'USD',
    accountingFramework:'USGAAP',            // ← framework set at deal origination
    faceValue:    40_000_000,                // par at maturity
    purchasePrice: 39_500_000,               // purchased at $0.9875 = $500k OID
    commitment:   40_000_000,
    // ---- OID treatment (Transtype #1) ----
    // PP < FV creates $500k Original Issue Discount.
    // Treatment: 'auto' (engine infers oid from PP vs FV)
    // Method:    effective-interest (IFRS 9 §B5.4 / ASC 310-20-35-26 compliant)
    // Engine separates OID accretion from EIR fee accretion in journal output —
    // see "Discount Accretion" vs "EIR Fee Accretion" transtypes in Stage 2.
    oidTreatment:'auto',
    oidMethod:'effective-interest',
    settlementDate:'2026-06-01',
    availabilityEnd:'2026-06-01',
    maturityDate:   '2031-06-01',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis:'ACT/360',                      // USD convention
    businessDayConvention:'modifiedFollowing',
    holidayCalendar:'usFederal',
    skipHolidays:false,
    coupon: { type:'Fixed', fixedRate: 0.0575, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-06-01', type:'draw', amount: 40_000_000, drawdownId:'HUD001_D1', status:'forecast' }
    ],
    fees: [
      {
        id:'hudsonOrigination',
        kind:'arrangement',
        label:'Origination Fee',
        mode:'flat',
        amount: 300_000,                     // USD 300k — ASC 310-20 EIR
        base:'face',
        frequency:'oneOff',
        paymentDate:'2026-06-01',
        ifrs:'ASC310-20-EIR',                // US GAAP equivalent of IFRS9-EIR
        notes:'USD 300k origination fee paid at signing. ASC 310-20 — capitalised into EIR and accreted over 5Y. Equivalent treatment to IFRS 9 §B5.4.'
      }
    ],
    // ---- IFRS block — reused as the canonical "credit metadata" block ----
    // Under CECL the same PD/LGD/EAD inputs feed a different formula. The
    // engine reads `accountingFramework` and branches the ECL math.
    ifrs: {
      ifrs9Classification:'AmortisedCost',   // US GAAP equivalent: Held-to-Maturity
      sppiPassed: true,
      businessModel:'HoldToCollect',
      ecLStage: 1,                           // ignored under CECL; left as default
      pdAnnual: 0.0060,                       // 0.60% annual PD
      lgd:      0.35,                         // 35% LGD
      qFactor:  1.10,                         // CECL qualitative factor (forward-looking overlay)
      macroOverlayWeight: 1.10                // shared label for IFRS macro / CECL Q-factor
    },
    preset:'Hudson Manufacturing Senior Notes · USD 40m · US GAAP / ASC 326 CECL demo'
  },
  /* ─────────────────────────────────────────────────────────────────────────
     US GAAP — EIR Method proof deals (Folder 1 spec)

     Three reference instruments reconciled against the proof workbooks in
     "loan calculator files 1/". Each deal targets a specific calculation
     method so you can switch the EIR Method dropdown and see the engine's
     answer match the spec exactly:

       • mainStreetTest    — Method 1 proof   · EIR ≈ 14.46%
       • interestATSample1 — Method 2 proof   · EIR ≈ 14.96% / 15.82%
       • interestATRandom  — Method 3 + Method 1 dual demo · 16.06% / 16.83%

     These ship as draftable / illustrative records, accountingFramework=USGAAP,
     so they only exercise the Interest AT 4-method calculator path.
     ────────────────────────────────────────────────────────────────────── */
  {
    id:'mainStreetTest',
    positionId:'POS-NWF-MSTR-EIR1', securityId:'SEC-MSTR-EIR-METHOD1',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Main Street Capital — Method 1 Test',
    position:'NWF 100% Bilateral · Method 1 EIR proof',
    incomeSecurity:'Main Street Capital Sub-Debt (USD 1.32m face, Method 1 custom-formula proof)',
    currency:'USD',
    accountingFramework:'USGAAP',
    eirMethod:'method1',
    faceValue:    1_320_000,        // P
    purchasePrice: 1_227_600,        // CV
    commitment:   1_320_000,
    settlementDate:'2008-10-14',
    maturityDate:   '2013-10-17',
    dayBasis:'ACT/365',
    holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.13, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    principalRepayment:'AtMaturity',
    principalSchedule: [{ date:'2008-10-14', type:'draw', amount: 1_320_000, status:'actual' }],
    fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed:true, businessModel:'HoldToCollect', ecLStage:1, pdAnnual:0.005, lgd:0.40, qFactor:1.0 },
    preset:'Main Street Capital · Method 1 (P/CV)^(1/m) - 1 + (I1+I2) proof · expected EIR ≈ 14.46%'
  },
  {
    id:'interestATSample1',
    positionId:'POS-NWF-IATS1-EIR2', securityId:'SEC-IATS1-EIR-METHOD2',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Interest AT Sample 1 — Method 2 Test',
    position:'NWF 100% Bilateral · Method 2 PRICE proof',
    incomeSecurity:'Interest AT Sample 1 Bond (USD 11.12m face, PRICE method proof)',
    currency:'USD',
    accountingFramework:'USGAAP',
    eirMethod:'method2',
    faceValue:    11_120_346.43,    // P
    purchasePrice: 10_183_896.20,    // CV (purchase at discount)
    commitment:   11_120_346.43,
    settlementDate:'2009-11-13',
    maturityDate:   '2016-11-13',
    dayBasis:'30/360',
    holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.13, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    principalRepayment:'AtMaturity',
    principalSchedule: [{ date:'2009-11-13', type:'draw', amount: 11_120_346.43, status:'actual' }],
    fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed:true, businessModel:'HoldToCollect', ecLStage:1, pdAnnual:0.0075, lgd:0.40, qFactor:1.0 },
    preset:'Interest AT Sample 1 · Method 2 PRICE bisection proof · expected EIR ≈ 15.82% (annual)'
  },
  {
    id:'interestATRandom',
    positionId:'POS-NWF-IATR-EIR3', securityId:'SEC-IATR-EIR-METHOD3',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Interest AT Random Test — Method 3 Test',
    position:'NWF 100% Bilateral · Method 3 generic formula proof',
    incomeSecurity:'Interest AT Random Test (USD 10m face, Cash + PIK, generic-formula proof)',
    currency:'USD',
    accountingFramework:'USGAAP',
    eirMethod:'method3',
    faceValue:    10_000_000,       // P
    purchasePrice:  9_000_000,       // CV
    commitment:   10_000_000,
    settlementDate:'2013-06-12',
    maturityDate:   '2023-06-12',
    dayBasis:'30/360',
    holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.10, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:true, rate:0.05, capitalizationFrequency:'Quarterly' },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    principalRepayment:'AtMaturity',
    principalSchedule: [{ date:'2013-06-12', type:'draw', amount: 10_000_000, status:'actual' }],
    fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed:true, businessModel:'HoldToCollect', ecLStage:1, pdAnnual:0.01, lgd:0.45, qFactor:1.10 },
    preset:'Interest AT Random · Method 3 generic-formula proof · expected EIR ≈ 16.83% (Method 3) / 16.06% (Method 1)'
  },
  {
    // ----------------------------------------------------------------
    // Harbor Manufacturing — Premium Amortisation demo (Transtype #2)
    //
    // Counterpart to Hudson (which demos OID where PP < Face). Harbor is
    // purchased at $40.5m for $40m face — a $500k premium that AMORTISES
    // over the loan's life. Engine produces a "Premium Amortization" JE pair
    // (income leg DR 421000 / offset CR 141000) — opposite sign to OID.
    //
    //   • $40m senior notes · 6.00% coupon · 5Y bullet · ACT/360
    //   • $500k premium (purchased above par)
    //   • US GAAP / CECL · no upfront fee (clean premium-only demo)
    // ----------------------------------------------------------------
    id:'harborSeniorNotes',
    positionId:'POS-NWF-HARBOR-USG', securityId:'SEC-HARBOR-MFG-USG',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Harbor Manufacturing Senior Notes — Premium',
    position:'NWF 100% Bilateral Position · Harbor Manufacturing',
    incomeSecurity:'Harbor Manufacturing Senior Notes (USD 40m, 6.00% fixed, purchased at premium · US GAAP)',
    counterpartyId:'HBR001',
    transactionId:'HBR001',
    bilateralFlag:'Bilateral',
    agentName:'Wells Fargo',
    currency:'USD',
    accountingFramework:'USGAAP',
    faceValue:    40_000_000,
    purchasePrice: 40_500_000,               // purchased ABOVE par → $500k premium
    commitment:   40_000_000,
    settlementDate:'2026-07-01',
    availabilityEnd:'2026-07-01',
    maturityDate:   '2031-07-01',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis:'ACT/360',
    businessDayConvention:'modifiedFollowing',
    holidayCalendar:'usFederal',
    skipHolidays:false,
    coupon: { type:'Fixed', fixedRate: 0.0600, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-07-01', type:'draw', amount: 40_000_000, drawdownId:'HBR001_D1', status:'forecast' }
    ],
    // Premium treatment (Transtype #2). Auto-resolves to 'premium' since PP > FV.
    oidTreatment:'auto',
    oidMethod:'effective-interest',
    fees: [],                                  // no upfront fee → clean premium-only demo
    ifrs: {
      ifrs9Classification:'AmortisedCost',
      sppiPassed: true,
      businessModel:'HoldToCollect',
      ecLStage: 1,
      pdAnnual: 0.0050,
      lgd:      0.30,
      qFactor:  1.00
    },
    preset:'Harbor Manufacturing · USD 40m premium-purchase demo · US GAAP / Premium Amortisation (Transtype #2)'
  },
  {
    // ----------------------------------------------------------------
    // Cascade Industries — Mid-Period Purchase demo (Transtype #3)
    //
    // NWF acquires a senior note on the secondary market 90 days after the
    // last coupon. Buyer must pay seller for the accrued-but-unpaid interest
    // at the trade date. Engine emits a JE pair on tradeDate:
    //   DR 113000 Interest Receivable (purchased)
    //   CR 111000 Cash                (paid to seller)
    // The receivable then clears on the next coupon when NWF receives the
    // full semi-annual coupon.
    //
    //   • $25m senior notes · 6.50% coupon · semi-annual · ACT/360
    //   • Originally issued 2025-09-01; NWF purchases on 2026-03-01 (= 91 days
    //     into the 2026-03 semi-annual period after the 2025-12-01 coupon).
    //   • Accrued interest = $25m × 6.50% × 91/360 = $410,694.44
    // ----------------------------------------------------------------
    id:'cascadeIndustries',
    positionId:'POS-NWF-CASC-USG', securityId:'SEC-CASC-MIDPER-USG',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Cascade Industries Senior Notes — Mid-Period Purchase',
    position:'NWF 100% Bilateral Position · Cascade Industries',
    incomeSecurity:'Cascade Industries Senior Notes (USD 25m, 6.50% fixed, secondary purchase · US GAAP)',
    counterpartyId:'CSC001',
    transactionId:'CSC001',
    bilateralFlag:'Bilateral',
    agentName:'Goldman Sachs',
    currency:'USD',
    accountingFramework:'USGAAP',
    faceValue:    25_000_000,
    purchasePrice: 25_000_000,                  // bought at par on secondary market
    commitment:   25_000_000,
    settlementDate:'2026-03-01',                // NWF takes the position
    availabilityEnd:'2026-03-01',
    maturityDate:   '2030-09-01',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis:'ACT/360',
    businessDayConvention:'modifiedFollowing',
    holidayCalendar:'usFederal',
    skipHolidays:false,
    coupon: { type:'Fixed', fixedRate: 0.0650, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-03-01', type:'draw', amount: 25_000_000, drawdownId:'CSC001_D1', status:'actual' }
    ],
    // ── Transtype #3 — Mid-period purchase ──
    // 91 days since last coupon (2025-12-01) × 6.50% × $25m / 360 = $410,694.44
    tradeDate: '2026-03-01',
    tradeAccruedInterest: 410_694.44,
    oidTreatment:'none',                       // bought at par — no OID
    oidMethod:'effective-interest',
    fees: [],
    ifrs: {
      ifrs9Classification:'AmortisedCost',
      sppiPassed: true,
      businessModel:'HoldToCollect',
      ecLStage: 1,
      pdAnnual: 0.0055,
      lgd:      0.35,
      qFactor:  1.05
    },
    preset:'Cascade Industries · USD 25m mid-period purchase demo · US GAAP / Accrued Interest at Trade (Transtype #3)'
  },
  {
    // ----------------------------------------------------------------
    // Driftwood Resorts — Prepayment demo (Transtype #4)
    //
    // 5Y bullet term loan that gets partially prepaid mid-life. Borrower
    // pays down $15m of a $25m balance 24 months into the loan (refinance).
    // Engine emits a "Loan Prepayment" JE pair (DR Cash / CR Loan asset),
    // distinct from the scheduled "Loan Repayment" transtype, so reports
    // can identify prepayments separately.
    //
    //   • $25m face · 7.00% fixed · 5Y bullet · ACT/360
    //   • Settle 2026-04-15 · mature 2031-04-15
    //   • Prepayment of $15m on 2028-04-15 (24 months in, leaves $10m balance)
    // ----------------------------------------------------------------
    id:'driftwoodResorts',
    positionId:'POS-NWF-DRIFT-USG', securityId:'SEC-DRIFT-PREPAY-USG',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Driftwood Resorts Term Loan — Prepayment Demo',
    position:'NWF 100% Bilateral Position · Driftwood Resorts',
    incomeSecurity:'Driftwood Resorts Term Loan (USD 25m, 7.00% fixed, with mid-life prepayment · US GAAP)',
    counterpartyId:'DWR001',
    transactionId:'DWR001',
    bilateralFlag:'Bilateral',
    agentName:'Bank of America',
    currency:'USD',
    accountingFramework:'USGAAP',
    faceValue:    25_000_000,
    purchasePrice: 25_000_000,
    commitment:   25_000_000,
    settlementDate:'2026-04-15',
    availabilityEnd:'2026-04-15',
    maturityDate:   '2031-04-15',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis:'ACT/360',
    businessDayConvention:'modifiedFollowing',
    holidayCalendar:'usFederal',
    skipHolidays:false,
    coupon: { type:'Fixed', fixedRate: 0.0700, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    principalRepayment:'AtMaturity',
    // ── Transtype #4 — Prepayment event in the principalSchedule ──
    principalSchedule: [
      { date:'2026-04-15', type:'draw',       amount: 25_000_000, drawdownId:'DWR001_D1', status:'actual'   },
      { date:'2028-04-15', type:'prepayment', amount: 15_000_000, eventId:  'DWR001_P1', status:'forecast', reason:'voluntary refinance' }
    ],
    // ── Transtype #5 — Prepayment penalty schedule ──
    // Standard "step-down" pattern: higher penalty in early years to compensate
    // the lender for lost yield; tapers to zero as the loan matures.
    //   Year 1  (2026-04-15 → 2027-04-14): 1.50%
    //   Year 2  (2027-04-15 → 2028-04-14): 1.00%
    //   Year 3  (2028-04-15 → 2029-04-14): 0.50%
    //   Year 4+ (2029-04-15 → maturity):   0.00% (no penalty)
    // Driftwood's prepayment on 2028-04-15 falls in Year 3 → penalty = $15m × 0.5% = $75,000
    prepaymentPenaltySchedule: [
      { from:'2026-04-15', to:'2027-04-14', ratePct: 0.0150 },
      { from:'2027-04-15', to:'2028-04-14', ratePct: 0.0100 },
      { from:'2028-04-15', to:'2029-04-14', ratePct: 0.0050 },
      { from:'2029-04-15', to:'2031-04-15', ratePct: 0.0000 }
    ],
    oidTreatment:'none',
    oidMethod:'effective-interest',
    fees: [],
    ifrs: {
      ifrs9Classification:'AmortisedCost',
      sppiPassed: true,
      businessModel:'HoldToCollect',
      ecLStage: 1,
      pdAnnual: 0.0070,
      lgd:      0.40,
      qFactor:  1.00
    },
    preset:'Driftwood Resorts · USD 25m with $15m prepayment in 2028 · US GAAP / Prepayment (Transtype #4)'
  },
  {
    // ----------------------------------------------------------------
    // Obsidian Holdings — Default Interest demo (Transtype #6)
    //
    // Senior secured term loan that goes into payment default 24 months into
    // its 5-year life. From the default event date forward, the borrower owes
    // additional "default interest" at coupon rate + 4.00% (penalty spread)
    // plus a $50k one-time default fee.
    //
    //   • $20m face · 5.50% coupon · 5Y bullet · ACT/360
    //   • Settle 2026-05-01 · mature 2031-05-01
    //   • Default event 2028-05-01 (Year 2 anniversary)
    //     - Default rate spread: 400 bps over coupon (i.e., 9.50% all-in)
    //     - Default fee:         $50,000 one-time
    //   • Migrated to Stage 3 (credit-impaired) per IFRS 9 §5.5
    // ----------------------------------------------------------------
    id:'obsidianHoldings',
    positionId:'POS-NWF-OBSI-USG', securityId:'SEC-OBSI-DEFAULT-USG',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Obsidian Holdings Senior Notes — Default Interest Demo',
    position:'NWF 100% Bilateral Position · Obsidian Holdings',
    incomeSecurity:'Obsidian Holdings Senior Notes (USD 20m, 5.50% fixed → default 2028-05-01, +400bps default rate · US GAAP)',
    counterpartyId:'OBS001',
    transactionId:'OBS001',
    bilateralFlag:'Bilateral',
    agentName:'Citi',
    currency:'USD',
    accountingFramework:'USGAAP',
    faceValue:    20_000_000,
    purchasePrice: 20_000_000,
    commitment:   20_000_000,
    settlementDate:'2026-05-01',
    availabilityEnd:'2026-05-01',
    maturityDate:   '2031-05-01',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis:'ACT/360',
    businessDayConvention:'modifiedFollowing',
    holidayCalendar:'usFederal',
    skipHolidays:false,
    coupon: { type:'Fixed', fixedRate: 0.0550, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-05-01', type:'draw', amount: 20_000_000, drawdownId:'OBS001_D1', status:'actual' }
    ],
    // ── Transtype #6 — Default Interest event ──
    // Engine accrues balance × (defaultRateBps/10000) × dcf each day in the
    // [date, endDate] window, and books the one-time defaultFeeAmount on the
    // event date itself. Distinct JE pairs ("Default Interest Income" /
    // "Default Interest Receivable") routed to 421000 / 113000.
    defaultEvents: [
      {
        date:        '2028-05-01',          // payment default — Year 2 anniversary
        endDate:     '2031-05-01',          // through maturity (no cure)
        defaultRateBps: 400,                // 4.00% additional over coupon
        defaultFeeAmount: 50_000,           // one-time $50k default fee
        reason:      'Missed scheduled semi-annual coupon payment',
        coveredByCovenants: ['Section 7.2 — Payment Default', 'Section 7.5 — Default Interest']
      }
    ],
    oidTreatment:'none',
    oidMethod:'effective-interest',
    fees: [],
    ifrs: {
      ifrs9Classification:'AmortisedCost',
      sppiPassed: true,
      businessModel:'HoldToCollect',
      ecLStage: 3,                          // credit-impaired
      pdAnnual: 0.1500,                     // 15% — very high default risk
      lgd:      0.40,
      qFactor:  1.20
    },
    preset:'Obsidian Holdings · USD 20m default at Year 2 · US GAAP / Default Interest +400bps + $50k fee (Transtype #6)'
  },
  {
    // ----------------------------------------------------------------
    // Quartz Holdings — Write-Off demo (Transtype #8)
    //
    // Senior term loan whose recovery efforts fail. Goes into default at Year 2,
    // ECL allowance is built up to $5m (Stage 3 lifetime ECL), then written off
    // at Year 4 when collections are abandoned.
    //
    //   • $15m face · 6.00% coupon · 5Y bullet · ACT/360
    //   • Default 2028-02-01 (Year 2 anniversary, +300 bps default rate)
    //   • Write-off 2030-02-01 (Year 4, full $15m carrying)
    //   • ECL allowance pre-write-off ≈ $5m → absorbs first $5m
    //   • Residual $10m hits 470000 Impairment Expense as P&L charge
    // ----------------------------------------------------------------
    id:'quartzHoldings',
    positionId:'POS-NWF-QRTZ-USG', securityId:'SEC-QRTZ-WRITEOFF-USG',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Quartz Holdings Term Loan — Write-Off Demo',
    position:'NWF 100% Bilateral Position · Quartz Holdings',
    incomeSecurity:'Quartz Holdings Term Loan (USD 15m, 6.00% fixed, default→write-off · US GAAP)',
    counterpartyId:'QRT001',
    transactionId:'QRT001',
    bilateralFlag:'Bilateral',
    agentName:'Morgan Stanley',
    currency:'USD',
    accountingFramework:'USGAAP',
    faceValue:    15_000_000,
    purchasePrice: 15_000_000,
    commitment:   15_000_000,
    settlementDate:'2026-02-01',
    availabilityEnd:'2026-02-01',
    maturityDate:   '2031-02-01',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis:'ACT/360',
    businessDayConvention:'modifiedFollowing',
    holidayCalendar:'usFederal',
    skipHolidays:false,
    coupon: { type:'Fixed', fixedRate: 0.0600, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    principalRepayment:'AtMaturity',
    // Draw at signing + write-off at Year 4 (Transtype #8)
    principalSchedule: [
      { date:'2026-02-01', type:'draw',     amount: 15_000_000, drawdownId:'QRT001_D1', status:'actual'   },
      { date:'2030-02-01', type:'writeOff', amount: 15_000_000, eventId:  'QRT001_W1', status:'actual',
        reason:'Recovery efforts exhausted; collateral realisation incomplete; borrower in Chapter 7' }
    ],
    defaultEvents: [
      { date:'2028-02-01', endDate:'2030-02-01', defaultRateBps: 300, defaultFeeAmount: 30_000,
        reason:'Missed coupon payment; covenant breach' }
    ],
    oidTreatment:'none',
    oidMethod:'effective-interest',
    fees: [],
    ifrs: {
      ifrs9Classification:'AmortisedCost',
      sppiPassed: true,
      businessModel:'HoldToCollect',
      ecLStage: 3,                          // credit-impaired, lifetime ECL
      pdAnnual: 0.0800,                     // 8% — tuned so allowance ≈ $5m at write-off
      lgd:      0.20,                       //  → 0.08 × 0.20 × 15m × ~4y × 1.0 ≈ $4.8m
      qFactor:  1.00
    },
    preset:'Quartz Holdings · USD 15m default → write-off in Year 4 · US GAAP / Write-Off (Transtype #8)'
  },
  {
    // ----------------------------------------------------------------
    // Garnet Industries — Sudden Default Write-Off demo (Transtype #8 partial)
    //
    // Performing Stage 1 loan that suddenly writes off due to a one-event
    // catastrophe (fraud / fire / bankruptcy filing) before the lender has
    // accumulated significant allowance. The Stage 1 12-month ECL only covers
    // a small fraction; the bulk hits P&L as an immediate impairment expense.
    //
    //   • $10m face · 5.00% coupon · 5Y bullet · ACT/360
    //   • Stage 1 with PD 0.5% × LGD 35% → ~$17.5k allowance after 1 year
    //   • Catastrophic write-off after 18 months: allowance covers tiny portion,
    //     residual ≈ $10m hits 470000 Impairment Expense
    //
    // Shows the OTHER branch of the write-off split logic: residual P&L charge
    // when allowance is insufficient.
    // ----------------------------------------------------------------
    id:'garnetIndustries',
    positionId:'POS-NWF-GRNT-USG', securityId:'SEC-GRNT-SUDDEN-USG',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Garnet Industries Term Loan — Sudden Write-Off Demo',
    position:'NWF 100% Bilateral Position · Garnet Industries',
    incomeSecurity:'Garnet Industries Term Loan (USD 10m, 5.00%, sudden write-off · US GAAP)',
    counterpartyId:'GAR001',
    transactionId:'GAR001',
    bilateralFlag:'Bilateral',
    agentName:'Wells Fargo',
    currency:'USD',
    accountingFramework:'USGAAP',
    faceValue:    10_000_000,
    purchasePrice: 10_000_000,
    commitment:   10_000_000,
    settlementDate:'2026-03-01',
    availabilityEnd:'2026-03-01',
    maturityDate:   '2031-03-01',
    dayBasis:'ACT/360',
    holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.0500, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-03-01', type:'draw',     amount: 10_000_000, drawdownId:'GAR001_D1', status:'actual'   },
      { date:'2027-09-01', type:'writeOff', amount: 10_000_000, eventId:  'GAR001_W1', status:'actual',
        reason:'Sudden bankruptcy filing — Chapter 7 — no recoverable collateral' },
      // ── Transtype #9 — Recovery 12 months later ──
      // Bankruptcy estate distributes $1.2m to NWF after asset realisation.
      // Credited to 470000 Impairment (reverses portion of prior write-off charge).
      { date:'2028-09-01', type:'recovery', amount: 1_200_000,  eventId:  'GAR001_R1', status:'actual',
        reason:'Bankruptcy estate distribution — pro-rata recovery on Chapter 7 claim' }
    ],
    // No defaultEvents — the borrower goes from performing to bankrupt in one event.
    oidTreatment:'none',
    fees: [],
    ifrs: {
      ifrs9Classification:'AmortisedCost',
      sppiPassed: true,
      businessModel:'HoldToCollect',
      ecLStage: 1,                          // performing — 12-month ECL only
      pdAnnual: 0.0050,                     // 0.5% — low default expectation
      lgd:      0.35,
      qFactor:  1.00
    },
    preset:'Garnet Industries · USD 10m sudden write-off with minimal allowance · US GAAP / Write-Off residual (Transtype #8)'
  },
  {
    // ----------------------------------------------------------------
    // Topaz Foods — Stage Cure demo (Transtype #10)
    //
    // Stage 1 performing loan that drops to Stage 3 mid-life after a covenant
    // breach, accumulates a $2.5m allowance, then cures back to Stage 2 a year
    // later. ECL allowance is released back to P&L.
    //
    //   • $12m face · 5.50% coupon · 5Y bullet · ACT/360
    //   • Cure event 2029-05-01: releases $2.5m allowance back to P&L
    // ----------------------------------------------------------------
    id:'topazFoods',
    positionId:'POS-NWF-TPZ-USG', securityId:'SEC-TPZ-CURE-USG',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Topaz Foods Term Loan — Cure Demo',
    position:'NWF 100% Bilateral Position · Topaz Foods',
    incomeSecurity:'Topaz Foods Term Loan (USD 12m, 5.50% fixed, Stage 3 cure · US GAAP)',
    counterpartyId:'TPZ001', transactionId:'TPZ001', bilateralFlag:'Bilateral', agentName:'PNC Bank',
    currency:'USD',
    accountingFramework:'USGAAP',
    faceValue:    12_000_000, purchasePrice: 12_000_000, commitment: 12_000_000,
    settlementDate:'2026-05-01', maturityDate:'2031-05-01',
    dayBasis:'ACT/360', holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.0550, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-05-01', type:'draw', amount: 12_000_000, drawdownId:'TPZ001_D1', status:'actual' },
      // ── Transtype #10 — Cure event releases $2.5m of allowance ──
      { date:'2029-05-01', type:'cure', releaseAmount: 2_500_000, eventId:'TPZ001_C1', status:'actual',
        fromStage: 3, toStage: 2, reason:'Covenant cure — leverage ratio back within band; payments current' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: {
      ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
      ecLStage: 3, pdAnnual: 0.10, lgd: 0.30, qFactor: 1.0
    },
    preset:'Topaz Foods · USD 12m cure releases $2.5m allowance back to P&L · US GAAP / Cure (Transtype #10)'
  },
  {
    // ----------------------------------------------------------------
    // Sapphire Logistics — Forbearance demo (Transtype #11)
    //
    // 5Y term loan that gets a 6-month interest holiday in Year 3 due to
    // pandemic-style stress. The expected deferred interest is reclassified
    // from regular Interest Receivable into a Deferred Interest sub-account.
    //
    //   • $18m face · 6.00% coupon · 5Y bullet · ACT/360
    //   • Forbearance start 2028-07-01 with $540k of expected deferral
    //     ($18m × 6% × 6/12 = $540k)
    // ----------------------------------------------------------------
    id:'sapphireLogistics',
    positionId:'POS-NWF-SPH-USG', securityId:'SEC-SPH-FORBEAR-USG',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Sapphire Logistics Term Loan — Forbearance Demo',
    position:'NWF 100% Bilateral Position · Sapphire Logistics',
    incomeSecurity:'Sapphire Logistics Term Loan (USD 18m, 6.00% fixed, 6-mo forbearance · US GAAP)',
    counterpartyId:'SPH001', transactionId:'SPH001', bilateralFlag:'Bilateral', agentName:'KeyBank',
    currency:'USD',
    accountingFramework:'USGAAP',
    faceValue: 18_000_000, purchasePrice: 18_000_000, commitment: 18_000_000,
    settlementDate:'2026-06-01', maturityDate:'2031-06-01',
    dayBasis:'ACT/360', holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.0600, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-06-01', type:'draw', amount: 18_000_000, drawdownId:'SPH001_D1', status:'actual' },
      // ── Transtype #11 — Forbearance start: reclass expected deferred interest ──
      { date:'2028-07-01', type:'forbearance', deferredAmount: 540_000, eventId:'SPH001_F1', status:'actual',
        endDate:'2029-01-01', holidayType:'interestHoliday',
        reason:'Pandemic-stress 6-month interest holiday — accrual continues, cash settlement deferred' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: {
      ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
      ecLStage: 2, pdAnnual: 0.025, lgd: 0.35, qFactor: 1.10
    },
    preset:'Sapphire Logistics · USD 18m with 6-mo forbearance · US GAAP / Deferred Interest Reclass (Transtype #11)'
  },
  {
    // ----------------------------------------------------------------
    // Emerald Pharma — Capitalised Origination Costs demo (Transtype #12)
    //
    // Senior secured term loan where NWF incurs $150k of legal, due-diligence,
    // and structuring costs at origination. Under IFRS 9 §B5.4 / ASC 310-20-25-2
    // these are CAPITALISED into the loan's carrying value (rather than expensed
    // immediately), increasing day-1 carrying and reducing effective yield.
    //
    //   • $22m face · 5.25% coupon · 5Y bullet · ACT/360
    //   • $150k capitalised origination costs paid on signing
    // ----------------------------------------------------------------
    id:'emeraldPharma',
    positionId:'POS-NWF-EMR-USG', securityId:'SEC-EMR-CAPCOST-USG',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Emerald Pharma Term Loan — Capitalised Costs Demo',
    position:'NWF 100% Bilateral Position · Emerald Pharma',
    incomeSecurity:'Emerald Pharma Term Loan (USD 22m, 5.25% fixed, $150k capitalised costs · US GAAP)',
    counterpartyId:'EMR001', transactionId:'EMR001', bilateralFlag:'Bilateral', agentName:'Truist',
    currency:'USD',
    accountingFramework:'USGAAP',
    faceValue: 22_000_000, purchasePrice: 22_000_000, commitment: 22_000_000,
    settlementDate:'2026-08-01', maturityDate:'2031-08-01',
    dayBasis:'ACT/360', holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.0525, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-08-01', type:'draw', amount: 22_000_000, drawdownId:'EMR001_D1', status:'actual' },
      // ── Transtype #12 — Capitalised origination costs paid at signing ──
      { date:'2026-08-01', type:'capitalisedCost', amount: 150_000, eventId:'EMR001_CC1', status:'actual',
        category:'legal + transaction + valuation', reason:'IFRS 9 §B5.4 / ASC 310-20-25-2 — costs incremental to origination' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: {
      ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
      ecLStage: 1, pdAnnual: 0.005, lgd: 0.30, qFactor: 1.0
    },
    preset:'Emerald Pharma · USD 22m with $150k capitalised origination costs · US GAAP / IFRS 9 §B5.4 (Transtype #12)'
  },
  // ───────────────────── Maple Heights Term Loan ─────────────────────
  // Transtype #13 — Loan Sale (Full Derecognition)
  //
  // NWF originates a $10m bilateral term loan to Maple Heights, then sells
  // it 18 months later (mid-life) to a competing lender for $9.5m cash —
  // a $500k loss on disposal. Per IFRS 9 §3.2.3 / ASC 860 the entire
  // carrying value is derecognised; cash flows in; difference flows to
  // P&L as Realised Loss on Loan Sale.
  //
  //   • $10m face · 4.50% fixed · 5Y bullet · ACT/360
  //   • Sold on 2027-02-01 for $9.50m → $500k loss
  // ----------------------------------------------------------------
  {
    id:'mapleHeightsTermLoan',
    positionId:'POS-NWF-MPL-IFRS', securityId:'SEC-MPL-LOANSALE-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF EMEA Credit', leid: 41,
    deal:'Maple Heights Term Loan — Loan Sale Demo',
    position:'NWF 100% Bilateral Position · Maple Heights',
    incomeSecurity:'Maple Heights Term Loan (USD 10m, 4.50% fixed · IFRS 9 §3.2.3 — Full Sale at Loss)',
    counterpartyId:'MPL001', transactionId:'MPL001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 10_000_000, purchasePrice: 10_000_000, commitment: 10_000_000,
    settlementDate:'2025-08-01', maturityDate:'2030-08-01',
    dayBasis:'ACT/360', holidayCalendar:'none',
    coupon: { type:'Fixed', fixedRate: 0.0450, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2025-08-01', type:'draw',     amount: 10_000_000, drawdownId:'MPL001_D1', status:'actual' },
      // ── Transtype #13 — Loan sold to competing lender at $500k loss ──
      { date:'2027-02-01', type:'loanSale', salePrice:  9_500_000, eventId:'MPL001_LS1', status:'actual',
        reason:'Portfolio rebalance — full sale to Pacific Credit Partners (IFRS 9 §3.2.3 full derecog)' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: {
      ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
      ecLStage: 1, pdAnnual: 0.008, lgd: 0.35, qFactor: 1.0
    },
    preset:'Maple Heights · USD 10m bilateral · sold mid-life at $500k loss · IFRS 9 §3.2.3 (Transtype #13)'
  },
  // ─────────────────── Cedar Ridge Senior Term Loan ───────────────────
  // Transtype #14 — Loan Participation / Partial Sell-Down
  //
  // NWF originates a $20m bilateral term loan to Cedar Ridge then,
  // 12 months later, sells a 50% participation interest to Pacific
  // Credit Partners for $10.05m cash — a $50k gain on the participated
  // half. Per IFRS 9 §3.2.6 "fully proportionate share" transfer test,
  // derecognise the participated proportion only; keep the remaining
  // 50% on balance sheet accruing.
  //
  //   • $20m face · 4.75% fixed · 4Y bullet · ACT/360
  //   • Sells 50% on 2026-06-15 for $10.05m → $50k gain on sold half
  // ----------------------------------------------------------------
  {
    id:'cedarRidgeParticipation',
    positionId:'POS-NWF-CDR-IFRS', securityId:'SEC-CDR-PARTIC-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Cedar Ridge Senior Term Loan — Participation Demo',
    position:'NWF 50% Bilateral Position (post-participation) · Cedar Ridge',
    incomeSecurity:'Cedar Ridge Senior Term Loan (USD 20m, 4.75% fixed · IFRS 9 §3.2.6 — 50% Participation)',
    counterpartyId:'CDR001', transactionId:'CDR001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 20_000_000, purchasePrice: 20_000_000, commitment: 20_000_000,
    settlementDate:'2025-06-15', maturityDate:'2029-06-15',
    dayBasis:'ACT/360', holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.0475, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2025-06-15', type:'draw', amount: 20_000_000, drawdownId:'CDR001_D1', status:'actual' },
      // ── Transtype #14 — 50% participation sold to Pacific Credit Partners at small gain ──
      { date:'2026-06-15', type:'participation', fraction: 0.50, salePrice: 10_050_000,
        eventId:'CDR001_PT1', status:'actual',
        participant:'Pacific Credit Partners',
        reason:'Risk diversification — fully proportionate participation (IFRS 9 §3.2.6 pass)' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: {
      ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
      ecLStage: 1, pdAnnual: 0.006, lgd: 0.30, qFactor: 1.0
    },
    preset:'Cedar Ridge · USD 20m bilateral · 50% participation at $50k gain · IFRS 9 §3.2.6 (Transtype #14)'
  },
  // ───────────────── Birchwood Industries Term Loan ─────────────────
  // Transtype #15 — Debt-for-Equity Swap
  //
  // Birchwood Industries (distressed borrower) restructures its $15m
  // senior loan by issuing common equity in lieu of repayment. The
  // equity received has an independently appraised fair value of $9m
  // — a $6m restructuring loss per IFRIC 19 / ASC 470-50-40.
  //
  //   • $15m face · 6.25% fixed · 3Y bullet · ACT/360
  //   • Swap event on 2026-12-01: equityFairValue $9m → $6m loss
  // ----------------------------------------------------------------
  {
    id:'birchwoodD4ESwap',
    positionId:'POS-NWF-BCH-IFRS', securityId:'SEC-BCH-D4ESWAP-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF EMEA Credit', leid: 41,
    deal:'Birchwood Industries — Debt-for-Equity Swap Demo',
    position:'NWF Bilateral Position · Birchwood Industries',
    incomeSecurity:'Birchwood Industries Senior Term Loan (USD 15m, 6.25% fixed · IFRIC 19 — D4E Swap)',
    counterpartyId:'BCH001', transactionId:'BCH001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 15_000_000, purchasePrice: 15_000_000, commitment: 15_000_000,
    settlementDate:'2025-12-01', maturityDate:'2028-12-01',
    dayBasis:'ACT/360', holidayCalendar:'none',
    coupon: { type:'Fixed', fixedRate: 0.0625, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2025-12-01', type:'draw', amount: 15_000_000, drawdownId:'BCH001_D1', status:'actual' },
      // ── Transtype #15 — Distressed borrower issues equity in lieu of repayment ──
      { date:'2026-12-01', type:'debtEquitySwap', equityFairValue: 9_000_000, equityShares: 1_500_000,
        eventId:'BCH001_D4E1', status:'actual',
        reason:'Restructuring — borrower issues common equity to extinguish loan obligation (IFRIC 19)' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: {
      ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
      ecLStage: 2, pdAnnual: 0.085, lgd: 0.55, qFactor: 1.5
    },
    preset:'Birchwood · USD 15m bilateral · D4E swap with $6m restructuring loss · IFRIC 19 (Transtype #15)'
  },
  // ─────────────────── Granite Logistics Term Loan ───────────────────
  // Transtype #16 — Mandatory Prepayment (Change-of-Control)
  //
  // Granite Logistics is acquired by Globex Holdings 18 months into the
  // term. The credit agreement's change-of-control clause requires
  // mandatory prepayment of the full outstanding principal within 30 days.
  // No prepayment penalty (waived under change-of-control covenant).
  //
  //   • $12m face · 5.00% fixed · 5Y bullet · ACT/360
  //   • Mandatory full prepayment on 2027-02-01 (change-of-control trigger)
  // ----------------------------------------------------------------
  {
    id:'graniteLogisticsCoC',
    positionId:'POS-NWF-GRN-IFRS', securityId:'SEC-GRN-MANPREPAY-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Granite Logistics Term Loan — Mandatory Prepayment Demo',
    position:'NWF 100% Bilateral Position · Granite Logistics',
    incomeSecurity:'Granite Logistics Term Loan (USD 12m, 5.00% fixed · Change-of-Control Mandatory Prepayment)',
    counterpartyId:'GRN001', transactionId:'GRN001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 12_000_000, purchasePrice: 12_000_000, commitment: 12_000_000,
    settlementDate:'2025-08-01', maturityDate:'2030-08-01',
    dayBasis:'ACT/360', holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.0500, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2025-08-01', type:'draw', amount: 12_000_000, drawdownId:'GRN001_D1', status:'actual' },
      // ── Transtype #16 — Change-of-control triggers mandatory full prepayment, no penalty ──
      { date:'2027-02-01', type:'mandatoryPrepayment', amount: 12_000_000,
        trigger:'changeOfControl', eventId:'GRN001_MP1', status:'actual',
        reason:'Granite acquired by Globex Holdings — change-of-control mandatory prepayment per Section 7.3' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: {
      ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
      ecLStage: 1, pdAnnual: 0.004, lgd: 0.30, qFactor: 1.0
    },
    preset:'Granite Logistics · USD 12m · change-of-control mandatory prepayment · Transtype #16'
  },
  // ──────────────── Aspen Health Term Loan — Level Principal ────────────────
  // Transtype #17a — Level Principal Amortisation
  //
  //   • $10m face · 4.75% fixed · 5Y · quarterly level principal
  //   • 20 quarterly paydowns of $500k each (auto-generated by profile)
  // ----------------------------------------------------------------
  {
    id:'aspenHealthLevelPrincipal',
    positionId:'POS-NWF-ASP-IFRS', securityId:'SEC-ASP-LEVELP-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Aspen Health Term Loan — Level Principal Amort',
    position:'NWF Bilateral Position · Aspen Health',
    incomeSecurity:'Aspen Health Term Loan (USD 10m, 4.75% fixed · level principal · Transtype #17a)',
    counterpartyId:'ASP001', transactionId:'ASP001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 10_000_000, purchasePrice: 10_000_000, commitment: 10_000_000,
    settlementDate:'2025-09-01', maturityDate:'2030-09-01',
    dayBasis:'ACT/360', holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.0475, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'Periodic',
    // ── Transtype #17a — Engine auto-generates 20 quarterly $500k paydowns ──
    amortProfile: { kind:'levelPrincipal', frequency:'Q', ioMonths:0, balloon:0 },
    principalSchedule: [
      { date:'2025-09-01', type:'draw', amount: 10_000_000, drawdownId:'ASP001_D1', status:'actual' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
            ecLStage: 1, pdAnnual: 0.005, lgd: 0.30, qFactor: 1.0 },
    preset:'Aspen Health · USD 10m · 5Y quarterly level principal · Transtype #17a'
  },
  // ──────────────── Beacon Tower Term Loan — Annuity ────────────────
  // Transtype #17b — Annuity (Equal Total Payment)
  //
  //   • $8m face · 5.50% fixed · 4Y · quarterly annuity
  //   • Engine computes annuity PMT, principal portion declines per period
  // ----------------------------------------------------------------
  {
    id:'beaconTowerAnnuity',
    positionId:'POS-NWF-BCN-IFRS', securityId:'SEC-BCN-ANNUITY-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF EMEA Credit', leid: 41,
    deal:'Beacon Tower Term Loan — Annuity Amort',
    position:'NWF Bilateral Position · Beacon Tower',
    incomeSecurity:'Beacon Tower Term Loan (USD 8m, 5.50% fixed · annuity · Transtype #17b)',
    counterpartyId:'BCN001', transactionId:'BCN001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 8_000_000, purchasePrice: 8_000_000, commitment: 8_000_000,
    settlementDate:'2025-10-01', maturityDate:'2029-10-01',
    dayBasis:'ACT/360', holidayCalendar:'none',
    coupon: { type:'Fixed', fixedRate: 0.0550, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'Periodic',
    // ── Transtype #17b — Engine auto-generates 16 quarterly annuity paydowns ──
    amortProfile: { kind:'annuity', frequency:'Q', ioMonths:0, balloon:0 },
    principalSchedule: [
      { date:'2025-10-01', type:'draw', amount: 8_000_000, drawdownId:'BCN001_D1', status:'actual' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
            ecLStage: 1, pdAnnual: 0.006, lgd: 0.32, qFactor: 1.0 },
    preset:'Beacon Tower · USD 8m · 4Y quarterly annuity · Transtype #17b'
  },
  // ──────────────── Halcyon Bridge — IO with Balloon ────────────────
  // Transtype #17c — Interest-Only with Balloon Repayment
  //
  //   • $25m face · 6.00% fixed · 2Y · 24 months IO + $25m balloon
  //   • Common for bridge / project finance — no intermediate principal
  // ----------------------------------------------------------------
  {
    id:'halcyonBridgeIOBalloon',
    positionId:'POS-NWF-HAL-IFRS', securityId:'SEC-HAL-IOBALLOON-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF EMEA Credit', leid: 41,
    deal:'Halcyon Bridge Loan — IO with Balloon',
    position:'NWF Bilateral Position · Halcyon Bridge',
    incomeSecurity:'Halcyon Bridge Loan (USD 25m, 6.00% fixed · IO+balloon · Transtype #17c)',
    counterpartyId:'HAL001', transactionId:'HAL001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 25_000_000, purchasePrice: 25_000_000, commitment: 25_000_000,
    settlementDate:'2026-01-15', maturityDate:'2028-01-15',
    dayBasis:'ACT/360', holidayCalendar:'none',
    coupon: { type:'Fixed', fixedRate: 0.0600, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    // ── Transtype #17c — Single balloon at maturity, no intermediate paydowns ──
    amortProfile: { kind:'ioBalloon', frequency:'Q', ioMonths:24, balloon:0 },
    principalSchedule: [
      { date:'2026-01-15', type:'draw', amount: 25_000_000, drawdownId:'HAL001_D1', status:'actual' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
            ecLStage: 1, pdAnnual: 0.008, lgd: 0.40, qFactor: 1.0 },
    preset:'Halcyon Bridge · USD 25m · 2Y interest-only with balloon · Transtype #17c'
  },
  // ─────────────────── Ironwood Pacific Term Loan ───────────────────
  // Transtype #18 — Trade vs Settlement Date Accounting
  //
  // NWF agrees to buy a $7.5m secondary-market loan position on trade
  // date 2026-04-01, with settlement T+7 on 2026-04-08. Under trade-date
  // accounting (IFRS 9 §B3.1.5), NWF recognises the loan asset on trade
  // date with an offsetting unsettled-trade-payable. On settlement the
  // payable unwinds against cash.
  //
  //   • $7.5m face · 4.85% fixed · 3Y bullet · ACT/360
  //   • Trade date 2026-04-01, settle 2026-04-08 (T+7)
  // ----------------------------------------------------------------
  {
    id:'ironwoodPacificTrade',
    positionId:'POS-NWF-IRN-IFRS', securityId:'SEC-IRN-TRADESETTLE-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Ironwood Pacific Term Loan — Trade-Date Accounting Demo',
    position:'NWF Secondary Position · Ironwood Pacific',
    incomeSecurity:'Ironwood Pacific Term Loan (USD 7.5m, 4.85% fixed · T+7 trade-date accounting · IFRS 9 §B3.1.5)',
    counterpartyId:'IRN001', transactionId:'IRN001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 7_500_000, purchasePrice: 7_500_000, commitment: 7_500_000,
    // ── Transtype #18 — Trade vs settlement date ──
    tradeDate:'2026-04-01',
    settlementDate:'2026-04-08',
    tradeAccountingMethod:'tradeDate',
    maturityDate:'2029-04-08',
    dayBasis:'ACT/360', holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.0485, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-04-08', type:'draw', amount: 7_500_000, drawdownId:'IRN001_D1', status:'actual',
        note:'Cash settles on T+7; trade-date recognition booked separately' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
            ecLStage: 1, pdAnnual: 0.005, lgd: 0.30, qFactor: 1.0 },
    preset:'Ironwood Pacific · USD 7.5m · T+7 trade-vs-settlement · IFRS 9 §B3.1.5 (Transtype #18)'
  },
  // ─────────────────── Juniper Park Term Loan ───────────────────
  // Transtype #19 — Period-End Reversing Entries
  //
  // Standard month-end-close pattern: every accrual JE posted on period-end
  // gets a mirrored "Reversing — …" entry on day 1 of the next period that
  // cancels it. When the cash receipt actually hits, the full coupon books
  // to income in the new period rather than half-and-half across periods.
  //
  //   • $8m face · 5.25% fixed · 3Y bullet · ACT/360
  //   • useReversingEntries: true → engine emits reversing twin pairs
  // ----------------------------------------------------------------
  {
    id:'juniperParkReversingEntries',
    positionId:'POS-NWF-JNP-IFRS', securityId:'SEC-JNP-REVERSE-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Juniper Park Term Loan — Reversing Entries Demo',
    position:'NWF Bilateral Position · Juniper Park',
    incomeSecurity:'Juniper Park Term Loan (USD 8m, 5.25% fixed · auto-reversing accruals · Transtype #19)',
    counterpartyId:'JNP001', transactionId:'JNP001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 8_000_000, purchasePrice: 8_000_000, commitment: 8_000_000,
    settlementDate:'2026-03-01', maturityDate:'2029-03-01',
    dayBasis:'ACT/360', holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.0525, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    // ── Transtype #19 — Auto-reversing accrual policy ──
    useReversingEntries: true,
    principalSchedule: [
      { date:'2026-03-01', type:'draw', amount: 8_000_000, drawdownId:'JNP001_D1', status:'actual' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
            ecLStage: 1, pdAnnual: 0.004, lgd: 0.30, qFactor: 1.0 },
    preset:'Juniper Park · USD 8m · auto-reversing accruals (Transtype #19)'
  },
  // ─────────────────── Kestrel Wind Farm Term Loan ───────────────────
  // Transtype #20 — Hedge De-Designation
  //
  // NWF originally designates an IRS as a CFH against the floating-rate
  // coupon. Two years in, hedge accounting is voluntarily discontinued
  // (e.g. portfolio realignment, risk policy change). Per IFRS 9 §6.5.6:
  //   • Stop accruing new effective-hedge OCI from de-designation date
  //   • Amortise the EXISTING OCI reserve linearly to P&L over remaining life
  //
  //   • $15m face · SONIA + 300bps · 5Y bullet · CFH IRS
  //   • De-designation on 2027-06-30 (~2 years in, ~3 years remain)
  // ----------------------------------------------------------------
  {
    id:'kestrelWindFarmDeDesignation',
    positionId:'POS-NWF-KST-IFRS', securityId:'SEC-KST-DEDED-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Kestrel Wind Farm — Hedge De-Designation Demo',
    position:'NWF Bilateral Position · Kestrel Wind Farm (CFH discontinued)',
    incomeSecurity:'Kestrel Wind Farm Term Loan (USD 15m, SONIA+300 · CFH de-designated · IFRS 9 §6.5.6)',
    counterpartyId:'KST001', transactionId:'KST001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 15_000_000, purchasePrice: 15_000_000, commitment: 15_000_000,
    settlementDate:'2025-06-30', maturityDate:'2030-06-30',
    dayBasis:'ACT/360', holidayCalendar:'usFederal',
    coupon: { type:'SONIA', fixedRate: 0, floatingRate: 0, spread: 0.030, floor:null, cap:null },
    rfr: { index:'SONIA', baseRate: 0.0475, lookbackDays: 5 },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2025-06-30', type:'draw', amount: 15_000_000, drawdownId:'KST001_D1', status:'actual' }
    ],
    // ── CFH hedge that builds OCI reserve until de-designation ──
    hedge: {
      type:'CFH',
      notional: 15_000_000,
      fixedRate: 0.0525,
      floatingRate: 0.0475,
      effectivenessRatio: 0.95,
      fairValueSchedule: [
        { date:'2025-06-30', mtm:        0 },
        { date:'2026-06-30', mtm:   75_000 },
        { date:'2027-06-30', mtm:  150_000 },   // freeze point
        { date:'2028-06-30', mtm:  225_000 },
        { date:'2029-06-30', mtm:  300_000 },
        { date:'2030-06-30', mtm:        0 }    // matures with hedged item
      ]
    },
    // ── Transtype #20 — De-designate hedge on 2027-06-30 ──
    hedgeDeDesignationDate:'2027-06-30',
    oidTreatment:'none', fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
            ecLStage: 1, pdAnnual: 0.005, lgd: 0.30, qFactor: 1.0 },
    preset:'Kestrel Wind Farm · USD 15m · CFH de-designated mid-life · IFRS 9 §6.5.6 (Transtype #20)'
  },
  // ─────────────────── Larkspur Mining Term Loan ───────────────────
  // Transtype #22 — FX Hedge of Loan Principal
  //
  // GBP-functional NWF entity holds a USD 20m term loan. To hedge the FX
  // risk on the principal balance, NWF enters an FX forward designated as
  // a hedge of the FX risk component. Per IFRS 9 §6.5.16(c) / §B6.5.34:
  // the OCI accumulates in a dedicated FX Hedge Reserve (370000) rather
  // than the generic CFH Reserve (360000). The currency basis spread
  // may be separated into a Cost of Hedging Reserve (375000) bucket.
  //
  //   • $20m face · SONIA + 250bps · 3Y bullet · FX forward hedge
  // ----------------------------------------------------------------
  {
    id:'larkspurMiningFXHedge',
    positionId:'POS-NWF-LRK-IFRS', securityId:'SEC-LRK-FXHEDGE-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF EMEA Credit', leid: 41,
    deal:'Larkspur Mining Term Loan — FX Hedge of Principal Demo',
    position:'NWF Bilateral Position · Larkspur Mining (USD loan, GBP functional)',
    incomeSecurity:'Larkspur Mining Term Loan (USD 20m, SONIA+250 · FX hedge of principal · IFRS 9 §6.5.16)',
    counterpartyId:'LRK001', transactionId:'LRK001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 20_000_000, purchasePrice: 20_000_000, commitment: 20_000_000,
    settlementDate:'2026-04-01', maturityDate:'2029-04-01',
    dayBasis:'ACT/360', holidayCalendar:'usFederal',
    coupon: { type:'SONIA', fixedRate: 0, floatingRate: 0, spread: 0.025, floor:null, cap:null },
    rfr: { index:'SONIA', baseRate: 0.0475, lookbackDays: 5 },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-04-01', type:'draw', amount: 20_000_000, drawdownId:'LRK001_D1', status:'actual' }
    ],
    // ── Transtype #22 — FX Hedge of Loan Principal ──
    // FX forward MTM accumulates into FX Hedge Reserve (370000) — dedicated
    // OCI bucket separate from the generic CFH reserve (360000).
    hedge: {
      type:'FXP',                              // FX hedge of Principal
      subType:'fxPrincipal',                   // explicit subType marker
      notional: 20_000_000,
      fixedRate: 1.25,                         // GBP per USD forward rate
      floatingRate: 1.27,                      // spot at trade
      effectivenessRatio: 0.95,
      currencyBasisShare: 0.10,                // ~10% of MTM attributable to basis spread
      fairValueSchedule: [
        { date:'2026-04-01', mtm:        0 },
        { date:'2027-04-01', mtm:  -180_000 },
        { date:'2028-04-01', mtm:  -120_000 },
        { date:'2029-04-01', mtm:        0 }   // settles at maturity
      ]
    },
    oidTreatment:'none', fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
            ecLStage: 1, pdAnnual: 0.006, lgd: 0.35, qFactor: 1.0 },
    preset:'Larkspur Mining · USD 20m · FX hedge of principal · IFRS 9 §6.5.16 (Transtype #22)'
  },
  // ─────────────── Marigold Senior Notes (Allowance Reversal) ───────────────
  // Transtype #23 — Allowance Reversal Without Stage Change
  //
  // A Stage 1 loan whose ECL allowance was built up over the first 18 months.
  // The bank's risk team recalibrates its macro overlay weights and the loan's
  // ECL drops by $50k — the borrower's stage doesn't change (still Stage 1),
  // but the model recalibration releases part of the allowance to P&L. The
  // engine emits a distinct JE pair labelled "model recalibration" so IFRS 7
  // §35F ECL roll-forward can split this from stage-driven cure movements.
  //
  //   • $10m face · 4.50% fixed · 4Y bullet
  //   • Model recalibration on 2027-09-01 releases $50k of allowance
  // ----------------------------------------------------------------
  {
    id:'marigoldAllowanceReversal',
    positionId:'POS-NWF-MGD-IFRS', securityId:'SEC-MGD-MODELRECAL-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Marigold Senior Notes — Allowance Reversal Demo',
    position:'NWF Bilateral Position · Marigold Senior Notes',
    incomeSecurity:'Marigold Senior Notes (USD 10m, 4.50% fixed · model-driven allowance reversal · Transtype #23)',
    counterpartyId:'MGD001', transactionId:'MGD001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 10_000_000, purchasePrice: 10_000_000, commitment: 10_000_000,
    settlementDate:'2026-03-01', maturityDate:'2030-03-01',
    dayBasis:'ACT/360', holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.0450, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-03-01', type:'draw', amount: 10_000_000, drawdownId:'MGD001_D1', status:'actual' },
      // ── Transtype #23 — Model recalibration releases part of allowance ──
      // (No stage change — borrower stays at Stage 1; macro overlay weights dropped)
      { date:'2027-09-01', type:'allowanceReversal', releaseAmount: 50_000,
        eventId:'MGD001_AR1', status:'actual',
        reason:'Macro overlay recalibration — Q3 2027 model update reduces lifetime PD assumption (no stage change)' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
            ecLStage: 1, pdAnnual: 0.012, lgd: 0.40, qFactor: 1.5 },   // qFactor 1.5 builds allowance
    preset:'Marigold · USD 10m · model recalibration releases $50k allowance · Transtype #23'
  },
  // ─────────────── Nightshade Capital Term Loan ───────────────
  // Transtype #24 — Loan-Loss Recovery Allocation
  //
  // After a $10m write-off at year 2, the bankruptcy estate distributes $3m.
  // The credit agreement governs allocation: principal first (60%), then
  // accrued default interest (20%), then default fees (15%), then legal
  // costs incurred during the proceedings (5%).
  //
  //   • $10m face · 5.50% fixed · 5Y bullet · written off at year 2
  //   • Recovery of $3m at year 3 with bucket allocation per §35K disclosure
  // ----------------------------------------------------------------
  {
    id:'nightshadeCapitalAllocatedRecovery',
    positionId:'POS-NWF-NSH-IFRS', securityId:'SEC-NSH-ALLOCREC-IFRS',
    instrumentKind:'loan',
    legalEntity:'NWF EMEA Credit', leid: 41,
    deal:'Nightshade Capital — Allocated Recovery Demo',
    position:'NWF Bilateral Position · Nightshade Capital',
    incomeSecurity:'Nightshade Capital Term Loan (USD 10m, 5.50% fixed · post-default recovery with bucket allocation · Transtype #24)',
    counterpartyId:'NSH001', transactionId:'NSH001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'IFRS',
    faceValue: 10_000_000, purchasePrice: 10_000_000, commitment: 10_000_000,
    settlementDate:'2025-06-01', maturityDate:'2030-06-01',
    dayBasis:'ACT/360', holidayCalendar:'none',
    coupon: { type:'Fixed', fixedRate: 0.0550, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 }, nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2025-06-01', type:'draw',     amount: 10_000_000, drawdownId:'NSH001_D1', status:'actual' },
      { date:'2027-06-01', type:'writeOff', amount: 10_000_000, eventId:'NSH001_WO1', status:'actual',
        reason:'Borrower Chapter 11 — full write-off' },
      // ── Transtype #24 — Allocated recovery distribution from bankruptcy estate ──
      { date:'2028-06-01', type:'recovery', amount: 3_000_000, eventId:'NSH001_REC1', status:'actual',
        reason:'Bankruptcy estate first distribution',
        allocation: {
          principal:  1_800_000,    // 60%
          defaultInt:   600_000,    // 20%
          defaultFee:   450_000,    // 15%
          legal:        150_000     //  5%
        }
      }
    ],
    oidTreatment:'none', fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
            ecLStage: 3, pdAnnual: 0.45, lgd: 0.60, qFactor: 1.0 },
    preset:'Nightshade Capital · USD 10m · written off, $3m allocated recovery · Transtype #24'
  },
  // ─────────────── Oakhaven Revolving Credit Facility ───────────────
  // Transtype #25 — Origination Cost Deferral on Revolvers
  //
  // Revolving credit facility — borrower can draw, repay, and re-draw during
  // the 3-year availability period; outstanding balances mature at year 5.
  // Per ASC 310-20-25-19 / IFRS 9 §B5.4.1: origination costs on revolvers
  // amortise over the COMMITMENT PERIOD (settlement → availabilityEnd), not
  // over the underlying loan maturity. Faster amort schedule than a term loan.
  //
  //   • $20m commitment · 4.75% fixed on drawn · 3Y availability · 5Y maturity
  //   • $200k capitalised origination costs amortise over 3-year availability
  // ----------------------------------------------------------------
  {
    id:'oakhavenRevolverDeferral',
    positionId:'POS-NWF-OAK-IFRS', securityId:'SEC-OAK-REVOLVER-IFRS',
    instrumentKind:'revolver',
    legalEntity:'NWF North America Credit', leid: 47,
    deal:'Oakhaven Revolving Credit Facility — Cost Deferral Demo',
    position:'NWF Bilateral Position · Oakhaven Revolver',
    incomeSecurity:'Oakhaven RCF (USD 20m commitment, 4.75% fixed · 3Y avail / 5Y maturity · origination cost over commitment · Transtype #25)',
    counterpartyId:'OAK001', transactionId:'OAK001', bilateralFlag:'Bilateral', agentName:'NWF',
    currency:'USD',
    accountingFramework:'USGAAP',  // ASC 310-20-25-19 is US GAAP territory
    faceValue: 20_000_000, purchasePrice: 20_000_000, commitment: 20_000_000,
    settlementDate:'2026-04-01',
    availabilityEnd:'2029-04-01',  // 3-year availability
    maturityDate:'2031-04-01',     // 5-year maturity
    dayBasis:'ACT/360', holidayCalendar:'usFederal',
    coupon: { type:'Fixed', fixedRate: 0.0475, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:true, rate: 0.0050 },   // 50bps on undrawn
    amortization: { method:'none' }, type:'simpleDaily', principalRepayment:'AtMaturity',
    // ── Transtype #25 — Amortise origination costs over commitment, not maturity ──
    revolverCostDeferralBasis:'commitment',
    principalSchedule: [
      { date:'2026-04-01', type:'draw', amount: 10_000_000, drawdownId:'OAK001_D1', status:'actual', note:'Initial $10m draw against $20m commitment' },
      // Capitalised origination cost paid at signing
      { date:'2026-04-01', type:'capitalisedCost', amount: 200_000, eventId:'OAK001_CC1', status:'actual',
        category:'legal + transaction', reason:'Revolver setup costs — amortise over commitment per ASC 310-20-25-19' }
    ],
    oidTreatment:'none', fees: [],
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed: true, businessModel:'HoldToCollect',
            ecLStage: 1, pdAnnual: 0.004, lgd: 0.30, qFactor: 1.0 },
    preset:'Oakhaven Revolver · USD 20m · origination cost over commitment period (ASC 310-20-25-19) · Transtype #25'
  }
];

