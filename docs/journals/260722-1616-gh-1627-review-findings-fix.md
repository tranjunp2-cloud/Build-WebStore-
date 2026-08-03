---
date: 2026-07-22
session: GH-1627 review findings fix
---

# Journal: 2026-07-22 — GH-1627 Review Findings Fix

## Context

The initial code-review cycle for GH-1627 found two focused correctness gaps in the Pending Orders widget: its zero-order markup did not follow the dashboard's canonical empty-state contract, and the loader accepted fractional item counts as valid order data. A follow-up adversarial review found unsafe-integer and cumulative-overflow boundaries plus documentation and test-contract inaccuracies.

## What Happened

- Red baseline: the focused suite reported **2 failed / 30 passed**.
- Root cause 1: the ready-with-zero-orders path reused the unavailable-state `.po-state` structure instead of the established `.card > .empty-block > .eb-ic + h5 + p` dashboard markup.
- Root cause 2: item-count validation accepted any finite positive number, including fractional values such as `1.5`.
- The empty path now renders the canonical dashboard empty-state structure; the unavailable path remains a distinct `.po-state` presentation.
- The initial loader fix required `Number.isInteger(quantity) && quantity > 0`, and the malformed-row fixture covered the fractional case.
- The follow-up fix requires positive safe-integer quantities, skips additions that would make the cumulative count unsafe, and strengthens the direct-child empty-state selector.
- Numeric boundary regression tests failed **2/29** before the follow-up production fix and then passed in the focused **34/34** suite.
- The full dashboard suite passed **1064/1064** tests; TypeScript typecheck and `git diff --check` also passed.
- Lint completed with **0 errors** and **137 pre-existing repo-wide warnings**.
- The production build could not reach compilation because the root-owned `.next/diagnostics` path raised `EACCES`; this is an environment/ownership blocker, not a verified compile failure.
- The architecture and QA docs now describe the actual RBAC exceptions and safe-integer policy.

## Reflection

The failures came from implicit UI and data-integrity contracts that TypeScript alone could not enforce. Converting both expectations into focused regression tests made the intended behavior explicit without widening the implementation scope.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Use the shared dashboard empty-state DOM contract only for the ready/empty path | Keeps visual consistency while preserving a semantically distinct load-failure state | Existing dashboard styling and selectors apply correctly |
| Ignore invalid or unrepresentable item quantities in the server mapper | Order item quantities must be positive safe integers and their cumulative sum must remain safe | Malformed CMS rows cannot display misleading quantities |
| Keep review fixes narrowly scoped | Both findings were isolated and already covered by the focused suite | No unrelated source or documentation changes |

## Next Steps

- Run credentialed E2E once `TEST_EMAIL` and `TEST_PASSWORD` are available.
- Complete visual/manual QA at 375px, 768px, and 1280px, including keyboard focus, RBAC, and cross-tenant checks.
- Repair ownership or recreate `.next` in a writable environment, then rerun the production build.
- Treat the passing automated suites as code-level verification only; visual and environment-dependent validation remain open.
