# PRD: Shipping — Malaysia (F14)
> **Version:** 1.1 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P1 | **Sprint:** Wave 6 | **Size:** M
> **Depends on:** F09 Storefront Commerce ✅, F10 Orders Management ✅
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §5 Shipping Landscape

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file.

> [!NOTE]
> F14 chưa có Story file riêng. Checkout shipping (WestMY/EastMY) được derived từ US-F14-03.
> **Action required:** Tạo `F12-shipping-stories.md` trước Wave 6 development.


---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F14-03 | Checkout — Shipping by State AC | [F09-storefront-stories.md](../stories/F09-storefront-stories.md) | Draft |
| *(Pending)* | Seller Sets Shipping Rates | *(F12-shipping-stories.md chưa có)* | Needs Story |
| *(Pending)* | Track Order Delivery | *(F12-shipping-stories.md chưa có)* | Needs Story |

> ⚠️ Seller shipping settings và tracking stories chưa tạo. Tạo trước Wave 6.

---

## 1. Problem Statement

PrimeWeb không có shipping logic. Checkout hiện create orders mà không tính shipping fees. Sellers Malaysia cần shipping cost auto-calculation theo state, và buyers cần thấy delivery cost trước khi thanh toán. Không có → seller phải tính tay qua WhatsApp.

---

## 2. Target User

- **SME Owner:** Set shipping rates, cập nhật tracking number
- **Buyer:** Thấy shipping cost tại checkout, track delivery

---

## 3. Solution Overview

**Wave 6 (P0):** Flat rate shipping theo region: West Malaysia RM 8, East Malaysia RM 15. Seller có thể customize trong Settings. Free shipping threshold configurable.

**Wave 7+ (P1):** Carrier API integration (J&T, Pos Laju, Ninja Van) via EasyParcel aggregator.

---

## 4. Scope

### In Scope (Wave 6)
- Flat rate by state: West MY = RM 8, East MY = RM 15 (US-F14-03)
- Seller customizable rates trong Settings (Pending story)
- Free shipping threshold (Pending story)
- Malaysian states dropdown (16 states + territories)

### Out of Scope (Wave 7+)
- Carrier API (J&T, Pos Laju) — EasyParcel integration
- Tracking number + tracking link
- Label printing

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Orders with shipping cost shown | 100% | DB check |
| Seller shipping setup time | < 2 min | UX test |

---

## 6. User Story Summary

```
AS A   buyer tại checkout
I WANT thấy shipping cost trước khi thanh toán
SO THAT tôi biết tổng tiền thực sự phải trả
```

> Source: [US-F14-01](../stories/F14-shipping-stories.md)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | State dropdown: 16 Malaysian states + territories | US-F14-01 | P0 | |
| FR-02 | Shipping auto-calculate: West MY = RM 8, East MY = RM 15 | US-F14-01 | P0 | |
| FR-03 | Order summary: Subtotal + Shipping + SST = Total | US-F14-01 | P0 | |
| FR-04 | Free shipping khi subtotal ≥ threshold | US-F14-02 | P1 | Seller configurable |
| FR-05 | "Add RM X more for free shipping" hint | US-F14-01 | P1 | |
| FR-06 | Seller Settings: customize West/East rates, free threshold | US-F14-02 | P0 | |
| FR-07 | Seller Settings: estimated delivery days per region | US-F14-02 | P1 | |
| FR-08 | **[Mobile]** Khung Form địa chỉ trên điện thoại sử dụng Numpad (`inputmode="numeric"`) cho postcode number, form fields full-width. | US-F14-03 | P1 | UX Form |

---

## 8. Business Rules

- **BR-01:** West MY = Johor, Kedah, Kelantan, Melaka, N.Sembilan, Pahang, Perak, Perlis, Penang, Selangor, Terengganu, KL, Putrajaya, Labuan
- **BR-02:** East MY = Sabah, Sarawak
- **BR-03:** Seller rates override defaults — stored trong `site.shippingConfig`
- **BR-04:** Rate phải ≥ 0 (free shipping allowed)
- **BR-05:** SST 6% computed on subtotal ONLY (không gồm shipping)

---

## 9. User Flow

```
Checkout form → type address
  → Select state from dropdown
  ↓
  ├── State in West MY → RM 8 shown
  └── State in East MY → RM 15 shown

  ├── Subtotal ≥ free threshold → RM 0 "🎉 Free Shipping"
  └── Subtotal < free threshold → "Add RM X more for free"

  Order Summary:
  Subtotal: RM XXX
  Shipping: RM 8 / RM 15 / FREE
  SST (6%): RM X.XX
  Total:    RM XXX
```

---

## 10. Screen Layout

> **[Global CMS Constraint]** Cấu hình Shipping được hiển thị trong trang Settings của CMS Dashboard (F18 Layout), trong khi thông tin tính toán Shipping được đặt trong luồng Checkout Storefront (F09).

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

### 10.1. Màn hình Cấu hình Shipping (CMS Dashboard)
- **Mô tả:** Màn hình do người bán thiết lập mức phí vận chuyển.
- **Components chính:**
  - Card: Các Vùng Địa Lý (Semenanjung, Sabah/Sarawak). Field cho Giá Vận Chuyển.
  - Tích chọn: Enable Free Shipping Threshold và điền Amount.
