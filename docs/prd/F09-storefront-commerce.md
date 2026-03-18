# PRD: Storefront Commerce (F09)
> **Version:** 2.1 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P0 🌟 | **Sprint:** Wave 5 | **Size:** XL
> **Depends on:** F08 Products CRUD ✅, F10 Orders ✅ | **Blocks:** F13 Payment Gateway, F14 Shipping
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §6 Trust Signals, §4 Payment

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F09-01 | Browse Products on Storefront | [F09-storefront-stories.md](../stories/F09-storefront-stories.md) | Ready |
| US-F09-02 | Add to Cart + Cart Drawer | [F09-storefront-stories.md](../stories/F09-storefront-stories.md) | Ready |
| US-F09-03 | Checkout — Purchase Flow | [F09-storefront-stories.md](../stories/F09-storefront-stories.md) | Ready |
| US-F09-04 | Order Confirmation | [F09-storefront-stories.md](../stories/F09-storefront-stories.md) | Ready |

---

## 1. Problem Statement

PrimeWeb has Products CRUD and Orders management, but **no public-facing storefront**. Site visitors cannot browse products, add to cart, or place orders. Without a storefront, all e-commerce features built in Wave 4 are unusable by customers.

---

## 2. Target User

- **Primary:** Site visitor (customer của SME dùng PrimeWeb)
- **Device:** 70% mobile (375px–428px), 30% desktop
- **Language:** English or Bahasa Melayu
- Guest checkout — không cần tạo account

---

## 3. Solution Overview

Public storefront pages dưới `/sites/[slug]/`: products listing, product detail, cart drawer (localStorage), guest checkout với Malaysian address + SST 6%, order confirmation. WhatsApp floating button + trust signals (Halal badge, SSM) cho MY market.

---

## 4. Scope

### In Scope
- Product listing (PLP) chuẩn E-com: Sidebar Filter (Category 3-Level, Giá, Thuộc tính), Sort Dropdown, ô Search (US-F09-01)
- Phân trang (Pagination) tối đa 10 sản phẩm/trang ở danh sách sản phẩm (US-F09-01)
- Product detail (PDP) với Ảnh Gallery, Variant Selector (2-tier), Bảng Attributes, Rich Text Description và JSON-LD schema (US-F09-01)
- Cart drawer slide-in + localStorage persistence (US-F09-02)
- Guest checkout đủ thông tin Shipping: name/email/phone/address line 1/city/state/postcode + Payment Method (COD, QR) (US-F09-03)
- Bắt buộc Upload proof image (<2MB) nếu Payment Method là QR Banking (US-F09-03)
- SST 6% calculation + Malaysian state dropdown (US-F09-03)
- Shipping by state: West MY = RM 8, East MY = RM 15 (US-F09-03)
- Order confirmation page (US-F09-04)
- WhatsApp floating button (MY market)
- Trust signals footer: Halal badge, SSM, payment icons

### Out of Scope
- User accounts for buyers (Wave 6+)
- Payment gateway integration Stripe (F13 — Tạm ẩn ở phase này)
- Real-time inventory sync

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Product page load (p95) | < 2s | Lighthouse |
| Cart → Checkout conversion | > 40% | Analytics |
| Order placement success rate | > 95% | API |
| Mobile score | > 90 | Lighthouse |

---

## 6. User Story Summary

```
AS A   site visitor
I WANT browse products và hoàn thành thanh toán dễ dàng
SO THAT tôi mua hàng và seller nhận được đơn
```

