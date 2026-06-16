# PRD: Discount Setting CMS (F33)

> **Version:** 1.0 | **Created:** 2026-05-29 | **Agent:** `docs-manager`
> **Priority:** P1 | **Sprint:** Wave 3 | **Size:** L
> **Depends on:** F01 Builder, F10 Orders | **Blocks:** None
> **GitHub Issue:** [#1114](https://github.com/primeproduction/ech-prime-web-v2/issues/1114)

---

> [!IMPORTANT]
> **Plan Reference:** Detailed implementation plan and phase breakdown available at `plans/260529-1135-f33-discount-cms/`.
> All resolved decisions confirmed 2026-05-29 are documented in the plan — this PRD summarizes the feature scope and user stories.

---

## 0. Story Traceability

| Story ID | Title | Priority | Size | File |
|----------|-------|:--------:|:----:|------|
| US-F33-01 | Tạo discount với loại percentage hoặc fixed | P0 | S | [stories](../stories/F33-discount-cms-stories.md) |
| US-F33-02 | Sửa thông tin discount | P0 | S | [stories](../stories/F33-discount-cms-stories.md) |
| US-F33-03 | Xoá discount | P1 | XS | [stories](../stories/F33-discount-cms-stories.md) |
| US-F33-04 | Danh sách discount với search và filter | P0 | M | [stories](../stories/F33-discount-cms-stories.md) |
| US-F33-05 | Export danh sách discount thành CSV | P1 | S | [stories](../stories/F33-discount-cms-stories.md) |
| US-F33-06 | Áp dụng discount code tại checkout (COD/QR) | P0 | M | [stories](../stories/F33-discount-cms-stories.md) |
| US-F33-07 | Áp dụng discount code tại checkout (Stripe) | P0 | M | [stories](../stories/F33-discount-cms-stories.md) |
| US-F33-08 | Xem lịch sử sử dụng discount per order | P1 | M | [stories](../stories/F33-discount-cms-stories.md) |

---

## 1. Problem Statement

Hiện tại, hệ thống **không có tính năng quản lý discount/khuyến mãi** cho merchant (PW1 feature `§2.7` chưa port sang PW2). Merchant muốn:
- Tạo và quản lý mã giảm giá (promo codes) theo tenant, hạn dùng, ngày hết hạn.
- Áp dụng discount tại mọi checkout flow (COD, QR-banking, Stripe) qua mã code duy nhất.
- Theo dõi lịch sử dùng discount để audit và báo cáo.
- Export danh sách discount để phân tích (CSV).

**Scope boundary:** Feature này KHÔNG bao gồm subscription-tier promo codes (TC-F15.14–17) — đó là platform-level super-admin feature tách biệt.

---

## 2. Target User

- **Merchant / Tenant Owner** — Quản lý discount cho cửa hàng của mình.
- **Admin Staff (nếu có)** — Cộng tác tạo/edit discount (qua tenant permission).

---

## 3. Solution Overview

**Discount Setting CMS** cho phép merchant:

1. **Quản lý Discount trong Payload Admin** — CRUD discount (code, type, value, status, limit, date range).
2. **Gateway-agnostic Checkout** — Một hàm `computeOrderTotal()` chung áp dụng discount tại SUBTOTAL, sau đó cộng shipping + tax → `finalAmount`. Mọi payment method (COD/QR/Stripe) cùng dùng chung finalAmount này.
3. **Xử lý Code At-Limit/Invalid** — Code hết hạn, hết lượt, không còn hiệu lực, hoặc sai tenant → **silent reject** — order vẫn đặt được nhưng mà không áp dụng discount (giá toàn bộ).
4. **Usage Tracking** — Lưu lịch sử dùng discount per order, đếm usage, giới hạn lượt.
5. **CSV Export** — Self-contained route để export danh sách discount.

---

## 4. Scope

### In Scope (F33)
- **Discount CRUD (admin-side):** Tạo, sửa, xoá, danh sách, search, filter.
- **Type:** Percentage (0–100%) hoặc Fixed amount (tính bằng sen).
- **Status:** Active/Inactive.
- **Fields:** Code (unique per tenant, uppercase), description, type, value, usage limit, usage count (read-only), start date, expiry date.
- **Tenant scoping:** Mỗi tenant chỉ quản lý discount của mình.
- **Checkout apply — tất cả payment method:** COD/QR + Stripe, qua shared `computeOrderTotal()` → `finalAmount`.
- **At-limit / expired / inactive / wrong-code behavior:** **Reject mã, không fail checkout** — order tiếp tục ở giá toàn bộ.
- **Usage history tracking:** Collection riêng `discount_usage_history` (order + discount snapshot + amount applied).
- **CSV export:** Self-contained route `GET /api/v1/discounts/export`.

### Out of Scope (Deferred)
- **Subscription-tier promo codes** (TC-F15.14–17, platform-level super-admin) — handled separately in F15.
- **Affiliate codes, referral promos** — defer to later phase.
- **Coupon distribution via email** — NOT covered; admin manually share code.

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Discount coverage | 100% merchant tenants có khả năng tạo discount | Feature adoption check |
| Checkout coverage | Mọi payment method (COD/QR/Stripe) áp dụng discount từ chung `computeOrderTotal()` | Smoke test: 3 paths apply same discount |
| Usage tracking accuracy | 100% applied discount có 1 `discount_usage_history` record | SQL audit: `COUNT(*)` match order discount snapshots |
| At-limit safety | 0 checkout fail do discount at-limit | QA test: order proceeds at full price when limit reached |
| CSV export functional | 100% discounts exportable, <10k row cap enforced | Manual export test |

---

## 6. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority |
|-------|-------------|-----------|----------|
| FR-01 | Admin CMS danh sách discount với columns: code, type, value, status, usageCount, expiresAt | US-F33-04 | P0 |
| FR-02 | Search discount by code hoặc description | US-F33-04 | P0 |
| FR-03 | Filter discount by status (active/inactive) + type (percentage/fixed) | US-F33-04 | P0 |
| FR-04 | Form tạo discount: nhập code (unique per tenant), select type, nhập value, select status | US-F33-01 | P0 |
| FR-05 | Form tạo discount: optional start date, expiry date; validate start < expiry nếu cả hai set | US-F33-01 | P0 |
| FR-06 | Form tạo discount: validate percentage 0–100, fixed ≥ 0, code non-empty + UPPERCASE | US-F33-01 | P0 |
| FR-07 | Form sửa discount: update bất kỳ field nào (trừ usageCount — read-only) | US-F33-02 | P0 |
| FR-08 | Nút xoá discount (soft hoặc hard delete per data policy) | US-F33-03 | P1 |
| FR-09 | Checkout COD/QR: buyer nhập discount code → validate (active + in-date + under-limit + tenant match) | US-F33-06 | P0 |
| FR-10 | Checkout COD/QR: code reject (expired/at-limit/inactive/wrong-tenant) → silent reject, order ở giá full | US-F33-06 | P0 |
| FR-11 | Checkout Stripe: cùng discount validation qua shared `computeOrderTotal()`, Stripe charged `finalAmount` | US-F33-07 | P0 |
| FR-12 | On successful order: atomic increment `usageCount` và insert `discount_usage_history` row (idempotent on orderId) | US-F33-06, US-F33-07 | P0 |
| FR-13 | Admin view "Discount Usage History" — per-order breakdown: discount code, amount applied, order #, date | US-F33-08 | P1 |
| FR-14 | `GET /api/v1/discounts/export` → CSV (code, type, value, status, limit, usageCount, dates) | US-F33-05 | P1 |
| FR-15 | CSV export: tenant-owner scoped, super-admin optional ?tenantId=, cap 10k rows | US-F33-05 | P1 |

---

## 7. Business Rules

- **BR-01:** Discount type có 2 loại: **percentage** (0–100%) hoặc **fixed** (sen, tính bằng đơn vị tiền nhỏ nhất).
- **BR-02:** **Base subtotal only** — discount áp dụng chỉ trên subtotal (tổng giá sản phẩm). Shipping cộng AFTER. Formula: `finalAmount = (subtotal − discountAmount) + shipping`. *(v1.1 — 2026-06-11: SST tax đã bỏ khỏi checkout, không còn `+ tax`; free-ship gate tính trên subtotal SAU discount.)*
- **BR-03:** **At-limit behavior — silent reject** — Code đã dùng hết lượt, hết hạn, không active, hoặc sai tenant → đơn hàng tiếp tục nhưng MỤC KHÔNG áp dụng discount (thành `discountAmount = 0`). KHÔNG bao giờ fail checkout vì lý do discount.
- **BR-04:** **Code unique per tenant** — Cùng code có thể dùng ở tenants khác nhau (partial unique index: `(tenant_id, code)`).
- **BR-05:** **Code UPPERCASE** — Lưu uppercase canonical; so sánh case-insensitive. Admin form tự động normalize.
- **BR-06:** **Gateway-agnostic — ALL methods same finalAmount** — COD/QR/Stripe không phải discount-specific. Chúng chỉ nhận `finalAmount` từ `computeOrderTotal()`. Stripe charge chính xác `finalAmount` (không dùng Stripe Coupon object).
- **BR-07:** **Usage history immutable** — `discount_usage_history` là audit trail, không được edit/delete (trừ GDPR).
- **BR-08:** **usageCount read-only in admin** — Admin không thể sửa lợi dụng. Hook chỉ khi order place thành công.
- **BR-09:** **Subscription promo codes (TC-F15.14–17) out of scope** — Platform-level, super-admin manage riêng.

---

## 8. Resolved Architecture Decisions (Confirmed 2026-05-29)

| # | Decision | Resolution |
|---|----------|-----------|
| **1** | **Discount base** | **Subtotal only** (Σ unit price × qty). Shipping + tax added AFTER discount. |
| **2** | **At-limit / invalid-code behavior** | **Reject the code, order proceeds at full price.** Expired/inactive/wrong-tenant: silently drop the code, checkout continues. No hard-fail. |
| **3** | **Stripe support** | **INCLUDED — gateway-agnostic.** Single `computeOrderTotal()` produces `finalAmount`; Stripe charges exactly it (no Stripe Coupon, no per-line-item coupon mapping). No separate Stripe effort. |
| **4** | **CSV export** | **Self-contained new route.** No shared csv helper extraction; customers export untouched. Small dup OK (KISS/YAGNI). |
| **5** | *(sub-item of 3)* | **Folded into decision 3** — all payment methods covered by shared pricing. |

---

## 9. Data Model

### Collections (Payload)

#### `discounts`
| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | Primary key |
| `tenant` | relationship→tenants | Required, tenant scoping |
| `site` | relationship→sites | Optional (null = all tenant's sites) |
| `code` | text | Required, index; unique per tenant; uppercase canonical |
| `description` | text | Optional |
| `type` | select: `percentage`\|`fixed` | Required; default `percentage` |
| `value` | number | Required; ≥0; meaning: percent for percentage, sen for fixed |
| `status` | select: `active`\|`inactive` | Required; default `active`; indexed |
| `usageLimit` | number | Optional (null = unlimited); min 1 |
| `usageCount` | number | Default 0; **admin.readOnly**; hook writer only |
| `startsAt` | date | Optional; begin-of-day |
| `expiresAt` | date | Optional; end-of-day |
| `created_at` | timestamp | Auto |
| `updated_at` | timestamp | Auto |

**Access Control:** Tenant-scoped create/read/update (copy from Orders.ts). `delete` allowed for tenant-owner + super-admin.

#### `discount_usage_history`
| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | Primary key |
| `tenant` | relationship→tenants | Required, tenant scoping |
| `discount` | relationship→discounts | Required, indexed |
| `order` | relationship→orders | Required, indexed |
| `amountApplied` | number | Required (sen); frozen snapshot |
| `customerEmail` | email | Snapshot for audit |
| `usedAt` | timestamp | Default now |
| `created_at` | timestamp | Auto |
| `updated_at` | timestamp | Auto |

**Access Control:** Tenant-scoped read. Create allowed. Update/delete false (immutable audit trail).

#### `orders` (updated)
Three new fields:
- `discount` — relationship→discounts, readOnly (snapshot of which discount was applied)
- `discountCode` — text, readOnly (snapshot of the code applied)
- `discountAmount` — number, readOnly (snapshot of the discount amount in sen)

---

## 10. API Endpoints (Summary)

### Admin CMS
- **GET** `/api/collections/discounts` — Payload admin list + search/filter
- **POST** `/api/collections/discounts` — Create discount
- **PATCH** `/api/collections/discounts/:id` — Update discount
- **DELETE** `/api/collections/discounts/:id` — Delete discount

### Storefront/Checkout
- **POST** `/api/orders/checkout` — COD/QR checkout (FR-09, FR-10)
- **POST** `/api/orders/stripe-checkout` — Stripe checkout (FR-11)
- Both call shared `computeOrderTotal(subtotal, shipping, tax, discountAmount) → finalAmount`

### Reporting
- **GET** `/api/collections/discount-usage-history` — Payload admin list (FR-13)
- **GET** `/api/v1/discounts/export` — CSV export (FR-14, FR-15)

---

## 11. UI/UX (Admin CMS)

*(Detailed wireframes in [design doc](../design/F33-discount-cms-design.md))*

### List View
```
Columns: Code | Type | Value | Status | Usage (count/limit) | Expires | Actions
Search:  by code or description
Filters: Status (active/inactive), Type (percentage/fixed)
Actions: Create [+], Edit, Delete, View Usage
```

### Create/Edit Form
```
Code (required, unique per tenant, auto-uppercase)
Description (optional)
Type: [Percentage ○] [Fixed ○]
Value: [0–100 for %, or sen for fixed] (with unit label)
Status: [Active ○] [Inactive ○]
Usage Limit: [optional number, or unlimited]
Start Date: [optional]
Expiry Date: [optional]
[Validate: start < expiry, bounds by type, unique code]
Buttons: [Save] [Cancel]
```

### Usage History (Read-Only View)
```
Columns: Discount Code | Amount Applied | Order # | Customer Email | Used Date
Search/Filter: by code, order, date range
```

---

## 12. Checkout Integration

### COD/QR Path
```
1. Customer enters discount code
2. Backend: resolveDiscount(code, tenant) → validates (active, in-date, under-limit)
   - Silent reject if invalid (discountAmount = 0, proceed)
3. computeOrderTotal(subtotal, shipping, tax, discountAmount) → finalAmount
4. On successful order: atomic redeemDiscount(discountId) + recordUsage()
5. Email shows discount line: "Discount: −RM X.XX"
```

### Stripe Path
```
1. Same discount code input + validation as COD/QR
2. computeOrderTotal() → finalAmount
3. Stripe line items REBUILT to sum to finalAmount (no Stripe Coupon)
   - Existing items + shipping adjusted so total === finalAmount
4. Stripe charged exactly finalAmount
5. On successful order: atomic redeemDiscount + recordUsage (same as COD/QR)
6. Email: same discount line as above
```

---

## 13. Questions Resolved

| Q | Resolution | Rationale |
|---|-----------|-----------|
| Discount on subtotal or grand total? | **Subtotal only** (Decision 1). Shipping + tax after. | Standard e-commerce practice; clearer for customers |
| What if code at-limit or expired at checkout? | **Silent reject; order proceeds at full price** (Decision 2). | Never hard-fail; better UX |
| Stripe Coupon object or custom amount? | **Custom amount, no Stripe Coupon** (Decision 3). | Simpler, gateway-agnostic, no per-line mapping |
| CSV shared helper or self-contained? | **Self-contained route** (Decision 4). | KISS; minor dup is safer than shared regression surface |
| Subscription promo codes in scope? | **No, separate F15 feature** | Platform-level, different flow |

---

## 14. Success Acceptance

- [ ] Payload admin shows Discounts collection with correct columns + search/filter.
- [ ] Create discount: percentage 0–100, fixed ≥ 0, unique code per tenant, normalized uppercase.
- [ ] Checkout COD/QR: code entered → applied correctly, silently rejected if invalid.
- [ ] Checkout Stripe: same discount logic, charged exactly `finalAmount`.
- [ ] Usage count atomic + never exceeds limit.
- [ ] CSV export works, 10k row cap, tenant-scoped.
- [ ] TypeScript clean, migrations pass CI gate, payload-types.ts regenerated.

---

## 15. Reference

**Plan:** [`plans/260529-1135-f33-discount-cms/`](../../plans/260529-1135-f33-discount-cms/)
**GitHub:** [Issue #1114](https://github.com/primeproduction/ech-prime-web-v2/issues/1114)
**Related PRDs:** [F10 Orders Management](F10-orders-management.md) · [F15 Admin Management](F15-admin-management.md)
**Related Stories:** [`F33-discount-cms-stories.md`](../stories/F33-discount-cms-stories.md)
**Related Design:** [`F33-discount-cms-design.md`](../design/F33-discount-cms-design.md)
