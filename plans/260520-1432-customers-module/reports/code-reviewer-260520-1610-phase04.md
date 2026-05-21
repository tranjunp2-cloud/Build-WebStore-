# Code Review — Phase 04 (Customers Admin UI + CSV Export)

Branch: `feat/F25-customers-module` · Commit: `9d227077`
Files: `src/collections/Customers.ts` (+22), `src/components/admin/customers-orders-tab.tsx` (NEW 239 LOC), `src/app/api/v1/customers/export/route.ts` (NEW 221 LOC).

> Note: actual commit shows orders tab = 239 LOC and route = 221 LOC. Both exceed the 200 LOC soft target stated in the phase spec — see MINOR finding #M4.

---

## Scores

| Category | Score | Notes |
|---|---|---|
| 1. Auth gate before DB | 9 | `getCurrentUser` runs first; 401 returned before any DB call. |
| 2. Tenant scope from `req.user.tenants[]` | 7 | Logic correct in `resolveTenantIds`; super-admin path needs SQL hardening (see C2). |
| 3. 413 cap before streaming | 4 | Logic intent correct, but bug: `drizzle.execute()` result shape mistyped — cap check evaluates `Number(undefined ?? 0) = 0` and never trips. See C1. |
| 4. CSV escaping (`,`, `"`, `\n`) | 9 | Correct: prefix-then-wrap, `""` doubling. |
| 5. Formula-injection guard (`=+-@`) | 9 | Correct order: prefix applied before wrap. |
| 6. Headers (CT, Cache-Control, Content-Disposition) | 10 | All three present and correct. |
| 7. No PII in logs | 9 | No PII fields logged; only generic error objects. |
| 8. SQL injection (parameterization) | 2 | **CRITICAL**: `sql.raw(tenantIds.map(id => \`'${id}'\`).join(','))` interpolates raw user input from `?tenantId=` into SQL string. See C2. |
| 9. Stream cleanup | 8 | `controller.close()` on success. No try/catch inside stream `start()` — uncaught error in row loop will reject the stream without `controller.error()`. See M1. |
| 10. Orders tab tenant safety | 6 | `payload.find` called without `req` → Payload Local API defaults to access-bypass. Relies on implicit tenant safety (parent customer doc is access-filtered). Defense-in-depth gap. See M2. |
| 11. Pagination correctness | 9 | `parseInt` clamped to ≥1, NaN-safe. Page 1 default. |
| 12. XSS in orders tab | 8 | React auto-escapes; `escapeHtml` helper in `Badge` is redundant (children are already escaped) but harmless. `href={\`/admin/collections/orders/${o.id}\`}` is safe (URL context). |
| 13. Empty state | 10 | Present at line 130. |
| 14. Customers.ts admin block additions only | 10 | No field/hook/access changes. Diff is admin-block scoped. |
| 15. Payload 3.79 API shape | 9 | Uses lowercase `edit.{key}.Component/path/tab`. Matches 3.79 docs per agent report. |
| 16. `listSearchableFields: ['email','name']` | 10 | Present line 11. |
| 17. Component path `@/` alias | 6 | Agent flagged: `'@/components/admin/customers-orders-tab'` may not resolve in Payload admin string registration on first staging deploy. See M3. |
| 18–21. Anti-scope (no Orders/migrations/tests/import) | 10 | All clean. |
| 22. LOC ≤ 200 | 5 | Both new files exceed: tab 239, route 221. |
| 23. `any` usage | 7 | Multiple `as { roles?: string[] }` and `as Array<{...}>` casts. Tolerable but the cast on line 124/179 is the cause of C1. |
| 24. Types | 7 | `NextRequest` imported correctly. `User` from `'payload'` is generic; project-specific shape applied via casts. |

**Overall: 6.5 / 10** — Critical bug in CSV endpoint blocks merge.

---

## Findings

### CRITICAL

[CRITICAL] `src/app/api/v1/customers/export/route.ts:117,124,179` — `drizzle.execute()` return shape is `{ rows: T[] }`, NOT `T[]`. The route casts to `Array<...>` so:
- Line 124: `countResult[0]?.cnt` → `undefined` → `Number(undefined ?? 0) = 0` → the 10k cap check **never trips** regardless of row count. This silently defeats the 413 guard.
- Line 189: `for (const row of rows)` will throw `TypeError: rows is not iterable` because `rows` is the QueryResult object, not its `.rows` array. Endpoint will 500 on every successful tenant query.
Existing project pattern (`src/app/studio/page.tsx:69-71`, `src/app/api/geo/districts/route.ts:25`): unwrap via `(result as { rows: T[] }).rows` or use `result.rows` directly.
**Fix**: change both call sites to `const { rows } = await db.drizzle.execute(...)` (or `(... as unknown as { rows: T[] }).rows`); update count read to `rows[0]?.cnt`.

