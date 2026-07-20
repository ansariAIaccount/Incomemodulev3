#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// Regression harness — Tier 1 engine coverage
// ═══════════════════════════════════════════════════════════════════════
// Standalone Node.js harness for the analytics-side engines shipped in
// this session:
//
//   Watchlist   (LMA.computeWatchlist)
//   Regulatory  (LMA.computeRegulatoryReports)
//   Multi-fund  (fund allocations flowing into computeRegulatoryReports)
//
// Each scenario is a self-contained fixture with declared expectations.
// The harness prints a pass/fail line per scenario and exits with code 1
// if any assertion fails — safe to hook into CI.
//
// Run:  node tests/regression-harness.js
// Or:   node tests/regression-harness.js --verbose    (prints all assertions)
//
// Fixtures use synthetic deals — no DB dependency, no server dependency.
// ═══════════════════════════════════════════════════════════════════════

const path = require('path');
const LMA = require(path.join(__dirname, '..', 'loan-module-analytics.js'));

const VERBOSE = process.argv.includes('--verbose');
const ONLY = (() => {
  const idx = process.argv.indexOf('--only');
  return idx >= 0 ? (process.argv[idx + 1] || '').split(',').map(s => s.trim().toUpperCase()) : null;
})();

// ── ANSI colors (skip when not a TTY) ────────────────────────────────
const c = process.stdout.isTTY ? {
  red:   s => '\x1b[31m' + s + '\x1b[0m',
  green: s => '\x1b[32m' + s + '\x1b[0m',
  yellow:s => '\x1b[33m' + s + '\x1b[0m',
  gray:  s => '\x1b[90m' + s + '\x1b[0m',
  bold:  s => '\x1b[1m' + s + '\x1b[0m'
} : { red: s=>s, green: s=>s, yellow: s=>s, gray: s=>s, bold: s=>s };

// ── Scenario runner ──────────────────────────────────────────────────
const results = [];
function scenario(id, title, fn){
  if(ONLY && !ONLY.includes(id.toUpperCase())) return;
  const assertions = [];
  const eq = (name, actual, expected) => {
    const ok = actual === expected;
    assertions.push({ name, ok, actual, expected });
  };
  const truthy = (name, actual) => {
    const ok = !!actual;
    assertions.push({ name, ok, actual, expected: 'truthy' });
  };
  const has = (name, arr, predicate) => {
    const ok = Array.isArray(arr) && arr.some(predicate);
    assertions.push({ name, ok, actual: ok ? 'found' : 'not found', expected: 'at least 1 match' });
  };
  try {
    fn({ eq, truthy, has });
  } catch(err){
    assertions.push({ name: 'threw', ok: false, actual: err.message, expected: 'no throw' });
  }
  const failed = assertions.filter(a => !a.ok);
  const status = failed.length === 0 ? 'PASS' : 'FAIL';
  results.push({ id, title, status, assertions, failed });
  const bullet = failed.length === 0 ? c.green('✓') : c.red('✗');
  const statusStr = failed.length === 0 ? c.green(status) : c.red(status);
  console.log('  ' + bullet + ' ' + c.bold(id.padEnd(6)) + statusStr + '  ' + title);
  if(VERBOSE || failed.length > 0){
    for(const a of assertions){
      const mark = a.ok ? c.gray('    ✓') : c.red('    ✗');
      const line = mark + ' ' + a.name +
        (a.ok ? '' : ' ' + c.gray('(got: ' + JSON.stringify(a.actual) + ', expected: ' + JSON.stringify(a.expected) + ')'));
      if(!a.ok || VERBOSE) console.log(line);
    }
  }
}

// ── Fixture helpers ──────────────────────────────────────────────────
const asOf = '2026-07-19';
const daysFromNow = (n) => new Date(new Date(asOf).getTime() + n*86400000).toISOString().slice(0,10);

