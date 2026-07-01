/* =========================================================
   Loan Module Integration Layer — Engine
   Extracted from income-calculator.html (single source of truth)
   Last sync: 2026-05-08
   ========================================================= */
const ONE_DAY = 86400000;
function toISO(d){ const z=new Date(d); z.setHours(12,0,0,0); return z.toISOString().slice(0,10); }
function parseISO(s){ if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y, m-1, d, 12); }
function addDays(d,n){ return new Date(d.getTime()+n*ONE_DAY); }
function addMonths(d,n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }
function eachDay(from,to){ const out=[]; for(let d=new Date(from); d<=to; d=addDays(d,1)) out.push(new Date(d)); return out; }
function isLeap(y){ return (y%4===0 && y%100!==0) || y%400===0; }
function daysInYear(d){ return isLeap(d.getFullYear())?366:365; }
function sameDate(a,b){ return a && b && a.getTime()===b.getTime(); }

/* ---------- Day-count per-day accrual factor ---------- */
function dayCountFactor(basis, date){
  // Returns the fraction of year attributed to ONE calendar day.
  switch(basis){
    case 'ACT/360': return 1/360;
    case 'ACT/365': return 1/365;
    case 'ACT/ACT': return 1/daysInYear(date);
    case '30/360':  return 1/360; // simplified — for daily granularity 30/360 treats each day = 1/360
    default: return 1/360;
  }
}

/* ---------- Event lookup ---------- */
function eventsOn(date, events){
  const iso = toISO(date);
  return (events||[]).filter(e => e.date === iso);
}

/* ---------- Holiday calendars (Req 18) ----------
   Small curated set covering 2019-2031 for demo purposes. In production these
   would come from a calendar service (e.g. SIFMA, TARGET, Bank of England).
-------------------------------------------------- */
const HOLIDAY_CALENDARS = {
  none: new Set(),
  usFederal: new Set([
    '2019-01-01','2019-01-21','2019-02-18','2019-05-27','2019-07-04','2019-09-02','2019-10-14','2019-11-11','2019-11-28','2019-12-25',
    '2020-01-01','2020-01-20','2020-02-17','2020-05-25','2020-07-03','2020-09-07','2020-10-12','2020-11-11','2020-11-26','2020-12-25',
    '2024-01-01','2024-01-15','2024-02-19','2024-05-27','2024-06-19','2024-07-04','2024-09-02','2024-10-14','2024-11-11','2024-11-28','2024-12-25',
    '2025-01-01','2025-01-20','2025-02-17','2025-05-26','2025-06-19','2025-07-04','2025-09-01','2025-10-13','2025-11-11','2025-11-27','2025-12-25',
    '2026-01-01','2026-01-19','2026-02-16','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-10-12','2026-11-11','2026-11-26','2026-12-25',
    '2027-01-01','2028-01-01','2029-01-01','2030-01-01','2031-01-01'
  ]),
  ukBank: new Set([
    '2024-01-01','2024-03-29','2024-04-01','2024-05-06','2024-05-27','2024-08-26','2024-12-25','2024-12-26',
    '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26','2025-08-25','2025-12-25','2025-12-26',
    '2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28'
  ]),
  target: new Set([
    '2024-01-01','2024-03-29','2024-04-01','2024-05-01','2024-12-25','2024-12-26',
    '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-12-25','2025-12-26',
    '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-12-25','2026-12-28'
  ])
};
function isHoliday(date, calendarId){
  const cal = HOLIDAY_CALENDARS[calendarId] || HOLIDAY_CALENDARS.none;
  return cal.has(toISO(date));
}

/* ---------- Business day + payment date helpers (v3) ----------
   Standard loan-market conventions:
     - Following            : if date is non-bizday, roll FORWARD to next bizday
     - ModifiedFollowing    : Following, but if it crosses month-end, roll
                              BACKWARD to the prior bizday instead (default
                              for syndicated loans + most interest payments)
     - Preceding            : if date is non-bizday, roll BACKWARD
     - NoAdjustment         : keep the scheduled date even if non-bizday
   Weekend = Saturday (6) or Sunday (0). Holiday = in HOLIDAY_CALENDARS[cal].
-------------------------------------------------------------- */
function isWeekend(d){ const w = d.getDay(); return w === 0 || w === 6; }
function isBusinessDay(d, calendarId){
  return !isWeekend(d) && !isHoliday(d, calendarId);
}
function rollDate(date, calendarId, convention){
  // Returns { paymentDate (Date), originalScheduledDate (Date), rolled (bool),
  //          rollReason ('weekend'|'holiday'|null), conventionUsed }.
  const conv = convention || 'ModifiedFollowing';
  const orig = new Date(date);
  if(conv === 'NoAdjustment' || isBusinessDay(orig, calendarId)){
    return { paymentDate: orig, originalScheduledDate: orig, rolled: false, rollReason: null, conventionUsed: conv };
  }
  const reason = isWeekend(orig) ? 'weekend' : 'holiday';
  if(conv === 'Preceding'){
    let d = new Date(orig);
    while(!isBusinessDay(d, calendarId)) d = addDays(d, -1);
    return { paymentDate: d, originalScheduledDate: orig, rolled: true, rollReason: reason, conventionUsed: conv };
  }
  // Following / ModifiedFollowing share forward-roll first
  let d = new Date(orig);
  while(!isBusinessDay(d, calendarId)) d = addDays(d, 1);
  if(conv === 'ModifiedFollowing' && d.getMonth() !== orig.getMonth()){
    // Forward-roll crossed month-end → roll backward instead
    d = new Date(orig);
    while(!isBusinessDay(d, calendarId)) d = addDays(d, -1);
  }
  return { paymentDate: d, originalScheduledDate: orig, rolled: true, rollReason: reason, conventionUsed: conv };
}
/* generatePaymentSchedule — list of payment events from anchor to endDate
   at the given frequency, each rolled per convention.
   anchor / endDate are ISO strings or Dates. frequency is one of
   'monthly' | 'quarterly' | 'semi' | 'semiAnnual' | 'annual'.
   Returns: [{ paymentDate ISO, originalScheduledDate ISO, rolled, rollReason, conventionUsed, seq }]
-------------------------------------------------------------- */
function generatePaymentSchedule(anchor, frequency, endDate, calendarId, convention){
  const out = [];
  const anchorD = (anchor instanceof Date) ? anchor : parseISO(anchor);
  const endD    = (endDate instanceof Date) ? endDate : parseISO(endDate);
  if(!anchorD || !endD) return out;
  const stepMonths = ({ monthly:1, quarterly:3, semi:6, semiAnnual:6, annual:12 })[frequency] || 0;
  if(!stepMonths) return out;
  const conv = convention || 'ModifiedFollowing';
  let seq = 0;
  for(let i = 0; ; i++){
    // Schedule date = anchor day-of-month, i months later. Preserve the
    // anchor's day-of-month: addMonths uses JS Date semantics which roll
    // overflow forward (e.g. 1/31 + 1mo → 3/3). For finance we want EOM-clamped:
    // 1/31 + 1mo → 2/28 (or 2/29 in a leap year).
    const target = addMonths(anchorD, i * stepMonths);
    const wantedDay = anchorD.getDate();
    if(target.getDate() !== wantedDay){
      // JS overflowed — clamp to last day of intended month
      const intendedMonth = (anchorD.getMonth() + i * stepMonths) % 12;
      const intendedYear  = anchorD.getFullYear() + Math.floor((anchorD.getMonth() + i * stepMonths) / 12);
      target.setFullYear(intendedYear, intendedMonth + 1, 0);  // 0th day = last of prev month
      target.setHours(12,0,0,0);
    }
    if(target > endD) break;
    const rolled = rollDate(target, calendarId, conv);
    seq++;
    out.push({
      seq,
      paymentDate:           toISO(rolled.paymentDate),
      originalScheduledDate: toISO(rolled.originalScheduledDate),
      rolled:                rolled.rolled,
      rollReason:            rolled.rollReason,
      conventionUsed:        rolled.conventionUsed,
      dayOfWeek:             ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][rolled.paymentDate.getDay()]
    });
    if(seq > 600) break;  // safety — 50 years of monthly
  }
  return out;
}
// Expose for the V3 UI (fee card preview etc.).
if(typeof window !== 'undefined'){
  window.rollDate = rollDate;
  window.generatePaymentSchedule = generatePaymentSchedule;
  window.isBusinessDay = isBusinessDay;
  window.isHoliday_engine = isHoliday;
}

/* ---------- Capitalization gate ---------- */
function isCapitalizationDay(date, anchor, freq){
  // Capitalization happens on the day-of-month of the anchor at the given frequency.
  if(!anchor) return false;
  if(date.getDate() !== anchor.getDate()) return false;
  const months = (date.getFullYear()-anchor.getFullYear())*12 + (date.getMonth()-anchor.getMonth());
  if(months <= 0) return false;
  if(freq==='Monthly')   return months % 1 === 0;
  if(freq==='Quarterly') return months % 3 === 0;
  if(freq==='Yearly')    return months % 12 === 0;
  return false;
}

/* ---------- IRR / yield solve (bisection, robust) ---------- */
function npv(rate, cashflows){
  // cashflows: [{t: yearsFromT0, amount}]
  let v=0; for(const cf of cashflows) v += cf.amount/Math.pow(1+rate, cf.t); return v;
}
function solveYield(targetNPV, cashflows){
  let lo=-0.99, hi=5.0;
  const f = r => npv(r, cashflows) - targetNPV;
  let fl=f(lo), fh=f(hi);
  if(fl*fh > 0) return null; // no sign change
  for(let i=0;i<200;i++){
    const mid=(lo+hi)/2, fm=f(mid);
    if(Math.abs(fm)<1e-9) return mid;
    if(fl*fm<0){ hi=mid; fh=fm; } else { lo=mid; fl=fm; }
  }
  return (lo+hi)/2;
}

/* ---------- Effective Interest Rate (EIR) solver ----------
   Returns a self-contained yield report for the instrument, computed
   independently of the amortization method selected. Fields:
     method          - the amort method actually driving book accretion
     effectiveYield  - the y used by the effective-interest family (or null)
     impliedYTM      - yield solved from (purchasePrice, projected coupon CFs,
                       face at maturity) — always computed for Fixed coupons
                       when PP≠Face; for Floating, uses current (index+spread).
     cashYield       - annual coupon / purchasePrice (current yield).
     totalReturn     - annualized (faceValue + totalCoupon - purchasePrice) / PP
     source          - 'price' | 'formula' | 'override' | 'implied' | 'par'
     note            - human-readable explanation.
   All yields are decimals (0.12 = 12%).
-------------------------------------------------------------- */
// Face-weighted aggregate EIR across tranches[] / underlyingLoans[].
// Returns null if no children resolved a non-zero coupon — caller handles fallback.
function aggregateChildEIRs(childResults, childRecords, kind){
  if(!childResults.length) return null;
  let totalFace = 0, weightedCoupon = 0, weightedYield = 0, withYield = 0;
  for(let i = 0; i < childResults.length; i++){
    const r = childResults[i];
    const f = (childRecords[i] && childRecords[i].faceValue) || 0;
    if(f <= 0) continue;
    totalFace += f;
    weightedCoupon += (r.couponRate || 0) * f;
    if(r.effectiveYield != null){
      weightedYield += r.effectiveYield * f;
      withYield += f;
    }
  }
  if(totalFace <= 0) return null;
  const couponRate = weightedCoupon / totalFace;
  const effectiveYield = withYield > 0 ? weightedYield / withYield : null;
  return {
    method: 'aggregated',
    couponRate,
    annualCoupon: totalFace * couponRate,
    effectiveYield,
    impliedYTM: null,
    cashYield: null,
    totalReturn: null,
    yearsToMat: childResults[0].yearsToMat,
    dayBasis: childResults[0].dayBasis,
    source: 'children',
    note: `Face-weighted across ${childResults.length} ${kind}${childResults.length === 1 ? '' : 's'} — coupon ${(couponRate*100).toFixed(4)}%`
  };
}

/* ============================================================================
   US GAAP — 4-method EIR calculator (Interest AT / Investran convention)
   Applied ONLY when instr.accountingFramework === 'USGAAP'. IFRS / ASPE deals
   continue to use the original IRR-style bisection (see below).

   Methods per the Income Security Panel spec (Folder 1):
     • Method 1 (custom formula — Main Street Capital):
         EIR = (P/CV)^(1/m) - 1 + (I1 + I2)
     • Method 2 (PRICE, iterative — default):  retained as highest-priority
         EIR = bisection over (CV, [coupon CFs..., face + last coupon])
     • Method 3 (generic formula):
         EIR = (PMT + (P-CV)/m) / ((CV+P)/2)
     • Method 4 (client override):
         EIR = instr.eirOverride  (skip calculation)

   Priority order when instr.eirMethod is null/missing:
     override → method2 (PRICE) → method3 → method1.
   ============================================================================ */
/* ============================================================================
   OID / Premium treatment (Transtype #1 spec — Option β)

   Translates the user-facing `oidTreatment` and `oidMethod` fields into the
   existing engine machinery (`amortization.method`). The engine already
   produces separate JE pairs for fee accretion vs OID/premium accretion — this
   helper just lets PortF set it via a clean, single field.

     oidTreatment:
       'auto'    → infer from PP vs FV  (PP<FV → oid, PP>FV → premium, else none)
       'oid'     → force discount accretion treatment
       'premium' → force premium amortisation treatment
       'none'    → no OID/premium treatment

     oidMethod:
       'effective-interest'  → use existing effectiveInterestFormula path
       'straight-line'       → use existing straightLine path
   ============================================================================ */
function resolveOIDTreatment(instr){
  if(!instr) return { treatment: 'none', method: 'effective-interest' };
  const pp = instr.purchasePrice || instr.faceValue || 0;
  const fv = instr.faceValue || 0;
  let t = (instr.oidTreatment || 'auto').toLowerCase();
  if(t === 'auto'){
    if(pp < fv - 0.01) t = 'oid';
    else if(pp > fv + 0.01) t = 'premium';
    else t = 'none';
  }
  const m = (instr.oidMethod || 'effective-interest').toLowerCase();
  return { treatment: t, method: m, oidAmount: fv - pp };
}

// Ensure `amortization.method` is set to drive the existing accretion logic
// whenever oidTreatment resolves to oid/premium. This runs lazily on read; we
// don't mutate the instrument here — the engine's dailyAmort path already
// keys off amortization.method, so we provide it via a getter when computeEIR
// or buildSchedule are called.
function applyOIDOverrideToAmortMethod(instr){
  const r = resolveOIDTreatment(instr);
  if(r.treatment === 'none') return instr;
  // Don't overwrite an explicitly-set non-'none' amortization.method
  const existing = instr.amortization && instr.amortization.method;
  if(existing && existing !== 'none') return instr;
  // effective-interest → solve yield from price (purchasePrice vs face);
  // straight-line     → totalOID / totalDays
  const newMethod = r.method === 'straight-line' ? 'straightLine' : 'effectiveInterestPrice';
  return Object.assign({}, instr, {
    amortization: Object.assign({}, instr.amortization || {}, { method: newMethod }),
    _oidResolved: r
  });
}

function computeEIRUSGAAP(instr){
  if(!instr) return null;
  const method = instr.eirMethod || 'method2';     // default: PRICE

  const settle   = parseISO(instr.settlementDate);
  const maturity = parseISO(instr.maturityDate);
  if(!settle || !maturity || maturity <= settle) return null;

  const basis = instr.dayBasis || 'ACT/365';
  const daysPerYear = (basis === 'ACT/365' || basis === 'ACT/ACT') ? 365 : 360;
  const totalDays = Math.round((maturity - settle) / ONE_DAY);
  const m = totalDays / daysPerYear;

  const P    = instr.faceValue    || 0;
  const CV   = instr.purchasePrice || P;
  const c    = instr.coupon || { type: 'Fixed', fixedRate: 0 };
  const I1   = (c.type === 'Fixed') ? (c.fixedRate || 0) : 0;
  const I2   = (instr.pik && instr.pik.enabled && instr.pik.rate) || 0;
  // PMT per Folder 1 spec — annual interest payment INCLUDING PIK accrual.
  // Test data verifies: P=10m, I1=10%, I2=5% → PMT = 1.5m (not just cash 1m).
  const PMT  = P * (I1 + I2);

  function packReport(eir, methodCode, methodLabel, source, note, trace){
    return {
      method:         instr.amortization?.method || methodCode,
      eirMethod:      methodCode,
      eirMethodLabel: methodLabel,
      couponRate:     I1,
      annualCoupon:   PMT,
      effectiveYield: eir,
      impliedYTM:     null,
      cashYield:      CV > 0 ? (PMT / CV) : null,
      totalReturn:    null,
      yearsToMat:     m,
      dayBasis:       basis,
      source:         source,
      note:           note,
      rateBreakdown:  '',
      eirTrace:       trace,
      eirInputs:      { P, CV, m, I1, I2, PMT, settle: instr.settlementDate, mat: instr.maturityDate }
    };
  }

  // ── Method 4 — Client Override ─────────────────────────────────────────
  if(method === 'override'){
    if(typeof instr.eirOverride === 'number'){
      const eir = instr.eirOverride;
      return packReport(eir, 'override', 'Method 4 — Client Override',
        'override', 'Client-provided override · ' + (eir*100).toFixed(4) + '% · skips calculation',
        { steps: [{ label: 'Client override', value: eir, isFinal: true }] });
    }
    // override flagged but no value → fall through to default
  }

  // ── Method 1 — Custom formula (Main Street Capital) ────────────────────
  if(method === 'method1'){
    if(CV <= 0 || m <= 0) return packReport(I1, 'method1', 'Method 1 — Custom Formula',
      'method1-degenerate', 'Cannot compute: CV or m is zero',
      { steps: [] });
    const A   = P / CV;
    const B   = 1 / m;
    const C   = Math.pow(A, B);
    const D   = I1 + I2;
    const eir = C - 1 + D;
    return packReport(eir, 'method1', 'Method 1 — Custom Formula',
      'method1-custom', 'EIR = (P/CV)^(1/m) - 1 + (I1+I2)',
      { steps: [
          { label: 'A = P / CV',         value: A,   formula: P + ' / ' + CV },
          { label: 'B = 1 / m',          value: B,   formula: '1 / ' + m.toFixed(6) },
          { label: 'C = A^B',            value: C,   formula: A.toFixed(6) + '^' + B.toFixed(6) },
          { label: 'D = I1 + I2',        value: D,   formula: I1 + ' + ' + I2 },
          { label: 'EIR = C - 1 + D',    value: eir, isFinal: true,
            formula: C.toFixed(6) + ' - 1 + ' + D.toFixed(6) }
      ]});
  }

  // ── Method 3 — Generic formula ─────────────────────────────────────────
  if(method === 'method3'){
    if(CV + P <= 0 || m <= 0) return packReport(I1, 'method3', 'Method 3 — Generic Formula',
      'method3-degenerate', 'Cannot compute: CV+P or m is zero',
      { steps: [] });
    const a   = (P - CV) / m;
    const b   = PMT + a;
    const cAvg= (CV + P) / 2;
    const eir = b / cAvg;
    return packReport(eir, 'method3', 'Method 3 — Generic Formula',
      'method3-generic', 'EIR = (PMT + (P-CV)/m) / ((CV+P)/2)',
      { steps: [
          { label: 'A = (P-CV) / m',     value: a,    formula: '(' + P + ' - ' + CV + ') / ' + m.toFixed(6) },
          { label: 'B = PMT + A',        value: b,    formula: PMT + ' + ' + a.toFixed(6) },
          { label: 'C = (CV+P) / 2',     value: cAvg, formula: '(' + CV + ' + ' + P + ') / 2' },
          { label: 'EIR = B / C',        value: eir,  isFinal: true,
            formula: b.toFixed(6) + ' / ' + cAvg.toFixed(6) }
      ]});
  }

  // ── Method 2 — PRICE (default; bisection over bond cashflows) ──────────
  const cfs = [];
  const fullYears = Math.floor(m);
  for(let y = 1; y <= fullYears; y++) cfs.push({ t: y, amount: PMT });
  const stub = m - fullYears;
  cfs.push({ t: m, amount: P + (stub > 0 ? PMT * stub : 0) });
  const eir = solveYield(CV, cfs);
  return packReport(eir, 'method2', 'Method 2 — PRICE (Iterative)',
    'method2-price', 'PRICE method · bisection solve over coupon + balloon cashflows',
    { steps: [
        { label: 'Cashflow set',       value: cfs.length + ' periods' },
        { label: 'Day-1 outflow',      value: -CV },
        { label: 'Coupon stream',      value: PMT + ' × ' + fullYears + ' years' },
        { label: 'Balloon',            value: P + (stub > 0 ? ' + stub coupon' : '') },
        { label: 'Bisection result',   value: eir, isFinal: true }
    ], cashflows: cfs });
}

function computeEIR(instr){
  if(!instr) return null;

  // ── US GAAP — branch to Interest AT 4-method calculator (Folder 1 spec)
  if(instr.accountingFramework === 'USGAAP'){
    return computeEIRUSGAAP(instr);
  }

  // ---- Multi-tranche / guarantee wrapper handling ----------------------
  // For loans split into tranches[] (e.g. Suffolk Solar) compute a face-weighted
  // EIR across the children. For guarantees with underlyingLoans[] (Volt
  // Multi-Loan), do the same. The top-level coupon on these wrappers is
  // typically all zeros — the real rate lives on each child.
  if(Array.isArray(instr.tranches) && instr.tranches.length){
    const child = instr.tranches.map(t => {
      const merged = Object.assign({}, instr, t);
      delete merged.tranches; delete merged.underlyingLoans;   // prevent infinite recursion
      return computeEIR(merged);
    }).filter(x => x);
    return aggregateChildEIRs(child, instr.tranches, 'tranche');
  }
  if(Array.isArray(instr.underlyingLoans) && instr.underlyingLoans.length){
    const child = instr.underlyingLoans.map(u => {
      const merged = Object.assign({}, instr, u);
      delete merged.tranches; delete merged.underlyingLoans;
      return computeEIR(merged);
    }).filter(x => x);
    return aggregateChildEIRs(child, instr.underlyingLoans, 'underlying');
  }

  const settle   = parseISO(instr.settlementDate);
  const maturity = parseISO(instr.maturityDate);
  if(!settle || !maturity || maturity <= settle) return null;

  const basis = instr.dayBasis || 'ACT/360';
  const daysPerYear = (basis==='ACT/365' || basis==='ACT/ACT') ? 365 : 360;
  const totalDays = Math.round((maturity-settle)/ONE_DAY);
  const yearsToMat = totalDays / daysPerYear;

  const face = instr.faceValue || 0;
  const price = instr.purchasePrice || face;
  const amort = instr.amortization || { method:'none' };

  // ---- Current coupon rate -----------------------------------------------
  // Three coupon families:
  //   • Fixed                — uses coupon.fixedRate
  //   • Floating             — uses coupon.floatingRate + coupon.spread (legacy SOFR-style)
  //   • SONIA / SOFR / EURIBOR / FED / etc — RFR-driven, uses:
  //         rfr.baseRate                                     (the observed index level)
  //       + coupon.spread  OR  current marginSchedule entry  (the contractual margin)
  //       + ESG adjustment if enabled
  const c = instr.coupon || { type:'Fixed', fixedRate:0 };
  const RFR_TYPES = new Set(['SONIA','SOFR','ESTR','EURIBOR','TONA','FED']);
  let couponRate = 0;
  let rateBreakdown = '';
  if(c.type === 'Fixed'){
    couponRate = c.fixedRate || 0;
    rateBreakdown = `Fixed coupon ${(couponRate*100).toFixed(4)}%`;
  } else if(RFR_TYPES.has(c.type) || instr.rfr){
    const baseRate = instr.rfr?.baseRate ?? c.floatingRate ?? 0;
    let margin = c.spread ?? 0;
    // marginSchedule[] takes precedence if present (Libra 3, Volt, Suffolk)
    if(Array.isArray(instr.marginSchedule) && instr.marginSchedule.length){
      const todayISO = toISO(new Date());
      const inWindow = instr.marginSchedule.find(s =>
        (!s.from || s.from <= todayISO) && (!s.to || s.to >= todayISO)
      ) || instr.marginSchedule[0];
      if(inWindow){
        margin = (inWindow.marginBps != null) ? inWindow.marginBps / 10000 : (inWindow.spread || margin);
      }
    }
    let raw = baseRate + margin;
    if(c.floor != null) raw = Math.max(raw, c.floor);
    if(c.cap   != null) raw = Math.min(raw, c.cap);
    couponRate = raw;
    rateBreakdown = `${c.type || 'RFR'} ${(baseRate*100).toFixed(4)}% + margin ${(margin*100).toFixed(4)}% = ${(couponRate*100).toFixed(4)}%`;
  } else {
    // Legacy 'Floating' (SOFR-style) — explicit floatingRate + spread on coupon
    let raw = (c.floatingRate || 0) + (c.spread || 0);
    if(c.floor != null) raw = Math.max(raw, c.floor);
    if(c.cap   != null) raw = Math.min(raw, c.cap);
    couponRate = raw;
    rateBreakdown = `Floating ${((c.floatingRate||0)*100).toFixed(4)}% + spread ${((c.spread||0)*100).toFixed(4)}% = ${(couponRate*100).toFixed(4)}%`;
  }
  const annualCoupon = face * couponRate;

  // --- Implied YTM: annual coupons + balloon at maturity ---
  let impliedYTM = null;
  if(price > 0 && face > 0 && yearsToMat > 0){
    const cfs = [];
    const fullYears = Math.floor(yearsToMat);
    for(let y=1; y<=fullYears; y++) cfs.push({ t:y, amount: annualCoupon });
    const stub = yearsToMat - fullYears;
    cfs.push({ t: yearsToMat, amount: face + (stub>0 ? annualCoupon*stub : 0) });
    impliedYTM = solveYield(price, cfs);
  }

  // --- Effective yield actually driving amortization ---
  let effectiveYield = null, source = 'par', note = '';
  if(amort.method === 'effectiveInterestPrice'){
    effectiveYield = impliedYTM;
    source = 'price';
    note = 'Yield solved from purchase price vs. projected coupon cashflows.';
  } else if(amort.method === 'effectiveInterestFormula'){
    effectiveYield = couponRate + (amort.spread ?? 0);
    source = 'formula';
    note = `Yield = coupon (${(couponRate*100).toFixed(4)}%) + user spread (${((amort.spread||0)*100).toFixed(4)}%).`;
  } else if(amort.method === 'effectiveInterestIRR'){
    effectiveYield = amort.yieldOverride ?? couponRate;
    source = 'override';
    note = 'Yield override supplied by user.';
  } else if(amort.method === 'straightLine'){
    source = 'straightLine';
    note = 'Straight-line amortization — no effective yield; showing implied YTM for reference.';
  } else {
    source = price === face ? 'par' : 'implied';
    note = price === face
      ? 'Bond purchased at par — no amortization; cash yield equals coupon.'
      : 'No amortization method set — showing implied YTM for reference only.';
  }

  // --- Other useful yield metrics ---
  const cashYield   = price > 0 ? (annualCoupon / price) : null;
  const totalCoupon = annualCoupon * yearsToMat;
  const totalReturn = (price > 0 && yearsToMat > 0)
    ? ((face + totalCoupon - price) / price) / yearsToMat : null;

  // Prepend the rate breakdown to the note so the FV / EIR display shows base + margin.
  const fullNote = rateBreakdown ? `${rateBreakdown}${note ? ' · ' + note : ''}` : note;
  return {
    method: amort.method || 'none',
    couponRate, annualCoupon,
    effectiveYield, impliedYTM, cashYield, totalReturn,
    yearsToMat, dayBasis: basis, source, note: fullNote, rateBreakdown
  };
}

