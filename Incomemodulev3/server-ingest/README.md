# PCS Ingestion Service

Standalone microservice for document ingestion + AI extraction. Runs alongside
(not inside) the `server/` Investran DIU proxy so:

- Long-running LLM calls (5-30s) never block DIU JE posts
- Anthropic API key sits in its own env with its own blast radius
- Ingestion can scale independently (workers, queues, doc storage)
- Prompts + models iterate on their own deploy cadence

## Endpoints

| Method | Path                    | Purpose                                             |
| ------ | ----------------------- | --------------------------------------------------- |
| GET    | `/healthz`              | Health check                                         |
| GET    | `/api/extract/status`   | Reports whether Anthropic key is configured         |
| POST   | `/api/extract/notice`   | Extract structured fields from a notice PDF         |

**Planned (Phase 2+):**
- `POST /api/extract/credit-agreement` — deal-setup extraction
- `POST /api/extract/borrower-financials` — parse borrower financial statements
- `POST /api/ingest/email-webhook` — inbound email from SES/Postmark
- `POST /api/match/deal` — deal-matching heuristics engine
- `POST /api/queue/exception` — human-review exception queue

## Setup

```bash
cd server-ingest
npm install
cp .env.example .env
# edit .env: set ANTHROPIC_API_KEY
npm start
```

You should see:

```
════════════════════════════════════════════
Document Ingestion Service listening on port 4319
  AI extract:       claude-opus-4-8
  ...
════════════════════════════════════════════
```

Point the browser client at this URL via **DB Settings → Ingestion Service URL**
(default: `http://localhost:4319`).

## Env vars

| Variable            | Default              | Purpose                                       |
| ------------------- | -------------------- | --------------------------------------------- |
| `INGEST_PORT`       | `4319`               | Listen port                                    |
| `ALLOWED_ORIGINS`   | `*`                  | CORS whitelist                                 |
| `ANTHROPIC_API_KEY` | *(blank = mock mode)* | Claude API key                                 |
| `ANTHROPIC_MODEL`   | `claude-opus-4-8`    | Claude model                                   |
| `LOG_VERBOSE`       | `0`                  | Set to `1` for verbose request logging         |

Without `ANTHROPIC_API_KEY`, the service still runs in **mock mode** —
returns a placeholder extraction so the client UI is testable without an API budget.

## Cost model

Claude Opus 4 vision ≈ $15 per 1M input tokens. A typical 1-2 page notice ≈
3-5K tokens ≈ **$0.05 per extraction**. Trivial cost even at high volume:

- 500 loans × ~15 notices/year each = 7,500 notices/year per fund
- ≈ $375/year in Anthropic spend per fund
- vs. 0.5-2 FTEs in loan-ops @ $80-150K each

## Separation from the DIU proxy

The DIU proxy (`../server/`) handles Investran connectivity + SMTP delivery.
This service handles anything AI/document-oriented. They are deployed and
scaled independently. Each holds its own secrets:

- DIU proxy: `INVESTRAN_CLIENT_ID`, `INVESTRAN_CLIENT_SECRET`, `SMTP_*`
- Ingest service: `ANTHROPIC_API_KEY`

Compromise of one does not expose the other.
