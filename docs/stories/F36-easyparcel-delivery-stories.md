# User Stories: EasyParcel Delivery Integration (F36)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F36 — EasyParcel Delivery Integration (Malaysia)
> **Wave:** 7 | **Priority:** P1 | **Ref PRD:** [F36-easyparcel-delivery.md](../prd/F36-easyparcel-delivery.md) (overview & index); phase details merged into [F14-shipping.md](../prd/F14-shipping.md), [F10-orders-management.md](../prd/F10-orders-management.md), [F19-store-configuration.md](../prd/F19-store-configuration.md)
> **Provider:** EasyParcel (aggregator MY) — per-merchant OAuth account, non-custody, platform RM0.
> **Depends on:** F09 Storefront ✅, F10 Order lifecycle + cancel-restock ✅, F34 Xendit Payment (song hành).

> [!IMPORTANT]
> **Guardrail xuyên suốt:** Platform KHÔNG giữ/markup tiền cước hay COD. Mọi call EasyParcel dùng OAuth token của merchant → cước trừ ví merchant. Giá hiển thị = raw EasyParcel (RM→sen ×100), không markup.
> **Currency (NFR-1):** internal lưu **sen**; EasyParcel dùng **RM**. `/100` khi gửi, `×100` khi nhận. Sai = lệch 100× → mọi story đụng tiền BẮT BUỘC có test chống regression.

---

## US-F36-01: Connect EasyParcel Account (OAuth 2.0 Authorization-Code)

**Wave 7** | **P0** | **L** | **Status:** Draft

### Story

```
As a   SME Owner
I want bấm "Connect with EasyParcel" để kết nối tài khoản EasyParcel qua OAuth
So that shop của tôi có quyền tính cước và mua nhãn vận đơn qua API, và tôi nhập địa chỉ kho (origin) trong settings
```

> **OAuth 2.0 Authorization-Code flow (not API keys):** Merchant never shares secrets. Workflow: merchant redirects to EasyParcel → logs in + grants scope → callback returns authorization code → backend exchanges code for access token (10h) + refresh token (1yr). Tokens stored securely per tenant, auto-refreshed on expiry.
>
> **Warehouses = Prime source of truth (KHÔNG sync từ EP):** EasyParcel OAuth doesn't return stored addresses → merchant enters multiple warehouse addresses (pickup points) in Prime, one marked as default (isDefault). Reused for rate-check + label/pickup operations. Force-validate via rate-check call.

### Acceptance Criteria

#### AC-1: OAuth redirect → token exchange → account connected

```gherkin
GIVEN tenant chưa kết nối, mở settings/shipping > tab "EasyParcel"
  AND bấm "Connect with EasyParcel ↗"
WHEN  GET /api/tenant/[id]/easyparcel-oauth-start (sets HttpOnly cookie ep_state_{tenantId})
  AND OAuth popup opens (https://api.easyparcel.com/oauth/login?client_id=...&redirect_uri=...&state=...)
  AND merchant logs in + grants scope
THEN  EasyParcel redirects callback to GET /api/easyparcel/oauth-callback with authorization code
  AND backend verifies nonce, then POSTs to https://api.easyparcel.com/oauth/token
        (grant_type=authorization_code, code, redirect_uri, Basic auth EASYPARCEL_CLIENT_ID:EASYPARCEL_CLIENT_SECRET)
  AND receives access_token (10h) + refresh_token (1yr) + expires_at
  AND stores securely in tenant.easyParcelIntegration (accessToken, refreshToken, tokenExpiresAt)
  AND calls GET /account/get_account_information to sync account name + email
  AND redirects to /settings/shipping?ep=connected
  AND settings page shows green "Connected — Account: [Name] (Live)" + wallet balance
  AND warehouse/courier selection sections unlock for input
```

> 📌 Source: PRD §8 (OAuth 2.0 Authorization-Code), spec v2026-03 _authentication.md

#### AC-2: Warehouse postcode force-validated at first save

```gherkin
GIVEN tenant connected via OAuth, now filling warehouse address
  AND entered address with city, state, postcode, country=MY
WHEN  bấm "Validate" hoặc "Save"
THEN  backend calls POST /api/tenant/[id]/easyparcel-test { syncWarehouse? } (rate-limited 3/60s/tenant)
  AND test call returns balance, accountName, accountEmail, pickupAddress → postcode valid, warehouse accepted
  AND test call fails → reject save with error "Postcode invalid or account not ready"
  AND config KHÔNG được lưu trước khi validate thành công
```

> 📌 Source: PRD FR A-2 (force validate warehouse)

#### AC-3: IDOR + session auth — chỉ owner tenant sửa được

```gherkin
GIVEN user A không thuộc tenant của site
WHEN  user A gửi PATCH settings/shipping của tenant đó
THEN  trả 403 Forbidden (mirror hasSiteAccess)
  AND DB không thay đổi
```

