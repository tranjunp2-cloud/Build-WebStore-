---
date: 2026-08-12
session: gh-1700-dashboard-shipping-status-implementation
---

# Journal: 2026-08-12 — GH-1700 Implementation Gates

## Context

Implemented the Dashboard onboarding fix for GH-1700 so Shipping is complete when either tenant-level
EasyParcel or site-level Self Delivery has been configured.

## What Happened

- Updated `DashboardRoot` to OR strict `true` values from the existing tenant EasyParcel and site
  Self Delivery fields without adding queries, schema changes, or external calls.
- Added TC-F03.78–80 traceability and four server-page regression cases covering EasyParcel-only,
  Self-Delivery-only, neither configured, and missing optional groups.
- Focused Vitest passed 10/10; typecheck passed; lint completed with 0 errors and 142 existing
  repo-wide warnings, none in the scoped files.
- Scoped code review approved the implementation at 9/10 with no P0 or blocking findings. The one
  suggested missing-group edge case was added and revalidated.
- Added a real Playwright regression for the reported EasyParcel-only state. Its staging fixture is
  authenticated, tenant-derived, strict, and idempotently resets only non-secret Dashboard UI state after EasyParcel satisfies the
  same connection and warehouse prerequisites as production activation.
- Site rows are locked and re-read inside the tenant transaction; canonical updates are sparse, and the Playwright helper fails immediately on commit-ambiguous transport or 5xx errors and retries only explicit 429 responses.
- The exact existing staging allow-list discovers TC-F03.78 as an independent test in its governed
  shipping spec, with no project coupling and no changes under `.github/workflows`.
- Expected fixture drift returns a safe typed 409 while unexpected failures remain generic 500; the
  browser proves tenant identity from the actual Dashboard editor link rather than surrounding API reads.
- Focused fixture, helper, and dashboard tests pass; typecheck and lint pass.
- A non-secret DOM marker proves the Shipping tick came from EasyParcel rather than concurrent Self Delivery.
- Authenticated browser execution remains pending because staging credentials are unavailable locally.

## Reflection

The production defect remains a narrow source-selection gap. Browser-level proof requires a real
EasyParcel connection that the test must not manufacture. The staging-only route therefore validates the real EasyParcel prerequisites and idempotently
canonicalizes only non-secret Dashboard UI state, and the browser checks the rendered
site identity directly to fail closed on cross-suite primary-tenant rotation.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Require strict `true` from either persisted setup flag | Matches GH-1700 acceptance criteria and handles missing groups safely | Either shipping method completes the onboarding step; absent/false values do not |
| Test the real server-page `steps` mapping | The defect lives in `DashboardRoot`, not the legacy onboarding component | Regression tests protect the production orchestration path |
| Automate the reported browser regression | User-reported bugs should have real Playwright coverage | TC-F03.78 exercises the real Dashboard and OnboardingCard |
| Use an idempotently prepared tenant | Manufacturing `enabled=true` bypasses production activation and pollutes later suites | The test validates real EasyParcel prerequisites and only canonicalizes onboarding visibility, theme completion, and Self Delivery confirmation |
| Reuse the governed shipping spec | The user prohibited workflow-directory changes | Existing allow-lists discover an independent TC-F03.78 without suppressing GH-1734 on fixture failure |
| Do not mark the issue shipped after local gates | Staging credentials are unavailable locally | Plan remains in progress until the deployed browser run |

## Next Steps

- Run the authenticated TC-F03.78 Playwright scenario against deployed staging.
- Record the staging evidence, then complete the plan and prepare a conventional PR using
  `Relates to #1700`.