/* ---------- Core schedule builder ----------
   Walks the day grid from settlement → maturity and maintains:
     balance              (principal outstanding, includes PIK capitalizations)
     drawnBalance         (for revolvers: actually drawn portion)
     carryingValue        (used by effective-interest / straight-line methods)
     cumInterest, cumPIK  (tracker for capitalization)
-------------------------------------------------- */
// ─── Transtype #17 — Multiple Amortisation Profiles ────────────────────
// Expand a high-level amortProfile spec into explicit principalSchedule
// paydown events. Supported profile kinds:
//
//   • 'bullet'         — single repayment at maturity (no-op; default)
//   • 'levelPrincipal' — equal principal payments across N periods
//                        E.g. $10m / 20 quarters = $500k each quarter
//   • 'annuity'        — equal total payments (P+I); engine computes the
//                        principal carve-out per period using the contract
//                        rate at start (approximation — real annuity would
//                        rely on the actual rate at each period date)
//   • 'ioBalloon'      — interest-only for ioMonths, then full balloon
//                        at maturity. Common for bridge / project finance.
//
// The expander only runs when amortProfile is set AND principalSchedule
// doesn't already contain explicit paydowns (so user-supplied schedules
// take precedence — backward compatible with all existing seeds).
function expandAmortProfile(instr){
  const prof = instr.amortProfile;
  if(!prof || !prof.kind || prof.kind === 'bullet') return;
  const sched = Array.isArray(instr.principalSchedule) ? instr.principalSchedule : [];
  const hasExplicitPaydown = sched.some(e => e.type === 'paydown' || e.type === 'repayment');
  if(hasExplicitPaydown) return;   // user already specified — don't double up

  const face = +instr.faceValue || +instr.commitment || 0;
  if(face <= 0) return;
  const settle   = new Date(instr.settlementDate);
  const maturity = new Date(instr.maturityDate);
  if(isNaN(settle) || isNaN(maturity) || maturity <= settle) return;

  const balloon = Math.max(0, +prof.balloon || 0);
  const amortAmount = face - balloon;        // amount to amortise across periods

  // Step interval in months between paydowns: 'M'=1, 'Q'=3, 'S'=6, 'A'=12
  const stepMonths = { M:1, Q:3, S:6, A:12 }[prof.frequency || 'Q'] || 3;
  const ioMonths   = Math.max(0, +prof.ioMonths || 0);
  // First amort date: ioMonths after settle (or explicit profile.startDate)
  const firstAmort = prof.startDate
    ? new Date(prof.startDate)
    : new Date(settle.getFullYear(), settle.getMonth() + ioMonths + stepMonths, settle.getDate());

  // Enumerate period-end dates from firstAmort to maturity inclusive
  const periodDates = [];
  let d = new Date(firstAmort);
  while(d < maturity){
    periodDates.push(new Date(d));
    d = new Date(d.getFullYear(), d.getMonth() + stepMonths, d.getDate());
  }
  const nPeriods = periodDates.length;
  if(nPeriods === 0){
    // No room for periodic paydowns — fall through to bullet at maturity
    sched.push({ date: instr.maturityDate, type:'paydown', amount: face, _generated:true, _profile: prof.kind });
    instr.principalSchedule = sched;
    return;
  }

  // Generate paydowns by kind
  const paydowns = [];
  if(prof.kind === 'levelPrincipal'){
    const perPeriod = amortAmount / nPeriods;
    periodDates.forEach((pd, i) => {
      paydowns.push({ date: pd.toISOString().slice(0,10), type:'paydown', amount: round2(perPeriod),
                      _generated:true, _profile:'levelPrincipal', _idx: i+1 });
    });
  } else if(prof.kind === 'annuity'){
    // Annuity formula: PMT = P × r/(1−(1+r)^-N)  where r = periodic rate
    const annualRate = (instr.coupon && (instr.coupon.fixedRate || (instr.coupon.floatingRate||0) + (instr.coupon.spread||0))) || 0;
    const r = annualRate * stepMonths / 12;
    const PMT = (r === 0) ? (amortAmount / nPeriods) : (amortAmount * r / (1 - Math.pow(1+r, -nPeriods)));
    let outstanding = amortAmount;
    periodDates.forEach((pd, i) => {
      const interestThisPd = outstanding * r;
      const principalThisPd = Math.max(0, PMT - interestThisPd);
      const cappedPrincipal = (i === nPeriods - 1) ? outstanding : Math.min(principalThisPd, outstanding);
      outstanding -= cappedPrincipal;
      paydowns.push({ date: pd.toISOString().slice(0,10), type:'paydown', amount: round2(cappedPrincipal),
                      _generated:true, _profile:'annuity', _idx: i+1 });
    });
  } else if(prof.kind === 'ioBalloon'){
    // Single balloon at maturity (no intermediate paydowns).
    paydowns.push({ date: instr.maturityDate, type:'paydown', amount: round2(face),
                    _generated:true, _profile:'ioBalloon', _idx: 1 });
  }

  // Add the balloon repayment at maturity (after the last period paydown) for
  // levelPrincipal / annuity if balloon > 0
  if(balloon > 0 && (prof.kind === 'levelPrincipal' || prof.kind === 'annuity')){
    paydowns.push({ date: instr.maturityDate, type:'paydown', amount: round2(balloon),
                    _generated:true, _profile: prof.kind + '_balloon' });
  }

  instr.principalSchedule = sched.concat(paydowns);
}
function round2(x){ return Math.round(x * 100) / 100; }

// ---------------------------------------------------------------------------
// applyCovenantSideEffects — Phase A medium-scope covenants
//
// Reads instr.covenants[] and returns an enriched array tagging each covenant
// with status (compliant / headroomWarning / breached), breachDate,
// curePeriodEndDate, and a stable identity (covIdentity) used for idempotent
// event synthesis. Pure function — does not mutate instr.
//
// Inputs per covenant (DB / Builder shape, both supported):
//   kpiMetric / name           — what's being measured
//   threshold                  — numeric limit
//   direction                  — 'max' | 'min' | 'maximum' | 'minimum' | '≤' | '≥' | '=='
//   lastReportedValue          — most recent observation (number or string-numeric)
//   reportDate / lastTestDate  — date the observation was taken (fallback = settle)
//   curePeriodDays             — days from breach to consequence trigger (default 0)
//   breachStepUpBps            — margin uplift in bps if marginStepUp is in consequenceOnBreach
//   consequenceOnBreach        — string OR comma-list of: 'sicrTrigger', 'marginStepUp',
//                                'mandatoryPrepayment', 'acceleration', 'eventOfDefault'
//   headroomWarnPct            — % below threshold at which to tag headroomWarning (default 0.10)
//
// Returns: covenants array with added { status, headroomPct, breachDate,
//   curePeriodEndDate, covIdentity, consequenceList[] }.
// ---------------------------------------------------------------------------
function applyCovenantSideEffects(instr){
  const list = Array.isArray(instr && instr.covenants) ? instr.covenants : [];
  if(!list.length) return [];
  const settleISO = instr.settlementDate || '1970-01-01';
  return list.map((c, idx) => {
    const enriched = Object.assign({}, c);
    const val = (c.lastReportedValue != null) ? +c.lastReportedValue : null;
    const thr = (c.threshold != null) ? +c.threshold : null;
    const dir = String(c.direction || c.testDirection || 'max').toLowerCase();
    const warnPct = (c.headroomWarnPct != null) ? +c.headroomWarnPct : 0.10;
    let breached = false, headroomWarning = false, headroomPct = null;
    if(val != null && thr != null && !isNaN(val) && !isNaN(thr)){
      if(dir === 'max' || dir === 'maximum' || dir === '≤' || dir === '<=' || dir === 'lte'){
        breached = val > thr;
        if(!breached && thr !== 0){
          headroomPct = (thr - val) / Math.abs(thr);
          headroomWarning = headroomPct < warnPct;
        }
      } else if(dir === 'min' || dir === 'minimum' || dir === '≥' || dir === '>=' || dir === 'gte'){
        breached = val < thr;
        if(!breached && thr !== 0){
          headroomPct = (val - thr) / Math.abs(thr);
          headroomWarning = headroomPct < warnPct;
        }
      } else if(dir === '==' || dir === 'equal' || dir === 'eq'){
        breached = val !== thr;
      }
    }
    enriched.status = breached ? 'breached' : (headroomWarning ? 'headroomWarning' : 'compliant');
    enriched.headroomPct = headroomPct;
    // Breach date: prefer explicit breach_date, then last reported/test date, then settle
    const breachDate = c.breachDate || c.breach_date
                     || c.lastReportedDate || c.last_reported_date
                     || c.lastTestDate || c.last_test_date
                     || c.reportDate || c.report_date
                     || c.nextTestDate || c.next_test_date
                     || c.firstTestDate || c.first_test_date
                     || settleISO;
    enriched.breachDate = breached ? breachDate : null;
    // Cure period end = breachDate + curePeriodDays (default 0 = take effect immediately)
    const cureDays = +(c.curePeriodDays ?? c.cure_period_days ?? 0) || 0;
    if(breached){
      if(cureDays > 0){
        const d = new Date(breachDate + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + cureDays);
        enriched.curePeriodEndDate = d.toISOString().slice(0,10);
      } else {
        enriched.curePeriodEndDate = breachDate;
      }
    } else {
      enriched.curePeriodEndDate = null;
    }
    // Normalise consequence into a list for easier matching
    const consRaw = c.consequenceOnBreach || c.consequence_on_breach || c.consequence || '';
    const consList = Array.isArray(consRaw)
      ? consRaw.map(String)
      : String(consRaw).split(/[,;|]/).map(s => s.trim()).filter(Boolean);
    enriched.consequenceList = consList;
    // Stable identity for idempotent event synthesis across re-invocations
    enriched.covIdentity = c.id || c.covenant_id || c.name
      || ((c.kpiMetric || c.kpi_metric || 'covenant') + ':' + (c.threshold ?? idx) + ':' + idx);
    return enriched;
  });
}

