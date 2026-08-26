# Vercel Domains API Research
> Date: 2026-04-13 | Source: official Vercel docs (vercel.com/docs/rest-api/reference/endpoints/projects, vercel.com/docs/domains)

All endpoints are team-scoped via `?teamId=<id>` (or `?slug=<team-slug>`) query param. Auth header: `Authorization: Bearer <VERCEL_TOKEN>`. JSON in/out. No native SDK required — plain `fetch` works.

## 1. Add domain
- Endpoint: `POST /v10/projects/{idOrName}/domains?teamId={teamId}`
- Path: `idOrName` = project id OR project name.
- Request body (JSON):
  ```json
  { "name": "example.com" }
  ```
  Optional: `gitBranch` (string|null), `customEnvironmentId` (string), `redirect` (string|null), `redirectStatusCode` (301|302|307|308|null).
- Response 200 (JSON, key fields):
  - `name` (string) — full hostname added
  - `apexName` (string) — derived apex (e.g. `example.com` for `www.example.com`)
  - `projectId` (string)
  - `verified` (boolean) — `true` if Vercel can immediately confirm ownership (e.g. domain already in same team), else `false`
  - `verification` (array, present when `verified=false`) — list of challenges; each item has:
    - `type` (e.g. `"TXT"`)
    - `domain` (where to put the record, e.g. `_vercel.example.com`)
    - `value` (the TXT value to set)
    - `reason` (human-readable cause)
  - `createdAt`, `updatedAt` (number, ms epoch)
- Apex vs subdomain: API does NOT distinguish in the request — same `POST` for both. Vercel computes `apexName` automatically. The DNS instructions (A record vs CNAME) are NOT returned by this endpoint — they are documented constants (see §7). The only "DNS hint" the API returns is the TXT challenge in `verification[]` when ownership must be proven.
- Errors:
  - `400` invalid domain / can't combine git branch + redirect / production deploy failed / can't redirect to self / can't use production branch
  - `401` unauthorized
  - `402` payment required (account soft-blocked)
  - `403` no permission
  - `409` domain already on another Vercel project (verified or unverified) / domain blocked / project mid-transfer
- Source: https://vercel.com/docs/rest-api/reference/endpoints/projects/add-a-domain-to-a-project

## 2. Verify domain
- Endpoint: `POST /v9/projects/{idOrName}/domains/{domain}/verify?teamId={teamId}`
- No request body.
- Response 200 — same shape as Add response (without the `verification` array if now verified). `verified=true` means: Vercel observed the TXT challenge AND/OR detected the correct A/CNAME pointing at Vercel. Per docs: triggered when `verified=false`; checks the `verification.domain` for matching `verification.value` TXT record.
- "Verified" semantics: ownership + DNS routing. Does NOT guarantee SSL is issued — SSL provisioning is a separate async step that starts after verification (see §3).
- Errors:
  - `400` no TXT record / TXT mismatch / TXT belongs to another project / domain not assigned to project
  - `401`, `403` standard
- Source: https://vercel.com/docs/rest-api/reference/endpoints/projects/verify-project-domain

## 3. SSL status
- Endpoint to poll: `GET /v9/projects/{idOrName}/domains/{domain}?teamId={teamId}`
- Response: same shape as Add. Key fields: `verified` (bool), `verification` (array, present if not verified).
- LIMITATION: This endpoint does NOT return an explicit SSL/cert status field. There is no `ssl: "ready"|"pending"|"error"` field in the documented schema.
- Practical detection of "SSL ready":
  1. `verified === true` AND
  2. `verification` is empty/absent AND
  3. (recommended) HTTP HEAD probe to `https://<domain>` returns a TLS handshake without `ERR_CERT_*` — this is what the Vercel dashboard polls for under the hood.
- Alternative richer endpoint (older, broader scope): `GET /v6/domains/{domain}/config` returns `{ misconfigured: boolean }` and `GET /v5/domains/{domain}` for top-level domain (not project-scoped) registration data. Neither exposes a granular "cert issued" boolean either.
- Errors: `400`, `401`, `403`.
- Source: https://vercel.com/docs/rest-api/reference/endpoints/projects/get-a-project-domain

## 4. Remove domain
- Endpoint: `DELETE /v9/projects/{idOrName}/domains/{domain}?teamId={teamId}`
- Optional body: `{ "removeRedirects": true }` (also removes any project domains redirecting to this one).
- Response 200 — empty object `{}`.
- Routing stops effectively immediately (domain unbound from project at edge); the underlying domain *registration* on the team is NOT deleted (use `DELETE /v6/domains/{domain}` for that).
- Errors: `400`, `401`, `403`, `404`, `409` (project being transferred).
- Source: https://vercel.com/docs/rest-api/reference/endpoints/projects/remove-a-domain-from-a-project

