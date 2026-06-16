# PCS Loan Module — V3 (Supabase Backend)

Browser-based loan accounting demo backed by Supabase. Open `loan-module-v3-builder.html` directly in a modern browser (Chrome / Edge / Safari / Firefox) or serve the folder over HTTP.

## Files

| File | Role |
|---|---|
| `loan-module-v3-builder.html` | Main application — UI + SB adapter + V3 logic |
| `loan-module-engine.js` | Daily accrual / EIR / ECL engine (shared with v1/v2) |
| `loan-module-instruments.js` | Legacy seed dataset (fallback when DB is offline) |
| `demo-assistant-kb.js` | Knowledge base for the in-app Demo Assistant |
| `demo-assistant-system-prompt.js` | System prompt for the Demo Assistant |

## Run locally

Just open `loan-module-v3-builder.html` in a browser. No build step.
If your browser blocks loading sibling JS files via `file://`, serve over HTTP:

```bash
# pick any one
python3 -m http.server 8000
# or
npx serve .
```

then visit http://localhost:8000/loan-module-v3-builder.html

## Database (Supabase)

V3 ships pointed at the demo Supabase project. To switch to UAT / staging /
your own DB, click the ⚙ gear icon in the header → set Backend Type + URL +
credentials → Test Connection → Save & Reload. Settings persist in the
browser's localStorage.

Supported backends:
- Supabase (default)
- PostgREST (raw)
- Custom REST API (PostgREST-compatible contract)
- Hasura GraphQL (stub)
- FIS Investran API (stub)

## V3 features layered on top of v2

- Supabase backend: read deals from `preset_catalog`, persist accounting runs
  (`accounting_runs`, `journal_entries`), treatment overrides, sessions, and
  the daily Stage 1 cashflow schedule (`cashflow_schedules`).
- Save to DB button in Stage 0 — full upsert of deal/facility/tranches/fees.
- Database connection settings popup with multi-backend support.
- DB-saved deals appear in the Active Deal modal under "Saved (DB)".
- Required-field validation popup before save.
- Verbose console diagnostics (`[V3] ...` / `[SB] ...`) for debuggability.
