# Phase 01 — Schema & Collections

**Priority:** P1 (blocker) · **Status:** pending · **Effort:** 6h

Define two new Payload collections + register them + add idempotent SQL migrations + align the CI
migration gate. This phase is **atomic** — per `.claude/rules/orchestration.md`, schema changes
(`src/collections/*` + `scripts/db-setup.js` + `scripts/check-migrations.js`) must be one agent,
sequential, never split.

## Locked sub-decisions (gap-audit fixes — 2026-05-29)

These resolve the schema-level holes from `plans/reports/audit-260529-1543-f33-discount-gaps.md`:

- **(B) History idempotency is DB-enforced** — `discount_usage_history` gets a **UNIQUE index on `order_id`**
  (one redemption per order). App-level "check-then-insert" is racy; the unique index + `ON CONFLICT DO NOTHING`
  in Phase 03 is the real guard. This also keeps `discounts.usage_count` reconcilable: `usage_count` == `COUNT(history rows)`.
- **(G) `code` unique PER TENANT, regardless of site** — unique index stays `(tenant_id, code)`. `site` is an
  OPTIONAL **restriction filter** (null = all tenant sites), NOT part of uniqueness. A tenant cannot have the same
  code on two different sites — intended.
- **(J) Soft-delete only** — discounts are NOT hard-deletable (would orphan `order.discount` FK + usage history,
  violating BR-07 immutable audit). `delete` access → `false`; "deleting" = set `status: 'inactive'`.
- **(E) Per-customer usage limit DEFERRED to a later iteration** — v1 has only the global `usageLimit`. Documented,
  not silently dropped. No schema field for it now (YAGNI).

## Context links

- Rule: `.claude/rules/database-schema.md` (Drizzle naming, migration convention, CI gate)
- Pattern mirror: `src/collections/Orders.ts` (tenant/site scoping), `src/collections/Customers.ts`
  (admin list config), `src/collections/Categories.ts` (simple serial-id collection in db-setup.js)
- Migration format: `scripts/db-setup.js` MIGRATIONS array (see `blogs.create_table`, `categories.create_table`)
- CI gate: `scripts/check-migrations.js` TRACKED_COLLECTIONS map (line ~51)

## Key insights (from research)

- `check-migrations.js` only validates collections listed in `TRACKED_COLLECTIONS`. A brand-new
  collection is invisible to the diff check UNLESS added there. Add both new files → their table names.
- Collections in this repo use **serial id + tenant_id integer** for top-level (see `blogs`, `categories`).
  Discount is a top-level collection → `id serial PRIMARY KEY`.
- Array sub-tables (none needed here — discount fields are all scalar) would need `varchar id + _parent_id + _order`.
- `relationship` field → `{field}_id integer` column on the same table (e.g. `order_id`, `discount_id`).
- Money convention in repo = **sen as integer** (`Sites.shippingConfig.westRate` default 800 = RM8). Reuse.
- `timestamps: true` → CI auto-requires `created_at` + `updated_at` columns in the CREATE TABLE.

## Requirements

**Functional**
- `discounts` collection: code, type (percentage|fixed), value, status (active|inactive), usageLimit,
  usageCount, startsAt, expiresAt, tenant, site (optional), description.
- `discount_usage_history` collection: discount (rel), order (rel), tenant, amountApplied (sen),
  customerEmail (snapshot), usedAt.
- `code` unique per tenant.

**Non-functional**
- All migrations idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). NEVER `DROP`.
- `node scripts/check-migrations.js origin/staging` exits 0.
- `npx tsc --noEmit` passes; `payload-types.ts` regenerates cleanly.

## Architecture

```
discounts (serial id, tenant_id, site_id?) ──1:N──→ discount_usage_history (serial id, discount_id, order_id, tenant_id)
                                                              └── order_id → orders.id
```

Two collections (NOT an Orders array sub-table) because usage history is queried standalone for revenue
audit and export, and survives independent of order edits.

## Field spec — `discounts`

| Field | Type | Notes |
|-------|------|-------|
| tenant | relationship→tenants | required, index (scoping) |
| site | relationship→sites | optional (null = all sites of tenant) |
| code | text | required, index; uppercased + unique-per-tenant in beforeChange (Phase 02) |
| description | text | optional |
| type | select: `percentage`/`fixed` | required, default `percentage` |
| value | number | required, min 0; meaning depends on type (pct 0–100, fixed = sen) |
| status | select: `active`/`inactive` | required, default `active`, index |
| usageLimit | number | optional (null = unlimited), min 1 |
| usageCount | number | default 0, `admin.readOnly`; **denormalized COUNT of usage-history rows** — sole writer is the Phase 03 redemption helper (`recordDiscountRedemption`), never the admin |
| startsAt | date | optional; **inclusive start-of-day** (Phase 02 normalizes to 00:00:00 store-tz) |
| expiresAt | date | optional; **inclusive end-of-day** (Phase 02 normalizes to 23:59:59.999 store-tz — see gap H) |

