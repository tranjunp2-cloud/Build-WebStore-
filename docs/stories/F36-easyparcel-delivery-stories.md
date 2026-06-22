# User Stories: EasyParcel Delivery Integration (F36)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F36 — EasyParcel Delivery Integration (Malaysia)
> **Wave:** 7 | **Priority:** P1 | **Ref PRD:** [F36-easyparcel-delivery.md](../prd/F36-easyparcel-delivery.md)
> **Provider:** EasyParcel (aggregator MY) — per-merchant API key, non-custody, platform RM0.
> **Depends on:** F09 Storefront ✅, F10 Order lifecycle + cancel-restock ✅, F34 Xendit Payment (song hành).

> [!IMPORTANT]
> **Guardrail xuyên suốt:** Platform KHÔNG giữ/markup tiền cước hay COD. Mọi call EasyParcel dùng API key của merchant → cước trừ ví merchant. Giá hiển thị = raw EasyParcel (RM→sen ×100), không markup.
> **Currency (NFR-1):** internal lưu **sen**; EasyParcel dùng **RM**. `/100` khi gửi, `×100` khi nhận. Sai = lệch 100× → mọi story đụng tiền BẮT BUỘC có test chống regression.

---

## US-F36-01: Connect EasyParcel Account (API Key + Warehouse)

**Wave 7** | **P0** | **L** | **Status:** Draft

### Story

```
As a   SME Owner
I want dán API key + auth key EasyParcel và nhập địa chỉ kho (origin) trong settings/shipping
So that shop của tôi tính được cước thật và mua được nhãn vận đơn qua tài khoản EasyParcel riêng
```

> **Warehouse = Prime source of truth (KHÔNG sync từ EP):** EasyParcel API không có endpoint đọc địa chỉ kho/sender từ account → merchant nhập 1 lần trong Prime, dùng cho **cả** rate-check **lẫn** label/pickup. KHÔNG cần set gì trên dashboard EP. Postcode kho **force validate** ngay tại Test connection. Nguồn: `plans/reports/researcher-260617-1107-easyparcel-address-sync.md`.

### Acceptance Criteria

#### AC-1: Test connection thành công → lưu key + list courier

```gherkin
GIVEN tenant chưa connect, mở settings/shipping > tab "EasyParcel"
  AND nhập api_key + auth_key (2 ô) — KHÔNG có ô chọn environment
  AND điền warehouse address (line1/2, city, state, postcode, country=MY)
WHEN  bấm "Test connection"
THEN  backend tự dò env: gọi EPRateCheckingBulk bằng CHÍNH warehouse postcode trên production trước, FAIL → thử demo
  AND env nào validate → warehouse postcode coi như hợp lệ (force validate)
  AND lưu config vào tenant.easyParcelIntegration (api_key, auth_key, warehouse, detectedEnv)
  AND trả về danh sách courier khả dụng để chọn (single-select)
  AND hiển thị toast "EasyParcel connected"
```

> 📌 Source: PRD FR A-1, A-2, A-6 + §10 verify note #1 (2 key) + #3 (demo dùng HTTPS `https://demo.connect.easyparcel.my/?ac=`)

#### AC-2: Key sai → KHÔNG lưu, báo lỗi rõ

```gherkin
GIVEN nhập api_key hoặc auth_key sai
WHEN  bấm "Test connection"
THEN  backend trả error code "EASYPARCEL_INVALID_KEY"
  AND hiển thị inline error "API key hoặc auth key không hợp lệ"
  AND config KHÔNG được lưu (tenant không kẹt trạng thái sai)
  AND key KHÔNG bị lộ ra response/log
```

> 📌 Source: PRD FR A-2, A-8, NFR-3

#### AC-3: Warehouse postcode sai → KHÔNG lưu (force validate)

```gherkin
GIVEN key hợp lệ nhưng warehouse postcode không gửi được từ EasyParcel (origin invalid)
WHEN  bấm "Test connection"
THEN  backend trả error code "EASYPARCEL_INVALID_WAREHOUSE"
  AND inline error "Địa chỉ kho không hợp lệ — kiểm tra lại postcode"
  AND config KHÔNG được lưu (không cho connect với origin sai)
```

> 📌 Source: PRD FR A-2 (force validate warehouse)

#### AC-4: IDOR — chỉ owner tenant sửa được

```gherkin
GIVEN user A không thuộc tenant của site
WHEN  user A gửi PATCH settings/shipping của tenant đó
THEN  trả 403 Forbidden (mirror hasSiteAccess)
  AND DB không thay đổi
```

> 📌 Source: PRD FR A-6, NFR-3

### Additional Criteria

- [ ] Form 2 ô key riêng (api_key + auth_key) — không gộp 1 ô. KHÔNG có selector environment.
- [ ] Auto-detect env: thử production trước, fail → demo; lưu `detectedEnv`. 2 base URL (HTTPS) vẫn là const trong code.
- [ ] Warehouse = Prime SoT: 1 field `warehouse` dùng cho cả rate (`pick_code/pick_state`) lẫn label/pickup (`pick_*`). KHÔNG sync từ EP, KHÔNG đọc từ dashboard EP.
- [ ] Warehouse form dùng **geo cascade có sẵn**: State → City → Postcode = 3 dropdown qua `/api/geo/{states,districts,postcodes}` (dataset `malaysia_*` đã seed); chỉ `line1/2` free text. KHÔNG dựng dataset mới.
- [ ] **Recommend (DRY):** tách cascade inline của checkout thành component dùng chung (`AddressCascadeFields`) — quyết lúc implement; fallback gọi thẳng 4 endpoint geo nếu né đụng checkout.
- [ ] Force validate warehouse postcode tại Test connection (dùng chính origin trong rate-check); sai → `EASYPARCEL_INVALID_WAREHOUSE`, không lưu.
- [ ] Cân nhắc encrypt at-rest cho 2 key; không có secret global trong code (chỉ const base URL).
- [ ] EasyParcel API timeout/5xx → error code rõ, không crash settings.