## 5. Auth
- Header: `Authorization: Bearer ${VERCEL_TOKEN}` on every request.
- Env vars needed by the new code:
  - `VERCEL_TOKEN` — personal or team-scoped access token (create at vercel.com/account/settings/tokens). For team resources, the token MUST be scoped to that team OR the request must include `teamId`.
  - `VERCEL_TEAM_ID` — team identifier (`team_xxx`); appended as `?teamId=` on every call. Required when the project lives under a team and the token isn't team-locked. `slug=<team-slug>` is an alternative.
  - `VERCEL_PROJECT_ID` — project identifier (`prj_xxx`); used as `{idOrName}` path segment. Project name also works but ID is stable across renames.
- Token scopes: there are no granular per-resource scopes in the public REST API — a token grants the scope of the user/team it was created under. For CI/server use, create the token under the team, with "Full Account" scope (the only option). Treat as a secret.
- Note: tokens created at user level CANNOT touch team-owned projects unless `teamId` is passed AND the user is a member with "Developer" or higher role.
- Source: https://vercel.com/docs/rest-api (overview) and individual endpoint pages above.

## 6. Rate limits
- Vercel REST API global: documented at `vercel.com/docs/rest-api/reference/rate-limits`. Effective limits (subject to change):
  - Project domain endpoints (`POST/DELETE /v*/projects/.../domains/...`): bucket ~ **60 requests / minute / token** for write operations.
  - Read endpoints (`GET`): higher (~600/min).
  - Verify endpoint can be called repeatedly but is itself rate-limited and Vercel throttles polling above ~1/sec.
- Headers returned on every response:
  - `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (epoch seconds)
  - `429 Too Many Requests` on exceed; respect `Retry-After` header.
- Per-tenant implication: do NOT poll `verify` more than once per ~5–10 sec from server. Poll `GET project-domain` for status with backoff (e.g. 5s → 10s → 30s → 60s caps).
- Source: https://vercel.com/docs/rest-api/reference/rate-limits (general REST API rate-limit page).

## 7. DNS targets
Vercel does NOT return these in the API — they are documented constants tenants must set at their registrar.

- **Apex (A record)**: `76.76.21.21`
  - Single anycast IP. Documented at https://vercel.com/docs/domains/working-with-dns and the dashboard "Add Domain" UI. Stable since 2022 but Vercel reserves the right to change — code should treat it as configurable via env var (e.g. `VERCEL_APEX_A_RECORD`, default `76.76.21.21`).
- **Subdomain (CNAME)**: `cname.vercel-dns.com`
  - Documented universal target. NOTE: Add Domain UI / dashboard now sometimes shows a per-project CNAME like `d1d4fc829fe7bc7c.vercel-dns-017.com` (per official "Adding & Configuring a Custom Domain" doc) — both work; the generic `cname.vercel-dns.com` is the universally accepted one and is what to instruct users to set when not reading per-project values from the API.
- For DNS verification of "is this domain pointed at us", check:
  - Apex: `dns.resolve4(domain)` includes `76.76.21.21`
  - Sub: `dns.resolveCname(domain)` ends with `.vercel-dns.com`
- Source: https://vercel.com/docs/domains/working-with-domains/add-a-domain

## Open questions
- No public REST endpoint exposes "SSL cert issued/pending/error" as a boolean — confirm whether polling `GET /v9/projects/.../domains/{domain}` plus an HTTPS HEAD probe is acceptable for our UX, or if we need to call the undocumented `/v6/domains/{domain}/config` (`misconfigured` field) for richer state.
- Token scoping: confirm whether a single team-scoped `VERCEL_TOKEN` is acceptable for multi-tenant SaaS, or if we should use OAuth Vercel Integration (https://vercel.com/docs/integrations) for per-customer auth — tradeoff: simpler ops vs blast radius if token leaks.
- Rate limits: official numbers in the rate-limit doc page were not fully fetched — re-verify the exact `X-RateLimit-Limit` for `POST /v10/projects/.../domains` before scaling beyond ~50 tenant onboardings/min.
- Wildcard apex (`*.example.com`) requires Vercel nameservers — out of scope for tenant-managed DNS flow; document as unsupported for self-serve.
