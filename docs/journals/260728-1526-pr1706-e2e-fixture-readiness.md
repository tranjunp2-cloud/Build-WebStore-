---
date: 2026-07-28
session: PR 1706 E2E fixture readiness fixes
---

# Journal: 2026-07-28 — PR 1706 E2E Fixture Readiness

## Context

The PR review found four reliability gaps in dashboard E2E provisioning: CI could mistake an older staging deployment for the fixture-capable build, a fixed order number could violate the globally unique `orders.orderNumber` constraint across custom E2E tenants, Playwright retries inherited the previous attempt's retired fixture, and a UTC date rollover could exclude the fixture from the Revenue query.

## What Happened

- Replaced the status-code deployment probe with an authenticated provisioning retry that requires `setupCapability: dashboard-fixture-v1` and validates the returned dashboard fixture before Playwright starts.
- Made missing provisioning credentials fail fast instead of silently skipping a fixture required by the dashboard scenario.
- Derived the fixture order number from the tenant ID while keeping tenant-scoped lookup and cleanup.
- Added route-level regression coverage that provisions two E2E tenants and verifies distinct order numbers.
- Added a Node `fetch` helper that provisions and validates an exact fixture at the start of every Playwright attempt, so retries recreate the order after prior cleanup.
- Scoped `E2E_SETUP_SECRET` to the `Run E2E tests` step instead of exposing it job-wide.
- Changed the Revenue scenario from `today` to `7d` so a UTC midnight rollover between provisioning and assertions does not exclude the fixture.
- Added regression checks for the helper contract, workflow secret scope, per-attempt provisioning, and the stable Revenue period.

## Reflection

Endpoint existence was too weak a readiness signal because it proved routing, not deployed behavior. Likewise, suite-level setup was insufficient for a destructive scenario: Playwright retries are separate attempts and each needs fresh state. Exact capability and fixture identity checks now fail closed, while the wider period removes a calendar-boundary dependency without weakening the Revenue assertion.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Treat the response capability and fixture payload as the deployment handshake | These values prove the expected handler ran and completed provisioning | Prevents Playwright from starting against stale code or a missing fixture |
| Include tenant ID in the fixture order number | `orders.orderNumber` is globally unique while custom `e2e-*` tenants are supported | Multiple E2E tenants can seed independently without collisions |
| Fail CI when required setup secrets are absent | The dashboard test cannot run deterministically without provisioning | Configuration errors surface before browser execution |
| Provision through Node `fetch` before every browser attempt | Cleanup intentionally retires the order, including after a failed attempt | Retries receive a new pending order instead of inheriting terminal state |
| Validate capability, order ID, number prefix, and exact total | A successful HTTP status alone cannot prove fixture compatibility | Browser assertions operate on the intended isolated fixture |
| Use a seven-day Revenue period | `today` can change at 00:00 UTC during a run | The fixture remains in range across midnight |

## Next Steps

- Confirm the next staging CI run exercises an actual Playwright retry and returns the expected tenant-specific fixture on each attempt.
