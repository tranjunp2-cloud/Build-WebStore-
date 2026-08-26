# User Stories: Shipping (F14)

> **Feature:** F14 — Shipping (Malaysia)
> **Wave:** 6 | **Priority:** P1 | **Ref PRD:** [F14-shipping.md](../prd/F14-shipping.md)

---

## US-F14-01: Shipping Calculation at Checkout

**Wave 6** | **P0** | **M** | **Status:** Draft

### Story

```
As a   buyer tại checkout
I want thấy shipping cost trước khi thanh toán
So that tôi biết tổng tiền thực sự phải trả
```

### Acceptance Criteria

#### AC-1: West Malaysia Shipping
```gherkin
GIVEN buyer at checkout selects state = "Selangor"
WHEN  state is in Semenanjung list
THEN  shipping cost shows RM 8.00
  AND order summary: Subtotal + RM 8.00 + SST = Total
```

#### AC-2: East Malaysia Shipping
```gherkin
GIVEN buyer selects state = "Sabah" or "Sarawak"
WHEN  shipping calculates
THEN  shipping cost shows RM 15.00
  AND estimated delivery "5-7 business days"
```

#### AC-3: Auto Free Shipping Threshold
```gherkin
GIVEN seller có cấu hình "Free shipping above RM 150"
WHEN  Cart subtotal >= 150
THEN  shipping fee hiển thị là "RM 0.00" hoặc "FREE"
```

### Definition of Done
- [ ] Logic tính giá shipping dựa vào 16 States.

---

## US-F14-02: Seller Shipping Settings

**Wave 6** | **P0** | **M** | **Status:** Draft

### Story

```
As a   SME Owner
I want tự định mức phí giao hàng cho West/East MY và Free Threshold
So that tôi tự quyết định được chính sách kinh doanh của shop
```

### Acceptance Criteria

#### AC-1: Configure Shipping Rates
```gherkin
GIVEN user đang ở Dashboard > Settings > Shipping
WHEN  nhập mức phí cho West MY và East MY
  AND thiết lập giá trị Free Shipping Threshold
THEN  system lưu JSON config vào `site.shippingConfig`
  AND Checkout tính theo giá trị mới này ngay lập tức
```

### Definition of Done
- [ ] Dữ liệu Rate được persist an toàn.

---

## US-F14-03: Mobile Web UX — Shipping Form Optimization

**Wave 6** | **P1** | **S** | **Status:** Ready

### Story

```
As a   mobile user (Shopper / Store Owner)
I want the shipping address forms and settings to be touch-friendly and use the correct keyboards
So that I can type quickly without errors on a small screen
```

### Acceptance Criteria

#### AC-1: Numeric Keyboards for Postcode

```gherkin
GIVEN a mobile shopper is entering their shipping address
WHEN  they tap the "Postcode" field
THEN  the device's native numeric keypad (Numpad) opens automatically (using `inputmode="numeric"`)
  AND all address fields are stacked vertically (100% width) to maximize typing space
```

#### AC-2: Tap-Friendly Shipping Settings

```gherkin
GIVEN a store owner is configuring shipping rates on a mobile device
WHEN  they view the settings page
THEN  the input fields for West/East Malaysia rates are vertically stacked
  AND the inputs are at least 44px tall
  AND the checkbox for "Enable free shipping" has a large tap target
```

### Definition of Done
- [ ] 9-Point Checklist pass.

---

## US-F14-04: Validate Shipping Rate Boundaries

**Wave 6** | **P0** | **S** | **Status:** Ready

### Story

```
As a   SME Owner cấu hình Shipping Settings
I want hệ thống chặn giá trị rate vô lý (âm, quá lớn)
So that tránh nhập sai gây loss doanh thu hoặc reject buyer
```

### Acceptance Criteria

#### AC-1: Reject negative rate

```gherkin
GIVEN seller mở Shipping Settings
WHEN  nhập westRate = -5 và click Save
THEN  hiển thị inline error "Rate must be 0 – RM 1,000"
  AND input border đỏ
  AND PATCH /shipping-config KHÔNG được gọi
  AND DB không thay đổi
```

> 📌 Source: QA TC-F14.13

#### AC-2: Accept rate = 0 (free shipping toàn shop)

```gherkin
GIVEN seller nhập westRate = 0, eastRate = 0
WHEN  click Save
THEN  request PATCH succeed với 200
  AND toast "Shipping settings updated"
  AND tại checkout: West/East buyer thấy "🎉 FREE SHIPPING APPLIED" cho mọi đơn
```

> 📌 Source: QA TC-F14.14

#### AC-3: Reject rate > RM 1,000

```gherkin
GIVEN seller nhập westRate = 100001 sen (RM 1,000.01)
WHEN  click Save
THEN  hiển thị inline error "Rate must be 0 – RM 1,000"
  AND PATCH KHÔNG được gọi
```

> 📌 Source: QA TC-F14.15

#### AC-4: Reset to Defaults rollback values