function mkDeal(overrides){
  return Object.assign({
    key: 'D1', name: 'Deal 1',
    inst: Object.assign({
      dealCode: 'D1', dealName: 'Deal 1',
      accountingFramework: 'IFRS', currency: 'USD',
      eclStage: '1', maturityDate: daysFromNow(365),
      commitment: 100_000_000, faceValue: 100_000_000,
      covenants: [], tranches: [], fundAllocations: []
    }, overrides.inst || {}),
    team: 'Test'
  }, overrides.wrapper || {});
}
function mkLoan(overrides){
  const deal = mkDeal(overrides);
  return {
    inst: deal.inst,
    metrics: Object.assign({
      notional: deal.inst.faceValue || deal.inst.commitment,
      coupon: 7.0, maturity: deal.inst.maturityDate,
      ytm: 7.5, wal: 3.0, modifiedDuration: 2.8, dv01: 25000,
      currency: deal.inst.currency
    }, overrides.metrics || {})
  };
}
const FUND_US   = { id: 'us1',  code: 'PCS-US-1',  name: 'US Fund',  domicile: 'US',       baseCcy: 'USD', regulatorScope: ['SEC'] };
const FUND_EU   = { id: 'eu1',  code: 'PCS-EU-2',  name: 'EU Fund',  domicile: 'Luxembourg', baseCcy: 'EUR', regulatorScope: ['ESMA','CSSF'] };
const FUND_CAY  = { id: 'cay1', code: 'PCS-CAY-3', name: 'Cayman',   domicile: 'Cayman',   baseCcy: 'USD', regulatorScope: ['SEC','CIMA'] };
const FUND_FED  = { id: 'fed1', code: 'PCS-FED-4', name: 'Bank Aff', domicile: 'US',       baseCcy: 'USD', regulatorScope: ['Fed','SEC'] };
const alloc = (fund, pct) => ({ fundId: fund.id, allocationPct: pct, method: 'pct', effectiveDate: asOf, fund });

// ═══════════════════════════════════════════════════════════════════════
// Sanity check
// ═══════════════════════════════════════════════════════════════════════
console.log('\n' + c.bold('Regression Harness — LMA v' + LMA.version));
console.log(c.gray('  as-of: ' + asOf + (ONLY ? '  · filter: ' + ONLY.join(',') : '')));

console.log('\n' + c.bold('Watchlist scenarios'));

// ═══════════════════════════════════════════════════════════════════════
// Watchlist (LMA.computeWatchlist)
// ═══════════════════════════════════════════════════════════════════════

scenario('W1', 'Clean deal → severity=clear, score=0, no signals', ({eq}) => {
  const r = LMA.computeWatchlist({ asOf, deals: [mkDeal({})], notices: [] });
  eq('rows.length', r.rows.length, 1);
  eq('severity', r.rows[0].severity, 'clear');
  eq('score', r.rows[0].score, 0);
  eq('signalCount', r.rows[0].signalCount, 0);
  eq('kpi.clear', r.kpi.clear, 1);
});

scenario('W2', 'Active covenant breach → critical', ({eq, has}) => {
  const deal = mkDeal({ inst: {
    covenants: [{ name: 'DSCR', threshold: 1.25, direction: 'gte',
      breachLog: [{ status: 'active', breachDate: '2026-05-01', breachValue: 1.05, thresholdAtBreach: 1.25 }] }]
  }});
  const r = LMA.computeWatchlist({ asOf, deals: [deal], notices: [] });
  eq('severity', r.rows[0].severity, 'critical');
  has('has covenant_breach signal', r.rows[0].signals, s => s.type === 'covenant_breach');
});

scenario('W3', 'ECL Stage 3 → critical', ({eq, has}) => {
  const deal = mkDeal({ inst: { eclStage: '3' }});
  const r = LMA.computeWatchlist({ asOf, deals: [deal], notices: [] });
  eq('severity', r.rows[0].severity, 'critical');
  has('has ecl_stage3', r.rows[0].signals, s => s.type === 'ecl_stage3');
});

