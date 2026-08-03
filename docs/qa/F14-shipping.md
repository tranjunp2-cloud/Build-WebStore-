# QA Test Plan — F14 Shipping (Malaysia)

> **Version:** 2.6 | **Updated:** 2026-07-29 (GH-1684 mobile/tablet shipping-label canvas + desktop native-viewer regression) | **Owner:** QA Team
> **PRD ref:** [`docs/prd/F14-shipping.md`](../prd/F14-shipping.md) v1.2
> **Stories ref:** [`docs/stories/F14-shipping-stories.md`](../stories/F14-shipping-stories.md) (US-F14-01..06)
> **Architecture ref:** [`docs/architecture/F14-shipping.md`](../architecture/F14-shipping.md)
> **Design ref:** [`docs/design/F14-shipping-design.md`](../design/F14-shipping-design.md)

### Changelog
- **v2.6 (2026-07-29)** — Preserve the deployed native PDF viewer on desktop; add GH-1684 mobile/tablet canvas coverage for carrier soft-mask barcodes/QR codes and responsive-modal coverage across desktop, Android, iPhone, and iPad.
- **v2.5 (2026-05-15)** — Dịch tiếng Việt toàn bộ section 3.13–3.15 (TC-F14.57..123b), Quality Gates, Traceability Matrix, Self-Check, Implementation Status. Giữ nguyên TC-ID, mã code, HTTP status, FR/BR/AC references.
- **v2.4 (2026-05-15)** — Thêm TC-F14.117..123b (8 TC mới): integration race PATCH↔POST shared-state (read-after-write + interleave + concurrent), hợp đồng email tracking plain-text BR-09 self-delivery (không `<a href>` trừ khi có trackingUrl, ký tự đặc biệt render nguyên vẹn, status không phải shipped thì không có khối tracking). Thêm Playwright project `qa-f14` trỏ `https://web-cms-v2.dev.ecommercehub.my`.
- **v2.3 (2026-05-15)** — Thêm TC-F14.80..116 (37 TC mới): i18n state có dấu/Ả Rập, edge config, lỗ hổng body/input POST, lỗ hổng auth PATCH, error/shape GET, hợp đồng constants ở mức yêu cầu, hint.gap sanity US-F14-06 AC-3, error shape internal POST.
- **v2.2 (2026-05-14)** — Added TC-F14.57..79 (25 new TCs from recheck): large subtotal, negative pass-through, case/whitespace state, concurrent PATCH, boundary precision, GET integer sen.
- **v2.1 (2026-05-13)** — Initial 56 manual TCs + 15 Playwright specs.

---

## 1. Objective

Đảm bảo F14 Shipping (Self-delivery flat-rate) hoạt động đúng PRD v1.2 cho 6 stories và 12 FRs. Bộ test suite **124 manual/automated TCs + 15 Playwright E2E specs + qa-f14 staging project** phủ:

- Classification West/East MY (16 states + Labuan boundary)
- Flat-rate calculation (West RM 8 / East RM 15 default)
- Free shipping threshold (boundary inclusive, null edge)
- Seller settings CRUD + validation (0..RM 1,000)
- Live recalc on state change (debounce 300ms, no reload)
- Postcode validation (regex `^\d{5}$`, format only)
- Reset to Defaults (rollback default config)
- Mobile UX (numpad, vertical stack, tap target ≥ 44px)
- Self-delivery flow (tracking number free-text, no carrier API)
- Edge cases (subtotal=0, freeAbove=null, missing state)

> **Out of Scope Wave 6:** Multi-seller cart isolation, carrier integration (EasyParcel, J&T, Pos Laju), auto label/tracking URL, estimated delivery days, multi-currency, postcode cross-check state.

---

## 2. Test Environment

| Item | Spec |
|---|---|
| Env | Staging + localhost với test tenant đã seed shippingConfig |
| Roles | Seller (tenant owner/admin), Buyer (guest + logged), Admin |
| Devices | Mobile 375px, Tablet 768px, Desktop 1440px |
| Browsers | Chrome v110+, Safari Latest, Firefox |
| Currency | MYR only |
| Test data | 16 MY states list, postcode samples, subtotal edge values (0, 99.99, 100, 100.01, 999999) |

---

## 3. Test Cases (Traceability Matrix)

Format: `TC-F14.NN | Type | Priority | Title | Steps | Expected | FR/BR/AC refs`

Legend: **Type** = `Func` (functional) / `UI` / `Sec` (security/validation) / `Edge` / `Mobile` / `Live` (real-time) | **Priority** = `Blocker` / `Critical` / `High` / `Medium`

---

### 3.1 State Classification (West vs East)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.01** | Func | Blocker | Dropdown hiển thị đầy đủ 16 states + 3 territories | 1. Mở Checkout form. 2. Click dropdown State. | Hiển thị 16 lựa chọn theo thứ tự alphabet: Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Sabah, Sarawak, Selangor, Terengganu, W.P. Kuala Lumpur, W.P. Putrajaya, W.P. Labuan. | FR-01, AC-3 |
| **TC-F14.02** | Func | Critical | Classify all 13 West MY states → RM 8 | Test mỗi state: Johor, Kedah, Kelantan, Melaka, N.Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Selangor, Terengganu, KL, Putrajaya. Subtotal RM 50. | Mỗi state hiển thị shipping = RM 8.00 (default westRate). | FR-02, BR-01, AC-1 |
| **TC-F14.03** | Func | Critical | Classify 2 East MY states (Sabah, Sarawak) → RM 15 | Test với Sabah và Sarawak. Subtotal RM 50. | Shipping = RM 15.00 (default eastRate). | FR-02, BR-02, AC-2 |
| **TC-F14.04** | Edge | High | Labuan (Federal Territory) classify East MY | Chọn W.P. Labuan. Subtotal RM 50. | Shipping = RM 15.00. KHÔNG nhầm West MY. | BR-02 |
| **TC-F14.05** | Edge | High | State trống/invalid → error | 1. Để trống state. 2. Click Pay/Continue. | Error inline "Please select a valid state". Submit bị chặn. Không tạo order. | FR-01 |

---

### 3.2 Shipping Calculation

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.06** | Func | Critical | Flat rate — multi items không nhân theo quantity | Cart có 5 sản phẩm cùng seller, tổng RM 200, state Selangor. | Shipping = RM 8 (flat, không phải RM 40). | FR-02 |
| **TC-F14.07** | Func | Critical | Order summary breakdown đúng format | Subtotal RM 50, state KL, SST 6%. | Hiển thị: Subtotal RM 50.00, Shipping RM 8.00, SST (6%) RM 3.00 (chỉ trên subtotal, không phải subtotal+ship), Total RM 61.00. | FR-03, BR-05 |
| **TC-F14.08** | Sec | High | SST KHÔNG tính trên shipping fee | Subtotal RM 100, state Sabah, SST 6%. | SST = RM 6.00 (= 100 × 6%), KHÔNG phải RM 6.90 (= 115 × 6%). Total = 100 + 15 + 6 = RM 121.00. | BR-05 |

---

### 3.3 Free Shipping Threshold

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.09** | Func | Critical | Free khi subtotal vượt threshold | Seller config `freeAbove=10000` (RM 100). Subtotal RM 150, state Selangor. | Shipping = RM 0. Badge "🎉 Free Shipping" hoặc tương đương. | FR-04, BR-06 |
| **TC-F14.10** | Edge | Critical | **Boundary inclusive** — subtotal = threshold | freeAbove=10000. Subtotal **đúng** RM 100. | Shipping = RM 0 (vì `subtotal >= freeAbove`). | FR-04, BR-06 |
| **TC-F14.11** | Edge | High | Subtotal đúng RM 99.99 vs RM 100.00 | A: subtotal 9999 sen. B: subtotal 10000 sen. | A: ship = RM 8. B: ship = RM 0. Sai 1 sen → khác kết quả. | FR-04, BR-06 |
| **TC-F14.12** | Func | High | Hint 3-tier display logic | A: gap > RM 50 → text neutral "Add RM X more". B: gap ≤ RM 50 → highlight color. C: reached → badge "Free Shipping". | UI render đúng 3 tier như design §8.3. | FR-05 |
| **TC-F14.13** | Edge | High | `freeAbove = null` → never free | Seller toggle free shipping OFF (DB lưu freeAbove=null). Subtotal RM 9999. | Shipping luôn theo region (West RM 8 / East RM 15), KHÔNG có badge Free. | BR-06 |

---

### 3.4 Seller Settings (CMS Dashboard)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.14** | UI | High | Trang Settings hiển thị đúng default | Seller mới (chưa từng edit). Vào `/dashboard/settings/shipping`. | Default values: West = RM 8.00, East = RM 15.00, Free Shipping toggle ON, freeAbove = RM 100. Khớp BR-07. | FR-06, BR-07 |
| **TC-F14.15** | Func | Critical | Save settings thành công | Đổi West = RM 10, East = RM 20, freeAbove = RM 150. Save. | Toast "Shipping settings saved!". DB site.shippingConfig update: westRate=1000, eastRate=2000, freeAbove=15000. | FR-06 |
| **TC-F14.16** | Func | High | Setting áp dụng ngay storefront | Sau TC-F14.15, mở storefront checkout. | West states ship = RM 10, East = RM 20. | FR-06 |
| **TC-F14.17** | Sec | High | Validate rate âm | West rate = -5 hoặc -100. Save. | Inline error "Shipping rate must be ≥ 0". DB không update. | FR-08, BR-04 |
| **TC-F14.18** | Edge | Medium | Rate = 0 cho phép (free toàn shop) | West rate = 0, East rate = 0. Save. | Save OK. Checkout cả 2 region đều ship RM 0 (không depend free threshold). | FR-08, BR-04 |
| **TC-F14.19** | Sec | High | Rate vượt 100,000 sen (RM 1,000) reject | West rate = 100001 hoặc RM 1,000.01. Save. | Inline error "Shipping rate cannot exceed RM 1,000". DB không update. | FR-08, BR-04 |
| **TC-F14.20** | Edge | High | Rate đúng biên 100,000 sen | West rate = exactly RM 1,000 (100000 sen). Save. | Save OK (`<=` inclusive). | FR-08, BR-04 |
| **TC-F14.21** | Func | High | Reset to Defaults | Sau khi edit về RM 99/99/null/OFF, click "Reset to Defaults". | Form về west=800, east=1500, freeAbove=10000, toggle=ON. Save xong DB khớp BR-07. KHÔNG dùng null cho freeAbove. | FR-12, BR-07 |
| **TC-F14.22** | Sec | Critical | Non-tenant không edit được | User chưa login hoặc không thuộc tenant gọi `PATCH /api/sites/:siteId/shipping-config`. | HTTP 401 hoặc 403. Settings unchanged. | FR-06 (auth) |

---

### 3.5 Checkout Live Recalc

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.23** | Live | Critical | Đổi state West → East, fee auto update | Đang ở Selangor (ship RM 8). Đổi sang Sabah. | Sau ~300ms (debounce), shipping auto cập nhật RM 15, total recalc. KHÔNG reload page. | FR-09 |
| **TC-F14.24** | Live | High | Debounce 300ms — gõ liên tục không spam API | Đổi state liên tục 5 lần trong 1s. | Chỉ 1 API call sau khi user dừng 300ms. Network tab confirm. | FR-09 |
| **TC-F14.25** | UI | High | Loading state khi đang recalc | Trigger state change. | Shipping text mờ nhẹ hoặc spinner xuất hiện cho đến khi fee mới về. | Design §10.4 |

---

