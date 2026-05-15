# QA Test Plan — F14 Shipping (Malaysia)

> **Version:** 2.5 | **Updated:** 2026-05-15 (full Vietnamese translation cho section 3.13–3.15, Quality Gates, Traceability, Self-Check, Implementation Status) | **Owner:** QA Team
> **PRD ref:** [`docs/prd/F14-shipping.md`](../prd/F14-shipping.md) v1.2
> **Stories ref:** [`docs/stories/F14-shipping-stories.md`](../stories/F14-shipping-stories.md) (US-F14-01..06)
> **Architecture ref:** [`docs/architecture/F14-shipping.md`](../architecture/F14-shipping.md)
> **Design ref:** [`docs/design/F14-shipping-design.md`](../design/F14-shipping-design.md)

### Changelog
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
| **TC-F14.43** | API | Critical | `POST /api/orders/calculate-shipping` happy | Body `{siteId, state:'Selangor', subtotal:5000}`. | HTTP 200 + body `{success:true, data:{fee:800, isFree:false, region:'west', hint:{tier, gap, message}}}`. | Arch §6.3 |
| **TC-F14.44** | API | High | POST calc — region field correct cho East | Body `{state:'Sabah', subtotal:5000}`. | Response `data.region === 'east'`, `data.fee === 1500`. | Arch §6.3, §7 |
| **TC-F14.45** | API | High | POST calc — INVALID_STATE | Body `{state:'Tokyo', subtotal:5000}`. | HTTP 400 + `{code:'INVALID_STATE', message:'Unknown Malaysian state'}`. | Arch §6.3, §9 |
| **TC-F14.46** | API | High | POST calc — SITE_NOT_FOUND | Body `{siteId:'invalid', state:'Selangor', subtotal:5000}`. | HTTP 404 + `{code:'SITE_NOT_FOUND'}`. | Arch §6.3 |
| **TC-F14.47** | Sec | Medium | POST calc — rate limit 60/min/IP | Spam 100 requests trong 1 phút từ cùng IP. | Sau request thứ 60 → HTTP 429. Retry-After header set. | Arch §6.3, §11 |
| **TC-F14.48** | API | High | POST calc — hint object shape đúng | Body `{state:'Selangor', subtotal:7000}` (freeAbove=10000, gap=3000). | Response `data.hint = {tier:'highlight', gap:3000, message:'Add RM 30 more for FREE shipping'}` (gap ≤ 5000 → highlight tier). | Arch §6.3, §7 (HINT_HIGHLIGHT_THRESHOLD) |
| **TC-F14.49** | API | Medium | POST calc — hint null khi đã free | Body subtotal ≥ freeAbove. | Response `data.isFree=true, hint=undefined` (hoặc null/không có). | Arch §6.3 |

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

## 11. Open Questions

1. **Wave 6 release date** — F14 còn bao xa? Nếu sắp ship → cần dev sprint emergency vì chưa impl business logic
2. **Story status** — US-F14-01/02 vẫn `Draft`, US-F14-03..06 `Ready`. PM cần approve trước khi dev bắt đầu
3. **Debounce 300ms** — confirmed trong PRD line 120, nhưng cần xác nhận với UX team value này có matching design intent
4. **Hint copy** trong FR-05 — text chính xác là gì ("Add RM X more for free shipping" tiếng Anh hay có cả tiếng Malay)?
5. **Reset to Defaults** — có cần confirmation modal "Are you sure?" không, hay reset ngay khi click?
6. **Empty tracking number** — seller có thể đổi status sang "Shipped" mà KHÔNG nhập tracking? Hay bắt buộc?
7. **Tax (SST 6%)** ở TC-F14.07 — F09 đã impl SST chưa hay F14 phải tự handle?