scenario('W4', 'Maturity in 15 days → critical', ({eq, has}) => {
  const deal = mkDeal({ inst: { maturityDate: daysFromNow(15) }});
  const r = LMA.computeWatchlist({ asOf, deals: [deal], notices: [] });
  eq('severity', r.rows[0].severity, 'critical');
  has('has maturity_critical', r.rows[0].signals, s => s.type === 'maturity_critical');
});

scenario('W5', 'Maturity in 60 days → warning', ({eq, has}) => {
  const deal = mkDeal({ inst: { maturityDate: daysFromNow(60) }});
  const r = LMA.computeWatchlist({ asOf, deals: [deal], notices: [] });
  eq('severity', r.rows[0].severity, 'warning');
  has('has maturity_warning', r.rows[0].signals, s => s.type === 'maturity_warning');
});

scenario('W6', 'Overdue notices → warning + overdue_notices signal', ({eq, has}) => {
  const deal = mkDeal({});
  const notices = [
    { deal_id: 'D1', notice_type: 'interest', effective_date: '2026-05-15', status: 'draft' },
    { deal_id: 'D1', notice_type: 'fee',      effective_date: '2026-06-15', status: 'draft' }
  ];
  const r = LMA.computeWatchlist({ asOf, deals: [deal], notices });
  eq('severity', r.rows[0].severity, 'warning');
  has('has overdue_notices', r.rows[0].signals, s => s.type === 'overdue_notices');
});

scenario('W7', 'Covenant proximity <20% headroom → warning', ({has}) => {
  // gte covenant: value 1.10 vs threshold 1.00 → headroom = 10% < 20% → warning
  const deal = mkDeal({ inst: {
    covenants: [{ name: 'ICR', threshold: 1.00, direction: 'gte', lastReportedValue: 1.10, breachLog: [] }]
  }});
  const r = LMA.computeWatchlist({ asOf, deals: [deal], notices: [] });
  has('has covenant_proximity', r.rows[0].signals, s => s.type === 'covenant_proximity');
});

scenario('W8', 'Cured breach → no critical signal', ({eq}) => {
  const deal = mkDeal({ inst: {
    covenants: [{ name: 'DSCR', threshold: 1.25, direction: 'gte',
      breachLog: [{ status: 'cured', breachDate: '2026-05-01', cureDate: '2026-06-01', breachValue: 1.05, thresholdAtBreach: 1.25 }] }]
  }});
  const r = LMA.computeWatchlist({ asOf, deals: [deal], notices: [] });
  eq('severity', r.rows[0].severity, 'clear');
  eq('signalCount', r.rows[0].signalCount, 0);
});

scenario('W9', 'Ranking: multi-signal deal ranks above single-signal deal', ({eq}) => {
  const heavy = mkDeal({ wrapper: { key: 'HEAVY', name: 'Heavy Risk' }, inst: {
    dealCode: 'HEAVY', eclStage: '3', maturityDate: daysFromNow(20),
    tranches: [{ defaultInterestActive: true }]
  }});
  const light = mkDeal({ wrapper: { key: 'LIGHT', name: 'Light Risk' }, inst: {
    dealCode: 'LIGHT', eclStage: '2'
  }});
  const r = LMA.computeWatchlist({ asOf, deals: [heavy, light], notices: [] });
  eq('heavy ranks first', r.rows[0].dealKey, 'HEAVY');
  eq('heavy > light score', r.rows[0].score > r.rows[1].score, true);
});

scenario('W10', 'Default interest active → critical signal', ({has}) => {
  const deal = mkDeal({ inst: { tranches: [{ defaultInterestActive: true }] }});
  const r = LMA.computeWatchlist({ asOf, deals: [deal], notices: [] });
  has('has default_interest', r.rows[0].signals, s => s.type === 'default_interest');
});

console.log('\n' + c.bold('Regulatory scenarios'));

