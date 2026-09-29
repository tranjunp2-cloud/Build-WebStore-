# Phase 1: Correct Status Logic and Deterministic Coverage

## Context Links

- Issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1700
- Source: `./src/app/(dashboard)/dashboard/page.tsx`
- Existing orchestration tests: `./src/__tests__/unit/dashboard/dashboard-page-orders.test.tsx`
- QA matrix: `./docs/qa/F03-dashboard.md`
- Test rules: `./docs/TEST_CONVENTION.md`

## Overview

- Priority: P1
- Status: In Progress (6/7; authenticated staging browser run pending)
- Estimate: 2h
- Goal: derive the Shipping step from the OR of the two persisted setup flags and protect the
  server data mapping with an explicit truth table.

## Key Insights

- `tenantResult` is already fetched; EasyParcel requires no new Payload query.
- `easyParcelIntegration` is a top-level tenant group, not part of `tenant.settings`.
- `OnboardingCard` only renders the `steps` it receives; the defect is in `DashboardRoot`.
- `DashboardOnboarding.tsx` and its tests are legacy and do not protect the production path.
- The EasyParcel save route already enforces connection plus a complete default warehouse before
  persisting `enabled: true`; Dashboard must not duplicate that validation.

## Requirements

### Functional

- Treat strict `true` from either setup flag as complete.
- Treat false, null, undefined, or a missing group as incomplete unless the other flag is true.
- Preserve the existing no-tenant, no-usable-site, all-steps-complete, and block visibility behavior.

### Non-functional

- The production Dashboard render path adds no `any`, query, external call, logging, schema,
  migration, env, or i18n change; the staging-only fixture idempotently reconciles non-secret Dashboard UI state.
- Tests import the real `DashboardRoot`, follow AAA, keep mocks at top level, and map to QA TC-IDs.
- Keep browser setup staging-only, authenticated as `TEST_EMAIL`, tenant-derived and idempotent, and
  fail closed unless the active tenant has a production-valid EasyParcel connection.
- Do not modify `.github/workflows`; add the regression as an independent test in the already
  allow-listed shipping spec so its fixture failure cannot suppress the GH-1734 scenario.

## Architecture

```ts
const hasSelfDeliveryShipping =
    siteDoc.shippingConfig?.shippingSetupConfirmed === true
const hasEasyParcelShipping =
    tenantResult.easyParcelIntegration?.enabled === true

hasShippingConfigured = hasSelfDeliveryShipping || hasEasyParcelShipping
```

Use narrow structural types around the two fields. Keep `tenantResult.settings.dashboardPreferences`
unchanged.

## Related Code Files

| Action | Absolute path | Change |
|---|---|---|
| Modify | `./src/app/(dashboard)/dashboard/page.tsx` | Combine Self Delivery and EasyParcel flags |
| Modify | `./src/__tests__/unit/dashboard/dashboard-page-orders.test.tsx` | Expose `OnboardingCard.steps` and add truth-table tests |
| Modify | `./docs/qa/F03-dashboard.md` | Add TC-F03.78–80 as AUTO scenarios |
| Modify | `./src/app/api/e2e/dashboard-fixture/route.ts` | Add guarded EasyParcel-only preparation action |
| Create | `./src/lib/e2e/dashboard-shipping-fixture.ts` | Prepare the dedicated tenant without changing EasyParcel activation or credentials |
| Create | `./e2e/helpers/dashboard-shipping-fixture.ts` | Idempotent Playwright preparation client |
| Modify | `./tests/gh-1734-self-delivery-complete.spec.ts` | Add independent GH-1700 Shipping row/tick coverage in the governed shipping spec |

No schema, migration, environment variable, OAuth, i18n, or workflow file changes.

## Implementation Steps

1. Derive `hasEasyParcelShipping` from `tenantResult.easyParcelIntegration.enabled === true`.
2. Derive `hasSelfDeliveryShipping` from the selected site's
   `shippingConfig.shippingSetupConfirmed === true`.
