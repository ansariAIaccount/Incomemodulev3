# DIU Proxy Quickstart

**Goal:** Flip Stage 3 (`Post JE`) from simulator to real Investran DIU posts.

The server code is complete at `server/server.js`. This runbook covers the three deployment paths (local dev / cloud host / internal VM) and the one-time V3 wiring step.

---

## Prerequisites (get these first)

From your Investran admin:
- **Base URL** (e.g. `https://accounting.investran.fis.com/api/v3`)
- **OAuth Client ID + Secret** — request a dedicated service account with scope `dataimport.write`. Never use a human user's credentials.
- **Token endpoint URL** if it's not `<base>/oauth/token`

You'll also want to confirm which DIU template maps to your GL — the default is `IFRS_Loan_GL_DIU_Template` but yours may differ. For USGAAP deals it's typically `USGAAP_Loan_GL_DIU_Template`.

---

## Path A: Local dev (fastest — 5 min)

Run on your Mac / dev machine. V3 connects via `http://localhost:4318`.

```bash
cd /Users/ferhatansari/Documents/GitHub/Incomemodulev3/Incomemodulev3/server
npm install                                    # ~15 sec — one-time
cp .env.example .env
# open .env in an editor, paste the 3 creds:
#   INVESTRAN_BASE_URL=https://...
#   INVESTRAN_CLIENT_ID=...
#   INVESTRAN_CLIENT_SECRET=...
npm start
```

You should see:

```
────────────────────────────────────────────
Investran DIU Proxy listening on port 4318
  Investran base:     https://accounting.investran.fis.com/api/v3
  Credentials set:    true
  Health check:       http://localhost:4318/healthz
────────────────────────────────────────────
```

Verify from a second terminal:

```bash
curl http://localhost:4318/healthz
# → { "ok": true, "investranConfigured": true, "tokenCached": false, ... }
```

Force an OAuth token fetch to prove the credentials work:

```bash
curl -X POST http://localhost:4318/api/diu/jobs \
     -H 'Content-Type: application/json' \
     -d '{"template":"IFRS_Loan_GL_DIU_Template","name":"proxy-test"}'
# ok=true + jobId means creds work.
# HTTP 401 or "OAuth token request failed" means bad CLIENT_ID/SECRET or wrong TOKEN_URL.
```

Ctrl+C to stop. Use `npm run dev` instead of `npm start` for auto-reload on edits.

---

## Path B: Cloud host (persistent — Render.com recommended, 10 min)

For a proxy that's always up (so anyone using V3 anywhere can post without you running the server), deploy to Render's free tier:

1. Push the repo to GitHub if not already:
   ```bash
   cd /Users/ferhatansari/Documents/GitHub/Incomemodulev3
   git add . && git commit -m "chore: prep DIU proxy for deploy" && git push
   ```

2. Sign in to https://render.com → **New → Web Service** → connect the `Incomemodulev3` repo.

3. Fill in:
   - **Name:** `investran-diu-proxy`
   - **Root Directory:** `Incomemodulev3/server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (or Starter $7/mo for no cold start)

4. Under **Environment Variables** paste the same values from `.env`:
   ```
   INVESTRAN_BASE_URL      = https://...
   INVESTRAN_CLIENT_ID     = ...
   INVESTRAN_CLIENT_SECRET = ...
   INVESTRAN_OAUTH_SCOPE   = dataimport.write
   ALLOWED_ORIGINS         = https://<your-v3-host>,http://localhost:8000
   DEFAULT_TEMPLATE        = USGAAP_Loan_GL_DIU_Template
   LOG_VERBOSE             = 0
   ```
   Don't set `PROXY_PORT` — Render assigns one via `$PORT` (the server picks that up automatically).

5. **Create Web Service** → wait ~2 min for first build. Render gives you a URL like `https://investran-diu-proxy.onrender.com`. Test:
   ```
   https://investran-diu-proxy.onrender.com/healthz
   ```

**Alternatives** if you don't want Render:
- **Fly.io** — `fly launch` from `server/`, set secrets via `fly secrets set`. ~$2/mo.
- **Railway** — GitHub-connect, same env-var flow, generous free tier.
- **AWS Lightsail / EC2** — for full control, but overkill for a 200-line proxy.

---

## Path C: Internal VM behind a firewall (production)

For a real deployment inside your firm's network:

```bash
ssh proxy-vm
git clone <the repo>
cd Incomemodulev3/server
npm ci --omit=dev
# Edit .env with prod creds, ALLOWED_ORIGINS locked to your V3 hostname only
# Set up as a systemd service:
sudo tee /etc/systemd/system/diu-proxy.service <<EOF
[Unit]
Description=Investran DIU Proxy
After=network.target
[Service]
ExecStart=/usr/bin/node /opt/diu-proxy/server.js
WorkingDirectory=/opt/diu-proxy
Restart=on-failure
User=diuproxy
EnvironmentFile=/opt/diu-proxy/.env
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now diu-proxy
```

Front with nginx for HTTPS termination + tighten `ALLOWED_ORIGINS` to your V3 host only.

---

## V3-side wiring (one-time)

After the proxy is running (whichever path you chose):

1. Open V3 in the browser
2. Click the **⚙ gear** icon in the header → DB Settings modal
3. Look for the **DIU Proxy URL** field. Enter:
   - `http://localhost:4318` if Path A
   - `https://investran-diu-proxy.onrender.com` if Path B
   - Your internal URL if Path C
4. Click **Test Connection** — should turn green
5. Click **Save**

The URL is stored in `localStorage`. When the field is set + reachable, the `Post JE` button performs real DIU posts. When blank or unreachable, V3 falls back to the simulator with a `DEMO MODE` banner so you never mistake a demo for a real post.

---

## Verification — end-to-end live post

1. Open V3, load **Cascade Capital Term Loan**
2. Stage 2 → **Run Accounting** → confirm 50 JE rows
3. Stage 2 → **Post JE to Investran** button
4. Watch the 6-step ticker:
   - Create job → jobId returned
   - Upload XLSX (~30 KB) → fileId returned
   - Load → processId
   - Validate → passed=true, 0 errors
   - Commit → batchId + rowsPosted=50
   - Confirm → processes fetched
5. Result modal shows `LIVE` badge (not `DEMO MODE`), plus the real Investran batch ID

Cross-check on the Investran side that the batch appears in the sub-ledger.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `investranConfigured: false` at `/healthz` | Blank env vars | Edit `.env`, restart proxy |
| `OAuth token request failed: HTTP 401` | Wrong CLIENT_ID/SECRET | Re-check with Investran admin |
| `OAuth token request failed: HTTP 404` | Wrong TOKEN_URL | Set `INVESTRAN_TOKEN_URL` explicitly |
| V3 → proxy: `CORS blocked` | ALLOWED_ORIGINS too strict | Add your V3 host to the list |
| V3 → proxy: `NetworkError when attempting to fetch` | Proxy not running or wrong URL | `curl <proxy>/healthz` first |
| Commits fail with 500 | Investran-side rejection | Turn `LOG_VERBOSE=1`, restart, watch the forwarded response body |
| `LIVE` never appears | V3 still on simulator path | Confirm ⚙ Settings shows the proxy URL saved (not blank) |

---

## Rollback plan

Zero risk. Clear the **DIU Proxy URL** in ⚙ Settings → V3 falls back to the simulator immediately. No engine or DB state is affected. You can toggle back and forth as needed while testing.
