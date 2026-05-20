# PRD: Shop Customers (F25)

> **Version:** 1.0 | **Created:** 2026-05-20 | **Agent:** `docs-manager`
> **Priority:** P0 | **Sprint:** Wave 6 — v1.1 stabilization | **Size:** M
> **Depends on:** F10 Orders Management ✅, Payload CMS ✅
> **Related:** US-MIGA-12 (ETL PW1→PW2 deferred), Tier-S #9, Group B3

---

> [!IMPORTANT]
> **Scope Note:** PRD documents the F25 feature implementation (PW2-built). User Stories deferred to separate plan per team decision. Customer History (Orders linkage) tracked separately in Phase 04 admin UI + Phase 05 QA tests.

---

## 0. Feature Alignment

| Property | Value |
|----------|-------|
| Feature ID | F25 |
| PW1 Parity | ✅ Yes — restores Customers as first-class entity |
| Related Issues | [US-MIGA-12](https://github.com/primeproduction/ech-prime-web-v2) (ETL phase TBD) |
| Acceptance Criteria | 10 TCs: TC-F25-001..010 (mapped in [QA doc](../qa/F25-shop-customers.md)) |
| Plan Reference | [`plans/260520-1432-customers-module/`](../../plans/260520-1432-customers-module/) |

---

## 1. Problem Statement

PrimeWeb v1.0 stores customer data (email, name, phone) denormalized inside each Order. No unified customer entity, no address book, no rank/segment tracking. This blocks PW1 parity and prevents merchants from building customer lifetime value strategies. Tier-S priority #9.

---

## 2. Target User

- **Merchant (Seller):** View customer list, update addresses + rank tag, export for analytics
- **Buyer:** None (backend-only feature at MVP)

---

## 3. Solution Overview

Promote customer data from Order snapshot into a **first-class `customers` collection** with:
- Multi-address book (up to 10 per customer)
- Manual rank field (`bronze|silver|gold|vip`) for merchant segmentation
- Auto-linking to Orders by tenant + normalized email
- Idempotent upsert on order creation (same customer across 5 orders = 1 row)
- Admin UI: list, detail view, Orders history tab, CSV export
- Tenant-scoped access (merchant A cannot view B's customers)

**Not in scope (Phase 1):** PW1 data migration (deferred to US-MIGA-12 plan), auto-calculated Rank, GDPR/anonymize actions.

---

## 4. Scope

### In Scope
- First-class Customers collection: email (normalized), name, phone, rank, addresses array
- Unique constraint per tenant: `(tenant_id, lower(trim(email)))`
- Auto-link to Orders via beforeChange hook on order create/update
- Idempotent upsert: repeated orders from same email → single Customer record
- Admin UI list view: search by name/email, filter by rank, default columns (email, name, rank, createdAt)
- Detail view: edit addresses (label, line1, line2, city, state, postcode, country, isDefault)
- Orders history tab: linked orders for this customer
- CSV export: `/api/v1/customers/export?tenantId=X` — streams 7 columns (email, name, phone, rank, createdAt, addressCount, orderCount)
- Hard-delete forbidden: `delete: () => false` mirrors Orders policy
- Access control: tenant-scoped read/update (super-admin OR user in tenant)
- Addresses cap: 10 per customer with Payload `maxRows` validator

### Out of Scope
- PW1 customer ETL import (separate plan US-MIGA-12)
- Orphan order backfill script execution (phase-03 pseudocode provided, not run)
- GDPR/anonymize features
- Auto-calculated Rank (no cron, no threshold config)
- SMS/phone verification
- Loyalty programs (future feature)
- Pages/Articles migration
- Phone uniqueness constraint (allows shared hotline numbers)

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Customers collection schema validation | 100% pass `check-migrations.js` | CI gate |
| Auto-link idempotency | 5 orders same email = 1 Customer | TC-F25-002 |
| Order creation non-throwing | no regression | TC-F25-005 |
| Tenant isolation | Tenant A cannot read Tenant B | TC-F25-006, TC-F25-008 |
| CSV export row cap | max 10k without OOM | Phase-05 manual smoke |

---

## 6. User Story Summary (Light Form)

```
AS A   merchant (shop owner)
I WANT a unified customers list with address book + rank tags
SO THAT I can segment buyers and export customer data for analytics
```

---

## 7. Functional Requirements

| FR-ID | Requirement | Priority | Notes |
|-------|-------------|----------|-------|
| FR-01 | Customers collection with email (normalized), name, phone, rank, addresses fields | P0 | Phase-02; email unique per tenant |
| FR-02 | Auto-link new orders to existing customers by tenant + email (idempotent upsert) | P0 | Phase-03; beforeChange hook; non-throwing |
| FR-03 | Addresses array field: 10 per customer max, with label/line1/line2/city/state/postcode/country/isDefault | P0 | Phase-02; validated by Payload `maxRows` |
| FR-04 | Admin list view: search, filter by rank, default columns email/name/rank/createdAt | P0 | Phase-04; searchable by name + email |
| FR-05 | Detail view: read/edit customer + addresses, delete forbidden | P0 | Phase-04 |
| FR-06 | Orders history tab: list all orders linked to this customer | P0 | Phase-04; custom Payload tab component |
| FR-07 | CSV export endpoint: 7 columns, 10k row cap, tenant-scoped, formula-injection guarded | P0 | Phase-04; `/api/v1/customers/export` |
| FR-08 | Rank field: 4 enum values bronze/silver/gold/vip, default unset (null) | P0 | Phase-02; no auto-calc |
| FR-09 | Access control: read/update tenant-scoped; super-admin unrestricted; delete forbidden | P0 | Phase-02; mirrors Sites/Orders pattern |
| FR-10 | First order date auto-set (firstOrderAt), never updated on subsequent orders | P0 | Phase-03; auto-link hook |

---

## 8. Business Rules

- **BR-01:** Customer identity scoped to `(tenant_id, lower(trim(email)))` — omnichannel within tenant inherits unified rank + history
- **BR-02:** Email normalized: `trim()` + `lowercase()` enforced in Customers beforeChange hook
- **BR-03:** Phone field optional; no unique constraint (allows shared hotline/family numbers)
- **BR-04:** Auto-link skips if email empty or fails regex; order.customer = null (no error)
- **BR-05:** Rank manual only; no auto-calculation on order count/amount/date
- **BR-06:** Addresses limited to 10 per customer; Payload `maxRows: 10` enforces
- **BR-07:** Customer deletion forbidden (`delete: () => false`); protects Order FK integrity; GDPR/anonymize deferred
- **BR-08:** Denormalized snapshot fields in Orders (`customerEmail/Name/Phone/shippingAddress`) untouched → backward-compatible
- **BR-09:** firstOrderAt set once on customer creation; never updated on subsequent orders

---

## 9. User Flow

### 9.1 Merchant views customer list (happy path)

```
[Entry: Dashboard > Customers menu link]
  ↓
Admin loads /dashboard/customers
  ├── API: GET /api/customers?where={tenant_in: [userTenants]}
  ├── Payload access control enforces tenant scope
  ↓ UI renders list
List view: columns (email, name, rank, createdAt), search bar (name/email), rank filter chips
  ├── User types "john" → highlights matching rows
  ├── User clicks rank filter "gold" → shows gold-tier customers only
  ↓ User clicks row
Detail view: customer card (email, name, phone, rank) + addresses array + Orders tab
  ├── Edit phone/rank → PATCH /api/customers/:id
  ├── Click Orders tab → shows linked orders (custom Payload tab)
  └── Export button → GET /api/v1/customers/export?tenantId=X → CSV download
```

### 9.2 Auto-link on order create

```
[Entry: Storefront checkout, buyer submits order]
  ↓
POST /api/orders/create { customerEmail: 'John@Gmail.com', customerName: 'John D', ... }
  ↓ Backend Order.beforeChange hook (autoLinkCustomer)
  ├── Normalize email: 'john@gmail.com'
  ├── Query: find customer where (tenant_id, email) = (X, 'john@gmail.com')
  ├── Found: link order.customer = existing customer.id
  └── Not found: create new customer + sync firstOrderAt
  ↓ Order save succeeds
Payload afterChange hook (syncCustomerSnapshot) updates Customer.name/phone with latest order values
```

### 9.3 Edge case: invalid email

```
[Storefront: customerEmail = '' or 'not-an-email']
  ↓ Orders.autoLinkCustomer
  ├── Email validation fails
  ├── Set order.customer = null
  └── No error thrown; order creation continues
Result: order created, no customer linked, no noise
```

---

## 10. Screen Layout

### 10.1 Customers List (Main)

- **Path:** `/dashboard/customers`
- **Components:**
  - Header: "Customers" title + Export button + Add Customer button (future)
  - Search bar: real-time search by email/name
  - Rank filter chips: All / Bronze / Silver / Gold / VIP
  - Data table:
    - Columns: Email (searchable), Name, Rank, Created (date), Actions (view/edit)
    - Pagination: 25 per page
    - Empty state: "No customers yet"
- **Design:** Standard Payload admin list view; responsive on mobile (collapsible columns)

### 10.2 Customer Detail

- **Path:** `/dashboard/customers/:id`
- **Layout:**
  - Left panel: Customer snapshot (email, name, phone, rank — editable fields)
  - Right panel: Metadata (createdAt, updatedAt, firstOrderAt)
  - Tabs:
    - **Info** (active): addresses array with add/edit/remove controls
    - **Orders** (custom Payload tab via phase-04): linked orders timeline
  - Actions: Save, Delete (disabled), Export

### 10.3 Orders Tab (Custom Payload View)

- **Component:** `src/components/admin/customers-orders-tab.tsx`
- **Content:** List of orders linked to this customer
  - Columns: Order ID, Date, Total, Status
  - Click row → navigate to order detail (external link)
  - Empty state: "No orders linked to this customer"

### 10.4 CSV Export Dialog

- **Triggered by:** Export button on list view
- **Headers:** email, name, phone, rank, createdAt, addressCount, orderCount
- **Row cap:** 10k (413 if exceeded)
- **Filename:** `customers_{tenantId}_{date}.csv`

---

## 11. Acceptance Criteria

### AC-1: Customer Collection Schema (TC-F25-001..004, FR-01)

```gherkin
GIVEN Customers collection exists in Payload
WHEN creating a customer record
THEN system assigns unique (tenant_id, normalized_email) constraint
  AND field email is required + indexed
  AND field name is required
  AND field phone is optional
  AND field rank is select enum (bronze/silver/gold/vip) default unset
  AND field addresses is array max 10 rows
  AND field firstOrderAt auto-set on creation
```

### AC-2: Auto-link on Order Create (TC-F25-002..005, FR-02)

```gherkin
GIVEN an order create request with customerEmail='Foo@Bar.com '
WHEN Orders.autoLinkCustomer hook executes
THEN email is normalized to 'foo@bar.com'
  AND system upserts one Customer record keyed (tenant_id, 'foo@bar.com')
  AND order.customer FK points to that Customer
  AND repeated orders same tenant+email link to same Customer (idempotent)
  AND invalid/empty email sets order.customer=null (non-throwing)
```

### AC-3: Tenant Access Control (TC-F25-006..008, FR-09)

```gherkin
GIVEN User A owns Tenant A
WHEN User A queries customers collection
THEN system filters WHERE tenant IN (A's tenants)
  AND User A cannot read/update Tenant B's customers
  AND super-admin can query all customers if authenticated
```

### AC-4: Address Book (TC-F25-009, FR-03)

```gherkin
GIVEN Customer with < 10 addresses
WHEN merchant adds new address
THEN system saves with label, line1, line2, city, state, postcode, country, isDefault
  AND max 10 per customer enforced
  AND adding 11th address rejected by Payload validator
```

### AC-5: Rank Validation (TC-F25-010, FR-08)

```gherkin
GIVEN Customer record
WHEN setting rank field
THEN only values bronze|silver|gold|vip accepted
  AND arbitrary values rejected (no 'platinum', 'diamond', etc.)
  AND null (unset) is valid default
```

### AC-6: CSV Export (Phase-05 manual smoke, FR-07)

```gherkin
GIVEN tenant owner requests export
WHEN GET /api/v1/customers/export?tenantId=X
THEN system streams CSV 7 columns (email, name, phone, rank, createdAt, addressCount, orderCount)
  AND max 10,000 rows; excess returns 413
  AND formula-injection guard active (= + - @ prefixed with ')
  AND response Content-Disposition: attachment; Cache-Control: private
  AND only authenticated user's tenants visible
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | CSV export <500ms for 10k rows | Streaming response, no memory load |
| **Security** | Tenant isolation enforced server-side | Payload access rules + WHERE clauses |
| **Security** | No PII in error logs | [Orders.autoLinkCustomer] prefix only; no email/name/phone logged |
| **Accessibility** | Admin UI keyboard navigable | Standard Payload admin conformance |
| **Browser support** | Chrome, Safari, Edge latest 2 versions | Admin dashboard scope |
| **Mobile** | Responsive 375px+ (admin dashboard context) | Standard Payload admin responsive |
| **Data/Privacy** | No PII exposed in REST responses except to authenticated user's tenant | Payload access control |

---

## 13. Technical Architecture

**Refer to [`docs/architecture/F25-shop-customers.md`](../architecture/F25-shop-customers.md) for:**
- Schema ER diagram (customers + customers_addresses + orders linkage)
- Hook sequence diagrams (autoLinkCustomer + syncCustomerSnapshot)
- CSV export streaming flow
- Access control pattern (mirrors Sites.ts pattern)
- Database migrations (9 entries from db-setup.js)

### Key Files

| Component | File | Role |
|-----------|------|------|
| Customers collection | `src/collections/Customers.ts` | Schema, access rules, hooks |
| Auto-link hook | `src/collections/orders-hooks/auto-link-customer.ts` | Upsert customer on order create/update |
| Sync snapshot hook | `src/collections/orders-hooks/sync-customer-snapshot.ts` | Keep Customer.name/phone latest |
| Admin UI — list/detail | `src/components/admin/customers-*.tsx` | Payload components (Phase-04 detail) |
| Orders history tab | `src/components/admin/customers-orders-tab.tsx` | Custom Payload tab (Phase-04) |
| CSV export endpoint | `src/app/api/v1/customers/export/route.ts` | Streaming CSV handler |

---

## 14. Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Payload CMS 3 | ✅ Active | Collection + hooks |
| F10 Orders | ✅ Done | autoLinkCustomer reads order.customerEmail |
| F02 Auth | ✅ Done | Access control uses req.user |
| Database schema | ✅ Done | 9 migration entries in db-setup.js |

---

## 15. Known Limitations + Future Work

| Item | Wave | Reason |
|------|------|--------|
| PW1 customer data migration | Wave 7 (US-MIGA-12) | Separate plan; not in scope F25 |
| Orphan order backfill script | Wave 7 (US-MIGA-12) | Pseudocode in phase-03; not executed |
| Auto-rank calculation | Wave 8+ | Requires cron + thresholds; YAGNI now |
| GDPR/anonymize | Wave 8+ | Deferred feature |
| Customer self-serve profile | Wave 8+ | Requires buyer account + login |
| Phone uniqueness | By design | Allows shared hotline; PW1 parity |

---

## 16. Related Documents

- **Architecture:** [`docs/architecture/F25-shop-customers.md`](../architecture/F25-shop-customers.md)
- **QA Test Plan:** [`docs/qa/F25-shop-customers.md`](../qa/F25-shop-customers.md) (10 TCs: TC-F25-001..010)
- **Implementation Plan:** [`plans/260520-1432-customers-module/`](../../plans/260520-1432-customers-module/)
- **PW1 Parity Matrix:** [`docs/migration/pw1-vs-pw2-feature-matrix.md`](../migration/pw1-vs-pw2-feature-matrix.md) (line 43: Customers, line 232: Tier-S #9)

---

## 17. Definition of Done

- [x] Customers collection schema exists + migrations validated
- [x] Auto-link hook implemented, non-throwing, idempotent
- [x] Access control enforces tenant scope per FR-09
- [x] Admin UI list/detail views complete
- [x] CSV export endpoint streams correctly
- [x] TC-F25-001..010 all pass (10 TCs, 39 automated tests)
- [x] Zero breaking changes to Orders (backward-compatible)
- [x] Payload CMS types generated without errors

