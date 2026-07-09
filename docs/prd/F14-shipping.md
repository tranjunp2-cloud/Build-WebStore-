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

---

## 20. EasyParcel Integration (Wave 7)

Carrier-integrated shipping via EasyParcel aggregator. Seller connects API key + warehouse origin + selects 1 COD-supporting courier; checkout offers real-time rates per selected courier (buyer does not choose). Hybrid fallback to flat West/East when unconfigured. See shared context & architecture: [`docs/prd/F36-easyparcel-delivery.md`](./F36-easyparcel-delivery.md).

### 20.1. EasyParcel — Connect & Settings

**User Stories**

| ID | Story |
|---|---|
| **US-F36-01** | As a merchant, I want to connect my EasyParcel account (via API key) and validate my warehouse address, so that Prime can calculate real shipping rates and generate labels on my behalf. |
| **US-F36-02** | As a merchant, I want to select 1 courier for my shop from the 4 COD-supporting couriers (COD is a non-negotiable platform default), so that my buyers always see rates for that courier and can pay by COD at checkout. |
| **US-F36-03** | As a merchant or buyer, I want checkout to fall back to flat rate when EasyParcel is not configured or disabled, so that the store never breaks. |

**Functional Requirements**

| FR | Mô tả | Story |
|---|---|---|
| **A-1** | Tab "EasyParcel" dalam `settings/shipping`: input API key (api + auth), form warehouse address. Warehouse = **Prime source of truth**, dùng cho cả rate + label/pickup; **KHÔNG sync từ EasyParcel** (API không có endpoint đọc address). Form dùng **geo cascade NATIVE có sẵn** (State → City → Postcode = 3 dropdown qua `/api/geo/{states,districts,postcodes}` + reverse `/api/geo/lookup/[postcode]`); chỉ `line1/line2` free text. Cascade trả `zone` (west/east) → tái dùng cho COD West-MY. **KHÔNG có selector environment** — env auto-detect ở bước test. | US-F36-01 |
| **A-2** | "Test connection" gọi `EPRateCheckingBulk` bằng key + **chính warehouse postcode**, **tự dò env** (production trước, fail → demo); OK → lưu key + `detectedEnv` + warehouse (đã validate) + trả list courier. FAIL key → `EASYPARCEL_INVALID_KEY`; FAIL warehouse postcode → `EASYPARCEL_INVALID_WAREHOUSE`. **Force validate: sai → KHÔNG lưu.** | US-F36-01 |
| **A-3** | Chọn **1 courier** cho shop (`selectedCourier` = single `courier_id`, radio single-select). **Vì COD mặc định bật toàn platform (non-negotiable), list CHỈ gồm 4 courier hỗ trợ COD** (`cod_service_available=true`: Flash/DHL/J&T/Aramex — đọc live từ response, KHÔNG hardcode, KHÔNG list courier non-COD). Default = **J&T**; mỗi courier gắn badge "COD" + settlement ETA per-courier; KHÔNG cần collapse (chỉ 4 courier). **KHÔNG show giá cước ở settings**; giá thật chỉ ở checkout. List chỉ name + logo + badge. Hint seller: COD payout lần đầu cần eKYC + verify bank trên EasyParcel (Prime chỉ hiện hint, KHÔNG build verify). | US-F36-02 |
| **A-4** | API key lưu trong `tenant.easyParcelIntegration.apiKey`; **PATCH yêu cầu auth + IDOR check** (chỉ owner tenant sửa được). | US-F36-01 |
| **A-5** | `enabled=false` hoặc thiếu key/warehouse → checkout dùng **flat rate fallback** (không vỡ). | US-F36-03 |
| **A-6** | EasyParcel API lỗi → log + error code, không lộ key, tenant không kẹt trạng thái sai. | US-F36-01 |

**Data Model**

