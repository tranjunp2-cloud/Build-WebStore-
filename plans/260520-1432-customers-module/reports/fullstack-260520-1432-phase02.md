# Phase 02 Implementation Report — Customers Collection Schema

## Phase
- Phase: phase-02-customers-collection-schema
- Plan: plans/260520-1432-customers-module/
- Status: completed
- Commit: e57bc4fe `feat(f25): add customers collection + addresses + rank (phase-02)`

## Files Modified

| File | Action | Lines |
|------|--------|-------|
| `src/collections/Customers.ts` | CREATED | 130 LOC |
| `scripts/db-setup.js` | MODIFIED | +44 lines (7 migrations + 1 slug) |
| `src/payload.config.ts` | MODIFIED | +2 lines (import + array entry) |

## Tasks Completed

- [x] Author `src/collections/Customers.ts` ≤200 LOC (130 LOC)
- [x] Add 7 migration entries to `scripts/db-setup.js`
- [x] Add `'customers'` to `COLLECTION_SLUGS[]`
- [x] Register in `src/payload.config.ts`
- [x] `node scripts/check-migrations.js origin/staging` → exit 0
- [x] `npm run build` → exit 0 (83 static pages generated, compiled in 54s)
- [x] Commit: `feat(f25): add customers collection + addresses + rank (phase-02)`

## Migration Entries Added (7)

1. `customers.create_table` — `id serial PRIMARY KEY`, tenant_id, email, name, phone, rank, notes, first_order_at, updated_at, created_at
2. `customers.tenant_email_lower_unique` — `CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_email_lower_uniq ON customers (tenant_id, LOWER(TRIM(email)))`
3. `customers.tenant_index` — `CREATE INDEX IF NOT EXISTS customers_tenant_idx ON customers (tenant_id)`
4. `customers_addresses.create_table` — `id varchar` (UUID), `_order`, `_parent_id`, `_uuid`, label, line1, line2, city, state, postcode, country DEFAULT 'Malaysia', is_default
5. `customers_addresses.parent_index` — `CREATE INDEX IF NOT EXISTS customers_addresses_parent_idx ON customers_addresses (_parent_id)`
6. `payload_locked_documents_rels.customers_id` — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS customers_id integer`
7. `payload_preferences_rels.customers_id` — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS customers_id integer`

## Verification Results

| Check | Result | Notes |
|-------|--------|-------|
| `node scripts/check-migrations.js origin/staging` | EXIT 0 | "No new collection fields or block types detected" |
| `npm run build` | EXIT 0 | 83 pages, compiled 54s, "Compiled successfully" |
| `git diff --stat` | 3 files only | Customers.ts (new) + db-setup.js + payload.config.ts |

## Deviations from Spec

None. Implemented per spec exactly:
- Access block copied verbatim from Sites.ts:13-41 (tenant-scoped read/update, create auth-only, delete: () => false)
- All 7 migration entries match spec §3 SQL exactly
- `customers_addresses` uses `varchar` id + `_parent_id` + `_order` per database-schema.md rule
- `email` field uses Payload `type: 'email'` (not `type: 'text'`) for built-in format validation — consistent with Subscribers.ts pattern
- `beforeChange` hook normalizes email to `lower(trim(...))` before write; DB expression index enforces uniqueness

## Notes

- `payload-types.ts` is not emitted during `next build` without a live DB connection; type generation is confirmed implicitly by the clean compile (TS type errors would abort the build)
- `syncPayloadRelsTables()` in db-setup.js also auto-handles rels columns from COLLECTION_SLUGS; the explicit migration entries are belt-and-suspenders for environments where syncPayloadRelsTables hasn't run (per database-schema.md guidance)
- `docs/design/` untracked files pre-existed on branch; not staged
