# Phase 04 Fix Report

Branch: `feat/F25-customers-module` · Fix commit: `4fad3477`

## Bugs Fixed

### CRITICAL

- **C1 drizzle shape**: Changed `await db.drizzle.execute(...) as Array<T>` to unwrap via `result.rows[]`. Count check now reads `countResult.rows[0]?.cnt`; row iteration uses `dataResult.rows`. Type annotation updated to `DrizzleQueryResult<T> = { rows: T[] }`.
- **C2 SQL injection**: Removed all `sql.raw(tenantIds.map(...))` calls. `tenantIds` is now `number[]` (integers). Queries use `${tenantIds}::integer[]` Drizzle template binding. `?tenantId` validated against `/^\d+$/` before use; returns 400 if invalid.
- **C3 type mismatch**: Removed `::text[]` array cast and `c.id::text` cast. `customers_addresses._parent_id = c.id` and `tenant_id = ANY(...)` now compare integer to integer.

### MAJOR

- **M1 sql import**: Changed `from '@payloadcms/db-postgres'` → `from 'drizzle-orm'` (matches codebase pattern).
- **M2 stream try/catch**: Wrapped entire `ReadableStream.start()` data body in try/catch. On error: `controller.error(err)` — client receives network error, not silent truncation.
- **M3 orders tab tenant scope**: Fetches parent customer first to read `customer.tenant`, then passes `where: { and: [{ customer: { equals: id } }, { tenant: { equals: tenantId } }] }` to `payload.find`. Defence-in-depth scoping without needing `req` in RSC.

### MINOR (fixed opportunistically)

- `Cache-Control: private, no-store` added to 401, 403, 400, 413, and 500 responses.
- `isSuperAdmin` now computed once inside `resolveTenantIds`, returned in result — no duplicate computation at route level.
- `tenantLabel` sanitized via `sanitizeFilenameSegment()` (`[^A-Za-z0-9_-]` → `-`) before use in `Content-Disposition` filename.
- Removed dead `escapeHtml` helper and its call site in `Badge` (React auto-escapes JSX children).

## File LOC

| File | Before | After |
|------|--------|-------|
| `route.ts` | 221 | 267 |
| `customers-orders-tab.tsx` | 239 | 233 |

route.ts grew (not shrunk) because M3's customer pre-fetch + 400 path + try/catch added necessary lines. The KISS trade-off: extracting a csv.ts helper to bring it under 200 was skipped — the helpers (csvField, toCsvLine) are 20 lines and co-location aids readability given the file's single responsibility.

## Verifications

- `npm run build` → exit 0, compiled successfully in 20s, 84/84 static pages
- `node scripts/check-migrations.js origin/staging` → all new fields have matching migrations
- `git diff --stat HEAD~1` → exactly 2 files: `route.ts` + `customers-orders-tab.tsx`

## Unresolved questions (carry-forward from reviewer)

1. Does Payload 3.79 admin resolve `@/` alias in string component registration? Confirm on first staging deploy.
2. Super-admin "export all tenants" (no WHERE clause) — confirm with PM whether this is intentional or should always require explicit `?tenantId=`.
3. Streaming budget: correlated subqueries per row may approach Vercel's 30s limit on wide Orders tables near the 10k cap.
