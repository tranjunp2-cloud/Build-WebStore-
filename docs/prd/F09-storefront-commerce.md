# PRD: Storefront Commerce (F09)
> **Version:** 2.2 | **Updated:** 2026-05-15 | **Agent:** `project-planner`
> **Priority:** P0 🌟 | **Sprint:** Wave 6 (v2.2 Bank Transfer confirmation variant) · Wave 5 (v2.1 base)
> **Depends on:** F08 Products CRUD ✅, F10 Orders ✅ | **Blocks:** F13 Payment Gateway, F14 Shipping
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §6 Trust Signals, §4 Payment
> **Decisions Log:** [PD-018](../decisions/decisions-log.md#pd-018--manual-payment-bank-transfer-verification-flow) · Issue [#1004](https://github.com/primeproduction/ech-prime-web-v2/issues/1004)

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
| US-F09-05 | Mobile Web UX — Native-Feeling Storefront | [F09-storefront-stories.md](../stories/F09-storefront-stories.md) | Ready |

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
- Guest checkout đủ thông tin Shipping: name/email/phone/address line 1/city/state/postcode + Payment Method (COD, Bank Transfer) (US-F09-03)
- **[v2.2]** Bank Transfer: KHÔNG bắt buộc upload tại checkout (D-04 PD-018). Proof upload chuyển sang Post-Order page via magic link.
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
| FR-06 | Checkout form details: name*, email*, phone*, address line 1*, line 2, city*, state (MY)*, postcode*, Payment Method (COD, Bank Transfer). Stripe Card/FPX qua F13. COD option gated per F19/F10 (West MY + courier COD support + per-courier limit); buyer does not see courier name. | US-F09-03 | P0 | |
| ~~FR-06.1~~ | ~~Bắt buộc khách hàng upload receipt ảnh (<2MB, JPG/PNG) nếu chọn QR Banking~~ | ~~US-F09-03~~ | ~~P0~~ | **DEPRECATED v2.2 (D-04)** — upload moved post-order via magic link. F10 FR-14 → FR-16 handle. |
| **FR-06.2** | **[v2.2]** Storefront checkout Bank Transfer option visibility tuân thủ tenant settings (`payment_bank_transfer` toggle ON + bank details complete). Nếu OFF → ẩn radio Bank Transfer. | US-F09-03 | P0 | Fix audit gap G-01 |
| FR-07 | Guest checkout — không cần auth | US-F09-03 | P0 | |
| FR-08 | SST 6% auto-calculated on subtotal | US-F09-03 | P0 | MY market |
| FR-09 | Shipping: West MY = RM 8, East MY (Sabah/Sarawak) = RM 15. Rate source = hybrid (flat OR EasyParcel real-time per tenant setting — see F14-shipping). | US-F09-03 | P0 | MY market |
| FR-10 | Place Order → order created, order number ORD-XXXXXXXX | US-F09-03 | P0 | |
| FR-11 | Cart preserved nếu payment fail | US-F09-03 | P0 | |
| FR-12 | Confirmation page: order number, items, total. Persistent route `/sites/[slug]/orders/[id]?token=...` (v2.2 — bookmark-able + share-able). | US-F09-04 | P0 | |
| **FR-12.1** | **[v2.2] Confirmation page COD variant:** Headline "Order Received!" + delivery expectations + tracking placeholder. | US-F09-04 | P0 | D-09 unified template |
| **FR-12.2** | **[v2.2] Confirmation page Bank Transfer variant** = Post-Order Upload page (F10 FR-16): Headline "Order Received! Awaiting Payment" + expiry timer + QR/STK + reference code + Upload Receipt button + anti-fraud warning. Đồng nhất route + token-based auth. | US-F09-04 | P0 | D-04 D-10 |
| FR-13 | WhatsApp floating button (nếu store owner set phone) | US-F09-01 | P1 | MY market |
| FR-14 | Trust signals footer: Halal badge, SSM number, payment icons | US-F09-01 | P1 | MY market |
| FR-15 | **[Mobile]** PDP hỗ trợ Sticky Bottom Bar cho nút Add to Cart. | US-F09-05 | P1 | Conversion Booster |
| FR-16 | **[Mobile]** PLP Filters & Sort chuyển thành Bottom Sheet mở từ dưới lên. | US-F09-05 | P1 | Ergonomics |
| FR-17 | **[Mobile]** Cart Drawer chiếm 100% chiều rộng màn hình (Full-screen). | US-F09-05 | P1 | |

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

> **[Global CMS Constraint]** Storefront là giao diện hiển thị phía End-user. Tuyệt đối không nhúng các header/sidebar của CMS Admin (F18 Layout) vào Storefront.

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

> **[Wireframe & Design Rule]** Không cần dùng ASCII để minh hoạ. Dẫn nguồn trực tiếp từ wireframe ở thư mục design nếu có.
> **[Quy tắc Cập nhật]** Mỗi khi 1 design/wireframe mới được thêm, BẮT BUỘC phải bổ sung ở Screen Layout đường dẫn tới file đó.

### 10.1. Màn hình chính (PLP: Product List Page - Shop Page)
- **Mô tả:** Màn hình khách hàng lướt xem danh sách sản phẩm.
- **Components chính:**
  - Breadcrumbs: Home > Danh mục cha > Danh mục con.
  - Sidebar Left (Desktop): Khối Filter list checkbox (Danh mục, Màu sắc, Size, Mức giá).
  - Top Bar: Text "Hiển thị X kết quả", Nút Sort By Dropdown (Mới nhất, Giá tăng/giảm), Nút Grid/List view toggle.
  - Product Grid: Danh sách card sản phẩm (Ảnh, Tên, Giá, Badge Sale). Cấu trúc 3-col Desktop, 1-col Mobile.
  - Bottom Pagination: Phân trang `< [1] [2] [3] >`.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.2. Màn hình Chi tiết (PDP: Product Detail Page)
- **Mô tả:** Xem chi tiết 1 sản phẩm cụ thể để bỏ vào giỏ hàng.
- **Components chính:**
  - Gallery (Left): Ảnh vuông lớn, thumbnail strip bên dưới.
  - Thông tin (Right): Tên SP, Đánh giá, Giá (giá gạch ngang nếu sale), Các khối chọn Biến thể (Tier 1, Tier 2), Số lượng điều chỉnh (+/-), Nút siêu to "🛒 THÊM VÀO GIỎ / ADD TO CART".
  - Mô tả & Attributes (Bottom): Khối tab chuyển đổi Rich Text giới thiệu và Bảng thông số chi tiết (Key-Value attributes).
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.3. Mobile View (Storefront PLP / PDP & Cart)
- **Mô tả:** Trải nghiệm mua sắm trên điện thoại của khách hàng, lưới 1 cột, Filter giấu vào Bottom Sheet, Giỏ hàng hiển thị toàn màn hình (Full Screen Drawer).
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.4. Các trạng thái UI (UI States) & Modals
- **Empty State:** PLP (Shop) hiện icon túi giấy rỗng text "Không tìm thấy sản phẩm nào". Drawer Cart hiển thị text "Giỏ hàng trống, hãy mua sắm".
- **Loading State:** Shimmer Skeleton Cards tại PLP trong 0.5s lúc fetch data. Skeleton vuông cho ảnh Gallery tại PDP.
- **Error State / Edge Cases:** Nếu item "Out of stock", Nút "Add to Cart" bị disabled màu xám gạch ngang. Nếu load fail: màn hình Error Fallback "Không thể tải trang".
- **Modals & Drawers:** 
  - Cart Drawer: Slide từ phải (Right Screen Edge) đè lên nội dung, hỗ trợ +/- số lượng và Checkout button.

### 10.4. Màn hình Checkout & Cart Drawer
- **Design / Wireframe (Cart Drawer):**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

- **Design / Wireframe (Guest Checkout):**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

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

### AC-7: Mobile Native-Feeling (App-like UX)
> 📌 Source: [US-F09-05](../stories/F09-storefront-stories.md)

Trên điện thoại (< 768px), PDP có thanh Sticky Add-to-Cart cố định bên dưới để luôn thúc đẩy chuyển đổi khi cuộn trang đọc mô tả. Các thao tác Lọc (Filter) và Sắp xếp (Sort) tại mục Shop (PLP) gọi ra Bottom Sheet trượt từ mép dưới lên thay vì dropdown. Khi mở Giỏ hàng (Cart Drawer), nó sẽ chiếm toàn bộ màn hình (Fullscreen) để tối đa hoá không gian hiển thị danh sách item và nút Checkout.

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