function buildSchedule(instr){
  if(!instr) return [];

  // Resolve OID/Premium treatment first — if oidTreatment is set (or auto
  // resolves to oid/premium given PP vs FV), apply amortization.method so the
  // existing dailyAmort path engages. This produces the separate "Discount
  // Accretion" / "Premium Amortization" JE pair already wired in generateDIU.
  instr = applyOIDOverrideToAmortMethod(instr);

  // Transtype #17 — Expand any amortProfile into explicit principalSchedule
  // paydowns. Operates in-place; safe for repeat invocations because the
  // expander short-circuits when explicit paydowns already exist.
  if(instr.amortProfile && instr.amortProfile.kind && instr.amortProfile.kind !== 'bullet'){
    // Clone so we don't mutate the user's INSTRUMENTS entry on repeated calls
    instr = Object.assign({}, instr, { principalSchedule: (instr.principalSchedule || []).slice() });
    expandAmortProfile(instr);
  }

  // ---- Multi-tranche / multi-underlying support -------------------------
  // If instr.tranches is non-empty (a loan with fixed + floating tranches in
  // one transaction) OR instr.underlyingLoans is non-empty (a guarantee
  // covering multiple loans), recursively build a schedule per sub-instrument
  // and aggregate row-by-row. Each sub-instrument inherits the parent's
  // settlement/maturity and identifying fields unless overridden.
  // Closes scenarios #10 (fixed+floating mix) and G1 (multiple underlyings).
  const subs = (Array.isArray(instr.tranches) && instr.tranches.length)
    ? instr.tranches
    : (Array.isArray(instr.underlyingLoans) && instr.underlyingLoans.length)
      ? instr.underlyingLoans
      : null;
  if(subs){
    // Build schedule for each sub-instrument with parent context inherited
    const subSchedules = subs.map(s => {
      const merged = Object.assign({}, instr, s);
      // Don't recurse infinitely
      delete merged.tranches;
      delete merged.underlyingLoans;
      // Each sub keeps its own coupon, marginSchedule, principalSchedule, etc.
      return buildSchedule(merged);
    });
    // Aggregate row-by-row by date. Use the longest sub's date list as the
    // canonical day grid (all subs share parent settle/maturity so all grids
    // are equal length).
    const longest = subSchedules.reduce((a,b) => b.length > a.length ? b : a, subSchedules[0]);
    const aggregated = [];
    const SUM_KEYS = ['balance','drawnBalance','carryingValue','initialPurchase','draw','paydown',
                      'dailyCash','cumInterestAccrued','cumInterestEarned',
                      'capitalized','cashInterestPayment','dailyPik','cumPikAccrued','cumPikEarned',
                      'pikPaydown','amortDaily','cumAmort','nonUseFee','cumNonUseFee',
                      'dailyFees','dailyEIRAccretion','cumEIRAccretion',
                      'dailyDefaultInterest','dailyDefaultFee','cumDefaultInterest','cumDefaultFee'];
    for(let k = 0; k < longest.length; k++){
      const date = longest[k].date;
      const r = { date, jsDate: longest[k].jsDate, dayOfWeek: longest[k].dayOfWeek,
                  feeBreakdown: {}, hasEvent: false,
                  // weighted-average rate placeholders
                  couponRate: 0, floatingRate: 0, currentRate: 0, pikRate: 0 };
      for(const key of SUM_KEYS) r[key] = 0;
      let totalBal = 0;
      for(const sched of subSchedules){
        const sr = sched[k]; if(!sr) continue;
        for(const key of SUM_KEYS){ r[key] += (sr[key] || 0); }
        totalBal += (sr.balance || 0);
        r.hasEvent = r.hasEvent || sr.hasEvent;
        // merge per-fee breakdown
        if(sr.feeBreakdown){
          for(const [fk,fv] of Object.entries(sr.feeBreakdown)){
            r.feeBreakdown[fk] = (r.feeBreakdown[fk] || 0) + (fv || 0);
          }
        }
      }
      // Weighted-average rates by balance
      if(totalBal > 0){
        for(const sched of subSchedules){
          const sr = sched[k]; if(!sr || !sr.balance) continue;
          const w = sr.balance / totalBal;
          r.couponRate   += (sr.couponRate   || 0) * w;
          r.floatingRate += (sr.floatingRate || 0) * w;
          r.currentRate  += (sr.currentRate  || 0) * w;
          r.pikRate      += (sr.pikRate      || 0) * w;
        }
      }
      aggregated.push(r);
    }
    // Aggregate per-fee accumulation across sub-schedules
    const aggFeeBreakdown = [];
    const seen = new Map();
    for(const sched of subSchedules){
      for(const f of (sched.feeBreakdown || [])){
        const key = f.label;
        if(!seen.has(key)){
          seen.set(key, { label:f.label, ifrs:f.ifrs, cumAccrued: 0, cumRecognised: 0, cumPaid: 0 });
          aggFeeBreakdown.push(seen.get(key));
        }
        seen.get(key).cumAccrued += f.cumAccrued || 0;
      }
    }
    aggregated.feeBreakdown = aggFeeBreakdown;
    aggregated.deferredEIRPool = subSchedules.reduce((a,s) => a + (s.deferredEIRPool || 0), 0);
    aggregated.tranchesUsed = subs.map(s => s.id || s.label);
    return aggregated;
  }

  const settle   = parseISO(instr.settlementDate);
  const maturity = parseISO(instr.maturityDate);
  if(!settle || !maturity || maturity < settle) return [];

  const basis = instr.dayBasis || 'ACT/360';

  // ----- Phase A medium covenants — derive side-effects + synth events ----
  const enrichedCovenants = applyCovenantSideEffects(instr);
  // Set of consequence-bearing breached covenants for fast lookup in helpers
  const breachedCovs = enrichedCovenants.filter(c => c.status === 'breached');
  // Phase A #4 — Mandatory prepayment synthesis on covenant acceleration.
  // For any breached covenant with consequence ∈ {mandatoryPrepayment,
  // acceleration, eventOfDefault}, push a synthetic event into
  // instr.principalSchedule. The actual amount is materialised inside the
  // event loop (set to current balance at trigger date), so partial paydowns
  // earlier in the schedule don't get over- or under-counted. Idempotent —
  // skipped when a matching event already exists. Stale synth events
  // (covenant cured / removed) are stripped on each call.
  const accelCovs = breachedCovs.filter(c =>
    c.consequenceList.includes('mandatoryPrepayment')
    || c.consequenceList.includes('acceleration')
    || c.consequenceList.includes('eventOfDefault'));
  const accelCovIds = new Set(accelCovs.map(c => c.covIdentity));
  instr.principalSchedule = instr.principalSchedule || [];
  // Strip stale synth events whose covenant is no longer breached / present
  instr.principalSchedule = instr.principalSchedule.filter(e =>
    !(e && e._covenantSynthesised && e.type === 'mandatoryPrepayment'
      && !accelCovIds.has(e._covenantIdentity)));
  // Add fresh synth events for any newly-breached accelerating covenants
  for(const c of accelCovs){
    const accelDate = c.curePeriodEndDate || c.breachDate;
    const already = instr.principalSchedule.some(e =>
      e && e._covenantSynthesised && e._covenantIdentity === c.covIdentity
      && e.type === 'mandatoryPrepayment');
    if(!already && accelDate){
      instr.principalSchedule.push({
        type: 'mandatoryPrepayment',
        date: accelDate,
        amount: 0,                            // materialised in loop = balance at trigger
        kind: 'covenantBreach',
        trigger: 'covenantBreach',
        reason: 'Covenant breach acceleration: ' + (c.name || c.kpiMetric || c.kpi_metric || 'unnamed'),
        _covenantSynthesised: true,
        _covenantIdentity: c.covIdentity,
      });
    }
  }

  // Helper: total margin step-up bps active on a given date across all
  // breached covenants with a non-zero breachStepUpBps. Active window:
  // [breachDate, curePeriodEndDate]. Multiple breached covenants stack.
  //
  // Phase C bugfix — apply step-up whenever breachStepUpBps > 0, regardless of
  // whether 'marginStepUp' is the named consequence. Real-world contracts
  // commonly pair sicrTrigger with a rate uplift (e.g. "breach forces SICR
  // for accounting AND adds 150bps to the spread"). Treating the bps field
  // as the sole authoritative signal removes the ambiguity.
  const covenantMarginStepBpsOn = (dateISO) => {
    let total = 0;
    for(const c of breachedCovs){
      const bps = +(c.breachStepUpBps ?? c.breach_step_up_bps ?? 0) || 0;
      if(bps <= 0) continue;
      if(dateISO < c.breachDate) continue;
      // After cure period ends, the step-up persists until next test cycle.
      // For Phase A we keep step-up live from breach onward (no auto-cure
      // without a fresh observation). Phase B adds the breach-log + cure date
      // wiring that lets us turn this off.
      total += bps;
    }
    return total;
  };

  // Helper: SICR active when any breached covenant has consequence sicrTrigger
  // (or any of: marginStepUp + an explicit sicrTrigger tag). Per IFRS 9 §B5.5.17
  // and ASC 326-20-30-2, a covenant breach is a presumptive SICR indicator —
  // the user opts in by configuring sicrTrigger on the covenant.
  const covenantSICRActiveOn = (dateISO) => {
    for(const c of breachedCovs){
      if(!c.consequenceList.includes('sicrTrigger')) continue;
      if(dateISO >= c.breachDate) return true;
    }
    return false;
  };

  const events = (instr.principalSchedule||[]).slice().sort((a,b)=> a.date.localeCompare(b.date));

  // For revolvers / loans the "balance" starts at initial draw (first event w/ type=draw at settle) or faceValue.
  // Facility / deferred-drawdown case: if the principalSchedule has draws AFTER
  // settlement and NO initial/draw event at settlement, the loan starts at
  // zero balance (e.g. SP023 / Libra 2 — signed Oct 2024, first draw Feb 2026).
  const initialDraw = events.find(e => e.date===toISO(settle) && (e.type==='draw' || e.type==='initial'));
  const hasFutureDraws = events.some(e => e.type === 'draw' && e.date > toISO(settle));
  let balance;
  if(initialDraw)            balance = initialDraw.amount;
  else if(hasFutureDraws)    balance = 0;       // facility with deferred drawdown
  else                       balance = instr.faceValue || 0;
  // BUGFIX: when initialDraw is a `type='draw'` event (not 'initial'), the
  // loop below would add its amount AGAIN, double-counting the draw. Mark it
  // so the loop skips it on the matched settle-date row.
  if(initialDraw && initialDraw.type === 'draw') initialDraw._consumedAsInitial = true;
  let drawnBalance  = balance;
  const commitment  = instr.commitment ?? instr.faceValue;

  // Carrying value start = purchase price if given, else face
  let carryingValue = (instr.purchasePrice ?? instr.faceValue) || 0;

  // Precompute total life (years) and a rough cashflow set for IRR methods.
  // For SONIA / CompoundedRFR coupons the fixedRate is 0 — derive an
  // indicative coupon from the rfr base + first margin step + ESG adj so the
  // EIR solver can still project cashflows.
  const totalDays = Math.round((maturity-settle)/ONE_DAY);
  let couponRateNominal = instr.coupon?.fixedRate ?? 0;
  if(!couponRateNominal && (instr.coupon?.type === 'SONIA' || instr.coupon?.type === 'CompoundedRFR')){
    const rfrBase = instr.rfr?.baseRate ?? 0;
    const firstStep = (instr.marginSchedule || [])[0];
    const marginBps = firstStep?.marginBps ?? ((instr.coupon?.spread ?? 0) * 10000);
    const esgBps    = instr.esgAdjustment?.deltaBps ?? 0;
    couponRateNominal = rfrBase + (marginBps + esgBps)/10000;
  }

  // Effective interest yield (y):
  //   method effectiveInterestPrice  -> solve from PP
  //   method effectiveInterestFormula-> yield = coupon + spread (user-supplied)
  //   method effectiveInterestIRR    -> explicit yield input
  //   method straightLine            -> no y — amortize linearly
  let effectiveYield = null;
  const amort = instr.amortization || { method:'none' };
  // Days-per-year aligned with the day-count basis (keeps IRR-solve consistent with daily accrual).
  const daysPerYear = (basis==='ACT/365' || basis==='ACT/ACT') ? 365 : 360;
  if(amort.method === 'effectiveInterestPrice' && instr.purchasePrice && instr.faceValue && couponRateNominal){
    // Build cashflows aligned to the scheduler's day-count: coupon annually + face at maturity.
    const yearsToMat = totalDays / daysPerYear;
    const cfs = [];
    const coupon = instr.faceValue * couponRateNominal;
    const fullYears = Math.floor(yearsToMat);
    for(let y=1; y<=fullYears; y++) cfs.push({t:y, amount: coupon});
    const stub = yearsToMat - fullYears;
    cfs.push({t: yearsToMat, amount: instr.faceValue + (stub>0 ? coupon*stub : 0)});
    const seed = solveYield(instr.purchasePrice, cfs) ?? couponRateNominal;
    // Refinement pass: pick the yield that makes the daily-simple-interest schedule
    // close to face at maturity. Two-point secant is plenty.
    const runCarrying = (y) => {
      let cv = instr.purchasePrice || 0;
      for(let k=0; k<totalDays+1; k++){
        cv += cv * y * (1/daysPerYear) - instr.faceValue * couponRateNominal * (1/daysPerYear);
      }
      return cv;
    };
    let y0 = seed, y1 = seed * 1.001;
    let f0 = runCarrying(y0) - instr.faceValue;
    let f1 = runCarrying(y1) - instr.faceValue;
    for(let i=0; i<6 && Math.abs(f1) > 1e-3; i++){
      const y2 = y1 - f1 * (y1-y0) / (f1-f0);
      y0 = y1; f0 = f1; y1 = y2; f1 = runCarrying(y1) - instr.faceValue;
    }
    effectiveYield = y1;
  } else if(amort.method === 'effectiveInterestFormula'){
    effectiveYield = (couponRateNominal) + (amort.spread ?? 0);
  } else if(amort.method === 'effectiveInterestIRR'){
    effectiveYield = amort.yieldOverride ?? couponRateNominal;
  }

  // Discount/premium for straight-line
  const straightLineDaily = (amort.method==='straightLine' && instr.purchasePrice && instr.faceValue && totalDays>0)
    ? (instr.faceValue - instr.purchasePrice) / totalDays
    : 0;

  // PIK tracking (capitalize at anchor dates)
  const pikEnabled = !!instr.pik?.enabled;
  const pikRateNominal = instr.pik?.rate ?? 0;
  const capAnchor = settle;
  const capFreq = instr.pik?.capitalizationFrequency || 'Monthly';

  let cumCashAccrued = 0, cumPikAccrued = 0;
  let cumInterestEarned = 0, cumPikEarned = 0;
  let cumAmort = 0;
  let cumNonUseFee = 0;
  // ---- IFRS 9 ECL state -------------------------------------------------
  // ECL allowance is a contra-asset that grows toward the target ECL each day.
  // Target = (Stage 1 ? 12-month PD : lifetime PD) × LGD × EAD.
  // Daily ECL change = target - allowance, posted DR P&L / CR Loan Loss Allow.
  let eclAllowance = 0;
  let cumECLChange = 0;
  // ---- FX revaluation state ---------------------------------------------
  // Reval P&L is computed daily as opening-balance × (todayFX - yesterdayFX),
  // where FX = instrument currency → functional currency. fxRateSchedule
  // [{date, rate}] supplies date-effective fixings; default to 1.0.
  const fxScheduleSorted = (instr.fxRateSchedule || []).slice().sort((a,b)=>a.date.localeCompare(b.date));
  function fxRateOn(dateISO){
    if(!fxScheduleSorted.length) return 1.0;
    let r = fxScheduleSorted[0].rate;
    for(const step of fxScheduleSorted){
      if(step.date <= dateISO) r = step.rate;
      else break;
    }
    return r;
  }
  let prevFX = fxScheduleSorted[0]?.rate ?? 1.0;
  let cumFXGain = 0;
  // ---- IFRS 9 hedge accounting state ------------------------------------
  // hedge: { type:'CFH'|'FVH', notional, fixedRate, floatingRate,
  //          fairValueSchedule:[{date, mtm}], effectivenessRatio:0.95,
  //          settlementDates:[...] }
  // CFH: effective portion → cashFlowHedgeReserve (OCI 35000); ineffective → P&L (45100)
  // FVH: hedge MTM change → P&L (45200); offsetting hedged-item FV change → P&L
  // Reclassification on settlement: DR Hedge Reserve / CR P&L Hedge Income
  const hedgeFVSorted = ((instr.hedge?.fairValueSchedule) || []).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const hedgeSettlements = new Set((instr.hedge?.settlementDates) || []);
  let prevHedgeMTM = hedgeFVSorted[0]?.mtm ?? 0;
  let cashFlowHedgeReserve = 0;     // OCI accumulator (CFH only)
  let cumHedgeOCI = 0;              // total OCI movement to date
  let cumHedgePL  = 0;              // total P&L impact (effective for FVH, ineffective for CFH)
  let cumHedgeReclass = 0;          // reserve reclassified to P&L on settlements (CFH)
  function hedgeMTMOn(dateISO){
    if(!hedgeFVSorted.length) return 0;
    let m = hedgeFVSorted[0].mtm;
    for(const step of hedgeFVSorted){
      if(step.date <= dateISO) m = step.mtm;
      else break;
    }
    return m;
  }

  // ---- Fee accrual setup (multi-fee) ----------------------------------
  // instr.fees: [{ id, kind, label, mode, rate, base, amount, frequency,
  //                paymentDate, ifrs, accrueFrom, accrueTo }]
  //   kind        : arrangement | commitment | guarantee | other
  //   mode        : 'percent' (rate × base × dcf) | 'flat' (amount on paymentDate)
  //   base        : commitment | undrawn | drawn | covered | face
  //   ifrs        : IFRS9-EIR | IFRS15-overTime | IFRS15-pointInTime
  //   frequency   : oneOff | daily | monthly | quarterly | semiAnnual | annual
  // EIR-classified fees (IFRS 9) accrete into carrying value as deferred
  // income; recognised pro-rata over the life. IFRS 15 fees are recognised
  // over the service period (commitment/guarantee) or at the point-in-time.
  const fees = Array.isArray(instr.fees) ? instr.fees : [];
  const feeAccum = fees.map(f => ({
    id: f.id, kind: f.kind, label: f.label || f.kind, ifrs: f.ifrs || 'IFRS15-overTime',
    cumAccrued: 0, cumRecognised: 0, cumPaid: 0
  }));
  const totalLifeDays = Math.max(1, Math.round((maturity - settle)/ONE_DAY));
  // For IFRS9-EIR fees: deferred income at t0 = sum(flat one-off) + 0 (% accrue daily over life)
  let deferredEIRPool = 0;
  for(const f of fees){
    // Accept both 'flat' (engine-native) and 'fixed' (v3 builder mapping of 'fixAmount').
    if(/EIR$/.test(f.ifrs || '') && (f.mode === 'flat' || f.mode === 'fixed') && f.frequency === 'oneOff'){
      deferredEIRPool += (f.amount || 0);
      // Reduce initial carrying value by the deferred fee (cash received at signing
      // is offset against carrying amount; it accretes back into interest income).
      carryingValue -= (f.amount || 0);
    } else if(/EIR$/.test(f.ifrs || '') && f.mode === 'percent' && f.frequency === 'oneOff'){
      const baseAmt = ((b)=>{
        if(b==='commitment') return commitment;
        if(b==='face')       return instr.faceValue || 0;
        if(b==='drawn')      return drawnBalance;
        if(b==='covered')    return instr.coveredAmount || 0;
        return commitment;
      })(f.base);
      const oneOff = baseAmt * (f.rate || 0);
      deferredEIRPool += oneOff;
      carryingValue -= oneOff;
    }
  }
  const eirDailyAccretion = deferredEIRPool > 0 ? (deferredEIRPool / totalLifeDays) : 0;
  // V3 — Running total so the daily accretion step can cap itself at the pool
  // (prevents float-rounding overshoot) and crystallise the residual when the
  // loan is derecognised (balance → 0 via paydown / sale / write-off).
  let cumulativeEIRAccreted = 0;

  // ---- SONIA / margin ratchet helpers ---------------------------------
  // instr.marginSchedule: [{ from: ISO, to: ISO|null, marginBps: number }]
  // instr.esgAdjustment : { from: ISO, deltaBps: number }   (e.g., -2.5)
  // instr.rfr            : { index, baseRate, lookbackDays, rounding }
  // ─── V3 — Compounded RFR (SONIA / SOFR / ESTR / BBSW) ────────────────────
// Implements the daily-compounded-in-arrears methodology used by ISDA /
// ARRC / LMA for modern RFR loans, honouring the four convention fields the
// v3 Builder persists on `interest_terms`:
//
//   • lookbackDays     — observation period ends N business days before
//                        the period-end (typical: 5 days for SONIA loans).
//   • observationShift — also shifts the period START by N business days.
//                        When true (combined with lookback), the period
//                        window for weighting equals the actual interest
//                        period (vs the standard "look-back only" where
//                        the window is shifted but weights track the
//                        observation period, not the interest period).
//   • lockoutDays      — the rate observed (period_end − lockoutDays) is
//                        repeated for the final L days (common in U.S.
//                        SOFR loans following the ARRC fallback).
//   • dailyCompounding — true → daily-compounded;
//                        false → simple-arithmetic average of fixings.
//
// Input requires an actual fixings series on instr.rfr.fixings = [{date,rate}].
// When the series is empty or missing, returns null and the caller falls back
// to `instr.rfr.baseRate` (preserves legacy behaviour).
//
// The "period" for compounding is heuristic — uses tenor: '3M'→90d, '1M'→30d
// etc., back from the as-of date. Real loans would tie this to coupon-period
// boundaries; this is a reasonable approximation for daily accrual.
function computeCompoundedRFR(asOfDate, instr){
  const rfr = instr && instr.rfr;
  if(!rfr || !Array.isArray(rfr.fixings) || rfr.fixings.length === 0) return null;
  const lookback   = +rfr.lookbackDays     || 0;
  const obsShift   = +rfr.observationShift || 0;
  const lockout    = +rfr.lockoutDays      || 0;
  const compounded = !!rfr.dailyCompounding;
  // Tenor → period length in calendar days (approx).
  const tenorDays = { '1M':30, '3M':90, '6M':180, '12M':365 }[rfr.tenor || '3M'] || 90;
  // Observation window: [periodStart − obsShift, asOf − lookback], with the
  // last `lockout` days inside that window held flat at the rate observed on
  // (periodEnd − lockout).
  const periodEnd       = addDays(asOfDate, -lookback);
  const periodStart     = addDays(periodEnd, -tenorDays + (obsShift ? obsShift : 0));
  const lockoutCutoff   = addDays(periodEnd, -lockout);
  // Build a date → rate lookup from fixings (latest fix on or before each day wins).
  const fxs = rfr.fixings.slice().sort((a,b) => (a.date||'').localeCompare(b.date||''));
  function fixingAt(d){
    const iso = toISO(d);
    let lastRate = null;
    for(const f of fxs){
      if(f.date <= iso) lastRate = +f.rate || 0;
      else break;
    }
    return lastRate != null ? lastRate : (rfr.baseRate || 0);
  }
  // Walk daily across the observation window.
  let product = 1;     // for compounded
  let sum     = 0;     // for simple
  let count   = 0;
  const lockoutRate = fixingAt(lockoutCutoff);
  for(let d = new Date(periodStart); d <= periodEnd; d = addDays(d, 1)){
    const rate = (d > lockoutCutoff && lockout > 0) ? lockoutRate : fixingAt(d);
    if(compounded){
      // Daily compounding: (1 + r × 1/360) factor
      product *= (1 + rate / 360);
    } else {
      sum += rate;
    }
    count++;
  }
  if(count === 0) return null;
  if(compounded){
    // Annualise: (product − 1) × 360 / count
    return (product - 1) * 360 / count;
  }
  return sum / count;
}

function lookupMarginBps(dateISO){
    const ms = instr.marginSchedule || [];
    for(const m of ms){
      const f = m.from || '0000-01-01';
      const t = m.to   || '9999-12-31';
      if(dateISO >= f && dateISO <= t) return m.marginBps;
    }
    return null;
  }
  function esgDeltaBps(dateISO){
    const e = instr.esgAdjustment;
    if(!e || !e.from) return 0;
    return dateISO >= e.from ? (e.deltaBps || 0) : 0;
  }

  const rows = [];
  const days = eachDay(settle, maturity);
  for(let i=0; i<days.length; i++){
    const d = days[i];

    // ----- Apply events first (draws, paydowns, prepayments, write-offs, recoveries, cures, forbearance, cap. costs, loan sales) -----
    const evs = eventsOn(d, events);
    let draw=0, paydown=0, prepayment=0, prepayPenalty=0, initial=0;
    let mandatoryPrepayment=0;                       // Transtype #16 — covenant-triggered portion
    const mandatoryTriggers = [];                    // Transtype #16 — array of trigger reason codes
    let writeOff=0, writeOffAllowanceUsed=0, writeOffResidualExpense=0;
    let recovery=0;
    let recoveryAllocation=null;        // Transtype #24 — optional bucket split
    let cureRelease=0;                  // Transtype #10
    let allowanceReversal=0;            // Transtype #23 — model-driven, no stage change
    let forbearanceStartDeferred=0;     // Transtype #11 (one-time deferral booking on start date)
    let capitalisedCost=0;              // Transtype #12 (one-off origination cost paid out)
    let loanSale=0, loanSaleCV=0, loanSaleGain=0;  // Transtype #13 (cash, carrying derecognised, gain/loss)
    let participation=0, participationCV=0, participationGain=0;  // Transtype #14 (partial sale)
    let debtEquitySwap=0, debtEquitySwapCV=0, debtEquitySwapLoss=0;  // Transtype #15 (D4E swap)
    const dateISO = toISO(d);
    for(const e of evs){
      if(e.type==='initial'){ initial += e.amount; /* already counted into starting balance */ }
      else if(e.type==='draw'){
        // Skip the draw event that was already consumed by the initialDraw
        // detection (otherwise balance/carryingValue would double-count).
        if(e._consumedAsInitial){ draw += e.amount; /* counted into starting balance */ }
        else { draw += e.amount; balance += e.amount; drawnBalance += e.amount; carryingValue += e.amount; }
      }
      // 'repayment' is an alias for 'paydown' used by guarantee / equity-fund
      // examples — semantically clearer when reading the schedule.
      // Phase C bugfix — clamp the deduction to current balance so a previously-
      // executed acceleration (covenant-breach mandatoryPrepayment that already
      // zeroed the balance) doesn't get further reduced by the remaining
      // scheduled paydowns. The loan is extinguished; subsequent scheduled
      // payments are no-ops.
      else if(e.type==='paydown' || e.type==='repayment'){
        const actual = Math.min(Math.max(0, balance), e.amount);
        paydown += actual;
        balance -= actual;
        drawnBalance = Math.max(0, drawnBalance - actual);
        carryingValue = Math.max(0, carryingValue - actual);
      }
      // Transtype #4 — Prepayment. Same balance / carrying effect as paydown,
      // tagged separately so generateDIU emits a distinct "Loan Prepayment" JE.
      else if(e.type==='prepayment'){
        prepayment += e.amount; balance -= e.amount; drawnBalance -= e.amount; carryingValue -= e.amount;
        // Transtype #5 — Prepayment penalty.
        // Look up the applicable rate from instr.prepaymentPenaltySchedule[] and
        // compute penalty = prepayAmount × rate. If the prepayment event itself
        // carries a `penaltyRate` field, that overrides the schedule (per-deal
        // negotiated case).
        const sched = Array.isArray(instr.prepaymentPenaltySchedule) ? instr.prepaymentPenaltySchedule : [];
        let rate = 0;
        if(typeof e.penaltyRate === 'number') rate = e.penaltyRate;
        else {
          const band = sched.find(s => (!s.from || s.from <= dateISO) && (!s.to || s.to >= dateISO));
          if(band) rate = band.ratePct || band.rate || 0;
        }
        if(rate > 0) prepayPenalty += e.amount * rate;
      }
      // Transtype #16 — Mandatory Prepayment Events. Covenant-triggered
      // partial or full early repayment (excess cash flow sweep, change-of-
      // control, asset disposal proceeds, insurance/condemnation, IPO
      // proceeds). Same balance/carrying effect as a voluntary prepayment,
      // but tagged separately so DIU emits a distinct transtype carrying
      // the trigger reason — critical for covenant tracking and lender
      // reporting. Default: NO penalty income (mandatory prepayments
      // typically waive penalty by design).
      //   • trigger: 'excessCashFlow'|'changeOfControl'|'assetSale'|'ipo'|'insurance'
      //   • penaltyRate: 0 by default — set explicitly if the credit agreement
      //                  applies a make-whole even on mandatory prepay
      else if(e.type==='mandatoryPrepayment'){
        // Phase A #4 — Covenant-synthesised events carry amount=0 until the
        // trigger date; materialise the amount as the FULL outstanding balance
        // (acceleration), recomputed at the actual trigger date so prior
        // paydowns inside the schedule are netted correctly.
        if(e._covenantSynthesised && (!e.amount || e.amount === 0)){
          e.amount = Math.max(0, balance);
        }
        mandatoryPrepayment += e.amount;
        // Also feed into the overall prepayment bucket so dashboard / cashflow
        // charts continue to display the principal flow correctly (the voluntary
        // vs. mandatory split is recovered in DIU via the dedicated row field).
        prepayment   += e.amount;
        balance      -= e.amount;
        drawnBalance -= e.amount;
        carryingValue-= e.amount;
        if(e.trigger) mandatoryTriggers.push(e.trigger);
        // Apply penalty only if the event explicitly carries a rate (rare).
        if(typeof e.penaltyRate === 'number' && e.penaltyRate > 0){
          prepayPenalty += e.amount * e.penaltyRate;
        }
      }
      // Transtype #9 — Recovery post-write-off. Cash received from the
      // borrower (or bankruptcy estate, guarantor, collateral realisation)
      // AFTER the loan has been written off. Balance / carrying remain zero;
      // the recovery is recognised as income that reverses prior impairment.
      // Per IFRS 9 §B5.5.43 / ASC 326-20-30, recoveries are credited to the
      // same line that absorbed the original write-off (470000 Impairment).
      else if(e.type==='recovery'){
        recovery += e.amount;
        // ── Transtype #24 — Loan-Loss Recovery Allocation ──
        // Optional `allocation` object splits the recovery across buckets
        // (principal / default interest / default fees / legal). When present,
        // generateDIU emits one JE pair per bucket so reports can trace where
        // the recovered cash actually paid down. If absent, falls through to
        // the single principal-only JE pair (legacy behaviour).
        if(e.allocation){
          // Tag the day's row so generateDIU sees the split (carries through
          // via the row push at end of loop iteration).
          recoveryAllocation = recoveryAllocation || { principal:0, defaultInt:0, defaultFee:0, legal:0 };
          recoveryAllocation.principal  += (+e.allocation.principal  || 0);
          recoveryAllocation.defaultInt += (+e.allocation.defaultInt || 0);
          recoveryAllocation.defaultFee += (+e.allocation.defaultFee || 0);
          recoveryAllocation.legal      += (+e.allocation.legal      || 0);
        }
      }
      // Transtype #10 — Cure / Stage Reversal. Borrower returns to performing
      // status; the ECL allowance is released back to P&L. `releaseAmount`
      // specifies how much of the existing allowance to reverse. The engine
      // releases up to the existing allowance balance, no more.
      else if(e.type==='cure'){
        const release = Math.min(eclAllowance, e.releaseAmount || 0);
        cureRelease  += release;
        eclAllowance -= release;
        cumECLChange -= release;
      }
      // Transtype #23 — Allowance Reversal (Without Stage Change).
      // Same mechanic as cure (release ECL allowance to P&L) but driven by a
      // model recalibration (PD/LGD update, macro overlay change, qFactor
      // adjustment) rather than a stage migration. Distinct event type so
      // reports / IFRS 7 §35F disclosures can split "model-driven movements"
      // from "stage-cure movements" in the ECL roll-forward.
      else if(e.type==='allowanceReversal'){
        const release = Math.min(eclAllowance, e.releaseAmount || 0);
        allowanceReversal += release;
        eclAllowance      -= release;
        cumECLChange      -= release;
      }
      // Transtype #11 — Forbearance / Payment Holiday. A start-of-period
      // booking that documents the deferred interest expected during the
      // holiday window. Subsequent JE flows continue as normal (engine doesn't
      // suspend accruals — for clean demos the operator/PortF schedules
      // payments accordingly). The `deferredAmount` is the operator-estimated
      // interest deferred over the holiday period.
      else if(e.type==='forbearance'){
        forbearanceStartDeferred += (e.deferredAmount || 0);
      }
      // Transtype #12 — Capitalised origination costs. Costs PAID by NWF at
      // origination (legal, transaction, valuation) that capitalise into the
      // loan's carrying value per IFRS 9 §B5.4 / ASC 310-20-25-2. Increases
      // carrying by the cost amount and reduces day-1 cash by the same.
      else if(e.type==='capitalisedCost'){
        capitalisedCost += e.amount;
        carryingValue   += e.amount;
      }
      // Transtype #13 — Loan Sale (full derecognition). Sell the entire loan
      // to another lender / investor. Compute gain/loss = salePrice − carrying
      // at the sale date; zero out balance + drawnBalance + carryingValue so
      // subsequent days produce no further accruals (balance × rate × dcf = 0).
      // Per IFRS 9 §3.2.3 / ASC 860 derecognition: full transfer of control,
      // risks and rewards. Any residual ECL allowance is released to P&L below.
      else if(e.type==='loanSale'){
        const cvBefore = carryingValue;
        const sale     = (typeof e.salePrice === 'number') ? e.salePrice
                        : (typeof e.amount    === 'number') ? e.amount
                        : carryingValue;
        loanSale       += sale;
        loanSaleCV     += cvBefore;
        loanSaleGain   += (sale - cvBefore);
        // Release any remaining ECL allowance back to P&L (since the asset
        // and its credit exposure no longer belong to NWF).
        if(eclAllowance > 0){
          cureRelease  += eclAllowance;
          cumECLChange -= eclAllowance;
          eclAllowance  = 0;
        }
        // Derecognise the asset
        balance        = 0;
        drawnBalance   = 0;
        carryingValue  = 0;
      }
      // Transtype #14 — Loan Participation / Partial Sell-Down. NWF sells a
      // fraction (`fraction` 0–1, or `notionalSold` in currency) of the loan
      // to a participant. Per IFRS 9 §3.2.6 "transfer of part of asset where
      // the part is a fully proportionate share" — derecognise the
      // participated proportion, keep the rest on balance sheet accruing.
      //
      //   • fraction   : 0–1 (default if both given); engine multiplies by carrying
      //   • salePrice  : cash received from participant
      //   • Pro-rata ECL allowance also released for the sold portion
      else if(e.type==='participation'){
        let frac = (typeof e.fraction === 'number') ? e.fraction : null;
        if(frac == null && typeof e.notionalSold === 'number' && balance > 0){
          frac = e.notionalSold / balance;
        }
        if(frac == null || frac <= 0) frac = 0;
        if(frac > 1) frac = 1;
        const cvSold   = carryingValue * frac;
        const balSold  = balance       * frac;
        const drawSold = drawnBalance  * frac;
        const sale     = (typeof e.salePrice === 'number') ? e.salePrice : cvSold;
        participation     += sale;
        participationCV   += cvSold;
        participationGain += (sale - cvSold);
        // Pro-rata ECL allowance release (participant takes the credit risk).
        if(eclAllowance > 0 && frac > 0){
          const eclRelease = eclAllowance * frac;
          cureRelease  += eclRelease;
          cumECLChange -= eclRelease;
          eclAllowance -= eclRelease;
        }
        // Derecognise the sold proportion only
        balance       -= balSold;
        drawnBalance  -= drawSold;
        carryingValue -= cvSold;
      }
      // Transtype #15 — Debt-for-Equity Swap. Borrower issues equity to
      // settle the loan obligation. Per IFRIC 19 ("Extinguishing Financial
      // Liabilities with Equity Instruments") / ASC 470-50-40: derecognise
      // the entire loan at carrying; recognise an equity investment at fair
      // value (almost always lower than carrying in a distressed swap); the
      // difference flows to P&L as Restructuring Loss.
      //
      //   • equityFairValue : fair value of equity received
      //   • equityShares    : optional — # shares received (informational only)
      else if(e.type==='debtEquitySwap'){
        const cvBefore = carryingValue;
        const fv       = (typeof e.equityFairValue === 'number') ? e.equityFairValue : 0;
        debtEquitySwap     += fv;
        debtEquitySwapCV   += cvBefore;
        debtEquitySwapLoss += (cvBefore - fv);   // typically positive (loss)
        // Release any ECL allowance (loan no longer NWF's credit exposure).
        if(eclAllowance > 0){
          cureRelease  += eclAllowance;
          cumECLChange -= eclAllowance;
          eclAllowance  = 0;
        }
        // Derecognise the loan
        balance        = 0;
        drawnBalance   = 0;
        carryingValue  = 0;
      }
      // Transtype #8 — Write-off. Stage 3 credit-impaired loan whose recovery
      // efforts have failed. Zero out balance + carryingValue; subsequent days
      // produce no further accruals (because balance × rate × dcf = 0).
      // The JE pair generated in generateDIU splits the write-off between the
      // existing ECL allowance (uses it up first) and a residual P&L charge.
      else if(e.type==='writeOff'){
        const wAmt = (typeof e.amount === 'number' && e.amount > 0) ? e.amount : balance;
        writeOff += wAmt;
        // Snapshot the allowance balance available to absorb the write-off
        const availableAllowance = Math.max(0, eclAllowance);
        const used = Math.min(wAmt, availableAllowance);
        writeOffAllowanceUsed   += used;
        writeOffResidualExpense += (wAmt - used);
        // Apply the write-off to balances + allowance
        balance        -= wAmt;
        drawnBalance   -= wAmt;
        carryingValue  -= wAmt;
        eclAllowance   -= used;            // allowance consumed
        cumECLChange   -= used;            // allowance release recorded
      }
    }

    // ----- IFRS 9 modification accounting (§5.4.3) -----------------------
    // modificationEvents: [{date, modType, gainLoss, newCoupon, newMaturity,
    //                       newSchedule, reason, pvDelta}]
    // Substantial mod (≥10% PV change) → derecognise + new instrument (the
    // engine logs the event and applies new terms forward; full derecog/re-
    // recog requires splitting into two instruments which we surface in DIU).
    // Non-substantial → adjust carrying value + post P&L gain/loss.
    let dailyModGain = 0;
    let modEventDescription = null;
    const dISO = toISO(d);
    for(const mev of (instr.modificationEvents || [])){
      if(mev.date !== dISO) continue;
      const gainLoss = mev.gainLoss || 0;
      dailyModGain += gainLoss;
      modEventDescription = (mev.modType === 'substantial' ? 'Substantial' : 'Non-substantial')
                          + ' modification' + (mev.reason ? ' — ' + mev.reason : '');
      // Apply forward-looking term changes
      if(mev.newCoupon){
        instr.coupon = Object.assign({}, instr.coupon || {}, mev.newCoupon);
      }
      if(mev.newMaturity){
        // Note: maturity change mid-life only takes effect for accrual purposes
        // beyond this date. The day grid was fixed at loop start so we won't
        // extend rows — set a flag for the user.
        instr.maturityDate = mev.newMaturity;
      }
      // For non-substantial mods, adjust carrying value by gain/loss (P&L pair posted via DIU)
      if(mev.modType !== 'substantial' && gainLoss){
        carryingValue += gainLoss;
      }
    }

    // ----- Determine effective coupon rate for today -----
    let couponRate = instr.coupon?.fixedRate ?? 0;
    let floatingRate = instr.coupon?.floatingRate ?? 0;
    const todayISO = toISO(d);
    if(instr.coupon?.type === 'Floating'){
      // Apply spread + cap/floor
      let r = floatingRate + (instr.coupon.spread ?? 0);
      if(instr.coupon.floor != null) r = Math.max(r, instr.coupon.floor);
      if(instr.coupon.cap   != null) r = Math.min(r, instr.coupon.cap);
      couponRate = r;
    } else if(instr.coupon?.type === 'SONIA' || instr.coupon?.type === 'CompoundedRFR'){
      // RFR (SONIA / SOFR / ESTR / BBSW) + ratcheted margin + optional ESG.
      // V3 — Use computeCompoundedRFR which respects lookback / observation_shift
      // / lockout / daily_compounding / weighted from instr.rfr (projected by
      // builderToInstrument from interest_terms). Falls back to baseRate when
      // no actual fixings series is supplied — same as the legacy behaviour.
      const rfrBase = computeCompoundedRFR(d, instr) || (instr.rfr?.baseRate ?? floatingRate) || 0;
      const baseMarginBps = lookupMarginBps(todayISO);
      const marginBps = (baseMarginBps != null ? baseMarginBps : (instr.coupon.spread ?? 0)*10000)
                       + esgDeltaBps(todayISO);
      let r = rfrBase + marginBps/10000;
      if(instr.coupon.floor != null) r = Math.max(r, instr.coupon.floor);
      if(instr.coupon.cap   != null) r = Math.min(r, instr.coupon.cap);
      couponRate = r;
    }

    // ----- Phase A #3 — Covenant breach margin step-up -----
    // Applied uniformly across Fixed / Floating / RFR coupons so any breached
    // covenant with consequence=marginStepUp lifts the rate from breachDate
    // onward. Multiple breaches stack additively. Floor/cap are NOT
    // re-applied: the step-up represents a credit-spread penalty per the loan
    // agreement and is intentionally permitted to push above the contractual
    // cap.
    const covenantBreachStepUpBps = covenantMarginStepBpsOn(todayISO);
    if(covenantBreachStepUpBps > 0){
      couponRate += covenantBreachStepUpBps / 10000;
    }
    // Compute SICR flag once per day so both ECL block and row push can read it
    const covenantSICRActive = covenantSICRActiveOn(todayISO);

    // ----- Holiday skip (Req 18): when enabled, zero the day-count factor on holidays -----
    const onHoliday = instr.holidayCalendar && instr.holidayCalendar!=='none' && isHoliday(d, instr.holidayCalendar);
    const skipToday = !!(instr.skipHolidays && onHoliday);

    // ----- Amortization window (Req 10): only amortize inside [amortStart, amortEnd] if set -----
    const amortStart = instr.amortStart ? parseISO(instr.amortStart) : settle;
    const amortEnd   = instr.amortEnd   ? parseISO(instr.amortEnd)   : maturity;
    const inAmortWindow = d >= amortStart && d <= amortEnd;

    // ----- Day count factor -----
    const dcf = skipToday ? 0 : dayCountFactor(basis, d);

    // ----- Daily cash accrual -----
    // For guarantee / equity instruments NWF does not earn the underlying
    // loan's coupon (only fees / dividends), so suppress interest accrual.
    // The coupon rate stays on the row for reference (drives the underlying
    // loan's behaviour and any rate-linked guarantee fee calcs).
    const noInterest = instr.instrumentKind === 'guarantee'
                    || instr.instrumentKind === 'equity-fund'
                    || instr.instrumentKind === 'equity-direct';
    const dailyCash = noInterest ? 0 : (balance * couponRate * dcf);
    cumCashAccrued += dailyCash;
    cumInterestEarned += dailyCash;

    // ----- Default interest / default fee accrual -----
    // instr.defaultEvents: [{date, kind:'missedPayment'|'covenantBreach',
    //                        defaultRateBps, defaultFeeAmount, endDate?, reason}]
    // From the event date (until endDate or maturity) the engine adds
    // defaultRateBps × balance × dcf as additional default interest, and
    // recognises defaultFeeAmount as a one-off default fee on the event date.
    let dailyDefaultInterest = 0;
    let dailyDefaultFee = 0;
    if(Array.isArray(instr.defaultEvents)){
      for(const ev of instr.defaultEvents){
        if(!ev.date) continue;
        const evEnd = ev.endDate || toISO(maturity);
        if(todayISO >= ev.date && todayISO <= evEnd && ev.defaultRateBps){
          dailyDefaultInterest += balance * (ev.defaultRateBps/10000) * dcf;
        }
        if(todayISO === ev.date && ev.defaultFeeAmount){
          dailyDefaultFee += ev.defaultFeeAmount;
        }
      }
    }

    // ----- Daily PIK accrual -----
    let dailyPik = 0;
    if(pikEnabled){
      dailyPik = balance * pikRateNominal * dcf;
      cumPikAccrued += dailyPik;
      cumPikEarned  += dailyPik;
    }

    // ----- IFRS 9 ECL provisioning ---------------------------------------
    // Target ECL based on stage:
    //   Stage 1: 12-month ECL  =  pdAnnual × lgd × balance
    //   Stage 2: lifetime ECL  =  min(1, pdAnnual × yearsRemaining) × lgd × balance
    //   Stage 3: lifetime ECL on net carrying (= gross - existing allowance)
    // Daily change = target - allowance (positive grows allowance, negative reverses).
    let dailyECLChange = 0;
    if(instr.ifrs && instr.ifrs.computeECL !== false){
      // Phase A #2 — SICR auto-migration on covenant breach.
      // Per IFRS 9 §B5.5.17(k) and ASC 326-20-30-2, a covenant breach is a
      // qualitative indicator of significant increase in credit risk. When
      // any covenant with consequence=sicrTrigger is breached, escalate
      // Stage 1 → Stage 2 from breachDate onward (manual Stage 3 overrides
      // still win; we only escalate, never de-escalate).
      let stage = instr.ifrs.ecLStage || 1;
      if(covenantSICRActive && stage < 2) stage = 2;
      const pdAnn = instr.ifrs.pdAnnual || 0;
      const lgd   = instr.ifrs.lgd || 0;
      if(pdAnn > 0 && lgd > 0 && balance > 0){
        const yrsRemaining = Math.max(0, (maturity - d) / (365 * ONE_DAY));
        let lifetimePD = Math.min(1, pdAnn * yrsRemaining);
        let targetECL;
        if(stage === 1){
          targetECL = balance * pdAnn * lgd;
        } else if(stage === 2){
          targetECL = balance * lifetimePD * lgd;
        } else {
          // Stage 3 — credit-impaired: lifetime ECL on net carrying
          const netCarrying = Math.max(0, balance - eclAllowance);
          targetECL = netCarrying * lifetimePD * lgd + eclAllowance;
          // Clamp so the net allowance stays sane
          targetECL = Math.min(balance, targetECL);
        }
        dailyECLChange = targetECL - eclAllowance;
        eclAllowance += dailyECLChange;
        cumECLChange += dailyECLChange;
      }
    }

    // ----- FX revaluation ------------------------------------------------
    // Revalue OPENING balance at today's rate vs prior day's rate. Flow
    // changes on the day (draws/repayments) get booked at today's FX so they
    // don't generate FX P&L themselves.
    const todayFX = fxRateOn(todayISO);
    const dailyFXGain = (i === 0) ? 0 : (balance - draw + paydown) * (todayFX - prevFX);
    // (balance - draw + paydown) reconstructs the opening balance: today's
    // closing balance was already adjusted for the day's flows above.
    cumFXGain += dailyFXGain;
    prevFX = todayFX;

    // ----- IFRS 9 hedge accounting (§6) --------------------------------
    // Daily hedge MTM change is split into effective (OCI for CFH) and
    // ineffective (P&L for both CFH and FVH). For FVH the entire change is
    // P&L because it directly offsets the hedged item's FV movements.
    let dailyHedgeOCI = 0;          // CFH effective portion
    let dailyHedgePL  = 0;          // ineffective (CFH) or full hedge MTM (FVH)
    let dailyHedgeReclass = 0;      // CFH reclassification to P&L on settlement
    let hedgeEffectiveness = null;  // 80-125% test indicator
    if(instr.hedge && instr.hedge.type){
      const effRatio = instr.hedge.effectivenessRatio ?? 0.95;
      const todayMTM = hedgeMTMOn(dISO);
      const dMTM = (i === 0) ? 0 : todayMTM - prevHedgeMTM;
      prevHedgeMTM = todayMTM;
      // ── Transtype #20 — Hedge De-Designation ──
      // Per IFRS 9 §6.5.6 / ASC 815-25-40 / 815-30-40: once hedge accounting
      // is voluntarily discontinued, future MTM movements stop flowing through
      // the CFH OCI / FVH P&L mechanism. For CFH, the EXISTING reserve is
      // amortised to P&L over the remaining life of the originally-hedged
      // exposure. Trigger via instr.hedgeDeDesignationDate.
      const dedDate = instr.hedgeDeDesignationDate;
      const isDeDed = dedDate && dISO >= dedDate;
      if(isDeDed){
        // No further OCI / P&L accumulation from MTM changes — accounting frozen.
        // For CFH, amortise the existing reserve linearly to P&L over remaining
        // days from de-designation date to maturity.
        if(instr.hedge.type === 'CFH' && Math.abs(cashFlowHedgeReserve) > 0.005){
          // Compute remaining days from de-designation to maturity (inclusive)
          const dedDateObj = parseISO(dedDate);
          const remainDays = Math.max(1, Math.ceil((maturity - dedDateObj) / 86400000));
          // Amortise daily until reserve is fully recycled
          const dailyAmort = cashFlowHedgeReserve / remainDays;
          dailyHedgeReclass = dailyAmort;
          cashFlowHedgeReserve -= dailyAmort;
          // Numerical cleanup: if reserve gets close to zero, zero it out
          if(Math.abs(cashFlowHedgeReserve) < 0.01) cashFlowHedgeReserve = 0;
        }
      } else if(instr.hedge.type === 'CFH'){
        // Cash flow hedge: effective portion to OCI, ineffective to P&L
        dailyHedgeOCI = dMTM * effRatio;
        dailyHedgePL  = dMTM * (1 - effRatio);
        cashFlowHedgeReserve += dailyHedgeOCI;
        // Reclassify reserve to P&L on settlement dates (when hedged cashflow occurs)
        if(hedgeSettlements.has(dISO) && cashFlowHedgeReserve !== 0){
          dailyHedgeReclass = cashFlowHedgeReserve;
          cashFlowHedgeReserve = 0;
        }
      } else if(instr.hedge.type === 'FXP' || instr.hedge.subType === 'fxPrincipal'){
        // ── Transtype #22 — FX Hedge of Loan Principal (IFRS 9 §6.5.16(c)) ──
        // Same MTM math as CFH, but the OCI accumulates in the dedicated
        // FX Hedge Reserve (370000) instead of the generic CFH Reserve.
        // The JE emission routes through INVESTRAN_GL.fxHedgeReserveOCI
        // because the transactionType is labelled "FX Hedge Reserve" below.
        dailyHedgeOCI = dMTM * effRatio;
        dailyHedgePL  = dMTM * (1 - effRatio);
        cashFlowHedgeReserve += dailyHedgeOCI;
        if(hedgeSettlements.has(dISO) && cashFlowHedgeReserve !== 0){
          dailyHedgeReclass = cashFlowHedgeReserve;
          cashFlowHedgeReserve = 0;
        }
      } else if(instr.hedge.type === 'FVH'){
        // Fair value hedge: full MTM change to P&L
        dailyHedgePL = dMTM;
      }
      // Effectiveness ratio test — must be in 80-125% range under IFRS 9
      // (legacy IAS 39 numerical test; IFRS 9 §6.4.1 only requires economic
      // relationship + dominant credit risk, but we surface the ratio for
      // diagnostic purposes).
      hedgeEffectiveness = effRatio;
      cumHedgeOCI += dailyHedgeOCI;
      cumHedgePL  += dailyHedgePL;
      cumHedgeReclass += dailyHedgeReclass;
    }

    // ----- Non-use fee (on undrawn commitment) -----
    let dailyNonUse = 0;
    if(instr.nonUseFee?.enabled && commitment > drawnBalance){
      dailyNonUse = (commitment - drawnBalance) * (instr.nonUseFee.rate ?? 0) * dcf;
      cumNonUseFee += dailyNonUse;
    }

    // ----- Multi-fee daily accrual (IFRS 9 / 15 aware) -----
    // Each fee accrues on its own base × rate × dcf when in-window. EIR-classified
    // fees feed deferredEIRPool (one-off side already booked at t0); the pool
    // accretes daily into interest income (via carryingValue accretion). IFRS 15
    // fees recognise income directly on the fee line.
    let dailyFees = 0;
    const dailyFeeBreakdown = {};
    for(let fi=0; fi<fees.length; fi++){
      const f = fees[fi];
      const acc = feeAccum[fi];
      const accFrom = f.accrueFrom ? parseISO(f.accrueFrom) : settle;
      const accTo   = f.accrueTo   ? parseISO(f.accrueTo)   : maturity;
      if(d < accFrom || d > accTo) continue;
      let amt = 0;
      // One-off fees (arrangement, structuring) are captured into the
      // deferredEIRPool at t0 — skip the daily accrual loop entirely so
      // they don't double-count. They surface via dailyEIRAccretion (IFRS 9)
      // or as a point-in-time recognition row on paymentDate (IFRS 15).
      if(f.frequency === 'oneOff') {
        // Point-in-time IFRS 15: recognise the full amount on paymentDate.
        if(f.ifrs === 'IFRS15-pointInTime' && f.paymentDate && toISO(d) === f.paymentDate){
          if(f.mode === 'percent'){
            const baseAmt = (b => {
              if(b==='commitment') return commitment;
              if(b==='face')       return instr.faceValue || 0;
              if(b==='drawn')      return drawnBalance;
              if(b==='covered')    return instr.coveredAmount || 0;
              return commitment;
            })(f.base || 'commitment');
            amt = baseAmt * (f.rate || 0);
          } else {
            amt = f.amount || 0;
          }
        }
        // IFRS9-EIR / IFRS15-overTime one-offs: skip — already in EIR pool.
      } else if(f.mode === 'percent' || f.mode === 'marginLinked'){
        // Per-fee rate ratchet: if feeRateSchedule = [{from,to,rate}] is set,
        // resolve today's rate from the schedule (otherwise fall back to f.rate).
        // Closes scenario #14 (commitment fee % ratchets) and G3 (time-based
        // guarantee fee adjustments) — works for any percent-mode fee.
        let effectiveRate = f.rate || 0;
        if(Array.isArray(f.feeRateSchedule) && f.feeRateSchedule.length){
          for(const step of f.feeRateSchedule){
            const fr = step.from || '0000-01-01';
            const to = step.to   || '9999-12-31';
            if(todayISO >= fr && todayISO <= to){ effectiveRate = step.rate; break; }
          }
        }
        // For guarantee instruments, "drawn" / "undrawn" naturally refer to
        // the covered tranche, not the full facility. Fall back to commitment-
        // based for non-guarantee loans so existing behaviour is preserved.
        const isGuar = instr.instrumentKind === 'guarantee';
        const cap = isGuar && instr.coveredAmount ? instr.coveredAmount : commitment;
        const baseAmt = (b => {
          if(b==='commitment') return commitment;
          if(b==='undrawn')    return Math.max(0, cap - drawnBalance);
          if(b==='drawn')      return Math.min(drawnBalance, cap);
          if(b==='covered')    return instr.coveredAmount || 0;
          if(b==='face')       return instr.faceValue || 0;
          return cap;
        })(f.base || 'undrawn');
        if(f.mode === 'marginLinked'){
          // UK convention: commitment fee = marginMultiple × current margin × undrawn × dcf.
          // Margin includes ESG adjustment so the fee tracks the contractual
          // economics. marginMultiple defaults to 0.35 (35%).
          const baseMarginBps = lookupMarginBps(todayISO);
          const marginBps = (baseMarginBps != null ? baseMarginBps
                              : (instr.coupon?.spread ?? 0) * 10000)
                            + esgDeltaBps(todayISO);
          const eff = (marginBps/10000) * (f.marginMultiple ?? 0.35);
          amt = baseAmt * eff * dcf;
        } else {
          amt = baseAmt * effectiveRate * dcf;
        }
      } else if(f.mode === 'flat' || f.mode === 'fixed'){
        // Spread flat amount linearly across accrual window
        // 'fixed' is the v3 builder's mapping of 'fixAmount'; treat identical to 'flat'.
        const lifeDays = Math.max(1, Math.round((accTo - accFrom)/ONE_DAY) + 1);
        amt = (f.amount || 0) / lifeDays;
      }
      if(amt){
        acc.cumAccrued += amt;
        dailyFees += amt;
        dailyFeeBreakdown[acc.label] = (dailyFeeBreakdown[acc.label]||0) + amt;
      }
    }

    // ----- EIR accretion of deferred IFRS 9 fees -----
    // Deferred income (from arrangement / OID-style fees) accretes back into
    // interest income via increasing the carrying value daily.
    // V3 — Two-part fix to prevent carrying value from going negative:
    //   1. While balance > 0: accrete the daily slice as normal, but cap
    //      cumulative accretion at deferredEIRPool (prevents float rounding
    //      from over-shooting the pool).
    //   2. When balance hits zero on this row (paydown / loan sale / write-off
    //      / final maturity payment processed earlier in the event loop),
    //      CRYSTALLISE the remaining residual pool in one shot. This is the
    //      correct accounting treatment: the loan is derecognised so any
    //      unamortised deferred fee must be recognised at that moment.
    let dailyEIRAccretion = 0;
    if(eirDailyAccretion > 0){
      const remainingPool = Math.max(0, deferredEIRPool - cumulativeEIRAccreted);
      if(balance > 0.005){
        // Standard daily accretion — but never exceed the residual pool
        dailyEIRAccretion = Math.min(eirDailyAccretion, remainingPool);
      } else if(remainingPool > 0.005){
        // Balance just hit zero — crystallise the entire residual pool today
        dailyEIRAccretion = remainingPool;
      }
      if(dailyEIRAccretion > 0){
        carryingValue += dailyEIRAccretion;
        cumulativeEIRAccreted += dailyEIRAccretion;
      }
    }

    // ----- Capitalization (PIK) -----
    let capitalized = 0;
    if(pikEnabled && isCapitalizationDay(d, capAnchor, capFreq) && cumPikAccrued > 0){
      capitalized = cumPikAccrued;
      balance += capitalized;
      carryingValue += capitalized;
      cumPikAccrued = 0; // reset accrued pool
    }

    // ----- Amortization of discount/premium -----
    let dailyAmort = 0;
    if(inAmortWindow){
      if(amort.method === 'straightLine'){
        dailyAmort = straightLineDaily;
        carryingValue += dailyAmort;
        cumAmort += dailyAmort;
      } else if(effectiveYield != null){
        // effective interest: daily yield accrual on carrying value
        const dyield = effectiveYield * dcf;
        const effectiveIncome = carryingValue * dyield;
        dailyAmort = effectiveIncome - dailyCash; // portion that amortizes discount/premium
        carryingValue += dailyAmort;
        cumAmort += dailyAmort;
      }
    }

    rows.push({
      date: toISO(d),
      jsDate: d,
      dayOfWeek: d.getDay(),
      balance,
      drawnBalance,
      carryingValue,
      initialPurchase: initial || 0,
      draw,
      paydown,
      prepayment,            // Transtype #4 — voluntary / mandatory early repayment (combined)
      mandatoryPrepayment,   // Transtype #16 — covenant-triggered portion (subset of `prepayment`)
      mandatoryTriggers: mandatoryTriggers.slice(),  // Transtype #16 — array of reason codes
      prepayPenalty,         // Transtype #5 — penalty income tied to prepayment
      writeOff,              // Transtype #8 — gross write-off amount
      writeOffAllowanceUsed, // Transtype #8 — portion absorbed by ECL allowance
      writeOffResidualExpense, // Transtype #8 — residual hitting P&L
      recovery,              // Transtype #9 — post-write-off cash recovered
      recoveryAllocation,    // Transtype #24 — optional split: {principal, defaultInt, defaultFee, legal}
      cureRelease,           // Transtype #10 — ECL allowance released back to P&L
      allowanceReversal,     // Transtype #23 — model-driven allowance reversal (no stage change)
      forbearanceStartDeferred,  // Transtype #11 — interest deferred from forbearance
      capitalisedCost,       // Transtype #12 — capitalised origination costs paid
      loanSale,              // Transtype #13 — sale proceeds (cash in)
      loanSaleCV,            // Transtype #13 — carrying value derecognised
      loanSaleGain,          // Transtype #13 — gain (+) or loss (−) on sale
      participation,         // Transtype #14 — participation proceeds (cash in)
      participationCV,       // Transtype #14 — partial carrying derecognised
      participationGain,     // Transtype #14 — gain/(loss) on partial sale
      debtEquitySwap,        // Transtype #15 — fair value of equity received
      debtEquitySwapCV,      // Transtype #15 — carrying derecognised
      debtEquitySwapLoss,    // Transtype #15 — restructuring loss (CV − FV)
      couponRate,
      floatingRate,
      currentRate: couponRate,
      dailyCash,
      cumInterestAccrued: cumCashAccrued,
      cumInterestEarned,
      capitalized,
      interestAdjustments: 0,
      cashInterestPayment: 0,
      pikRate: pikEnabled ? pikRateNominal : 0,
      dailyPik,
      cumPikAccrued,
      cumPikEarned,
      pikInterestAdjustments: 0,
      pikPaydown: 0,
      amortDaily: dailyAmort,
      cumAmort,
      nonUseFee: dailyNonUse,
      cumNonUseFee,
      // IFRS-aware fee fields
      dailyFees,
      feeBreakdown: dailyFeeBreakdown,
      dailyEIRAccretion,
      cumEIRAccretion: (rows.length ? rows[rows.length-1].cumEIRAccretion : 0) + dailyEIRAccretion,
      // Default interest / default fee
      dailyDefaultInterest,
      dailyDefaultFee,
      cumDefaultInterest: (rows.length ? rows[rows.length-1].cumDefaultInterest : 0) + dailyDefaultInterest,
      cumDefaultFee:      (rows.length ? rows[rows.length-1].cumDefaultFee : 0) + dailyDefaultFee,
      // ECL provisioning (IFRS 9 §5.5)
      dailyECLChange,
      eclAllowance,
      cumECLChange,
      // Modification accounting (IFRS 9 §5.4.3)
      dailyModGain,
      modEventDescription,
      cumModGain: (rows.length ? rows[rows.length-1].cumModGain : 0) + dailyModGain,
      // FX revaluation
      fxRate: todayFX,
      dailyFXGain,
      cumFXGain,
      balanceFC: balance * todayFX,                       // balance in functional currency
      // Hedge accounting (IFRS 9 §6)
      dailyHedgeOCI, dailyHedgePL, dailyHedgeReclass,
      cashFlowHedgeReserve, cumHedgeOCI, cumHedgePL, cumHedgeReclass,
      hedgeEffectiveness,
      // Phase A covenants — daily diagnostics for JE memos + Dashboard
      covenantMarginStepBps: covenantBreachStepUpBps,
      covenantSICRActive,
      hasEvent: evs.length > 0 || capitalized > 0 || dailyDefaultFee > 0
    });
  }
  // Stash the engine's applied yield so computeEIR can align its effectiveYield
  // with the value the scheduler actually used.
  rows.effectiveYield = effectiveYield;
  rows.feeBreakdown   = feeAccum;          // per-fee cumulative accrual
  rows.deferredEIRPool = deferredEIRPool;  // total IFRS-9 deferred income at t0
  // Phase A covenants — surface enriched covenant array for Dashboard / JE
  // generator to render breach banners + framework-aware memos.
  rows.covenants = enrichedCovenants;
  return rows;
}