### 3.6 Postcode Validation

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.26** | Func | High | Postcode 5 chữ số valid | Nhập 50480, 88300, 93100. | Pass validation. Form submit được. | FR-11, BR-08 |
| **TC-F14.27** | Sec | High | Postcode reject format sai | Nhập "abc12", "1234" (4 digits), "123456" (6 digits), empty. | Inline error "Postcode must be 5 digits". Submit blocked. | FR-11, BR-08 |
| **TC-F14.28** | Edge | Medium | Postcode KHÔNG cross-check với state | Selangor + postcode 88300 (Sabah). | Vẫn pass validation (chỉ check format `^\d{5}$`). PRD v1.2 không cross-check. | BR-08 |

---

### 3.7 Edge Cases

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.29** | Edge | Medium | Subtotal = 0 vẫn tính ship | Cart có item promo giảm 100% → subtotal = 0. State East MY. | Shipping = RM 15 (East rate). Total = RM 15. KHÔNG phải RM 0. | FR-10, BR-06 |
| **TC-F14.30** | Edge | Medium | Subtotal = 0 + freeAbove threshold | Subtotal = 0, freeAbove = RM 100. | Shipping vẫn RM 15 vì 0 < 100. | FR-10 |
| **TC-F14.31** | Edge | Medium | Currency hiển thị đúng format MYR | Subtotal RM 999.99, ship RM 8. | Format hiển thị "RM 999.99", "RM 8.00" (2 chữ số thập phân, có space sau RM). | FR-03 |

---

### 3.8 Mobile UX (375px)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.32** | Mobile | High | Postcode dùng numpad | Mở Checkout trên iPhone 375px. Click input Postcode. | Bàn phím số (`inputmode="numeric"`) hiện, KHÔNG phải bàn phím chữ. | FR-07, US-F14-03 |
| **TC-F14.33** | Mobile | High | Form fields stack vertical + tap target ≥ 44px | Viewport 375px. Đo height của state dropdown, postcode input, save button. | Tất cả form fields stack dọc. Mỗi tap target có height ≥ 44px (`min-h-[44px]`). | FR-07 |
| **TC-F14.34** | Mobile | Medium | Shipping Settings responsive Mobile | Seller mở `/dashboard/settings/shipping` trên 375px. | Form không tràn ngang. Inputs full-width. Save button đủ rộng để chạm. | FR-07, TC-F14.16 cũ |

---

### 3.9 Self-Delivery Model (BR-09)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.35** | Func | Medium | Tracking number = free-text, không validate | Seller vào Order detail, nhập trackingNumber="abc-123-XYZ-!@#". Save. | Save OK. DB lưu raw string. KHÔNG có format validation, KHÔNG call carrier API. | BR-09 |
| **TC-F14.36** | UI | Medium | Email "Shipped" hiển thị tracking number plain text | Order đổi status → Shipped. Email gửi buyer. | Email chứa tracking number plain text, KHÔNG có link clickable, KHÔNG có carrier logo. | BR-09 |

---

### 3.10 API-Level Tests (HTTP)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.37** | API | Critical | `GET /api/sites/:siteId/shipping-config` happy | Curl GET với valid siteId. | HTTP 200 + body `{success:true, data:{westRate, eastRate, freeAbove}}`. Số ở dạng sen (integer). | Arch §6.1 |
| **TC-F14.38** | API | High | GET shipping-config — site không tồn tại | GET với siteId invalid (vd `xxx-not-exist`). | HTTP 404 + `{success:false, error:{code:'SITE_NOT_FOUND', message}}`. | Arch §6.1, §9 |
| **TC-F14.39** | API | Critical | `PATCH /api/sites/:siteId/shipping-config` happy | Auth tenant member. PATCH `{westRate:1000, eastRate:2000, freeAbove:15000}`. | HTTP 200 + updated data. DB write confirm. | Arch §6.2 |
| **TC-F14.40** | API | Critical | PATCH — VALIDATION_ERROR cho rate out of range | PATCH `{westRate:-1}` hoặc `{westRate:100001}`. | HTTP 400 + `{code:'VALIDATION_ERROR', fields:{westRate:'out_of_range'}}`. DB không đổi. | Arch §6.2, §8 |
| **TC-F14.41** | Sec | Critical | PATCH cross-tenant attack — FORBIDDEN | Login tenant A. PATCH siteId thuộc tenant B. | HTTP 403 + `{code:'FORBIDDEN', message:'Not a member of this site'}`. Tenant B's config UNCHANGED. | Arch §6.2, §11 |
| **TC-F14.42** | Sec | High | PATCH unauthenticated | PATCH không có session cookie / token. | HTTP 401 hoặc 403. DB không đổi. | Arch §6.2 |
| **TC-F14.43** | API | Critical | `POST /api/orders/calculate-shipping` happy | Body `{siteId, state:'Selangor', subtotalSen:5000}`. | HTTP 200 + body `{success:true, data:{fee:800, rates:[{priceSen:800}], isFree:false, region:'west', hint:{tier, gap}}}`. | Arch §6.3 |
| **TC-F14.44** | API | High | POST calc — region field correct cho East | Body `{siteId, state:'Sabah', subtotalSen:5000}`. | Response `data.region === 'east'`, flat legacy `data.fee === 1500`, `data.rates[0].priceSen === 1500`. | Arch §6.3, §7 |
| **TC-F14.45** | API | High | POST calc — INVALID_STATE | Body `{siteId, state:'Tokyo', subtotalSen:5000}`. | HTTP 400 + `{code:'INVALID_STATE', message:'Invalid Malaysia state'}`. | Arch §6.3, §9 |
| **TC-F14.46** | API | High | POST calc — NOT_FOUND | Body `{siteId:'invalid', state:'Selangor', subtotalSen:5000}`. | HTTP 404 + `{code:'NOT_FOUND'}`. | Arch §6.3 |
| **TC-F14.47** | Sec | Medium | POST calc — rate limit 20/min/siteId | Gửi 21 requests trong 1 phút với cùng `siteId`. | Request thứ 21 → HTTP 429 với mã `RATE_LIMITED`. Requests của `siteId` khác không bị tính chung. | Arch §6.3, §11 |
| **TC-F14.48** | API | High | POST calc — hint object shape đúng | Body `{siteId, state:'Selangor', subtotalSen:7000}` (freeAbove=10000, gap=3000). | Response `data.hint = {tier:'highlight', gap:3000}` (gap ≤ 5000 → highlight tier). | Arch §6.3, §7 (HINT_HIGHLIGHT_THRESHOLD) |
| **TC-F14.49** | API | Medium | POST calc — hint null khi đã free | Body `subtotalSen >= freeAbove`. | Response `data.isFree=true, hint=undefined` (hoặc null/không có). | Arch §6.3 |

---

### 3.11 Stories AC Gaps (US-F14-05 AC-3, US-F14-06 AC-2/3)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.50** | Live | Critical | Network error retry với auto-retry 1x | 1. Mock POST `/calculate-shipping` return 500. 2. Buyer change state. | Toast "Failed to calculate shipping. Retry?" hiện. Auto-retry sau 1s (exponential backoff). Nếu fail tiếp → manual retry button. | US-F14-05 AC-3 |
| **TC-F14.51** | UI | Critical | Place Order disabled khi shipping fee chưa tính được | API calc đang fail. | Place Order button DISABLED (gray, không click được). Tooltip "Shipping must be calculated first". | US-F14-05 AC-3 |
| **TC-F14.52** | Edge | High | Subtotal=0 + freeAbove=0 → FREE | Cart promo 100% → subtotal=0. Seller config freeAbove=0. State Sabah. | Shipping fee=0, isFree=true, badge "🎉 FREE SHIPPING APPLIED" hiển thị (vì 0 >= 0 inclusive). | US-F14-06 AC-2, BR-06 |
| **TC-F14.53** | Edge | High | Hint KHÔNG sinh "Add RM 0 more" hoặc NaN | Subtotal=0, threshold=100. State West. | Hint = "Add RM 100 more for FREE shipping" (tier neutral). KHÔNG hiện "Add RM 0 more" hoặc NaN. Console không error. | US-F14-06 AC-3 |

---

### 3.12 Database & Migration

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.54** | Func | High | Migration backfill freeAbove=10000 cho sites cũ | 1. Site existing có `freeAbove=null`. 2. Run `scripts/db-setup.js` migration. | Site row update: `freeAbove=10000` (BR-07 default). Sites đã có giá trị custom KHÔNG bị overwrite. | Arch §10, BR-07 |
| **TC-F14.55** | Edge | Medium | Default values seed match SHIPPING_DEFAULTS constant | New site tạo lần đầu. Check DB `sites.shippingConfig`. | `westRate=800, eastRate=1500, freeAbove=10000`. Khớp `SHIPPING_DEFAULTS` trong `lib/shipping/constants.ts`. | Arch §7, BR-07 |
| **TC-F14.56** | Edge | Medium | Order DB lưu shippingFee = giá trị từ calc | Place order với state Sabah, subtotal 5000 sen. | DB row `orders.shippingFee = 1500`, NOT hardcoded 10 hay 1000. | FR-02, FR-09 |
| **TC-F14.57** | Unit | High | saveSiteSchema chấp nhận freeAbove=1 sen (minimum) | `saveSiteSchema.safeParse({ shippingConfig: { freeAbove: 1 } })` | `success=true`. RM 0.01 là giá trị hợp lệ thấp nhất. | FR-04, BR-06 |
| **TC-F14.58** | Unit | Critical | saveSiteSchema từ chối freeAbove âm | `saveSiteSchema.safeParse({ shippingConfig: { freeAbove: -1 } })` | `success=false`. Ngăn exploit free-shipping-for-all qua save endpoint. | FR-04, BR-06 |
| **TC-F14.59** | Unit | High | saveSiteSchema từ chối freeAbove > 10_000_000 sen | `saveSiteSchema.safeParse({ shippingConfig: { freeAbove: 10_000_001 } })` | `success=false`. Consistent với giới hạn RM 100,000 ở route shipping-config. | FR-04, BR-06 |

---

### 3.13 Edge case Unit & API (thêm v2.2 — 2026-05-14)

> **File nguồn:** `src/__tests__/unit/lib/shipping/calculate-fee.test.ts` + `src/__tests__/api/orders-calculate-shipping.test.ts` + `src/__tests__/api/sites-shipping-config.test.ts`

#### Edge cases unit cho `getShippingRate`

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|---|---|---|---|---|---|
| **TC-F14.57** | Edge | Medium | Subtotal `99_999_999` sen (cận max-safe) | Không overflow, phí = west rate | FR-02 |
| **TC-F14.58** | Edge | Medium | Subtotal âm pass-through (hợp đồng layer unit) | Không throw, vẫn tính phí (layer API chặn 422 ở trên) | FR-02 |
| **TC-F14.59** | Edge | High | `freeAbove=0` + subtotal=0 → phí=0 (inclusive `>=`) | Trả về 0 (miễn phí) | BR-06 |
| **TC-F14.60** | Edge | Medium | Case-sensitive lower/UPPER/khoảng trắng → west fallback | Unit tính west rate phòng vệ; API reject strict | FR-02 |
| **TC-F14.61** | Edge | Medium | Synonym "Pulau Pinang" không canonical → west fallback | Trả về west rate | BR-01 |
| **TC-F14.62** | Edge | High | `config=null` + Labuan → default eastRate=1500 | Trả về 1500 | BR-02, BR-07 |
| **TC-F14.63** | Edge | Medium | `config.freeAbove` không có (undefined) → bỏ qua check free | Luôn tính phí | BR-06 |
| **TC-F14.64** | Edge | Medium | `westRate=0 + eastRate=0` → free toàn shop | Trả về 0 | BR-04 |