```typescript
// Tenants collection — easyParcelIntegration (new)
easyParcelIntegration: {
  apiKey: string,          // api_key (sensitive, encrypt at-rest consideration)
  authKey: string,         // authentication key (sensitive)
  warehouse: {
    line1: string,
    line2?: string,
    city: string,
    state: string,
    postcode: string,
    zone: 'west' | 'east'  // derived from state via /api/geo/
  },
  selectedCourier: {
    courier_id: string,    // e.g. 'EP-CR0A'
    courier_name: string,  // e.g. 'J&T'
    courier_logo: string,  // URL
    codAvailable: boolean, // cached from rate-check
    codFee?: number,       // sen; from response
    codMin?: number,       // sen
    codMax?: number        // sen
  },
  detectedEnv: 'production' | 'demo',
  enabled: boolean
}
```

**Acceptance Criteria**

1. GIVEN tenant chưa connect WHEN mở settings/shipping THEN thấy tab EasyParcel + form API key.
2. GIVEN dán key đúng + warehouse WHEN "Test connection" THEN OK, lưu key, hiện list courier.
3. GIVEN key sai WHEN test THEN error `EASYPARCEL_INVALID_KEY`, KHÔNG lưu.
4. GIVEN connect xong WHEN chọn 1 courier THEN chỉ courier đó hiện ở checkout.
5. GIVEN user không thuộc tenant WHEN PATCH settings THEN 403 (IDOR chặn).
6. GIVEN enabled=false THEN checkout dùng flat rate fallback.

---

### 20.2. EasyParcel — Real-Time Rates (Hybrid)

**User Stories**

| ID | Story |
|---|---|
| **US-F36-04** | Real-time rate at checkout (EasyParcel → 1 courier) |
| **US-F36-05** | Checkout address + shipping UI + hybrid fallback |

**Functional Requirements**

| FR | Mô tả | Story |
|---|---|---|
| **B-0** | Buyer shipping-address form **reuse cascade F14** (State → City → Postcode `<Select>` × 3, `/api/geo/*` + `CheckoutForm`) — KHÔNG dựng form/endpoint mới. | US-F36-05 |
| **B-1** | `calculate-shipping` nhận thêm `items` → tính tổng weight (sum `Products.weight` × qty; product = 0/thiếu → hằng số hệ thống `DEFAULT_PARCEL`). `DEFAULT_PARCEL` contains **both** fallback weight (kg) **and** default box dimensions (width, length, height in cm integer). `EPRateCheckingBulk` call **MUST send weight + the `DEFAULT_PARCEL` dims** so volumetric basis at rate-check matches label creation. | US-F36-04 |
| **B-1b** | **Snapshot `parcelWeight` (kg — updated 2026-07-06, GH-1458; was previously documented as gram) lên order lúc checkout** (= tổng weight đã tính ở B-1) — để modal Ready-to-Ship đọc lại khớp đúng cước đã báo, KHÔNG re-join Products. | US-F36-04 |
| **B-2** | Tenant EasyParcel ON → rate `selectedCourier` (1 courier shop chọn), trả `{ courier, serviceId, fee(sen), eta }` đơn; OFF → trả flat fee đơn (shape cũ tương thích). | US-F36-04 |
| **B-3** | Checkout UI: phí ship hiển thị **1 dòng "Shipping" trong Order Summary** — KHÔNG có section vận chuyển (shop chốt 1 courier, buyer không chọn), KHÔNG có dòng SST. Fallback → giữ UI fee đơn hiện tại. | US-F36-05 |
| **B-4** | Lưu `shippingCourier`, `shippingServiceId`, `shippingFee` vào order. `shippingFee` lưu **RM-float** (compute bằng sen rồi `/100` khi lưu — KHÔNG lưu sen vào cột này). Wire ở nhánh `/api/orders/checkout` + `/api/orders/stripe-checkout`. | US-F36-04 |
| **B-5** | EasyParcel rate API lỗi/timeout → **fallback flat rate** (không chặn checkout); log cảnh báo. | US-F36-05 |
| **B-6** | Giá hiển thị = **raw EasyParcel** (RM→sen ×100), KHÔNG markup. | US-F36-04 |
| **B-7** | Free-shipping threshold (`freeAbove`) vẫn áp được lên phí ship nếu merchant bật. | US-F36-05 |
| **B-8** | **Buyer checkout đã thu đủ 8 receiver fields** (name, phone, email, addr1, addr2, city, state, postcode) — KHÔNG cần thêm input field mới. Backend transform `mapState()` + `normalizePhone()` + `buildAddress()` trước khi gửi EasyParcel. | US-F36-04 |
| **B-9** | **Product weight/dimensions snapshot vào order** tại checkout (kg — updated 2026-07-06, GH-1458; was previously documented as grams); aggregated thành `parcelWeight` (kg) trên order để rate call và modal "Ready to Ship" dùng lại. Default `DEFAULT_PARCEL` khi product weight = 0. `DEFAULT_PARCEL` carries both fallback weight and box dims (W/L/H cm); both sent in `EPRateCheckingBulk` so checkout rate is volumetrically consistent with label creation. | US-F36-04 |
| **B-10** | **EasyParcel normalize per-courier differences** — cùng 1 field set cho mọi courier (J&T, Pos Laju, Flash, Ninja Van, etc.). Backend gửi cùng field set bất kể `selectedCourier`. | US-F36-04 |

