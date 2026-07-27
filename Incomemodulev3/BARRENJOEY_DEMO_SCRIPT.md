# Barrenjoey RFP — Demo Script

**Audience:** Barrenjoey Private Capital review panel
**Length:** ~40–45 minutes for both deals + 10 min Q&A
**Deals covered:** Example 1 (RE Mezzanine construction finance) · Example 2 (FirstAg Livestock borrowing base)
**Presenter:** Ferhat Ansari (product lead, FIS PCS Loan Module V4)

---

## Pre-flight checklist (5 min before you start)

- [ ] App loaded at `loan-module-v4-builder.html` — hard-refresh (Cmd+Shift+R)
- [ ] Signed in as `ansari1@gmail.com` (admin — shows Manage teams sidebar entry)
- [ ] Console open in DevTools **just in case** — not shown to audience unless helping debug
- [ ] Both deals visible in the deal picker: **Barrenjoey RE Mezz — Example 1 (anonymised)** and **Barrenjoey FirstAg Livestock — Example 2 (anonymised)**
- [ ] Test the Waterfall modal opens (deal picker populated) and the Borrowing base modal opens
- [ ] Backup: if BB modal cashflow simulator shows $0 outstanding, run in console: check the drawdown seed landed — should show 30% utilisation

---

## Opening (2 min)

**Setup slide / verbal:**

> Barrenjoey shared two anonymised term sheets in the RFP: one construction-mezzanine deal and one revolving borrowing-base livestock facility. They picked those two on purpose — they're structurally very different from each other and neither looks like a plain corporate term loan. That's the test.
>
> What I'm going to show you today is those two deals built out end-to-end in our loan admin platform — not modelled, not summarised. Live deals, live covenants, live waterfalls, live borrowing-base compute. Same platform, one code base, two very different structures.

---

# DEAL 1 — Barrenjoey RE Mezzanine (~20 min)

## Act 1 — Deal shape (3 min)

**Action:** From the header deal picker, select **"Barrenjoey RE Mezz — Example 1 (anonymised)"**. Wait for the Loan Builder to load.

**What to point out:**

1. **Deal Setup header** — Deal structure dropdown = "Construction / mezzanine finance". This drives which config panels appear below.
2. **Facility limit $37.7m, principal $28m** — matches the term sheet.
3. **Two tranches** side-by-side:
   - Tranche A — Investor A · $26m
   - Tranche B — Investor B · $2.06m
4. **Barrenjoey's role** — Lender role dropdown = **Arranger / manager**, not Lender of record. This is critical: the platform correctly represents that Barrenjoey isn't the principal lender — the two investors are.

**Talking point:**

> Notice how the Deal structure at the top drives which config sections appear. If I pick a corporate term loan or bilateral facility, all the mezz-specific fields go away. FirstAg later will show the same platform with a totally different set of panels — Borrowing base configuration instead of Construction / mezz support.

---

## Act 2 — Coupon mechanics: the split (2 min)

**Action:** Scroll to **Tranches** section. Click on Tranche A to expand. Scroll to the **PIK / Capitalise coupon** subsection.

**What to point out:**

1. **PIK / capitalise coupon = on**, capitalisation frequency = monthly.
2. **Interest component** shows 16.5% p.a. FIXED — capitalised in arrears.
3. **Cash-serviced coupon** = 6% p.a., **Start year** = 2, **Cap on cash servicing** = $3,060,000.
4. **Live schedule preview** below shows the projected annual cash-servicing payments — first payment 2 weeks before year-2 anniversary, then each subsequent year, stopping when cap is reached.

**Talking point:**

> This is one of the trickiest parts of the term sheet. The 16.5% coupon is capitalised monthly — normal. But Investor A's 6% cost-of-capital carve-out gets **cash-serviced annually from year 2**, capped at $3.06m. Our engine projects that schedule live. When we run the waterfall in a few minutes, the capitalised coupon balance you see there will already be **net of the cash-serviced payments** that have already been made. You'll see the number pre-fill exactly that way.

---

## Act 3 — Cost overrun + drawdown gating (3 min)

**Action:** Scroll up to **Construction / mezz support** section.

**What to point out:**