#### Edge cases POST `/api/orders/calculate-shipping`

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|---|---|---|---|---|---|
| **TC-F14.65** | API | Medium | subtotalSen=99_999_999 (max-safe) | 200, phí đúng, không overflow | Arch §6.3 |
| **TC-F14.66** | API | Medium | State viết thường `"selangor"` | 400 INVALID_STATE | Arch §6.3 |
| **TC-F14.67** | API | Medium | State có khoảng trắng `" Selangor "` | 400 INVALID_STATE | Arch §6.3 |
| **TC-F14.68** | API | Medium | 2 POST đồng thời cùng site | Cả 2 đều 200, độc lập | Arch §6.3 |
| **TC-F14.69** | API | High | subtotalSen=0 + freeAbove=0 | 200, phí=0, isFree=true | BR-06 |
| **TC-F14.70** | API | Medium | siteId định dạng UUID hợp lệ | 200 | Arch §6.3 |
| **TC-F14.71** | API | High | `enabled=false` → phí=0 NHƯNG isFree=false (phân biệt với free threshold) | Phân biệt được 2 trạng thái | BR-09 |

#### Edge cases PATCH `/api/sites/:siteId/shipping-config`

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|---|---|---|---|---|---|
| **TC-F14.72** | API | Medium | westRateRm="8.005" → `Math.round(0.5)` = 801 sen | 200, lưu 801 sen | Arch §8 |
| **TC-F14.73** | API | Medium | westRateRm="8.99" → 899 sen | 200, lưu 899 sen | Arch §8 |
| **TC-F14.74** | API | High | westRateRm="1000.00" đúng biên max | 200, lưu 100_000 sen | BR-04 |
| **TC-F14.75** | API | High | westRateRm="1000.01" → 422 (vượt biên 1 sen) | 422 VALIDATION_ERROR | BR-04 |
| **TC-F14.76** | API | Medium | 2 PATCH đồng thời → cả 2 đều 200, last-write-wins | Cả 2 thành công | Arch §11 |
| **TC-F14.77** | API | Low | Body có field lạ → bỏ qua, không lỗi | 200 | Arch §6.2 |
| **TC-F14.78** | API | Medium | Content-Type text/plain (parse fail) | 400 VALIDATION_ERROR | Arch §6.2 |

#### GET `/api/sites/:siteId/shipping-config`

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|---|---|---|---|---|---|
| **TC-F14.79** | API | High | GET trả về shippingConfig dạng integer sen (không phải RM decimal) | Mọi value đều `Number.isInteger` | Arch §6.1 |

---

### 3.14 Edge case & Contracts (thêm v2.3 — 2026-05-15)

> **Phạm vi coverage:** bug validation body/input, edge auth, i18n, hợp đồng constants ở mức yêu cầu, kiểm tra hint khi subtotal=0.

#### Hợp đồng config + i18n cho `getShippingRate`

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|---|---|---|---|---|---|
| **TC-F14.80** | Edge | Medium | `config.enabled=null` (null tường minh, không phải false) | Coi như đang bật, vẫn tính phí | BR-06 |
| **TC-F14.81** | Edge | Low | subtotalSen = `Number.MAX_SAFE_INTEGER` | Không overflow, phí = west rate | FR-02 |
| **TC-F14.82** | Edge | High | `config.freeAbove=null` (tường minh) → không bao giờ free | Luôn tính phí, kể cả ở 99_999_999 sen | BR-06 |
| **TC-F14.83** | Edge | Low | State có dấu `"Sélangor"` | Fallback west (không trong east list) | FR-01 |
| **TC-F14.84** | Edge | Low | State chữ Ả Rập | Fallback west | FR-01 |

#### Lỗ hổng body/input POST `/api/orders/calculate-shipping`

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|---|---|---|---|---|---|
| **TC-F14.85** ⚠ | API | **Critical** | Body = JSON `null` (bug, đã thống nhất không fix) | **Đáng lẽ phải 400 VALIDATION_ERROR** — hiện trả về 500 (TypeError destructure null) | Arch §6.3 |
| **TC-F14.86** | API | High | siteId độ dài 101 (vượt max 100) | 400 VALIDATION_ERROR | Arch §6.3 |
| **TC-F14.87** | API | High | siteId="" (chuỗi rỗng) | 400 VALIDATION_ERROR | Arch §6.3 |
| **TC-F14.88** | API | Medium | state=null (không phải string) | 400 INVALID_STATE | Arch §6.3 |
| **TC-F14.89** | API | High | subtotalSen="5000" (string số, không phải number) | 400 VALIDATION_ERROR | Arch §6.3 |
| **TC-F14.90** | API | High | `enabled=false` ẩn hint ngay cả khi subtotal<freeAbove | hint=undefined | FR-05 |
| **TC-F14.91** | API | Medium | `enabled=null` (null tường minh) → isFree có thể áp dụng | 200, isFree=true nếu subtotal≥freeAbove | BR-06 |
| **TC-F14.92** | API | Medium | site.shippingConfig=undefined → áp default | phí=800 (default west) | BR-07 |
| **TC-F14.93** | API | Medium | 10 POST đồng thời, mixed region | Tất cả 200 độc lập | Arch §6.3 |
| **TC-F14.94** | API | High | Race seller-PATCH → buyer-POST: mỗi POST đọc snapshot tại thời điểm findByID của chính nó | Xác nhận semantic snapshot | Arch §11 |

#### Lỗ hổng auth + body + boundary PATCH `/api/sites/:siteId/shipping-config`

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|---|---|---|---|---|---|
| **TC-F14.95** ⚠ | API | **Critical** | PATCH body = JSON `null` (bug, đã thống nhất không fix) | **Đáng lẽ phải 400 VALIDATION_ERROR** — hiện trả về 500 (TypeError destructure null) | Arch §6.2 |
| **TC-F14.96** | Sec | High | Role super-admin bypass tenant check → 200 trên site tenant khác | Bypass auth cho super-admin | Arch §11 |
| **TC-F14.97** | Sec | High | `user.tenants=undefined` + không phải super-admin → 403 | FORBIDDEN, không crash | Arch §11 |
| **TC-F14.98** | Sec | High | Site row thiếu field `tenant` (legacy/malformed) → 403 | FORBIDDEN | Arch §11 |
| **TC-F14.99** | Sec | High | `user.tenants[i].tenant` dạng object đã populate → 200 | Trích `.id` đúng | Arch §11 |
| **TC-F14.100** | API | Medium | westRateRm="1e2" (ký hiệu khoa học) | 200, lưu 10_000 sen | Arch §8 |
| **TC-F14.101** | API | High | freeAboveRm="100000.00" (biên max inclusive) | 200, lưu 10_000_000 sen | BR-04 |
| **TC-F14.102** | API | Medium | freeAboveRm="0.01" (biên min inclusive) | 200, lưu 1 sen | BR-06 |
| **TC-F14.103** | API | High | `enabled="true"` (string, không phải boolean) | 400 VALIDATION_ERROR | Arch §6.2 |
| **TC-F14.104** | API | Medium | `enabled=1` (number, không phải boolean) | 400 VALIDATION_ERROR | Arch §6.2 |
| **TC-F14.105** | API | High | `payload.update` throw → 500 INTERNAL_ERROR (catch, không crash) | Error cascade được xử lý | Arch §6.2 |
| **TC-F14.108** | API | Low | westRateRm=" 8.00 " (có khoảng trắng) → JS Number tự trim | 200, lưu 800 sen (document quirk) | Arch §8 |
| **TC-F14.109** | API | Medium | PATCH idempotent: 2 body giống nhau → cả 2 đều 200 | Không phân kỳ side-effect | Arch §11 |
| **TC-F14.110** | API | High | westRateRm="abc" (không phải số) → NaN bị reject | 422 VALIDATION_ERROR | BR-04 |

#### GET `/api/sites/:siteId/shipping-config` — error & shape

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|---|---|---|---|---|---|
| **TC-F14.106** | API | Medium | GET `payload.findByID` throw → 404 NOT_FOUND | `.catch(()=>null)` resilient | Arch §6.1 |
| **TC-F14.107** | API | Medium | Site không có field `shippingConfig` → 200 với `data.shippingConfig=null` | Coalesce `?? null` | Arch §6.1 |

#### Hợp đồng constants ở mức yêu cầu (regression guards)

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|---|---|---|---|---|---|
| **TC-F14.111** | Func | High | `SHIPPING_DEFAULTS` khớp spec BR-07 | `{westRate:800, eastRate:1500, freeAbove:10000}` chính xác | BR-07 |
| **TC-F14.112** | Func | High | `MY_STATES` chứa đúng 16 bang/lãnh thổ Malaysia | Length 16, đủ tên expected | FR-01 |
| **TC-F14.113** | Func | Medium | Hợp đồng `WEST_MY_STATES`: 13 bang West MY | Length 13, có Penang/KL/Putrajaya; loại trừ East | BR-01 |
| **TC-F14.114** | Func | Medium | Hợp đồng `EAST_MY_STATES`: chỉ Sabah, Sarawak, Labuan | Length 3, đúng tên | BR-02 |

#### Tính nhất quán hint & error shape

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|---|---|---|---|---|---|
| **TC-F14.115** | API | High | hint.gap khi subtotalSen=0 + freeAbove=10000 | hint.gap=10000 (số nguyên dương, KHÔNG phải 0 hay NaN), tier=neutral | US-F14-06 AC-3 |
| **TC-F14.116** | API | Medium | POST `findByID` throw → 404 NOT_FOUND (POST resilient hơn PATCH) | Document hành vi POST `.catch(()=>null)` | Arch §6.3 |

> **⚠ Tests đang fail (đã chấp nhận, không fix):** TC-F14.85 + TC-F14.95 — route POST/PATCH destructure `body` trước khi check null → TypeError → 500. Đáng lẽ phải trả 400. Quyết định: giữ làm hợp đồng đã document; không block release.

---

### 3.15 Integration shared-state + Email (thêm v2.4 — 2026-05-15)

> **File nguồn:** `src/__tests__/integration/f14-shipping-race.test.ts` + `src/__tests__/unit/lib/email/order-status-tracking.test.ts`

#### Race shared-state (siteStore in-memory, mô phỏng read-after-write thật)

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|---|---|---|---|---|---|
| **TC-F14.117** | Integration | High | PATCH ghi rate mới → POST kế tiếp trả rate mới (read-after-write) | POST trước=800, POST sau=1200 | Arch §11 |
| **TC-F14.118** | Integration | High | Xen kẽ POST-PATCH-POST: mỗi POST thấy state mới nhất đã commit | POST1=1500, PATCH freeAbove=4000, POST2=0 (free) | Arch §11 |
| **TC-F14.119** | Integration | Medium | POST đồng thời quanh 1 PATCH: thứ tự phản ánh đúng vào lần đọc store | Mỗi POST trả về HOẶC giá cũ (800) HOẶC giá mới (2000) — không bao giờ giá trị sai khác | Arch §11 |