### Market Notes

- MY SME hầu hết đã có sẵn tài khoản EasyParcel (~70k SME) → flow "dán key" quen thuộc, không OAuth.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Cột mới của `easyParcelIntegration` → `scripts/db-setup.js` MIGRATIONS (CI gate) (NFR-9)
- [ ] Test: invalid key không lưu; IDOR 403; key không lộ trong log/response

---

## US-F36-02: Courier Selection (Single)

**Wave 7** | **P0** | **S** | **Status:** Draft

### Story

```
As a   SME Owner đã connect EasyParcel
I want chọn 1 courier cho shop
So that shop tôi giao qua đúng 1 hãng courier
```

### Acceptance Criteria

#### AC-1: Chọn 1 courier (single-select) cho shop

```gherkin
GIVEN tenant đã connect, thấy list courier khả dụng (courier_id, courier_name, logo)
WHEN  chọn 1 courier (radio single-select, map theo courier_id)
THEN  lưu selectedCourier (single courier_id) vào tenant.easyParcelIntegration
  AND chỉ 1 courier active mỗi lúc (chọn cái mới → bỏ cái cũ)
  AND checkout chỉ rate + hiển thị đúng courier đã chọn
```

> 📌 Source: PRD FR A-3 + §10 RESOLVED (map theo `courier_id`, hiển thị `courier_name`+logo, mua label bằng `service_id`)

#### AC-2: Default J&T + top 3 badge + gập phần còn lại

```gherkin
GIVEN merchant vừa connect xong (list courier trả về từ EasyParcel)
WHEN  render section Courier
THEN  default chọn J&T Express (#1 SME); top 3 (J&T, Pos Laju, Flash) có badge "Phổ biến SME"
  AND courier còn lại (Ninja Van, DHL, City-Link...) gập trong "＋ Xem thêm courier"
  AND merchant chọn lại tự do (vẫn single-select)
  AND chỉ default những mã top 3 mà account merchant thực sự có
```

> 📌 Source: PRD FR A-3 + `plans/reports/researcher-260617-1150-my-sme-top-couriers.md` (top 3 SME: J&T market leader, Pos Laju phủ East MY, Flash giá rẻ nhất — cả 3 support COD)

### Additional Criteria

- [ ] `selectedCourier` = single field (courier_id), KHÔNG hasMany. Chưa chọn → default J&T.
- [ ] KHÔNG show giá ở settings; KHÔNG còn section "Default parcel" (đã bỏ — weight lấy từ Products.weight/dimensions, fallback hằng số hệ thống).
- [ ] KHÔNG có setting label mode (tạo label luôn manual ở Phase C); KHÔNG show số dư ví EP.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Cột mới (`selectedCourier`) → MIGRATIONS (NFR-9)
- [ ] Test: single-select (chọn mới bỏ cũ); checkout chỉ rate courier đã chọn

---

## US-F36-03: Hybrid Fallback to Flat Rate

**Wave 7** | **P0** | **S** | **Status:** Draft

### Story

```
As a   system (business rule)
I want checkout tự dùng flat West/East khi tenant chưa bật/chưa cấu hình đủ EasyParcel
So that merchant cũ không bị vỡ checkout khi feature ra mắt
```

### Acceptance Criteria

#### AC-1: enabled=false → flat rate

```gherkin
GIVEN tenant.easyParcelIntegration.enabled = false (hoặc thiếu key/warehouse)
WHEN  buyer tới checkout
THEN  getRates() dùng nhánh flat West/East (getShippingRate hiện tại)
  AND checkout hiển thị 1 fee như cũ, KHÔNG vỡ
```

> 📌 Source: PRD FR A-7, NFR-4

#### AC-2: Cấu hình thiếu → vẫn fallback, không lỗi

```gherkin
GIVEN tenant enabled=true nhưng thiếu warehouse postcode HOẶC chưa chọn courier (`selectedCourier` rỗng)
WHEN  buyer tới checkout
THEN  getRates() fallback flat rate (không gọi EasyParcel với input thiếu)
  AND log cảnh báo cấu hình thiếu (không lộ key)
```

> 📌 Source: PRD FR A-7, NFR-4

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Flat-rate logic (`calculate-fee.ts` + `constants.ts`) giữ nguyên 0 phá hành vi
- [ ] Test: enabled=false + cấu hình thiếu đều ra flat rate

---

## US-F36-04: Real-Time Rate Calculation (Backend)

**Wave 7** | **P0** | **L** | **Status:** Draft

### Story

```
As a   buyer tại checkout
I want hệ thống tính cước thật của courier shop dùng dựa trên cân nặng + origin/dest postcode
So that tôi thấy đúng giá ship trước khi trả tiền
```

### Acceptance Criteria

#### AC-1: EasyParcel ON → trả phí ship 1 courier (shop chọn)