> 📌 Source: PRD FR A-6, NFR-3

#### AC-4: Token auto-refresh on 401

```gherkin
GIVEN access token sắp hết hạn (< 60s to expiry)
WHEN  backend makes rate/order call
THEN  backend auto-refreshes: POSTs to https://api.easyparcel.com/oauth/token với refresh_token (grant_type=refresh_token)
  AND gets new access_token
  AND uses new token for the call
  AND succeeds (idempotent)

AND GIVEN access token đã hết hạn hoàn toàn
WHEN  backend makes call lấy 401 Unauthorized
THEN  throws AUTH_EXPIRED error (needs reconnect)
```

> 📌 Source: spec v2026-03 _authentication.md (Refresh Token Flow)

### Additional Criteria

- [ ] Warehouses = Prime SoT: array of pickup addresses (id?, label?, phone, address1, address2?, city, state, postcode, country, isDefault?). One marked isDefault. Reused for all rate-check + label/pickup operations. KHÔNG sync từ EasyParcel.
- [ ] Warehouse array form: add/edit/delete UI with one default selector. Reuse `AddressCascadeFields` component for geo cascade (DRY). Line1 required, line2 optional, city required, state required (cascade), postcode required (5 digits), country hardcoded MY.
- [ ] Phone normalized to 60-prefix (e.g. "0122134567" → "60122134567").
- [ ] Force validate first-time save (or Validate button) → POST /api/tenant/[id]/easyparcel-test. Sai → error. Đúng → lưu. Edit sau không cần re-validate.
- [ ] OAuth tokens stored in `tenant.easyParcelIntegration`: accessToken*, refreshToken*, tokenExpiresAt*, tokenRefreshExpiresAt* (all server-only, access.read=false). Encrypt at-rest if possible; decrypt on use.
- [ ] Disconnect button: DELETE /api/tenant/[id]/easyparcel-disconnect — clears tokens, disables integration, keeps warehouse/courier config. Merchant can re-authorize anytime.
- [ ] Errors: OAuth flow errors (invalid state, user denied, invalid redirect_uri) → red Alert with retry. Network errors → generic "Failed to connect, retry" + details in logs only.

### Market Notes

- OAuth avoids storing merchant secrets. Security + compliance benefit (no key rotation needed, tokens expire automatically).
- Merchant never sees or manages keys — EasyParcel dashboard handles all auth lifecycle.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] `tenant.easyParcelIntegration.oauthTokens` (access, refresh, expires_at, connected_at) → `scripts/db-setup.js` MIGRATIONS (NFR-9)
- [ ] Test: OAuth callback success → tokens stored + page updates; token expired → auto-refresh OK; IDOR 403; warehouse postcode invalid → reject save

---

## US-F36-02: Courier Allowlist Selection (Multi-Select)

**Wave 7** | **P0** | **S** | **Status:** Draft

### Story

```
As a   SME Owner đã connect EasyParcel
I want chọn một hay nhiều courier để dùng cho shop
So that checkout tự lựa chọn courier rẻ nhất từ danh sách tôi cho phép
```

### Acceptance Criteria

#### AC-1: Chọn một hay nhiều courier (multi-select allowlist) cho shop

```gherkin
GIVEN tenant đã connect, thấy list courier khả dụng (courier_id, courier_name, logo)
WHEN  chọn một hay nhiều courier (checkbox multi-select, map theo courier_id)
THEN  lưu selectedCouriers[] (JSON array courier_ids) vào tenant.easyParcelIntegration
  AND multiple couriers active cùng lúc (allowlist); checkout chọn rẻ nhất trong danh sách
  AND UI default: recommend 1 courier, but allow any ≥1 selection
  AND isEpReady gate on allowlist length ≥ 1 (not 0)
```

> 📌 Source: Commit 722b47f0 (ep courier allowlist); allowlist model in get-rates.ts + easyparcel-save route

#### AC-2: List ALL live couriers từ EasyParcel (multi-select)

```gherkin
GIVEN merchant vừa connect xong
WHEN  render section Courier Selection
THEN  GET /api/tenant/[id]/easyparcel-couriers → fetch full live courier list (country=MY) + wallet
  AND list ALL returned couriers (no 4-courier restriction)
  AND each courier shows: courier name + logo + selection as checkbox (multi-select)
  AND default chọn J&T Express (nếu có, otherwise first available)
  AND merchant chọn ≥1 courier cho checkout (multi-select, not single)
  AND warn if wallet < RM10 (LOW_WALLET_THRESHOLD)
```

> 📌 Source: Commit 722b47f0 (courier-picker.tsx shows multi-select UI)

### Additional Criteria

