# Phase 02 — Customers Collection Schema + Addresses + Rank + Migrations

## Context links

- This plan: [plan.md](./plan.md)
- Depends on: [phase-01-slug-collision-fix.md](./phase-01-slug-collision-fix.md)
- Pattern reference: `src/collections/Sites.ts:13-41` (tenant access), `src/collections/Orders.ts:71-92`, `scripts/db-setup.js:2419-2431` (subscribers email+site unique precedent)
- Rule: `.claude/rules/database-schema.md`

## Overview

- Date: 2026-05-20
- Priority: P0 (foundation for phases 03/04/05)
- Implementation status: completed
- Review status: completed (score: 10.0/10)
- Commit: e57bc4fe
- Description: Create a real persisted `customers` collection with tenant scoping, multi-address book (Payload `array` field), and manual `rank` select tag. Add all `scripts/db-setup.js` migrations (collection table + addresses sub-table + rels ALTERs + unique index). Register in `src/payload.config.ts`. No code touching Orders or UI — pure collection + schema work.

## Key insights

- Primary key shape: `id serial PRIMARY KEY` (Payload default). Identity uniqueness enforced by composite `(tenant_id, email)` UNIQUE INDEX on normalized email (`lower(trim(email))` applied at write time in Payload hook + at DB write via expression index OR stored lowercase column).
- Decision: store email as-typed (preserve casing for display) BUT enforce uniqueness via **expression index** `CREATE UNIQUE INDEX customers_tenant_email_lower_uniq ON customers (tenant_id, LOWER(TRIM(email)))`. This avoids a duplicate `email_normalized` column and keeps schema lean (KISS).
- Addresses modelled as Payload `type: 'array'` field → sub-table `customers_addresses` with `varchar` id, `_parent_id`, `_order` (per `.claude/rules/database-schema.md`). Hard cap 10 addresses via `maxRows: 10` to prevent unbounded growth (R6 in plan risk register).
- `rank` is a `type: 'select'` (single value, NOT hasMany) → stays as column on `customers` table, no sub-table. Allowed values frozen in plan: `bronze|silver|gold|vip`.
- Snapshot fields cached on Customer for fast list/search WITHOUT join: `name`, `phone`. Updated on each linked order (handled in phase-03 hook). Optional `notes` textarea for admin-only.
- Stats fields (`order_count`, `total_spent`, `last_order_at`) deferred — needed for UI rank-by-spend but no auto-calc this plan; phase-04 computes on-the-fly via aggregation query (YAGNI for cached columns).

**Locked decisions (PM 2026-05-20)** — referenced from `plan.md` "Resolved decisions":

- Identity scope **tenant-wide** (omnichannel). Unique index on `(tenant_id, lower(trim(email)))` only; NO `site_id` in identity key.
- Phone column **NOT** unique-indexed. Owner may have shared family/hotline numbers; PW1 parity.
- `delete: () => false` is final (mirrors `Orders.ts:91`). Hard-delete forbidden; future GDPR/anonymize handled in a separate plan, not here.
- Rank enum values stay in English (`bronze|silver|gold|vip`). Localized labels are F21's job — do NOT add per-locale columns or duplicate rank rows.

## Requirements

**Functional**

1. New collection `customers` with slug `'customers'` registered in `src/payload.config.ts`.
2. Fields:
   - `tenant` — relationship → `tenants`, required, indexed.
   - `email` — text, required (Payload field-level validator: trim + lowercase compare for duplicates within tenant).
   - `name` — text, required (snapshot from latest order; updated by Orders hook in phase-03).
   - `phone` — text, optional.
   - `rank` — select, options `bronze|silver|gold|vip`, not required (null = unranked).
   - `addresses` — array, maxRows 10, fields: `label` (text), `line1` (text, required if row present), `line2` (text), `city` (text), `state` (text), `postcode` (text), `country` (text, defaultValue 'Malaysia'), `isDefault` (checkbox).
   - `notes` — textarea, admin-only description.
   - `firstOrderAt` — date, readOnly, set by phase-03 hook on first link.
   - `timestamps: true` (Payload auto-adds `createdAt`/`updatedAt`).
3. Access control mirrors `Sites.ts:13-41` (tenant-scoped read/update; super-admin sees all; create restricted to authenticated users; delete returns `false`).
4. Admin config:
   - `useAsTitle: 'email'`
   - `defaultColumns: ['email', 'name', 'rank', 'phone', 'createdAt']`
   - `description`: "Shop customers (buyers). Auto-created from orders; addresses + rank editable."