#### Email tracking self-delivery (BR-09)

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|---|---|---|---|---|---|
| **TC-F14.120** | Func | High | BR-09: shipped + chỉ có trackingNumber (không URL) → text thuần, KHÔNG có `<a href>` | Tracking hiển thị plain; không link, không logo carrier | BR-09 |
| **TC-F14.121** | Func | Medium | shipped + trackingNumber + trackingUrl → render `<a href>` (hỗ trợ carrier sau này) | Có link, URL attribute đúng | BR-09 |
| **TC-F14.122** | Func | Medium | BR-09: trackingNumber free-text ký tự đặc biệt (`abc-123-XYZ-!@#`) render nguyên vẹn | Không validate format; giữ raw string trong HTML | BR-09 |
| **TC-F14.123** | Edge | Low | Status khác shipped (processing/delivered/cancelled) → không hiện khối tracking dù có trackingNumber | Tracking chỉ render khi `status==='shipped'` | BR-09 |
| **TC-F14.123b** | Edge | Low | Shipped KHÔNG có trackingNumber → không hiện khối tracking (seller được dispatch không cần số) | Khối tracking rỗng, không lỗi | BR-09 |

---

### 3.16 EasyParcel Allowlist + Auto-Cheapest (F36, GH-1333 Phase 06)

**[DEPRECATED 2026-07-01]** Merchant courier selection via allowlist (`selectedCouriers[]`) has been REMOVED. Checkout now auto-picks the cheapest courier that serves the route (no user selection). TC-F14.124–F14.144 below are OBSOLETE. See GH-1333 (F36) for new auto-cheapest behavior.

---

#### ~~Coalesce Helper Tests (getAllowedCouriers)~~ [DEPRECATED]

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.124** | Unit | High | `selectedCouriers:['jnt','flash']` array present → `['jnt','flash']` | Import `getAllowedCouriers(ep)`, ep={selectedCouriers:['jnt','flash']} | Return `['jnt','flash']` | F36, GH-1333 |
| **TC-F14.125** | Unit | High | Legacy only `selectedCourier:'flash'`, no array → `['flash']` | ep={selectedCourier:'flash', warehouses:[]} (no selectedCouriers) | Return `['flash']` | F36, GH-1333 |
| **TC-F14.126** | Unit | High | Neither array nor legacy set → `[]` | ep={warehouses:[], accessToken:'tok'} (no courier fields) | Return `[]` | F36, GH-1333 |
| **TC-F14.127** | Unit | High | Array wins when BOTH present | ep={selectedCouriers:['jnt'], selectedCourier:'flash'} | Return `['jnt']` (array priority) | F36, GH-1333 |
| **TC-F14.128** | Unit | Medium | Array with whitespace/empty entries → trimmed + deduped | ep={selectedCouriers:['  jnt  ', '', 'jnt', 'flash']} | Return `['jnt','flash']` (trim, filter empty, dedupe) | F36, GH-1333 |

#### Readiness Gate (isEpReady)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.129** | Unit | High | isEpReady true when token + warehouse + ≥1 courier (array) | isEpReady({accessToken:'tok', warehouses:[completeWh], selectedCouriers:['jnt','flash']}) | true | F36, GH-1333 |
| **TC-F14.130** | Unit | High | isEpReady false when allowlist length=0 (empty array) | isEpReady({accessToken:'tok', warehouses:[completeWh], selectedCouriers:[]}) | false (no courier allowed) | F36, GH-1333 |

#### getRates Cheapest + COD Logic

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.131** | Unit | High | Allowlist `['jnt','flash']`, route offers both → pick cheaper only, `degraded:false`, `rates.length===1` | Mock quotations→{jnt:RM50, flash:RM40}, allowedCouriers=['jnt','flash'], codAmountSen=0 | rates=[{courier:'flash', priceSen:4000}], degraded:false | F36, GH-1333 |
| **TC-F14.132** | Unit | High | Allowlist `['dhl']`, route offers only `['jnt','flash']` → flat fallback, `degraded:true` | allowedCouriers=['dhl'], quotations→{jnt:RM50, flash:RM40} | rates=[{courier:'flat', degraded:true}], degraded:true | F36, GH-1333 |
| **TC-F14.133** | Unit | High | Empty/absent allowlist → cheapest of ALL (not rates[0]), `degraded:false` | allowedCouriers=undefined, quotations→{jnt:RM50, flash:RM40} | rates=[{courier:'flash', priceSen:4000}], degraded:false (cheapest regardless order) | F36, GH-1333 |
| **TC-F14.134** | Unit | High | COD order (`codAmountSen>0`), both allowed, only `flash.codAvailable` → returns `flash` even if `jnt` cheaper | codAmountSen=1000, allowedCouriers=['jnt','flash'], jnt:RM40 (noCOD), flash:RM50 (hasCOD) | rates=[{courier:'flash', codAvailable:true}], degraded:false | F36, GH-1333 |
| **TC-F14.135** | Unit | High | COD order, NO courier is COD-capable → GIỮ EP pick (không swap flat), `codIneligible:'no_cod_courier'` (PD-021) | codAmountSen=1000, allowedCouriers=['jnt','flash'], both codAvailable:false | rates=[{courier:'jnt' — cheapest EP}], degraded:false, codIneligible='no_cod_courier'; buyer thấy courier + giá thật, chỉ hiện error | F36, GH-1333, PD-021 |
| **TC-F14.136** | Unit | High | Non-COD order (`codAmountSen=0`) ignores `codAvailable` flag (cheapest regardless) | codAmountSen=0, allowedCouriers=['jnt','flash'], jnt:RM40 (noCOD), flash:RM50 (hasCOD) | rates=[{courier:'jnt', codAvailable:false}] (jnt cheaper) | F36, GH-1333 |
| **TC-F14.137** | Unit | Medium | Allowlist `['flat']` (sentinel) filtered out → treated as no allowlist → cheapest of all | allowedCouriers=['flat'], quotations→{jnt:RM40, flash:RM50} | rates=[{courier:'jnt', degraded:false}] (after filtering 'flat', no restriction, pick cheapest) | F36, GH-1333 |

#### Server Route Threading

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.138** | Func | High | POST /api/orders/calculate-shipping passes `getAllowedCouriers(ep)` to getRates | Call POST with epIntegration={selectedCouriers:['jnt'], ...}, quotations→jnt/flash available | Response includes chosen rate's codAvailable | F36, GH-1333 |
| **TC-F14.139** | Func | High | Legacy single-courier tenant → identical output to pre-change (regression) | ep={selectedCourier:'flash'}, quotations→flash/jnt both available, jnt cheaper | rates=[{courier:'flash'}] because legacy coalesced to ['flash'] | F36, GH-1333 |

#### Save Route Guard

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.140** | Sec | High | POST /api/tenant/[id]/easyparcel-save: `enabled:true` + empty `selectedCouriers` → 400 `EP_NOT_READY` | POST {enabled:true, warehouses:[completeWh], selectedCouriers:[]} | HTTP 400, error.code='EP_NOT_READY' | F36, GH-1333 |
| **TC-F14.141** | Func | High | POST with `selectedCouriers:['jnt','flash']` + complete warehouse → 200, persists array + legacy scalar | POST {enabled:true, warehouses:[completeWh], selectedCouriers:['jnt','flash']} | HTTP 200, DB easyParcelIntegration.selectedCouriers=['jnt','flash'], selectedCourier='jnt' | F36, GH-1333 |

#### UI Multi-Select

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F14.142** | UI | High | CourierPicker toggles membership (check adds, re-check removes), aria-checked reflects state | Render CourierPicker with ['jnt']. Click 'flash' checkbox (add). Click 'jnt' checkbox (remove). | After add: ['jnt','flash'], aria-checked='true' on flash. After remove: ['flash'], aria-checked='false' on jnt | F36, GH-1333 |
| **TC-F14.143** | UI | High | Settings-tab seeds `selectedCouriers` from legacy config via coalesce, Activate disabled at 0 | Render SettingsTab for ep={selectedCourier:'flash'}. Check initial state. Try Activate with 0 selected. | Initial picked=['flash']. Activate button disabled when selected.length=0 | F36, GH-1333 |
| **TC-F14.144** | UI | High | Stepper `courierDone` true only when ≥1 selected; activate body carries array | Render Stepper. Step 2 (courier) with 0 selected. Add 1. Click Next. | courierDone=false at 0 selected; activate POST includes selectedCouriers:['jnt'] | F36, GH-1333 |

#### Auto-Cheapest — BYOC Guard (ACTIVE)

| TC-ID | Type | Priority | Description | Input | Expected | Trace |
|-------|------|----------|-------------|-------|----------|-------|
| **TC-F14.145** | Unit | High | BYOC couriers ("Bring Your Own Contract", e.g. `BYOC FedEx`) are excluded from auto-pick even when cheapest; picks cheapest non-BYOC. All-BYOC → flat fallback | Quotations: byoc_fedex RM30, flash RM40, jnt RM50 | rates=[{courier:'flash'}] (BYOC skipped); all-BYOC → rates=[{courier:'flat', degraded:true}] | F36, GH-1333 |

#### COD Eligibility R1/R2/R3 — PD-021 Follow-EP Model (ACTIVE)

> COD gating theo `min_cod_amount`/`max_cod_amount`/`cod.available` LIVE per-route (KHÔNG hardcode vùng). Unit rules: `src/__tests__/unit/shipping/cod-eligibility.test.ts` (TC-F36.U01–U11, supersede bộ isCodBlocked East-MY cũ). getRates integration bên dưới.

| TC-ID | Type | Priority | Description | Input | Expected | Trace |
|-------|------|----------|-------------|-------|----------|-------|
| **TC-F14.146** | Unit | High | COD amount vượt max của MỌI courier COD-capable (R1) → GIỮ EP pick + `codIneligible:'over_max'` | codAmountSen=500000 (RM5000), quotation jnt COD min RM7.50/max RM1000 | rates=[{courier:'jnt'}], degraded:false, codIneligible='over_max' | F36, GH-1333, PD-021 |
| **TC-F14.147** | Unit | High | COD amount dưới min của MỌI courier COD-capable (R2) → GIỮ EP pick + `codIneligible:'under_min'` | codAmountSen=50 (RM0.50), quotation jnt COD min RM7.50/max RM1000 | rates=[{courier:'jnt'}], degraded:false, codIneligible='under_min' | F36, GH-1333, PD-021 |
| **TC-F14.148** | Unit | High | Auto-pick enforce min/max: courier rẻ hơn nhưng out-of-range bị skip, chọn courier in-range | codAmountSen=150000 (RM1500), jnt RM40 max RM1000, dhl RM50 max RM2000 | rates=[{courier:'dhl'}], degraded:false, codIneligible undefined | F36, GH-1333, PD-021 |
| **TC-F14.149** | Unit | High | `codMinSen` extract từ quotation `min_cod_amount` (RM→sen) để enforce R2 | Quotation flash COD min RM7.50 → min_cod_amount:'7.5' | rates[0].codMinSen=750 | F36, GH-1333, PD-021 |
| **TC-F14.150** | Unit | High | create-label live re-check: service còn COD-eligible (kể cả route East MY — R4 không có input vùng) → ok | Re-quote SVC-JNT, cod available min 7.5/max 1000, amount RM118, dest Sarawak | {ok:true} → submit tiếp tục | F36, GH-1333, PD-021 |
| **TC-F14.151** | Unit | High | create-label live re-check: limits đổi làm amount out-of-range HOẶC courier tắt COD → 422 COD_NOT_ELIGIBLE | (a) max giảm còn RM100, amount RM118; (b) cod.available=false | (a) {ok:false, reason:'over_max'}; (b) {ok:false, reason:'no_cod_courier'} → route trả 422 | F36, GH-1333, PD-021 |
| **TC-F14.152** | Unit | High | create-label live re-check fail-open: quotation lỗi / service vắng mặt / status error → KHÔNG chặn tạo label | (a) quotations throw; (b) service_id khác; (c) status:'error' | {ok:true} cả 3 case — submit_orders là authority cho lỗi quote | F36, GH-1333, PD-021 |
| **TC-F14.153** | Unit | High | `codProbeSen`: verdict COD tính trên probe amount mà KHÔNG COD-filter pick — storefront pre-disable COD trước khi buyer chọn payment method | Non-COD pick + codProbeSen=500000, jnt COD max RM1000, citylink rẻ hơn không COD | rates=[citylink] (cheapest overall), codIneligible='over_max'; probe in-range → codIneligible undefined | F36, GH-1333, PD-021 |
| **TC-F14.154** | Unit | High | NaN guard: EP trả `min_cod_amount`/`max_cod_amount` = ""/non-numeric → coi như KHÔNG có limit (không được fail so sánh vì NaN) | Quotation pos cod.available=true, min=""/max="" , codAmountSen=950 | rates=[pos], codMinSen/codMaxSen=undefined (không NaN), codIneligible=undefined — COD đặt được | F36, GH-1333, PD-021 |