- [ ] `selectedCouriers[]` = JSON array field (courier_ids), allowlist model. Chưa chọn → empty array. Gate: ≥1 required to enable EP (isEpReady).
- [ ] Legacy `selectedCourier` (single scalar, old) kept in schema for back-compat; coalesced by getAllowedCouriers() helper. Will be removed after all consumers migrate.
- [ ] GET /api/tenant/[id]/easyparcel-couriers → live courier list, wallet balance per currency.
- [ ] KHÔNG show giá ở settings; KHÔNG còn section "Default parcel" (đã bỏ — weight lấy từ Products.weight/dimensions, fallback hằng số hệ thống).
- [ ] KHÔNG có setting label mode (tạo label luôn manual ở Phase C); KHÔNG show số dư ví EP chi tiết (chỉ cảnh báo RM10 threshold).

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Cột mới (`selectedCouriers` JSON array) → MIGRATIONS (NFR-9). Legacy `selectedCourier` kept for back-compat, coalesced by helper.
- [ ] Test: multi-select (chọn 2+ couriers OK); checkout lấy rẻ nhất từ allowlist; isEpReady gate ≥1

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
GIVEN tenant enabled=true nhưng thiếu warehouse postcode HOẶC allowlist trống (selectedCouriers[] length < 1)
WHEN  buyer tới checkout
THEN  getRates() fallback flat rate (không gọi EasyParcel với input thiếu)
  AND log cảnh báo cấu hình thiếu (không lộ key)
```

> 📌 Source: PRD FR A-7, NFR-4; Commit 722b47f0 (isEpReady gate on allowlist ≥1)

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

#### AC-1: EasyParcel ON → trả phí ship (auto-cheapest từ allowlist)

```gherkin
GIVEN tenant EasyParcel ON + allowlist couriers ≥1 (selectedCouriers[])
  AND POST /api/orders/calculate-shipping { siteId, destPostcode/destState, items, codAmountSen? }
WHEN  getRates() chạy
THEN  tính tổng weight = sum(Products.weight × qty); product = 0/thiếu → hằng số DEFAULT_PARCEL
  AND aggregate weight: min floor 0.1 kg, round UP to 1 decimal
  AND normalize phone to 60-prefix (e.g. "0122134567" → "60122134567")
  AND gọi POST /open_api/2026-03/shipment/quotations (OAuth Bearer token) với:
        { shipment: [{ sender (warehouse), receiver (dest address), parcel_value(RM float), weight(kg), width?/length?/height?(cm) }] }
  AND trả rates[] array với { courier, serviceId, courierName, serviceName, priceSen, codAvailable, codMaxSen, estDelivery }
  AND filter rates to allowlist ∩ route-serving couriers
  AND NGOÀI RA nếu COD order (codAmountSen > 0) → further filter to COD-capable couriers
  AND pick cheapest từ candidates → return 1 rate (auto-selected for checkout)
  AND backward-compat field fee (single price)
```

> 📌 Source: Commit 722b47f0 (get-rates.ts allowlist filter + cheapest pick; COD filter)

#### AC-2: Currency RM→sen đúng, KHÔNG markup

```gherkin
GIVEN EasyParcel trả price = RM 8.00 cho 1 service trong rates[]
WHEN  normalize giá
THEN  compute nội bộ = 800 sen (×100 chính xác) để compare/discount logic
  AND order.shippingFee lưu = 8.00 RM-float (đồng nhất field `total`)
  AND codMaxSen = max COD (sen) × 1 to apply caps
  AND giá = raw EasyParcel (KHÔNG cộng markup)
  AND NFR-1: tất cả tiền dụng sen internally; RM khi gửi EP, sen khi nhận
```

> 📌 Source: PRD FR B-6, NFR-1, §8 Phase B AC#5 + brief

#### AC-3: Lưu courier vào order ở mọi nhánh checkout

```gherkin
GIVEN order với courier được lựa chọn tự động (cheapest từ allowlist serving route)
WHEN  tạo order qua /api/orders/checkout (COD/bank) HOẶC stripe-checkout (nhánh Xendit thuộc F34, nhánh riêng — wire khi F34 merge)
THEN  order lưu shippingCourier + shippingServiceId + shippingFee (RM-float, đồng nhất field hiện tại)
  AND các nhánh checkout hiện có đều persist 3 field này
  AND shippingCourier = courier_id được pick từ getRates() (auto-cheapest, không merchant-fixed)
```

> 📌 Source: PRD FR B-4; Commit 722b47f0 (auto-pick cheapest)

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

#### AC-1: phí ship + courier branding → 1 dòng "Shipping" trong Order Summary

```gherkin
GIVEN calculate-shipping trả rates[] với courier name + logo (auto-picked cheapest từ allowlist)
WHEN  checkout render
THEN  Order Summary hiển thị 1 dòng "Shipping: [Courier Logo] Courier Name — RM X.XX"
  AND KHÔNG có section vận chuyển picker (buyer không chọn courier — auto-pick cheapest từ allowlist)
  AND KHÔNG có dòng SST (gỡ ở checkout từ F33 phase-06)
  AND phí + total đúng (total = subtotal − discount + shipping); lưu vào order khi đặt