/* ---------- Window summariser ---------- */
function summarize(rows, beginISO, endISO){
  const win = rows.filter(r => r.date >= beginISO && r.date <= endISO);
  const sum = (arr, k) => arr.reduce((a,r)=> a + (r[k]||0), 0);
  // Build a per-fee breakdown for the window by walking each day's
  // feeBreakdown map and aggregating by label.
  const feeBreakdown = {};
  for(const r of win){
    if(r.feeBreakdown){
      for(const [k,v] of Object.entries(r.feeBreakdown)){
        feeBreakdown[k] = (feeBreakdown[k] || 0) + (v || 0);
      }
    }
  }
  return {
    rows: win,
    totalCashAccrual: sum(win,'dailyCash'),
    totalPikAccrual:  sum(win,'dailyPik'),
    totalCapitalized: sum(win,'capitalized'),
    totalAmort:       sum(win,'amortDaily'),
    totalNonUseFee:   sum(win,'nonUseFee'),
    totalFees:        sum(win,'dailyFees'),
    totalEIRAccretion: sum(win,'dailyEIRAccretion'),
    totalDefaultInterest: sum(win,'dailyDefaultInterest'),
    totalDefaultFee:      sum(win,'dailyDefaultFee'),
    totalDraws:           sum(win,'draw'),
    totalRepayments:      sum(win,'paydown'),
    totalPrepayments:     sum(win,'prepayment'),
    totalMandatoryPrepayments: sum(win,'mandatoryPrepayment'),  // Transtype #16 — covenant-triggered subset
    totalPrepayPenalty:   sum(win,'prepayPenalty'),
    totalWriteOff:        sum(win,'writeOff'),
    totalWriteOffAllowanceUsed:   sum(win,'writeOffAllowanceUsed'),
    totalWriteOffResidualExpense: sum(win,'writeOffResidualExpense'),
    totalRecovery:        sum(win,'recovery'),
    totalCureRelease:     sum(win,'cureRelease'),
    totalAllowanceReversal: sum(win,'allowanceReversal'),  // Transtype #23 — model-driven
    totalForbearanceDeferred: sum(win,'forbearanceStartDeferred'),
    totalCapitalisedCost: sum(win,'capitalisedCost'),
    totalLoanSale:        sum(win,'loanSale'),       // Transtype #13 — sale proceeds
    totalLoanSaleCV:      sum(win,'loanSaleCV'),     // Transtype #13 — carrying derecognised
    totalLoanSaleGain:    sum(win,'loanSaleGain'),   // Transtype #13 — gain/(loss) on sale
    totalParticipation:       sum(win,'participation'),    // Transtype #14 — participation proceeds
    totalParticipationCV:     sum(win,'participationCV'),  // Transtype #14 — partial carrying derecog
    totalParticipationGain:   sum(win,'participationGain'),// Transtype #14 — partial gain/(loss)
    totalDebtEquitySwap:      sum(win,'debtEquitySwap'),   // Transtype #15 — FV of equity recognised
    totalDebtEquitySwapCV:    sum(win,'debtEquitySwapCV'), // Transtype #15 — loan carrying derecog
    totalDebtEquitySwapLoss:  sum(win,'debtEquitySwapLoss'),// Transtype #15 — restructuring loss
    totalECLChange:       sum(win,'dailyECLChange'),
    closingECLAllowance:  win[win.length-1]?.eclAllowance ?? 0,
    totalFXGain:          sum(win,'dailyFXGain'),
    closingBalanceFC:     win[win.length-1]?.balanceFC ?? 0,
    totalModGain:         sum(win,'dailyModGain'),
    modEvents:            win.filter(r => r.modEventDescription).map(r => ({date: r.date, description: r.modEventDescription, gainLoss: r.dailyModGain})),
    totalHedgeOCI:        sum(win,'dailyHedgeOCI'),
    totalHedgePL:         sum(win,'dailyHedgePL'),
    totalHedgeReclass:    sum(win,'dailyHedgeReclass'),
    closingHedgeReserve:  win[win.length-1]?.cashFlowHedgeReserve ?? 0,
    feeBreakdown,                  // { 'Arrangement Fee': 12345.67, ... }
    daysCount:        win.length,
    openingBalance:   win[0]?.balance ?? 0,
    closingBalance:   win[win.length-1]?.balance ?? 0,
    closingCarrying:  win[win.length-1]?.carryingValue ?? 0,
    periodStart:      win[0]?.date,
    periodEnd:        win[win.length-1]?.date,
    // Phase A covenants — period-level breach signals for JE memo tagging.
    // covenantSICRTriggered = any day in window had a covenant-driven SICR
    // (forces Stage 2 ECL even if user set Stage 1). covenantMarginStepUpBpsMax
    // is the highest step-up active across the window — used for memo only.
    covenantSICRTriggered: win.some(r => r.covenantSICRActive),
    covenantMarginStepUpBpsMax: Math.max(0, ...win.map(r => r.covenantMarginStepBps || 0))
  };
}