#### Pickup/Dropoff Collection Date — US-F36-07 (ACTIVE)

> Chọn pickup/dropoff + `collection_date` NGAY tại bước Ready-to-Ship (trước khi mua label); server clamp AC-3b dùng CHUNG helper `pickup-schedule.ts` với date picker. Popover schedule-pickup sau-label + route `/api/orders/[id]/pickup` đã gỡ (TC-F36.P01–P20 retire). Unit: `src/__tests__/unit/shipping/pickup-schedule.test.ts`.

| TC-ID | Type | Priority | Description | Input | Expected | Trace |
|-------|------|----------|-------------|-------|----------|-------|
| **TC-F14.155** | Unit | High | `earliestPickupDate` cut-off aware (MYT): trước cut-off → hôm nay; sau cut-off → ngày làm việc kế; T6 sau cut-off → T2; courier lạ (EP-CR*) fallback cut-off 12:00 | nowUtc cố định các mốc quanh cut-off J&T 13:50 / default 12:00 | same-day / next-business-day đúng từng mốc | F36, GH-1333, US-F36-07 AC-2 |
| **TC-F14.156** | Unit | Medium | `isBusinessDateString` phân loại T2–T6/T7-CN theo MYT; `courierCutoffLabel` trả "13:50" (jnt) / "12:00" (default) | các ngày cố định 2026-07-06..12 | Mon–Fri true, Sat/Sun false; label đúng | F36, GH-1333, US-F36-07 AC-2 |
| **TC-F14.157** | Unit | High | `clampCollectionDate` (AC-3b): không tin client — no date → earliest; past → clamp; mở picker trước cut-off nhưng submit sau → clamp lên ngày kế + shifted:true; weekend → bump ngày làm việc; future weekday hợp lệ → giữ nguyên | requested × nowUtc matrix | {date, shifted} đúng từng case; create-label trả `collectionDate`+`collectionDateShifted` để UI toast "đã dời sang DD/MM" | F36, GH-1333, US-F36-07 AC-3b |

#### Parcel Weight Unit — GH-1458 KG Canonical (ACTIVE)

> `Products.weight` đơn vị chuẩn = **KG** (chốt 2026-07-06). Pipeline shipping chạy gram integer nội bộ; `productWeightToGrams()` là điểm convert duy nhất, wire vào checkout + stripe-checkout (`build-order-items`) + calculate-shipping (server lookup theo productId khi client không gửi weightG). Trước fix này weight sản phẩm không hề được đọc — mọi đơn quote 500g/item default.

| TC-ID | Type | Priority | Description | Input | Expected | Trace |
|-------|------|----------|-------------|-------|----------|-------|
| **TC-F14.158** | Unit | High | `productWeightToGrams`: kg→gram integer; unset/0/âm/NaN → 500g default; KHÔNG chia 1000 lần nữa (regression grams-era) | 0.5 / 1.5 / null / 0 / -1 / NaN | 500 / 1500 / 500 / 500 / 500 / 500; 0.5kg qua aggregateWeightKg ra đúng 0.5kg | F36, GH-1333, GH-1458 |
| **TC-F14.159** | Unit/API | Critical | Flat-rate money unit: custom westRate 801 sen phải giữ nguyên qua quote và hiển thị checkout đúng RM | westRate=801; POST flat quote; checkout nhận rate | `data.fee=801` (legacy), `rates[0].priceSen=801`; checkout hiển thị và cộng RM 8.01 | F14 money-unit contract |

---

## 4. End-to-End UAT Flows

### E2E #1: Seller setup → Buyer mua West MY (happy path)

1. Seller login → Settings → Shipping
2. Đổi West rate = RM 10, East = RM 18, freeAbove = RM 200, toggle ON. Save → toast.
3. Buyer (incognito) vào storefront, add product RM 150 vào cart
4. Vào checkout, nhập tên + email + address + state Selangor + postcode 50480
5. Order summary: Subtotal RM 150, Shipping **RM 10**, SST 6% RM 9.00, Total **RM 169.00**
6. Đổi state sang Sabah → live recalc → Shipping **RM 18**, Total **RM 177.00** (without reload)
7. Pay → Order confirmation hiển thị đầy đủ breakdown

### E2E #2: Free shipping threshold trigger

1. Seller config freeAbove = RM 100
2. Buyer add product RM 95 → checkout (West) → ship RM 8, hint "Add RM 5 more for free" (highlight)
3. Add 1 SP RM 10 → subtotal RM 105 → ship **RM 0**, badge "🎉 Free Shipping"
4. Remove → subtotal RM 95 → ship lại RM 8 (live recalc)

### E2E #3: Edge — Subtotal = 0 vẫn charge ship

1. Buyer apply promo 100% off → subtotal RM 0
2. State Sabah → Shipping RM 15, Total RM 15
3. Pay → Order DB lưu shippingFee=1500, subtotal=0, total=1500

### E2E #4: Seller fulfillment self-delivery

1. Order arrive in Dashboard, status Pending
2. Seller liên hệ J&T ngoài hệ thống, nhận tracking "JT123456789MY"
3. Vào Order detail → nhập trackingNumber → đổi status Shipped
4. Email tự gửi buyer: subject "Your order shipped", body chứa "JT123456789MY" plain text
5. Buyer copy → paste vào jtexpress.my để track

---

## 5. Quality Gates

| Nhóm | TCs | Mục tiêu pass | TCs Critical |
|---|---|---|---|
| **1. Phân loại State** | TC-F14.01..05 | 5/5 | TC-F14.02, 03, 04 |
| **2. Tính phí Shipping** | TC-F14.06..08 | 3/3 | TC-F14.07, 08 |
| **3. Ngưỡng Free** | TC-F14.09..13 | 5/5 | TC-F14.09, 10, 13 |
| **4. Seller Settings** | TC-F14.14..22 | 9/9 | TC-F14.15, 22 |
| **5. Live Recalc** | TC-F14.23..25 | 3/3 | TC-F14.23 |
| **6. Postcode** | TC-F14.26..28 | 3/3 | TC-F14.27 |
| **7. Edge Cases** | TC-F14.29..31 | 3/3 | TC-F14.29 |
| **8. Mobile** | TC-F14.32..34 | 3/3 | TC-F14.32, 33 |
| **9. Self-Delivery** | TC-F14.35..36 | 2/2 | — |
| **10. API HTTP-level** | TC-F14.37..49 | 13/13 | TC-F14.39, 41, 43 |
| **11. Lỗ hổng Stories AC** | TC-F14.50..53 | 4/4 | TC-F14.50, 51 |
| **12. DB & Migration** | TC-F14.54..56 | 3/3 | TC-F14.54 |
| **13. Edge Unit & API (v2.2)** | TC-F14.57..79 | 23/23 | TC-F14.59, 69, 71, 74, 75 |
| **14. Edge & Contracts (v2.3)** | TC-F14.80..116 | 35/37 ⚠ | **TC-F14.85, 95** (đã chấp nhận không fix) |
| **15. Race + Email (v2.4)** | TC-F14.117..123b | 8/8 | TC-F14.117, 120 |
| **E2E UAT** | 4 flow | 4/4 | Tất cả |
| **Playwright Automated** | TC-PW-F14.01..15 | 15/15 | TC-PW-F14.01, 03, 05, 11 |
| **Playwright qa-f14 project** | BASE_URL staging | (env-gated) | chạy chống `https://web-cms-v2.dev.ecommercehub.my` |

**Cổng release:** 100% TCs Critical/Blocker pass + ≤2 P2 bug có workaround + 0 Blocker bug open.

> ⚠ **Blocker hiện tại:** TC-F14.85 + TC-F14.95 FAILING — body=null trả về 500 thay vì 400. Chạy `/cook` để thêm null guard trước khi destructure.

---

## 6. Ma trận Traceability (FR/BR/AC ↔ TC)

| Nguồn | TCs Coverage |
|---|---|
| **FR-01** Dropdown 16 bang | TC-F14.01, 05, **112**, **83**, **84** |
| **FR-02** Flat rate West/East | TC-F14.02, 03, 06, **57**, **58**, **81** |
| **FR-03** Order summary breakdown | TC-F14.07, 31 |
| **FR-04** Ngưỡng free inclusive | TC-F14.09, 10, 11, **59**, **69**, **82** |
| **FR-05** Logic hint 3-tier | TC-F14.12, **90**, **115** |
| **FR-06** Seller tuỳ chỉnh rate | TC-F14.15, 16, 22, **100**, **108** |
| **FR-07** Mobile numpad + tap 44px | TC-F14.32, 33, 34 |
| **FR-08** Rate range 0..100k sen | TC-F14.17, 18, 19, 20, **74**, **75**, **101**, **102**, **110** |
| **FR-09** Live recalc debounce 300ms | TC-F14.23, 24, 25, **94** |
| **FR-10** Subtotal=0 vẫn charge | TC-F14.29, 30, **69** |
| **FR-11** Postcode regex `^\d{5}$` | TC-F14.26, 27 |
| **FR-12** Reset to Defaults | TC-F14.21 |
| **BR-01** West = 13 bang | TC-F14.02, **113** |
| **BR-02** East = Sabah/Sarawak/Labuan | TC-F14.03, 04, **114** |
| **BR-03** Seller override defaults | TC-F14.15, 16 |
| **BR-04** Rate 0..RM 1,000 | TC-F14.17, 18, 19, 20, **74**, **75**, **101**, **102**, **110** |
| **BR-05** SST không tính shipping | TC-F14.08 |
| **BR-06** Inclusive `>=`, null=không free | TC-F14.10, 13, **59**, **80**, **82**, **91** |
| **BR-07** Default values | TC-F14.14, 21, **62**, **92**, **111** |
| **BR-08** Postcode chỉ check format | TC-F14.26, 27, 28 |
| **BR-09** Self-delivery | TC-F14.35, 36, **71**, **120**, **121**, **122**, **123**, **123b** |
| **AC-1** Checkout West MY | TC-F14.02 + E2E #1 |
| **AC-2** Checkout East MY | TC-F14.03 + E2E #1 |
| **AC-3** Dropdown 16 bang | TC-F14.01, **112** |
| **US-F14-01** Tính Shipping | TC-F14.01..13, **57..69**, E2E #1 #2 |
| **US-F14-02** Seller Settings | TC-F14.14..22, **72..78**, **96..110** |
| **US-F14-03** Mobile UX | TC-F14.32..34 |
| **US-F14-04** Validate boundary | TC-F14.17..20, **74**, **75**, **101**, **102**, **110** |
| **US-F14-05** Live recalc | TC-F14.23..25, **94**, + E2E #1 |
| **US-F14-06** Subtotal=0 vẫn charge | TC-F14.29, 30, **59**, **69**, **115** + E2E #3 |
| **Security: cross-tenant + auth** | TC-F14.41, **96**, **97**, **98**, **99** |
| **Error cascades** | TC-F14.105, **106**, **116** |
| **Bug validation body (đã chấp nhận không fix)** | TC-F14.**85**, **95** ⚠ |

