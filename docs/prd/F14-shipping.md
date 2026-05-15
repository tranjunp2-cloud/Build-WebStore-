# PRD: Shipping — Malaysia (F14)
> **Version:** 1.2 | **Updated:** 2026-05-12 | **Agent:** `docs-engineer`
> **Priority:** P1 | **Sprint:** Wave 6 | **Size:** M
> **Depends on:** F09 Storefront Commerce ✅, F10 Orders Management ✅
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §5 Shipping Landscape

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file.

> [!NOTE]
> **Scope Wave 6 (chốt 2026-05-12):**
> - Flat-rate only — KHÔNG bao gồm estimated delivery days per region
> - MYR only — KHÔNG multi-currency
> - Single-seller cart — KHÔNG multi-seller free shipping isolation (Cart store chưa hỗ trợ split theo seller)

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F14-01 | Shipping Calculation at Checkout | [F14-shipping-stories.md](../stories/F14-shipping-stories.md) | Draft |
| US-F14-02 | Seller Shipping Settings | [F14-shipping-stories.md](../stories/F14-shipping-stories.md) | Draft |
| US-F14-03 | Mobile Web UX — Shipping Form Optimization | [F14-shipping-stories.md](../stories/F14-shipping-stories.md) | Ready |
| US-F14-04 | Validate Shipping Rate Boundaries | [F14-shipping-stories.md](../stories/F14-shipping-stories.md) | Ready |
| US-F14-05 | Live Recalc on Address Change | [F14-shipping-stories.md](../stories/F14-shipping-stories.md) | Ready |
| US-F14-06 | Zero-Subtotal Order Still Charges Shipping | [F14-shipping-stories.md](../stories/F14-shipping-stories.md) | Ready |

---

## 1. Problem Statement

PrimeWeb không có shipping logic. Checkout hiện create orders mà không tính shipping fees. Sellers Malaysia cần shipping cost auto-calculation theo state, và buyers cần thấy delivery cost trước khi thanh toán. Không có → seller phải tính tay qua WhatsApp.

---

## 2. Target User

- **SME Owner:** Set shipping rates, cập nhật tracking number
- **Buyer:** Thấy shipping cost tại checkout, track delivery

---

## 3. Solution Overview

> **🚚 Delivery Model: SELF-DELIVERY (Merchant-Fulfilled)**
> Seller tự lo toàn bộ quá trình giao hàng — KHÔNG có integration với carrier nào (J&T, Pos Laju, Ninja Van, EasyParcel...). Hệ thống chỉ tính phí ship dạng flat-rate và cho seller nhập thủ công tracking number sau khi đã liên hệ courier ngoài hệ thống.

**Wave 6 (P0) — Self-delivery flat-rate:**
- Flat rate shipping theo region: West Malaysia RM 8, East Malaysia RM 15
- Seller customize rates trong Settings
- Free shipping threshold configurable
- Tracking number = free-text field, seller nhập tay sau khi ship hàng qua courier ngoài hệ thống

**Wave 7+ (P1) — Carrier-integrated:**
- EasyParcel aggregator integration (J&T, Pos Laju, Ninja Van)
- Auto generate shipping label
- Auto tracking URL từ carrier API
- Real-time delivery status webhook

---

## 4. Scope

### In Scope (Wave 6)
- Flat rate by state: West MY = RM 8, East MY = RM 15 (US-F14-01)
- Seller customizable rates trong Settings (US-F14-02)
- Free shipping threshold (US-F14-02)
- Malaysian states dropdown (16 states + territories) (US-F14-01)
- Validate rate boundaries: 0 ≤ rate ≤ RM 1,000 (US-F14-04)
- Live recalc khi buyer đổi state tại checkout (US-F14-05)
- Mobile UX: Numpad cho postcode, vertical stack ≥ 44px (US-F14-03)

