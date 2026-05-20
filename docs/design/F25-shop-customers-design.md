# F25 Shop Customers — Design & Wireframe Report

> **Epic:** Shop Customers (Group B3 / Tier-S #9 / US-MIGA-12)
> **Feature Code:** F25
> **Version:** 1.0 — Initial PW2-side build (ETL deferred to US-MIGA-12)
> **Updated:** 2026-05-20
> **Figma Design:** TBD (this doc is the source of truth until Figma added)
> **Decisions:** [Plan 260520-1432-customers-module](../../plans/260520-1432-customers-module/plan.md) · [PRD F25](../prd/F25-shop-customers.md) · Issue [#1043](https://github.com/primeproduction/ech-prime-web-v2/issues/1043) · PR [#1042](https://github.com/primeproduction/ech-prime-web-v2/pull/1042)

Tài liệu này cung cấp bản vẽ Wireframe + spec UI cho module Shop Customers (F25), tổ chức dữ liệu khách hàng mua hàng thành entity bậc một. Tất cả giao diện sống bên trong **Payload Admin** và tuân thủ **F18 CMS Global Layout** (Sidebar trái + Topbar giữ nguyên).

PW2 trước F25 lưu thông tin buyer denormalized trong Orders (`customerEmail/Name/Phone + shippingAddress`). F25 promote chúng thành collection `customers` riêng + multi-address book + manual rank tag, link Orders qua FK + auto-link hook. UI side phần lớn ship miễn phí từ Payload list/edit defaults; phần custom là **Orders tab** trong detail view + **CSV export trigger**.

---

## 1. Màn Hình Chính: Danh Sách Khách Hàng (Customers List)

*URL: `/admin/collections/customers`. Là Payload default list view, được bật search + filter + columns qua `Customers.ts admin` block. Không có Status Stats Bar (vì rank là tag manual, không phải state machine như Orders).*

```text
┌─────────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                              [👤 Admin] │
├──────────────┬──────────────────────────────────────────────┤
│ 🏠 Dashboard │ 👥 Customers                                 │
│ 📦 Products  │                                              │
│ 🛒 Orders    │ ┌─ Search & Filters ─────────────────────┐   │
│ 👥 Customers │ │ [🔍 Search email or name...]            │   │
│ 📝 Blogs     │ │ Rank: [ All ▼ ]  Created: [ Any ▼ ]     │   │
│ ⚙️ Settings  │ │                          [⬇ Export CSV] │   │
│              │ └────────────────────────────────────────┘   │
│              │                                              │
│              │ ┌─ Customers Table ───────────────────────┐ │
│              │ │ Email           │ Name      │ Rank │ ... │ │
│              │ │ ─────────────────┼───────────┼──────┼─────│ │
│              │ │ ali@example.com │ Ali Baba  │ 🥇Gold│ … │ │
│              │ │ siti@example.my │ Siti N.   │ 🥈Silv│ … │ │
│              │ │ john@example.co │ John Doe  │ 🥉Bron│ … │ │
│              │ │ abu@example.my  │ Abu Bakar │ —    │ … │ │
│              │ └──────────────────────────────────────────┘ │
│              │  ◀ 1 2 3 ... ▶   25 / page                  │
└──────────────┴──────────────────────────────────────────────┘
```

### 1.1. Default columns

Cấu hình qua `Customers.admin.defaultColumns`:

| Column | Source field | Width | Sortable |
|--------|--------------|-------|----------|
| Email | `email` (useAsTitle) | 24% | ✓ |
| Name | `name` | 22% | ✓ |
| Rank | `rank` (badge) | 12% | ✓ |
| Phone | `phone` | 16% | ✓ |
| Created | `createdAt` (relative) | 14% | ✓ default desc |

Người dùng có thể tự thêm/bỏ columns qua icon "Columns" của Payload list (ship sẵn).

### 1.2. Rank badges

```text
🥇 Gold     — value `gold`,   accent #f59e0b background-tint
🥈 Silver   — value `silver`, accent #94a3b8
🥉 Bronze   — value `bronze`, accent #b45309
⭐ VIP      — value `vip`,    accent #7c3aed
—          — null/unset, muted text
```

Localization defer F21 — values + emoji labels EN-only ở giai đoạn này.

### 1.3. Search behaviour

- Field: `Customers.admin.listSearchableFields = ['email', 'name']`
- Payload native search input ở topbar
- Case-insensitive prefix match
- Debounced 300ms (Payload default)
- Empty search → all rows tenant-scoped

### 1.4. Filters

```text
┌─ Rank dropdown ─────┐
│ ☐ All               │
│ ☐ Bronze            │
│ ☐ Silver            │
│ ☐ Gold              │
│ ☐ VIP               │
│ ☐ Unranked (null)   │
└─────────────────────┘
```

- Source: Payload tự suy ra options từ `rank.select.options` ở schema
- Multi-select chips
- Combine với `?where[rank][in]=gold,silver` URL param

**Date filter** dùng Payload's built-in `createdAt` range picker (ship free). Nếu chưa surface auto, defer v2.

### 1.5. Tenant scoping (silent — không hiển thị)

- Tenant-owner: chỉ thấy customers của tenants mình thuộc về (access rule `tenant: { in: req.user.tenants[].tenant }`)
- Super-admin: thấy tất cả, có thể filter qua URL `?where[tenant][equals]=<id>` nhưng không có UI dropdown (YAGNI v1)

### 1.6. Bulk actions

- **DISABLED** mọi bulk action. Lý do: `delete: () => false` (hard-delete cấm). Không có bulk edit rank (YAGNI cho tới khi PM yêu cầu).
- Checkbox column ẩn qua Payload admin config nếu Payload cho. Nếu không, để default nhưng "Delete selected" button sẽ trả 403 — flag minor UX gap.

### 1.7. Export CSV button

```text
       ┌──────────────────────────────┐
       │  ⬇ Export CSV                │  ← primary outlined button
       └──────────────────────────────┘
              ↓ click
   GET /api/v1/customers/export
              ↓
   Browser download: customers-<tenantId>-<YYYYMMDD>.csv
```

- Position: top-right cạnh filter row (xem ASCII §1)
- Disabled state khi user chưa có tenant access → muted + tooltip "No accessible customers"
- Click → trình duyệt download file CSV stream
- Super-admin có optional `?tenantId=<int>` query (manual URL); UI dropdown defer v2
- 413 response → toast "Export too large — filter by date/rank then retry"
- 400/401/403 → toast generic error + log

---

## 2. Detail View: Customer Profile

*URL: `/admin/collections/customers/:id`. Là Payload default Edit view với 2 tab built-in (Default + Addresses từ array field) + 1 tab custom F25 thêm vào (Orders).*

```text
┌─────────────────────────────────────────────────────────────┐
│ Customers > ali@example.com                  [💾 Save]      │
├─────────────────────────────────────────────────────────────┤
│ [ Default ] [ Addresses ] [ Orders ]  ← tabs                │
│                                                             │
│ ┌─ Default tab ──────────────────────────────────────────┐ │
│ │ Email *      [ali@example.com         ]                 │ │
│ │ Name *       [Ali Baba                ]                 │ │
│ │ Phone        [+60 12 345 6789         ]                 │ │
│ │ Rank         [ 🥇 Gold     ▼ ]                          │ │
│ │ Notes        ┌─────────────────────────────────────┐   │ │
│ │              │ VIP since Q2 2026. Prefer email     │   │ │
│ │              │ communication.                       │   │ │
│ │              └─────────────────────────────────────┘   │ │
│ │ First order  2026-04-12 (read-only)                     │ │
│ │ Created      2026-04-12 14:32                           │ │
│ │ Updated      2026-05-18 09:15                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│             [ Save changes ]  [Cancel]                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.1. Default tab fields

| Field | Type | Required | Validation | Readonly |
|-------|------|----------|------------|----------|
| `email` | email | yes | RFC 5322 + lowercase normalize | no |
| `name` | text | yes | trim, ≤200 char | no |
| `phone` | text | no | free text, no format enforced | no |
| `rank` | select | no | `bronze \| silver \| gold \| vip` or null | no |
| `notes` | textarea | no | ≤2000 char, admin-only | no |
| `firstOrderAt` | date | — | auto-set bởi auto-link hook | **yes** |
| `createdAt` | date | — | Payload auto | yes |
| `updatedAt` | date | — | Payload auto | yes |

Email change side-effect: hook `beforeChange` normalizes email lowercase + trim. Nếu admin đổi email sang một giá trị đã tồn tại trong cùng tenant → DB unique index `customers_tenant_email_lower_uniq` reject với 409. UI hiển thị toast lỗi.

### 2.2. Disabled hard-delete

- Sidebar Payload default thường có "Delete" button ở footer Edit view
- `Customers.access.delete = () => false` khiến button gọi REST → 403 → toast "Deletion is not allowed"
- Hiển thị visually: button vẫn xuất hiện nhưng disabled (Payload không support hide qua access — chấp nhận minor UX gap; v2 có thể custom Edit view override)

---

## 3. Addresses Tab (Multi-Address Book)

*Tab này tận dụng Payload native `array` field UI từ `addresses: { type: 'array', maxRows: 10 }` trong schema. Không cần custom component.*

```text
┌─ Addresses tab ─────────────────────────────────────────────┐
│                                                              │
│  ┌─ Address 1 (default) ─────────────────────── ⋮  [drag] ─┐│
│  │ Label    [ Home                           ]              ││
│  │ Line 1 * [ No. 12, Jalan Bukit Bintang    ]              ││
│  │ Line 2   [ Unit 5A-2                      ]              ││
│  │ City     [ Kuala Lumpur ] State [ WPKL  ]                ││
│  │ Postcode [ 50200       ] Country [ Malaysia ]            ││
│  │ ☑ Default address                                        ││
│  │                                          [Remove]        ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Address 2 ──────────────────────────────── ⋮  [drag] ─┐ │
│  │ Label    [ Office                         ]             │ │
│  │ Line 1 * [ Suite 33-2, Menara Maxis       ]             │ │
│  │ … (same fields)                                          │ │
│  │ ☐ Default address                                        │ │
│  │                                          [Remove]        │ │
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│           [ + Add another address ]   (disabled khi ≥10)    │
└──────────────────────────────────────────────────────────────┘
```

### 3.1. Field spec per address

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `label` | text | no | — |
| `line1` | text | **yes** | — |
| `line2` | text | no | — |
| `city` | text | no | — |
| `state` | text | no | — |
| `postcode` | text | no | — |
| `country` | text | no | `Malaysia` |
| `isDefault` | checkbox | no | false |

### 3.2. Constraints + interactions

- `maxRows: 10` (hard cap). Khi đạt 10, button "+ Add" disabled + tooltip "Maximum 10 addresses per customer"
- Drag-reorder enabled (Payload native cho array fields)
- `isDefault` không enforce single-default ở schema (KISS) — nếu owner đánh dấu 2 cái default, UI/billing logic xử lý sau (YAGNI)
- Empty state khi 0 addresses: hiển thị "No addresses yet. Click + Add to create one."

---

## 4. Orders Tab (Custom Edit View — F25 NEW)

*Tab này là component custom F25 thêm vào — `src/components/admin/customers-orders-tab.tsx`. Liệt kê tất cả orders linked tới customer qua FK `orders.customer = customers.id`.*

```text
┌─ Orders tab ────────────────────────────────────────────────┐
│                                                              │
│ Orders (24)                                                  │
│                                                              │
│ ┌─────────┬──────────────┬──────────┬──────────┬─────────┐  │
│ │ Order # │ Status       │ Total    │ Payment  │ Date    │  │
│ ├─────────┼──────────────┼──────────┼──────────┼─────────┤  │
│ │ P-2098  │ 🟢 Completed │ 250.00 MYR │ ✅ Paid  │ Mar 15  │  │
│ │ P-2055  │ 🔵 Shipped   │ 89.00 MYR  │ ✅ Paid  │ Mar 02  │  │
│ │ P-2034  │ ⏳ Confirmed │ 120.00 MYR │ ⏳ Unpaid│ Feb 28  │  │
│ │ P-2020  │ 🔴 Cancelled │ 45.00 MYR  │ ❌ Cancl │ Feb 14  │  │
│ │ …       │              │            │          │         │  │
│ └─────────┴──────────────┴──────────┴──────────┴─────────┘  │
│                                                              │
│  ◀ Prev    Page 1 of 4    Next ▶            25 / page       │
└──────────────────────────────────────────────────────────────┘
```

### 4.1. Component spec

- File: `src/components/admin/customers-orders-tab.tsx` (RSC, ~233 LOC)
- Props (Payload 3.79 inject): `id` (customer id, string|number), `searchParams` (page query param)
- Query: `payload.find({ collection: 'orders', where: { and: [{ customer: equals id }, { tenant: equals customer.tenant }] }, sort: '-createdAt', limit: 25, page })`
- Defence-in-depth tenant filter: pre-fetch parent customer, add `tenant` constraint vào where (per code-review M3 fix)

### 4.2. Columns

| Column | Source | Render |
|--------|--------|--------|
| Order # | `order.orderNumber` (fallback `order.id`) | bold text, link to `/admin/collections/orders/<id>` |
| Status | `order.status` | colored Badge (reuse Orders status palette) |
| Total | `order.total + order.currency` | `{total.toFixed(2)} MYR` (or `USD`/`SGD`) |
| Payment | `order.paymentStatus` | small Badge (paid / unpaid / failed / refunded / cancelled) |
| Date | `order.createdAt` | en-MY locale `15 Mar 2026` |
| Action | — | row click → navigate to order detail |

### 4.3. Pagination

- `?page=N` URL query
- Prev disabled khi page === 1
- Next disabled khi page === totalPages
- Limit hard-coded 25/page (configurable v2)

### 4.4. States

| State | Render |
|-------|--------|
| Loading (RSC) | None — RSC blocks render; if Suspense added later, skeleton |
| Empty (0 orders) | "No orders linked yet." (italic, muted #6b7280) |
| Error (fetch throws) | "Failed to load orders: {error.message}" (red #dc2626) |
| New customer (no id yet) | "Save the customer record first to view linked orders." |

### 4.5. Status colors (reuse Orders palette)

```text
pending           → #f59e0b (amber)
new               → #06b6d4 (cyan)
confirmed         → #3b82f6 (blue)
ready_to_ship     → #8b5cf6 (purple)
shipped           → #6366f1 (indigo)
completed         → #10b981 (green)
cancelled         → #ef4444 (red)
refunded          → #6b7280 (gray)
paid              → #10b981
payment_failed    → #ef4444
processing        → #f59e0b
```

---

## 5. CSV Export Flow

*Endpoint: `GET /api/v1/customers/export`. Streaming CSV, tenant-scoped, max 10k rows.*

### 5.1. UX flow

```text
[Admin clicks ⬇ Export CSV] ──────────────────────────────────┐
                                                              │
                       ↓ GET /api/v1/customers/export         │
                                                              │
       ┌──────────────────────┴──────────────────────────┐   │
       │ Server                                          │   │
       │  1. Auth check (Payload session cookie)         │   │
       │  2. Resolve tenant IDs from user.tenants[]      │   │
       │  3. Validate ?tenantId=N (super-admin only)     │   │
       │  4. COUNT(*) — if > 10000 → 413                 │   │
       │  5. Stream CSV rows via ReadableStream          │   │
       │     header + N rows                             │   │
       └──────────────────────┬──────────────────────────┘   │
                              ↓                              │
              Browser triggers download:                     │
              filename = customers-<tenantId>-<YYYYMMDD>.csv │
                                                              │
   On 413 → toast: "Export too large. Filter then retry."  ──┘
   On 401 → redirect to login
   On 403 → toast: "Permission denied"
```

### 5.2. CSV format

```csv
email,name,phone,rank,createdAt,addressCount,orderCount
ali@example.com,Ali Baba,+60 12 345 6789,gold,2026-04-12T14:32:00Z,2,24
siti@example.my,Siti Nurhaliza,,silver,2026-04-13T09:15:00Z,1,8
"john,doe@example.co","Doe, John",+60 19 999 8888,,2026-04-14T11:00:00Z,0,3
```

Escaping rules:
- Cells containing `,`, `"`, or newline → wrap in `"..."`, double internal `"`
- Cells starting with `=`, `+`, `-`, `@` → prepend `'` (formula-injection guard)
- Empty cells → empty between commas (not `null`)

### 5.3. Response headers

```
Content-Type: text/csv; charset=utf-8
Cache-Control: private, no-store
Content-Disposition: attachment; filename="customers-12-20260520.csv"
```

`tenantId` portion sanitized to `[A-Za-z0-9_-]` (forbidden chars replaced with `-`).

### 5.4. Error responses (uniform JSON or text + Cache-Control)

| Status | Body | Trigger |
|--------|------|---------|
| 400 | `Bad Request: tenantId must be a positive integer` | super-admin passes non-numeric `?tenantId` |
| 401 | `Unauthorized` | no auth cookie |
| 403 | `Forbidden` | user has no accessible tenants OR requests tenant outside scope |
| 413 | `{"error":"export_too_large","hint":"Filter by date or rank"}` | row count > 10000 |
| 500 | `Internal Server Error` (logged with stack) | DB fail or stream crash |

---

## 6. Empty / Error States Map

| Surface | Empty | Error |
|---------|-------|-------|
| Customers list | "No customers yet. They will be created automatically when orders are placed." | Payload default error toast |
| Detail view (new) | Default fields blank | Validation inline (email format, required name) |
| Addresses tab | "No addresses yet. Click + Add to create one." | Field-level (line1 missing) |
| Orders tab | "No orders linked yet." | "Failed to load orders: {message}" (red) |
| CSV export | Empty CSV (header only) | Toast per §5.4 |

---

## 7. Auto-Link Hook (Invisible — but affects UX expectations)

Customers KHÔNG được tạo qua UI hằng ngày. Mỗi khi tenant lưu một Order:

1. Hook `autoLinkCustomer` (Orders.beforeChange) normalize email → `lower(trim(email))`
2. Lookup Customer by `(tenant_id, normalized_email)`
3. Hit → link `order.customer = found.id`
4. Miss → tạo Customer mới với `firstOrderAt = now()`, sau đó link

Hệ quả UX:
- Admin hiếm khi tạo Customer thủ công qua "+ New" button — nhưng Payload vẫn cho phép
- Customer record sẽ có `name = (unknown)` nếu order không có customerName → admin chỉnh trên Edit view
- Manual creation OK cho VIP-import từ Excel hoặc legacy migration (US-MIGA-12 ETL)

---

## 8. Responsive / Mobile

- Payload Admin UI là **desktop-first**; F25 không thêm mobile-specific layout
- List view tự collapse sang horizontal scroll trên ≤768px (Payload default)
- Edit view tabs stack vertically trên ≤640px (Payload default)
- Orders tab table sử dụng `overflow-x: auto` wrapper — đã apply trong component
- CSV download work nguyên trên mobile browsers; filename giữ nguyên

---

## 9. Accessibility

- Tab navigation giữa Default / Addresses / Orders tabs: Payload native ARIA tablist
- Form labels associated với `<label for>` (Payload default)
- Rank badge có `aria-label` ("Rank: Gold") cho screen readers
- Error states sử dụng `role="alert"` + đỏ + icon (kế thừa Payload error UI)
- CSV download button có `aria-label="Export customers to CSV"`

---

## 10. Future Enhancements (defer YAGNI)

| Feature | Why defer | Trigger to revisit |
|---------|-----------|--------------------|
| Auto-calc rank theo order count/spend | Manual tag đủ cho v1; cần threshold config per-tenant | PM gets churn report request |
| Bulk rank assignment | YAGNI cho tới khi owner có >100 customers cần re-tier | Owner feedback |
| Merge duplicate customers | Hook idempotency đã handle 99% trường hợp | Found dup in production |
| Customer activity timeline / audit log | Nice-to-have, không phải v1 commitment | Compliance request |
| Cached `order_count` + `total_spent` columns | Phase-04 tính on-the-fly đủ nhanh ở 10k scale | List view >1.5s |
| Soft-delete / GDPR anonymize | Pháp lý chưa yêu cầu MY | GDPR adoption hoặc PM phán |
| Multi-tenant customer (cross-tenant identity) | Out of scope; tenant-scope locked decision | Business pivots toward omnichannel ID |

---

## 11. Related Files (code references)

| Layer | Path |
|-------|------|
| Collection schema | `src/collections/Customers.ts` |
| Auto-link hook | `src/collections/orders-hooks/auto-link-customer.ts` |
| Sync snapshot hook | `src/collections/orders-hooks/sync-customer-snapshot.ts` |
| Payment-status hook | `src/collections/orders-hooks/update-payment-status.ts` |
| Orders FK wiring | `src/collections/Orders.ts` (search `customer` field) |
| Orders tab UI | `src/components/admin/customers-orders-tab.tsx` |
| CSV export endpoint | `src/app/api/v1/customers/export/route.ts` |
| Migrations | `scripts/db-setup.js` (search `F25:`) |
| Unit + integration tests | `src/__tests__/unit/customers/`, `src/__tests__/integration/customers-export.test.ts` |

---

## 12. Test Cases (cross-link to QA matrix)

| TC | Surface tested |
|----|----------------|
| TC-F25-001 | Auto-link normalization (email casing/trim) |
| TC-F25-002 | Idempotency (5 orders → 1 customer) |
| TC-F25-003 | Empty email → no customer, no error |
| TC-F25-004 | Invalid email → no customer, no error |
| TC-F25-005 | Hook fault tolerance (DB throw → null FK + log) |
| TC-F25-006 | List view tenant scoping |
| TC-F25-007 | Hard-delete blocked (403) |
| TC-F25-008 | CSV export tenant isolation + 403 cross-tenant |
| TC-F25-009 | Addresses maxRows: 10 enforced |
| TC-F25-010 | Rank enum validation (only 4 values) |

Full matrix: `docs/qa/F25-shop-customers.md`.

---

**Hết design report — v1.0. Future updates theo Figma khi available.**