**Coverage:** 12/12 FR + 9/9 BR + 3/3 AC + 6/6 Stories ✅ | Bonus: security 5 TCs, error cascades 3 TCs, constants contracts 4 TCs

---

## 7. Self-Check

```
Self-check QA Test Plan (auto-validate, v2.4 — 2026-05-15):
├── Tổng TCs manual + auto: 124 (TC-F14.01..123b) ✅
├── Tổng Playwright E2E specs: 15 ✅
├── E2E UAT flow: 4 ✅
├── 100% FR mapped: 12/12 ✅
├── 100% BR mapped: 9/9 ✅
├── 100% PRD AC mapped: 3/3 ✅
├── 100% Story AC mapped: 15/15 ✅
├── Coverage API endpoint: 3/3 (GET, PATCH, POST calc) ✅
├── Mã lỗi HTTP: NOT_FOUND, INVALID_STATE, VALIDATION_ERROR, FORBIDDEN, INTERNAL_ERROR, 429 ✅
├── Security cross-tenant: TC-F14.41, 96, 97, 98, 99 ✅
├── Bypass super-admin: TC-F14.96 ✅
├── Test migration DB: TC-F14.54 ✅
├── Mobile 375px: 3 TCs ✅
├── Mô hình Self-delivery: 3 TCs ✅
├── Regression guard constants: TC-F14.111..114 ✅
├── Edge case state i18n: TC-F14.83, 84 ✅
├── Concurrency (POST+PATCH): TC-F14.68, 76, 93, 109 ✅
├── Snapshot race PATCH→POST: TC-F14.94 ✅
├── Bug validation body: TC-F14.85, 95 ⚠ FAILING (đã chấp nhận không fix)
├── Nhãn Priority: Tất cả TCs ✅
├── Phân loại Type: Tất cả TCs ✅
├── Dữ liệu test cụ thể: Có (giá trị sen, tên bang, UUID, fixtures) ✅
└── Out-of-scope đã đánh dấu: Multi-seller, API Carrier, cross-check postcode-state ✅
```

---

## 8. Test Execution Notes

### Pre-conditions
- Test tenant đã có `shippingConfig` seed default (BR-07 values)
- Test sản phẩm có price linh hoạt (RM 1, 50, 95, 99.99, 100, 105, 150, 200, 9999)
- Test addresses cho 16 states với postcode valid
- Network throttle "Fast 3G" cho mobile E2E

### Tools
- Manual: Browser DevTools (Network tab cho debounce TC-F14.24, Console cho live recalc)
- Automated: Vitest unit cho calculation logic, Playwright cho E2E #1-4 + TC-F14.23
- Mobile: Real device hoặc Chrome DevTools mobile emulation 375×667

### Coverage targets
- Unit: `src/lib/shipping/calculate.ts` (function `classifyRegion`, `calculateShippingFee`) ≥ 90% lines
- API: 3 endpoints ≥ 80% lines, all happy + 4xx + 5xx paths
- E2E: 4 flows fully automated trong `e2e/f14-shipping.spec.ts`

---

## 9. Trạng thái triển khai (scan 2026-05-15 v2.4)

✅ **F14 đã implement đầy đủ** — chỉ còn 2 bug body=null đã chấp nhận không fix.

| Component | Status | TC verification |
|---|---|---|
| Data model (`Sites.shippingConfig`, `Orders.shippingFee`) | ✅ Xong | — |
| Schema `validateShippingConfig` | ✅ Xong | TC-F14.17..20, 74, 75, 101, 102, 110 |
| API GET shipping-config | ✅ Xong | TC-F14.79, 106, 107 |
| API PATCH shipping-config | ✅ Xong | TC-F14.12..15, 72..78, 96..110 |
| API POST calculate-shipping | ✅ Xong | TC-F14.01..09, 65..71, 86..94, 115, 116 |
| `lib/shipping/calculate-fee.ts` + `classify-region.ts` | ✅ Xong | TC-F14.01..09, 57..64, 80..84 |
| `lib/shipping/constants.ts` (defaults + state lists) | ✅ Xong | TC-F14.111..114 |
| UI Seller Settings `/dashboard/settings/shipping` | ✅ Xong | Playwright TC-PW-F14.11..14 |
| Checkout live recalc | ✅ Xong | Playwright TC-PW-F14.05, 06 |
| Validate postcode regex | ✅ Xong | Playwright TC-PW-F14.07 |
| **Body=null guard (POST + PATCH)** | 🐛 Bug | **TC-F14.85, 95 FAILING — trả 500 thay vì 400 (đã chấp nhận không fix)** |

**Lần chạy test (2026-05-15):** 106/108 unit+API+integration tests PASS, 2 FAIL (TC-F14.85, 95 — cùng root cause body=null).

---

## 10. Playwright E2E Test Specs

**File:** `e2e/f14-shipping.spec.ts` (NEW — chưa tồn tại) | **Framework:** `@playwright/test@^1.58.2` | **Config:** `playwright.config.ts` ở root

### 10.1 Pre-conditions & fixtures

```typescript
// e2e/fixtures/f14-shipping.ts
export const TEST_SITE = {
  slug: 'qa-test-shop',
  siteId: '<seed-uuid>',
}

export const TEST_PRODUCTS = {
  cheap:  { name: 'Test Sticker',  price: 9999  },  // RM 99.99 — boundary < 100
  medium: { name: 'Test Mug',      price: 10000 },  // RM 100   — boundary =
  expensive: { name: 'Test Shirt', price: 15000 },  // RM 150   — > threshold
  promo:  { name: 'Free Promo',    price: 0     },  // RM 0     — TC-F14.29/52
}

export const TEST_ADDRESSES = {
  selangor: { name: 'Test Buyer', email: 't@e.my', line1: '1 Jln Test', city: 'PJ',  state: 'Selangor',     postcode: '47800' },
  sabah:    { name: 'Test Buyer', email: 't@e.my', line1: '2 Jln Test', city: 'KK',  state: 'Sabah',        postcode: '88300' },
  labuan:   { name: 'Test Buyer', email: 't@e.my', line1: '3 Jln Test', city: 'Lab', state: 'W.P. Labuan',  postcode: '87000' },
  invalidPostcode: { /* ... */ postcode: 'abc12' },
}

export const SELLER_CREDS = { email: 'seller@qa.test', password: process.env.QA_SELLER_PASS }
```

### 10.2 Playwright Test Cases (mapping với manual TCs)

| Spec ID | Manual TC ref | Description | Estimate LOC |
|---|---|---|---|
| **TC-PW-F14.01** | TC-F14.01, 02 | West MY happy path — Selangor → RM 8, breakdown đúng | 25 |
| **TC-PW-F14.02** | TC-F14.03, 04 | East MY + Labuan → RM 15 (boundary) | 30 |
| **TC-PW-F14.03** | TC-F14.09, 10, 11 | Free threshold boundary inclusive (`>=`) — test 3 cases: < / = / > | 40 |
| **TC-PW-F14.04** | TC-F14.12 | 3-tier hint display logic (neutral/highlight/badge) | 35 |
| **TC-PW-F14.05** | TC-F14.23, 25 | Live recalc on state change — West → East no reload, spinner show | 30 |
| **TC-PW-F14.06** | TC-F14.24 | Debounce 300ms — 5 rapid changes = 1 API call (network intercept) | 35 |
| **TC-PW-F14.07** | TC-F14.26, 27 | Postcode validation — 5 digits OK, 4/6/non-digit reject | 25 |
| **TC-PW-F14.08** | TC-F14.32, 33 | Mobile 375px UX — numpad, vertical stack, tap target 44px | 40 |
| **TC-PW-F14.09** | TC-F14.50, 51 | Network error retry + Place Order disabled | 50 |
| **TC-PW-F14.10** | TC-F14.29, 52, 53 | Edge subtotal=0 — 3 scenarios (charge / free / hint sane) | 45 |
| **TC-PW-F14.11** | TC-F14.15, 21 | Seller Settings — save + Reset to Defaults | 50 |
| **TC-PW-F14.12** | TC-F14.17, 19 | Seller Settings — validate rate boundaries inline error | 35 |
| **TC-PW-F14.13** | TC-F14.41 | Cross-tenant PATCH 403 (API-level via `request.fetch`) | 30 |
| **TC-PW-F14.14** | TC-F14.34 | Mobile Seller Settings responsive 375px | 30 |
| **TC-PW-F14.15** | E2E #4 | Seller fulfillment self-delivery flow (set tracking → email plain) | 60 |

**Total est:** ~560 LOC trong 1 spec file. Có thể split thành 3 files nếu file quá lớn:
- `e2e/f14-shipping-checkout.spec.ts` (TC-PW-F14.01..10) — buyer side
- `e2e/f14-shipping-settings.spec.ts` (TC-PW-F14.11..14) — seller side
- `e2e/f14-shipping-fulfillment.spec.ts` (TC-PW-F14.15) — order flow

### 10.3 Sample Playwright spec stubs