// ═══════════════════════════════════════════════════════════════════════
// Regulatory (LMA.computeRegulatoryReports)
// ═══════════════════════════════════════════════════════════════════════

scenario('R1', 'USGAAP deal, no allocations → in Form PF via framework fallback', ({eq, has}) => {
  const loan = mkLoan({ inst: { dealCode: 'US1', dealName: 'US Deal', accountingFramework: 'USGAAP' }});
  const r = LMA.computeRegulatoryReports({ loans: [loan], deals: [mkDeal({ inst: loan.inst })], asOf });
  eq('formPF in scope', r.formPF.meta.inScopeCount, 1);
  has('inScopeDeals has US Deal', r.formPF.meta.inScopeDeals, d => d.name === 'US Deal');
  eq('scopedByFramework', r.formPF.meta.scopedByFramework, 1);
});

scenario('R2', 'IFRS deal, no allocations → in AIFMD via framework fallback', ({eq, has}) => {
  const loan = mkLoan({ inst: { dealCode: 'EU1', dealName: 'EU Deal', accountingFramework: 'IFRS' }});
  const r = LMA.computeRegulatoryReports({ loans: [loan], deals: [mkDeal({ inst: loan.inst })], asOf });
  eq('aifmd in scope', r.aifmd.meta.inScopeCount, 1);
  has('inScopeDeals has EU Deal', r.aifmd.meta.inScopeDeals, d => d.name === 'EU Deal');
});

scenario('R3', 'AASB deal, no allocations → excluded from Form PF + AIFMD', ({eq}) => {
  const loan = mkLoan({ inst: { dealCode: 'AU1', dealName: 'AU Deal', accountingFramework: 'AASB' }});
  const r = LMA.computeRegulatoryReports({ loans: [loan], deals: [mkDeal({ inst: loan.inst })], asOf });
  eq('formPF excluded', r.formPF.meta.excludedCount, 1);
  eq('aifmd excluded', r.aifmd.meta.excludedCount, 1);
});

scenario('R4', 'IFRS deal + US SEC fund → included in Form PF (fund overrides framework)', ({eq, has}) => {
  const inst = { dealCode: 'X1', dealName: 'Cross-Framework Deal',
                 accountingFramework: 'IFRS', fundAllocations: [alloc(FUND_US, 1.0)] };
  const loan = mkLoan({ inst });
  const r = LMA.computeRegulatoryReports({ loans: [loan], deals: [mkDeal({ inst })], asOf });
  eq('formPF in scope', r.formPF.meta.inScopeCount, 1);
  eq('scopedByFund', r.formPF.meta.scopedByFund, 1);
  has('reason mentions fund', r.formPF.meta.inScopeDeals, d => /Allocated to PCS-US-1/.test(d.reason));
});

scenario('R5', 'USGAAP deal + EU ESMA fund → included in AIFMD', ({eq, has}) => {
  const inst = { dealCode: 'X2', dealName: 'US-booked EU-held',
                 accountingFramework: 'USGAAP', fundAllocations: [alloc(FUND_EU, 1.0)] };
  const loan = mkLoan({ inst });
  const r = LMA.computeRegulatoryReports({ loans: [loan], deals: [mkDeal({ inst })], asOf });
  eq('aifmd in scope', r.aifmd.meta.inScopeCount, 1);
  eq('formPF excluded', r.formPF.meta.excludedCount, 1);
  has('excluded reason', r.formPF.meta.excludedDeals, d => /none includes SEC/.test(d.reason));
});

scenario('R6', 'Deal with 2 funds (US + EU) → in both Form PF AND AIFMD', ({eq}) => {
  const inst = { dealCode: 'X3', dealName: 'Multi-jurisdiction',
                 accountingFramework: 'USGAAP',
                 fundAllocations: [alloc(FUND_US, 0.6), alloc(FUND_EU, 0.4)] };
  const loan = mkLoan({ inst });
  const r = LMA.computeRegulatoryReports({ loans: [loan], deals: [mkDeal({ inst })], asOf });
  eq('formPF in scope', r.formPF.meta.inScopeCount, 1);
  eq('aifmd in scope', r.aifmd.meta.inScopeCount, 1);
});

