# QA Full Report — Vercel Migration Regression

## Summary
- **Date:** 2026-04-11
- **Branch:** staging-vercel
- **Scope:** Vercel + Neon migration (Phase 1-2) regression testing
- **Target:** https://ech-prime-web-v2-env-staging-nguyen-phuongs-projects.vercel.app

## Results

| Category | Status |
|----------|--------|
| **Typecheck** | ✅ 0 new errors (5 pre-existing) |
| **Unit + Integration** | ✅ 3690/3690 pass |
| **New Migration Tests** | ✅ 61 tests (middleware, polling, db-setup) |
| **Security Audit** | ⚠️ 26 vulnerabilities (pre-existing, deps) |
| **E2E** | ⏭ Skipped (needs custom domain) |
| **API Health** | ✅ DB connected, latency 207ms |
| **Login API** | ✅ 200 OK |

## Fixes Applied (Bước 5)
1. `live-toast.test.tsx` — Rewritten from SSE mock → polling mock (3 tests)
2. `f19-domains-client.test.tsx` — `getByText(/CNAME/)` → `getAllByText` (multiple elements)

## Test Files Created
- `src/__tests__/unit/migration/vercel-middleware.test.ts` — 22 tests
- `src/__tests__/unit/migration/vercel-notification-polling.test.tsx` — 19 tests
- `src/__tests__/unit/migration/vercel-db-setup.test.ts` — 20 tests

## Gaps Remaining
- E2E tests need custom domain (Phase 4)
- Stripe/S3 env vars not set → related features untestable
- npm audit: 7 high + 4 critical (dependency issues, not migration code)

## Verdict: ✅ PASS WITH WARNINGS

Migration code is solid. All unit/integration tests pass. Warnings are pre-existing dependency vulnerabilities and missing optional env vars (Stripe, S3).