```typescript
// e2e/f14-shipping-checkout.spec.ts
import { test, expect } from '@playwright/test'
import { TEST_SITE, TEST_PRODUCTS, TEST_ADDRESSES } from './fixtures/f14-shipping'

test.describe('F14 Shipping — Checkout (Storefront)', () => {

  // TC-PW-F14.01 — West MY happy path
  test('TC-F14.02 — Selangor → RM 8.00 + breakdown đúng', async ({ page }) => {
    await page.goto(`/sites/${TEST_SITE.slug}`)
    await page.click(`text=${TEST_PRODUCTS.medium.name}`)
    await page.click('button:has-text("Add to Cart")')
    await page.goto(`/sites/${TEST_SITE.slug}/checkout`)

    await page.fill('input[name="email"]', TEST_ADDRESSES.selangor.email)
    await page.fill('input[name="line1"]', TEST_ADDRESSES.selangor.line1)
    await page.fill('input[name="postcode"]', TEST_ADDRESSES.selangor.postcode)
    await page.selectOption('select[name="state"]', TEST_ADDRESSES.selangor.state)

    // Wait for debounced calc to settle
    await expect(page.locator('[data-testid="shipping-fee"]')).toHaveText('RM 8.00', { timeout: 1000 })
    await expect(page.locator('[data-testid="subtotal"]')).toHaveText('RM 100.00')
    await expect(page.locator('[data-testid="sst"]')).toHaveText('RM 6.00')      // BR-05: SST chỉ trên subtotal
    await expect(page.locator('[data-testid="total"]')).toHaveText('RM 114.00')  // 100 + 8 + 6
  })

  // TC-PW-F14.05 — Live recalc
  test('TC-F14.23 — Đổi state Selangor → Sabah, fee auto update không reload', async ({ page }) => {
    // ... setup checkout với Selangor → ship RM 8
    const oldUrl = page.url()
    await page.selectOption('select[name="state"]', 'Sabah')
    await expect(page.locator('[data-testid="shipping-fee"]')).toHaveText('RM 15.00', { timeout: 1000 })
    expect(page.url()).toBe(oldUrl)  // KHÔNG reload — same URL
    // Form fields preserved
    await expect(page.locator('input[name="email"]')).toHaveValue(TEST_ADDRESSES.selangor.email)
  })

  // TC-PW-F14.06 — Debounce 300ms
  test('TC-F14.24 — 5 rapid state changes = 1 API call', async ({ page }) => {
    let calcCallCount = 0
    page.on('request', req => {
      if (req.url().includes('/api/orders/calculate-shipping')) calcCallCount++
    })

    // ... setup checkout
    for (const state of ['Selangor', 'KL', 'Sabah', 'Sarawak', 'Penang']) {
      await page.selectOption('select[name="state"]', state, { force: true })
      await page.waitForTimeout(50)  // rapid changes < debounce window
    }
    await page.waitForTimeout(500)  // wait debounce settle
    expect(calcCallCount).toBe(1)
  })

  // TC-PW-F14.09 — Network error retry
  test('TC-F14.50 — POST calc 500 → toast + auto retry + Place Order disabled', async ({ page }) => {
    let attempt = 0
    await page.route('**/api/orders/calculate-shipping', route => {
      attempt++
      if (attempt < 2) return route.fulfill({ status: 500, body: '{}' })
      return route.continue()
    })

    // ... setup checkout
    await page.selectOption('select[name="state"]', 'Selangor')
    await expect(page.locator('text=Failed to calculate shipping')).toBeVisible()
    await expect(page.locator('button:has-text("Place Order")')).toBeDisabled()
    // After auto-retry succeeds
    await expect(page.locator('[data-testid="shipping-fee"]')).toHaveText('RM 8.00', { timeout: 3000 })
    await expect(page.locator('button:has-text("Place Order")')).toBeEnabled()
  })

})

// e2e/f14-shipping-settings.spec.ts
test.describe('F14 Shipping — Seller Settings (Dashboard)', () => {
  test.use({ storageState: 'e2e/.auth/seller.json' })  // pre-auth via auth.setup.ts

  test('TC-F14.15 — Save settings + apply to storefront', async ({ page, request }) => {
    await page.goto('/dashboard/settings/shipping')
    await page.fill('input[name="westRate"]', '10.00')
    await page.fill('input[name="eastRate"]', '20.00')
    await page.fill('input[name="freeAbove"]', '150.00')
    await page.click('button:has-text("Save")')
    await expect(page.locator('text=Shipping settings saved')).toBeVisible()

    // Verify DB via API
    const res = await request.get(`/api/sites/${TEST_SITE.siteId}/shipping-config`)
    const json = await res.json()
    expect(json.data).toMatchObject({ westRate: 1000, eastRate: 2000, freeAbove: 15000 })
  })

  test('TC-F14.21 — Reset to Defaults', async ({ page }) => {
    await page.goto('/dashboard/settings/shipping')
    // ... edit về nonsense values
    await page.fill('input[name="westRate"]', '99.99')
    await page.click('button:has-text("Reset to Defaults")')
    await expect(page.locator('input[name="westRate"]')).toHaveValue('8.00')
    await expect(page.locator('input[name="eastRate"]')).toHaveValue('15.00')
    await expect(page.locator('input[name="freeAbove"]')).toHaveValue('100.00')
    await expect(page.locator('input[type="checkbox"][name="freeShippingEnabled"]')).toBeChecked()
  })

  test('TC-F14.41 — Cross-tenant PATCH 403', async ({ request }) => {
    const otherSiteId = '<seed-other-tenant-uuid>'
    const res = await request.patch(`/api/sites/${otherSiteId}/shipping-config`, {
      data: { westRate: 5000 },
    })
    expect(res.status()).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })
})

// e2e/f14-shipping-mobile.spec.ts
test.describe('F14 Shipping — Mobile UX (375px)', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('TC-F14.32 — Postcode dùng numpad (inputmode=numeric)', async ({ page }) => {
    // ... goto checkout mobile
    const postcodeInput = page.locator('input[name="postcode"]')
    await expect(postcodeInput).toHaveAttribute('inputmode', 'numeric')
  })

  test('TC-F14.33 — Tap target ≥ 44px stacked vertical', async ({ page }) => {
    // ... goto checkout mobile
    const stateSelect = await page.locator('select[name="state"]').boundingBox()
    expect(stateSelect!.height).toBeGreaterThanOrEqual(44)

    const saveBtn = await page.locator('button:has-text("Place Order")').boundingBox()
    expect(saveBtn!.height).toBeGreaterThanOrEqual(44)
  })
})
```

### 10.4 Playwright execution

```bash
# Run all F14 e2e specs
npm run test:e2e -- e2e/f14-shipping-*.spec.ts

# Run với UI mode để debug
npm run test:e2e:ui -- e2e/f14-shipping-*.spec.ts

# Single test
npx playwright test e2e/f14-shipping-checkout.spec.ts -g "TC-F14.23"
```

### 10.5 Data setup requirements

| Resource | How to seed |
|---|---|
| Test tenant + site | `pnpm tsx scripts/seed-qa-tenant.ts` (NEEDS creation) |
| Seller account `seller@qa.test` | `e2e/auth.setup.ts` storage state |
| Test products | seed script tạo cheap/medium/expensive/promo |
| Cross-tenant site | seed thêm 1 tenant khác để test cross-tenant security |

### 10.6 Dependencies cần install (nếu chưa có)

```bash
npm ls @playwright/test  # check version >=1.58.2 OK
```

Project hiện tại đã có `@playwright/test@^1.58.2` + `playwright.config.ts` + `e2e/auth.setup.ts` → **READY** để add spec files, không cần install.

---

### 3.16 Validation Tests — Phase 3 (Pure functions + Component wiring)

> **File nguồn:** `src/__tests__/unit/dashboard/shipping-rate-validation.test.tsx`
>
> **Phạm vi:** Unit tests cho `validateRate()` (13 edge cases), `parseRateRm()`, `validateCrossField()`, component integration (`ShippingSettingsClient` form wiring)

#### validateRate edge cases (TC-F14.21–F14.33)

| ID | Type | Title | Input | Expected | Refs |
|---|---|---|---|---|---|
| **TC-F14.21** | Unit | Empty + required → errorEmpty | validateRate('', {required:true}) | {error:'Required'} | FR-08, BR-04 |
| **TC-F14.22** | Unit | Empty + optional → no error | validateRate('', {required:false}) | {error:''} | FR-08 |
| **TC-F14.23** | Unit | Negative → errorNegative | validateRate('-5', opts) | {error:'Cannot be negative'} | FR-08 |
| **TC-F14.24** | Unit | Over max (1001 RM) → errorTooHigh | validateRate('1001', {maxSen:100_000}) | {error:'Maximum RM 1,000'} | FR-08, BR-04 |
| **TC-F14.25** | Unit | Scientific notation 1e3 → errorFormat | validateRate('1e3', opts) | {error:'Numbers only'} | FR-08 |
| **TC-F14.26** | Unit | Non-numeric 'abc' → errorFormat | validateRate('abc', opts) | {error:'Numbers only'} | FR-08 |
| **TC-F14.27** | Unit | Comma decimal 8,50 → valid | validateRate('8,50', opts) | {error:''} | FR-08 |
| **TC-F14.28** | Unit | Whitespace padded "  8.5  " → valid | validateRate('  8.5  ', opts) | {error:''} | FR-08 |
| **TC-F14.29** | Unit | >2 decimals 8.123 → errorFormat | validateRate('8.123', opts) | {error:'Numbers only'} | FR-08 |
| **TC-F14.30** | Unit | Zero → no error + warnFree | validateRate('0', opts) | {error:'', warning:'All orders free'} | BR-04 |
| **TC-F14.31** | Unit | Happy path 8.00 → no error | validateRate('8.00', opts) | {error:''} | FR-08 |
| **TC-F14.32** | Unit | Multiple dots 1.2.3 → errorFormat | validateRate('1.2.3', opts) | {error:'Numbers only'} | FR-08 |
| **TC-F14.33** | Unit | Sub-cent 0.001 + minSen=1 → errorNegative | validateRate('0.001', {minSen:1}) | {error:'Cannot be negative'} | FR-08 |

#### Component wiring (TC-F14.34–F14.38)

| ID | Type | Title | Action | Expected | Refs |
|---|---|---|---|---|---|
| **TC-F14.34** | Func | Paste -1 → shows errorNegative + aria-invalid | Paste '-1' into west rate input | Input has aria-invalid='true' + error visible | FR-08 |
| **TC-F14.35** | Func | onBlur auto-format 8 → 8.00 | Type '8', then blur west input | Value auto-formatted to '8.00' | FR-06 |
| **TC-F14.36** | Accessibility | aria-describedby + role=alert | Trigger validation error | Error paragraph has id='ship-rate-west-err', aria-describedby linked, role='alert' | A11y |
| **TC-F14.37** | Func | Paste trim + format " 8,50 " → 8.50 | Paste ' 8,50 ' (with spaces) | Input value becomes '8.50' | FR-06 |
| **TC-F14.38** | Func | onChange filter rejects letters | Type 'a' when input is empty | Input remains empty (filter blocked 'a') | FR-06 |
| **TC-F14.39** | Func | Paste "RM 8.00" strips prefix → 8.00 (AC-11) | Paste 'RM 8.00' into west rate | Input value becomes '8.00', no error shown | FR-08 |

#### Reset behavior (TC-F14.40–F14.42)

> **File nguồn:** `src/__tests__/unit/dashboard/shipping-settings-reset-defaults.test.tsx`

| ID | Type | Title | Action | Expected | Refs |
|---|---|---|---|---|---|
| **TC-F14.40** | Func | Reset clears error + aria-invalid | Paste '-1' → click Reset | Error text gone, aria-invalid removed | FR-08 |
| **TC-F14.41** | Func | Reset clears warnFree + restores default | Type '0' → blur → click Reset | Warning gone, west input back to '8.00' | BR-04 |
| **TC-F14.42** | Func | Reset restores both inputs to defaults | Change west+east → click Reset | West='8.00', East='15.00' | FR-06 |

---

## 10. F36 Order Detail (GH-1333) — Fulfillment & Pickup Scheduling

> **Scope:** Full-page order detail redesign (replaces drawer). Fulfillment state machine (7 states), EasyParcel create-label, pickup scheduling, COD recovery, tracking timeline.
>
> **Files:** `src/app/(dashboard)/orders/[id]/page.tsx` (RSC), `src/app/(dashboard)/orders/_components/detail/*` (12 components), `src/app/api/orders/[id]/{self-deliver,pickup}/route.ts` (2 endpoints), `src/lib/shipping/cod-block.ts` (helper).
>
> **TC-ID scheme:** `TC-F36.OD.NNN` (OD = Order Detail), e.g. TC-F36.OD.001, TC-F36.OD.002, ...

### Fulfillment State Machine (7 states)

| State | Trigger | Display | Components | TC-ID |
|-------|---------|---------|------------|-------|
| **pending→confirm** | Status=pending, EP ready, no label | Weight wizard → confirm | create-label-flow | TC-F36.OD.001–003 |
| **ready→create-label** | Status=pending, EP ready, missing weight | Weight input form | missing-weight-form | TC-F36.OD.004–005 |
| **success** | Status=pending, label created (labelUrl + awbNo) | Print modal + pickup popover + (if COD) recovery | print-label-modal, schedule-pickup-popover, cod-recovery | TC-F36.OD.006–010 |
| **shipping/completed** | Status=shipped/completed, `shippingTrackingHistory` present | Tracking timeline (immutable) | tracking-timeline | TC-F36.OD.011–013 |
| **cancelled** | Status=cancelled | Reason badge (immutable) | order-actions-card | TC-F36.OD.014 |
| **cod-blocked** | codAmount>0 + state in {Sabah, Sarawak, Labuan} | Recovery only: "Ship manually" | cod-recovery, self-delivery-zone | TC-F36.OD.015–017 |
| **missing-weight** | All routes but parcelWeight=null | Inline weight form | missing-weight-form | TC-F36.OD.018–019 |