[CRITICAL] `src/app/api/v1/customers/export/route.ts:121,163` — **SQL injection via super-admin `?tenantId=` param.** The code builds:
```ts
sql.raw(tenantIds.map((id) => `'${id}'`).join(','))
```
For a super-admin caller, `tenantIds = [requestedTenantId]` (line 83), where `requestedTenantId` comes directly from `req.nextUrl.searchParams.get('tenantId')` with no validation. `sql.raw` bypasses Drizzle's parameterization. Payload value `1'); DROP TABLE customers;--` produces injectable SQL.
The tenant-owner path is safer (IDs derived from authenticated user.tenants[]), but defense-in-depth says no `sql.raw` of user-influenced strings.
**Fix**: parameterize via template-literal interpolation. Drizzle's `sql` tag treats each `${value}` as a bound parameter. Either:
```ts
const ids = tenantIds.map(Number) // tenant_id column is integer
sql`WHERE c.tenant_id = ANY(${ids})`
```
or build `sql.join(ids.map(id => sql`${Number(id)}`), sql`, `)` inside `ANY(ARRAY[...])`. Also validate `requestedTenantId` matches `/^\d+$/` before use.

[CRITICAL] `src/app/api/v1/customers/export/route.ts:121,160-163,173` — **SQL type mismatch.** Schema (per `scripts/db-setup.js:3984-4006`):
- `customers.id` = `serial` (integer)
- `customers.tenant_id` = `integer NOT NULL`
- `customers_addresses._parent_id` = `integer NOT NULL`

Route uses `ARRAY[...]::text[]` and `_parent_id = c.id::text`. Postgres will raise `operator does not exist: integer = text` for the WHERE comparison. Endpoint will 500 even after C1/C2 are addressed.
**Fix**: cast array literal to `::integer[]` and drop `::text` cast on `c.id`. With proper parameterization (C2 fix), this becomes `tenant_id = ANY(${integerArray})` and `_parent_id = c.id`.

### MAJOR

[MAJOR] `src/app/api/v1/customers/export/route.ts:28` — `import { sql } from '@payloadcms/db-postgres'`. The Payload adapter package does not officially re-export `sql`; project pattern (`src/app/studio/page.tsx:1`, `src/app/api/geo/districts/route.ts:8`) uses `import { sql } from 'drizzle-orm'`. May silently work today via tree-shaking but is fragile.
**Fix**: change to `import { sql } from 'drizzle-orm'` to match the established codebase pattern.

[MAJOR] `src/app/api/v1/customers/export/route.ts:144-207` — No try/catch inside the `ReadableStream.start()` body. If the data query throws (typing bug, DB connection drop), the promise rejects but `controller.error(err)` is never called. The HTTP response has already sent `200` + headers + header row, so the client sees a truncated CSV with no error signal.
**Fix**: wrap the data query + row loop in try/catch; on error call `controller.error(err)` so the stream terminates with a network error visible to fetch consumers. Avoid leaking the raw error message to the body (already sent), but ensure logs capture it.

[MAJOR] `src/components/admin/customers-orders-tab.tsx:96-103` — `payload.find` called without a `req` argument. In Payload Local API, omitting `req` defaults to `overrideAccess: true` (i.e., bypasses the Orders collection's access rules). Tenant isolation here relies entirely on the implicit fact that the admin user can only reach this page after passing the Customers `read` access check (so `customer.id` is already tenant-scoped) AND that Orders FK integrity holds.

If a stray Order ever has `customer_id` pointing into another tenant (data corruption or future bug), this view will leak it. Defense-in-depth says scope explicitly.
**Fix**: pass `req` to `payload.find` so access rules run, OR add explicit `tenant: { equals: customer.tenant }` to the `where` clause (requires loading the customer first to read its tenant). Cheapest fix: fetch customer first, then `where: { customer: { equals: id }, tenant: { equals: customer.tenant } }`.

### MINOR

[MINOR] `src/app/api/v1/customers/export/route.ts:217-220` — Catch-all returns plain text `'Internal server error'` without `Cache-Control: no-store`. Edge caches/proxies could cache the 500. Low impact since 500s aren't typically cached, but the rest of the endpoint sets `private, no-store`.
**Fix**: add `headers: { 'Cache-Control': 'private, no-store' }` to the 500 response (and 401/403 for consistency).

[MINOR] `src/app/api/v1/customers/export/route.ts:69,110` — `isSuperAdmin` computed twice (once inside `resolveTenantIds`, once at the route level). Mild DRY violation; if role logic changes, both must update.
**Fix**: return `isSuperAdmin` from `resolveTenantIds` alongside `tenantIds` and `tenantLabel`.

[MINOR] `src/components/admin/customers-orders-tab.tsx:33-35,69` — `escapeHtml` is defined and used inside `Badge`, but React already escapes children in JSX. The double-escape will visibly render `&lt;` if a status ever contains `<`. Status values come from a controlled enum so this is academic, but the helper is dead code at best, misleading at worst.
**Fix**: remove `escapeHtml` helper and call site.

[MINOR] Both new files exceed the 200 LOC soft cap per the phase spec ("Each new component file ≤200 LOC"). Tab is 239, route is 221.
**Fix**: extract CSV helpers (`csvField`, `toCsvLine`) to `src/lib/csv.ts` and Badge/colour maps to `src/components/admin/customers-orders-tab.parts.tsx`. Both will drop below 200.

[MINOR] `src/app/api/v1/customers/export/route.ts:117` — `const db = payload.db as { drizzle: { execute: (q: unknown) => Promise<unknown[]> } }`. The return-type annotation is wrong (`unknown[]` should be `{ rows: unknown[] }`). This wrong type is what enabled C1 to compile cleanly. Even after fixing C1, narrow this cast to the real shape so future calls error correctly.

[MINOR] `src/collections/Customers.ts:21` — Component path uses `@/` alias. The agent flagged uncertainty about Payload 3.79 resolution. If staging build can't resolve, change to a path that matches existing custom-component registrations in the codebase (grep `Component: '` in collection files).

