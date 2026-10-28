---
name: database-schema
description: Payload CMS + Drizzle schema changes — migration convention, table naming, CI enforcement
paths:
  - "src/collections/**/*.ts"
  - "src/payload.config.ts"
  - "scripts/db-setup.js"
  - "scripts/check-migrations.js"
---

# Database Schema Changes

When modifying Payload CMS collections (adding/removing fields), you MUST follow these rules.

## 1. Add migration to `scripts/db-setup.js`

Every new column or table must have a matching entry in the `MIGRATIONS` array.
A Payload-backed column/table whose absence breaks queries gets `required: true` (cached like any entry, but a failure fails the build instead of a warning); `critical: true` re-runs every deploy — only for function bodies / idempotent safety nets, never `ALTER TABLE` on hot tables.

## 2. Follow Payload Drizzle naming convention

| Field Type | Table | id | order col | parent col | Extra |
|---|---|---|---|---|---|
| `type: 'array'` | `{collection}_{field}` | `varchar` (UUID) | `_order` | `_parent_id` | `_uuid varchar` |
| `type: 'select' + hasMany` | `{collection}_{field}` | `serial` | `order` | `parent_id` | `value varchar` |
| `type: 'group'` | same table | — | — | — | `{group}_{field}` |
| `type: 'relationship'` | same table | — | — | — | `{field}_id` |

**CRITICAL:**
- Array tables use `varchar` id (UUID) — NEVER `serial`
- Array tables use `_parent_id` and `_order` (WITH underscore)
- Select hasMany tables use `parent_id` and `order` (NO underscore)
- NEVER write `DROP TABLE` in migrations — use `CREATE TABLE IF NOT EXISTS`

## 3. Test before PR

```bash
node scripts/check-migrations.js origin/staging
```

CI will block PR if migration is missing or uses wrong convention.

## 4. Example

```javascript
// Adding array field 'tenants' to Users collection
{
  name: 'users_tenants.create_table',
  sql: `CREATE TABLE IF NOT EXISTS users_tenants (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
    _order integer NOT NULL DEFAULT 0,
    _parent_id integer NOT NULL,
    _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
    tenant_id integer,
    role varchar DEFAULT 'viewer');`,
},
```

## Why this exists (Legacy context)

- `push: true` in `payload.config.ts` only works with `NODE_ENV=development`
- Docker standalone has no Drizzle compiler — pushDevSchema unreliable
- All schema changes MUST go through `scripts/db-setup.js`
- `db-setup.js` runs as part of `vercel build` buildCommand (current Vercel) and previously as Docker CMD (legacy DO, deprecated 2026-04-12)
- `COLLECTION_SLUGS[]` in db-setup.js must include slug for every collection
- ALTER TABLE fallbacks required: pushDevSchema creates skeleton tables → CREATE TABLE IF NOT EXISTS skips → field columns missing → add ALTER TABLE ADD COLUMN IF NOT EXISTS for each field
- `syncPayloadRelsTables()` auto-creates FK columns for `payload_locked_documents_rels` + `payload_preferences_rels`
