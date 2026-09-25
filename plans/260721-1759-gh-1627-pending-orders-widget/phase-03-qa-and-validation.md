# Phase 03 — QA traceability and regression validation

## Context Links

- Plan: [plan.md](./plan.md)
- Depends on: [Phase 01](./phase-01-secure-data-contract-and-loader.md), [Phase 02](./phase-02-dashboard-integration-and-ui.md)
- Test convention: `docs/TEST_CONVENTION.md`
- QA matrix: `docs/qa/F03-dashboard.md`
- Component gold standard: `src/__tests__/unit/localization/f21-localization.test.tsx`

## Overview

- **Priority:** P1 quality gate
- **Status:** Completed
- **Effort:** 4h
- Add AC-level loader/page/component/config coverage, repair directly conflicting F03 mappings, and run dependency install before focused/broad validation.

## Key Insights

- Existing `dashboard-blocks.test.ts` asserts `orders.soon === true`; this must flip while retaining `visible === false`.
- QA `TC-F03.04` still expects `/dashboard/orders/:id`, but the real route-group URL is `/orders/{id}`.
- QA has no Pending Orders empty-state TC; the next free ID is `TC-F03.72`.
- Existing tests misuse `.03/.04/.09/.10` for tabs, tenant auth, greeting/site grid, and legacy Pending Orders. These collide directly with the QA rows this issue implements.
- No new page/route is created, so AGENTS.md does not require a new Playwright E2E file. Real responsive/focus CSS still needs a manual browser pass.
- Local typecheck currently misses three packages already declared in package.json/lockfile. A clean `npm ci` must restore them; baseline errors are not an acceptable final gate.

## Requirements

### Automated

- Tests import the real loader/component/utils; no reimplemented production logic.
- `vi.mock()` declarations stay at file top; every test uses AAA and a QA TC-ID.
- Cover data, count > visible rows, empty, unavailable, exact href, no locked copy, default-off/no-Soon, real page gate/RBAC suppression, and isolated loader failure.

### Manual

- Validate 1280px desktop, 768px tablet, and 375px mobile; optionally probe 820px around the existing breakpoint.
- Validate mouse hover and keyboard Tab/Enter/focus ring.
- Validate owner/full/custom-with-orders/custom-without-orders and two-tenant isolation scenarios.

## Related Code Files

| Action | Absolute path | Change |
|---|---|---|
| Modify | `./docs/qa/F03-dashboard.md` | Correct TC-F03.03/.04; add TC-F03.72–76 `[x] AUTO`; update count/date. |
| Create | `./src/__tests__/unit/dashboard/pending-orders.test.tsx` | Component behavior for TC-F03.03/.04/.72/.74 and AC06 semantics. |
| Create | `./src/__tests__/unit/dashboard/dashboard-page-orders.test.tsx` | DashboardRoot gates, RBAC suppression, success, and isolated failure. |
| Modify | `./src/__tests__/unit/dashboard/dashboard-blocks.test.ts` | Assert Orders is not Soon and remains default OFF. |
| Modify | `./src/__tests__/unit/dashboard/api-summary.test.ts` | Retag no-tenant 403 from conflicting TC-F03.03 to TC-F03.17. |
| Modify | `./src/__tests__/unit/dashboard/dashboard-components.test.tsx` | Retag legacy Pending Orders assertions from .09/.10 to canonical .03/.04. |
| Modify | `./src/__tests__/unit/dashboard/f03-dashboard-components-extended.test.tsx` | Retag greeting/site-grid cases to new .75/.76 rows. |
| Modify | `./e2e/dashboard.spec.ts` | Remove obsolete single-column-incompatible “tab navigation” test using TC-F03.03. |
| Validate | Phase 01 test files | Run predicate and loader suites together with UI tests. |

## Implementation Steps