1. Senior debt provider, senior limit ($130m illustrative), as-if-complete value ($187.5m), TDC ($181m), QPS ($46.5m), NRV ($187.5m), MinNAV ($15m).
2. **Cost-overrun guarantee** = 10% of TDC — the field shows a live-computed **"Obligor guarantee: $18.1m"** underneath.
3. **Overrun funding rate** = 500 bps (facility IRR + 5%) — the rate the investor charges if they choose to fund an overrun the obligors didn't.
4. **Availability period** = 30 days → live text underneath shows *"Window closes 2026-05-30"*.
5. **Minimum drawdown** = $5,000,000.
6. **Drawdown basis** = Cost-to-complete (QS-verified).
7. **Require QS progress evidence on each drawdown** = ✓.

**Action:** Scroll back to Tranche A → Drawdowns.

**What to point out:**

- Each drawdown row has an **inline shield icon** — green = passes gating, amber = warnings (e.g. QS evidence missing), red = hard errors (e.g. below min draw or outside window with non-CTC basis).
- Each row has a **reason / QS evidence** field. If left blank on a QS-required deal, an amber warning fires with a hover tooltip.

**Talking point:**

> The term sheet is very specific about drawdown mechanics — 30-day availability, $5m minimum, progressive on cost-to-complete against QS-verified progress. The platform enforces those rules **at the row level**. If a Barrenjoey ops person tries to log a $2m draw or a draw after the window closed, they get a shield-x with a specific error.

---

## Act 4 — Guarantors + NAV covenant (2 min)

**Action:** Scroll to **Guarantors & NAV covenant** section (should be auto-open because data exists).

**What to point out:**

1. **Summary strip** at top:
   - Total qualifying assets: **$18,600,000**
   - Min NAV covenant: **$15,000,000**
   - Badge: **Compliant** (green pill)
   - "$18.6m vs $15m Min NAV covenant · 2 guarantors · tested at financial close + every 6 months"
2. **Two guarantor cards:**
   - **Sponsor Holdings Pty Ltd** (corporate) — $3.5m cash (ANZ) + $8.2m Sydney CBD commercial (CBRE) = **$11.7m**
   - **Individual Guarantor (redacted)** — $4.8m Mosman residence (Herron Todd White) + $2.1m ASX securities (CommSec) = **$6.9m**
3. Each qualifying-asset row: kind (cash / AU real estate / liquid securities / other), description, valuation, valuation date, valuer name, doc ref.
4. **Next NAV test** badge on each card — auto-computed = last test + 6 months.

**Talking point:**

> Each guarantor's qualifying assets are itemised — cash, real estate, securities — with independent valuer names and doc references. The MinNAV covenant on the Watchlist reads this sum live, not a manually-entered "last reported value" field. When a new valuation comes in, you overwrite one row, the summary updates, the covenant re-evaluates.

---

## Act 5 — Legal & compliance (1 min)

**Action:** Scroll to **Legal & compliance** section.

**What to point out (quick):**

- Target financial close date: 2026-04-30
- Intercreditor deed ref: placeholder for post-execution
- Reimbursement min budget: $60,000
- Governing law: NSW
- **s128F Public Offer** = ✓
- **No prepayment without investor consent** = ✓

**Talking point:**

> All the binding-provision metadata from the term sheet is captured as first-class fields, not stuffed into a notes column. Filterable, reportable, auditable.

---

## Act 6 — Fees (2 min)

**Action:** Scroll to **Fees** section.

**What to point out:**

Five fees, each with per-tranche attribution + IFRS treatment tags:

1. **Upfront Fee — Investor A** · 2% × Facility Limit · one-off at close · **Investor A only** (trancheRef = Tranche A)
2. **Barrenjoey origination fee** · 1.25% · from proceeds of Upfront Fee · ASC310-20 EIR
3. **Barrenjoey base management fee** · 50 bps p.a. on drawn balance · annual · ASC606 over time
4. **Barrenjoey performance fee** · 20% over 16% IRR hurdle · IRR-hurdle mode
5. **Investor B tiered exit fees** · IRR-hurdle tiers editor showing all three tiers verbatim:
   - Tier 1: 20% until Investor B 20% IRR
   - Tier 2: 22.5% until Investor B 30% IRR
   - Tier 3: 20% residual (paid to Borrower as Exit Fee)

