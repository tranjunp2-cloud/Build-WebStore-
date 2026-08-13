---
date: 2026-08-12
session: gh-1700-dashboard-shipping-status-planning
---

# Journal: 2026-08-12 — GH-1700 Dashboard Shipping Status Plan

## Context

Planned the fix for GH-1700: Dashboard onboarding must treat shipping as configured when either
tenant-level EasyParcel or site-level Self Delivery has been configured.

## What Happened

- Confirmed Dashboard checks only `site.shippingConfig.shippingSetupConfirmed`.
- Defined the intended condition as top-level `tenant.easyParcelIntegration.enabled === true` OR
  the site Self Delivery confirmation flag.
- Created the implementation plan in `plans/260812-1142-gh-1700-dashboard-shipping-status/`.
- Scoped deterministic server-page tests around the `steps` passed to `OnboardingCard`.
- Initially kept browser verification as manual staging UAT; later implementation review required a guarded E2E regression and idempotent fixture preparation.
- Reviewed #1652 and #1724 as related context; neither blocks GH-1700.

## Reflection

The defect is narrowly scoped to Dashboard status derivation. Existing data and APIs already expose
the required signals, so the plan avoids unnecessary schema, migration, OAuth, or shipping API
business-logic changes.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| OR top-level tenant EasyParcel with site Self Delivery | Matches storage and issue AC | Either configured method completes Shipping |
| Test real server-page orchestration | Verifies source selection instead of legacy component props | Protects all three AC states |
| Initial planning assumption: keep browser verification manual for this issue | A durable E2E path would require unrelated fixture/API expansion | Superseded after review by a guarded canonical fixture that never mutates EasyParcel credentials or activation |
| Keep #1652 and #1724 non-blocking | Adjacent scope, no shared Dashboard predicate ownership | GH-1700 proceeds independently |

## Next Steps

Implement the single plan phase, run focused verification, then validate the checklist on staging.

## Unresolved Questions

None blocking implementation.