/* ---------- Cash flow forecast & maturity ladder ----------
   Project daily flows from `asOfDate` forward into bucketed maturity ladders.
   Standard IFRS 7 liquidity disclosure buckets:
     ≤30d, 31-90d, 91-180d, 181d-1yr, 1-5yr, >5yr.
   Each bucket sums the principal repayments, interest, fees, and EIR
   accretion expected to settle in that window.
*/
function buildCashFlowForecast(rows, asOfISO){
  if(!rows || !rows.length) return null;
  const asOfDate = parseISO(asOfISO);
  if(!asOfDate) return null;
  const D = ms => Math.floor(ms / ONE_DAY);
  const cutoffs = [
    { label:'≤30d',     maxDays: 30  },
    { label:'31-90d',   maxDays: 90  },
    { label:'91-180d',  maxDays: 180 },
    { label:'181d-1yr', maxDays: 365 },
    { label:'1-5yr',    maxDays: 365 * 5 },
    { label:'>5yr',     maxDays: Infinity }
  ];
  // Initialise buckets
  const buckets = cutoffs.map((c, ix) => ({
    label: c.label,
    fromDays: ix === 0 ? 0 : cutoffs[ix-1].maxDays + 1,
    toDays:   c.maxDays,
    principal: 0, interest: 0, fees: 0, eir: 0, defaultInt: 0, total: 0,
    rowsCount: 0
  }));
  let totalPrincipal=0, totalInterest=0, totalFees=0, totalEIR=0, totalDefault=0;
  for(const r of rows){
    const rd = parseISO(r.date);
    if(rd < asOfDate) continue;
    const days = D(rd - asOfDate);
    const b = buckets.find(b => days >= b.fromDays && days <= b.toDays);
    if(!b) continue;
    const principal = (r.paydown || 0);
    const interest  = (r.dailyCash || 0);
    const fees      = (r.dailyFees || 0);
    const eir       = (r.dailyEIRAccretion || 0);
    const defaultInt= (r.dailyDefaultInterest || 0);
    b.principal += principal; b.interest += interest; b.fees += fees;
    b.eir += eir; b.defaultInt += defaultInt;
    b.total += principal + interest + fees + eir + defaultInt;
    b.rowsCount++;
    totalPrincipal += principal; totalInterest += interest; totalFees += fees;
    totalEIR += eir; totalDefault += defaultInt;
  }
  return {
    asOf: asOfISO,
    buckets,
    totals: {
      principal: totalPrincipal, interest: totalInterest, fees: totalFees,
      eirAccretion: totalEIR, defaultInterest: totalDefault,
      grandTotal: totalPrincipal + totalInterest + totalFees + totalEIR + totalDefault
    }
  };
}

/* ---------- Inline reference sample (SP023 / Libra 2) -----------------
   Embedded so the "Load sample" button works without a fetch — useful when
   the calculator is opened from file:// where same-directory JSON fetches
   may be blocked by the browser.
*/
const RECON_SAMPLE_LIBRA2 = {
  source: 'Reference Software X · SP023 Libra 2',
  exportedAt: '2026-04-30T16:00:00Z',
  matchKey: 'date',
  tolerances: { balance: 1.00, interest: 0.10, fees: 0.10, totalCash: 0.10, breakThresholdPct: 0.5 },
  instrument: { id: 'libra2', legalEntity: 'NWF Sustainable Infrastructure', deal: 'Libra 2',
                position: 'NWF 100% Bilateral Position · Libra 2',
                incomeSecurity: 'HSBC Facility B4 — Libra 2 (Compounded SONIA + Ratcheted Margin)' },
  scheduleResults: [
    { date:'2024-10-13', openingBalance:0, closingBalance:0, interestAccrued:0, totalFees: 437500.00, drawdown:0, repayment:0, utilisation:0, totalFacility:25000000, undrawnAmount:0,        comment:'Arrangement fee 1.75% × £25M paid 13/10/2024' },
    { date:'2025-01-10', openingBalance:0, closingBalance:0, interestAccrued:0, totalFees:  88219.18, drawdown:0, repayment:0, utilisation:0, totalFacility:25000000, undrawnAmount:25000000, comment:'Q1 commitment fee · 25M × 35% × 4.0% × 92/365' },
    { date:'2025-04-10', openingBalance:0, closingBalance:0, interestAccrued:0, totalFees:  87679.79, drawdown:0, repayment:0, utilisation:0, totalFacility:25000000, undrawnAmount:25000000, comment:'Q2 — margin 4.00% → 4.25% mid-period' },
    { date:'2025-07-10', openingBalance:0, closingBalance:0, interestAccrued:0, totalFees:  92420.38, drawdown:0, repayment:0, utilisation:0, totalFacility:25000000, undrawnAmount:25000000, comment:'Q3 — margin 4.50%, ESG -25 bps from 22/5' },
    { date:'2025-10-10', openingBalance:0, closingBalance:0, interestAccrued:0, totalFees:  93181.51, drawdown:0, repayment:0, utilisation:0, totalFacility:25000000, undrawnAmount:25000000, comment:'Q4 — full quarter at 4.475% effective' },
    { date:'2026-01-12', openingBalance:0, closingBalance:0, interestAccrued:0, totalFees:  95207.19, drawdown:0, repayment:0, utilisation:0, totalFacility:25000000, undrawnAmount:25000000, comment:'Q5 — date adjusted forward (modified following)' },
    { date:'2026-04-01', openingBalance:0, closingBalance:25000000, interestAccrued:0, totalFees:0, drawdown:25000000, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0, comment:'£25M drawdown · single tranche per reference modelling' },
    { date:'2026-04-10', openingBalance:25000000, closingBalance:25000000, interestAccrued:0, totalFees:80937.50, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0, comment:'Stub commitment fee 12/01 → 31/03' },
    { date:'2026-07-01', openingBalance:25000000, closingBalance:25000000, interestAccrued:499006.92, totalFees:0, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0, comment:'First quarterly interest post-drawdown' },
    { date:'2026-10-01', openingBalance:25000000, closingBalance:25000000, interestAccrued:497482.15, totalFees:0, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0 },
    { date:'2027-01-04', openingBalance:25000000, closingBalance:25000000, interestAccrued:511904.02, totalFees:0, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0 },
    { date:'2027-04-01', openingBalance:25000000, closingBalance:25000000, interestAccrued:469317.48, totalFees:0, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0 },
    { date:'2027-07-01', openingBalance:25000000, closingBalance:25000000, interestAccrued:507740.36, totalFees:0, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0 },
    { date:'2027-10-01', openingBalance:25000000, closingBalance:25000000, interestAccrued:515037.06, totalFees:0, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0 }
  ]
};

/* ---------- Reconciliation engine -------------------------------------
   Compare our calculator's daily schedule against PortF reference data's
   period-by-period results (interest, fees, balance, etc.) and surface
   per-row diffs with status (tied / within tolerance / break) plus
   summary KPIs. Tolerances and break thresholds are configurable in the
   reference JSON; sensible defaults below.
*/
const RECON_DEFAULT_TOLERANCES = {
  balance: 1.00,
  interest: 0.10,
  fees: 0.10,
  totalCash: 0.10,
  breakThresholdPct: 0.5
};

function reconcileAgainstReference(rows, referenceData){
  if(!rows || !rows.length || !referenceData || !Array.isArray(referenceData.scheduleResults)) return null;
  const tol = Object.assign({}, RECON_DEFAULT_TOLERANCES, referenceData.tolerances || {});
  // Fast lookup: map calculator rows by date (ISO)
  const ourByDate = new Map();
  for(const r of rows) ourByDate.set(r.date, r);
  // For each reference period, find the matching day in our schedule.
  // The reference rows are typically end-of-period; we sum our daily flows
  // since the previous reference date for a period-to-period comparison.
  const sortedRef = referenceData.scheduleResults.slice()
    .sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  let prevDate = null;
  const compared = [];
  for(const ref of sortedRef){
    const ourRow = ourByDate.get(ref.date);
    // Sum our daily flows from prevDate (exclusive) to ref.date (inclusive)
    // for period-style comparisons (interest, fees, drawdown, repayment).
    let ourInterest = 0, ourFees = 0, ourDraw = 0, ourPaydown = 0;
    if(prevDate){
      for(const r of rows){
        if(r.date > prevDate && r.date <= ref.date){
          ourInterest += r.dailyCash || 0;
          ourFees     += r.dailyFees || 0;
          ourDraw     += r.draw || 0;
          ourPaydown  += r.paydown || 0;
        }
      }
    } else {
      // First reference row — sum from start through ref.date
      for(const r of rows){
        if(r.date <= ref.date){
          ourInterest += r.dailyCash || 0;
          ourFees     += r.dailyFees || 0;
          ourDraw     += r.draw || 0;
          ourPaydown  += r.paydown || 0;
        }
      }
    }
    const ourBalance = ourRow ? ourRow.balance : null;
    const lines = [];
    const checkLine = (metric, refVal, ourVal, tolerance) => {
      if(refVal == null && ourVal == null) return;
      if(refVal == null) refVal = 0;
      if(ourVal == null) ourVal = 0;
      const diff = ourVal - refVal;
      const absDiff = Math.abs(diff);
      const denom = Math.abs(refVal) || Math.abs(ourVal) || 1;
      const pct = denom > 0 ? Math.abs(diff)/denom : 0;
      let status;
      if(absDiff <= tolerance)                                  status = 'tied';
      else if(pct * 100 <= tol.breakThresholdPct)               status = 'within';
      else                                                       status = 'break';
      lines.push({ metric, ref: refVal, ours: ourVal, diff, pct, status, tolerance });
    };
    checkLine('Closing Balance', ref.closingBalance,   ourBalance, tol.balance);
    checkLine('Interest Accrued', ref.interestAccrued,  ourInterest, tol.interest);
    checkLine('Total Fees',       ref.totalFees,        ourFees, tol.fees);
    checkLine('Drawdown',         ref.drawdown,         ourDraw, tol.balance);
    checkLine('Repayment',        ref.repayment,        ourPaydown, tol.balance);
    if(ref.feeBreakdown){
      for(const [k,v] of Object.entries(ref.feeBreakdown)){
        const ours = (ourRow && ourRow.feeBreakdown && ourRow.feeBreakdown[k]) || 0;
        checkLine('Fee · ' + k, v, ours, tol.fees);
      }
    }
    compared.push({
      date: ref.date,
      hasOurRow: !!ourRow,
      lines,
      worstStatus: lines.reduce((acc, l) =>
        l.status === 'break' ? 'break'
        : (l.status === 'within' && acc !== 'break') ? 'within'
        : acc, 'tied'),
      comment: ref.comment || null
    });
    prevDate = ref.date;
  }
  // Summary stats
  const flat = compared.flatMap(p => p.lines);
  const tied   = flat.filter(l => l.status === 'tied').length;
  const within = flat.filter(l => l.status === 'within').length;
  const breaks = flat.filter(l => l.status === 'break').length;
  const totalDiff = flat.reduce((a,l)=> a + l.diff, 0);
  const totalAbsDiff = flat.reduce((a,l)=> a + Math.abs(l.diff), 0);
  return {
    source: referenceData.source || '—',
    exportedAt: referenceData.exportedAt || null,
    tolerances: tol,
    periods: compared,
    summary: {
      periodsCompared: compared.length,
      linesTotal: flat.length,
      linesTied: tied,
      linesWithinTol: within,
      linesBreak: breaks,
      tieRatePct: flat.length ? (tied / flat.length * 100) : 100,
      totalSignedDiff: totalDiff,
      totalAbsDiff
    }
  };
}

/* ---------- Reference data persistence (per-instrument) ---------- */
const LS_KEY_RECON_REF = 'pe-loan-calc.reconciliation-references.v1';
function loadAllReferenceData(){
  try {
    const raw = localStorage.getItem(LS_KEY_RECON_REF);
    if(!raw) return {};
    return JSON.parse(raw) || {};
  } catch(e){ return {}; }
}
function saveAllReferenceData(map){
  try { localStorage.setItem(LS_KEY_RECON_REF, JSON.stringify(map || {})); }
  catch(e){ console.warn('Could not persist reference data:', e); }
}
function getReferenceForInstrument(id){ return loadAllReferenceData()[id] || null; }
function setReferenceForInstrument(id, refData){
  const all = loadAllReferenceData();
  all[id] = refData;
  saveAllReferenceData(all);
}
function clearReferenceForInstrument(id){
  const all = loadAllReferenceData();
  delete all[id];
  saveAllReferenceData(all);
}