1. Update QA traceability before finalizing tests.
   - TC-F03.03: when N is 1–5, render exactly N newest exact-pending orders, total badge, and required fields.
   - TC-F03.04: expected URL `/orders/{id}`, document ID rather than order number.
   - TC-F03.72 `[x] AUTO`: authorized zero-result state shows localized empty copy and no order links.
   - TC-F03.73 `[x] AUTO`: no query/widget for no tenant/site, block OFF, non-active membership, or custom role without `orders`.
   - TC-F03.74 `[x] AUTO`: Orders loader failure renders unavailable while other dashboard blocks survive.
   - TC-F03.75/.76 `[x] AUTO`: canonical rows for the existing greeting and site-grid component tests currently mislabeled .03/.04.
   - Update header from 72 existing unique cases (including `TC-F03.41b`) to 77 and refresh the version date.
2. Add `pending-orders.test.tsx` using existing i18n provider/mocks.
   - Data state renders order code, summed item label, normalized currency/total, awaiting status, and `totalCount` badge even when only five rows render.
   - Each row is a focusable link with exact `/orders/{id}` href.
   - Empty state renders both localized messages and no order links.
   - Unavailable state renders distinct localized copy and no order links.
   - Neither state contains “Coming Soon”, lock overlay, or hardcoded mock IDs.
   - Avoid brittle assertions on exact NBSP emitted by `Intl.NumberFormat`.
3. Update dashboard block tests.
   - Orders exists in `ALL_BLOCKS` with no Soon flag.
   - Orders remains absent from defaults and visible only when explicitly saved.
4. Repair only direct TC-ID collisions.
   - API summary no-tenant 403 => TC-F03.17; update file header, describe title, and test title so no stale .03 reference remains.
   - Legacy `DashboardActionList` pending data/link assertions => TC-F03.03/.04; update header/comments/test titles together.
   - Greeting/site-grid assertions => TC-F03.75/.76; update header/comments/test titles together.
   - Delete the obsolete E2E tab-navigation case and its header mapping; the current dashboard is a single-column stream.
5. Add a focused DashboardRoot test.
   - TC-F03.73: all four negative gates produce zero loader calls and no widget; authorized + visible calls it once.
   - TC-F03.74: rejected loader returns unavailable UI while glance/traffic/SEO remain in the rendered tree.
6. Run `npm ci` first, then focused tests, dashboard regression, targeted dashboard E2E, clean typecheck, and coverage.
7. Manual browser pass.
   - Test row layout and no horizontal scroll at 375/768/1280; probe 820px if the breakpoint transition looks ambiguous.
   - Tab to each row, verify visible focus, press Enter, and confirm `/orders/{id}`.
   - Verify exact-pending fixture order and count, authorized empty state, RBAC suppression, and cross-tenant absence.

## Test Flow

```text
DashboardRoot
├─ tenant/site/block/permission gate fails -> no loader, no widget             [TC-F03.73]
└─ all gates pass -> Pending Orders loader
   ├─ rejects / malformed row -> unavailable; other dashboard blocks survive  [TC-F03.74]
   ├─ ready + 0 rows       -> localized empty, no links                        [TC-F03.72]
   └─ ready + 1–5 rows     -> fields + totalDocs badge                         [TC-F03.03]
                              └─ row link /orders/{documentId}                 [TC-F03.04]

CSS/interaction: 375/768/1280, hover, Tab, focus ring, Enter                    [manual AC06]
```

## Failure Modes

| Failure | Automated evidence | Handling/user outcome |
|---|---|---|
| No tenant/site, block OFF, or no permission | Page call-count/render test | No query and no widget by design |
| Payload query rejects | DashboardRoot test | Sanitized log; unavailable state; other blocks remain |
| Unknown currency or non-finite total | Loader + page test | Mapping rejects; unavailable state, never false money |
| Authorized zero results | Component test | Clear localized empty state |
| Mobile/focus regression | Manual viewport/keyboard matrix | Must block release if AC06 fails |

## Validation Commands