```gherkin
GIVEN tenant EasyParcel ON + đã chọn selectedCourier
  AND POST /api/orders/calculate-shipping { siteId, dest postcode/state, items }
WHEN  getRates() chạy
THEN  tính tổng weight = sum(Products.weight × qty); product = 0/thiếu → hằng số DEFAULT_PARCEL
  AND gọi EPRateCheckingBulk(origin warehouse, dest, weight, dims) cho selectedCourier
  AND trả { courier, serviceId, fee(sen), eta } của đúng courier shop chọn (KHÔNG mảng nhiều courier)
```

> 📌 Source: PRD FR B-1, B-2

#### AC-2: Currency RM→sen đúng, KHÔNG markup

```gherkin
GIVEN EasyParcel trả price = RM 8.00 cho 1 service
WHEN  normalize giá
THEN  compute nội bộ = 800 sen (×100 chính xác); order.shippingFee lưu = 8.00 RM-float (đồng nhất `total`), KHÔNG lưu 800 vào cột (lệch 100×)
  AND giá = raw EasyParcel (KHÔNG cộng markup)
```

> 📌 Source: PRD FR B-6, NFR-1, §8 Phase B AC#5

#### AC-3: Lưu courier vào order ở mọi nhánh checkout

```gherkin
GIVEN order với courier shop đã chọn (selectedCourier)
WHEN  tạo order qua /api/orders/checkout (COD/bank) HOẶC stripe-checkout (nhánh Xendit thuộc F34, nhánh riêng — wire khi F34 merge)
THEN  order lưu shippingCourier + shippingServiceId + shippingFee (RM-float, đồng nhất field hiện tại)
  AND các nhánh checkout hiện có đều persist 3 field này
```

> 📌 Source: PRD FR B-4

#### AC-4: OFF → flat fee đơn (giữ shape cũ)

```gherkin
GIVEN tenant EasyParcel OFF
WHEN  calculate-shipping chạy
THEN  trả flat fee đơn, shape tương thích cũ (không phá client cũ)
```

> 📌 Source: PRD FR B-2

### Additional Criteria

- [ ] Tổng weight = sum(`Products.weight` × qty); product = 0/thiếu → hằng số `DEFAULT_PARCEL` (const trong code, KHÔNG field per-tenant).
- [ ] **Snapshot `parcelWeight` (gram) lên order lúc checkout** = tổng weight đã tính → modal Ready-to-Ship đọc lại, KHÔNG re-join Products (order items KHÔNG snapshot weight/dims).
- [ ] Rate p95 < 4s (NFR-6); quá timeout → fallback (xem US-F36-05 AC-2).

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test currency: RM8 → 800 sen (chống regression 100×) — BẮT BUỘC (NFR-1)
- [ ] Test: các nhánh checkout hiện có (checkout + stripe; Xendit khi F34 merge) đều lưu shippingCourier/serviceId/fee
- [ ] Cột order mới (shippingCourier, shippingServiceId, parcelWeight) → MIGRATIONS (NFR-9)

---

## US-F36-05: Checkout Shipping Fee Display (Single Courier)

**Wave 7** | **P0** | **S** | **Status:** Draft

### Story

```
As a   buyer tại checkout
I want thấy phí ship thật trong Order Summary
So that tôi biết tổng tiền chính xác trước khi đặt (không phải chọn courier)
```

### Acceptance Criteria

#### AC-0: Shipping address reuse cascade F14

```gherkin
GIVEN buyer ở bước nhập địa chỉ checkout
WHEN  render form địa chỉ
THEN  dùng lại cascade State → City → Postcode của F14 (/api/geo/* + CheckoutForm)
  AND KHÔNG dựng form/endpoint geo mới
```

> 📌 Source: PRD FR B-0

#### AC-1: phí ship → 1 dòng "Shipping" trong Order Summary

```gherkin
GIVEN calculate-shipping trả phí của courier shop chọn (selectedCourier)
WHEN  checkout render
THEN  Order Summary hiển thị 1 dòng "Shipping: giá thật"
  AND KHÔNG có section vận chuyển (buyer không thấy/không chọn courier)
  AND KHÔNG có dòng SST (gỡ ở checkout từ F33 phase-06)
  AND phí + total đúng (total = subtotal − discount + shipping); lưu vào order khi đặt
```

> 📌 Source: PRD FR B-3

#### AC-2: Rate API lỗi/timeout → fallback flat, KHÔNG chặn checkout

```gherkin
GIVEN EasyParcel rate API timeout (>4s) hoặc lỗi
WHEN  buyer ở bước shipping
THEN  checkout tự fallback flat West/East
  AND buyer vẫn đặt được hàng (KHÔNG chặn)
  AND log cảnh báo (không lộ key)
```

> 📌 Source: PRD FR B-5, NFR-4, NFR-6

#### AC-3: Free-shipping threshold áp lên phí ship

```gherkin
GIVEN merchant bật freeAbove = RM 100 + cart subtotal >= RM 100
WHEN  render phí ship
THEN  phí ship hiển thị "FREE" (fee = 0)
```

> 📌 Source: PRD FR B-7

#### AC-4: Fallback → UI fee đơn như cũ

```gherkin
GIVEN tenant OFF (chỉ 1 flat option)
WHEN  checkout render
THEN  hiển thị 1 fee flat (UI hiện tại)
```

