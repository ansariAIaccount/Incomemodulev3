// ═══════════════════════════════════════════════════════════════════════════
// loan-module-analytics.js — Portfolio Analytics engine (Tier 1 #1)
// ═══════════════════════════════════════════════════════════════════════════
// Pure JS analytics functions. Zero dependencies. Consumes the daily
// cashflow schedule produced by loan-module-engine.js and derives:
//
//   Per-loan metrics
//   ────────────────
//   • Yield to Maturity (YTM)         IRR of all remaining cashflows
//   • Yield to Call    (YTC)          IRR to next call/prepayment date
//   • Yield to Worst   (YTW)          min(YTM, YTC)
//   • Current coupon                  latest all-in coupon (RFR + margin)
//   • Spread over benchmark           coupon − risk-free reference
//   • Weighted Average Life (WAL)     Σ(t·principal_paydown) / Σ(principal)
//   • Macaulay duration               Σ(t·PV_cf) / Σ(PV_cf)
//   • Modified duration               Macaulay / (1 + y/freq)
//   • DV01                            $ price change for a 1bp yield move
//   • Convexity                       curvature term for large moves
//
//   Portfolio aggregates
//   ────────────────────
//   • Total notional / outstanding balance
//   • Weighted-avg YTM / WAL / duration (by outstanding)
//   • Portfolio DV01
//   • Concentration: by framework, currency, team, ECL stage, maturity bucket
//   • Maturity ladder buckets: 0-1Y, 1-2Y, 2-3Y, 3-5Y, 5-7Y, 7-10Y, 10Y+
//
// Usage:
//   const metrics = LMA.deriveLoanMetrics(inst, schedule, options);
//   const portfolio = LMA.aggregatePortfolio(deals);
// ═══════════════════════════════════════════════════════════════════════════

