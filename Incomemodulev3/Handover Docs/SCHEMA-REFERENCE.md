# PCS Loan Module — Database Schema Reference

**Read from the live database, 12 October 2026.**
PostgreSQL 17 · 77 tables · 227 RLS policies · 57 enum types · 101 migrations.

> **This is a reference, not a rebuild script.** To recreate the database use the
> Supabase CLI, which captures functions, triggers, grants, sequences and
> extensions that a reconstructed DDL dump silently omits:
>
> ```bash
> supabase link --project-ref prljhhyfgzipjnfpztfu
> supabase db dump --schema public > schema.sql
> supabase db dump --schema public --data-only > seed.sql
> ```

---

## Table inventory

Columns, RLS policies and current row counts. Row counts show which tables carry
demo data and which are reference data.

```
TABLE                              COLS  POL     ROWS
aasb_extras                           9    4        4
accounting_frameworks                22    3        4   reference
accounting_run_history               11    2        0
accounting_runs                      29    3       62
bb_approved_location                 10    4       32
bb_approved_offtaker                 10    4       14
bb_certificate                       17    4        1
bb_eligible_asset_class              11    4       12
bb_livestock_inventory               19    4        5
borrower_financials                  49    8        2
cash_movement_actuals                15    1        0
cash_movement_batches                13    1        0
cashflow_column_config               15    2       18   reference
cashflow_schedules                   37    6   222072   demo
covenant_breach_log                  23    2        4
covenants                            24    1       37
credit_agreements                    36    8        3
dashboard_kpi_snapshots              15    1        0
deal_commitment_events               10    4        0
deal_guarantors                      11    4       10
deal_legal_entity_allocations        15    2        4
deal_portfolio_position              19    2        1
deal_recipients                      12    8        0
deal_reporting_requirements          16    4        9
deal_securities                       5    1        0
deal_user_assignments                 7    4        3   access control
deals                                58    5       55   demo
default_events                       10    2        0
document_extractions                 21    4       14
drawdowns                             8    5       25
external_cashflows                   20    1    18218   demo
external_snapshot_changes            15    1     1127
external_snapshots                   17    1       20
facilities                           11    4       44
fees                                 26    1       73
fund_allocations                     11    4        2
funds                                15    4        3
gl_account_mappings                  13    4        2
gl_accounts                           9    3       58   reference — chart of accounts
gl_business_events                    8    2       24   reference
gl_coverage_audit                     9    2        0
gl_event_mappings                    14    2       96   reference — event to DR/CR
gl_frameworks                        10    2        4   reference
gl_transtype_mappings                11    3       26   reference
hedge_designations                   12    1        0
interest_components                  14    5       57
interest_payments                     9    1        4
interest_spreads                      7    4       74
interest_terms                       11    4       54
journal_entries                      30    3    18477   demo
loan_lifecycle_events                14    2        2
loan_notices                         31    8     2921   demo
modification_events                  15    2        5
notice_deliveries                    15    3        0
paydowns                             10    5      101
pcs_ref_datasets                     21    2       16
pcs_ref_rows                          9    2     2254
prepayment_penalty_schedule           8    2        0
preset_catalog                       11    3       17   reference — demo presets
principal_events                     17    1        1
ratchet_tiers                         8    4       33
rate_curve_points                     7    1        9
rate_curves                          12    1        1
recon_line_items                     12    1        0
reconciliations                      12    1        0
rfr_fixings                           7    2     2837   reference — published rates
rfr_forecast_curves                  11    2        1   reference
rfr_forecast_points                   6    2     2211   reference
rfr_index_fixings                     7    2      841   reference
securities                           19    2        0
security_pricing                      8    2        0
sessions                              8    7        0
teams                                 5    2        1   access control
tranches                             24    1       57
treatment_overrides                  61    5       34   accounting policy per deal
user_profiles                         7    5       16   access control
user_teams                            4    4        3   access control
```

### The tables that matter most

- **`deals`** (58 cols) — the deal master. `source` distinguishes internal from external.
- **`treatment_overrides`** (61 cols) — every accounting policy decision per deal: EIR method, ECL stage, PD/LGD, POCI flags and lifetime ECL, modification threshold, hedge designation. This is where the accounting judgements live.
- **`accounting_runs`** / **`journal_entries`** — a run and its output. One current run per deal.
- **`cashflow_schedules`** — the daily schedule, one row per day per run. The largest table by far.
- **`external_snapshots`** / **`external_cashflows`** — imported deals. A snapshot is complete and immutable; changes are detected by diffing.
- **`gl_event_mappings`** — business event to debit/credit account, per framework. Drives journal mapping and is client-configurable.

---

## Access control

Row-level security on **all 77 tables**, enforced through three helpers:

