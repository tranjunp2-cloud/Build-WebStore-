# Test Cases: F09 — Products CRUD + F11 — Orders

> **Tester:** ___
> **Ngày test:** ___
> **URL Staging:** https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app

---

## 9-Point Checklist

| # | Check | Status | Ghi chú |
|---|---|---|---|
| 1 | Loading State | ⬜ | Skeleton loader cho product list |
| 2 | Empty State | ⬜ | "No products yet" + CTA |
| 3 | Error State | ⬜ | API fail → error message |
| 4 | Form Validation | ⬜ | Product name required, price >= 0 |
| 5 | Button States | ⬜ | Save/Delete disabled khi loading |
| 6 | Toast/Feedback | ⬜ | "Product saved!", "Product deleted!" |
| 7 | Auth Redirect | ⬜ | Chưa login → /login |
| 8 | Mobile 375px | ⬜ | Product cards stack |
| 9 | Console Errors | ⬜ | |

---

## Products Test Cases

### TC-01: Products — List view

**Precondition:** Đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /products | Hiện product list (hoặc empty state) |
| 2 | Check search bar | Có search input |
| 3 | Check status filter | All / Active / Draft filter |
| 4 | Check "Create Product" button | Button hiện, click navigate tới form |

**Result:** ⬜
**Bug #:** —

---

### TC-02: Products — Create product

**Precondition:** Đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Click "Create Product" | Mở form tạo product |
| 2 | Nhập tên: "Test Product" | Field nhận giá trị |
| 3 | Nhập giá: 99.90 | |
| 4 | Nhập mô tả | |
| 5 | Upload ảnh (nếu có) | Preview ảnh hiện |
| 6 | Click "Save" | Toast "Product created!", redirect về list |
| 7 | Check list | Product mới xuất hiện |

**Result:** ⬜
**Bug #:** —

---

### TC-03: Products — Edit product

**Precondition:** Có ít nhất 1 product

| Step | Action | Expected |
|---|---|---|
| 1 | Click vào product card | Navigate /products/:id |
| 2 | Đổi tên sản phẩm | |
| 3 | Đổi giá | |
| 4 | Click "Save" | Toast "Product updated!" |
| 5 | Quay lại list | Product hiện tên/giá mới |

**Result:** ⬜
**Bug #:** —

---

### TC-04: Products — AI Generate Description

**Precondition:** Đang edit product

| Step | Action | Expected |
|---|---|---|
| 1 | Click "Generate with AI" (nếu có) | AI tạo description |
| 2 | Check description field | Text mới xuất hiện |
| 3 | Có thể edit lại text | Editable |

**Result:** ⬜
**Bug #:** —

---

### TC-05: Products — Validation

**Precondition:** Đang ở form tạo/edit product

| Step | Action | Expected |
|---|---|---|
| 1 | Bỏ trống tên, click Save | Validation error |
| 2 | Nhập giá âm (-10) | Validation error |
| 3 | Nhập giá = 0 | Chấp nhận (free product) |

**Result:** ⬜
**Bug #:** —

---

## Orders Test Cases

### TC-06: Orders — List view

**Precondition:** Đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /orders | Hiện order list (hoặc empty state) |
| 2 | Check columns | Order #, Customer, Total, Status, Date |
| 3 | Check status badges | Pending (vàng), Shipped (xanh dương), Delivered (xanh lá) |
| 4 | Click refresh | List reload |

**Result:** ⬜
**Bug #:** —

---

### TC-07: Orders — Storefront checkout tạo order

**Precondition:** Có site published với products

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /sites/:slug/products | Hiện danh sách products |
| 2 | Click "Add to Cart" trên 1 product | Cart badge update |
| 3 | Mở cart → Click "Checkout" | Navigate /sites/:slug/checkout |
| 4 | Điền shipping info (name, email, address, phone) | |
| 5 | Click "Place Order" | Order confirmation hiện |
| 6 | Quay lại /orders | Order mới xuất hiện status "Pending" |

**Result:** ⬜
**Bug #:** —

---

### TC-08: Orders — Mobile responsive

**Precondition:** Chrome DevTools → iPhone SE (375px)

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /orders | Table scroll horizontal hoặc stack cards |
| 2 | Mở /products | Product cards stack 1 column |

**Result:** ⬜
**Bug #:** —

---

## Tổng kết

| TC | Tên | Result | Bug # |
|---|---|---|---|
| TC-01 | Products list | ⬜ | — |
| TC-02 | Create product | ⬜ | — |
| TC-03 | Edit product | ⬜ | — |
| TC-04 | AI description | ⬜ | — |
| TC-05 | Validation | ⬜ | — |
| TC-06 | Orders list | ⬜ | — |
| TC-07 | Storefront checkout | ⬜ | — |
| TC-08 | Mobile responsive | ⬜ | — |

**Overall:** ⬜ PASS / FAIL
**Sign-off by:** ___
**Date:** ___
