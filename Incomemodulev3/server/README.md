# Investran DIU Proxy

Browser-to-Investran bridge for V3's `Post JE` flow. The V3 page can't call Investran directly (CORS + OAuth + multipart upload), so this small Node.js proxy holds the credentials and forwards calls.

## Quick start

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your Investran sandbox credentials
npm start
```

The proxy listens on `http://localhost:4318` by default. Check it's alive:

```bash
curl http://localhost:4318/healthz
# → {"ok":true,"proxy":"investran-diu-proxy","investranConfigured":true,...}
```

## .env settings

| Variable | Required | Description |
|---|---|---|
| `PROXY_PORT` | no | Listen port. Default `4318`. |
| `INVESTRAN_BASE_URL` | yes | Base URL of your Investran environment, e.g. `https://accounting.investran.fis.com/api/v3` |
| `INVESTRAN_CLIENT_ID` | yes | OAuth2 client ID — request from your Investran admin |
| `INVESTRAN_CLIENT_SECRET` | yes | OAuth2 client secret. **Never put this in V3's HTML.** |
| `INVESTRAN_OAUTH_SCOPE` | no | OAuth scope. Default `dataimport.write`. |
| `INVESTRAN_TOKEN_URL` | no | Override token endpoint. Defaults to `<base>/oauth/token`. |
| `ALLOWED_ORIGINS` | no | Comma-separated origins allowed to call this proxy. Use `*` in dev only. |
| `DEFAULT_TEMPLATE` | no | Default DIU template name. |
| `LOG_VERBOSE` | no | `1` to log every forwarded request. |

## Endpoints (mirror V3's simulator steps)

| Method | Path | Forwards to | Notes |
|---|---|---|---|
| GET | `/healthz` | — | Health check. Returns config status. |
| POST | `/api/diu/jobs` | `POST /dataimport/jobs` | Create DIU job. Body: `{ template, name, metadata }` |
| POST | `/api/diu/jobs/:id/files` | `PUT /dataimport/jobs/:id/files` | Multipart XLSX upload. Field name: `file`. Max 50 MB. |
| POST | `/api/diu/jobs/:id/load` | `POST /dataimport/jobs/:id/load` | Parse XLSX into staging tables. |
| POST | `/api/diu/jobs/:id/validate` | `POST /dataimport/jobs/:id/validate` | Chart of accounts + FK resolution. |
| POST | `/api/diu/jobs/:id/commit` | `POST /dataimport/jobs/:id/commit` | Commit to sub-ledger. Returns batch ID + status. |
| GET | `/api/diu/jobs/:id/processes` | `GET /dataimport/jobs/:id/processes` | Confirm batch + fetch feedback. |

OAuth is handled automatically — the proxy caches the access token and refreshes ~30 s before expiry.

## V3 wiring

Open V3, click the ⚙ gear icon in the header, set **Backend Type = PostgREST** for Supabase (the DB), and add a new **DIU Proxy URL** field pointing at the proxy:

```
http://localhost:4318
```

When that URL is set + reachable, the `Post JE` button will perform real DIU API calls. When blank or unreachable, V3 falls back to the simulator with a yellow `DEMO MODE` banner so nobody mistakes it for a real post.

## Deployment

- **Local development**: `npm run dev` (watches the file)
- **Internal server**: run behind nginx with HTTPS termination. Restrict `ALLOWED_ORIGINS` to your firm's V3 host.
- **Container**: ~50 MB Alpine + node:18. Standard `Dockerfile`:
  ```dockerfile
  FROM node:18-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --omit=dev
  COPY . .
  EXPOSE 4318
  CMD ["node", "server.js"]
  ```

## Security notes

- **Never commit `.env`** — only `.env.example`. `.gitignore` is set up.
- The proxy holds the OAuth client secret. Restrict who can SSH to the host.
- Use a dedicated Investran service account with just `dataimport.write`. Not a human user's creds.
- In prod, put `ALLOWED_ORIGINS` to your exact V3 host (no `*`, no `file://`).
- Behind an internal load balancer with TLS — never expose this proxy to the public internet.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `OAuth token request failed: HTTP 401` | Bad CLIENT_ID/SECRET or wrong TOKEN_URL |
| `CORS blocked: <origin>` | Add the origin to `ALLOWED_ORIGINS` |
| `multipart field "file" required` | V3 must POST as `multipart/form-data` with field name `file` |
| Proxy starts but commits fail with 404 | Check INVESTRAN_BASE_URL — should include `/api/v3` |
| Slow responses | Investran sandbox is slow. Bump V3's step timeout. Real prod is faster. |
