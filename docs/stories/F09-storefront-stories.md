# User Stories: Storefront Commerce (F09)

> **Feature:** F09 — Storefront Commerce
> **Wave:** 5 | **Priority:** P0 🌟 | **Ref PRD:** [F09-storefront-commerce.md](../prd/F09-storefront-commerce.md)
> **Market Ref:** [malaysia-market-context.md](../malaysia-market-context.md)

---

## US-F09-01: Browse Products on Storefront

**Wave 5** | **P0 🌟** | **M** | **Status:** Ready

### Story

```
As a   site visitor
I want browse products trên storefront
So that tôi tìm được items muốn mua
```

### Acceptance Criteria

#### AC-1: Happy Path — Product Listing

```gherkin
GIVEN a published site with active products
WHEN  visitor navigates to /sites/[slug]/products
THEN  products display in responsive standard E-com layout (Sidebar left, Grid right)
  AND each product card shows: image, category, name, price (RM XX.XX)
  AND products with compareAtPrice show "SALE" badge
  AND only status='active' products visible
```

#### AC-2: PLP Sorting & Filtering

```gherkin
GIVEN visitor is on the products page
WHEN  viewing the Toolbar and Sidebar
THEN  visitor can search products by keyword
  AND filter products by Category (up to 3 levels) and Price range
  AND sort products by "Mới nhất", "Cũ nhất", "Giá tăng dần", "Giá giảm dần"
  AND results update smoothly
```

#### AC-3: PLP Pagination

```gherkin
GIVEN there are more than 10 active products matching current filters
WHEN  viewing the product list
THEN  products are paginated with exactly 10 items per page
  AND standard pagination controls (Previous, 1, 2..., Next) are displayed at the bottom
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Mobile layout 1-col works on 375px

---

## US-F09-02: Add to Cart + Cart Drawer

**Wave 5** | **P0 🌟** | **M** | **Status:** Ready

### Story

```
As a   site visitor
I want thêm sản phẩm vào cart và review trước khi checkout
So that tôi kiểm soát được những gì đang mua
```

### Acceptance Criteria

#### AC-1: Happy Path — Add to Cart

```gherkin
GIVEN visitor clicks "Add to Cart" on a product
WHEN  item is added
THEN  cart drawer slides in from right
  AND item appears with quantity controls (+/-)
  AND subtotal updates in real-time
  AND cart persists across navigation (localStorage)
  AND adding same product increases quantity (not duplicate)
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Cart persists sau page navigation

---

## US-F09-03: Checkout — Purchase Flow ⭐

**Wave 5** | **P0 🌟** | **XL** | **Status:** Ready

### Story

```
As a   khách hàng trên published site với items trong cart
I want hoàn thành thanh toán dễ dàng
So that tôi nhận hàng và seller nhận tiền
```

### Acceptance Criteria

#### AC-1: Happy Path — Checkout Form

```gherkin
GIVEN khách có items trong cart
WHEN  vào /checkout
THEN  form hiện đầy đủ thông tin giao hàng:
  - Shipping fields: Họ Tên*, Email*, Số điện thoại*, Địa chỉ Line 1*, Địa chỉ Line 2, Thành phố (City)*, Bang (State dropdown)*, Mã bưu điện (Postcode)*
  - Payment method: COD, QR Banking (Stripe tạm ẩn ở Phase này)
  AND if "QR Banking" is selected, the user MUST upload a payment proof image (<2MB, JPG/PNG)
```

#### AC-2: Happy Path — Place Order

```gherkin
GIVEN chọn payment method và điền đủ thông tin
WHEN  click "Thanh toán" / "Place Order"
THEN  order created với status='pending'
  AND order number generated (format: ORD-XXXXXXXX)
  AND success → /order/:id/confirm
  AND seller nhận notification
```

#### AC-3: Guest Checkout — No Login Required

```gherkin
GIVEN visitor is NOT logged in
WHEN  access /sites/[slug]/checkout
THEN  checkout form accessible without authentication
  AND order linked to site/tenant (not user account)
  AND SST (6%) calculated on subtotal
  AND Malaysian state dropdown shown for address
```

#### AC-4: Payment Failure

```gherkin
GIVEN payment thất bại
WHEN  return từ gateway FAIL
THEN  toast đỏ "Thanh toán thất bại. Thử lại"
  AND cart KHÔNG bị xóa
```

### Market Notes

- Currency: `RM XX.XX` (always)
- Tax: SST 6% displayed separately
- Address: Malaysian state dropdown (Selangor, Johor, Penang, etc.)
- Future: WhatsApp order notification (P1), FPX payment (P1)

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Mobile tested on 375px
- [ ] Guest checkout không yêu cầu login

---

## US-F09-04: Order Confirmation

**Wave 5** | **P0** | **S** | **Status:** Ready

### Story

```
As a   customer đã đặt hàng thành công
I want thấy trang xác nhận đơn hàng
So that tôi biết đơn hàng đã được ghi nhận
```

### Acceptance Criteria

#### AC-1: Happy Path — Order Confirmation Page

```gherkin
GIVEN customer placed an order successfully
WHEN  order confirmed
THEN  confirmation page shows: order number, total, items list
  AND "Continue Shopping" link back to products page
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Order number format: ORD-XXXXXXXX
