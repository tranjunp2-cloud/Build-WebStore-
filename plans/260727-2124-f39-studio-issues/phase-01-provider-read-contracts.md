# Phase 1: Build Provider Read Contracts

## Context Links

- [Implementation plan](./plan.md)
- [Delivery gates](./phase-00-validate-delivery-gates.md)
- [F39 PRD: Provider, API, and data contract](../../docs/prd/F39-studio-log-issue-tracking.md#10-provider-api-and-data-contract)

## Overview

- **Priority:** P1
- **Status:** Code complete; live provider gate pending
- **Effort:** 3h
- **Acceptance criteria:** AC-01–AC-11; AC-14 blocked pending stable Vercel refetch

## Architecture

`provider response → strict adapter → positive-allowlist sanitizer → tenant resolver → deterministic guidance → temporary LiveError DTO`

Sentry and Vercel execute through separate UI requests. No provider fetch writes to Payload or PostgreSQL.

## Requirements

### Functional

- Support bounded Sentry list/detail and bounded current-production Vercel reads.
- Return one normalized DTO and distinguish empty success from unavailable source.
- Resolve platform subdomains and active custom domains; otherwise return `Unknown`.
- Generate deterministic guidance for every PRD category.

### Non-functional

- Provider credentials stay server-only.
- Sanitization occurs before logging, hashing, response serialization, or later promotion.
- The route uses super-admin auth, validated input, `maxDuration <= 60`, and internal deadlines at or below 10 seconds.

## Related Code Files

- **Create:** `src/lib/admin/live-errors/contracts.ts`
- **Create:** `src/lib/admin/live-errors/sanitize-evidence.ts`
- **Create:** `src/lib/admin/live-errors/provider-key.ts`
- **Create:** `src/lib/admin/live-errors/resolve-tenant.ts`
- **Create:** `src/lib/admin/live-errors/guidance.ts`
- **Create:** `src/lib/admin/live-errors/providers/sentry.ts`
- **Create:** `src/lib/admin/live-errors/providers/vercel.ts`
- **Create:** `src/app/api/admin/issues/providers/route.ts`
- **Modify:** `.env.example`, `.env.staging.example`, `.env.production.example` for a runtime `SENTRY_READ_TOKEN` placeholder and accurate runtime org/project comments
- **Create tests:** `src/__tests__/unit/f39/*.test.ts`, `src/__tests__/api/f39-issue-providers.test.ts`

## Implementation Steps

1. Define `LiveError` with only source, opaque provider ID, occurred time, severity, capped message, normalized host, minimal tenant match, route without query/fragment, method, status, release/deployment ID, request/trace ID, five in-application frames, provider URL, guidance, and fetch timestamp.
2. Parse provider-native objects inside strict adapters. Discard unknown keys recursively; never return raw objects.
3. Cap message at 1,000 characters and frames at five. Exclude cookies, auth headers, all query parameters, bodies, prompts, breadcrumbs, locals, variables, email, IP, and arbitrary metadata.
4. Redact token/email/IP canaries inside allowed strings and restrict provider links to expected HTTPS hosts.
5. Implement Sentry list mode for unresolved production issues and detail mode for the latest event only when selected.
6. Implement Vercel production-deployment resolution and bounded qualifying-row read using the Phase 0 contract.
7. Add `GET /api/admin/issues/providers` with validated `source=sentry|vercel`; allow item refetch for Sentry and fail closed for Vercel item IDs until the live contract proves stable re-identification. Map provider failures to safe `502/504`; never report failure as empty success.
8. Normalize host casing, port, and trailing dot. Use tenant slug lookup for platform subdomains and custom-domain lookup for other hosts; expose safe tenant ID/slug/name only.
9. Implement approved guidance for 500–503, 504/timeout, 401/403, 404, 429, application exception, and unmatched evidence. Always return area, two checks, escalation condition, and `Suggested next checks` labeling.
10. Compute stable identity: Sentry group/issue ID; Vercel SHA-256 over normalized domain, method, path, status, and exact sanitized message.
11. Preserve exact non-empty request/trace ID only for optional relation. Never correlate by time, similar message, tenant, or model inference.
12. Require a provider ID that the server can refetch before promotion. Sentry meets this code contract; Vercel promotion remains disabled because its content hash cannot re-identify a transient stream row.

## Todo

- [x] Normalized DTO contains allowlisted fields only
- [x] Sentry list/detail and Vercel bounded read pass contract tests
- [x] Empty, unavailable, timeout, and rate-limit states remain distinct
- [x] Custom domain, platform subdomain, and `Unknown` pass
- [x] Every category returns approved deterministic guidance
- [x] Stable provider key and exact-correlation tests pass
- [x] Provider fetch/detail performs zero DB writes

## Success Criteria

- AC-01–AC-11 backend contracts pass.
- Secret canaries are absent from serialized DTOs and test logs.
- One failed source cannot block a separately requested source.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Unbounded provider response | Timeout/memory pressure | AbortController, count/size caps |
| Sanitized strings still contain secrets | Leakage | Value-level redaction plus canary tests |
| Cached tenant lookup is stale | Wrong attribution | Reuse existing invalidation; never infer on miss |

## Next Step

Expose only the normalized contract in the existing Issues UI.