```

> 📌 Source: PRD FR B-3; Commit 722b47f0 (auto-cheapest at checkout)

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

> **⚠️ NOT BUILT (as of 2026-07-01) — Phase C only. Acceptance criteria are forward-looking; no code yet.**

### Acceptance Criteria

#### AC-1: Tạo label thành công (single submit, ví trừ ngay) qua nút "Ready to Ship"

```gherkin
GIVEN order đã paid/confirmed, EP tenant, merchant mở order trong OrderDetailPanel (có sẵn)
WHEN  bấm "Ready to Ship" → mở modal (prefill weight/dims) → POST /api/orders/[id]/create-label
THEN  gọi POST /shipment/submit_orders (OAuth Bearer token, wallet auto-deduct) → returns shipment_number + awb_number + tracking_url
  AND trừ ví EasyParcel merchant
  AND lưu shipmentNumber + awbNo + easyParcelOrderNo + trackingNumber=awbNo (awb_url/label PDF tới async qua webhook topic 2 hoặc POST /shipment/list)
  AND order → ready_to_ship (KHÔNG có màn/route "Tạo vận đơn" riêng)
  AND nút in label hiện khi awb_url đã có (async)
```

> 📌 Source: PRD FR C-1, C-6 + §8 (label = single submit, wallet auto-deduct)

#### AC-2: Idempotent — chặn tạo label lần 2

```gherkin
GIVEN order đã có awbNo
WHEN  gọi create-label lần 2
THEN  bị chặn (KHÔNG gọi /shipment/submit_orders lại — wallet already deducted)
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
- [ ] Modal **KHÔNG hiển thị courier** (dùng auto-picked courier từ `order.shippingCourier` ngầm; không merchant-selectable). Hiển thị: weight (prefill `order.parcelWeight`, sửa được) + dims thùng (prefill `DEFAULT_PARCEL`/dims SP nếu đơn 1 món, sửa được — KHÔNG cộng dims đa-SP) + pickup date + nút in label sau OK.

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

> **⚠️ NOT BUILT (as of 2026-07-01) — Phase C only. Acceptance criteria are forward-looking; no code yet.**

### Acceptance Criteria

#### AC-1: Pickup/dropoff — collection_date với date-picker rule đúng

```gherkin
GIVEN merchant tạo label trong modal Ready-to-Ship
WHEN  chọn pickup (default) HOẶC dropoff + chọn ngày lấy
THEN  pickup truyền collection_date (YYYY-MM-DD, giờ MY UTC+8) trong POST /shipment/submit_orders
  AND KHÔNG gọi endpoint pickup riêng (EasyParcel tự sắp theo collection_date)
  AND dropoff vẫn truyền collection_date (tùy courier)
```

#### AC-2: Date picker CUT-OFF-AWARE (same-day nếu trước cut-off; chặn quá khứ)

```gherkin
GIVEN merchant mở date picker pickup, order đã assign courier tự động (from allowlist)
WHEN  render (tính giờ hiện tại theo MYT/UTC+8, server-side)
THEN  min = HÔM NAY nếu hôm nay là T2–T6 VÀ giờ MYT < cut-off(auto-picked courier)
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
  AND auto-picked courier dùng cut-off từ const này
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

## US-F36-08: COD via EasyParcel — Eligibility & Checkout

**Wave 7** | **P1** | **L** | **Status:** Draft (Phase B: Checkout portion built; Phase C: Label creation deferred)

### Story

```
As a   buyer ở West Malaysia
I want chọn COD (trả tiền mặt khi nhận) tại checkout khi courier shop hỗ trợ và đơn trong giới hạn
So that tôi mua hàng không cần thanh toán trước
```

> **COD eligibility (R1–R5 verified rules):** NO hardcoded region block — COD eligibility follows rules **R1–R5 PER-ROUTE, LIVE from quotation response**. COD-capable couriers vary by route; picker filters to live `cod.available` couriers per-route; backend enforces R1–R5. See [F36 PRD §8](../prd/F36-easyparcel-delivery.md#8-key-api-contract-decisions-v2026-03-spec) for rule details + evidence.
> **"Confirmed but unpaid" model:** COD order tạo với `paymentStatus='unpaid'` — tiền chưa thu tại checkout. Merchant nhận tiền sau khi courier settle qua EasyParcel dashboard.
> **Platform RM0:** platform không đụng tiền COD; không build reconciliation; merchant tự withdraw trên EasyParcel.
>
> **References:**
> - Decision & validation: [decision-260702-1503-GH-1333-cod-handoff.md](../../plans/reports/decision-260702-1503-GH-1333-cod-handoff.md)
> - COD matrix evidence: [ep-cod-matrix-260702.md](../../plans/reports/ep-cod-matrix-260702.md)
> - Issue: [GH-1333](https://github.com/primeproduction/ech-prime-web-v2/issues/1333)

### Acceptance Criteria (Phase B — Checkout)

#### AC-1: COD eligibility gating — hiện tùy chọn đúng điều kiện

```gherkin
GIVEN buyer đã nhập địa chỉ + calculate-shipping trả rates[]
  AND rate response chứa codAvailable (boolean) + codMinSen + codMaxSen (per courier)
  AND auto-picked courier có sẵn từ getRates() result