```gherkin
GIVEN seller đã đổi westRate = 2000, freeAbove = null (toggle off)
WHEN  click "Reset to Defaults"
THEN  westRate input shows "8.00" (default 800 sen)
  AND eastRate shows "15.00" (default 1500 sen)
  AND freeAbove shows "100.00" (default 10000 sen, KHÔNG null)
  AND free shipping toggle = ON
  AND Save button enabled (dirty state — chưa persist)
```

> 📌 Source: Design §8.1, PRD BR-07

### Definition of Done
- [ ] Zod schema validate rate range [0, 100000] sen
- [ ] Inline error UI khớp design §3 UI States Matrix
- [ ] Reset to Defaults dùng SHIPPING_DEFAULTS constant (architecture §7)
- [ ] Tests phủ TC-F14.13/14/15

---

## US-F14-05: Live Recalc on Address Change

**Wave 6** | **P0** | **M** | **Status:** Ready

### Story

```
As a   buyer tại checkout
I want phí ship tự động update khi tôi đổi state, không cần reload trang
So that tôi thấy ngay tổng tiền chính xác để quyết định mua
```

### Acceptance Criteria

#### AC-1: West → East auto-recalc

```gherkin
GIVEN buyer đã chọn state "Kuala Lumpur" → phí ship hiển thị RM 8.00
WHEN  buyer đổi state sang "Sarawak"
THEN  trong vòng < 500ms, phí ship update lên RM 15.00
  AND Total update tương ứng (Subtotal + RM 15 + SST)
  AND KHÔNG reload trang
  AND KHÔNG mất giá trị form fields khác (name, email, postcode...)
```

> 📌 Source: QA TC-F14.19

#### AC-2: Debounce 300ms

```gherkin
GIVEN buyer đang ở dropdown state, gõ liên tục nhiều state nhanh
WHEN  thay đổi 5 lần trong 200ms
THEN  chỉ 1 request POST /calculate-shipping được gọi (sau khi user dừng 300ms)
  AND inline spinner cạnh "Shipping:" hiện trong khi pending
```

> 📌 Source: Architecture §6.3, Design §3

#### AC-3: Network error retry

```gherkin
GIVEN POST /calculate-shipping return 500
WHEN  buyer change state
THEN  hiển thị toast "Failed to calculate shipping. Retry?"
  AND inline retry button cạnh Shipping row
  AND auto-retry 1 lần (exponential backoff 1s); nếu fail tiếp → manual retry
  AND Place Order button DISABLED khi shipping fee chưa tính được
```

> 📌 Source: Architecture §9 Error Handling Matrix

### Definition of Done
- [ ] Debounce hook (300ms) trong CheckoutPage
- [ ] Spinner UI khớp design §3
- [ ] Retry logic 1x auto + manual
- [ ] Tests phủ TC-F14.19 + debounce unit test

---

## US-F14-06: Zero-Subtotal Order Still Charges Shipping

**Wave 6** | **P1** | **S** | **Status:** Ready

### Story

```
As a   system (business rule)
I want đơn hàng với subtotal = RM 0 (do promo 100% off) vẫn tính phí ship
So that tránh exploit free shipping mà không đạt threshold thực
```

### Acceptance Criteria

#### AC-1: Subtotal 0, threshold không đạt → tính ship

```gherkin
GIVEN seller cấu hình freeAbove = RM 100, eastRate = RM 15
  AND buyer có promo code giảm 100% → subtotal = RM 0
WHEN  buyer chọn state "Sabah" (East MY)
THEN  shipping fee = RM 15.00 (không free vì 0 < 100)
  AND SST = RM 0 (6% của 0)
  AND Total = RM 15.00
  AND KHÔNG hiển thị "🎉 FREE SHIPPING APPLIED"
```

> 📌 Source: QA TC-F14.20, PRD BR-06

#### AC-2: Subtotal 0, threshold = 0 → free

```gherkin
GIVEN seller cấu hình freeAbove = 0 (mọi đơn đều free)
  AND buyer subtotal = RM 0
WHEN  buyer chọn state bất kỳ
THEN  shipping fee = RM 0
  AND hiển thị "🎉 FREE SHIPPING APPLIED" (vì 0 >= 0)
  AND Total = RM 0
```

> 📌 Source: PRD BR-06 (boundary inclusive `>=`)

#### AC-3: Hint không hiển thị "Add RM 0 more"

```gherkin
GIVEN subtotal = RM 0, threshold = RM 100
WHEN  buyer view checkout
THEN  hint hiển thị "💡 Add RM 100 more for FREE shipping" (gap = 100, neutral tier)
  AND KHÔNG xảy ra edge case "Add RM 0 more" hoặc NaN
```

> 📌 Source: Design §8.3 3-tier hint

### Definition of Done
- [ ] `calculateShippingFee()` xử lý subtotal = 0 đúng (không divide by zero, không NaN)
- [ ] Free shipping condition strict `subtotal >= freeAbove` (boundary inclusive)
- [ ] Hint logic không generate "Add RM 0 more"
- [ ] Tests phủ TC-F14.20 + AC-2/AC-3 edge cases