> 📌 Source: PRD FR B-3, §8 Phase B AC#2

### Additional Criteria

- [ ] Mobile: dòng "Shipping" trong Order Summary đọc rõ.
- [ ] Loading state khi đang gọi rate (spinner cạnh "Shipping").

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test: Order Summary có 1 dòng "Shipping" đúng giá, KHÔNG dòng SST; timeout → flat fallback không chặn

---

## US-F36-06: Create Shipping Label (qua nút "Ready to Ship")

**Wave 7** | **P0** | **L** | **Status:** Draft

### Story

```
As a   SME Owner
I want bấm "Ready to Ship" (nút có sẵn) để mua nhãn (AWB) ngay trong order detail
So that tôi không cần màn tạo vận đơn riêng, cước trừ thẳng ví EasyParcel của tôi
```

### Acceptance Criteria

#### AC-1: Tạo label thành công (2 bước submit→pay) qua nút "Ready to Ship"

```gherkin
GIVEN order đã paid/confirmed, EP tenant, merchant mở order trong OrderDetailPanel (có sẵn)
WHEN  bấm "Ready to Ship" → mở modal (prefill weight/dims) → POST /api/orders/[id]/create-label
THEN  gọi EPSubmitOrderBulk (giữ chỗ) → EPPayOrderBulk (trừ ví + sinh AWB) bằng api key merchant
  AND trừ ví EasyParcel merchant
  AND lưu awbNo + labelUrl + easyParcelOrderNo + trackingNumber=awbNo
  AND order → ready_to_ship (KHÔNG có màn/route "Tạo vận đơn" riêng)
  AND merchant thấy nút in label (labelUrl)
```

> 📌 Source: PRD FR C-1, C-6 + §10 verify note #2 (label = 2 bước)

#### AC-2: Idempotent — chặn tạo label lần 2

```gherkin
GIVEN order đã có awbNo
WHEN  gọi create-label lần 2
THEN  bị chặn (KHÔNG gọi EPPayOrderBulk lại)
  AND KHÔNG trừ ví lần 2
  AND trả về AWB/label đã có
```

> 📌 Source: PRD FR C-2, NFR-2 (idempotency khóa theo bước **pay**)

#### AC-3: Ví hết tiền → order không đổi, retry được

```gherkin
GIVEN ví EasyParcel merchant không đủ credit
WHEN  bấm "Tạo vận đơn"
THEN  trả error "EASYPARCEL_WALLET_LOW" + link nạp ví EasyParcel
  AND order KHÔNG đổi trạng thái
  AND merchant retry được sau khi nạp ví
```

> 📌 Source: PRD FR C-3, NFR-7

#### AC-4: Non-EP giữ ShipOrderModal manual (config-driven, KHÔNG tab toggle)

```gherkin
GIVEN tenant CHƯA bật EasyParcel (chưa connect)
WHEN  merchant bấm "Ship Order" → ShipOrderModal
THEN  hiển thị nhánh nhập trackingNumber thủ công như HÔM NAY (0 đổi)
  AND order → shipped require trackingNumber (giữ validation hiện có)
  AND KHÔNG có tab toggle [EasyParcel | manual] — nhánh do config tenant quyết
  AND EP tenant: "Ship Order" = xác nhận pickup → shipped, KHÔNG nhập tracking (AWB đã có)
```

> 📌 Source: PRD FR C-5, C-6

### Additional Criteria

- [ ] Create-label p95 < 6s (NFR-6).
- [ ] Modal **KHÔNG hiển thị courier** (đã khoá 1 courier; dùng `selectedCourier` ngầm). Hiển thị: weight (prefill `order.parcelWeight`, sửa được) + dims thùng (prefill `DEFAULT_PARCEL`/dims SP nếu đơn 1 món, sửa được — KHÔNG cộng dims đa-SP) + pickup date + nút in label sau OK.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test idempotent: order có awbNo → KHÔNG double-charge ví (NFR-2) — BẮT BUỘC
- [ ] Test: wallet low → order không đổi + error code đúng
- [ ] Cột order mới (awbNo, labelUrl, easyParcelOrderNo) → MIGRATIONS (NFR-9)

---

## US-F36-07: Pickup / Dropoff

**Wave 7** | **P1** | **S** | **Status:** Draft

### Story

```
As a   SME Owner
I want chọn pickup (courier tới lấy) hoặc dropoff khi tạo label
So that hàng được lấy theo lịch phù hợp với shop
```

### Acceptance Criteria

#### AC-1: Pickup/dropoff — collection_date với date-picker rule đúng

```gherkin
GIVEN merchant tạo label trong modal Ready-to-Ship
WHEN  chọn pickup (default) HOẶC dropoff + chọn ngày lấy
THEN  pickup truyền collection_date (YYYY-MM-DD, giờ MY UTC+8) trong EPSubmitOrderBulk
  AND KHÔNG gọi endpoint EPPickUpBooking (không tồn tại trong API)
  AND dropoff vẫn truyền collection_date (tùy courier)
```

#### AC-2: Date picker CUT-OFF-AWARE (same-day nếu trước cut-off; chặn quá khứ)

