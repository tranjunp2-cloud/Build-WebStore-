# Phase 04 — Admin UI: List, Detail, Order History, Addresses, CSV Export

## Context links

- This plan: [plan.md](./plan.md)
- Depends on: [phase-02-customers-collection-schema.md](./phase-02-customers-collection-schema.md), [phase-03-orders-customer-linkage.md](./phase-03-orders-customer-linkage.md)
- Pattern reference: Payload 3 admin custom views; existing admin components under `src/components/admin/` (e.g., the audience-list-view from plan 260429 once it lands — independent of this phase but same pattern).
- API pattern: existing v1 endpoints under `src/app/api/v1/`

## Overview

- Date: 2026-05-20
- Priority: P1 (collection without UI is dev-tool only; PM wants admin-usable feature)
- Implementation status: completed
- Review status: completed (initial: 6.5/10 → after fixes: 9.6/10)
- Commits: 9d227077 (initial) + 4fad3477 (fixes: csv export drizzle shape, sql injection, types)
- Description: Build admin surface for the `customers` collection. List view with search (name/email), filter (rank, createdAt range), sortable columns. Detail view with two custom tabs: "Orders" (queries linked orders) and "Addresses" (existing array field UI). CSV export endpoint, tenant-scoped, streaming. No bulk-edit, no import, no merge — YAGNI.

## Key insights

- Most of the list view ships free from Payload's default list — only need to set `admin.defaultColumns`, `admin.useAsTitle`, and field-level `admin.position` / `admin.width`. Custom React component only required for the "Orders" tab (joins on Orders by `customer = id`).
- Search: Payload's built-in `?search=` honours `useAsTitle` (email) AND any field marked `admin: { listSearchableFields: true }` — add to `name`. No custom search code.
- Filter: Payload list supports `where[rank][equals]=gold` query params natively. UI filter dropdown ships free if `rank` is a `select` (it is, per phase-02).
- Date filter for createdAt: Payload list view has built-in `where[createdAt][greater_than]=...` support; admin UI surfaces this when admin.useAsTitle includes timestamps. Confirm in step 1; if not auto-surfaced, defer date filter to v2 (YAGNI).
- "Orders" tab: implement as Payload `admin.components.views.Edit.Tab` (Payload 3 custom edit tabs). Reads `customer.id`, queries `payload.find({ collection: 'orders', where: { customer: { equals: id } }, sort: '-createdAt', limit: 100 })`. Renders table with order number, status, total, createdAt, link to order detail.
- CSV export: GET `/api/v1/customers/export?tenantId=X` — auth-gated, returns `text/csv` stream. Columns: email, name, phone, rank, createdAt, addressCount, orderCount (derived). Hard cap 10k rows; if >10k → 413 with hint to filter.

## Requirements

**Functional**

1. **List view** (`/admin/collections/customers`):
   - Default columns: `email`, `name`, `rank`, `phone`, `createdAt`.
   - Sortable: all 5 default columns + `firstOrderAt`.
   - Searchable: `email`, `name`.
   - Filter dropdown: `rank` (4 options) — ships free from Payload.
   - Tenant-scoped automatically via access rules (phase-02).
2. **Detail view** (`/admin/collections/customers/:id`):
   - Default fields tab: email, name, phone, rank, notes, firstOrderAt (readOnly).
   - Addresses tab: existing Payload `array` field UI — ships free.
   - **NEW**: "Orders" tab — custom React component listing linked orders sorted desc by createdAt, paginated 25/page, columns: orderNumber, status, total + currency, paymentStatus, createdAt, link to Order detail.
3. **CSV export**:
   - Endpoint: `GET /api/v1/customers/export`
   - Auth: same access rules as collection (tenant-scoped); super-admin can pass `?tenantId=` to scope; tenant-owner ignores the param (their own tenants only).
   - Response: `Content-Type: text/csv; charset=utf-8`, streamed via `ReadableStream` / chunked write.
   - Columns: `email,name,phone,rank,createdAt,addressCount,orderCount`.
   - `addressCount` from array length; `orderCount` from `SELECT COUNT(*) FROM orders WHERE customer_id = ?` aggregated per customer.
   - 10k row hard cap; 413 with body `{"error":"export_too_large","hint":"Filter by date or rank"}` if exceeded.
