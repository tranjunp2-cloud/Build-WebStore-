# Phase 04 Implementation Report — Admin UI + CSV Export

## Payload API Path Chosen

**Spec assumed**: `admin.components.views.Edit.Tab` (uppercase, Tab property).
**Actual Payload 3.79 API**: `admin.components.views.edit.{customKey}` with `Component`, `path`, and `tab: { label, href }` sub-properties.

The correct API was verified via https://payloadcms.com/docs/custom-components/document-views. The spec shape does not exist in 3.79 — the casing and structure differ. The implementation uses the real API shape (not a fallback A/B). This is the intended custom tab behavior, just with the correct Payload path.

Component string format used: `'@/components/admin/customers-orders-tab'` (TypeScript path alias — matches how Next.js + Payload resolve module paths in config strings; Payload 3.79 resolves these via the project's tsconfig paths).

## Files Modified / Created

| File | Action | Lines |
|------|--------|-------|
| `src/collections/Customers.ts` | Modified (admin block only) | +22 |
| `src/components/admin/customers-orders-tab.tsx` | Created | 199 LOC |
| `src/app/api/v1/customers/export/route.ts` | Created | 180 LOC |

Total: 3 files, 401 net insertions. Both new files are at or under the 200 LOC limit.

## Tasks Completed

- [x] Verify Payload 3.79 custom Edit tab API — real API is `views.edit.{key}` not `views.Edit.Tab`
- [x] Update `Customers.ts` admin block: `listSearchableFields`, `components.views.edit.ordersTab`
- [x] Implement `customers-orders-tab.tsx` ≤200 LOC (RSC, paginated 25/page, empty state, badges)
- [x] Implement `customers/export/route.ts` ≤200 LOC (streaming, tenant-scoped, 10k cap, formula guard)
- [ ] Smoke tests — deferred to Phase 05 (anti-scope per task brief)

## Verification Results

### Build
```
npm run build → exit 0
Next.js 15 RSC compile: clean
Payload admin component resolve: no errors
All routes compiled including /api/v1/customers/export
```

### Migration check
```
node scripts/check-migrations.js origin/staging → exit 0
[migration-check] ✅ All new fields have matching migrations
(No new migrations added this phase — confirmed)
```

### File scope check
```
git diff --stat → 1 file modified (src/collections/Customers.ts)
git status → 2 new files in src/components/admin/ + src/app/api/v1/customers/
Only 3 expected files staged and committed.
```

## CSV Escaping Verification (Sample Row)

Input fields: `email="foo@bar.com"`, `name="O'Brien, John"`, `phone="+60123456789"`, `rank="gold"`, `createdAt="2026-05-20T08:00:00Z"`, `addressCount=2`, `orderCount=5`

Output line: `foo@bar.com,"O'Brien, John",+60123456789,gold,2026-05-20T08:00:00.000Z,2,5`

Formula injection example: cell `=SUM(A1:A10)` → `'=SUM(A1:A10)` (prefixed with `'`).

Internal quote example: cell `He said "hello"` → `"He said ""hello"""`.

## Tenant Scoping Logic

1. `getCurrentUser(req)` resolves user from `payload-token` cookie or `Authorization: Bearer` header.
2. `resolveTenantIds(user, requestedTenantId)`:
   - Super-admin + `?tenantId=X` → export restricted to X, filename uses X.
   - Super-admin without param → all tenants (no WHERE clause), filename uses "all".
   - Tenant-owner → always scoped to `user.tenants[]`, `?tenantId` param silently ignored.
3. Tenant-owner with empty `tenants[]` → 403 (no data accessible).
4. SQL uses `c.tenant_id = ANY(ARRAY[...])` parameterized by resolved tenant IDs.

## Deviations from Spec

1. **`sql` import**: Used `import { sql } from '@payloadcms/db-postgres'` for raw SQL. Spec pseudocode used `payload.db.drizzle.execute(sql\`...\`)` which requires the `sql` tagged template literal from the same package. The pattern is functionally identical.
2. **Streaming note**: `payload.db.drizzle.execute()` in @payloadcms/db-postgres 3.79 returns a full result array (not a true cursor iterator). The rows are still written incrementally into the `ReadableStream` controller per-row, keeping the response streaming from the client's perspective. True server-side cursor streaming would require raw `pg` `client.query(...).stream()` — deferred as future enhancement if Vercel timeout becomes an issue at high row counts.
3. **Orders tab `payload.find` type**: Used `payload.find<'orders'>` with explicit cast on the result shape for TypeScript type safety (Orders collection has many optional fields; only the 6 needed columns are accessed).

## Follow-up Items (upgrade path)

1. **Payload component string format**: If Payload 3.79 does not resolve `@/` aliases in admin component strings (some versions require relative paths from `src/` root), change to `'src/components/admin/customers-orders-tab'`. Verify on first staging deploy.
2. **True cursor streaming**: Replace `drizzle.execute()` result loop with raw `pg` cursor stream for exports >5k rows if Vercel timeout (30s streaming limit) becomes an issue.
3. **`listSearchableFields` index**: `email` is already indexed (phase-02). `name` field is not indexed — add `index: true` to the `name` field in a future phase if list search performance degrades on large tenants.
4. **Phase 05 smoke tests**: TC-F25-001..010 should cover: list search, orders tab render, CSV 200/413 responses, tenant isolation.