WHEN  render payment options tại checkout
THEN  COD option ENABLED chỉ khi ĐỒNG THỜI (R1–R5 rules):
        (R3) auto-picked courier có codAvailable=true (live from quotation)
        (R2) order grand total ≥ codMinAmount của auto-picked courier (per-courier, live)
        (R1) order grand total ≤ codMaxAmount của auto-picked courier (per-courier, live)
  AND thiếu bất kỳ điều kiện nào (R1–R3) → COD option disabled với helper text lý do cụ thể
  AND NO region hardcode (R4) — follow live cod.available per-route per-courier
```

> 📌 Source: PRD FR C-6a; Commit 722b47f0 (auto-picked courier with COD filter)

#### AC-2: COD disabled — helper text đúng theo từng lý do

```gherkin
GIVEN auto-picked courier không hỗ trợ COD (cod.available=false ở quotation cho route này)
WHEN  render payment options
THEN  COD disabled + helper "Không có courier nào trong danh sách được chọn hỗ trợ COD cho địa chỉ này"

GIVEN total > max_cod_amount của auto-picked courier (per-courier, live từ quotation) — R1 violation
WHEN  render payment options
THEN  COD disabled + helper "Đơn vượt hạn mức COD của courier"

GIVEN total < min_cod_amount của auto-picked courier (per-courier, live từ quotation) — R2 violation
WHEN  render payment options
THEN  COD disabled + helper "Đơn dưới mức tối thiểu để dùng COD"
```

> 📌 Source: PRD FR C-6a, design §2.2 COD disabled states

#### AC-3: COD selected → order tạo đúng fields

```gherkin
GIVEN buyer đủ điều kiện + chọn COD tại checkout
WHEN  bấm Place Order → POST /api/orders/checkout { paymentMethod: 'cod', codAmountSen }
THEN  order tạo với:
        paymentMethod = 'cod'
        codAmount     = snapshot grand total (sen, KHÔNG recalculate sau)
        codStatus     = 'pending' (default)
        paymentStatus = 'unpaid'
  AND codAmount (RM float) = codAmount (sen) / 100 (khi hiển thị / gửi EasyParcel)
  AND "confirmed but unpaid" — tiền không thu tại đây
```

> 📌 Source: PRD FR C-6b, C-6c, NFR-1 + brief as-built facts

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

#### AC-4b: Server hard-rejects ineligible COD

```gherkin
GIVEN buyer submit checkout với cod_amount pero isCodEligible=false (courier không hỗ trợ R3 OR amount out-of-range R1/R2 per-route per-courier)
WHEN  POST /api/orders/checkout executes
THEN  server hard-rejects: KHÔNG tạo order
  AND trả 400 Bad Request hoặc 422 Unprocessable Entity: "COD not eligible for this order"
  AND ordinal cause: courier không hỗ trợ COD (R3), hoặc total ngoài giới hạn courier (R1/R2)
  AND UI-only disable là không đủ — EP không validate; code PHẢI enforce R1–R5

AND GIVEN cod_amount không submitted (buyer chọn bank/Stripe)
WHEN  checkout submit
THEN  ignore cod_amount (KHÔNG parse)
```

> 📌 Source: PA2 validation decision (GH-1333) — backend is gate, not UI

---

### Acceptance Criteria (Phase C — Label Creation — NOT BUILT)

> **⚠️ NOT BUILT (as of 2026-07-01) — Phase C only. AC-5 onwards are forward-looking; no code yet.**

#### AC-5: Create label COD — gửi flag COD + codAmount

```gherkin
GIVEN order paymentMethod='cod' + buyer West MY + codAmount trong giới hạn auto-picked courier
WHEN  merchant tạo label qua modal Ready to Ship → POST /api/orders/[id]/create-label
THEN  POST /open_api/2026-03/shipment/submit_orders gửi { cod_amount (RM float = codAmount/100) } với auto-picked courier
  AND modal hiện COD badge + "Thu hộ: RM X" + fee note trước khi confirm
  AND codStatus = 'pending' (unchanged — tiền chưa thu)
  AND cước ship vẫn trừ ví merchant (tách biệt khỏi COD amount)
