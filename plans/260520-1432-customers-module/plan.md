---
title: "Customers module (shop entity, Group B3)"
description: "Promote denormalized order-customer snapshot into a first-class Customers collection with Addresses + manual Rank + Orders linkage."
status: pending
priority: P1
effort: 11h
branch: docs/design-missing-features
tags: [cms, payload, customers, orders, shop, parity, US-MIGA-12, F25]
created: 2026-05-20
---

# Customers Module — Plan Overview

Restore PW1 parity for **Group B3 / Tier-S #9 / US-MIGA-12**. Promote `customerEmail/customerName/customerPhone/shippingAddress` (currently denormalized inside Orders) into a first-class `customers` collection with multi-address book and manual `rank` tag. Wire Orders → Customer via auto-link hook on email+tenant. **Feature id reserved: F25-shop-customers** (F24 already taken by `cms-customer-tracking` plan). PRD deferred per decision; ETL PW1→PW2 deferred to its own plan.

## Verified context (file:line)

- `src/collections/Orders.ts:263-289` — current denormalized fields; KEEP as snapshot for historical orders.
- `src/collections/Sites.ts:13-41` + `Orders.ts:71-92` — canonical tenant-scope access pattern (super-admin OR `tenant in req.user.tenants[]`).
- `scripts/db-setup.js:2419-2431` — `subscribers` migration precedent (id serial + composite unique index on (email, site_id)) → mirror for `customers (email, tenant_id)`.
- `scripts/db-setup.js:3992-4023` — `COLLECTION_SLUGS[]` requires every new slug.
- `plans/260429-1024-cms-customer-tracking/plan.md:38` + `phase-02-customers-virtual-collection.md:36-65` — uses slug `customers` (status pending, not merged). **Collision must be resolved in Phase 01** before this plan touches schema.
- `.claude/rules/database-schema.md` — array tables `varchar` id + `_parent_id` + `_order`; select hasMany `serial` + `parent_id` + `order`; NEVER `DROP TABLE`.
- `docs/migration/pw1-vs-pw2-feature-matrix.md:43,232` — flags this as Tier-S #9, P0 missing.

## Strategy decision

Real persisted collection (not virtual). `customers` table keyed by `(tenant_id, lower(trim(email)))` UNIQUE → idempotent upsert. Orders.beforeChange hook upserts Customer + writes `customer` FK back. Denormalized snapshot fields in Orders untouched → zero risk to existing 1.0 orders. Addresses modelled as Payload `array` field (sub-table `customers_addresses` per Drizzle convention). Rank = select field, 4 manual values (`bronze|silver|gold|vip`); zero auto-calc.

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 01 | Slug collision fix (rename plan 260429 `customers` → `audience`) | pending | 0.5h | [phase-01-slug-collision-fix.md](./phase-01-slug-collision-fix.md) |
| 02 | Customers collection schema + addresses + Rank + migrations | pending | 4h | [phase-02-customers-collection-schema.md](./phase-02-customers-collection-schema.md) |
| 03 | Orders.customer FK + auto-link hook + orphan-backfill outline | pending | 2h | [phase-03-orders-customer-linkage.md](./phase-03-orders-customer-linkage.md) |
| 04 | Admin UI: list, detail, order history, addresses tab, CSV export | pending | 3h | [phase-04-admin-ui.md](./phase-04-admin-ui.md) |
| 05 | Tests + smoke matrix (TC-F25-001..010) | pending | 1.5h | [phase-05-tests-and-smoke.md](./phase-05-tests-and-smoke.md) |

## Dependencies

- 01 → 02 (slug `customers` must be free before this plan claims it).
- 02 → 03 (Orders FK targets the new collection).
- 02 → 04 (UI binds to the collection schema).
- 03 → 05 (hook behaviour tested).
- All phases gated by `node scripts/check-migrations.js origin/staging` before PR merge.

## Anti-scope (KHÔNG làm)

- No `docs/prd/F25-shop-customers.md` PRD draft.
- No PW1→PW2 ETL script, no backfill execution, no reconciliation queries (defer to plan `US-MIGA-12` ETL).
- No auto-calc Rank (no cron, no threshold config).
- No Pages/Articles migration.
- No SSO redirect changes.
- No real code in phase files — pseudocode + acceptance criteria only.

## Backwards compatibility

Additive. Orders.customerEmail/Name/Phone/shippingAddress preserved as denormalized snapshot. Orders.customer is **nullable** relationship → existing rows untouched until phase-03 orphan-backfill (script outlined but NOT run in this plan). Rollback per phase = revert PR; migrations are `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` → idempotent.