```gherkin
GIVEN merchant mở date picker pickup, shop đã khoá selectedCourier
WHEN  render (tính giờ hiện tại theo MYT/UTC+8, server-side)
THEN  min = HÔM NAY nếu hôm nay là T2–T6 VÀ giờ MYT < cut-off(selectedCourier)
  AND ngược lại (sau cut-off / cuối tuần) min = ngày làm việc kế
  AND default = min
  AND disable mọi ngày quá khứ (KHÔNG cho chọn ngày quá khứ — bug hiện tại) + Sat/Sun
  AND public holiday để API tự bump (KHÔNG build lịch lễ MY cho MVP)
  AND KHÔNG có time picker
  AND server validate format YYYY-MM-DD; gửi sau cut-off → API âm thầm bump (không vỡ)
```

> 📌 Source: PRD FR C-4, C-4c + `plans/reports/researcher-260617-1426-courier-cutoff-verify.md` (EasyParcel chấp nhận same-day; cut-off J&T 13:50 / Flash 14:00 / Pos 12:50)

#### AC-3b: Server re-validate đúng SLA (khóa 2 lớp, không tin client)

```gherkin
GIVEN 1 helper earliestPickupDate(courier, nowMYT) dùng chung picker + server
WHEN  merchant submit create-label với collection_date
THEN  server re-tính earliest theo MYT tại thời điểm request (KHÔNG tin date client gửi)
  AND nếu collection_date < earliest (vd mở modal trước cut-off, bấm sau cut-off)
        → clamp lên earliest + trả về ngày đã dời để UI báo "đã dời sang DD/MM"
  AND KHÔNG bao giờ gửi same-day sai SLA xuống EasyParcel
```

> 📌 Source: PRD FR C-4d (picker client chỉ là UX; server là chốt chặn SLA)

#### AC-3: Cut-off per courier (config + verify Pos)

```gherkin
GIVEN const COURIER_CUTOFF (MYT): J&T 13:50, Flash 14:00, Pos Laju 12:50 (conservative)
WHEN  courier khác / chưa biết cut-off
THEN  fallback conservative (vd 12:00 hoặc chỉ cho ngày làm việc kế)
  AND Pos Laju cut-off PHẢI confirm với Pos/EasyParcel trước go-live
  AND đặt task re-verify cut-off ~cuối 2026 (hardcode, không có API auto-fetch)
```

> 📌 Source: PRD FR C-4c

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Date picker cut-off-aware: same-day trước cut-off (T2–T6), ngược lại ngày làm việc kế; tính giờ MYT server-side
- [ ] Test: trước cut-off → hôm nay chọn được; sau cut-off → min=ngày mai; KHÔNG submit được ngày quá khứ
- [ ] **Helper `earliestPickupDate(courier, nowMYT)` dùng chung picker + server** (DRY, 1 nguồn sự thật)
- [ ] **Test server re-validate:** submit date < earliest → clamp lên earliest + báo ngày đã dời; KHÔNG gửi same-day sai SLA
- [ ] `COURIER_CUTOFF` const + TODO verify Pos Laju + re-verify cuối 2026

---

## US-F36-08: COD via EasyParcel — Eligibility, Checkout & Label Creation

**Wave 7** | **P1** | **L** | **Status:** Draft

### Story

```
As a   buyer ở West Malaysia
I want chọn COD (trả tiền mặt khi nhận) tại checkout khi courier shop hỗ trợ và đơn trong giới hạn
So that tôi mua hàng không cần thanh toán trước, và merchant tạo label COD qua EasyParcel để courier thu hộ
```

> **Couriers hỗ trợ COD (West MY only):** J&T Express, DHL eCommerce, Flash Express, Aramex. Pos Laju, SPX Express, City-Link KHÔNG hỗ trợ.
> **"Confirmed but unpaid" model:** COD order tạo với `paymentStatus='unpaid'` — tiền chưa thu tại checkout. Merchant nhận tiền sau khi courier settle qua EasyParcel dashboard.
> **Platform RM0:** platform không đụng tiền COD; không build reconciliation; merchant tự withdraw trên EasyParcel.

### Acceptance Criteria

#### AC-1: COD eligibility gating — hiện tùy chọn đúng điều kiện

```gherkin
GIVEN buyer đã nhập địa chỉ + rate đã tính xong
WHEN  render payment options tại checkout
THEN  COD option ENABLED chỉ khi ĐỒNG THỜI:
        (1) zone của địa chỉ buyer = 'west' (từ /api/geo/lookup/[postcode])
        (2) selectedCourier có cod_service_available = true trong rate response (J&T, DHL, Flash, Aramex)
        (3) order grand total >= RM5.01 (min COD)
        (4) order grand total <= RM7,000 (max COD)
  AND thiếu bất kỳ điều kiện nào → COD option disabled với helper text lý do cụ thể
```

> 📌 Source: PRD FR C-6a

#### AC-2: COD disabled — helper text đúng theo từng lý do

```gherkin
GIVEN buyer East MY (Sabah/Sarawak)
WHEN  render payment options
THEN  COD disabled + helper "COD chỉ khả dụng cho địa chỉ West Malaysia"

GIVEN buyer West MY nhưng selectedCourier là Pos Laju (không hỗ trợ COD)
WHEN  render payment options
THEN  COD disabled + helper "Courier đang chọn không hỗ trợ COD"

GIVEN buyer West MY + courier hỗ trợ nhưng total > RM7,000
WHEN  render payment options
THEN  COD disabled + helper "Đơn vượt hạn mức COD (RM7,000)"

GIVEN buyer West MY + courier hỗ trợ nhưng total < RM5.01
WHEN  render payment options
THEN  COD disabled + helper "Giá trị đơn tối thiểu để dùng COD là RM5.01"
```

