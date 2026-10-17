-- ═══════════════════════════════════════════════════════════════════════
-- seed-reference.sql — PCS Loan Module V4 reference data
-- Generated 2026-10-16 from Supabase project prljhhyfgzipjnfpztfu
-- ═══════════════════════════════════════════════════════════════════════
--
-- Restore AFTER schema.sql. Produced by generate-seed.sql; regenerate rather
-- than hand-editing. Every insert is `on conflict do nothing`, so re-running
-- is safe and will not overwrite anything a user has since changed.
--
-- REFERENCE DATA, NOT DEMO DATA. Ten tables, 865 rows:
--
--   accounting_frameworks        4   IFRS / USGAAP / ASPE / AASB definitions
--   gl_frameworks                4   the same four, as GL mapping scopes
--   gl_accounts                 58   chart of accounts
--   gl_business_events          24   the event vocabulary the engine posts
--   gl_event_mappings           96   4 frameworks × 24 events → DR/CR
--   gl_transtype_mappings       26   legacy transtype → account fallback
--   cashflow_column_config      18   Cashflow tab column composition
--   holiday_calendars            7   calendar definitions
--   holiday_dates              611   the dates themselves
--   preset_catalog              17   demo deal build definitions
--                              ───
--                              865
--
-- Without these the application starts, looks correct, and produces wrong
-- journals: the GL mapping screen is empty, every business event posts
-- nowhere, no payment date rolls for a holiday, and the Cashflow tab has no
-- columns. A missing seed is not a visible failure, which is why the expected
-- row counts are repeated at the foot of this file.
--
-- DELIBERATELY EXCLUDED — one client's demo content, not configuration:
--   deals, facilities, tranches, interest_*, fees, covenants,
--   accounting_runs, journal_entries (~18k rows), cashflow_schedules (~222k),
--   external_*, loan_notices, borrower_financials, document_extractions
-- The demo deals are reproducible from loan-module-instruments.js and
-- preset_catalog below, which is a cleaner route than copying rows because it
-- exercises the save path you are shipping.
--
-- created_by, updated_by and team_id are NULL throughout. They point at
-- auth.users and teams rows that do not exist in a fresh database, and a
-- foreign key violation partway through leaves half the reference data
-- loaded. NULL is honest: nobody in the new database created these.
--
-- gl_source_accounts is NOT here. It is a view over journal_entries.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- Seeding runs as service_role to bypass RLS. If your target database has no
-- such role (a plain Postgres rebuild via 00-auth-shim.sql), the shim creates
-- it; if you removed that, comment this line out and seed as the owner.
set local role service_role;

-- ═══ accounting frameworks (4) ═══
-- Drives every citation string the UI shows and the ECL model it selects:
-- 'staged' (IFRS/AASB three-stage), 'cecl' (USGAAP lifetime, no stages),
-- 'incurred' (ASPE binary trigger). ASPE's mod_threshold is NULL on purpose —
-- ASPE has no 10% test.

insert into public.accounting_frameworks (code, label, long_name, chip_class, ecl_model, ecl_formula, ecl_citation, ecl_trace_title, eir_citation, fv_citation, mod_citation, mod_threshold, hedge_citation, fx_citation, waterfall_citation, fee_eir_value, fee_eir_label, fee_overtime_value, fee_overtime_label, fee_pointintime_value, fee_pointintime_label, created_at) values
  ('IFRS', 'IFRS', 'IFRS (International Financial Reporting Standards)', 'blue', 'staged', 'PD × LGD × EAD × stage_curve × macro_overlay', 'IFRS 9 §5.5', 'IFRS 9 §5.5.17 — Expected Credit Loss formula', 'IFRS 9 §B5.4', 'IFRS 13 §93', 'IFRS 9 §5.4.3', '10% PV test (substantial)', 'IFRS 9 §6', 'IAS 21', 'IAS 1 §54', 'IFRS9-EIR', 'IFRS 9 — capitalised into EIR', 'IFRS15-overTime', 'IFRS 15 — recognised over time', 'IFRS15-pointInTime', 'IFRS 15 — recognised point-in-time', '2026-06-14T03:12:38.019108+00:00'),
  ('USGAAP', 'US GAAP', 'US GAAP (FASB ASC)', 'green', 'cecl', 'lifetime_PD × LGD × EAD × Q-factor', 'ASC 326 (CECL)', 'ASC 326-20-30-2 — Current Expected Credit Loss (lifetime, no stages)', 'ASC 310-20-35', 'ASC 820', 'ASC 470-50/60', '10% cash-flow test (TDR removed per ASU 2022-02)', 'ASC 815', 'ASC 830', 'ASC 310-10-50', 'ASC310-20-EIR', 'ASC 310-20 — capitalised into EIR', 'ASC606-overTime', 'ASC 606 — recognised over time', 'ASC310-20-pointInTime', 'ASC 310-20 — recognised point-in-time', '2026-06-14T03:12:38.019108+00:00'),
  ('ASPE', 'Canadian ASPE', 'ASPE (Accounting Standards for Private Enterprises)', 'red', 'incurred', 'allowance recognised only when objective evidence of impairment exists', 'ASPE 3856.16-19', 'ASPE 3856 — Incurred-loss impairment (binary trigger)', 'ASPE 3856.16', 'ASPE 3856', 'ASPE 3856.27', null, 'ASPE 3856.A53', 'ASPE 1651', 'ASPE 1521', 'ASPE3856-EIR', 'ASPE 3856 — capitalised into EIR', 'ASPE3400-overTime', 'ASPE 3400 — recognised over service period', 'ASPE3400-pointInTime', 'ASPE 3400 — recognised point-in-time', '2026-06-14T03:12:38.019108+00:00'),
  ('AASB', 'AASB (Australian)', 'AASB (Australian Accounting Standards Board)', 'amber', 'staged', 'PD × LGD × EAD × stage_curve × macro_overlay (FLI per AASB 9 §5.5.17)', 'AASB 9 §5.5', 'AASB 9 §5.5.17 — Expected Credit Loss (forward-looking information)', 'AASB 9 §B5.4', 'AASB 13 §93', 'AASB 9 §5.4.3', '10% PV test (substantial)', 'AASB 9 §6', 'AASB 121', 'AASB 101 §54', 'AASB9-EIR', 'AASB 9 — capitalised into EIR', 'AASB15-overTime', 'AASB 15 — recognised over time', 'AASB15-pointInTime', 'AASB 15 — recognised point-in-time', '2026-06-14T03:12:38.019108+00:00')
on conflict do nothing;

-- ═══ GL frameworks (4) ═══
-- gl_event_mappings.framework_code matches gl_frameworks.code by value, not
-- by foreign key. Adding a framework here does not create its 24 mappings.

insert into public.gl_frameworks (id, code, label, sort_order, is_builtin, is_active, team_id, created_by, created_at, updated_at) values
  ('184f3496-293f-44bd-9901-90cf7aa54e88', 'IFRS', 'IFRS', 10, true, true, null, null, '2026-08-21T00:33:32.027792+00:00', '2026-08-21T00:33:32.027792+00:00'),
  ('d1b69349-b8b3-4186-9568-4eec34e1f639', 'USGAAP', 'US GAAP', 20, true, true, null, null, '2026-08-21T00:33:32.027792+00:00', '2026-08-21T00:33:32.027792+00:00'),
  ('185d8eca-f2da-4596-bfd6-31c6eb8d999e', 'ASPE', 'ASPE', 30, true, true, null, null, '2026-08-21T00:33:32.027792+00:00', '2026-08-21T00:33:32.027792+00:00'),
  ('3c03459e-6b36-498a-ace6-553b9c3167de', 'AASB', 'AASB', 40, true, true, null, null, '2026-08-21T00:33:32.027792+00:00', '2026-08-21T00:33:32.027792+00:00')
on conflict do nothing;

-- ═══ GL chart of accounts (58) ═══
-- Two generations of codes coexist: short legacy codes (15000, 23000, 40100…)
-- and six-digit Investran-aligned codes (141000, 421000, 470000…). Both are
-- live — gl_event_mappings references the six-digit set, gl_transtype_mappings
-- still references some of the short set. Do not prune either without checking
-- both mapping tables.
--
-- Two rows are classified oddly and are reproduced as they stand in the
-- source, not corrected here:
--   23000  'Interest Income Accrued' is account_class 'Income' although the
--          name and its use (accrued interest receivable) are an asset.
--   40110  'EIR Fee Accretion Offset' is account_class 'Asset' under a 4xxxx
--          income code.
-- Both are reachable from the GL Mapping screen, so a reclassification is a
-- data change, not a schema change.