```

> 📌 Source: PRD FR C-6e; Commit 722b47f0 (order.shippingCourier used for label creation)

#### AC-6: COD tại create-label — validate R1–R5 before submit

```gherkin
GIVEN order paymentMethod='cod' + merchant mở modal Ready to Ship (Phase C)
WHEN  modal renders + merchant nhập cân nặng/dims
THEN  validate isCodEligible(route, courier, total) == R1–R5 check
  AND nếu isCodEligible=false → hiển thị block "Courier không hỗ trợ COD cho địa chỉ này" (generic, per-route per-courier live decision)
  AND nút tạo label disabled
  AND merchant phải xử lý thủ công (đổi courier hoặc cancel)
```

> 📌 Source: PRD §8 R1–R5 decision (no region hardcode; follow live quotation response). Phase C will re-validate at label creation.

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
- [ ] Test AC-1: COD enabled per R1–R3 when courier COD-capable + total trong range (no region hardcode)
- [ ] Test AC-2: disabled states — đúng helper text từng lý do (non-COD courier R3, out-of-range amount R1/R2)
- [ ] Test AC-3: order fields codAmount (sen), codStatus='pending', paymentStatus='unpaid'
- [ ] Test AC-4b: server rejects ineligible COD (R1–R5 violation, returns 400/422); UI disable alone insufficient
- [ ] Test AC-5: label payload gửi cod_enabled + cod_amount đúng; param name verify sandbox (Phase C)
- [ ] Test AC-6: COD ineligibility (per-route per-courier) detected at create-label modal (Phase C)
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

> **⚠️ NOT BUILT (as of 2026-07-01) — Phase C only. Acceptance criteria are forward-looking; no code yet.**

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

> **⚠️ NOT BUILT (as of 2026-07-01) — Phase C only. Acceptance criteria are forward-looking; no code yet.**

### Acceptance Criteria

#### AC-1: Cron poll tracking theo batch tenant

```gherkin
GIVEN có orders shipped/chưa completed có trackingNumber (awbNo)
WHEN  GET /api/cron/sync-tracking chạy (cron-secret auth, mỗi 30-60 phút)
THEN  gom orders group theo tenant (đúng OAuth token)
  AND gọi GET /open_api/2026-03/shipment/tracking?tracking_number=awbNo theo batch
  AND receive EP string status → map via mapTrackingStatus() → 1 trong 13 status chuẩn (order_created, pending_pickup, picked_up, in_transit, out_for_delivery, delivered, failed_delivery, returned_to_sender, lost, cancelled, exception, processing, unknown)
  AND cập nhật order.shippingTrackingStatus + shippingTrackingLastUpdated
  AND idempotent + backoff (không spam API)
```

> 📌 Source: PRD FR C-7, NFR-5 + brief as-built facts (GET /shipment/tracking, string status mapping)

#### AC-2: Tracking nhúng order detail (KHÔNG màn riêng) + dual-field

```gherkin
GIVEN order có trackingNumber + shippingTrackingStatus (string enum from polling GET /shipment/tracking)
WHEN  buyer mở sites/[slug]/orders/[orderNumber]
THEN  làm giàu component có sẵn OtShippingCard + OtTimeline (KHÔNG dựng trang/scene mới)
  AND hiển thị courier + AWB + trạng thái tracking mới nhất (13 string enums, display labels per mapping)
  AND order.status (lifecycle) tách khỏi shippingTrackingStatus (display) — dual-field
  AND merchant order detail (OrderDetailPanel) có badge tracking tương ứng
```

> 📌 Source: PRD FR C-7, design §2.4 dual-field table + brief as-built facts (string status enums, no numeric codes)

#### AC-2b: 13 string status enums → gợi ý lifecycle (manual)

```gherkin
GIVEN shippingTrackingStatus ∈ {in_transit, out_for_delivery, delivered, returned_to_sender, ...} (13 string enums from polling)
WHEN  render tracking
THEN  in_transit / out_for_delivery / exception → CHỈ hiển thị, KHÔNG đổi order.status
  AND picked_up → gợi ý merchant bấm shipped; returned_to_sender → refunded; cancelled → cancelled
  AND mọi transition vẫn do merchant bấm tay (KHÔNG auto)
```

> 📌 Source: PRD FR C-7, design §2.4 status mapping + brief as-built facts (13 string enums)

#### AC-3: Delivered → KHÔNG auto-complete (manual)

```gherkin
GIVEN polling nhận EP status = 'delivered' (mapped to shippingTrackingStatus='delivered')
WHEN  cập nhật order
THEN  CHỈ update shippingTrackingStatus = 'delivered' (field hiển thị)
  AND KHÔNG tự chuyển order sang completed
  AND merchant tự bấm "Completed" (giữ manual order lifecycle hiện tại)
