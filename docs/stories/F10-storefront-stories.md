# User Stories: Storefront Commerce (F10)

> **Feature:** F10 — Storefront Commerce  
> **Wave:** 5 | **Priority:** P0 🌟 | **Ref PRD:** [F10-storefront-commerce.md](../prd/F10-storefront-commerce.md)  
> **Market Ref:** [malaysia-market-context.md](../malaysia-market-context.md)

---

## US-008: Checkout — Purchase Flow ⭐

**Wave 4** | **P0 🌟** | **XL** | Status: Draft

### Story
```
As a   khách hàng trên published site
I want hoàn thành thanh toán dễ dàng
So that tôi nhận hàng và seller nhận tiền
```

### Acceptance Criteria
```gherkin
GIVEN khách có items trong cart
WHEN  vào /checkout
THEN  form: họ tên, phone, địa chỉ, payment method

GIVEN chọn payment method
WHEN  click "Thanh toán" / "Place Order"
THEN  order created with status='pending'
AND   order number generated (format: ORD-XXXXXXXX)
AND   success → /order/:id/confirm
AND   seller nhận notification

GIVEN payment thất bại
WHEN  return từ gateway FAIL
THEN  toast đỏ "Thanh toán thất bại. Thử lại"
AND   cart KHÔNG bị xóa
```

---

## US-10A: Browse Products

### Story
```
As a   site visitor
I want to browse products on the storefront
So that I can find items I want to purchase
```

### Acceptance Criteria
```gherkin
GIVEN a published site with active products
WHEN  visitor navigates to /sites/[slug]/products
THEN  products display in responsive grid (3-col desktop, 1-col mobile)
AND   each card: image, category, name, price (RM XX.XX)
AND   products with compareAtPrice show "SALE" badge
AND   only status='active' products visible
```

---

## US-10B: Add to Cart + Cart Drawer

### Story
```
As a   site visitor
I want to add products to cart and review before checkout
So that I can control what I'm buying
```

### Acceptance Criteria
```gherkin
GIVEN visitor clicks "Add to Cart" on a product
WHEN  item is added
THEN  cart drawer slides in from right
AND   item appears with quantity controls (+/-)
AND   subtotal updates in real-time
AND   cart persists across navigation (localStorage)
AND   adding same product increases quantity (not duplicate)
```

---

## US-10C: Guest Checkout (No Login)

### Acceptance Criteria
```gherkin
GIVEN visitor is NOT logged in
WHEN  access /sites/[slug]/checkout
THEN  checkout form accessible without authentication
AND   order linked to site/tenant (not user account)
AND   SST (6%) calculated on subtotal
AND   Malaysian state dropdown for address
```

---

## US-10D: Order Confirmation

### Acceptance Criteria
```gherkin
GIVEN customer placed an order successfully
WHEN  order confirmed
THEN  confirmation page with order number + total + items
AND   "Continue Shopping" link back to products
```

### MY Market Notes
- Currency: always `RM XX.XX`
- Tax: SST 6% displayed separately
- Address: Malaysian state dropdown (Selangor, Johor, Penang, etc.)
- Future: WhatsApp order notification (P1), FPX payment (P1)

### Definition of Done
- [ ] All 10 ACs from PRD pass
- [ ] 9-Point Checklist pass
- [ ] Mobile tested on 375px