insert into public.gl_accounts (account_code, account_name, account_class, account_subclass, description, is_active, framework_specific, created_at, updated_at) values
  ('10000', 'Operating Cash', 'Asset', 'CashAndEquivalents', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('111000', 'Cash', 'Asset', 'CashAndEquivalents', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('113000', 'Accounts Receivable', 'Asset', 'CurrentAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('141000', 'Investments at Cost', 'Asset', 'LoanAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('142000', 'Equity Investments at FV', 'Asset', 'EquityInvestment', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('14500', 'Loan Write-Off — Allowance Applied', 'Asset', 'ContraAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('145000', 'Loan Loss Allowance (Contra-Asset)', 'Asset', 'ContraAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('146000', 'Hedged Loan Adjustment', 'Asset', 'LoanAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('146100', 'Hedged Loan FV Adjustment', 'Asset', 'LoanAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('15000', 'Loan Asset', 'Asset', 'LoanAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('15500', 'Loan Loss Allowance (Contra-Asset)', 'Asset', 'ContraAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('16000', 'Hedging Instrument MTM', 'Asset', 'DerivativeAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('160000', 'Loan Write-Off', 'Asset', 'WrittenOff', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('23000', 'Interest Income Accrued', 'Income', 'InterestIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('23100', 'Non-Use Fee Receivable', 'Asset', 'CurrentAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('23130', 'Default Interest Receivable', 'Asset', 'CurrentAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('23140', 'Default Fee Receivable', 'Asset', 'CurrentAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('23150', 'Fee Receivable', 'Asset', 'CurrentAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('232000', 'Unsettled Trade Payable', 'Liability', 'CurrentLiability', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('23900', 'Franking Credit Receivable', 'Asset', 'CurrentAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('24500', 'GST Payable — 10% on Taxable Supply', 'Liability', 'CurrentLiability', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('35000', 'Cash Flow Hedge Reserve (OCI)', 'OCI', 'HedgeReserve', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('360000', 'Hedge Reserve / Cost of Hedging', 'OCI', 'HedgeReserve', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('370000', 'FX Hedge Reserve (OCI · FX Principal)', 'OCI', 'HedgeReserve', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('375000', 'FX Hedging Instrument MTM', 'Asset', 'DerivativeAsset', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('40100', 'Interest Income — Loan Carrying', 'Income', 'InterestIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('40110', 'EIR Fee Accretion Offset', 'Asset', 'CarryingValueAdj', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('40130', 'Default Interest Income', 'Income', 'PenaltyIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('40140', 'Default Fee Income', 'Income', 'PenaltyIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('40150', 'Discount Accretion / Premium Amort', 'Income', 'AmortIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('40200', 'Non-Use Fee Income', 'Income', 'FeeIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('40250', 'Generic Fee Income (legacy)', 'Income', 'FeeIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('40300', 'Dividend Income (legacy)', 'Income', 'OtherIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('40310', 'Franking Credit Income — Imputation Gross-Up', 'Income', 'OtherIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('421000', 'Investment Interest Income', 'Income', 'InterestIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('421500', 'Default Interest Income', 'Income', 'Interest Income', 'Penalty / default-rate interest, shown separately from contractual interest.', true, null, '2026-10-08T11:21:52.274317+00:00', '2026-10-08T11:21:52.274317+00:00'),
  ('44000', 'Modification Gain/Loss (IFRS 9 §5.4.3)', 'Income', 'OtherIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('440000', 'Modification Gain/Loss', 'Income', 'OtherIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('442000', 'Gain on Loan Sale', 'Income', 'OtherIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('442100', 'Restructuring Gain — D4E', 'Income', 'OtherIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('45000', 'FX Revaluation Gain/Loss', 'Income', 'FXIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('450000', 'Other Hedge Income', 'Income', 'HedgeIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('45100', 'Hedge Reclass to P&L / Ineffectiveness', 'Income', 'HedgeIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('451000', 'Hedge Reserve Recycle to P&L', 'Income', 'HedgeIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('45200', 'Fair Value Hedge P&L', 'Income', 'HedgeIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('452000', 'Hedge Ineffectiveness Loss', 'Expense', 'HedgeExpense', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('47000', 'Loan Write-Off — Residual Expense', 'Expense', 'ImpairmentExpense', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('470000', 'Impairment Expense (ECL)', 'Expense', 'ImpairmentExpense', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('470100', 'Recovery — Previously Written-Off', 'Income', 'OtherIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('492000', 'Other Income — Amendment Fees', 'Income', 'FeeIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('492100', 'Arrangement Fee Income', 'Income', 'FeeIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('492200', 'Commitment Fee Income', 'Income', 'FeeIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('492300', 'Guarantee Fee Income', 'Income', 'FeeIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('492400', 'Management Fee Income', 'Income', 'FeeIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('492500', 'Dividend Income (Equity – IFRS 15)', 'Income', 'OtherIncome', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('542000', 'Loss on Loan Sale', 'Expense', 'OtherExpense', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('542100', 'Restructuring Loss — D4E', 'Expense', 'OtherExpense', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00'),
  ('70100', 'Impairment Expense (modern code)', 'Expense', 'ImpairmentExpense', null, true, null, '2026-06-14T03:12:38.019108+00:00', '2026-06-14T03:12:38.019108+00:00')
on conflict do nothing;

-- ═══ business events (24) ═══
-- event_key is the join key the engine uses. gl_event_mappings references it
-- by FK, so renaming one of these breaks every mapping that points at it.

insert into public.gl_business_events (id, event_key, event_label, category, system_trigger, sort_order, is_active, created_at) values
  ('7513505b-ee3e-486b-bddf-6df2f4acf0f2', 'commitment', 'Commitment', 'Funding', 'Facility commitment recognised', 10, true, '2026-08-21T00:33:32.027792+00:00'),
  ('eba93d33-13e0-4c48-ba01-dbca6fea78de', 'drawdown', 'Drawdown', 'Funding', 'Loan Drawdown', 20, true, '2026-08-21T00:33:32.027792+00:00'),
  ('2c8a9eba-0a88-4db0-8aee-85a4fd4e7ae5', 'commitment_fee', 'Commitment Fee', 'Fees', 'Commitment Fee (on undrawn)', 30, true, '2026-08-21T00:33:32.027792+00:00'),
  ('f9caa14c-6151-4177-bcd0-05769e4bced9', 'origination_fee', 'Origination Fee', 'Fees', 'Arrangement Fee', 40, true, '2026-08-21T00:33:32.027792+00:00'),
  ('fb0cc39d-ee65-4d11-8bef-783ee5a700e7', 'interest_accrual', 'Interest Accrual', 'Interest', 'Income - Daily Accrued Interest', 50, true, '2026-08-21T00:33:32.027792+00:00'),
  ('84fa9631-cce7-415a-b43d-1de83e85ed9d', 'interest_receipt', 'Interest Receipt', 'Interest', 'Interest Cash Receipt', 60, true, '2026-08-21T00:33:32.027792+00:00'),
  ('87731b1d-45c6-4508-adbe-9b8130967b81', 'paydown', 'Paydown', 'Repayment', 'Loan Repayment', 70, true, '2026-08-21T00:33:32.027792+00:00'),
  ('cdecd4e6-ca12-4bb3-91ed-bdcba83a7a60', 'prepayment', 'Prepayment', 'Repayment', 'Loan Prepayment', 80, true, '2026-08-21T00:33:32.027792+00:00'),
  ('cb439701-5673-4abd-a722-763ad0aadca1', 'mandatory_prepay', 'Mandatory Prepayment', 'Repayment', 'Mandatory Prepayment', 90, true, '2026-08-21T00:33:32.027792+00:00'),
  ('b3120ace-a43e-44b5-834f-2523eb00ed6d', 'exit_fee', 'Exit Fee', 'Fees', 'Exit Fee', 100, true, '2026-08-21T00:33:32.027792+00:00'),
  ('52890b6f-4a6d-4443-856e-30e1b219e6b8', 'utilisation_fee', 'Utilisation Fee', 'Fees', 'Utilisation Fee', 110, true, '2026-08-21T00:33:32.027792+00:00'),
  ('5b797a4b-0f27-451d-bc71-7bdd5db50188', 'agency_fee', 'Agency Fee', 'Fees', 'Annual Agency Fee', 120, true, '2026-08-21T00:33:32.027792+00:00'),
  ('b09a7910-d766-4b3a-a20f-15f721ba6042', 'eir_accretion', 'EIR Accretion', 'Interest', 'EIR Fee Accretion', 130, true, '2026-08-21T00:33:32.027792+00:00'),
  ('4b4241c1-56b7-40b2-9645-a63b2298de6f', 'ecl_impairment', 'ECL / Impairment', 'Impairment', 'Impairment Expense (ECL)', 140, true, '2026-08-21T00:33:32.027792+00:00'),
  ('b22c2515-0b0d-4d93-95d2-49113d7e4353', 'loan_restructuring', 'Loan Restructuring', 'Modification', 'Modification gain/loss', 150, true, '2026-08-21T00:33:32.027792+00:00'),
  ('786bde94-6808-4b45-ba62-1dcce0a2ae6f', 'write_off', 'Write-Off', 'Loss', 'Write-Off', 160, true, '2026-08-21T00:33:32.027792+00:00'),
  ('8350abd2-e31f-4cda-9405-c340a1d324b9', 'recovery', 'Recovery', 'Recovery', 'Recovery', 170, true, '2026-08-21T00:33:32.027792+00:00'),
  ('24c102ff-019e-4ad4-bd8d-2ed61dbddfea', 'loan_sale', 'Loan Sale', 'Disposal', 'Loan Sale (derecognition)', 180, true, '2026-08-21T00:33:32.027792+00:00'),
  ('c9972c1e-dce8-4e24-a6c9-e6ca6471a0ee', 'participation', 'Participation', 'Disposal', 'Loan Participation', 190, true, '2026-08-21T00:33:32.027792+00:00'),
  ('ceb10bf4-e2ad-4eb0-a9b5-8216259a21b4', 'debt_equity_swap', 'Debt-for-Equity Swap', 'Restructuring', 'Debt-for-Equity Swap', 200, true, '2026-08-21T00:33:32.027792+00:00'),
  ('76957343-a056-425a-bfc0-0650a2cdb32b', 'capitalised_cost', 'Capitalised Costs', 'Fees', 'Capitalised origination costs', 210, true, '2026-08-21T00:33:32.027792+00:00'),
  ('0b4866a3-93fa-47ca-9eee-79c3482a89f4', 'default_interest', 'Default Interest', 'Default', 'Default Interest & Fee', 220, true, '2026-08-21T00:33:32.027792+00:00'),
  ('dcc974fc-aa17-4cd1-aaee-0ebc3f427874', 'pik_capitalisation', 'PIK Capitalisation', 'Interest', 'PIK interest capitalised', 230, true, '2026-08-21T00:33:32.027792+00:00'),
  ('e3fc1871-0cab-458d-80a3-80ef8c706796', 'forbearance', 'Forbearance', 'Modification', 'Forbearance / payment holiday', 240, true, '2026-08-21T00:33:32.027792+00:00')
on conflict do nothing;

-- ═══ transtype → account mapping (26) ═══
-- The legacy path. applyInvestranGLMapping() consults this when a journal row
-- carries a gl_trans_type string rather than an event_key. precedence_order
-- 200 rows are the fallbacks; `feeReceivable` is flagged is_gap because it
-- lands every unmatched fee on 113000 Accounts Receivable rather than a
-- fee-specific receivable. That is a known gap, carried deliberately.

insert into public.gl_transtype_mappings (id, mapping_key, transtype_pattern, account_code, is_dr_leg, is_gap, gap_note, framework_applies, precedence_order, description, created_at) values
  ('80300b05-e66e-4f17-b961-b09ce0ccca35', 'arrangementFeeIncome', 'Arrangement fee income – IFRS 15', '492100', false, false, null, null, 100, 'Arrangement fee income — CR', '2026-06-14T03:12:38.019108+00:00'),
  ('0e0b8882-994c-424e-b442-de7c819ec5c3', 'cashLeg', 'Loan Drawdown — Cash', '10000', false, false, null, null, 100, 'Cash CR on draw', '2026-06-14T03:12:38.019108+00:00'),
  ('cb6805a1-4371-46ee-9b87-e2c718dcc677', 'cashReceipt', 'Cash Receipt', '111000', true, false, null, null, 100, 'Cash settlement DR (catch-all)', '2026-06-14T03:12:38.019108+00:00'),
  ('f2bbe9c7-8308-4eca-a4a4-5bdb4adf3d0b', 'cfhReserve', 'Cash Flow Hedge Reserve (OCI)', '35000', false, false, null, null, 100, 'CFH effective portion — CR OCI', '2026-06-14T03:12:38.019108+00:00'),
  ('e240bf66-7a0b-418e-ac70-198272577a35', 'commitmentFeeIncome', 'Commitment fee income – IFRS 15', '492200', false, false, null, null, 100, 'Commitment fee income — CR', '2026-06-14T03:12:38.019108+00:00'),
  ('a7e18a3c-b0c2-44a8-b138-c2532690f2bd', 'd4eEquity', 'Debt-for-Equity Swap — Equity Recognition', '142000', true, false, null, null, 100, 'Equity DR', '2026-06-14T03:12:38.019108+00:00'),
  ('48e56b7b-3cf8-4803-97cd-63d245e6013e', 'd4eRestructGain', 'Debt-for-Equity Swap — Restructuring Gain', '442100', false, false, null, null, 100, 'Gain on D4E — CR', '2026-06-14T03:12:38.019108+00:00'),
  ('52ccc8c8-f845-4852-ae55-641066fcfed6', 'd4eRestructLoss', 'Debt-for-Equity Swap — Restructuring Loss', '542100', true, false, null, null, 100, 'Loss on D4E — DR', '2026-06-14T03:12:38.019108+00:00'),
  ('541e671f-5606-4f79-a323-9a45e13f3be2', 'dividendIncome', 'Dividend income – IFRS 15', '492500', false, false, null, null, 100, 'Dividend income — CR', '2026-06-14T03:12:38.019108+00:00'),
  ('7725bdf6-cb40-4cf4-af22-f6d9b2121abd', 'frankingCreditIncome', 'Franking Credit Income — Gross-Up', '40310', false, false, null, null, 100, 'AASB franking memo — CR', '2026-06-14T03:12:38.019108+00:00'),
  ('f07e0d80-8de9-459f-a0ea-996756cd693a', 'frankingCreditReceivable', 'Franking Credit Receivable', '23900', true, false, null, null, 100, 'AASB franking memo — DR', '2026-06-14T03:12:38.019108+00:00'),
  ('d0b3b73b-9a7c-4ce3-8ef4-f764e022fc0e', 'gstPayable_aasb', 'GST Payable (10% on Fee)', '24500', false, false, null, null, 100, 'AASB overlay GST split — CR', '2026-06-14T03:12:38.019108+00:00'),
  ('effccde6-c41d-4db6-90e9-cb8acf32339f', 'guaranteeFeeIncome', 'Guarantee fee income – IFRS 15', '492300', false, false, null, null, 100, 'Guarantee fee income — CR', '2026-06-14T03:12:38.019108+00:00'),
  ('8d0a18e5-45c9-4bee-8f24-73177dd4b618', 'hedgingInstrumentMTM', 'Hedging Instrument MTM', '16000', true, false, null, null, 100, 'Hedge instrument DR', '2026-06-14T03:12:38.019108+00:00'),
  ('3b3bd98b-6715-48b4-9038-925e2a80015f', 'impairmentExpense', 'Impairment Expense (ECL)', '70100', true, false, null, null, 100, 'IFRS 9 ECL — DR', '2026-06-14T03:12:38.019108+00:00'),
  ('ce12972e-c5df-4c63-806a-ac75da9dd542', 'interestIncomeAccrued', 'Income - Daily Accrued Interest', '421000', false, false, null, null, 100, 'Interest income — CR', '2026-06-14T03:12:38.019108+00:00'),
  ('1186268a-4106-4d53-b30b-b774914cd8fd', 'interestReceivable', 'Interest Receivable', '113000', true, false, null, null, 100, 'Cash interest accrual — DR', '2026-06-14T03:12:38.019108+00:00'),
  ('d5aa4c65-ca80-444a-85d7-407a75102be1', 'loanDrawdownInitial', 'Loan Drawdown', '141000', true, false, null, null, 100, 'Loan asset DR on draw', '2026-06-14T03:12:38.019108+00:00'),
  ('e964ec19-9985-4b0c-b3ef-e5aa1ed6d5ad', 'loanLossAllowance', 'Loan Loss Allowance (Contra-Asset)', '15500', false, false, null, null, 100, 'IFRS 9 ECL / APRA top-up — CR', '2026-06-14T03:12:38.019108+00:00'),
  ('25b386dd-5d7a-4824-9147-add24be38c14', 'loanSaleDerecog', 'Loan Sale — Asset Derecognition', '141000', false, false, null, null, 100, 'Loan sale CR derecog', '2026-06-14T03:12:38.019108+00:00'),
  ('45642536-7584-4c24-bc56-ec43bce09c7d', 'managementFeeIncome', 'Management fee income', '492400', false, false, null, null, 100, 'Management fee income — CR', '2026-06-14T03:12:38.019108+00:00'),
  ('56ba5590-40d7-4657-b0e4-c5da668bab1d', 'modificationGain', 'Modification Gain (IFRS 9)', '44000', false, false, null, null, 100, 'Modification gain — CR', '2026-06-14T03:12:38.019108+00:00'),
  ('317a8a0b-9e86-4725-8463-33e8c1a0b948', 'modificationLoss', 'Modification Loss (IFRS 9)', '44000', true, false, null, null, 100, 'Modification loss — DR', '2026-06-14T03:12:38.019108+00:00'),
  ('5319f2ad-9b5e-4a14-8d02-9ea83f570452', 'participationDerecog', 'Loan Participation — Asset Derecognition', '141000', false, false, null, null, 100, 'Partial derecog — CR', '2026-06-14T03:12:38.019108+00:00'),
  ('d4e3f69d-58ef-4939-8da9-3cf6ed8bf3c5', 'feeIncome', 'Other fee income / IFRS 15', '492000', false, false, null, null, 200, 'Generic fee income — CR (fallback)', '2026-06-14T03:12:38.019108+00:00'),
  ('9fe02ff4-be60-4b3a-aa03-effeb53fb556', 'feeReceivable', 'Other fee receivable', '113000', true, true, null, null, 200, 'GAP — generic fee receivable falls back to 113000', '2026-06-14T03:12:38.019108+00:00')
on conflict do nothing;

-- ═══ event → DR/CR mapping (96) ═══
-- 4 frameworks × 24 events. This is the table the accounting run actually
-- reads (applyInvestranGLMapping), so a missing row means that business event
-- posts nothing and the run looks clean.
--
-- Two things to know before changing any row:
--
--  1. `forbearance` maps 113000 → 113000 in all four frameworks. Debit and
--     credit are the same account, so the entry nets to nothing. That is
--     deliberate as a placeholder, not a copy error: forbearance changes the
--     schedule, and the accounting consequence is picked up by the
--     re-accretion, not by a separate journal. Leave it or replace it, but do
--     not "fix" it by guessing a second account.
--
--  2. The four frameworks are currently identical row for row. The table
--     exists so they can diverge (ASPE has no ECL staging, USGAAP uses CECL),
--     and the UI lets a user change one framework without the others. Do not
--     collapse this into a cross join.
--
-- `is_suppressed` is the NWF switch: true means the run books neither leg for
-- that event/framework. All 96 ship false.

insert into public.gl_event_mappings (id, event_key, framework_code, dr_account_code, dr_account_name, cr_account_code, cr_account_name, is_custom, notes, team_id, created_by, updated_by, created_at, updated_at, is_suppressed) values
  ('5f52e6ef-3b6d-4eec-a048-668ecdc03bdc', 'agency_fee', 'AASB', '113000', 'Accounts Receivable', '492000', 'Other Income — Amendment Fees', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('6832e318-ab12-4d68-87c2-d0df2a9345ad', 'capitalised_cost', 'AASB', '141000', 'Investments at Cost', '111000', 'Cash', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('f1e11ad7-e464-4656-8221-7d21d977cd27', 'commitment', 'AASB', '141000', 'Investments at Cost', '111000', 'Cash', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('d13d5981-1931-4619-b5d5-f0d077f21952', 'commitment_fee', 'AASB', '113000', 'Accounts Receivable', '492200', 'Commitment Fee Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('387586c3-5796-4540-b210-859e27d2688c', 'debt_equity_swap', 'AASB', '142000', 'Equity Investments at FV', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('21f2274f-5ca9-4766-add3-887a4a7e896c', 'default_interest', 'AASB', '113000', 'Accounts Receivable', '421500', 'Default Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('97353635-9e38-47bc-9e3f-3d60c60d8063', 'drawdown', 'AASB', '141000', 'Investments at Cost', '111000', 'Cash', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('4b349cbd-938d-46f0-be80-91cf2d7cfc81', 'ecl_impairment', 'AASB', '470000', 'Impairment Expense (ECL)', '145000', 'Loan Loss Allowance (Contra-Asset)', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('f7c1beff-1c86-45f1-ae95-e9421718bc39', 'eir_accretion', 'AASB', '141000', 'Investments at Cost', '421000', 'Investment Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('da4310ec-5551-41b8-b465-5e15410d6454', 'exit_fee', 'AASB', '113000', 'Accounts Receivable', '492000', 'Other Income — Amendment Fees', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('126123ac-1eb7-49d5-be9a-30bb9ec07d42', 'forbearance', 'AASB', '113000', 'Accounts Receivable', '113000', 'Accounts Receivable', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('42edbade-fecd-4b30-b455-3368f3f26225', 'interest_accrual', 'AASB', '113000', 'Accounts Receivable', '421000', 'Investment Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('f5f5dfc4-0c74-4de6-a3af-cb6e545cfb79', 'interest_receipt', 'AASB', '111000', 'Cash', '113000', 'Accounts Receivable', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('47d33e38-9551-4dd7-ad95-a215393267b5', 'loan_restructuring', 'AASB', '141000', 'Investments at Cost', '440000', 'Modification Gain/Loss', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('5f96fbd7-2883-4b78-adc3-5fc8c09f0729', 'loan_sale', 'AASB', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('89e1c540-ec79-4f28-b2dc-35baab0beeb7', 'mandatory_prepay', 'AASB', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('983a8562-9845-4096-bb8c-a021053791c9', 'origination_fee', 'AASB', '113000', 'Accounts Receivable', '492100', 'Arrangement Fee Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('ca121132-f484-4209-a1ed-22b15007910f', 'participation', 'AASB', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('ef040d15-4780-48b6-9326-3e550830718c', 'paydown', 'AASB', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('3c09234d-57c5-43a4-97b4-bc1d21520890', 'pik_capitalisation', 'AASB', '141000', 'Investments at Cost', '421000', 'Investment Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('f7a4af7f-c2c2-4fa6-a763-e21d404000ab', 'prepayment', 'AASB', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('cdb131b9-d62a-4bdd-9159-632b0a2630df', 'recovery', 'AASB', '111000', 'Cash', '470000', 'Impairment Expense (ECL)', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('2da38bda-5727-4fd6-9358-7ee071585f45', 'utilisation_fee', 'AASB', '113000', 'Accounts Receivable', '492000', 'Other Income — Amendment Fees', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('88e82d09-5e97-4b43-af76-8fe450d53426', 'write_off', 'AASB', '145000', 'Loan Loss Allowance (Contra-Asset)', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('b4c02698-9797-40da-9eb4-1e2071118c74', 'agency_fee', 'ASPE', '113000', 'Accounts Receivable', '492000', 'Other Income — Amendment Fees', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('5321e088-19f6-4fa3-8ece-df2a3a6d7420', 'capitalised_cost', 'ASPE', '141000', 'Investments at Cost', '111000', 'Cash', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('4869fdfc-f24c-44fe-a1c1-61a52a765c79', 'commitment', 'ASPE', '141000', 'Investments at Cost', '111000', 'Cash', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('2d260d90-45cf-47d9-a328-0509a9cf5844', 'commitment_fee', 'ASPE', '113000', 'Accounts Receivable', '492200', 'Commitment Fee Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('0a768341-45a5-4ab1-ae27-508546fd30bc', 'debt_equity_swap', 'ASPE', '142000', 'Equity Investments at FV', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('585aab3a-eb8e-4498-b210-8a65c29d0c34', 'default_interest', 'ASPE', '113000', 'Accounts Receivable', '421500', 'Default Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('d862764f-964e-4459-bc68-9c14a3a9e6e5', 'drawdown', 'ASPE', '141000', 'Investments at Cost', '111000', 'Cash', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('8d30b3d0-33c3-4fad-b0f6-8d5f93bdfa22', 'ecl_impairment', 'ASPE', '470000', 'Impairment Expense (ECL)', '145000', 'Loan Loss Allowance (Contra-Asset)', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('96eaf4f2-a020-4961-aa6d-3d39d44d8c22', 'eir_accretion', 'ASPE', '141000', 'Investments at Cost', '421000', 'Investment Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('a42ef3af-fdfa-4ac4-891f-359225f37891', 'exit_fee', 'ASPE', '113000', 'Accounts Receivable', '492000', 'Other Income — Amendment Fees', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('732220df-23d0-4d0f-bcb8-0d4e22a54faa', 'forbearance', 'ASPE', '113000', 'Accounts Receivable', '113000', 'Accounts Receivable', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('f8c7cdc6-c990-42bc-88b4-03bbceae249e', 'interest_accrual', 'ASPE', '113000', 'Accounts Receivable', '421000', 'Investment Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('6037c888-7cf1-400a-a1de-d193847f270d', 'interest_receipt', 'ASPE', '111000', 'Cash', '113000', 'Accounts Receivable', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('c110631f-50c9-453b-9c0e-c2b849355a83', 'loan_restructuring', 'ASPE', '141000', 'Investments at Cost', '440000', 'Modification Gain/Loss', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('d3b4bd82-1003-430a-b3f8-1253a18dd328', 'loan_sale', 'ASPE', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('3c4cfbe0-a1f9-4c2b-bf18-d6e33e0dc3a5', 'mandatory_prepay', 'ASPE', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('c04dc212-9d4d-4f5a-9eca-edbbc69bfde7', 'origination_fee', 'ASPE', '113000', 'Accounts Receivable', '492100', 'Arrangement Fee Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('1f20a776-0d4d-474a-9d26-84e507de66a5', 'participation', 'ASPE', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('8f008cbc-d2af-4e7d-bcc2-b69a2c7580af', 'paydown', 'ASPE', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('24f51937-452d-4f52-a9ad-0c4f9b364a0c', 'pik_capitalisation', 'ASPE', '141000', 'Investments at Cost', '421000', 'Investment Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('59b34009-7942-4243-93a0-02af6f57696c', 'prepayment', 'ASPE', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('d785185d-baa4-474a-985e-ae3c581d571b', 'recovery', 'ASPE', '111000', 'Cash', '470000', 'Impairment Expense (ECL)', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('17d0f59a-08b1-4b87-b136-79e010cbdb01', 'utilisation_fee', 'ASPE', '113000', 'Accounts Receivable', '492000', 'Other Income — Amendment Fees', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('cc7ee976-5bf6-4bc3-a5b5-4f3adbb36589', 'write_off', 'ASPE', '145000', 'Loan Loss Allowance (Contra-Asset)', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('dbee7e66-ff60-4645-b378-9d1173cb18fd', 'agency_fee', 'IFRS', '113000', 'Accounts Receivable', '492000', 'Other Income — Amendment Fees', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('1375f350-2502-4586-9a1a-4225eca37a64', 'capitalised_cost', 'IFRS', '141000', 'Investments at Cost', '111000', 'Cash', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('918b9821-4937-4bc8-8b2a-252e92e59b1f', 'commitment', 'IFRS', '141000', 'Investments at Cost', '111000', 'Cash', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-10-08T11:05:45.019496+00:00', false),
  ('7f037b45-6619-4e9b-bffd-3982e32880f5', 'commitment_fee', 'IFRS', '113000', 'Accounts Receivable', '492200', 'Commitment Fee Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('228cd902-351f-4d6a-ba3f-ce48fd242a58', 'debt_equity_swap', 'IFRS', '142000', 'Equity Investments at FV', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('ccf4a948-99a6-4bf6-a891-bf967c79c996', 'default_interest', 'IFRS', '113000', 'Accounts Receivable', '421500', 'Default Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('d45abaa9-f297-4716-a395-3574893abca8', 'drawdown', 'IFRS', '141000', 'Investments at Cost', '111000', 'Cash', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('ae920795-18e7-4f19-a50c-c96487d2142b', 'ecl_impairment', 'IFRS', '470000', 'Impairment Expense (ECL)', '145000', 'Loan Loss Allowance (Contra-Asset)', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('e607ad8f-018a-4c70-ade9-9c658f18a9b0', 'eir_accretion', 'IFRS', '141000', 'Investments at Cost', '421000', 'Investment Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('9f55a869-bbc8-41ed-9681-706d5bbb4207', 'exit_fee', 'IFRS', '113000', 'Accounts Receivable', '492000', 'Other Income — Amendment Fees', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('dca8cd88-024a-40c5-bf93-cdbda13e74ec', 'forbearance', 'IFRS', '113000', 'Accounts Receivable', '113000', 'Accounts Receivable', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-10-08T11:05:45.019496+00:00', false),
  ('3bab9154-a66a-43af-8fd4-4e18e24f73a1', 'interest_accrual', 'IFRS', '113000', 'Accounts Receivable', '421000', 'Investment Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('ec9014c6-eb74-4665-a53a-e3a0b3f22bc1', 'interest_receipt', 'IFRS', '111000', 'Cash', '113000', 'Accounts Receivable', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('8c89bc17-d33f-4019-b883-1a93d1ff6aa6', 'loan_restructuring', 'IFRS', '141000', 'Investments at Cost', '440000', 'Modification Gain/Loss', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-10-08T11:05:45.019496+00:00', false),
  ('c2e91320-59e3-4e0c-8761-7fdacce878cc', 'loan_sale', 'IFRS', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('5314d514-2a34-464e-b93b-3f2590285a66', 'mandatory_prepay', 'IFRS', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('3935e81f-7f1b-4820-a325-afe83c8262f1', 'origination_fee', 'IFRS', '113000', 'Accounts Receivable', '492100', 'Arrangement Fee Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('3e849524-f588-4d94-b876-5ffdce4134d8', 'participation', 'IFRS', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('0808aac7-0b27-4b2e-9467-56e8c4dfaaba', 'paydown', 'IFRS', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('b1ae9713-1c1e-40f9-8c4c-481b38a6f102', 'pik_capitalisation', 'IFRS', '141000', 'Investments at Cost', '421000', 'Investment Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('11130bcb-0ea1-4277-8144-84a2b0424ee0', 'prepayment', 'IFRS', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('2a45ba3f-3cfb-4963-bc52-82ad47801304', 'recovery', 'IFRS', '111000', 'Cash', '470000', 'Impairment Expense (ECL)', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('ff123edd-a3dc-4b29-a75a-b1255085e7cd', 'utilisation_fee', 'IFRS', '113000', 'Accounts Receivable', '492000', 'Other Income — Amendment Fees', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('f3632733-af39-490a-af08-c820eed02044', 'write_off', 'IFRS', '145000', 'Loan Loss Allowance (Contra-Asset)', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('27cb28ae-bbb6-48b6-bf37-62487e5f8564', 'agency_fee', 'USGAAP', '113000', 'Accounts Receivable', '492000', 'Other Income — Amendment Fees', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('9d5f9b73-5b6f-4f31-a0e3-fb7bf82a2037', 'capitalised_cost', 'USGAAP', '141000', 'Investments at Cost', '111000', 'Cash', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('0077ec11-75b8-4c75-bc04-0adae55802aa', 'commitment', 'USGAAP', '141000', 'Investments at Cost', '111000', 'Cash', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('aef70b4d-607c-477d-9fee-c9f3335915c2', 'commitment_fee', 'USGAAP', '113000', 'Accounts Receivable', '492200', 'Commitment Fee Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('05bb315d-3ed9-483a-8916-bc5c30adab69', 'debt_equity_swap', 'USGAAP', '142000', 'Equity Investments at FV', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('e914eea4-0201-428d-8fc6-bd9487cce59e', 'default_interest', 'USGAAP', '113000', 'Accounts Receivable', '421500', 'Default Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('dab22e70-7680-4913-818e-e74c255a526b', 'drawdown', 'USGAAP', '141000', 'Investments at Cost', '111000', 'Cash', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('12fb00db-76e4-4d56-a427-d48ca25cbd3c', 'ecl_impairment', 'USGAAP', '470000', 'Impairment Expense (ECL)', '145000', 'Loan Loss Allowance (Contra-Asset)', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('b64e0bc6-f0da-46d7-a516-b95f8c4dc0a3', 'eir_accretion', 'USGAAP', '141000', 'Investments at Cost', '421000', 'Investment Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('443f8744-1ae1-4f34-86c0-0d99336f3a6b', 'exit_fee', 'USGAAP', '113000', 'Accounts Receivable', '492000', 'Other Income — Amendment Fees', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('408ec0d4-a3b7-4f4a-a641-2f6a39ea360b', 'forbearance', 'USGAAP', '113000', 'Accounts Receivable', '113000', 'Accounts Receivable', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('68f38ec2-5f70-4ea2-8114-4fe059471f38', 'interest_accrual', 'USGAAP', '113000', 'Accounts Receivable', '421000', 'Investment Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('8a1ecfe8-648e-439b-ada2-a763e86c4cfe', 'interest_receipt', 'USGAAP', '111000', 'Cash', '113000', 'Accounts Receivable', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('63a355fc-2de7-4186-ad72-24fe2f9e7bd0', 'loan_restructuring', 'USGAAP', '141000', 'Investments at Cost', '440000', 'Modification Gain/Loss', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('dc28e011-fdff-4247-84d9-230de63e74e0', 'loan_sale', 'USGAAP', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('80ec654f-3f7d-4b88-a10b-1a8c78a21f34', 'mandatory_prepay', 'USGAAP', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('ffc1420f-4650-4bc6-88ce-205ea46dc232', 'origination_fee', 'USGAAP', '113000', 'Accounts Receivable', '492100', 'Arrangement Fee Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('0bc4df68-da33-4612-a27e-6ff70216297d', 'participation', 'USGAAP', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('9b902473-b56c-4569-b3ac-8b75fc2578c3', 'paydown', 'USGAAP', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('a5abe0b3-aba8-4a91-a448-227289f83661', 'pik_capitalisation', 'USGAAP', '141000', 'Investments at Cost', '421000', 'Investment Interest Income', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('9dd06b0a-ea1a-4e43-9fbf-78c3f86d4e09', 'prepayment', 'USGAAP', '111000', 'Cash', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('85241023-6af6-40dc-9ce0-61c9e3a0b59a', 'recovery', 'USGAAP', '111000', 'Cash', '470000', 'Impairment Expense (ECL)', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('d05b0a75-a215-4f57-898d-7d9bab9c139e', 'utilisation_fee', 'USGAAP', '113000', 'Accounts Receivable', '492000', 'Other Income — Amendment Fees', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false),
  ('9e200bc7-0b65-4248-ae81-7cbf8035b5a7', 'write_off', 'USGAAP', '145000', 'Loan Loss Allowance (Contra-Asset)', '141000', 'Investments at Cost', false, null, null, null, null, '2026-08-21T00:33:51.170344+00:00', '2026-08-21T00:33:51.170344+00:00', false)
on conflict do nothing;

-- ═══ cashflow column composition (18) ═══
-- Each row says how one Cashflow-tab column is built. `events` is an ordered
-- list of {event_key, sign} that the front end sums; `is_derived` rows carry
-- no events and are computed from other columns per `derivation`.
--
-- Two things that look like omissions and are not:
--
--  1. The Accretion and Accreted-to-date columns added in V4.67 are NOT here.
--     They are read straight off the schedule row (`accretion`,
--     `accretion_to_date`), not composed from events, so they have no config
--     row. Adding one would not make them configurable.
--
--  2. `outstanding` is not the balance-sheet number and `carrying_value` is.
--     PIK capitalisation raises both; a yield-integral origination fee lowers
--     only the carrying amount. The gap between them is the `Unaccreted`
--     column, which runs to nil at maturity — the quickest check that an
--     accretion is complete.

insert into public.cashflow_column_config (id, team_id, column_key, column_label, sort_order, is_derived, derivation, events, is_active, is_custom, notes, created_by, updated_by, created_at, updated_at) values
  ('7be31c34-0f0d-4f3a-8465-f06ffbce65bd', null, 'period_start', 'Period start', 10, true, 'Period boundary — not composed from events.', '[]', true, false, 'Date column.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('8a58888a-30af-4094-ba8d-98896eeb4faa', null, 'period_end', 'Period end', 20, true, 'Period boundary — not composed from events.', '[]', true, false, 'Date column.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('86812474-46b1-4fc9-9971-395a1c5723cc', null, 'commitment_to_date', 'Commitment to date', 30, false, null, '[{"sign": 1, "event_key": "commitment"}]', true, false, 'Facility commitment as of this period, including upsizes.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('251045ce-9cd7-4f5b-bf66-3b4d0e19252d', null, 'drawdown_to_date', 'Drawdown to date', 40, false, null, '[{"sign": 1, "event_key": "drawdown"}]', true, false, 'Cumulative cash disbursed to the borrower.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('dfa0842d-9e42-4228-847a-9d0b414f0b97', null, 'undrawn_balance', 'Balance (undrawn)', 50, true, 'Commitment to date − Drawdown to date', '[]', true, false, 'Headroom still available to draw.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('30046e7e-54cf-43d3-94a3-1d98d81b425f', null, 'outstanding', 'Outstanding', 60, false, null, '[{"sign": 1, "event_key": "drawdown"}, {"sign": 1, "event_key": "pik_capitalisation"}, {"sign": -1, "event_key": "paydown"}, {"sign": -1, "event_key": "prepayment"}, {"sign": -1, "event_key": "mandatory_prepay"}, {"sign": -1, "event_key": "write_off"}, {"sign": -1, "event_key": "loan_sale"}, {"sign": -1, "event_key": "participation"}, {"sign": -1, "event_key": "debt_equity_swap"}]', true, false, 'Principal the borrower owes. PIK capitalisation increases it; forgiveness and transfers reduce it. NOT the balance-sheet figure.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('68953ac7-e9fa-4669-a36b-2a4d270e4df0', null, 'carrying_value', 'Gross carrying amount', 70, false, null, '[{"sign": 1, "event_key": "drawdown"}, {"sign": 1, "event_key": "pik_capitalisation"}, {"sign": 1, "event_key": "eir_accretion"}, {"sign": 1, "event_key": "capitalised_cost"}, {"sign": -1, "event_key": "origination_fee"}, {"sign": 1, "event_key": "loan_restructuring"}, {"sign": -1, "event_key": "paydown"}, {"sign": -1, "event_key": "prepayment"}, {"sign": -1, "event_key": "mandatory_prepay"}, {"sign": -1, "event_key": "write_off"}, {"sign": -1, "event_key": "loan_sale"}, {"sign": -1, "event_key": "participation"}, {"sign": -1, "event_key": "debt_equity_swap"}]', true, false, 'Amortised cost before impairment. Opens at consideration less yield-integral fees plus transaction costs and accretes to par at the EIR. Modification adjustments move it in either direction, so loan_restructuring carries sign 1 and the event itself may be negative.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('767f8db0-9db5-43b4-915e-3223b3f4eab1', null, 'ecl_allowance', 'ECL allowance', 80, false, null, '[{"sign": 1, "event_key": "ecl_impairment"}, {"sign": -1, "event_key": "write_off"}, {"sign": 1, "event_key": "recovery"}]', true, false, 'Contra-asset between gross and net. A write-off consumes allowance rather than creating expense; a recovery rebuilds it.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('25005aa2-1b41-4a60-878c-96b892025fe1', null, 'net_carrying_value', 'Net carrying amount', 90, true, 'Gross carrying amount − ECL allowance', '[]', true, false, 'The figure on the face of the balance sheet. Equal to gross when there is no allowance.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('15882134-1159-418b-a50f-67de1be22aa7', null, 'carrying_vs_balance', 'Unaccreted', 100, true, 'Gross carrying amount − Outstanding', '[]', true, false, 'The part of the balance sheet the coupon alone does not explain: unaccreted discount, premium or deferred fee. Runs to nil at maturity.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('1f604061-bcfc-4dce-a850-60ae57ba6f92', null, 'drawdowns', 'Drawdowns', 110, false, null, '[{"sign": 1, "event_key": "drawdown"}]', true, false, 'Cash disbursed in this period only.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('7455c1cc-cf1e-443a-adda-d460d509ae01', null, 'interest_accrued', 'Interest accrued', 120, false, null, '[{"sign": 1, "event_key": "interest_accrual"}, {"sign": 1, "event_key": "default_interest"}]', true, false, 'Accrued in this period, whether or not received. Excludes PIK, which is not interest income on a cash basis — see PIK capitalisation on the gross carrying amount.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('1a89e6e1-70c5-441e-8347-194a1070d44a', null, 'interest_accrued_to_date', 'Interest accrued to date', 130, true, 'Running total of Interest accrued', '[]', true, false, null, null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('8b9ff2cb-9e31-4dea-b6b6-4e61902a6e11', null, 'interest_paid', 'Interest paid', 140, false, null, '[{"sign": 1, "event_key": "interest_receipt"}]', true, false, 'Cash actually received. Never derived from accrual, so a blank means nothing has been booked.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('1212a711-2cec-4d7c-abfd-8e4a7d20fc52', null, 'fees', 'Fees', 150, false, null, '[{"sign": 1, "event_key": "commitment_fee"}, {"sign": 1, "event_key": "utilisation_fee"}, {"sign": 1, "event_key": "agency_fee"}, {"sign": 1, "event_key": "exit_fee"}]', true, false, 'Fees recognised in the period. Excludes origination fees integral to the EIR, which reduce the gross carrying amount instead of being income.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('3ba081a5-d8a0-456f-a477-1b03e4d45caf', null, 'cap_cost_to_date', 'Capitalised cost to date', 160, false, null, '[{"sign": 1, "event_key": "capitalised_cost"}]', true, false, 'Transaction costs capitalised into the asset.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('23b4ae6a-3d40-49db-ad1c-4c81f5a6ee6d', null, 'paydowns', 'Paydowns', 170, false, null, '[{"sign": 1, "event_key": "paydown"}, {"sign": 1, "event_key": "prepayment"}, {"sign": 1, "event_key": "mandatory_prepay"}]', true, false, 'Principal received in this period.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00'),
  ('fcef02cd-254d-4817-a8cb-ed7055f66c1c', null, 'net_cash', 'Net cash', 180, false, null, '[{"sign": -1, "event_key": "drawdown"}, {"sign": 1, "event_key": "interest_receipt"}, {"sign": 1, "event_key": "paydown"}, {"sign": 1, "event_key": "prepayment"}, {"sign": 1, "event_key": "mandatory_prepay"}, {"sign": 1, "event_key": "commitment_fee"}, {"sign": 1, "event_key": "utilisation_fee"}, {"sign": 1, "event_key": "agency_fee"}, {"sign": 1, "event_key": "exit_fee"}, {"sign": 1, "event_key": "recovery"}]', true, false, 'Cash to the lender in this period. A drawdown is cash out, hence sign -1.', null, null, '2026-10-08T09:12:28.898277+00:00', '2026-10-08T09:12:28.898277+00:00')
on conflict do nothing;

-- ═══ holiday calendars (7) ═══
-- `code` is the value stored in facilities.holiday_calendar and passed to the
-- engine's registerHolidayCalendar(). It was an enum until 2026-10-14; it is
-- now text with a FK to this table, which is what makes new calendars a
-- configuration change rather than a code change.
--
-- Two notes that affect payment dates:
--
--  * `none` is is_active = false and sort_order 0. It is hidden from the
--    config screen but offered directly by the Deal Setup picker. Do not
--    delete it — facilities.holiday_calendar defaults to it.
--
--  * `auFederal` is not here. It was offered in the UI dropdown but never
--    registered in the engine, so seven Australian deals rolled against no
--    holidays at all. They were repointed to `auNational` on 2026-10-14,
--    which moves their payment dates. If you are comparing journals across
--    that date on an AU deal, that is why.

insert into public.holiday_calendars (id, code, label, country_code, notes, is_builtin, is_active, sort_order, team_id, created_by, created_at, updated_at) values
  ('7f58320b-2fba-4817-b217-309f9c649c99', 'none', 'None', null, 'No holidays. Dates roll for weekends only. Not shown on the config screen; the Deal Setup picker offers it directly.', true, false, 0, null, null, '2026-10-14T20:00:13.047204+00:00', '2026-10-14T20:00:13.047204+00:00'),
  ('57c0ab21-cc58-43b2-9b6c-bfc9fd99eaed', 'usFederal', 'US Federal', 'US', 'US federal holidays, weekend dates observed on the adjacent weekday.', true, true, 10, null, null, '2026-10-14T19:54:04.61848+00:00', '2026-10-14T19:54:04.61848+00:00'),
  ('8c3dfdb5-4d4d-494e-aa45-861de5e1e10e', 'ukBank', 'UK Bank', 'GB', 'England & Wales bank holidays, with substitute days when a fixed date falls at a weekend.', true, true, 20, null, null, '2026-10-14T19:54:04.61848+00:00', '2026-10-14T19:54:04.61848+00:00'),
  ('312d54d8-4c0a-4624-9c42-9b8420c461cb', 'target', 'TARGET (EUR)', 'EU', 'TARGET2 euro settlement days. No weekend substitution — TARGET closes on the date itself.', true, true, 30, null, null, '2026-10-14T19:54:04.61848+00:00', '2026-10-14T19:54:04.61848+00:00'),
  ('55dfadf4-d23d-40c5-8196-98cf7a3b7f7c', 'nlNational', 'Netherlands National', 'NL', 'Dutch national public holidays. Note Koningsdag (27 Apr) and Goede Vrijdag are NOT TARGET2 closures — on a EUR loan settling through TARGET2, use the TARGET calendar or remove those dates.', true, true, 40, null, null, '2026-10-14T19:54:04.61848+00:00', '2026-10-14T19:54:04.61848+00:00'),
  ('7b14f6a9-7a3d-4808-a010-bbadd4b62fd3', 'luNational', 'Luxembourg National', 'LU', 'The 11 legal public holidays fixed by the law of 25 April 2019, including Europe Day on 9 May.', true, true, 50, null, null, '2026-10-14T19:54:04.61848+00:00', '2026-10-14T19:54:04.61848+00:00'),
  ('a2223a5e-4d48-4d90-a554-f0625507e60b', 'auNational', 'Australian National', 'AU', 'Australian national holidays. Replaces the old auFederal option, which was offered in the UI but never existed in the engine.', true, true, 60, null, null, '2026-10-14T19:54:04.61848+00:00', '2026-10-14T19:54:04.61848+00:00')
on conflict do nothing;

-- ═══ holiday dates (611) ═══
--
-- ⚠ COVERAGE: 2024-01-01 to 2035-12-26 ONLY. Twelve years, six calendars.
--
-- Nine deals in the source database mature after 2035-12-26 (latest
-- 2063-03-01). Beyond the last date here, every payment date rolls for
-- WEEKENDS ONLY, and nothing says so: the engine's warn-once only fires for
-- an unknown calendar CODE, and these codes exist — they simply have no dates
-- in range. Extend the table before relying on a schedule past 2035.
--
-- `id` is omitted so the target database generates its own. Nothing
-- references holiday_dates.id.
--
-- There is a unique constraint on (calendar_code, holiday_date), which is why
-- luNational has 131 rows rather than 11 × 12 = 132: in 2024, Ascension fell
-- on 9 May, the same day as Journée de l'Europe, and the two collapsed to one
-- row. That is correct — a date is either a holiday or it is not — but it is
-- the reason a per-year row count does not come out even.
--
-- Accents are stripped from the Luxembourg names as stored (Paques, Noel,
-- Pentecote). Reproduced as-is rather than corrected, because the front end
-- displays these strings and a silent change would look like a data fix in
-- one place and a mismatch in another.
--
-- Per-calendar totals, to check after restoring:
--   usFederal   132   (11/yr)
--   luNational  131   (11/yr, less the 2024 collision above)
--   nlNational   96   (8/yr)
--   ukBank       96   (8/yr)
--   auNational   84   (7/yr)
--   target       72   (6/yr)

insert into public.holiday_dates (calendar_code, holiday_date, holiday_name) values
  -- ── usFederal + ukBank, ordered by date ──
  ('ukBank', '2024-01-01', 'New Year''s Day'),
  ('usFederal', '2024-01-01', 'New Year''s Day'),
  ('usFederal', '2024-01-15', 'Martin Luther King Jr. Day'),
  ('usFederal', '2024-02-19', 'Washington''s Birthday'),
  ('ukBank', '2024-03-29', 'Good Friday'),
  ('ukBank', '2024-04-01', 'Easter Monday'),
  ('ukBank', '2024-05-06', 'Early May bank holiday'),
  ('usFederal', '2024-05-27', 'Memorial Day'),
  ('ukBank', '2024-05-27', 'Spring bank holiday'),
  ('usFederal', '2024-06-19', 'Juneteenth'),
  ('usFederal', '2024-07-04', 'Independence Day'),
  ('ukBank', '2024-08-26', 'Summer bank holiday'),
  ('usFederal', '2024-09-02', 'Labor Day'),
  ('usFederal', '2024-10-14', 'Columbus Day'),
  ('usFederal', '2024-11-11', 'Veterans Day'),
  ('usFederal', '2024-11-28', 'Thanksgiving Day'),
  ('usFederal', '2024-12-25', 'Christmas Day'),
  ('ukBank', '2024-12-25', 'Christmas Day'),
  ('ukBank', '2024-12-26', 'Boxing Day'),
  ('ukBank', '2025-01-01', 'New Year''s Day'),
  ('usFederal', '2025-01-01', 'New Year''s Day'),
  ('usFederal', '2025-01-20', 'Martin Luther King Jr. Day'),
  ('usFederal', '2025-02-17', 'Washington''s Birthday'),
  ('ukBank', '2025-04-18', 'Good Friday'),
  ('ukBank', '2025-04-21', 'Easter Monday'),
  ('ukBank', '2025-05-05', 'Early May bank holiday'),
  ('usFederal', '2025-05-26', 'Memorial Day'),
  ('ukBank', '2025-05-26', 'Spring bank holiday'),
  ('usFederal', '2025-06-19', 'Juneteenth'),
  ('usFederal', '2025-07-04', 'Independence Day'),
  ('ukBank', '2025-08-25', 'Summer bank holiday'),
  ('usFederal', '2025-09-01', 'Labor Day'),
  ('usFederal', '2025-10-13', 'Columbus Day'),
  ('usFederal', '2025-11-11', 'Veterans Day'),
  ('usFederal', '2025-11-27', 'Thanksgiving Day'),
  ('usFederal', '2025-12-25', 'Christmas Day'),
  ('ukBank', '2025-12-25', 'Christmas Day'),
  ('ukBank', '2025-12-26', 'Boxing Day'),
  ('usFederal', '2026-01-01', 'New Year''s Day'),
  ('ukBank', '2026-01-01', 'New Year''s Day'),
  ('usFederal', '2026-01-19', 'Martin Luther King Jr. Day'),
  ('usFederal', '2026-02-16', 'Washington''s Birthday'),
  ('ukBank', '2026-04-03', 'Good Friday'),
  ('ukBank', '2026-04-06', 'Easter Monday'),
  ('ukBank', '2026-05-04', 'Early May bank holiday'),
  ('usFederal', '2026-05-25', 'Memorial Day'),
  ('ukBank', '2026-05-25', 'Spring bank holiday'),
  ('usFederal', '2026-06-19', 'Juneteenth'),
  ('usFederal', '2026-07-03', 'Independence Day'),
  ('ukBank', '2026-08-31', 'Summer bank holiday'),
  ('usFederal', '2026-09-07', 'Labor Day'),
  ('usFederal', '2026-10-12', 'Columbus Day'),
  ('usFederal', '2026-11-11', 'Veterans Day'),
  ('usFederal', '2026-11-26', 'Thanksgiving Day'),
  ('usFederal', '2026-12-25', 'Christmas Day'),
  ('ukBank', '2026-12-25', 'Christmas Day'),
  ('ukBank', '2026-12-28', 'Boxing Day'),
  ('usFederal', '2027-01-01', 'New Year''s Day'),
  ('ukBank', '2027-01-01', 'New Year''s Day'),
  ('usFederal', '2027-01-18', 'Martin Luther King Jr. Day'),
  ('usFederal', '2027-02-15', 'Washington''s Birthday'),
  ('ukBank', '2027-03-26', 'Good Friday'),
  ('ukBank', '2027-03-29', 'Easter Monday'),
  ('ukBank', '2027-05-03', 'Early May bank holiday'),
  ('usFederal', '2027-05-31', 'Memorial Day'),
  ('ukBank', '2027-05-31', 'Spring bank holiday'),
  ('usFederal', '2027-06-18', 'Juneteenth'),
  ('usFederal', '2027-07-05', 'Independence Day'),
  ('ukBank', '2027-08-30', 'Summer bank holiday'),
  ('usFederal', '2027-09-06', 'Labor Day'),
  ('usFederal', '2027-10-11', 'Columbus Day'),
  ('usFederal', '2027-11-11', 'Veterans Day'),
  ('usFederal', '2027-11-25', 'Thanksgiving Day'),
  ('usFederal', '2027-12-24', 'Christmas Day'),
  ('ukBank', '2027-12-27', 'Christmas Day'),
  ('ukBank', '2027-12-28', 'Boxing Day'),
  ('usFederal', '2027-12-31', 'New Year''s Day'),
  ('ukBank', '2028-01-03', 'New Year''s Day'),
  ('usFederal', '2028-01-17', 'Martin Luther King Jr. Day'),
  ('usFederal', '2028-02-21', 'Washington''s Birthday'),
  ('ukBank', '2028-04-14', 'Good Friday'),
  ('ukBank', '2028-04-17', 'Easter Monday'),
  ('ukBank', '2028-05-01', 'Early May bank holiday'),
  ('usFederal', '2028-05-29', 'Memorial Day'),
  ('ukBank', '2028-05-29', 'Spring bank holiday'),
  ('usFederal', '2028-06-19', 'Juneteenth'),
  ('usFederal', '2028-07-04', 'Independence Day'),
  ('ukBank', '2028-08-28', 'Summer bank holiday'),
  ('usFederal', '2028-09-04', 'Labor Day'),
  ('usFederal', '2028-10-09', 'Columbus Day'),
  ('usFederal', '2028-11-10', 'Veterans Day'),
  ('usFederal', '2028-11-23', 'Thanksgiving Day'),
  ('usFederal', '2028-12-25', 'Christmas Day'),
  ('ukBank', '2028-12-25', 'Christmas Day'),
  ('ukBank', '2028-12-26', 'Boxing Day'),
  ('usFederal', '2029-01-01', 'New Year''s Day'),
  ('ukBank', '2029-01-01', 'New Year''s Day'),
  ('usFederal', '2029-01-15', 'Martin Luther King Jr. Day'),
  ('usFederal', '2029-02-19', 'Washington''s Birthday'),
  ('ukBank', '2029-03-30', 'Good Friday'),
  ('ukBank', '2029-04-02', 'Easter Monday'),
  ('ukBank', '2029-05-07', 'Early May bank holiday'),
  ('usFederal', '2029-05-28', 'Memorial Day'),
  ('ukBank', '2029-05-28', 'Spring bank holiday'),
  ('usFederal', '2029-06-19', 'Juneteenth'),
  ('usFederal', '2029-07-04', 'Independence Day'),
  ('ukBank', '2029-08-27', 'Summer bank holiday'),
  ('usFederal', '2029-09-03', 'Labor Day'),
  ('usFederal', '2029-10-08', 'Columbus Day'),
  ('usFederal', '2029-11-12', 'Veterans Day'),
  ('usFederal', '2029-11-22', 'Thanksgiving Day'),
  ('usFederal', '2029-12-25', 'Christmas Day'),
  ('ukBank', '2029-12-25', 'Christmas Day'),
  ('ukBank', '2029-12-26', 'Boxing Day'),
  ('usFederal', '2030-01-01', 'New Year''s Day'),
  ('ukBank', '2030-01-01', 'New Year''s Day'),
  ('usFederal', '2030-01-21', 'Martin Luther King Jr. Day'),
  ('usFederal', '2030-02-18', 'Washington''s Birthday'),
  ('ukBank', '2030-04-19', 'Good Friday'),
  ('ukBank', '2030-04-22', 'Easter Monday'),
  ('ukBank', '2030-05-06', 'Early May bank holiday'),
  ('usFederal', '2030-05-27', 'Memorial Day'),
  ('ukBank', '2030-05-27', 'Spring bank holiday'),
  ('usFederal', '2030-06-19', 'Juneteenth'),
  ('usFederal', '2030-07-04', 'Independence Day'),
  ('ukBank', '2030-08-26', 'Summer bank holiday'),
  ('usFederal', '2030-09-02', 'Labor Day'),
  ('usFederal', '2030-10-14', 'Columbus Day'),
  ('usFederal', '2030-11-11', 'Veterans Day'),
  ('usFederal', '2030-11-28', 'Thanksgiving Day'),
  ('usFederal', '2030-12-25', 'Christmas Day'),
  ('ukBank', '2030-12-25', 'Christmas Day'),
  ('ukBank', '2030-12-26', 'Boxing Day'),
  ('ukBank', '2031-01-01', 'New Year''s Day'),
  ('usFederal', '2031-01-01', 'New Year''s Day'),
  ('usFederal', '2031-01-20', 'Martin Luther King Jr. Day'),
  ('usFederal', '2031-02-17', 'Washington''s Birthday'),
  ('ukBank', '2031-04-11', 'Good Friday'),
  ('ukBank', '2031-04-14', 'Easter Monday'),
  ('ukBank', '2031-05-05', 'Early May bank holiday'),
  ('usFederal', '2031-05-26', 'Memorial Day'),
  ('ukBank', '2031-05-26', 'Spring bank holiday'),
  ('usFederal', '2031-06-19', 'Juneteenth'),
  ('usFederal', '2031-07-04', 'Independence Day'),
  ('ukBank', '2031-08-25', 'Summer bank holiday'),
  ('usFederal', '2031-09-01', 'Labor Day'),
  ('usFederal', '2031-10-13', 'Columbus Day'),
  ('usFederal', '2031-11-11', 'Veterans Day'),
  ('usFederal', '2031-11-27', 'Thanksgiving Day'),
  ('usFederal', '2031-12-25', 'Christmas Day'),
  ('ukBank', '2031-12-25', 'Christmas Day'),
  ('ukBank', '2031-12-26', 'Boxing Day'),
  ('usFederal', '2032-01-01', 'New Year''s Day'),
  ('ukBank', '2032-01-01', 'New Year''s Day'),
  ('usFederal', '2032-01-19', 'Martin Luther King Jr. Day'),
  ('usFederal', '2032-02-16', 'Washington''s Birthday'),
  ('ukBank', '2032-03-26', 'Good Friday'),
  ('ukBank', '2032-03-29', 'Easter Monday'),
  ('ukBank', '2032-05-03', 'Early May bank holiday'),
  ('usFederal', '2032-05-31', 'Memorial Day'),
  ('ukBank', '2032-05-31', 'Spring bank holiday'),
  ('usFederal', '2032-06-18', 'Juneteenth'),
  ('usFederal', '2032-07-05', 'Independence Day'),
  ('ukBank', '2032-08-30', 'Summer bank holiday'),
  ('usFederal', '2032-09-06', 'Labor Day'),
  ('usFederal', '2032-10-11', 'Columbus Day'),
  ('usFederal', '2032-11-11', 'Veterans Day'),
  ('usFederal', '2032-11-25', 'Thanksgiving Day'),
  ('usFederal', '2032-12-24', 'Christmas Day'),
  ('ukBank', '2032-12-27', 'Christmas Day'),
  ('ukBank', '2032-12-28', 'Boxing Day'),
  ('usFederal', '2032-12-31', 'New Year''s Day'),
  ('ukBank', '2033-01-03', 'New Year''s Day'),
  ('usFederal', '2033-01-17', 'Martin Luther King Jr. Day'),
  ('usFederal', '2033-02-21', 'Washington''s Birthday'),
  ('ukBank', '2033-04-15', 'Good Friday'),
  ('ukBank', '2033-04-18', 'Easter Monday'),
  ('ukBank', '2033-05-02', 'Early May bank holiday'),
  ('usFederal', '2033-05-30', 'Memorial Day'),
  ('ukBank', '2033-05-30', 'Spring bank holiday'),
  ('usFederal', '2033-06-20', 'Juneteenth'),
  ('usFederal', '2033-07-04', 'Independence Day'),
  ('ukBank', '2033-08-29', 'Summer bank holiday'),
  ('usFederal', '2033-09-05', 'Labor Day'),
  ('usFederal', '2033-10-10', 'Columbus Day'),
  ('usFederal', '2033-11-11', 'Veterans Day'),
  ('usFederal', '2033-11-24', 'Thanksgiving Day'),
  ('usFederal', '2033-12-26', 'Christmas Day'),
  ('ukBank', '2033-12-26', 'Christmas Day'),
  ('ukBank', '2033-12-27', 'Boxing Day'),
  ('ukBank', '2034-01-02', 'New Year''s Day'),
  ('usFederal', '2034-01-02', 'New Year''s Day'),
  ('usFederal', '2034-01-16', 'Martin Luther King Jr. Day'),
  ('usFederal', '2034-02-20', 'Washington''s Birthday'),
  ('ukBank', '2034-04-07', 'Good Friday'),
  ('ukBank', '2034-04-10', 'Easter Monday'),
  ('ukBank', '2034-05-01', 'Early May bank holiday'),
  ('usFederal', '2034-05-29', 'Memorial Day'),
  ('ukBank', '2034-05-29', 'Spring bank holiday'),
  ('usFederal', '2034-06-19', 'Juneteenth'),
  ('usFederal', '2034-07-04', 'Independence Day'),
  ('ukBank', '2034-08-28', 'Summer bank holiday'),
  ('usFederal', '2034-09-04', 'Labor Day'),
  ('usFederal', '2034-10-09', 'Columbus Day'),
  ('usFederal', '2034-11-10', 'Veterans Day'),
  ('usFederal', '2034-11-23', 'Thanksgiving Day'),
  ('usFederal', '2034-12-25', 'Christmas Day'),
  ('ukBank', '2034-12-25', 'Christmas Day'),
  ('ukBank', '2034-12-26', 'Boxing Day'),
  ('usFederal', '2035-01-01', 'New Year''s Day'),
  ('ukBank', '2035-01-01', 'New Year''s Day'),
  ('usFederal', '2035-01-15', 'Martin Luther King Jr. Day'),
  ('usFederal', '2035-02-19', 'Washington''s Birthday'),
  ('ukBank', '2035-03-23', 'Good Friday'),
  ('ukBank', '2035-03-26', 'Easter Monday'),
  ('ukBank', '2035-05-07', 'Early May bank holiday'),
  ('usFederal', '2035-05-28', 'Memorial Day'),
  ('ukBank', '2035-05-28', 'Spring bank holiday'),
  ('usFederal', '2035-06-19', 'Juneteenth'),
  ('usFederal', '2035-07-04', 'Independence Day'),
  ('ukBank', '2035-08-27', 'Summer bank holiday'),
  ('usFederal', '2035-09-03', 'Labor Day'),
  ('usFederal', '2035-10-08', 'Columbus Day'),
  ('usFederal', '2035-11-12', 'Veterans Day'),
  ('usFederal', '2035-11-22', 'Thanksgiving Day'),
  ('usFederal', '2035-12-25', 'Christmas Day'),
  ('ukBank', '2035-12-25', 'Christmas Day'),
  ('ukBank', '2035-12-26', 'Boxing Day'),
  -- ── auNational ──
  ('auNational', '2024-01-01', 'New Year''s Day'),
  ('auNational', '2024-01-26', 'Australia Day'),
  ('auNational', '2024-03-29', 'Good Friday'),
  ('auNational', '2024-04-01', 'Easter Monday'),
  ('auNational', '2024-04-25', 'Anzac Day'),
  ('auNational', '2024-12-25', 'Christmas Day'),
  ('auNational', '2024-12-26', 'Boxing Day'),
  ('auNational', '2025-01-01', 'New Year''s Day'),
  ('auNational', '2025-01-27', 'Australia Day'),
  ('auNational', '2025-04-18', 'Good Friday'),
  ('auNational', '2025-04-21', 'Easter Monday'),
  ('auNational', '2025-04-25', 'Anzac Day'),
  ('auNational', '2025-12-25', 'Christmas Day'),
  ('auNational', '2025-12-26', 'Boxing Day'),
  ('auNational', '2026-01-01', 'New Year''s Day'),
  ('auNational', '2026-01-26', 'Australia Day'),
  ('auNational', '2026-04-03', 'Good Friday'),
  ('auNational', '2026-04-06', 'Easter Monday'),
  ('auNational', '2026-04-27', 'Anzac Day'),
  ('auNational', '2026-12-25', 'Christmas Day'),
  ('auNational', '2026-12-28', 'Boxing Day'),
  ('auNational', '2027-01-01', 'New Year''s Day'),
  ('auNational', '2027-01-26', 'Australia Day'),
  ('auNational', '2027-03-26', 'Good Friday'),
  ('auNational', '2027-03-29', 'Easter Monday'),
  ('auNational', '2027-04-26', 'Anzac Day'),
  ('auNational', '2027-12-27', 'Christmas Day'),
  ('auNational', '2027-12-28', 'Boxing Day'),
  ('auNational', '2028-01-03', 'New Year''s Day'),
  ('auNational', '2028-01-26', 'Australia Day'),
  ('auNational', '2028-04-14', 'Good Friday'),
  ('auNational', '2028-04-17', 'Easter Monday'),
  ('auNational', '2028-04-25', 'Anzac Day'),
  ('auNational', '2028-12-25', 'Christmas Day'),
  ('auNational', '2028-12-26', 'Boxing Day'),
  ('auNational', '2029-01-01', 'New Year''s Day'),
  ('auNational', '2029-01-26', 'Australia Day'),
  ('auNational', '2029-03-30', 'Good Friday'),
  ('auNational', '2029-04-02', 'Easter Monday'),
  ('auNational', '2029-04-25', 'Anzac Day'),
  ('auNational', '2029-12-25', 'Christmas Day'),
  ('auNational', '2029-12-26', 'Boxing Day'),
  ('auNational', '2030-01-01', 'New Year''s Day'),
  ('auNational', '2030-01-28', 'Australia Day'),
  ('auNational', '2030-04-19', 'Good Friday'),
  ('auNational', '2030-04-22', 'Easter Monday'),
  ('auNational', '2030-04-25', 'Anzac Day'),
  ('auNational', '2030-12-25', 'Christmas Day'),
  ('auNational', '2030-12-26', 'Boxing Day'),
  ('auNational', '2031-01-01', 'New Year''s Day'),
  ('auNational', '2031-01-27', 'Australia Day'),
  ('auNational', '2031-04-11', 'Good Friday'),
  ('auNational', '2031-04-14', 'Easter Monday'),
  ('auNational', '2031-04-25', 'Anzac Day'),
  ('auNational', '2031-12-25', 'Christmas Day'),
  ('auNational', '2031-12-26', 'Boxing Day'),
  ('auNational', '2032-01-01', 'New Year''s Day'),
  ('auNational', '2032-01-26', 'Australia Day'),
  ('auNational', '2032-03-26', 'Good Friday'),
  ('auNational', '2032-03-29', 'Easter Monday'),
  ('auNational', '2032-04-26', 'Anzac Day'),
  ('auNational', '2032-12-27', 'Christmas Day'),
  ('auNational', '2032-12-28', 'Boxing Day'),
  ('auNational', '2033-01-03', 'New Year''s Day'),
  ('auNational', '2033-01-26', 'Australia Day'),
  ('auNational', '2033-04-15', 'Good Friday'),
  ('auNational', '2033-04-18', 'Easter Monday'),
  ('auNational', '2033-04-25', 'Anzac Day'),
  ('auNational', '2033-12-26', 'Christmas Day'),
  ('auNational', '2033-12-27', 'Boxing Day'),
  ('auNational', '2034-01-02', 'New Year''s Day'),
  ('auNational', '2034-01-26', 'Australia Day'),
  ('auNational', '2034-04-07', 'Good Friday'),
  ('auNational', '2034-04-10', 'Easter Monday'),
  ('auNational', '2034-04-25', 'Anzac Day'),
  ('auNational', '2034-12-25', 'Christmas Day'),
  ('auNational', '2034-12-26', 'Boxing Day'),
  ('auNational', '2035-01-01', 'New Year''s Day'),
  ('auNational', '2035-01-26', 'Australia Day'),
  ('auNational', '2035-03-23', 'Good Friday'),
  ('auNational', '2035-03-26', 'Easter Monday'),
  ('auNational', '2035-04-25', 'Anzac Day'),
  ('auNational', '2035-12-25', 'Christmas Day'),
  ('auNational', '2035-12-26', 'Boxing Day'),
  -- ── target (TARGET2 EUR settlement) ──
  ('target', '2024-01-01', 'New Year''s Day'),
  ('target', '2024-03-29', 'Good Friday'),
  ('target', '2024-04-01', 'Easter Monday'),
  ('target', '2024-05-01', 'Labour Day'),
  ('target', '2024-12-25', 'Christmas Day'),
  ('target', '2024-12-26', 'Christmas holiday'),
  ('target', '2025-01-01', 'New Year''s Day'),
  ('target', '2025-04-18', 'Good Friday'),
  ('target', '2025-04-21', 'Easter Monday'),
  ('target', '2025-05-01', 'Labour Day'),
  ('target', '2025-12-25', 'Christmas Day'),
  ('target', '2025-12-26', 'Christmas holiday'),
  ('target', '2026-01-01', 'New Year''s Day'),
  ('target', '2026-04-03', 'Good Friday'),
  ('target', '2026-04-06', 'Easter Monday'),
  ('target', '2026-05-01', 'Labour Day'),
  ('target', '2026-12-25', 'Christmas Day'),
  ('target', '2026-12-26', 'Christmas holiday'),
  ('target', '2027-01-01', 'New Year''s Day'),
  ('target', '2027-03-26', 'Good Friday'),
  ('target', '2027-03-29', 'Easter Monday'),
  ('target', '2027-05-01', 'Labour Day'),
  ('target', '2027-12-25', 'Christmas Day'),
  ('target', '2027-12-26', 'Christmas holiday'),
  ('target', '2028-01-01', 'New Year''s Day'),
  ('target', '2028-04-14', 'Good Friday'),
  ('target', '2028-04-17', 'Easter Monday'),
  ('target', '2028-05-01', 'Labour Day'),
  ('target', '2028-12-25', 'Christmas Day'),
  ('target', '2028-12-26', 'Christmas holiday'),
  ('target', '2029-01-01', 'New Year''s Day'),
  ('target', '2029-03-30', 'Good Friday'),
  ('target', '2029-04-02', 'Easter Monday'),
  ('target', '2029-05-01', 'Labour Day'),
  ('target', '2029-12-25', 'Christmas Day'),
  ('target', '2029-12-26', 'Christmas holiday'),
  ('target', '2030-01-01', 'New Year''s Day'),
  ('target', '2030-04-19', 'Good Friday'),
  ('target', '2030-04-22', 'Easter Monday'),
  ('target', '2030-05-01', 'Labour Day'),
  ('target', '2030-12-25', 'Christmas Day'),
  ('target', '2030-12-26', 'Christmas holiday'),
  ('target', '2031-01-01', 'New Year''s Day'),
  ('target', '2031-04-11', 'Good Friday'),
  ('target', '2031-04-14', 'Easter Monday'),
  ('target', '2031-05-01', 'Labour Day'),
  ('target', '2031-12-25', 'Christmas Day'),
  ('target', '2031-12-26', 'Christmas holiday'),
  ('target', '2032-01-01', 'New Year''s Day'),
  ('target', '2032-03-26', 'Good Friday'),
  ('target', '2032-03-29', 'Easter Monday'),
  ('target', '2032-05-01', 'Labour Day'),
  ('target', '2032-12-25', 'Christmas Day'),
  ('target', '2032-12-26', 'Christmas holiday'),
  ('target', '2033-01-01', 'New Year''s Day'),
  ('target', '2033-04-15', 'Good Friday'),
  ('target', '2033-04-18', 'Easter Monday'),
  ('target', '2033-05-01', 'Labour Day'),
  ('target', '2033-12-25', 'Christmas Day'),
  ('target', '2033-12-26', 'Christmas holiday'),
  ('target', '2034-01-01', 'New Year''s Day'),
  ('target', '2034-04-07', 'Good Friday'),
  ('target', '2034-04-10', 'Easter Monday'),
  ('target', '2034-05-01', 'Labour Day'),
  ('target', '2034-12-25', 'Christmas Day'),
  ('target', '2034-12-26', 'Christmas holiday'),
  ('target', '2035-01-01', 'New Year''s Day'),
  ('target', '2035-03-23', 'Good Friday'),
  ('target', '2035-03-26', 'Easter Monday'),
  ('target', '2035-05-01', 'Labour Day'),
  ('target', '2035-12-25', 'Christmas Day'),
  ('target', '2035-12-26', 'Christmas holiday'),
  -- ── nlNational ──
  ('nlNational', '2024-01-01', 'Nieuwjaarsdag'),
  ('nlNational', '2024-03-29', 'Goede Vrijdag'),
  ('nlNational', '2024-04-01', 'Tweede Paasdag'),
  ('nlNational', '2024-04-27', 'Koningsdag'),
  ('nlNational', '2024-05-09', 'Hemelvaartsdag'),
  ('nlNational', '2024-05-20', 'Tweede Pinksterdag'),
  ('nlNational', '2024-12-25', 'Eerste Kerstdag'),
  ('nlNational', '2024-12-26', 'Tweede Kerstdag'),
  ('nlNational', '2025-01-01', 'Nieuwjaarsdag'),
  ('nlNational', '2025-04-18', 'Goede Vrijdag'),
  ('nlNational', '2025-04-21', 'Tweede Paasdag'),
  ('nlNational', '2025-04-26', 'Koningsdag'),
  ('nlNational', '2025-05-29', 'Hemelvaartsdag'),
  ('nlNational', '2025-06-09', 'Tweede Pinksterdag'),
  ('nlNational', '2025-12-25', 'Eerste Kerstdag'),
  ('nlNational', '2025-12-26', 'Tweede Kerstdag'),
  ('nlNational', '2026-01-01', 'Nieuwjaarsdag'),
  ('nlNational', '2026-04-03', 'Goede Vrijdag'),
  ('nlNational', '2026-04-06', 'Tweede Paasdag'),
  ('nlNational', '2026-04-27', 'Koningsdag'),
  ('nlNational', '2026-05-14', 'Hemelvaartsdag'),
  ('nlNational', '2026-05-25', 'Tweede Pinksterdag'),
  ('nlNational', '2026-12-25', 'Eerste Kerstdag'),
  ('nlNational', '2026-12-26', 'Tweede Kerstdag'),
  ('nlNational', '2027-01-01', 'Nieuwjaarsdag'),
  ('nlNational', '2027-03-26', 'Goede Vrijdag'),
  ('nlNational', '2027-03-29', 'Tweede Paasdag'),
  ('nlNational', '2027-04-27', 'Koningsdag'),
  ('nlNational', '2027-05-06', 'Hemelvaartsdag'),
  ('nlNational', '2027-05-17', 'Tweede Pinksterdag'),
  ('nlNational', '2027-12-25', 'Eerste Kerstdag'),
  ('nlNational', '2027-12-26', 'Tweede Kerstdag'),
  ('nlNational', '2028-01-01', 'Nieuwjaarsdag'),
  ('nlNational', '2028-04-14', 'Goede Vrijdag'),
  ('nlNational', '2028-04-17', 'Tweede Paasdag'),
  ('nlNational', '2028-04-27', 'Koningsdag'),
  ('nlNational', '2028-05-25', 'Hemelvaartsdag'),
  ('nlNational', '2028-06-05', 'Tweede Pinksterdag'),
  ('nlNational', '2028-12-25', 'Eerste Kerstdag'),
  ('nlNational', '2028-12-26', 'Tweede Kerstdag'),
  ('nlNational', '2029-01-01', 'Nieuwjaarsdag'),
  ('nlNational', '2029-03-30', 'Goede Vrijdag'),
  ('nlNational', '2029-04-02', 'Tweede Paasdag'),
  ('nlNational', '2029-04-27', 'Koningsdag'),
  ('nlNational', '2029-05-10', 'Hemelvaartsdag'),
  ('nlNational', '2029-05-21', 'Tweede Pinksterdag'),
  ('nlNational', '2029-12-25', 'Eerste Kerstdag'),
  ('nlNational', '2029-12-26', 'Tweede Kerstdag'),
  ('nlNational', '2030-01-01', 'Nieuwjaarsdag'),
  ('nlNational', '2030-04-19', 'Goede Vrijdag'),
  ('nlNational', '2030-04-22', 'Tweede Paasdag'),
  ('nlNational', '2030-04-27', 'Koningsdag'),
  ('nlNational', '2030-05-30', 'Hemelvaartsdag'),
  ('nlNational', '2030-06-10', 'Tweede Pinksterdag'),
  ('nlNational', '2030-12-25', 'Eerste Kerstdag'),
  ('nlNational', '2030-12-26', 'Tweede Kerstdag'),
  ('nlNational', '2031-01-01', 'Nieuwjaarsdag'),
  ('nlNational', '2031-04-11', 'Goede Vrijdag'),
  ('nlNational', '2031-04-14', 'Tweede Paasdag'),
  ('nlNational', '2031-04-26', 'Koningsdag'),
  ('nlNational', '2031-05-22', 'Hemelvaartsdag'),
  ('nlNational', '2031-06-02', 'Tweede Pinksterdag'),
  ('nlNational', '2031-12-25', 'Eerste Kerstdag'),
  ('nlNational', '2031-12-26', 'Tweede Kerstdag'),
  ('nlNational', '2032-01-01', 'Nieuwjaarsdag'),
  ('nlNational', '2032-03-26', 'Goede Vrijdag'),
  ('nlNational', '2032-03-29', 'Tweede Paasdag'),
  ('nlNational', '2032-04-27', 'Koningsdag'),
  ('nlNational', '2032-05-06', 'Hemelvaartsdag'),
  ('nlNational', '2032-05-17', 'Tweede Pinksterdag'),
  ('nlNational', '2032-12-25', 'Eerste Kerstdag'),
  ('nlNational', '2032-12-26', 'Tweede Kerstdag'),
  ('nlNational', '2033-01-01', 'Nieuwjaarsdag'),
  ('nlNational', '2033-04-15', 'Goede Vrijdag'),
  ('nlNational', '2033-04-18', 'Tweede Paasdag'),
  ('nlNational', '2033-04-27', 'Koningsdag'),
  ('nlNational', '2033-05-26', 'Hemelvaartsdag'),
  ('nlNational', '2033-06-06', 'Tweede Pinksterdag'),
  ('nlNational', '2033-12-25', 'Eerste Kerstdag'),
  ('nlNational', '2033-12-26', 'Tweede Kerstdag'),
  ('nlNational', '2034-01-01', 'Nieuwjaarsdag'),
  ('nlNational', '2034-04-07', 'Goede Vrijdag'),
  ('nlNational', '2034-04-10', 'Tweede Paasdag'),
  ('nlNational', '2034-04-27', 'Koningsdag'),
  ('nlNational', '2034-05-18', 'Hemelvaartsdag'),
  ('nlNational', '2034-05-29', 'Tweede Pinksterdag'),
  ('nlNational', '2034-12-25', 'Eerste Kerstdag'),
  ('nlNational', '2034-12-26', 'Tweede Kerstdag'),
  ('nlNational', '2035-01-01', 'Nieuwjaarsdag'),
  ('nlNational', '2035-03-23', 'Goede Vrijdag'),
  ('nlNational', '2035-03-26', 'Tweede Paasdag'),
  ('nlNational', '2035-04-27', 'Koningsdag'),
  ('nlNational', '2035-05-03', 'Hemelvaartsdag'),
  ('nlNational', '2035-05-14', 'Tweede Pinksterdag'),
  ('nlNational', '2035-12-25', 'Eerste Kerstdag'),
  ('nlNational', '2035-12-26', 'Tweede Kerstdag'),
  -- ── luNational ──
  -- 2024 has 10 rows, not 11: Ascension fell on 9 May, the same day as
  -- Journée de l'Europe, and the unique constraint collapsed the pair.
  -- Good Friday is absent throughout, correctly — it is not a legal
  -- public holiday in Luxembourg.
  ('luNational', '2024-01-01', 'Nouvel An'),
  ('luNational', '2024-04-01', 'Lundi de Paques'),
  ('luNational', '2024-05-01', 'Fete du Travail'),
  ('luNational', '2024-05-09', 'Journee de l''Europe'),
  ('luNational', '2024-05-20', 'Lundi de Pentecote'),
  ('luNational', '2024-06-23', 'Fete nationale'),
  ('luNational', '2024-08-15', 'Assomption'),
  ('luNational', '2024-11-01', 'Toussaint'),
  ('luNational', '2024-12-25', 'Noel'),
  ('luNational', '2024-12-26', 'Saint-Etienne'),
  ('luNational', '2025-01-01', 'Nouvel An'),
  ('luNational', '2025-04-21', 'Lundi de Paques'),
  ('luNational', '2025-05-01', 'Fete du Travail'),
  ('luNational', '2025-05-09', 'Journee de l''Europe'),
  ('luNational', '2025-05-29', 'Ascension'),
  ('luNational', '2025-06-09', 'Lundi de Pentecote'),
  ('luNational', '2025-06-23', 'Fete nationale'),
  ('luNational', '2025-08-15', 'Assomption'),
  ('luNational', '2025-11-01', 'Toussaint'),
  ('luNational', '2025-12-25', 'Noel'),
  ('luNational', '2025-12-26', 'Saint-Etienne'),
  ('luNational', '2026-01-01', 'Nouvel An'),
  ('luNational', '2026-04-06', 'Lundi de Paques'),
  ('luNational', '2026-05-01', 'Fete du Travail'),
  ('luNational', '2026-05-09', 'Journee de l''Europe'),
  ('luNational', '2026-05-14', 'Ascension'),
  ('luNational', '2026-05-25', 'Lundi de Pentecote'),
  ('luNational', '2026-06-23', 'Fete nationale'),
  ('luNational', '2026-08-15', 'Assomption'),
  ('luNational', '2026-11-01', 'Toussaint'),
  ('luNational', '2026-12-25', 'Noel'),
  ('luNational', '2026-12-26', 'Saint-Etienne'),
  ('luNational', '2027-01-01', 'Nouvel An'),
  ('luNational', '2027-03-29', 'Lundi de Paques'),
  ('luNational', '2027-05-01', 'Fete du Travail'),
  ('luNational', '2027-05-06', 'Ascension'),
  ('luNational', '2027-05-09', 'Journee de l''Europe'),
  ('luNational', '2027-05-17', 'Lundi de Pentecote'),
  ('luNational', '2027-06-23', 'Fete nationale'),
  ('luNational', '2027-08-15', 'Assomption'),
  ('luNational', '2027-11-01', 'Toussaint'),
  ('luNational', '2027-12-25', 'Noel'),
  ('luNational', '2027-12-26', 'Saint-Etienne'),
  ('luNational', '2028-01-01', 'Nouvel An'),
  ('luNational', '2028-04-17', 'Lundi de Paques'),
  ('luNational', '2028-05-01', 'Fete du Travail'),
  ('luNational', '2028-05-09', 'Journee de l''Europe'),
  ('luNational', '2028-05-25', 'Ascension'),
  ('luNational', '2028-06-05', 'Lundi de Pentecote'),
  ('luNational', '2028-06-23', 'Fete nationale'),
  ('luNational', '2028-08-15', 'Assomption'),
  ('luNational', '2028-11-01', 'Toussaint'),
  ('luNational', '2028-12-25', 'Noel'),
  ('luNational', '2028-12-26', 'Saint-Etienne'),
  ('luNational', '2029-01-01', 'Nouvel An'),
  ('luNational', '2029-04-02', 'Lundi de Paques'),
  ('luNational', '2029-05-01', 'Fete du Travail'),
  ('luNational', '2029-05-09', 'Journee de l''Europe'),
  ('luNational', '2029-05-10', 'Ascension'),
  ('luNational', '2029-05-21', 'Lundi de Pentecote'),
  ('luNational', '2029-06-23', 'Fete nationale'),
  ('luNational', '2029-08-15', 'Assomption'),
  ('luNational', '2029-11-01', 'Toussaint'),
  ('luNational', '2029-12-25', 'Noel'),
  ('luNational', '2029-12-26', 'Saint-Etienne'),
  ('luNational', '2030-01-01', 'Nouvel An'),
  ('luNational', '2030-04-22', 'Lundi de Paques'),
  ('luNational', '2030-05-01', 'Fete du Travail'),
  ('luNational', '2030-05-09', 'Journee de l''Europe'),
  ('luNational', '2030-05-30', 'Ascension'),
  ('luNational', '2030-06-10', 'Lundi de Pentecote'),
  ('luNational', '2030-06-23', 'Fete nationale'),
  ('luNational', '2030-08-15', 'Assomption'),
  ('luNational', '2030-11-01', 'Toussaint'),
  ('luNational', '2030-12-25', 'Noel'),
  ('luNational', '2030-12-26', 'Saint-Etienne'),
  ('luNational', '2031-01-01', 'Nouvel An'),
  ('luNational', '2031-04-14', 'Lundi de Paques'),
  ('luNational', '2031-05-01', 'Fete du Travail'),
  ('luNational', '2031-05-09', 'Journee de l''Europe'),
  ('luNational', '2031-05-22', 'Ascension'),
  ('luNational', '2031-06-02', 'Lundi de Pentecote'),
  ('luNational', '2031-06-23', 'Fete nationale'),
  ('luNational', '2031-08-15', 'Assomption'),
  ('luNational', '2031-11-01', 'Toussaint'),
  ('luNational', '2031-12-25', 'Noel'),
  ('luNational', '2031-12-26', 'Saint-Etienne'),
  ('luNational', '2032-01-01', 'Nouvel An'),
  ('luNational', '2032-03-29', 'Lundi de Paques'),
  ('luNational', '2032-05-01', 'Fete du Travail'),
  ('luNational', '2032-05-06', 'Ascension'),
  ('luNational', '2032-05-09', 'Journee de l''Europe'),
  ('luNational', '2032-05-17', 'Lundi de Pentecote'),
  ('luNational', '2032-06-23', 'Fete nationale'),
  ('luNational', '2032-08-15', 'Assomption'),
  ('luNational', '2032-11-01', 'Toussaint'),
  ('luNational', '2032-12-25', 'Noel'),
  ('luNational', '2032-12-26', 'Saint-Etienne'),
  ('luNational', '2033-01-01', 'Nouvel An'),
  ('luNational', '2033-04-18', 'Lundi de Paques'),
  ('luNational', '2033-05-01', 'Fete du Travail'),
  ('luNational', '2033-05-09', 'Journee de l''Europe'),
  ('luNational', '2033-05-26', 'Ascension'),
  ('luNational', '2033-06-06', 'Lundi de Pentecote'),
  ('luNational', '2033-06-23', 'Fete nationale'),
  ('luNational', '2033-08-15', 'Assomption'),
  ('luNational', '2033-11-01', 'Toussaint'),
  ('luNational', '2033-12-25', 'Noel'),
  ('luNational', '2033-12-26', 'Saint-Etienne'),
  ('luNational', '2034-01-01', 'Nouvel An'),
  ('luNational', '2034-04-10', 'Lundi de Paques'),
  ('luNational', '2034-05-01', 'Fete du Travail'),
  ('luNational', '2034-05-09', 'Journee de l''Europe'),
  ('luNational', '2034-05-18', 'Ascension'),
  ('luNational', '2034-05-29', 'Lundi de Pentecote'),
  ('luNational', '2034-06-23', 'Fete nationale'),
  ('luNational', '2034-08-15', 'Assomption'),
  ('luNational', '2034-11-01', 'Toussaint'),
  ('luNational', '2034-12-25', 'Noel'),
  ('luNational', '2034-12-26', 'Saint-Etienne'),
  ('luNational', '2035-01-01', 'Nouvel An'),
  ('luNational', '2035-03-26', 'Lundi de Paques'),
  ('luNational', '2035-05-01', 'Fete du Travail'),
  ('luNational', '2035-05-03', 'Ascension'),
  ('luNational', '2035-05-09', 'Journee de l''Europe'),
  ('luNational', '2035-05-14', 'Lundi de Pentecote'),
  ('luNational', '2035-06-23', 'Fete nationale'),
  ('luNational', '2035-08-15', 'Assomption'),
  ('luNational', '2035-11-01', 'Toussaint'),
  ('luNational', '2035-12-25', 'Noel'),
  ('luNational', '2035-12-26', 'Saint-Etienne')
on conflict do nothing;

-- ═══ preset catalogue (17) ═══
-- `build_definition` is the whole deal — deal header, facility, tranches,
-- interest components with spreads/terms/ratchets, and fees — as one JSONB
-- document. materialize_preset() reads it and writes the normalised rows.
--
-- ⚠ materialize_preset() CANNOT MATERIALISE A NEW-COUNTRY PRESET.
-- The function casts facility.holiday to the retired `::holiday_calendar`
-- enum, which never had nlNational or luNational as members. A preset
-- specifying either fails at that cast. The column is now text with a FK to
-- holiday_calendars, so the fix is one word — change `::holiday_calendar` to
-- `::text` in the function body in schema.sql. None of the 17 presets below
-- trips it (they use usFederal, ukBank, target or auNational), which is why
-- it has not been noticed.
--
-- These are demo deals, and they are the one piece of demo content kept here
-- because they populate the preset menu the test plan uses. They are also
-- reproducible from loan-module-instruments.js, so if a restore of this
-- section fails you can drop it and rebuild from the UI.
--
-- ⚠ ALL FIVE `-au` PRESETS ALSO CARRY THE RETIRED `auFederal`.
-- Their build_definition.facility.holiday is 'auFederal', a code that no
-- longer exists in holiday_calendars, so facilities_holiday_calendar_fk
-- rejects the insert even before the enum cast above is reached. The five are
-- murraydarling-mining-au, northbridge-property-au, pilbara-aasb-au,
-- riverina-agribusiness-au and tasman-renewables-sll-au. They are reproduced
-- here exactly as stored rather than silently corrected, because the same
-- value needs fixing in the database too and a seed that disagrees with the
-- source is worse than one that is faithfully broken. To fix both at once:
--
--   update public.preset_catalog
--      set build_definition = jsonb_set(build_definition,
--                                       '{facility,holiday}', '"auNational"')
--    where build_definition #>> '{facility,holiday}' = 'auFederal';
--
-- and the standing check, which should return no rows:
--
--   select preset_key from public.preset_catalog
--    where (build_definition #>> '{facility,holiday}')
--          not in (select code from public.holiday_calendars);
--
-- The `au` suffixed presets are the AASB set and carry aasbExtras; the rest
-- have aasbExtras null.

insert into public.preset_catalog (id, preset_key, label, team_code, tag, complexity, participation_pct, framework, is_historical, build_definition, created_at) values
  ('1517f8bd-470c-4d90-ac59-e6175fccd848', 'atlas-syndicated', 'Atlas Acquisition — Syndicated Mega-Deal (3 Tranches · 6 Fees · Full Ratchets)', 'LeveragedFinance', 'Complex', 5, 25.00, 'IFRS', false, '{"deal": {"le": "Syndicated Lending", "name": "Atlas Acquisition Finance", "dealId": "ATL-2026-010", "settle": "2026-12-01", "currency": "USD", "maturity": "2033-12-01", "framework": "IFRS", "counterparty": "Atlas Industries SA"}, "fees": [{"id": "FEE_8", "bps": 0, "pct": 0.0225, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Underwriting Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-12-08", "linkedComponentId": ""}, {"id": "FEE_9", "bps": 0, "pct": 0.01, "base": "tranche-face", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Tranche A Upfront Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-12-08", "linkedComponentId": ""}, {"id": "FEE_10", "bps": 0, "pct": 0.0075, "base": "unfunded", "ifrs": "IFRS15-overTime", "kind": "commitment", "mode": "overUnfunded", "label": "RCF Commitment Fee", "frequency": "quarterly", "flatAmount": 0, "paymentDate": "", "linkedComponentId": ""}, {"id": "FEE_11", "bps": 0, "pct": 0.004, "base": "funded", "ifrs": "IFRS15-overTime", "kind": "utilisation", "mode": "overFunded", "label": "RCF Utilisation Fee", "frequency": "quarterly", "flatAmount": 0, "paymentDate": "", "linkedComponentId": ""}, {"id": "FEE_12", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "IFRS15-overTime", "kind": "agency", "mode": "fixAmount", "label": "Agency Fee", "frequency": "annual", "flatAmount": 150000, "paymentDate": "2027-12-01", "linkedComponentId": ""}, {"id": "FEE_13", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "IFRS15-pointInTime", "kind": "other", "mode": "fixAmount", "label": "Coordination Fee", "frequency": "oneOff", "flatAmount": 250000, "paymentDate": "2026-12-15", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "usFederal", "availEnd": "2029-12-01", "dayBasis": "ACT/360", "repayment": "AtMaturity", "commitment": 100000000}, "tranches": [{"id": "TRN_1", "face": 50000000, "name": "Tranche A — Senior Term", "currency": "USD", "drawdowns": [], "repayments": [], "drawnInitially": 50000000, "interestComponents": [{"id": "IC_2", "name": "Senior Margin over Term SOFR", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 5, "dailyCompounding": true, "observationShift": 0}], "ratchet": {"kpi": "leverageRatio", "tiers": [{"to": 3.5, "from": 0, "marginBps": 0}, {"to": 5, "from": 3.5, "marginBps": 25}, {"to": 6.5, "from": 5, "marginBps": 75}, {"to": null, "from": 6.5, "marginBps": 150}]}, "spreads": [{"to": "2028-12-01", "bps": 250, "from": "2026-12-01", "note": "Y1-2"}, {"to": "2031-12-01", "bps": 225, "from": "2028-12-01", "note": "Y3-5"}, {"to": "2033-12-01", "bps": 200, "from": "2031-12-01", "note": "Y6-7"}], "baseIndex": "TermSOFR", "baseValue": 0.0475, "esgAdjustmentBps": -2.5}]}, {"id": "TRN_3", "face": 30000000, "name": "Tranche B — Mezz", "currency": "USD", "drawdowns": [{"date": "2027-06-01", "amount": 15000000}], "repayments": [], "drawnInitially": 15000000, "interestComponents": [{"id": "IC_4", "name": "Mezz Cash Margin", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 5, "dailyCompounding": true, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2033-12-01", "bps": 500, "from": "2026-12-01", "note": "Mezz cash margin"}], "baseIndex": "TermSOFR", "baseValue": 0.0475, "esgAdjustmentBps": 0}, {"id": "IC_5", "name": "Mezz PIK Component", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 0, "dailyCompounding": false, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2033-12-01", "bps": 0, "from": "2026-12-01", "note": "PIK kicker"}], "baseIndex": "FIXED", "baseValue": 0.03, "esgAdjustmentBps": 0}]}, {"id": "TRN_6", "face": 20000000, "name": "Tranche C — RCF", "currency": "USD", "drawdowns": [{"date": "2027-12-01", "amount": 8000000}], "repayments": [{"date": "2029-06-01", "amount": 8000000}], "drawnInitially": 0, "interestComponents": [{"id": "IC_7", "name": "RCF Margin", "terms": [{"tenor": "1M", "weighted": false, "lockoutDays": 0, "lookbackDays": 5, "dailyCompounding": true, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2033-12-01", "bps": 200, "from": "2026-12-01", "note": "RCF base margin"}], "baseIndex": "TermSOFR", "baseValue": 0.0475, "esgAdjustmentBps": 0}]}], "aasbExtras": null}', '2026-06-14 14:01:22.274955+00'),
  ('d061a9f0-7ace-4f7d-9c12-3c12260a840b', 'aurora-multitranche', 'Project Aurora — Multi-tranche Senior + Junior (5Y · Leverage Ratchet)', 'LeveragedFinance', 'Medium', 3, 60.00, 'IFRS', false, '{"deal": {"le": "Leveraged Finance", "name": "Project Aurora", "dealId": "AUR-2026-004", "settle": "2026-09-01", "currency": "USD", "maturity": "2031-09-01", "framework": "IFRS", "counterparty": "Aurora Holdings plc"}, "fees": [{"id": "FEE_5", "bps": 0, "pct": 0.0175, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Arrangement Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-09-08", "linkedComponentId": ""}, {"id": "FEE_6", "bps": 0, "pct": 0.005, "base": "unfunded", "ifrs": "IFRS15-overTime", "kind": "commitment", "mode": "overUnfunded", "label": "Commitment Fee", "frequency": "quarterly", "flatAmount": 0, "paymentDate": "", "linkedComponentId": ""}, {"id": "FEE_7", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "IFRS15-overTime", "kind": "agency", "mode": "fixAmount", "label": "Agency Fee", "frequency": "annual", "flatAmount": 25000, "paymentDate": "2027-09-01", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "usFederal", "availEnd": "2028-09-01", "dayBasis": "ACT/360", "repayment": "AtMaturity", "commitment": 25000000}, "tranches": [{"id": "TRN_1", "face": 15000000, "name": "Tranche A — Senior", "currency": "USD", "drawdowns": [], "repayments": [], "drawnInitially": 15000000, "interestComponents": [{"id": "IC_2", "name": "Margin over Term SOFR", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 5, "dailyCompounding": true, "observationShift": 0}], "ratchet": {"kpi": "leverageRatio", "tiers": [{"to": 3, "from": 0, "marginBps": 0}, {"to": 4.5, "from": 3, "marginBps": 25}, {"to": 6, "from": 4.5, "marginBps": 50}, {"to": null, "from": 6, "marginBps": 100}]}, "spreads": [{"to": "2027-09-01", "bps": 275, "from": "2026-09-01", "note": "Year 1"}, {"to": "2029-09-01", "bps": 250, "from": "2027-09-01", "note": "Years 2-3"}, {"to": "2031-09-01", "bps": 225, "from": "2029-09-01", "note": "Years 4-5"}], "baseIndex": "TermSOFR", "baseValue": 0.0475, "esgAdjustmentBps": -2.5}]}, {"id": "TRN_3", "face": 10000000, "name": "Tranche B — Junior", "currency": "USD", "drawdowns": [{"date": "2027-03-01", "amount": 5000000}], "repayments": [], "drawnInitially": 5000000, "interestComponents": [{"id": "IC_4", "name": "Margin over Term SOFR (Junior)", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 5, "dailyCompounding": true, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2031-09-01", "bps": 425, "from": "2026-09-01", "note": "Junior margin · flat"}], "baseIndex": "TermSOFR", "baseValue": 0.0475, "esgAdjustmentBps": 0}]}], "aasbExtras": null}', '2026-06-14 13:59:30.087216+00'),
  ('84dafd41-2699-4569-b716-80ebe0392e33', 'aurora-solar-multifx', 'Aurora Solar — Multi-Currency (USD + EUR Tranches)', 'SustainableFinance', 'Complex', 4, 100.00, 'IFRS', false, '{"deal": {"le": "Cross-Border Finance", "name": "Aurora Solar Multi-Ccy", "dealId": "ASR-2026-008", "settle": "2026-11-01", "currency": "EUR", "maturity": "2031-11-01", "framework": "IFRS", "counterparty": "Aurora Solar AG"}, "fees": [{"id": "FEE_5", "bps": 0, "pct": 0.0175, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Arrangement Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-11-08", "linkedComponentId": ""}, {"id": "FEE_6", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "IFRS15-overTime", "kind": "other", "mode": "fixAmount", "label": "FX Hedge Fee", "frequency": "annual", "flatAmount": 75000, "paymentDate": "2027-11-01", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "target", "availEnd": "2027-11-01", "dayBasis": "ACT/360", "repayment": "AtMaturity", "commitment": 30000000}, "tranches": [{"id": "TRN_1", "face": 18000000, "name": "EUR Tranche", "currency": "EUR", "drawdowns": [], "repayments": [], "drawnInitially": 18000000, "interestComponents": [{"id": "IC_2", "name": "EUR Margin over ESTR", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 2, "dailyCompounding": true, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2031-11-01", "bps": 225, "from": "2026-11-01", "note": "EUR base margin"}], "baseIndex": "ESTR", "baseValue": 0.0325, "esgAdjustmentBps": 0}]}, {"id": "TRN_3", "face": 12000000, "name": "USD Tranche", "currency": "USD", "drawdowns": [], "repayments": [], "drawnInitially": 12000000, "interestComponents": [{"id": "IC_4", "name": "USD Margin over Term SOFR", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 5, "dailyCompounding": true, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2031-11-01", "bps": 250, "from": "2026-11-01", "note": "USD base margin"}], "baseIndex": "TermSOFR", "baseValue": 0.0475, "esgAdjustmentBps": 0}]}], "aasbExtras": null}', '2026-06-14 14:00:19.420825+00'),
  ('82912d15-a788-4e60-a2f6-25380f3d10ad', 'cedar-rcf', 'Cedar Ridge RCF — Revolver with Commitment Fee on Unfunded', 'Corporate', 'Medium', 3, 100.00, 'IFRS', false, '{"deal": {"le": "Corporate Bank", "name": "Cedar Ridge RCF", "dealId": "CDR-2026-005", "settle": "2026-07-01", "currency": "USD", "maturity": "2030-07-01", "framework": "IFRS", "counterparty": "Cedar Ridge Capital LLC"}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.01, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Arrangement Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-07-08", "linkedComponentId": ""}, {"id": "FEE_4", "bps": 0, "pct": 0.0075, "base": "unfunded", "ifrs": "IFRS15-overTime", "kind": "commitment", "mode": "overUnfunded", "label": "Commitment Fee (on undrawn)", "frequency": "quarterly", "flatAmount": 0, "paymentDate": "", "linkedComponentId": ""}, {"id": "FEE_5", "bps": 0, "pct": 0.0025, "base": "funded", "ifrs": "IFRS15-overTime", "kind": "utilisation", "mode": "overFunded", "label": "Utilisation Fee", "frequency": "quarterly", "flatAmount": 0, "paymentDate": "", "linkedComponentId": ""}], "facility": {"type": "revolver", "holiday": "usFederal", "availEnd": "2030-07-01", "dayBasis": "ACT/360", "repayment": "AtMaturity", "commitment": 20000000}, "tranches": [{"id": "TRN_1", "face": 20000000, "name": "Revolving Facility", "currency": "USD", "drawdowns": [{"date": "2027-01-15", "amount": 5000000}, {"date": "2028-04-01", "amount": 4000000}], "repayments": [{"date": "2029-01-15", "amount": 7000000}], "drawnInitially": 8000000, "interestComponents": [{"id": "IC_2", "name": "Margin over Term SOFR", "terms": [{"tenor": "1M", "weighted": false, "lockoutDays": 0, "lookbackDays": 5, "dailyCompounding": true, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2030-07-01", "bps": 200, "from": "2026-07-01", "note": "RCF margin"}], "baseIndex": "TermSOFR", "baseValue": 0.0475, "esgAdjustmentBps": 0}]}], "aasbExtras": null}', '2026-06-14 14:00:19.420825+00'),
  ('c1300735-c1ec-4273-a929-f5de3a5f4370', 'halcyon-bridge', 'Halcyon Bridge — Interest-Only + Balloon (2Y · 6%)', 'RealEstate', 'Simple+', 2, 100.00, 'IFRS', false, '{"deal": {"le": "Real Estate Finance", "name": "Halcyon Bridge", "dealId": "HAL-2026-003", "settle": "2026-06-01", "currency": "USD", "maturity": "2028-06-01", "framework": "IFRS", "counterparty": "Halcyon Properties Ltd."}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.015, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Arrangement Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-06-08", "linkedComponentId": ""}, {"id": "FEE_4", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "IFRS15-pointInTime", "kind": "other", "mode": "fixAmount", "label": "Exit Fee", "frequency": "oneOff", "flatAmount": 250000, "paymentDate": "2028-06-01", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "usFederal", "availEnd": "2026-06-01", "dayBasis": "ACT/360", "repayment": "AtMaturity", "commitment": 25000000}, "tranches": [{"id": "TRN_1", "face": 25000000, "name": "Bridge Loan", "currency": "USD", "drawdowns": [], "repayments": [], "drawnInitially": 25000000, "interestComponents": [{"id": "IC_2", "name": "Fixed Coupon", "terms": [{"tenor": "1M", "weighted": false, "lockoutDays": 0, "lookbackDays": 0, "dailyCompounding": false, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2028-06-01", "bps": 0, "from": "2026-06-01", "note": "Flat fixed rate · interest-only"}], "baseIndex": "FIXED", "baseValue": 0.06, "esgAdjustmentBps": 0}]}], "aasbExtras": null}', '2026-06-14 13:59:30.087216+00'),
  ('921a22a6-d2f7-47d2-a06e-e12287aa6c8d', 'marigold-amortising', 'Marigold Healthcare — Quarterly Amortising Term Loan', 'Corporate', 'Medium', 3, 100.00, 'USGAAP', false, '{"deal": {"le": "Healthcare Finance", "name": "Marigold Healthcare", "dealId": "MGD-2026-007", "settle": "2026-01-15", "currency": "USD", "maturity": "2030-01-15", "framework": "USGAAP", "counterparty": "Marigold Healthcare Group"}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.01, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Arrangement Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-01-22", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "usFederal", "availEnd": "2026-01-15", "dayBasis": "ACT/360", "repayment": "Periodic", "commitment": 12000000}, "tranches": [{"id": "TRN_1", "face": 12000000, "name": "Amortising Term Loan", "currency": "USD", "drawdowns": [], "repayments": [{"date": "2026-04-15", "amount": 750000}, {"date": "2026-07-15", "amount": 750000}, {"date": "2026-10-15", "amount": 750000}, {"date": "2027-01-15", "amount": 750000}, {"date": "2027-04-15", "amount": 750000}, {"date": "2027-07-15", "amount": 750000}, {"date": "2027-10-15", "amount": 750000}, {"date": "2028-01-15", "amount": 750000}, {"date": "2028-04-15", "amount": 750000}, {"date": "2028-07-15", "amount": 750000}, {"date": "2028-10-15", "amount": 750000}, {"date": "2029-01-15", "amount": 750000}, {"date": "2029-04-15", "amount": 750000}, {"date": "2029-07-15", "amount": 750000}, {"date": "2029-10-15", "amount": 750000}, {"date": "2030-01-15", "amount": 750000}], "drawnInitially": 12000000, "interestComponents": [{"id": "IC_2", "name": "Fixed Coupon", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 0, "dailyCompounding": false, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2030-01-15", "bps": 0, "from": "2026-01-15", "note": "Flat coupon"}], "baseIndex": "FIXED", "baseValue": 0.0525, "esgAdjustmentBps": 0}]}], "aasbExtras": null}', '2026-06-14 14:00:19.420825+00'),
  ('c206b4a0-dfa0-447d-927b-42ea8fd84f36', 'pinnacle-esg-sll', 'Pinnacle Real Estate — ESG-Linked Sustainability Loan', 'SustainableFinance', 'Medium', 3, 100.00, 'IFRS', false, '{"deal": {"le": "Sustainable Finance", "name": "Pinnacle Real Estate SLL", "dealId": "PNK-2026-006", "settle": "2026-10-01", "currency": "EUR", "maturity": "2032-10-01", "framework": "IFRS", "counterparty": "Pinnacle Properties REIT"}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.0125, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Arrangement Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-10-08", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "target", "availEnd": "2026-10-01", "dayBasis": "ACT/365", "repayment": "AtMaturity", "commitment": 15000000}, "tranches": [{"id": "TRN_1", "face": 15000000, "name": "Green Term Loan", "currency": "EUR", "drawdowns": [], "repayments": [], "drawnInitially": 15000000, "interestComponents": [{"id": "IC_2", "name": "Margin over EURIBOR", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 2, "dailyCompounding": false, "observationShift": 0}], "ratchet": {"kpi": "esgScore", "tiers": [{"to": 100, "from": 90, "marginBps": -15}, {"to": 90, "from": 75, "marginBps": 0}, {"to": 75, "from": 60, "marginBps": 10}, {"to": 60, "from": 0, "marginBps": 25}]}, "spreads": [{"to": "2032-10-01", "bps": 175, "from": "2026-10-01", "note": "SLL base margin"}], "baseIndex": "EURIBOR", "baseValue": 0.035, "esgAdjustmentBps": -10}]}], "aasbExtras": null}', '2026-06-14 14:00:19.420825+00'),
  ('f64a4240-7403-48ae-b731-e3b4d4684feb', 'riverside-vanilla', 'Riverside Industries — Vanilla Bullet (3Y · Fixed 5%)', 'Corporate', 'Simple', 1, 100.00, 'IFRS', false, '{"deal": {"le": "Corporate Bank", "name": "Riverside Industries", "dealId": "RVR-2026-001", "settle": "2026-04-01", "currency": "USD", "maturity": "2029-04-01", "framework": "IFRS", "counterparty": "Riverside Industries plc"}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.01, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Arrangement Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-04-08", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "usFederal", "availEnd": "2026-04-01", "dayBasis": "ACT/360", "repayment": "AtMaturity", "commitment": 5000000}, "tranches": [{"id": "TRN_1", "face": 5000000, "name": "Term Loan A", "currency": "USD", "drawdowns": [], "repayments": [], "drawnInitially": 5000000, "interestComponents": [{"id": "IC_2", "name": "Fixed Coupon", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 0, "dailyCompounding": false, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2029-04-01", "bps": 0, "from": "2026-04-01", "note": "Flat fixed rate"}], "baseIndex": "FIXED", "baseValue": 0.05, "esgAdjustmentBps": 0}]}], "aasbExtras": null}', '2026-06-14 13:59:30.087216+00'),
  ('56e1f744-4914-41e6-841d-d8967d8179f0', 'sapphire-floating', 'Sapphire Manufacturing — Floating SOFR + Step-Down (5Y)', 'Corporate', 'Simple', 2, 100.00, 'IFRS', false, '{"deal": {"le": "Corporate Bank", "name": "Sapphire Manufacturing", "dealId": "SPH-2026-002", "settle": "2026-05-15", "currency": "USD", "maturity": "2031-05-15", "framework": "IFRS", "counterparty": "Sapphire Manufacturing Inc."}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.0125, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Arrangement Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-05-22", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "usFederal", "availEnd": "2026-05-15", "dayBasis": "ACT/360", "repayment": "AtMaturity", "commitment": 10000000}, "tranches": [{"id": "TRN_1", "face": 10000000, "name": "Term Loan A", "currency": "USD", "drawdowns": [], "repayments": [], "drawnInitially": 10000000, "interestComponents": [{"id": "IC_2", "name": "Margin over Term SOFR", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 5, "dailyCompounding": true, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2028-05-15", "bps": 300, "from": "2026-05-15", "note": "Years 1-2 — opening margin"}, {"to": "2030-05-15", "bps": 275, "from": "2028-05-15", "note": "Years 3-4 — step-down"}, {"to": "2031-05-15", "bps": 250, "from": "2030-05-15", "note": "Year 5 — final step-down"}], "baseIndex": "TermSOFR", "baseValue": 0.0475, "esgAdjustmentBps": 0}]}], "aasbExtras": null}', '2026-06-14 13:59:30.087216+00'),
  ('ef6402b0-a62e-4ac6-90de-578032bfdd15', 'kestrel-projfin', 'Kestrel Wind Farm — Project Finance (Delayed-Draw · 10Y)', 'ProjectFinance', 'Complex', 4, 40.00, 'IFRS', false, '{"deal": {"le": "Project Finance", "name": "Kestrel Wind Farm", "dealId": "KST-2026-009", "settle": "2026-04-01", "currency": "GBP", "maturity": "2036-04-01", "framework": "IFRS", "counterparty": "Kestrel Renewables Ltd."}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.02, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Arrangement Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-04-08", "linkedComponentId": ""}, {"id": "FEE_4", "bps": 0, "pct": 0.004, "base": "unfunded", "ifrs": "IFRS15-overTime", "kind": "commitment", "mode": "overUnfunded", "label": "Commitment Fee (delayed draw)", "frequency": "quarterly", "flatAmount": 0, "paymentDate": "", "linkedComponentId": ""}, {"id": "FEE_5", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "IFRS15-overTime", "kind": "agency", "mode": "fixAmount", "label": "Agency Fee", "frequency": "annual", "flatAmount": 50000, "paymentDate": "2027-04-01", "linkedComponentId": ""}], "facility": {"type": "delayedDraw", "holiday": "ukBank", "availEnd": "2028-04-01", "dayBasis": "ACT/365", "repayment": "AtMaturity", "commitment": 50000000}, "tranches": [{"id": "TRN_1", "face": 50000000, "name": "Senior Project Loan", "currency": "GBP", "drawdowns": [{"date": "2026-10-01", "amount": 12000000}, {"date": "2027-04-01", "amount": 12000000}, {"date": "2027-10-01", "amount": 11000000}], "repayments": [], "drawnInitially": 15000000, "interestComponents": [{"id": "IC_2", "name": "SONIA + Margin", "terms": [{"tenor": "3M", "weighted": true, "lockoutDays": 0, "lookbackDays": 5, "dailyCompounding": true, "observationShift": 0}, {"tenor": "6M", "weighted": true, "lockoutDays": 2, "lookbackDays": 5, "dailyCompounding": true, "observationShift": 0}], "ratchet": {"kpi": "dscr", "tiers": [{"to": null, "from": 1.5, "marginBps": 0}, {"to": 1.5, "from": 1.2, "marginBps": 25}, {"to": 1.2, "from": 1, "marginBps": 75}, {"to": 1, "from": 0, "marginBps": 150}]}, "spreads": [{"to": "2028-04-01", "bps": 350, "from": "2026-04-01", "note": "Construction phase"}, {"to": "2032-04-01", "bps": 275, "from": "2028-04-01", "note": "Early operational"}, {"to": "2036-04-01", "bps": 225, "from": "2032-04-01", "note": "Mature operational"}], "baseIndex": "SONIA", "baseValue": 0.05, "esgAdjustmentBps": -5}]}], "aasbExtras": null}', '2026-06-14 14:01:22.274955+00'),
  ('be47301b-0422-488c-b74b-1148abd7d4e3', 'northbridge-property-au', 'Northbridge Property Trust — RE Senior Bullet (Mid-life · 1 Voluntary Prepayment)', 'RealEstate', 'Medium', 3, 100.00, 'AASB', true, '{"deal": {"le": "Corporate Bank — Sydney Branch", "name": "Northbridge Property Trust", "dealId": "NBP-2022-AU01", "settle": "2022-03-15", "currency": "AUD", "maturity": "2029-03-15", "framework": "AASB", "counterparty": "Northbridge Property Trust ABN 78 145 612 901"}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.01, "base": "commitment", "ifrs": "AASB9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Establishment Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2022-03-22", "linkedComponentId": ""}, {"id": "FEE_4", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "AASB15-overTime", "kind": "agency", "mode": "fixAmount", "label": "Annual Agency Fee", "frequency": "annual", "flatAmount": 40000, "paymentDate": "2023-03-15", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "auFederal", "availEnd": "2022-03-15", "dayBasis": "ACT/365", "repayment": "AtMaturity", "commitment": 50000000}, "tranches": [{"id": "TRN_1", "face": 50000000, "name": "Senior Secured Term Loan", "currency": "AUD", "drawdowns": [], "repayments": [{"date": "2024-09-15", "kind": "voluntary", "amount": 10000000, "reason": "Partial refinancing from cash sweep — 20% face paydown"}], "drawnInitially": 50000000, "interestComponents": [{"id": "IC_2", "name": "Margin over 3M BBSW", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 0, "dailyCompounding": false, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2025-03-15", "bps": 280, "from": "2022-03-15", "note": "Years 1-3 — opening margin"}, {"to": "2029-03-15", "bps": 250, "from": "2025-03-15", "note": "Years 4-7 — step-down on debt reduction"}], "baseIndex": "BBSW", "baseValue": 0.042, "esgAdjustmentBps": 0}]}], "aasbExtras": {"tier": "tier1", "apraStandard": "aps220", "gstTreatment": "financialSupply", "relatedParty": "none", "asicReportable": true, "frankingTreatment": "none"}}', '2026-06-14 14:02:34.407841+00'),
  ('4825cf81-5032-473c-9319-d2969942d87c', 'orion-leveraged-tlb', 'Orion Acquisition — Leveraged TLB (7Y · OID · Springing Covenant · ECF Sweep)', 'LeveragedFinance', 'Complex', 4, 35.00, 'IFRS', false, '{"deal": {"le": "Leveraged Finance", "name": "Orion Acquisition LBO", "dealId": "ORI-2026-011", "settle": "2026-08-15", "currency": "USD", "maturity": "2033-08-15", "framework": "IFRS", "counterparty": "Orion Industries Inc."}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.025, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Underwriting Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-08-22", "linkedComponentId": ""}, {"id": "FEE_4", "bps": 0, "pct": 0.02, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Original Issue Discount (OID 2pt)", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-08-15", "linkedComponentId": ""}, {"id": "FEE_5", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "IFRS15-overTime", "kind": "agency", "mode": "fixAmount", "label": "Agency Fee", "frequency": "annual", "flatAmount": 250000, "paymentDate": "2027-08-15", "linkedComponentId": ""}, {"id": "FEE_6", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "IFRS15-overTime", "kind": "other", "mode": "fixAmount", "label": "Excess Cash Flow Sweep Fee", "frequency": "annual", "flatAmount": 50000, "paymentDate": "2027-08-15", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "usFederal", "availEnd": "2026-08-15", "dayBasis": "ACT/360", "repayment": "AtMaturity", "commitment": 200000000}, "tranches": [{"id": "TRN_1", "face": 200000000, "name": "TLB · Senior Secured (1st Lien)", "currency": "USD", "drawdowns": [], "repayments": [], "drawnInitially": 200000000, "interestComponents": [{"id": "IC_2", "name": "Margin over Term SOFR (TLB)", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 5, "dailyCompounding": true, "observationShift": 0}], "ratchet": {"kpi": "leverageRatio", "tiers": [{"to": 4.5, "from": 0, "marginBps": -25}, {"to": 5.5, "from": 4.5, "marginBps": 0}, {"to": 6.5, "from": 5.5, "marginBps": 25}, {"to": null, "from": 6.5, "marginBps": 75}]}, "spreads": [{"to": "2033-08-15", "bps": 400, "from": "2026-08-15", "note": "TLB base margin · institutional"}], "baseIndex": "TermSOFR", "baseValue": 0.0475, "esgAdjustmentBps": 0}]}], "aasbExtras": null}', '2026-06-14 14:01:22.274955+00'),
  ('a12d81d7-8316-446a-819d-dd0601f5c9b5', 'phoenix-second-lien', 'Phoenix Capital — 2nd-Lien Term Loan (8Y · L+800 · PIK Toggle · Call Protection)', 'LeveragedFinance', 'Complex', 5, 50.00, 'IFRS', false, '{"deal": {"le": "Leveraged Finance", "name": "Phoenix Capital 2L", "dealId": "PHX-2026-012", "settle": "2026-09-15", "currency": "USD", "maturity": "2034-09-15", "framework": "IFRS", "counterparty": "Phoenix Capital Holdings"}, "fees": [{"id": "FEE_4", "bps": 0, "pct": 0.04, "base": "commitment", "ifrs": "IFRS9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "2L Upfront Fee (4pt)", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-09-22", "linkedComponentId": ""}, {"id": "FEE_5", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "IFRS15-pointInTime", "kind": "other", "mode": "fixAmount", "label": "Call Protection Fee (Y1 NC)", "frequency": "oneOff", "flatAmount": 750000, "paymentDate": "2027-09-15", "linkedComponentId": ""}, {"id": "FEE_6", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "IFRS15-overTime", "kind": "agency", "mode": "fixAmount", "label": "Agency Fee", "frequency": "annual", "flatAmount": 100000, "paymentDate": "2027-09-15", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "usFederal", "availEnd": "2026-09-15", "dayBasis": "ACT/360", "repayment": "AtMaturity", "commitment": 75000000}, "tranches": [{"id": "TRN_1", "face": 75000000, "name": "Second-Lien Term Loan", "currency": "USD", "drawdowns": [], "repayments": [], "drawnInitially": 75000000, "interestComponents": [{"id": "IC_2", "name": "2L Cash Margin over Term SOFR", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 5, "dailyCompounding": true, "observationShift": 0}], "ratchet": {"kpi": "leverageRatio", "tiers": [{"to": 5, "from": 0, "marginBps": 0}, {"to": 6, "from": 5, "marginBps": 50}, {"to": null, "from": 6, "marginBps": 100}]}, "spreads": [{"to": "2034-09-15", "bps": 800, "from": "2026-09-15", "note": "2L cash margin · L+800"}], "baseIndex": "TermSOFR", "baseValue": 0.0475, "esgAdjustmentBps": 0}, {"id": "IC_3", "name": "2L PIK Toggle Margin", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 0, "dailyCompounding": false, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2034-09-15", "bps": 0, "from": "2026-09-15", "note": "PIK toggle on full coupon if cash flow weak"}], "baseIndex": "FIXED", "baseValue": 0.05, "esgAdjustmentBps": 0}]}], "aasbExtras": null}', '2026-06-14 14:01:22.274955+00'),
  ('b91f4e16-d30a-4c39-839f-95d0a3626983', 'murraydarling-mining-au', 'Murray-Darling Mining RCF — Multi-Draw (Live · 3 Drawdowns · 2 Paydowns)', 'Corporate', 'Complex', 4, 100.00, 'AASB', true, '{"deal": {"le": "Corporate Bank — Melbourne Branch", "name": "Murray-Darling Mining Pty Ltd", "dealId": "MDM-2023-AU02", "settle": "2023-06-01", "currency": "AUD", "maturity": "2028-06-01", "framework": "AASB", "counterparty": "Murray-Darling Mining Pty Ltd ABN 22 658 209 345"}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.009, "base": "commitment", "ifrs": "AASB9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Upfront Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2023-06-08", "linkedComponentId": ""}, {"id": "FEE_4", "bps": 0, "pct": 0.004, "base": "unfunded", "ifrs": "AASB15-overTime", "kind": "commitment", "mode": "fixPct", "label": "Line Fee (Undrawn)", "frequency": "quarterly", "flatAmount": 0, "paymentDate": "2023-09-01", "linkedComponentId": ""}, {"id": "FEE_5", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "AASB15-overTime", "kind": "agency", "mode": "fixAmount", "label": "Agency Fee", "frequency": "annual", "flatAmount": 35000, "paymentDate": "2024-06-01", "linkedComponentId": ""}], "facility": {"type": "revolver", "holiday": "auFederal", "availEnd": "2027-06-01", "dayBasis": "ACT/365", "repayment": "AtMaturity", "commitment": 40000000}, "tranches": [{"id": "TRN_1", "face": 40000000, "name": "Revolving Credit Facility", "currency": "AUD", "drawdowns": [{"date": "2023-12-15", "amount": 10000000, "reason": "Equipment finance — heavy machinery acquisition"}, {"date": "2024-10-20", "amount": 8000000, "reason": "Working capital — seasonal inventory build"}], "repayments": [{"date": "2024-06-30", "kind": "scheduled", "amount": 5000000, "reason": "Operating cashflow surplus"}, {"date": "2025-03-15", "kind": "scheduled", "amount": 7000000, "reason": "Commodity price upside · early paydown"}], "drawnInitially": 15000000, "interestComponents": [{"id": "IC_2", "name": "Margin over 3M BBSW", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 0, "dailyCompounding": false, "observationShift": 0}], "ratchet": {"kpi": "leverageRatio", "tiers": [{"to": 2, "from": 0, "marginBps": 0}, {"to": 3, "from": 2, "marginBps": 25}, {"to": null, "from": 3, "marginBps": 75}]}, "spreads": [{"to": "2025-06-01", "bps": 240, "from": "2023-06-01", "note": "Years 1-2 — opening margin"}, {"to": "2028-06-01", "bps": 220, "from": "2025-06-01", "note": "Years 3-5 — step-down on covenant compliance"}], "baseIndex": "BBSW", "baseValue": 0.0445, "esgAdjustmentBps": 0}]}], "aasbExtras": {"tier": "tier1", "apraStandard": "aps220", "gstTreatment": "financialSupply", "relatedParty": "none", "asicReportable": true, "frankingTreatment": "none"}}', '2026-06-14 14:02:34.407841+00'),
  ('e7cc2d9a-46eb-42a0-938f-ecff8c9cb210', 'pilbara-aasb-au', 'Australian Example — Pilbara Mining Term Loan (AUD · BBSW · AASB 9 · APRA)', 'Corporate', 'Medium', 3, 100.00, 'AASB', false, '{"deal": {"le": "Corporate Bank — Sydney Branch", "name": "Pilbara Resources Term Loan", "dealId": "PIL-2026-AU01", "settle": "2026-07-01", "currency": "AUD", "maturity": "2031-07-01", "framework": "AASB", "counterparty": "Pilbara Resources Pty Ltd (ABN 41 132 758 619)"}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.0125, "base": "commitment", "ifrs": "AASB9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Establishment Fee (Upfront)", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2026-07-08", "linkedComponentId": ""}, {"id": "FEE_4", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "AASB15-overTime", "kind": "agency", "mode": "fixAmount", "label": "Agency Fee (Annual)", "frequency": "annual", "flatAmount": 50000, "paymentDate": "2027-07-01", "linkedComponentId": ""}, {"id": "FEE_5", "bps": 0, "pct": 0.005, "base": "undrawn", "ifrs": "AASB15-overTime", "kind": "commitment", "mode": "fixPct", "label": "Line Fee (Undrawn)", "frequency": "quarterly", "flatAmount": 0, "paymentDate": "2026-10-01", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "auFederal", "availEnd": "2026-07-01", "dayBasis": "ACT/365", "repayment": "AtMaturity", "commitment": 80000000}, "tranches": [{"id": "TRN_1", "face": 80000000, "name": "Senior Secured Term Loan A", "currency": "AUD", "drawdowns": [], "repayments": [], "drawnInitially": 80000000, "interestComponents": [{"id": "IC_2", "name": "Margin over 3M BBSW", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 0, "dailyCompounding": false, "observationShift": 0}], "ratchet": {"kpi": "leverageRatio", "tiers": [{"to": 2.5, "from": 0, "marginBps": 0}, {"to": 3.5, "from": 2.5, "marginBps": 25}, {"to": 4.5, "from": 3.5, "marginBps": 50}, {"to": null, "from": 4.5, "marginBps": 100}]}, "spreads": [{"to": "2028-07-01", "bps": 285, "from": "2026-07-01", "note": "Years 1-2 — opening margin (BBSW + 285bps)"}, {"to": "2030-07-01", "bps": 260, "from": "2028-07-01", "note": "Years 3-4 — step-down"}, {"to": "2031-07-01", "bps": 240, "from": "2030-07-01", "note": "Year 5 — final step-down"}], "baseIndex": "BBSW", "baseValue": 0.0435, "esgAdjustmentBps": -5}]}], "aasbExtras": {"tier": "tier1RDR", "apraStandard": "aps220", "gstTreatment": "financialSupply", "relatedParty": "aasb124-disclose", "asicReportable": true, "frankingTreatment": "none"}}', '2026-06-14 14:02:34.407841+00'),
  ('36ced44d-4fdf-48c8-9a6a-84001aecb9af', 'riverina-agribusiness-au', 'Riverina Agribusiness Co-op — 10Y Amortising (Deeply Mature · 13 Semi-Annual Paydowns)', 'Corporate', 'Medium', 3, 100.00, 'AASB', true, '{"deal": {"le": "Corporate Bank — Brisbane Branch", "name": "Riverina Agribusiness Co-op Ltd", "dealId": "RAC-2020-AU03", "settle": "2020-01-15", "currency": "AUD", "maturity": "2030-01-15", "framework": "AASB", "counterparty": "Riverina Agribusiness Co-op Ltd ABN 91 333 421 887"}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.0075, "base": "commitment", "ifrs": "AASB9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Establishment Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2020-01-22", "linkedComponentId": ""}, {"id": "FEE_4", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "AASB15-overTime", "kind": "agency", "mode": "fixAmount", "label": "Annual Agency Fee", "frequency": "annual", "flatAmount": 25000, "paymentDate": "2021-01-15", "linkedComponentId": ""}], "facility": {"type": "termLoan", "holiday": "auFederal", "availEnd": "2020-01-15", "dayBasis": "ACT/365", "repayment": "Periodic", "commitment": 30000000}, "tranches": [{"id": "TRN_1", "face": 30000000, "name": "10-Year Amortising Term Loan", "currency": "AUD", "drawdowns": [], "repayments": [{"date": "2020-07-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #1"}, {"date": "2021-01-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #2"}, {"date": "2021-07-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #3"}, {"date": "2022-01-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #4"}, {"date": "2022-07-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #5"}, {"date": "2023-01-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #6"}, {"date": "2023-07-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #7"}, {"date": "2024-01-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #8"}, {"date": "2024-07-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #9"}, {"date": "2025-01-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #10"}, {"date": "2025-07-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #11"}, {"date": "2026-01-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #12"}, {"date": "2026-07-15", "kind": "scheduled", "amount": 1500000, "reason": "Semi-annual amortisation #13 — upcoming"}], "drawnInitially": 30000000, "interestComponents": [{"id": "IC_2", "name": "Fixed Coupon", "terms": [{"tenor": "6M", "weighted": false, "lockoutDays": 0, "lookbackDays": 0, "dailyCompounding": false, "observationShift": 0}], "ratchet": {"kpi": "none", "tiers": []}, "spreads": [{"to": "2030-01-15", "bps": 0, "from": "2020-01-15", "note": "Flat fixed rate · long-tenor agri financing"}], "baseIndex": "FIXED", "baseValue": 0.0425, "esgAdjustmentBps": 0}]}], "aasbExtras": {"tier": "tier2", "apraStandard": "notApplicable", "gstTreatment": "financialSupply", "relatedParty": "none", "asicReportable": false, "frankingTreatment": "none"}}', '2026-06-14 14:02:34.407841+00'),
  ('3128c33a-51df-4eb8-8eef-587f75db638e', 'tasman-renewables-sll-au', 'Tasman Renewables Green SLL — Mid-life · 3 Drawdowns · 1 Mandatory Prepayment', 'SustainableFinance', 'Complex', 4, 100.00, 'AASB', true, '{"deal": {"le": "Sustainable Finance — Sydney Branch", "name": "Tasman Renewables Pty Ltd", "dealId": "TRN-2023-AU04", "settle": "2023-12-01", "currency": "AUD", "maturity": "2029-12-01", "framework": "AASB", "counterparty": "Tasman Renewables Pty Ltd ABN 17 502 198 663"}, "fees": [{"id": "FEE_3", "bps": 0, "pct": 0.011, "base": "commitment", "ifrs": "AASB9-EIR", "kind": "arrangement", "mode": "fixPct", "label": "Green Loan Establishment Fee", "frequency": "oneOff", "flatAmount": 0, "paymentDate": "2023-12-08", "linkedComponentId": ""}, {"id": "FEE_4", "bps": 0, "pct": 0, "base": "commitment", "ifrs": "AASB15-overTime", "kind": "other", "mode": "fixAmount", "label": "ESG Reporting Fee", "frequency": "annual", "flatAmount": 30000, "paymentDate": "2024-12-01", "linkedComponentId": ""}, {"id": "FEE_5", "bps": 0, "pct": 0.004, "base": "unfunded", "ifrs": "AASB15-overTime", "kind": "commitment", "mode": "fixPct", "label": "Line Fee (Undrawn)", "frequency": "quarterly", "flatAmount": 0, "paymentDate": "2024-03-01", "linkedComponentId": ""}], "facility": {"type": "delayedDraw", "holiday": "auFederal", "availEnd": "2026-12-01", "dayBasis": "ACT/365", "repayment": "AtMaturity", "commitment": 60000000}, "tranches": [{"id": "TRN_1", "face": 60000000, "name": "Green Sustainability-Linked Loan", "currency": "AUD", "drawdowns": [{"date": "2024-05-15", "amount": 25000000, "reason": "Stage 2 construction — solar farm Phase A"}, {"date": "2025-01-30", "amount": 15000000, "reason": "Stage 3 construction — battery storage + grid connect"}], "repayments": [{"date": "2025-09-15", "kind": "mandatory", "amount": 8000000, "reason": "Mandatory prepayment from non-core asset sale (legacy wind farm)", "trigger": "assetSale"}], "drawnInitially": 20000000, "interestComponents": [{"id": "IC_2", "name": "Margin over 3M BBSW (with ESG ratchet)", "terms": [{"tenor": "3M", "weighted": false, "lockoutDays": 0, "lookbackDays": 0, "dailyCompounding": false, "observationShift": 0}], "ratchet": {"kpi": "esgScore", "tiers": [{"to": 100, "from": 80, "marginBps": -10}, {"to": 80, "from": 60, "marginBps": 0}, {"to": 60, "from": 0, "marginBps": 15}]}, "spreads": [{"to": "2026-12-01", "bps": 250, "from": "2023-12-01", "note": "Years 1-3 — opening margin"}, {"to": "2029-12-01", "bps": 220, "from": "2026-12-01", "note": "Years 4-6 — step-down on debt service ratio"}], "baseIndex": "BBSW", "baseValue": 0.042, "esgAdjustmentBps": -7.5}]}], "aasbExtras": {"tier": "tier1", "apraStandard": "aps220", "gstTreatment": "financialSupply", "relatedParty": "none", "asicReportable": true, "frankingTreatment": "none"}}', '2026-06-14 14:02:34.407841+00')
on conflict do nothing;

commit;

-- ═══════════════════════════════════════════════════════════════════════
-- Expected row counts — compare after restoring
-- ═══════════════════════════════════════════════════════════════════════
--   accounting_frameworks      4
--   cashflow_column_config    18
--   gl_accounts               58
--   gl_business_events        24
--   gl_event_mappings         96
--   gl_frameworks              4
--   gl_transtype_mappings     26
--   holiday_calendars          7
--   holiday_dates            611
--   preset_catalog            17
--                            ───
--                            865
--
-- One query that returns all ten:
--
--   select 'accounting_frameworks' t, count(*) n from accounting_frameworks
--   union all select 'cashflow_column_config', count(*) from cashflow_column_config
--   union all select 'gl_accounts', count(*) from gl_accounts
--   union all select 'gl_business_events', count(*) from gl_business_events
--   union all select 'gl_event_mappings', count(*) from gl_event_mappings
--   union all select 'gl_frameworks', count(*) from gl_frameworks
--   union all select 'gl_transtype_mappings', count(*) from gl_transtype_mappings
--   union all select 'holiday_calendars', count(*) from holiday_calendars
--   union all select 'holiday_dates', count(*) from holiday_dates
--   union all select 'preset_catalog', count(*) from preset_catalog
--   order by t;
--
-- A seed that restored 95 of 96 gl_event_mappings is the failure worth
-- catching here: the application will run, and one business event will post
-- to the wrong account, or to nothing at all.
--
-- Two referential checks worth running as well. Both should return no rows:
--
--   -- every mapping points at an account that exists
--   select event_key, framework_code, dr_account_code, cr_account_code
--     from gl_event_mappings m
--    where not exists (select 1 from gl_accounts a where a.account_code = m.dr_account_code)
--       or not exists (select 1 from gl_accounts a where a.account_code = m.cr_account_code);
--
--   -- every preset names a calendar that exists  (currently returns 5 rows —
--   -- the auFederal problem documented above)
--   select preset_key from preset_catalog
--    where (build_definition #>> '{facility,holiday}')
--          not in (select code from holiday_calendars);