- **Wireframe:**
```text
Settings (/settings/shipping):
┌──────────────────────────────────────┐
│  Semenanjung (West):  [RM 8  ]       │
│  Sabah & Sarawak:     [RM 15 ]       │
│  Free shipping above: [RM 150]       │
│  ☐ Enable free shipping              │
│  [Save Settings]                     │
└──────────────────────────────────────┘
```

### 10.2. Màn hình Tính phí Shipping Checkout (Storefront)
- **Mô tả:** Phần điền địa chỉ để tính phí tự động.
- **Components chính:**
  - Form nhập: Điền State (16 Vùng).
  - Tự động nhảy text "Standard Delivery – RM X.00".
- **Wireframe:**
```text
Checkout (/sites/[slug]/checkout):
┌─ Shipping ─────────────────────────────┐
│  [Address Line 1*     ]                │
│  [City*   ] [Postcode*]                │
│  [State ▼ — 16 states]                 │
│                                         │
│  📦 Standard Delivery — RM 8.00        │
│     Est. 3-5 business days             │
│     (Sabah/Sarawak: RM 15, 5-7 days)  │
│                                         │
│  ✨ Add RM 20.00 more to unlock        │
│     FREE Shipping!                     │
└────────────────────────────────────────┘
```

### 10.3. Mobile View (Shipping Configuration & Checkout)
- **Mô tả:** Hiển thị cấu hình vận chuyển thu gọn trên Settings CMS của Mobile, và khối chọn State trong Form Checkout của Mobile Storefront.
- **Wireframe:**
```text
┌─ Mobile Settings: Shipping ─────────────────┐
│ [←] Back         [Save]                     │
│ ─────────────────────────────────────────── │
│ 📦 STANDARD DELIVERY                        │
│ Semenanjung:     [RM 8  ]                   │
│ Sabah/Sarawak:   [RM 15 ]                   │
│                                             │
│ 🎁 CẤU HÌNH FREE SHIPPING                   │
│ Free shipping từ [RM 150]                   │
│ [ON] Kích hoạt Free Shipping                │
└─────────────────────────────────────────────┘
```

### 10.4. Các trạng thái UI (UI States) & Modals
- **Loading State:** Text Shipping mờ nhẹ hoặc hiện vòng quay Spinner mỗi khi User Trigger đổi giá trị ô State (debounced).
- **Error State / Edge Cases:** Nếu nhập thiếu Postal Code, ô input highlight viền Đỏ.

---

## 11. Acceptance Criteria

> AC từ `F14-shipping-stories.md`.

### AC-1: West Malaysia Shipping
> 📌 Source: [US-F14-01](../stories/F14-shipping-stories.md) — AC-1

```gherkin
GIVEN buyer at checkout selects state = "Selangor"
WHEN  state is in Semenanjung list
THEN  shipping cost shows RM 8.00
  AND order summary: Subtotal + RM 8.00 + SST = Total
```

### AC-2: East Malaysia Shipping
> 📌 Source: [US-F14-01](../stories/F14-shipping-stories.md) — AC-2

```gherkin
GIVEN buyer selects state = "Sabah" or "Sarawak"
WHEN  shipping calculates
THEN  shipping cost shows RM 15.00
  AND estimated delivery "5-7 business days"
```

### AC-3: Malaysian States Dropdown
> 📌 Source: [US-F14-01](../stories/F14-shipping-stories.md) — AC-3

```gherkin
GIVEN buyer at checkout address form
WHEN  clicks State dropdown
THEN  shows all 16 Malaysian states + federal territories:
      Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang,
      Perak, Perlis, Pulau Pinang, Sabah, Sarawak, Selangor,
      Terengganu, W.P. Kuala Lumpur, W.P. Putrajaya, W.P. Labuan
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Accuracy** | Shipping rate 100% correct based on state | Auto-tested |
| **Device** | Mobile 375px — address fields stack, state full-width | |

---

## 13. Technical Architecture

### Data Model

```typescript
// Sites collection — add shippingConfig
shippingConfig: {
  westRate: number,        // default: 800 (RM 8.00 in cents)
  eastRate: number,        // default: 1500 (RM 15.00)
  freeAbove: number | null // null = no free shipping
  westDays: string,        // "3-5"
  eastDays: string,        // "5-7"
}

// Orders collection — add shipping
shipping: {
  address: { line1, line2, city, state, postcode, country: "Malaysia" },
  cost: number,
  method: 'standard',
  trackingNumber?: string, // Wave 7+
}
```

### API Endpoints

```
GET /api/sites/:id/shipping-config          → get rates
PATCH /api/sites/:id/shipping-config        → update rates (auth required)
POST /api/orders/calculate-shipping         → returns cost based on state
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F09 Storefront | ✅ | — |
| F10 Orders collection | ✅ | Add shipping fields |
| EasyParcel API (Wave 7) | ⬜ | Future |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Shipping calculation spinner
- [ ] Empty State — N/A
- [ ] Error State — "Failed to calculate shipping" + retry
- [ ] Form Validation — Address, State required
- [ ] Button States — Save Settings disabled during API
- [ ] Toast Feedback — "Shipping settings saved!"
- [ ] Auth Redirect — Settings requires auth; checkout public
- [ ] Mobile 375px — Address fields stack, state full-width
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] User Stories F14 approved
- [ ] F09, F10 done
- [ ] All 16 MY states list confirmed

---

## 19. Definition of Done

- [ ] All FR implemented
- [ ] Shipping cost calculation verified (all 16 states)
- [ ] Free shipping threshold works
- [ ] Seller settings saved and applied correctly