5. DB migrations in `scripts/db-setup.js` MIGRATIONS array (exact entries listed under "Implementation steps §3").
6. `COLLECTION_SLUGS[]` (line ~3992) includes `'customers'`.

**Non-functional**

- Collection file ≤200 LOC (split helpers if needed).
- All Payload field-level validators pure functions (testable).
- Migration entries idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`).

## Architecture

```
src/collections/Customers.ts                 ← NEW: collection config
  slug: 'customers'
  hooks: { beforeChange: [ normalizeEmail ] }
  access: { read/update tenant-scoped; create auth-only; delete: false }
  fields: [ tenant, email, name, phone, rank, addresses[], notes, firstOrderAt ]

src/payload.config.ts                        ← +1 import, +1 array entry

scripts/db-setup.js                          ← +6 MIGRATIONS entries (see step 3)
                                              +1 slug in COLLECTION_SLUGS[]
```

Data flow (this phase only — Orders linkage is phase-03):

```
Admin user → POST /api/customers
  → Payload access check (tenant in req.user.tenants)
  → beforeChange.normalizeEmail (email = lower(trim(email)))
  → INSERT INTO customers (tenant_id, email, name, ...)
  → UNIQUE INDEX (tenant_id, LOWER(TRIM(email))) catches duplicates → 409
