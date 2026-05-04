---
title: "Sentry Integration for Next.js 15 + Payload CMS 3"
description: "Wire @sentry/nextjs into existing Vercel CI pipeline with server/client/edge configs, source-map upload, and Postgres + AI gen tracing."
status: pending
priority: P2
effort: 4h
branch: feat/sentry-integration
tags: [monitoring, observability, sentry, vercel, ci]
created: 2026-05-04
---

# Sentry Integration

## Goal

Add error monitoring + perf tracing (Sentry) for staging + production. Capture: server errors, client errors, Postgres query spans, AI gen pipeline spans (`src/lib/ai/`). Source maps uploaded via CI, then deleted from bundle.

## Why

Recurring AI gen 500s on staging are hard to debug from Vercel logs alone. Need stack traces, request context, and span timings. Quota-conscious config (filter 4xx, sample 0.1 in prod).

## Scope (YAGNI)

In:
- `@sentry/nextjs@10.50.0` install + 3 SDK init files (server/client/edge)
- `instrumentation.ts` + `instrumentation-client.ts` + `app/global-error.tsx`
- `next.config.ts` `withSentryConfig` wrap with tunnel route
- `src/middleware.ts` matcher exclusion for `/sentry-tunnel`
- Env var placeholders in both `.env.*.example` files
- CI source-map upload step (GitHub Secrets: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`)
- Custom span instrumentation for `src/lib/ai/` entry points
- Smoke verification (test error route, dashboard event check)

Out:
- `@payloadcms/plugin-sentry` (skipped — manual setup gives more control over Payload internals)
- Replay (Session Replay) — defer until quota usage understood
- User feedback widget — defer
- Profiling — defer
- Custom dashboards / alerts — done in Sentry UI later, not via code

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 01 | Install SDK + create config files | pending | 1h | [phase-01-install-and-config-files.md](phase-01-install-and-config-files.md) |
| 02 | Wire `next.config.ts` + middleware exclusion | pending | 30m | [phase-02-nextconfig-and-middleware.md](phase-02-nextconfig-and-middleware.md) |
| 03 | Env files + CI source-map upload | pending | 1h | [phase-03-env-and-ci.md](phase-03-env-and-ci.md) |
| 04 | Verification + smoke tests | pending | 1.5h | [phase-04-verification-and-testing.md](phase-04-verification-and-testing.md) |

## Dependency graph

```
01 (configs) ──► 02 (next.config + middleware) ──► 03 (env + CI) ──► 04 (verify)
```

Sequential. Each phase depends on previous. No parallelization — single fullstack-developer agent owns all phases.

## File ownership

Single agent. Files touched (atomic — no parallel split):
- Root: `package.json`, `package-lock.json`, `next.config.ts`
- New root files: `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `instrumentation-client.ts`
- `src/middleware.ts`, `src/app/global-error.tsx` (new)
- `src/lib/ai/sentry-spans.ts` (new helper)
- `.env.staging.example`, `.env.production.example`
- `.github/workflows/ci.yml`

## Pre-flight checks (verified)

- `instrumentation.ts` does NOT exist — safe to create
- `instrumentation-client.ts` does NOT exist — safe to create
- `src/app/global-error.tsx` does NOT exist — safe to create
- `next.config.ts` exists, exports via `withPayload(nextConfig)` — must wrap with `withSentryConfig` outside `withPayload`
- `src/middleware.ts` matcher already excludes `/api/`, `_next/static`, `_next/image`, `favicon.ico` — must add `sentry-tunnel`
- Vercel env: `staging` is a **custom environment** (not Preview) — Sentry vars must be added to that scope explicitly
- CI source-map upload: GitHub Secrets path (these are CI tooling secrets, NOT app runtime → correct per `env-vars.md`)

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `withSentryConfig` breaks Turbopack dev | Med | Med | Sentry 10.x supports Turbopack; pin exact version `10.50.0`; test `npm run dev` in phase 04 |
| Source maps leak to public bundle | Low | High | `widenClientFileUpload: false`, `deleteSourcemapsAfterUpload: true` — both set in phase 02 |
| Sentry tunnel intercepted by middleware → 500 on event ingestion | Med | Med | Add `sentry-tunnel` to matcher exclusion in phase 02; verify in phase 04 with browser devtools |
| AI gen spans flood quota | Med | Med | `tracesSampleRate` prod=0.1; only wrap entry points in `src/lib/ai/`, not every helper |
| Build fails when `SENTRY_AUTH_TOKEN` missing locally | High | Low | Source-map upload is no-op without token (Sentry SDK skips silently); document in `.env.example` |
| Vercel custom env `staging` doesn't inherit `SENTRY_DSN` | Med | High | Phase 03 explicit instruction: add to `Production` + `Custom: staging` scopes (not Preview) |
| Payload admin panel JS errors flood Sentry from internal Payload UI | Low | Med | `beforeSend` filter: drop events with `event.request.url.match(/\/admin/)` if noisy (defer to phase 04 if observed) |
| Multipart form-data bodies captured by Sentry → leak file uploads | Med | High | `sendDefaultPii: false`, `maxRequestBodySize: 'small'`, `beforeSend` strips `body` from `/api/media/*` |

## Backwards compatibility

- No DB schema changes → no migration entry
- No API contract changes → no breaking changes for clients
- Adding env vars only — missing vars cause Sentry SDK to no-op (init without DSN = disabled). Existing local-dev users without `SENTRY_DSN` see no behavior change.
- `next.config.ts` wrap is additive — Payload still wrapped via `withPayload`, Sentry adds outer wrapper.

## Rollback plan

Per phase:
- **01**: `git checkout` removes new files; `npm uninstall @sentry/nextjs` reverts package.json. No state changes.
- **02**: `git checkout next.config.ts src/middleware.ts` — restores original wrap and matcher.
- **03**: Remove env placeholders from `.env.*.example`; remove CI step. GitHub Secrets stay (no harm).
- **04**: N/A (verification only).

Full rollback: revert the merge commit on `staging`. No data migration to undo. Sentry project on dashboard can be left dormant or deleted.

## Test matrix

| Test | Type | Phase | Owner |
|------|------|-------|-------|
| Unit: `sentry-spans.ts` wrapper preserves return value + throws | Unit | 04 | tester |
| `npm run dev` starts without errors | Manual | 04 | dev |
| `npm run build` succeeds locally without `SENTRY_AUTH_TOKEN` | Manual | 04 | dev |
| `npm run typecheck` passes after wrap | CI | 04 | CI |
| `npm run lint` passes | CI | 04 | CI |
| Test error route `/api/sentry-test` triggers server event in dashboard | E2E | 04 | dev |
| Client error in `global-error.tsx` triggers client event | E2E | 04 | dev |
| Tunnel route `/sentry-tunnel` returns 200, NOT 308/500 | E2E | 04 | dev |
| Source maps absent from `/_next/static/*.map` after build | E2E | 04 | dev |
| AI gen request creates a span visible in Sentry trace | E2E | 04 | dev |
| Postgres query span appears under server transaction | E2E | 04 | dev |

## Success criteria (measurable)

- [ ] `npm run dev` + `npm run build` + `npm run typecheck` all green locally
- [ ] CI green on PR `feat/sentry-integration` → `staging`
- [ ] Sentry dashboard shows at least 1 server event from staging deploy (test endpoint)
- [ ] Sentry dashboard shows at least 1 client event from staging (manual error trigger)
- [ ] Sentry trace shows AI gen span ≥ 1 nested PG query span
- [ ] No `*.map` files in deployed bundle (curl `https://web-v2.dev.ecommercehub.my/_next/static/chunks/*.js.map` → 404)
- [ ] No regression in existing `/api/*` endpoints (curl `/api/health` returns 200)
- [ ] `/sentry-tunnel` returns 200 (browser devtools network tab during page load)

## Open questions

1. Sentry org/project name — does the team already have a Sentry org or do we provision new one? Need owner to confirm before Phase 03.
2. AI gen entry-point list — Phase 01 instruments `generateSite()` only; do we also want `editSection()` and `bulkParse()` in v1, or wait for quota signal?
3. PII sweep — staging emails are real (e2e-bot@primeweb.app etc); confirm `sendDefaultPii: false` is sufficient or need to scrub `payload-token` cookie explicitly in `beforeSend`.
