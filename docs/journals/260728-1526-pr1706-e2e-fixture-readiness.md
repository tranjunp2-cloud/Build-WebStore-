---
date: 2026-07-28
session: PR 1706 E2E fixture readiness fixes
---

# Journal: 2026-07-28 — PR 1706 E2E Fixture Readiness

## Context

The PR review found that HTTP 200 plus the old `dashboard-fixture-v1` capability could accept a stale Vercel deployment that had not enabled Pending Orders. The final design also had to keep `.github/workflows/**` unchanged and avoid exposing the password-sync setup endpoint to cookie-authenticated callers.

## What Happened

- Bumped the fixture handshake to `dashboard-fixture-v2` and extracted product, preference, and order provisioning into one server-side module shared by both E2E endpoints.
- Added a fixture-only `POST /api/e2e/dashboard-fixture` route with `dynamic = force-dynamic` and `maxDuration = 60`.
- Restricted the route to staging, the authenticated `TEST_EMAIL` account, an explicit v2 intent header, and the primary tenant derived from the session. It accepts no tenant ID, email, or password from the request.
- Changed the Playwright helper to use `page.request`, which inherits the authenticated browser cookie jar, instead of Node `fetch` plus `E2E_SETUP_SECRET`.
- Moved deployed-contract readiness into the helper. It retries network errors, 404/429, selected 5xx responses, and incompatible/stale payloads until a complete v2 fixture is returned; auth and other contract errors fail immediately.
- Provisioned a fresh fixture at the start of every Playwright attempt and retained the seven-day Revenue period so retries and UTC midnight rollover remain deterministic.
- Added route coverage for staging/auth/tenant isolation and the real Products publish hook, plus helper coverage for v1-to-v2 and missing-route retries.
- Restored both GitHub Actions workflows to their base-branch content and removed the workflow-specific assertion test.

## Reflection

Readiness belongs next to the browser scenario that consumes the deployed contract. The authenticated request context proves both the deployed v2 semantics and the exact tenant that Dashboard queries, while the dedicated fixture route prevents cookie auth from gaining the password-sync powers of `ensure-test-user`.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Use a dedicated cookie-authenticated fixture route | The existing setup route can create users and synchronize passwords | Browser auth can seed only the fixture, not mutate credentials |
| Derive tenant from the authenticated session | Dashboard reads the user's primary tenant | Fixture data and widget queries cannot target different tenants |
| Gate on capability v2 inside the helper | Workflow probes cannot prove the new preference semantics are live | TC-F03.57 waits for the deployed contract it actually needs |
| Retry only deployment-transient failures | Stale aliases can return 404, 5xx, or an older capability | Rollout delay is tolerated while auth/config failures remain visible |
| Keep `.github/workflows/**` unchanged | Deployment and database ownership remain outside this fixture fix | Existing CI policy is preserved |

## Next Steps

- Run TC-F03.57 against the deployed staging alias so Vercel executes the fixture route against its configured Neon `DATABASE_URI`.