## File ownership (no parallel conflict)

- Phase 01 owns: `plans/260429-1024-cms-customer-tracking/plan.md`, `phase-02-customers-virtual-collection.md`, related slug refs.
- Phase 02 owns: `src/collections/Customers.ts` (NEW), `src/payload.config.ts` (1 import + 1 array slot), `scripts/db-setup.js` (migrations only).
- Phase 03 owns: `src/collections/Orders.ts` (single `customer` field + hook edit), `scripts/db-setup.js` (1 ALTER COLUMN entry — atomic with collection registration).
- Phase 04 owns: `src/components/admin/customers-*.tsx` (NEW), `src/app/api/v1/customers/export/route.ts` (NEW). Re-touches `Customers.ts` admin block only.
- Phase 05 owns: `src/__tests__/unit/customers/*.test.ts` (NEW); reads but never writes implementation files.

**Atomic constraint**: Phases 02 and 03 both touch `scripts/db-setup.js`. Phase 03 runs AFTER phase 02 sequentially; do NOT parallelize.

## Risk register

| # | Risk | L×I | Mitigation |
|---|------|-----|------------|
| R1 | Slug collision with plan 260429 not actually resolved → migration conflict | M×H | Phase 01 grep + rename; phase 02 verifies `customers` absent from `COLLECTION_SLUGS[]` |
| R2 | Auto-link hook upserts duplicate Customer on case/whitespace email variance | M×M | Normalize `lower(trim(email))` everywhere; DB UNIQUE INDEX on `(tenant_id, email)` as last-line guard |
| R3 | Auto-link hook throws → blocks order creation (regression P0) | L×H | Wrap in try/catch; on failure log + set `customer = null` + proceed; never throw from beforeChange |
| R4 | Empty/malformed email on order → upsert noise / orphan customer rows | M×L | Skip link if email regex fails OR empty after trim; explicit unit test |
| R5 | Manual Rank tag drift (no audit trail) | L×L | Add Payload field-level `admin.description`; future: changelog field if needed (YAGNI now) |
| R6 | Addresses array growth unbounded per customer | L×L | Hard cap 10 addresses via Payload `maxRows`; UI surfaces warning at 8 |
| R7 | Tenant leak via customer search across tenants | L×H | Reuse `Sites.ts:13-41` access pattern verbatim; phase-05 cross-tenant smoke |

## Success criteria (measurable)

1. `customers` table exists with `(tenant_id, lower(trim(email)))` UNIQUE constraint; `check-migrations.js origin/staging` exits 0.
2. Creating an Order with `customerEmail='Foo@Bar.com '` produces exactly ONE Customer row keyed `foo@bar.com` (idempotent across 5 orders).
3. Order.customer FK populated after order create when email valid; null when email empty/invalid; no thrown error in either case.
4. Tenant A admin cannot read/list/update Tenant B's customers (verified via REST + admin UI).
5. CSV export endpoint streams ≤10k rows tenant-scoped without OOM (manual smoke with seeded data).
6. Rank field accepts only `bronze|silver|gold|vip`; default unset (null/empty); unit test rejects arbitrary values.
7. Phase-05 TC-F25-001..010 all pass on first green CI.

## Resolved decisions (PM sign-off 2026-05-20)

All open questions resolved before cook handoff. No remaining PM gates.

1. **Identity scope** → `(tenant_id, lower(trim(email)))` — confirmed. Omnichannel: same buyer across all sites under one tenant inherits unified rank + history. Implemented in phase-02 unique index.
2. **Phone uniqueness** → no unique index. PW1 parity; allows shared family/hotline numbers and number changes without conflict.
3. **Customer deletion policy** → hard-delete disallowed (`delete: () => false`), mirrors `Orders.ts:91`. Protects historical Order FK integrity. GDPR / anonymize feature deferred to a separate plan.
4. **Rank labels** → DB enum stays English `bronze|silver|gold|vip` (single source of truth). Localized labels handled by **F21 Localization** when it ships — no per-language column on this collection.
5. **ETL + backfill ordering** → cutover sequence is: (a) US-MIGA-12 ETL imports PW1 customers into `customers` table FIRST, (b) orphan-order backfill script (phase-03 pseudocode) runs SECOND to wire historical orders' `customer_id`. Rationale: pre-populated customer rows let the orphan scan match by `(tenant_id, lower(email))` and avoid duplicate auto-create noise.