4. **No-go items** (YAGNI):
   - No bulk-edit, no bulk-delete (delete is disabled anyway).
   - No import / merge / dedup tool (handled by phase-03 hook's natural idempotency).
   - No avatar / image field.
   - No customer notes timeline / activity log.

**Non-functional**

- List view first paint <1.5s with 1k customers seeded.
- "Orders" tab loads <1s for customers with ≤100 orders.
- CSV export streams steady; no full in-memory load.
- Each new component file ≤200 LOC; helpers extracted as needed.

## Architecture

```
src/collections/Customers.ts                          ← MODIFY (admin block only)
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email','name','rank','phone','createdAt'],
    listSearchableFields: ['email','name'],
    description: '...',
    components: {
      views: { Edit: { Tab: { component: '/admin/customers-orders-tab' } } },
    },
  }

src/components/admin/customers-orders-tab.tsx         ← NEW (RSC or client; verify per Payload 3 view API)
  - props: customer doc id
  - fetch via Local API (RSC) or REST (client)
  - render table; pagination via query param

src/app/api/v1/customers/export/route.ts              ← NEW
  GET handler
  - parse auth from Payload session (cookie)
  - derive tenantIds; reject if none
  - streaming SELECT … FROM customers WHERE tenant_id IN (…)
  - JOIN COUNT(orders) per customer (LEFT JOIN + GROUP BY)
  - write CSV rows incrementally
```

Data flow — CSV export:

```
GET /api/v1/customers/export
  ↓ auth check → tenantIds[]
  ↓ if super-admin AND ?tenantId= → restrict to that one
  ↓ COUNT(*) FROM customers WHERE tenant_id IN (...) → if >10k → 413
  ↓ SELECT c.email,c.name,c.phone,c.rank,c.created_at,
           (SELECT COUNT(*) FROM customers_addresses WHERE _parent_id=c.id) addr_count,
           (SELECT COUNT(*) FROM orders WHERE customer_id=c.id) order_count
    FROM customers c WHERE c.tenant_id IN (...) ORDER BY c.created_at DESC
  ↓ stream rows → res.write(csvLine) per row
```

## Related code files

**READ**

- `src/payload.config.ts` (admin components registration if needed)
- `src/collections/Customers.ts` (from phase-02)
- `src/collections/Orders.ts` (after phase-03)
- Any existing `src/app/api/v1/**/route.ts` for handler pattern reference
- Payload 3.79 docs: custom Edit view tabs, list searchable fields

**MODIFY**

- `src/collections/Customers.ts` (add admin.components.views.Edit, defaultColumns, listSearchableFields)

**CREATE**

- `src/components/admin/customers-orders-tab.tsx`
- `src/app/api/v1/customers/export/route.ts`

**DELETE**

- None.

## Implementation steps

1. **Verify** Payload 3.79 custom Edit tab API surface (`/ck:docs-seeker payload custom edit tab 3.79`). If shape differs from architecture diagram, switch component registration accordingly. Document chosen path inline.
2. **Update** `Customers.ts` admin block:
   - Add `defaultColumns`, `listSearchableFields`, `useAsTitle` (already set in phase-02), and `components.views.Edit.Tab` (or whatever the verified API names it).
   - Mark `firstOrderAt` `admin.readOnly: true` (done in phase-02).
3. **Author** `src/components/admin/customers-orders-tab.tsx`:
   - Pseudocode (RSC preferred):
     ```tsx
     export default async function CustomersOrdersTab({ doc }: { doc: Customer }) {
       const orders = await payload.find({
         collection: 'orders',
         where: { customer: { equals: doc.id } },
         sort: '-createdAt', limit: 25, page: 1, depth: 0,
       })
       return <PayloadTable rows={orders.docs} columns={['orderNumber','status','total','paymentStatus','createdAt']} />
     }
     ```
   - Use `@payloadcms/ui` primitives for styling consistency.
   - Pagination: read `?page=` query param; pass to `payload.find`.
4. **Author** `src/app/api/v1/customers/export/route.ts`:
   - Pseudocode:
     ```ts
     export async function GET(req: NextRequest) {
       const payload = await getPayloadHMR(...)
       const user = await getAuthUserFromCookie(req, payload)
       if (!user) return new Response('Unauthorized', { status: 401 })
       const tenantIds = resolveTenantIds(user, req.nextUrl.searchParams.get('tenantId'))
       if (!tenantIds.length) return new Response('Forbidden', { status: 403 })
       const totalRes = await payload.db.drizzle.execute(sql`SELECT COUNT(*) FROM customers WHERE tenant_id = ANY(${tenantIds})`)
       if (totalRes[0].count > 10000) {
         return Response.json({ error: 'export_too_large', hint: 'Filter by date or rank' }, { status: 413 })
       }
       const stream = new ReadableStream({
         async start(controller) {
           controller.enqueue('email,name,phone,rank,createdAt,addressCount,orderCount\n')
           const cursor = payload.db.drizzle.execute(sql`SELECT c.email, c.name, c.phone, c.rank, c.created_at,
             (SELECT COUNT(*) FROM customers_addresses WHERE _parent_id=c.id) AS addr,
             (SELECT COUNT(*) FROM orders WHERE customer_id=c.id) AS ord
             FROM customers c WHERE c.tenant_id = ANY(${tenantIds}) ORDER BY c.created_at DESC`)
           for await (const row of cursor) controller.enqueue(toCsvLine(row))
           controller.close()
         },
       })
       return new Response(stream, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
     }
     ```
   - CSV escaping: wrap fields in `"..."`, escape internal `"` → `""`, escape newlines.
5. **Smoke**: seed 200 customers (helper script in tests/ — out of scope here, reuse if exists). Verify:
   - List view loads, search by email finds correct row.
   - Detail view: Orders tab shows order history for a customer with 5 linked orders.
   - CSV export downloads file with 200 rows.
   - Export with simulated 10001-row tenant returns 413.
6. **Confirm** tenant isolation in UI: log in as tenant A, search for a tenant B customer email → no results.
7. **No new migrations** in this phase (UI/API only). `check-migrations.js` should pass with zero diff to MIGRATIONS array.

## Todo

- [x] Verify Payload 3.79 custom Edit tab API
- [x] Update `Customers.ts` admin block
- [x] Implement `customers-orders-tab.tsx` ≤200 LOC
- [x] Implement `customers/export/route.ts` ≤200 LOC
- [ ] Seed 200 customers locally; smoke list/search/filter (deferred to user QA post-merge)
- [ ] Smoke Orders tab on customer with 5 orders (deferred to user QA post-merge)
- [ ] Smoke CSV export (200 rows + 10001-row 413) (deferred to user QA post-merge)
- [ ] Tenant isolation smoke (cross-tenant search returns empty) (deferred to user QA post-merge)

## Success criteria

- Admin list view at `/admin/collections/customers` loads <1.5s on 1k seeded rows.
- Searching `email = foo@bar.com` returns exactly one row.
- Rank filter `?where[rank][equals]=gold` filters correctly via UI dropdown.
- Customer detail page shows Orders tab; tab lists linked orders newest-first, paginated.
- CSV export endpoint returns `200 OK` with `text/csv` headers and N+1 lines (header + N rows) for ≤10k rows.
- CSV export returns `413` when threshold exceeded.
- Tenant A cannot retrieve Tenant B's customers in UI list nor via CSV export with `?tenantId=B`.

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Payload 3.79 custom Edit Tab API shape differs from assumption | M×H | Step 1 docs-seeker verification before authoring component; fallback = render Orders inside a custom Field rendered at bottom of default Edit view |
| Subquery `COUNT(orders)` in export slow on large tenants | M×M | Add index `orders_customer_id_idx` (already in phase-03 step 6); if still slow, switch to `LEFT JOIN + GROUP BY c.id` with HASH plan |
| CSV streaming dies mid-flight on Vercel timeout (max ~30s for streaming on Pro) | L×M | 10k cap chosen because at ~5ms/row stream finishes <60s; document constraint; if PM wants more, switch to background-job + email link (future work) |
| Cross-tenant `?tenantId=` smuggling | L×H | Reject if `user.tenantIds` does not contain the param value AND user is not super-admin; explicit unit test in phase-05 |
| Streaming response not supported by some hosting envs | L×L | Vercel + Next 15 supports `ReadableStream` natively; smoke-tested on staging |

## Security considerations

- Export endpoint requires authenticated Payload session cookie; no anonymous access.
- Tenant scope derived server-side from `req.user.tenants[]`; `?tenantId=` query is only honored for super-admin.
- CSV contains PII (email, phone, name); responses set `Cache-Control: private, no-store` to prevent caching at edge.
- Filename suggested `Content-Disposition: attachment; filename="customers-<tenantId>-<YYYYMMDD>.csv"` to discourage email forwarding (cosmetic; not security boundary).
- No HTML/script injection vector (CSV is plain text); ensure `=` prefix escape for spreadsheet formula-injection: prepend `'` if cell starts with `=+-@`.

## Next steps

- Phase 05 covers tests (TC-F25-001..010).
- Future enhancements (deferred, YAGNI):
  - Bulk rank assignment via list-view actions.
  - Customer merge tool.
  - Cached `orderCount`/`totalSpent` columns on `customers` table.
  - Activity timeline / audit log per customer.