```bash
npm ci
npm test -- src/__tests__/unit/dashboard/pending-orders-data.test.ts src/__tests__/unit/dashboard/pending-orders.test.tsx src/__tests__/unit/dashboard/dashboard-page-orders.test.tsx src/__tests__/unit/dashboard/dashboard-blocks.test.ts src/__tests__/unit/dashboard/api-summary.test.ts src/__tests__/unit/dashboard/dashboard-components.test.tsx src/__tests__/unit/dashboard/f03-dashboard-components-extended.test.tsx
npm test -- src/__tests__/unit/dashboard
npm run test:e2e -- e2e/dashboard.spec.ts
npm run typecheck
npm run test:coverage
rg -n "mockOrder|soonTip|ComingSoonCorner|cs-lockzone|#2048" src/components/dashboard/revamp/pending-orders.tsx src/i18n/locales
```

## Todo List

- [x] Update TC-F03.03/.04, add TC-F03.72–76, and repair direct test collisions.
- [x] Add PendingOrders component tests.
- [x] Update block and DashboardRoot regressions.
- [x] Restore lockfile dependencies and complete focused, dashboard-wide, typecheck, and focused-coverage validation.
- [x] Record credentialed E2E and manual viewport/RBAC validation as explicit release-QA handoff items.

## Verification Evidence

- Focused Phase 03 regression set: 48/48 tests passed.
- Review-finding regression was captured RED with 2 expected failures: the empty state did not use the canonical `.empty-block` structure and fractional positive quantities were included in `itemCount`.
- Finding fixes passed GREEN with 32/32 focused tests: Pending Orders now reuses the canonical `.empty-block` markup and the loader counts only positive finite integers via `Number.isInteger` (invalid/fractional quantities remain ignored).
- Follow-up numeric-boundary regressions failed RED at 2/29, then passed GREEN in the 34/34 Pending Orders suite after requiring positive safe integers and guarding cumulative overflow; the empty-state selector now locks `.card > .empty-block`.
- Full dashboard unit suite: 75 files and 1064/1064 tests passed.
- TypeScript typecheck and `git diff --check`: passed.
- Lint: 0 errors and 137 pre-existing repo-wide warnings. Production build did not reach compilation because root-owned `.next/diagnostics` raised `EACCES`.
- Focused coverage invocation: 11/11 selected tests passed. The repository-wide coverage threshold is not meaningful for a two-file selector and therefore was not claimed as a full coverage pass.
- Follow-up re-review after all findings: 10/10 with 0 blocking findings.
- Targeted dashboard E2E: 4 tests skipped because `TEST_EMAIL` and `TEST_PASSWORD` were unavailable in this environment; no test failure was observed.
- Manual 375/768/1280 viewport, keyboard, role, and cross-tenant matrix was not run in this environment and remains a release-QA handoff.

## Success Criteria

- All AC01–AC08 have an implementation owner and validation evidence.
- Focused tests and dashboard unit suite pass.
- Typecheck is fully clean after `npm ci`; CI must pass fully.
- No mock/lock strings remain in the Orders widget/locales.
- Manual responsive, keyboard, role, and tenant checks pass.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Loader tests pass but page wiring regresses | Focused DashboardRoot orchestration test plus loader call counts. |
| Existing stale QA IDs invite unrelated cleanup | Repair only direct `.03/.04/.09/.10` collisions and add `.72–76`; leave other debt out of scope. |
| jsdom cannot validate responsive CSS | Mandatory real-browser viewport and keyboard matrix. |
| Missing local packages obscure type errors | Restore declared lockfile dependencies with `npm ci`; require clean local/CI typecheck. |

## Security Considerations

- Include a negative custom-role test proving no order query/render.
- Include tenant A/B fixtures; assert no customer/order metadata leaks across tenants.
- Keep test fixtures synthetic and free of real customer data.

## Next Steps

Run the credentialed dashboard E2E and manual viewport/keyboard/RBAC/tenant matrix in the staging QA environment. Then open a PR titled with the repo Conventional Commit/story format and include `Relates to #1627` (never `Closes #1627`).