**Data Model (Orders — new fields)**

```typescript
// Orders collection — shipping fields (extended)
shippingCourier?: string,    // e.g. 'J&T' (from EasyParcel selectedCourier.courier_name; wave 7+)
shippingServiceId?: string,  // e.g. 'EP-CS0I' (from EPRateCheckingBulk; wave 7+)
parcelWeight?: number,       // kg (updated 2026-07-06, GH-1458 — was previously gram); snapshot at checkout; wave 7+
// existing:
shippingFee: number,         // RM-float; wave 6+
shippingAddress: { line1, line2, city, state, postcode, country }
```

**FR-02 Update (Wave 6 → Wave 7)**

Updated note: Shipping auto-calculate — **Wave 6:** flat West MY = RM 8, East MY = RM 15. **Wave 7:** flat OR real-time EasyParcel rate per tenant setting (hybrid fallback to flat when unconfigured per FR A-5, B-5).

**Acceptance Criteria**

1. GIVEN tenant EasyParcel ON + product có weight WHEN buyer nhập địa chỉ THEN thấy phí ship thật của courier shop chọn + ETA (1 dòng, không chọn courier).
2. GIVEN tenant OFF THEN checkout hiện flat West/East như cũ (không vỡ).
3. GIVEN buyer đặt hàng THEN order lưu đúng shippingCourier (courier shop chọn) + serviceId + shippingFee (RM-float).
4. GIVEN EasyParcel rate API timeout THEN fallback flat rate, checkout không chặn.
5. GIVEN giá EasyParcel RM8 THEN compute nội bộ = 800 sen, order.shippingFee lưu = 8.00 (RM-float); KHÔNG lưu 800 vào shippingFee.

---

**Non-Functional Requirements (Wave 7)**

Wave 7 NFRs are defined in [`docs/prd/F36-easyparcel-delivery.md §6`](./F36-easyparcel-delivery.md#6-non-functional-requirements-shared). Key items affecting checkout/rates:

- **NFR-1:** sen↔RM conversion (P0) — critical for rate accuracy
- **NFR-3:** API key per-merchant; auth + IDOR check; no key leak
- **NFR-4:** Hybrid fallback (P0) — error → flat rate, no checkout break
- **NFR-6:** Rate API p95 < 4s; timeout → fallback
- **NFR-9:** Schema: new columns → `scripts/db-setup.js` MIGRATIONS; CI gate
- **NFR-10:** Buyer-safe projection — public endpoints mask `labelUrl`, `easyParcelOrderNo`, `codAmount` (seller only)

See full NFR list and resolved questions (warehouse sync, COD settlement, reverse labels, state code mapping, weight/dims precision) in the shared overview document.
