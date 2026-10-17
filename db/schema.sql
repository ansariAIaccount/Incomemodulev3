-- ═══════════════════════════════════════════════════════════════════════
-- schema.sql — PCS Loan Module, public schema
-- ═══════════════════════════════════════════════════════════════════════
-- Generated 2026-10-16 from project prljhhyfgzipjnfpztfu (PostgreSQL 17)
-- by db/generate-schema.sql.
--
-- 80 tables · 7 views · 57 enums · 28 functions · 24 triggers
-- 244 indexes · 139 foreign keys · 49 checks · 236 RLS policies
--
-- RUN 00-auth-shim.sql FIRST. This file creates 73 foreign keys pointing at
-- auth.users and 236 policies naming the anon / authenticated / service_role
-- roles. Without the shim the first of those fails and you are left with a
-- half-built schema.
--
-- Regenerate rather than hand-edit:
--   psql "$SRC" -At -f generate-schema.sql > schema.sql
-- ═══════════════════════════════════════════════════════════════════════

set check_function_bodies = off;

-- ═══ EXTENSIONS ═══
-- pgcrypto is required: gen_random_uuid() is a column default throughout.
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- NOT portable, deliberately left commented:
--   pg_stat_statements — needs shared_preload_libraries set in postgresql.conf;
--                        CREATE EXTENSION alone fails. Observability only,
--                        nothing in this schema depends on it.
--   supabase_vault     — Supabase platform only. Nothing in this schema
--                        references it.
-- create extension if not exists pg_stat_statements;
-- create extension if not exists supabase_vault;

-- ═══ ENUM TYPES (57) ═══
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
create type public.fee_kind as enum ('arrangement', 'commitment', 'utilisation', 'agency', 'other', 'exitFeeIrrHurdle', 'origination', 'management', 'performance', 'legal');
create type public.fee_mode as enum ('fixPct', 'fixAmount', 'floatBps', 'overFunded', 'overUnfunded', 'overInterestComponent', 'irrHurdleTiers', 'cashCoupon', 'undrawnRamp');
create type public.financial_period_type as enum ('monthly', 'quarterly', 'semi_annual', 'annual', 'ttm', 'ytd', 'custom');
create type public.franking_treatment_kind as enum ('none', 'fullyFranked', 'partiallyFranked', 'unfranked');
create type public.fund_domicile as enum ('US', 'EU', 'UK', 'AU', 'Cayman', 'Luxembourg', 'Ireland', 'Other');
create type public.gst_treatment_kind as enum ('financialSupply', 'taxable', 'gstFree', 'mixed');
create type public.hedge_designation_type as enum ('cfh', 'fvh', 'fx_hedge', 'none');
-- RETIRED 2026-10-14: facilities.holiday_calendar is now text + FK onto
-- holiday_calendars(code). The type is recreated for fidelity with the source
-- database; nothing references it and it can be dropped.
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

-- ═══ FUNCTIONS (28) ═══
-- Emitted before tables: column defaults, triggers and RLS policies all
-- reference them.
--
-- NOTE on SECURITY DEFINER: is_admin, in_team, owns_deal, has_deal_assignment
-- and can_access_deal are all SECURITY DEFINER with a pinned search_path.
-- That is deliberate and load-bearing — they read tables the calling user
-- cannot read directly, which is what lets RLS ask "may this user see this
-- deal" without granting them sight of the assignment tables. Do not
-- casually change them to SECURITY INVOKER.

