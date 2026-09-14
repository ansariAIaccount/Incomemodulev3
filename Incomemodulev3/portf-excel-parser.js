/* ═══════════════════════════════════════════════════════════════════════════
   PortF Excel parser — second ingestion path for external deals
   ───────────────────────────────────────────────────────────────────────────
   The API pull (GET /deals/{id}) and this file both produce the SAME snapshot
   object described in PortF-feed-contract-v0.2.md. Everything downstream —
   validation, storage, diffing, accounting — sees one shape and does not know
   or care which path the data arrived by.

       Excel file  ─┐
                    ├─► snapshot JSON ─► validate ─► import ─► diff ─► accounting
       PortF API   ─┘

   Layout this parses (from "Loan info portF.xlsx"):

     Header block      A2:B8   label in col A, value in col B
     Commitments       D2:E..  Date | Total Commitment, repeating down
     Component block   row 2 cell reading "Name" marks the LABEL column;
                       component values sit at labelCol+2, +4, +6 …
                       rows below carry Posting Type, Calculation Basis,
                       Interest Rate Structure, Interest Rate, Accrual
                       Frequency, Settlement Frequency, Settlement Type,
                       First Settlement Date, Drawdown
     Group labels      row 13  "Cash Interest" / "Cash Fee"   (posting type)
                       row 14  the components each group covers
     Cashflow header   row 15
     Cashflow rows     row 16 onward

   Two things the sheet does not state, which this parser derives:

   1. daysCovered. The row date is the period START. Days covered is the gap
      to the next date in the same series. Verified against the sample:
      31 Jul (Fri) → 3 Aug (Mon) is 3 days and carries £10,697.65, which is
      exactly 3 × the £3,565.88 that the following 1-day row carries.

   2. Component attribution. Row 14 can name TWO components over a single
      Rate/Amount pair ("20 Year Fixed, Monthly SONIA"). The workbook simply
      does not say how much of that amount belongs to which component. This
      parser does not guess: it emits one row against a combined pseudo-
      component and raises a warning. Per-component attribution requires the
      long-format API feed.

   Exposes: PortFExcel.parseWorkbook(wb)  — a SheetJS workbook
            PortFExcel.parseGrids(grids)  — { sheetName: rows[][] }, for tests
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ── coercion ─────────────────────────────────────────────────────────── */

  // Cells arrive as '£ 23,000,000.00', '£  -', '0.0045', 0.0045, or null.
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).replace(/[£$€,\s]/g, '').replace(/ /g, '');
    if (s === '' || s === '-' || s === '—') return 0;
    var neg = /^\((.*)\)$/.exec(s);
    if (neg) s = '-' + neg[1];
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function iso(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) {
      return v.getUTCFullYear() + '-' +
        String(v.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(v.getUTCDate()).padStart(2, '0');
    }
    var s = String(v).trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    // Excel serial date, 1900 system
    var n = parseFloat(s);
    if (isFinite(n) && n > 20000 && n < 90000) {
      var d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
      return iso(d);
    }
    var p = new Date(s);
    return isNaN(p.getTime()) ? null : iso(p);
  }

  function txt(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return iso(v);
    return String(v).trim();
  }

  function dayDiff(a, b) {
    if (!a || !b) return null;
    return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  }

  function slug(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  }

  function cell(grid, r, c) {
    var row = grid[r];
    return row ? (row[c] === undefined ? null : row[c]) : null;
  }

  /* ── enum mapping ─────────────────────────────────────────────────────── */
  // Every mapper returns null on an unrecognised value rather than guessing.
  // Callers turn a null into a rejection naming the cell, per contract §9.

  var FREQ = {
    'daily': 'daily', 'weekly': 'weekly', 'fortnightly': 'fortnightly',
    'monthly': 'monthly', 'quarterly': 'quarterly',
    'semi-annually': 'semiAnnual', 'semiannually': 'semiAnnual',
    'semi annually': 'semiAnnual', 'semi-annual': 'semiAnnual',
    'annually': 'annual', 'annual': 'annual', 'yearly': 'annual',
    'one-off': 'oneOff', 'one off': 'oneOff', 'oneoff': 'oneOff',
    'at maturity': 'atMaturity', 'at-maturity': 'atMaturity'
  };

  // "Semi-annually (Anniversary)" carries two facts in one cell.
  function freq(v) {
    var s = txt(v).toLowerCase();
    if (!s) return { frequency: null, anchor: null };
    var anchor = null;
    var m = /\(([^)]*)\)/.exec(s);
    if (m) {
      var a = m[1].trim();
      anchor = /anniversar/.test(a) ? 'anniversary' : (/calendar|month.?end|eom/.test(a) ? 'calendar' : null);
      s = s.slice(0, m.index).trim();
    }
    s = s.replace(/[.,;]+$/, '').trim();
    return { frequency: FREQ[s] || null, anchor: anchor, raw: txt(v) };
  }

  var POSTING = { 'interest': 'interest', 'fee': 'fee', 'principal': 'principal' };

  var BASIS = {
    'principal balance': 'principalBalance',
    'unfunded balance': 'unfundedBalance',
    'commitment': 'commitment',
    'face value': 'faceValue',
    'drawn balance': 'principalBalance'
  };

  var STRUCT = { 'fixed': 'fixed', 'floating': 'floating' };

  var SETTLE = {
    'cash': 'cash', 'capitalised': 'capitalised', 'capitalized': 'capitalised',
    'pik': 'pik', 'payment in kind': 'pik'
  };

  var DAYCOUNT = {
    'act/360': 'ACT/360', 'actual/360': 'ACT/360',
    'act/365': 'ACT/365', 'actual/365': 'ACT/365', 'act/365f': 'ACT/365',
    'act/act': 'ACT/ACT', 'actual/actual': 'ACT/ACT',
    '30/360': '30/360', '30e/360': '30E/360'
  };

  function mapEnum(table, v) {
    var s = txt(v).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!s) return null;
    return table[s] || null;
  }

  /* ── header block (A2:B..) ────────────────────────────────────────────── */

  function readHeaderBlock(grid) {
    var out = {};
    for (var r = 0; r < Math.min(grid.length, 14); r++) {
      var k = txt(cell(grid, r, 0));
      if (!k) continue;
      out[k.toLowerCase().replace(/\s+/g, ' ')] = cell(grid, r, 1);
    }
    return out;
  }

  /* ── commitment schedule (D2:E..) ─────────────────────────────────────── */

  function readCommitments(grid, warn, sheetName) {
    var rows = [];
    // Find the "Date"/"Total Commitment" header pair in the top rows.
    var hr = -1, dc = -1;
    for (var r = 0; r < Math.min(grid.length, 12) && hr < 0; r++) {
      for (var c = 0; c < 12; c++) {
        if (txt(cell(grid, r, c)).toLowerCase() === 'date' &&
            /total commitment/i.test(txt(cell(grid, r, c + 1)))) { hr = r; dc = c; break; }
      }
    }
    if (hr < 0) return rows;
    for (var i = hr + 1; i < grid.length; i++) {
      var d = iso(cell(grid, i, dc));
      var a = num(cell(grid, i, dc + 1));
      if (!d && a === null) break;          // blank row ends the block
      if (!d) { warn(sheetName + ': commitment row ' + (i + 1) + ' has an amount but no date — skipped'); continue; }
      rows.push({ effectiveDate: d, amount: a });
    }
    return rows;
  }

  /* ── component definition block ───────────────────────────────────────── */
  /* Row 2 holds "Name" in the label column; each component occupies a column
     at labelCol+2, +4, +6 … The rows beneath carry its attributes.          */

  var COMPONENT_FIELDS = {
    'posting type': 'postingTypeRaw',
    'calculation basis': 'calculationBasisRaw',
    'calculation method': 'calculationMethodRaw',
    'interest rate structure': 'rateStructureRaw',
    'interest rate': 'rateRaw',
    'index': 'indexRaw',
    'accrual frequency': 'accrualRaw',
    'settlement frequency': 'settlementRaw',
    'settlement type': 'settlementTypeRaw',
    'first settlement date': 'firstSettlementRaw',
    'drawdown': 'drawdownRaw'
  };

  function readComponents(grid, scope, ctx, warn, err, sheetName) {
    var out = [];
    // Locate the label column: the cell reading "Name" in the top rows.
    var nameRow = -1, labelCol = -1;
    for (var r = 0; r < Math.min(grid.length, 12) && nameRow < 0; r++) {
      for (var c = 0; c < 30; c++) {
        if (txt(cell(grid, r, c)).toLowerCase() === 'name') { nameRow = r; labelCol = c; break; }
      }
    }
    if (nameRow < 0) { warn(sheetName + ': no component block found (no "Name" label)'); return out; }

    // Attribute rows sit beneath the Name row, keyed by their label.
    var fieldRow = {};
    for (var r2 = nameRow + 1; r2 < Math.min(grid.length, nameRow + 14); r2++) {
      var lbl = txt(cell(grid, r2, labelCol)).toLowerCase().replace(/\s+/g, ' ');
      if (COMPONENT_FIELDS[lbl]) fieldRow[COMPONENT_FIELDS[lbl]] = r2;
    }

    // Walk right in steps of 2 until an empty name column.
    for (var col = labelCol + 2; col < labelCol + 40; col += 2) {
      var name = txt(cell(grid, nameRow, col));
      if (!name) break;

      var raw = {};
      Object.keys(fieldRow).forEach(function (k) { raw[k] = cell(grid, fieldRow[k], col); });

      // Component ids must be unique across tranches — two tranches can both
      // carry a "Monthly SONIA". ctx.trancheKey is the tranche's own token,
      // passed in rather than parsed back out of the id (splitting on '-' broke
      // as soon as tranche ids stopped being a tidy "T1").
      var id = (ctx.externalDealId || 'DEAL') +
               (scope === 'tranche' && ctx.trancheKey ? '-' + ctx.trancheKey : '') +
               '-' + slug(name);

      var acc = freq(raw.accrualRaw);
      var set = freq(raw.settlementRaw);

      var comp = {
        externalComponentId: id,
        scope: scope,
        name: name,
        postingType: mapEnum(POSTING, raw.postingTypeRaw),
        calculationMethod: txt(raw.calculationMethodRaw)
          ? (/level/i.test(txt(raw.calculationMethodRaw)) ? 'levelPayment' : 'dayCount')
          : 'dayCount',
        calculationBasis: mapEnum(BASIS, raw.calculationBasisRaw),
        basisReference: null,           // resolved below
        rateStructure: mapEnum(STRUCT, raw.rateStructureRaw),
        index: txt(raw.indexRaw) || null,
        rate: num(raw.rateRaw),
        accrualFrequency: acc.frequency,
        accrualAnchor: acc.anchor,
        settlementFrequency: set.frequency,
        settlementType: mapEnum(SETTLE, raw.settlementTypeRaw),
        firstSettlementDate: iso(raw.firstSettlementRaw),
        drawdownScope: /all/i.test(txt(raw.drawdownRaw)) ? 'all' : (txt(raw.drawdownRaw) || 'all'),
        effectiveFrom: ctx.loanStartDate || null,
        effectiveTo: null
      };

      if (scope === 'tranche' && ctx.externalTrancheId) comp.externalTrancheId = ctx.externalTrancheId;

      // The name often encodes the index when the structure is floating and
      // no explicit Index cell exists: "Monthly SONIA", "Daily SOFR".
      if (comp.rateStructure === 'floating' && !comp.index) {
        var m = /\b(SONIA|SOFR|ESTR|EURIBOR|BBSY|BBSW|TONA|CORRA|SORA)\b/i.exec(name);
        if (m) comp.index = m[1].toUpperCase();
        else warn(sheetName + ': component "' + name + '" is floating but names no index — set it before accounting');
      }

      // basisReference: an unfunded-balance component must say whether it
      // ticks on the committed amount or the maximum facility. The workbook
      // has no such cell, so it is resolved against the commitment schedule
      // by the caller and left null here when it cannot be determined.
      if (comp.calculationBasis === 'unfundedBalance') comp.basisReference = ctx.unfundedBasisReference || null;
      else if (comp.calculationBasis === 'principalBalance') comp.basisReference = 'drawn';

      // Hard failures — never defaulted, per contract §9.
      if (!comp.postingType) err(sheetName + ': component "' + name + '" has an unrecognised Posting Type (' + txt(raw.postingTypeRaw) + ')');
      if (!comp.calculationBasis) err(sheetName + ': component "' + name + '" has an unrecognised Calculation Basis (' + txt(raw.calculationBasisRaw) + ')');
      if (!comp.rateStructure) err(sheetName + ': component "' + name + '" has an unrecognised Interest Rate Structure (' + txt(raw.rateStructureRaw) + ')');
      // A one-off fee has no accrual cadence — it is charged, not accrued —
      // so a blank Accrual Frequency there is correct, not a defect.
      if (!comp.accrualFrequency && comp.settlementFrequency === 'oneOff') {
        comp.accrualFrequency = 'oneOff';
      }
      if (!comp.accrualFrequency) err(sheetName + ': component "' + name + '" has an unrecognised Accrual Frequency (' + (acc.raw || '(blank)') + ')');
      if (comp.rateStructure === 'fixed' && comp.rate === null) err(sheetName + ': fixed component "' + name + '" has no Interest Rate');
      // A rate above 1 is a percent that should have been a decimal.
      if (comp.rate !== null && comp.rate > 1) err(sheetName + ': component "' + name + '" has rate ' + comp.rate + ' — rates must be decimals (0.0702, not 7.02)');

      out.push(comp);
    }
    return out;
  }

  /* ── cashflow table ───────────────────────────────────────────────────── */
  /* Row 13 names each group's posting type, row 14 the components it covers,
     row 15 the columns. A group may cover more than one component, which the
     workbook gives no way to split — see the note at the top of this file.  */

  /* Drawdown lot identity.
     Accrual rows identify their lot in prose — "Drawdown — £23,000,000 on
     2026-07-31" — while the event rows carry the same drawdown as an amount
     and a date with no prose at all. Deriving the id from (date, amount) in
     both places is what lets an event and its accruals join up, which the
     consolidation handling in contract §5 depends on. */
  function lotId(date, amount) {
    if (!date || !amount) return null;
    return 'LOT-' + date + '-' + Math.round(Math.abs(amount));
  }

  function lotIdFromScope(scopeRaw) {
    if (!scopeRaw) return null;
    var amt = /£\s*([\d,]+(?:\.\d+)?)/.exec(scopeRaw);
    var dt = /(\d{4}-\d{2}-\d{2})/.exec(scopeRaw);
    if (amt && dt) return lotId(dt[1], num(amt[1]));
    return slug(scopeRaw).slice(0, 32);   // unparseable prose — keep it stable
  }

  function findCashflowHeader(grid) {
    for (var r = 0; r < grid.length; r++) {
      if (txt(cell(grid, r, 0)).toLowerCase() === 'date' &&
          /initial purchase/i.test(txt(cell(grid, r, 1)))) return r;
    }
    return -1;
  }

  function readCashflows(grid, components, ctx, warn, err, sheetName, meta) {
    var rows = [];
    meta = meta || {};
    // Denominator for the implied-days yardstick below. ACT/ACT and the 30/360
    // family are close enough to 365 over the short periods this compares.
    var den = /360/.test(ctx.dayCountConvention || '') ? 360 : 365;
    var hr = findCashflowHeader(grid);
    if (hr < 0) { warn(sheetName + ': no cashflow table found'); return rows; }

    var headers = (grid[hr] || []).map(function (v) { return txt(v).toLowerCase(); });

    var colBalance = -1, colScope = -1;
    headers.forEach(function (h, i) {
      if (/unfunded balance|principal balance/.test(h)) colBalance = i;
      if (/drawdown scope/.test(h)) colScope = i;
    });

    // Groups: each "rate" column starts one, paired with the "amount" beside it.
    var groups = [];
    headers.forEach(function (h, i) {
      if (h !== 'rate') return;
      if (txt(cell(grid, hr, i + 1)).toLowerCase() !== 'amount') {
        err(sheetName + ': "Rate" at column ' + (i + 1) + ' is not followed by "Amount"');
        return;
      }
      var postingLabel = '';
      for (var back = i; back >= 0 && !postingLabel; back--) postingLabel = txt(cell(grid, hr - 2, back));
      var memberLabel = '';
      for (var b2 = i; b2 >= 0 && !memberLabel; b2--) memberLabel = txt(cell(grid, hr - 1, b2));
      if (/balance basis/i.test(memberLabel)) memberLabel = '';

      var members = memberLabel
        ? memberLabel.split(/\s*,\s*/).map(function (s) { return s.trim(); }).filter(Boolean)
        : [];

      var matched = members.map(function (nm) {
        var hit = components.filter(function (c) { return c.name.toLowerCase() === nm.toLowerCase(); })[0];
        if (!hit) warn(sheetName + ': cashflow group names "' + nm + '", which is not a defined component');
        return hit || null;
      }).filter(Boolean);

      var postingType = /interest/i.test(postingLabel) ? 'interest'
                      : /fee/i.test(postingLabel) ? 'fee'
                      : /principal/i.test(postingLabel) ? 'principal'
                      : (matched[0] ? matched[0].postingType : null);

      var combined = matched.length > 1;
      if (combined) {
        warn(sheetName + ': one Rate/Amount pair covers ' + matched.length + ' components (' +
             matched.map(function (c) { return c.name; }).join(', ') +
             '). The workbook does not say how the amount splits, so it is imported as a single combined line. ' +
             'Per-component figures need the API feed.');
      }

      groups.push({
        rateCol: i,
        amountCol: i + 1,
        cashCol: (headers[i + 2] || '').indexOf('total cash') === 0 ? i + 2 : -1,
        postingType: postingType,
        components: matched,
        combined: combined,
        componentId: combined
          ? (ctx.externalDealId + (ctx.externalTrancheId ? '-' + slug(ctx.externalTrancheId.split('-').pop()) : '') +
             '-COMBINED-' + slug(postingType || 'X'))
          : (matched[0] ? matched[0].externalComponentId : null)
      });
    });

    if (!groups.length) { warn(sheetName + ': cashflow table has no Rate/Amount groups'); return rows; }

    // Collect raw rows first; daysCovered needs the NEXT date per series.
    var raw = [];
    for (var r = hr + 1; r < grid.length; r++) {
      var d = iso(cell(grid, r, 0));
      if (!d) continue;
      var scopeRaw = colScope >= 0 ? txt(cell(grid, r, colScope)) : '';
      var lot = lotIdFromScope(scopeRaw);
      var bal = colBalance >= 0 ? num(cell(grid, r, colBalance)) : null;

      groups.forEach(function (g, gi) {
        var amt = num(cell(grid, r, g.amountCol));
        var rt = num(cell(grid, r, g.rateCol));
        if (amt === null && rt === null) return;
        if (rt !== null && rt > 1) {
          err(sheetName + ' row ' + (r + 1) + ': rate ' + rt + ' must be a decimal, not a percent');
        }
        raw.push({
          rowNo: r + 1,
          seriesKey: gi + '|' + (lot || ''),
          date: d,
          externalTrancheId: ctx.externalTrancheId || null,
          externalComponentId: g.componentId,
          componentNames: g.components.map(function (c) { return c.name; }),
          combined: g.combined,
          drawdownLotId: lot,
          drawdownScopeText: scopeRaw || null,
          postingType: g.postingType,
          basisBalance: bal,
          rate: rt,
          amount: amt === null ? 0 : amt,
          // What the figures themselves say the period must have been. This
          // is the yardstick the calendar conventions below are scored against.
          impliedDays: (bal && rt && amt) ? (amt * den) / (bal * rt) : null,
          cashSettled: g.cashCol >= 0 ? (num(cell(grid, r, g.cashCol)) || 0) : 0
        });
      });
    }

    /* daysCovered is not stated anywhere in the workbook, and the sample does
       NOT use one convention throughout: on "Tranch info" the row date is the
       period START (days = gap forward), on "Loan info" it is the period END
       (days = gap back to the previous date, or to loan start for the first
       row). Assuming either one would silently mis-state half the file.

       So both are scored against impliedDays and the better fit wins. The
       residual is reported rather than smoothed away — where PortF's figures
       do not reconcile to the calendar, that is a question for PortF. */

    var bySeries = {};
    raw.forEach(function (x) { (bySeries[x.seriesKey] = bySeries[x.seriesKey] || []).push(x); });
    Object.keys(bySeries).forEach(function (k) {
      bySeries[k].sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    });

    function gapAt(list, i, mode) {
      var j;
      if (mode === 'start') {
        for (j = i + 1; j < list.length; j++) if (list[j].date !== list[i].date) return dayDiff(list[i].date, list[j].date);
        return null;                              // last row: no successor
      }
      for (j = i - 1; j >= 0; j--) if (list[j].date !== list[i].date) return dayDiff(list[j].date, list[i].date);
      // First row under end-dating runs from the start of the loan.
      return ctx.loanStartDate ? dayDiff(ctx.loanStartDate, list[i].date) : null;
    }

    function score(mode) {
      var total = 0, n = 0;
      Object.keys(bySeries).forEach(function (k) {
        bySeries[k].forEach(function (x, i) {
          if (!x.impliedDays) return;
          var d = gapAt(bySeries[k], i, mode);
          if (d === null || d <= 0) return;
          total += Math.abs(d - x.impliedDays) / x.impliedDays;
          n++;
        });
      });
      return n ? { err: total / n, n: n } : { err: Infinity, n: 0 };
    }

    var sStart = score('start'), sEnd = score('end');
    var mode = sEnd.err < sStart.err ? 'end' : 'start';
    meta.dateConvention = mode === 'start' ? 'rowDateIsPeriodStart' : 'rowDateIsPeriodEnd';
    var chosenErr = (mode === 'start' ? sStart.err : sEnd.err);
    meta.conventionFitPct = isFinite(chosenErr) ? +(chosenErr * 100).toFixed(3) : null;
    meta.conventionScored = (mode === 'start' ? sStart.n : sEnd.n);

    if (sStart.n || sEnd.n) {
      warn(sheetName + ': days covered is not in the file. Read as "' + meta.dateConvention +
           '" — it fits the stated amounts ' +
           (isFinite(sStart.err) && isFinite(sEnd.err)
              ? 'better than the alternative (' + (+(Math.min(sStart.err, sEnd.err) * 100)).toFixed(2) + '% mean error vs ' +
                (+(Math.max(sStart.err, sEnd.err) * 100)).toFixed(2) + '%)'
              : 'across ' + meta.conventionScored + ' rows') + '.');
    }

    var offBy = 0, worst = 0, worstRow = null;
    Object.keys(bySeries).forEach(function (k) {
      bySeries[k].forEach(function (x, i) {
        var d = gapAt(bySeries[k], i, mode);
        x.daysCovered = (d !== null && d > 0) ? d : null;
        x.daysCoveredSource = x.daysCovered === null ? null : mode;
        if (x.daysCovered && x.impliedDays) {
          x.daysCoveredResidualPct = +(((x.daysCovered - x.impliedDays) / x.impliedDays) * 100).toFixed(3);
          if (Math.abs(x.daysCoveredResidualPct) > 0.5) {
            offBy++;
            if (Math.abs(x.daysCoveredResidualPct) > Math.abs(worst)) { worst = x.daysCoveredResidualPct; worstRow = x; }
          }
        }
      });
    });

    if (offBy) {
      // A constant residual across every row is the signature of a rate that
      // has been rounded for display rather than a period that is wrong. The
      // sample's 45bp commitment fee is stated as 0.0045 to four decimals; the
      // amounts imply 0.0044669, and that 4dp rounding alone accounts for the
      // whole 0.74% gap. On a 5.7% rate the same rounding is only 0.02%, which
      // is why the tranche sheet reconciles and the facility sheet does not.
      var residuals = [];
      Object.keys(bySeries).forEach(function (k) {
        bySeries[k].forEach(function (x) {
          if (typeof x.daysCoveredResidualPct === 'number' && Math.abs(x.daysCoveredResidualPct) > 0.5) residuals.push(x.daysCoveredResidualPct);
        });
      });
      var spread = residuals.length ? Math.max.apply(null, residuals) - Math.min.apply(null, residuals) : 0;
      var systematic = residuals.length > 2 && spread < 0.05;

      if (systematic) {
        var impliedRate = worstRow && worstRow.rate ? worstRow.rate / (1 + worst / 100) : null;
        meta.ratePrecisionSuspect = true;
        warn(sheetName + ': every row is off the calendar by the same ' + worst.toFixed(2) + '%, which is the signature ' +
             'of a rate rounded for display, not a wrong period. The stated rate ' +
             (worstRow ? worstRow.rate : '?') + ' appears to be ' +
             (impliedRate ? impliedRate.toFixed(7) : 'a longer decimal') + ' rounded to 4 places. ' +
             'Amounts are used as given so the accounting is unaffected, but ask PortF to send rates at full precision — ' +
             'a 4dp rate distorts any recalculation of a low-rate fee by roughly 1%.');
      } else {
        warn(sheetName + ': ' + offBy + ' cashflow row(s) do not reconcile to the calendar — the stated amount implies a ' +
             'shorter or longer period than the dates do (worst: row ' + (worstRow ? worstRow.rowNo : '?') +
             ', off by ' + worst.toFixed(2) + '%). PCS posts PortF\'s amounts as given, so the accounting is unaffected, ' +
             'but days covered shown on screen is our inference, not their statement. Worth asking PortF to confirm.');
      }
    }

    var unresolved = raw.filter(function (x) { return x.daysCovered === null && x.amount; });
    if (unresolved.length) {
      warn(sheetName + ': ' + unresolved.length + ' cashflow line(s) sit at the edge of the file with no neighbouring ' +
           'date, so days covered cannot be inferred. The amount is still imported and still posts.');
    }

    raw.forEach(function (x) { delete x.seriesKey; rows.push(x); });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return rows;
  }

  /* ── events, derived from the cashflow table's movement columns ───────── */

  function readEvents(grid, ctx, warn, sheetName) {
    var events = [];
    var hr = findCashflowHeader(grid);
    if (hr < 0) return events;
    var headers = (grid[hr] || []).map(function (v) { return txt(v).toLowerCase(); });

    var map = [
      { re: /initial purchase/, type: 'initialPurchase' },
      { re: /^drawdown$/, type: 'drawdown' },
      { re: /principal payment/, type: 'principalPayment' }
    ];
    var cols = [];
    headers.forEach(function (h, i) {
      map.forEach(function (m) { if (m.re.test(h)) cols.push({ col: i, type: m.type }); });
    });
    if (!cols.length) return events;

    var colScope = headers.indexOf('drawdown scope');
    var n = 0;
    for (var r = hr + 1; r < grid.length; r++) {
      var d = iso(cell(grid, r, 0));
      if (!d) continue;
      cols.forEach(function (cdef) {
        var amt = num(cell(grid, r, cdef.col));
        if (!amt) return;                    // 0 and '£ -' are not events
        var scopeRaw = colScope >= 0 ? txt(cell(grid, r, colScope)) : '';
        events.push({
          externalEventId: ctx.externalDealId + '-E' + (++n),
          externalTrancheId: ctx.externalTrancheId || null,
          eventType: cdef.type,
          eventDate: d,
          amount: amt,
          // Same derivation the accrual rows use, so an event and the accruals
          // it gave rise to carry the same lot id and can be joined.
          drawdownLotId: lotIdFromScope(scopeRaw) || lotId(d, amt),
          sourceRow: r + 1
        });
      });
    }
    return events;
  }

  /* ── main ─────────────────────────────────────────────────────────────── */

  /* Fifty tranche sheets means fifty copies of every per-sheet warning, and a
     review screen with 200 near-identical lines is one nobody reads. Warnings
     of the form "<sheet>: <message>" are collapsed onto the message, listing
     the sheets it affects. The first sheet name is kept verbatim so a genuinely
     one-off warning still reads normally. */
  function rollUp(list) {
    var groups = [], index = {};
    list.forEach(function (w) {
      var m = /^([^:]{1,60}):\s([\s\S]+)$/.exec(w);
      var sheet = m ? m[1] : null;
      var body = m ? m[2] : w;
      // Numbers inside a message differ per sheet ("3 rows", "7 rows"); key on
      // the shape so those still group, and show the range afterwards.
      var key = body.replace(/\b\d[\d,.]*\b/g, '#');
      if (!index[key]) { index[key] = { sheets: [], body: body, bare: !sheet }; groups.push(index[key]); }
      if (sheet) index[key].sheets.push(sheet);
      else index[key].bodies = (index[key].bodies || []).concat(body);
    });

    return groups.map(function (g) {
      if (!g.sheets.length) return g.body;
      if (g.sheets.length === 1) return g.sheets[0] + ': ' + g.body;
      var shown = g.sheets.slice(0, 4).join(', ') + (g.sheets.length > 4 ? ' and ' + (g.sheets.length - 4) + ' more' : '');
      return g.sheets.length + ' sheets (' + shown + '): ' + g.body;
    });
  }

  function parseGrids(grids, opts) {
    opts = opts || {};
    var warnings = [], errors = [];
    function warn(m) { warnings.push(m); }
    function err(m) { errors.push(m); }

    /* Sheet names are matched loosely — "Loan info", "Loan Info", "LoanInfo".
       One worksheet per tranche, so EVERY sheet matching /tranch/ is read and
       the workbook may carry as many as it likes. Order is preserved so the
       tranches appear as they do in the file. */
    var loanKey = null, trancheKeys = [];
    Object.keys(grids).forEach(function (k) {
      var n = k.toLowerCase().replace(/\s+/g, '');
      if (/^loaninfo/.test(n)) loanKey = k;
      else if (/tranch/.test(n)) trancheKeys.push(k);
    });
    if (!loanKey) { err('No "Loan info" sheet found — cannot identify the facility'); return { snapshot: null, warnings: rollUp(warnings), errors: errors }; }

    var loan = grids[loanKey];
    var head = readHeaderBlock(loan);

    var company = txt(head['company']);
    if (!company) err('Loan info: Company is blank — it identifies the deal');

    var externalDealId = opts.externalDealId || slug(company) || 'PORTF-DEAL';

    var dayCountRaw = head['day count convention'];
    var dayCount = mapEnum(DAYCOUNT, dayCountRaw);
    if (!dayCount) {
      dayCount = opts.defaultDayCount || 'ACT/365';
      warn('Loan info: Day Count Convention is blank. Defaulted to ' + dayCount +
           ' — confirm before running accounting, because it changes every accrual.');
    }

    var commitments = readCommitments(loan, warn, 'Loan info');
    var committedAmount = commitments.reduce(function (s, c) { return s + (c.amount || 0); }, 0) || null;

    var facility = {
      company: company || null,
      debtType: txt(head['debt type']) || null,
      currency: opts.currency || 'GBP',
      loanStartDate: iso(head['loan start date']),
      loanEndDate: iso(head['loan end date']),
      dayCountConvention: dayCount,
      interestAccrues: /next/i.test(txt(head['interest accrues'])) ? 'nextDay' : 'sameDay',
      committedAmount: committedAmount,
      maximumFacilityAmount: null,        // filled from the opening balance below
      commitmentSchedule: commitments.map(function (c) {
        return { effectiveDate: c.effectiveDate, amount: c.amount, reference: 'committed' };
      })
    };

    if (!facility.loanStartDate) err('Loan info: Loan Start Date is blank');
    if (!facility.loanEndDate) err('Loan info: Loan End Date is blank');
    if (!opts.currency) warn('Currency is not stated anywhere in the workbook. Assumed GBP — set it on import if wrong.');

    // The opening unfunded balance is the maximum facility, not the sum of
    // the commitment rows. Contract §4: the two are different numbers and the
    // fee ticks on the larger one.
    var loanHr = findCashflowHeader(loan);
    if (loanHr >= 0) {
      var lh = (loan[loanHr] || []).map(function (v) { return txt(v).toLowerCase(); });
      var ub = lh.findIndex(function (h) { return /unfunded balance/.test(h); });
      if (ub >= 0) {
        for (var rr = loanHr + 1; rr < loan.length; rr++) {
          var v = num(cell(loan, rr, ub));
          if (v) { facility.maximumFacilityAmount = v; break; }
        }
      }
    }

    var basisRef = null;
    if (facility.maximumFacilityAmount && committedAmount) {
      if (facility.maximumFacilityAmount > committedAmount * 1.5) {
        basisRef = 'maximum';
        warn('The opening unfunded balance (' + facility.maximumFacilityAmount.toLocaleString() +
             ') far exceeds the commitment schedule total (' + committedAmount.toLocaleString() +
             '). Read as the maximum facility, with unfunded-balance fees ticking on it. ' +
             'ECL exposure still uses the committed amount only — see contract §4.');
      } else {
        basisRef = 'committed';
      }
    }

    var facilityComponents = readComponents(loan, 'facility',
      { externalDealId: externalDealId, loanStartDate: facility.loanStartDate, unfundedBasisReference: basisRef },
      warn, err, 'Loan info');

    var meta = { sheets: {} };
    meta.sheets['Loan info'] = {};
    var facilityCashflows = readCashflows(loan, facilityComponents, {
      externalDealId: externalDealId,
      externalTrancheId: null,
      loanStartDate: facility.loanStartDate,
      dayCountConvention: facility.dayCountConvention
    }, warn, err, 'Loan info', meta.sheets['Loan info']);

    /* ── tranches: one worksheet each ──────────────────────────────────────
       Each /tranch/ sheet becomes one tranche. The tranche id is derived from
       the SHEET NAME rather than from its position, because position moves
       whenever someone reorders or inserts a sheet, and an id that moves
       breaks the link to prior snapshots, to posted accounting runs and to
       the GL. A sheet rename still breaks it — which is precisely the id
       immutability question already open with PortF (contract §10 Q1).       */

    var tranches = [], trancheComponents = [], trancheCashflows = [], events = [];
    var usedTrancheIds = {};
    var rowBudget = opts.maxCashflowRows || 500000;

    if (!trancheKeys.length) {
      warn('No tranche worksheet found — importing facility-level data only, with no tranche cashflows.');
    }

    // A plain loop, not forEach — the row-budget check below has to be able to
    // BREAK. With forEach it could only record an error and carry on parsing,
    // which defeats the point: the guard exists to stop before the tab runs
    // out of memory, not to report afterwards that it should have.
    var budgetBlown = false;
    for (var tsi = 0; tsi < trancheKeys.length; tsi++) {
      var sheetName = trancheKeys[tsi], ti = tsi;
      var tg = grids[sheetName];
      var th = readHeaderBlock(tg);
      var tName = txt(th['tranche name']);

      // The sample carries a date in Tranche Name. Contract §6 makes names
      // display-only, so a bad name is a warning, never a failure.
      var tNameDate = null;
      if (/^\d{4}-\d{2}-\d{2}/.test(tName)) {
        tNameDate = iso(tName);
        warn(sheetName + ': Tranche Name holds a date (' + tName + ') rather than a name, so the sheet name is used ' +
             'instead. The date is kept as a candidate tranche start — it may be the real start date in the wrong ' +
             'cell. Confirm with PortF before relying on it.');
        tName = '';
      }
      if (!tName) tName = sheetName;

      // Id from the sheet name, de-duplicated if two sheets slug alike.
      var base = slug(sheetName) || ('T' + (ti + 1));
      var key = base;
      var dedupe = 2;
      while (usedTrancheIds[key]) { key = base + '-' + (dedupe++); }
      usedTrancheIds[key] = true;
      var externalTrancheId = externalDealId + '-' + key;

      var tCommitments = readCommitments(tg, warn, sheetName);

      tranches.push({
        externalTrancheId: externalTrancheId,
        name: tName,
        sheetName: sheetName,
        currency: facility.currency,
        commitment: tCommitments.length ? tCommitments[0].amount : null,
        startDate: tCommitments.length ? tCommitments[0].effectiveDate : facility.loanStartDate,
        startDateCandidate: tNameDate || null
      });

      var tctx = {
        externalDealId: externalDealId,
        externalTrancheId: externalTrancheId,
        trancheKey: key,
        loanStartDate: iso(th['loan start date']) || facility.loanStartDate,
        dayCountConvention: facility.dayCountConvention
      };

      meta.sheets[sheetName] = {};
      var comps = readComponents(tg, 'tranche', tctx, warn, err, sheetName);
      var flows = readCashflows(tg, comps, tctx, warn, err, sheetName, meta.sheets[sheetName]);
      var evts  = readEvents(tg, tctx, warn, sheetName);

      trancheComponents = trancheComponents.concat(comps);
      trancheCashflows  = trancheCashflows.concat(flows);
      events            = events.concat(evts);

      // Stop before the browser does. A 40-year daily tranche is ~30k rows;
      // fifty of them is 1.5m, which exceeds what a tab can hold as objects.
      // Failing here with a clear message beats an unexplained crash halfway
      // through — and points at the API path, which streams server-side.
      if (facilityCashflows.length + trancheCashflows.length > rowBudget) {
        err('This workbook exceeds ' + rowBudget.toLocaleString() + ' cashflow rows — stopped at sheet "' +
            sheetName + '", tranche ' + (ti + 1) + ' of ' + trancheKeys.length + '. A browser cannot hold a file ' +
            'this large in memory. Split it, shorten the schedule, or bring this deal in over the pull API, which ' +
            'imports server-side with no such ceiling.');
        budgetBlown = true;
        break;
      }
    }

    if (budgetBlown) return { snapshot: null, warnings: rollUp(warnings), errors: errors };

    if (trancheKeys.length > 1) {
      meta.trancheSheets = trancheKeys.slice();
      warn(trancheKeys.length + ' tranche worksheets read (' + trancheKeys.join(', ') + '). Tranche ids are derived ' +
           'from the sheet names, so renaming a sheet in a later export will read as a new tranche rather than the ' +
           'same one — keep the names stable between snapshots.');
    }

    var components = facilityComponents.concat(trancheComponents);
    var cashflows = facilityCashflows.concat(trancheCashflows);

    // A workbook is one point in time. The hash is over content only, so a
    // re-export of unchanged figures does not read as a new snapshot.
    var payload = { facility: facility, components: components, tranches: tranches, events: events, cashflows: cashflows };
    var hash = 'fnv:' + fnv1a(JSON.stringify(payload));

    var snapshot = {
      snapshotId: externalDealId + '-XLS-' + (opts.receivedAt || new Date().toISOString()).slice(0, 19).replace(/[-:T]/g, ''),
      contentHash: hash,
      generatedAt: opts.generatedAt || null,
      receivedAt: opts.receivedAt || new Date().toISOString(),
      externalDealId: externalDealId,
      externalSystem: 'portf',
      ingestMethod: 'excel',
      sourceFilename: opts.filename || null,
      parseMeta: meta,
      facility: facility,
      components: components,
      tranches: tranches,
      events: events,
      cashflows: cashflows
    };

    // Contract §9 cross-reference check.
    var known = {};
    components.forEach(function (c) { known[c.externalComponentId] = true; });
    cashflows.forEach(function (cf) {
      if (cf.externalComponentId && !known[cf.externalComponentId] && !/-COMBINED-/.test(cf.externalComponentId)) {
        err('Cashflow row ' + cf.rowNo + ' references unknown component ' + cf.externalComponentId);
      }
    });

    return { snapshot: snapshot, warnings: rollUp(warnings), errors: errors };
  }

  function fnv1a(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function parseWorkbook(wb, opts) {
    if (typeof XLSX === 'undefined') throw new Error('XLSX library not loaded — refresh the page');
    var grids = {};
    wb.SheetNames.forEach(function (n) {
      grids[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, raw: true, cellDates: true });
    });
    return parseGrids(grids, opts);
  }

  var api = {
    parseWorkbook: parseWorkbook,
    parseGrids: parseGrids,
    _internals: { num: num, iso: iso, freq: freq, mapEnum: mapEnum, slug: slug, fnv1a: fnv1a }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PortFExcel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
