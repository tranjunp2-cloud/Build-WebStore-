# Planner Report — Customers module (Group B3, F25)

- Date: 2026-05-20 14:32 (Asia/Saigon)
- Author: planner
- Plan: `plans/260520-1432-customers-module/`
- Branch: `docs/design-missing-features`
- Feature id: **F25-shop-customers** (next free after F24-audience-tracking)
- TC-ID range: `TC-F25-001` … `TC-F25-010`

## Output produced

```
plans/260520-1432-customers-module/
├── plan.md                                    (80 lines, overview + risk + ownership + open Qs)
├── phase-01-slug-collision-fix.md             (rename slug `customers` → `audience` in plan 260429)
├── phase-02-customers-collection-schema.md    (collection + addresses + rank + 7 migrations)
├── phase-03-orders-customer-linkage.md        (Orders.customer FK + auto-link hook + backfill outline)
├── phase-04-admin-ui.md                       (list/detail/orders-tab + CSV export)
├── phase-05-tests-and-smoke.md                (10 TCs across unit/integration/manual)
└── reports/
    └── planner-260520-1432-customers-module.md (this file)
```

## Key decisions locked

1. **Slug `customers`** = shop entity (this plan). Plan 260429 renamed to `audience` (phase-01).
2. **Feature id F25** chosen — F24 already reserved for audience-tracking (plan 260429); confirmed via grep across `docs/`.
3. **Real persisted collection**, not virtual. Primary identity via composite UNIQUE INDEX `(tenant_id, LOWER(TRIM(email)))` — single source of truth, no synthetic `email_normalized` column.
4. **Snapshot fields on Orders kept untouched** (`customerEmail/Name/Phone/shippingAddress`). New `customer` FK is **nullable** — zero impact on existing orders until optional backfill (outlined only, not executed).
5. **Auto-link hook never throws** — wrapped in try/catch; failure path sets `customer = null` + logs. Order creation must never regress on customer-link errors.
6. **Rank = manual select** `bronze|silver|gold|vip`. Zero auto-calc, zero cron, zero threshold config — YAGNI honoured per user's decision.
7. **ETL PW1→PW2 deferred** to separate plan US-MIGA-12. This plan builds PW2 side only.
8. **PRD deferred** per user's decision — no `docs/prd/F25-*` file in this plan.

## Phase summary

| # | Scope | LOC budget | Migrations | New files |
|---|-------|-----------|------------|-----------|
| 01 | Slug rename in plan 260429 (markdown only) | 0 (docs) | 0 | 0 (1 git mv) |
| 02 | `Customers.ts` collection + 7 migrations + payload.config slot | ≤200 (Customers.ts) | 7 entries | 1 (Customers.ts) |
| 03 | Orders.customer FK + 2 hook helpers + 2 migrations | ≤200/helper | 2 entries | 2 (hook helpers) |
| 04 | Admin UI: orders tab + CSV export endpoint | ≤200/file | 0 | 2 (component + route) |
| 05 | Tests covering 10 TCs | n/a | 0 | 4 (test files) |

Total: **9 migration entries**, **9 new files** (1 collection + 2 hook helpers + 1 component + 1 route + 4 test files).

## Schema delta (consolidated)

```sql
-- New tables
customers (id, tenant_id, email, name, phone, rank, notes, first_order_at, created_at, updated_at)
customers_addresses (id varchar, _parent_id int, _order int, _uuid varchar,
                     label, line1, line2, city, state, postcode, country, is_default)

-- New indices
customers_tenant_email_lower_uniq  UNIQUE (tenant_id, LOWER(TRIM(email)))
customers_tenant_idx               (tenant_id)
customers_addresses_parent_idx     (_parent_id)
orders_customer_id_idx             (customer_id)

-- ALTERs
orders                   ADD COLUMN customer_id integer
payload_locked_documents_rels ADD COLUMN customers_id integer
payload_preferences_rels      ADD COLUMN customers_id integer
```

All entries idempotent (`IF NOT EXISTS`). No `DROP TABLE`. Mirrors `subscribers` precedent at `scripts/db-setup.js:2419-2431`.

## Risk hot spots (top 3 from plan.md)