> Source: [US-F09-03](../stories/F09-storefront-stories.md#us-f10-03)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Product listing: grid (3-col desktop, 1-col mobile), sidebar filter, sort, search, pagination (exactly 10 items/page), active products only | US-F09-01 | P0 | |
| FR-02 | Product card: image, category, name, price (RM XX.XX), SALE badge | US-F09-01 | P0 | |
| FR-03 | Product detail: image gallery, stock status, JSON-LD schema | US-F09-01 | P0 | |
| FR-04 | Add to Cart → cart drawer slides in từ phải | US-F09-02 | P0 | |
| FR-05 | Cart quantity controls (+/-), subtotal realtime, localStorage persist | US-F09-02 | P0 | |
| FR-06 | Checkout form details: name*, email*, phone*, address line 1*, line 2, city*, state (MY)*, postcode*, Payment Method (COD, QR) | US-F09-03 | P0 | Stripe tạm ẩn |
| FR-06.1 | Bắt buộc khách hàng upload receipt ảnh (<2MB, JPG/PNG) nếu chọn QR Banking | US-F09-03 | P0 | |
| FR-07 | Guest checkout — không cần auth | US-F09-03 | P0 | |
| FR-08 | SST 6% auto-calculated on subtotal | US-F09-03 | P0 | MY market |
| FR-09 | Shipping: West MY = RM 8, East MY (Sabah/Sarawak) = RM 15 | US-F09-03 | P0 | MY market |
| FR-10 | Place Order → order created, order number ORD-XXXXXXXX | US-F09-03 | P0 | |
| FR-11 | Cart preserved nếu payment fail | US-F09-03 | P0 | |
| FR-12 | Confirmation page: order number, items, total | US-F09-04 | P0 | |
| FR-13 | WhatsApp floating button (nếu store owner set phone) | US-F09-01 | P1 | MY market |
| FR-14 | Trust signals footer: Halal badge, SSM number, payment icons | US-F09-01 | P1 | MY market |

---

## 8. Business Rules

- **BR-01:** Guest checkout — order linked đến site/tenant, không phải user
- **BR-02:** Currency: MYR, format `RM XX.XX`
- **BR-03:** Hàng hết stock → "Out of Stock", Add to Cart disabled
- **BR-04:** SST = fixed 6%, hiện thành dòng riêng
- **BR-05:** Storefront chỉ accessible khi site.isPublished = true

---

## 9. User Flow

```
/sites/[slug]/products
  ↓
Click product → /sites/[slug]/products/[slug]
  ↓
Add to Cart → cart drawer slide in
  → Proceed to Checkout
  ↓
/sites/[slug]/checkout
  Fill: name, email, address, state, postcode
  SST + shipping auto-calculated
  Place Order
  ↓
  ├── Success → /sites/[slug]/order/:id/confirm
  └── Fail → toast đỏ, cart preserved
```

---

## 10. Screen Layout

**10.1 Màn hình PLP (Product List Page - Shop Page)**
```
┌─ /sites/[slug]/shop/category/[category-slug] ──────────┐
│ [Crumbs: Home > Fashion > Men > Shirts]                │
│                                                        │
│ ┌────────────────┐ ┌─────────────────────────────────┐ │
│ │ CATEGORIES     │ │ [Sort by ▼] [View: ⊞ / ☰]       │ │
│ │ ├ Fashion      │ │ ┌──────┐ ┌──────┐ ┌──────┐      │ │
│ │ │ ├ Men        │ │ │ 📦   │ │ 📷   │ │ 📷   │      │ │
│ │ │ │ └ Shirts   │ │ │ Nam  │ │ Nu   │ │ Polo │      │ │
│ │ │ └ Women      │ │ │ RM29 │ │ RM49 │ │ RM19 │      │ │
│ │ ├ F&B          │ │ └──────┘ └──────┘ └──────┘      │ │
│ │ └ Beauty       │ │                                 │ │
│ │                │ │ ┌──────┐ ┌──────┐ ┌──────┐      │ │
│ │ FILTERS        │ │ │ 📦   │ │ 📷   │ │ 📷   │      │ │
│ │ ├ Trắng [x]    │ │ │ Tee  │ │ Pant │ │ Hat  │      │ │
│ │ ├ Size L [x]   │ │ │ RM39 │ │ RM89 │ │ RM59 │      │ │
│ │ └ Price (RM)   │ │ └──────┘ └──────┘ └──────┘      │ │
│ │   [0 - 50 ]    │ │                                 │ │
│ └────────────────┘ │ <  [1]  [2]  [3]  >             │ │
│                    │ (Tối đa 10 sản phẩm/trang)      │ │
│                    └─────────────────────────────────┘ │
│ Mobile: 1-col stack, Filter in Bottom Sheet            │
└────────────────────────────────────────────────────────┘
```

**10.2 Màn hình PDP (Product Detail Page)**
```
┌─ /sites/[slug]/product/[friendly-slug] ────────────────┐
│ [Crumbs: Home > Fashion > Men > Shirts > Polo Black]   │
│                                                        │
│ ┌─────────────────┐ ┌────────────────────────────────┐ │
│ │   [ MAIN IMG ]  │ │ Polo Black Nhập Khẩu           │ │
│ │                 │ │ ⭐⭐⭐⭐⭐ 5.0 (20 Reviews)      │ │
│ │                 │ │ RM 120.00                      │ │
│ │                 │ │                                │ │
│ │   [T1] [T2] [T3]│ │ Màu Sắc (Tier 1):              │ │
│ │   (Gallery)     │ │ [ Đỏ ] [ Xanh (Out of stock)]  │ │
│ │                 │ │ Kích cỡ (Tier 2):              │ │
│ │                 │ │ [ S ] [ M ] [ L ]              │ │
│ │                 │ │                                │ │
│ │                 │ │ [-] 1 [+]   [ THÊM VÀO GIỎ ]   │ │
│ └─────────────────┘ └────────────────────────────────┘ │
│ ────────────────────────────────────────────────────── │
│ ┌────────────────────────┐ ┌─────────────────────────┐ │
│ │ MÔ TẢ SẢN PHẨM         │ │ THÔNG TIN CHI TIẾT      │ │
│ │ Áo thun làm từ chất    │ │ ├ Thương hiệu: XYZ      │ │
│ │ liệu cotton lụa...     │ │ ├ Xuất xứ: Vietnam      │ │
│ │ [✨ AI Rich Text]     │ │ ├ Chất liệu: Cotton 100%│ │
│ │                        │ │ (Hiển thị Attributes)   │ │
│ └────────────────────────┘ └─────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## 11. Acceptance Criteria

> AC được copy từ `F09-storefront-stories.md`. Không tự thêm AC không có trong story.

### AC-1: Browse Products
> 📌 Source: [US-F09-01](../stories/F09-storefront-stories.md) — AC-1

```gherkin
GIVEN a published site with active products
WHEN  visitor navigates to /sites/[slug]/products
THEN  products display in responsive grid (3-col desktop, 1-col mobile)
  AND each card: image, category, name, price (RM XX.XX)
  AND products with compareAtPrice show "SALE" badge
  AND only status='active' products visible
```

### AC-2: Add to Cart
> 📌 Source: [US-F09-02](../stories/F09-storefront-stories.md) — AC-1

```gherkin
GIVEN visitor clicks "Add to Cart" on a product
WHEN  item is added
THEN  cart drawer slides in from right
  AND item appears with quantity controls (+/-)
  AND subtotal updates in real-time
  AND cart persists across navigation (localStorage)
  AND adding same product increases quantity (not duplicate)
```

### AC-3: Checkout — Happy Path
> 📌 Source: [US-F09-03](../stories/F09-storefront-stories.md) — AC-1

```gherkin
GIVEN khách có items trong cart và điền đủ thông tin giao hàng
WHEN  click "Place Order"
THEN  order created với status='pending'
  AND order number generated (format: ORD-XXXXXXXX)
  AND success → /order/:id/confirm
  AND SST (6%) calculated on subtotal
```

### AC-4: Guest Checkout
> 📌 Source: [US-F09-03](../stories/F09-storefront-stories.md) — AC-3

```gherkin
GIVEN visitor is NOT logged in
WHEN  access /sites/[slug]/checkout
THEN  checkout form accessible without authentication
  AND order linked to site/tenant (not user account)
  AND Malaysian state dropdown shown for address
```

### AC-5: Payment Failure
> 📌 Source: [US-F09-03](../stories/F09-storefront-stories.md) — AC-4

```gherkin
GIVEN payment thất bại
WHEN  return từ payment gateway FAIL
THEN  toast đỏ "Thanh toán thất bại. Thử lại"
  AND cart KHÔNG bị xóa
```

### AC-6: Mobile Responsive
> 📌 Source: [US-F09-01](../stories/F09-storefront-stories.md) — Additional Criteria

```gherkin
GIVEN screen width < 768px
WHEN  on any storefront page
THEN  product grid 1-col, all buttons ≥ 44px tap target
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Product page < 2s (p95) | Lighthouse |
| **Security** | Storefront public — no auth required for visitors | |
| **SEO** | JSON-LD Product schema on all product pages | |
| **Device** | Mobile 375px, Desktop 1280px+ | |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `ProductsPage` | `app/sites/[slug]/products/page.tsx` | Listing |
| `ProductDetailPage` | `app/sites/[slug]/products/[id]/page.tsx` | Detail |
| `CartDrawer` | `components/storefront/CartDrawer.tsx` | Slide-in cart |
| `CheckoutPage` | `app/sites/[slug]/checkout/page.tsx` | Checkout form |
| `OrderConfirmPage` | `app/sites/[slug]/order/[id]/page.tsx` | Confirm |

### 13.2 API Endpoints

```
GET /api/products?where[site][equals]={id}&where[status][equals]=active
POST /api/orders/create
Request: { siteId, items[], customer: { name, email, phone, address } }
Response: { orderId, orderNumber, total, status }
Auth: None (public storefront)
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F08 Products CRUD | ✅ Ready | — |
| F10 Orders collection | ✅ Ready | — |
| Stripe (Wave 6) | ⬜ F13 | Tạm ẩn ở phase này, dùng COD và QR Banking |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Skeleton cards on product listing
- [ ] Empty State — "No products available" + shopping bag icon
- [ ] Error State — "Failed to load" + retry, "Order failed" + retry
- [ ] Form Validation — Name + Email required on checkout
- [ ] Button States — "Add to Cart" disabled khi out of stock, "Place Order" spinner
- [ ] Toast Feedback — "Thanh toán thất bại" với cart preserved
- [ ] Auth Redirect — N/A (public storefront)
- [ ] Mobile 375px — 1-col grid, stacked layout, 44px tap targets
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] User Stories approved và linked ở Section 0
- [ ] F08 Products seeded với test data
- [ ] F10 Orders collection ready

---

## 19. Definition of Done

- [ ] All FR implemented
- [ ] All AC pass
- [ ] JSON-LD validates on Google Rich Results Test
- [ ] Mobile 375px tested
- [ ] `docs/qa/F09-storefront-commerce.md` written