**Talking point:**

> Two things to highlight. First, Barrenjoey's fees (origination, management, performance) are correctly attributed to Barrenjoey the manager, not the lending investors. Second, the Investor B exit-fee tiers aren't a text description — they're a structured editor. The waterfall engine reads those tiers directly and applies them in the cash cascade.

---

## Act 7 — Waterfall of Payments (5 min) — **the money shot**

**Action:** Click **Waterfall** in the sidebar (with the hierarchy icon). Barrenjoey should be pre-selected in the deal picker.

**What to point out on the modal:**

1. Deal picker at top shows Barrenjoey selected.
2. **Left pane** — 7 tiers configured per term sheet:
   - Tier 1: Sales / project costs / GST (deduction)
   - Tier 2: Senior debt (debt service)
   - Tier 3: Cost Overrun Funding (debt service)
   - Tier 4: Facility Principal pro-rata to Investor A + B
   - Tier 5: Capitalised Coupon pro-rata to Investor A + B
   - Tier 6: Borrower Equity
   - Tier 7: IRR-hurdle exit fees to Investor B (with 3 sub-tiers)
3. **Right pane — inputs:**
   - Sale proceeds
   - Costs (tier 1 override)
   - Senior debt outstanding
   - Cost overrun outstanding
   - Per-tranche principal + capitalised coupon — **note the pre-filled coupon value is net of the cash-serviced payments already made** (small hint text under each field explains this)
   - Borrower equity
   - IRR-hurdle amounts per sub-tier

**Action:** Enter demo values:

| Field | Value |
|---|---|
| Sale proceeds | 245,000,000 |
| Costs (tier 1) | 8,500,000 |
| Senior debt | 130,000,000 |
| Cost overrun | 0 |
| Borrower equity | 12,682,026 |
| IRR-hurdle amount T1 (20% IRR) | 15,000,000 |
| IRR-hurdle amount T2 (30% IRR) | 20,000,000 |

(Tranche A + B pre-fill their own principal + coupon. Leave them.)

**Click "Run waterfall"**

**What to walk through in the result:**

1. Tier-by-tier cascade table shows: consumed at each tier, remaining after, notes.
2. **Per-recipient totals** at the bottom — Sponsor + Senior lender + Cost overrun + Investor A + Investor B + Borrower — clearly broken out.
3. Verify Investor A's coupon return matches expectation (16.5% × time × principal minus cash-served).
4. Verify Investor B receives their tiered exit fees on top of principal + coupon.

**Talking point:**

> This is the differentiator. Most loan-admin platforms model tranche accruals fine but stop at "principal + coupon" for exit. Barrenjoey's mezz waterfall has 7 tiers with an IRR-hurdle profit-share at the end — that's a hedge-fund-style computation grafted onto a bank-loan-admin platform. Ours runs it in one click and shows the recipient-level breakdown.

---

## Act 8 — Ongoing monitoring (3 min)

**Action:** Close the waterfall modal. Click the **Cashflow** tab (Stage 1).

**What to point out (quick tour):**

- Daily accrual schedule
- Capitalised coupon events per tranche
- Rows tied back to source drawdowns

**Action:** Click the **Accounting** tab (Stage 2). Click "Run accounting".

**What to point out:**

- Journal entries post: drawdowns (Dr Loan / Cr Cash), coupon accruals (Dr Interest Rec / Cr Interest Income), fees (per IFRS treatment tag — arrangement into EIR, management into revenue over time).
- **JE Trace** subtab shows drill-down to source event.

**Action:** Click **Notices** in the sidebar. Filter to Barrenjoey.

**What to point out:**

- 36 notices already derived: drawdown notifications, coupon capitalisation events, upcoming payment reminders.

**Action:** Click **Watchlist** in the sidebar.

**What to point out:**

- Barrenjoey appears with all 5 covenants tested:
  - LVR (construction) vs 89.4% cap
  - LTC vs 92.7% cap
  - RLVR vs 86% cap
  - MinNAV — reads guarantor sum ($18.6m ≥ $15m)
  - MinPresales vs $46.5m