scenario('R7', 'AUM > $2B triggers Form PF Section 4 flag', ({eq, has}) => {
  const loans = [];
  for(let i = 0; i < 5; i++){
    loans.push(mkLoan({ inst: { dealCode: 'D'+i, dealName: 'Deal '+i,
      accountingFramework: 'USGAAP', faceValue: 500_000_000, commitment: 500_000_000 },
      metrics: { notional: 500_000_000, maturity: daysFromNow(365) }}));
  }
  const deals = loans.map(l => mkDeal({ inst: l.inst }));
  const r = LMA.computeRegulatoryReports({ loans, deals, asOf });
  eq('AUM >$2B', r.formPF.section1a_fundInfo.totalAUM >= 2_000_000_000, true);
  has('Section 4 flag present', r.formPF.flags, f => /Section 4/.test(f));
});

scenario('R8', 'Top-5 borrower concentration >40% flagged', ({has}) => {
  // 3 borrowers, all sizeable → each ≥ 33% → top-5 = 100%
  const loans = [
    mkLoan({ inst: { dealCode: 'A', dealName: 'BorrowerA', borrower: 'Alpha Co', accountingFramework: 'USGAAP', faceValue: 100e6 }, metrics: { notional: 100e6 }}),
    mkLoan({ inst: { dealCode: 'B', dealName: 'BorrowerB', borrower: 'Beta Co',  accountingFramework: 'USGAAP', faceValue: 100e6 }, metrics: { notional: 100e6 }}),
    mkLoan({ inst: { dealCode: 'C', dealName: 'BorrowerC', borrower: 'Gamma Co', accountingFramework: 'USGAAP', faceValue: 100e6 }, metrics: { notional: 100e6 }})
  ];
  const deals = loans.map(l => mkDeal({ inst: l.inst }));
  const r = LMA.computeRegulatoryReports({ loans, deals, asOf });
  has('top-5 flag', r.formPF.flags, f => /Top-5.*40%/i.test(f));
});

scenario('R9', 'inScopeDeals list carries deal name populated', ({eq}) => {
  const loan = mkLoan({ inst: { dealCode: 'NAMED', dealName: 'Named Deal Ltd', accountingFramework: 'USGAAP' }});
  const r = LMA.computeRegulatoryReports({ loans: [loan], deals: [mkDeal({ inst: loan.inst })], asOf });
  const first = r.formPF.meta.inScopeDeals[0];
  eq('name populated', first && first.name, 'Named Deal Ltd');
  eq('framework populated', first && first.framework, 'USGAAP');
  eq('scopedVia', first && first.scopedVia, 'framework');
});

scenario('R10', 'Y-14Q PD/LGD stage mapping: Stage 3 → PD 0.50, LGD 0.60', ({eq}) => {
  const loan = mkLoan({ inst: { dealCode: 'S3', dealName: 'Impaired', accountingFramework: 'USGAAP', eclStage: '3' }});
  const r = LMA.computeRegulatoryReports({ loans: [loan], deals: [mkDeal({ inst: loan.inst })], asOf });
  const row = r.y14q.rows[0];
  eq('Y-14Q rows.length', r.y14q.rows.length, 1);
  eq('pd', row && row.pd, 0.50);
  eq('lgd', row && row.lgd, 0.60);
  eq('stage3Count', r.y14q.summary.stage3Count, 1);
});

console.log('\n' + c.bold('Multi-fund scope scenarios'));

// ═══════════════════════════════════════════════════════════════════════
// Multi-fund (fund allocations flowing into regulatory scope)
// ═══════════════════════════════════════════════════════════════════════

