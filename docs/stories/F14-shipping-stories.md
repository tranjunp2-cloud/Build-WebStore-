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



