# DB Schema & Audit Patterns for F15

## Migration System (scripts/db-setup.js)
- All changes in MIGRATIONS array: `{ name, sql }`
- Idempotent: CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS
- Runs on every deploy (vercel build)
- Array tables: varchar id UUID, `_parent_id`, `_order` (with underscore)
- Select hasMany: serial id, `parent_id`, `order` (no underscore)

## Relevant Existing Tables
- `users` (serial id), `tenants` (serial id), `sites` (serial id)
- `users_tenants` — array table linking users to tenants (role, status)
- `users_tenants_permissions` — hasMany select table
- `ai_usage_logs` — per-call AI observability (tokens, cost, latency, model)
- `analytics` — storefront page/event tracking
- `notifications` — in-app per user per tenant

## Patterns to Follow
- `AiUsageLogs`: fire-and-forget writes, super-admin read only, access.create: () => false
- Helper pattern: `src/lib/ai/log-usage.ts` with `.catch(() => {})`
- Register in `src/payload.config.ts`

## No Drizzle Schema Files
- Payload generates Drizzle schema at build time
- Manual supplement via scripts/db-setup.js MIGRATIONS