scenario('M1', 'AASB deal + Cayman SEC fund → included in Form PF (framework alone would exclude)', ({eq, has}) => {
  const inst = { dealCode: 'AU-CAY', dealName: 'Aussie held in Cayman',
                 accountingFramework: 'AASB', fundAllocations: [alloc(FUND_CAY, 1.0)] };
  const loan = mkLoan({ inst });
  const r = LMA.computeRegulatoryReports({ loans: [loan], deals: [mkDeal({ inst })], asOf });
  eq('formPF in scope', r.formPF.meta.inScopeCount, 1);
  has('scoped via fund', r.formPF.meta.inScopeDeals, d => d.scopedVia === 'fund');
});

scenario('M2', 'Bank-affiliated fund (Fed scope) → deal appears in Y-14Q via fund', ({eq}) => {
  const inst = { dealCode: 'BANK', dealName: 'Bank Loan',
                 accountingFramework: 'USGAAP', fundAllocations: [alloc(FUND_FED, 1.0)] };
  const loan = mkLoan({ inst });
  const r = LMA.computeRegulatoryReports({ loans: [loan], deals: [mkDeal({ inst })], asOf });
  eq('y14q in scope', r.y14q.meta.inScopeCount, 1);
  eq('scopedByFund', r.y14q.meta.scopedByFund, 1);
});

scenario('M3', 'Split 60/40 across 2 funds — both fund codes appear in reason', ({has}) => {
  const inst = { dealCode: 'SPLIT', dealName: 'Split Deal',
                 accountingFramework: 'USGAAP',
                 fundAllocations: [alloc(FUND_US, 0.6), alloc(FUND_CAY, 0.4)] };
  const loan = mkLoan({ inst });
  const r = LMA.computeRegulatoryReports({ loans: [loan], deals: [mkDeal({ inst })], asOf });
  has('reason mentions both funds', r.formPF.meta.inScopeDeals,
    d => /PCS-US-1/.test(d.reason) && /PCS-CAY-3/.test(d.reason));
});

scenario('M4', 'Only EU-fund allocation → excluded from Form PF with clear reason', ({has}) => {
  const inst = { dealCode: 'EU-ONLY', dealName: 'EU-only Deal',
                 accountingFramework: 'IFRS', fundAllocations: [alloc(FUND_EU, 1.0)] };
  const loan = mkLoan({ inst });
  const r = LMA.computeRegulatoryReports({ loans: [loan], deals: [mkDeal({ inst })], asOf });
  has('excluded from Form PF', r.formPF.meta.excludedDeals, d => d.name === 'EU-only Deal');
  has('reason cites missing SEC', r.formPF.meta.excludedDeals, d => /none includes SEC/.test(d.reason));
});

scenario('M5', 'User framework filter override — chip toggles bring AASB into scope', ({eq}) => {
  const loan = mkLoan({ inst: { dealCode: 'A1', dealName: 'AASB Loan', accountingFramework: 'AASB' }});
  const r = LMA.computeRegulatoryReports({
    loans: [loan], deals: [mkDeal({ inst: loan.inst })], asOf,
    frameworkFilters: { formPF: ['USGAAP','ASPE','AASB'] }
  });
  eq('formPF in scope', r.formPF.meta.inScopeCount, 1);
});

// ═══════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════

const total = results.length;
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;

console.log('\n' + c.bold('═══ Summary ═══'));
console.log('  Total:  ' + total);
console.log('  ' + c.green('Passed: ' + passed));
if(failed > 0) console.log('  ' + c.red('Failed: ' + failed));

if(failed > 0){
  console.log('\n' + c.red(c.bold('FAILURES:')));
  for(const r of results.filter(r => r.status === 'FAIL')){
    console.log('  ' + c.red('✗ ' + r.id) + ' — ' + r.title);
    for(const a of r.failed){
      console.log('      ' + a.name + '  ' + c.gray('got=' + JSON.stringify(a.actual) + ' expected=' + JSON.stringify(a.expected)));
    }
  }
  process.exit(1);
}
console.log('\n' + c.green(c.bold('ALL PASS')) + '\n');
process.exit(0);
