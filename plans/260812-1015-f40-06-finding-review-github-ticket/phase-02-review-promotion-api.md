# Phase 02 — Protected review and idempotent GitHub promotion

## Overview

Priority: P1. Expose safe finding data and make confirmation the single authority that can
create a GitHub issue.

## Related files

- Create `src/app/api/admin/qa/findings/route.ts` and
  `src/app/api/admin/qa/findings/[id]/promotion/route.ts` (plus a focused lifecycle route only
  when needed).
- Modify `src/lib/admin/qa/github-issues.ts` and the Phase 01 finding service.
- Reuse `src/lib/admin/api-utils.ts`, US-F40-05 `qa_github_issues`, and its sync/upsert helper.

## Steps

1. Implement paginated safe finding summaries/detail projections. Require `withSuperAdmin`;
   validate query/body with `.strict()` schemas; validate numeric IDs; use force-dynamic and
   Vercel-safe duration.
2. Implement explicit cancel/review actions that change only internal lifecycle/audit and never
   call GitHub.
3. Extend the existing server-only GitHub App helper, not browser code, with bounded
   create/search-by-marker/retry behavior. Validate repository and returned issue URL/number.
4. On confirm, acquire a promotion lease/transactional state. Reconcile deterministic marker
   before a POST and after timeout/remote-success-local-failure; attach exactly one mirror issue
   record and audit actor/time.
5. Build title/body solely from safe fields: target marker, severity, reproduction from
   TC-ID/assertion/expected-actual, PR/SHA when available, and approved signed evidence links.
6. Return generic safe service errors. A GitHub failure leaves the finding reviewable/active,
   preserves evidence and records a bounded non-secret failure state. Never leak token or body.

## Done

- [x] No route or runner auto-promotes a finding.
- [x] Concurrent/double confirmation and retry yield one remote issue.
- [x] Failed promotion does not lose the internal finding.
- [x] All protected endpoints reject unauthenticated/non-super-admin callers before work.
