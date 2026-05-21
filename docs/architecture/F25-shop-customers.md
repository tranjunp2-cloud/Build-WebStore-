# F25 Shop Customers — Architecture

> **Feature:** F25 — Shop Customers (Wave 6 P0)
> **Version:** 1.0 | **Created:** 2026-05-20 | **Owner:** Backend Dev
> **Links:**
> - PRD: [`docs/prd/F25-shop-customers.md`](../prd/F25-shop-customers.md)
> - QA: [`docs/qa/F25-shop-customers.md`](../qa/F25-shop-customers.md)
> - Plan: [`plans/260520-1432-customers-module/`](../../plans/260520-1432-customers-module/)

---

## 1. Overview

**Architecture:** First-class Customers collection with email-based idempotent linkage to Orders. Restores PW1 parity for customer management (Tier-S #9, Group B3).

- **Schema:** Customers table keyed by `(tenant_id, lower(trim(email)))` UNIQUE; Addresses as array sub-table
- **Linkage:** Orders.beforeChange hook upserts Customer + populates FK (non-throwing)
- **Access:** Tenant-scoped read/update (super-admin unrestricted); hard-delete forbidden
- **Admin UI:** List view (search, filter by rank), detail view (edit addresses), Orders history tab, CSV export (10k cap)

---

## 2. Data Flow

### 2.1 Order creation (auto-link customer)

```
Storefront checkout
  ↓ POST /api/orders/create { customerEmail: 'John@Gmail.com', ... }
Backend Order.beforeChange hook (Orders collection)
  ├── Call autoLinkCustomer({ data, req, operation })
  │     ├── Normalize email: trim + lowercase → 'john@gmail.com'
  │     ├── Query: find customer WHERE tenant_id=X AND email='john@gmail.com'
  │     ├── Found → set data.customer = existing.id (idempotent)
  │     └── Not found → create new Customer { tenant, email, name, phone, firstOrderAt }
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
  email varchar(255) NOT NULL,
  name varchar(255) NOT NULL,
  phone varchar(20),
  rank varchar(20),  -- enum: bronze|silver|gold|vip
  notes text,
  first_order_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE (tenant_id, email),  -- email normalized in app layer
  INDEX (tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

**Key properties:**
- `email`: normalized `lower(trim())` enforced via Customers.beforeChange hook + DB UNIQUE index
- `rank`: select enum, default NULL (unset) — no auto-calc
- `first_order_at`: set once on creation; never updated
- `id`: serial integer (Payload default for collections, not UUID)

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

## 4. Migrations (9 entries)

All entries in `scripts/db-setup.js` MIGRATIONS array:

| # | Name | Type | Notes |
|---|------|------|-------|
| 1 | `customers.create_table` | CREATE TABLE | Payload collection registration |
| 2 | `customers.tenant_email_lower_unique` | UNIQUE constraint | `(tenant_id, lower(email))` deferred (PG lower() function) or application-layer normalize |
| 3 | `customers.tenant_index` | INDEX | `tenant_id` for access-control filtering |
| 4 | `customers_addresses.create_table` | CREATE TABLE | Array field sub-table (UUID id, _parent_id, _order) |
| 5 | `customers_addresses.parent_index` | INDEX | `_parent_id` for array join |
| 6 | `payload_locked_documents_rels.customers_id` | Payload internal | Auto-created by `syncPayloadRelsTables()` |
| 7 | `payload_preferences_rels.customers_id` | Payload internal | Auto-created by `syncPayloadRelsTables()` |
| 8 | `orders.customer` | ALTER TABLE | Add `customer_id` FK column |
| 9 | `orders.customer_id_index` | INDEX | `customer_id` for order lookup by customer |

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
    const email = String(data.customerEmail ?? '').trim().toLowerCase()
    
    // Skip on update if unchanged
    if (operation === 'update' && originalDoc?.customerEmail === email) return data
    
    // Validate email + resolve tenant
    if (!email || !EMAIL_REGEX.test(email)) { data.customer = null; return data }
    const tenantId = typeof data.tenant === 'object' ? data.tenant.id : data.tenant
    if (!tenantId) { data.customer = null; return data }
    
    // Find existing customer
    const found = await req.payload.find({ collection: 'customers', where: { and: [{ tenant: { equals: tenantId } }, { email: { equals: email } }] }, limit: 1 })
    if (found.docs[0]) { data.customer = found.docs[0].id; return data }
    
    // Create new customer (firstOrderAt set once)
    const created = await req.payload.create({ collection: 'customers', data: { tenant: tenantId, email, name: data.customerName || '(unknown)', phone: data.customerPhone ?? null, firstOrderAt: new Date().toISOString() } })
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
- **Idempotent:** Same email+tenant repeated = upsert (find existing OR create new)
- **Fault-tolerant:** Invalid email or payload failure → `customer = null` (order proceeds)
- **Perf:** On update, skip if email unchanged

**afterChange** (syncCustomerSnapshot):
```typescript
// src/collections/orders-hooks/sync-customer-snapshot.ts
export const syncCustomerSnapshot: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  try {
    const customerId = typeof doc.customer === 'object' ? doc.customer.id : doc.customer
    if (!customerId) return doc
    
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
- **Latest-wins:** Updates Customer.name/phone to latest order values (multi-order scenario)
- **Non-throwing:** Failure doesn't affect order
- **Perf:** Only updates if changed (create OR name/phone differ)

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
   - CSV escape: wrap in quotes if comma/quote/newline
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

**Searching:** Uses Payload admin.listSearchableFields = ['email', 'name']

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
| **Email collision cross-tenant** | UNIQUE index on `(tenant_id, email)` prevents duplicates within same tenant; different tenants allowed same email |
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

---

## 12. Testing Strategy

**Refer to [`docs/qa/F25-shop-customers.md`](../qa/F25-shop-customers.md) for 10 TCs:**

- **TC-F25-001:** Email normalization (mixed case + trailing space)
- **TC-F25-002:** Idempotency (5 orders same email → 1 Customer)
- **TC-F25-003:** Empty email (skips link)
- **TC-F25-004:** Invalid email (skips link)
- **TC-F25-005:** Hook fault tolerance (database failure → silent skip)
- **TC-F25-006:** Tenant scope read access
- **TC-F25-007:** Delete forbidden
- **TC-F25-008:** CSV export tenant isolation
- **TC-F25-009:** Address max 10 validator
- **TC-F25-010:** Rank enum validation

**Test files:**
- `src/__tests__/unit/customers/auto-link-customer.test.ts`
- `src/__tests__/unit/customers/customers-access.test.ts`
- `src/__tests__/unit/customers/customers-field-validation.test.ts`
- `src/__tests__/integration/customers-export.test.ts`

---

## 13. Known Limitations + Future Work

| Item | Wave | Reason |
|------|------|--------|
| PW1 customer ETL | Wave 7 (US-MIGA-12) | Separate plan; large data migration scope |
| Orphan order backfill | Wave 7 (US-MIGA-12) | Pseudocode in phase-03 spec; not executed in F25 |
| Auto-rank calculation | Wave 8+ | Cron job + threshold config; YAGNI now |
| Phone uniqueness | By design | Allows shared hotlines; PW1 parity |
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

## 15. References

- Payload CMS hooks: https://payloadcms.com/docs/hooks/overview
- Payload access control: https://payloadcms.com/docs/access-control/overview
- Drizzle ORM: https://orm.drizzle.team/
- Plan phases: [`plans/260520-1432-customers-module/`](../../plans/260520-1432-customers-module/phase-01-slug-collision-fix.md) through `phase-05-tests-and-smoke.md`