**Talking point:**

> Everything I've shown you so far — deal setup, guarantors, waterfall — feeds into Watchlist + Dashboard live. When a valuation certificate arrives, ops updates one field, the LVR covenant re-evaluates, if it breaches a notice auto-posts to the Notices inbox.

---

## Act 9 — Access control (2 min) — **enterprise credibility**

**Action:** Scroll to **Deal Setup → Access & assignments**.

**What to point out:**

- **Assigned team** dropdown — this deal can be attached to a team
- **User dropdown** with all workspace users (Ferhat, Paul, Marija) — grant direct access

**Action:** Click **Manage teams** in the sidebar (visible because you're admin).

**What to point out:**

- **Workspace admins** section at the top — every user with an admin toggle. Try flipping Paul to admin and back — instant, with the last-admin guardrail. Sign in and out logs show up.
- **Create team** + assign members below.

**Talking point:**

> Row-level security on the DB — a non-admin user like Paul only sees deals he's assigned to (directly or via a team). Ops teams for RE deals see the RE book, ag teams see the ag book. Admin sees everything. This is table-stakes for a shared workspace serving multiple deal desks.

---

# DEAL 2 — Barrenjoey FirstAg Livestock (~15–18 min)

## Transition (30 sec)

> Same platform. Different deal. From the picker, I'm switching to FirstAg Livestock.

**Action:** Header deal picker → **"Barrenjoey FirstAg Livestock — Example 2 (anonymised)"**.

## Act 1 — Structure difference (2 min)

**What to immediately point out:**

1. **Deal structure dropdown** = "Revolving borrowing base"
2. **Construction / mezz support panel is GONE** — irrelevant for this deal, so hidden
3. **New panel visible: Borrowing base configuration**
4. **Guarantors + Legal panels still there** — those are universal

**Talking point:**

> This is what the Deal structure dropdown does — hides sections that don't apply. FirstAg doesn't have senior debt, LVR/LTC/RLVR, or cost-overrun mechanics. It has borrowing-base mechanics. So the UI changes accordingly.

---

## Act 2 — Facility sizing + BB config panels (3 min)

**Action:** Expand **Borrowing base configuration** section.

**What to point out:**

1. Facility limit **$40m** (on facility card above)
2. Backgrounding sub-limit **$8m** · 60-day cap on uncontracted commodities
3. Max utilisations outstanding **26**
4. Min utilisation amount **$100,000**
5. Extension option **364 days** · Extension notice **3 months**
6. Below the sizing fields, **three sub-panels**:
   - **Eligible asset classes (6)** — table with add/edit/delete: breeding (0%), backgrounding uncontracted (100% × purchase), backgrounding contracted (80% × NRV), feedlot uncontracted (100%), feedlot contracted (80%), insured receivable (85%)
   - **Approved locations (16)** — table showing Location 1..16 with access structure (guarantor-owned, third-party feedlot, third-party agistment) and commodity groups
   - **Approved offtakers (7)** — 6 named offtakers + 1 Trade Credit Insurance policy fallback, each with contract method + target days on feed

**Action:** Click one asset class row — try editing the advance rate from 80 to 85, click save. Toast confirms. When we open the Borrowing base modal next, the live compute will pick up the new rate.

**Talking point:**

> Every FirstAg-specific configuration is editable in the UI — asset classes, locations, offtakers. Not hardcoded, not in a config file. If Barrenjoey adds a 17th approved location or a new offtaker, an ops user makes the change without engineering.

---

## Act 3 — Guarantors (1 min)

**Action:** Scroll to **Guarantors & NAV covenant** section.

**What to point out:**

- **5 guarantors seeded** matching the term sheet (Schedule 1): 1 corporate parent + 4 as trustees of property trusts
- **Total qualifying assets: $25.9m**
- Each guarantor card shows sample AU real estate valuations from independent valuers

**Talking point:**

> Same guarantor registry pattern as RE Mezz. Every deal — mezz, revolver, borrowing base — can have guarantors with qualifying-asset breakdowns. Universal panel.

---

## Act 4 — Fees (2 min)

**Action:** Scroll to **Fees**.

**What to point out:**

1. **Establishment fee** · $400,000 flat · one-off at close · **Deduct from 1st draw** = ✓
2. **Undrawn fee (40% of margin, ramp mechanic)** · mode = **Undrawn (ramp)** · **Ramp limit $30m** · **Ramp months 4** · **Cancel trigger $30m drawn** · **280 bps** (= 40% × 700 bps margin)

**Talking point:**

> The undrawn-fee ramp is the term sheet's most distinctive fee gimmick. During the first 4 months (or until loans exceed $30m), the undrawn fee is calculated as if the facility limit were $30m rather than $40m. Reduces borrower fee drag while they're ramping utilisation. The engine handles it — first-class mode, not a workaround.

---

## Act 5 — Borrowing Base modal (5 min) — **the money shot for FirstAg**

**Action:** Click **Borrowing base** in the sidebar (scale icon).

**What to point out in the modal:**

1. Deal picker at top — FirstAg selected under **"Borrowing-base deals"** group
2. **Config summary strip** — facility limit, sub-limit, max util
3. **Left pane — Live inventory (5 rows):**
   - Contracted feedlot @ Location 4 · 200 head · $480k NRV · 60d on feed
   - Contracted feedlot @ Location 5 · 150 head · $360k NRV · 45d on feed
   - Uncontracted backgrounding @ Location 10 · 80 head · $96k purchase · 30d
   - Uncontracted backgrounding @ Location 11 · 60 head · $72k purchase · 55d
   - Eligible insured receivable · $250k invoice face · 5d old
   - Days-on-feed badges colour-coded (green under 60d, amber over 60d, red over 90d for uncontracted)
4. **Right pane — Computed borrowing base:**
   - **$1,089,700** — headline number
   - Breakdown by asset class with contribution per class
   - Backgrounding sub-limit tracker (used vs $8m cap)
5. **Certificates:**
   - 1 approved certificate at today's date

**Action:** Add a new inventory row → base updates live. Then edit an existing row's value → base recomputes.

**Action:** Click **Submit certificate**. Toast confirms. Row appears as "submitted". Click **Approve** on it. Moves to "approved" pill.

**Talking point:**

> The borrowing base is computed live from inventory rows. Any change — new stock in, receivables collected, prices updated — recomputes the base immediately. When the ops team submits a Borrowing Base Certificate, it captures a dated snapshot with the breakdown. The Facility Manager reviews and approves or rejects. That workflow drives what the borrower can draw against.

---

## Act 6 — Cashflow simulator (3 min) — **new for FirstAg**

**Action:** Stay in the Borrowing base modal. Scroll the right column to **Cashflow simulator**.

**What to point out:**

- **Summary strip:**
  - Outstanding **$12,000,000** (from the $12m drawdown seeded at close)
  - Utilisation **30%**
  - All-in rate **11.35%** (BBSY 4.35% + 700 bps)
  - Interest / 7 days: **$26,120**
  - Interest / 30 days: **$111,945**

**Action:** In the Simulate inflow form:
- Days: **7**
- Amount: **250000**
- Kind: **Receivable**
- Click **Apply**

**What to point out in the result:**

- Interest accrued (7d @ 11.35%): $26,120
- Interest paid from inflow: $26,120
- Principal reduced: $223,880
- **New outstanding: $11,776,120**
- New utilisation: 29.4%

**Action:** Try again with a **Drawdown** of $5m, days=0.
- Interest paid: $0 (paid on schedule)
- Principal added: $5m
- **New outstanding: $16,776,120**
- New utilisation: 41.9%

**Talking point:**

> This is a demo calculator — pure engine, not persisted. But it proves the numbers. The daily accrual is `principal × 11.35% / 365` per day. Weekly interest = daily × 7. When a receivable comes in, we cover accrued interest first then reduce principal. When a drawdown comes in, it just adds to outstanding. Same engine that would run every night on real production data.

---

## Act 7 — Livestock covenants (2 min)

**Action:** Close the Borrowing base modal. Click **Watchlist** in sidebar.

**What to point out:**

- FirstAg shows in the list with 6 covenants:
  - **Livestock aging (contracted)** — max days on feed among contracted rows, threshold 180 days (target 150 + 30 grace). Current: 60 days (compliant).
  - **Livestock aging (uncontracted)** — max days among uncontracted, threshold 90. Current: 55 days (compliant).
  - **Utilisation count** — 1 utilisation open, threshold 26 (compliant with 25 headroom).
  - Permitted indebtedness cap ($200k), Trade credit threshold ($1m), Significant disposal % (20%) — awaiting reported values.

**Talking point:**

> Livestock-specific covenants. The aging covenants read the inventory rows live — no manual "last reported value" needed. If an uncontracted animal sits in a paddock for 91 days, the covenant fires that night and posts a notice. This is why the borrowing base isn't just a compute — it's the source of truth for a whole class of covenants.

---

# Closing (2 min)

**Verbal:**

> Two deals. Same platform. Both structurally very different from a plain corporate term loan — one construction mezz with 7-tier waterfall and IRR-hurdle exit fees, one revolving borrowing base with NLIS livestock and receivables. Both live end-to-end.
>
> Behind what you've seen:
> - Row-level security on every table so different desks see different deals
> - Admin controls for team + user management
> - Full IFRS 9 EIR / ASC 606 accounting engine for the fees
> - Waterfall engine with 7 tier kinds usable for any mezz deal
> - Borrowing base engine usable for any commodity or receivable
> - Guarantor registry + covenant engine that both deals share
>
> Three things still in progress:
> - **Reporting cadence scheduler** — auto-notice generation for overdue quarterly / annual reports. ~1 week.
> - **Extension request workflow** for FirstAg's 364-day option. ~4 hours.
> - **Site inspection workflow** for FirstAg's stock-on-hand reconciliation. ~1 day.
>
> Every mechanic in the term sheets that we're currently modelling was built specifically for this RFP.
> Happy to answer questions.

---

# Contingency notes (if something breaks)

| Symptom | Fix |
|---|---|
| Borrowing base modal shows "no BB deals" | Check `SB.connected` in console; hard-refresh; verify FirstAg row exists in DB |
| Cashflow simulator shows Outstanding $0 | Drawdown seed didn't hydrate. In console: `window.__bbActiveDeal.tranches[0].drawdowns` — should be non-empty. If empty, refresh. |
| Guarantors panel empty on FirstAg | `PCS.createFirstAgLivestockInDB()` was called after seed but before guarantor upsert — re-run seed |
| Waterfall run shows $0 for everyone | Sale proceeds not entered — always start with a positive sale proceeds |
| Icons render as raw text | Icon shim didn't complete — hard-refresh |
| "Save the deal first" on Access panel | Deal wasn't saved via `saveDeal` — it's still local Builder state. Click Save first. |

---

# Cheat sheet — DevTools one-liners

Useful during demo prep OR live if a reviewer asks a specific question.

```javascript
// Re-seed FirstAg from scratch (deletes nothing — creates a new deal)
await PCS.createFirstAgLivestockInDB()

// Re-seed Barrenjoey RE Mezz from scratch
await PCS.createBarrenjoeyREMezzInDB()

// Show the interest reconciliation math
PCS.reconcileInterest({ principal: 30_000_000, ratePct: 11.35, tenorDays: 7, dayCount: 365 })
// → dailyAccrual: 9328.77, periodInterest: 65301.37

// Show projected cash-servicing schedule for Investor A
PCS.projectCouponServicingSchedule(
  B.tranches[0], B.deal.settle, B.deal.maturity
)

// Show what a waterfall would return for arbitrary inputs
PCS.computeWaterfall(B.waterfall, /* sale proceeds */ 245_000_000, {
  seniorDebtOutstanding: 130_000_000,
  costOverrunOutstanding: 0,
  borrowerEquity: 12_682_026,
  tranches: [
    { name: 'Investor A', principalBalance: 26_000_000, capitalisedCouponBalance: 12_000_000 },
    { name: 'Investor B', principalBalance:  2_060_000, capitalisedCouponBalance:    950_000 }
  ],
  irrHurdleAmounts: { 7: [15_000_000, 20_000_000] }
})

// Sign in as a non-admin to show access-control (paste user's email + password)
await SB.signInWithPassword('paul.landi@fisglobal.com', 'PASSWORD')
```