### Out of Scope (Wave 7+)
- Carrier API (J&T, Pos Laju) — EasyParcel integration
- Tracking number live update + tracking link
- Label printing
- Estimated delivery days per region (`westDays`/`eastDays`)
- Multi-seller cart free shipping isolation
- Multi-currency shipping rates

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
| FR-04 | Free shipping khi subtotal `≥` threshold | US-F14-01 | P1 | Boundary inclusive (TC-F14.08) |
| FR-05 | "Add RM X more for free shipping" hint — 3-tier display logic (gap > 50 neutral; gap ≤ 50 highlight; reached → badge) | US-F14-01 | P1 | See design §8.3 |
| FR-06 | Seller Settings: customize West/East rates, free threshold | US-F14-02 | P0 | |
| FR-07 | **[Mobile]** Numpad (`inputmode="numeric"`) cho postcode, form fields full-width, tap target ≥ 44px | US-F14-03 | P1 | UX Form |
| FR-08 | Validate rate boundaries: 0 ≤ rate ≤ 100,000 sen (RM 1,000) | US-F14-04 | P0 | TC-F14.13/14/15 |
| FR-09 | Live recalc fee khi đổi state tại checkout (debounced 300ms, no reload) | US-F14-05 | P0 | TC-F14.19 |
| FR-10 | Subtotal = 0 vẫn tính phí ship (chỉ free khi đạt threshold) | US-F14-06 | P1 | TC-F14.20 |
| FR-11 | Postcode validation: regex `^\d{5}$` (format only, no state cross-check) | US-F14-03 | P0 | See design §8.2 |
| FR-12 | Reset to Defaults: rollback về `westRate=800, eastRate=1500, freeAbove=10000, toggle=ON` — KHÔNG dùng `null` | US-F14-02 | P1 | See design §8.1 |

---

## 8. Business Rules

- **BR-01:** West MY (13 states) = Johor, Kedah, Kelantan, Melaka, N.Sembilan, Pahang, Perak, Perlis, Penang, Selangor, Terengganu, KL, Putrajaya
- **BR-02:** East MY (3 states) = Sabah, Sarawak, **Labuan** (Federal Territory thuộc East MY per TC-F14.03)
- **BR-03:** Seller rates override defaults — stored trong `site.shippingConfig`
- **BR-04:** Rate range: 0 ≤ rate ≤ 100,000 sen (RM 1,000). Rate = 0 cho phép (free shipping toàn shop).
- **BR-05:** SST 6% computed on **subtotal ONLY** — explicitly excludes shipping fee.
- **BR-06:** Free shipping condition: `subtotal >= freeAbove` (boundary inclusive). `freeAbove = null` → never free.
- **BR-07:** Default values (system seed + Reset to Defaults): `westRate=800, eastRate=1500, freeAbove=10000, freeShippingEnabled=true`. KHÔNG dùng `null` cho `freeAbove` ở default state.
- **BR-08:** Postcode validate format only (regex `^\d{5}$`). KHÔNG cross-check postcode-state — Wave 7+ feature.
- **BR-09:** **Self-delivery model** — seller responsibility ngoài hệ thống. Tracking number do seller nhập tay (free text); hệ thống KHÔNG verify tracking number, KHÔNG gọi carrier API, KHÔNG generate tracking URL tự động.

---

## 9. User Flow

### 9.1. Buyer flow (Storefront)
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

### 9.2. Seller fulfillment flow (SELF-DELIVERY, outside system)
```
Order received (status = PENDING)
  ↓
Seller TỰ đóng gói sản phẩm
  ↓
Seller TỰ liên hệ courier (J&T / Pos Laju / Grab / etc.)
  → ngoài hệ thống — PrimeWeb KHÔNG có integration
  ↓
Seller nhận tracking number từ courier
  ↓
Vào Dashboard → Order detail → nhập THỦ CÔNG `trackingNumber` (free text)
  → Đổi status: Ready to Ship → Shipped
  ↓
Hệ thống tự gửi email "Shipped" tới buyer (hiển thị tracking number, KHÔNG link)
  ↓
Buyer copy tracking number → tự paste vào trang carrier để xem trạng thái
```

> ⚠️ Wave 6 KHÔNG có: auto label printing, auto tracking URL, real-time delivery webhook. Wave 7+ via EasyParcel.

---

## 10. Screen Layout

> **[Global CMS Constraint]** Cấu hình Shipping được hiển thị trong trang Settings của CMS Dashboard (F18 Layout), trong khi thông tin tính toán Shipping được đặt trong luồng Checkout Storefront (F09).

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

> **[Wireframe & Design Rule]** Không cần dùng ASCII để minh hoạ. Dẫn nguồn trực tiếp từ wireframe ở thư mục design nếu có.
> **[Quy tắc Cập nhật]** Mỗi khi 1 design/wireframe mới được thêm, BẮT BUỘC phải bổ sung ở Screen Layout đường dẫn tới file đó.

### 10.1. Màn hình Cấu hình Shipping (CMS Dashboard)
- **Mô tả:** Màn hình do người bán thiết lập mức phí vận chuyển.
- **Components chính:**
  - Card: Các Vùng Địa Lý (Semenanjung, Sabah/Sarawak). Field cho Giá Vận Chuyển.
  - Tích chọn: Enable Free Shipping Threshold và điền Amount.