| Helper | Grants |
|---|---|
| `is_admin()` | Admin override across the workspace |
| `in_team(team_id)` | Team-scoped workspace configuration |
| `owns_deal(deal_id)` | Per-deal access via `deal_user_assignments` |

Typical pattern, from `gl_event_mappings`:

```sql
create policy gl_event_mappings_read on public.gl_event_mappings
  for select to authenticated
  using (team_id is null or is_admin() or in_team(team_id));

create policy gl_event_mappings_write on public.gl_event_mappings
  for all to authenticated
  using      (is_admin() or (team_id is not null and in_team(team_id)))
  with check (is_admin() or (team_id is not null and in_team(team_id)));
```

Workspace defaults are rows with `team_id IS NULL` — readable by all, writable by admins.

**Audit before production.** Some early policies grant `{anon, authenticated}` with `using (true)` — a demo-phase hangover. `rfr_fixings` is one. Find them all:

```sql
select tablename, policyname, roles, qual
from pg_policies
where schemaname = 'public' and 'anon' = any(roles)
order by tablename;
```

---

## Enum types (57)

```sql
create type public.aasb_tier_kind as enum ('tier1', 'tier1RDR', 'tier2');
create type public.accounting_framework as enum ('IFRS', 'USGAAP', 'ASPE', 'AASB');
create type public.allocation_method as enum ('pct', 'absolute', 'pro_rata', 'side_letter', 'waterfall');
create type public.amort_profile_frequency as enum ('M', 'Q', 'S', 'A');
create type public.amort_profile_kind as enum ('bullet', 'levelPrincipal', 'annuity', 'ioBalloon');
create type public.apra_standard_kind as enum ('notApplicable', 'aps220', 'aps221', 'aps330');
create type public.base_index_type as enum ('FIXED', 'SONIA', 'SOFR', 'TermSOFR', 'BBSW', 'EURIBOR', 'ESTR', 'BBSY');
create type public.batch_status as enum ('Pending', 'Pushed', 'Posted', 'Failed', 'Cancelled');
create type public.bilateral_flag as enum ('Bilateral', 'Syndicated', 'ClubDeal');
create type public.breach_status as enum ('active', 'cured', 'acceleratedToPrepayment', 'waived');
create type public.business_model as enum ('HoldToCollect', 'HoldToCollectAndSell', 'Other');
create type public.commitment_event_type_enum as enum ('initial_commitment', 'commitment_increase', 'commitment_decrease', 'delayed_draw_available', 'delayed_draw_expired', 'extension_granted', 'rollover', 'cancellation');
create type public.covenant_category as enum ('maintenance', 'incurrence', 'operating', 'information', 'sustainability', 'borrowingBase');
create type public.covenant_consequence as enum ('notice', 'marginStepUp', 'defaultInterest', 'sicrTrigger', 'mandatoryPrepayment', 'acceleration');
create type public.covenant_direction as enum ('max', 'min');
create type public.covenant_test_frequency as enum ('monthly', 'quarterly', 'semiAnnual', 'annual', 'event', 'adHoc');
create type public.cure_method as enum ('equityInjection', 'sponsorEquity', 'refinancing', 'naturalCure', 'waiver', 'other');
create type public.day_count_basis as enum ('ACT/360', 'ACT/365', 'ACT/ACT', '30/360', '30E/360');
create type public.delivery_method as enum ('smtp', 'mailto', 'manual', 'api');
create type public.delivery_status as enum ('queued', 'sent', 'failed', 'bounced', 'opened');
create type public.ecl_model_type as enum ('staged', 'cecl', 'incurred');
create type public.ecl_stage_value as enum ('stage1', 'stage2', 'stage3', 'poci');
create type public.eir_method as enum ('default', 'effectiveInterestPrice', 'effectiveInterestFormula', 'effectiveInterestIRR', 'override');
create type public.event_type as enum ('draw', 'paydown', 'prepayment', 'mandatoryPrepayment', 'prepaymentPenalty', 'default', 'writeOff', 'recovery', 'cure', 'forbearance', 'capitalisedCost', 'loanSale', 'participation', 'debtEquitySwap', 'modification', 'maturityPayoff');
create type public.extraction_review_status as enum ('pending', 'reviewed', 'discarded', 'imported', 'failed');
create type public.extraction_type as enum ('notice', 'credit_agreement', 'borrower_financials', 'waiver', 'amendment', 'other');
create type public.facility_type as enum ('termLoan', 'revolver', 'delayedDraw', 'bridgeLoan', 'revolvingBorrowingBase');
create type public.fee_base_kind as enum ('commitment', 'funded', 'unfunded', 'tranche-face');
create type public.fee_frequency as enum ('oneOff', 'monthly', 'quarterly', 'semi', 'annual');
create type public.fee_kind as enum ('arrangement', 'commitment', 'utilisation', 'agency', 'other', 'exitFeeIrrHurdle', 'origination', 'management', 'performance');
create type public.fee_mode as enum ('fixPct', 'fixAmount', 'floatBps', 'overFunded', 'overUnfunded', 'overInterestComponent', 'irrHurdleTiers', 'cashCoupon', 'undrawnRamp');
create type public.financial_period_type as enum ('monthly', 'quarterly', 'semi_annual', 'annual', 'ttm', 'ytd', 'custom');
create type public.franking_treatment_kind as enum ('none', 'fullyFranked', 'partiallyFranked', 'unfranked');
create type public.fund_domicile as enum ('US', 'EU', 'UK', 'AU', 'Cayman', 'Luxembourg', 'Ireland', 'Other');
create type public.gst_treatment_kind as enum ('financialSupply', 'taxable', 'gstFree', 'mixed');
create type public.hedge_designation_type as enum ('cfh', 'fvh', 'fx_hedge', 'none');
create type public.holiday_calendar as enum ('none', 'usFederal', 'ukBank', 'target', 'auFederal');
create type public.ifrs9_classification as enum ('AmortisedCost', 'FVOCI', 'FVTPL');
create type public.je_source as enum ('engine', 'aasb-overlay-gst', 'aasb-overlay-apra', 'aasb-overlay-franking', 'participation-scaled', 'cash-leg', 'manual');
create type public.lifecycle_event_type as enum ('loanSale', 'participation', 'debtEquitySwap', 'recovery', 'writeOff', 'cure', 'forbearance', 'capitalisedCost');
create type public.modification_type as enum ('substantial', 'non_substantial');
create type public.notice_source as enum ('system_derived', 'agent_received', 'manual', 'email_ingest');
create type public.notice_status_enum as enum ('pending', 'sent', 'acknowledged', 'completed', 'cancelled');
create type public.notice_type_enum as enum ('drawdown', 'interest', 'repayment', 'prepayment', 'rate_reset', 'fee', 'waiver', 'amendment', 'default', 'other', 'reporting_due');
create type public.oid_treatment_type as enum ('none', 'accrete', 'expense_immediately');
create type public.paydown_kind as enum ('scheduled', 'voluntary', 'mandatory', 'changeOfControl', 'assetSale');
create type public.prepay_trigger as enum ('changeOfControl', 'assetSale', 'ecfSweep', 'covenantBreach', 'manual');
create type public.ratchet_kpi as enum ('none', 'leverageRatio', 'dscr', 'esgScore', 'interestCoverage', 'currentRatio', 'minNetWorth', 'capexLimit', 'restrictedPayments', 'icr', 'borrowingBase', 'lvrConstruction', 'ltc', 'rlvr', 'minNetAssets', 'minPresales', 'livestockAgingContracted', 'livestockAgingUncontracted', 'permittedIndebtednessCap', 'tradeCreditThreshold', 'significantDisposalPct', 'insuranceMaintenance', 'utilisationCount');
create type public.recipient_role_enum as enum ('loan_officer', 'agent_bank', 'admin_agent', 'lender', 'borrower', 'trustee', 'legal_counsel', 'operations', 'other');
create type public.recon_status as enum ('Clean', 'Discrepancy', 'Investigated', 'Resolved');
create type public.regulator_code as enum ('SEC', 'ESMA', 'Fed', 'APRA', 'FCA', 'CIMA', 'CSSF', 'None');
create type public.related_party_kind as enum ('none', 'aasb124-disclose', 'aasb124-fullDisclosure');
create type public.repayment_type as enum ('AtMaturity', 'Periodic', 'BulletWithAmort');
create type public.revolver_cost_basis as enum ('maturity', 'commitment');
create type public.run_status as enum ('Draft', 'Calculated', 'Approved', 'Posted', 'Cancelled', 'Error');
create type public.trade_accounting_method as enum ('settleDate', 'tradeDate');
create type public.view_mode as enum ('syndication', 'participation');
```

