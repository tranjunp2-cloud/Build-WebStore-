# Phase 01 — Migration: Slug Composite Unique Per Tenant

**PR:** 1 · **Migration:** YES · **Priority:** P1 (blocks Phase 04) · **Status:** pending

## Context

- Rule: `.claude/rules/database-schema.md` — every schema change needs a `MIGRATIONS` entry in `scripts/db-setup.js`; CI `scripts/check-migrations.js` hard-gates the PR.
- Current: `src/collections/Categories.ts:161-166` field `slug` has `unique: true` → Payload emits a **global** unique index on `categories.slug`.
- Precedent to copy: F05 pages dedup + composite unique — `scripts/db-setup.js:1494-1509` (`pages.dedupe_site_slug` + `pages.site_slug_unique`).
- Current table def: `scripts/db-setup.js:386-399` (`categories.create_table`, `slug varchar` — note the CREATE TABLE itself does NOT declare slug UNIQUE; the global unique index is added by Payload's pushDevSchema, so the real live index name must be verified, not assumed).

## Overview

Convert `categories.slug` uniqueness from **global** → **per-tenant** `(slug, tenant_id)`. Requires: (a) drop old global unique index, (b) dedup existing colliding rows scoped to tenant, (c) create new composite partial unique index (respecting soft-delete via `deleted_at IS NULL`).

## Key Insights

- The `unique: true` on the Payload field must ALSO be removed (Phase 04 file edit) — otherwise Payload re-creates the global index on next `pushDevSchema`. Migration + field edit must ship together in PR-1.
- Soft-delete is active (`deleted_at`), so the unique index MUST be partial (`WHERE deleted_at IS NULL`) to avoid blocking re-use of a slug after a category is soft-deleted — mirrors `pages_site_slug_uniq`.
- The old index name is **unknown until verified**. Payload/Drizzle typically names it `categories_slug_idx` (from `index: true`) and a separate unique — could be `categories_slug_unique` or `categories_slug_key`. DO NOT blind-drop; verify first.

## Requirements

- Functional: two categories in different tenants may share a slug; two active categories in the same tenant may not.
- Non-functional: migration idempotent, no `DROP TABLE`, no data loss for existing tenant data, safe to re-run.

## Architecture / Data Flow

```
pushDevSchema (skeleton) → MIGRATIONS run in order:
  1. categories.dedupe_tenant_slug   (UPDATE ... SET deleted_at, soft-delete newer-loses-older-wins collisions)
  2. categories.drop_global_slug_unique (DROP INDEX IF EXISTS <verified name(s)>)
  3. categories.tenant_slug_unique   (CREATE UNIQUE INDEX IF NOT EXISTS ... (slug, tenant_id) WHERE deleted_at IS NULL)
```

## Related Code Files

**Modify:**
- `scripts/db-setup.js` — append 3 migration entries near the categories block (after line ~399) or with the F05 dedup convention block. Append-only; do not reorder existing entries.

**Read for context:**
- `scripts/db-setup.js:386-399` (categories.create_table), `:1494-1509` (F05 precedent)
- `scripts/check-migrations.js` (validation gate)

**No delete.**

## Implementation Steps

1. **Verify live index names first** (manual, before writing DROP). Run against staging/local DB:
   ```bash
   psql "$DATABASE_URI" -c "\d categories"
   # note every index on slug: e.g. categories_slug_idx (btree), categories_slug_key / categories_slug_unique (UNIQUE)
   psql "$DATABASE_URI" -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='categories';"
   ```
   Record the exact UNIQUE index/constraint name(s). Keep the plain non-unique `categories_slug_idx` (lookup perf) — only drop the UNIQUE one.

2. **Dedup existing colliding rows** (keep newest active per tenant+slug, soft-delete older). Append entry:
   ```js
   {
     name: 'categories.dedupe_tenant_slug',
     sql: `UPDATE categories SET deleted_at = NOW()
       WHERE deleted_at IS NULL
         AND slug IS NOT NULL
         AND id NOT IN (
           SELECT DISTINCT ON (tenant_id, slug) id
           FROM categories WHERE deleted_at IS NULL AND slug IS NOT NULL
           ORDER BY tenant_id, slug, updated_at DESC NULLS LAST, created_at DESC, id DESC
         );`,
   },
   ```

3. **Drop the global unique index** (use the VERIFIED name(s) from step 1; include both likely names, all `IF EXISTS` = safe no-op if absent):
   ```js
   {
     name: 'categories.drop_global_slug_unique',
     sql: `DROP INDEX IF EXISTS categories_slug_unique;
           DROP INDEX IF EXISTS categories_slug_key;`,
   },
   ```
   If `\d` shows the uniqueness as a table CONSTRAINT (not a bare index), use instead:
   `ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_unique;`
   > Adjust names to match step-1 output. Do NOT drop `categories_slug_idx` (non-unique lookup index — keep it).

4. **Create composite partial unique index:**
   ```js
   {
     name: 'categories.tenant_slug_unique',
     sql: `CREATE UNIQUE INDEX IF NOT EXISTS categories_tenant_slug_uniq
           ON categories (tenant_id, slug) WHERE deleted_at IS NULL;`,
   },
   ```

5. Run gate locally:
   ```bash
   node scripts/check-migrations.js origin/staging
   ```

6. Coordinate with Phase 04: remove `unique: true` from `Categories.ts` slug field in the SAME PR (leave `index: true`).

## Todo

- [ ] Verify live UNIQUE index/constraint name via `psql \d categories`
- [ ] Add `categories.dedupe_tenant_slug` migration
- [ ] Add `categories.drop_global_slug_unique` with verified name(s)
- [ ] Add `categories.tenant_slug_unique` composite partial index
- [ ] `check-migrations.js` passes
- [ ] Confirm Phase 04 removes `unique: true` from field in same PR

## Success Criteria

- `check-migrations.js origin/staging` exits 0.
- After apply, `\d categories` shows `categories_tenant_slug_uniq` and NO global unique on slug.
- Inserting same slug across two tenants succeeds; same slug twice in one active tenant fails at DB level.
- Re-running `db-setup.js` is a no-op (idempotent).

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Blind DROP of wrong index name → migration errors / uniqueness silently retained | Med×High | Step-1 `psql \d` verification mandatory; all DROPs `IF EXISTS` |
| Dedup soft-deletes a row the tenant still wants | Low×Med | Keep-newest heuristic + reversible (soft-delete, not hard); communicate to test-tenant owner before running on shared staging |
| Non-partial index blocks slug reuse after delete | Low×Med | `WHERE deleted_at IS NULL` partial index (matches F05) |
| Payload re-adds global index if field `unique:true` left in | Med×High | Phase 04 removes it in same PR — gate on both landing together |

## Security

- No auth surface change. Uniqueness is per-tenant, reinforcing tenant isolation (prevents cross-tenant slug guessing collisions).

## Next Steps

- Phase 04 consumes this: app-layer name/slug dedup validation + field `unique:true` removal.