- **Design / Wireframe:**
  - [F14-shipping-design.md §Screen A](../design/F14-shipping-design.md#screen-a-shipping-settings)

### 10.2. Màn hình Tính phí Shipping Checkout (Storefront)
- **Mô tả:** Phần điền địa chỉ để tính phí tự động.
- **Components chính:**
  - Form nhập: Điền State (16 Vùng).
  - Tự động nhảy text "Standard Delivery – RM X.00".
- **Design / Wireframe:**
  - [F14-shipping-design.md §Screen B](../design/F14-shipping-design.md#screen-b-checkout-shipping)

### 10.3. Mobile View (Shipping Configuration & Checkout)
- **Mô tả:** Hiển thị cấu hình vận chuyển thu gọn trên Settings CMS của Mobile, và khối chọn State trong Form Checkout của Mobile Storefront.
- **Design / Wireframe:**
  - [F14-shipping-design.md §Screen C](../design/F14-shipping-design.md#screen-c-mobile-375px)

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
// Sites collection — shippingConfig (existing, src/collections/Sites.ts:330)
shippingConfig: {
  westRate: number,        // sen, default 800 (RM 8.00); range [0, 100_000]
  eastRate: number,        // sen, default 1500 (RM 15.00); range [0, 100_000]
  freeAbove: number | null // sen; null = no free shipping
}

// Orders collection — shipping fields (existing, src/collections/Orders.ts:138,237)
shippingFee: number,       // sen, min 0
shippingAddress: {
  line1, line2, city, state, postcode,
  country: 'Malaysia' (default)
},
trackingNumber?: string    // Wave 7+
```

### API Endpoints

```
GET   /api/sites/:siteId/shipping-config    → returns ShippingConfig (public-safe)
PATCH /api/sites/:siteId/shipping-config    → update rates (tenant member auth)
POST  /api/orders/calculate-shipping        → { fee, isFree, hint } based on state + subtotal
```

> Full API contract: see [`docs/architecture/F14-shipping.md`](../architecture/F14-shipping.md) §6 API Design.

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F09 Storefront | ✅ | — |
| F10 Orders collection | ✅ | Add shipping fields |
| EasyParcel API (Wave 7) | ⬜ | Future |

---

## 15. API Spec

Full request/response schema + error codes: see [`docs/architecture/F14-shipping.md`](../architecture/F14-shipping.md) §6 API Design.

Summary:
- `GET /api/sites/:siteId/shipping-config` — public-safe read
- `PATCH /api/sites/:siteId/shipping-config` — auth: tenant member; body validates rate range
- `POST /api/orders/calculate-shipping` — public; body `{ state, subtotal, siteId }`; returns `{ fee, isFree, hint? }`

---

## 16. Test Strategy

Test suite: see [`docs/qa/F14-shipping.md`](../qa/F14-shipping.md) — 20 TC + 2 E2E flows.

Coverage map (TC ↔ FR):
- FR-01/02/03 → TC-F14.01/02/03/05/17
- FR-04/06 → TC-F14.06/07/08/09
- FR-06 → TC-F14.11/12/16
- FR-07 (Mobile) → TC-F14.16 + manual mobile audit
- FR-08 (Validate) → TC-F14.13/14/15
- FR-09 (Live recalc) → TC-F14.19
- FR-10 (Zero subtotal) → TC-F14.20
- Edge → TC-F14.04/10/18

> Wave 6 không test multi-seller free ship isolation (TC-F14.10) — out of scope.

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

- [ ] All 6 User Stories (US-F14-01..06) status = Ready
- [ ] F09, F10 done
- [ ] All 16 MY states list confirmed (13 West + 3 East incl. Labuan)
- [ ] Design doc (`docs/design/F14-shipping-design.md`) complete (Phase 02)
- [ ] Architecture doc (`docs/architecture/F14-shipping.md`) complete (Phase 03)

---

## 19. Definition of Done

- [ ] All FR (FR-01..10) implemented
- [ ] Shipping cost calculation verified (all 16 states, West/East classification correct)
- [ ] Free shipping threshold works (boundary inclusive `>=`)
- [ ] Seller settings saved and applied correctly (validate 0 ≤ rate ≤ RM 1,000)
- [ ] Live recalc verified — no full reload on state change
- [ ] SST excludes shipping fee (BR-05)
- [ ] Mobile 375px audit passed (US-F14-03 AC checks)
- [ ] All 20 QA TC pass (excl. TC-F14.10 multi-seller, out of scope)
