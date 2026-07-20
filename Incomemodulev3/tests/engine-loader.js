// ═══════════════════════════════════════════════════════════════════════
// engine-loader.js — Node.js shim for loan-module-engine.js
// ═══════════════════════════════════════════════════════════════════════
// The engine file is browser-side (no module.exports; touches window +
// localStorage). This loader:
//   1. Reads the engine source from disk
//   2. Runs it inside a Node vm context with shimmed localStorage/window
//   3. Exposes the top-level function declarations as CommonJS exports
//
// Usage: const engine = require('./engine-loader.js');
//        const schedule = engine.buildSchedule(inst);
//        const summary  = engine.summarize(schedule, inst.settlementDate, inst.maturityDate);
//        const jes      = engine.generateDIU(inst, summary, {});
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const engineSrc = fs.readFileSync(
  path.join(__dirname, '..', 'loan-module-engine.js'), 'utf8'
);

// Sandbox globals the engine expects. `window` is guarded via
// `typeof window !== 'undefined'` so we DON'T provide it — that leaves the
// browser-only exposure block as a no-op.
const sandbox = {
  console,
  Date, Math, JSON, Object, Array, Number, String, Boolean, RegExp,
  parseInt, parseFloat, isNaN, isFinite,
  // localStorage shim — engine only touches it via loadAllReferenceData /
  // saveAllReferenceData, both wrapped in try/catch. A no-op is fine.
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined
  }
};
vm.createContext(sandbox);
vm.runInContext(engineSrc, sandbox, { filename: 'loan-module-engine.js' });

// Pluck the public API we test against
module.exports = {
  buildSchedule:               sandbox.buildSchedule,
  summarize:                   sandbox.summarize,
  generateDIU:                 sandbox.generateDIU,
  splitInterestJEsByCouponPeriod: sandbox.splitInterestJEsByCouponPeriod,
  // Utility exports — used by some scenarios
  computeEIR:                  sandbox.computeEIR,
  rollDate:                    sandbox.rollDate,
  generatePaymentSchedule:     sandbox.generatePaymentSchedule,
  isBusinessDay:               sandbox.isBusinessDay
};
