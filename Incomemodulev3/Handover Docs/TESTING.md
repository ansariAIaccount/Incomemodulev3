# Testing

### V4.67 · 50 automated cases, all passing

There is a working test harness. It is easy to miss — no `package.json` at the
app root, no `npm test`, nothing in the README — so the first thing to know is
that it exists and that it runs.

```bash
cd Incomemodulev3/tests
node engine-harness.js        # 25 cases · the calculation engine
node regression-harness.js    # 25 cases · analytics, regulatory scope, watchlist
```

No install step. No dependencies. Node 18+.

Both were green on V4.67, including after this week's engine changes
(`eclTrace`, `registerHolidayCalendar`). **Run both before and after any engine
edit** — a diff of two green runs is the cheapest evidence you have.

---

## How it runs a browser file in Node

`loan-module-engine.js` is browser-side: no `module.exports`, and it touches
`window` and `localStorage`. `engine-loader.js` bridges that:

1. reads the engine source from disk
2. runs it in a Node `vm` context with `localStorage` shimmed
3. **deliberately does not provide `window`**, so the engine's
   `typeof window !== 'undefined'` guards take the Node branch
4. exposes the top-level function declarations as CommonJS exports

```js
const engine = require('./engine-loader.js');
const schedule = engine.buildSchedule(inst);
const summary  = engine.summarize(schedule, inst.settlementDate, inst.maturityDate);
const jes      = engine.generateDIU(inst, summary, {});
```

Consequence worth knowing: **only top-level declarations are reachable.**
Functions declared inside `buildSchedule` at column 0 — `computeCompoundedRFR`,
`lookupMarginBps` — cannot be tested directly. See ENGINE-GUIDE.md §2.

---

## Writing a case

```js
scenario('E26', 'Short description of what must hold', ({eq, close, gt, has, truthy, balanced}) => {
  const inst = mkInst({ coupon: { type:'Fixed', fixedRate: 0.08 } });
  const r = run(inst);
  close('interest ≈ $800K', r.summary.totalCashAccrual, 800000, 2000);
  balanced('JEs balance', r.jes);
});
```

`mkInst(overrides)` gives a working $10M bullet loan — IFRS, ACT/360, 6% fixed,
2026-01-01 → 2027-01-01 — and merges your overrides over it. `run(inst)` does
buildSchedule → summarize → generateDIU and returns all three.

Assertions available: `eq`, `close(name, actual, expected, tol)` (default
tolerance 0.5), `gt`, `truthy`, `has(name, arr, predicate)`, `balanced(name,
jes)`.

**Prefer `close` over `eq` for money.** Day-count conventions make exact
equality brittle, and a test that fails for the wrong reason gets deleted
rather than fixed.

Run one case while iterating:

```bash
node engine-harness.js --only E26
node engine-harness.js --only E1,E2,E26 --verbose
```

---

## What the harnesses cover

**engine-harness.js** — accrual and amortisation, maturity payoff, discount
accretion, fees and the EIR, PIK, ECL stages 1 and 3, framework-specific memos
(IFRS / USGAAP / AASB), multi-tranche aggregation, floating SONIA, covenant
step-up and mandatory prepayment, per-period JE splitting, and a set of
invariants: every JE has `isDebit` / `amountLE` / `transactionType`; every
effective date falls inside `[settlement, maturity]`; ACT/360 accrues more than
ACT/365; an empty instrument returns `[]` rather than throwing.

**regression-harness.js** — watchlist signals and ranking, Form PF / AIFMD /
Y-14Q scope resolution, framework fallback, fund-overrides-framework, and
multi-fund allocation splits.

---

## What they do not cover

Be honest with yourself about this list; it is where the defects have actually
been.

- **The UI.** Nothing in `loan-module-v4-builder.html` is tested. Every
  front-end defect this week — a tab missing from `TAB_IDS`, a column
  preference that could not express "unchecked", a maturity that contradicted
  its own history — was invisible to these harnesses.
- **Persistence.** No test touches Supabase. Save/load round-trips, RLS, and
  the enum constraints are unverified.
- **The DIU push.** No test exercises the Investran proxy.
- **POCI.** There is no POCI scenario in `engine-harness.js`. Given it is a
  distinct branch in the ECL block and has two open defects (#71, #72), this is
  the most valuable gap to close.
- **The external feed path.** `generateDIUFromExternalFeed` is untested.

---

## Verifying the front end without a browser

Parse-checking catches the class of error that takes the whole page down. It is
not a substitute for opening the screen, but it is fast and it has caught real
breakage.

```bash
cd Incomemodulev3
python3 - <<'PY'
import re,subprocess,os
p="loan-module-v4-builder.html"
h=re.sub(r'<!--.*?-->','',open(p,encoding='utf-8').read(),flags=re.S)
inline=[(a,b) for a,b in re.findall(r'<script\b([^>]*)>(.*?)</script>',h,re.S|re.I)
        if 'src=' not in a.lower()]
os.makedirs('/tmp/chk',exist_ok=True); bad=0
for i,(a,b) in enumerate(inline):
    f=f'/tmp/chk/s{i}.js'; open(f,'w',encoding='utf-8').write(b)
    r=subprocess.run(['node','--check',f],capture_output=True,text=True)
    if r.returncode: bad+=1; print(f"BLOCK {i} FAILED\n{r.stderr[:600]}")
print(f"{len(inline)} blocks checked · {'OK' if not bad else str(bad)+' FAILED'}")
PY

node --check loan-module-engine.js
node --check portf-excel-parser.js
node --check loan-module-analytics.js
```

Strip the HTML comments **first**. One comment in the builder contains the
literal text `<script>`, and a naive regex treats it as an opening tag and
reports a syntax error that is not there.

---

## Manual checks worth keeping

After an engine change, re-run the demo deals and diff. The ones with the most
coverage per run:

| Deal | Exercises |
|---|---|
| `DEMO-POCI`, `-MID`, `-PAR` | POCI, credit-adjusted EIR, three recovery outcomes |
| `DEMO-MOD-S3` | modification, Stage 3, interest on net |
| `DEMO-HAIRCUT-SALE` | restructuring, haircut, disposal |
| `DEMO-FORGIVE-S3` | principal forgiveness + extension |
| Hamilton / Smokey | the external PortF feed path |
| The seven AU deals | holiday-calendar rolling |

The thing to diff is the journal register and the carrying-value column. A
balanced batch with the wrong carrying amount is the failure mode this project
produces most often, and it looks entirely normal on screen.

---

## If you add CI

Lowest-effort useful pipeline:

```bash
node tests/engine-harness.js && node tests/regression-harness.js
node --check loan-module-engine.js
# plus the inline-block parse check above
./check-manifest.sh
```

`check-manifest.sh` catches a build committed without the pre-commit hook
having run, which is the deployment failure this project has actually had.