### Test Cases (TC-F36.OD.*)

#### Routing & Navigation (TC-F36.OD.001–003)

| ID | Type | Priority | Title | Input | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.OD.001** | Func | Blocker | Full-page route `/orders/[id]` renders 2-column layout | Click row in OrdersTable → navigate to `/orders/[id]` | Page load; left col = items/customer/payment; right col = fulfillment zone | GH-1333 Phase 02 |
| **TC-F36.OD.002** | Func | Critical | Legacy `?order=123` query redirects to `/orders/[id]` | POST to `/orders?order=123` (old deep-link) | 301 redirect to `/orders/123` | GH-1333 Phase 02 |
| **TC-F36.OD.003** | Func | High | Drawer removed from OrdersClientLayout | Open Orders page, check layout tree | No `.DrawerPanel` overlay; table click triggers `<Link href="/orders/[id]">` | GH-1333 Phase 02 |

#### Create Label Flow (TC-F36.OD.004–007)

| ID | Type | Priority | Title | Input | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.OD.004** | Func | Critical | Wizard: enter weight → confirm → POST /create-label | Order status=pending, EP ready, no label. Enter parcelWeight=5000 sen, click "Create Label" | POST /api/orders/[id]/create-label success; response: `{labelUrl, awbNo}`. UI updates to success state | GH-1333 Phase 03 |
| **TC-F36.OD.005** | Func | High | Missing weight form: input parcelWeight, re-confirm | Order status=pending, parcelWeight=null. Input 5000, click "Confirm" | Form submits; state→pending→confirm (awaiting label creation); Create Label button enabled | GH-1333 Phase 03 |
| **TC-F36.OD.006** | Func | High | Create-label single-step: no intermediate steps | EP createLabel API returns awbNo + labelUrl in one call | State jumps directly to success (print modal visible) | GH-1333 Phase 03 |
| **TC-F36.OD.007** | Edge | Medium | Label creation error → toast + retry button | POST create-label fails (EP timeout/error) | Toast "Failed to create label. Retry?" appears; retry button re-submits | GH-1333 Phase 03 |

#### Print Label Modal (TC-F36.OD.008–009)

| ID | Type | Priority | Title | Input | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.OD.008** | Func | High | Print label modal: preview/download/print buttons | State=success, AWB present. Open modal, then Download or Print | Same-origin PDF preview renders; Download saves the active format; Print opens the active proxy PDF in a new tab | GH-1333 Phase 03, GH-1684 |
| **TC-F36.OD.009** | UI | Medium | A4/A6 format-specific preview | Modal rendered, toggle A4↔A6 | Active format requests `/label?format=A4` or `/label?format=A6`; unavailable format is disabled with a clear fallback | GH-1333 Phase 03, GH-1684 |

#### Shipping Label Canvas & Responsive Modal (TC-F36.OD.051–053)

| ID | Automation | Type | Priority | Title | Input | Expected | Refs |
|---|---|---|---|---|---|---|---|
| **TC-F36.OD.051** | [x] AUTO | Func | Critical | PDF label content renders in the viewer appropriate to each device | PII-free carrier-style PDF fixture with two soft-mask barcodes, QR, sender, and recipient; wide/narrow Desktop Chrome, Pixel 7 Chrome, iPhone Safari/Edge WebKit, iPad Mini portrait and 1024×768 landscape WebKit with the iPadOS desktop-site UA | Desktop retains the native PDF iframe regardless of window width; mobile/tablet canvas contains both barcodes, QR, sender, and recipient pixels; WebKit repairs all three transparent image XObjects; mobile/tablet has no iframe/object/embed | GH-1684 AC-1 |
| **TC-F36.OD.052** | [x] AUTO | UI | Critical | Print modal remains usable on desktop/mobile/tablet | Open modal in the seven Playwright projects above | Dialog and inner scroll area have no horizontal overflow or footer/body intersection; format/mark-printed/hint can each be scrolled into the visible grid above the footer; Cancel/Download/Print remain visible | GH-1684 AC-2 |
| **TC-F36.OD.053** | [ ] MANUAL | Mobile | High | Physical mobile browser UAT | iOS Safari + Android Chrome, portrait and landscape | Label content is readable; scrolling and all actions work without overlap | GH-1684 AC-1, AC-2 |

#### Schedule Pickup (TC-F36.OD.010–011)

| ID | Type | Priority | Title | Input | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.OD.010** | Func | High | Pickup popover: date picker + slot select → POST | Label created, popover open. Select date 2026-07-10, slot "08:00–12:00", click "Schedule" | POST /api/orders/[id]/pickup success; response: `{pickupScheduledAt, pickupSlot}`. Toast "Pickup scheduled" | GH-1333 Phase 03 |
| **TC-F36.OD.011** | Edge | Medium | Slot list depends on carrier API (informational) | EP API returns 3 available slots for selected date | Slot dropdown renders all 3; no pre-filtering on server | GH-1333 Phase 03 |

#### Tracking Timeline (TC-F36.OD.012–014)

| ID | Type | Priority | Title | Input | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.OD.012** | Func | High | Tracking timeline renders milestones from `shippingTrackingHistory` array | Order status=shipped, tracking history has 3 entries (confirmed, picked-up, delivered) | Timeline shows 3 milestone cards with dates + status labels (i18n) | GH-1333 Phase 05 |
| **TC-F36.OD.013** | UI | Medium | Milestone status labels localized (en/ms) | Dashboard language set to Malay; shippingTrackingHistory status = "picked-up" | Timeline label renders i18n key `dashboard.orders.tracking.pickedUp` → "Diambil" (Malay) | GH-1333 Phase 06 |
| **TC-F36.OD.014** | Edge | Low | Empty shippingTrackingHistory → no timeline | Order status=shipped, tracking history=[] | Timeline section empty or hidden; no error | GH-1333 Phase 05 |

#### COD Recovery (TC-F36.OD.015–017)

| ID | Type | Priority | Title | Input | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.OD.015** | Func | Critical | COD-blocked detection: codAmount>0 + state={Sabah,Sarawak,Labuan} | Order: codAmount=500, state='Sabah', status=pending, EP ready | Fulfillment zone shows "COD Recovery" only; "Ship manually" button → self-delivery form | GH-1333 Phase 03 |
| **TC-F36.OD.016** | Func | High | COD recovery non-East states → standard fulfill path | Order: codAmount=500, state='Selangor' | Fulfillment zone shows normal create-label flow (not COD recovery) | GH-1333 Phase 03 |
| **TC-F36.OD.017** | Edge | Medium | COD-free order (codAmount=0 or null) → standard path even in East | Order: codAmount=0, state='Sabah' | Normal create-label flow; no COD recovery badge | GH-1333 Phase 03 |

#### Self-Delivery (TC-F36.OD.018–020)

| ID | Type | Priority | Title | Input | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.OD.018** | Func | High | Self-delivery form: enter courier + tracking → POST | COD recovery or manual fulfillment. Enter courier='J&T', tracking='JT123456', click "Ship" | POST /api/orders/[id]/self-deliver success; status→shipped, selfDeliveryCourier + trackingNumber saved. Toast "Order marked shipped" | GH-1333 Phase 03 |
| **TC-F36.OD.019** | Edge | Medium | Free-text courier name (no validation) | Enter courier='Our-Custom-Handler-123-!@#' | Form accepts; DB stores raw string | GH-1333 Phase 03 |
| **TC-F36.OD.020** | UI | Medium | Tracking number display in shipped email (plain text, no link) | Order shipped via self-deliver, email sent. Email contains tracking number | Email body: "Tracking: JT123456" (plain text, KHÔNG có `<a href>` link) | GH-1333 Phase 06 |

#### Missing Weight Handling (TC-F36.OD.021–022)

| ID | Type | Priority | Title | Input | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.OD.021** | Func | High | Missing weight form: parcelWeight input + confirm re-enables create-label | Order parcelWeight=null. Input 3000, click "Confirm Weight" | Form submits; parcelWeight persisted. Create Label button re-enabled | GH-1333 Phase 03 |
| **TC-F36.OD.022** | Edge | Medium | Weight validation: sen range (must be ≥1) | Enter weight='0' or weight='-1' | Inline error "Weight must be positive"; submit blocked | GH-1333 Phase 03 |

#### Order Item Card (TC-F36.OD.023–024)

| ID | Type | Priority | Title | Input | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.OD.023** | UI | High | Items card: thumbnail/SKU/weight expandable | Order has 2 items. Click item row to expand | Expand shows: product image (or monogram fallback), name, SKU, variant weight, unit price, qty, line total | GH-1333 Phase 04 |
| **TC-F36.OD.024** | Edge | Medium | Missing product image → monogram tile | Product no longer has image (or depth=null). Item card renders | Monogram tile (initials) displays instead of image; no broken image icon | GH-1333 Phase 04 |

#### Page Rendering & i18n (TC-F36.OD.025–027)

| ID | Type | Priority | Title | Input | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.OD.025** | Func | High | Order detail page renders all 4 right-col cards + fulfillment zone | Navigate to `/orders/[id]` | Page loads with no 404. Left col has items/customer/payment. Right col has fulfillment zone + cards. | GH-1333 Phase 02 |
| **TC-F36.OD.026** | UI | Critical | All button/field labels use i18n keys (no hardcoded English) | Dashboard language=Malay. View fulfillment buttons, form labels | All text in `dashboard.orders.*` scope; no English fallback visible | GH-1333 Phase 06 |
| **TC-F36.OD.027** | Edge | Medium | i18n missing key → fallback to key name (no blank) | i18n key not found in ms.json (EN key exists). Dashboard language=Malay | Label shows key ID (e.g. "dashboard.orders.fulfillment") instead of blank | GH-1333 Phase 06 |

---

## 11. Open Questions

1. **Wave 6 release date** — F14 còn bao xa? Nếu sắp ship → cần dev sprint emergency vì chưa impl business logic
2. **Story status** — US-F14-01/02 vẫn `Draft`, US-F14-03..06 `Ready`. PM cần approve trước khi dev bắt đầu
3. **Debounce 300ms** — confirmed trong PRD line 120, nhưng cần xác nhận với UX team value này có matching design intent
4. **Hint copy** trong FR-05 — text chính xác là gì ("Add RM X more for free shipping" tiếng Anh hay có cả tiếng Malay)?
5. **Reset to Defaults** — có cần confirmation modal "Are you sure?" không, hay reset ngay khi click?
6. **Empty tracking number** — seller có thể đổi status sang "Shipped" mà KHÔNG nhập tracking? Hay bắt buộc?
7. **Tax (SST 6%)** ở TC-F14.07 — F09 đã impl SST chưa hay F14 phải tự handle?
8. **F36 wallet balance display** — PW1 showed EP wallet balance on order detail. v2 API doesn't return it. Confirm: hidden in v1?
9. **F36 pickup reschedule** — v1 persists locally. v2 feature (EP reschedule API call) deferred. Confirm: no sync back to EP?
10. **F36 shipping label size** — A4 vs A6 toggle informational. Confirm: no API parameter → same PDF regardless?