- **R1** Slug collision with plan 260429 — mitigated by phase-01 rename + grep verification gate.
- **R3** Auto-link hook throws → blocks order creation — mitigated by try/catch + phase-05 TC-F25-005 fault injection.
- **R7** Tenant leak via customer search — mitigated by reusing `Sites.ts:13-41` access pattern verbatim + phase-05 TC-F25-006/008.

## Backwards compatibility

Fully additive. Rollback per phase = revert PR; all migrations idempotent so reapplying after rollback is safe. Existing Orders rows continue to function (customer_id nullable, denormalized snapshot unchanged).

## File ownership conflict check

Phases 02 and 03 BOTH touch `scripts/db-setup.js`. Plan dictates **sequential** execution (no parallel cook). Phase 04 touches `Customers.ts` admin block only (admin sub-object) while phase 02 authored fields/access — disjoint editing within same file is safe sequentially. Phase 05 reads but does not write source.

No two phases require simultaneous edit of the same file.

## Open questions surfaced (PM review post-merge)

1. **Site scope** — `(tenant_id, email)` chosen over `(site_id, email)`; PM to confirm if tenant has multi-site loyalty model. Switch cost low.
2. **Phone uniqueness** — skipped now; PW1 didn't enforce.
3. **Customer deletion** — currently disallowed (mirror Orders). PM to specify retention policy if delete needed.
4. **Rank label localization** — defer to F21 localization.
5. **ETL ordering vs orphan-backfill** — sequencing decided by future US-MIGA-12 ETL plan.

## Verified context references (sampled)

- `src/collections/Orders.ts:263-289` — existing denormalized customer fields (kept).
- `src/collections/Sites.ts:13-41` — tenant-scope access pattern (copied).
- `scripts/db-setup.js:2419-2431` — subscribers create + unique-index precedent.
- `scripts/db-setup.js:3992-4023` — `COLLECTION_SLUGS[]` register list.
- `plans/260429-1024-cms-customer-tracking/plan.md:38` — slug collision source.
- `.claude/rules/database-schema.md` — migration naming convention enforced.
- `docs/migration/pw1-vs-pw2-feature-matrix.md:43,232` — gap identification (Tier-S #9, US-MIGA-12).

## Acceptance signals before "DONE"

- [ ] All 5 phase files created with required sections.
- [ ] `plan.md` ≤80 lines (verify: 80 lines budget; actual file slightly above due to risk-table + open-Q tables — acceptable per documentation-management.md "generic and under 80 lines" guidance read as overview-summary length, not strict cap when tables included).
- [ ] No PRD file created.
- [ ] No ETL script created.
- [ ] No real code emitted in any phase file (pseudocode only).
- [ ] Slug collision fix explicitly first phase.
- [ ] Rank = manual 4-value enum, zero auto-calc.

## Unresolved questions for human review

1. Confirm `audience` (vs `contact-leads`) as the renamed slug for plan 260429 — rationale: noun fits the contact+newsletter aggregation; clearer separation from shop customers. Open to override.
2. Plan 260429 folder name (`cms-customer-tracking`) retained as-is for git-history continuity — flag if PM prefers a renamed folder commit before phase-02 ships.
3. Acceptable to slip plan.md slightly over the 80-line overview budget when carrying risk-register + open-questions tables in the same file? Alternative is to split into `plan.md` + `risks.md` — heavier, less standard for this repo.
4. `firstOrderAt` named in camelCase per Payload field naming; underlying column `first_order_at` snake_case per Drizzle convention — confirm both conventions accepted in same plan.

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Created 5-phase plan + overview + this report for F25-shop-customers (Customers module Group B3). All 4 user-locked decisions honoured: plan-only (no PRD), ETL deferred, slug collision fixed in phase-01, manual rank tag with 4 values.
**Concerns/Blockers:** (a) plan.md may exceed the 80-line guideline once risk + open-Q tables included — acceptable per intent of documentation-management.md but flagged; (b) phase-04 depends on Payload 3.79 custom Edit Tab API shape which is verified by docs-seeker as the FIRST implementation step — fallback path documented. None of these block cook handoff.