Access control: copy the exact tenant-scoped create/read/update from `Orders.ts`. `delete`: **`() => false`
(soft-delete only — decision J).** "Deleting" a discount = set `status: 'inactive'` via update; the admin UI
Delete button is hidden (`admin.hidden` on delete is not a thing — instead rely on `access.delete: false`,
which removes the row action). Hard delete is forbidden because it orphans `order.discount` FKs + usage history.

## Field spec — `discount_usage_history`

| Field | Type | Notes |
|-------|------|-------|
| tenant | relationship→tenants | required, index |
| discount | relationship→discounts | required, index |
| order | relationship→orders | required, index |
| amountApplied | number | required (sen discounted) |
| customerEmail | email | snapshot for audit |
| usedAt | date | default now (set in hook) |

Access: tenant-scoped read; `create` allowed for authenticated (hook runs as system); `update`/`delete`
→ false (immutable audit trail).

## Migration entries (EXACT — add to `scripts/db-setup.js` MIGRATIONS array)

```javascript
// ── F33: Discounts collection ──
{
  name: 'discounts.create_table',
  sql: `CREATE TABLE IF NOT EXISTS discounts (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL,
    site_id integer,
    code varchar NOT NULL,
    description varchar,
    type varchar DEFAULT 'percentage',
    value numeric DEFAULT 0,
    status varchar DEFAULT 'active',
    usage_limit numeric,
    usage_count numeric DEFAULT 0,
    starts_at timestamptz,
    expires_at timestamptz,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
  );`,
},
{ name: 'discounts.tenant_idx', sql: `CREATE INDEX IF NOT EXISTS discounts_tenant_idx ON discounts (tenant_id);` },
{ name: 'discounts.site_idx', sql: `CREATE INDEX IF NOT EXISTS discounts_site_idx ON discounts (site_id);` },
{ name: 'discounts.status_idx', sql: `CREATE INDEX IF NOT EXISTS discounts_status_idx ON discounts (status);` },
// Unique code PER TENANT (partial — lowercased compare done in app; store uppercased canonical)
{ name: 'discounts.code_tenant_uniq', sql: `CREATE UNIQUE INDEX IF NOT EXISTS discounts_code_tenant_uniq ON discounts (tenant_id, code);` },
// ALTER fallbacks (pushDevSchema may seed skeleton table → ensure each column exists)
{ name: 'discounts.code', sql: `ALTER TABLE discounts ADD COLUMN IF NOT EXISTS code varchar;` },
{ name: 'discounts.description', sql: `ALTER TABLE discounts ADD COLUMN IF NOT EXISTS description varchar;` },
{ name: 'discounts.type', sql: `ALTER TABLE discounts ADD COLUMN IF NOT EXISTS type varchar DEFAULT 'percentage';` },
{ name: 'discounts.value', sql: `ALTER TABLE discounts ADD COLUMN IF NOT EXISTS value numeric DEFAULT 0;` },
{ name: 'discounts.status', sql: `ALTER TABLE discounts ADD COLUMN IF NOT EXISTS status varchar DEFAULT 'active';` },
{ name: 'discounts.usage_limit', sql: `ALTER TABLE discounts ADD COLUMN IF NOT EXISTS usage_limit numeric;` },
{ name: 'discounts.usage_count', sql: `ALTER TABLE discounts ADD COLUMN IF NOT EXISTS usage_count numeric DEFAULT 0;` },
{ name: 'discounts.starts_at', sql: `ALTER TABLE discounts ADD COLUMN IF NOT EXISTS starts_at timestamptz;` },
{ name: 'discounts.expires_at', sql: `ALTER TABLE discounts ADD COLUMN IF NOT EXISTS expires_at timestamptz;` },
{ name: 'discounts.site_id', sql: `ALTER TABLE discounts ADD COLUMN IF NOT EXISTS site_id integer;` },

// ── F33: Discount usage history collection ──
{
  name: 'discount_usage_history.create_table',
  sql: `CREATE TABLE IF NOT EXISTS discount_usage_history (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL,
    discount_id integer NOT NULL,
    order_id integer NOT NULL,
    amount_applied numeric DEFAULT 0,
    customer_email varchar,
    used_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
  );`,
},
{ name: 'discount_usage_history.tenant_idx', sql: `CREATE INDEX IF NOT EXISTS discount_usage_history_tenant_idx ON discount_usage_history (tenant_id);` },
{ name: 'discount_usage_history.discount_idx', sql: `CREATE INDEX IF NOT EXISTS discount_usage_history_discount_idx ON discount_usage_history (discount_id);` },
// (gap B) UNIQUE on order_id — ONE redemption row per order. This is the real idempotency guard:
// Phase 03 INSERTs with ON CONFLICT (order_id) DO NOTHING, so webhook re-delivery / admin re-save never double-count.
// Replaces the plain order_idx (a UNIQUE index already serves lookups by order_id).
{ name: 'discount_usage_history.order_uniq', sql: `CREATE UNIQUE INDEX IF NOT EXISTS discount_usage_history_order_uniq ON discount_usage_history (order_id);` },
{ name: 'discount_usage_history.amount_applied', sql: `ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS amount_applied numeric DEFAULT 0;` },
{ name: 'discount_usage_history.customer_email', sql: `ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS customer_email varchar;` },
{ name: 'discount_usage_history.used_at', sql: `ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS used_at timestamptz DEFAULT now();` },

// ── F33: Orders link to applied discount (optional FK + snapshot) ──
{ name: 'orders.discount_id', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_id integer;` },
{ name: 'orders.discount_code', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code varchar;` },
{ name: 'orders.discount_amount', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;` },
```

Note: `relationship` columns are `_id` integer. CI gate maps bare field `name:` → snake_case column;
relationship field `discount` would be checked as `orders.discount` but real column is `orders.discount_id`.
The ALTER entries above register BOTH the `_id` form and (via the bare names `discount_code`,
`discount_amount`) the scalar forms. For the relationship field `discount` on Orders, also add the bare
alias so the diff check passes: `{ name: 'orders.discount', sql: 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_id integer;' }` is redundant — instead confirm CI maps it; if it flags `orders.discount`, add a no-op alias entry mirroring the existing `tenants.*` duplicate-entry trick (db-setup.js line ~549).

## check-migrations.js alignment

Add to `TRACKED_COLLECTIONS` (line ~51):
```javascript
'Discounts.ts': 'discounts',
'DiscountUsageHistory.ts': 'discount_usage_history',
```
This makes the gate validate that every new field added in the PR diff has a matching migration column.
Both CREATE TABLE bodies already cover all columns, so the gate passes via `isColumnCovered` CREATE-body scan.

## Related code files

**Create**
- `src/collections/Discounts.ts` (<200 lines — fields + access + admin stub; validation hooks in Phase 02)
- `src/collections/DiscountUsageHistory.ts` (<120 lines)

**Modify**
- `src/payload.config.ts` — import both + add to `collections[]` array (after `Customers`)
- `src/collections/Orders.ts` — add 3 fields: `discount` (rel→discounts, readOnly), `discountCode` (text, readOnly), `discountAmount` (number, readOnly, sen)
- `scripts/db-setup.js` — append MIGRATIONS entries above
- `scripts/check-migrations.js` — add 2 TRACKED_COLLECTIONS entries

**Delete:** none

## Implementation steps

1. Create `src/collections/Discounts.ts` mirroring `Orders.ts` access blocks; fields per spec; `timestamps: true`.
   `access.delete: () => false` (soft-delete via `status:'inactive'` — decision J).
2. Create `src/collections/DiscountUsageHistory.ts`; immutable access (create allowed for system; update/delete → false).
3. Register both in `payload.config.ts`.
4. Add 3 discount fields to `Orders.ts` (all `admin.readOnly`).
5. Append all MIGRATIONS entries to `db-setup.js`.
6. Add 2 entries to `TRACKED_COLLECTIONS` in `check-migrations.js`.
7. Run `npx payload generate:types` (or build) to refresh `payload-types.ts`.
8. Run `npx tsc --noEmit`.
9. Run `node scripts/check-migrations.js origin/staging` → expect exit 0.

## Todo

- [ ] Discounts.ts created (fields + tenant-scoped access)
- [ ] DiscountUsageHistory.ts created (immutable)
- [ ] Registered in payload.config.ts
- [ ] Orders.ts gains discount/discountCode/discountAmount fields
- [ ] db-setup.js MIGRATIONS appended (both tables + orders cols + indexes + **UNIQUE `discount_usage_history(order_id)`**)
- [ ] Discounts `access.delete` → `false` (soft-delete via status)
- [ ] check-migrations.js TRACKED_COLLECTIONS updated
- [ ] payload-types.ts regenerated
- [ ] tsc --noEmit clean
- [ ] check-migrations.js exits 0

## Success criteria

- Both tables defined with correct serial-id + tenant_id integer convention.
- Unique-per-tenant index on `(tenant_id, code)` present; site NOT part of uniqueness (decision G).
- **UNIQUE index on `discount_usage_history(order_id)` present** (idempotency guard — gap B).
- Discounts `access.delete` returns `false` (soft-delete only — decision J).
- CI migration gate green. TS compiles. Types regenerated.
- Admin sidebar shows "Discounts" + "Discount Usage History" collections (manual smoke).

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Wrong id type (serial vs varchar) | L×H | Top-level collection → serial confirmed against blogs/categories pattern |
| CI gate blind to new collection | M×M | TRACKED_COLLECTIONS updated in same commit |
| `orders.discount` rel flagged by CI | M×L | Add alias migration entry (duplicate-trick precedent at db-setup.js ~549) |
| Type regen drift in payload-types.ts | L×M | Regenerate + commit; reviewer checks diff |

## Security considerations

- Tenant scoping on every access rule (no cross-tenant read of discounts/usage).
- `usageCount` readOnly in admin — only the Phase 03 redemption helper writes it (prevents manual tampering of limit enforcement).
- Usage history immutable (audit integrity); `delete: false` on discounts too → audit trail can never be orphaned (decision J).
- UNIQUE `(order_id)` on history → a replayed webhook / re-save cannot forge a second redemption row (gap B).

## Next steps

Unblocks Phase 02 (admin config + validation hooks) and Phase 04 (export, reads `discounts` table).