/* ---------- DIU generator (N-6 / N-9) ---------- */
/* ---------- Investran GL chart mapping --------------------------------
   Maps the calculator's transaction types to the Investran GL accounts
   from "GL Accounts and tran types.xlsx". Each entry carries:
     account     — Investran 6-digit GL account code
     accountName — Investran display name
     transType   — Investran transaction type (when one cleanly matches)
     gap         — true when no clean match exists (operator must create)
     gapNote     — explanation shown in the GL Coverage panel
*/
const INVESTRAN_GL = {
  // ─── Cash ─────────────────────────────────────────────────────
  cashReceipt:     { account:'111000', accountName:'Cash', transType:'Cash received' },
  cashDisbursed:   { account:'111000', accountName:'Cash', transType:'Cash disbursed' },
  // ─── Loan asset (drawdown / repayment / capitalisation) ───────
  loanDrawdownInitial:    { account:'141000', accountName:'Investments at Cost', transType:'Purchase of investment - Notes - initial drawdown' },
  loanDrawdownAdditional: { account:'141000', accountName:'Investments at Cost', transType:'Purchase of investment - Notes - additional drawdown' },
  loanReturnOfCapital:    { account:'141000', accountName:'Investments at Cost', transType:'Sale of investment - Notes - Return of capital' },
  loanPikCapitalisation:  { account:'141000', accountName:'Investments at Cost', transType:'Purchase of investment - Notes - principal from capitalization' },
  loanOID:                { account:'141000', accountName:'Investments at Cost', transType:'Investment accretion - Original issue discount' },
  loanPIKAccretion:       { account:'141000', accountName:'Investments at Cost', transType:'Investment accretion - PIK interest' },
  // ─── Receivables ──────────────────────────────────────────────
  interestReceivable:  { account:'113000', accountName:'Accounts Receivable', transType:'Interest receivable' },
  interestReceived:    { account:'113000', accountName:'Accounts Receivable', transType:'Interest received' },
  pikReceivable:       { account:'113000', accountName:'Accounts Receivable', transType:'Portfolio PIK interest receivable' },
  // Per-fee-type IFRS 15 fee receivables (NewReport(4) — gap closed). Each fee
  // type now has dedicated DR-side and CR-side (cash settlement) transtypes.
  feeReceivableArrangement:  { account:'113000', accountName:'Accounts Receivable', transType:'Fee receivable – Arrangement' },
  feeReceivedArrangement:    { account:'113000', accountName:'Accounts Receivable', transType:'Fee received – Arrangement' },
  feeReceivableCommitment:   { account:'113000', accountName:'Accounts Receivable', transType:'Fee receivable – Commitment' },
  feeReceivedCommitment:     { account:'113000', accountName:'Accounts Receivable', transType:'Fee received – Commitment' },
  feeReceivableGuarantee:    { account:'113000', accountName:'Accounts Receivable', transType:'Fee receivable – Guarantee' },
  feeReceivedGuarantee:      { account:'113000', accountName:'Accounts Receivable', transType:'Fee received – Guarantee' },
  feeReceivableManagement:   { account:'113000', accountName:'Accounts Receivable', transType:'Fee receivable – Management' },
  feeReceivedManagement:     { account:'113000', accountName:'Accounts Receivable', transType:'Fee received – Management' },
  feeReceivableDividend:     { account:'113000', accountName:'Accounts Receivable', transType:'Fee receivable – Dividend (Equity)' },
  feeReceivedDividend:       { account:'113000', accountName:'Accounts Receivable', transType:'Fee received – Dividend (Equity)' },
  // Generic fallback when the fee label doesn't fit any of the IFRS 15 buckets above.
  feeReceivable:       { account:'113000', accountName:'Accounts Receivable', transType:'Other receivable' },
  // Default interest / non-use fee receivable — no dedicated transtype on Investran chart.
  // These still use 'Other receivable' and are the only Priority-3 gap remaining.
  defaultIntReceivable:{ account:'113000', accountName:'Accounts Receivable', transType:'Other receivable',
                         gap:true, gapNote:'Default interest receivable — no specific transtype. The income side ("Default interest income (penalty rate)" under 421000) is mapped, but the DR-side receivable still falls back to "Other receivable". Optional: add "Default interest receivable" / "Default interest received" transtypes under 113000.' },
  defaultFeeReceivable:{ account:'113000', accountName:'Accounts Receivable', transType:'Other receivable',
                         gap:true, gapNote:'Default fee receivable — no specific transtype. The income side ("Default fee income" under 492000) is mapped, but the DR-side receivable still falls back to "Other receivable". Optional: add "Default fee receivable" / "Default fee received" transtypes under 113000.' },
  nonUseFeeReceivable: { account:'113000', accountName:'Accounts Receivable', transType:'Other receivable',
                         gap:true, gapNote:'Non-use fee receivable — no specific transtype. The income side ("Non-use fee income (lender)" under 492000) is mapped, but the DR-side receivable still falls back to "Other receivable". Optional: add "Non-use fee receivable" transtype under 113000.' },
  whtReceivable:       { account:'113000', accountName:'Accounts Receivable', transType:'Withholding tax receivable' },
  // ─── Income — interest ────────────────────────────────────────
  interestIncomeAccrued: { account:'421000', accountName:'Investment Interest Income', transType:'Income - Investment interest - Accrued' },
  interestIncomeCash:    { account:'421000', accountName:'Investment Interest Income', transType:'Income - Investment interest - Cash' },
  interestIncomePIK:     { account:'421000', accountName:'Investment Interest Income', transType:'Income - Investment interest - PIK/Accreted' },
  // ─── Income — IFRS 15 fees (dedicated accounts) ───────────────
  feeIncome:                { account:'492000', accountName:'Other Income - Amendments', transType:'Income - Other - Amendment fees' },  // generic fallback
  arrangementFeeIncome:     { account:'492100', accountName:'Arrangement Fee Income',         transType:'Arrangement fee income – IFRS 15' },
  commitmentFeeIncome:      { account:'492200', accountName:'Commitment Fee Income',          transType:'Commitment fee income – IFRS 15' },
  guaranteeFeeIncome:       { account:'492300', accountName:'Guarantee Fee Income',           transType:'Guarantee fee income – IFRS 15' },
  managementFeeIncomeInv:   { account:'492400', accountName:'Management Fee Income',          transType:'Management fee income – investment period' },
  managementFeeIncomePost:  { account:'492400', accountName:'Management Fee Income',          transType:'Management fee income – post-investment' },
  dividendIncome:           { account:'492500', accountName:'Dividend Income (Equity – IFRS 15)', transType:'Dividend income – IFRS 15' },
  // ─── Default interest / default fees / non-use fee (NewReport(4) — gaps closed)
  defaultIntIncome:      { account:'421000', accountName:'Investment Interest Income', transType:'Default interest income (penalty rate)' },
  defaultFeeIncome:      { account:'492000', accountName:'Other Income - Amendments',  transType:'Default fee income' },
  nonUseFeeIncome:       { account:'492000', accountName:'Other Income - Amendments',  transType:'Non-use fee income (lender)' },
  // ─── Gains / losses ───────────────────────────────────────────
  fxUnrealised:        { account:'450000', accountName:'Unrealized Gain/Loss', transType:'Unrealized gain/(loss) - F/X gain/(loss)' },
  fxRealised:          { account:'440000', accountName:'Realized Gain/Loss',   transType:'Realized gain/(loss) - Short term - F/X' },
  modificationGain:    { account:'442000', accountName:'Modification Gain / Loss (IFRS 9 §5.4.3)', transType:'Modification gain – IFRS 9' },
  modificationLoss:    { account:'442000', accountName:'Modification Gain / Loss (IFRS 9 §5.4.3)', transType:'Modification loss – IFRS 9' },
  // Loan sale / disposal (IFRS 9 §3.2.3 / ASC 860 — Transtype #13)
  loanSaleDerecognition:{ account:'141000', accountName:'Investments at Cost', transType:'Sale of investment - Notes - Loan disposal (derecognition)' },
  loanSaleGain:         { account:'442000', accountName:'Realized Gain on Loan Sale (IFRS 9 §3.2.3 / ASC 860)', transType:'Gain on sale of loan – IFRS 9 §3.2.3' },
  loanSaleLoss:         { account:'442000', accountName:'Realized Loss on Loan Sale (IFRS 9 §3.2.3 / ASC 860)', transType:'Loss on sale of loan – IFRS 9 §3.2.3' },
  // Loan participation / partial sell-down (IFRS 9 §3.2.6 — Transtype #14)
  participationDerecog: { account:'141000', accountName:'Investments at Cost', transType:'Sale of investment - Notes - Loan participation (partial derecog)' },
  participationGain:    { account:'442000', accountName:'Realized Gain on Loan Participation (IFRS 9 §3.2.6)', transType:'Gain on loan participation – IFRS 9 §3.2.6' },
  participationLoss:    { account:'442000', accountName:'Realized Loss on Loan Participation (IFRS 9 §3.2.6)', transType:'Loss on loan participation – IFRS 9 §3.2.6' },
  // Debt-for-Equity Swap (IFRIC 19 / ASC 470-50-40 — Transtype #15)
  d4eEquity:          { account:'142000', accountName:'Equity Investments at Cost', transType:'Equity received in debt-for-equity swap (IFRIC 19)' },
  d4eLoanDerecog:     { account:'141000', accountName:'Investments at Cost',         transType:'Sale of investment - Notes - Loan extinguished via D4E swap' },
  d4eRestructLoss:    { account:'542100', accountName:'Restructuring Loss — Debt-for-Equity (IFRIC 19)', transType:'Restructuring loss — debt-for-equity swap' },
  d4eRestructGain:    { account:'442100', accountName:'Restructuring Gain — Debt-for-Equity (IFRIC 19)', transType:'Restructuring gain — debt-for-equity swap' },
  // Mandatory prepayment (covenant-triggered — Transtype #16)
  mandatoryPrepayment:{ account:'141000', accountName:'Investments at Cost', transType:'Sale of investment - Notes - Mandatory prepayment (covenant trigger)' },
  // Trade-date accounting (IFRS 9 §B3.1.5 — Transtype #18)
  tradeDateAsset:     { account:'141000', accountName:'Investments at Cost', transType:'Trade-date recognition — Loan asset (IFRS 9 §B3.1.5)' },
  unsettledTradePay:  { account:'232000', accountName:'Unsettled Trade Payable', transType:'Unsettled trade payable — trade-date booking' },
  unsettledTradeRev:  { account:'232000', accountName:'Unsettled Trade Payable', transType:'Unsettled trade payable — settlement-date reversal' },
  tradeDateAssetRev:  { account:'141000', accountName:'Investments at Cost', transType:'Trade-date recognition reversal — Loan asset' },
  // ─── IFRS 9 ECL ───────────────────────────────────────────────
  impairmentExpense:   { account:'470000', accountName:'Impairment / ECL Expense (IFRS 9 §5.5)', transType:'Impairment expense – IFRS 9 ECL' },
  loanLossAllowance:   { account:'145000', accountName:'Loan Loss Allowance – IFRS 9 ECL',       transType:'Loan loss allowance – IFRS 9 ECL' },
  // ─── Hedge accounting (IFRS 9 §6) ─────────────────────────────
  hedgingInstrument:        { account:'146000', accountName:'Derivative Assets / Liabilities', transType:'Hedging instrument MTM' },
  hedgingInstrumentCFHEff:  { account:'146000', accountName:'Derivative Assets / Liabilities', transType:'Hedging instrument MTM – CFH effective' },
  hedgingInstrumentCFHIneff:{ account:'146000', accountName:'Derivative Assets / Liabilities', transType:'Hedging instrument MTM – CFH ineffective' },
  hedgingInstrumentFVH:     { account:'146000', accountName:'Derivative Assets / Liabilities', transType:'Hedging instrument MTM – FV hedge' },
  cfhReserve:               { account:'360000', accountName:'Cash Flow Hedge Reserve (OCI)',   transType:'Cash flow hedge reserve – OCI' },
  cfhReserveReclass:        { account:'360000', accountName:'Cash Flow Hedge Reserve (OCI)',   transType:'Cash flow hedge reserve – reclassification' },
  hedgeIneffectiveness:     { account:'451000', accountName:'Hedge Ineffectiveness P&L',       transType:'Hedge ineffectiveness P&L' },
  fvHedgePL:                { account:'452000', accountName:'Fair Value Hedge P&L',            transType:'Fair value hedge P&L' },
  hedgeReclass:             { account:'421000', accountName:'Investment Interest Income',     transType:'Income - Investment interest' },  // legacy generic CFH reclass routing
  // Transtype #21 — Dedicated CFH reclass transtype. Keeps the account on 421000
  // so it still flows to interest income, but tags the JE with a distinct
  // transactionType ("CFH reserve recycling to P&L — IFRS 9 §6.5.11"). This
  // lets reports split "income from hedge reserve recycling" from "raw coupon
  // income" — critical for hedge accounting disclosures (IFRS 7 §24A-B).
  cfhReclassPL:             { account:'421000', accountName:'Investment Interest Income — CFH Recycling', transType:'CFH reserve recycling to P&L (IFRS 9 §6.5.11)' },
  // De-designation amortisation surfaced separately so post-de-designation
  // OCI recycling is distinguishable from settlement-driven recycling.
  cfhReclassDeDed:          { account:'421000', accountName:'Investment Interest Income — CFH Recycling (De-Designated)', transType:'CFH reserve amortisation — post de-designation (IFRS 9 §6.5.6)' },
  // Transtype #22 — FX Hedge of Loan Principal (IFRS 9 §6.5.16(c) / §B6.5.34)
  // FX forwards designated as a hedge of the foreign-currency loan principal.
  // Spot-FX effective portion → FX Hedge Reserve (OCI).
  // Currency basis spread → Cost of Hedging Reserve (separate OCI bucket).
  fxHedgeReserveOCI:        { account:'370000', accountName:'FX Hedge Reserve (OCI · IFRS 9 §6.5.16)', transType:'FX hedge reserve – OCI (spot component)' },
  costOfHedgingReserve:     { account:'375000', accountName:'Cost of Hedging Reserve (OCI · IFRS 9 §6.5.16(c))', transType:'Cost of hedging – currency basis (OCI)' },
  fxHedgeInstrument:        { account:'146100', accountName:'FX Forward Asset / Liability', transType:'FX hedging instrument MTM' }
};

