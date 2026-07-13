---
title: "AI bulk-parse rate-limit fix (GH-1599)"
description: "Raise bulk-parse limit to 10/hr and surface a reset-countdown toast instead of the wrong parse-error message on 429."
status: completed
priority: P1
effort: 3h
branch: fix/1599-ai-bulk-rate-limit
tags: [bugfix, ai, rate-limit, i18n, dashboard, v1.1]
created: 2026-07-13
---

# AI Bulk-Parse Rate-Limit Fix — GH-1599

Bulk product creation ("Quickly create multiple products") returns HTTP 429 after 5 req/hr, and the
frontend shows the generic `parseError` toast instead of a rate-limit message. Fix = raise limit to
10/hr, return a machine-readable `rateLimitExceeded` code + `resetAt` from the API, and render a
minutes-until-reset toast client-side. Pure API-shape + frontend error-handling + i18n. **No DB /
Payload collection changes — no migration phase.**

- GH issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1599
- Milestone: v1.1 Phase 2 Sprint 4 · Priority: Urgent (P1) · Effort: High

## Error contract (shared between phases — frozen here)

429 response body: `{ error: 'rateLimitExceeded', resetAt: <number ms> }`
Frontend derives minutes: `Math.ceil((resetAt - Date.now()) / 60000)`, min 1.

## Phases

| # | Phase | Status | Owns (file globs) | Depends on |
|---|-------|--------|-------------------|-----------|
| 01 | [Backend: limit bump + 429 response shape + route test](./phase-01-backend-error-response.md) | completed | `src/app/api/ai/products-bulk-parse/route.ts`, `src/__tests__/api/ai.test.ts` | contract above |
| 02 | [Frontend error handling + i18n + parse test](./phase-02-frontend-i18n-and-tests.md) | completed | `src/components/dashboard/BulkCreateModal.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/ms.json`, `src/__tests__/unit/dashboard/bulk-create-parse.test.tsx` | contract above |

Phases touch disjoint files and both consume the frozen contract → **parallelizable**. If run solo,
either order works; do 01 first so the real response can be manually verified end-to-end.

## Key dependencies / conventions

- `checkRateLimit(key, limit, windowMs)` already returns `{allowed, remaining, resetAt}` — just plumb
  `resetAt` through; no change to `src/lib/rateLimit.ts`.
- Reuse the existing `isSkuConflictError` pattern (`JSON.parse(err.message)`) — throw
  `new Error(JSON.stringify(data))` on non-ok; do NOT invent a new error channel.
- **Trap:** catch block currently does `errBase.message === 'aiQuotaExceeded'`. Switching the throw to
  JSON breaks that unless the catch is refactored to parse once and switch on `parsed.error`. Phase 02
  handles this (keeps aiQuotaExceeded / aiTimeout working). See phase-02 Risk.
- i18n placeholder convention: `.replace('{minutes}', n)` mirroring existing `{count}` usage.
- Locales: only `en` + `ms` exist (`Locale = 'en' | 'ms'`). No `vi.json` — issue's "VI" N/A.

## Success criteria (whole plan)

1. Route returns 429 `{error:'rateLimitExceeded', resetAt:number}` when limited; `checkRateLimit`
   called with limit `10`.
2. Modal shows the reset-countdown toast (correct minutes) on 429; aiQuotaExceeded/aiTimeout/parseError
   toasts still work.
3. Both locales have `rateLimitExceeded` with `{minutes}` placeholder.
4. `npm test` green; new focused tests cover both the route 429 shape and the modal toast.

## Validation Summary

**Validated:** 2026-07-13
**Questions asked:** 3

### Confirmed Decisions
- Branch: `fix/1599-ai-bulk-rate-limit` (git-manager cuts this off `staging`, not off `main` — repo is staging-first). Frontmatter `branch:` above still says `staging` as recorded at plan-creation time; update to `fix/1599-ai-bulk-rate-limit` once the branch is cut.
- Tests: descriptive names only, no TC-ID (bug has no `docs/qa/F*.md` slot — matches project convention for untracked bug fixes).
- MS translation (`rateLimitExceeded` in `ms.json`): **blocks merge** — needs a native Bahasa Melayu speaker to review the provided string before the PR can merge to staging. Add this as an explicit PR checklist item / reviewer request, not a "ship and fix later" item.

### Action Items
- [x] Branch `fix/1599-ai-bulk-rate-limit` cut from `staging`; frontmatter updated.
- [ ] Before merge: get native MS-speaker review/sign-off on `ms.json`'s new `rateLimitExceeded` string (phase-02 step 4); do not merge PR to staging until confirmed.
