/* ═══════════════════════════════════════════════════════════════════════════
   PCS Loan Import — Excel workbook parser
   Template: "PCS Loan Import New Deal.xlsx" (agreed with PortF, Sept 2026)
   ───────────────────────────────────────────────────────────────────────────
   Produces the same snapshot object the pull API returns, so validation,
   storage, diffing and accounting see one shape regardless of route.

   WORKBOOK SHAPE
     "Loan info"      one per file. Deal Setup / Facility Setup / Facility Fees
                      blocks, then the facility cashflow table.
     "Tranche N"      one per tranche, up to 50. Tranche Details / Tranche
                      Interest Details / Tranche Fees, then its cashflow table.
     "Lookup values"  the agreed vocabulary. Every governed field is validated
                      against it and anything else stops the import.

   NOTHING IS READ FROM A FIXED CELL ADDRESS. Blocks are located by their
   section heading ("Deal Setup", "Tranche Interest Details", …) and fields by
   their label within that block. This is not defensive programming for its own
   sake: in the agreed template itself, Tranche 1 starts its blocks on row 2 and
   Tranche 2 on row 3. Fixed addresses would already be wrong.

   CASHFLOW TABLE
     Four sections, delimited by their running-total columns:
       … pairs … | Total Accrued PIK Interest
       … pairs … | Flat PIK Fee  | Total Accrued PIK Fee | Total Accrued PIK
       … pairs … | Total Cash Interest
       … pairs … | Flat Cash Fee | Total Cash Fee | Total Cash | Total
     Each section holds four Rate/Amount pairs, one per balance basis, named in
     the row above the header. So posting type and settlement type both come
     from the section, and the basis from the column — no guessing.

   Exposes: PortFExcel.parseWorkbook(wb)   SheetJS workbook
            PortFExcel.parseGrids(grids)   { sheetName: rows[][] }, for tests
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ── cell coercion ────────────────────────────────────────────────────── */

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).replace(/[£$€¥,\s]/g, '').replace(/ /g, '');
    if (s === '' || s === '-' || s === '—') return 0;
    var neg = /^\((.*)\)$/.exec(s);
    if (neg) s = '-' + neg[1];
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function iso(v, conv) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) {
      return v.getUTCFullYear() + '-' +
        String(v.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(v.getUTCDate()).padStart(2, '0');
    }
    var s = String(v).trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    var n = parseFloat(s);
    if (isFinite(n) && n > 20000 && n < 90000) {          // Excel serial, 1900
      return iso(new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000));
    }
    /* A slash date is ambiguous: 08/04/2024 is 8 April to most of the world and
       4 August to the US. new Date() silently picks the US reading, which is how
       a UK deal's April payment becomes an August one with nothing to show for
       it. Refuse it here; the caller scans the whole column and passes the
       convention it can actually evidence (see scanDateConvention). */
    /* Fall back to the convention established for the whole workbook.

       scanDateConvention existed but was wired into exactly one v0.3-era
       reader. Every v0.4 reader called iso() with no convention, so a slash
       date returned null and the row was discarded as a placeholder — the
       Smokey v0.5 file writes all 93 movements as "22/08/2024" text and lost
       every one of them, then failed with "no movements found". Files whose
       dates happen to be real Excel dates were unaffected, which is why this
       went unnoticed.

       _fileDateConv is only ever set from evidence (a component above 12
       somewhere in the file), never guessed — an all-ambiguous file still
       refuses, exactly as before. */
    var sl = SLASH_DATE.exec(s);
    if (sl) {
      var c = conv || _fileDateConv;
      return c ? fromSlash(sl, c) : null;
    }
    var p = new Date(s);
    return isNaN(p.getTime()) ? null : iso(p);
  }

  var SLASH_DATE = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/;

  /* Workbook-wide date convention, established once per parse from evidence
     across every sheet, then used by iso() above. Scoped to one parse and
     cleared at the start of the next — a stale convention carried from a
     previous file would be worse than none. */
  var _fileDateConv = null;

  /* Look at EVERY cell in the workbook, not one column.
     A file usually writes dates the same way throughout, so evidence in any
     sheet settles the reading for all of them. That matters here: Movements
     might be all day-first-unprovable while Cashflows contains a 22/08 that
     settles it, and reading the sheets independently would refuse the first
     while accepting the second — same file, two answers. */
  function establishFileDateConvention(grids, warn, err) {
    _fileDateConv = null;
    var samples = [];
    Object.keys(grids).forEach(function (k) {
      var g = grids[k];
      if (!g) return;
      for (var r = 0; r < g.length; r++) {
        var row = g[r];
        if (!row) continue;
        for (var c = 0; c < row.length; c++) {
          var v = row[c];
          if (v === null || v === undefined || v instanceof Date) continue;
          if (SLASH_DATE.test(String(v).trim())) samples.push(v);
        }
      }
    });
    if (!samples.length) return true;            // no slash dates: nothing to settle

    var dc = scanDateConvention(samples);
    if (dc.conflict) {
      err('The workbook contains both day-first and month-first dates (' +
          dc.sampleD + ' and ' + dc.sampleM + '). One reading cannot be right for both, so ' +
          'the file is not imported. Ask the sender for ISO dates (YYYY-MM-DD).');
      return false;
    }
    if (dc.ambiguous) {
      err('Dates are written as text like "' + txt(samples[0]) + '" and every value in the ' +
          'workbook is valid read either day-first or month-first, so the order cannot be ' +
          'established from the file. Guessing would silently move amounts by months. Ask the ' +
          'sender for ISO dates (YYYY-MM-DD), or state the convention.');
      return false;
    }
    if (dc.conv) {
      _fileDateConv = dc.conv;
      warn('Dates are text, not dates. Read as ' +
           (dc.conv === 'dmy' ? 'day-first (DD/MM/YYYY)' : 'month-first (MM/DD/YYYY)') +
           ' on the evidence of "' + dc.evidence + '", which is only valid that way round. ' +
           'ISO dates (YYYY-MM-DD) would remove the inference.');
    }
    return true;
  }

  function fromSlash(m, conv) {
    var a = +m[1], b = +m[2], y = +m[3];
    if (y < 100) y += (y < 70 ? 2000 : 1900);
    var d = conv === 'mdy' ? b : a;
    var mo = conv === 'mdy' ? a : b;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  /* Decide day-first vs month-first from the column itself, and say so. A value
     with a first component above 12 can only be day-first; one with a second
     component above 12 can only be month-first. Both present is a corrupt
     column. Neither present is genuinely ambiguous and must be asked, not
     guessed — every date in the file would be plausible either way. */
  function scanDateConvention(values) {
    var dmy = 0, mdy = 0, slash = 0, sampleD = null, sampleM = null;
    values.forEach(function (v) {
      if (v instanceof Date) return;
      var m = SLASH_DATE.exec(String(v === null || v === undefined ? '' : v).trim());
      if (!m) return;
      slash++;
      if (+m[1] > 12) { dmy++; if (!sampleD) sampleD = m[0]; }
      if (+m[2] > 12) { mdy++; if (!sampleM) sampleM = m[0]; }
    });
    if (!slash) return { conv: null, slash: 0 };
    if (dmy && mdy) return { conv: null, slash: slash, conflict: true, sampleD: sampleD, sampleM: sampleM };
    if (dmy) return { conv: 'dmy', slash: slash, evidence: sampleD };
    if (mdy) return { conv: 'mdy', slash: slash, evidence: sampleM };
    return { conv: null, slash: slash, ambiguous: true };
  }

  function txt(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return iso(v);
    return String(v).trim();
  }

  // Label matching: case, spacing and a trailing colon must not matter.
  function norm(v) {
    return txt(v).toLowerCase().replace(/\s+/g, ' ').replace(/\s*:\s*$/, '').trim();
  }

  function dayDiff(a, b) {
    if (!a || !b) return null;
    return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  }

  function slug(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  }

  function cell(grid, r, c) {
    var row = grid[r];
    return row ? (row[c] === undefined ? null : row[c]) : null;
  }

  // A1-style reference, for error messages that name the offending cell.
  function ref(sheet, r, c) {
    var s = '', n = c + 1;
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
    return sheet + '!' + s + (r + 1);
  }

  /* ── lookup tab ───────────────────────────────────────────────────────── */
  /* The workbook carries its own vocabulary. Reading it from the file rather
     than hard-coding it here means PortF can extend the list without a code
     change, and means the error message can quote the values the file itself
     declares — not a list in our source that may have drifted from theirs.   */

  function readLookups(grid, warn) {
    var out = {};
    if (!grid) return out;
    // Header cells are any non-empty cell with values beneath it. The tab has
    // two header bands (facility-level and component-level); both are found.
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < 20; c++) {
        var head = txt(cell(grid, r, c));
        if (!head) continue;
        var vals = [], rr = r + 1;
        while (rr < grid.length) {
          var v = txt(cell(grid, rr, c));
          if (!v) break;
          vals.push(v);
          rr++;
        }
        if (vals.length >= 2) {
          var key = norm(head);
          if (!out[key]) out[key] = { values: [], cells: [], header: head, at: ref('Lookup values', r, c) };
          vals.forEach(function (v, i) {
            if (out[key].values.map(norm).indexOf(norm(v)) === -1) {
              out[key].values.push(v);
              out[key].cells.push(ref('Lookup values', r + 1 + i, c));
            }
          });
        }
      }
    }
    return out;
  }

  /* Known defects in the agreed template, accepted deliberately and reported.
     Neither is silently patched: the import proceeds, and the review screen
     names the cell so the tab gets fixed at source rather than worked around
     here forever. */
  var LOOKUP_REPAIRS = {
    'day count conversion': {
      add: ['ACT/365'],
      why: 'The Day Count list has ACT/360 twice and no ACT/365. ACT/365 is accepted as ' +
           'the intended second value — without it no SONIA or other GBP deal could be ' +
           'imported. Please correct the Lookup values tab.'
    },
    'frequency': {
      alias: { 'montly': 'Monthly' },
      why: 'The Frequency list spells Monthly as "Montly". Both spellings are accepted. ' +
           'Please correct the Lookup values tab.'
    }
  };

  /* Which workbook label is governed by which lookup column. The label and the
     lookup header do not always match — the sheets say "Day Count Convention",
     the lookup tab says "Day Count Conversion". */
  var GOVERNED = {
    'deal structure':                    'deal structure',
    'currency':                          'currency',
    'accounting framework':              'accounting framework',
    'day count convention':              'day count conversion',
    'day count conversion':              'day count conversion',
    'holiday calendar':                  'holiday calendar',
    'repayment type':                    'repayment type',
    'facility type':                     'facility type',
    'interest accrual period (default)': 'interest accrual period (default)',
    'fee types':                         'fee types',
    'base':                              'base',
    'frequency':                         'frequency',
    'aasb':                              'ifrs',
    'ifrs':                              'ifrs',
    'interest type':                     'interest type',
    'accrual frequency':                 'accrual',
    'terms':                             'terms (multi)',
    'settlement type':                   'settlement type'
  };

  // Fields where a blank is as invalid as a wrong value. A defaulted day count
  // mis-states every accrual in the file; a defaulted currency mis-states every
  // amount. The softer fields are allowed to be absent.
  /* Blank blocks the import only where a missing value would change a NUMBER.
     Day count, currency and accounting framework silently mis-state every
     amount in the file if defaulted, so they must be stated. A blank fee Base
     or Frequency is descriptive only — the amounts still come from the
     cashflow table and still post correctly — so those warn instead. That
     distinction is not cosmetic: the agreed template's own tranche-fee blocks
     leave Base blank, and a blanket rule would reject the sample file. */
  var REQUIRED_GOVERNED = {
    'currency': true,
    'accounting framework': true,
    'day count convention': true,
    'day count conversion': true,
    'deal structure': true,
    'interest type': true,
    'settlement type': false,
    'fee types': false,
    'base': false,
    'frequency': false
  };
  // Blank on these is still called out, just not fatal.
  var WARN_IF_BLANK = { 'fee types': true, 'base': true, 'frequency': true, 'holiday calendar': true };

  /* ── validation ───────────────────────────────────────────────────────── */

  function makeValidator(lookups, warn, err) {
    var repairsReported = {};

    /* Some lookup columns exist under more than one spelling across template
       versions — the original tab said "Day Count Conversion", the corrected
       one says "Day Count Convention". Try every known spelling before giving
       up, or a workbook that FIXED the typo is punished for it. */
    var COLUMN_ALIASES = {
      'day count conversion': ['day count conversion', 'day count convention'],
      'day count convention': ['day count convention', 'day count conversion']
    };

    function allowed(key) {
      var candidates = COLUMN_ALIASES[key] || [key];
      var l = null;
      for (var i = 0; i < candidates.length && !l; i++) {
        if (lookups[candidates[i]] && lookups[candidates[i]].values.length) l = lookups[candidates[i]];
      }
      var vals = l ? l.values.slice() : [];
      var rep = LOOKUP_REPAIRS[key];
      /* Only repair a list that EXISTS. Adding to an empty one manufactured a
         whitelist out of nothing: with no matching column the day-count repair
         produced the single value ACT/365, so a file correctly stating ACT/360
         was rejected as invalid — against a list the workbook never contained.
         A missing column is "cannot validate", which the caller already
         reports; it is not a one-item vocabulary. */
      if (rep && rep.add && vals.length) rep.add.forEach(function (v) {
        if (vals.map(norm).indexOf(norm(v)) === -1) vals.push(v);
      });
      return vals;
    }

    /* Returns the canonical value from the lookup tab, or null having recorded
       an error. Canonicalising matters: the file may say "gbp" and the lookup
       "GBP", and everything downstream should see one spelling. */
    return function validate(label, rawValue, where) {
      var key = GOVERNED[norm(label)];
      if (!key) return txt(rawValue);            // not a governed field

      var value = txt(rawValue);
      var list = allowed(key);

      if (!list.length) {
        // No such column on the lookup tab — cannot validate, so say so rather
        // than pretending the value was checked.
        warn(where + ': "' + label + '" cannot be validated — the Lookup values tab has no ' +
             '"' + key + '" column. The value was accepted as given.');
        return value;
      }

      if (!value) {
        if (REQUIRED_GOVERNED[norm(label)]) {
          err(where + ': ' + label + ' is blank. It must be one of: ' + list.join(', ') + '.');
          return null;
        }
        if (WARN_IF_BLANK[norm(label)]) {
          warn(where + ': ' + label + ' is blank. Accepted — it does not affect any amount — but ' +
               'PortF should populate it. Expected one of: ' + list.join(', ') + '.');
        }
        return '';
      }

      // Aliases for known template misspellings.
      var rep = LOOKUP_REPAIRS[key];
      if (rep && rep.alias) {
        var aliased = rep.alias[norm(value)];
        if (aliased) value = aliased;
      }

      var hit = list.filter(function (v) { return norm(v) === norm(value); })[0];
      if (hit === undefined) {
        err(where + ': ' + label + ' is "' + value + '", which is not an accepted value. ' +
            'Must be one of: ' + list.join(', ') + '.');
        return null;
      }

      if (rep && rep.why && !repairsReported[key]) {
        repairsReported[key] = true;
        warn('Lookup values tab: ' + rep.why);
      }
      return hit;                                 // canonical spelling
    };
  }

  /* ── canonical mapping, applied AFTER validation ──────────────────────── */
  /* Validation proves the value is one the workbook declares. These maps turn
     that agreed wording into the internal vocabulary. A value that reaches
     here has already passed the lookup check, so an unmapped one is our gap,
     not the file's, and is reported as such. */

  var FREQ_MAP = {
    'one-off': 'oneOff', 'weekly': 'weekly', 'monthly': 'monthly', 'montly': 'monthly',
    'quarterly': 'quarterly', 'semi': 'semiAnnual', 'semi-annual': 'semiAnnual',
    'semi-annually': 'semiAnnual', 'annual': 'annual', 'annually': 'annual',
    'at maturity': 'atMaturity', 'at maturity (bullet)': 'atMaturity',
    'facility default': ''
  };

  var SETTLE_MAP = {
    'cash': 'cash', 'capitalized': 'capitalised', 'capitalised': 'capitalised', 'pik': 'pik'
  };

  var BASIS_MAP = {
    'principal balance': 'principalBalance',
    'unfunded balance': 'unfundedBalance',
    'principal + capitalised': 'principalPlusCapitalised',
    'principal + capitalized': 'principalPlusCapitalised',
    'unfunded (net of capitalisations)': 'unfundedNetOfCapitalisations',
    'unfunded (net of capitalizations)': 'unfundedNetOfCapitalisations',
    'commitment': 'commitment',
    'funded': 'principalBalance',
    'unfunded': 'unfundedBalance',
    'tranche face': 'faceValue'
  };

  var DAYCOUNT_MAP = {
    'act/360': 'ACT/360', 'act/365': 'ACT/365', 'act/act': 'ACT/ACT',
    '30/360': '30/360', '30e/360': '30E/360'
  };

  function mapOrReport(table, value, what, where, warn) {
    if (!value) return null;
    var hit = table[norm(value)];
    if (hit === undefined) {
      warn(where + ': "' + value + '" is a valid ' + what + ' per the lookup tab, but PCS has no ' +
           'handling for it yet. Imported as-is; it will not drive any calculation.');
      return value;
    }
    return hit;
  }

  /* ── block reading ────────────────────────────────────────────────────── */
  /* A block is a section heading ("Deal Setup") with labels running down its
     own column and values in the columns to its right. One value column for
     the singular blocks; several for components and fees. */

  /* Match a cashflow slot's label to a declared component. The template labels
     the slot "Commitment Fee" while the fee block names it "Commitment", so an
     exact match misses. Compared on the name with a trailing Fee/Interest
     dropped — close enough to join reliably, strict enough not to collide. */
  function matchComponent(list, name) {
    if (!name) return null;
    var strip = function (x) { return norm(x).replace(/\s+(fee|interest)$/, '').trim(); };
    var want = strip(name);
    return list.filter(function (c) { return norm(c.name) === norm(name); })[0] ||
           list.filter(function (c) { return strip(c.name) === want; })[0] || null;
  }

  /* Locate a section heading. Scans the WHOLE sheet by default.

     It used to stop after `maxRow || 12` rows and every caller passed 14, which
     silently broke the moment a block above grew. "Facility Setup" sits at row
     index 14 in the current template — one row past the window — so the entire
     block was invisible: facility name blank, Total Commitment 0, Availability
     End blank, and Day Count / Holiday / Repayment / Facility Type / Accrual
     all falling through to their DEFAULTS. Day count silently became ACT/365
     on a template that said ACT/360, which moves every interest figure.

     Nothing was wrong with the file, and nothing reported an error, because a
     missing optional block looks exactly like a block that is not there. The
     row cap bought nothing — a heading match is unambiguous — so it is gone.
     `maxRow` is still honoured when a caller genuinely wants a bounded scan. */
  function findSection(grid, headingText, maxRow) {
    var want = norm(headingText);
    var limit = maxRow ? Math.min(grid.length, maxRow) : grid.length;
    for (var r = 0; r < limit; r++) {
      for (var c = 0; c < 24; c++) {
        if (norm(cell(grid, r, c)) === want) return { row: r, col: c };
      }
    }
    return null;
  }

  /* Reads a block into { labelKey: {value, row, col} }, for `width` value
     columns. Stops at the first fully blank label row after at least one hit,
     so a block never bleeds into whatever sits below it. */
  function readBlock(grid, at, width, maxRows) {
    if (!at) return null;
    var fields = {}, blanks = 0;
    for (var r = at.row + 1; r < Math.min(grid.length, at.row + (maxRows || 24)); r++) {
      var label = txt(cell(grid, r, at.col));
      if (!label) { if (++blanks >= 3) break; continue; }
      blanks = 0;
      var vals = [];
      for (var i = 0; i < width; i++) vals.push(cell(grid, r, at.col + 1 + i));
      fields[norm(label)] = { label: label, values: vals, row: r, col: at.col };
    }
    return fields;
  }

  // How many value columns does a multi-column block have? Counted from its
  // first populated label row, so an empty trailing "Component N" placeholder
  // column is not mistaken for a real component.
  function blockWidth(grid, at, nameLabels) {
    if (!at) return 0;
    var nameRow = -1;
    for (var r = at.row + 1; r < Math.min(grid.length, at.row + 12) && nameRow < 0; r++) {
      var l = norm(cell(grid, r, at.col));
      if (nameLabels.indexOf(l) !== -1) nameRow = r;
    }
    if (nameRow < 0) return 0;
    var n = 0;
    for (var c = at.col + 1; c < at.col + 60; c++) {
      if (!txt(cell(grid, nameRow, c))) break;
      n++;
    }
    return n;
  }

  function fieldAt(fields, names, idx) {
    if (!fields) return null;
    for (var i = 0; i < names.length; i++) {
      var f = fields[norm(names[i])];
      if (f) return { raw: f.values[idx || 0], label: f.label, row: f.row, col: f.col + 1 + (idx || 0) };
    }
    return null;
  }

  /* ── cashflow table ───────────────────────────────────────────────────── */

  // Section boundaries, identified by their running-total column.
  var SECTION_TOTALS = [
    { match: /^total accrued pik interest$/, postingType: 'interest', settlementType: 'pik' },
    { match: /^total accrued pik fee$/,      postingType: 'fee',      settlementType: 'pik' },
    { match: /^total cash interest$/,        postingType: 'interest', settlementType: 'cash' },
    { match: /^total cash fee$/,             postingType: 'fee',      settlementType: 'cash' }
  ];
  var FLAT_FEE = { 'flat pik fee': 'pik', 'flat cash fee': 'cash' };

  function findCashflowHeader(grid) {
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < 6; c++) {
        if (norm(cell(grid, r, c)) === 'date' &&
            /initial purchase/.test(norm(cell(grid, r, c + 1)))) return { row: r, col: c };
      }
    }
    return null;
  }

  function readCashflows(grid, ctx, warn, err, sheet, meta) {
    var rows = [];
    var hdr = findCashflowHeader(grid);
    if (!hdr) { warn(sheet + ': no cashflow table found.'); return rows; }

    var HR = hdr.row, C0 = hdr.col;
    var header = [];
    for (var c = 0; c < 80; c++) header[c] = norm(cell(grid, HR, c));

    // Movement + balance columns, by label rather than offset.
    var col = {};
    header.forEach(function (h, i) {
      if (h === 'date') col.date = i;
      else if (h === 'initial purchase') col.initialPurchase = i;
      else if (h === 'drawdown') col.drawdown = i;
      else if (h === 'principal payment') col.principalPayment = i;
      else if (h === 'drawdown scope') col.scope = i;
      else if (h === 'principal balance' && col.principalBalance === undefined) col.principalBalance = i;
      else if (h === 'unfunded balance' && col.unfundedBalance === undefined) col.unfundedBalance = i;
      else if (/^principal \+ capitalis?zed$|^principal \+ capitalised$/.test(h) && col.principalPlusCap === undefined) col.principalPlusCap = i;
      else if (/^unfunded \(net of capitalis|^unfunded \(net of capitaliz/.test(h) && col.unfundedNet === undefined) col.unfundedNet = i;
    });

    /* Walk left to right accumulating Rate/Amount pairs, and assign them to a
       section when its running-total column appears. Deriving the section from
       the totals rather than from the (optional) banner row above means it
       works on both sheet types — the facility sheet has no banner row. */
    var pending = [], groups = [], flats = [];
    for (var i = C0; i < header.length; i++) {
      var h = header[i];
      if (!h) continue;

      if (h === 'rate') {
        if (header[i + 1] !== 'amount') {
          err(ref(sheet, HR, i) + ': a "Rate" column must be followed immediately by "Amount".');
          continue;
        }
        var basisRaw = txt(cell(grid, HR - 1, i));
        pending.push({ rateCol: i, amountCol: i + 1, basisRaw: basisRaw });
        i++;                                        // skip the Amount column
        continue;
      }

      if (FLAT_FEE[h] !== undefined) { flats.push({ col: i, settlementType: FLAT_FEE[h], label: txt(cell(grid, HR, i)) }); continue; }

      var sec = SECTION_TOTALS.filter(function (s) { return s.match.test(h); })[0];
      if (sec) {
        pending.forEach(function (p) {
          groups.push({
            rateCol: p.rateCol, amountCol: p.amountCol, basisRaw: p.basisRaw,
            postingType: sec.postingType, settlementType: sec.settlementType
          });
        });
        // A flat-fee column belongs to the section whose total follows it.
        flats.forEach(function (f) {
          if (f.settlementType === sec.settlementType && sec.postingType === 'fee') f.postingType = 'fee';
        });
        pending = [];
      }
    }
    if (pending.length) {
      warn(sheet + ': ' + pending.length + ' Rate/Amount pair(s) sit after the last section total and ' +
           'cannot be attributed to PIK or cash. They are skipped.');
    }
    if (!groups.length) { warn(sheet + ': cashflow table has no Rate/Amount groups.'); return rows; }

    meta.groups = groups.length;

    /* The basis label doubles as the component name: where a component or fee
       actually occupies a slot, the template overwrites the basis wording with
       its name ("20 Year Fixed", "Commitment Fee"). So an unrecognised label is
       not an error — it identifies the component. */
    /* Each section holds four pairs, one per balance basis, in a fixed order.
       Where a component actually occupies a slot the template OVERWRITES the
       basis wording with the component's name ("20 Year Fixed"), so an
       unrecognised label identifies the component — and the basis is then
       recovered from the slot's position rather than lost. Without this the
       balance is null, and with it every days-covered check that depends on
       the balance. */
    var SLOT_BASIS = ['principalBalance', 'unfundedBalance',
                      'principalPlusCapitalised', 'unfundedNetOfCapitalisations'];
    var slotOf = {};
    groups.forEach(function (g) {
      var sec = g.postingType + '/' + g.settlementType;
      slotOf[sec] = (slotOf[sec] === undefined) ? 0 : slotOf[sec] + 1;
      g.slot = slotOf[sec];

      var mapped = BASIS_MAP[norm(g.basisRaw)];
      if (mapped) { g.basis = mapped; g.componentName = null; }
      else {
        g.basis = SLOT_BASIS[g.slot] || null;
        g.componentName = g.basisRaw || null;
        // A single pair labelled with two component names cannot be split: the
        // workbook never says how the amount divides. Imported combined and
        // flagged, never apportioned by guesswork.
        if (g.componentName && /,/.test(g.componentName)) {
          g.combinedNames = g.componentName.split(/\s*,\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
          g.combined = true;
        }
      }
      g.componentId = ctx.componentIdFor(g);
    });

    var combined = groups.filter(function (g) { return g.combined; });
    if (combined.length) {
      warn(sheet + ': ' + combined.length + ' Rate/Amount pair(s) cover more than one component (' +
           combined[0].combinedNames.join(' + ') + '). The workbook does not say how the amount splits ' +
           'between them, so it is imported as one combined line. Per-component reporting needs a ' +
           'separate pair for each.');
    }

    var den = /360/.test(ctx.dayCountConvention || '') ? 360 : 365;
    var raw = [];

    for (var r = HR + 1; r < grid.length; r++) {
      var d = iso(cell(grid, r, col.date));
      if (!d) continue;
      var scopeRaw = col.scope !== undefined ? txt(cell(grid, r, col.scope)) : '';
      var lot = lotIdFromScope(scopeRaw);
      var balances = {
        principalBalance:            col.principalBalance !== undefined ? num(cell(grid, r, col.principalBalance)) : null,
        unfundedBalance:             col.unfundedBalance  !== undefined ? num(cell(grid, r, col.unfundedBalance))  : null,
        principalPlusCapitalised:    col.principalPlusCap !== undefined ? num(cell(grid, r, col.principalPlusCap)) : null,
        unfundedNetOfCapitalisations:col.unfundedNet      !== undefined ? num(cell(grid, r, col.unfundedNet))      : null
      };

      groups.forEach(function (g, gi) {
        var amt = num(cell(grid, r, g.amountCol));
        var rt  = num(cell(grid, r, g.rateCol));
        if (!amt && !rt) return;                     // nothing posted on this line
        if (rt !== null && rt > 1) {
          err(ref(sheet, r, g.rateCol) + ': rate ' + rt + ' must be a decimal, not a percentage.');
        }
        var bal = g.basis ? balances[g.basis] : null;
        raw.push({
          rowNo: r + 1, seriesKey: gi + '|' + (lot || ''),
          date: d,
          externalTrancheId: ctx.externalTrancheId || null,
          externalComponentId: g.componentId,
          componentNames: g.combinedNames || (g.componentName ? [g.componentName] : []),
          combined: !!g.combined,
          postingType: g.postingType,
          settlementType: g.settlementType,
          balanceBasis: g.basis || null,
          drawdownLotId: lot,
          drawdownScopeText: scopeRaw || null,
          basisBalance: bal,
          rate: rt,
          amount: amt === null ? 0 : amt,
          impliedDays: (bal && rt && amt) ? (amt * den) / (bal * rt) : null,
          cashSettled: g.settlementType === 'cash' ? (amt || 0) : 0
        });
      });

      flats.forEach(function (f, fi) {
        var amt = num(cell(grid, r, f.col));
        if (!amt) return;
        raw.push({
          rowNo: r + 1, seriesKey: 'flat' + fi + '|' + (lot || ''),
          date: d,
          externalTrancheId: ctx.externalTrancheId || null,
          externalComponentId: ctx.flatFeeId(f.settlementType),
          componentNames: [f.label],
          postingType: 'fee',
          settlementType: f.settlementType,
          balanceBasis: null,
          drawdownLotId: lot,
          drawdownScopeText: scopeRaw || null,
          basisBalance: null,
          rate: null,
          amount: amt,
          impliedDays: null,
          isFlat: true,
          cashSettled: f.settlementType === 'cash' ? amt : 0
        });
      });
    }

    deriveDaysCovered(raw, ctx, warn, sheet, meta);
    raw.forEach(function (x) { delete x.seriesKey; rows.push(x); });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return rows;
  }

  /* daysCovered is not stated in the workbook and the two sheet types do not
     agree on what the row date means — on tranche sheets it is the period
     start, on the facility sheet the period end. Rather than assume, both
     readings are scored against the days the figures themselves imply and the
     better fit wins. The residual is reported, never smoothed away. */
  function deriveDaysCovered(raw, ctx, warn, sheet, meta) {
    var bySeries = {};
    raw.forEach(function (x) { (bySeries[x.seriesKey] = bySeries[x.seriesKey] || []).push(x); });
    Object.keys(bySeries).forEach(function (k) {
      bySeries[k].sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    });

    function gapAt(list, i, mode) {
      var j;
      if (mode === 'start') {
        for (j = i + 1; j < list.length; j++) if (list[j].date !== list[i].date) return dayDiff(list[i].date, list[j].date);
        return null;
      }
      for (j = i - 1; j >= 0; j--) if (list[j].date !== list[i].date) return dayDiff(list[j].date, list[i].date);
      return ctx.loanStartDate ? dayDiff(ctx.loanStartDate, list[i].date) : null;
    }

    function score(mode) {
      var total = 0, n = 0;
      Object.keys(bySeries).forEach(function (k) {
        bySeries[k].forEach(function (x, i) {
          if (!x.impliedDays) return;
          var d = gapAt(bySeries[k], i, mode);
          if (d === null || d <= 0) return;
          total += Math.abs(d - x.impliedDays) / x.impliedDays; n++;
        });
      });
      return n ? { err: total / n, n: n } : { err: Infinity, n: 0 };
    }

    var sStart = score('start'), sEnd = score('end');
    var mode = sEnd.err < sStart.err ? 'end' : 'start';
    meta.dateConvention = mode === 'start' ? 'rowDateIsPeriodStart' : 'rowDateIsPeriodEnd';
    meta.conventionScored = (mode === 'start' ? sStart.n : sEnd.n);

    if (sStart.n || sEnd.n) {
      warn(sheet + ': days covered is not stated in the file. Read as "' + meta.dateConvention +
           '" — it fits the stated amounts better than the alternative (' +
           (+(Math.min(sStart.err, sEnd.err) * 100)).toFixed(2) + '% mean error vs ' +
           (+(Math.max(sStart.err, sEnd.err) * 100)).toFixed(2) + '%).');
    }

    var offBy = 0, worst = 0, worstRow = null, residuals = [];
    Object.keys(bySeries).forEach(function (k) {
      bySeries[k].forEach(function (x, i) {
        var d = gapAt(bySeries[k], i, mode);
        x.daysCovered = (d !== null && d > 0) ? d : null;
        x.daysCoveredSource = x.daysCovered === null ? null : mode;
        if (x.daysCovered && x.impliedDays) {
          x.daysCoveredResidualPct = +(((x.daysCovered - x.impliedDays) / x.impliedDays) * 100).toFixed(3);
          if (Math.abs(x.daysCoveredResidualPct) > 0.5) {
            offBy++; residuals.push(x.daysCoveredResidualPct);
            if (Math.abs(x.daysCoveredResidualPct) > Math.abs(worst)) { worst = x.daysCoveredResidualPct; worstRow = x; }
          }
        }
      });
    });

    if (offBy) {
      var spread = residuals.length ? Math.max.apply(null, residuals) - Math.min.apply(null, residuals) : 0;
      if (residuals.length > 2 && spread < 0.05) {
        var implied = worstRow && worstRow.rate ? worstRow.rate / (1 + worst / 100) : null;
        meta.ratePrecisionSuspect = true;
        warn(sheet + ': every affected row is off the calendar by the same ' + worst.toFixed(2) + '%, the ' +
             'signature of a rate rounded for display rather than a wrong period. The stated rate ' +
             (worstRow ? worstRow.rate : '?') + ' looks like ' + (implied ? implied.toFixed(8) : 'a longer decimal') +
             ' rounded. Amounts are used as given, so the accounting is unaffected.');
      } else {
        warn(sheet + ': ' + offBy + ' row(s) do not reconcile to the calendar — the stated amount implies a ' +
             'different period length than the dates do (worst: row ' + (worstRow ? worstRow.rowNo : '?') +
             ', off by ' + worst.toFixed(2) + '%). Amounts post as given; days covered on screen is our inference.');
      }
    }
  }

  /* Drawdown lots. Accrual rows identify their lot in prose; event rows carry
     only an amount and a date. Deriving the id from (date, amount) in both
     places is what lets the two join up. */
  function lotId(date, amount) {
    if (!date || !amount) return null;
    return 'LOT-' + date + '-' + Math.round(Math.abs(amount));
  }
  function lotIdFromScope(scopeRaw) {
    if (!scopeRaw) return null;
    var amt = /[£$€]?\s*([\d,]+(?:\.\d+)?)/.exec(scopeRaw);
    var dt  = /(\d{4}-\d{2}-\d{2})/.exec(scopeRaw);
    if (amt && dt) return lotId(dt[1], num(amt[1]));
    return slug(scopeRaw).slice(0, 40);
  }

  /* ── events ───────────────────────────────────────────────────────────── */

  function readEvents(grid, ctx, sheet) {
    var events = [];
    var hdr = findCashflowHeader(grid);
    if (!hdr) return events;
    var header = [];
    for (var c = 0; c < 80; c++) header[c] = norm(cell(grid, hdr.row, c));

    var map = [
      { h: 'initial purchase',   type: 'initialPurchase' },
      { h: 'drawdown',           type: 'drawdown' },
      { h: 'principal payment',  type: 'principalPayment' }
    ];
    var cols = [];
    header.forEach(function (h, i) {
      map.forEach(function (m) { if (h === m.h) cols.push({ col: i, type: m.type }); });
    });
    if (!cols.length) return events;

    var scopeCol = header.indexOf('drawdown scope');
    var n = 0;
    for (var r = hdr.row + 1; r < grid.length; r++) {
      var d = iso(cell(grid, r, hdr.col));
      if (!d) continue;
      cols.forEach(function (cd) {
        var amt = num(cell(grid, r, cd.col));
        if (!amt) return;                             // 0 and blank are not events
        var scopeRaw = scopeCol >= 0 ? txt(cell(grid, r, scopeCol)) : '';
        events.push({
          externalEventId: ctx.externalDealId + '-' + (ctx.trancheKey || 'FAC') + '-E' + (++n),
          externalTrancheId: ctx.externalTrancheId || null,
          eventType: cd.type,
          eventDate: d,
          amount: amt,
          drawdownLotId: lotIdFromScope(scopeRaw) || lotId(d, amt),
          sourceRow: r + 1
        });
      });
    }
    return events;
  }

  /* ── warning rollup ───────────────────────────────────────────────────── */
  /* Fifty tranche sheets means fifty copies of every per-sheet warning, and a
     review screen of 200 near-identical lines is one nobody reads. */
  function rollUp(list) {
    var groups = [], index = {};
    list.forEach(function (w) {
      var m = /^([^:]{1,60}):\s([\s\S]+)$/.exec(w);
      var sheet = m ? m[1] : null;
      var body  = m ? m[2] : w;
      var key = body.replace(/\b\d[\d,.]*\b/g, '#');
      if (!index[key]) { index[key] = { sheets: [], body: body }; groups.push(index[key]); }
      if (sheet) index[key].sheets.push(sheet);
    });
    return groups.map(function (g) {
      if (!g.sheets.length) return g.body;
      if (g.sheets.length === 1) return g.sheets[0] + ': ' + g.body;
      var shown = g.sheets.slice(0, 4).join(', ') + (g.sheets.length > 4 ? ' and ' + (g.sheets.length - 4) + ' more' : '');
      return g.sheets.length + ' sheets (' + shown + '): ' + g.body;
    });
  }

  /* ── main ─────────────────────────────────────────────────────────────── */

  /* ═══════════════════════════════════════════════════════════════════════
     v0.4 — flat amounts
     ─────────────────────────────────────────────────────────────────────────
     v0.3 asked PortF for the balance and the rate beside every amount.
     Checking against those only verifies their arithmetic: accept their
     balance and their rate and `balance x rate x days` must reproduce their
     amount by construction.

     v0.4 takes amounts and movements. PCS derives the balance from the
     movements and the rate from the terms, computes the amount itself, and
     compares. That is an independent recalculation.

     The two shapes coexist: a workbook is v0.4 if it has Cashflows and
     Components sheets, otherwise it is read as v0.3. Loan info is identical in
     both, so everything above the cashflow read is shared.
     ═══════════════════════════════════════════════════════════════════════ */

  /* ── legacy payment list ────────────────────────────────────────────────
     `Date | Drawdown | Interest Payment | Commitment Fee | ...` — one column
     per category, an amount in the cell, and nothing else. No balance, no
     rate, no period. Movement columns become events; the rest become
     cashflow rows marked `unverified`.

     This is deliberately NOT a guess at a schedule. It records what the sender
     said was paid, on the date they said it, and declines to invent the
     working behind it. */
  var PAYMENT_MOVEMENT = {
    'drawdown': 'drawdown', 'initial purchase': 'initialPurchase',
    'principal payment': 'principalPayment', 'principal repayment': 'principalPayment',
    'pik capitalised': 'capitalisation', 'pik capitalized': 'capitalisation'
  };

  function readPaymentList(grid, ctx, warn, err, sheet) {
    var hdrRow = -1, dateCol = -1;
    for (var r = 0; r < grid.length && hdrRow < 0; r++) {
      for (var c = 0; c < 6; c++) {
        if (norm(cell(grid, r, c)) === 'date') {
          // a real payment list has at least two amount columns beside Date
          var amountCols = 0;
          for (var cc = c + 1; cc < c + 25; cc++) if (txt(cell(grid, r, cc))) amountCols++;
          if (amountCols >= 2) { hdrRow = r; dateCol = c; }
          break;
        }
      }
    }
    if (hdrRow < 0) return [];

    var cats = [];
    for (var c2 = dateCol + 1; c2 < dateCol + 25; c2++) {
      var label = txt(cell(grid, hdrRow, c2));
      if (!label) continue;
      cats.push({ col: c2, label: label, movement: PAYMENT_MOVEMENT[norm(label)] || null });
    }
    if (!cats.length) return [];

    /* Establish the date convention from the whole column before reading a
       single row, and say which reading was taken and on what evidence. */
    var samples = [];
    for (var sr = hdrRow + 1; sr < grid.length; sr++) samples.push(cell(grid, sr, dateCol));
    var dc = scanDateConvention(samples);
    if (dc.conflict) {
      err(sheet + ': the date column contains both day-first and month-first values (' +
          dc.sampleD + ' and ' + dc.sampleM + '). One reading cannot be right for both, so the ' +
          'sheet is not imported. Ask the sender for ISO dates (YYYY-MM-DD).');
      return [];
    }
    if (dc.ambiguous) {
      err(sheet + ': dates are written as text like "' + txt(samples.filter(function (s) { return s; })[0]) +
          '" and every value is valid read either day-first or month-first, so the order cannot be ' +
          'established from the file. Guessing would silently move payments by months. Ask the sender ' +
          'for ISO dates (YYYY-MM-DD), or state the convention.');
      return [];
    }
    if (dc.conv) {
      warn(sheet + ': dates are text, not dates. Read as ' +
           (dc.conv === 'dmy' ? 'day-first (DD/MM/YYYY)' : 'month-first (MM/DD/YYYY)') +
           ' on the evidence of "' + dc.evidence + '", which is only valid that way round. ' +
           'ISO dates (YYYY-MM-DD) would remove the inference.');
    }

    var rows = [], unmatched = {}, badDates = 0;
    for (var rr = hdrRow + 1; rr < grid.length; rr++) {
      var rawD = cell(grid, rr, dateCol);
      var d = iso(rawD, dc.conv);
      if (!d) {
        // Only count rows that carry an amount — trailing blanks are not losses.
        var hasAmt = cats.some(function (cat) { return num(cell(grid, rr, cat.col)); });
        if (hasAmt) badDates++;
        continue;
      }
      cats.forEach(function (cat) {
        if (cat.movement) return;                  // movements handled as events
        var amt = num(cell(grid, rr, cat.col));
        if (!amt) return;
        var hit = matchComponent(ctx.declared, cat.label);
        if (!hit) unmatched[cat.label] = (unmatched[cat.label] || 0) + 1;
        var posting = hit ? hit.postingType : (/fee/i.test(cat.label) ? 'fee' : 'interest');
        var settle = (hit && hit.settlementType) ? hit.settlementType : 'cash';
        rows.push({
          rowNo: rr + 1,
          date: d, periodStart: null, periodEnd: null,
          daysCovered: null, daysCoveredStated: false,
          externalTrancheId: ctx.externalTrancheId || null,
          externalComponentId: hit ? hit.externalComponentId
                                   : ctx.externalDealId + '-' + ctx.trancheKey + '-' + slug(cat.label),
          componentNames: [cat.label],
          combined: false,
          postingType: posting,
          settlementType: settle,
          balanceBasis: null,
          drawdownLotId: null, drawdownScopeText: null,
          basisBalance: null, rate: null,
          amount: amt, impliedDays: null,
          isFlat: false,
          verificationStatus: 'unverified',
          cashSettled: settle === 'cash' ? amt : 0
        });
      });
    }

    if (badDates) {
      err(sheet + ': ' + badDates + ' row(s) carry an amount but a date that cannot be read. ' +
          'They are not imported, and dropping money silently is not acceptable — fix the dates ' +
          'or the whole sheet will keep being wrong by exactly those rows.');
    }
    if (rows.length) {
      warn(sheet + ': read as a payment list — ' + rows.length + ' amount(s) with no balance, rate or ' +
           'period. They import and post, but none of them can be checked against a PCS calculation. ' +
           'Ask the sender to export the full schedule.');
    }
    Object.keys(unmatched).forEach(function (l) {
      warn(sheet + ': payment column "' + l + '" does not match any declared interest component or fee, ' +
           'so its ' + unmatched[l] + ' amount(s) cannot be reported against one.');
    });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return rows;
  }

  function detectV04(grids) {
    var out = {};
    Object.keys(grids).forEach(function (k) {
      var n = norm(k).replace(/\s+/g, '');
      if (/^cashflow/.test(n))        out.cashflows   = k;
      else if (/^component/.test(n))  out.components  = k;
      else if (/^movement/.test(n))   out.movements   = k;
      else if (/^balancecheck/.test(n)) out.checkpoints = k;
      else if (/^tranches$/.test(n))  out.tranches    = k;
    });
    return (out.cashflows && out.components) ? out : null;
  }

  /* Locate a header row by looking for the first row containing at least two
     of the expected labels, then read every row beneath it. Header position is
     not assumed: these sheets carry explanatory notes above the table, and the
     number of note lines will differ between senders. */
  function readTable(grid, expect, sheet, warn) {
    if (!grid) return { rows: [], col: {}, headerRow: -1 };
    var want = expect.map(norm);
    for (var r = 0; r < Math.min(grid.length, 40); r++) {
      var hits = 0, col = {};
      for (var c = 0; c < 40; c++) {
        var h = norm(cell(grid, r, c));
        if (!h) continue;
        var i = want.indexOf(h);
        if (i >= 0) { col[expect[i]] = c; hits++; }
      }
      if (hits >= 2) {
        var rows = [];
        for (var rr = r + 1; rr < grid.length; rr++) {
          var any = false;
          for (var cc = 0; cc < 40; cc++) { if (cell(grid, rr, cc) !== null && cell(grid, rr, cc) !== '') { any = true; break; } }
          if (any) rows.push(rr);
        }
        return { rows: rows, col: col, headerRow: r };
      }
    }
    warn(sheet + ': no header row found. Expected columns such as "' + expect.slice(0, 3).join('", "') + '".');
    return { rows: [], col: {}, headerRow: -1 };
  }

  function gv(grid, r, col, name) {
    return (col[name] === undefined) ? null : cell(grid, r, col[name]);
  }

  /* Verification status — what the FILE supports, not what the app happens to
     hold today. Missing SONIA fixings make a row uncheckable at compare time,
     but that is our gap, not the sender's, and conflating the two would make
     this column useless for telling PortF what to fix. */
  function classifyRow(row, comp) {
    if (row.isFlat) return 'flat';
    if (comp && comp.isFlatFee) return 'flat';
    if (!row.periodStart || !row.periodEnd) return 'unverified';
    var hasRateTerms = !!(comp && (comp.baseValue !== null && comp.baseValue !== undefined && comp.baseValue !== '' ||
                                   (comp.interestType && comp.interestType !== 'FIXED')));
    return hasRateTerms ? 'full' : 'unverified';
  }

  function readTranchesV04(grids, key, externalDealId, warn) {
    var grid = grids[key];
    if (!grid) return [];
    var t = readTable(grid, ['Tranche ID', 'Tranche GUID', 'Tranche Name', 'Currency', 'Face Value', 'Commitment',
                             /* v0.5 — effective-interest inputs. */
                             'Consideration Paid', 'Consideration Date', 'Transaction Costs',
                             'Expected Redemption Date', 'Credit Impaired at Acquisition'], key, warn);
    var out = [];
    t.rows.forEach(function (r) {
      var id = txt(gv(grid, r, t.col, 'Tranche ID'));
      var nm = txt(gv(grid, r, t.col, 'Tranche Name'));
      if (!id && !nm) return;
      var face  = num(gv(grid, r, t.col, 'Face Value'));
      /* Every v0.5 field stays null when the cell is blank. Defaulting
         consideration to face would assert "acquired at par" — a specific and
         consequential claim — on a file that said nothing, and the resulting
         yield would look as settled as one we were actually told. Same for
         costs: a stated 0 and an unstated cost are different answers. */
      var consid = num(gv(grid, r, t.col, 'Consideration Paid'));
      var costs  = num(gv(grid, r, t.col, 'Transaction Costs'));
      var poci   = yesNo(gv(grid, r, t.col, 'Credit Impaired at Acquisition'));

      if (consid !== null && face && consid > 0) {
        /* A price wildly away from face is almost always a units error — a
           figure entered in thousands against a face in units, say. Worth a
           word before it becomes a yield nobody can explain. */
        var pxPct = consid / face * 100;
        if (pxPct < 20 || pxPct > 180) {
          warn(key + ': tranche "' + (nm || id) + '" has Consideration Paid at ' +
               pxPct.toFixed(1) + '% of Face Value. Check the units — this is well ' +
               'outside the range a price normally takes.');
        }
      }

      out.push({
        externalTrancheId: externalDealId + '-' + slug(id || nm),
        sourceKey: id || nm,
        externalTrancheGuid: txt(gv(grid, r, t.col, 'Tranche GUID')) || null,
        name: nm || id,
        currency: txt(gv(grid, r, t.col, 'Currency')) || null,
        face: face,
        commitment: num(gv(grid, r, t.col, 'Commitment')),
        // ─── v0.5 ───
        considerationPaid: consid,
        considerationDate: iso(gv(grid, r, t.col, 'Consideration Date')),
        transactionCosts: costs,
        expectedRedemptionDate: iso(gv(grid, r, t.col, 'Expected Redemption Date')),
        creditImpairedAtAcquisition: poci,
        startDate: null, initialDrawdown: null
      });
    });
    return out;
  }

  /* Yes / No, kept tri-state. Returns true, false, or null for "not stated" —
     because on the POCI question in particular, an unanswered cell must not be
     read as "No". The whole point of asking is that the two are different. */
  function yesNo(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'boolean') return v;
    var s = norm(v);
    if (/^(y|yes|true|1)$/.test(s)) return true;
    if (/^(n|no|false|0)$/.test(s)) return false;
    return null;
  }

  /* A compounding convention expressed as a number of business days.
     Accepts 5, "5", "5 days", "5 business days", "5BD". Returns null for an
     empty cell and for anything with no number in it ("n/a", "none", "TBC") —
     null means "not stated", which is NOT the same as 0. Zero is a real
     convention (no lookback at all); the distinction is the whole point, so a
     cell reading "0" returns 0 and an empty one returns null. */
  function conventionDays(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? Math.round(v) : null;
    var m = String(v).match(/-?\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  function readComponentsV04(grids, key, externalDealId, trancheBySource, validate, warn, err) {
    var grid = grids[key];
    if (!grid) return [];
    var cols = ['Component ID', 'Tranche ID', 'Name', 'Posting Type', 'Settlement Type', 'Interest Type',
                'Base Value', 'Terms', 'Accrual Frequency', 'Balance Basis', 'Lookback', 'Lockout',
                'Obs Shift', 'First Settlement Date', 'Fee Types',
                /* v0.5 — is this fee part of the yield, or payment for a service? */
                'Yield Integral'];
    var t = readTable(grid, cols, key, warn);
    var out = [];
    t.rows.forEach(function (r) {
      var id = txt(gv(grid, r, t.col, 'Component ID'));
      var nm = txt(gv(grid, r, t.col, 'Name'));
      if (!id && !nm) return;
      var trSrc = txt(gv(grid, r, t.col, 'Tranche ID'));
      var tr = trSrc ? trancheBySource[trSrc] : null;
      if (trSrc && !tr) {
        err(key + ': component "' + (nm || id) + '" names tranche "' + trSrc +
            '", which is not on the Tranches sheet.');
      }
      var posting = (norm(gv(grid, r, t.col, 'Posting Type')) || 'interest');
      var isFee   = /fee/.test(posting);
      /* Whether this fee forms part of the lender's return (and belongs inside
         the effective interest rate) or is payment for a service (and is
         recognised as that service is performed). Tri-state: null means the
         file did not say, and PCS must not decide it from the fee's name —
         "arrangement and agency fee" is genuinely ambiguous, and an inference
         that moves the reported yield should never be silent. */
      var yieldIntegral = yesNo(gv(grid, r, t.col, 'Yield Integral'));
      if (isFee && yieldIntegral === null) {
        warn(key + ': fee "' + (txt(gv(grid, r, t.col, 'Name')) || txt(gv(grid, r, t.col, 'Component ID'))) +
             '" does not state Yield Integral. PCS cannot tell whether it forms part of the ' +
             'yield or is payment for a service, so it will be recorded but kept out of the ' +
             'effective interest rate.');
      }
      var settleRaw = txt(gv(grid, r, t.col, 'Settlement Type'));
      var base = num(gv(grid, r, t.col, 'Base Value'));
      var itype = txt(gv(grid, r, t.col, 'Interest Type'));
      var floating = !!(itype && norm(itype) !== 'fixed');
      /* A compounded RFR cannot be reproduced without these three. Saying so
         per component is far more actionable than one warning per file. */
      if (floating) {
        /* Judged on the parsed value, not the raw text: "n/a" and "TBC" are
           cells someone filled in, but they state nothing. A literal 0 does
           state something and is not flagged. */
        var lb = conventionDays(gv(grid, r, t.col, 'Lookback')),
            lo = conventionDays(gv(grid, r, t.col, 'Lockout')),
            os = conventionDays(gv(grid, r, t.col, 'Obs Shift'));
        if (lb === null || lo === null || os === null) {
          warn(key + ': component "' + (nm || id) + '" is ' + itype + ' but does not state ' +
               'lookback / lockout / observation shift. A compounded rate cannot be reproduced ' +
               'without them, so its amounts can be recorded but not checked.');
        }
      }
      out.push({
        externalComponentId: externalDealId + '-' + slug(id || nm),
        sourceKey: id || nm,
        externalTrancheId: tr ? tr.externalTrancheId : null,
        scope: tr ? 'tranche' : 'facility',
        name: nm || id,
        postingType: isFee ? 'fee' : 'interest',
        yieldIntegral: yieldIntegral,
        settlementType: settleRaw ? (SETTLE_MAP[norm(settleRaw)] || norm(settleRaw)) : 'cash',
        interestType: itype || null,
        baseValue: base,
        isFlatFee: (/fee/.test(posting) && (base === null || base === undefined)),
        terms: txt(gv(grid, r, t.col, 'Terms')) || null,
        accrualFrequency: mapOrReport(FREQ_MAP, txt(gv(grid, r, t.col, 'Accrual Frequency')), 'accrual', key, warn),
        calculationBasis: mapOrReport(BASIS_MAP, txt(gv(grid, r, t.col, 'Balance Basis')), 'balance basis', key, warn),
        feeType: txt(gv(grid, r, t.col, 'Fee Types')) || null,
        /* Raw text kept for the audit trail; the *Days fields below are what
           the Builder and the engine actually consume. Until now only the raw
           strings existed under these names, while the mapper looked for
           lookbackDays / lockoutDays / observationShift — so every stated
           convention was read, discarded, and silently replaced by zero. */
        lookback: txt(gv(grid, r, t.col, 'Lookback')) || null,
        lockout: txt(gv(grid, r, t.col, 'Lockout')) || null,
        obsShift: txt(gv(grid, r, t.col, 'Obs Shift')) || null,
        lookbackDays:     conventionDays(gv(grid, r, t.col, 'Lookback')),
        lockoutDays:      conventionDays(gv(grid, r, t.col, 'Lockout')),
        observationShift: conventionDays(gv(grid, r, t.col, 'Obs Shift')),
        firstSettlementDate: iso(gv(grid, r, t.col, 'First Settlement Date')),
        rate: base
      });
    });
    return out;
  }

  var MOVEMENT_MAP = {
    'initial purchase': 'initialPurchase', 'drawdown': 'drawdown',
    'principal payment': 'principalPayment', 'principal repayment': 'principalPayment',
    'pik capitalisation': 'capitalisation', 'pik capitalization': 'capitalisation'
  };

  function readMovementsV04(grids, key, externalDealId, trancheBySource, warn, err) {
    var grid = grids[key];
    if (!grid) return [];
    var t = readTable(grid, ['Date', 'Tranche ID', 'Movement Type', 'Amount'], key, warn);
    var out = [];
    t.rows.forEach(function (r) {
      var d = iso(gv(grid, r, t.col, 'Date'));
      var typeRaw = txt(gv(grid, r, t.col, 'Movement Type'));
      var amt = num(gv(grid, r, t.col, 'Amount'));
      if (!d && !typeRaw) return;
      if (!d || !typeRaw || amt === null) return;      // template placeholder rows
      var mapped = MOVEMENT_MAP[norm(typeRaw)];
      if (!mapped) {
        err(ref(key, r, t.col['Movement Type'] || 0) + ': movement type "' + typeRaw +
            '" is not one of ' + Object.keys(MOVEMENT_MAP).join(', ') + '.');
        return;
      }
      /* Sign convention: every movement is a POSITIVE magnitude and its type
         says which way the balance moves. A negative principal payment would
         otherwise increase the balance — silently, and for the whole remaining
         life of the tranche. Normalise and say so rather than guessing, because
         the alternative reading (negative = the sender's own sign convention)
         is equally plausible and produces the opposite schedule. */
      if (amt < 0) {
        warn(key + ': "' + typeRaw + '" on ' + d + ' is negative (' + amt.toLocaleString() +
             '). Movements are recorded as positive magnitudes — the type says the direction — ' +
             'so it has been read as ' + Math.abs(amt).toLocaleString() + '. If the sender means ' +
             'something else by the minus sign, the schedule after this date is wrong.');
        amt = Math.abs(amt);
      }
      var trSrc = txt(gv(grid, r, t.col, 'Tranche ID'));
      var tr = trSrc ? trancheBySource[trSrc] : null;
      out.push({
        eventId: externalDealId + '-MV-' + slug(mapped) + '-' + d + '-' + Math.round(amt),
        eventType: mapped, eventDate: d, amount: amt,
        externalTrancheId: tr ? tr.externalTrancheId : null,
        externalDealId: externalDealId
      });
    });
    return out;
  }

  function readCashflowsV04(grids, key, externalDealId, trancheBySource, compBySource, warn, err) {
    var grid = grids[key];
    if (!grid) return [];
    var t = readTable(grid, ['Period Start', 'Period End', 'Tranche ID', 'Component ID',
                             'Posting Type', 'Settlement Type', 'Amount'], key, warn);
    var out = [], missingPeriod = 0;
    t.rows.forEach(function (r) {
      var amt = num(gv(grid, r, t.col, 'Amount'));
      var cSrc = txt(gv(grid, r, t.col, 'Component ID'));
      if (amt === null && !cSrc) return;
      var ps = iso(gv(grid, r, t.col, 'Period Start'));
      var pe = iso(gv(grid, r, t.col, 'Period End'));
      /* An amount with no date at all cannot be posted to any period, and there
         is nothing to infer one from. Stop and name the row: importing it is
         impossible, and dropping it quietly would lose money. Period End on its
         own is fine — that is a charge whose covered period was not stated,
         which is the ordinary "unverified" case, not a broken row. */
      if (!ps && !pe) {
        err(ref(key, r, t.col['Period End'] || 0) + ': amount ' +
            (amt === null ? '(blank)' : amt.toLocaleString()) +
            ' has neither Period Start nor Period End, so it cannot be posted to a period. ' +
            'Period End alone is enough where the period covered is not known.');
        return;
      }
      if (!ps || !pe) missingPeriod++;
      var comp = cSrc ? compBySource[cSrc] : null;
      if (cSrc && !comp) {
        err(ref(key, r, t.col['Component ID'] || 0) + ': component "' + cSrc +
            '" is not on the Components sheet.');
      }
      var trSrc = txt(gv(grid, r, t.col, 'Tranche ID'));
      var tr = trSrc ? trancheBySource[trSrc] : null;
      var settle = txt(gv(grid, r, t.col, 'Settlement Type'));
      settle = settle ? (SETTLE_MAP[norm(settle)] || norm(settle)) : (comp ? comp.settlementType : 'cash');
      var posting = norm(gv(grid, r, t.col, 'Posting Type')) || (comp ? comp.postingType : 'interest');
      posting = /fee/.test(posting) ? 'fee' : 'interest';

      /* A one-off charge is dated, not accrued: an arrangement fee on the
         settlement date has the same start and end. That is a point event with
         no period to cover, NOT a zero-day accrual — and calling it zero days
         is both wrong and rejected by the day-count check on the table. Keep
         the dates, decline to derive a length from them. */
      var pointDated = !!(ps && pe && ps === pe);
      var row = {
        rowNo: r + 1,
        date: pe || ps,
        periodStart: ps, periodEnd: pe,
        daysCovered: (ps && pe && !pointDated) ? dayDiff(ps, pe) : null,
        daysCoveredStated: !!(ps && pe && !pointDated),
        externalTrancheId: tr ? tr.externalTrancheId : (comp ? comp.externalTrancheId : null),
        externalComponentId: comp ? comp.externalComponentId : (cSrc ? externalDealId + '-' + slug(cSrc) : null),
        componentNames: comp ? [comp.name] : (cSrc ? [cSrc] : []),
        combined: false,
        postingType: posting,
        settlementType: settle,
        balanceBasis: comp ? comp.calculationBasis : null,
        drawdownLotId: null, drawdownScopeText: null,
        basisBalance: null,      // derived by PCS from Movements, never sent
        rate: null,              // derived by PCS from the component terms
        amount: amt === null ? 0 : amt,
        impliedDays: null,
        isFlat: !!(comp && comp.isFlatFee),
        cashSettled: settle === 'cash' ? (amt || 0) : 0
      };
      row.verificationStatus = classifyRow(row, comp);
      out.push(row);
    });
    if (missingPeriod) {
      warn(key + ': ' + missingPeriod + ' row(s) do not state Period Start and Period End. ' +
           'Without the period the day count cannot be derived, so those amounts are recorded ' +
           'but cannot be checked.');
    }
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out;
  }

  function readCheckpointsV04(grids, key, trancheBySource, warn) {
    var grid = grids[key];
    if (!grid) return [];
    var t = readTable(grid, ['Date', 'Tranche ID', 'Principal Balance', 'Unfunded Balance',
                             'Principal + Capitalised', 'Unfunded (Net of capitalisations)'], key, warn);
    var out = [];
    t.rows.forEach(function (r) {
      var d = iso(gv(grid, r, t.col, 'Date'));
      if (!d) return;
      var trSrc = txt(gv(grid, r, t.col, 'Tranche ID'));
      var tr = trSrc ? trancheBySource[trSrc] : null;
      out.push({
        date: d,
        externalTrancheId: tr ? tr.externalTrancheId : null,
        principalBalance: num(gv(grid, r, t.col, 'Principal Balance')),
        unfundedBalance: num(gv(grid, r, t.col, 'Unfunded Balance')),
        principalPlusCapitalised: num(gv(grid, r, t.col, 'Principal + Capitalised')),
        unfundedNetOfCapitalisations: num(gv(grid, r, t.col, 'Unfunded (Net of capitalisations)'))
      });
    });
    return out;
  }

  function parseGrids(grids, opts) {
    opts = opts || {};
    var warnings = [], errors = [];
    function warn(m) { warnings.push(m); }
    function err(m) { errors.push(m); }

    /* Settle how this workbook writes dates BEFORE reading anything from it.
       Every reader below calls iso(), which cannot interpret "22/08/2024"
       without knowing the order — and silently returned null when it did not,
       discarding the row. Establish it once, from evidence, for the whole
       file. Refuses (rather than guesses) when the file cannot prove it. */
    if (!establishFileDateConvention(grids, warn, err)) {
      return { snapshot: null, warnings: rollUp(warnings), errors: errors };
    }

    var loanKey = null, lookupKey = null, trancheKeys = [];
    Object.keys(grids).forEach(function (k) {
      var n = norm(k).replace(/\s+/g, '');
      if (/^loaninfo/.test(n)) loanKey = k;
      else if (/^lookup/.test(n)) lookupKey = k;
      else if (/tranch/.test(n)) trancheKeys.push(k);
    });

    if (!loanKey) {
      err('No "Loan info" sheet found — cannot identify the facility.');
      return { snapshot: null, warnings: rollUp(warnings), errors: errors };
    }
    if (!lookupKey) {
      err('No "Lookup values" sheet found. Field values cannot be validated against the agreed ' +
          'list, so the import is stopped rather than accepting unchecked data.');
      return { snapshot: null, warnings: rollUp(warnings), errors: errors };
    }

    var lookups = readLookups(grids[lookupKey], warn);
    var validate = makeValidator(lookups, warn, err);
    var meta = { sheets: {}, lookupColumns: Object.keys(lookups) };

    var loan = grids[loanKey];

    // Old-template detection: fail with a sentence that explains, rather than
    // an avalanche of "label not found".
    if (!findSection(loan, 'Deal Setup') && !findSection(loan, 'Facility Setup')) {
      err('"Loan info" has no "Deal Setup" or "Facility Setup" heading. This does not look like the ' +
          'current PCS Loan Import template — an earlier layout will not import.');
      return { snapshot: null, warnings: rollUp(warnings), errors: errors };
    }

    /* ── deal + facility ── */
    var dealAt = findSection(loan, 'Deal Setup');
    var facAt  = findSection(loan, 'Facility Setup');
    var feeAt  = findSection(loan, 'Facility Fees');

    var deal = readBlock(loan, dealAt, 1) || {};
    var fac  = readBlock(loan, facAt, 1) || {};

    /* Say so rather than defaulting in silence. With no Facility Setup block
       the commitment is 0, the facility is unnamed, and day count, holiday
       calendar, repayment type and accrual period all take engine defaults —
       ACT/365 where the file may well say ACT/360, which moves every interest
       figure on the deal. That is far too consequential to infer from silence. */
    if (!facAt) {
      err('Loan info: no "Facility Setup" heading found. Total Commitment, Day Count ' +
          'Convention, Holiday Calendar, Repayment Type and Facility Type all live in ' +
          'that block; without it the import would fall back to defaults and quietly ' +
          'change how interest is calculated.');
    }

    function fv(fields, names, label) {
      var f = fieldAt(fields, names, 0);
      if (!f) return { value: '', found: false };
      var v = label ? validate(label, f.raw, ref(loanKey, f.row, f.col)) : txt(f.raw);
      return { value: v === null ? '' : v, raw: f.raw, found: true, at: ref(loanKey, f.row, f.col) };
    }

    var company   = fv(deal, ['Deal Name']).value;
    var dealCode  = fv(deal, ['Deal ID']).value;
    var structure = fv(deal, ['Deal Structure'], 'Deal Structure').value;
    var currency  = fv(deal, ['Currency'], 'Currency').value;
    var framework = fv(deal, ['Accounting Framework'], 'Accounting Framework').value;

    if (!company)  err('Loan info: Deal Name is blank — it identifies the deal.');
    if (!dealCode) warn('Loan info: Deal ID is blank, so the deal is identified by its Deal Name. ' +
                        'A stable id that survives a rename is strongly preferred.');

    var dayCountRaw = fv(fac, ['Day Count Convention', 'Day Count Conversion'], 'Day Count Convention').value;
    var dayCount    = mapOrReport(DAYCOUNT_MAP, dayCountRaw, 'day count', 'Loan info', warn);

    var facility = {
      company: company || null,
      facilityName: fv(fac, ['Facility Name']).value || null,
      dealStructure: structure || null,
      counterparty: fv(deal, ['Counterparty']).value || null,
      agentName: fv(deal, ['Agent Name']).value || null,
      currency: currency || null,
      accountingFramework: framework || null,
      signingDate: iso(fv(deal, ['Signing Date']).raw),
      loanStartDate: iso(fv(deal, ['Settlement Date']).raw),
      loanEndDate: iso(fv(deal, ['Maturity Date']).raw),
      committedAmount: num(fv(fac, ['Total Commitment']).raw),
      maximumFacilityAmount: null,
      availabilityEnd: iso(fv(fac, ['Availability End']).raw),
      dayCountConvention: dayCount,
      holidayCalendar: fv(fac, ['Holiday Calendar'], 'Holiday Calendar').value || null,
      repaymentType: fv(fac, ['Repayment Type'], 'Repayment Type').value || null,
      facilityType: fv(fac, ['Facility Type'], 'Facility Type').value || null,
      interestAccrualPeriod: mapOrReport(FREQ_MAP,
        fv(fac, ['Interest Accrual Period (Default)'], 'Interest Accrual Period (Default)').value,
        'accrual period', 'Loan info', warn)
    };

    if (!facility.loanStartDate) err('Loan info: Settlement Date is blank. It is the date interest starts accruing.');
    if (!facility.loanEndDate)   err('Loan info: Maturity Date is blank.');
    if (facility.signingDate && facility.loanStartDate && facility.signingDate > facility.loanStartDate) {
      warn('Loan info: Signing Date is after Settlement Date. Unusual but not impossible — worth confirming.');
    }

    var externalDealId = opts.externalDealId || slug(dealCode) || slug(company) || 'PCS-DEAL';

    /* ── facility fees ── */
    var fees = [];
    var feeWidth = blockWidth(loan, feeAt, ['name']);
    var feeFields = readBlock(loan, feeAt, feeWidth);
    for (var fi = 0; fi < feeWidth; fi++) {
      var fname = txt(fieldAt(feeFields, ['Name'], fi) && fieldAt(feeFields, ['Name'], fi).raw);
      if (!fname) continue;
      var at_ = function (names) { return fieldAt(feeFields, names, fi); };
      var w = function (names, label) {
        var f = at_(names);
        if (!f) return '';
        var v = label ? validate(label, f.raw, ref(loanKey, f.row, f.col)) : txt(f.raw);
        return v === null ? '' : v;
      };
      fees.push({
        externalComponentId: externalDealId + '-FEE-' + slug(fname),
        scope: 'facility',
        name: fname,
        postingType: 'fee',
        feeType: w(['Fee Types'], 'Fee Types') || null,
        appliesTo: w(['Applies to']) || null,
        rate: num(at_(['%']) && at_(['%']).raw),
        calculationBasis: mapOrReport(BASIS_MAP, w(['Base'], 'Base'), 'fee basis', 'Loan info', warn),
        settlementFrequency: mapOrReport(FREQ_MAP, w(['Frequency'], 'Frequency'), 'frequency', 'Loan info', warn),
        firstSettlementDate: iso(at_(['Payment Date']) && at_(['Payment Date']).raw),
        revenueTreatment: w(['AASB', 'IFRS'], 'AASB') || null
      });
    }

    /* Maximum facility: the opening unfunded balance, which in the sample far
       exceeds the commitment. Both are kept — the fee ticks on the larger, but
       expected credit loss is measured on the committed amount only. */
    var loanHdr = findCashflowHeader(loan);
    if (loanHdr) {
      var lh = [];
      for (var lc = 0; lc < 80; lc++) lh[lc] = norm(cell(loan, loanHdr.row, lc));
      var ub = lh.indexOf('unfunded balance');
      if (ub >= 0) {
        for (var rr2 = loanHdr.row + 1; rr2 < loan.length; rr2++) {
          var v2 = num(cell(loan, rr2, ub));
          if (v2) { facility.maximumFacilityAmount = v2; break; }
        }
      }
    }
    if (facility.maximumFacilityAmount && facility.committedAmount &&
        facility.committedAmount > facility.maximumFacilityAmount) {
      warn('Total Commitment (' + facility.committedAmount.toLocaleString() + ') exceeds the opening ' +
           'unfunded balance (' + facility.maximumFacilityAmount.toLocaleString() + '). One of the two ' +
           'is wrong, or the fee accrues on a narrower base than the whole commitment — worth confirming ' +
           'with PortF, because it is the figure expected credit loss is measured against.');
    }
    if (facility.maximumFacilityAmount && facility.committedAmount &&
        facility.maximumFacilityAmount > facility.committedAmount * 1.5) {
      warn('The opening unfunded balance (' + facility.maximumFacilityAmount.toLocaleString() +
           ') far exceeds Total Commitment (' + facility.committedAmount.toLocaleString() +
           '). Read as the maximum facility, with unfunded-balance fees accruing on it. ' +
           'ECL exposure still uses the committed amount only.');
    }

    /* ── v0.4 branch ──────────────────────────────────────────────────────
       Loan info, the fee block and every check above are shared. Only the
       source of tranches, components, movements and cashflows differs, so the
       split happens here rather than at the top of the function. */
    var v04 = detectV04(grids);
    if (v04) {
      meta.templateVersion = 'v0.4';
      var v4Tranches = v04.tranches
        ? readTranchesV04(grids, v04.tranches, externalDealId, warn)
        : [];
      if (!v4Tranches.length) {
        err('v0.4 workbook: no "Tranches" sheet, or it has no rows. Cashflows and components ' +
            'reference tranches by id, so nothing can be attributed without it.');
      }
      var trBySrc = {};
      v4Tranches.forEach(function (t) { trBySrc[t.sourceKey] = t; });

      var v4Components = readComponentsV04(grids, v04.components, externalDealId, trBySrc, validate, warn, err);
      var cmpBySrc = {};
      v4Components.forEach(function (c) { cmpBySrc[c.sourceKey] = c; });

      var v4Movements = v04.movements
        ? readMovementsV04(grids, v04.movements, externalDealId, trBySrc, warn, err)
        : [];
      if (!v4Movements.length) {
        err('v0.4 workbook: no movements found. Balances are derived from them, so without ' +
            'movements no amount can be checked and no balance can be reported.');
      }

      var v4Cashflows = readCashflowsV04(grids, v04.cashflows, externalDealId, trBySrc, cmpBySrc, warn, err);
      var v4Checkpoints = v04.checkpoints
        ? readCheckpointsV04(grids, v04.checkpoints, trBySrc, warn)
        : [];
      if (!v4Checkpoints.length) {
        warn('v0.4 workbook: no balance checkpoints. Balances are derived from movements, so a ' +
             'movement that never arrives produces silent drift with nothing to catch it. ' +
             'A quarterly checkpoint is strongly preferred.');
      }

      /* Seed each tranche's opening position from its initial-purchase movement,
         so the Builder shows a drawn balance without the balance columns v0.3
         used to carry. */
      v4Tranches.forEach(function (t) {
        var init = v4Movements.filter(function (m) {
          return m.eventType === 'initialPurchase' && m.externalTrancheId === t.externalTrancheId;
        }).sort(function (a, b) { return a.eventDate < b.eventDate ? -1 : 1; })[0];
        if (init) { t.startDate = init.eventDate; t.initialDrawdown = init.amount; }
      });

      return finish(v4Tranches, fees.concat(v4Components), v4Movements, v4Cashflows, v4Checkpoints);
    }

    meta.sheets[loanKey] = {};
    var facilityCashflows = readCashflows(loan, {
      externalDealId: externalDealId,
      externalTrancheId: null,
      trancheKey: null,
      loanStartDate: facility.loanStartDate,
      dayCountConvention: facility.dayCountConvention,
      componentIdFor: function (g) {
        var base = externalDealId + '-FAC';
        if (g.componentName && !g.combined) {
          var hit = matchComponent(fees, g.componentName);
          if (hit) return hit.externalComponentId;
          return base + '-' + slug(g.componentName);
        }
        if (g.combined) return base + '-COMBINED-' + g.postingType.toUpperCase();
        return base + '-' + g.postingType.toUpperCase() + '-' + g.settlementType.toUpperCase() +
               '-' + slug(g.basis || 'NA');
      },
      flatFeeId: function (st) { return externalDealId + '-FAC-FLATFEE-' + st.toUpperCase(); }
    }, warn, err, loanKey, meta.sheets[loanKey]);

    /* ── tranches ── */
    var tranches = [], components = [], trancheCashflows = [], events = [];
    var usedKeys = {};
    var rowBudget = opts.maxCashflowRows || 500000;
    var budgetBlown = false;

    if (!trancheKeys.length) warn('No tranche worksheet found — facility-level data only.');

    for (var ti = 0; ti < trancheKeys.length; ti++) {
      var sheet = trancheKeys[ti];
      var tg = grids[sheet];

      var tdAt = findSection(tg, 'Tranche Details');
      var tiAt = findSection(tg, 'Tranche Interest Details');
      var tfAt = findSection(tg, 'Tranche Fees');
      if (!tdAt) { err(sheet + ': no "Tranche Details" heading — cannot read this tranche.'); continue; }

      var td = readBlock(tg, tdAt, 1) || {};
      var tvf = function (names, label) {
        var f = fieldAt(td, names, 0);
        if (!f) return { value: '', raw: null };
        var v = label ? validate(label, f.raw, ref(sheet, f.row, f.col)) : txt(f.raw);
        return { value: v === null ? '' : v, raw: f.raw };
      };

      var tName = tvf(['Tranche Name']).value || sheet;
      // Tranche names in the template repeat the deal code ("SP032 — 01042026"),
      // which would produce SP032-SP032-01042026. Dropped for legibility only;
      // the id is still derived from the name and still stable.
      var base = slug(String(tName).replace(new RegExp('^\\s*' + externalDealId + '\\s*[—–-]*\\s*', 'i'), '')) ||
                 slug(tName) || slug(sheet) || ('T' + (ti + 1));
      var key = base, dedupe = 2;
      while (usedKeys[key]) key = base + '-' + (dedupe++);
      usedKeys[key] = true;
      var externalTrancheId = externalDealId + '-' + key;

      var tCcy = tvf(['Currency'], 'Currency').value;
      tranches.push({
        externalTrancheId: externalTrancheId,
        name: tName,
        sheetName: sheet,
        currency: tCcy || facility.currency,
        commitment: num(tvf(['Face Value']).raw),
        initialDrawdown: num(tvf(['Initial Drawdown']).raw),
        startDate: iso(tvf(['Initial Drawdown Date']).raw) || facility.loanStartDate
      });

      /* interest components */
      var icWidth = blockWidth(tg, tiAt, ['interest name', 'name']);
      var icFields = readBlock(tg, tiAt, icWidth);
      var sheetComponents = [];
      for (var ci = 0; ci < icWidth; ci++) {
        var icNameF = fieldAt(icFields, ['Interest Name', 'Name'], ci);
        var icName = txt(icNameF && icNameF.raw);
        if (!icName) continue;
        var g_ = function (names) { return fieldAt(icFields, names, ci); };
        var gv = function (names, label) {
          var f = g_(names);
          if (!f) return '';
          var v = label ? validate(label, f.raw, ref(sheet, f.row, f.col)) : txt(f.raw);
          return v === null ? '' : v;
        };

        var comp = {
          externalComponentId: externalDealId + '-' + key + '-' + slug(icName),
          externalTrancheId: externalTrancheId,
          scope: 'tranche',
          name: icName,
          postingType: 'interest',
          index: gv(['Interest Type'], 'Interest Type') || null,
          rate: num(g_(['Base Value']) && g_(['Base Value']).raw),
          accrualFrequency: mapOrReport(FREQ_MAP, gv(['Accrual Frequency'], 'Accrual Frequency'), 'accrual frequency', sheet, warn),
          terms: gv(['Terms'], 'Terms') || null,
          settlementType: mapOrReport(SETTLE_MAP, gv(['Settlement Type'], 'Settlement Type'), 'settlement type', sheet, warn),
          // The template misspells this label; both spellings are accepted.
          firstSettlementDate: iso((g_(['First Settlement Date', 'Fist Settlement Date']) || {}).raw),
          lookbackDays: num(g_(['Lookback']) && g_(['Lookback']).raw),
          lockoutDays: num(g_(['Lockout']) && g_(['Lockout']).raw),
          observationShift: num(g_(['Obs shift']) && g_(['Obs shift']).raw),
          spreadBandStart: iso((g_(['Spread band 1 Start Date']) || {}).raw),
          spreadBandEnd: iso((g_(['Spread band 2 End Date']) || {}).raw),
          marginRatchet: txt((g_(['Margin Ratchet']) || {}).raw) || null,
          esgAdjustmentBps: num(g_(['ESG Adjustment (bps)']) && g_(['ESG Adjustment (bps)']).raw),
          floorBps: num(g_(['Rate FLOOR']) && g_(['Rate FLOOR']).raw),
          capBps: num(g_(['Rate CAP']) && g_(['Rate CAP']).raw),
          rateStructure: null
        };
        comp.rateStructure = (norm(comp.index) === 'fixed') ? 'fixed' : 'floating';
        if (comp.rateStructure === 'fixed' && comp.rate === null) {
          err(sheet + ': interest component "' + icName + '" is FIXED but has no Base Value.');
        }
        if (comp.rate !== null && comp.rate > 1) {
          err(sheet + ': interest component "' + icName + '" has Base Value ' + comp.rate +
              ' — rates must be decimals, not percentages.');
        }
        sheetComponents.push(comp);
        components.push(comp);
      }

      /* tranche fees */
      var tfWidth = blockWidth(tg, tfAt, ['name']);
      var tfFields = readBlock(tg, tfAt, tfWidth);
      for (var fj = 0; fj < tfWidth; fj++) {
        var tfNameF = fieldAt(tfFields, ['Name'], fj);
        var tfName = txt(tfNameF && tfNameF.raw);
        if (!tfName) continue;
        var h_ = function (names) { return fieldAt(tfFields, names, fj); };
        var hv = function (names, label) {
          var f = h_(names);
          if (!f) return '';
          var v = label ? validate(label, f.raw, ref(sheet, f.row, f.col)) : txt(f.raw);
          return v === null ? '' : v;
        };
        var tfee = {
          externalComponentId: externalDealId + '-' + key + '-FEE-' + slug(tfName),
          externalTrancheId: externalTrancheId,
          scope: 'tranche',
          name: tfName,
          postingType: 'fee',
          feeType: hv(['Fee Types'], 'Fee Types') || null,
          appliesTo: hv(['Applies to']) || null,
          rate: num(h_(['%']) && h_(['%']).raw),
          calculationBasis: mapOrReport(BASIS_MAP, hv(['Base'], 'Base'), 'fee basis', sheet, warn),
          settlementFrequency: mapOrReport(FREQ_MAP, hv(['Frequency'], 'Frequency'), 'frequency', sheet, warn),
          firstSettlementDate: iso(h_(['Payment Date']) && h_(['Payment Date']).raw),
          revenueTreatment: hv(['AASB', 'IFRS'], 'AASB') || null
        };
        sheetComponents.push(tfee);
        components.push(tfee);
      }

      meta.sheets[sheet] = {};
      var flows = readCashflows(tg, {
        externalDealId: externalDealId,
        externalTrancheId: externalTrancheId,
        trancheKey: key,
        loanStartDate: iso(tvf(['Initial Drawdown Date']).raw) || facility.loanStartDate,
        dayCountConvention: facility.dayCountConvention,
        componentIdFor: (function (sc, k) {
          return function (g) {
            if (g.componentName && !g.combined) {
              var hit = matchComponent(sc, g.componentName);
              if (hit) return hit.externalComponentId;
              return externalDealId + '-' + k + '-' + slug(g.componentName);
            }
            if (g.combined) return externalDealId + '-' + k + '-COMBINED-' + g.postingType.toUpperCase();
            return externalDealId + '-' + k + '-' + g.postingType.toUpperCase() + '-' +
                   g.settlementType.toUpperCase() + '-' + slug(g.basis || 'NA');
          };
        })(sheetComponents, key),
        flatFeeId: (function (k) {
          return function (st) { return externalDealId + '-' + k + '-FLATFEE-' + st.toUpperCase(); };
        })(key)
      }, warn, err, sheet, meta.sheets[sheet]);

      /* Fallback: some senders still export a payment list — a Date column and
         one column per category, with no balance, rate or section headers. It
         cannot be checked, but refusing it outright loses real amounts and real
         dates for no gain. Read it, and mark every row unverified so nothing
         downstream mistakes it for a schedule we have recalculated. */
      if (!flows.length) {
        var legacy = readPaymentList(tg, {
          externalDealId: externalDealId,
          externalTrancheId: externalTrancheId,
          trancheKey: key,
          declared: sheetComponents.concat(fees)
        }, warn, err, sheet);
        if (legacy.length) flows = legacy;
      }

      trancheCashflows = trancheCashflows.concat(flows);
      events = events.concat(readEvents(tg, {
        externalDealId: externalDealId, externalTrancheId: externalTrancheId, trancheKey: key
      }, sheet));

      // Stop before the browser does. The check has to break the loop, not
      // merely record an error, or the memory it exists to protect is already
      // gone by the time anyone reads the message.
      if (facilityCashflows.length + trancheCashflows.length > rowBudget) {
        err('This workbook exceeds ' + rowBudget.toLocaleString() + ' cashflow rows — stopped at "' +
            sheet + '", tranche ' + (ti + 1) + ' of ' + trancheKeys.length + '. A browser cannot hold a ' +
            'file this size. Use the pull API, which imports server-side with no such ceiling.');
        budgetBlown = true;
        break;
      }
    }

    if (budgetBlown) return { snapshot: null, warnings: rollUp(warnings), errors: errors };

    return finish(tranches, fees.concat(components), events,
                  facilityCashflows.concat(trancheCashflows), []);

    /* Shared tail for both template versions: status back-fill, the
       nothing-imported check, snapshot assembly and the cross-reference. */
    function finish(tranches, allComponents, events, cashflows, checkpoints) {
      /* v0.3 rows carry the rate and balance PortF sent, so their status is read
         off what arrived rather than off the component terms. */
      cashflows.forEach(function (cf) {
        if (cf.verificationStatus) return;
        cf.verificationStatus = cf.isFlat ? 'flat'
          : (cf.rate !== null && cf.rate !== undefined && cf.basisBalance !== null && cf.basisBalance !== undefined)
            ? 'full' : 'unverified';
      });

      var tally = { full: 0, flat: 0, unverified: 0 };
      cashflows.forEach(function (cf) { tally[cf.verificationStatus] = (tally[cf.verificationStatus] || 0) + 1; });
      meta.verification = tally;

      /* A workbook with no schedule used to import as a success, which is how a
         file could create a deal with nothing in it and report no problem. If
         the caller genuinely wants the terms only, it has to say so. */
      if (!cashflows.length && !opts.allowTermsOnly) {
        err('No cashflow rows were found in this workbook, so there is nothing to post. ' +
            'The deal terms parsed correctly — if you meant to import the terms alone, re-run ' +
            'with "terms only" confirmed.');
      }
      if (tally.unverified) {
        warn(tally.unverified + ' of ' + cashflows.length + ' cashflow row(s) cannot be independently ' +
             'checked — the file gives an amount but not enough to recalculate it. They import and post, ' +
             'and are marked "unverified" wherever they are shown.');
      }

      var payload = { facility: facility, components: allComponents, tranches: tranches, events: events, cashflows: cashflows };
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
        templateVersion: meta.templateVersion === 'v0.4' ? 'PCS Loan Import v0.4' : 'PCS Loan Import New Deal',
        parseMeta: meta,
        facility: facility,
        components: allComponents,
        tranches: tranches,
        events: events,
        cashflows: cashflows,
        balanceCheckpoints: checkpoints || []
      };

      // Cross-reference check: every cashflow must point at something real.
      var known = {};
      allComponents.forEach(function (c) { known[c.externalComponentId] = true; });
      var unknown = {};
      cashflows.forEach(function (cf) {
        if (cf.externalComponentId && !known[cf.externalComponentId]) unknown[cf.externalComponentId] = (unknown[cf.externalComponentId] || 0) + 1;
      });
      Object.keys(unknown).forEach(function (id) {
        warn(unknown[id] + ' cashflow row(s) post against "' + id + '", which is not a declared component ' +
             'or fee. They import as a balance-basis line and will post, but cannot be reported per component.');
      });

      return { snapshot: snapshot, warnings: rollUp(warnings), errors: errors };
    }
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
    _internals: { num: num, iso: iso, norm: norm, slug: slug, readLookups: readLookups, fnv1a: fnv1a }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PortFExcel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
