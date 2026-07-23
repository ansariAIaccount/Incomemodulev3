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
          continue;
        }

        // ── Value resolution — three tiers ───────────────────────
        // 1. c.lastReportedValue — ops-updated value from the QS or
        //    financial statement (works for any KPI).
        // 2. covenantKpiValue(kpi, kpis, deal, c) — mechanically
        //    derived value for construction ratios (LVR / LTC / RLVR)
        //    from the deal's own reference fields. This is why the
        //    Watchlist can flag a construction-covenant breach the
        //    moment the deal is saved, before any manual reporting.
        // 3. Fall back to null — nothing to test.
        let val = (c.lastReportedValue != null) ? +c.lastReportedValue : null;
        if(val == null && typeof covenantKpiValue === 'function'){
          const derived = covenantKpiValue(c.kpiMetric, inst.financialKpis || null, inst, c);
          if(derived != null) val = +derived;
        }
        if(val == null || c.threshold == null) continue;

        const thr = +c.threshold;
        const dir = (c.direction || 'gte').toLowerCase();
        const isMax = (dir === 'lte' || dir === 'max' || dir === '<=' || dir === '<');
        const isMin = (dir === 'gte' || dir === 'min' || dir === '>=' || dir === '>');
        const breached = isMax ? val > thr : (isMin ? val < thr : false);

        if(breached){
          // Live breach detected from a derived / reported value — no
          // active breachLog entry yet (ops hasn't confirmed), but the
          // math says the deal is over the line. Flag as critical so
          // the risk team catches it before month-end reporting.
          signals.push({
            type: 'covenant_breach',
            severity: 'critical',
            label: 'Covenant breached: ' + (c.name || c.kpiMetric || 'unnamed'),
            detail: 'Live value ' + (typeof val === 'number' ? val.toFixed(2) : val) +
                    ' ' + (isMax ? '>' : '<') + ' threshold ' + thr +
                    ' · derived from deal fields, awaiting ops confirmation'
          });
        } else if(thr !== 0){
          // Proximity check — headroom as fraction of threshold.
          const headroom = isMin ? (val - thr) / Math.abs(thr)
                        :  isMax ? (thr - val) / Math.abs(thr)
                        :  null;
          if(headroom != null && headroom < proximityPct && headroom >= 0){
            signals.push({
              type: 'covenant_proximity',
              severity: 'warning',
              label: 'Covenant proximity: ' + (c.name || c.kpiMetric),
              detail: 'Headroom ' + (headroom * 100).toFixed(1) + '% (value ' +
                      (typeof val === 'number' ? val.toFixed(2) : val) +
                      ' vs threshold ' + thr + ')'
            });
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

  // ═════════════════════════════════════════════════════════════════════════
  // Regulatory Reports — Preview (Tier 1 #4)
  // ═════════════════════════════════════════════════════════════════════════
  //
  // Preview-quality regulator dashboards from data we already have:
  //   • Form PF (SEC)           — US private-fund adviser filing
  //   • AIFMD Annex IV (EU)     — EU alternative investment fund manager report
  //   • FR Y-14Q Schedule H.1   — Fed bank stress-test corporate loan schedule
  //   • N-PORT (SEC)            — Registered fund quarterly holdings
  //
  // Preview scope: we produce the KEY sections of each report as tables, not
  // the full regulator XML/XBRL/XLSX schema. Numbers are computed from the
  // loan book; ratings/PD are approximated from ECL stage (labelled as such
  // in the UI). Real submission still needs human review + regulator schema
  // conversion — this preview replaces the "which loans have I missed?"
  // scoping step of prep, not the final filing.
  //
  //   const rpt = LMA.computeRegulatoryReports({
  //     loans: [{ inst, metrics }, ...],   // same shape aggregatePortfolio takes
  //     deals: [{ key, name, inst }, ...], // for name/covenants pass-through
  //     notices: [ ... ],                  // for covenant / event flags
  //     asOf: '2026-07-19',
  //     fundNAV: 1_000_000_000             // optional; falls back to activeNotional
  //   });
  //   → { formPF, aifmd, y14q, nport, meta }
  //
  function computeRegulatoryReports(opts){
    opts = opts || {};
    const loans   = Array.isArray(opts.loans)   ? opts.loans   : [];
    const deals   = Array.isArray(opts.deals)   ? opts.deals   : [];
    const notices = Array.isArray(opts.notices) ? opts.notices : [];
    const asOf    = opts.asOf || new Date().toISOString().slice(0,10);
    // Pre-build (or reuse) the portfolio aggregate — many report sections
    // reproject its concentration output.
    const agg     = opts.agg || aggregatePortfolio(loans, { asOf });
    const fundNAV = +opts.fundNAV || agg.activeNotional || agg.totalNotional || 0;

    // Framework filters per report. Fallback path when a deal has NO fund
    // allocations attached — we approximate scope from accounting framework.
    // Defaults reflect the most-common pairing (Form PF → US → USGAAP;
    // AIFMD → EU → IFRS). Users can override per-tab in the UI.
    const DEFAULT_FRAMEWORK_FILTERS = {
      formPF: ['USGAAP','ASPE'],
      aifmd:  ['IFRS','IFRS9'],
      y14q:   ['USGAAP','ASPE'],
      nport:  ['USGAAP','ASPE']
    };
    const filters = Object.assign({}, DEFAULT_FRAMEWORK_FILTERS, opts.frameworkFilters || {});
    // Report-key → primary regulator code that MUST be in a fund's scope
    // for the deal to be included in that report. Preferred filter when
    // fund allocations exist (proper regulator scoping); falls back to
    // framework filter when not.
    const REGULATOR_BY_REPORT = {
      formPF: 'SEC',
      aifmd:  'ESMA',
      y14q:   'Fed',
      nport:  'SEC'
    };
    // Empty array means "no filter — include all frameworks"
    const framePasses = (fw, key) => {
      const allowed = filters[key];
      if(!Array.isArray(allowed) || allowed.length === 0) return true;
      return allowed.some(a => (a || '').toUpperCase() === (fw || '').toUpperCase());
    };
    // Fund-scope filter: does ANY of this deal's fund allocations file with
    // the target regulator? Returns null (=fall back to framework) when the
    // deal has no allocations attached.
    const scopePasses = (allocations, key) => {
      if(!Array.isArray(allocations) || !allocations.length) return null;
      const required = REGULATOR_BY_REPORT[key];
      if(!required) return true;
      return allocations.some(a =>
        a && a.fund && Array.isArray(a.fund.regulatorScope) &&
        a.fund.regulatorScope.includes(required)
      );
    };

    // Helper: PD/LGD estimation from ECL stage — Y-14Q requires them, but we
    // don't run a full IRB model. Approximates for preview only; flagged as
    // such in the UI. Numbers are illustrative Basel-style buckets.
    const stagePD = { 1: 0.01,  2: 0.05,  3: 0.50, poci: 0.50 };
    const stageLGD = { 1: 0.40, 2: 0.45, 3: 0.60, poci: 0.60 };
    const normStage = (s) => String(s || '1').toLowerCase().replace('stage','').trim();

    // Roll-up deal-level view combining inst + metrics + name for report rows
    const byKey = new Map();
    for(const d of deals){
      const k = d.key || d.dealKey || (d.inst && (d.inst.dealCode || d.inst.instrumentId));
      if(k) byKey.set(k, d);
    }
    const facilities = loans.map(l => {
      const inst = l.inst || {};
      const m = l.metrics || {};
      // Key resolution — builderToInstrument sets inst.id (from B.deal.dealId)
      // and NOT dealCode/instrumentId. Widen the fallback so DB-saved deals
      // resolve back into the byKey lookup.
      const key = inst.dealCode || inst.instrumentId || inst.id || inst.transactionId;
      const d = byKey.get(key) || {};
      const st = normStage(inst.eclStage);
      const commitment = +inst.commitment || +inst.faceValue || +m.notional || 0;
      const drawn = +m.notional || +inst.faceValue || 0;
      const covenantBreached = Array.isArray(inst.covenants) && inst.covenants.some(c =>
        Array.isArray(c.breachLog) && c.breachLog.some(b =>
          !['cured','waived'].includes((b.status || '').toLowerCase()))
      );
      // Fund allocations — carried through so scope filters can use real
      // regulator scope. Read from inst.fundAllocations (mirrored by the
      // Builder→Instrument converter) or the deal wrapper.
      const fundAllocations = Array.isArray(inst.fundAllocations) ? inst.fundAllocations
        : Array.isArray(d.fundAllocations) ? d.fundAllocations : [];
      // Name resolution — Builder Def uses `def.deal.name`; builderToInstrument
      // flattens that to `inst.deal` (a string). Also honour `inst.dealName`
      // for the older shape.
      const resolvedName = d.name || inst.dealName || inst.deal || inst.name || key;
      return {
        key, name: resolvedName,
        fundAllocations,
        borrower:   inst.borrower || resolvedName,
        industry:   inst.industry || inst.sector || 'Unclassified',
        geography:  inst.country  || inst.jurisdiction || (inst.currency === 'EUR' ? 'EMEA' : inst.currency === 'GBP' ? 'UK' : 'US'),
        currency:   inst.currency || 'USD',
        framework:  inst.accountingFramework || 'IFRS',
        commitment, drawn,
        utilization: commitment > 0 ? drawn / commitment : null,
        coupon:     m.coupon,
        maturity:   m.maturity || inst.maturityDate,
        wal:        m.wal,
        pd:         stagePD[st]  || 0.02,
        lgd:        stageLGD[st] || 0.40,
        ead:        drawn + (commitment - drawn) * 0.75,   // Basel CCF 75% on undrawn
        eclStage:   st,
        covenantBreached,
        secured:    inst.secured !== false,
        seniority:  inst.seniority || 'Senior Secured',
        rateType:   (inst.rateType || (inst.floatingRate ? 'Float' : 'Fixed')),
        // For AIFMD principal-exposure lookup: convert to USD-equivalent via
        // deal.metrics if FX ingest is populated, else 1:1
        usdEquiv:   drawn
      };
    }).filter(f => f.commitment > 0 || f.drawn > 0);

    // ── Concentration helpers used by multiple reports
    const groupBy = (rows, keyFn, valueFn) => {
      const m = new Map();
      for(const r of rows){
        const k = keyFn(r) || 'Unclassified';
        const v = valueFn(r);
        m.set(k, (m.get(k) || 0) + v);
      }
      const total = Array.from(m.values()).reduce((s,x) => s+x, 0);
      return Array.from(m.entries())
        .map(([label, amount]) => ({ label, amount, pct: total > 0 ? amount/total*100 : 0 }))
        .sort((a,b) => b.amount - a.amount);
    };
    const topN = (arr, n) => arr.slice(0, n);
    const covenantBreachCount = facilities.filter(f => f.covenantBreached).length;
    const wtdAvg = (rows, valueFn, weightFn) => {
      let num = 0, den = 0;
      for(const r of rows){ const w = weightFn(r); const v = valueFn(r);
        if(v == null || !isFinite(v)) continue; num += v*w; den += w; }
      return den > 0 ? num/den : null;
    };

    // Deals dropped by each report's scope filter — surfaced in meta so the
    // UI can show "8 of 12 deals in scope; 4 excluded". Uses a two-tier logic:
    //   Tier 1 (preferred): fund_allocations.fund.regulator_scope contains
    //                       the target regulator (e.g. SEC for Form PF)
    //   Tier 2 (fallback):  framework matches DEFAULT_FRAMEWORK_FILTERS
    // When a deal has no fund allocations, Tier 1 returns null and we fall
    // through to Tier 2 (the framework filter).
    const scopedFacilities = (key) => {
      let scopedByFund = 0, scopedByFramework = 0;
      const inScope = [], excluded = [];
      // Deal-level scope report — { name, framework, scopedVia, funds[], reason }
      // Used by the UI to render "which deals are in / out and why".
      const inScopeDeals = [], excludedDeals = [];
      for(const f of facilities){
        const fundVerdict = scopePasses(f.fundAllocations, key);
        let inside, scopedVia, reason;
        if(fundVerdict !== null){
          inside = fundVerdict;
          scopedVia = 'fund';
          if(inside){
            scopedByFund++;
            // Which funds put this deal into scope? Show the codes.
            const hitFunds = (f.fundAllocations || []).filter(a =>
              a && a.fund && Array.isArray(a.fund.regulatorScope) &&
              a.fund.regulatorScope.includes(REGULATOR_BY_REPORT[key])
            ).map(a => a.fund.code || 'Unknown fund');
            reason = 'Allocated to ' + hitFunds.join(', ') + ' (fund scope includes ' + REGULATOR_BY_REPORT[key] + ')';
          } else {
            const funds = (f.fundAllocations || []).map(a => a.fund && a.fund.code || '?').join(', ');
            reason = 'Allocated only to ' + funds + ' — none includes ' + REGULATOR_BY_REPORT[key];
          }
        } else {
          inside = framePasses(f.framework, key);
          scopedVia = 'framework';
          if(inside){
            scopedByFramework++;
            reason = 'No fund allocation — framework ' + f.framework + ' passes the ' + key + ' filter';
          } else {
            reason = 'No fund allocation — framework ' + f.framework + ' not in ' + (filters[key] || []).join('/');
          }
        }
        const dealEntry = {
          name: f.name || f.borrower, framework: f.framework, drawn: f.drawn,
          scopedVia, reason,
          fundCodes: (f.fundAllocations || []).map(a => a.fund && a.fund.code).filter(Boolean)
        };
        if(inside){ inScope.push(f); inScopeDeals.push(dealEntry); }
        else { excluded.push(f); excludedDeals.push(dealEntry); }
      }
      const excludedByFw = {};
      for(const f of excluded){ excludedByFw[f.framework] = (excludedByFw[f.framework]||0) + 1; }
      return { inScope, excluded, excludedByFw, scopedByFund, scopedByFramework, inScopeDeals, excludedDeals };
    };

    // ═════════════════════════════════════════════════════════════════════
    // Form PF — US SEC (17 CFR 275.204(b)-1)
    // ═════════════════════════════════════════════════════════════════════
    const pfScope = scopedFacilities('formPF');
    const pfFacilities = pfScope.inScope;
    const byBorrower = groupBy(pfFacilities, f => f.borrower, f => f.drawn);
    const byIndustry = groupBy(pfFacilities, f => f.industry, f => f.drawn);
    const byGeo      = groupBy(pfFacilities, f => f.geography, f => f.drawn);
    const byFramework_pf = groupBy(pfFacilities, f => f.framework, f => f.drawn);
    const top5Pct    = topN(byBorrower, 5).reduce((s,x) => s+x.pct, 0);
    const totalCommitment = pfFacilities.reduce((s,f) => s + f.commitment, 0);
    const totalDrawn      = pfFacilities.reduce((s,f) => s + f.drawn, 0);
    const unfundedCommit  = totalCommitment - totalDrawn;
    const pfBreachCount   = pfFacilities.filter(f => f.covenantBreached).length;
    const formPF = {
      meta: {
        asOf, filingType: 'Preview', section: 'Section 1a/1b/4 (Large PE Adviser)',
        note: 'Preview only — real Form PF submission requires SEC PFRD schema conversion + human review.',
        frameworkFilter: filters.formPF, inScopeCount: pfFacilities.length,
        excludedCount: pfScope.excluded.length, excludedByFramework: pfScope.excludedByFw,
        scopedByFund: pfScope.scopedByFund, scopedByFramework: pfScope.scopedByFramework,
        inScopeDeals: pfScope.inScopeDeals, excludedDeals: pfScope.excludedDeals,
        scopeNote: 'Form PF is a US SEC-registered-adviser filing. Deals with fund allocations use fund.regulator_scope (SEC); deals without fall back to framework filter.'
      },
      section1a_fundInfo: {
        totalAUM:        pfFacilities.reduce((s,f) => s + f.drawn, 0),
        netAUM:          pfFacilities.reduce((s,f) => s + f.drawn, 0),
        fundType:        'Private Credit / Direct Lending',
        loanCount:       pfFacilities.length,
        currency:        (topN(groupBy(pfFacilities, f => f.currency, f => f.drawn), 1)[0] || {label:'USD'}).label,
        borrowingsPct:   0,   // no leverage tracking yet
        cashPct:         null,
        derivativesPct:  0
      },
      section1b_concentration: {
        top5BorrowersPct: top5Pct,
        byBorrower: topN(byBorrower, 10),
        byIndustry: topN(byIndustry, 10),
        byGeography: byGeo,
        byFramework: byFramework_pf
      },
      section4_peAdviser: {
        // Bridge financings — Form PF Q73: aggregate drawn on unfunded facilities
        // For preview we flag any facility with utilization < 100% as a candidate
        bridgeCandidates: pfFacilities.filter(f => f.utilization != null && f.utilization < 1).map(f => ({
          borrower: f.borrower, framework: f.framework, commitment: f.commitment, drawn: f.drawn,
          undrawn: f.commitment - f.drawn, maturity: f.maturity
        })),
        totalUnfundedCommit: unfundedCommit,
        commitmentUtilization: totalCommitment > 0 ? totalDrawn/totalCommitment : null,
        controlledCompaniesCount: 0,   // requires equity-holding data we don't track
        note: 'Controlled companies count requires equity-holding data outside this module.'
      },
      flags: [
        totalDrawn > 2_000_000_000 ? 'AUM > $2B triggers Section 4 (Large PE Adviser)' : null,
        top5Pct > 40 ? 'Top-5 borrower concentration ' + top5Pct.toFixed(1) + '% > 40% — regulatory-attention threshold' : null,
        pfBreachCount > 0 ? pfBreachCount + ' facility(ies) in covenant breach — disclose in Section 4' : null,
        pfScope.excluded.length > 0 ? pfScope.excluded.length + ' deal(s) excluded by framework filter — held by non-US-adviser fund(s)?' : null
      ].filter(Boolean)
    };

    // ═════════════════════════════════════════════════════════════════════
    // AIFMD Annex IV — EU (Directive 2011/61/EU)
    // ═════════════════════════════════════════════════════════════════════
    const aifScope = scopedFacilities('aifmd');
    const aifFacilities = aifScope.inScope;
    const aifByBorrower = groupBy(aifFacilities, f => f.borrower, f => f.drawn);
    const aifByIndustry = groupBy(aifFacilities, f => f.industry, f => f.drawn);
    const aifByGeo      = groupBy(aifFacilities, f => f.geography, f => f.drawn);
    const aifByFramework = groupBy(aifFacilities, f => f.framework, f => f.drawn);
    const aifTop5Pct    = topN(aifByBorrower, 5).reduce((s,x) => s+x.pct, 0);
    const aifCommitment = aifFacilities.reduce((s,f) => s + f.commitment, 0);
    const aifDrawn      = aifFacilities.reduce((s,f) => s + f.drawn, 0);
    // Principal exposures: top 5 by drawn amount (proxy for principal exposure).
    // Instruments-traded: for a pure credit fund, everything is loans; if
    // hedges present they'd be classified as derivatives.
    const instrumentTypes = { Loan: 0, Bond: 0, Equity: 0, Derivative: 0 };
    for(const f of aifFacilities){
      const t = (f.rateType === 'Float' || f.rateType === 'Fixed') ? 'Loan' : 'Loan';
      instrumentTypes[t] += f.drawn;
    }
    const grossLeverage = fundNAV > 0 ? aifCommitment / fundNAV : null;
    const netLeverage   = fundNAV > 0 ? aifDrawn / fundNAV : null;
    // Liquidity buckets — for illiquid loans, most sits in the >365 day bucket
    const liquidityBuckets = [
      { daysUpTo: 1,    pct: 0 },
      { daysUpTo: 7,    pct: 0 },
      { daysUpTo: 30,   pct: 0 },
      { daysUpTo: 90,   pct: 0 },
      { daysUpTo: 180,  pct: 0 },
      { daysUpTo: 365,  pct: 0 },
      { daysUpTo: 999999, pct: 100 }   // private credit is fundamentally illiquid
    ];
    // Only include YTM/duration for facilities that survived the aifmd filter
    const aifLoansScoped = loans.filter(l => framePasses((l.inst && l.inst.accountingFramework) || 'IFRS', 'aifmd'));
    const aifmd = {
      meta: {
        asOf, filingFrequency: 'Quarterly (AUM > €1B)',
        reportingCurrency: (topN(groupBy(aifFacilities, f => f.currency, f => f.drawn), 1)[0] || {label:'EUR'}).label,
        note: 'Preview only — ESMA reporting requires XML in the AIFMD data-format schema.',
        frameworkFilter: filters.aifmd, inScopeCount: aifFacilities.length,
        excludedCount: aifScope.excluded.length, excludedByFramework: aifScope.excludedByFw,
        scopedByFund: aifScope.scopedByFund, scopedByFramework: aifScope.scopedByFramework,
        inScopeDeals: aifScope.inScopeDeals, excludedDeals: aifScope.excludedDeals,
        scopeNote: 'AIFMD Annex IV is filed by EU-managed alternative funds. Deals with fund allocations use fund.regulator_scope (ESMA); deals without fall back to framework filter.'
      },
      principalExposures: {
        long: topN(aifByBorrower, 5).map(x => ({ instrument: x.label, exposure: x.amount, pct: x.pct, position: 'long' })),
        short: []
      },
      instruments: {
        byType: Object.entries(instrumentTypes).filter(([, v]) => v > 0)
          .map(([type, amount]) => ({ type, amount, pct: aifDrawn > 0 ? amount/aifDrawn*100 : 0 }))
      },
      concentration: {
        top5CounterpartiesPct: aifTop5Pct,
        bySector: topN(aifByIndustry, 10),
        byGeography: aifByGeo,
        byFramework: aifByFramework
      },
      leverage: {
        grossMethod:      grossLeverage,
        commitmentMethod: netLeverage,
        fundNAV,
        note: fundNAV === agg.activeNotional
          ? 'NAV proxy = active notional (no explicit NAV supplied). Provide fundNAV opt for accurate ratios.'
          : ''
      },
      riskProfile: {
        wtdAvgYield:     wtdAvg(aifLoansScoped.map(l => ({ v: l.metrics && l.metrics.ytm, w: l.metrics && l.metrics.notional })), r => r.v, r => r.w || 0),
        wtdAvgDuration:  wtdAvg(aifLoansScoped.map(l => ({ v: l.metrics && l.metrics.modifiedDuration, w: l.metrics && l.metrics.notional })), r => r.v, r => r.w || 0),
        totalDV01:       aifLoansScoped.reduce((s,l) => s + ((l.metrics && +l.metrics.dv01) || 0), 0),
        currencyMix:     groupBy(aifFacilities, f => f.currency, f => f.drawn).map(x => ({ label: x.label, pct: x.pct, amount: x.amount }))
      },
      liquidity: {
        buckets: liquidityBuckets,
        note: 'Private-credit loans are fundamentally illiquid — 100% in >365d bucket unless secondary sale is planned.'
      }
    };

    // ═════════════════════════════════════════════════════════════════════
    // FR Y-14Q Schedule H.1 — Fed corporate loan facility schedule
    // ═════════════════════════════════════════════════════════════════════
    // Facility-level rows. Full spec has 100+ fields per facility; preview
    // shows the core stress-test fields.
    const y14Scope = scopedFacilities('y14q');
    const y14Facilities = y14Scope.inScope;
    const y14q_rows = y14Facilities.map(f => ({
      obligorName:  f.borrower,
      framework:    f.framework,
      industry:     f.industry,
      geography:    f.geography,
      commitment:   f.commitment,
      drawn:        f.drawn,
      utilization:  f.utilization,
      couponPct:    f.coupon,
      maturity:     f.maturity,
      pd:           f.pd,
      lgd:          f.lgd,
      ead:          f.ead,
      secured:      f.secured,
      seniority:    f.seniority,
      rateType:     f.rateType,
      eclStage:     f.eclStage,
      covenantBreach: f.covenantBreached
    }));
    const y14q = {
      meta: {
        asOf, reportingPeriod: 'Quarter ending ' + asOf,
        reporterType: 'Preview — banks with $100B+ assets file this; PE credit funds do not, but the schedule is a useful loan-book scorecard.',
        note: 'PD/LGD are STAGE-BASED APPROXIMATIONS (Stage 1: 1% / Stage 2: 5% / Stage 3: 50%). Real submission requires IRB or internal-rating-model outputs.',
        frameworkFilter: filters.y14q, inScopeCount: y14Facilities.length,
        excludedCount: y14Scope.excluded.length, excludedByFramework: y14Scope.excludedByFw,
        scopedByFund: y14Scope.scopedByFund, scopedByFramework: y14Scope.scopedByFramework,
        inScopeDeals: y14Scope.inScopeDeals, excludedDeals: y14Scope.excludedDeals,
        scopeNote: 'FR Y-14Q is a US bank-holding-company filing. Deals with fund allocations use fund.regulator_scope (Fed); deals without fall back to framework filter.'
      },
      rows: y14q_rows,
      summary: {
        totalCommitment: y14Facilities.reduce((s,f) => s + f.commitment, 0),
        totalDrawn:      y14Facilities.reduce((s,f) => s + f.drawn, 0),
        totalEAD:        y14q_rows.reduce((s,r) => s + (r.ead || 0), 0),
        totalExpectedLoss: y14q_rows.reduce((s,r) => s + (r.ead * r.pd * r.lgd), 0),
        wtdAvgPD:        wtdAvg(y14q_rows, r => r.pd, r => r.ead || 0),
        wtdAvgLGD:       wtdAvg(y14q_rows, r => r.lgd, r => r.ead || 0),
        breachCount:     y14q_rows.filter(r => r.covenantBreach).length,
        stage3Count:     y14q_rows.filter(r => r.eclStage === '3').length
      }
    };

    // ═════════════════════════════════════════════════════════════════════
    // N-PORT — SEC registered-fund monthly portfolio (Rule 30b1-9)
    // ═════════════════════════════════════════════════════════════════════
    // Item C: portfolio holdings, per instrument. For a private credit fund
    // this would only file if registered (BDC or interval fund). Preview
    // shows what the holdings schedule would look like.
    const npScope = scopedFacilities('nport');
    const npFacilities = npScope.inScope;
    const nport_holdings = npFacilities.map(f => {
      const fairValue = f.drawn;
      const cost = f.drawn;
      const unrealPnL = fairValue - cost;
      return {
        identifier:  f.key,
        name:        f.name,
        framework:   f.framework,
        principal:   f.drawn,
        fairValue,
        cost,
        unrealizedPnL: unrealPnL,
        maturity:    f.maturity,
        couponPct:   f.coupon,
        secured:     f.secured,
        seniority:   f.seniority,
        eclStage:    f.eclStage,
        liquidityClass: f.covenantBreached ? 'Level 3 — illiquid (breach)' : 'Level 3 — illiquid (private credit)',
        fairValueLevel: 3
      };
    });
    const npLoansScoped = loans.filter(l => framePasses((l.inst && l.inst.accountingFramework) || 'IFRS', 'nport'));
    const nport = {
      meta: {
        asOf,
        note: 'Preview — N-PORT is a REGISTERED-FUND filing (BDC / interval fund). Private funds are typically exempt. Shown here as a loan-book QC view.',
        frameworkFilter: filters.nport, inScopeCount: npFacilities.length,
        excludedCount: npScope.excluded.length, excludedByFramework: npScope.excludedByFw,
        scopedByFund: npScope.scopedByFund, scopedByFramework: npScope.scopedByFramework,
        inScopeDeals: npScope.inScopeDeals, excludedDeals: npScope.excludedDeals,
        scopeNote: 'N-PORT is a US SEC-registered-fund filing. Deals with fund allocations use fund.regulator_scope (SEC); deals without fall back to framework filter. Most PE credit funds are §3(c)(7)-exempt.'
      },
      itemA_summary: {
        totalAssets:      nport_holdings.reduce((s,h) => s + h.fairValue, 0),
        totalLiabilities: 0,
        netAssets:        nport_holdings.reduce((s,h) => s + h.fairValue, 0),
        holdingsCount:    nport_holdings.length
      },
      itemC_holdings: nport_holdings,
      itemD_riskMetrics: {
        wtdAvgMaturityYears: wtdAvg(npLoansScoped.map(l => ({ v: l.metrics && l.metrics.wal, w: l.metrics && l.metrics.notional })), r => r.v, r => r.w || 0),
        illiquidPct: 100,
        level3AssetsPct: 100
      }
    };

    return {
      meta: { asOf, generatedAt: new Date().toISOString(), facilityCount: facilities.length, fundNAV },
      formPF, aifmd, y14q, nport
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Notice matching — pair Expected (system_derived) vs Received (agent)
  // ═════════════════════════════════════════════════════════════════════════
  // Fuzzy matcher that scores a candidate notice against a pool of existing
  // ones. Returns the best match (if any), a score, and a variance report
  // ready to render in the UI.
  //
  // Scoring: mandatory same deal_id + at least one of (type match, amount ~=,
  // date ~=). Threshold-tuned so a $5M drawdown expected on 06-22 matches a
  // $5.02M drawdown received on 06-23 as "minor variance".
  //
  //   const r = LMA.matchNoticePair(candidate, pool, opts);
  //   → {
  //       bestMatch: <existingNotice> | null,
  //       score: 0..200,
  //       severity: 'clean' | 'minor' | 'major' | 'unmatched',
  //       variance: {
  //         date_diff_days, amount_diff, amount_diff_pct,
  //         type_mismatch, currency_mismatch, reference_match,
  //         rate_diff, reasons: [...]
  //       },
  //       autoApproveOk: bool   // true if severity==='clean' and score high enough
  //     }
  function matchNoticePair(candidate, pool, opts){
    opts = opts || {};
    const AUTO_MATCH_SCORE = +opts.autoMatchScore || 130;
    const AMT_TOL_PCT      = +opts.amountTolerancePct || 0.01;   // 1%
    const AMT_MINOR_PCT    = +opts.amountMinorPct || 0.05;       // 5% still-minor
    const DATE_TOL_DAYS    = +opts.dateToleranceDays || 3;
    const DATE_MINOR_DAYS  = +opts.dateMinorDays || 7;
    const daysBetween = (a, b) => {
      if(!a || !b) return null;
      return Math.round((new Date(b) - new Date(a)) / 86400000);
    };
    const norm = s => String(s || '').trim().toLowerCase();

    if(!candidate || !Array.isArray(pool) || !pool.length){
      return { bestMatch: null, score: 0, severity: 'unmatched', variance: null, autoApproveOk: false };
    }

    const scored = pool
      .filter(n => n && n.id !== candidate.id)
      .filter(n => (n.deal_id || n.dealId) === (candidate.deal_id || candidate.dealId))
      // Skip already-paired notices (each notice can only match one partner)
      .filter(n => !n.matched_notice_id)
      .map(n => {
        let score = 0;
        const reasons = [];
        const candType = norm(candidate.notice_type);
        const nType    = norm(n.notice_type);
        const typeMatch = candType && candType === nType;
        if(typeMatch) score += 50;
        else if(candType && nType) reasons.push('type mismatch (' + n.notice_type + ' vs ' + candidate.notice_type + ')');

        // Amount comparison — tolerate small differences
        const cAmt = +candidate.amount || 0;
        const nAmt = +n.amount || 0;
        const amtDiff = cAmt - nAmt;
        const amtBase = Math.max(Math.abs(cAmt), Math.abs(nAmt));
        const amtDiffPct = amtBase > 0 ? Math.abs(amtDiff) / amtBase : 0;
        if(amtBase > 0){
          if(amtDiffPct <= AMT_TOL_PCT)      { score += 30; }
          else if(amtDiffPct <= AMT_MINOR_PCT){ score += 15; reasons.push('amount differs ' + (amtDiffPct*100).toFixed(1) + '%'); }
          else                                { reasons.push('amount differs ' + (amtDiffPct*100).toFixed(1) + '% (' + amtDiff.toLocaleString() + ')'); }
        }

        // Date comparison — days between effective_dates
        const dDiff = daysBetween(candidate.effective_date, n.effective_date);
        if(dDiff !== null){
          const abs = Math.abs(dDiff);
          if(abs === 0)                       { score += 20; }
          else if(abs <= DATE_TOL_DAYS)       { score += 15; reasons.push('date off by ' + dDiff + 'd'); }
          else if(abs <= DATE_MINOR_DAYS)     { score += 5;  reasons.push('date off by ' + dDiff + 'd'); }
          else                                { reasons.push('date off by ' + dDiff + ' days'); }
        }

        // Currency mismatch is a hard signal — usually means wrong notice
        const currencyMismatch = (candidate.currency && n.currency && norm(candidate.currency) !== norm(n.currency));
        if(currencyMismatch){ score -= 30; reasons.push('currency mismatch (' + n.currency + ' vs ' + candidate.currency + ')'); }

        // Reference number — bonus if identical (agents often echo our ref)
        const referenceMatch = candidate.reference && n.reference && norm(candidate.reference) === norm(n.reference);
        if(referenceMatch) score += 5;

        // Rate comparison (interest notices)
        const cRate = candidate.rate != null ? +candidate.rate : null;
        const nRate = n.rate != null ? +n.rate : null;
        const rateDiff = (cRate != null && nRate != null) ? cRate - nRate : null;
        if(rateDiff != null && Math.abs(rateDiff) > 0.0001){
          reasons.push('rate differs ' + (rateDiff * 10000).toFixed(1) + 'bps');
        }

        return {
          notice: n, score,
          variance: {
            date_diff_days: dDiff,
            amount_diff: amtDiff,
            amount_diff_pct: amtDiffPct,
            type_mismatch: !typeMatch,
            currency_mismatch: currencyMismatch,
            reference_match: !!referenceMatch,
            rate_diff: rateDiff,
            reasons
          }
        };
      })
      .filter(x => x.score > 0)
      .sort((a,b) => b.score - a.score);

    if(!scored.length){
      return { bestMatch: null, score: 0, severity: 'unmatched', variance: null, autoApproveOk: false };
    }
    const best = scored[0];
    // Classify severity: clean (green), minor (amber), major (red)
    const v = best.variance;
    let severity;
    const bigDate = Math.abs(v.date_diff_days || 0) > DATE_MINOR_DAYS;
    const bigAmt  = (v.amount_diff_pct || 0) > AMT_MINOR_PCT;
    if(v.type_mismatch || v.currency_mismatch || bigDate || bigAmt){
      severity = 'major';
    } else if(Math.abs(v.date_diff_days || 0) > 0 || (v.amount_diff_pct || 0) > 0 || v.rate_diff){
      severity = 'minor';
    } else {
      severity = 'clean';
    }
    return {
      bestMatch: best.notice,
      score: best.score,
      severity,
      variance: v,
      autoApproveOk: (severity === 'clean' && best.score >= AUTO_MATCH_SCORE),
      candidates: scored.slice(0, 5).map(x => ({ notice: x.notice, score: x.score }))
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Borrower financials — KPI computation
  // ═════════════════════════════════════════════════════════════════════════
  // Takes an extracted financial statement (balance_sheet + income_statement
  // + cash_flow) and computes the standard credit-covenant KPIs. Handles
  // nulls gracefully — any KPI whose inputs are missing returns null instead
  // of throwing.
  //
  //   const kpis = LMA.computeFinancialKpis(extraction);
  //   → { dscr, interest_coverage, leverage_ratio, net_leverage_ratio,
  //       current_ratio, debt_to_equity, quick_ratio, warnings: [...] }
  function computeFinancialKpis(fin){
    fin = fin || {};
    const bs = fin.balance_sheet || {};
    const is = fin.income_statement || {};
    const cf = fin.cash_flow || {};
    const warnings = [];
    const num = (v) => (v == null || isNaN(+v)) ? null : +v;

    const ebitda    = num(is.ebitda);
    const interest  = num(is.interest_expense);
    const principal = num(cf.principal_payments);
    const totalDebt = num(bs.total_debt) != null
      ? num(bs.total_debt)
      : (num(bs.short_term_debt) != null && num(bs.long_term_debt) != null
          ? num(bs.short_term_debt) + num(bs.long_term_debt) : null);
    const cash          = num(bs.cash);
    const equity        = num(bs.total_equity);
    const currentAssets = num(bs.current_assets);
    const currentLiab   = num(bs.current_liabilities);
    const ar            = num(bs.accounts_receivable);

    // DSCR = EBITDA / (Interest + Principal Payments)
    // If principal not reported, fall back to ICR-style denominator with a warning
    let dscr = null;
    if(ebitda != null && interest != null){
      const denom = interest + (principal != null ? principal : 0);
      if(denom > 0) dscr = ebitda / denom;
      if(principal == null) warnings.push('DSCR uses interest only (principal payments not reported)');
    }
    // Interest Coverage = EBITDA / Interest
    const icr = (ebitda != null && interest != null && interest > 0) ? ebitda / interest : null;
    // Leverage = Total Debt / EBITDA (annualised — quarterly EBITDA × 4)
    let leverage = null, netLeverage = null;
    if(totalDebt != null && ebitda != null && ebitda !== 0){
      const period = String(fin.period_type || '').toLowerCase();
      const annEbitda = (period === 'quarterly') ? ebitda * 4
                       : (period === 'monthly') ? ebitda * 12
                       : (period === 'semi_annual') ? ebitda * 2
                       : ebitda;
      leverage = totalDebt / annEbitda;
      if(cash != null) netLeverage = (totalDebt - cash) / annEbitda;
      if(['quarterly','monthly','semi_annual'].includes(period)){
        warnings.push('Leverage annualised (period=' + period + ', EBITDA × ' + Math.round(annEbitda / ebitda) + ')');
      }
    }
    // Current Ratio = Current Assets / Current Liabilities
    const currentRatio = (currentAssets != null && currentLiab != null && currentLiab > 0)
      ? currentAssets / currentLiab : null;
    // Debt to Equity = Total Debt / Total Equity
    const debtToEquity = (totalDebt != null && equity != null && equity > 0)
      ? totalDebt / equity : null;
    // Quick Ratio = (Cash + AR) / Current Liabilities
    const quickRatio = (currentLiab != null && currentLiab > 0 && cash != null)
      ? (cash + (ar || 0)) / currentLiab : null;

    return {
      dscr: dscr != null ? round(dscr, 4) : null,
      interest_coverage: icr != null ? round(icr, 4) : null,
      leverage_ratio: leverage != null ? round(leverage, 4) : null,
      net_leverage_ratio: netLeverage != null ? round(netLeverage, 4) : null,
      current_ratio: currentRatio != null ? round(currentRatio, 4) : null,
      debt_to_equity: debtToEquity != null ? round(debtToEquity, 4) : null,
      quick_ratio: quickRatio != null ? round(quickRatio, 4) : null,
      warnings
    };
  }

  // Map a covenant.kpiMetric string to a field on the computed KPI object.
  // Used by the client to auto-update covenant.lastReportedValue after a
  // financials import. Returns null when the covenant KPI isn't derivable
  // from financials (e.g. 'esgScore', 'borrowingBase', 'custom').
  // ─── Covenant KPI resolver ────────────────────────────────────
  // Now accepts a third `deal` argument so construction-mezz KPIs
  // (LVR / LTC / RLVR / min-NAV / min-presales) can be computed
  // mechanically from the deal's own fields — Watchlist was silently
  // treating them as clear because the map didn't know how to
  // evaluate them.
  //
  // For P&L / balance-sheet KPIs, this reads from the `kpis` object
  // produced by the Financials import (DSCR, ICR, leverage, etc.).
  // For construction ratios it reads senior_debt_limit + facility
  // commitment + as_if_complete_value + total_dev_cost + QPS + NRV.
  // For min-NAV / min-presales, it reads the covenant's own
  // last_reported_value (updated by ops each month from the QS or
  // the guarantor's financial statements).
  function covenantKpiValue(kpiMetric, kpis, deal, covenant){
    const m = String(kpiMetric || '').toLowerCase().replace(/[_\s-]/g, '');

    // P&L / balance-sheet KPIs — from Financials import
    const finMap = {
      dscr:              kpis && kpis.dscr,
      interestcoverage:  kpis && kpis.interest_coverage,
      icr:               kpis && kpis.interest_coverage,
      fccr:              kpis && (kpis.fccr || kpis.fixed_charge_coverage),
      leverage:          kpis && kpis.leverage_ratio,
      leverageratio:     kpis && kpis.leverage_ratio,
      netleverage:       kpis && kpis.net_leverage_ratio,
      netleverageratio:  kpis && kpis.net_leverage_ratio,
      currentratio:      kpis && kpis.current_ratio,
      debttoequity:      kpis && kpis.debt_to_equity,
      quickratio:        kpis && kpis.quick_ratio,
      minnetworth:       kpis && (kpis.net_worth || kpis.equity)
    };
    if(m in finMap) return finMap[m];

    // Construction-mezz KPIs — derived from the deal's own reference
    // fields set on Deal Setup → Construction / arranger — mezz support.
    // Facility limit = principal commitment + capitalised coupon accrued
    // to date. For a rough breach check at any point we use the total
    // commitment; a more precise per-date value could compute the
    // outstanding balance from the schedule. Barrenjoey's threshold
    // formula uses the FACILITY LIMIT (investor commitment + coupon),
    // so we approximate by summing commitment + est. peak capitalised
    // coupon if available; otherwise just commitment.
    if(deal){
      const senior = +deal.seniorDebtLimit    || +deal.senior_debt_limit    || 0;
      const facilityCommitment =
        (deal.facility && +deal.facility.commitment) ||
        +deal.commitment || 0;
      // Term-sheet "Facility Limit" for mezz construction deals =
      // investor commitment + capitalised coupon at exit. If the caller
      // stored an explicit estimate use it; otherwise compute one from
      // the PIK tranches so LVR / LTC / RLVR reflect the real max
      // exposure that Barrenjoey's covenants test against.
      //
      // Estimator: sum over PIK-toggled tranches of
      //   face_value × baseValue (coupon %) × years_to_maturity
      // Simple compound approximation — good to a few percent for
      // demo purposes. Precise number requires running the schedule.
      let estCoupon = +deal.estCapitalisedCoupon || +deal.facilityLimitCoupon || 0;
      if(estCoupon === 0 && Array.isArray(deal.tranches) && deal.settle && deal.maturity){
        const years = Math.max(0, (new Date(deal.maturity) - new Date(deal.settle)) / (365.25 * 86400000));
        for(const t of deal.tranches){
          if(!t.isPikToggle) continue;
          const face = +t.face || 0;
          const ic = (t.interestComponents || [])[0];
          const rate = ic ? (+ic.baseValue || 0) : 0;
          if(face > 0 && rate > 0 && years > 0){
            estCoupon += face * rate * years;
          }
        }
      }
      const facilityLimit = facilityCommitment + estCoupon;
      const aic   = +deal.asIfCompleteValue  || +deal.as_if_complete_value || 0;
      const tdc   = +deal.totalDevCost       || +deal.total_development_cost || 0;
      const qps   = +deal.qualifyingPresales || +deal.qualifying_presales || 0;
      const nrv   = +deal.nrv                || +deal.net_realisation_value || 0;

      if(m === 'lvrconstruction' || m === 'lvr'){
        if(aic > 0) return ((senior + facilityLimit) / aic) * 100;   // return as %
        return null;
      }
      if(m === 'ltc'){
        if(tdc > 0) return ((senior + facilityLimit) / tdc) * 100;
        return null;
      }
      if(m === 'rlvr' || m === 'residuallvr'){
        const denom = (nrv - qps);
        if(denom > 0) return ((senior + facilityLimit - qps) / denom) * 100;
        return null;
      }
    }

    // KPIs backed by a manually-reported value on the covenant itself
    // (updated by ops each test cycle). Watchlist can still evaluate
    // breach when the ops team has populated `lastReportedValue`.
    if(m === 'minnetassets' || m === 'minpresales'){
      if(covenant && covenant.lastReportedValue != null) return +covenant.lastReportedValue;
      if(covenant && covenant.last_reported_value != null) return +covenant.last_reported_value;
      return null;
    }

    return null;
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
    computeRegulatoryReports,
    matchNoticePair,
    computeFinancialKpis, covenantKpiValue,
    version: '1.6.0'
  };
  if(typeof module !== 'undefined' && module.exports) module.exports = LMA;
  global.LMA = LMA;
})(typeof window !== 'undefined' ? window : globalThis);
