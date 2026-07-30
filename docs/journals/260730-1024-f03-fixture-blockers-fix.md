---
date: 2026-07-30
session: TC-F03.57 fixture blockers
---

# Journal: 2026-07-30 — TC-F03.57 Fixture Blockers

## Context

Rechecked and fixed two fresh-tenant blockers in the TC-F03.57 dashboard E2E fixture: product publication failed through the real Payload hook, and Pending Orders stayed hidden because `orders` is intentionally absent from the default dashboard blocks.

## What Happened

- Product create/update used `status: active` without a publish-valid payload. `overrideAccess: true` bypassed access checks but not `Products.publishGateHook`, producing HTTP 500.
- Captured RED with `npm test -- src/__tests__/api/e2e-ensure-test-user.test.ts`: 1 file, 2 failed/1 passed. Create was blocked for missing `sku`, `inventory`, and `weight`; existing draft update was blocked for missing `price`, `sku`, `inventory`, and `weight`.
- Fixture product data now supplies deterministic tenant-scoped slug/SKU plus `price`, `inventory: 10`, `weight: 0.5`, `hasVariants: false`, and `status: active` on both create and update. Deterministic `seo.title`/`seo.description` also prevent fixture activation from enqueueing auto-meta AI generation.
- Fixture provisioning now reads the tenant settings, preserves them, normalizes existing valid dashboard preferences, and appends `orders` only when absent. Fresh/default tenants receive defaults plus `orders`; custom order and unrelated settings remain intact.
- Regression coverage imports the real Payload module and executes the actual product `beforeChange` publish gate and `afterChange` SEO hook around mocked Local API calls, covering both new and existing products and asserting that the SEO queue stays idle. It also covers preference preservation, default enablement, and tenant-isolated fixture identifiers.

## Verification

| Check | Result |
|---|---|
| Focused RED→GREEN command | GREEN: 1 file, 3/3 tests passed |
| Route + product hooks + dashboard blocks + Pending Orders baseline | 4 files, 42/42 tests passed |
| Broader verifier | 6 files, 66/66 tests passed |
| `npm run typecheck` | Exit 0; no diagnostics |
| `npm run lint` | Exit 0; pre-existing repository warnings only, none in modified files |
| `npm run build` | Exit 0; compiled in 120s and generated 113/113 pages |

Build emitted a non-fatal local database `ECONNREFUSED 127.0.0.1:5432` during page-data/finalization; compilation and static generation still completed successfully.

## Reflection

Mocking Payload without invoking collection hooks hid a production-equivalent fixture failure. Testing the fixture payload against the real publish gate now guards the contract that matters. Enabling `orders` during fixture provisioning keeps the E2E Arrange deterministic without changing the application's intentional default dashboard.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Use one publish-valid product payload for create and update | Existing draft fixtures must be repaired as reliably as fresh fixtures | Provisioning is idempotent and passes the real publish gate |
| Derive product slug and SKU from the tenant ID | Avoid cross-tenant uniqueness collisions | Parallel E2E tenants remain isolated |
| Merge `orders` into normalized saved preferences | Preserve valid user ordering/settings while guaranteeing Pending Orders visibility | TC-F03.57 no longer times out on fresh or customized tenants |
| Exercise the real collection hook inside the route test | A fully mocked Payload client cannot detect hook validation failures | Regression fails if fixture fields drift from publication requirements |

## Next Steps

- Run the browser TC-F03.57 flow against an environment with PostgreSQL available as the final deployment-level check.
