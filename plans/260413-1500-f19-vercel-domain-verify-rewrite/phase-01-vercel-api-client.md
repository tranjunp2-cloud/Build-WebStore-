# Phase 01 — Vercel API client wrapper

## Context
- Parent: [plan.md](./plan.md)
- Depends on: none (foundation)
- Vercel docs:
  - https://vercel.com/docs/rest-api/reference/endpoints/projects/add-a-domain-to-a-project
  - https://vercel.com/docs/rest-api/reference/endpoints/projects/verify-project-domain
  - https://vercel.com/docs/rest-api/reference/endpoints/projects/get-a-project-domain
  - https://vercel.com/docs/rest-api/reference/endpoints/projects/remove-a-domain-from-a-project
  - https://vercel.com/docs/rest-api/reference/rate-limits

## Overview
- Date: 2026-04-13
- Description: Build typed `fetch`-based client for the 4 Vercel project-domain endpoints used by F19.
- Priority: P0 (foundation for phase 03)
- Implementation status: pending
- Review status: pending

## Key insights
- No SDK needed — 4 endpoints, plain `fetch`, ~150 LOC.
- Every call must include `?teamId=<VERCEL_TEAM_ID>` (or `?slug=`).
- `429` responses carry `Retry-After` (seconds) — wrapper must surface this so callers can decide retry vs fail-fast.
- Vercel returns rich error JSON (`{ error: { code, message } }`) — preserve `code` upstream for action-level mapping (e.g. `domain_already_in_use` → tenant-friendly toast).

## Requirements
- Pure module, server-only (`import 'server-only'`).
- Reads env at call time (not import time) so tests can override.
- Throws `VercelDomainsError` (custom class) with `{ status, code, message, retryAfter? }`.
- Each function returns the parsed JSON shape documented in researcher-01.
- Zero external deps beyond Node `fetch` (Node 18+).

## Architecture
```
src/lib/vercel/
  domains.ts          // exported functions
  domains.types.ts    // VercelDomain, VercelDomainVerification, VercelDomainsError
  domains.test.ts     // unit tests w/ vi.stubGlobal('fetch', ...)
```

Functions:
- `addProjectDomain(name: string): Promise<VercelDomain>`
- `verifyProjectDomain(domain: string): Promise<VercelDomain>`
- `getProjectDomain(domain: string): Promise<VercelDomain>`
- `removeProjectDomain(domain: string, opts?: { removeRedirects?: boolean }): Promise<void>`
- internal `vercelFetch(path, init)` — injects auth header, teamId query, parses errors

## Related code files
- New: `src/lib/vercel/domains.ts`
- New: `src/lib/vercel/domains.types.ts`
- New: `src/lib/vercel/domains.test.ts`
- Reference (existing webhook handler, pattern): `src/app/api/webhooks/vercel/route.ts`

## Implementation steps
1. Create `domains.types.ts` mirroring researcher-01 §1 response shape — `VercelDomain { name, apexName, projectId, verified, verification?, createdAt, updatedAt }`, `VercelDomainVerification { type, domain, value, reason }`.
2. Create `VercelDomainsError extends Error` with typed fields.
3. Implement `vercelFetch`: build URL with `teamId`, set `Authorization: Bearer ${VERCEL_TOKEN}`, set `Content-Type: application/json`, on `!res.ok` parse `error.code/message`, capture `Retry-After`, throw.
4. Implement 4 wrappers, each calling `vercelFetch` with the right method/path/body.
5. Add env validation helper `assertVercelEnv()` — throws clear message naming missing var, called inside each wrapper (lazy so import doesn't crash).
6. Write unit tests — happy path + 400 (TXT mismatch), 401, 404, 409 (already in use), 429 (with retryAfter parsed).

## Todo
- [ ] `domains.types.ts` with full response shape
- [ ] `VercelDomainsError` class
- [ ] `vercelFetch` helper with teamId + auth + error parsing
- [ ] `addProjectDomain` (POST `/v10/projects/{id}/domains`)
- [ ] `verifyProjectDomain` (POST `/v9/projects/{id}/domains/{domain}/verify`)
- [ ] `getProjectDomain` (GET `/v9/projects/{id}/domains/{domain}`)
- [ ] `removeProjectDomain` (DELETE `/v9/projects/{id}/domains/{domain}`)
- [ ] `assertVercelEnv()` helper
- [ ] Unit tests cover all 4 fns + error mapping
- [ ] `tsc --noEmit` clean

## Success criteria
- All 4 wrappers exported with strict types.
- Tests: ≥6 cases, all green.
- Calling any wrapper without `VERCEL_TOKEN`/`VERCEL_TEAM_ID`/`VERCEL_PROJECT_ID` throws explicit error naming the missing var.
- `429` propagates `retryAfter` so callers can act on it.

## Risk assessment
- Low. Self-contained module. No runtime callers until phase 03 lands.
- Edge: Vercel may rename undocumented response fields — mitigated by treating unknown fields as optional in TS types and not destructuring beyond what we need.

## Security considerations
- `VERCEL_TOKEN` is a full-account-scope secret. Never log it. Never include in error messages bubbled to client. Action layer (phase 03) must scrub before `revalidatePath`.
- Tag module `import 'server-only'` so accidental client import fails build.
- No PII in URLs — domain names are tenant-public, fine to log at info level.

## Next steps
- Phase 03 will import these wrappers. Phase 02 (schema) can run in parallel.

## Open questions
- Do we want exponential-backoff retry baked into `vercelFetch`, or leave that to callers? Recommendation: leave to callers (phase 03 handles single-shot verify; backfill script in phase 06 handles its own retry).
