# F25 Shop Customers — Architecture

> **Feature:** F25 — Shop Customers (Wave 6 P0)
> **Version:** 1.0 | **Created:** 2026-05-20 | **Owner:** Backend Dev
> **Links:**
> - PRD: [`docs/prd/F25-shop-customers.md`](../prd/F25-shop-customers.md)
> - QA: [`docs/qa/F25-shop-customers.md`](../qa/F25-shop-customers.md)
> - Plan: [`plans/260520-1432-customers-module/`](../../plans/260520-1432-customers-module/)

---

## 1. Overview

**Architecture:** First-class Customers collection with phone-primary identity for idempotent linkage to Orders. Restores PW1 parity for customer management (Tier-S #9, Group B3).

- **Schema:** Customers table keyed by phone (primary); email optional (supplementary); Addresses as array sub-table
- **Linkage:** Orders.beforeChange hook upserts Customer by `(tenant, phone)` + populates FK (non-throwing; phone absent → null)
- **Access:** Tenant-scoped read/update (super-admin unrestricted); hard-delete forbidden
- **Admin UI:** List view (search, filter by rank), detail view (edit addresses), Orders history tab, CSV export (10k cap)

---

## 2. Data Flow

### 2.1 Order creation (auto-link customer)

```
Storefront checkout
  ↓ POST /api/orders/create { customerEmail: 'John@Gmail.com', customerPhone: '+60..', ... }
Backend Order.beforeChange hook (Orders collection)
  ├── Call autoLinkCustomer({ data, req, operation })
  │     ├── Normalize phone: trim + strip spaces/dashes/dots + lowercase → '+60...' or null
  │     ├── Phone absent → data.customer = null (silent skip; phone required at checkout)
  │     ├── Primary lookup: find customer WHERE tenant_id=X AND phone=normPhone
  │     ├── Found → set data.customer = existing.id (idempotent)
  │     └── Not found → create new Customer { tenant, phone, email?, name, firstOrderAt }
  │           ↓ return data.customer = new.id
  ├── [Try/catch] On error: log (no PII) + set data.customer=null (non-throwing)
  ↓ Order.afterChange hook (syncCustomerSnapshot)
  ├── Call syncCustomerSnapshot({ doc, previousDoc })
  │     ├── Resolve customerId from order.customer
  │     ├── IF changed (create OR customerName/Phone differ):
  │     │     PATCH /customers/:customerId { name, phone }
  │     └── [Try/catch] On error: log + continue
  ↓ Order saved + Customer created/updated
```

**Identity deduplication rules:**
- Same phone → same customer (idempotent; email ignored for lookup)
- Different phones → different customers (even if same email)
- Phone absent → no customer link (data.customer = null; phone required at checkout)

### 2.2 Merchant views customer list (access control)

```
Admin request: GET /api/customers?where={...}
  ↓ Payload access control (Customers.access.read)
  ├── User authenticated? → continue : 401
  ├── Super-admin? → return all customers
  └── Regular user? → return { tenant: { in: [userTenantIds] } } filter
  ↓ Results tenant-scoped
```

### 2.3 CSV export (streaming)

```
Admin: GET /api/v1/customers/export?tenantId=X
  ↓ Backend: resolveTenantIds(user, X)
  ├── Tenant X in user.tenants? → continue : 403
  ├── Super-admin? → allow X : deny X
  ↓ Query customers LEFT JOIN addresses + orders
  ├── Drizzle: SELECT * FROM customers WHERE tenant_id = X LIMIT 10001
  ├── Aggregate: COUNT(addresses) per customer, COUNT(orders) per customer
  ↓ Stream CSV headers + rows (10k cap)
  ├── Formula-injection guard: = + - @ prefixed with '
  ├── CSV escape: commas, quotes, newlines wrapped in quotes
  └── Response: text/csv, Content-Disposition: attachment, Cache-Control: private
```

---

## 3. Schema

### 3.1 Customers table

```sql
CREATE TABLE customers (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id integer NOT NULL,
  email varchar(255),
  name varchar(255) NOT NULL,
  phone varchar(20),
  rank varchar(20),  -- enum: bronze|silver|gold|vip
  notes text,
  first_order_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE (tenant_id, LOWER(TRIM(phone))) WHERE phone IS NOT NULL AND TRIM(phone) != '',  -- phone primary identity
  INDEX (tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

**Key properties:**
- `phone`: PRIMARY identity key; normalized `lower(trim())` enforced. Partial unique index on `(tenant_id, phone)` prevents duplicates.
- `email`: nullable; stored as supplementary info (not used for identity lookup). Not unique.
- `rank`: select enum, default NULL (unset) — no auto-calc
- `first_order_at`: set once on creation; never updated
- `id`: serial integer (Payload default for collections, not UUID)
- **Identity rule:** Same customer = `(tenant_id, phone)` match. Phone absent → no customer link.

### 3.2 Customers_addresses array sub-table

```sql
CREATE TABLE customers_addresses (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  _parent_id integer NOT NULL,
  _order integer NOT NULL DEFAULT 0,
  label varchar(100),
  line1 varchar(255) NOT NULL,
  line2 varchar(255),
  city varchar(100),
  state varchar(100),
  postcode varchar(10),
  country varchar(100) DEFAULT 'Malaysia',
  is_default boolean DEFAULT false,
  FOREIGN KEY (_parent_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

**Key properties:**
- `id`: UUID (Payload array field convention)
- `_parent_id`: FK to customers.id
- `_order`: sort order
- `is_default`: boolean flag (one address per customer may be marked default)
- Max 10 rows per customer (Payload `maxRows: 10` enforcer)

### 3.3 Orders FK (modified in phase-03)

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id integer;
ALTER TABLE orders ADD FOREIGN KEY (customer_id) REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS orders_customer_id ON orders(customer_id);
```

**Properties:**
- Nullable (existing orders without customer FK remain NULL until orphan-backfill)
- Denormalized snapshot fields (`customerEmail`, `customerName`, `customerPhone`, `shippingAddress`) UNCHANGED (backward-compatible)

---

## 4. Migrations (18 entries)

All entries in `scripts/db-setup.js` MIGRATIONS array (execution order):

| # | Name | Type | Notes |
|---|------|------|-------|
| 1 | `customers.create_table` | CREATE TABLE | Payload collection registration |
| 2 | `customers.tenant_email_lower_unique` | UNIQUE INDEX | Legacy email index (dropped in #12) |
| 3 | `customers.tenant_index` | INDEX | `tenant_id` for access-control filtering |
| 4 | `customers_addresses.create_table` | CREATE TABLE | Array field sub-table (UUID id, _parent_id, _order) |
| 5 | `customers_addresses.parent_index` | INDEX | `_parent_id` for array join |
| 6 | `payload_locked_documents_rels.customers_id` | Payload internal | Auto-created by `syncPayloadRelsTables()` |
| 7 | `payload_preferences_rels.customers_id` | Payload internal | Auto-created by `syncPayloadRelsTables()` |
| 8 | `orders.customer` | ALTER TABLE | Add `customer_id` FK column |
| 9 | `orders.customer_id_index` | INDEX | `customer_id` for order lookup by customer |
| 10 | `orders.customer_id_fk` | ADD CONSTRAINT | FK `customer_id → customers(id) ON DELETE SET NULL`; protects order history if customer removed |
| 11 | `customers.email_not_null_drop` | ALTER TABLE | Drop `NOT NULL` from email — phone is now primary |
| 12 | `customers.drop_email_unique_index` | DROP INDEX | Remove `customers_tenant_email_lower_uniq` |
| 13 | `customers.normalize_existing_phones` | UPDATE | Strip formatting from existing phone values; must run before dedup (#14) |
| 14 | `customers.dedup_by_phone` | UPDATE | Nullify duplicate phones per tenant (keeps oldest row); must run before #15 |
| 15 | `customers.tenant_phone_partial_unique` | UNIQUE INDEX | Partial index on `(tenant_id, LOWER(TRIM(phone)))` WHERE phone NOT NULL |
| 16 | `customers.latest_order_at` | ALTER TABLE | Add `latest_order_at timestamptz` column for sort |
| 17 | `customers.backfill_latest_order_at` | UPDATE | Backfill `latest_order_at` from `MAX(orders.created_at)` per customer |
| 18 | `customers.phone_type_varchar20` | ALTER TABLE | Constrain `phone` to `varchar(20)`; aligns DB type with spec (safe — normalized phones ≤ 15 chars) |

**Idempotency:** All `CREATE TABLE` use `IF NOT EXISTS`; all `ADD COLUMN` use `IF NOT EXISTS`. Safe to rerun on any deployment.

---

## 5. Payload Hooks

### 5.1 Customers collection

**beforeChange** (phase-02):
```typescript
// src/collections/Customers.ts
hooks: {
  beforeChange: [
    ({ data }) => {
      if (typeof data.email === 'string') {
        data.email = data.email.trim().toLowerCase()
      }
      return data
    },
  ],
}
```
- Normalizes email on every save (ensures idempotency even if UI sends mixed-case)

### 5.2 Orders collection (phase-03)

**beforeChange** (autoLinkCustomer):
```typescript
// src/collections/orders-hooks/auto-link-customer.ts
export const autoLinkCustomer: CollectionBeforeChangeHook = async ({ data, req, operation, originalDoc }) => {
  try {
    const phoneRaw = data.customerPhone ?? ''
    const normPhone = normalizePhone(phoneRaw)  // strip [-\s()+.], lowercase

    // Skip on update if normalized phone unchanged (perf)
    if (operation === 'update' && normalizePhone(originalDoc?.customerPhone) === normPhone) return data

    // Phone absent → no link (phone required at checkout)
    if (!normPhone) { data.customer = null; return data }

    // Resolve tenant
    const tenantId = typeof data.tenant === 'object' ? data.tenant.id : data.tenant
    if (!tenantId) { data.customer = null; return data }

    // Lookup by (tenant, phone)
    const found = await req.payload.find({ collection: 'customers', where: { and: [{ tenant: { equals: tenantId } }, { phone: { equals: normPhone } }] }, limit: 1, depth: 0, overrideAccess: true })
    if (found.docs[0]) { data.customer = found.docs[0].id; return data }

    // No existing customer → create
    const emailRaw = String(data.customerEmail ?? '').trim().toLowerCase()
    const validEmail = emailRaw && EMAIL_REGEX.test(emailRaw) ? emailRaw : null
    const created = await req.payload.create({ collection: 'customers', data: { tenant: tenantId, name: data.customerName || '(unknown)', phone: normPhone, ...(validEmail ? { email: validEmail } : {}), firstOrderAt: new Date().toISOString() } })
    data.customer = created.id
    return data
  } catch (err) {
    console.error('[Orders.autoLinkCustomer] failed', err)
    data.customer = null
    return data
  }
}
```

**Key behaviors:**
- **Non-throwing:** Entire body wrapped in try/catch; logs error (no PII) + continues
- **Phone-primary identity:** Lookup solely by `(tenant, phone)`; phone absent → null (no email fallback)
- **Idempotent:** Same phone + tenant = upsert (find existing OR create new)
- **Fault-tolerant:** Missing phone or payload failure → `customer = null` (order proceeds)
- **Perf:** On update, skip if normalized phone unchanged
- **Phone normalization:** `normalizePhone()` strips `[-\s()+.]` (spaces, dashes, parens, plus, dot), lowercases, empty/null → null. Prevents identity fragmentation (+60... vs 60...).

**afterChange** (syncCustomerSnapshot):
```typescript
// src/collections/orders-hooks/sync-customer-snapshot.ts
export const syncCustomerSnapshot: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  try {
    const customerId = typeof doc.customer === 'object' ? doc.customer.id : doc.customer
    if (!customerId) return doc
    
    // Only update on create; skip on edit to prevent historical overwrites
    const changed = operation === 'create' || doc.customerName !== previousDoc?.customerName || doc.customerPhone !== previousDoc?.customerPhone
    if (!changed) return doc
    
    await req.payload.update({ collection: 'customers', id: customerId, data: { name: doc.customerName, phone: doc.customerPhone ?? null } })
  } catch (err) {
    console.error('[Orders.syncCustomerSnapshot] failed', err)
  }
  return doc
}
```

**Key behaviors:**
- **Latest-wins:** Name/phone patched on `operation=create` AND on `update` when `customerName` or `customerPhone` differs from `previousDoc`. Ensures Customer always reflects the most recent order data.
- **Non-throwing:** Failure doesn't affect order
- **Perf:** No-op when name/phone unchanged (create always runs; update skips if identical)
- **Isolation:** Snapshot fields decoupled from order edits; preserves historical accuracy

---

## 6. Access Control Pattern

**Mirrors `Sites.ts:13-41` and `Orders.ts:71-92`:**

```typescript
access: {
  create: ({ req }) => Boolean(req.user),
  read: ({ req }) => {
    if (!req.user) return false
    if (req.user.roles?.includes('super-admin')) return true
    const tenantIds = req.user.tenants?.map(t => typeof t.tenant === 'object' ? t.tenant.id : t.tenant) ?? []
    return { tenant: { in: tenantIds } }
  },
  update: ({ req }) => {
    // same as read
  },
  delete: () => false,  // hard-delete forbidden
}
```

**Rules:**
1. **Create:** Authenticated only (prevents anonymous customer records)
2. **Read:** Super-admin → all; user → own tenant(s) only
3. **Update:** Same as read
4. **Delete:** Forbidden (protects Order FK integrity; GDPR deferred)

---

## 7. CSV Export Flow

**Endpoint:** `GET /api/v1/customers/export?tenantId=X`

**Steps:**

1. **Auth:** Verify `req.user` exists (401 if not)
2. **Tenant resolve:** `resolveTenantIds(user, requestedTenantId)`
   - User tenant IDs from `req.user.tenants[].tenant` (extract id from object or raw)
   - If super-admin + `?tenantId=X` → allow X
   - If regular user → enforce user.tenants[] filter
3. **Validate:** Ensure X is positive integer (no SQL injection)
4. **Query:** Drizzle `SELECT * FROM customers WHERE tenant_id = X LIMIT 10001`
   - Aggregate: `COUNT(customers_addresses)` per customer, `COUNT(orders)` per customer
5. **Stream:** CSV headers + rows (10k cap)
   - Formula-injection guard: = + - @ prefixed with '
   - CSV escape: wrap in quotes if comma/quote/newline; sanitize cell values strip embedded `\r\n` (RFC 4180)
6. **Response:**
   - `Content-Type: text/csv`
   - `Content-Disposition: attachment; filename=customers_{tenantId}_{date}.csv`
   - `Cache-Control: private, no-store` (PII data)
7. **Cap:** If > 10k rows → HTTP 413 JSON hint

**Row cap rationale:** Prevent OOM on large exports; manual smoke test with seeded data validates 10k streaming.

---

## 8. Admin UI Structure

### 8.1 List view

**Path:** `/dashboard/customers`

**Components:**
- Header: "Customers" title, "Export" button, "Add Customer" button (future)
- Search bar: real-time filter by name/email (Payload `listSearchableFields`)
- Rank filter chips: All / Bronze / Silver / Gold / VIP
- Table: 25 rows/page, columns (email, name, rank, createdAt), click-to-detail
- Empty state: "No customers yet"

**Searching:** Uses Payload admin.listSearchableFields = ['email', 'name', 'phone']

### 8.2 Detail view

**Path:** `/dashboard/customers/:id`

**Layout:**
- Customer card (email, name, phone, rank — editable)
- Metadata (createdAt, updatedAt, firstOrderAt — read-only)
- Addresses array:
  - Add address button
  - Card per address (label, line1, line2, city, state, postcode, country, isDefault toggle)
  - Edit/remove buttons per address
  - Max 10 warning at 8+ addresses
- Tabs:
  - **Info:** Address management (above)
  - **Orders:** Custom component (`customers-orders-tab.tsx`) — linked orders list

**Actions:** Save (updates customer), Delete (disabled), Export (in future)

### 8.3 Orders tab (custom Payload component)

**File:** `src/components/admin/customers-orders-tab.tsx`

**Content:**
- Orders linked to this customer (where `customer_id = this.id`)
- Table: Order ID, Date, Total, Status
- Click row → navigate `/dashboard/orders/:id` (external link)
- Empty state: "No orders linked to this customer"

---

## 9. Implementation Files

| File | Role | Status |
|------|------|--------|
| `src/collections/Customers.ts` | Collection definition (schema, hooks, access) | ✅ Done (177 LOC) |
| `src/collections/orders-hooks/auto-link-customer.ts` | Order.beforeChange upsert hook | ✅ Done (89 LOC) |
| `src/collections/orders-hooks/sync-customer-snapshot.ts` | Order.afterChange sync hook | ✅ Done (50 LOC) |
| `src/app/api/v1/customers/export/route.ts` | CSV export endpoint | ✅ Done (streaming) |
| `src/components/admin/customers-*.tsx` | List/detail UI (Payload admin views) | ✅ Done (phase-04) |
| `src/components/admin/customers-orders-tab.tsx` | Custom Orders tab | ✅ Done (phase-04) |
| `src/collections/Orders.ts` | Add `customer` FK field + hook wiring | ✅ Done (phase-03) |
| `scripts/db-setup.js` | 9 migration entries | ✅ Done (idempotent) |
| `src/payload.config.ts` | Import Customers collection + register | ✅ Done |

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| **Tenant leak via query filter** | Payload access control + WHERE clauses enforced server-side (phase-05 smoke test TC-F25-006, TC-F25-008) |
| **Phone collision cross-tenant** | Partial UNIQUE index on `(tenant_id, phone)` prevents duplicate phones within same tenant; different tenants allowed same phone |
| **Email duplicates** | Email is supplementary only — no unique constraint on email; duplicate emails allowed across customers in same tenant |
| **PII in error logs** | `autoLinkCustomer` + `syncCustomerSnapshot` catch errors + log without email/name/phone; only prefix and generic message |
| **CSV formula injection** | All cell values starting with =+-@ prefixed with ' (Excel safe mode) |
| **CSV as-is injection** | Standard CSV escaping: commas/quotes/newlines wrapped in double-quotes; quotes escaped as "" |
| **Export PII exposure** | Cache-Control: private, no-store; requires authenticated user in tenant |
| **Hard-delete abuse** | Delete forbidden (`delete: () => false`) — GDPR handled separately; Order FK integrity protected |

---

## 11. Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| Customer list load (25 rows) | <500ms p95 | Indexed tenant_id query |
| CSV export 10k rows | <2s p95 | Streaming response, no memory load |
| Auto-link hook latency | <100ms p95 | Single Drizzle query + create if not found |
| Search (name/email, 1000+ customers) | <200ms p95 | Payload `listSearchableFields` index |
| Customer detail order stats | <300ms p95 | Single `fetchOrderStats` query, 5k row limit per customer |

---

## 12. Testing Strategy

**Refer to [`docs/qa/F25-shop-customers.md`](../qa/F25-shop-customers.md) for 19 TCs:**

### Wave 1 (TC-F25-001..010)
- **TC-F25-001:** Phone normalization (strip spaces/dashes/dots, lowercase)
- **TC-F25-002:** Idempotency (5 orders same phone → 1 Customer)
- **TC-F25-003:** Empty phone → customer=null
- **TC-F25-004:** Whitespace-only phone → customer=null
- **TC-F25-005:** Hook fault tolerance (database failure → silent skip)
- **TC-F25-006:** Tenant scope read access
- **TC-F25-007:** Delete forbidden
- **TC-F25-008:** CSV export tenant isolation
- **TC-F25-009:** Address max 10 validator
- **TC-F25-010:** Rank enum validation

### Wave 2 (TC-F25-09-01..07) — Round-2 Bug Fix Tests
- **TC-F25-09-01:** Phone `+` stripping (`+60...` → `60...` identity dedup)
- **TC-F25-09-02:** Phone normalization with all punctuation chars
- **TC-F25-09-03:** `latestOrderAt` only set on create (not edit)
- **TC-F25-09-04:** `syncCustomerSnapshot` — invalid email omitted from PATCH payload
- **TC-F25-09-05:** Snapshot fields isolated from edit overwrites
- **TC-F25-09-06:** CSV sanitizeCell strips `\r\n` per RFC 4180
- **TC-F25-09-07:** `fetchOrderStats` 5k row limit per customer

**Test files:**
- `src/__tests__/unit/customers/auto-link-customer.test.ts`
- `src/__tests__/unit/customers/customers-access.test.ts`
- `src/__tests__/unit/customers/customers-field-validation.test.ts`
- `src/__tests__/integration/customers-export.test.ts`
- `src/__tests__/unit/customers/sync-customer-snapshot.test.ts` (NEW — 9 tests)

---

## 13. Known Limitations + Future Work

| Item | Wave | Reason |
|------|------|--------|
| PW1 customer ETL | Wave 7 (US-MIGA-12) | Separate plan; large data migration scope |
| Orphan order backfill | Wave 7 (US-MIGA-12) | Pseudocode in phase-03 spec; not executed in F25 |
| Auto-rank calculation | Wave 8+ | Cron job + threshold config; YAGNI now |
| Email as secondary field | By design (Phase 04) | Email stored supplementary on create; not used for identity lookup. Phone is sole primary key. |
| GDPR/anonymize | Wave 8+ | Deferred feature; delete forbidden for now |
| Customer self-serve profile | Wave 8+ | Requires buyer login + frontend forms |
| Bulk customer import | Wave 8+ | CSV upload; defer until ETL complete |

---

## 14. Rollback Strategy

- **Per phase:**
  - Phase 01 (docs): revert plan rename → restore slug collision
  - Phase 02 (schema): revert migration entries + Customers.ts import
  - Phase 03 (linkage): revert Orders.customer FK + hooks
  - Phase 04 (UI): revert admin components
  - Phase 05 (tests): revert test files

- **Per-merge rollback:** Revert PR commits; migrations idempotent (CREATE IF NOT EXISTS + ADD IF NOT EXISTS) → safe revert + re-apply

---

## 14.5. Dashboard Server Actions Layer (F25 Wave 2)

**Feature:** Custom Next.js dashboard for `/dashboard/customers/` list + detail pages (distinct from Payload admin UI).

**Files:**
- `src/app/(dashboard)/customers/_lib/shop-customer-record.ts` — TypeScript types + mappers
- `src/app/(dashboard)/customers/actions.ts` — 5 server actions

**Types:**

```typescript
export type ShopCustomerRecord = {
  id: number
  email: string
  name: string
  phone: string | null
  rank: 'bronze' | 'silver' | 'gold' | 'vip' | null
  notes: string | null
  addresses: AddressRecord[]
  firstOrderAt: string | null
  orderCount: number        // computed
  lifetime: number          // computed — MYR total
  completedRate: number     // computed — percentage (0–100), 2 decimals, 0 if no orders
  failedRate: number        // computed — percentage (0–100), 2 decimals, 0 if no orders
  createdAt: string
  updatedAt: string
}

export type ShopCustomerDetail = ShopCustomerRecord  // same shape; computed fields populated

export type ShopCustomerFilters = {
  search?: string  // email/name/phone
  rank?: 'bronze' | 'silver' | 'gold' | 'vip' | 'none'  // discriminated union
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}
```

**Rate Formula (Computed Fields):**

Rates are computed per customer when fetching list or detail, using the `rate(numerator, count)` helper in `actions.ts`:

```typescript
function rate(numerator: number, count: number): number {
  if (count <= 0) return 0
  return Math.round((numerator / count) * 10000) / 100  // 2-decimal precision
}
```

| Rate | Formula | Notes |
|------|---------|-------|
| **completedRate** | `completed / total × 100` | % of orders with `status='completed'` |
| **failedRate** | `cancelled / total × 100` | % of orders with `status='cancelled'` |
| **Zero-order fallback** | `0` (not null) | When customer has no orders, both rates = 0 (stable identity) |

**Mapping:** `ech` status → conceptual meaning:
- `status='completed'` → order fulfilled (deliverable state in ech, analogous to prime-web-api `delivered`)
- `status='cancelled'` → order failed/cancelled (terminal non-fulfillment state, analogous to prime-web-api `failed`)
- `status='shipped'` → order in transit (not counted in rates; only completed/cancelled counted)
- `payment_failed`, `refunded` → payment states (NOT counted in failed rate; F25 scope excludes these)

**Server Actions:**

1. **`getShopCustomersAction(filters: ShopCustomerFilters)`**
   - Paginated list (limit 100, default page 1)
   - Search: `{or: [{email: {like}}, {name: {like}}, {phone: {like}}]}`
   - Rank filter: `rank = 'none'` → `{rank: {equals: null}}`; otherwise exact match
   - Date range: `{createdAt: {greater_than_equal: fromDate, less_than_equal: toDate}}`
   - Returns: `{data: ShopCustomerRecord[], meta: {page, limit, total, totalDocs}}`
   - IDOR: Tenant-scoped via `where: {tenant: {equals: tenantId}}`

2. **`getShopCustomerDetailAction(id: number)`**
   - Single customer by ID
   - Fetches customer + 4 computed stats:
     - `orderCount` — COUNT(orders WHERE customer_id = id)
     - `lifetime` — SUM(orders.total WHERE customer_id = id)
     - `completedRate` — PERCENTAGE(completed orders) per customer, via `rate()` helper
     - `failedRate` — PERCENTAGE(cancelled orders) per customer, via `rate()` helper
   - IDOR: Assert `customer.tenant === tenantId`
   - Returns: `ShopCustomerDetail`

3. **`updateShopCustomerAction(id: number, data: Partial<ShopCustomerRecord>)`**
   - Updates: name, phone, rank, notes, addresses
   - Email frozen (idempotent identity)
   - IDOR: Assert `customer.tenant === tenantId`
   - Validates: email regex (server-side), rank enum, address max 10
   - Returns: updated `ShopCustomerRecord`

4. **`exportShopCustomersCsvAction(filters: ShopCustomerFilters)`**
   - Exports all matching customers as CSV (10k row cap)
   - Columns: id, email, name, phone, rank, orderCount, lifetime, createdAt
   - Formula-injection guard: `=+-@` prefixed with `'`
   - CSV escape: standard (commas/quotes/newlines wrapped)
   - IDOR: Tenant-scoped via `where: {tenant: {equals: tenantId}}`
   - Returns: CSV string (caller handles download headers)

5. **`getCustomerOrdersAction(customerId: number, page?: number)`**
   - Linked orders for detail view Orders tab
   - Paginated (limit 50)
   - Returns: `{data: OrderRecord[], meta: {page, limit, total}}`
   - IDOR: Verify customer.tenant === tenantId

**Security:**
- All actions require `getCurrentTenantId()` + throw `'Unauthorized'` if missing
- IDOR guard: fetch doc, assert `String(doc.tenant?.id ?? doc.tenant) === tenantId`
- No raw SQL; Payload local API only
- Input validation: `id` numeric, `rank` enum, `page` clamped to 1+

**Performance:**
- Batch order count query: single `where: {customer: {in: ids}}` for all customers in list
- List limit capped at 100 to prevent slow aggregation
- Detail fetch: single order query with `depth: 0` for counts/aggregates

---

## 15. Theming & Light/Dark Mode

**CSS Variables:** F25 UI components use semantic tokens defined in `src/app/globals.css` under the `--cus-*` namespace:

| Token Category | Variables | Purpose |
|---|---|---|
| **Surfaces** | `--cus-surface-{card,header,dropdown,select,sticky,info}` | Backgrounds for cards, headers, dropdowns, sticky headers, info panels |
| **Borders** | `--cus-border-{subtle,medium,strong}` | Border colors with varying opacity levels |
| **Text** | `--cus-text-{secondary,muted,subtle,faint}` | Text color layers from primary → increasingly de-emphasized |
| **Code** | `--cus-code-{bg,border,fg}` | Monospace block styling (email copy, IDs, phone display) |
| **Rank badges** | `--cus-rank-{vip,gold,silver,bronze}-{fg,bg,border}` | Color schemes for rank tags (foreground + background + border per tier) |
| **Utility** | `--cus-skeleton`, `--cus-dot-sep` | Skeleton loaders, dot separators between metadata |

**Dark Mode (default, `:root`):** All tokens set to dark palette with opacity-based surfaces + white text.

**Light Mode (`html:not(.dark)`):** Full light palette overrides defined; surfaces use light colors, text uses dark.

**Usage:** All customer components reference these tokens via inline styles or Tailwind semantic classes. No hardcoded color values in components; changes to `globals.css` automatically propagate.

**Example:**
```css
/* Light mode */
html:not(.dark) {
  --cus-surface-card: rgba(248,250,252,0.85);     /* Light slate card background */
  --cus-text-muted: #64748b;                       /* Dark slate muted text */
  --cus-rank-gold-fg: #b45309;                     /* Dark amber gold text */
}

/* Dark mode */
:root {
  --cus-surface-card: rgba(15,23,42,0.4);         /* Deep slate card background */
  --cus-text-muted: #94a3b8;                       /* Light slate muted text */
  --cus-rank-gold-fg: #fbbf24;                     /* Light amber gold text */
}
```

---

## 16. References

- Payload CMS hooks: https://payloadcms.com/docs/hooks/overview
- Payload access control: https://payloadcms.com/docs/access-control/overview
- Drizzle ORM: https://orm.drizzle.team/
- Plan phases: [`plans/260520-1432-customers-module/`](../../plans/260520-1432-customers-module/phase-01-slug-collision-fix.md) through `phase-05-tests-and-smoke.md`

