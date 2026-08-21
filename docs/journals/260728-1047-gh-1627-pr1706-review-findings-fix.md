---
date: 2026-07-28
session: GH-1627 PR 1706 review findings fix
---

# Journal: 2026-07-28 — GH-1627 PR 1706 Review Findings Fix

## Context

PR #1706 implements Pending Orders plus the intentionally restored Revenue card. Review found that Revenue aggregation bypassed the Orders permission boundary, exposing completed-order revenue to dashboard users who could not read orders.

## What Happened

- Kept the Revenue implementation after scope clarification and documented AC-R01..AC-R08 on issue #1627.
- Added an explicit `user` context to `getGlanceData`, derived tenant scope with `tenantIdForQuery`, and reused the Orders permission gate before executing the Revenue Orders aggregate.
- Users without Orders access now receive zero/empty Revenue and no Orders SQL is executed; analytics metrics remain available.
- Added regression coverage for the denied path and for page orchestration passing the authenticated user.
- Updated the PostgreSQL regression to the required `getGlanceData(period, { user })` signature, kept the real Orders gate active, and added a denied-user database case. The exact container run changed from **1 failed, 1 passed** to **3/3 passed**.
- Synchronized the Revenue plan, phase contract, historical Phase 1 journal, and QA traceability with GH-1627 AC-R01..R08 and the Orders RBAC boundary.
- Dashboard tests, focused RBAC tests, typecheck, lint (**0 errors**, existing repository warnings only), and `git diff --check` passed.
- Existing unrelated changes in `docker-compose.yml`, `scripts/db-migrate-dev.js`, and `docker-compose.worktree.yml` were preserved untouched.

## Reflection

The permission bug was a scope-boundary failure as much as a query bug. Passing the authenticated user to the loader and reusing the Orders gate makes the absence of unauthorized Revenue database access observable and enforceable.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Keep Revenue in PR #1706 after clarification | The user explicitly confirmed the feature and added AC-R01..AC-R08 to #1627 | Review validates both Pending Orders and Revenue |
| Gate Revenue at the loader boundary | Hidden UI is not an authorization boundary | Users without Orders access receive no order-derived Revenue data |

## Next Steps

- Ask the user whether to commit and push the reviewed local code changes.
- Repair or recreate the root-owned `.next` diagnostics directory, then rerun the production build.
- Run the four PostgreSQL-dependent tests in an environment with the test database available.