```

> 📌 Source: PRD FR C-9 + brief as-built facts (string status enums, no auto-complete)

### Additional Criteria

- [ ] **Polling (current impl):** cron /api/cron/sync-tracking → GET /open_api/2026-03/shipment/tracking (every 30-60 min). No webhooks in MVP (forward-looking).
- [ ] Cron auth bằng cron-secret; reject nếu thiếu/sai secret.
- [ ] String status enums (13 values) → display labels per mapping table (PRD §8 updated, design §2.4).
- [ ] KHÔNG show số dư ví EP / KHÔNG cron cảnh báo ví (đã bỏ); ví thiếu chỉ lộ khi tạo label fail.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test: polling cron batches correctly; 13 string status enums map to display labels correctly
- [ ] Cột order mới (shippingTrackingStatus, shippingTrackingLastUpdated) → MIGRATIONS (NFR-9)

---

## US-F36-10: Returns — Courier Auto-Return (Case A) + Manual Buyer-Return (Case B)

**Wave 7** | **P1** | **M** | **Status:** Draft

### Story

```
As a   SME Owner
I want handle returned parcels in two ways — courier auto-returns failed/refused deliveries
      (Case A) and manual buyer-initiated returns (Case B: buyer ships back via any courier)
So that I can process refunds through the existing Refund button without needing a new RMA system,
      and for Case B capture the return tracking code and who bears the return shipping cost
```

> **No EasyParcel reverse label:** F36 does NOT use EP reverse label. Case A = courier auto-returns the parcel to sender (no new label, no EP API call). Case B = merchant records a free-text tracking code from any courier the buyer uses — not EP-generated.

> **⚠️ NOT BUILT (as of 2026-07-01) — Phase D only. Acceptance criteria are forward-looking; no code yet.**

### Acceptance Criteria

#### AC-1 (Case A): Cron marks auto-returned parcel; merchant triggers refund

```gherkin
GIVEN an order where delivery failed (buyer no-show, COD refusal, or undeliverable)
  AND courier auto-returns the parcel to sender address (no new label, no EP API call)
WHEN  webhook listener receives topic 1 (status) or cron /api/cron/sync-tracking polls POST /shipment/tracking_status
  AND receives a status that maps to 'Returned'
THEN  shippingTrackingStatus is set to 'Returned' on the order
  AND no EasyParcel API call is made for the return leg
  AND no reverse label is created
  AND codStatus (if COD order) remains 'pending' (buyer never paid)
  AND merchant sees a "Returned" badge on the order in dashboard
```

> 📌 Source: PRD FR D-1, AC #1 in [F10-orders-management.md § 20.3](../prd/F10-orders-management.md#easyparcel--returns--cancel)

#### AC-2 (Case A): Merchant refunds via existing endpoint

```gherkin
GIVEN shippingTrackingStatus = 'Returned' on the order
  AND merchant has inspected the returned goods
WHEN  merchant clicks Refund (existing nút Refund in OrderDetailPanel)
THEN  POST /api/orders/[id]/refund (F10 — refund goods + restock) is called
  AND inventory is restocked via existing F10 logic
  AND outbound shipping fee is NOT refunded (freight lost per courier policy)
  AND no new refund/restock logic is written
```

> 📌 Source: PRD FR D-1, D-3, AC #2 in [F10-orders-management.md § 20.3](../prd/F10-orders-management.md#easyparcel--returns--cancel)

### Additional Criteria

- [ ] Case A requires NO new DB columns on the orders table.
- [ ] KHÔNG viết logic refund/restock mới — reuse `/api/orders/[id]/refund` and `/api/orders/[id]/cancel` (F10).
- [ ] No buyer-facing return-request UI; no Returns/RMA collection.
- [ ] Manual buyer-return (Case B) with fee capture is covered in US-F36-12.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test Case A: cron sets shippingTrackingStatus='Returned'; no EP API call; no reverse label
- [ ] Test Case A: merchant clicks Refund → F10 /refund executes; restock OK; outbound freight NOT refunded
- [ ] 0 new refund/restock logic

---

## US-F36-11: Cancel Refund by Label Status

**Wave 7** | **P0** | **M** | **Status:** Draft

### Story

```
As a   SME Owner
I want hủy đơn và refund đúng theo trạng thái nhãn vận đơn (chưa mua / đã mua / đã pickup)
So that tiền hàng và cước được xử lý công bằng, không thất thoát sai
```

> **⚠️ NOT BUILT (as of 2026-07-01) — Phase D only. Acceptance criteria are forward-looking; no code yet.**

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
  AND MVP không wire cancel programmatic (product decision — `POST /shipment/cancel` có sẵn nhưng out-of-scope MVP)
```

> 📌 Source: PRD FR D-5, D-6 + §8 (cancel endpoint có sẵn; MVP defer sang dashboard)

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

## US-F36-12: Manual Buyer-Return with Fee Capture (Case B)

**Wave 7** | **P1** | **M** | **Status:** Draft

### Story

```
As a   SME Owner
I want record a buyer-initiated return on an order — capturing the return tracking code
      (from any courier), who pays the return shipping fee, and the fee amount
So that I have a complete record of the return, can track the parcel back to my warehouse,
      and then process a refund through the existing Refund button once goods are received
```