> 📌 Source: PRD FR C-6a, design §2.2 COD disabled states

#### AC-3: COD selected → order tạo đúng fields

```gherkin
GIVEN buyer đủ điều kiện + chọn COD tại checkout
WHEN  bấm Place Order
THEN  order tạo với:
        paymentMethod = 'cod'
        codAmount     = snapshot grand total (sen, KHÔNG recalculate sau)
        codStatus     = 'pending' (default)
        paymentStatus = 'unpaid'
  AND codAmount (RM) = codAmount (sen) / 100 (khi hiển thị)
  AND "confirmed but unpaid" — tiền không thu tại đây
```

> 📌 Source: PRD FR C-6b, C-6c, NFR-1

#### AC-4: COD fee disclosure (informational)

```gherkin
GIVEN buyer chọn COD
WHEN  render payment section
THEN  hiển thị <Alert> thông tin phí COD max(flat, 4%) theo courier đã chọn
        Flash: RM5 hoặc 4%; DHL: RM6 hoặc 4%; J&T: RM7 hoặc 4%; Aramex: RM10 hoặc 4%
  AND phí là informational — merchant chịu, trừ từ tiền thu hộ
  AND platform KHÔNG thu/markup phí này
```

> 📌 Source: PRD FR C-6d

#### AC-5: Create label COD — gửi flag COD + codAmount

```gherkin
GIVEN order paymentMethod='cod' + buyer West MY + codAmount trong giới hạn courier
WHEN  merchant tạo label qua modal Ready to Ship → POST /api/orders/[id]/create-label
THEN  EPSubmitOrderBulk gửi cod_enabled=true + cod_amount (RM = codAmount/100)
  AND modal hiện COD badge + "Thu hộ: RM X" + fee note trước khi confirm
  AND codStatus = 'pending' (unchanged — tiền chưa thu)
  AND cước ship vẫn trừ ví merchant (tách biệt khỏi COD amount)

NOTE: tên param cod_enabled + cod_amount CHƯA confirmed — verify sandbox trước go-live (§11 item #1)
```

> 📌 Source: PRD FR C-6e, §11 item #1

#### AC-6: COD East MY tại create-label → block

```gherkin
GIVEN order COD nhưng địa chỉ East MY (Sabah/Sarawak)
WHEN  merchant mở modal Ready to Ship
THEN  hiển thị block "EasyParcel COD chỉ West Malaysia"
  AND nút tạo label disabled
  AND merchant phải xử lý thủ công (đổi phương thức hoặc cancel)
```

> 📌 Source: PRD §8 Phase C AC#5, design §2.3 COD East MY state

#### AC-7: COD không thu được (buyer từ chối / returned)

```gherkin
GIVEN order COD + shippingTrackingStatus = 'Returned' (buyer từ chối / giao fail)
WHEN  cron update tracking
THEN  codStatus giữ nguyên 'pending' (không thu được tiền)
  AND merchant thấy cảnh báo (cước mất + COD chưa thu)
  AND merchant bấm Refund (reuse endpoint F10) để xử lý
```

> 📌 Source: PRD Use Case E5, §8 Phase C AC#9

### Additional Criteria

- [ ] Phí COD max(flat, 4%) do EasyParcel trừ thẳng tiền thu hộ — platform KHÔNG đụng. Chỉ lưu `codAmount` (sen) trong DB.
- [ ] KHÔNG build reconciliation — merchant tự xem settlement trên dashboard EasyParcel. No API đối soát.
- [ ] COD settlement: courier settle → EasyParcel → merchant withdraw. J&T 7-12 ngày; Flash/DHL 1-3 ngày; Aramex 30 ngày + 3-4 ngày payout.
- [ ] `codAmount` = cột MỚI `cod_amount` (number, sen) trên `orders` — KHÔNG derive từ `total` (field `total` lưu RM-float); lưu nội bộ bằng **sen**, `/100` khi gửi EasyParcel (NFR-1). Sai = 100× error.
- [ ] `codStatus` field (display-only enum: `pending` / `collected` / `settled`) — cần entry `cod_status varchar` trong `scripts/db-setup.js` MIGRATIONS (NFR-9). KHÔNG là reconciliation engine.
- [ ] Tenant EP OFF: COD vẫn khả dụng nếu `site.paymentConfig.enableCod=true` — không thay đổi. Chỉ mất automation courier thu hộ (merchant tự thu COD tay).

### Market Notes

- COD vẫn phổ biến MY cho SME mới; giới hạn West MY là ràng buộc của EasyParcel COD service.
- Couriers hỗ trợ COD: J&T (phổ biến nhất), Flash (phí thấp nhất), DHL eCommerce (settle nhanh), Aramex (settle chậm nhất).
- Pos Laju — top courier MY nhưng KHÔNG hỗ trợ COD qua EasyParcel.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test AC-1: COD enabled đúng khi West MY + courier COD + total trong range
- [ ] Test AC-2: 4 disabled states — đúng helper text từng lý do
- [ ] Test AC-3: order fields codAmount (sen), codStatus='pending', paymentStatus='unpaid'
- [ ] Test AC-5: label payload gửi cod_enabled + cod_amount đúng; param name verify sandbox
- [ ] Test AC-6: East MY COD order → modal block + disable nút
- [ ] `cod_amount` (number, sen) + `cod_status` varchar → 2 cột mới trên `orders` → MIGRATIONS entries (NFR-9)