[MINOR] `src/app/api/v1/customers/export/route.ts:141` — Filename uses raw `tenantLabel` which can be `"all"` or a tenant ID. For a maliciously-crafted `?tenantId=foo"; rm -rf /`, the value would be reflected unsanitized into `Content-Disposition`. While CSV download filenames are sandboxed by browsers and the SQL injection would fire first (C2), validate the label is `/^[a-zA-Z0-9_-]+$/` or strip non-safe chars.

### Positive observations

- Auth → tenant resolution → DB order is correct (no DB hit before auth pass).
- CSV escaping order (formula guard before wrap) is correct — many implementations get this wrong.
- `Cache-Control: private, no-store` set on success path (good for PII).
- Phase scope respected: no Orders.ts edits, no migrations, no test files.
- Payload 3.79 API correctly investigated and applied with documented deviation from spec.
- `listSearchableFields` cleanly added without touching access rules.
- Empty state present in orders tab; pagination NaN-safe and clamped to ≥1.
- Tab renders entirely server-side (RSC) — no client JS bloat in admin bundle.

---

## Recommendation

**BLOCKED — must fix critical findings before merge.**

The CSV export endpoint will not work in production as written: the result-shape bug means *every* call 500s, the type-mismatch bug means even with shape fixed the SQL errors, and the `sql.raw` injection is an active security hole. None of these were caught because there are no tests yet (Phase 05 scope) and the agent appears not to have hit the endpoint with a real request during smoke (smoke was deferred per the report).

### Required actions (blocking)

1. Fix `drizzle.execute()` result unwrap (C1).
2. Replace `sql.raw` interpolation with parameterized `${integerArray}` and validate `?tenantId=` (C2).
3. Cast tenant IDs to `integer[]` and remove `c.id::text` cast (C3).

### Recommended actions (non-blocking, fix in same PR if cheap)

4. Switch `sql` import to `drizzle-orm` (M1).
5. Wrap stream body in try/catch with `controller.error()` (M2).
6. Pass `req` to `payload.find` in orders tab OR add explicit `tenant` filter (M3).
7. Smoke locally: `curl /api/v1/customers/export -H "Cookie: payload-token=..."` against a seeded DB. Verify 200 + correct CSV, then verify 413 with >10k seeded customers, then verify 401 anonymous.

### Then proceed to Phase 05

Phase 05 (TC-F25-001..010) should include:
- TC: super-admin `?tenantId=` with SQL-meta-character payload → 400 or stripped.
- TC: tenant-owner ignores `?tenantId=` (verify SQL emitted scopes to own tenants).
- TC: 10001-row tenant returns 413, not partial CSV.
- TC: anonymous → 401.
- TC: stream truncation visible to client on mid-stream error.

---

## Unresolved questions

1. Does Payload 3.79 admin component string registration resolve `@/` alias, or require relative paths? Agent flagged; confirm on first staging deploy.
2. Is super-admin "export all tenants" actually a requirement, or should it always require an explicit `?tenantId=`? The current "no WHERE clause" path is the riskiest one — confirm with PM.
3. For exports approaching 10k rows on tenants with very wide Orders tables, will the two correlated subqueries (`customers_addresses` count + `orders` count per row) finish within Vercel's 30s streaming budget? Agent's deferred "true cursor streaming" note is relevant.

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Overall 6.5/10 — 3 CRITICAL bugs in CSV export (wrong drizzle result shape, sql.raw injection, integer/text type mismatch) block merge. Admin block + orders tab acceptable.
**Concerns/Blockers:** CSV export endpoint will 500 on every call as written; super-admin `?tenantId=` is SQL-injectable.