// Map our internal placeholder-account-codes / transaction-type strings onto
// the Investran chart. Called once on each batch of JE entries after the
// generators run so we don't have to thread the mapping through every add().
function applyInvestranGLMapping(entries){
  // Transaction-type keyword → Investran GL key. Order matters: more specific
  // keywords must be checked before more general ones.
  const lookup = (tt, ourAcct) => {
    const t = (tt || '').toLowerCase();
    // Cash-leg lines (drawdown cash, repayment cash, fee/interest cash receipts)
    if(/cash receipt/.test(t) || /drawdown — cash/.test(t)) return INVESTRAN_GL.cashReceipt;
    if(/repayment — cash/.test(t))                          return INVESTRAN_GL.cashDisbursed;
    // Loan asset legs
    if(/^loan drawdown\b/.test(t) || /drawdown.*initial/.test(t))   return INVESTRAN_GL.loanDrawdownInitial;
    if(/^loan repayment\b/.test(t))                                return INVESTRAN_GL.loanReturnOfCapital;
    // Transtype #4 — Prepayment: same GL routing as repayment (loanReturnOfCapital
    // / cashReceipt) but distinct transtype so reports can filter on it.
    if(/^loan prepayment$/.test(t))                                return INVESTRAN_GL.loanReturnOfCapital;
    if(/^loan prepayment — cash$/.test(t))                         return INVESTRAN_GL.cashReceipt;
    // Transtype #16 — Mandatory Prepayment (covenant-triggered)
    if(/^mandatory prepayment$/.test(t))                           return INVESTRAN_GL.mandatoryPrepayment;
    if(/^mandatory prepayment — cash$/.test(t))                    return INVESTRAN_GL.cashReceipt;
    // Transtype #19 — Period-End Reversing Entries. The "Reversing — " prefix
    // is the entry's label; we delegate routing by stripping the prefix, re-
    // running the lookup recursively so the reverse pair lands in the same GL
    // account family as the original accrual, then re-attaching the prefix.
    if(/^reversing — /.test(t)){
      const innerTT = (tt || '').replace(/^reversing — /i, '');
      const innerMapped = lookup(innerTT, ourAcct);
      if(innerMapped){
        return { account: innerMapped.account, accountName: innerMapped.accountName,
                 transType: 'Reversing — ' + innerMapped.transType };
      }
    }
    // Transtype #18 — Trade vs Settlement Date Accounting
    if(/^trade-date recognition — loan asset$/.test(t))            return INVESTRAN_GL.tradeDateAsset;
    if(/^trade-date recognition — unsettled trade payable$/.test(t)) return INVESTRAN_GL.unsettledTradePay;
    if(/^settlement-date reversal — unsettled trade payable$/.test(t)) return INVESTRAN_GL.unsettledTradeRev;
    if(/^settlement-date reversal — loan asset/.test(t))           return INVESTRAN_GL.tradeDateAssetRev;
    // Transtype #5 — Prepayment penalty / make-whole income. Cash leg uses the
    // standard cash receipt; income leg maps to Other Investment Income (492000)
    // since 492700 isn't yet in the canonical Investran chart — flagged as a
    // candidate new sub-account in the GL gap inventory.
    if(/^prepayment penalty — cash$/.test(t))                      return INVESTRAN_GL.cashReceipt;
    if(/^prepayment penalty income$/.test(t))                      return INVESTRAN_GL.feeIncome;
    // Transtype #8 — Write-off. Allowance application → 145000 contra-asset;
    // residual expense → 470000 Impairment Expense; asset derecognition → 141000.
    if(/loan write-off — allowance applied/.test(t))               return INVESTRAN_GL.loanLossAllowance;
    if(/loan write-off — residual expense/.test(t))                return INVESTRAN_GL.impairmentExpense;
    if(/loan write-off — asset derecognition/.test(t))             return INVESTRAN_GL.loanReturnOfCapital;
    // Transtype #9 — Recovery post-write-off. Cash leg → standard cash receipt;
    // income leg credits 470000 Impairment (reverses prior write-off charge).
    if(/^recovery — cash receipt$/.test(t))                        return INVESTRAN_GL.cashReceipt;
    if(/^recovery of written-off loan$/.test(t))                   return INVESTRAN_GL.impairmentExpense;
    // Transtype #24 — Loan-Loss Recovery Allocation buckets
    if(/^recovery — cash receipt \(/.test(t))                      return INVESTRAN_GL.cashReceipt;
    if(/^recovery — principal/.test(t))                            return INVESTRAN_GL.impairmentExpense;
    if(/^recovery — default interest/.test(t))                     return INVESTRAN_GL.defaultIntIncome;
    if(/^recovery — default fee/.test(t))                          return INVESTRAN_GL.defaultFeeIncome;
    if(/^recovery — legal cost/.test(t))                           return INVESTRAN_GL.impairmentExpense;
    // Transtype #10 — Cure / Stage Reversal. Allowance side → 145000 (down),
    // income side → 470000 Impairment Expense (CR reverses prior expense).
    if(/^ecl cure — allowance reversal$/.test(t))                  return INVESTRAN_GL.loanLossAllowance;
    if(/^ecl cure — impairment reversal$/.test(t))                 return INVESTRAN_GL.impairmentExpense;
    // Transtype #23 — Model-driven allowance reversal (no stage change)
    if(/^allowance reversal — model recalibration$/.test(t))       return INVESTRAN_GL.loanLossAllowance;
    if(/^impairment reversal — model recalibration$/.test(t))      return INVESTRAN_GL.impairmentExpense;
    // Transtype #11 — Forbearance reclass. Both legs go to receivable area
    // (113000); operator can later route the deferred sub-balance to a
    // dedicated "Deferred Interest Receivable" sub-account.
    if(/^forbearance — deferred interest reclass$/.test(t))        return INVESTRAN_GL.interestReceivable;
    if(/^forbearance — interest receivable reduction$/.test(t))    return INVESTRAN_GL.interestReceivable;
    // Transtype #12 — Capitalised origination costs. DR carrying value (141000),
    // CR Cash (111000). Same income-statement effect as a negative upfront fee.
    if(/^capitalised origination costs$/.test(t))                  return INVESTRAN_GL.loanDrawdownInitial;
    if(/^capitalised origination costs — cash$/.test(t))           return INVESTRAN_GL.cashReceipt;
    // Transtype #25 — Revolver Origination Cost Deferral policy disclosure
    if(/^revolver cost deferral policy/.test(t))                   return INVESTRAN_GL.loanDrawdownInitial;
    // Transtype #13 — Loan Sale (full derecognition)
    if(/^loan sale — cash received/.test(t))                       return INVESTRAN_GL.cashReceipt;
    if(/^loan sale — asset derecognition$/.test(t))                return INVESTRAN_GL.loanSaleDerecognition;
    if(/^loan sale — residual asset derecog$/.test(t))             return INVESTRAN_GL.loanSaleDerecognition;
    if(/^loan sale — gain on disposal$/.test(t))                   return INVESTRAN_GL.loanSaleGain;
    if(/^loan sale — loss on disposal$/.test(t))                   return INVESTRAN_GL.loanSaleLoss;
    // Transtype #14 — Loan Participation (partial sell-down)
    if(/^loan participation — cash received/.test(t))              return INVESTRAN_GL.cashReceipt;
    if(/^loan participation — asset derecognition$/.test(t))       return INVESTRAN_GL.participationDerecog;
    if(/^loan participation — residual asset derecog$/.test(t))    return INVESTRAN_GL.participationDerecog;
    if(/^loan participation — gain on disposal$/.test(t))          return INVESTRAN_GL.participationGain;
    if(/^loan participation — loss on disposal$/.test(t))          return INVESTRAN_GL.participationLoss;
    // Transtype #15 — Debt-for-Equity Swap
    if(/^debt-for-equity swap — equity recognition/.test(t))       return INVESTRAN_GL.d4eEquity;
    if(/^debt-for-equity swap — loan derecognition/.test(t))       return INVESTRAN_GL.d4eLoanDerecog;
    if(/^debt-for-equity swap — restructuring loss$/.test(t))      return INVESTRAN_GL.d4eRestructLoss;
    if(/^debt-for-equity swap — restructuring gain$/.test(t))      return INVESTRAN_GL.d4eRestructGain;
    if(/pik (investment|capitalization)/.test(t))                  return INVESTRAN_GL.loanPikCapitalisation;
    // Per IFRS 9 §B5.4 / ASC 310-20-35-26: discount accretion = income side; the
    // offset (asset side) goes to 141000 carrying value. So the "Offset" leg routes
    // to loanOID (141000), and the income leg routes to interestIncomeAccrued (421000).
    if(/discount accretion offset|premium amort.*offset/.test(t))  return INVESTRAN_GL.loanOID;
    if(/discount accretion|premium amort/.test(t))                 return INVESTRAN_GL.interestIncomeAccrued;
    if(/eir fee accretion/.test(t) && /offset/.test(t))            return INVESTRAN_GL.loanOID;
    if(/eir fee accretion/.test(t))                                return INVESTRAN_GL.interestIncomeAccrued;
    // Default interest / default fee — clear-leg checked BEFORE the bare receivable
    // pattern (the "clear" suffix is more specific and must match first).
    if(/default interest receivable clear/.test(t))                return INVESTRAN_GL.interestReceived;
    if(/default interest receivable/.test(t))                      return INVESTRAN_GL.defaultIntReceivable;
    if(/default interest income/.test(t))                          return INVESTRAN_GL.defaultIntIncome;
    if(/default interest cash receipt/.test(t))                    return INVESTRAN_GL.cashReceipt;
    if(/default fee receivable clear/.test(t))                     return INVESTRAN_GL.defaultFeeReceivable;
    if(/default fee receivable/.test(t))                           return INVESTRAN_GL.defaultFeeReceivable;
    if(/default fee income/.test(t))                               return INVESTRAN_GL.defaultFeeIncome;
    // Non-use fee
    if(/non-use fee receivable clear/.test(t))                     return INVESTRAN_GL.nonUseFeeReceivable;
    if(/non-use fee receivable/.test(t))                           return INVESTRAN_GL.nonUseFeeReceivable;
    if(/non-use fee income/.test(t))                               return INVESTRAN_GL.nonUseFeeIncome;
    // FX revaluation
    if(/fx (revaluation )?(gain|loss)/.test(t))                    return INVESTRAN_GL.fxUnrealised;
    if(/fx revaluation .*loan asset/.test(t))                      return INVESTRAN_GL.loanReturnOfCapital;
    // Modification gain/loss
    if(/modification (gain|loss)/.test(t) && !/offset|adjust/.test(t)) {
      return /gain/.test(t) ? INVESTRAN_GL.modificationGain : INVESTRAN_GL.modificationLoss;
    }
    if(/modification.*loan asset/.test(t))                         return INVESTRAN_GL.loanReturnOfCapital;
    // ECL / Impairment
    if(/impairment expense|impairment reversal/.test(t))           return INVESTRAN_GL.impairmentExpense;
    if(/loan loss allowance/.test(t))                              return INVESTRAN_GL.loanLossAllowance;
    // Hedge accounting — CFH OCI side, reclassification, ineffectiveness, FV hedge
    // Transtype #22 — FX Hedge of Loan Principal routing
    if(/^fx hedge reserve|fx hedge reserve.*oci/.test(t))          return INVESTRAN_GL.fxHedgeReserveOCI;
    if(/^fx hedging instrument mtm/.test(t))                       return INVESTRAN_GL.fxHedgeInstrument;
    if(/cost of hedging|currency basis/.test(t))                   return INVESTRAN_GL.costOfHedgingReserve;
    if(/cash flow hedge reserve.*reclass/.test(t))                 return INVESTRAN_GL.cfhReserveReclass;
    if(/hedge reserve reclass.*de-designat|cfh.*amortis.*de-desig/.test(t)) return INVESTRAN_GL.cfhReclassDeDed;
    if(/hedge reserve reclass|hedge income.*reclass|cfh reserve recycling/.test(t)) return INVESTRAN_GL.cfhReclassPL;
    if(/cfh oci|cash flow hedge reserve/.test(t))                  return INVESTRAN_GL.cfhReserve;
    if(/hedging instrument.*cfh oci/.test(t))                      return INVESTRAN_GL.hedgingInstrumentCFHEff;
    if(/hedging instrument mtm \(cfh/.test(t))                     return INVESTRAN_GL.hedgingInstrumentCFHEff;
    if(/hedging instrument/.test(t) && /fv|fair value/.test(t))    return INVESTRAN_GL.hedgingInstrumentFVH;
    if(/hedging instrument/.test(t))                               return INVESTRAN_GL.hedgingInstrumentCFHIneff;
    if(/hedge ineffectiveness/.test(t))                            return INVESTRAN_GL.hedgeIneffectiveness;
    if(/fair value hedge p&l/.test(t))                             return INVESTRAN_GL.fvHedgePL;
    // Interest legs
    if(/interest receivable clear/.test(t))                        return INVESTRAN_GL.interestReceived;
    // Transtype #3 — mid-period purchase: receivable side maps to 113000; cash side to 111000
    if(/accrued interest receivable/.test(t))                      return INVESTRAN_GL.interestReceivable;
    if(/accrued interest cash paid/.test(t))                       return INVESTRAN_GL.cashReceipt;
    if(/interest receivable/.test(t))                              return INVESTRAN_GL.interestReceivable;
    if(/income.*daily accrued interest/.test(t))                   return INVESTRAN_GL.interestIncomeAccrued;
    if(/interest cash receipt/.test(t))                            return INVESTRAN_GL.cashReceipt;
    // IFRS 15 fee legs — per-fee-type routing into dedicated accounts.
    // The fee label is what JE rows are tagged with (e.g. "Arrangement Fee Receivable",
    // "Arrangement Fee Receivable Clear", "Arrangement Fee Income"). Route both the
    // receivable / clear / income variants per fee type before falling back to generic.
    // Arrangement
    if(/arrangement fee receivable clear/.test(t))                 return INVESTRAN_GL.feeReceivedArrangement;
    if(/arrangement fee receivable/.test(t))                       return INVESTRAN_GL.feeReceivableArrangement;
    if(/arrangement fee.*income|arrangement fee \(/.test(t))       return INVESTRAN_GL.arrangementFeeIncome;
    // Commitment (NWF or generic)
    if(/(commitment fee|nwf commitment fee) receivable clear/.test(t)) return INVESTRAN_GL.feeReceivedCommitment;
    if(/(commitment fee|nwf commitment fee) receivable/.test(t))   return INVESTRAN_GL.feeReceivableCommitment;
    if(/(commitment fee|nwf commitment fee).*income|(commitment fee|nwf commitment fee) \(/.test(t))
                                                                    return INVESTRAN_GL.commitmentFeeIncome;
    // Guarantee
    if(/guarantee fee receivable clear/.test(t))                   return INVESTRAN_GL.feeReceivedGuarantee;
    if(/guarantee fee receivable/.test(t))                         return INVESTRAN_GL.feeReceivableGuarantee;
    if(/guarantee fee.*income|guarantee fee \(/.test(t))           return INVESTRAN_GL.guaranteeFeeIncome;
    // Management
    if(/management fee.*receivable clear/.test(t))                 return INVESTRAN_GL.feeReceivedManagement;
    if(/management fee.*receivable/.test(t))                       return INVESTRAN_GL.feeReceivableManagement;
    if(/management fee \(investment period\).*income/.test(t))     return INVESTRAN_GL.managementFeeIncomeInv;
    if(/management fee \(post-investment\).*income/.test(t))       return INVESTRAN_GL.managementFeeIncomePost;
    // Dividend (Equity, IFRS 15)
    if(/dividend.*receivable clear/.test(t))                       return INVESTRAN_GL.feeReceivedDividend;
    if(/dividend.*receivable/.test(t))                             return INVESTRAN_GL.feeReceivableDividend;
    if(/dividend income.*income \(ifrs 15\)|dividend.*\(ifrs 15\)/.test(t)) return INVESTRAN_GL.dividendIncome;
    // Generic IFRS 15 fee / PortF fallback
    if(/income \(ifrs 15\)|fee income \(ifrs 15\)|income \(portf\)/.test(t)) return INVESTRAN_GL.feeIncome;
    if(/cash receipt/.test(t))                                     return INVESTRAN_GL.cashReceipt;
    if(/receivable clear/.test(t))                                 return INVESTRAN_GL.feeReceivable;
    if(/receivable/.test(t))                                       return INVESTRAN_GL.feeReceivable;
    if(/fee income/.test(t))                                       return INVESTRAN_GL.feeIncome;
    return null;
  };
  for(const e of entries){
    const map = lookup(e.transactionType, e.account);
    if(map){
      e.account = map.account;
      e.glAccountName = map.accountName;
      e.glTransType = map.transType || e.transactionType;
      e.glGap = !!map.gap;
      e.glGapNote = map.gapNote || null;
    } else {
      // No mapping found — flag as a gap so the GL Coverage panel surfaces it
      e.glAccountName = '— UNMAPPED —';
      e.glGap = true;
      e.glGapNote = `No mapping rule for "${e.transactionType}". Add to INVESTRAN_GL or extend the lookup() rules.`;
    }
  }
  return entries;
}

function generateDIU(instr, summary, opts){
  if(!summary || !summary.rows.length) return [];
  // glDate semantics:
  //   • If opts.glDate is a non-empty string → every JE row uses that explicit close
  //     date (typical month-end posting: glDate = '2026-05-31' across the batch).
  //   • Otherwise → glDate AUTO-matches each row's effectiveDate (the day the
  //     underlying economic event occurred). This is the safe default: a JE for a
  //     drawdown booked on 2024-10-08 has glDate = 2024-10-08.
  // The operator overrides via the Stage 2 "GL Posting Date" date picker when
  // running a real period close.
  const glDateOverride = opts && opts.glDate ? opts.glDate : null;
  const ctx = { legal: instr.legalEntity, leid: instr.leid, deal: instr.deal, position: instr.position, sec: instr.incomeSecurity };
  const entries = [];
  let jeIndex = 1;
  const add = (transType, amount, isDebit, account, effDate, comments) => {
    entries.push({
      legalEntity: ctx.legal, leid: ctx.leid, batchId: 1, jeIndex: jeIndex, txIndex: isDebit?2:1,
      glDate: glDateOverride || effDate,        // auto = effectiveDate per row, else override
      effectiveDate: effDate,
      deal: ctx.deal, position: ctx.position, incomeSecurity: ctx.sec,
      transactionType: transType, account: account,
      allocationRule: 'No Allocation',           // NWF default for the loan module
      batchType: 'Loan Calculator',
      batchComments: `Loan Calculator Entries from ${summary.periodStart} to ${summary.periodEnd}`,
      transactionComments: comments,
      originalAmount: isDebit ? amount : amount,
      amountLE: Math.abs(amount),
      fx: 1, amountLocal: Math.abs(amount),
      isDebit, leDomain: 'NWF'                    // NWF instead of generic Investran Global
    });
  };
  // Interest pair
  if(summary.totalCashAccrual){
    // Direction fix: accrual JE is DR Receivable / CR Income (asset up, revenue
    // up). Previously emitted with the legs flipped — caught during Transtype #3
    // regression. Affects every loan with non-zero accrued cash interest.
    // Phase A covenants — when a covenant breach margin step-up was active in
    // this period, suffix the memo so the auditor sees the rate uplift source
    // in the workpaper. Step-up only shows up when at least one day in the
    // window had a non-zero covenantMarginStepBps.
    const stepUpSuffix = (summary.covenantMarginStepUpBpsMax || 0) > 0
      ? ` — includes covenant-breach step-up +${summary.covenantMarginStepUpBpsMax}bps`
      : '';
    add('Interest Receivable',           summary.totalCashAccrual, true,  '40100', summary.periodEnd, `Interest Adjustment for ${summary.periodEnd}${stepUpSuffix}`);
    add('Income - Daily Accrued Interest', summary.totalCashAccrual, false, '23000', summary.periodEnd, `Interest Adjustment for ${summary.periodEnd}${stepUpSuffix}`);
    jeIndex++;
  }
  // PIK pair (capitalization)
  if(summary.totalCapitalized){
    add('PIK Investment', -summary.totalCapitalized, true,  '40100', summary.periodEnd, `PIK Capitalization for ${summary.periodEnd}`);
    add('Interest Receivable', -summary.totalCapitalized, false, '23000', summary.periodEnd, `PIK Capitalization for ${summary.periodEnd}`);
    jeIndex++;
  }
  // Amortization — Transtype #1 (Discount Accretion) / #2 (Premium Amortization)
  // Direction flips on sign:
  //   • totalAmort > 0 (OID):     income CR / carrying DR   (income up, CV up)
  //   • totalAmort < 0 (premium): income DR / carrying CR   (income down, CV down)
  // Per IFRS 9 §B5.4 / ASC 310-20-35-26.
  if(Math.abs(summary.totalAmort) > 0.005){
    const isAccretion = summary.totalAmort > 0;
    const label = isAccretion ? 'Discount Accretion' : 'Premium Amortization';
    const absAmt = Math.abs(summary.totalAmort);
    // Income leg
    add(label,            absAmt, /*isDebit*/!isAccretion, '40150', summary.periodEnd, `${label} for ${summary.periodEnd}`);
    // Carrying-value (offset) leg
    add(label + ' Offset', absAmt, /*isDebit*/isAccretion,  '23000', summary.periodEnd, `${label} for ${summary.periodEnd}`);
    jeIndex++;
  }
  // Non-use fee
  if(summary.totalNonUseFee > 0.005){
    add('Non-Use Fee Income', summary.totalNonUseFee, false, '40200', summary.periodEnd, `Non-use fee for ${summary.periodEnd}`);
    add('Non-Use Fee Receivable', summary.totalNonUseFee, true, '23100', summary.periodEnd, `Non-use fee for ${summary.periodEnd}`);
    jeIndex++;
  }
  // Hedge accounting (IFRS 9 §6) — three components per period:
  //  1) CFH effective portion → DR/CR Hedging Instrument (16000) / Cash Flow Hedge Reserve OCI (35000)
  //  2) Ineffective (CFH) or full MTM (FVH) → DR/CR Hedging Instrument / P&L Hedge Ineffectiveness (45100) / FV Hedge P&L (45200)
  //  3) Reclassification on settlement → DR Cash Flow Hedge Reserve / CR Hedge Income (45100)
  if(Math.abs(summary.totalHedgeOCI || 0) > 0.005){
    const v = summary.totalHedgeOCI;
    if(v > 0){
      // Transtype #22 — Route to FX Hedge Reserve when this is an FX hedge of principal
      const isFXP = (instr.hedge?.type === 'FXP' || instr.hedge?.subType === 'fxPrincipal');
      const ociLabel = isFXP ? 'FX Hedge Reserve (OCI · FX Principal)' : 'Cash Flow Hedge Reserve (OCI)';
      const instrLabel = isFXP ? 'FX Hedging Instrument MTM' : 'Hedging Instrument MTM (CFH OCI)';
      const periodComment = isFXP ? `FX hedge of principal — effective portion to OCI ${summary.periodEnd}` : `CFH effective portion to OCI for ${summary.periodEnd}`;
      add(instrLabel,  v, true,  '16000', summary.periodEnd, periodComment);
      add(ociLabel,    v, false, '35000', summary.periodEnd, periodComment);
    } else {
      add(instrLabel, -v, false, '16000', summary.periodEnd, periodComment);
      add(ociLabel,   -v, true,  '35000', summary.periodEnd, periodComment);
    }
    jeIndex++;
  }
  if(Math.abs(summary.totalHedgePL || 0) > 0.005){
    const v = summary.totalHedgePL;
    const acct = (instr.hedge?.type === 'FVH') ? '45200' : '45100';
    const label = (instr.hedge?.type === 'FVH') ? 'Fair Value Hedge P&L' : 'Hedge Ineffectiveness P&L';
    if(v > 0){
      add('Hedging Instrument MTM',  v, true,  '16000', summary.periodEnd, `Hedge MTM to P&L for ${summary.periodEnd}`);
      add(label,                     v, false, acct,    summary.periodEnd, `Hedge MTM to P&L for ${summary.periodEnd}`);
    } else {
      add('Hedging Instrument MTM', -v, false, '16000', summary.periodEnd, `Hedge MTM to P&L for ${summary.periodEnd}`);
      add(label,                    -v, true,  acct,    summary.periodEnd, `Hedge MTM to P&L for ${summary.periodEnd}`);
    }
    jeIndex++;
  }
  if(Math.abs(summary.totalHedgeReclass || 0) > 0.005){
    const v = summary.totalHedgeReclass;
    // Transtype #21 — Distinguish post-de-designation amortisation from
    // settlement-driven CFH reclass. Both flow to interest income but with
    // different transtype labels so reports / disclosures can split them.
    const isDeDed = !!instr.hedgeDeDesignationDate;
    const reclassLabel = isDeDed
      ? 'Hedge Reserve Reclass — De-Designation Amortisation'
      : 'CFH Reserve Recycling — Settlement Reclass';
    const reclassComment = isDeDed
      ? `Post-de-designation amortisation to P&L (IFRS 9 §6.5.6) ${summary.periodEnd}`
      : `CFH reclass to P&L on settlement (IFRS 9 §6.5.11) ${summary.periodEnd}`;
    if(v > 0){
      add('Cash Flow Hedge Reserve Reclass',  v, true,  '35000', summary.periodEnd, reclassComment);
      add(reclassLabel,                       v, false, '45100', summary.periodEnd, reclassComment);
    } else {
      add('Cash Flow Hedge Reserve Reclass', -v, false, '35000', summary.periodEnd, reclassComment);
      add(reclassLabel,                      -v, true,  '45100', summary.periodEnd, reclassComment);
    }
    jeIndex++;
  }
  // Modification gain/loss — framework-aware label (IFRS 9 §5.4.3 / ASC 470-50 / AASB 9 §5.4.3)
  if(Math.abs(summary.totalModGain || 0) > 0.005){
    const v = summary.totalModGain;
    const fwm = (instr.accountingFramework || 'IFRS').toUpperCase();
    const modTag = fwm === 'USGAAP' ? 'ASC 470-50' : fwm === 'AASB' ? 'AASB 9' : fwm === 'ASPE' ? 'ASPE 3856' : 'IFRS 9';
    if(v > 0){
      add('Modification Gain (' + modTag + ')',          v, false, '44000', summary.periodEnd, `Modification gain for ${summary.periodEnd}`);
      add('Modification — Loan Asset Adjustment',         v, true,  '15000', summary.periodEnd, `Modification gain for ${summary.periodEnd}`);
    } else {
      add('Modification Loss (' + modTag + ')',         -v, true,  '44000', summary.periodEnd, `Modification loss for ${summary.periodEnd}`);
      add('Modification — Loan Asset Adjustment',       -v, false, '15000', summary.periodEnd, `Modification loss for ${summary.periodEnd}`);
    }
    jeIndex++;
  }
  // Credit-loss provisioning — DR Impairment expense / CR Loan Loss Allowance.
  // Net change can be positive (build-up) or negative (release on stage migration / paydown).
  // V3 — Memo references the right standard for the deal's accounting framework:
  //   IFRS  → IFRS 9 §5.5 ECL
  //   AASB  → AASB 9 ECL
  //   USGAAP → ASC 326 CECL (Current Expected Credit Loss)
  //   ASPE  → ASPE §3856 incurred-loss
  if(Math.abs(summary.totalECLChange || 0) > 0.005){
    const v = summary.totalECLChange;
    const fw = (instr.accountingFramework || 'IFRS').toUpperCase();
    const eclLabel =
      fw === 'USGAAP' ? 'ASC 326 CECL' :
      fw === 'AASB'   ? 'AASB 9 ECL' :
      fw === 'ASPE'   ? 'ASPE 3856 incurred-loss' :
                        'IFRS 9 ECL';
    // Phase A covenants — when a covenant-driven SICR escalated the stage in
    // this period, suffix the memo with the standard's SICR citation so the
    // workpaper trail shows the trigger source.
    const sicrCitation =
      fw === 'USGAAP' ? 'ASC 326-20-30-2' :
      fw === 'AASB'   ? 'AASB 9 §B5.5.17' :
      fw === 'ASPE'   ? 'ASPE 3856.16' :
                        'IFRS 9 §B5.5.17';
    const sicrSuffix = summary.covenantSICRTriggered
      ? ` — SICR triggered by covenant breach (${sicrCitation})`
      : '';
    if(v > 0){
      add('Impairment Expense (ECL)',           v, true,  '70100', summary.periodEnd, `${eclLabel} provision for ${summary.periodEnd}${sicrSuffix}`);
      add('Loan Loss Allowance (Contra-Asset)', v, false, '15500', summary.periodEnd, `${eclLabel} provision for ${summary.periodEnd}${sicrSuffix}`);
    } else {
      add('Impairment Reversal (ECL)',          -v, false, '70100', summary.periodEnd, `${eclLabel} release for ${summary.periodEnd}${sicrSuffix}`);
      add('Loan Loss Allowance Reversal',       -v, true,  '15500', summary.periodEnd, `${eclLabel} release for ${summary.periodEnd}${sicrSuffix}`);
    }
    jeIndex++;
  }
  // FX revaluation gain/loss — DR/CR Forex P&L (45000) / Loan Asset (15000)
  if(Math.abs(summary.totalFXGain || 0) > 0.005){
    const v = summary.totalFXGain;
    if(v > 0){
      add('FX Revaluation Gain', v, false, '45000', summary.periodEnd, `FX reval (functional currency) for ${summary.periodEnd}`);
      add('FX Revaluation — Loan Asset Adjustment', v, true,  '15000', summary.periodEnd, `FX reval (functional currency) for ${summary.periodEnd}`);
    } else {
      add('FX Revaluation Loss', -v, true,  '45000', summary.periodEnd, `FX reval (functional currency) for ${summary.periodEnd}`);
      add('FX Revaluation — Loan Asset Adjustment', -v, false, '15000', summary.periodEnd, `FX reval (functional currency) for ${summary.periodEnd}`);
    }
    jeIndex++;
  }
  // Default interest (penalty rate × outstanding balance from event date)
  if((summary.totalDefaultInterest || 0) > 0.005){
    add('Default Interest Income',     summary.totalDefaultInterest, false, '40130', summary.periodEnd, `Default interest for ${summary.periodEnd}`);
    add('Default Interest Receivable', summary.totalDefaultInterest, true,  '23130', summary.periodEnd, `Default interest for ${summary.periodEnd}`);
    jeIndex++;
  }
  // Default fee (one-off penalty fee on event date)
  if((summary.totalDefaultFee || 0) > 0.005){
    add('Default Fee Income',     summary.totalDefaultFee, false, '40140', summary.periodEnd, `Default fee for ${summary.periodEnd}`);
    add('Default Fee Receivable', summary.totalDefaultFee, true,  '23140', summary.periodEnd, `Default fee for ${summary.periodEnd}`);
    jeIndex++;
  }
  // EIR accretion of deferred origination fees (arrangement / OID-style).
  // DR Loan carrying value (40110) / CR Interest income (40100).
  // V3 — JE memo and transtype label now reflect the deal's accounting
  // framework. IFRS labels were applied to USGAAP / AASB / ASPE deals too,
  // confusing users on Ferhat Float (USGAAP).
  //   IFRS  → "IFRS 9 §B5.4 EIR"
  //   AASB  → "AASB 9 EIR"
  //   USGAAP → "ASC 310-20 effective-yield"
  //   ASPE  → "ASPE 3856 effective-interest"
  if(Math.abs(summary.totalEIRAccretion || 0) > 0.005){
    const v = summary.totalEIRAccretion;
    const fw = (instr.accountingFramework || 'IFRS').toUpperCase();
    const eirTag =
      fw === 'USGAAP' ? 'ASC 310-20' :
      fw === 'AASB'   ? 'AASB 9' :
      fw === 'ASPE'   ? 'ASPE 3856' :
                        'IFRS 9';
    add('EIR Fee Accretion ('        + eirTag + ')', v, false, '40100', summary.periodEnd, `${eirTag} EIR fee accretion for ${summary.periodEnd}`);
    add('EIR Fee Accretion Offset (' + eirTag + ')', v, true,  '40110', summary.periodEnd, `${eirTag} EIR fee accretion for ${summary.periodEnd}`);
    jeIndex++;
  }
  // Fee income — framework-aware tag (IFRS 15 / ASC 606 / AASB 15 / ASPE 3400).
  // GL split: 40250 Fee Income (commitment / arrangement / guarantee), 23150 Fee Receivable.
  const fb = summary.feeBreakdown || {};
  const fwf = (instr.accountingFramework || 'IFRS').toUpperCase();
  const feeTag = fwf === 'USGAAP' ? 'ASC 606' : fwf === 'AASB' ? 'AASB 15' : fwf === 'ASPE' ? 'ASPE 3400' : 'IFRS 15';
  for(const [label, amt] of Object.entries(fb)){
    if(Math.abs(amt) <= 0.005) continue;
    add(`${label} Income (${feeTag})`,   amt, false, '40250', summary.periodEnd, `${label} accrual for ${summary.periodEnd}`);
    add(`${label} Receivable`,           amt, true,  '23150', summary.periodEnd, `${label} accrual for ${summary.periodEnd}`);
    jeIndex++;
  }
  // ----- CASH-LEG JEs (closes the half-double-entry gap) -------------------
  // Drawdowns: DR Loan Asset (15000) / CR Cash (10000) — one pair per draw event
  // Repayments: DR Cash (10000) / CR Loan Asset (15000) — one pair per repayment
  // Cash settlement of accrued income at period end: DR Cash / CR Receivable
  // (clears the corresponding 23000/23130/23140/23150 receivables booked above).
  // ── Transtype #3 — Mid-period purchase (accrued interest paid at trade) ──
  // When NWF acquires a loan mid-coupon-period, the buyer pays the seller for
  // accrued-but-unpaid interest at the trade date. That amount is held as a
  // receivable and clears on the next coupon when the buyer receives the full
  // coupon. Emit a JE pair on the trade date (= recognition date for NWF):
  //   DR 113000 Interest Receivable   (purchased accrual)
  //   CR 111000 Cash                  (cash paid to seller)
  // Only emits if instr.tradeAccruedInterest is a positive number.
  if(typeof instr.tradeAccruedInterest === 'number' && instr.tradeAccruedInterest > 0.005){
    const tradeDate = instr.tradeDate || instr.settlementDate;
    add('Accrued Interest Receivable (purchased at trade)', instr.tradeAccruedInterest, true,  '40100', tradeDate,
        `Accrued interest paid to seller at trade · ${tradeDate}`);
    add('Accrued Interest Cash Paid (at trade)',            instr.tradeAccruedInterest, false, '10000', tradeDate,
        `Cash paid to seller for accrued interest at trade · ${tradeDate}`);
    jeIndex++;
  }
  // ── Transtype #18 — Trade vs Settlement Date Accounting ──
  // Per IFRS 9 §B3.1.5: a financial asset purchased may be recognised either
  // on trade date (commitment date) or settlement date (cash exchange).
  // Policy is applied consistently to a category of assets.
  //
  // When instr.tradeDate < instr.settlementDate AND
  // instr.tradeAccountingMethod === 'tradeDate', emit a pre-recognition pair
  // on trade date and the offsetting reversal on settle date so the
  // GL trail shows the unsettled-period exposure cleanly.
  //
  //   tradeDate (T+0)   : DR 141000 Loan Asset / CR 232000 Unsettled Trade Payable
  //   settleDate (T+n)  : DR 232000 Unsettled Trade Payable / CR 141000 Loan Asset
  //   settleDate (T+n)  : DR 141000 Loan Asset / CR 111000 Cash (existing draw JE)
  //
  // Net effect: the loan asset shows on day T+0 (commitment recognised) and
  // the cash hits on T+n. Total carrying value at end of T+n is unchanged.
  if(instr.tradeAccountingMethod === 'tradeDate' && instr.tradeDate && instr.tradeDate < instr.settlementDate){
    const initialDraw = (summary.rows[0]?.balance || 0);   // opening balance = face committed
    const tradeAmt    = +instr.faceValue || +instr.commitment || initialDraw;
    if(tradeAmt > 0.005){
      add('Trade-Date Recognition — Loan Asset',
          tradeAmt, true,  '141000', instr.tradeDate, `Trade-date recognition — IFRS 9 §B3.1.5 · ${instr.tradeDate}`);
      add('Trade-Date Recognition — Unsettled Trade Payable',
          tradeAmt, false, '232000', instr.tradeDate, `Unsettled trade payable booked on trade date · ${instr.tradeDate}`);
      jeIndex++;
      // Reversal on settlement date (immediately before the cash-settlement JE
      // that the existing draw handler will emit)
      add('Settlement-Date Reversal — Unsettled Trade Payable',
          tradeAmt, true,  '232000', instr.settlementDate, `Reverse unsettled trade payable on settle · ${instr.settlementDate}`);
      add('Settlement-Date Reversal — Loan Asset (Unsettled)',
          tradeAmt, false, '141000', instr.settlementDate, `Reverse trade-date asset booking on settle · ${instr.settlementDate}`);
      jeIndex++;
    }
  }
  for(const r of summary.rows){
    if(r.draw && r.draw > 0.005){
      add('Loan Drawdown',          r.draw, true,  '15000', r.date, `Drawdown ${r.date}`);
      add('Loan Drawdown — Cash',   r.draw, false, '10000', r.date, `Drawdown ${r.date}`);
      jeIndex++;
    }
    if(r.paydown && r.paydown > 0.005){
      add('Loan Repayment — Cash',   r.paydown, true,  '10000', r.date, `Repayment ${r.date}`);
      add('Loan Repayment',          r.paydown, false, '15000', r.date, `Repayment ${r.date}`);
      jeIndex++;
    }
    // Transtype #4 — Prepayment. Same DR/CR pattern as scheduled repayment
    // but with a distinct transtype so it can be filtered separately in the
    // GL / DIU output and audit reports.
    if(r.prepayment && r.prepayment > 0.005){
      // Transtype #16 — Mandatory Prepayment Events. If part of today's
      // prepayment was mandatory (covenant-triggered: excess cash flow sweep,
      // change-of-control, asset sale proceeds, IPO, insurance), emit a
      // separate JE pair carrying the trigger reason in the comments so
      // covenant tracking / lender reporting can isolate it cleanly.
      const mandatory = r.mandatoryPrepayment || 0;
      const voluntary = Math.max(0, r.prepayment - mandatory);
      const trigStr   = (r.mandatoryTriggers && r.mandatoryTriggers.length)
                       ? ' (' + r.mandatoryTriggers.join(', ') + ')' : '';
      if(voluntary > 0.005){
        add('Loan Prepayment — Cash',  voluntary, true,  '10000', r.date, `Prepayment ${r.date}`);
        add('Loan Prepayment',         voluntary, false, '15000', r.date, `Prepayment ${r.date}`);
        jeIndex++;
      }
      if(mandatory > 0.005){
        add('Mandatory Prepayment — Cash', mandatory, true,  '10000', r.date, `Mandatory prepayment ${r.date}${trigStr}`);
        add('Mandatory Prepayment',        mandatory, false, '15000', r.date, `Mandatory prepayment ${r.date}${trigStr}`);
        jeIndex++;
      }
    }
    // Transtype #5 — Prepayment penalty / make-whole income. Cash received from
    // borrower over and above the prepaid principal; recognised immediately as
    // fee/penalty income (not part of EIR per IFRS 9 §B5.4 / ASC 310-20-25-12).
    if(r.prepayPenalty && r.prepayPenalty > 0.005){
      add('Prepayment Penalty — Cash', r.prepayPenalty, true,  '10000', r.date, `Prepayment penalty ${r.date}`);
      add('Prepayment Penalty Income', r.prepayPenalty, false, '40250', r.date, `Prepayment penalty ${r.date}`);
      jeIndex++;
    }
    // Transtype #8 — Write-off. Three-legged JE that uses up the existing ECL
    // allowance first, then takes the residual to P&L as a current-period
    // impairment expense. Asset side credited for the full gross write-off.
    if(r.writeOff && r.writeOff > 0.005){
      const allowUsed = r.writeOffAllowanceUsed || 0;
      const residual  = r.writeOffResidualExpense || 0;
      if(allowUsed > 0.005){
        add('Loan Write-Off — Allowance Applied', allowUsed, true,  '14500', r.date, `Write-off allowance application ${r.date}`);
      }
      if(residual > 0.005){
        add('Loan Write-Off — Residual Expense', residual, true,  '47000', r.date, `Write-off residual impairment ${r.date}`);
      }
      add('Loan Write-Off — Asset Derecognition', r.writeOff, false, '15000', r.date, `Loan asset written off ${r.date}`);
      jeIndex++;
    }
    // Transtype #9 — Recovery post-write-off. Cash received from a borrower /
    // bankruptcy estate / guarantor / collateral realisation AFTER write-off.
    // IFRS 9 §B5.5.43 / ASC 326-20-30 credit the income to the same line that
    // absorbed the original write-off (470000 Impairment), effectively
    // reversing prior expense.
    if(r.recovery && r.recovery > 0.005){
      // Transtype #24 — When `recoveryAllocation` is present, split the cash
      // receipt across the four buckets (principal, default interest, default
      // fees, legal). Each bucket emits its own JE pair with a distinct label
      // so the IFRS 7 §35K recovery analysis can trace where cash landed.
      const alloc = r.recoveryAllocation;
      if(alloc){
        const buckets = [
          { key:'principal',   amt: +alloc.principal  || 0, label:'Recovery — Principal (Write-Off Reversal)',  glAcct:'47000' },
          { key:'defaultInt',  amt: +alloc.defaultInt || 0, label:'Recovery — Default Interest Allocation',     glAcct:'42100' },
          { key:'defaultFee',  amt: +alloc.defaultFee || 0, label:'Recovery — Default Fee Allocation',           glAcct:'49200' },
          { key:'legal',       amt: +alloc.legal      || 0, label:'Recovery — Legal Cost Reimbursement',         glAcct:'54300' }
        ];
        for(const b of buckets){
          if(b.amt <= 0.005) continue;
          add('Recovery — Cash Receipt (' + b.key + ')', b.amt, true,  '10000', r.date, `Recovery cash allocated to ${b.key} ${r.date}`);
          add(b.label,                                    b.amt, false, b.glAcct, r.date, `Recovery cash allocated to ${b.key} ${r.date}`);
          jeIndex++;
        }
        // If allocation doesn't equal total recovery, residual hits Impairment Reversal
        const allocSum = buckets.reduce((s,b) => s + b.amt, 0);
        const residual = r.recovery - allocSum;
        if(residual > 0.005){
          add('Recovery — Cash Receipt (unallocated)', residual, true,  '10000', r.date, `Unallocated recovery residual ${r.date}`);
          add('Recovery of Written-Off Loan',          residual, false, '47000', r.date, `Unallocated recovery residual ${r.date}`);
          jeIndex++;
        }
      } else {
        // Legacy single-bucket path
        add('Recovery — Cash Receipt',              r.recovery, true,  '10000', r.date, `Post-write-off recovery ${r.date}`);
        add('Recovery of Written-Off Loan',         r.recovery, false, '47000', r.date, `Post-write-off recovery ${r.date}`);
        jeIndex++;
      }
    }
    // Transtype #10 — Cure / Stage Reversal. Stage 3 → Stage 2/1 transition
    // releases the existing ECL allowance back to P&L. JE pair reverses the
    // prior allowance build (DR Allowance / CR Impairment Expense).
    if(r.cureRelease && r.cureRelease > 0.005){
      add('ECL Cure — Allowance Reversal',       r.cureRelease, true,  '14500', r.date, `Stage cure / allowance release ${r.date}`);
      add('ECL Cure — Impairment Reversal',      r.cureRelease, false, '47000', r.date, `Stage cure / allowance release ${r.date}`);
      jeIndex++;
    }
    // Transtype #23 — Allowance Reversal (Without Stage Change). Same DR/CR
    // mechanic as cure (DR Allowance / CR Impairment) but with distinct
    // transtype labels so IFRS 7 §35F ECL roll-forward can split model-
    // recalibration movements from stage-driven movements.
    if(r.allowanceReversal && r.allowanceReversal > 0.005){
      add('Allowance Reversal — Model Recalibration',  r.allowanceReversal, true,  '14500', r.date, `Model-driven allowance reversal (no stage change) ${r.date}`);
      add('Impairment Reversal — Model Recalibration', r.allowanceReversal, false, '47000', r.date, `Model-driven allowance reversal (no stage change) ${r.date}`);
      jeIndex++;
    }
    // Transtype #11 — Forbearance / Payment Holiday. One-time booking on the
    // forbearance start date that reclassifies the expected deferred interest
    // from the regular receivable (113000) to a separate "Deferred Interest"
    // sub-account. Subsequent accruals continue and naturally accumulate in
    // the deferred bucket until the holiday ends.
    if(r.forbearanceStartDeferred && r.forbearanceStartDeferred > 0.005){
      add('Forbearance — Deferred Interest Reclass',  r.forbearanceStartDeferred, true,  '40100', r.date, `Forbearance deferral ${r.date}`);
      add('Forbearance — Interest Receivable Reduction', r.forbearanceStartDeferred, false, '40100', r.date, `Forbearance deferral ${r.date}`);
      jeIndex++;
    }
    // Transtype #12 — Capitalised origination costs. Costs PAID by NWF at
    // origination (legal, transaction, valuation) that capitalise into the
    // loan's carrying value per IFRS 9 §B5.4 / ASC 310-20-25-2.
    if(r.capitalisedCost && r.capitalisedCost > 0.005){
      add('Capitalised Origination Costs',           r.capitalisedCost, true,  '15000', r.date, `Capitalised cost into carrying ${r.date}`);
      add('Capitalised Origination Costs — Cash',    r.capitalisedCost, false, '10000', r.date, `Capitalised cost cash paid ${r.date}`);
      jeIndex++;
      // ── Transtype #25 — Origination Cost Deferral on Revolvers (ASC 310-20-25-19) ──
      // When the deal's revolverCostDeferralBasis === 'commitment', the
      // origination cost amortises over the COMMITMENT period (settlement →
      // availabilityEnd) rather than the loan maturity. Emit a documentation
      // JE that captures the policy choice for the audit trail. The actual
      // amortisation flows through the existing EIR mechanism (the higher
      // day-1 carrying yields a lower EIR over the commitment period).
      if(instr.revolverCostDeferralBasis === 'commitment' && instr.availabilityEnd && r.date === instr.settlementDate){
        add('Revolver Cost Deferral Policy — Commitment Basis (ASC 310-20-25-19)',
            r.capitalisedCost, true,  '15000', r.date,
            `Origination cost amortises over commitment period (settle → ${instr.availabilityEnd}) per ASC 310-20-25-19, not over loan maturity (${instr.maturityDate})`);
        add('Revolver Cost Deferral Policy — Offset (zero net effect)',
            r.capitalisedCost, false, '15000', r.date,
            `Memo entry — policy disclosure only; no net carrying-value impact`);
        jeIndex++;
      }
    }
    // Transtype #13 — Loan Sale (full derecognition). Per IFRS 9 §3.2.3 /
    // ASC 860: derecognise the entire carrying amount; book sale proceeds to
    // cash; the difference between proceeds and carrying value flows to P&L
    // as Gain/(Loss) on Sale of Loan.
    //
    // We split the booking into two JE pairs so the gain/loss leg is visible:
    //   JE-A (always)    DR Cash 111000           CR Loan Asset 141000  (at carrying)
    //   JE-B (gain)      DR Cash 111000           CR Gain on Sale 442000
    //   JE-B (loss)      DR Loss on Sale 542000   CR Loan Asset 141000
    if(r.loanSaleCV && r.loanSaleCV > 0.005){
      const proceeds = r.loanSale || 0;
      const cv       = r.loanSaleCV;
      const gainLoss = r.loanSaleGain || 0;
      // JE-A — derecognise asset against cash up to carrying value
      const baseCash = Math.min(proceeds, cv);   // portion of cash that pairs with asset
      if(baseCash > 0.005){
        add('Loan Sale — Cash Received',         baseCash, true,  '111000', r.date, `Loan sale proceeds ${r.date}`);
        add('Loan Sale — Asset Derecognition',   baseCash, false, '141000', r.date, `Loan sale carrying derecog ${r.date}`);
        jeIndex++;
      }
      // JE-B — gain or loss leg
      if(gainLoss > 0.005){
        // Sold above carrying → gain. Excess cash hits Gain on Sale (P&L credit).
        const excess = gainLoss;
        add('Loan Sale — Cash Received (Gain)',  excess,   true,  '111000', r.date, `Loan sale gain — extra cash ${r.date}`);
        add('Loan Sale — Gain on Disposal',      excess,   false, '442000', r.date, `Gain on loan sale ${r.date}`);
        jeIndex++;
      } else if(gainLoss < -0.005){
        // Sold below carrying → loss. Loss on Sale absorbs the residual carrying value.
        const shortfall = -gainLoss;
        add('Loan Sale — Loss on Disposal',      shortfall, true,  '542000', r.date, `Loss on loan sale ${r.date}`);
        add('Loan Sale — Residual Asset Derecog',shortfall, false, '141000', r.date, `Loan sale residual derecog ${r.date}`);
        jeIndex++;
      }
    }
    // Transtype #14 — Loan Participation / Partial Sell-Down. Per IFRS 9
    // §3.2.6 "fully proportionate share" transfer test. The pro-rata
    // carrying value is derecognised; cash flows in; the difference flows
    // to P&L as Gain/(Loss) on Participation Sale.
    if(r.participationCV && r.participationCV > 0.005){
      const proceeds = r.participation || 0;
      const cv       = r.participationCV;
      const gainLoss = r.participationGain || 0;
      const baseCash = Math.min(proceeds, cv);
      if(baseCash > 0.005){
        add('Loan Participation — Cash Received',          baseCash, true,  '111000', r.date, `Participation proceeds ${r.date}`);
        add('Loan Participation — Asset Derecognition',    baseCash, false, '141000', r.date, `Participation partial derecog ${r.date}`);
        jeIndex++;
      }
      if(gainLoss > 0.005){
        const excess = gainLoss;
        add('Loan Participation — Cash Received (Gain)',   excess,   true,  '111000', r.date, `Participation gain — extra cash ${r.date}`);
        add('Loan Participation — Gain on Disposal',       excess,   false, '442000', r.date, `Gain on participation ${r.date}`);
        jeIndex++;
      } else if(gainLoss < -0.005){
        const shortfall = -gainLoss;
        add('Loan Participation — Loss on Disposal',       shortfall, true,  '542000', r.date, `Loss on participation ${r.date}`);
        add('Loan Participation — Residual Asset Derecog', shortfall, false, '141000', r.date, `Participation residual derecog ${r.date}`);
        jeIndex++;
      }
    }
    // Transtype #15 — Debt-for-Equity Swap. Per IFRIC 19 / ASC 470-50-40:
    // derecognise the loan at carrying; recognise a new equity investment
    // at fair value (FV); the carrying-FV gap is a restructuring loss to
    // P&L. JE pair structure:
    //   DR Equity Investment  142000    (at fair value of equity received)
    //   DR Restructuring Loss 542100    (CV − FV)
    //   CR Loan Asset         141000    (at full carrying)
    if(r.debtEquitySwapCV && r.debtEquitySwapCV > 0.005){
      const fv   = r.debtEquitySwap || 0;
      const cv   = r.debtEquitySwapCV;
      const loss = r.debtEquitySwapLoss || 0;
      if(fv > 0.005){
        add('Debt-for-Equity Swap — Equity Recognition', fv, true,  '142000', r.date, `Equity received at FV — D4E swap ${r.date}`);
        add('Debt-for-Equity Swap — Loan Derecognition (FV portion)', fv, false, '141000', r.date, `Loan derecog at FV portion ${r.date}`);
        jeIndex++;
      }
      if(loss > 0.005){
        add('Debt-for-Equity Swap — Restructuring Loss', loss, true,  '542100', r.date, `Restructuring loss CV-FV ${r.date}`);
        add('Debt-for-Equity Swap — Loan Derecognition (Loss portion)', loss, false, '141000', r.date, `Loan derecog loss portion ${r.date}`);
        jeIndex++;
      } else if(loss < -0.005){
        // Rare — equity FV exceeds loan carrying. Gain on swap.
        const gain = -loss;
        add('Debt-for-Equity Swap — Equity Recognition (Gain)', gain, true, '142000', r.date, `Equity FV > carrying ${r.date}`);
        add('Debt-for-Equity Swap — Restructuring Gain',       gain, false,'442100', r.date, `Restructuring gain FV-CV ${r.date}`);
        jeIndex++;
      }
    }
  }
  // Cash settlement at period end: assume accrued interest + fees paid on
  // periodEnd date (a simplification — real systems track per-fee payment
  // schedules). Pair up to clear the receivables we booked above.
  if(summary.totalCashAccrual > 0.005){
    add('Interest Cash Receipt',     summary.totalCashAccrual, true,  '10000', summary.periodEnd, `Interest cash settlement ${summary.periodEnd}`);
    add('Interest Receivable Clear', summary.totalCashAccrual, false, '23000', summary.periodEnd, `Interest cash settlement ${summary.periodEnd}`);
    jeIndex++;
  }
  for(const [label, amt] of Object.entries(fb)){
    if(Math.abs(amt) <= 0.005) continue;
    add(`${label} Cash Receipt`,            amt, true,  '10000', summary.periodEnd, `${label} cash settlement ${summary.periodEnd}`);
    add(`${label} Receivable Clear`,        amt, false, '23150', summary.periodEnd, `${label} cash settlement ${summary.periodEnd}`);
    jeIndex++;
  }
  if((summary.totalDefaultInterest || 0) > 0.005){
    add('Default Interest Cash Receipt',     summary.totalDefaultInterest, true,  '10000', summary.periodEnd, `Default interest cash settlement ${summary.periodEnd}`);
    add('Default Interest Receivable Clear', summary.totalDefaultInterest, false, '23130', summary.periodEnd, `Default interest cash settlement ${summary.periodEnd}`);
    jeIndex++;
  }
  if((summary.totalDefaultFee || 0) > 0.005){
    add('Default Fee Cash Receipt',          summary.totalDefaultFee, true,  '10000', summary.periodEnd, `Default fee cash settlement ${summary.periodEnd}`);
    add('Default Fee Receivable Clear',      summary.totalDefaultFee, false, '23140', summary.periodEnd, `Default fee cash settlement ${summary.periodEnd}`);
    jeIndex++;
  }
  if(summary.totalNonUseFee > 0.005){
    add('Non-Use Fee Cash Receipt',          summary.totalNonUseFee, true,  '10000', summary.periodEnd, `Non-use fee cash settlement ${summary.periodEnd}`);
    add('Non-Use Fee Receivable Clear',      summary.totalNonUseFee, false, '23100', summary.periodEnd, `Non-use fee cash settlement ${summary.periodEnd}`);
    jeIndex++;
  }
  // ──────────────── Transtype #19 — Period-End Reversing Entries ────────────────
  // Standard month-end-close pattern: every accrual JE posted on periodEnd gets
  // a mirrored "reversing" entry on day 1 of the next period. When the real cash
  // hits later, the cash JE books the full amount to income in the new period.
  // The reverse pair cancels out so net effect is zero — but the audit trail
  // shows the original accrual + its reversal + the eventual cash receipt
  // distinctly, which is how many GLs require accruals to be presented.
  //
  // Triggered when instr.useReversingEntries === true. Filters the entries
  // emitted so far to find accrual-style postings (income/receivable pairs)
  // and emits flipped twins dated to the day after periodEnd.
  if(instr.useReversingEntries && summary.periodEnd){
    const periodEndDate = new Date(summary.periodEnd);
    const nextDay = new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), periodEndDate.getDate() + 1)
                    .toISOString().slice(0, 10);
    // Identify which JEs to reverse: anything posted on periodEnd that is an
    // accrual (interest, fee, PIK, default interest/fee, EIR accretion) and
    // NOT a cash receipt or settlement.
    const isAccrual = (e) => {
      if(e.effectiveDate !== summary.periodEnd) return false;
      const tt = (e.transactionType || '').toLowerCase();
      const isCash = /cash receipt|cash settlement|receivable clear|drawdown|repayment/.test(tt);
      const isAccrualLike = /interest receivable|interest income|daily accrued|pik|fee receivable|fee income|accretion|amortis|default (interest|fee)|non-use fee/.test(tt);
      return isAccrualLike && !isCash;
    };
    const toReverse = entries.filter(isAccrual);
    for(const orig of toReverse){
      // Emit a DR/CR-flipped twin with a "Reversing —" prefix label
      add(
        'Reversing — ' + (orig.transactionType || ''),
        orig.amountLE,
        !orig.isDebit,         // flip DR ↔ CR
        orig.account,
        nextDay,
        `Auto-reversing entry — cancels ${summary.periodEnd} accrual at next period start`
      );
    }
    if(toReverse.length > 0) jeIndex++;
  }
  return applyInvestranGLMapping(entries);
}

/* ---------- DIU generator — from PortF Data ---------------
   Walks the loaded reference's scheduleResults[] (date-indexed period rows)
   and emits the same DIU JE pair shape that generateDIU() produces from
   our calculator. Used when the DIU Export tab's Source = "PortF Data".
*/
function generateDIUFromReference(instr, referenceData){
  if(!instr || !referenceData || !Array.isArray(referenceData.scheduleResults)) return [];
  const ctx = { legal: instr.legalEntity, leid: instr.leid, deal: instr.deal, position: instr.position, sec: instr.incomeSecurity };
  const entries = [];
  let jeIndex = 1;
  const add = (transType, amount, isDebit, account, effDate, comments) => {
    entries.push({
      legalEntity: ctx.legal, leid: ctx.leid, batchId: 1, jeIndex: jeIndex, txIndex: isDebit?2:1,
      glDate: effDate, effectiveDate: effDate,
      deal: ctx.deal, position: ctx.position, incomeSecurity: ctx.sec,
      transactionType: transType, account: account, allocationRule: isDebit?'Non-Dominant':'By Commitment and GL Date',
      batchType: 'Loan Calculator (PortF)',
      batchComments: `From reference: ${referenceData.source || 'unknown'} · ${effDate}`,
      transactionComments: comments,
      originalAmount: isDebit ? amount : amount,
      amountLE: Math.abs(amount), fx: 1, amountLocal: Math.abs(amount),
      isDebit, leDomain: 'Investran Global · PortF'
    });
  };
  for(const ref of referenceData.scheduleResults){
    const eff = ref.date;
    // Interest accrual pair (+ cash-settlement clear)
    if((ref.interestAccrued || 0) > 0.005){
      // Direction fix (same as main flow): DR Receivable / CR Income for accrual
      add('Interest Receivable',           ref.interestAccrued, true,  '40100', eff, `Interest accrual (PortF) ${eff}`);
      add('Income - Daily Accrued Interest', ref.interestAccrued, false, '23000', eff, `Interest accrual (PortF) ${eff}`);
      jeIndex++;
      add('Interest Cash Receipt',     ref.interestAccrued, true,  '10000', eff, `Interest cash settlement (PortF) ${eff}`);
      add('Interest Receivable Clear', ref.interestAccrued, false, '23000', eff, `Interest cash settlement (PortF) ${eff}`);
      jeIndex++;
    }
    // Fees — by breakdown if provided, else as a single line
    if(ref.feeBreakdown && Object.keys(ref.feeBreakdown).length){
      for(const [label, amt] of Object.entries(ref.feeBreakdown)){
        if(Math.abs(amt) <= 0.005) continue;
        add(`${label} Income (PortF)`,        amt, false, '40250', eff, `${label} accrual (PortF) ${eff}`);
        add(`${label} Receivable`,                amt, true,  '23150', eff, `${label} accrual (PortF) ${eff}`);
        jeIndex++;
        add(`${label} Cash Receipt`,              amt, true,  '10000', eff, `${label} cash settlement (PortF) ${eff}`);
        add(`${label} Receivable Clear`,          amt, false, '23150', eff, `${label} cash settlement (PortF) ${eff}`);
        jeIndex++;
      }
    } else if((ref.totalFees || 0) > 0.005){
      add('Fee Income (PortF)',     ref.totalFees, false, '40250', eff, `Total fees (PortF) ${eff}`);
      add('Fee Receivable',             ref.totalFees, true,  '23150', eff, `Total fees (PortF) ${eff}`);
      jeIndex++;
      add('Fee Cash Receipt',           ref.totalFees, true,  '10000', eff, `Fee cash settlement (PortF) ${eff}`);
      add('Fee Receivable Clear',       ref.totalFees, false, '23150', eff, `Fee cash settlement (PortF) ${eff}`);
      jeIndex++;
    }
    // Drawdown pair
    if((ref.drawdown || 0) > 0.005){
      add('Loan Drawdown',          ref.drawdown, true,  '15000', eff, `Drawdown (PortF) ${eff}`);
      add('Loan Drawdown — Cash',   ref.drawdown, false, '10000', eff, `Drawdown (PortF) ${eff}`);
      jeIndex++;
    }
    // Repayment pair
    if((ref.repayment || 0) > 0.005){
      add('Loan Repayment — Cash',   ref.repayment, true,  '10000', eff, `Repayment (PortF) ${eff}`);
      add('Loan Repayment',          ref.repayment, false, '15000', eff, `Repayment (PortF) ${eff}`);
      jeIndex++;
    }
  }
  return applyInvestranGLMapping(entries);
}