---

## US-F36-08b: COD Status Tracking (Merchant Display)

**Wave 7** | **P2** | **S** | **Status:** Draft

### Story

```
As a   SME Owner
I want xem trạng thái thu hộ COD (pending/collected/settled) trên order detail
So that tôi biết tiền COD đang ở bước nào mà không cần rời khỏi dashboard
```

> Đây là display-only story — KHÔNG có reconciliation API. Merchant update thủ công dựa trên EasyParcel dashboard. Giữ tối thiểu (KISS).

### Acceptance Criteria

#### AC-1: codStatus badge hiện trên order detail (merchant)

```gherkin
GIVEN order paymentMethod='cod' đang mở trong OrderDetailPanel
WHEN  merchant xem order detail
THEN  hiển thị codStatus badge gần block payment info:
        pending   → badge "COD — Đang chờ" (grey)
        collected → badge "COD — Đã thu" (blue)
        settled   → badge "COD — Đã đối soát" (green outline)
  AND badge chỉ hiện khi paymentMethod='cod' (ẩn với order non-COD)
  AND hiển thị codAmount: "Thu hộ: RM X.XX"
```

> 📌 Source: PRD FR C-6c, design §2.4 COD status badge

#### AC-2: Merchant update codStatus thủ công

```gherkin
GIVEN merchant đã nhận thông báo settlement từ EasyParcel dashboard
WHEN  merchant bấm nút update codStatus (inline action trong OrderDetailPanel)
THEN  PATCH /api/orders/[id] { codStatus: 'collected' | 'settled' }
  AND badge cập nhật ngay
  AND KHÔNG có transition ngược (collected → pending bị chặn)
```

> 📌 Source: PRD FR C-6c (display-only, merchant manual)

#### AC-3: codStatus không ảnh hưởng order lifecycle

```gherkin
GIVEN merchant update codStatus
WHEN  bất kỳ giá trị nào
THEN  order.status (pending/confirmed/shipped/completed/etc.) KHÔNG thay đổi
  AND paymentStatus KHÔNG auto-update (2 field độc lập)
```

### Additional Criteria

- [ ] KHÔNG có API EasyParcel đối soát → merchant tự xem EasyParcel dashboard và update thủ công.
- [ ] `codStatus` = cột scalar `cod_status varchar` trên `orders` table (KHÔNG array table) → MIGRATIONS entry (NFR-9).
- [ ] codStatus chỉ liên quan COD orders — default `null` cho non-COD orders.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test: badge hiện đúng 3 states; update thủ công PATCH OK; lifecycle không ảnh hưởng
- [ ] `cod_status` column → MIGRATIONS (NFR-9) — cùng entry với US-F36-08

---

## US-F36-09: Tracking Sync Cron + Tracking View (nhúng order detail)

**Wave 7** | **P1** | **L** | **Status:** Draft

### Story

```
As a   buyer
I want theo dõi trạng thái giao hàng (courier + AWB + status) trên trang đơn
So that tôi biết hàng đang ở đâu mà không cần hỏi shop
```

### Acceptance Criteria

#### AC-1: Cron poll tracking theo batch tenant

```gherkin
GIVEN có orders shipped/chưa completed có awbNo
WHEN  GET /api/cron/sync-tracking chạy (cron-secret auth, mỗi 30-60 phút)
THEN  gom orders group theo tenant (đúng api key)
  AND gọi EPParcelStatusBulk theo batch
  AND cập nhật shippingTrackingStatus = 1 trong 13 status chuẩn EasyParcel (đã normalize mọi courier)
  AND idempotent + backoff (không spam API)
```

> 📌 Source: PRD FR C-7, NFR-5

#### AC-2: Tracking nhúng order detail (KHÔNG màn riêng) + dual-field

```gherkin
GIVEN order có awbNo + shippingTrackingStatus
WHEN  buyer mở sites/[slug]/orders/[orderNumber]
THEN  làm giàu component có sẵn OtShippingCard + OtTimeline (KHÔNG dựng trang/scene mới)
  AND hiển thị courier + AWB + trạng thái tracking mới nhất
  AND order.status (lifecycle) tách khỏi shippingTrackingStatus (display) — dual-field
  AND merchant order detail (OrderDetailPanel) có badge tracking tương ứng
```

> 📌 Source: PRD FR C-8

#### AC-2b: 13 status EasyParcel → chỉ 4 gợi ý lifecycle (manual)

```gherkin
GIVEN shippingTrackingStatus thuộc 13 enum EasyParcel
WHEN  render tracking
THEN  In Transit / Out for Delivery / On Hold / Exception → CHỈ hiển thị, KHÔNG đổi order.status
  AND Collected → gợi ý merchant bấm shipped; Returned → refunded; Cancelled/Admin Cancel/Expired → cancelled
  AND mọi transition vẫn do merchant bấm tay (KHÔNG auto)
```

> 📌 Source: PRD §6.C dual-field table · `researcher-260617-1406-easyparcel-status-mapping.md`

#### AC-3: Delivered → KHÔNG auto-complete (manual)

```gherkin
GIVEN cron nhận trạng thái "delivered"
WHEN  cập nhật order
THEN  CHỈ update shippingTrackingStatus (field hiển thị)
  AND KHÔNG tự chuyển order sang completed
  AND merchant tự bấm "Completed" (giữ manual order lifecycle hiện tại)
```