(function(global){
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  // Fractional year between two dates using ACT/365 (good enough for
  // present-value math even when the loan uses ACT/360 for accrual).
  function yearFrac(fromISO, toISO){
    if(!fromISO || !toISO) return 0;
    const ms = (new Date(toISO).getTime() - new Date(fromISO).getTime());
    return ms / (365.25 * 86400 * 1000);
  }

  // Round for display without polluting IRR / NPV calcs
  function round(n, dp){ if(n == null || !isFinite(n)) return null; const p = Math.pow(10, dp||6); return Math.round(n * p) / p; }

  // ─────────────────────────────────────────────────────────────────────────
  // Core: extract clean cashflow stream from an engine schedule row set
  // ─────────────────────────────────────────────────────────────────────────
  // The engine schedule is a per-day array. For present-value maths we want
  // aggregated cashflows on payment dates only. Returns:
  //   [{ date, principal, interest, fees, total }] sorted by date
  //
  // `schedule` is expected to be M.schedule or equivalent — each row has:
  //   { date, interestAccrual, feeAccrual, drawdown, paydown, coupon,
  //     scheduledPrincipal, scheduledInterest, ... }
  // Consumes the loan-module-engine daily schedule. Engine field names:
  //   draw, paydown, prepayment, prepayPenalty  (event-day only, mostly zero)
  //   dailyCash    (daily interest accrual — non-zero on every accrual day)
  //   dailyFees    (daily fee accrual)
  //
  // For YTM/IRR we treat each daily row as its own micro-cashflow. IRR handles
  // the daily aggregation naturally (this is equivalent to continuous
  // compounding rolled up). Skips zero-total rows for efficiency.
  //
  // Sign convention (investor's perspective):
  //   Cash in  (+): dailyCash + paydown + prepayment + prepayPenalty + dailyFees
  //   Cash out (-): draw
  function extractCashflows(schedule, opts){
    opts = opts || {};
    const asOf = opts.asOf ? new Date(opts.asOf) : new Date();
    if(!Array.isArray(schedule) || !schedule.length) return [];
    const flows = [];
    for(const r of schedule){
      const d = r.date || r.payDate || r.effectiveDate;
      if(!d) continue;
      if(opts.futureOnly !== false && new Date(d) <= asOf) continue;
      // Also fall back to legacy engines that used `scheduledInterest` etc.
      const interest = +r.dailyCash            || +r.scheduledInterest || +r.interestPayment || 0;
      const paydown  = +r.paydown              || +r.scheduledPrincipal || 0;
      const prepay   = +r.prepayment           || 0;
      const penalty  = +r.prepayPenalty        || 0;
      const draw     = +r.draw                 || +r.drawdown           || 0;
      const fees     = +r.dailyFees            || +r.feePayment         || 0;
      const principal = paydown + prepay;
      const total = interest + principal + penalty + fees - draw;
      if(Math.abs(total) < 0.005) continue;
      flows.push({
        date: d,
        principal, interest, fees: fees + penalty, drawdown: draw, total
      });
    }
    return flows;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IRR — Newton-Raphson with bisection fallback
  // ─────────────────────────────────────────────────────────────────────────
  // Solves for `y` where Σ cf_i / (1+y)^t_i = price
  // cashflows = [{ t: yearFrac, cf: amount }]
  function computeIRR(cashflows, price, guess){
    if(!cashflows || !cashflows.length) return null;
    price = price != null ? price : 0;
    let y = guess != null ? guess : 0.08;
    // NPV & derivative at guess y
    function npvAndDeriv(y){
      let npv = -price, dnpv = 0;
      for(const { t, cf } of cashflows){
        const disc = Math.pow(1 + y, t);
        npv  += cf / disc;
        dnpv -= t * cf / (disc * (1 + y));
      }
      return [npv, dnpv];
    }
    // Newton-Raphson (up to 100 iterations, tol 1e-8)
    for(let i = 0; i < 100; i++){
      const [f, df] = npvAndDeriv(y);
      if(Math.abs(f) < 1e-8) return y;
      if(Math.abs(df) < 1e-14) break;  // derivative zero → bail to bisection
      const step = f / df;
      y = y - step;
      if(y < -0.99) y = -0.99;
      if(Math.abs(step) < 1e-10) return y;
    }
    // Bisection fallback: bracket between -0.99 and 5.0
    let lo = -0.99, hi = 5.0;
    let flo = npvAndDeriv(lo)[0], fhi = npvAndDeriv(hi)[0];
    if(flo * fhi > 0) return null;  // no bracket → give up
    for(let i = 0; i < 100; i++){
      const mid = (lo + hi) / 2;
      const fm = npvAndDeriv(mid)[0];
      if(Math.abs(fm) < 1e-8) return mid;
      if(flo * fm < 0){ hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Yield to Maturity — expects future-only cashflows, price = current MTM
  // ─────────────────────────────────────────────────────────────────────────
  function computeYTM(cashflows, price, asOfISO){
    if(!cashflows || !cashflows.length) return null;
    const asOf = asOfISO || new Date().toISOString().slice(0,10);
    const flows = cashflows.map(cf => ({
      t: yearFrac(asOf, cf.date),
      cf: cf.total != null ? cf.total : (cf.principal + cf.interest + cf.fees - (cf.drawdown||0))
    })).filter(f => f.t > 0);
    if(!flows.length) return null;
    return computeIRR(flows, price != null ? price : 0);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Yield to Call — same as YTM but truncated to next call/prepayment date
  // Uses the instrument's prepaymentPenaltySchedule to find next call
  // ─────────────────────────────────────────────────────────────────────────
  function computeYTC(cashflows, price, asOfISO, callDateISO, callPrice){
    if(!callDateISO || !cashflows || !cashflows.length) return null;
    const asOf = asOfISO || new Date().toISOString().slice(0,10);
    const truncated = cashflows
      .filter(cf => cf.date <= callDateISO)
      .map(cf => ({
        t: yearFrac(asOf, cf.date),
        cf: cf.total != null ? cf.total : (cf.principal + cf.interest + cf.fees - (cf.drawdown||0))
      }));
    // Add call payment on the call date
    const callT = yearFrac(asOf, callDateISO);
    if(callT > 0){
      const cp = callPrice != null ? callPrice : 1.0;
      // Assume callPrice is a fraction of remaining principal (e.g. 101% = 1.01)
      truncated.push({ t: callT, cf: cp });
    }
    return computeIRR(truncated.filter(f => f.t > 0), price != null ? price : 0);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Weighted Average Life — expected time for principal repayment
  //   WAL = Σ (t · principal_paydown) / Σ principal_paydown
  // ─────────────────────────────────────────────────────────────────────────
  function computeWAL(cashflows, asOfISO){
    if(!cashflows || !cashflows.length) return null;
    const asOf = asOfISO || new Date().toISOString().slice(0,10);
    let num = 0, denom = 0;
    for(const cf of cashflows){
      const p = +cf.principal || 0;
      if(p <= 0) continue;
      const t = yearFrac(asOf, cf.date);
      if(t <= 0) continue;
      num += t * p;
      denom += p;
    }
    return denom > 0 ? num / denom : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Macaulay + Modified Duration + DV01 + Convexity
  //   Macaulay = Σ (t · PV_cf) / Σ PV_cf
  //   Modified = Macaulay / (1 + y)
  //   DV01     = -Modified · PV · 0.0001
  //   Convexity= Σ (t² + t) · PV_cf / (PV · (1+y)²)
  // ─────────────────────────────────────────────────────────────────────────
  function computeDurationSuite(cashflows, ytm, asOfISO, faceValue){
    if(!cashflows || !cashflows.length || ytm == null) return {};
    const asOf = asOfISO || new Date().toISOString().slice(0,10);
    let pv = 0, wMac = 0, conv = 0;
    for(const cf of cashflows){
      const t = yearFrac(asOf, cf.date);
      if(t <= 0) continue;
      const c = cf.total != null ? cf.total : (cf.principal + cf.interest + cf.fees - (cf.drawdown||0));
      const disc = Math.pow(1 + ytm, t);
      const pvcf = c / disc;
      pv += pvcf;
      wMac += t * pvcf;
      conv += (t*t + t) * pvcf;
    }
    if(pv <= 0) return { presentValue: pv };
    const macaulay = wMac / pv;
    const modified = macaulay / (1 + ytm);
    const face = faceValue != null ? faceValue : pv;
    const dv01 = modified * face * 0.0001;   // $ per 1bp move (parallel shift)
    const convexity = conv / (pv * Math.pow(1 + ytm, 2));
    return { presentValue: pv, macaulayDuration: macaulay, modifiedDuration: modified, dv01, convexity };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Current coupon derivation from instrument
  // Returns the all-in coupon rate at as-of date (RFR + margin, or fixed)
  // ─────────────────────────────────────────────────────────────────────────
  // Current coupon — prefer the engine's `couponRate` on the latest schedule
  // row (source of truth: applied margin, RFR, ratchets, all baked in).
  // Falls back to inst.coupon (flat instrument shape from builderToInstrument)
  // or legacy tranche fields.
  function currentCoupon(inst, asOfISO, schedule){
    if(!inst) return null;
    const asOf = asOfISO || new Date().toISOString().slice(0,10);
    // Path 1 — schedule provides authoritative daily couponRate. Grab the
    // last row on/before asOf. Multiply by 100 to convert 0.0725 → 7.25%.
    if(Array.isArray(schedule) && schedule.length){
      let latest = null;
      for(const r of schedule){
        if(r.date && r.date <= asOf && r.couponRate) latest = r;
      }
      if(latest) return (+latest.couponRate || 0) * 100;
      // Fall through to inst if schedule has no couponRate populated
    }
    // Path 2 — flat instrument from builderToInstrument (inst.coupon + inst.rfr)
    if(inst.coupon){
      if(inst.coupon.type === 'Fixed'){
        return (+inst.coupon.fixedRate || 0) * 100;
      } else {
        const rfrRate = inst.rfr ? (+inst.rfr.baseRate || 0) : (+inst.coupon.floatingRate || 0);
        const spread = +inst.coupon.spread || 0;
        return (rfrRate + spread) * 100;
      }
    }
    // Path 3 — legacy: read marginBps/rfrIndex off tranches (rarely populated in our stack)
    const tranches = (inst.tranches && inst.tranches.length) ? inst.tranches : [inst];
    let numWeighted = 0, totalNotional = 0;
    for(const tr of tranches){
      const notional = +tr.notional || +tr.face || +inst.notional || +inst.faceValue || 0;
      if(notional <= 0) continue;
      const marginBps = +tr.marginBps || +inst.marginBps || 0;
      let couponPct = 0;
      if(tr.rfrIndex === 'FIXED' || inst.rfrIndex === 'FIXED'){
        couponPct = +(tr.fixedRate != null ? tr.fixedRate : inst.fixedRate) || (marginBps / 100);
      } else {
        const rfrIndex = tr.rfrIndex || inst.rfrIndex || 'SOFR';
        const rfrPct = rfrIndex === 'SOFR' ? 5.30 : rfrIndex === 'SONIA' ? 5.20 : 3.80;
        couponPct = rfrPct + (marginBps / 100);
      }
      numWeighted += couponPct * notional;
      totalNotional += notional;
    }
    return totalNotional > 0 ? numWeighted / totalNotional : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: deriveLoanMetrics — one-stop function for a single loan
  // ─────────────────────────────────────────────────────────────────────────
  function deriveLoanMetrics(inst, schedule, opts){
    opts = opts || {};
    if(!inst) return { error: 'no instrument' };
    const asOf = opts.asOf || new Date().toISOString().slice(0,10);
    const priceMTM = opts.price != null ? opts.price
                   : (inst.currentPrice != null ? +inst.currentPrice : null);
    // Notional resolution — accept multiple field aliases across shapes:
    //   Flat instrument (from builderToInstrument): inst.faceValue
    //   Legacy shape:                                inst.notional
    //   Tranches (Builder Def shape):                tranches[].face
    //   Tranches (legacy):                           tranches[].notional
    let notional = 0;
    if(inst.tranches && inst.tranches.length){
      notional = inst.tranches.reduce((s,t) => s + (+t.notional || +t.face || 0), 0);
    }
    if(notional <= 0){
      notional = +inst.faceValue || +inst.notional || +inst.commitment || 0;
    }
    // Face value used for DV01 sign — default to notional, or to price × notional if MTM given
    const face = priceMTM != null ? priceMTM * notional : notional;
    // 1. Cashflow stream
    const cashflows = extractCashflows(schedule, { asOf, futureOnly: true });
    if(!cashflows.length){
      return {
        asOf, notional, error: 'no future cashflows in schedule',
        coupon: currentCoupon(inst, asOf)
      };
    }
    // 2. YTM at par (price = notional) unless MTM given
    const priceForYield = priceMTM != null ? face : notional;
    const ytm = computeYTM(cashflows, priceForYield, asOf);
    // 3. WAL
    const wal = computeWAL(cashflows, asOf);
    // 4. Duration suite using derived YTM
    const dur = ytm != null ? computeDurationSuite(cashflows, ytm, asOf, notional) : {};
    // 5. Coupon + spread — pass the schedule so we can pull the engine's
    // authoritative couponRate rather than reconstruct from RFR + margin.
    const coupon = currentCoupon(inst, asOf, schedule);
    const benchmark = +opts.benchmarkRate || 4.50;  // configurable risk-free anchor (US 10Y default)
    const spread = (coupon != null) ? (coupon - benchmark) * 100 : null;   // bps
    // 6. Yield to Call — find next call date from prepaymentPenaltySchedule
    let ytc = null, nextCall = null;
    const pps = inst.prepaymentPenaltySchedule || (inst.tranches && inst.tranches[0] && inst.tranches[0].prepaymentPenaltySchedule) || [];
    const futureCalls = pps.filter(c => c.date > asOf).sort((a,b) => a.date < b.date ? -1 : 1);
    if(futureCalls.length){
      nextCall = futureCalls[0];
      // callPrice like 101% = 1.01 × remaining principal at call date
      const cp = (nextCall.penaltyBps != null) ? (1 + nextCall.penaltyBps/10000) : 1.0;
      ytc = computeYTC(cashflows, priceForYield, asOf, nextCall.date, cp * notional);
    }
    // 7. Yield to Worst
    const ytw = (ytm != null && ytc != null) ? Math.min(ytm, ytc) : (ytm != null ? ytm : ytc);
    return {
      asOf,
      notional,
      currentPrice: priceMTM,
      coupon:              round(coupon, 4),
      couponBps:           coupon != null ? Math.round(coupon * 100) : null,
      spreadOverBenchmark: round(spread, 1),
      benchmarkRate:       benchmark,
      ytm:                 round(ytm != null ? ytm * 100 : null, 4),
      ytc:                 round(ytc != null ? ytc * 100 : null, 4),
      ytw:                 round(ytw != null ? ytw * 100 : null, 4),
      nextCallDate:        nextCall ? nextCall.date : null,
      nextCallPenaltyBps:  nextCall ? nextCall.penaltyBps : null,
      wal:                 round(wal, 3),
      macaulayDuration:    round(dur.macaulayDuration, 3),
      modifiedDuration:    round(dur.modifiedDuration, 3),
      dv01:                round(dur.dv01, 2),
      convexity:           round(dur.convexity, 3),
      presentValue:        round(dur.presentValue, 2),
      cashflowCount:       cashflows.length,
      framework:           inst.accountingFramework || inst.framework,
      currency:            inst.currency,
      team:                inst.team,
      maturity:            inst.maturityDate || (inst.tranches && inst.tranches[0] && inst.tranches[0].maturityDate)
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Portfolio aggregation
  // ─────────────────────────────────────────────────────────────────────────
  // Consumes an array of { inst, metrics } and returns weighted-average
  // portfolio-level analytics + concentration slices.
  function aggregatePortfolio(loans, opts){
    opts = opts || {};
    if(!Array.isArray(loans) || !loans.length){
      return { count: 0, totalNotional: 0, activeCount: 0, maturedCount: 0, weightedAvg: {}, concentration: {}, maturityLadder: [] };
    }
    let totalNotional = 0, totalPV = 0, totalDV01 = 0;
    let ytmNum = 0, walNum = 0, durNum = 0, weightSum = 0;
    let maturedCount = 0, unknownCount = 0;
    const byFramework = {}, byCurrency = {}, byTeam = {}, byStage = {};
    // Include Matured and Unknown as first-class buckets so matured / missing-
    // date loans don't get miscounted as "0-1Y".
    const maturityBuckets = { 'Matured':0, '0-1Y':0, '1-2Y':0, '2-3Y':0, '3-5Y':0, '5-7Y':0, '7-10Y':0, '10Y+':0, 'N/A':0 };
    const asOf = opts.asOf || new Date().toISOString().slice(0,10);
    for(const l of loans){
      const m = l.metrics || {};
      const w = +m.notional || 0;
      if(w <= 0) continue;
      totalNotional += w;
      // Concentrations always apply (matured deals still contribute to team/framework mix)
      const fw = m.framework || 'IFRS';   const cur = m.currency || 'USD';
      const tm = m.team || 'Unassigned';  const st = (l.inst && (l.inst.eclStage || 'Stage1')) || 'Stage1';
      byFramework[fw] = (byFramework[fw] || 0) + w;
      byCurrency[cur] = (byCurrency[cur] || 0) + w;
      byTeam[tm]      = (byTeam[tm]     || 0) + w;
      byStage[st]     = (byStage[st]    || 0) + w;
      // Maturity bucket — separate past / unknown from forward buckets
      if(!m.maturity){
        maturityBuckets['N/A'] += w;
        unknownCount++;
        continue;   // no forward metrics to aggregate either
      }
      const years = yearFrac(asOf, m.maturity);
      if(years < 0){
        maturityBuckets['Matured'] += w;
        maturedCount++;
        continue;   // don't feed matured loans into weighted-avg YTM/WAL/duration
      }
      const bucket = years <= 1 ? '0-1Y' : years <= 2 ? '1-2Y' : years <= 3 ? '2-3Y'
                   : years <= 5 ? '3-5Y' : years <= 7 ? '5-7Y' : years <= 10 ? '7-10Y' : '10Y+';
      maturityBuckets[bucket] += w;
      // Forward-looking averages only for active loans with valid metrics
      totalPV   += (+m.presentValue || 0);
      totalDV01 += (+m.dv01 || 0);
      if(m.ytm != null){ ytmNum += m.ytm * w; weightSum += w; }
      if(m.wal != null) walNum += m.wal * w;
      if(m.modifiedDuration != null) durNum += m.modifiedDuration * w;
    }
    // For weighted averages, denominator is ACTIVE notional (excludes matured/unknown)
    const activeNotional = totalNotional - maturityBuckets['Matured'] - maturityBuckets['N/A'];
    return {
      asOf,
      count: loans.length,
      activeCount: loans.length - maturedCount - unknownCount,
      maturedCount, unknownCount,
      totalNotional: round(totalNotional, 2),
      activeNotional: round(activeNotional, 2),
      totalPresentValue: round(totalPV, 2),
      totalDV01: round(totalDV01, 2),
      // Weighted averages are over ACTIVE notional only (matured/unknown excluded)
      weightedAvg: {
        ytm:              (weightSum > 0 && activeNotional > 0) ? round(ytmNum / activeNotional, 4) : null,
        wal:              activeNotional > 0 ? round(walNum / activeNotional, 3) : null,
        modifiedDuration: activeNotional > 0 ? round(durNum / activeNotional, 3) : null
      },
      concentration: {
        byFramework: normalizePct(byFramework, totalNotional),
        byCurrency:  normalizePct(byCurrency,  totalNotional),
        byTeam:      normalizePct(byTeam,      totalNotional),
        byStage:     normalizePct(byStage,     totalNotional)
      },
      maturityLadder: Object.entries(maturityBuckets).map(([bucket, amt]) => ({
        bucket, amount: round(amt, 2), pct: totalNotional > 0 ? round(amt / totalNotional * 100, 1) : 0
      }))
    };
  }
  function normalizePct(map, total){
    return Object.entries(map)
      .map(([k, v]) => ({ label: k, amount: round(v, 2), pct: total > 0 ? round(v / total * 100, 1) : 0 }))
      .sort((a,b) => b.amount - a.amount);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Notice Derivation (Tier 1 #3)
  // ─────────────────────────────────────────────────────────────────────────
  // Walks the engine's daily schedule and synthesizes the expected loan-agent
  // notices for the loan: drawdown, interest, principal, rate reset, fees.
  //
  // Returns an array of notice objects ready to upsert into `loan_notices`.
  //
  // Design decisions:
  //   • Interest notices — one per COUPON PAYMENT DATE (aggregate the daily
  //     accruals since the last payment). If the schedule doesn't emit explicit
  //     payment dates, fall back to month-end.
  //   • Drawdown notices — one per DAY with draw > 0
  //   • Principal notices — one per DAY with paydown > 0 or prepayment > 0
  //   • Rate reset notices — one per DAY where couponRate changed vs prior day
  //   • Fee notices — aggregate weekly to avoid spam; one per week with
  //     dailyFees > 0
  function deriveNotices(inst, schedule, opts){
    opts = opts || {};
    if(!inst || !Array.isArray(schedule) || !schedule.length) return [];
    const dealId    = opts.dealId    || inst._dbDealId || inst.id;
    const currency  = inst.currency   || 'USD';
    const trancheId = opts.trancheId || null;   // null → deal-level (multi-tranche aggregated)
    const notices = [];
    const round2 = (n) => Math.round((+n || 0) * 100) / 100;

    // Buffers for period-aggregation (interest, fees)
    let interestAccrual = 0;   let interestPeriodStart = null;
    let feesAccrual = 0;       let feesPeriodStart = null;
    let lastCouponRate = null;

    // Coupon payment dates — derived from the deal's coupon frequency so the
    // notice cadence matches what the engine's splitInterestJEsByCouponPeriod
    // emits. Falls back to month-end if no frequency is available.
    const freqToMonths = { monthly:1, quarterly:3, 'semi-annual':6, semi:6, semiannual:6, annual:12, yearly:12 };
    const tenorToMonths = (t) => {
      if(!t) return null;
      const m = String(t).toUpperCase().match(/^(\d+)([MY])$/);
      if(!m) return null;
      return m[2] === 'Y' ? +m[1] * 12 : +m[1];
    };
    const periodMonths =
      freqToMonths[(inst.couponFrequency || '').toLowerCase()] ||
      tenorToMonths(inst.tranches && inst.tranches[0] && inst.tranches[0].interestComponents &&
                    inst.tranches[0].interestComponents[0] && inst.tranches[0].interestComponents[0].terms &&
                    inst.tranches[0].interestComponents[0].terms[0] && inst.tranches[0].interestComponents[0].terms[0].tenor) ||
      tenorToMonths(inst.rfr && inst.rfr.tenor) ||
      3;   // quarterly default
    const settleISO   = inst.settlementDate || schedule[0].date;
    const maturityISO = inst.maturityDate || schedule[schedule.length - 1].date;
    const couponPaymentDates = new Set();
    if(settleISO && maturityISO){
      const start = new Date(settleISO + 'T00:00:00Z');
      const mat   = new Date(maturityISO + 'T00:00:00Z');
      let cursor = new Date(start);
      cursor.setUTCMonth(cursor.getUTCMonth() + periodMonths);
      while(cursor <= mat){
        couponPaymentDates.add(cursor.toISOString().slice(0,10));
        cursor = new Date(cursor);
        cursor.setUTCMonth(cursor.getUTCMonth() + periodMonths);
      }
      // Also include maturity as a final coupon date if not already
      couponPaymentDates.add(maturityISO);
    }
    function isCouponDate(dateISO){ return couponPaymentDates.has(dateISO); }
    // Fallback: if no coupon dates could be derived, dump on month-end
    function isMonthEnd(dateISO){
      if(!dateISO) return false;
      const d = new Date(dateISO); const next = new Date(d); next.setUTCDate(d.getUTCDate() + 1);
      return next.getUTCMonth() !== d.getUTCMonth();
    }

    for(let i = 0; i < schedule.length; i++){
      const r = schedule[i];
      const date = r.date;
      if(!date) continue;

      // Drawdown notice — cash out from the investor
      const draw = +r.draw || 0;
      if(draw > 0.01){
        notices.push({
          deal_id: dealId, tranche_id: trancheId, notice_type: 'drawdown',
          notice_date: date, effective_date: date,
          amount: round2(draw), currency,
          reference: 'DRW-' + date.replace(/-/g,''),
          breakdown: { source: 'schedule', dailyRow: i }
        });
      }

      // Principal notices — scheduled paydown (repayment) vs prepayment
      const paydown  = +r.paydown    || 0;
      const prepay   = +r.prepayment || 0;
      const penalty  = +r.prepayPenalty || 0;
      if(paydown > 0.01){
        notices.push({
          deal_id: dealId, tranche_id: trancheId, notice_type: 'repayment',
          notice_date: date, effective_date: date,
          amount: round2(paydown), currency,
          reference: 'RPY-' + date.replace(/-/g,''),
          breakdown: { source: 'schedule', kind: 'scheduled', dailyRow: i }
        });
      }
      if(prepay > 0.01){
        notices.push({
          deal_id: dealId, tranche_id: trancheId, notice_type: 'prepayment',
          notice_date: date, effective_date: date,
          amount: round2(prepay + penalty), currency,
          reference: 'PRE-' + date.replace(/-/g,''),
          breakdown: { source: 'schedule', principal: round2(prepay), penalty: round2(penalty) }
        });
      }

      // Interest — accrue daily, dump on coupon payment date or month-end
      const dailyInterest = +r.dailyCash || 0;
      if(dailyInterest > 0.005){
        if(interestPeriodStart == null) interestPeriodStart = date;
        interestAccrual += dailyInterest;
      }
      // Explicit payment date signal from engine (cashInterestPayment on that day > 0)
      const isPaymentDay = (+r.cashInterestPayment || 0) > 0.005;
      // Dump on: explicit payment day, paydown/prepay day (interest catches up on early close),
      // COUPON payment date (aligned with engine's per-period JEs), or last row of schedule.
      // Only falls back to month-end when no coupon dates were derivable — this keeps
      // the notice cadence in sync with what the engine's splitter emits per period.
      const useCouponDates = couponPaymentDates.size > 0;
      const shouldDumpInterest =
        interestAccrual > 0.005 &&
        (isPaymentDay || paydown > 0.01 || prepay > 0.01 ||
         (useCouponDates ? isCouponDate(date) : isMonthEnd(date)) ||
         i === schedule.length - 1);
      if(shouldDumpInterest){
        notices.push({
          deal_id: dealId, tranche_id: trancheId, notice_type: 'interest',
          notice_date: date, effective_date: date,
          amount: round2(interestAccrual), currency,
          rate: r.couponRate || null,
          reference: 'INT-' + date.replace(/-/g,''),
          breakdown: {
            source: 'schedule',
            period_start: interestPeriodStart,
            period_end: date,
            coupon_rate: r.couponRate,
            balance: r.balance
          }
        });
        interestAccrual = 0;
        interestPeriodStart = null;
      }

      // Rate reset — new couponRate vs previous row
      if(r.couponRate != null && lastCouponRate != null && Math.abs(r.couponRate - lastCouponRate) > 1e-6){
        notices.push({
          deal_id: dealId, tranche_id: trancheId, notice_type: 'rate_reset',
          notice_date: date, effective_date: date,
          amount: null, currency,
          rate: r.couponRate,
          reference: 'RST-' + date.replace(/-/g,''),
          breakdown: { source: 'schedule', prev_rate: lastCouponRate, new_rate: r.couponRate }
        });
      }
      lastCouponRate = r.couponRate != null ? r.couponRate : lastCouponRate;

      // Fee notices — DISABLED for auto-derivation.
      //
      // Rationale: under IFRS 9 §B5.4 / ASC 310-20-25, arrangement/origination
      // fees are AMORTIZED into interest income via EIR — they don't produce
      // separate fee JEs. The engine's `dailyFees` field captures theoretical
      // fee amortization for reporting, but no cash-side JE is booked (it's
      // baked into the coupon).
      //
      // Only cash-per-period fees (commitment fee, servicing fee, agency fee)
      // warrant a notice, and identifying those requires per-fee treatment
      // metadata (fee.treatment === 'straight-line' cash vs 'EIR' amortize).
      // For now: skip fee auto-derivation. Users can add cash fee notices via
      // the Manual Notice form (waiver/amendment path).
      //
      // Feeds still accrue for schedule visibility, just no notice emission.
      // TODO Phase 2: read inst.fees[].treatment and emit notices only for
      // fees where treatment === 'straight-line' or 'cash-per-period'.
    }
    return notices;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Watchlist / Early-Warning (Tier 1 #5)
  // ═════════════════════════════════════════════════════════════════════════
  //
  // Aggregates every red-flag signal we already compute elsewhere into a single
  // per-deal scorecard. This is the "one screen to check each morning" view
  // that PMs use to decide which deals need attention today.
  //
  // Data sources (all already flowing through the app):
  //   • deal.inst.covenants[]              — breach + headroom
  //   • deal.inst.covenants[].breachLog[]  — active breaches + consequences
  //   • deal.inst.eclStage                 — 2 = SICR, 3 = credit-impaired
  //   • deal.inst.maturityDate             — approaching maturity
  //   • notices[]                          — overdue / unreconciled / mismatched
  //   • deal.inst.tranches[].defaultInterest — default interest active
  //
  // Signal severities (drives sort order + colour badge):
  //   • critical → red    (score 100) — needs action THIS WEEK
  //   • warning  → amber  (score  40) — watch, may escalate
  //   • info     → blue   (score  10) — FYI, no action needed
  //
  // Scoring is additive so a deal with 3 warnings still ranks above a deal
  // with 1 warning, but any critical signal pushes it above pure-warning peers.
  //
  //   const watchlist = LMA.computeWatchlist({
  //     deals: [{ key, name, inst }, ...],
  //     notices: [ ... ],  // from SB.fetchNotices()
  //     asOf: '2026-07-19'
  //   });
  //   → [{ dealKey, name, score, severity, signals: [{type,label,severity,detail}], ... }]
  //     sorted by score DESC
  //
  function computeWatchlist(opts){
    opts = opts || {};
    const deals   = Array.isArray(opts.deals)   ? opts.deals   : [];
    const notices = Array.isArray(opts.notices) ? opts.notices : [];
    const asOf    = opts.asOf || new Date().toISOString().slice(0,10);
    const proximityPct = +opts.proximityPct || 0.20;   // <20% headroom = warning
    const maturityWarnDays = +opts.maturityWarnDays || 90;
    const maturityCritDays = +opts.maturityCritDays || 30;

    const SEV_SCORE = { critical: 100, warning: 40, info: 10 };
    const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

    // Bucket notices by deal_id once (avoids O(deals × notices))
    const noticesByDeal = new Map();
    for(const n of notices){
      const k = n.deal_id || n.dealId; if(!k) continue;
      if(!noticesByDeal.has(k)) noticesByDeal.set(k, []);
      noticesByDeal.get(k).push(n);
    }

    const rows = [];
    for(const d of deals){
      const inst = d.inst || d;
      const dealKey = d.key || d.dealKey || inst.dealCode || inst.instrumentId;
      const dealName = d.name || inst.name || inst.dealName || dealKey;
      const signals = [];

      // ── 1. Covenant breaches (active, not cured) — CRITICAL
      const covenants = Array.isArray(inst.covenants) ? inst.covenants : [];
      for(const c of covenants){
        const active = (c.breachLog || []).filter(b =>
          (b.status || '').toLowerCase() !== 'cured' &&
          (b.status || '').toLowerCase() !== 'waived'
        );
        if(active.length){
          const latest = active[0]; // breachLog already sorted DESC by breachDate
          const consequences = (latest.consequenceApplied || []).join(', ') || 'none';
          signals.push({
            type: 'covenant_breach',
            severity: 'critical',
            label: 'Covenant breached: ' + (c.name || c.kpiMetric || 'unnamed'),
            detail: 'Breach date ' + latest.breachDate +
                    ' · value ' + latest.breachValue +
                    ' vs threshold ' + latest.thresholdAtBreach +
                    ' · consequences: ' + consequences
          });
        } else if(c.lastReportedValue != null && c.threshold != null){
          // Proximity check — only meaningful when we have a fresh reading
          const val = +c.lastReportedValue, thr = +c.threshold;
          if(thr !== 0){
            const dir = (c.direction || 'gte').toLowerCase();
            // Headroom as fraction of threshold. For >= covenants (min ratio),
            // headroom = (val - thr) / thr. For <= covenants (max ratio), it's
            // flipped: (thr - val) / thr.
            let headroom = null;
            if(dir === 'gte' || dir === 'min' || dir === '>=' || dir === '>'){
              headroom = (val - thr) / Math.abs(thr);
            } else if(dir === 'lte' || dir === 'max' || dir === '<=' || dir === '<'){
              headroom = (thr - val) / Math.abs(thr);
            }
            if(headroom != null && headroom < proximityPct && headroom >= 0){
              signals.push({
                type: 'covenant_proximity',
                severity: 'warning',
                label: 'Covenant proximity: ' + (c.name || c.kpiMetric),
                detail: 'Headroom ' + (headroom * 100).toFixed(1) + '% (value ' + val +
                        ' vs threshold ' + thr + ')'
              });
            }
          }
        }
      }

      // ── 2. ECL Stage drift — Stage 2 = warning, Stage 3 = critical
      const stage = String(inst.eclStage || '1').toLowerCase().replace('stage','').trim();
      if(stage === '3' || stage === 'poci'){
        signals.push({
          type: 'ecl_stage3',
          severity: 'critical',
          label: 'ECL Stage 3 (credit-impaired)',
          detail: 'Lifetime ECL on gross basis · net interest accrual on carrying amount'
        });
      } else if(stage === '2'){
        signals.push({
          type: 'ecl_stage2',
          severity: 'warning',
          label: 'ECL Stage 2 (SICR)',
          detail: 'Significant increase in credit risk since initial recognition'
        });
      }

      // ── 3. Approaching maturity — 30 days = critical, 90 days = warning
      const maturity = inst.maturityDate || (inst.tranches && inst.tranches[0] && inst.tranches[0].maturityDate);
      if(maturity){
        const dtm = daysBetween(asOf, maturity);
        if(dtm >= 0 && dtm <= maturityCritDays){
          signals.push({
            type: 'maturity_critical',
            severity: 'critical',
            label: 'Maturity in ' + dtm + ' days',
            detail: 'Matures ' + maturity + ' — refinancing / rollover decision required'
          });
        } else if(dtm > maturityCritDays && dtm <= maturityWarnDays){
          signals.push({
            type: 'maturity_warning',
            severity: 'warning',
            label: 'Maturity in ' + dtm + ' days',
            detail: 'Matures ' + maturity
          });
        }
      }

      // ── 4. Overdue notices (past effective_date, still Draft/Pending) — WARNING
      const dn = noticesByDeal.get(dealKey) || noticesByDeal.get(inst.instrumentId) || [];
      const overdue = dn.filter(n =>
        n.effective_date && n.effective_date < asOf &&
        (n.status || 'draft').toLowerCase() !== 'sent' &&
        (n.status || 'draft').toLowerCase() !== 'acknowledged'
      );
      if(overdue.length){
        signals.push({
          type: 'overdue_notices',
          severity: 'warning',
          label: overdue.length + ' overdue notice' + (overdue.length===1?'':'s'),
          detail: overdue.slice(0,3).map(n =>
            (n.notice_type || 'notice') + ' · due ' + n.effective_date
          ).join('; ') + (overdue.length>3 ? ' … +'+(overdue.length-3)+' more' : '')
        });
      }

      // ── 5. Default interest active (from tranche flag or breach consequence)
      const trs = inst.tranches || [];
      const dfltActive = trs.some(t => t.defaultInterestActive === true || t.defaultInterest === true);
      if(dfltActive){
        signals.push({
          type: 'default_interest',
          severity: 'critical',
          label: 'Default interest active',
          detail: 'Penalty margin currently applied per credit agreement'
        });
      }

      // ── 6. Mandatory prepayment recently triggered (from breachLog)
      const mandPre = covenants.flatMap(c => (c.breachLog || []))
        .filter(b => b.prepaymentTriggered === true &&
                     (b.status || '').toLowerCase() !== 'cured');
      if(mandPre.length){
        const total = mandPre.reduce((s,b) => s + (+b.prepaymentEventAmount || 0), 0);
        signals.push({
          type: 'mandatory_prepay',
          severity: 'warning',
          label: 'Mandatory prepayment triggered',
          detail: mandPre.length + ' event' + (mandPre.length===1?'':'s') +
                  ' · total ' + total.toLocaleString(undefined,{maximumFractionDigits:0})
        });
      }

      // ── Score + top severity
      const score = signals.reduce((s, x) => s + (SEV_SCORE[x.severity] || 0), 0);
      const severity = signals.some(x => x.severity === 'critical') ? 'critical'
                     : signals.some(x => x.severity === 'warning')  ? 'warning'
                     : signals.length ? 'info' : 'clear';

      rows.push({
        dealKey, name: dealName, currency: inst.currency, framework: inst.accountingFramework,
        team: (d.team || inst.team),
        score, severity, signalCount: signals.length, signals,
        maturityDate: maturity, eclStage: stage
      });
    }

    rows.sort((a,b) => b.score - a.score || a.name.localeCompare(b.name));

    // Roll-up KPIs
    const kpi = {
      total:    rows.length,
      critical: rows.filter(r => r.severity === 'critical').length,
      warning:  rows.filter(r => r.severity === 'warning').length,
      info:     rows.filter(r => r.severity === 'info').length,
      clear:    rows.filter(r => r.severity === 'clear').length,
      asOf
    };
    return { rows, kpi };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────
  const LMA = {
    yearFrac, extractCashflows, computeIRR,
    computeYTM, computeYTC, computeWAL, computeDurationSuite, currentCoupon,
    deriveLoanMetrics, aggregatePortfolio,
    deriveNotices,
    computeWatchlist,
    version: '1.2.0'
  };
  if(typeof module !== 'undefined' && module.exports) module.exports = LMA;
  global.LMA = LMA;
})(typeof window !== 'undefined' ? window : globalThis);
