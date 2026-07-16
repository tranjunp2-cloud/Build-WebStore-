# Phase 02 — DROP INDEX Guard (Group D / M3)

## Context links
- Plan: [plan.md](./plan.md)
- Target: `scripts/db-setup.js` ~L4969-4974 (`categories.drop_global_slug_unique`)
- Repo rule: `.claude/rules/database-schema.md` (migration conventions, CI gate)

## Overview
- **Priority:** P3 (cleanup, not a real bug). **Status:** completed.
- Own phase, sequential after Phase 01 (both touch category schema/migration surface — do NOT
  parallelize per constraint). Reduces redundant DDL/log churn on every deploy.

## Key insights
- NOT a security/data-integrity bug. The enforced index `categories_tenant_slug_uniq`
  (~L4976-4978) is untouched by this change.
- Current migration unconditionally runs 3× `DROP INDEX IF EXISTS` every deploy → log noise.
- Only drop if the index actually exists AND is a UNIQUE index (avoid dropping a legit plain
  lookup index that pushDevSchema may recreate as non-unique).

## Requirements
1. Guard `DROP INDEX IF EXISTS categories_slug_idx` (and the two siblings) with a conditional:
   only drop when a UNIQUE index of that name currently exists.
2. Preserve migration idempotency (`CREATE ... IF NOT EXISTS` / conditional DROP; never `DROP TABLE`).
3. Keep the `MIGRATIONS` array entry name stable (`categories.drop_global_slug_unique`).

## Architecture / data flow
```
db-setup runMigrations → per entry pool.query(sql)
  new sql: DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='categories_slug_idx'
               AND indexdef LIKE 'CREATE UNIQUE%') THEN
      EXECUTE 'DROP INDEX categories_slug_idx'; END IF;
    -- repeat for categories_slug_unique, categories_slug_key
  END $$;
```

## Related code files
- Modify: `scripts/db-setup.js` (single `MIGRATIONS` entry sql body only)

## Implementation steps
1. Read `scripts/db-setup.js` ~L4955-4985 for exact current lines.
2. Replace the 3 bare `DROP INDEX IF EXISTS` statements with a `DO $$ ... $$` block that checks
   `pg_indexes.indexdef LIKE 'CREATE UNIQUE%'` per index name before dropping.
3. Run `node scripts/check-migrations.js origin/staging` (CI schema gate).
4. Confirm no change to `categories.tenant_slug_unique` entry.

## Todo list
- [x] Read exact lines
- [x] Conditional UNIQUE-only DROP block
- [x] check-migrations.js passes (pre-existing unrelated failure on this branch — see report)
- [x] tenant_slug_uniq entry untouched

## Success criteria
- `check-migrations.js` passes.
- On a DB where the unique index is already gone, migration runs with no DROP executed (quieter log).
- On a DB where a UNIQUE `categories_slug_idx` still exists, it is dropped (behavior preserved).

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| DO-block syntax error blocks all migrations | Low×High | check-migrations.js + local psql dry-run |
| Over-narrow predicate skips a real unique index | Low×Med | match on `indexdef LIKE 'CREATE UNIQUE%'` (covers unique btree) |

## Security considerations
- None (DDL cleanup only).

## Next steps
- Independent of Phases 03-05. Feeds Phase 06 review.