> **No EasyParcel reverse label:** the buyer ships back via any courier of their choice (J&T, Pos Laju, Lalamove, etc.). The system records a free-text tracking code — not an EP reverse AWB.

> **⚠️ NOT BUILT (as of 2026-07-01) — Phase D only. Acceptance criteria are forward-looking; no code yet.**

### Acceptance Criteria

#### AC-1: Merchant records return details on a shipped/completed order

```gherkin
GIVEN an order in 'shipped' or 'completed' status
  AND buyer has contacted merchant out-of-band to request a return (phone, WhatsApp, etc.)
WHEN  merchant opens the order in OrderDetailPanel and fills in the return fields:
        return_tracking_code (required — free-text, any courier AWB)
        return_tracking_url (optional — deep link to courier tracking page)
        return_fee_payer: 'buyer' | 'seller'
        return_shipping_fee (sen — integer; 0 if not applicable)
        return_reason (optional free-text)
        return_status: none → requested
THEN  all six return fields are persisted on the order
  AND return_status transitions from 'none' to 'requested'
  AND no EasyParcel API call is made at any step
  AND buyer may have used any courier — tracking code is free-text, not EP-validated
  AND return_shipping_fee and return_fee_payer are recorded informationally (shown in the return block; NOT a financial deduction)
```

> 📌 Source: PRD FR D-2, D-7, AC #3 in [F10-orders-management.md § 20.3](../prd/F10-orders-management.md#easyparcel--returns--cancel)

#### AC-2: Return status transitions as merchant tracks the return

```gherkin
GIVEN return_status = 'requested' and merchant has shared return address with buyer
WHEN  buyer ships the parcel back and merchant enters the tracking code
THEN  merchant can advance return_status: requested → in_transit → received
  AND no server-side state machine enforces transitions for MVP (UI-only guardrails)
  AND each transition is saved via PATCH /api/orders/[id] { return_status, ... }
```

> 📌 Source: PRD FR D-2, Open Item #1 in [F10-orders-management.md § 20.3](../prd/F10-orders-management.md#easyparcel--returns--cancel)

#### AC-3: Merchant refunds after receiving goods

```gherkin
GIVEN return_status = 'received' (merchant has inspected returned goods)
WHEN  merchant clicks Refund (existing nút Refund in OrderDetailPanel)
THEN  POST /api/orders/[id]/refund (F10) executes — goods refunded + inventory restocked
  AND return_status advances to 'refunded'
  AND no new refund/restock logic is written (100% reuse F10)
```

> 📌 Source: PRD FR D-3, AC #8 in [F10-orders-management.md § 20.3](../prd/F10-orders-management.md#easyparcel--returns--cancel)

#### AC-4: Seller-only fields — not exposed to buyer

```gherkin
GIVEN an order with return fields populated
WHEN  buyer-facing endpoint /api/orders/track/[orderNumber] or /api/orders/stream/[orderNumber]
      OR OrderTrackingClient renders the order
THEN  none of return_status, return_tracking_code, return_tracking_url,
      return_shipping_fee, return_fee_payer, return_reason appear in the response or rendered UI
```

> 📌 Source: PRD FR D-7, NFR-10 in [F10-orders-management.md § 20.3](../prd/F10-orders-management.md#easyparcel--returns--cancel)

### Additional Criteria

- [ ] Six new columns on `orders` table: `return_status` (varchar, default `none`), `return_tracking_code` (varchar, nullable), `return_tracking_url` (varchar, nullable), `return_shipping_fee` (number/sen, default `0`), `return_fee_payer` (varchar, nullable), `return_reason` (text, nullable). All require entries in `scripts/db-setup.js` MIGRATIONS (NFR-9).
- [ ] Merchant-only: all six fields excluded from public buyer projections (per NFR-10 — mirrors existing exclusion pattern for `labelUrl`, `codAmount`, `codStatus`).
- [ ] No RMA collection, no buyer self-service return-request UI.
- [ ] return_shipping_fee stored in sen (consistent with codAmount). Display as RM (divide by 100).
- [ ] return_shipping_fee and return_fee_payer are informational fields shown in the return block only — NOT added as a deduction in OrderSummary, NOT subtracted from revenue, NOT counted in analytics (record-only per PM decision).

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test AC-1: all six return fields saved on order; return_status = 'requested'; no EP API call
- [ ] Test AC-2: status transitions requested → in_transit → received via PATCH
- [ ] Test AC-3: return_status='received' → Refund → F10 /refund executes; return_status='refunded'
- [ ] Test AC-4: buyer-facing endpoints exclude all six return fields
- [ ] Six new `orders` columns → MIGRATIONS entries (NFR-9) — CI gate rejects if missing

<!-- 13 stories (US-F36-01..12 + US-F36-08b) — full coverage PRD F36 FR A-1..D-7 + COD C-6a..C-6e. Map FR→Story: xem cột "Story" trong PRD §6. -->