---

## Migration history (101)

The schema was built incrementally. The names read as a development log.

```
20260613132449  pe_income_schema
20260613134353  fund_user_defined_fields
20260614023832  drop_pe_income_schema
20260614030048  v2_01_foundation_enums_teams_frameworks
20260614030132  v2_02_deal_master_data
20260614030216  v2_03_lifecycle_events_and_treatment
20260614030337  v2_04_pipeline_runs_jes_cashmove_recon
20260614030439  v2_05_market_data_and_sessions
20260614030507  v2_06_gl_chart_and_transtype_mappings
20260614030723  v2_07a_rls_helpers_and_enable
20260614030748  v2_07b_rls_policies_reference_and_self
20260614030808  v2_07c_rls_policies_deals_and_direct_children
20260614030931  v2_07d_rls_policies_nested_qualified
20260614031238  v2_08c_seed_teams_frameworks_gl_complete
20260614031308  v2_09_fix_function_search_path
20260614140344  v2_10_materialize_preset_function
20260614140604  v2_11_add_estr_base_index
20260616124133  v3_01_anon_read_demo_data
20260616140920  v3_02_anon_write_deal_definition
20260616152920  v3_03_cashflow_schedules
20260617022915  v3_04_anon_delete_deals
20260626170202  add_stage2_settings_tables
20260626174756  extend_treatment_overrides_with_stage2_columns
20260626182243  extend_lifecycle_event_type_enum
20260627145104  add_covenants_table
20260630014012  add_covenant_breach_log_table
20260701004905  add_rfr_fixings_table
20260711140522  auth_add_created_by_and_owner_policies
20260712152223  rls_helpers_security_definer_fix_recursion
20260719110127  add_loan_notices_table
20260719111214  fix_loan_notices_unique_constraint
20260719112723  add_deal_recipients_table
20260720002913  multi_fund_allocations_phase1
20260720014841  notice_deliveries_phase2a
20260720121117  ai_document_extractions_phase1
20260720143024  notice_matching_pairs
20260720190309  borrower_financials_phase1
20260720201435  loan_notices_source_extraction_link
20260721114634  credit_agreements_phase2
20260721175801  interest_components_floor_cap
20260723122949  mezz_support_enums
20260723123017  mezz_support_columns
20260726193003  access_control_deal_user_assignments
20260726193135  resolve_user_by_email_rpc
20260726200151  team_and_user_rpcs
20260727121113  user_profiles_backfill_and_trigger
20260727123437  set_user_admin_rpc
20260727124120  set_user_admin_disambiguate_column
20260727152121  deal_guarantors_registry
20260727174001  deal_legal_compliance_metadata
20260727175758  firstag_facility_type_and_livestock_kpis
20260727175901  firstag_borrowing_base_schema
20260727181854  add_bbsy_to_base_index_enum
20260727183121  undrawn_fee_ramp_mode_and_columns
20260727184720  fee_deductible_from_first_utilisation
20260728173421  rfr_index_fixings_shared_curves
20260728210032  deal_reporting_requirements
20260728210146  reporting_due_notice_type_and_sweep_fix
20260728210235  sweep_reporting_correct_enum_names
20260728210627  deal_secondary_framework_dual_book
20260803200459  fix_sweep_reporting_notices_enum_name
20260803200548  optimise_owns_deal_admin_shortcircuit
20260809215302  gl_account_mappings
20260810025427  gl_account_mappings_usage_category
20260810030013  gl_usage_category_rebackfill_events
20260819184205  deal_commitment_events
20260820181412  deal_interest_accrual_frequency
20260821003332  gl_configuration_business_event_matrix
20260821003351  gl_event_mappings_seed_defaults
20260824205936  pcs_sync_reference_data
20260825013338  pcs_ref_datasets_add_rw_report_id
20260828172942  deal_legal_entity_allocations
20260828225003  deal_portfolio_position
20260901172327  add_facility_name
20260901202052  add_tranche_drawn_initially_date
20260901202425  add_interest_component_accrual_freq
20260901204234  create_interest_payments
20260903130154  create_rate_curves
20260903130212  create_curve_rate_lookup
20260913141930  external_deal_feed_schema
20260916150724  add_deal_signing_date
20260916150959  add_interest_component_settlement
20260917123014  external_cashflows_settlement_and_basis
20260918210920  external_cashflow_verification_status
20260919022018  rfr_conventions_stated_not_assumed
20260919210854  eir_floating_policy_on_treatment_overrides
20260919221917  tranche_eir_acquisition_fields
20260921142047  persist_balance_checkpoints_on_snapshot
20261002022742  add_sent_to_pcs_to_deal_portfolio_position
20261002173337  add_poci_lifetime_ecl_to_treatment_overrides
20261007094300  add_original_maturity_date
20261008090106  add_ecl_allowance_and_net_carrying_to_cashflow_schedules
20261008091203  create_cashflow_column_config
20261008091228  seed_cashflow_column_config_defaults
20261008100349  create_rfr_forecast_curves
20261008100413  create_rfr_effective_rate_function
20261008103750  create_run_comparison_function
20261008104740  add_rate_basis_to_forecast_curves
20261008110545  correct_lender_side_gl_mappings
20261008112152  gl_mapping_lender_side_all_frameworks_and_name_guard
20261012171337  enable_rls_on_config_and_forecast_tables
```
