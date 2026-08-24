# Investran DIU REST API — integration questions

**Context:** We're building a loan-accounting module that generates IFRS/US GAAP
journal entries and needs to post them into Investran via the Data Import
Utility. A Node proxy holds the credential server-side; the browser never sees
it. Auth, tenant routing and token-expiry handling are built and working. What
we're missing is the REST endpoint contract.

**Environment:** `goldenliveuat` (Server `v8wbsinvsq07l1`)
**Service account:** `C-E1074557`

---

## What we've already established

So the answers below don't repeat work already done:

| Finding | Detail |
|---|---|
| Token is valid | RS256 JWT, `aud=investran-web-api`, `iss=login10.fisglobal.com/idp/InvestranUSPRD`, 30-day life. Claims carry `Database=goldenliveuat`, `Server=v8wbsinvsq07l1`, and a nested `accessToken`. |
| `investran-uat-us-live.fisglobal.com/api/` | **Not the API.** Serves IIS; returns 403 at root and 404 on every path we probed (`/DataImport`, `/ReferenceData`, `/ReportWizard`, `/swagger`, plus casing and version variants). This is the URL we were originally given. |
| `investranweb-livedev-us.fiscloudservices.com/api/mcp` | Reachable and functional, but it's an **MCP/JSON-RPC gateway**, not REST. Returns 405 on GET, 406 on `Accept: application/json`. Not suitable for our app. |
| UAT hostnames on `fiscloudservices.com` | All guesses failed DNS (`investranweb-uat-us`, `-liveuat-us`, `-uat-live-us`, `-golden-us`, `-us`). |

---

## Questions

### 1 · Base URL  ← *most important*

**What is the REST API base URL for the `goldenliveuat` tenant?**

We need the host + root path, e.g. `https://<host>/<root>`, such that DIU
endpoints hang off it.

### 2 · Is there a Swagger / OpenAPI document?

**If yes, the URL.** This would answer questions 3–7 in one go and is by far the
fastest resolution. We probed `/swagger/v1/swagger.json` and `/$metadata` with no
success on the hosts we tried.

### 3 · DIU endpoint paths and methods

For each step of the import lifecycle, the **HTTP method and path**:

| Step | What we need |
|---|---|
| Create import job | method + path + request body schema |
| Upload data | method + path — and whether it takes multipart XLSX or a JSON payload |
| Validate | method + path |
| Load / commit | method + path |
| Poll status / feedback | method + path |

We have the *tool-level* documentation (`dataimport_create_job`,
`dataimport_validate_process`, `dataimport_load_process`, etc.) which indicates a
create → validate → load lifecycle with a body of
`{"Name":"...","DomainId":1,"EntityId":1}`. We do **not** have the HTTP mapping.

### 4 · Authentication

- Does the REST API accept the **same bearer JWT** we already have, or does it
  require a different token or grant?
- If different: which OAuth endpoint, grant type and scope?
- Our token has a 30-day life and a `refresh_token`. **Is there a refresh
  endpoint** we should call, or is manual rotation every 30 days the expected
  operating model? (Manual rotation is a production risk we'd like to avoid.)

### 5 · Tenant routing

The JWT carries `Database`, `Server` and a nested `accessToken`.
**How are these conveyed on each request?**

- Custom headers? If so, the exact header names — we're currently guessing
  `X-Investran-Database` / `-Server` / `-AccessToken`.
- Or query parameters, or part of the URL path?
- Or are they implicit in the token and not needed separately?

### 6 · DomainId and EntityId for GL journal import

Job creation takes `DomainId` and `EntityId`. **Which values correspond to
importing GL journal entries?** Or: which endpoint lists valid domains and
entities so we can resolve them at runtime?

### 7 · Template

Is there a named DIU template for GL journal import, and if so **what is its
exact name or ID**? We currently default to `USGAAP_Loan_GL_DIU_Template`, which
was an assumption on our side.

### 8 · Is DIU enabled on this tenant?

Worth confirming it's provisioned for `goldenliveuat` and that our service
account has import permissions — so we don't chase a URL for something that
isn't switched on.

---

## What we'll do with the answers

Point the proxy at the correct base URL, rebuild the six endpoint handlers
against the real contract, and post a test batch. Everything either side of that
hop is already built and tested.

## What good looks like

A working `curl` that creates an import job on `goldenliveuat` would let us
reverse-engineer the rest. If someone has one from Postman or an integration
test, that single example is worth more than all eight answers above.
