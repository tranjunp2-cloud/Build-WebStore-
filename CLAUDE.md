# CLAUDE.md — ECH Prime Web v2

> Project-specific rules for AI code assistants (Claude, Cursor, Antigravity).

## Database Schema Changes

When modifying Payload CMS collections (adding/removing fields), you MUST follow these rules:

### 1. Add migration to `scripts/db-setup.js`

Every new column or table must have a matching entry in the `MIGRATIONS` array.

### 2. Follow Payload Drizzle naming convention

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

### 3. Test before PR

```bash
node scripts/check-migrations.js origin/staging
```

CI will block PR if migration is missing or uses wrong convention.

### 4. Example

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

## Docker Standalone Constraints

- `push: true` in payload.config.ts only works with `NODE_ENV=development`
- Docker standalone does NOT have Drizzle compiler — pushDevSchema may not work
- All schema changes MUST go through `scripts/db-setup.js` migrations
- `db-setup.js` runs as Docker CMD before starting the Next.js server

## Email/SMTP

- If `MAIL_HOST` env is not set → Payload uses stream transport (logs to console, no crash)
- Login does NOT require SMTP — Payload default auth returns JWT directly
- OTP endpoints use `sendEmail` with fire-and-forget `.catch()` pattern

## Key Files

| File | Purpose |
|------|---------|
| `scripts/db-setup.js` | Migration executor + server orchestrator |
| `scripts/check-migrations.js` | CI schema validation |
| `src/payload.config.ts` | Payload + DB config |
| `src/collections/*.ts` | Collection definitions (schema source of truth) |
| `.github/workflows/ci.yml` | CI pipeline |
| `Dockerfile` | Docker build (CMD = db-setup.js) |