CREATE OR REPLACE FUNCTION public._easter_sunday(y integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  -- Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
  with t as (
    select y % 19 a, y / 100 b, y % 100 c
  ), u as (
    select a, b, c, b / 4 d, b % 4 e, (b + 8) / 25 f from t
  ), v as (
    select a, b, c, d, e, f, (b - f + 1) / 3 g from u
  ), w as (
    select a, c, d, e, g, (19 * a + b - d - g + 15) % 30 h from v
  ), x as (
    select h, c / 4 i, c % 4 k, (32 + 2 * e + 2 * (c / 4) - h - (c % 4)) % 7 l from w
  ), z as (
    select h, l, ((select a from t) + 11 * h + 22 * l) / 451 m from x
  )
  select make_date(y, ((h + l - 7 * m + 114) / 31)::int, (((h + l - 7 * m + 114) % 31) + 1)::int)
  from z;
$function$
;

CREATE OR REPLACE FUNCTION public._gl_mapping_touch()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public._last_dow(y integer, mo integer, dow integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select (d - ((extract(dow from d)::int - dow + 7) % 7))::date
  from (select (make_date(y, mo, 1) + interval '1 month' - interval '1 day')::date d) s;
$function$
;

CREATE OR REPLACE FUNCTION public._nth_dow(y integer, mo integer, dow integer, n integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select (make_date(y, mo, 1)
          + (((dow - extract(dow from make_date(y, mo, 1))::int) + 7) % 7)
          + (n - 1) * 7)::date;
$function$
;

CREATE OR REPLACE FUNCTION public._us_obs(d date)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case extract(dow from d)::int when 6 then d - 1 when 0 then d + 1 else d end;
$function$
;

CREATE OR REPLACE FUNCTION public._wknd_fwd(d date)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case extract(dow from d)::int when 6 then d + 2 when 0 then d + 1 else d end;
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_deal(target_deal_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ok boolean;
BEGIN
  IF public.is_admin() THEN RETURN true; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.deals d
    WHERE d.id = target_deal_id
      AND (
        d.created_by = auth.uid()
        OR (d.team_id IS NOT NULL AND public.in_team(d.team_id))
        OR public.has_deal_assignment(d.id)
      )
  ) INTO ok;
  RETURN COALESCE(ok, false);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_fund_allocation_sum()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  total_pct NUMERIC;
  target_deal UUID;
  target_date DATE;
BEGIN
  target_deal := COALESCE(NEW.deal_id, OLD.deal_id);
  target_date := COALESCE(NEW.effective_date, OLD.effective_date);
  SELECT COALESCE(SUM(allocation_pct), 0) INTO total_pct
    FROM public.fund_allocations
    WHERE deal_id = target_deal
      AND effective_date = target_date
      AND allocation_pct IS NOT NULL;
  IF total_pct > 1.000001 THEN
    RAISE EXCEPTION 'Fund allocations for deal % on % sum to % (>100%%). Adjust before saving.',
      target_deal, target_date, total_pct * 100;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.credit_agreements_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at := now(); RETURN NEW; END $function$
;

CREATE OR REPLACE FUNCTION public.curve_rate(p_curve_code text, p_as_of date, p_tenor numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_curve_id uuid;
  v_date     date;
  lo_t numeric; lo_r numeric;
  hi_t numeric; hi_r numeric;
BEGIN
  IF p_tenor IS NULL OR p_tenor <= 0 THEN RETURN NULL; END IF;

  SELECT id INTO v_curve_id FROM rate_curves WHERE code = p_curve_code;
  IF v_curve_id IS NULL THEN RETURN NULL; END IF;

  SELECT max(curve_date) INTO v_date
  FROM rate_curve_points
  WHERE curve_id = v_curve_id AND curve_date <= p_as_of;
  IF v_date IS NULL THEN RETURN NULL; END IF;

  -- Nearest published tenor at or below the requested one.
  SELECT tenor_years, rate INTO lo_t, lo_r
  FROM rate_curve_points
  WHERE curve_id = v_curve_id AND curve_date = v_date AND tenor_years <= p_tenor
  ORDER BY tenor_years DESC LIMIT 1;

  -- …and at or above.
  SELECT tenor_years, rate INTO hi_t, hi_r
  FROM rate_curve_points
  WHERE curve_id = v_curve_id AND curve_date = v_date AND tenor_years >= p_tenor
  ORDER BY tenor_years ASC LIMIT 1;

  -- Outside the published range: hold the end point flat rather than
  -- extrapolating a trend the curve does not assert.
  IF lo_t IS NULL THEN RETURN hi_r; END IF;
  IF hi_t IS NULL THEN RETURN lo_r; END IF;
  IF lo_t = hi_t  THEN RETURN lo_r; END IF;

  RETURN lo_r + (hi_r - lo_r) * (p_tenor - lo_t) / (hi_t - lo_t);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gl_event_mapping_normalise()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare nm text;
begin
  if new.dr_account_code is not null then
    select account_name into nm from gl_accounts where account_code = new.dr_account_code;
    if nm is null then
      raise exception 'GL mapping %/% : DR account % is not in the chart of accounts',
        new.event_key, new.framework_code, new.dr_account_code
        using hint = 'Add the account to gl_accounts first, or pick an existing code.';
    end if;
    new.dr_account_name := nm;
  end if;

  if new.cr_account_code is not null then
    select account_name into nm from gl_accounts where account_code = new.cr_account_code;
    if nm is null then
      raise exception 'GL mapping %/% : CR account % is not in the chart of accounts',
        new.event_key, new.framework_code, new.cr_account_code
        using hint = 'Add the account to gl_accounts first, or pick an existing code.';
    end if;
    new.cr_account_name := nm;
  end if;

  return new;
end $function$
;

-- Fires on INSERT into auth.users. Reads NEW.raw_user_meta_data, which
-- Supabase's auth.users has and a bare replacement does not — 00-auth-shim.sql
-- includes that column for exactly this reason. Without it, creating a user
-- raises "record new has no field raw_user_meta_data" and no profile row is
-- written, leaving a user who authenticates and can then see nothing.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, is_admin, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    false,
    NEW.created_at,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_deal_assignment(d_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.deal_user_assignments
    WHERE deal_id = d_id AND user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.in_team(t_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_teams ut
    WHERE ut.user_id = auth.uid() AND ut.team_id = t_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    (SELECT up.is_admin FROM public.user_profiles up WHERE up.id = auth.uid()),
    false
  );
$function$
;

-- Reads auth.users.raw_user_meta_data and auth.users.deleted_at.
-- 00-auth-shim.sql provides both columns for this reason.
CREATE OR REPLACE FUNCTION public.list_all_users()
 RETURNS TABLE(id uuid, email text, full_name text, is_admin boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp', 'auth'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT
      u.id,
      COALESCE(up.email, u.email)::text AS email,
      COALESCE(up.full_name, u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))::text AS full_name,
      COALESCE(up.is_admin, false) AS is_admin
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON up.id = u.id
    WHERE u.deleted_at IS NULL
    ORDER BY LOWER(COALESCE(up.email, u.email));
END;
$function$
;

-- KNOWN ISSUE — see db/README.md §"Latent issues carried over".
-- This casts the preset's holiday value to ::holiday_calendar, the enum that
-- was retired on 2026-10-14 when facilities.holiday_calendar became text with
-- an FK onto holiday_calendars(code). The cast still succeeds for the five
-- legacy values and FAILS for any calendar added since — a preset specifying
-- nlNational or luNational cannot be materialised. The enum is recreated
-- earlier in this file so the function at least compiles.
CREATE OR REPLACE FUNCTION public.materialize_preset(p_preset_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_preset            preset_catalog%ROWTYPE;
  v_def               jsonb;
  v_deal_id           uuid;
  v_team_id           uuid;
  v_tranche_id        uuid;
  v_ic_id             uuid;
  t_idx               int;
  c_idx               int;
  t_obj               jsonb;
  ic_obj              jsonb;
  term_obj            jsonb;
  spread_obj          jsonb;
  tier_obj            jsonb;
  draw_obj            jsonb;
  paydown_obj         jsonb;
  fee_obj             jsonb;
  fee_idx             int;
  draw_idx            int;
  paydown_idx         int;
  term_idx            int;
  tier_idx            int;
  ax                  jsonb;
BEGIN
  SELECT * INTO v_preset FROM preset_catalog WHERE preset_key = p_preset_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'preset_key % not found', p_preset_key; END IF;
  v_def := v_preset.build_definition;

  SELECT id INTO v_team_id FROM teams WHERE code = v_preset.team_code;

  -- DEAL
  INSERT INTO deals (
    preset_key, deal_code, name, counterparty, legal_entity, currency, framework,
    settlement_date, maturity_date, participation_pct, team_id,
    is_preset, complexity, tag
  ) VALUES (
    v_preset.preset_key,
    v_def->'deal'->>'dealId',
    v_def->'deal'->>'name',
    v_def->'deal'->>'counterparty',
    v_def->'deal'->>'le',
    v_def->'deal'->>'currency',
    (v_def->'deal'->>'framework')::accounting_framework,
    (v_def->'deal'->>'settle')::date,
    (v_def->'deal'->>'maturity')::date,
    v_preset.participation_pct,
    v_team_id,
    TRUE,
    v_preset.complexity,
    v_preset.tag
  )
  ON CONFLICT (deal_code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_deal_id;

  -- FACILITY
  INSERT INTO facilities (
    deal_id, commitment, availability_end, day_basis, holiday_calendar, repayment_type, facility_type
  ) VALUES (
    v_deal_id,
    (v_def->'facility'->>'commitment')::numeric,
    NULLIF(v_def->'facility'->>'availEnd', '')::date,
    (v_def->'facility'->>'dayBasis')::day_count_basis,
    COALESCE(NULLIF(v_def->'facility'->>'holiday', ''), 'none')::holiday_calendar,
    COALESCE(NULLIF(v_def->'facility'->>'repayment', ''), 'AtMaturity')::repayment_type,
    COALESCE(NULLIF(v_def->'facility'->>'type', ''), 'termLoan')::facility_type
  )
  ON CONFLICT (deal_id) DO UPDATE SET commitment = EXCLUDED.commitment;

  -- TRANCHES (+ their nested data)
  t_idx := 0;
  FOR t_obj IN SELECT jsonb_array_elements(v_def->'tranches')
  LOOP
    t_idx := t_idx + 1;
    INSERT INTO tranches (deal_id, tranche_no, name, currency, face_value, drawn_initially)
    VALUES (v_deal_id, t_idx, t_obj->>'name', t_obj->>'currency',
            (t_obj->>'face')::numeric, (t_obj->>'drawnInitially')::numeric)
    ON CONFLICT (deal_id, tranche_no) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_tranche_id;

    -- Drawdowns (extra beyond initial)
    draw_idx := 0;
    FOR draw_obj IN SELECT jsonb_array_elements(t_obj->'drawdowns')
    LOOP
      draw_idx := draw_idx + 1;
      INSERT INTO drawdowns (tranche_id, drawdown_no, draw_date, amount, reason)
      VALUES (v_tranche_id, draw_idx, (draw_obj->>'date')::date, (draw_obj->>'amount')::numeric, draw_obj->>'reason')
      ON CONFLICT (tranche_id, drawdown_no) DO UPDATE SET amount = EXCLUDED.amount;
    END LOOP;

    -- Paydowns (with kind / trigger)
    paydown_idx := 0;
    FOR paydown_obj IN SELECT jsonb_array_elements(t_obj->'repayments')
    LOOP
      paydown_idx := paydown_idx + 1;
      INSERT INTO paydowns (tranche_id, paydown_no, paydown_date, amount, kind, trigger, reason)
      VALUES (
        v_tranche_id, paydown_idx,
        (paydown_obj->>'date')::date,
        (paydown_obj->>'amount')::numeric,
        COALESCE(NULLIF(paydown_obj->>'kind',''),'scheduled')::paydown_kind,
        NULLIF(paydown_obj->>'trigger','')::prepay_trigger,
        paydown_obj->>'reason'
      )
      ON CONFLICT (tranche_id, paydown_no) DO UPDATE SET amount = EXCLUDED.amount;
    END LOOP;

    -- Interest components per tranche
    c_idx := 0;
    FOR ic_obj IN SELECT jsonb_array_elements(t_obj->'interestComponents')
    LOOP
      c_idx := c_idx + 1;
      INSERT INTO interest_components (
        tranche_id, component_no, name, base_index, base_value, esg_adjustment_bps, ratchet_kpi
      ) VALUES (
        v_tranche_id, c_idx, ic_obj->>'name',
        (ic_obj->>'baseIndex')::base_index_type,
        (ic_obj->>'baseValue')::numeric,
        COALESCE((ic_obj->>'esgAdjustmentBps')::numeric, 0),
        COALESCE(NULLIF(ic_obj->'ratchet'->>'kpi',''), 'none')::ratchet_kpi
      )
      ON CONFLICT (tranche_id, component_no) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_ic_id;

      -- Terms
      term_idx := 0;
      FOR term_obj IN SELECT jsonb_array_elements(ic_obj->'terms')
      LOOP
        term_idx := term_idx + 1;
        INSERT INTO interest_terms (
          interest_component_id, term_no, tenor, lookback_days, observation_shift, lockout_days,
          daily_compounding, weighted
        ) VALUES (
          v_ic_id, term_idx, term_obj->>'tenor',
          COALESCE((term_obj->>'lookbackDays')::int, 0),
          COALESCE((term_obj->>'observationShift')::int, 0),
          COALESCE((term_obj->>'lockoutDays')::int, 0),
          COALESCE((term_obj->>'dailyCompounding')::boolean, false),
          COALESCE((term_obj->>'weighted')::boolean, false)
        )
        ON CONFLICT (interest_component_id, term_no) DO NOTHING;
      END LOOP;

      -- Spreads
      FOR spread_obj IN SELECT jsonb_array_elements(ic_obj->'spreads')
      LOOP
        INSERT INTO interest_spreads (interest_component_id, effective_from, effective_to, bps, note)
        VALUES (v_ic_id,
                (spread_obj->>'from')::date,
                (spread_obj->>'to')::date,
                (spread_obj->>'bps')::numeric,
                spread_obj->>'note');
      END LOOP;

      -- Ratchet tiers
      tier_idx := 0;
      FOR tier_obj IN SELECT jsonb_array_elements(ic_obj->'ratchet'->'tiers')
      LOOP
        tier_idx := tier_idx + 1;
        INSERT INTO ratchet_tiers (
          interest_component_id, tier_no, kpi_from, kpi_to, margin_bps, note
        ) VALUES (
          v_ic_id, tier_idx,
          NULLIF(tier_obj->>'from','null')::numeric,
          NULLIF(tier_obj->>'to','null')::numeric,
          (tier_obj->>'marginBps')::numeric,
          tier_obj->>'note'
        )
        ON CONFLICT (interest_component_id, tier_no) DO NOTHING;
      END LOOP;
    END LOOP;   -- end of interestComponents
  END LOOP;     -- end of tranches

  -- FEES
  fee_idx := 0;
  FOR fee_obj IN SELECT jsonb_array_elements(v_def->'fees')
  LOOP
    fee_idx := fee_idx + 1;
    INSERT INTO fees (
      deal_id, fee_no, label, kind, mode, pct, bps, flat_amount, base_kind, frequency, payment_date, ifrs_treatment_value
    ) VALUES (
      v_deal_id, fee_idx, fee_obj->>'label',
      (fee_obj->>'kind')::fee_kind,
      (fee_obj->>'mode')::fee_mode,
      COALESCE((fee_obj->>'pct')::numeric, 0),
      COALESCE((fee_obj->>'bps')::numeric, 0),
      COALESCE((fee_obj->>'flatAmount')::numeric, 0),
      -- Map preset's "undrawn" / "unfunded" base → enum value 'unfunded'
      CASE COALESCE(NULLIF(fee_obj->>'base',''), 'commitment')
        WHEN 'undrawn' THEN 'unfunded'::fee_base_kind
        ELSE COALESCE(NULLIF(fee_obj->>'base',''), 'commitment')::fee_base_kind
      END,
      COALESCE(NULLIF(fee_obj->>'frequency',''), 'oneOff')::fee_frequency,
      NULLIF(fee_obj->>'paymentDate','')::date,
      fee_obj->>'ifrs'
    )
    ON CONFLICT (deal_id, fee_no) DO UPDATE SET label = EXCLUDED.label;
  END LOOP;

  -- AASB EXTRAS
  ax := v_def->'aasbExtras';
  IF ax IS NOT NULL AND ax::text <> 'null' THEN
    INSERT INTO aasb_extras (
      deal_id, tier, asic_reportable, franking_treatment, related_party, gst_treatment, apra_standard
    ) VALUES (
      v_deal_id,
      COALESCE(NULLIF(ax->>'tier',''), 'tier1')::aasb_tier_kind,
      COALESCE((ax->>'asicReportable')::boolean, false),
      COALESCE(NULLIF(ax->>'frankingTreatment',''), 'none')::franking_treatment_kind,
      COALESCE(NULLIF(ax->>'relatedParty',''), 'none')::related_party_kind,
      COALESCE(NULLIF(ax->>'gstTreatment',''), 'financialSupply')::gst_treatment_kind,
      COALESCE(NULLIF(ax->>'apraStandard',''), 'notApplicable')::apra_standard_kind
    )
    ON CONFLICT (deal_id) DO UPDATE SET tier = EXCLUDED.tier;
  END IF;

  RETURN v_deal_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.owns_deal(d_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.is_admin() THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = d_id
      AND (
        d.created_by = auth.uid()
        OR public.in_team(d.team_id)
      )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reporting_cadence_months(p_cadence text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE p_cadence
    WHEN 'monthly'      THEN 1
    WHEN 'quarterly'    THEN 3
    WHEN 'half_yearly'  THEN 6
    WHEN 'annual'       THEN 12
    ELSE NULL
  END
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_user_by_email(p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp', 'auth'
AS $function$
DECLARE
  uid uuid;
BEGIN
  -- Require caller to be signed in
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  RETURN uid;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.set_user_admin(target_user_id uuid, new_is_admin boolean)
 RETURNS TABLE(id uuid, email text, full_name text, is_admin boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_is_admin boolean;
  v_admin_count     int;
BEGIN
  -- Caller must already be an admin.
  SELECT public.is_admin() INTO v_caller_is_admin;
  IF NOT COALESCE(v_caller_is_admin, false) THEN
    RAISE EXCEPTION 'Only workspace admins can change admin status'
      USING ERRCODE = '42501';
  END IF;

  -- Last-admin guardrail: block demotion when only one admin remains.
  IF new_is_admin = false THEN
    SELECT count(*) INTO v_admin_count
    FROM public.user_profiles up
    WHERE up.is_admin = true;
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last workspace admin'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.user_profiles up
  SET is_admin = new_is_admin
  WHERE up.id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found in user_profiles: %', target_user_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT up.id, up.email, up.full_name, up.is_admin
  FROM public.user_profiles up
  WHERE up.id = target_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_notice_pairing()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only act when matched_notice_id actually changed
  IF (TG_OP = 'UPDATE' AND NEW.matched_notice_id IS NOT DISTINCT FROM OLD.matched_notice_id) THEN
    RETURN NEW;
  END IF;
  -- Clear the OLD partner's back-reference if we're unlinking
  IF TG_OP = 'UPDATE' AND OLD.matched_notice_id IS NOT NULL
     AND OLD.matched_notice_id <> COALESCE(NEW.matched_notice_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    UPDATE public.loan_notices
      SET matched_notice_id = NULL, match_score = NULL, variance_json = NULL
      WHERE id = OLD.matched_notice_id AND matched_notice_id = NEW.id;
  END IF;
  -- Set the NEW partner's back-reference (idempotent — skip if already set)
  IF NEW.matched_notice_id IS NOT NULL AND NEW.matched_notice_id <> NEW.id THEN
    UPDATE public.loan_notices
      SET matched_notice_id = NEW.id,
          match_score       = NEW.match_score,
          variance_json     = NEW.variance_json
      WHERE id = NEW.matched_notice_id
        AND (matched_notice_id IS DISTINCT FROM NEW.id
             OR match_score    IS DISTINCT FROM NEW.match_score
             OR variance_json  IS DISTINCT FROM NEW.variance_json);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_bump_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_deal_guarantors_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rfr_effective_series(p_index text, p_scenario text DEFAULT 'base'::text)
 RETURNS TABLE(fix_date date, rate numeric, source text, as_of date)
 LANGUAGE sql
 STABLE
AS $function$
  with last_actual as (
    select max(fix_date) as d
      from rfr_index_fixings
     where rfr_index = p_index
  ),
  latest_curve as (
    select c.id, c.as_of_date
      from rfr_forecast_curves c
     where c.is_active
       and c.rfr_index = p_index
       and c.scenario  = p_scenario
     order by c.as_of_date desc
     limit 1
  )
  select f.fix_date, f.rate, 'actual'::text, null::date
    from rfr_index_fixings f
   where f.rfr_index = p_index
  union all
  select p.fix_date, p.rate, 'forecast'::text, lc.as_of_date
    from latest_curve lc
    join rfr_forecast_points p on p.curve_id = lc.id
    left join last_actual la on true
   where la.d is null or p.fix_date > la.d
   order by 1;
$function$
;

CREATE OR REPLACE FUNCTION public.run_comparison(p_deal_id uuid)
 RETURNS TABLE(metric text, current_val numeric, prior_val numeric, delta numeric, current_run text, prior_run text, current_at timestamp with time zone, prior_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  with ranked as (
    select a.id, a.run_id, a.run_at,
           row_number() over (order by a.run_at desc) rn
      from accounting_runs a
     where a.deal_id = p_deal_id
  ),
  cur as (select * from ranked where rn = 1),
  pri as (select * from ranked where rn = 2),
  agg as (
    select r.rn,
           coalesce(sum(c.daily_accrual), 0)                      as interest_accrued,
           coalesce(sum(c.capitalized), 0)                        as pik_capitalised,
           coalesce(max(c.balance), 0)                            as peak_balance,
           coalesce((array_agg(c.carrying_value order by c.day desc))[1], 0)     as closing_gross,
           coalesce((array_agg(c.net_carrying_value order by c.day desc))[1], 0) as closing_net,
           coalesce((array_agg(c.ecl_allowance order by c.day desc))[1], 0)      as closing_allowance,
           coalesce(min(c.coupon_rate), 0)                        as min_coupon,
           coalesce(max(c.coupon_rate), 0)                        as max_coupon
      from ranked r
      join cashflow_schedules c on c.run_id = r.id
     where r.rn <= 2
     group by r.rn
  ),
  je as (
    select r.rn,
           coalesce(sum(j.amount_original) filter (where j.transaction_type = 'Impairment Expense (ECL)'), 0) as ecl_charge,
           count(*)::numeric as je_rows
      from ranked r
      join journal_entries j on j.run_id = r.id
     where r.rn <= 2
     group by r.rn
  ),
  m as (
    select 'Interest accrued'      as metric, 10 as ord,
           (select interest_accrued  from agg where rn=1) c, (select interest_accrued  from agg where rn=2) p
    union all select 'PIK capitalised',   20, (select pik_capitalised   from agg where rn=1), (select pik_capitalised   from agg where rn=2)
    union all select 'ECL charge',        30, (select ecl_charge        from je  where rn=1), (select ecl_charge        from je  where rn=2)
    union all select 'Closing gross carrying', 40, (select closing_gross from agg where rn=1), (select closing_gross from agg where rn=2)
    union all select 'Closing net carrying',   50, (select closing_net   from agg where rn=1), (select closing_net   from agg where rn=2)
    union all select 'Closing ECL allowance',  60, (select closing_allowance from agg where rn=1), (select closing_allowance from agg where rn=2)
    union all select 'Peak balance',      70, (select peak_balance      from agg where rn=1), (select peak_balance      from agg where rn=2)
    union all select 'Min coupon rate',   80, (select min_coupon        from agg where rn=1), (select min_coupon        from agg where rn=2)
    union all select 'Max coupon rate',   90, (select max_coupon        from agg where rn=1), (select max_coupon        from agg where rn=2)
    union all select 'Journal rows',     100, (select je_rows           from je  where rn=1), (select je_rows           from je  where rn=2)
  )
  select m.metric,
         round(m.c, 2), round(m.p, 2), round(coalesce(m.c,0) - coalesce(m.p,0), 2),
         (select run_id from cur), (select run_id from pri),
         (select run_at from cur), (select run_at from pri)
    from m
   order by m.ord;
$function$
;

CREATE OR REPLACE FUNCTION public.sweep_reporting_notices()
 RETURNS TABLE(inserted_count integer, checked_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted integer := 0;
  v_checked  integer := 0;
  rec        record;
BEGIN
  FOR rec IN
    SELECT * FROM public.deal_reporting_computed
     WHERE is_active AND status IN ('overdue','due_soon')
       AND deal_id IN (SELECT id FROM public.deals WHERE
         created_by = auth.uid()
         OR public.is_admin()
         OR public.has_deal_assignment(id)
         OR (team_id IS NOT NULL AND public.in_team(team_id))
       )
  LOOP
    v_checked := v_checked + 1;
    IF EXISTS(
      SELECT 1 FROM public.loan_notices
       WHERE deal_id = rec.deal_id
         AND notice_type = 'reporting_due'::notice_type_enum
         AND effective_date = rec.next_due_date
         AND reference = 'reporting:' || rec.report_type
    ) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.loan_notices (
      deal_id, notice_type, notice_date, effective_date, amount, currency,
      reference, status, source, is_auto_derived, notes, created_by
    ) VALUES (
      rec.deal_id,
      'reporting_due'::notice_type_enum,
      current_date,
      rec.next_due_date,
      NULL, NULL,
      'reporting:' || rec.report_type,
      'pending'::notice_status_enum,
      'system_derived'::notice_source,   -- FIXED: was ::notice_source_enum
      true,
      CASE WHEN rec.status = 'overdue'
           THEN 'OVERDUE · ' || rec.label || ' was due ' || rec.next_due_date::text ||
                ' (' || (current_date - rec.next_due_date) || ' days ago)'
           ELSE 'DUE SOON · ' || rec.label || ' due ' || rec.next_due_date::text ||
                ' (' || (rec.next_due_date - current_date) || ' days)'
      END,
      auth.uid()
    );
    v_inserted := v_inserted + 1;
  END LOOP;
  RETURN QUERY SELECT v_inserted, v_checked;
END;
$function$
;

-- ═══ TABLES (80) ═══
-- Columns, types, defaults and NOT NULL only. Primary keys, uniques, checks
-- and foreign keys follow in their own sections so table creation order does
-- not matter.

create table if not exists public.aasb_extras (
  deal_id uuid not null,
  tier aasb_tier_kind default 'tier1'::aasb_tier_kind,
  asic_reportable boolean default false,
  franking_treatment franking_treatment_kind default 'none'::franking_treatment_kind,
  related_party related_party_kind default 'none'::related_party_kind,
  gst_treatment gst_treatment_kind default 'financialSupply'::gst_treatment_kind,
  apra_standard apra_standard_kind default 'notApplicable'::apra_standard_kind,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.accounting_frameworks (
  code accounting_framework not null,
  label text not null,
  long_name text not null,
  chip_class text,
  ecl_model ecl_model_type not null,
  ecl_formula text,
  ecl_citation text,
  ecl_trace_title text,
  eir_citation text,
  fv_citation text,
  mod_citation text,
  mod_threshold text,
  hedge_citation text,
  fx_citation text,
  waterfall_citation text,
  fee_eir_value text,
  fee_eir_label text,
  fee_overtime_value text,
  fee_overtime_label text,
  fee_pointintime_value text,
  fee_pointintime_label text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.accounting_run_history (
  id uuid default gen_random_uuid() not null,
  run_id uuid,
  deal_label text,
  framework accounting_framework,
  je_rows integer,
  run_at timestamp with time zone default now() not null,
  run_by uuid,
  status run_status,
  treatment_dirty boolean,
  event text,
  notes text
);

create table if not exists public.accounting_runs (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  run_id text not null,
  version integer default 1 not null,
  framework_used accounting_framework not null,
  view_mode view_mode default 'participation'::view_mode not null,
  builder_scale numeric(10,8) default 1.0 not null,
  target_share numeric(10,8) default 1.0 not null,
  acct_scale numeric(10,8) default 1.0 not null,
  participation_pct numeric(5,2) default 100 not null,
  gl_posting_date date,
  gl_posting_mode text default 'AUTO'::text not null,
  status run_status default 'Draft'::run_status not null,
  treatment_dirty boolean default false not null,
  je_rows_count integer default 0 not null,
  total_drs numeric(20,2) default 0 not null,
  total_crs numeric(20,2) default 0 not null,
  balanced boolean default true not null,
  aasb_gst_rows integer default 0,
  aasb_apra_topup_rows integer default 0,
  aasb_franking_rows integer default 0,
  run_at timestamp with time zone default now() not null,
  run_by uuid,
  approved_at timestamp with time zone,
  approved_by uuid,
  posted_at timestamp with time zone,
  posted_by uuid,
  comments text,
  summary_jsonb jsonb
);

create table if not exists public.bb_approved_location (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  location_ref text not null,
  name text,
  access_structure text not null,
  commodity_groups jsonb default '[]'::jsonb not null,
  address_redacted boolean default true,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.bb_approved_offtaker (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  name text not null,
  contract_method text,
  commodity_groups jsonb default '[]'::jsonb not null,
  target_days_on_feed integer,
  is_trade_credit_insurance_fallback boolean default false not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.bb_certificate (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  as_of_date date not null,
  status text default 'draft'::text not null,
  submitted_at timestamp with time zone,
  submitted_by uuid,
  approved_at timestamp with time zone,
  approved_by uuid,
  rejected_at timestamp with time zone,
  rejected_by uuid,
  base_amount_computed numeric default 0 not null,
  breakdown jsonb default '{}'::jsonb not null,
  headcount_total integer,
  inventory_snapshot jsonb,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.bb_eligible_asset_class (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  asset_class text not null,
  asset_class_label text not null,
  asset_details text,
  price_source text not null,
  qty_source text,
  advance_rate_pct numeric default 0 not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.bb_livestock_inventory (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  location_id uuid,
  offtaker_id uuid,
  asset_class text not null,
  nlis_tag text,
  head_count integer default 1 not null,
  purchase_price numeric,
  purchase_price_basis text default 'aggregate'::text not null,
  contracted_value_nrv numeric,
  purchase_date date,
  days_on_feed_start date,
  is_contracted boolean default false not null,
  is_receivable boolean default false not null,
  invoice_face_value numeric,
  invoice_date date,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.borrower_financials (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  as_of_date date not null,
  period_type financial_period_type default 'quarterly'::financial_period_type not null,
  currency text default 'USD'::text not null,
  fiscal_year_end date,
  borrower_name text,
  reporter_note text,
  total_assets numeric(20,2),
  current_assets numeric(20,2),
  cash numeric(20,2),
  accounts_receivable numeric(20,2),
  inventory numeric(20,2),
  fixed_assets numeric(20,2),
  total_liabilities numeric(20,2),
  current_liabilities numeric(20,2),
  accounts_payable numeric(20,2),
  short_term_debt numeric(20,2),
  long_term_debt numeric(20,2),
  total_debt numeric(20,2),
  total_equity numeric(20,2),
  revenue numeric(20,2),
  cogs numeric(20,2),
  gross_profit numeric(20,2),
  operating_expenses numeric(20,2),
  ebitda numeric(20,2),
  depreciation_amort numeric(20,2),
  ebit numeric(20,2),
  interest_expense numeric(20,2),
  tax_expense numeric(20,2),
  net_income numeric(20,2),
  operating_cash_flow numeric(20,2),
  capex numeric(20,2),
  free_cash_flow numeric(20,2),
  principal_payments numeric(20,2),
  dscr numeric(10,4),
  interest_coverage numeric(10,4),
  leverage_ratio numeric(10,4),
  net_leverage_ratio numeric(10,4),
  current_ratio numeric(10,4),
  debt_to_equity numeric(10,4),
  quick_ratio numeric(10,4),
  source_extraction_id uuid,
  raw_extraction_json jsonb,
  confidence numeric(4,3),
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.cash_movement_actuals (
  id uuid default gen_random_uuid() not null,
  batch_id uuid not null,
  je_index integer not null,
  tx_index numeric(8,2),
  effective_date date,
  gl_date date,
  account_code text,
  transaction_type text,
  is_debit boolean,
  amount_le numeric(20,2),
  posted_status text default 'POSTED'::text,
  posted_at timestamp with time zone,
  external_je_id text,
  payload jsonb,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.cash_movement_batches (
  id uuid default gen_random_uuid() not null,
  run_id uuid not null,
  batch_id text not null,
  external_key text,
  je_rows_count integer not null,
  status batch_status default 'Pending'::batch_status not null,
  pushed_at timestamp with time zone,
  pushed_by uuid,
  gl_posting_date date not null,
  filename text,
  payload jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.cashflow_column_config (
  id uuid default gen_random_uuid() not null,
  team_id uuid,
  column_key text not null,
  column_label text not null,
  sort_order integer default 0 not null,
  is_derived boolean default false not null,
  derivation text,
  events jsonb default '[]'::jsonb not null,
  is_active boolean default true not null,
  is_custom boolean default false not null,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.cashflow_schedules (
  id uuid default gen_random_uuid() not null,
  run_id uuid not null,
  deal_id uuid not null,
  day date not null,
  balance numeric default 0 not null,
  drawn_balance numeric default 0 not null,
  carrying_value numeric default 0 not null,
  coupon_rate numeric,
  floating_rate numeric,
  current_rate numeric,
  daily_cash numeric default 0 not null,
  daily_accrual numeric default 0 not null,
  cum_interest_accrued numeric default 0 not null,
  cum_interest_earned numeric default 0 not null,
  capitalized numeric default 0 not null,
  fee_accrual numeric default 0 not null,
  default_interest numeric default 0 not null,
  initial_purchase numeric default 0 not null,
  draw numeric default 0 not null,
  paydown numeric default 0 not null,
  prepayment numeric default 0 not null,
  mandatory_prepayment numeric default 0 not null,
  prepay_penalty numeric default 0 not null,
  write_off numeric default 0 not null,
  recovery numeric default 0 not null,
  cure_release numeric default 0 not null,
  allowance_reversal numeric default 0 not null,
  forbearance_deferred numeric default 0 not null,
  capitalised_cost numeric default 0 not null,
  loan_sale numeric default 0 not null,
  participation numeric default 0 not null,
  debt_equity_swap numeric default 0 not null,
  extras_jsonb jsonb,
  created_at timestamp with time zone default now() not null,
  created_by uuid,
  ecl_allowance numeric,
  net_carrying_value numeric
);

create table if not exists public.covenant_breach_log (
  id uuid default gen_random_uuid() not null,
  covenant_id uuid not null,
  deal_id uuid not null,
  breach_date date not null,
  breach_value numeric,
  threshold_at_breach numeric,
  direction_at_breach text,
  consequence_applied text[],
  margin_step_up_bps integer,
  sicr_triggered boolean default false,
  prepayment_triggered boolean default false,
  prepayment_event_date date,
  prepayment_event_amount numeric,
  status breach_status default 'active'::breach_status not null,
  cure_date date,
  cure_value numeric,
  cure_method cure_method,
  notes text,
  detected_at timestamp with time zone default now() not null,
  cured_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  created_by uuid
);

create table if not exists public.covenants (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  covenant_no integer not null,
  name text not null,
  category covenant_category default 'maintenance'::covenant_category not null,
  kpi_metric ratchet_kpi default 'leverageRatio'::ratchet_kpi not null,
  direction covenant_direction default 'max'::covenant_direction not null,
  threshold numeric not null,
  unit text,
  test_frequency covenant_test_frequency default 'quarterly'::covenant_test_frequency not null,
  first_test_date date,
  next_test_date date,
  cure_period_days integer default 0,
  equity_cure_available boolean default false,
  max_cure_count_per_year integer,
  consequence_on_breach covenant_consequence default 'sicrTrigger'::covenant_consequence,
  breach_step_up_bps integer,
  last_reported_value numeric,
  last_reported_date date,
  credit_agreement_section text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid
);

create table if not exists public.credit_agreements (
  id uuid default gen_random_uuid() not null,
  deal_id uuid,
  source_extraction_id uuid,
  borrower_name text,
  borrower_entity text,
  lead_arranger text,
  administrative_agent text,
  lenders jsonb,
  guarantors jsonb,
  facility_name text,
  facility_type text,
  principal numeric,
  currency text default 'USD'::text,
  effective_date date,
  maturity_date date,
  purpose text,
  base_rate text,
  base_rate_tenor text,
  margin_bps integer,
  margin_ratchet jsonb,
  day_count text,
  rate_floor_bps integer,
  amort_type text,
  amort_schedule jsonb,
  fees jsonb,
  covenants jsonb,
  prepay_triggers jsonb,
  events_of_default jsonb,
  governing_law text,
  raw_extraction_json jsonb,
  confidence numeric,
  notes text,
  imported_as_deal_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  created_by uuid
);

create table if not exists public.dashboard_kpi_snapshots (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  run_id uuid,
  snapshot_date date default CURRENT_DATE not null,
  face_value numeric(20,2),
  carrying_value numeric(20,2),
  total_interest_life numeric(20,2),
  total_fees_life numeric(20,2),
  total_drawdowns numeric(20,2),
  total_paydowns numeric(20,2),
  ecl_allowance numeric(20,2),
  effective_yield numeric(12,8),
  lifecycle_event_count integer,
  payload jsonb,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.deal_commitment_events (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  tranche_id uuid,
  event_date date not null,
  event_type commitment_event_type_enum not null,
  amount_delta numeric(20,4) default 0 not null,
  new_maturity_date date,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.deal_guarantors (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  kind text not null,
  name text not null,
  registration text,
  qualifying_assets jsonb default '[]'::jsonb not null,
  last_test_date date,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  created_by uuid
);

create table if not exists public.deal_legal_entity_allocations (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  le_external_id text not null,
  le_name text not null,
  le_domain text,
  le_currency text,
  method text default 'percentage'::text not null,
  allocation_pct numeric(9,6),
  absolute_amount numeric(20,2),
  effective_date date,
  notes text,
  team_id uuid,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.deal_portfolio_position (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  deal_name text,
  deal_type text default 'Direct Investment'::text,
  deal_domain text default 'Investran Global'::text,
  deal_currency text,
  issuer text,
  issuer_domain text default 'Investran Global'::text,
  issuer_linked_org text,
  issuer_linked_org_domain text default 'Investran Global'::text,
  issuer_currency text,
  security text,
  security_type text default 'Loan'::text,
  security_currency text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  sent_to_pcs jsonb
);

create table if not exists public.deal_recipients (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  name text not null,
  email text not null,
  role recipient_role_enum default 'lender'::recipient_role_enum not null,
  organization text,
  phone text,
  is_primary boolean default false,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.deal_reporting_requirements (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  report_type text not null,
  label text not null,
  cadence text not null,
  due_offset_days integer default 30 not null,
  grace_days integer default 15 not null,
  period_anchor date,
  next_due_date date,
  last_received_at date,
  last_received_by uuid,
  is_active boolean default true not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  created_by uuid
);

create table if not exists public.deal_securities (
  deal_id uuid not null,
  security_id uuid not null,
  tranche_id uuid,
  primary_isin boolean default false not null,
  linked_at timestamp with time zone default now() not null
);

create table if not exists public.deal_user_assignments (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  user_id uuid not null,
  role text default 'viewer'::text not null,
  assigned_at timestamp with time zone default now() not null,
  assigned_by uuid,
  notes text
);

create table if not exists public.deals (
  id uuid default gen_random_uuid() not null,
  preset_key text,
  deal_code text not null,
  name text not null,
  counterparty text,
  counterparty_abn text,
  legal_entity text,
  currency text not null,
  framework accounting_framework not null,
  settlement_date date not null,
  maturity_date date not null,
  participation_pct numeric(5,2) default 100 not null,
  team_id uuid,
  bilateral_flag bilateral_flag default 'Bilateral'::bilateral_flag,
  agent_name text,
  is_preset boolean default false not null,
  complexity integer,
  tag text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  senior_debt_provider text,
  senior_debt_limit numeric,
  as_if_complete_value numeric,
  total_development_cost numeric,
  qualifying_presales numeric,
  net_realisation_value numeric,
  min_net_assets numeric,
  waterfall_config jsonb,
  deal_structure text,
  lender_role text,
  target_financial_close_date date,
  intercreditor_deed_ref text,
  s128f_public_offer boolean,
  reimbursement_min_budget numeric,
  prepayment_consent_required boolean,
  governing_law_jurisdiction text,
  cost_overrun_pct numeric,
  cost_overrun_margin_bps integer,
  availability_period_days integer,
  min_drawdown_amount numeric,
  drawdown_basis text,
  require_qs_evidence boolean,
  backgrounding_sublimit numeric,
  backgrounding_sublimit_days integer,
  max_utilisations_outstanding integer,
  min_utilisation_amount numeric,
  extension_option_days integer,
  extension_notice_months integer,
  secondary_framework text,
  secondary_framework_purpose text,
  interest_accrual_freq text,
  source text default 'internal'::text not null,
  external_system text,
  external_deal_id text,
  signing_date date,
  original_maturity_date date,
  workday_investment_id text
);

create table if not exists public.default_events (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  event_no integer not null,
  event_date date not null,
  default_rate_pct numeric,
  days_past_due integer,
  recovery_estimate numeric,
  notes text,
  created_at timestamp with time zone default now(),
  created_by uuid
);

create table if not exists public.document_extractions (
  id uuid default gen_random_uuid() not null,
  deal_id uuid,
  notice_id uuid,
  extraction_type extraction_type default 'notice'::extraction_type not null,
  source_file_path text not null,
  source_file_name text,
  source_file_size integer,
  source_pages integer,
  model_used text,
  extracted_json jsonb default '{}'::jsonb not null,
  confidence numeric(4,3),
  processing_ms integer,
  review_status extraction_review_status default 'pending'::extraction_review_status not null,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  discarded_reason text,
  match_score numeric(4,3),
  match_reason text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.drawdowns (
  id uuid default gen_random_uuid() not null,
  tranche_id uuid not null,
  drawdown_no integer not null,
  draw_date date not null,
  amount numeric(20,2) not null,
  reason text,
  status text default 'actual'::text not null,
  created_at timestamp with time zone default now() not null
);

-- NOTE: external_cashflows and external_snapshot_changes use bigint identity
-- via nextval() on a sequence. generate-schema.sql does not emit CREATE
-- SEQUENCE separately — the default expression references it, so the sequence
-- must exist first. Two sequences are created here for that reason.
create sequence if not exists public.external_cashflows_id_seq;
create sequence if not exists public.external_snapshot_changes_id_seq;

create table if not exists public.external_cashflows (
  id bigint default nextval('external_cashflows_id_seq'::regclass) not null,
  snapshot_id uuid not null,
  deal_id uuid not null,
  flow_date date not null,
  external_tranche_id text not null,
  external_component_id text not null,
  drawdown_lot_id text,
  posting_type text not null,
  days_covered integer not null,
  basis_balance numeric(20,2),
  rate numeric(12,8),
  amount numeric(20,2) not null,
  cash_settled numeric(20,2) default 0,
  settlement_type text,
  balance_basis text,
  is_flat boolean default false not null,
  verification_status text default 'unverified'::text,
  period_start date,
  period_end date,
  days_covered_stated boolean default false
);

create table if not exists public.external_snapshot_changes (
  id bigint default nextval('external_snapshot_changes_id_seq'::regclass) not null,
  deal_id uuid not null,
  snapshot_id uuid not null,
  prior_snapshot_id uuid,
  change_type text not null,
  scope text not null,
  flow_date date,
  external_tranche_id text,
  external_component_id text,
  drawdown_lot_id text,
  field text,
  old_value numeric(20,8),
  new_value numeric(20,8),
  posted_before_change boolean default false not null,
  detected_at timestamp with time zone default now() not null
);

create table if not exists public.external_snapshots (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  external_deal_id text not null,
  snapshot_id text not null,
  content_hash text,
  generated_at timestamp with time zone,
  received_at timestamp with time zone default now() not null,
  is_current boolean default false not null,
  status text default 'received'::text not null,
  facility_jsonb jsonb,
  components_jsonb jsonb,
  tranches_jsonb jsonb,
  events_jsonb jsonb,
  cashflow_rows integer,
  validation_jsonb jsonb,
  created_by uuid default auth.uid(),
  checkpoints_jsonb jsonb
);

create table if not exists public.facilities (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  commitment numeric(20,2) not null,
  availability_end date,
  day_basis day_count_basis default 'ACT/360'::day_count_basis not null,
  holiday_calendar text default 'none'::text not null,
  repayment_type repayment_type default 'AtMaturity'::repayment_type not null,
  facility_type facility_type default 'termLoan'::facility_type not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  facility_name text
);

create table if not exists public.fees (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  fee_no integer not null,
  label text not null,
  kind fee_kind not null,
  mode fee_mode not null,
  pct numeric(14,8) default 0,
  bps numeric(10,2) default 0,
  flat_amount numeric(20,2) default 0,
  base_kind fee_base_kind default 'commitment'::fee_base_kind,
  linked_component_id uuid,
  frequency fee_frequency default 'oneOff'::fee_frequency not null,
  payment_date date,
  ifrs_treatment_value text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  tranche_id uuid,
  irr_hurdle_tiers jsonb,
  recipient text,
  cap_amount numeric,
  start_year integer,
  irr_hurdle_pct numeric,
  ramp_facility_limit numeric,
  ramp_months integer,
  ramp_cancellation_trigger_amt numeric,
  deductible_from_first_utilisation boolean
);

create table if not exists public.fund_allocations (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  fund_id uuid not null,
  allocation_pct numeric(9,6),
  absolute_amount numeric(20,2),
  method allocation_method default 'pct'::allocation_method not null,
  effective_date date default CURRENT_DATE not null,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.funds (
  id uuid default gen_random_uuid() not null,
  code text not null,
  name text not null,
  fund_type text default 'Private Credit'::text,
  domicile fund_domicile default 'US'::fund_domicile not null,
  base_ccy text default 'USD'::text not null,
  regulator_scope regulator_code[] default ARRAY['SEC'::regulator_code] not null,
  nav numeric(20,2),
  launch_date date,
  active boolean default true not null,
  notes text,
  team text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.gl_account_mappings (
  id uuid default gen_random_uuid() not null,
  team_id uuid,
  source_account_code text not null,
  source_account_name text,
  mapped_account_code text,
  mapped_account_name text,
  mapped_gl_trans_type text,
  notes text,
  is_active boolean default true not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  usage_category text
);

create table if not exists public.gl_accounts (
  account_code text not null,
  account_name text not null,
  account_class text not null,
  account_subclass text,
  description text,
  is_active boolean default true not null,
  framework_specific accounting_framework,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.gl_business_events (
  id uuid default gen_random_uuid() not null,
  event_key text not null,
  event_label text not null,
  category text,
  system_trigger text,
  sort_order integer default 100 not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.gl_coverage_audit (
  id uuid default gen_random_uuid() not null,
  audit_date date default CURRENT_DATE not null,
  total_transtypes integer not null,
  mapped_count integer not null,
  gap_count integer not null,
  missing_count integer not null,
  report_payload jsonb,
  notes text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.gl_event_mappings (
  id uuid default gen_random_uuid() not null,
  event_key text not null,
  framework_code text not null,
  dr_account_code text,
  dr_account_name text,
  cr_account_code text,
  cr_account_name text,
  is_custom boolean default false not null,
  notes text,
  team_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  is_suppressed boolean default false not null
);

create table if not exists public.gl_frameworks (
  id uuid default gen_random_uuid() not null,
  code text not null,
  label text not null,
  sort_order integer default 100 not null,
  is_builtin boolean default false not null,
  is_active boolean default true not null,
  team_id uuid,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.gl_transtype_mappings (
  id uuid default gen_random_uuid() not null,
  mapping_key text not null,
  transtype_pattern text not null,
  account_code text not null,
  is_dr_leg boolean not null,
  is_gap boolean default false not null,
  gap_note text,
  framework_applies accounting_framework[],
  precedence_order integer default 100 not null,
  description text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.hedge_designations (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  hedge_type text not null,
  sub_type text,
  designation_date date not null,
  de_designation_date date,
  hedged_item text,
  hedging_instrument text,
  notional numeric(20,2),
  effective_portion_pct numeric(6,4) default 1.0,
  notes text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.holiday_calendars (
  id uuid default gen_random_uuid() not null,
  code text not null,
  label text not null,
  country_code text,
  notes text,
  is_builtin boolean default false not null,
  is_active boolean default true not null,
  sort_order integer default 500 not null,
  team_id uuid,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.holiday_dates (
  id uuid default gen_random_uuid() not null,
  calendar_code text not null,
  holiday_date date not null,
  holiday_name text,
  team_id uuid,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.interest_components (
  id uuid default gen_random_uuid() not null,
  tranche_id uuid not null,
  component_no integer not null,
  name text not null,
  base_index base_index_type not null,
  base_value numeric(10,6) default 0 not null,
  esg_adjustment_bps numeric(8,2) default 0,
  ratchet_kpi ratchet_kpi default 'none'::ratchet_kpi not null,
  created_at timestamp with time zone default now() not null,
  floor_bps integer default 0,
  cap_bps integer default 0,
  accrual_freq text,
  settlement_type text,
  first_settlement_date date
);

create table if not exists public.interest_payments (
  id uuid default gen_random_uuid() not null,
  tranche_id uuid not null,
  payment_no integer not null,
  pay_date date not null,
  amount numeric default 0 not null,
  source text default 'event'::text not null,
  reference text,
  note text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.interest_spreads (
  id uuid default gen_random_uuid() not null,
  interest_component_id uuid not null,
  effective_from date not null,
  effective_to date not null,
  bps numeric(8,2) not null,
  note text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.interest_terms (
  id uuid default gen_random_uuid() not null,
  interest_component_id uuid not null,
  term_no integer default 1 not null,
  tenor text not null,
  lookback_days integer,
  observation_shift integer,
  lockout_days integer,
  daily_compounding boolean,
  weighted boolean,
  created_at timestamp with time zone default now() not null,
  conventions_source text
);

create table if not exists public.journal_entries (
  id uuid default gen_random_uuid() not null,
  run_id uuid not null,
  je_index integer not null,
  tx_index numeric(8,2) not null,
  effective_date date not null,
  gl_date date not null,
  legal_entity text,
  leid integer,
  batch_id integer,
  deal_label text,
  position_label text,
  income_security text,
  transaction_type text not null,
  account_code text not null,
  gl_account_name text,
  gl_trans_type text,
  is_debit boolean not null,
  amount_original numeric(20,2) not null,
  amount_le numeric(20,2) not null,
  amount_local numeric(20,2) not null,
  fx_rate numeric(20,8) default 1 not null,
  allocation_rule text default 'No Allocation'::text not null,
  batch_type text,
  batch_comments text,
  transaction_comments text,
  le_domain text default 'NWF'::text not null,
  is_gl_gap boolean default false not null,
  gl_gap_note text,
  source je_source default 'engine'::je_source not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.loan_lifecycle_events (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  event_no integer not null,
  event_date date not null,
  event_type lifecycle_event_type not null,
  amount numeric,
  sale_proceeds numeric,
  participation_pct numeric,
  equity_received_value numeric,
  allocation_json jsonb,
  notes text,
  status text default 'actual'::text,
  created_at timestamp with time zone default now(),
  created_by uuid
);

create table if not exists public.loan_notices (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  tranche_id uuid,
  notice_type notice_type_enum not null,
  notice_date date not null,
  effective_date date not null,
  amount numeric(18,2),
  currency text,
  reference text,
  rate numeric(10,6),
  breakdown jsonb,
  status notice_status_enum default 'pending'::notice_status_enum not null,
  sender text,
  recipients text[],
  notes text,
  is_auto_derived boolean default true,
  source_run_uuid uuid,
  created_by uuid,
  sent_at timestamp with time zone,
  sent_by uuid,
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid,
  completed_at timestamp with time zone,
  completed_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  source notice_source default 'manual'::notice_source not null,
  matched_notice_id uuid,
  match_score numeric(6,2),
  variance_json jsonb,
  source_extraction_id uuid
);

create table if not exists public.maturity_extensions (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  seq smallint not null,
  maturity_before date not null,
  maturity_after date not null,
  agreed_date date,
  effective_date date,
  basis text default 'option'::text not null,
  extension_fee numeric,
  document_ref text,
  notes text,
  modification_event_id uuid,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.modification_events (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  modification_date date not null,
  description text,
  is_substantial boolean default false not null,
  pv_change_pct numeric(8,4),
  pre_mod_cv numeric(20,2),
  post_mod_cv numeric(20,2),
  gain_loss numeric(20,2),
  eir_reset boolean default false,
  notes text,
  created_at timestamp with time zone default now() not null,
  created_by uuid,
  maturity_before date,
  maturity_after date
);

create table if not exists public.notice_deliveries (
  id uuid default gen_random_uuid() not null,
  notice_id uuid not null,
  recipient_email text not null,
  recipient_name text,
  recipient_role text,
  method delivery_method default 'smtp'::delivery_method not null,
  status delivery_status default 'queued'::delivery_status not null,
  subject text,
  message_id text,
  error text,
  attachment_name text,
  attachment_size integer,
  sent_by uuid,
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.paydowns (
  id uuid default gen_random_uuid() not null,
  tranche_id uuid not null,
  paydown_no integer not null,
  paydown_date date not null,
  amount numeric(20,2) not null,
  kind paydown_kind default 'scheduled'::paydown_kind not null,
  trigger prepay_trigger,
  reason text,
  status text default 'actual'::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.pcs_ref_datasets (
  id uuid default gen_random_uuid() not null,
  dataset_key text not null,
  label text not null,
  description text,
  category text,
  sort_order integer default 100 not null,
  source_type text,
  source_ref text,
  rw_field_id integer,
  row_count integer default 0 not null,
  last_synced_at timestamp with time zone,
  last_sync_by uuid,
  last_status text default 'never'::text not null,
  last_error text,
  stale_after_hours integer default 168 not null,
  team_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  rw_report_id bigint,
  rw_report_name text,
  column_map jsonb default '{}'::jsonb
);

create sequence if not exists public.pcs_ref_rows_id_seq;

create table if not exists public.pcs_ref_rows (
  id bigint default nextval('pcs_ref_rows_id_seq'::regclass) not null,
  dataset_key text not null,
  external_id text,
  name text,
  code text,
  is_active boolean,
  payload jsonb not null,
  team_id uuid,
  synced_at timestamp with time zone default now() not null
);

create table if not exists public.prepayment_penalty_schedule (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  band_no integer not null,
  from_date date,
  to_date date,
  rate_pct numeric not null,
  note text,
  created_by uuid
);

create table if not exists public.preset_catalog (
  id uuid default gen_random_uuid() not null,
  preset_key text not null,
  label text not null,
  team_code text not null,
  tag text not null,
  complexity integer not null,
  participation_pct numeric(5,2) default 100 not null,
  framework accounting_framework not null,
  is_historical boolean default false not null,
  build_definition jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.principal_events (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  event_type event_type not null,
  event_date date not null,
  amount numeric(20,2),
  sale_price numeric(20,2),
  equity_fair_value numeric(20,2),
  equity_shares numeric(20,4),
  fraction numeric(8,6),
  participant text,
  trigger prepay_trigger,
  reason text,
  category text,
  event_external_id text,
  status text default 'actual'::text not null,
  created_at timestamp with time zone default now() not null,
  created_by uuid
);

create table if not exists public.ratchet_tiers (
  id uuid default gen_random_uuid() not null,
  interest_component_id uuid not null,
  tier_no integer not null,
  kpi_from numeric(12,4),
  kpi_to numeric(12,4),
  margin_bps numeric(8,2) not null,
  note text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.rate_curve_points (
  id uuid default gen_random_uuid() not null,
  curve_id uuid not null,
  curve_date date not null,
  tenor_years numeric(7,4) not null,
  rate numeric(12,8) not null,
  imported_at timestamp with time zone default now() not null,
  imported_by uuid default auth.uid()
);

create table if not exists public.rate_curves (
  id uuid default gen_random_uuid() not null,
  code text not null,
  name text not null,
  currency text default 'GBP'::text not null,
  curve_kind text default 'spot'::text not null,
  basis text default 'nominal'::text not null,
  compounding text default 'annual'::text not null,
  day_count text,
  source text,
  notes text,
  created_at timestamp with time zone default now() not null,
  created_by uuid default auth.uid()
);

create table if not exists public.recon_line_items (
  id uuid default gen_random_uuid() not null,
  reconciliation_id uuid not null,
  je_id uuid,
  je_index integer not null,
  tx_index numeric(8,2),
  expected_le numeric(20,2),
  actual_le numeric(20,2),
  variance_le numeric(20,2),
  status recon_status default 'Clean'::recon_status not null,
  action text,
  notes text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.reconciliations (
  id uuid default gen_random_uuid() not null,
  batch_id uuid not null,
  recon_at timestamp with time zone default now() not null,
  recon_by uuid,
  status recon_status default 'Clean'::recon_status not null,
  total_lines integer default 0 not null,
  clean_lines integer default 0 not null,
  discrepancy_lines integer default 0 not null,
  total_dr_variance numeric(20,2) default 0 not null,
  total_cr_variance numeric(20,2) default 0 not null,
  feedback_sent_to_source boolean default false not null,
  notes text
);

create table if not exists public.rfr_fixings (
  id uuid default gen_random_uuid() not null,
  interest_component_id uuid not null,
  fixing_date date not null,
  rate numeric not null,
  source text,
  created_at timestamp with time zone default now() not null,
  created_by uuid
);

create table if not exists public.rfr_forecast_curves (
  id uuid default gen_random_uuid() not null,
  rfr_index text not null,
  scenario text default 'base'::text not null,
  as_of_date date not null,
  name text,
  source text,
  notes text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  created_by uuid,
  rate_basis text default 'benchmark'::text not null
);

create table if not exists public.rfr_forecast_points (
  id uuid default gen_random_uuid() not null,
  curve_id uuid not null,
  fix_date date not null,
  rate numeric not null,
  imported_at timestamp with time zone default now() not null,
  imported_by uuid
);

create table if not exists public.rfr_index_fixings (
  id uuid default gen_random_uuid() not null,
  rfr_index text not null,
  fix_date date not null,
  rate numeric not null,
  source text,
  imported_at timestamp with time zone default now() not null,
  imported_by uuid
);

create table if not exists public.securities (
  id uuid default gen_random_uuid() not null,
  isin text not null,
  lxid text,
  issuer text,
  ticker text,
  lien text,
  rating text,
  country text,
  sector text,
  coupon_rate numeric(10,6),
  maturity_date date,
  issue_date date,
  currency text,
  face_usd numeric(20,2),
  tranche_ref text,
  source text default 'Markit'::text,
  payload jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.security_pricing (
  id uuid default gen_random_uuid() not null,
  security_id uuid not null,
  price_date date not null,
  bid numeric(10,4),
  offer numeric(10,4),
  mid numeric(10,4),
  source text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.sessions (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  deal_id uuid,
  session_name text not null,
  pipeline_state jsonb not null,
  active_tab text,
  saved_at timestamp with time zone default now() not null,
  notes text
);

create table if not exists public.teams (
  id uuid default gen_random_uuid() not null,
  code text not null,
  name text not null,
  description text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.tranches (
  id uuid default gen_random_uuid() not null,
  deal_id uuid not null,
  tranche_no integer not null,
  name text not null,
  currency text not null,
  face_value numeric(20,2) not null,
  drawn_initially numeric(20,2) default 0 not null,
  seniority text,
  is_pik_toggle boolean default false not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  investor_name text,
  investor_domicile text,
  pik_capitalisation_freq text,
  coupon_servicing_pct numeric,
  coupon_servicing_cap numeric,
  coupon_servicing_start_year integer,
  drawn_initially_date date,
  consideration_paid numeric,
  consideration_date date,
  transaction_costs numeric,
  expected_redemption_date date,
  credit_impaired_at_acquisition boolean
);

create table if not exists public.treatment_overrides (
  deal_id uuid not null,
  framework_override accounting_framework,
  eir_method text,
  eir_override_rate numeric(12,8),
  oid_treatment text,
  oid_method text,
  ifrs9_classification ifrs9_classification,
  business_model business_model,
  sppi_passed boolean,
  fv_level integer,
  ecl_stage ecl_stage_value,
  pd_annual numeric(14,10),
  lgd numeric(14,10),
  ead_ccf numeric(14,10),
  compute_ecl boolean default true,
  poci_flag boolean default false,
  stage3_interest_on_net boolean default false,
  suspended boolean default false,
  dpd_to_stage2 integer,
  dpd_to_stage3 integer,
  dpd_current integer default 0,
  covenant_breach boolean default false,
  watchlist boolean default false,
  macro_overlay_weight numeric(8,4),
  mod_threshold_pct numeric(8,4),
  mod_reir_on_substantial boolean default true,
  mod_default_classification text,
  continuing boolean default true,
  wht_rate numeric(8,4),
  wht_recoverable boolean default false,
  deferred_tax boolean default false,
  fx_cadence text,
  pik_enabled boolean default false,
  pik_rate numeric(10,8) default 0,
  pik_frequency text,
  is_dirty boolean default false not null,
  updated_at timestamp with time zone default now() not null,
  q_factor numeric,
  eir_override numeric,
  pik_rate_override numeric,
  trade_accounting_method trade_accounting_method default 'settleDate'::trade_accounting_method,
  trade_date date,
  trade_accrued_interest numeric,
  use_reversing_entries boolean default false,
  revolver_cost_deferral_basis revolver_cost_basis default 'maturity'::revolver_cost_basis,
  amort_profile_kind amort_profile_kind default 'bullet'::amort_profile_kind,
  amort_profile_frequency amort_profile_frequency,
  amort_profile_io_months integer,
  amort_profile_balloon numeric,
  amort_profile_start_date date,
  hedge_designation_type hedge_designation_type default 'none'::hedge_designation_type,
  hedge_designation_date date,
  hedge_de_designation_date date,
  hedge_de_designation_reason text,
  allowance_reversal_amount numeric,
  allowance_reversal_date date,
  created_at timestamp with time zone default now(),
  created_by uuid,
  eir_floating_policy text,
  lifetime_ecl_at_acquisition numeric,
  lifetime_ecl_revisions jsonb,
  stage1_start_date date,
  stage2_start_date date,
  stage3_start_date date
);

create table if not exists public.user_profiles (
  id uuid not null,
  full_name text,
  email text,
  primary_team_id uuid,
  is_admin boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.user_teams (
  user_id uuid not null,
  team_id uuid not null,
  role text default 'member'::text not null,
  joined_at timestamp with time zone default now() not null
);

-- ═══ PRIMARY KEYS AND UNIQUE CONSTRAINTS ═══
-- Two of these use UNIQUE NULLS NOT DISTINCT (PostgreSQL 15+). That is not
-- cosmetic: Postgres treats NULLs as distinct in a unique index by default,
-- so without it `holiday_dates_uniq` would allow the same date to be inserted
-- any number of times for team_id IS NULL — which is every seeded row.
-- Restoring this file on PostgreSQL 14 or earlier will fail here.

alter table public.aasb_extras add constraint aasb_extras_pkey PRIMARY KEY (deal_id);
alter table public.accounting_frameworks add constraint accounting_frameworks_pkey PRIMARY KEY (code);
alter table public.accounting_run_history add constraint accounting_run_history_pkey PRIMARY KEY (id);
alter table public.accounting_runs add constraint accounting_runs_pkey PRIMARY KEY (id);
alter table public.accounting_runs add constraint accounting_runs_run_id_key UNIQUE (run_id);
alter table public.bb_approved_location add constraint bb_approved_location_deal_id_location_ref_key UNIQUE (deal_id, location_ref);
alter table public.bb_approved_location add constraint bb_approved_location_pkey PRIMARY KEY (id);
alter table public.bb_approved_offtaker add constraint bb_approved_offtaker_pkey PRIMARY KEY (id);
alter table public.bb_certificate add constraint bb_certificate_pkey PRIMARY KEY (id);
alter table public.bb_eligible_asset_class add constraint bb_eligible_asset_class_deal_id_asset_class_key UNIQUE (deal_id, asset_class);
alter table public.bb_eligible_asset_class add constraint bb_eligible_asset_class_pkey PRIMARY KEY (id);
alter table public.bb_livestock_inventory add constraint bb_livestock_inventory_pkey PRIMARY KEY (id);
alter table public.borrower_financials add constraint borrower_financials_deal_id_as_of_date_period_type_key UNIQUE (deal_id, as_of_date, period_type);
alter table public.borrower_financials add constraint borrower_financials_pkey PRIMARY KEY (id);
alter table public.cash_movement_actuals add constraint cash_movement_actuals_pkey PRIMARY KEY (id);
alter table public.cash_movement_batches add constraint cash_movement_batches_batch_id_key UNIQUE (batch_id);
alter table public.cash_movement_batches add constraint cash_movement_batches_pkey PRIMARY KEY (id);
alter table public.cashflow_column_config add constraint cashflow_column_config_pkey PRIMARY KEY (id);
alter table public.cashflow_column_config add constraint cashflow_column_config_team_key_uniq UNIQUE (team_id, column_key);
alter table public.cashflow_schedules add constraint cashflow_schedules_pkey PRIMARY KEY (id);
alter table public.cashflow_schedules add constraint cashflow_schedules_run_id_day_key UNIQUE (run_id, day);
alter table public.covenant_breach_log add constraint covenant_breach_log_pkey PRIMARY KEY (id);
alter table public.covenant_breach_log add constraint covenant_breach_log_unique UNIQUE (covenant_id, breach_date);
alter table public.covenants add constraint covenants_deal_id_covenant_no_key UNIQUE (deal_id, covenant_no);
alter table public.covenants add constraint covenants_pkey PRIMARY KEY (id);
alter table public.credit_agreements add constraint credit_agreements_pkey PRIMARY KEY (id);
alter table public.dashboard_kpi_snapshots add constraint dashboard_kpi_snapshots_pkey PRIMARY KEY (id);
alter table public.deal_commitment_events add constraint deal_commitment_events_pkey PRIMARY KEY (id);
alter table public.deal_guarantors add constraint deal_guarantors_pkey PRIMARY KEY (id);
alter table public.deal_legal_entity_allocations add constraint deal_legal_entity_allocations_pkey PRIMARY KEY (id);
alter table public.deal_legal_entity_allocations add constraint dlea_unique_entity UNIQUE (deal_id, le_external_id);
alter table public.deal_portfolio_position add constraint deal_portfolio_position_deal_id_key UNIQUE (deal_id);
alter table public.deal_portfolio_position add constraint deal_portfolio_position_pkey PRIMARY KEY (id);
alter table public.deal_recipients add constraint deal_recipients_pkey PRIMARY KEY (id);
alter table public.deal_reporting_requirements add constraint deal_reporting_requirements_pkey PRIMARY KEY (id);
alter table public.deal_securities add constraint deal_securities_pkey PRIMARY KEY (deal_id, security_id);
alter table public.deal_user_assignments add constraint deal_user_assignments_deal_id_user_id_key UNIQUE (deal_id, user_id);
alter table public.deal_user_assignments add constraint deal_user_assignments_pkey PRIMARY KEY (id);
alter table public.deals add constraint deals_deal_code_key UNIQUE (deal_code);
alter table public.deals add constraint deals_pkey PRIMARY KEY (id);
alter table public.deals add constraint deals_preset_key_key UNIQUE (preset_key);
alter table public.default_events add constraint default_events_deal_id_event_no_key UNIQUE (deal_id, event_no);
alter table public.default_events add constraint default_events_pkey PRIMARY KEY (id);
alter table public.document_extractions add constraint document_extractions_pkey PRIMARY KEY (id);
alter table public.drawdowns add constraint drawdowns_pkey PRIMARY KEY (id);
alter table public.drawdowns add constraint drawdowns_tranche_id_drawdown_no_key UNIQUE (tranche_id, drawdown_no);
alter table public.external_cashflows add constraint external_cashflows_pkey PRIMARY KEY (id);
alter table public.external_snapshot_changes add constraint external_snapshot_changes_pkey PRIMARY KEY (id);
alter table public.external_snapshots add constraint external_snapshots_pkey PRIMARY KEY (id);
alter table public.external_snapshots add constraint external_snapshots_uq UNIQUE (deal_id, snapshot_id);
alter table public.facilities add constraint facilities_deal_id_key UNIQUE (deal_id);
alter table public.facilities add constraint facilities_pkey PRIMARY KEY (id);
alter table public.fees add constraint fees_deal_id_fee_no_key UNIQUE (deal_id, fee_no);
alter table public.fees add constraint fees_pkey PRIMARY KEY (id);
alter table public.fund_allocations add constraint fund_allocations_deal_id_fund_id_effective_date_key UNIQUE (deal_id, fund_id, effective_date);
alter table public.fund_allocations add constraint fund_allocations_pkey PRIMARY KEY (id);
alter table public.funds add constraint funds_code_key UNIQUE (code);
alter table public.funds add constraint funds_pkey PRIMARY KEY (id);
alter table public.gl_account_mappings add constraint gl_account_mappings_pkey PRIMARY KEY (id);
alter table public.gl_account_mappings add constraint gl_mapping_unique_per_team UNIQUE (team_id, source_account_code);
alter table public.gl_accounts add constraint gl_accounts_pkey PRIMARY KEY (account_code);
alter table public.gl_business_events add constraint gl_business_events_event_key_key UNIQUE (event_key);
alter table public.gl_business_events add constraint gl_business_events_pkey PRIMARY KEY (id);
alter table public.gl_coverage_audit add constraint gl_coverage_audit_pkey PRIMARY KEY (id);
alter table public.gl_event_mappings add constraint gl_event_mappings_pkey PRIMARY KEY (id);
alter table public.gl_frameworks add constraint gl_frameworks_pkey PRIMARY KEY (id);
alter table public.gl_transtype_mappings add constraint gl_transtype_mappings_mapping_key_key UNIQUE (mapping_key);
alter table public.gl_transtype_mappings add constraint gl_transtype_mappings_pkey PRIMARY KEY (id);
alter table public.hedge_designations add constraint hedge_designations_pkey PRIMARY KEY (id);
alter table public.holiday_calendars add constraint holiday_calendars_code_uniq UNIQUE (code);
alter table public.holiday_calendars add constraint holiday_calendars_pkey PRIMARY KEY (id);
alter table public.holiday_dates add constraint holiday_dates_pkey PRIMARY KEY (id);
alter table public.holiday_dates add constraint holiday_dates_uniq UNIQUE NULLS NOT DISTINCT (calendar_code, holiday_date, team_id);
alter table public.interest_components add constraint interest_components_pkey PRIMARY KEY (id);
alter table public.interest_components add constraint interest_components_tranche_id_component_no_key UNIQUE (tranche_id, component_no);
alter table public.interest_payments add constraint interest_payments_pkey PRIMARY KEY (id);
alter table public.interest_spreads add constraint interest_spreads_pkey PRIMARY KEY (id);
alter table public.interest_terms add constraint interest_terms_interest_component_id_term_no_key UNIQUE (interest_component_id, term_no);
alter table public.interest_terms add constraint interest_terms_pkey PRIMARY KEY (id);
alter table public.journal_entries add constraint journal_entries_pkey PRIMARY KEY (id);
alter table public.loan_lifecycle_events add constraint loan_lifecycle_events_deal_id_event_no_key UNIQUE (deal_id, event_no);
alter table public.loan_lifecycle_events add constraint loan_lifecycle_events_pkey PRIMARY KEY (id);
alter table public.loan_notices add constraint loan_notices_dedupe_key UNIQUE NULLS NOT DISTINCT (deal_id, notice_type, effective_date, tranche_id, amount);
alter table public.loan_notices add constraint loan_notices_pkey PRIMARY KEY (id);
alter table public.maturity_extensions add constraint maturity_extensions_pkey PRIMARY KEY (id);
alter table public.maturity_extensions add constraint maturity_extensions_seq_uniq UNIQUE (deal_id, seq);
alter table public.modification_events add constraint modification_events_pkey PRIMARY KEY (id);
alter table public.notice_deliveries add constraint notice_deliveries_pkey PRIMARY KEY (id);
alter table public.paydowns add constraint paydowns_pkey PRIMARY KEY (id);
alter table public.paydowns add constraint paydowns_tranche_id_paydown_no_key UNIQUE (tranche_id, paydown_no);
alter table public.pcs_ref_datasets add constraint pcs_ref_datasets_pkey PRIMARY KEY (id);
alter table public.pcs_ref_rows add constraint pcs_ref_rows_pkey PRIMARY KEY (id);
alter table public.prepayment_penalty_schedule add constraint prepayment_penalty_schedule_deal_id_band_no_key UNIQUE (deal_id, band_no);
alter table public.prepayment_penalty_schedule add constraint prepayment_penalty_schedule_pkey PRIMARY KEY (id);
alter table public.preset_catalog add constraint preset_catalog_pkey PRIMARY KEY (id);
alter table public.preset_catalog add constraint preset_catalog_preset_key_key UNIQUE (preset_key);
alter table public.principal_events add constraint principal_events_pkey PRIMARY KEY (id);
alter table public.ratchet_tiers add constraint ratchet_tiers_interest_component_id_tier_no_key UNIQUE (interest_component_id, tier_no);
alter table public.ratchet_tiers add constraint ratchet_tiers_pkey PRIMARY KEY (id);
alter table public.rate_curve_points add constraint rate_curve_points_pkey PRIMARY KEY (id);
alter table public.rate_curve_points add constraint rate_curve_points_uniq UNIQUE (curve_id, curve_date, tenor_years);
alter table public.rate_curves add constraint rate_curves_code_key UNIQUE (code);
alter table public.rate_curves add constraint rate_curves_pkey PRIMARY KEY (id);
alter table public.recon_line_items add constraint recon_line_items_pkey PRIMARY KEY (id);
alter table public.reconciliations add constraint reconciliations_pkey PRIMARY KEY (id);
alter table public.rfr_fixings add constraint rfr_fixings_pkey PRIMARY KEY (id);
alter table public.rfr_fixings add constraint rfr_fixings_unique UNIQUE (interest_component_id, fixing_date);
alter table public.rfr_forecast_curves add constraint rfr_forecast_curves_pkey PRIMARY KEY (id);
alter table public.rfr_forecast_curves add constraint rfr_forecast_curves_uniq UNIQUE (rfr_index, scenario, as_of_date);
alter table public.rfr_forecast_points add constraint rfr_forecast_points_pkey PRIMARY KEY (id);
alter table public.rfr_forecast_points add constraint rfr_forecast_points_uniq UNIQUE (curve_id, fix_date);
alter table public.rfr_index_fixings add constraint rfr_index_fixings_pkey PRIMARY KEY (id);
alter table public.rfr_index_fixings add constraint rfr_index_fixings_rfr_index_fix_date_key UNIQUE (rfr_index, fix_date);
alter table public.securities add constraint securities_isin_key UNIQUE (isin);
alter table public.securities add constraint securities_pkey PRIMARY KEY (id);
alter table public.security_pricing add constraint security_pricing_pkey PRIMARY KEY (id);
alter table public.security_pricing add constraint security_pricing_security_id_price_date_key UNIQUE (security_id, price_date);
alter table public.sessions add constraint sessions_pkey PRIMARY KEY (id);
alter table public.teams add constraint teams_code_key UNIQUE (code);
alter table public.teams add constraint teams_pkey PRIMARY KEY (id);
alter table public.tranches add constraint tranches_deal_id_tranche_no_key UNIQUE (deal_id, tranche_no);
alter table public.tranches add constraint tranches_pkey PRIMARY KEY (id);
alter table public.treatment_overrides add constraint treatment_overrides_pkey PRIMARY KEY (deal_id);
alter table public.user_profiles add constraint user_profiles_pkey PRIMARY KEY (id);
alter table public.user_teams add constraint user_teams_pkey PRIMARY KEY (user_id, team_id);

-- ═══ CHECK CONSTRAINTS (49) ═══

alter table public.bb_certificate add constraint bb_certificate_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text])));
alter table public.bb_eligible_asset_class add constraint bb_eligible_asset_class_advance_rate_pct_check CHECK (((advance_rate_pct >= (0)::numeric) AND (advance_rate_pct <= (100)::numeric)));
alter table public.deal_guarantors add constraint deal_guarantors_kind_check CHECK ((kind = ANY (ARRAY['corporate'::text, 'individual'::text])));
alter table public.deal_legal_entity_allocations add constraint deal_legal_entity_allocations_method_check CHECK ((method = ANY (ARRAY['percentage'::text, 'absolute'::text])));
alter table public.deal_legal_entity_allocations add constraint dlea_pct_range CHECK (((allocation_pct IS NULL) OR ((allocation_pct >= (0)::numeric) AND (allocation_pct <= (100)::numeric))));
alter table public.deal_legal_entity_allocations add constraint dlea_share_present CHECK ((((method = 'percentage'::text) AND (allocation_pct IS NOT NULL)) OR ((method = 'absolute'::text) AND (absolute_amount IS NOT NULL))));
alter table public.deal_user_assignments add constraint deal_user_assignments_role_check CHECK ((role = ANY (ARRAY['viewer'::text, 'editor'::text, 'owner'::text])));
alter table public.deals add constraint deals_check CHECK ((maturity_date > settlement_date));
alter table public.deals add constraint deals_complexity_check CHECK (((complexity >= 1) AND (complexity <= 5)));
alter table public.deals add constraint deals_currency_check CHECK ((length(currency) = 3));
alter table public.deals add constraint deals_external_ids_chk CHECK (((source = 'internal'::text) OR ((external_system IS NOT NULL) AND (external_deal_id IS NOT NULL))));
alter table public.deals add constraint deals_participation_pct_check CHECK (((participation_pct > (0)::numeric) AND (participation_pct <= (100)::numeric)));
alter table public.deals add constraint deals_source_chk CHECK ((source = ANY (ARRAY['internal'::text, 'external'::text])));
alter table public.drawdowns add constraint drawdowns_amount_check CHECK ((amount > (0)::numeric));
alter table public.external_cashflows add constraint external_cashflows_basis_chk CHECK (((balance_basis IS NULL) OR (balance_basis = ANY (ARRAY['principalBalance'::text, 'unfundedBalance'::text, 'principalPlusCapitalised'::text, 'unfundedNetOfCapitalisations'::text, 'commitment'::text, 'faceValue'::text]))));
alter table public.external_cashflows add constraint external_cashflows_days_chk CHECK ((days_covered > 0));
alter table public.external_cashflows add constraint external_cashflows_posting_chk CHECK ((posting_type = ANY (ARRAY['interest'::text, 'fee'::text, 'principal'::text])));
alter table public.external_cashflows add constraint external_cashflows_rate_chk CHECK (((rate IS NULL) OR ((rate > '-0.5'::numeric) AND (rate < 1.0))));
alter table public.external_cashflows add constraint external_cashflows_settlement_chk CHECK (((settlement_type IS NULL) OR (settlement_type = ANY (ARRAY['cash'::text, 'capitalised'::text, 'pik'::text]))));
alter table public.external_cashflows add constraint external_cashflows_verification_status_check CHECK ((verification_status = ANY (ARRAY['full'::text, 'flat'::text, 'unverified'::text])));
alter table public.external_snapshot_changes add constraint external_changes_scope_chk CHECK ((scope = ANY (ARRAY['facility'::text, 'tranche'::text, 'component'::text, 'event'::text, 'cashflow'::text])));
alter table public.external_snapshot_changes add constraint external_changes_type_chk CHECK ((change_type = ANY (ARRAY['added'::text, 'removed'::text, 'changed'::text])));
alter table public.external_snapshots add constraint external_snapshots_status_chk CHECK ((status = ANY (ARRAY['received'::text, 'validated'::text, 'rejected'::text, 'superseded'::text])));
alter table public.facilities add constraint facilities_commitment_check CHECK ((commitment >= (0)::numeric));
alter table public.fund_allocations add constraint fund_allocations_allocation_pct_check CHECK (((allocation_pct IS NULL) OR ((allocation_pct >= (0)::numeric) AND (allocation_pct <= (1)::numeric))));
alter table public.fund_allocations add constraint fund_allocations_check CHECK (((allocation_pct IS NOT NULL) OR (absolute_amount IS NOT NULL)));
alter table public.holiday_calendars add constraint holiday_calendars_code_fmt CHECK ((code ~ '^[A-Za-z][A-Za-z0-9_]{1,31}$'::text));
alter table public.interest_components add constraint interest_components_accrual_freq_chk CHECK (((accrual_freq IS NULL) OR (accrual_freq = ANY (ARRAY['weekly'::text, 'monthly'::text, 'quarterly'::text, 'semi-annual'::text, 'annual'::text, 'at-maturity'::text]))));
alter table public.interest_components add constraint interest_components_settlement_type_chk CHECK (((settlement_type IS NULL) OR (settlement_type = ANY (ARRAY['cash'::text, 'capitalised'::text, 'pik'::text]))));
alter table public.interest_payments add constraint interest_payments_source_chk CHECK ((source = ANY (ARRAY['event'::text, 'cashmgmt'::text])));
alter table public.interest_spreads add constraint interest_spreads_check CHECK ((effective_to > effective_from));
alter table public.interest_terms add constraint interest_terms_conventions_source_check CHECK ((conventions_source = ANY (ARRAY['stated'::text, 'assumed'::text])));
alter table public.maturity_extensions add constraint maturity_extensions_basis_ck CHECK ((basis = ANY (ARRAY['option'::text, 'negotiated'::text, 'standstill'::text, 'other'::text])));
alter table public.maturity_extensions add constraint maturity_extensions_moves_date CHECK ((maturity_after <> maturity_before));
alter table public.maturity_extensions add constraint maturity_extensions_seq_pos CHECK ((seq >= 1));
alter table public.paydowns add constraint paydowns_amount_check CHECK ((amount > (0)::numeric));
alter table public.preset_catalog add constraint preset_catalog_complexity_check CHECK (((complexity >= 1) AND (complexity <= 5)));
alter table public.principal_events add constraint principal_events_fraction_check CHECK (((fraction IS NULL) OR ((fraction > (0)::numeric) AND (fraction <= (1)::numeric))));
alter table public.rate_curve_points add constraint rate_curve_points_rate_sane CHECK (((rate > '-0.5'::numeric) AND (rate < 1.0)));
alter table public.rate_curve_points add constraint rate_curve_points_tenor_pos CHECK ((tenor_years > (0)::numeric));
alter table public.rate_curves add constraint rate_curves_basis_chk CHECK ((basis = ANY (ARRAY['nominal'::text, 'real'::text, 'ois'::text])));
alter table public.rate_curves add constraint rate_curves_comp_chk CHECK ((compounding = ANY (ARRAY['annual'::text, 'semi'::text, 'quarterly'::text, 'continuous'::text])));
alter table public.rate_curves add constraint rate_curves_kind_chk CHECK ((curve_kind = ANY (ARRAY['spot'::text, 'forward'::text, 'par'::text])));
alter table public.rfr_forecast_curves add constraint rfr_forecast_curves_rate_basis_check CHECK ((rate_basis = ANY (ARRAY['benchmark'::text, 'all_in'::text])));
alter table public.tranches add constraint tranches_drawn_initially_check CHECK ((drawn_initially >= (0)::numeric));
alter table public.tranches add constraint tranches_face_value_check CHECK ((face_value > (0)::numeric));
alter table public.treatment_overrides add constraint treatment_overrides_eir_floating_policy_check CHECK ((eir_floating_policy = ANY (ARRAY['original'::text, 'revise'::text])));
alter table public.treatment_overrides add constraint treatment_overrides_fv_level_check CHECK (((fv_level IS NULL) OR ((fv_level >= 1) AND (fv_level <= 3))));
alter table public.treatment_overrides add constraint treatment_overrides_stage_dates_ordered CHECK ((((stage1_start_date IS NULL) OR (stage2_start_date IS NULL) OR (stage2_start_date >= stage1_start_date)) AND ((stage2_start_date IS NULL) OR (stage3_start_date IS NULL) OR (stage3_start_date >= stage2_start_date)) AND ((stage1_start_date IS NULL) OR (stage3_start_date IS NULL) OR (stage3_start_date >= stage1_start_date))));

-- ═══ FOREIGN KEYS (139) ═══
-- 73 of these reference auth.users(id). 00-auth-shim.sql must have run first
-- or every one of them fails.
--
-- Note the unqualified REFERENCES deals(id) etc — pg_get_constraintdef omits
-- the schema when it is on the search_path. Restoring with a search_path that
-- does not include `public` will fail here. psql defaults are fine.

alter table public.aasb_extras add constraint aasb_extras_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.accounting_run_history add constraint accounting_run_history_run_by_fkey FOREIGN KEY (run_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.accounting_run_history add constraint accounting_run_history_run_id_fkey FOREIGN KEY (run_id) REFERENCES accounting_runs(id) ON DELETE SET NULL;
alter table public.accounting_runs add constraint accounting_runs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.accounting_runs add constraint accounting_runs_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.accounting_runs add constraint accounting_runs_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.accounting_runs add constraint accounting_runs_run_by_fkey FOREIGN KEY (run_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.bb_approved_location add constraint bb_approved_location_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.bb_approved_offtaker add constraint bb_approved_offtaker_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.bb_certificate add constraint bb_certificate_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);
alter table public.bb_certificate add constraint bb_certificate_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.bb_certificate add constraint bb_certificate_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES auth.users(id);
alter table public.bb_certificate add constraint bb_certificate_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id);
alter table public.bb_eligible_asset_class add constraint bb_eligible_asset_class_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.bb_livestock_inventory add constraint bb_livestock_inventory_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.bb_livestock_inventory add constraint bb_livestock_inventory_location_id_fkey FOREIGN KEY (location_id) REFERENCES bb_approved_location(id) ON DELETE SET NULL;
alter table public.bb_livestock_inventory add constraint bb_livestock_inventory_offtaker_id_fkey FOREIGN KEY (offtaker_id) REFERENCES bb_approved_offtaker(id) ON DELETE SET NULL;
alter table public.borrower_financials add constraint borrower_financials_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.borrower_financials add constraint borrower_financials_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.borrower_financials add constraint borrower_financials_source_extraction_id_fkey FOREIGN KEY (source_extraction_id) REFERENCES document_extractions(id) ON DELETE SET NULL;
alter table public.cash_movement_actuals add constraint cash_movement_actuals_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES cash_movement_batches(id) ON DELETE CASCADE;
alter table public.cash_movement_batches add constraint cash_movement_batches_pushed_by_fkey FOREIGN KEY (pushed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.cash_movement_batches add constraint cash_movement_batches_run_id_fkey FOREIGN KEY (run_id) REFERENCES accounting_runs(id) ON DELETE CASCADE;
alter table public.cashflow_column_config add constraint cashflow_column_config_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public.cashflow_schedules add constraint cashflow_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.cashflow_schedules add constraint cashflow_schedules_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.cashflow_schedules add constraint cashflow_schedules_run_id_fkey FOREIGN KEY (run_id) REFERENCES accounting_runs(id) ON DELETE CASCADE;
alter table public.covenant_breach_log add constraint covenant_breach_log_covenant_id_fkey FOREIGN KEY (covenant_id) REFERENCES covenants(id) ON DELETE CASCADE;
alter table public.covenant_breach_log add constraint covenant_breach_log_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.covenant_breach_log add constraint covenant_breach_log_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.covenants add constraint covenants_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.covenants add constraint covenants_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.credit_agreements add constraint credit_agreements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.credit_agreements add constraint credit_agreements_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
alter table public.credit_agreements add constraint credit_agreements_source_extraction_id_fkey FOREIGN KEY (source_extraction_id) REFERENCES document_extractions(id) ON DELETE SET NULL;
alter table public.dashboard_kpi_snapshots add constraint dashboard_kpi_snapshots_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.dashboard_kpi_snapshots add constraint dashboard_kpi_snapshots_run_id_fkey FOREIGN KEY (run_id) REFERENCES accounting_runs(id) ON DELETE SET NULL;
alter table public.deal_commitment_events add constraint deal_commitment_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.deal_commitment_events add constraint deal_commitment_events_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.deal_commitment_events add constraint deal_commitment_events_tranche_id_fkey FOREIGN KEY (tranche_id) REFERENCES tranches(id) ON DELETE CASCADE;
alter table public.deal_guarantors add constraint deal_guarantors_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.deal_guarantors add constraint deal_guarantors_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.deal_legal_entity_allocations add constraint deal_legal_entity_allocations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.deal_legal_entity_allocations add constraint deal_legal_entity_allocations_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.deal_portfolio_position add constraint deal_portfolio_position_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.deal_portfolio_position add constraint deal_portfolio_position_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.deal_recipients add constraint deal_recipients_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.deal_recipients add constraint deal_recipients_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.deal_reporting_requirements add constraint deal_reporting_requirements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.deal_reporting_requirements add constraint deal_reporting_requirements_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.deal_reporting_requirements add constraint deal_reporting_requirements_last_received_by_fkey FOREIGN KEY (last_received_by) REFERENCES auth.users(id);
alter table public.deal_securities add constraint deal_securities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.deal_securities add constraint deal_securities_security_id_fkey FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE;
alter table public.deal_securities add constraint deal_securities_tranche_id_fkey FOREIGN KEY (tranche_id) REFERENCES tranches(id) ON DELETE SET NULL;
alter table public.deal_user_assignments add constraint deal_user_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.deal_user_assignments add constraint deal_user_assignments_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.deal_user_assignments add constraint deal_user_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.deals add constraint deals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.deals add constraint deals_framework_fkey FOREIGN KEY (framework) REFERENCES accounting_frameworks(code);
alter table public.deals add constraint deals_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.default_events add constraint default_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.default_events add constraint default_events_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.document_extractions add constraint document_extractions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.document_extractions add constraint document_extractions_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
alter table public.document_extractions add constraint document_extractions_notice_id_fkey FOREIGN KEY (notice_id) REFERENCES loan_notices(id) ON DELETE SET NULL;
alter table public.document_extractions add constraint document_extractions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.drawdowns add constraint drawdowns_tranche_id_fkey FOREIGN KEY (tranche_id) REFERENCES tranches(id) ON DELETE CASCADE;
alter table public.external_cashflows add constraint external_cashflows_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.external_cashflows add constraint external_cashflows_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES external_snapshots(id) ON DELETE CASCADE;
alter table public.external_snapshot_changes add constraint external_snapshot_changes_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.external_snapshot_changes add constraint external_snapshot_changes_prior_snapshot_id_fkey FOREIGN KEY (prior_snapshot_id) REFERENCES external_snapshots(id) ON DELETE SET NULL;
alter table public.external_snapshot_changes add constraint external_snapshot_changes_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES external_snapshots(id) ON DELETE CASCADE;
alter table public.external_snapshots add constraint external_snapshots_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.facilities add constraint facilities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.facilities add constraint facilities_holiday_calendar_fk FOREIGN KEY (holiday_calendar) REFERENCES holiday_calendars(code) ON UPDATE CASCADE ON DELETE SET DEFAULT;
alter table public.fees add constraint fees_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.fees add constraint fees_linked_component_id_fkey FOREIGN KEY (linked_component_id) REFERENCES interest_components(id) ON DELETE SET NULL;
alter table public.fees add constraint fees_tranche_id_fkey FOREIGN KEY (tranche_id) REFERENCES tranches(id) ON DELETE SET NULL;
alter table public.fund_allocations add constraint fund_allocations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.fund_allocations add constraint fund_allocations_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.fund_allocations add constraint fund_allocations_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id) ON DELETE CASCADE;
alter table public.funds add constraint funds_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.gl_account_mappings add constraint gl_account_mappings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.gl_account_mappings add constraint gl_account_mappings_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public.gl_event_mappings add constraint gl_event_mappings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.gl_event_mappings add constraint gl_event_mappings_event_key_fkey FOREIGN KEY (event_key) REFERENCES gl_business_events(event_key) ON DELETE CASCADE;
alter table public.gl_event_mappings add constraint gl_event_mappings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.gl_frameworks add constraint gl_frameworks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.gl_transtype_mappings add constraint gl_transtype_mappings_account_code_fkey FOREIGN KEY (account_code) REFERENCES gl_accounts(account_code);
alter table public.hedge_designations add constraint hedge_designations_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.holiday_dates add constraint holiday_dates_calendar_code_fkey FOREIGN KEY (calendar_code) REFERENCES holiday_calendars(code) ON UPDATE CASCADE ON DELETE CASCADE;
alter table public.interest_components add constraint interest_components_tranche_id_fkey FOREIGN KEY (tranche_id) REFERENCES tranches(id) ON DELETE CASCADE;
alter table public.interest_payments add constraint interest_payments_tranche_id_fkey FOREIGN KEY (tranche_id) REFERENCES tranches(id) ON DELETE CASCADE;
alter table public.interest_spreads add constraint interest_spreads_interest_component_id_fkey FOREIGN KEY (interest_component_id) REFERENCES interest_components(id) ON DELETE CASCADE;
alter table public.interest_terms add constraint interest_terms_interest_component_id_fkey FOREIGN KEY (interest_component_id) REFERENCES interest_components(id) ON DELETE CASCADE;
alter table public.journal_entries add constraint journal_entries_run_id_fkey FOREIGN KEY (run_id) REFERENCES accounting_runs(id) ON DELETE CASCADE;
alter table public.loan_lifecycle_events add constraint loan_lifecycle_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.loan_lifecycle_events add constraint loan_lifecycle_events_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.loan_notices add constraint loan_notices_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id);
alter table public.loan_notices add constraint loan_notices_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES auth.users(id);
alter table public.loan_notices add constraint loan_notices_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.loan_notices add constraint loan_notices_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.loan_notices add constraint loan_notices_matched_notice_id_fkey FOREIGN KEY (matched_notice_id) REFERENCES loan_notices(id) ON DELETE SET NULL;
alter table public.loan_notices add constraint loan_notices_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES auth.users(id);
alter table public.loan_notices add constraint loan_notices_source_extraction_id_fkey FOREIGN KEY (source_extraction_id) REFERENCES document_extractions(id) ON DELETE SET NULL;
alter table public.loan_notices add constraint loan_notices_source_run_uuid_fkey FOREIGN KEY (source_run_uuid) REFERENCES accounting_runs(id) ON DELETE SET NULL;
alter table public.loan_notices add constraint loan_notices_tranche_id_fkey FOREIGN KEY (tranche_id) REFERENCES tranches(id) ON DELETE SET NULL;
alter table public.maturity_extensions add constraint maturity_extensions_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.maturity_extensions add constraint maturity_extensions_modification_event_id_fkey FOREIGN KEY (modification_event_id) REFERENCES modification_events(id) ON DELETE SET NULL;
alter table public.modification_events add constraint modification_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.modification_events add constraint modification_events_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.notice_deliveries add constraint notice_deliveries_notice_id_fkey FOREIGN KEY (notice_id) REFERENCES loan_notices(id) ON DELETE CASCADE;
alter table public.notice_deliveries add constraint notice_deliveries_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.paydowns add constraint paydowns_tranche_id_fkey FOREIGN KEY (tranche_id) REFERENCES tranches(id) ON DELETE CASCADE;
alter table public.pcs_ref_datasets add constraint pcs_ref_datasets_last_sync_by_fkey FOREIGN KEY (last_sync_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.prepayment_penalty_schedule add constraint prepayment_penalty_schedule_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.prepayment_penalty_schedule add constraint prepayment_penalty_schedule_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.principal_events add constraint principal_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.principal_events add constraint principal_events_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.ratchet_tiers add constraint ratchet_tiers_interest_component_id_fkey FOREIGN KEY (interest_component_id) REFERENCES interest_components(id) ON DELETE CASCADE;
alter table public.rate_curve_points add constraint rate_curve_points_curve_id_fkey FOREIGN KEY (curve_id) REFERENCES rate_curves(id) ON DELETE CASCADE;
alter table public.recon_line_items add constraint recon_line_items_je_id_fkey FOREIGN KEY (je_id) REFERENCES journal_entries(id) ON DELETE SET NULL;
alter table public.recon_line_items add constraint recon_line_items_reconciliation_id_fkey FOREIGN KEY (reconciliation_id) REFERENCES reconciliations(id) ON DELETE CASCADE;
alter table public.reconciliations add constraint reconciliations_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES cash_movement_batches(id) ON DELETE CASCADE;
alter table public.reconciliations add constraint reconciliations_recon_by_fkey FOREIGN KEY (recon_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.rfr_fixings add constraint rfr_fixings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.rfr_fixings add constraint rfr_fixings_interest_component_id_fkey FOREIGN KEY (interest_component_id) REFERENCES interest_components(id) ON DELETE CASCADE;
alter table public.rfr_forecast_points add constraint rfr_forecast_points_curve_id_fkey FOREIGN KEY (curve_id) REFERENCES rfr_forecast_curves(id) ON DELETE CASCADE;
alter table public.rfr_index_fixings add constraint rfr_index_fixings_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES auth.users(id);
alter table public.security_pricing add constraint security_pricing_security_id_fkey FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE;
alter table public.sessions add constraint sessions_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
alter table public.sessions add constraint sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.tranches add constraint tranches_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.treatment_overrides add constraint treatment_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.treatment_overrides add constraint treatment_overrides_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.user_profiles add constraint user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_profiles add constraint user_profiles_primary_team_id_fkey FOREIGN KEY (primary_team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.user_teams add constraint user_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public.user_teams add constraint user_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ═══ INDEXES ═══
-- Excludes indexes backing a pk/unique constraint — those were created by the
-- constraint section above. Several here are PARTIAL (WHERE ...) or on an
-- EXPRESSION (lower(email), COALESCE(team_id, '000…')). Both matter:
-- gl_event_mappings_uniq uses COALESCE on team_id to get "one row per
-- event+framework per team, and one global row", which a plain unique index
-- cannot express because NULLs compare as distinct.

CREATE INDEX idx_run_history_runat ON public.accounting_run_history USING btree (run_at DESC);
CREATE INDEX idx_runs_deal_status ON public.accounting_runs USING btree (deal_id, status);
CREATE INDEX idx_runs_runat ON public.accounting_runs USING btree (run_at DESC);
CREATE INDEX ix_bb_loc_deal_id ON public.bb_approved_location USING btree (deal_id);
CREATE INDEX ix_bb_off_deal_id ON public.bb_approved_offtaker USING btree (deal_id);
CREATE INDEX ix_bb_cert_as_of ON public.bb_certificate USING btree (deal_id, as_of_date DESC);
CREATE INDEX ix_bb_cert_deal_id ON public.bb_certificate USING btree (deal_id);
CREATE INDEX ix_bb_eac_deal_id ON public.bb_eligible_asset_class USING btree (deal_id);
CREATE INDEX ix_bb_inv_asset_class ON public.bb_livestock_inventory USING btree (deal_id, asset_class);
CREATE INDEX ix_bb_inv_deal_id ON public.bb_livestock_inventory USING btree (deal_id);
CREATE INDEX ix_bb_inv_location ON public.bb_livestock_inventory USING btree (location_id);
CREATE INDEX bf_asof_idx ON public.borrower_financials USING btree (as_of_date DESC);
CREATE INDEX bf_deal_idx ON public.borrower_financials USING btree (deal_id);
CREATE INDEX bf_extract_idx ON public.borrower_financials USING btree (source_extraction_id);
CREATE INDEX idx_actuals_batch ON public.cash_movement_actuals USING btree (batch_id);
CREATE INDEX idx_batches_run ON public.cash_movement_batches USING btree (run_id);
CREATE INDEX idx_batches_status ON public.cash_movement_batches USING btree (status);
CREATE UNIQUE INDEX cashflow_column_config_default_key_uniq ON public.cashflow_column_config USING btree (column_key) WHERE (team_id IS NULL);
CREATE INDEX cashflow_column_config_team_idx ON public.cashflow_column_config USING btree (team_id);
CREATE INDEX cashflow_schedules_deal_day_idx ON public.cashflow_schedules USING btree (deal_id, day);
CREATE INDEX cashflow_schedules_run_idx ON public.cashflow_schedules USING btree (run_id);
CREATE INDEX idx_covenant_breach_log_breach_date ON public.covenant_breach_log USING btree (breach_date);
CREATE INDEX idx_covenant_breach_log_covenant_id ON public.covenant_breach_log USING btree (covenant_id);
CREATE INDEX idx_covenant_breach_log_deal_id ON public.covenant_breach_log USING btree (deal_id);
CREATE INDEX idx_covenant_breach_log_status ON public.covenant_breach_log USING btree (status);
CREATE INDEX idx_covenants_deal ON public.covenants USING btree (deal_id);
CREATE INDEX credit_agreements_created_by_idx ON public.credit_agreements USING btree (created_by);
CREATE INDEX credit_agreements_deal_id_idx ON public.credit_agreements USING btree (deal_id) WHERE (deal_id IS NOT NULL);
CREATE INDEX credit_agreements_source_extraction_id_idx ON public.credit_agreements USING btree (source_extraction_id) WHERE (source_extraction_id IS NOT NULL);
CREATE INDEX idx_kpi_deal_date ON public.dashboard_kpi_snapshots USING btree (deal_id, snapshot_date DESC);
CREATE INDEX idx_cmt_ev_deal ON public.deal_commitment_events USING btree (deal_id, event_date);
CREATE INDEX idx_cmt_ev_tranche ON public.deal_commitment_events USING btree (tranche_id, event_date);
CREATE INDEX ix_deal_guarantors_deal_id ON public.deal_guarantors USING btree (deal_id);
CREATE INDEX dlea_deal_idx ON public.deal_legal_entity_allocations USING btree (deal_id);
CREATE INDEX dlea_le_idx ON public.deal_legal_entity_allocations USING btree (le_external_id);
CREATE INDEX dpp_deal_idx ON public.deal_portfolio_position USING btree (deal_id);
CREATE INDEX deal_recipients_deal_idx ON public.deal_recipients USING btree (deal_id);
CREATE UNIQUE INDEX deal_recipients_email_per_deal ON public.deal_recipients USING btree (deal_id, lower(email));
CREATE INDEX ix_drr_deal_id ON public.deal_reporting_requirements USING btree (deal_id);
CREATE INDEX ix_drr_next_due ON public.deal_reporting_requirements USING btree (next_due_date) WHERE is_active;
CREATE INDEX deal_user_assignments_deal_idx ON public.deal_user_assignments USING btree (deal_id);
CREATE INDEX deal_user_assignments_user_idx ON public.deal_user_assignments USING btree (user_id);
CREATE UNIQUE INDEX deals_external_uq ON public.deals USING btree (external_system, external_deal_id) WHERE (source = 'external'::text);
CREATE INDEX deals_workday_investment_id_idx ON public.deals USING btree (workday_investment_id) WHERE (workday_investment_id IS NOT NULL);
CREATE INDEX idx_deals_created_by ON public.deals USING btree (created_by);
CREATE INDEX idx_deals_framework ON public.deals USING btree (framework);
CREATE INDEX idx_deals_settle_maturity ON public.deals USING btree (settlement_date, maturity_date);
CREATE INDEX idx_deals_team ON public.deals USING btree (team_id);
CREATE INDEX idx_deals_team_id ON public.deals USING btree (team_id);
CREATE INDEX idx_default_events_deal ON public.default_events USING btree (deal_id);
CREATE INDEX doc_extract_created_idx ON public.document_extractions USING btree (created_at DESC);
CREATE INDEX doc_extract_deal_idx ON public.document_extractions USING btree (deal_id);
CREATE INDEX doc_extract_notice_idx ON public.document_extractions USING btree (notice_id);
CREATE INDEX doc_extract_status_idx ON public.document_extractions USING btree (review_status);
CREATE INDEX idx_drawdowns_tranche_date ON public.drawdowns USING btree (tranche_id, draw_date);
CREATE INDEX external_cashflows_deal_date_idx ON public.external_cashflows USING btree (deal_id, flow_date);
CREATE INDEX external_cashflows_key_idx ON public.external_cashflows USING btree (snapshot_id, external_tranche_id, external_component_id, flow_date);
CREATE INDEX external_cashflows_settlement_idx ON public.external_cashflows USING btree (deal_id, posting_type, settlement_type);
CREATE INDEX external_cashflows_snap_date_idx ON public.external_cashflows USING btree (snapshot_id, flow_date);
CREATE INDEX external_cashflows_verification_idx ON public.external_cashflows USING btree (deal_id, verification_status);
CREATE INDEX external_changes_posted_idx ON public.external_snapshot_changes USING btree (deal_id, posted_before_change) WHERE posted_before_change;
CREATE INDEX external_changes_snap_idx ON public.external_snapshot_changes USING btree (snapshot_id);
CREATE UNIQUE INDEX external_snapshots_current_uq ON public.external_snapshots USING btree (deal_id) WHERE is_current;
CREATE INDEX external_snapshots_deal_idx ON public.external_snapshots USING btree (deal_id, received_at DESC);
CREATE INDEX fees_tranche_id_idx ON public.fees USING btree (tranche_id);
CREATE INDEX fund_alloc_deal_idx ON public.fund_allocations USING btree (deal_id);
CREATE INDEX fund_alloc_fund_idx ON public.fund_allocations USING btree (fund_id);
CREATE INDEX funds_created_by_idx ON public.funds USING btree (created_by);
CREATE INDEX funds_domicile_idx ON public.funds USING btree (domicile);
CREATE INDEX idx_gl_mapping_source ON public.gl_account_mappings USING btree (source_account_code);
CREATE INDEX idx_gl_mapping_team ON public.gl_account_mappings USING btree (team_id);
CREATE INDEX gl_event_mappings_fw_idx ON public.gl_event_mappings USING btree (framework_code);
CREATE UNIQUE INDEX gl_event_mappings_uniq ON public.gl_event_mappings USING btree (event_key, framework_code, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE UNIQUE INDEX gl_frameworks_code_team_uniq ON public.gl_frameworks USING btree (code, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_transtype_account ON public.gl_transtype_mappings USING btree (account_code);
CREATE INDEX idx_transtype_pattern ON public.gl_transtype_mappings USING btree (transtype_pattern);
CREATE INDEX holiday_dates_cal_idx ON public.holiday_dates USING btree (calendar_code, holiday_date);
CREATE INDEX interest_payments_tranche_idx ON public.interest_payments USING btree (tranche_id, pay_date);
CREATE INDEX idx_spreads_component_dates ON public.interest_spreads USING btree (interest_component_id, effective_from);
CREATE INDEX idx_je_account ON public.journal_entries USING btree (account_code);
CREATE INDEX idx_je_dates ON public.journal_entries USING btree (effective_date, gl_date);
CREATE INDEX idx_je_run ON public.journal_entries USING btree (run_id);
CREATE INDEX idx_je_run_index ON public.journal_entries USING btree (run_id, je_index, tx_index);
CREATE INDEX idx_lifecycle_events_deal ON public.loan_lifecycle_events USING btree (deal_id);
CREATE INDEX idx_loan_notices_deal_id ON public.loan_notices USING btree (deal_id);
CREATE INDEX loan_notices_deal_idx ON public.loan_notices USING btree (deal_id);
CREATE INDEX loan_notices_effective_idx ON public.loan_notices USING btree (effective_date);
CREATE INDEX loan_notices_matched_idx ON public.loan_notices USING btree (matched_notice_id);
CREATE INDEX loan_notices_source_extraction_id_idx ON public.loan_notices USING btree (source_extraction_id) WHERE (source_extraction_id IS NOT NULL);
CREATE INDEX loan_notices_source_idx ON public.loan_notices USING btree (source);
CREATE INDEX loan_notices_status_idx ON public.loan_notices USING btree (status);
CREATE INDEX loan_notices_type_idx ON public.loan_notices USING btree (notice_type);
CREATE INDEX maturity_extensions_deal_idx ON public.maturity_extensions USING btree (deal_id, seq);
CREATE INDEX idx_modification_events_deal ON public.modification_events USING btree (deal_id);
CREATE INDEX notice_deliveries_notice_idx ON public.notice_deliveries USING btree (notice_id);
CREATE INDEX notice_deliveries_sent_at_idx ON public.notice_deliveries USING btree (sent_at DESC);
CREATE INDEX idx_paydowns_tranche_date ON public.paydowns USING btree (tranche_id, paydown_date);
CREATE UNIQUE INDEX pcs_ref_datasets_key_team_uniq ON public.pcs_ref_datasets USING btree (dataset_key, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX pcs_ref_rows_code_idx ON public.pcs_ref_rows USING btree (dataset_key, code);
CREATE INDEX pcs_ref_rows_dataset_idx ON public.pcs_ref_rows USING btree (dataset_key);
CREATE UNIQUE INDEX pcs_ref_rows_extid_uniq ON public.pcs_ref_rows USING btree (dataset_key, external_id, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE (external_id IS NOT NULL);
CREATE INDEX pcs_ref_rows_name_idx ON public.pcs_ref_rows USING btree (dataset_key, name);
CREATE INDEX idx_prepay_penalty_deal ON public.prepayment_penalty_schedule USING btree (deal_id);
CREATE INDEX idx_preset_framework ON public.preset_catalog USING btree (framework);
CREATE INDEX idx_preset_team ON public.preset_catalog USING btree (team_code);
CREATE INDEX idx_principal_events_deal_date ON public.principal_events USING btree (deal_id, event_date);
CREATE INDEX idx_principal_events_type ON public.principal_events USING btree (event_type);
CREATE INDEX rate_curve_points_curve_date_idx ON public.rate_curve_points USING btree (curve_id, curve_date, tenor_years);
CREATE INDEX rate_curve_points_tenor_idx ON public.rate_curve_points USING btree (curve_id, tenor_years, curve_date);
CREATE INDEX idx_recon_lines_recon ON public.recon_line_items USING btree (reconciliation_id);
CREATE INDEX idx_recon_batch ON public.reconciliations USING btree (batch_id);
CREATE INDEX idx_rfr_fixings_date ON public.rfr_fixings USING btree (fixing_date);
CREATE INDEX idx_rfr_fixings_ic ON public.rfr_fixings USING btree (interest_component_id);
CREATE INDEX rfr_forecast_curves_lookup_idx ON public.rfr_forecast_curves USING btree (rfr_index, scenario, as_of_date DESC) WHERE is_active;
CREATE INDEX rfr_forecast_points_curve_date_idx ON public.rfr_forecast_points USING btree (curve_id, fix_date);
CREATE INDEX ix_rfr_index_fixings_idx_date ON public.rfr_index_fixings USING btree (rfr_index, fix_date DESC);
CREATE INDEX idx_securities_issuer ON public.securities USING btree (issuer);
CREATE INDEX idx_pricing_security_date ON public.security_pricing USING btree (security_id, price_date DESC);
CREATE INDEX idx_sessions_user ON public.sessions USING btree (user_id, saved_at DESC);

-- ═══ VIEWS (7) ═══
-- my_deals calls auth.uid(), in_team() and is_admin(), so it depends on both
-- the auth shim and the functions section above.
-- gl_source_accounts is a VIEW over journal_entries, not a table — it has no
-- rows of its own and must NOT appear in a seed file.

create or replace view public.bb_inventory_computed as
 SELECT i.id,
    i.deal_id,
    i.location_id,
    i.offtaker_id,
    i.asset_class,
    i.nlis_tag,
    i.head_count,
    i.purchase_price,
    i.purchase_price_basis,
    i.contracted_value_nrv,
    i.purchase_date,
    i.days_on_feed_start,
    i.is_contracted,
    i.is_receivable,
    i.invoice_face_value,
    i.invoice_date,
    i.notes,
    loc.location_ref,
    loc.access_structure AS location_access_structure,
    off.name AS offtaker_name,
    off.target_days_on_feed AS offtaker_target_days,
        CASE
            WHEN i.is_receivable THEN NULL::integer
            ELSE COALESCE(CURRENT_DATE - COALESCE(i.days_on_feed_start, i.purchase_date), 0)
        END AS days_on_feed,
    i.created_at,
    i.updated_at
   FROM bb_livestock_inventory i
     LEFT JOIN bb_approved_location loc ON loc.id = i.location_id
     LEFT JOIN bb_approved_offtaker off ON off.id = i.offtaker_id;

create or replace view public.deal_commitment_history as
 SELECT deal_id,
    event_date,
    event_type,
    amount_delta,
    new_maturity_date,
    sum(amount_delta) OVER (PARTITION BY deal_id ORDER BY event_date, id) AS effective_commitment_after_event,
    notes
   FROM deal_commitment_events
  ORDER BY deal_id, event_date, id;

create or replace view public.deal_guarantors_computed as
 SELECT id,
    deal_id,
    kind,
    name,
    registration,
    qualifying_assets,
    COALESCE(( SELECT sum((asset.value ->> 'valuation'::text)::numeric) AS sum
           FROM jsonb_array_elements(g.qualifying_assets) asset(value)
          WHERE (asset.value ->> 'valuation'::text) IS NOT NULL AND (asset.value ->> 'valuation'::text) ~ '^-?[0-9]+(\.[0-9]+)?$'::text), 0::numeric) AS qualifying_assets_total,
    last_test_date,
        CASE
            WHEN last_test_date IS NULL THEN NULL::timestamp without time zone
            ELSE last_test_date + '6 mons'::interval
        END::date AS next_test_date,
    notes,
    created_at,
    updated_at
   FROM deal_guarantors g;

create or replace view public.deal_reporting_computed as
 SELECT id,
    deal_id,
    report_type,
    label,
    cadence,
    due_offset_days,
    grace_days,
    period_anchor,
    next_due_date,
    last_received_at,
    last_received_by,
    is_active,
    notes,
    created_at,
    updated_at,
        CASE
            WHEN NOT is_active THEN 'inactive'::text
            WHEN next_due_date IS NULL THEN 'pending'::text
            WHEN last_received_at IS NOT NULL AND last_received_at >= (next_due_date - '1 day'::interval) THEN 'received'::text
            WHEN (next_due_date + grace_days) < CURRENT_DATE THEN 'overdue'::text
            WHEN next_due_date <= (CURRENT_DATE + '7 days'::interval) THEN 'due_soon'::text
            ELSE 'pending'::text
        END AS status,
    next_due_date + grace_days - CURRENT_DATE AS days_to_hard_due
   FROM deal_reporting_requirements r;

create or replace view public.gl_source_accounts as
 SELECT DISTINCT je.account_code AS source_account_code,
    je.gl_account_name AS source_account_name,
    je.gl_trans_type AS source_gl_trans_type,
    count(*) AS occurrences,
    max(je.effective_date) AS last_seen
   FROM journal_entries je
     JOIN accounting_runs ar ON ar.id = je.run_id
  WHERE je.account_code IS NOT NULL
  GROUP BY je.account_code, je.gl_account_name, je.gl_trans_type;

create or replace view public.my_deals as
 SELECT id,
    preset_key,
    deal_code,
    name,
    counterparty,
    counterparty_abn,
    legal_entity,
    currency,
    framework,
    settlement_date,
    maturity_date,
    participation_pct,
    team_id,
    bilateral_flag,
    agent_name,
    is_preset,
    complexity,
    tag,
    notes,
    created_by,
    created_at,
    updated_at
   FROM deals d
  WHERE created_by = auth.uid() OR team_id IS NOT NULL AND in_team(team_id) OR is_admin() OR is_preset = true;

create or replace view public.v_cashflow_runs as
 SELECT d.deal_code,
    d.name AS deal_name,
    d.currency,
    d.framework,
    ar.run_id AS accounting_run_id,
    ar.run_at,
    ar.framework_used,
    cs.day,
    to_char(cs.day::timestamp with time zone, 'YYYY-"Q"Q'::text) AS quarter_label,
    cs.balance,
    cs.drawn_balance,
    cs.carrying_value,
    cs.current_rate,
    cs.daily_cash,
    cs.daily_accrual,
    cs.fee_accrual,
    cs.draw,
    cs.paydown,
    cs.prepayment,
    cs.mandatory_prepayment,
    cs.prepay_penalty,
    cs.write_off,
    cs.recovery,
    cs.loan_sale,
    cs.participation,
    cs.debt_equity_swap,
    COALESCE(cs.daily_cash, 0::numeric) + COALESCE(cs.paydown, 0::numeric) + COALESCE(cs.prepayment, 0::numeric) + COALESCE(cs.prepay_penalty, 0::numeric) + COALESCE(cs.recovery, 0::numeric) + COALESCE(cs.loan_sale, 0::numeric) + COALESCE(cs.participation, 0::numeric) + COALESCE(cs.fee_accrual, 0::numeric) - COALESCE(cs.draw, 0::numeric) - COALESCE(cs.initial_purchase, 0::numeric) - COALESCE(cs.capitalised_cost, 0::numeric) AS net_lender_cash,
    cs.extras_jsonb,
    cs.id AS cashflow_id
   FROM cashflow_schedules cs
     JOIN accounting_runs ar ON ar.id = cs.run_id
     JOIN deals d ON d.id = cs.deal_id;

-- ═══ TRIGGERS (24) ═══
-- trg_fund_alloc_sum is a DEFERRABLE INITIALLY DEFERRED constraint trigger:
-- it fires at COMMIT, not per statement, so a multi-row reallocation can pass
-- through an intermediate state summing over 100% without raising.

CREATE TRIGGER tg_aasb_extras_updated_at BEFORE UPDATE ON public.aasb_extras FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bb_loc_updated_at BEFORE UPDATE ON public.bb_approved_location FOR EACH ROW EXECUTE FUNCTION tg_bump_updated_at();
CREATE TRIGGER trg_bb_off_updated_at BEFORE UPDATE ON public.bb_approved_offtaker FOR EACH ROW EXECUTE FUNCTION tg_bump_updated_at();
CREATE TRIGGER trg_bb_cert_updated_at BEFORE UPDATE ON public.bb_certificate FOR EACH ROW EXECUTE FUNCTION tg_bump_updated_at();
CREATE TRIGGER trg_bb_eac_updated_at BEFORE UPDATE ON public.bb_eligible_asset_class FOR EACH ROW EXECUTE FUNCTION tg_bump_updated_at();
CREATE TRIGGER trg_bb_inv_updated_at BEFORE UPDATE ON public.bb_livestock_inventory FOR EACH ROW EXECUTE FUNCTION tg_bump_updated_at();
CREATE TRIGGER tg_cm_batches_updated_at BEFORE UPDATE ON public.cash_movement_batches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER credit_agreements_touch BEFORE UPDATE ON public.credit_agreements FOR EACH ROW EXECUTE FUNCTION credit_agreements_touch_updated_at();
CREATE TRIGGER trg_deal_guarantors_updated_at BEFORE UPDATE ON public.deal_guarantors FOR EACH ROW EXECUTE FUNCTION tg_deal_guarantors_updated_at();
CREATE TRIGGER deal_recipients_updated_at BEFORE UPDATE ON public.deal_recipients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_drr_updated_at BEFORE UPDATE ON public.deal_reporting_requirements FOR EACH ROW EXECUTE FUNCTION tg_bump_updated_at();
CREATE TRIGGER tg_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_facilities_updated_at BEFORE UPDATE ON public.facilities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_fees_updated_at BEFORE UPDATE ON public.fees FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE CONSTRAINT TRIGGER trg_fund_alloc_sum AFTER INSERT OR UPDATE ON public.fund_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_fund_allocation_sum();
CREATE TRIGGER trg_gl_mapping_touch BEFORE UPDATE ON public.gl_account_mappings FOR EACH ROW EXECUTE FUNCTION _gl_mapping_touch();
CREATE TRIGGER tg_gl_accounts_updated_at BEFORE UPDATE ON public.gl_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_gl_event_mapping_normalise BEFORE INSERT OR UPDATE ON public.gl_event_mappings FOR EACH ROW EXECUTE FUNCTION gl_event_mapping_normalise();
CREATE TRIGGER loan_notices_updated_at BEFORE UPDATE ON public.loan_notices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notice_pairing AFTER INSERT OR UPDATE OF matched_notice_id ON public.loan_notices FOR EACH ROW EXECUTE FUNCTION sync_notice_pairing();
CREATE TRIGGER tg_securities_updated_at BEFORE UPDATE ON public.securities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_tranches_updated_at BEFORE UPDATE ON public.tranches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_treatment_overrides_updated_at BEFORE UPDATE ON public.treatment_overrides FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═══ ROW LEVEL SECURITY ═══
--
-- ⚠ READ THIS BEFORE RESTORING INTO ANYTHING INTERNET-FACING.
--
-- RLS is enabled on all 80 tables, but a large number of the 240 policies
-- below are demo doors: they grant `anon` (or `public`, which includes anon)
-- SELECT/INSERT/UPDATE/DELETE with `using (true)`. They are named with the
-- prefixes `v3_demo_anon_*`, `v3_anon_*`, and `anon_*`. Because PERMISSIVE
-- policies are OR-ed together, one of these defeats every owns_deal() /
-- in_team() policy on the same table — RLS being "enabled" buys nothing there.
--
-- They exist because the builder HTML talks to PostgREST with the publishable
-- anon key and no sign-in in demo mode. That is survivable on a throwaway
-- Supabase project; it is not survivable on a shared or production database.
--
-- To restore WITHOUT the demo doors, filter them out:
--   grep -v "_anon_" schema.sql > schema-locked.sql
-- then confirm nothing remains:
--   grep -nE "to (anon|public)" schema-locked.sql
-- Note the app will then require an authenticated session for every read.
--
-- `to public` here is Postgres's PUBLIC pseudo-role (every role, anon
-- included), NOT the public schema. Policies written `to public` with
-- `using (can_access_deal(deal_id))` are fine — the predicate does the work.
-- Policies written `to public` with `using (true)` are open doors.

alter table public.aasb_extras enable row level security;
alter table public.accounting_frameworks enable row level security;
alter table public.accounting_run_history enable row level security;
alter table public.accounting_runs enable row level security;
alter table public.bb_approved_location enable row level security;
alter table public.bb_approved_offtaker enable row level security;
alter table public.bb_certificate enable row level security;
alter table public.bb_eligible_asset_class enable row level security;
alter table public.bb_livestock_inventory enable row level security;
alter table public.borrower_financials enable row level security;
alter table public.cash_movement_actuals enable row level security;
alter table public.cash_movement_batches enable row level security;
alter table public.cashflow_column_config enable row level security;
alter table public.cashflow_schedules enable row level security;
alter table public.covenant_breach_log enable row level security;
alter table public.covenants enable row level security;
alter table public.credit_agreements enable row level security;
alter table public.dashboard_kpi_snapshots enable row level security;
alter table public.deal_commitment_events enable row level security;
alter table public.deal_guarantors enable row level security;
alter table public.deal_legal_entity_allocations enable row level security;
alter table public.deal_portfolio_position enable row level security;
alter table public.deal_recipients enable row level security;
alter table public.deal_reporting_requirements enable row level security;
alter table public.deal_securities enable row level security;
alter table public.deal_user_assignments enable row level security;
alter table public.deals enable row level security;
alter table public.default_events enable row level security;
alter table public.document_extractions enable row level security;
alter table public.drawdowns enable row level security;
alter table public.external_cashflows enable row level security;
alter table public.external_snapshot_changes enable row level security;
alter table public.external_snapshots enable row level security;
alter table public.facilities enable row level security;
alter table public.fees enable row level security;
alter table public.fund_allocations enable row level security;
alter table public.funds enable row level security;
alter table public.gl_account_mappings enable row level security;
alter table public.gl_accounts enable row level security;
alter table public.gl_business_events enable row level security;
alter table public.gl_coverage_audit enable row level security;
alter table public.gl_event_mappings enable row level security;
alter table public.gl_frameworks enable row level security;
alter table public.gl_transtype_mappings enable row level security;
alter table public.hedge_designations enable row level security;
alter table public.holiday_calendars enable row level security;
alter table public.holiday_dates enable row level security;
alter table public.interest_components enable row level security;
alter table public.interest_payments enable row level security;
alter table public.interest_spreads enable row level security;
alter table public.interest_terms enable row level security;
alter table public.journal_entries enable row level security;
alter table public.loan_lifecycle_events enable row level security;
alter table public.loan_notices enable row level security;
alter table public.maturity_extensions enable row level security;
alter table public.modification_events enable row level security;
alter table public.notice_deliveries enable row level security;
alter table public.paydowns enable row level security;
alter table public.pcs_ref_datasets enable row level security;
alter table public.pcs_ref_rows enable row level security;
alter table public.prepayment_penalty_schedule enable row level security;
alter table public.preset_catalog enable row level security;
alter table public.principal_events enable row level security;
alter table public.ratchet_tiers enable row level security;
alter table public.rate_curve_points enable row level security;
alter table public.rate_curves enable row level security;
alter table public.recon_line_items enable row level security;
alter table public.reconciliations enable row level security;
alter table public.rfr_fixings enable row level security;
alter table public.rfr_forecast_curves enable row level security;
alter table public.rfr_forecast_points enable row level security;
alter table public.rfr_index_fixings enable row level security;
alter table public.securities enable row level security;
alter table public.security_pricing enable row level security;
alter table public.sessions enable row level security;
alter table public.teams enable row level security;
alter table public.tranches enable row level security;
alter table public.treatment_overrides enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_teams enable row level security;

-- ─── POLICIES (240) ───

create policy aasb_owner_all on public.aasb_extras as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy v3_demo_anon_read_aasb_extras on public.aasb_extras as permissive for select to anon
  using (true);
create policy v3_demo_anon_update_aasb_extras on public.aasb_extras as permissive for update to anon
  using (true)
  with check (true);
create policy v3_demo_anon_write_aasb_extras on public.aasb_extras as permissive for insert to anon
  with check (true);
create policy frameworks_read on public.accounting_frameworks as permissive for select to authenticated
  using (true);
create policy frameworks_write on public.accounting_frameworks as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy v3_demo_anon_read_frameworks on public.accounting_frameworks as permissive for select to anon
  using (true);
create policy run_history_insert on public.accounting_run_history as permissive for insert to authenticated
  with check (((run_by = ( SELECT auth.uid() AS uid)) OR is_admin()));
create policy run_history_read on public.accounting_run_history as permissive for select to authenticated
  using (((run_by = ( SELECT auth.uid() AS uid)) OR is_admin() OR ((run_id IS NOT NULL) AND owns_deal(( SELECT ar.deal_id
   FROM accounting_runs ar
  WHERE (ar.id = accounting_run_history.run_id))))));
create policy runs_owner_all on public.accounting_runs as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy v3_demo_anon_insert_accounting_runs on public.accounting_runs as permissive for insert to anon
  with check (true);
create policy v3_demo_anon_read_accounting_runs on public.accounting_runs as permissive for select to anon
  using (true);
create policy bb_approved_location_delete on public.bb_approved_location as permissive for delete to public
  using (can_access_deal(deal_id));
create policy bb_approved_location_insert on public.bb_approved_location as permissive for insert to public
  with check (can_access_deal(deal_id));
create policy bb_approved_location_select on public.bb_approved_location as permissive for select to public
  using (can_access_deal(deal_id));
create policy bb_approved_location_update on public.bb_approved_location as permissive for update to public
  using (can_access_deal(deal_id));
create policy bb_approved_offtaker_delete on public.bb_approved_offtaker as permissive for delete to public
  using (can_access_deal(deal_id));
create policy bb_approved_offtaker_insert on public.bb_approved_offtaker as permissive for insert to public
  with check (can_access_deal(deal_id));
create policy bb_approved_offtaker_select on public.bb_approved_offtaker as permissive for select to public
  using (can_access_deal(deal_id));
create policy bb_approved_offtaker_update on public.bb_approved_offtaker as permissive for update to public
  using (can_access_deal(deal_id));
create policy bb_certificate_delete on public.bb_certificate as permissive for delete to public
  using (can_access_deal(deal_id));
create policy bb_certificate_insert on public.bb_certificate as permissive for insert to public
  with check (can_access_deal(deal_id));
create policy bb_certificate_select on public.bb_certificate as permissive for select to public
  using (can_access_deal(deal_id));
create policy bb_certificate_update on public.bb_certificate as permissive for update to public
  using (can_access_deal(deal_id));
create policy bb_eligible_asset_class_delete on public.bb_eligible_asset_class as permissive for delete to public
  using (can_access_deal(deal_id));
create policy bb_eligible_asset_class_insert on public.bb_eligible_asset_class as permissive for insert to public
  with check (can_access_deal(deal_id));
create policy bb_eligible_asset_class_select on public.bb_eligible_asset_class as permissive for select to public
  using (can_access_deal(deal_id));
create policy bb_eligible_asset_class_update on public.bb_eligible_asset_class as permissive for update to public
  using (can_access_deal(deal_id));
create policy bb_livestock_inventory_delete on public.bb_livestock_inventory as permissive for delete to public
  using (can_access_deal(deal_id));
create policy bb_livestock_inventory_insert on public.bb_livestock_inventory as permissive for insert to public
  with check (can_access_deal(deal_id));
create policy bb_livestock_inventory_select on public.bb_livestock_inventory as permissive for select to public
  using (can_access_deal(deal_id));
create policy bb_livestock_inventory_update on public.bb_livestock_inventory as permissive for update to public
  using (can_access_deal(deal_id));
create policy bf_delete on public.borrower_financials as permissive for delete to authenticated
  using ((owns_deal(deal_id) OR is_admin()));
create policy bf_insert on public.borrower_financials as permissive for insert to authenticated
  with check (owns_deal(deal_id));
create policy bf_select on public.borrower_financials as permissive for select to authenticated
  using (owns_deal(deal_id));
create policy bf_update on public.borrower_financials as permissive for update to authenticated
  using (owns_deal(deal_id));
create policy v3_demo_anon_delete_bf on public.borrower_financials as permissive for delete to public
  using (true);
create policy v3_demo_anon_read_bf on public.borrower_financials as permissive for select to public
  using (true);
create policy v3_demo_anon_update_bf on public.borrower_financials as permissive for update to public
  using (true);
create policy v3_demo_anon_write_bf on public.borrower_financials as permissive for insert to public
  with check (true);
create policy actuals_owner_all on public.cash_movement_actuals as permissive for all to authenticated
  using (owns_deal(( SELECT ar.deal_id
   FROM (accounting_runs ar
     JOIN cash_movement_batches b ON ((b.run_id = ar.id)))
  WHERE (b.id = cash_movement_actuals.batch_id))))
  with check (owns_deal(( SELECT ar.deal_id
   FROM (accounting_runs ar
     JOIN cash_movement_batches b ON ((b.run_id = ar.id)))
  WHERE (b.id = cash_movement_actuals.batch_id))));
create policy batches_owner_all on public.cash_movement_batches as permissive for all to authenticated
  using (owns_deal(( SELECT ar.deal_id
   FROM accounting_runs ar
  WHERE (ar.id = cash_movement_batches.run_id))))
  with check (owns_deal(( SELECT ar.deal_id
   FROM accounting_runs ar
  WHERE (ar.id = cash_movement_batches.run_id))));
create policy cashflow_column_config_read on public.cashflow_column_config as permissive for select to authenticated
  using (((team_id IS NULL) OR is_admin() OR in_team(team_id)));
create policy cashflow_column_config_write on public.cashflow_column_config as permissive for all to authenticated
  using ((is_admin() OR ((team_id IS NOT NULL) AND in_team(team_id))))
  with check ((is_admin() OR ((team_id IS NOT NULL) AND in_team(team_id))));
create policy cashflow_schedules_owner_all on public.cashflow_schedules as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy cf_schedule_read on public.cashflow_schedules as permissive for select to authenticated
  using (true);
create policy cf_schedule_write on public.cashflow_schedules as permissive for insert to authenticated
  with check (true);
create policy v3_anon_delete_cashflow_schedules on public.cashflow_schedules as permissive for delete to anon
  using (true);
create policy v3_anon_read_cashflow_schedules on public.cashflow_schedules as permissive for select to anon
  using (true);
create policy v3_anon_write_cashflow_schedules on public.cashflow_schedules as permissive for insert to anon
  with check (true);
create policy covenant_breach_log_all on public.covenant_breach_log as permissive for all to anon, authenticated
  using (true)
  with check (true);
create policy covenant_breach_log_owner_all on public.covenant_breach_log as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy covenants_owner_all on public.covenants as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy ca_delete on public.credit_agreements as permissive for delete to public
  using (((created_by = auth.uid()) OR ((deal_id IS NOT NULL) AND owns_deal(deal_id)) OR is_admin()));
create policy ca_insert on public.credit_agreements as permissive for insert to public
  with check (((created_by = auth.uid()) OR is_admin() OR ((deal_id IS NOT NULL) AND owns_deal(deal_id))));
create policy ca_select on public.credit_agreements as permissive for select to public
  using ((((deal_id IS NULL) AND ((created_by = auth.uid()) OR is_admin())) OR ((deal_id IS NOT NULL) AND owns_deal(deal_id)) OR is_admin()));
create policy ca_update on public.credit_agreements as permissive for update to public
  using (((created_by = auth.uid()) OR ((deal_id IS NOT NULL) AND owns_deal(deal_id)) OR is_admin()));
create policy v3_demo_anon_delete_ca on public.credit_agreements as permissive for delete to public
  using (true);
create policy v3_demo_anon_read_ca on public.credit_agreements as permissive for select to public
  using (true);
create policy v3_demo_anon_update_ca on public.credit_agreements as permissive for update to public
  using (true);
create policy v3_demo_anon_write_ca on public.credit_agreements as permissive for insert to public
  with check (true);
create policy kpi_owner_all on public.dashboard_kpi_snapshots as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy cmt_ev_delete on public.deal_commitment_events as permissive for delete to authenticated
  using (can_access_deal(deal_id));
create policy cmt_ev_insert on public.deal_commitment_events as permissive for insert to authenticated
  with check (can_access_deal(deal_id));
create policy cmt_ev_select on public.deal_commitment_events as permissive for select to authenticated
  using (can_access_deal(deal_id));
create policy cmt_ev_update on public.deal_commitment_events as permissive for update to authenticated
  using (can_access_deal(deal_id))
  with check (can_access_deal(deal_id));
create policy deal_guarantors_delete on public.deal_guarantors as permissive for delete to public
  using (can_access_deal(deal_id));
create policy deal_guarantors_insert on public.deal_guarantors as permissive for insert to public
  with check (can_access_deal(deal_id));
create policy deal_guarantors_select on public.deal_guarantors as permissive for select to public
  using (can_access_deal(deal_id));
create policy deal_guarantors_update on public.deal_guarantors as permissive for update to public
  using (can_access_deal(deal_id));
create policy dlea_select on public.deal_legal_entity_allocations as permissive for select to public
  using ((is_admin() OR (EXISTS ( SELECT 1
   FROM deals d
  WHERE ((d.id = deal_legal_entity_allocations.deal_id) AND ((d.created_by = auth.uid()) OR in_team(d.team_id)))))));
create policy dlea_write on public.deal_legal_entity_allocations as permissive for all to public
  using ((is_admin() OR (EXISTS ( SELECT 1
   FROM deals d
  WHERE ((d.id = deal_legal_entity_allocations.deal_id) AND ((d.created_by = auth.uid()) OR in_team(d.team_id)))))))
  with check ((is_admin() OR (EXISTS ( SELECT 1
   FROM deals d
  WHERE ((d.id = deal_legal_entity_allocations.deal_id) AND ((d.created_by = auth.uid()) OR in_team(d.team_id)))))));
create policy dpp_select on public.deal_portfolio_position as permissive for select to public
  using ((is_admin() OR (EXISTS ( SELECT 1
   FROM deals d
  WHERE ((d.id = deal_portfolio_position.deal_id) AND ((d.created_by = auth.uid()) OR in_team(d.team_id)))))));
create policy dpp_write on public.deal_portfolio_position as permissive for all to public
  using ((is_admin() OR (EXISTS ( SELECT 1
   FROM deals d
  WHERE ((d.id = deal_portfolio_position.deal_id) AND ((d.created_by = auth.uid()) OR in_team(d.team_id)))))))
  with check ((is_admin() OR (EXISTS ( SELECT 1
   FROM deals d
  WHERE ((d.id = deal_portfolio_position.deal_id) AND ((d.created_by = auth.uid()) OR in_team(d.team_id)))))));
create policy recipients_owner_delete on public.deal_recipients as permissive for delete to public
  using (owns_deal(deal_id));
create policy recipients_owner_insert on public.deal_recipients as permissive for insert to public
  with check (owns_deal(deal_id));
create policy recipients_owner_select on public.deal_recipients as permissive for select to public
  using (owns_deal(deal_id));
create policy recipients_owner_update on public.deal_recipients as permissive for update to public
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy v3_demo_anon_delete_recipients on public.deal_recipients as permissive for delete to public
  using (true);
create policy v3_demo_anon_read_recipients on public.deal_recipients as permissive for select to public
  using (true);
create policy v3_demo_anon_update_recipients on public.deal_recipients as permissive for update to public
  using (true)
  with check (true);
create policy v3_demo_anon_write_recipients on public.deal_recipients as permissive for insert to public
  with check (true);
create policy drr_delete on public.deal_reporting_requirements as permissive for delete to public
  using (can_access_deal(deal_id));
create policy drr_insert on public.deal_reporting_requirements as permissive for insert to public
  with check (can_access_deal(deal_id));
create policy drr_select on public.deal_reporting_requirements as permissive for select to public
  using (can_access_deal(deal_id));
create policy drr_update on public.deal_reporting_requirements as permissive for update to public
  using (can_access_deal(deal_id));
create policy deal_sec_owner_all on public.deal_securities as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy dua_delete on public.deal_user_assignments as permissive for delete to authenticated
  using ((is_admin() OR (EXISTS ( SELECT 1
   FROM deals d
  WHERE ((d.id = deal_user_assignments.deal_id) AND (d.created_by = ( SELECT auth.uid() AS uid)))))));
create policy dua_select on public.deal_user_assignments as permissive for select to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM deals d
  WHERE ((d.id = deal_user_assignments.deal_id) AND ((d.created_by = ( SELECT auth.uid() AS uid)) OR in_team(d.team_id) OR is_admin()))))));
create policy dua_update on public.deal_user_assignments as permissive for update to authenticated
  using ((is_admin() OR (EXISTS ( SELECT 1
   FROM deals d
  WHERE ((d.id = deal_user_assignments.deal_id) AND (d.created_by = ( SELECT auth.uid() AS uid)))))));
create policy dua_write on public.deal_user_assignments as permissive for insert to authenticated
  with check ((is_admin() OR (EXISTS ( SELECT 1
   FROM deals d
  WHERE ((d.id = deal_user_assignments.deal_id) AND (d.created_by = ( SELECT auth.uid() AS uid)))))));
create policy deals_team_delete on public.deals as permissive for delete to authenticated
  using (((created_by = ( SELECT auth.uid() AS uid)) OR is_admin()));
create policy deals_team_insert on public.deals as permissive for insert to authenticated
  with check ((((created_by = ( SELECT auth.uid() AS uid)) AND ((team_id IS NULL) OR in_team(team_id))) OR is_admin()));
create policy deals_team_select on public.deals as permissive for select to authenticated
  using (((created_by = ( SELECT auth.uid() AS uid)) OR in_team(team_id) OR has_deal_assignment(id) OR is_admin() OR (is_preset = true)));
create policy deals_team_update on public.deals as permissive for update to authenticated
  using (((created_by = ( SELECT auth.uid() AS uid)) OR in_team(team_id) OR is_admin()))
  with check (((created_by = ( SELECT auth.uid() AS uid)) OR in_team(team_id) OR is_admin()));
create policy v3_demo_anon_delete_user_deals on public.deals as permissive for delete to anon
  using ((is_preset = false));
create policy default_events_owner_all on public.default_events as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy demo_all on public.default_events as permissive for all to public
  using (true)
  with check (true);
create policy extraction_delete on public.document_extractions as permissive for delete to authenticated
  using (((created_by = auth.uid()) OR is_admin()));
create policy extraction_insert on public.document_extractions as permissive for insert to authenticated
  with check ((created_by = auth.uid()));
create policy extraction_select on public.document_extractions as permissive for select to authenticated
  using (((deal_id IS NULL) OR owns_deal(deal_id)));
create policy extraction_update on public.document_extractions as permissive for update to authenticated
  using (((created_by = auth.uid()) OR is_admin() OR ((deal_id IS NOT NULL) AND owns_deal(deal_id))));
create policy drawdowns_owner_all on public.drawdowns as permissive for all to authenticated
  using (owns_deal(( SELECT t.deal_id
   FROM tranches t
  WHERE (t.id = drawdowns.tranche_id))))
  with check (owns_deal(( SELECT t.deal_id
   FROM tranches t
  WHERE (t.id = drawdowns.tranche_id))));
create policy v3_demo_anon_delete_drawdowns on public.drawdowns as permissive for delete to anon
  using (true);
create policy v3_demo_anon_read_drawdowns on public.drawdowns as permissive for select to anon
  using (true);
create policy v3_demo_anon_update_drawdowns on public.drawdowns as permissive for update to anon
  using (true)
  with check (true);
create policy v3_demo_anon_write_drawdowns on public.drawdowns as permissive for insert to anon
  with check (true);
create policy external_cashflows_owner_all on public.external_cashflows as permissive for all to public
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy external_changes_owner_all on public.external_snapshot_changes as permissive for all to public
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy external_snapshots_owner_all on public.external_snapshots as permissive for all to public
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy facilities_owner_all on public.facilities as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy v3_demo_anon_read_facilities on public.facilities as permissive for select to anon
  using (true);
create policy v3_demo_anon_update_facilities on public.facilities as permissive for update to anon
  using (true)
  with check (true);
create policy v3_demo_anon_write_facilities on public.facilities as permissive for insert to anon
  with check (true);
create policy fees_owner_all on public.fees as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy fund_alloc_delete on public.fund_allocations as permissive for delete to authenticated
  using (owns_deal(deal_id));
create policy fund_alloc_insert on public.fund_allocations as permissive for insert to authenticated
  with check (owns_deal(deal_id));
create policy fund_alloc_select on public.fund_allocations as permissive for select to authenticated
  using (owns_deal(deal_id));
create policy fund_alloc_update on public.fund_allocations as permissive for update to authenticated
  using (owns_deal(deal_id));
create policy funds_delete on public.funds as permissive for delete to authenticated
  using (((created_by = auth.uid()) OR is_admin()));
create policy funds_insert on public.funds as permissive for insert to authenticated
  with check (((created_by = auth.uid()) OR is_admin()));
create policy funds_select on public.funds as permissive for select to authenticated
  using (true);
create policy funds_update on public.funds as permissive for update to authenticated
  using (((created_by = auth.uid()) OR is_admin()));
create policy gl_mapping_delete on public.gl_account_mappings as permissive for delete to authenticated
  using ((((team_id IS NOT NULL) AND in_team(team_id)) OR is_admin()));
create policy gl_mapping_insert on public.gl_account_mappings as permissive for insert to authenticated
  with check ((((created_by = auth.uid()) AND ((team_id IS NULL) OR in_team(team_id))) OR is_admin()));
create policy gl_mapping_select on public.gl_account_mappings as permissive for select to authenticated
  using (((team_id IS NULL) OR in_team(team_id) OR is_admin()));
create policy gl_mapping_update on public.gl_account_mappings as permissive for update to authenticated
  using ((((team_id IS NOT NULL) AND in_team(team_id)) OR ((team_id IS NULL) AND is_admin()) OR is_admin()))
  with check ((((team_id IS NOT NULL) AND in_team(team_id)) OR ((team_id IS NULL) AND is_admin()) OR is_admin()));
create policy gl_accounts_read on public.gl_accounts as permissive for select to authenticated
  using (true);
create policy gl_accounts_write on public.gl_accounts as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy v3_demo_anon_read_gl_accounts on public.gl_accounts as permissive for select to anon
  using (true);
create policy gl_business_events_read on public.gl_business_events as permissive for select to authenticated
  using (true);
create policy gl_business_events_write on public.gl_business_events as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy gl_audit_read on public.gl_coverage_audit as permissive for select to authenticated
  using (true);
create policy gl_audit_write on public.gl_coverage_audit as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy gl_event_mappings_read on public.gl_event_mappings as permissive for select to authenticated
  using (((team_id IS NULL) OR is_admin() OR in_team(team_id)));
create policy gl_event_mappings_write on public.gl_event_mappings as permissive for all to authenticated
  using ((is_admin() OR ((team_id IS NOT NULL) AND in_team(team_id))))
  with check ((is_admin() OR ((team_id IS NOT NULL) AND in_team(team_id))));
create policy gl_frameworks_read on public.gl_frameworks as permissive for select to authenticated
  using (((team_id IS NULL) OR is_admin() OR in_team(team_id)));
create policy gl_frameworks_write on public.gl_frameworks as permissive for all to authenticated
  using ((is_admin() OR ((team_id IS NOT NULL) AND in_team(team_id))))
  with check ((is_admin() OR ((team_id IS NOT NULL) AND in_team(team_id))));
create policy gl_mappings_read on public.gl_transtype_mappings as permissive for select to authenticated
  using (true);
create policy gl_mappings_write on public.gl_transtype_mappings as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy v3_demo_anon_read_gl_mappings on public.gl_transtype_mappings as permissive for select to anon
  using (true);
create policy hedges_owner_all on public.hedge_designations as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy holiday_calendars_rw on public.holiday_calendars as permissive for all to authenticated
  using (true)
  with check (true);
create policy holiday_dates_rw on public.holiday_dates as permissive for all to authenticated
  using (true)
  with check (true);
create policy ic_owner_all on public.interest_components as permissive for all to authenticated
  using (owns_deal(( SELECT t.deal_id
   FROM tranches t
  WHERE (t.id = interest_components.tranche_id))))
  with check (owns_deal(( SELECT t.deal_id
   FROM tranches t
  WHERE (t.id = interest_components.tranche_id))));
create policy v3_demo_anon_delete_interest_components on public.interest_components as permissive for delete to anon
  using (true);
create policy v3_demo_anon_read_interest_components on public.interest_components as permissive for select to anon
  using (true);
create policy v3_demo_anon_update_interest_components on public.interest_components as permissive for update to anon
  using (true)
  with check (true);
create policy v3_demo_anon_write_interest_components on public.interest_components as permissive for insert to anon
  with check (true);
create policy interest_payments_owner_all on public.interest_payments as permissive for all to public
  using (owns_deal(( SELECT t.deal_id
   FROM tranches t
  WHERE (t.id = interest_payments.tranche_id))))
  with check (owns_deal(( SELECT t.deal_id
   FROM tranches t
  WHERE (t.id = interest_payments.tranche_id))));
create policy ispreads_owner_all on public.interest_spreads as permissive for all to authenticated
  using (owns_deal(( SELECT t.deal_id
   FROM (tranches t
     JOIN interest_components ic ON ((ic.tranche_id = t.id)))
  WHERE (ic.id = interest_spreads.interest_component_id))))
  with check (owns_deal(( SELECT t.deal_id
   FROM (tranches t
     JOIN interest_components ic ON ((ic.tranche_id = t.id)))
  WHERE (ic.id = interest_spreads.interest_component_id))));
create policy v3_demo_anon_delete_interest_spreads on public.interest_spreads as permissive for delete to anon
  using (true);
create policy v3_demo_anon_read_interest_spreads on public.interest_spreads as permissive for select to anon
  using (true);
create policy v3_demo_anon_write_interest_spreads on public.interest_spreads as permissive for insert to anon
  with check (true);
create policy iterms_owner_all on public.interest_terms as permissive for all to authenticated
  using (owns_deal(( SELECT t.deal_id
   FROM (tranches t
     JOIN interest_components ic ON ((ic.tranche_id = t.id)))
  WHERE (ic.id = interest_terms.interest_component_id))))
  with check (owns_deal(( SELECT t.deal_id
   FROM (tranches t
     JOIN interest_components ic ON ((ic.tranche_id = t.id)))
  WHERE (ic.id = interest_terms.interest_component_id))));
create policy v3_demo_anon_delete_interest_terms on public.interest_terms as permissive for delete to anon
  using (true);
create policy v3_demo_anon_read_interest_terms on public.interest_terms as permissive for select to anon
  using (true);
create policy v3_demo_anon_write_interest_terms on public.interest_terms as permissive for insert to anon
  with check (true);
create policy je_owner_all on public.journal_entries as permissive for all to authenticated
  using (owns_deal(( SELECT ar.deal_id
   FROM accounting_runs ar
  WHERE (ar.id = journal_entries.run_id))))
  with check (owns_deal(( SELECT ar.deal_id
   FROM accounting_runs ar
  WHERE (ar.id = journal_entries.run_id))));
create policy v3_demo_anon_insert_journal_entries on public.journal_entries as permissive for insert to anon
  with check (true);
create policy v3_demo_anon_read_journal_entries on public.journal_entries as permissive for select to anon
  using (true);
create policy demo_all on public.loan_lifecycle_events as permissive for all to public
  using (true)
  with check (true);
create policy loan_lifecycle_events_owner_all on public.loan_lifecycle_events as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy notices_owner_delete on public.loan_notices as permissive for delete to public
  using (owns_deal(deal_id));
create policy notices_owner_insert on public.loan_notices as permissive for insert to public
  with check (owns_deal(deal_id));
create policy notices_owner_select on public.loan_notices as permissive for select to public
  using (owns_deal(deal_id));
create policy notices_owner_update on public.loan_notices as permissive for update to public
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy v3_demo_anon_delete_notices on public.loan_notices as permissive for delete to public
  using (true);
create policy v3_demo_anon_read_notices on public.loan_notices as permissive for select to public
  using (true);
create policy v3_demo_anon_update_notices on public.loan_notices as permissive for update to public
  using (true)
  with check (true);
create policy v3_demo_anon_write_notices on public.loan_notices as permissive for insert to public
  with check (true);
create policy maturity_extensions_owner_all on public.maturity_extensions as permissive for all to public
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy demo_all on public.modification_events as permissive for all to public
  using (true)
  with check (true);
create policy mods_owner_all on public.modification_events as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy delivery_insert on public.notice_deliveries as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM loan_notices n
  WHERE ((n.id = notice_deliveries.notice_id) AND owns_deal(n.deal_id)))));
create policy delivery_select on public.notice_deliveries as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM loan_notices n
  WHERE ((n.id = notice_deliveries.notice_id) AND owns_deal(n.deal_id)))));
create policy delivery_update on public.notice_deliveries as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM loan_notices n
  WHERE ((n.id = notice_deliveries.notice_id) AND owns_deal(n.deal_id)))));
create policy paydowns_owner_all on public.paydowns as permissive for all to authenticated
  using (owns_deal(( SELECT t.deal_id
   FROM tranches t
  WHERE (t.id = paydowns.tranche_id))))
  with check (owns_deal(( SELECT t.deal_id
   FROM tranches t
  WHERE (t.id = paydowns.tranche_id))));
create policy v3_demo_anon_delete_paydowns on public.paydowns as permissive for delete to anon
  using (true);
create policy v3_demo_anon_read_paydowns on public.paydowns as permissive for select to anon
  using (true);
create policy v3_demo_anon_update_paydowns on public.paydowns as permissive for update to anon
  using (true)
  with check (true);
create policy v3_demo_anon_write_paydowns on public.paydowns as permissive for insert to anon
  with check (true);
create policy pcs_ref_datasets_read on public.pcs_ref_datasets as permissive for select to authenticated
  using (((team_id IS NULL) OR is_admin() OR in_team(team_id)));
create policy pcs_ref_datasets_write on public.pcs_ref_datasets as permissive for all to authenticated
  using ((is_admin() OR (team_id IS NULL) OR in_team(team_id)))
  with check ((is_admin() OR (team_id IS NULL) OR in_team(team_id)));
create policy pcs_ref_rows_read on public.pcs_ref_rows as permissive for select to authenticated
  using (((team_id IS NULL) OR is_admin() OR in_team(team_id)));
create policy pcs_ref_rows_write on public.pcs_ref_rows as permissive for all to authenticated
  using ((is_admin() OR (team_id IS NULL) OR in_team(team_id)))
  with check ((is_admin() OR (team_id IS NULL) OR in_team(team_id)));
create policy demo_all on public.prepayment_penalty_schedule as permissive for all to public
  using (true)
  with check (true);
create policy prepayment_penalty_schedule_owner_all on public.prepayment_penalty_schedule as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy preset_read on public.preset_catalog as permissive for select to authenticated
  using (true);
create policy preset_write on public.preset_catalog as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy v3_demo_anon_read_preset_catalog on public.preset_catalog as permissive for select to anon
  using (true);
create policy events_owner_all on public.principal_events as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy ratchets_owner_all on public.ratchet_tiers as permissive for all to authenticated
  using (owns_deal(( SELECT t.deal_id
   FROM (tranches t
     JOIN interest_components ic ON ((ic.tranche_id = t.id)))
  WHERE (ic.id = ratchet_tiers.interest_component_id))))
  with check (owns_deal(( SELECT t.deal_id
   FROM (tranches t
     JOIN interest_components ic ON ((ic.tranche_id = t.id)))
  WHERE (ic.id = ratchet_tiers.interest_component_id))));
create policy v3_demo_anon_delete_ratchet_tiers on public.ratchet_tiers as permissive for delete to anon
  using (true);
create policy v3_demo_anon_read_ratchet_tiers on public.ratchet_tiers as permissive for select to anon
  using (true);
create policy v3_demo_anon_write_ratchet_tiers on public.ratchet_tiers as permissive for insert to anon
  with check (true);
create policy rate_curve_points_rw on public.rate_curve_points as permissive for all to authenticated
  using (true)
  with check (true);
create policy rate_curves_rw on public.rate_curves as permissive for all to authenticated
  using (true)
  with check (true);
create policy recon_lines_owner_all on public.recon_line_items as permissive for all to authenticated
  using (owns_deal(( SELECT ar.deal_id
   FROM ((accounting_runs ar
     JOIN cash_movement_batches b ON ((b.run_id = ar.id)))
     JOIN reconciliations r ON ((r.batch_id = b.id)))
  WHERE (r.id = recon_line_items.reconciliation_id))))
  with check (owns_deal(( SELECT ar.deal_id
   FROM ((accounting_runs ar
     JOIN cash_movement_batches b ON ((b.run_id = ar.id)))
     JOIN reconciliations r ON ((r.batch_id = b.id)))
  WHERE (r.id = recon_line_items.reconciliation_id))));
create policy recon_owner_all on public.reconciliations as permissive for all to authenticated
  using (owns_deal(( SELECT ar.deal_id
   FROM (accounting_runs ar
     JOIN cash_movement_batches b ON ((b.run_id = ar.id)))
  WHERE (b.id = reconciliations.batch_id))))
  with check (owns_deal(( SELECT ar.deal_id
   FROM (accounting_runs ar
     JOIN cash_movement_batches b ON ((b.run_id = ar.id)))
  WHERE (b.id = reconciliations.batch_id))));
create policy rfr_fixings_all on public.rfr_fixings as permissive for all to anon, authenticated
  using (true)
  with check (true);
create policy rfr_fixings_owner_all on public.rfr_fixings as permissive for all to authenticated
  using (owns_deal(( SELECT t.deal_id
   FROM (interest_components ic
     JOIN tranches t ON ((t.id = ic.tranche_id)))
  WHERE (ic.id = rfr_fixings.interest_component_id))))
  with check (owns_deal(( SELECT t.deal_id
   FROM (interest_components ic
     JOIN tranches t ON ((t.id = ic.tranche_id)))
  WHERE (ic.id = rfr_fixings.interest_component_id))));
create policy rfr_forecast_curves_read on public.rfr_forecast_curves as permissive for select to authenticated
  using (true);
create policy rfr_forecast_curves_write on public.rfr_forecast_curves as permissive for all to authenticated
  using (true)
  with check (true);
create policy rfr_forecast_points_read on public.rfr_forecast_points as permissive for select to authenticated
  using (true);
create policy rfr_forecast_points_write on public.rfr_forecast_points as permissive for all to authenticated
  using (true)
  with check (true);
create policy rfr_idx_fix_admin_write on public.rfr_index_fixings as permissive for all to public
  using (is_admin())
  with check (is_admin());
create policy rfr_idx_fix_select on public.rfr_index_fixings as permissive for select to public
  using ((auth.role() = 'authenticated'::text));
create policy securities_read on public.securities as permissive for select to authenticated
  using (true);
create policy securities_write on public.securities as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy pricing_read on public.security_pricing as permissive for select to authenticated
  using (true);
create policy pricing_write on public.security_pricing as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy sessions_self_delete on public.sessions as permissive for delete to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR is_admin()));
create policy sessions_self_read on public.sessions as permissive for select to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR is_admin()));
create policy sessions_self_update on public.sessions as permissive for update to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy sessions_self_write on public.sessions as permissive for insert to authenticated
  with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy v3_demo_anon_insert_sessions on public.sessions as permissive for insert to anon
  with check (true);
create policy v3_demo_anon_read_sessions on public.sessions as permissive for select to anon
  using (true);
create policy v3_demo_anon_update_sessions on public.sessions as permissive for update to anon
  using (true)
  with check (true);
create policy teams_read on public.teams as permissive for select to authenticated
  using (true);
create policy teams_write on public.teams as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy tranches_owner_all on public.tranches as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy demo_all on public.treatment_overrides as permissive for all to public
  using (true)
  with check (true);
create policy treatment_owner_all on public.treatment_overrides as permissive for all to authenticated
  using (owns_deal(deal_id))
  with check (owns_deal(deal_id));
create policy v3_demo_anon_insert_treatment_overrides on public.treatment_overrides as permissive for insert to anon
  with check (true);
create policy v3_demo_anon_read_treatment_overrides on public.treatment_overrides as permissive for select to anon
  using (true);
create policy v3_demo_anon_update_treatment_overrides on public.treatment_overrides as permissive for update to anon
  using (true)
  with check (true);
create policy profiles_admin_all on public.user_profiles as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy profiles_self_read on public.user_profiles as permissive for select to authenticated
  using (((id = ( SELECT auth.uid() AS uid)) OR is_admin()));
create policy profiles_self_update on public.user_profiles as permissive for update to authenticated
  using ((id = ( SELECT auth.uid() AS uid)))
  with check ((id = ( SELECT auth.uid() AS uid)));
create policy user_profiles_read on public.user_profiles as permissive for select to authenticated
  using (true);
create policy user_profiles_write_self on public.user_profiles as permissive for update to authenticated
  using (((id = ( SELECT auth.uid() AS uid)) OR is_admin()))
  with check (((id = ( SELECT auth.uid() AS uid)) OR is_admin()));
create policy user_teams_admin on public.user_teams as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());
create policy user_teams_read on public.user_teams as permissive for select to authenticated
  using (true);
create policy user_teams_self_read on public.user_teams as permissive for select to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR is_admin()));
create policy user_teams_write on public.user_teams as permissive for all to authenticated
  using ((is_admin() OR (user_id = ( SELECT auth.uid() AS uid))))
  with check ((is_admin() OR (user_id = ( SELECT auth.uid() AS uid))));