```

## Related code files

**READ**

- `src/collections/Sites.ts:1-60` (access pattern)
- `src/collections/Orders.ts:71-92` (access pattern)
- `src/collections/Subscribers.ts` (slim collection pattern)
- `scripts/db-setup.js:2419-2461` (subscribers + contact_submissions migrations)
- `scripts/db-setup.js:3992-4023` (`COLLECTION_SLUGS[]`)
- `src/payload.config.ts:116-143` (collections array)

**MODIFY**

- `src/payload.config.ts` (add `Customers` import + array slot)
- `scripts/db-setup.js` (add migration entries; add slug to `COLLECTION_SLUGS[]`)

**CREATE**

- `src/collections/Customers.ts`

**DELETE**

- None.

## Implementation steps

1. **Verify** phase-01 complete (grep `customers` in plan 260429 returns zero).
2. **Author** `src/collections/Customers.ts` per Architecture above. Pseudocode skeleton:

   ```ts
   // pseudocode — actual TS in cook phase
   export const Customers: CollectionConfig = {
     slug: 'customers',
     admin: { useAsTitle: 'email', defaultColumns: [...], description: '...' },
     access: {
       create: ({ req }) => Boolean(req.user),
       read:   tenantScopedFilter,   // copy from Sites.ts:13-21 verbatim
       update: tenantScopedFilter,   // copy from Sites.ts:23-31 verbatim
       delete: () => false,          // mirror Orders.ts:91
     },
     hooks: {
       beforeChange: [
         ({ data }) => {
           if (typeof data.email === 'string') data.email = data.email.trim().toLowerCase()
           return data
         },
       ],
     },
     fields: [
       { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
       { name: 'email',  type: 'email',        required: true, index: true },
       { name: 'name',   type: 'text',         required: true },
       { name: 'phone',  type: 'text' },
       { name: 'rank',   type: 'select', options: [
         { label: 'Bronze', value: 'bronze' },
         { label: 'Silver', value: 'silver' },
         { label: 'Gold',   value: 'gold' },
         { label: 'VIP',    value: 'vip' },
       ]},
       { name: 'addresses', type: 'array', maxRows: 10, fields: [
         { name: 'label',     type: 'text' },
         { name: 'line1',     type: 'text', required: true },
         { name: 'line2',     type: 'text' },
         { name: 'city',      type: 'text' },
         { name: 'state',     type: 'text' },
         { name: 'postcode',  type: 'text' },
         { name: 'country',   type: 'text', defaultValue: 'Malaysia' },
         { name: 'isDefault', type: 'checkbox' },
       ]},
       { name: 'notes',         type: 'textarea', admin: { description: 'Internal admin notes' } },
       { name: 'firstOrderAt',  type: 'date', admin: { readOnly: true } },
     ],
     timestamps: true,
   }
   ```

3. **Add** to `scripts/db-setup.js` MIGRATIONS array (exact entries — 7 total):

   ```js
   // ── F25: Shop Customers collection ──
   { name: 'customers.create_table',
     sql: `CREATE TABLE IF NOT EXISTS customers (
       id serial PRIMARY KEY,
       tenant_id integer NOT NULL,
       email varchar NOT NULL,
       name varchar NOT NULL,
       phone varchar,
       rank varchar,
       notes text,
       first_order_at timestamptz,
       updated_at timestamptz DEFAULT now() NOT NULL,
       created_at timestamptz DEFAULT now() NOT NULL
     );` },
   { name: 'customers.tenant_email_lower_unique',
     sql: `CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_email_lower_uniq
           ON customers (tenant_id, LOWER(TRIM(email)));` },
   { name: 'customers.tenant_index',
     sql: `CREATE INDEX IF NOT EXISTS customers_tenant_idx ON customers (tenant_id);` },
   { name: 'customers_addresses.create_table',
     sql: `CREATE TABLE IF NOT EXISTS customers_addresses (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
       _order integer NOT NULL DEFAULT 0,
       _parent_id integer NOT NULL,
       _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
       label varchar,
       line1 varchar NOT NULL,
       line2 varchar,
       city varchar,
       state varchar,
       postcode varchar,
       country varchar DEFAULT 'Malaysia',
       is_default boolean DEFAULT false
     );` },
   { name: 'customers_addresses.parent_index',
     sql: `CREATE INDEX IF NOT EXISTS customers_addresses_parent_idx
           ON customers_addresses (_parent_id);` },
   { name: 'payload_locked_documents_rels.customers_id',
     sql: `ALTER TABLE payload_locked_documents_rels
           ADD COLUMN IF NOT EXISTS customers_id integer;` },
   { name: 'payload_preferences_rels.customers_id',
     sql: `ALTER TABLE payload_preferences_rels
           ADD COLUMN IF NOT EXISTS customers_id integer;` },
   ```

4. **Append** `'customers'` to `COLLECTION_SLUGS[]` in `scripts/db-setup.js` (around line 3992).
5. **Register** `Customers` in `src/payload.config.ts`:
   - Add `import { Customers } from './collections/Customers'`
   - Append `Customers,` to the `collections: [ ... ]` array.
6. **Run** `node scripts/check-migrations.js origin/staging` locally → MUST exit 0.
7. **Run** `npm run build` → confirm Payload generates TypeScript types for `Customer` and admin loads.
8. **Smoke** (local dev): create one Customer manually via Payload admin UI → verify it appears in list; create a second with same email same tenant → expect 409/duplicate error from unique index.

## Todo

- [x] Phase 01 complete (slug freed)
- [x] Author `src/collections/Customers.ts` ≤200 LOC
- [x] Add 7 migration entries to `scripts/db-setup.js`
- [x] Add `'customers'` to `COLLECTION_SLUGS[]`
- [x] Register in `src/payload.config.ts`
- [x] `node scripts/check-migrations.js origin/staging` → exit 0
- [x] `npm run build` → green
- [x] Manual smoke: create customer; duplicate rejected; tenant scoping verified

## Success criteria

- `customers` and `customers_addresses` tables exist in DB after `db-setup.js` run.
- Unique index `customers_tenant_email_lower_uniq` rejects `Foo@Bar.com` when `foo@bar.com` already exists in same tenant.
- `check-migrations.js` exit 0.
- Tenant-owner can list/create their own customers via admin; super-admin sees all.
- Tenant A cannot read Tenant B's customers via direct REST (`GET /api/customers?where[tenant][equals]=<B>`) — returns empty.
- `delete` blocked (mirrors Orders): API returns 403.

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Expression unique index syntax rejected by Neon Postgres | L×H | Pre-test SQL on staging Neon; fallback = stored `email_normalized` column + plain unique index |
| Payload field-level email validator conflicts with normalization hook | L×M | beforeChange runs after validator; verify in build smoke |
| `maxRows: 10` not enforced (Payload version drift) | L×L | Phase-05 unit test attempts 11 addresses, expects rejection |
| Migration entry naming clashes with `tenants.customer_id` (line 1623 already uses `customer_id`) | L×M | Our migration uses `customers.create_table` (plural) and `customers_id` in rels — no overlap; verify grep |
| `COLLECTION_SLUGS[]` omission silently breaks Payload rels sync | M×H | Step 4 explicit; phase-05 verifies `payload_locked_documents_rels.customers_id` column exists post-migrate |

## Security considerations

- Access pattern copied verbatim from `Sites.ts` → same default-deny posture.
- Email never logged at INFO level (PII).
- `delete: () => false` prevents accidental customer wipe; super-admin must use DB if retention forces deletion (escalate to PM).
- `notes` textarea visible to tenant admins only — Payload field-level access not added (whole collection already tenant-scoped); revisit if PW1 had per-staff hide.

## Next steps

- Phase 03 wires Orders → Customer auto-link hook.
- Phase 04 builds UI on top of this schema.
- Future: cached stats columns (`order_count`, `total_spent`, `last_order_at`) when UI performance demands it (YAGNI now).