3. Set `hasShippingConfigured` to their boolean OR without changing the query graph.
4. Change the existing `OnboardingCard` mock to render or capture the received `steps` prop. Assert
   the real `shipping` entry; do not duplicate the OR expression inside test code.
5. Make the unit-test setup include the `onboarding` block and leave one unrelated step incomplete so
   the card remains rendered even when Shipping is complete.
6. Add AAA cases:
   - TC-F03.78: Self Delivery false + EasyParcel true -> `shipping.done=true`.
   - TC-F03.79: Self Delivery true + EasyParcel false/missing -> `shipping.done=true`.
   - TC-F03.80: both false/missing -> `shipping.done=false`.
7. Add the same three cases to `docs/qa/F03-dashboard.md` with `[x] AUTO` before relying on their
   TC-IDs in tests.
8. Preserve all existing Pending Orders assertions and mocks.
9. Add a strict staging-only fixture action that derives the tenant from the authenticated
   `TEST_EMAIL` session and verifies the dedicated slug, connection credentials, connection test,
   complete default warehouse, then locks tenant site rows and canonically enables onboarding visibility while sparsely resetting Self Delivery/theme completion flags.
10. Add TC-F03.78 Playwright coverage against the real Dashboard and `OnboardingCard`; assert the
    Shipping row's EasyParcel source marker, `done` class, and tick; prove its editor site belongs to the
    prerequisite-validated tenant.
11. Keep GH-1700 and GH-1734 as independent tests in the existing governed shipping spec without project dependency coupling.

## Todo List

- [x] Implement the strict two-source predicate.
- [x] Make the production `steps` prop observable in the orchestration test.
- [x] Add TC-F03.78–80 to the QA matrix.
- [x] Add and run all three regression cases.
- [x] Confirm the focused suite has no regressions.
- [x] Add the authenticated idempotent browser regression, bounded transient retries, and contract tests.
- [x] Confirm the existing staging allow-list discovers TC-F03.78 without workflow edits.
- [ ] Execute the browser regression against deployed staging credentials.

## Verification

```bash
npm test -- src/__tests__/unit/dashboard/dashboard-page-orders.test.tsx
npm test -- src/__tests__/api/e2e-dashboard-fixture.test.ts src/__tests__/unit/ci/dashboard-fixture-helper.test.ts
npm run typecheck
npm run lint
npx playwright test tests/gh-1734-self-delivery-complete.spec.ts --project=gh-1734-self-delivery --list
```

Authenticated staging browser check:

1. Fixture fails closed unless the dedicated tenant already has production-valid EasyParcel enabled
   with a complete warehouse; it then canonically resets Self Delivery and theme completion state.
2. Dashboard renders the Shipping row with the EasyParcel source marker, `done` class, and visible tick.

## Success Criteria

- Each issue AC maps to one deterministic test using the real page orchestration.
- EasyParcel-only and Self Delivery-only both produce `shipping.done=true`.
- Neither configured produces `shipping.done=false`.
- Existing Dashboard tests pass without testing the obsolete component as a proxy.
- Authenticated staging Playwright execution passes the reported EasyParcel-only browser flow.

## Risk Assessment

- If every step is complete, the card disappears. Mitigation: keep one unrelated mocked step false.
- Concurrent Dashboard work may modify the same test. Mitigation: preserve newer cases and merge the
  mock enhancement instead of replacing the file.
- Multi-site selection is ambiguous because the page uses `limit: 1`. Do not change it in #1700.
- Cross-suite primary-tenant rotation must not create false evidence. Mitigation: assert the actual
  Dashboard editor site ID belongs to the verifier's tenant-owned site set while canonical preparation is idempotent and fails closed on a later competing mutation.

## Security Considerations

- Tenant isolation remains controlled by `tenantIdForQuery(user)` and existing queries.
- Validate hidden activation fields server-side, but never mutate, serialize, or log OAuth tokens.
- The fixture requires the existing intent header and authenticated `TEST_EMAIL`, verifies hidden
  activation prerequisites server-side, and returns only non-secret site IDs required for identity proof.

## Next Steps

After verification passes, prepare the conventional PR with `Relates to #1700` and request review.