> 📌 Source: PRD FR C-9

### Additional Criteria

- [ ] Không có webhook tracking → polling có độ trễ 30-60 phút (chấp nhận cho MVP).
- [ ] Cron auth bằng cron-secret; reject nếu thiếu/sai secret.
- [ ] KHÔNG show số dư ví EP / KHÔNG cron cảnh báo ví (đã bỏ); ví thiếu chỉ lộ khi tạo label fail (US-F36-06 AC-3).

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test: cron batch theo tenant dùng đúng api key; idempotent
- [ ] Cột order mới (shippingTrackingStatus) → MIGRATIONS (NFR-9)

---

## US-F36-10: Returns — Reverse Label + Reuse Refund

**Wave 7** | **P1** | **S** | **Status:** Draft

### Story

```
As a   SME Owner
I want (tuỳ chọn) tạo nhãn trả hàng reverse, rồi refund qua nút Refund có sẵn
So that tôi xử lý hàng trả mà KHÔNG cần hệ RMA mới — reuse refund + restock đã build
```

### Acceptance Criteria

#### AC-1: Reverse label (đảo origin↔dest) — nút mới cạnh Refund

```gherkin
GIVEN merchant bấm "Tạo nhãn trả hàng" (tuỳ chọn, EP tenant)
WHEN  gọi EPSubmitOrderBulk tạo ĐƠN MỚI đảo origin↔dest (pick = địa chỉ buyer, send = kho merchant)
THEN  lưu return AWB riêng
  AND buyer gửi hàng về → merchant nhận → bấm Refund (endpoint có sẵn) → refund + restock
  AND KHÔNG dựng Returns/RMA collection, KHÔNG buyer return-request UI
```

> 📌 Source: PRD FR D-1, D-2 + §10 RESOLVED (không có flag reverse native → tạo đơn mới đảo chiều)

#### AC-2: Không reverse label → refund qua endpoint có sẵn

```gherkin
GIVEN merchant không tạo nhãn (buyer tự gửi / nhận tay)
WHEN  buyer gửi hàng về, merchant nhận → bấm Refund (nút có sẵn)
THEN  refund + restock reuse /api/orders/[id]/refund (Stripe/manual) + restock atomic (KHÔNG logic mới)
```

> 📌 Source: PRD FR D-3

### Additional Criteria

- [ ] Reverse label API shape chưa chắc 100% → fallback "buyer tự gửi" nếu reverse fail.
- [ ] KHÔNG viết logic refund/restock mới — reuse `/api/orders/[id]/{refund,cancel}` đã có (F10).

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test: reverse tạo return AWB riêng; refund + restock reuse endpoint có sẵn (0 logic refund mới)

---

## US-F36-11: Cancel Refund by Label Status

**Wave 7** | **P0** | **M** | **Status:** Draft

### Story

```
As a   SME Owner
I want hủy đơn và refund đúng theo trạng thái nhãn vận đơn (chưa mua / đã mua / đã pickup)
So that tiền hàng và cước được xử lý công bằng, không thất thoát sai
```

### Acceptance Criteria

#### AC-1: Chưa mua label → /cancel có sẵn: refund full + restock

```gherkin
GIVEN order chưa mua label (chưa có awbNo)
WHEN  hủy đơn → POST /api/orders/[id]/cancel (F10, có sẵn)
THEN  refund FULL (tiền hàng + ship) + restock atomic ngay (reuse)
```

> 📌 Source: PRD FR D-4, §8 Phase D AC#3

#### AC-2: Đã mua label, chưa pickup → /refund có sẵn + message hủy cước

```gherkin
GIVEN order đã mua label nhưng chưa pickup
WHEN  hủy đơn → POST /api/orders/[id]/refund (có sẵn, Stripe/manual)
THEN  refund tiền HÀNG + restock (reuse)
  AND ship: message hướng dẫn merchant tự hủy shipment trên dashboard EasyParcel (credit hoàn ví)
  AND không có API cancel programmatic cho MVP
```

> 📌 Source: PRD FR D-5, D-6 + §10 RESOLVED (không có endpoint cancel → xử lý qua dashboard)

#### AC-3: Đã pickup → /refund có sẵn: refund hàng, cước mất

```gherkin
GIVEN order đã pickup
WHEN  hủy đơn → POST /api/orders/[id]/refund (có sẵn)
THEN  refund tiền hàng + restock (reuse)
  AND cước MẤT (không hoàn) — ghi rõ cho merchant
```

> 📌 Source: PRD FR D-5, §8 Phase D AC#5

#### AC-4: Refund tiền hàng KHÔNG qua EasyParcel

```gherkin
GIVEN bất kỳ case refund tiền hàng
WHEN  thực thi refund qua /api/orders/[id]/refund có sẵn
THEN  refund qua provider: Stripe (live) / manual (COD-bank) / Xendit (khi F34 xong)
  AND KHÔNG đi qua EasyParcel
```

> 📌 Source: PRD FR D-6

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test: 3 case (chưa label / chưa pickup / đã pickup) refund đúng nhánh
- [ ] Refund tiền hàng qua provider thanh toán, không qua EasyParcel

---

<!-- 12 stories (US-F36-01..11 + US-F36-08b) — full coverage PRD F36 FR A-1..D-6 + COD C-6a..C-6e. Map FR→Story: xem cột "Story" trong PRD §6. -->
```
