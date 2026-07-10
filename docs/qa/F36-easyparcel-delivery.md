# QA Test Plan — F36 EasyParcel Delivery Integration (Malaysia)

> **Version:** 1.2 | **Updated:** 2026-07-09 | **Owner:** QA Team
> **PRD ref:** [`docs/prd/F36-easyparcel-delivery.md`](../prd/F36-easyparcel-delivery.md) v2.0 (overview & index)
> **Host PRDs:** [`F14-shipping.md`](../prd/F14-shipping.md) §20 · [`F10-orders-management.md`](../prd/F10-orders-management.md) §20 · [`F19-store-configuration.md`](../prd/F19-store-configuration.md)
> **Stories ref:** [`docs/stories/F36-easyparcel-delivery-stories.md`](../stories/F36-easyparcel-delivery-stories.md) (US-F36-01..12 + 08b)
> **Design ref:** [`docs/design/F36-easyparcel-delivery-design.md`](../design/F36-easyparcel-delivery-design.md)
> **Spec:** EasyParcel OpenAPI v2026-03 (GitHub official)

### Changelog
- **v1.2 (2026-07-09)** — QA gap-review vòng 2 (2 agent đọc song song stories + PRD/design field-map). Thêm §3.21 (TC-F36.179..185, 7 TC): `parcel_value` transform (RM/100), `feature.*` tracking booleans, `item[]` per-line build, Aramex cut-off missing, buyer label vocab-collapse (Exception/Admin Cancel/Expired), token encrypt-at-rest (nâng từ note TC-10), cron batch chunk≤100. **Flag 3 doc contradiction** (§9 #9 wallet-balance Design vs NFR-7 + nội bộ TC-01 vs TC-19/57, #10 courier_logo CSP, #12 COURIER_CUTOFF roster Aramex/Pos). Tổng **185 TCs**. (Vòng review xác nhận 178 TC gốc đã cover ~95% requirement — đa số "gap" agent nêu là false-positive.)
- **v1.1 (2026-07-09)** — QA gap-review (qa-full:check) sau khi đọc **host PRD FR chi tiết** (F14 §20, F10 §20, F19 COD) + ck:scenario. Thêm §3.20 (TC-F36.161..178, 18 TC): address/phone transform B-8 (mapState/normalizePhone/buildAddress), 2-step submit+pay, Case A pre-alert, email trackingUrl, per-courier COD, currency 8.505 rounding, webhook replay. **Sửa 3 lỗi correctness:** parcelWeight **kg** (KHÔNG gram — GH-1458) ở TC-28/120/UAT; COD limit **per-courier** (KHÔNG hardcode RM7000) ở TC-79/83. **Flag BLOCKER spec conflict** OAuth vs API-key (2 thế hệ API mâu thuẫn trong docs). Tổng **178 TCs**.
- **v1.0 (2026-07-09)** — Bộ TC khởi tạo. 160 manual/automated TCs phủ 13 stories (US-F36-01..12 + 08b), 6 phase (A Connect / B Rate / C Fulfillment / C-COD / D Returns) + 4 section cross-cutting (Currency NFR-1, Idempotency NFR-2, Security NFR-3/NFR-10, DB migration NFR-9). COD (US-F36-08/08b) marked **DEFERRED** — blocked on sandbox verify param `cod_enabled`/`cod_amount` (PRD §8/§9 item #1).

---

## 1. Objective

Đảm bảo F36 EasyParcel Delivery hoạt động đúng PRD v2.0 + 13 stories, với **trọng tâm dòng tiền** (đây là tính năng liên quan trực tiếp ví merchant + COD + refund). Bộ test suite **185 TCs** phủ:

- **OAuth 2.0 Authorization-Code** connect/disconnect + token lifecycle (refresh, IDOR, no-leak)
- Warehouse force-validate qua rate-check + geo cascade reuse
- Courier single-select (chỉ 4 courier COD: Flash/DHL/J&T/Aramex, default J&T)
- **Hybrid fallback** flat West/East khi EP OFF/lỗi/timeout (không phá merchant cũ)
- **Rate real-time** 1 courier + persist order (shippingCourier/serviceId/fee/parcelWeight)
- **Create label** (submit_orders wallet auto-deduct) + **idempotency** (chống double-charge)
- Wallet low → `EASYPARCEL_WALLET_LOW`, order không kẹt, retry được
- Pickup **cut-off-aware** date picker + server re-validate SLA (không tin client)
- Tracking sync (webhook topics 1/2/3 primary + cron polling fallback) + numeric status 0-11 → dual-field, **delivered KHÔNG auto-complete**
- **COD** eligibility gating + checkout fields + label COD (**DEFERRED**)
- **Returns** Case A auto-return (courier) + Case B manual buyer-return + cancel/refund by label status (reuse F10)
- **Currency NFR-1** — sen↔RM `/100`·`×100`, chống regression 100× (BẮT BUỘC)
- **Non-custody** — platform RM0, giá = raw EasyParcel, không markup
- **Buyer-safe projection NFR-10** — không lộ labelUrl/codAmount/codStatus/wallet-error/return fields ra public

### Legend

- **Type** = `Func` (functional) · `Sec` (security/auth/validation) · `Edge` (boundary/edge) · `Money` (currency/wallet/COD — dòng tiền) · `API` (HTTP contract) · `Live` (real-time UI) · `UI` · `Integration`
- **Priority** = `Blocker` · `Critical` · `High` · `Medium`
- **Status marker** = `[DEFERRED]` block chờ sandbox verify · `[TBD]` chờ confirm param/spec

> **⚠ Money-critical TCs (phải 100% pass trước go-live):** TC-F36.30, 31, 32 (currency), TC-F36.51, 52 (idempotent double-charge), TC-F36.114..125 (currency regression suite), TC-F36.54, 55 (wallet low), TC-F36.126..132 (buyer projection leak), TC-F36.161..165 (address/phone transform), TC-F36.79 (COD per-courier limit).

> ### 🚨 BLOCKER — SPEC CONFLICT (dev PHẢI resolve trước khi implement)
>
> Tồn tại **2 thế hệ API mâu thuẫn** trong docs. Bộ TC này viết theo **OAuth/v2026-03** (theo overview PRD v2.0 + stories — newest, "Status: Active — aligned to EasyParcel v2026-03"). Nhưng **host PRD F14 §20 + F10 §20 mô tả model API-key cũ**. Cả 2 không thể đúng đồng thời:
>
> | Khía cạnh | Overview PRD v2.0 + stories (TC theo cái này) | Host PRD F14/F10 §20 |
> |---|---|---|
> | **Auth** | OAuth 2.0 Authorization-Code (access+refresh token) | API key (`apiKey`+`authKey`, `detectedEnv` production/demo) |
> | **Rate** | `POST /shipment/quotations` | `EPRateCheckingBulk` |
> | **Label** | `POST /shipment/submit_orders` (1 call, wallet auto-deduct) | `EPSubmitOrderBulk` + `EPPayOrderBulk` (**2 call**) |
> | **Tracking** | `POST /shipment/tracking_status` (numeric 0-11) | `EPParcelStatusBulk` (13 string enum) |
> | **Error codes** | (không nêu) | `EASYPARCEL_INVALID_KEY`, `EASYPARCEL_INVALID_WAREHOUSE` |
>
> **Tác động test:** idempotency (1-call vs submit+pay 2-call — xem TC-F36.166), tracking taxonomy (TC-F36.70/167), connect flow (TC-F36.01-13 OAuth vs TC-F36.168 API-key), error handling. **PM/dev chốt 1 spec → QA cập nhật nhánh TC tương ứng trước khi chạy.** Xem §9 câu hỏi #7.

---

## 2. Test Environment

| Item | Spec |
|---|---|
| Env | Staging + localhost với test tenant đã seed `easyParcelIntegration` |
| **EasyParcel** | **Sandbox** (same base URL `https://api.easyparcel.com/open_api/2026-03/`, sandbox OAuth creds). KHÔNG chạy production wallet. |
| Roles | SME Owner (tenant owner/admin), Buyer (guest + logged), Platform admin |
| Tenants | (A) EP connected + warehouse West MY + courier J&T · (B) EP connected + warehouse East MY · (C) EP **OFF** (fallback) · (D) EP enabled nhưng thiếu warehouse/courier |
| Wallet states | Ví đủ tiền · ví hết tiền (test `EASYPARCEL_WALLET_LOW`) |
| Couriers | 4 COD: Flash, DHL eCommerce, J&T, Aramex · non-COD: Pos Laju, Ninja Van |
| Currency | MYR only. Internal **sen** (integer); EasyParcel **RM** (float). |
| Order states | chưa label · đã label chưa pickup · đã pickup · shipped · delivered · returned |
| Test data | postcode West (50480, 47800) + East (88300 Sabah, 93100 Sarawak, 87000 Labuan); weight boundary (0, 0.09, 0.1, 2.50, 30, 50 kg); COD amounts (RM 5.00, 5.01, 1000, 7000, 7000.01) |
| Devices | Mobile 375px, Desktop 1440px |

---

## 3. Test Cases (Traceability Matrix)

Format: `TC-F36.NN | Type | Priority | Title | Steps | Expected | Refs`

---

### 3.1 Phase A — OAuth Connect (US-F36-01)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.01** | Func | Blocker | OAuth connect → token exchange → connected | 1. Tenant chưa kết nối, mở settings/shipping > tab EasyParcel. 2. Bấm "Connect with EasyParcel ↗". 3. OAuth popup mở (`oauth/login?client_id&redirect_uri&state`). 4. Merchant login + grant scope. | Callback trả `code` → backend POST `oauth/token` (grant_type=authorization_code, Basic auth client_id:secret) → nhận access_token (10h) + refresh_token (1yr) + expires_at → lưu `tenant.easyParcelIntegration.oauthTokens`. Popup đóng. Page hiện "Connected — Account: [Name] (Live)" + wallet balance. Warehouse/courier section unlock. | US-F36-01 AC-1 |
| **TC-F36.02** | Sec | Critical | OAuth state mismatch → reject (CSRF guard) | Callback trả `state` khác với `state` gửi đi. | Backend reject exchange, red Alert "invalid state", KHÔNG lưu token. | AC-1, NFR-3 |
| **TC-F36.03** | Func | High | User denied grant → error + retry | Merchant bấm "Deny" ở màn EasyParcel. | Callback trả `error=access_denied` → red Alert với nút retry. KHÔNG lưu token. | AC-1, additional |
| **TC-F36.04** | Money | Blocker | Warehouse postcode force-validate qua rate-check (pass) | 1. Tenant connected. 2. Nhập warehouse (line1, city, state, postcode West MY valid, country=MY). 3. Bấm Save. | Backend gọi POST `/shipment/quotations` với warehouse làm sender. Quotation success → postcode valid → config **được lưu**. | AC-2 |
| **TC-F36.05** | Money | Critical | Warehouse postcode invalid → reject save | Nhập postcode/state combo sai. Save. | Quotation call fail → reject save với error "Postcode invalid". Config **KHÔNG lưu**. | AC-2 |
| **TC-F36.06** | Func | Medium | Edit warehouse sau lần đầu KHÔNG cần re-validate | Warehouse đã validate 1 lần, sửa line1, Save. | Save OK không gọi lại rate-check (force-validate chỉ 1 lần). | AC-2, additional |
| **TC-F36.07** | Sec | Blocker | IDOR — user không thuộc tenant PATCH settings → 403 | User A (khác tenant) gửi PATCH settings/shipping của tenant B. | HTTP 403 Forbidden (mirror `hasSiteAccess`). DB tenant B KHÔNG đổi. | AC-3, NFR-3 |
| **TC-F36.08** | Sec | Critical | Unauthenticated PATCH settings → 401/403 | PATCH settings không có session. | HTTP 401/403. DB không đổi. | AC-3, NFR-3 |
| **TC-F36.09** | Func | Critical | Token auto-refresh on 401 → retry success | Access token đã hết hạn (>10h). Backend gọi rate/label → nhận 401. | Backend POST `oauth/token` với refresh_token (grant_type=refresh_token) → access_token mới → retry request gốc → success (idempotent). | AC-4 |
| **TC-F36.10** | Sec | Critical | Token KHÔNG lộ ra response/log | Sau connect, inspect API response + server log của settings GET/PATCH. | Không có access_token/refresh_token/client_secret trong response body hay log. (Cân nhắc encrypt at-rest.) | NFR-3, NFR-8 |
| **TC-F36.11** | Func | High | Disconnect → clear tokens, có thể re-authorize | Bấm Disconnect. | Tokens bị xóa khỏi `easyParcelIntegration`. Page về trạng thái chưa connect. Có thể Connect lại. | AC additional |
| **TC-F36.12** | Func | Medium | Warehouse form dùng geo cascade có sẵn (State→City→Postcode) | Mở warehouse form. | 3 dropdown gọi `/api/geo/{states,districts,postcodes}`; line1 required, line2 optional, city required, postcode 5 digits, country hardcoded MY. KHÔNG dựng endpoint geo mới. | AC additional |
| **TC-F36.13** | Sec | High | Network error khi connect → generic error, details chỉ ở log | Mock `oauth/token` timeout. | UI hiện "Failed to connect, retry". Chi tiết lỗi chỉ trong server log (không lộ ra client). | AC additional |

---

### 3.2 Phase A — Courier Selection (US-F36-02)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.14** | Func | Critical | Single-select courier (chọn mới bỏ cũ) | Tenant connected, chọn courier J&T (radio) → sau đó chọn Flash. | `selectedCourier` = single `courier_id`, lưu Flash (bỏ J&T). Chỉ 1 courier active. | US-F36-02 AC-1 |
| **TC-F36.15** | Func | Critical | Chỉ list 4 courier COD (đọc live `cod_service_available=true`) | Merchant connect xong, render section Courier. | CHỈ list Flash, DHL eCommerce, J&T, Aramex. Courier non-COD (Pos Laju, Ninja Van, City-Link, SPX) KHÔNG hiển thị. | AC-2 |
| **TC-F36.16** | Func | High | Default courier = J&T Express | Merchant chưa chọn courier. | `selectedCourier` default = J&T (chỉ default mã courier account merchant thực có). | AC-2, additional |
| **TC-F36.17** | UI | Medium | Mỗi courier gắn badge "COD" + settlement ETA; không có "Xem thêm" | Render section courier. | 4 courier đều có badge COD + settlement ETA per-courier. KHÔNG có collapse "＋ Xem thêm courier". | AC-2 |
| **TC-F36.18** | Func | Medium | Checkout chỉ rate courier đã chọn | Chọn J&T → buyer checkout. | Rate + hiển thị đúng J&T (không list nhiều courier). | AC-1 |
| **TC-F36.19** | Func | Medium | KHÔNG show giá/section "Default parcel"/ví ở settings | Render settings courier. | Không hiện giá cước, không section "Default parcel", không show số dư ví, không setting label mode. | AC additional |

---

### 3.3 Phase A — Hybrid Fallback (US-F36-03)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.20** | Func | Blocker | `enabled=false` → flat rate, KHÔNG vỡ checkout | Tenant `easyParcelIntegration.enabled=false`. Buyer tới checkout. | `getRates()` dùng nhánh flat West/East (`getShippingRate` hiện tại). Checkout hiện 1 fee như cũ. | US-F36-03 AC-1, NFR-4 |
| **TC-F36.21** | Func | Critical | Thiếu warehouse postcode → fallback, không gọi EP | Tenant `enabled=true` nhưng thiếu warehouse postcode. Buyer checkout. | `getRates()` fallback flat (KHÔNG gọi EasyParcel với input thiếu). Log cảnh báo config thiếu (không lộ key). | AC-2, NFR-4 |
| **TC-F36.22** | Func | Critical | Chưa chọn courier (`selectedCourier` rỗng) → fallback | Tenant enabled nhưng `selectedCourier` rỗng. Buyer checkout. | Fallback flat rate, không gọi EP. Log cảnh báo. | AC-2, NFR-4 |
| **TC-F36.23** | Func | High | Flat-rate logic giữ nguyên 0 phá hành vi | Regression: tenant EP OFF, so sánh output với F14 flat behavior. | `calculate-fee.ts` + `constants.ts` cho kết quả y hệt F14 (West/East rate + freeAbove). | AC DoD |
| **TC-F36.24** | Sec | Medium | Fallback không lộ key/token trong log cảnh báo | Trigger fallback do config thiếu, đọc log. | Log chỉ ghi "config incomplete", KHÔNG chứa token/client_secret. | AC-2, NFR-8 |

---

### 3.4 Phase B — Real-Time Rate Backend (US-F36-04)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.25** | Func | Critical | EP ON → trả phí ship 1 courier (shop chọn) | Tenant EP ON + selectedCourier J&T. POST `/api/orders/calculate-shipping {siteId, dest postcode/state, items}`. | Tính total weight = sum(Products.weight × qty). Gọi POST `/shipment/quotations` (OAuth Bearer) với origin warehouse + dest + weight + dims cho J&T. Trả `{courier, serviceId, fee, eta}` của đúng J&T (KHÔNG mảng nhiều courier). | US-F36-04 AC-1 |
| **TC-F36.26** | Func | High | Total weight = sum(Products.weight × qty) | Cart 2 SP: A 0.5kg×2 + B 1.0kg×1. | Weight gửi EP = 2.0 kg. | AC-1, additional |
| **TC-F36.27** | Edge | High | Product weight = 0/thiếu → dùng `DEFAULT_PARCEL` | Cart có SP weight=0 hoặc null. | Weight fallback hằng số `DEFAULT_PARCEL` (const trong code, KHÔNG field per-tenant). | AC-1, additional |
| **TC-F36.28** | Money | Critical | Snapshot `parcelWeight` lên order lúc checkout (**grams**) | Đặt order EP. | Order lưu `parcelWeight` = tổng weight đã tính, **đơn vị grams** (Orders.ts field description; GH-1458 chỉ đổi `Products.weight` sang kg — `productWeightToGrams` convert kg→grams tại build-order-items, corrected 2026-07-10) → modal Ready-to-Ship đọc lại, KHÔNG re-join Products. | AC additional, B-1b |
| **TC-F36.29** | Func | Critical | Persist shippingCourier + serviceId + fee mọi nhánh checkout | Tạo order qua `/api/orders/checkout` (COD/bank) + stripe-checkout + xendit-checkout. | Order lưu `shippingCourier` + `shippingServiceId` + `shippingFee` + `parcelWeight` (grams) ở cả 3 nhánh; flat fallback KHÔNG ghi courier fields. Xendit wired 2026-07-10 (trước đó dùng flat rate cũ → order detail hiện self-delivery). | AC-3 |
| **TC-F36.30** | Money | Blocker | **Currency RM→sen đúng ×100** | EasyParcel trả price = RM 8.00. Normalize. | Compute nội bộ = 800 sen (×100 chính xác). Giá = raw EP (KHÔNG markup). | AC-2, NFR-1 |
| **TC-F36.31** | Money | Blocker | order.shippingFee lưu RM-float (đồng nhất `total`), KHÔNG 800 | Đặt order với rate RM 8.00. Check DB. | `order.shippingFee` = 8.00 (RM-float, đồng nhất field `total`). **KHÔNG lưu 800 vào cột** (lệch 100×). | AC-2, NFR-1, §8 Phase B AC#5 |
| **TC-F36.32** | Money | Blocker | KHÔNG markup — giá hiển thị = raw EasyParcel | EP trả RM 8.00. So sánh giá buyer thấy. | Buyer thấy đúng RM 8.00, không có +markup/+fee ẩn. | AC-2, non-custody |
| **TC-F36.33** | Func | High | OFF → flat fee đơn, shape tương thích cũ | Tenant EP OFF. calculate-shipping chạy. | Trả flat fee đơn, shape tương thích client cũ (không phá). | AC-4 |
| **TC-F36.34** | API | High | Rate p95 < 4s; timeout → fallback (không chặn) | Mock quotations trả sau 5s. | Sau 4s timeout → fallback flat, buyer vẫn tiếp tục được (xem US-05 AC-2). | AC additional, NFR-6 |
| **TC-F36.35** | Sec | Medium | Rate call dùng OAuth Bearer token đúng tenant | Tenant A + B đều EP ON. Rate cho order tenant A. | Call `/shipment/quotations` dùng access_token của tenant A → cước vào ví A. Không lẫn token tenant B. | NFR-3, routing auth |

---

### 3.5 Phase B — Checkout Shipping Display (US-F36-05)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.36** | Func | High | Shipping address reuse cascade F14 | Buyer ở bước địa chỉ checkout. | Dùng lại cascade State→City→Postcode của F14 (`/api/geo/*` + CheckoutForm). KHÔNG dựng form/endpoint geo mới. | US-F36-05 AC-0 |
| **TC-F36.37** | Func | Critical | Phí ship → 1 dòng "Shipping" trong Order Summary | calculate-shipping trả phí J&T. Checkout render. | Order Summary hiện 1 dòng "Shipping: giá thật". KHÔNG section vận chuyển (buyer không chọn courier). KHÔNG dòng SST. Total = subtotal − discount + shipping. | AC-1 |
| **TC-F36.38** | Func | Critical | Rate lỗi/timeout → fallback flat, KHÔNG chặn checkout | EP rate timeout (>4s) hoặc lỗi. Buyer ở bước shipping. | Checkout fallback flat West/East. Buyer vẫn đặt được. Log cảnh báo (không lộ key). | AC-2, NFR-4, NFR-6 |
| **TC-F36.39** | Money | High | Free-shipping threshold áp lên phí ship | Merchant bật freeAbove=RM100, cart subtotal ≥ RM100. | Phí ship hiển thị "FREE" (fee=0). | AC-3 |
| **TC-F36.40** | Edge | High | Free-ship boundary inclusive (subtotal = threshold) | freeAbove=RM100, subtotal đúng RM100. | Ship = FREE (`subtotal >= freeAbove`). | AC-3, BR F14 |
| **TC-F36.41** | Func | Medium | Fallback → UI fee đơn như cũ | Tenant OFF (1 flat option). Checkout render. | Hiển thị 1 fee flat (UI hiện tại). | AC-4 |
| **TC-F36.42** | UI | Medium | Loading state khi đang gọi rate | Trigger rate calc. | Spinner cạnh "Shipping" cho tới khi fee về. | AC additional |
| **TC-F36.43** | Mobile | Medium | Mobile — dòng "Shipping" đọc rõ 375px | Checkout trên 375px. | Dòng Shipping trong Order Summary không tràn, đọc rõ. | AC additional |

---

### 3.6 Phase C — Create Shipping Label (US-F36-06)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.44** | Money | Blocker | Tạo label thành công (single submit, ví trừ ngay) | Order paid/confirmed, EP tenant. Bấm "Ready to Ship" → modal (prefill weight/dims) → POST `/api/orders/[id]/create-label`. | Gọi POST `/shipment/submit_orders` (OAuth Bearer, wallet auto-deduct) → trả shipment_number + awb_number + tracking_url. Trừ ví merchant. Lưu shipmentNumber + awbNo + easyParcelOrderNo + trackingNumber=awbNo. Order → `ready_to_ship`. | US-F36-06 AC-1 |
| **TC-F36.45** | Func | High | AWB PDF (awb_url) tới async, nút in label hiện sau | Sau tạo label, awb_url chưa có ngay. | Nút in label chỉ hiện khi awb_url đã về (async qua webhook topic 2 hoặc POST `/shipment/list`). KHÔNG block order. | AC-1 |
| **TC-F36.46** | Func | Medium | Modal KHÔNG hiển thị courier (đã khóa 1 courier) | Mở modal Ready-to-Ship. | Modal hiện weight (prefill `order.parcelWeight`, sửa được) + dims (prefill DEFAULT_PARCEL/dims SP nếu 1 món) + pickup date. KHÔNG hiện courier (dùng `selectedCourier` ngầm). | AC additional |
| **TC-F36.47** | Edge | Medium | Đơn đa-SP → dims KHÔNG cộng dồn | Order 3 SP khác dims. Mở modal. | Dims prefill DEFAULT_PARCEL (KHÔNG cộng dims đa-SP), merchant sửa được. | AC additional |
| **TC-F36.48** | API | High | Create-label p95 < 6s | Đo thời gian create-label. | p95 < 6s. | AC DoD, NFR-6 |
| **TC-F36.49** | Func | Critical | Non-EP giữ ShipOrderModal manual (config-driven) | Tenant CHƯA connect EP. Bấm "Ship Order" → ShipOrderModal. | Hiện nhánh nhập trackingNumber thủ công như hôm nay (0 đổi). Order→shipped require trackingNumber. KHÔNG có tab toggle [EasyParcel\|manual]. | AC-4 |
| **TC-F36.50** | Func | High | EP tenant "Ship Order" = xác nhận pickup → shipped (KHÔNG nhập tracking) | EP tenant, order đã có AWB. Bấm "Ship Order". | Xác nhận courier pickup → order shipped. KHÔNG nhập tracking (AWB đã có). | AC-4, C-6 |

---

### 3.7 Phase C — Idempotency + Wallet (US-F36-06 AC-2/AC-3) — MONEY CRITICAL

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.51** | Money | Blocker | **Idempotent — order có awbNo → chặn create-label lần 2** | Order đã có awbNo. Gọi create-label lần 2. | Bị chặn — KHÔNG gọi `/shipment/submit_orders` lại. KHÔNG trừ ví lần 2. Trả về AWB/label đã có. | US-F36-06 AC-2, NFR-2 |
| **TC-F36.52** | Money | Blocker | **Double-click / concurrent create-label → 1 lần trừ ví** | Gửi 2 request create-label đồng thời cùng order (race). | Chỉ 1 lần gọi submit_orders + 1 lần trừ ví. Request thứ 2 trả AWB đã tạo (idempotency khóa theo bước pay). | AC-2, NFR-2 |
| **TC-F36.53** | Money | Critical | Idempotency key theo bước **pay** (không tạo AWB trùng) | Verify khóa idempotent dùng đúng key (order id + pay step). | Không sinh 2 AWB cho cùng 1 lần pay. | AC-2, NFR-2 |
| **TC-F36.54** | Money | Blocker | **Ví hết tiền → order KHÔNG đổi, retry được** | Ví EP merchant không đủ credit. Bấm "Ready to Ship". | Trả error `EASYPARCEL_WALLET_LOW` + link nạp ví EasyParcel. Order KHÔNG đổi trạng thái. Merchant retry được sau khi nạp ví. | US-F36-06 AC-3, NFR-7 |
| **TC-F36.55** | Money | Critical | Wallet-low KHÔNG để order kẹt ở trạng thái nửa vời | submit_orders fail giữa chừng (wallet low). | Order vẫn ở trạng thái trước (paid/confirmed), KHÔNG có awbNo rác, KHÔNG kẹt. | NFR-7 |
| **TC-F36.56** | Sec | High | Wallet-low error KHÔNG lộ ra buyer | Order wallet-low. Buyer mở trang track. | Buyer KHÔNG thấy `EASYPARCEL_WALLET_LOW` (chỉ seller dashboard thấy). | NFR-10 |
| **TC-F36.57** | Func | Medium | KHÔNG show số dư ví chủ động / KHÔNG cron cảnh báo ví | Kiểm settings + order detail. | Không có widget số dư ví, không cron cảnh báo ví. Ví thiếu chỉ lộ khi tạo label fail. | NFR-7 |

---

### 3.8 Phase C — Pickup / Dropoff (US-F36-07)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.58** | Func | High | Pickup/dropoff qua `collection_date` (không endpoint pickup riêng) | Modal Ready-to-Ship: chọn pickup (default) hoặc dropoff + ngày. | `collection_date` (YYYY-MM-DD, MYT UTC+8) truyền trong POST `/shipment/submit_orders`. KHÔNG gọi endpoint pickup riêng. Dropoff vẫn truyền collection_date. | US-F36-07 AC-1 |
| **TC-F36.59** | Func | Critical | Date picker same-day nếu trước cut-off (T2–T6) | Hôm nay là T3, giờ MYT 10:00, courier J&T (cut-off 13:50). Mở picker. | min = HÔM NAY, default = hôm nay (chọn được same-day). | AC-2 |
| **TC-F36.60** | Func | Critical | Sau cut-off → min = ngày làm việc kế | Hôm nay T3, giờ MYT 14:30, J&T cut-off 13:50. Mở picker. | min = ngày làm việc kế (T4). Không cho chọn hôm nay. | AC-2 |
| **TC-F36.61** | Edge | High | Cuối tuần → min = T2 kế tiếp | Hôm nay T7 (Sat). Mở picker. | min = Monday. Disable Sat/Sun. | AC-2 |
| **TC-F36.62** | Edge | Critical | Disable mọi ngày quá khứ (fix bug hiện tại) | Mở date picker. | Mọi ngày < hôm nay bị disable. KHÔNG submit được ngày quá khứ. | AC-2 |
| **TC-F36.63** | Sec | Blocker | **Server re-validate SLA — không tin client date** | Mở modal trước cut-off (10:00), submit sau cut-off (14:00) với collection_date=hôm nay. | Server re-tính earliest theo MYT tại thời điểm request. collection_date < earliest → **clamp lên earliest** + trả ngày đã dời để UI báo "đã dời sang DD/MM". KHÔNG gửi same-day sai SLA xuống EP. | AC-3b |
| **TC-F36.64** | Func | High | Helper `earliestPickupDate(courier, nowMYT)` dùng chung picker + server | Verify 1 helper cho cả client picker lẫn server validate. | Cùng 1 nguồn sự thật (DRY). Kết quả picker == server cho cùng input. | AC-3b DoD |
| **TC-F36.65** | Func | High | Cut-off per courier đúng const | Test J&T 13:50, Flash 14:00, Pos Laju 12:50. | `COURIER_CUTOFF` const đúng giá trị. Courier chưa biết cut-off → fallback conservative (12:00 hoặc ngày làm việc kế). | AC-3 |
| **TC-F36.66** | Func | Medium | Gửi sau cut-off → API tự bump (không vỡ) | Server gửi collection_date after cut-off. | API EasyParcel âm thầm bump sang ngày kế, không throw. | AC-2 |
| **TC-F36.67** | UI | Medium | KHÔNG có time picker | Mở date picker. | Chỉ chọn ngày (YYYY-MM-DD), không có time picker. Public holiday để API tự bump. | AC-2 |

---

### 3.9 Phase C — Tracking Sync + View (US-F36-09)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.68** | Func | High | Cron poll tracking batch theo tenant | Có orders shipped chưa completed có awbNo. GET `/api/cron/sync-tracking` (cron-secret auth). | Gom orders group theo tenant (đúng OAuth token). Gọi POST `/shipment/tracking_status` + `/shipment/details` batch. Update `shippingTrackingStatus`. Idempotent + backoff. | US-F36-09 AC-1, NFR-5 |
| **TC-F36.69** | Sec | Critical | Cron reject nếu thiếu/sai cron-secret | GET `/api/cron/sync-tracking` không có/sai secret. | HTTP 401/403. KHÔNG chạy sync. | AC additional, NFR-5 |
| **TC-F36.70** | Func | High | Numeric status code → 13 display label chuẩn | Nhận status code 4 (In Transit). | `shippingTrackingStatus` map đúng 1 trong 13 status chuẩn EasyParcel (normalize mọi courier). | AC-1, §8 |
| **TC-F36.71** | Func | Critical | Dual-field — order.status tách shippingTrackingStatus | Order có awbNo + tracking code. Buyer mở trang đơn. | OtShippingCard + OtTimeline hiện courier + AWB + tracking status. `order.status` (lifecycle) TÁCH khỏi `shippingTrackingStatus` (display). | AC-2 |
| **TC-F36.72** | Func | High | Webhook topic 1/2/3 → order update realtime | Webhook gửi topic 1 (status), 2 (awb), 3 (tracking). | Order update tương ứng (status, awb_url, tracking event). Merchant OrderDetailPanel có badge tracking. | AC additional |
| **TC-F36.73** | Func | Critical | Codes hiển thị-only KHÔNG đổi order.status (4/7/8) | shippingTrackingStatus ∈ {4 In Transit, 7 Schedule, 8 On Hold}. | CHỈ hiển thị, KHÔNG đổi order.status. Mọi transition do merchant bấm tay. | AC-2b |
| **TC-F36.74** | Func | High | Code 3 Collected → gợi ý merchant bấm shipped (không auto) | Nhận code 3. | Gợi ý merchant bấm shipped. KHÔNG tự chuyển. | AC-2b |
| **TC-F36.75** | Func | Blocker | **Delivered (code 5) → KHÔNG auto-complete** | Webhook/polling nhận shipment_status_code=5. | CHỈ update `shippingTrackingStatus=5`. KHÔNG tự chuyển order → completed. Merchant tự bấm "Completed". | AC-3, FR C-9 |
| **TC-F36.76** | Func | High | Code 6 Returned → gợi ý refunded; Code 0 Cancel → gợi ý cancelled | Nhận code 6, rồi code 0. | 6 → gợi ý merchant refunded; 0 → gợi ý cancelled. Vẫn manual (không auto). | AC-2b |
| **TC-F36.77** | Func | Medium | Cron idempotent + backoff (không spam API) | Chạy cron 2 lần liên tiếp trên cùng orders. | Không double-update, có backoff giữa batch. | NFR-5 |
| **TC-F36.78** | Func | Medium | Tracking nhúng order detail (KHÔNG màn/scene mới) | Buyer mở sites/[slug]/orders/[orderNumber]. | Làm giàu OtShippingCard + OtTimeline có sẵn. KHÔNG dựng trang/scene mới. | AC-2 |

---

### 3.10 Phase C-COD — Eligibility, Checkout & Label (US-F36-08) **[DEFERRED]**

> **⚠ [DEFERRED]** — toàn section blocked chờ verify param `cod_enabled`/`cod_amount` trong `submit_orders` với EasyParcel support (PRD §8/§9 item #1). TC-F36.79..92 viết spec-based; **AC-5 (label payload) không thể auto-test** cho tới khi confirm sandbox. Đánh dấu `[TBD]` cho param name.

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.79** | Money | Critical | COD eligible chỉ khi đủ 4 điều kiện AND (**per-courier limit từ API, KHÔNG hardcode**) | Buyer nhập địa chỉ + rate xong. Render payment options. | COD ENABLED chỉ khi ĐỒNG THỜI: (1) zone='west' (từ `/api/geo/lookup/[postcode]`) (2) selectedCourier `cod_service_available=true` (3) total ≥ `cod_service_min_cod_amount` (per-courier) (4) total ≤ `cod_service_max_cod_amount` (per-courier: **J&T RM1000 ≠ Flash RM7000** — đọc LIVE từ rate response, TUYỆT ĐỐI không hardcode RM7000). Thiếu bất kỳ → disabled + helper cụ thể. | US-F36-08 AC-1, F19 C-6a, F10 §20.2 |
| **TC-F36.80** | Func | High | COD disabled East MY → helper đúng | Buyer Sabah/Sarawak. Render payment. | COD disabled + helper "COD chỉ khả dụng cho địa chỉ West Malaysia". | AC-2 |
| **TC-F36.81** | Sec | High | COD disabled courier non-COD → helper chung chung (không lộ courier) | Buyer West + selectedCourier không hỗ trợ COD (edge/EP OFF). | COD disabled, helper chung — buyer KHÔNG thấy tên courier. | AC-2 |
| **TC-F36.82** | Money | High | COD disabled total > max courier → helper không lộ courier | Buyer West + total > cod_service_max (J&T RM1000). | COD disabled + helper "COD chỉ áp dụng cho đơn dưới RM X" (KHÔNG lộ tên courier). | AC-2 |
| **TC-F36.83** | Money | High | COD disabled total < per-courier min → helper min (KHÔNG hardcode) | Buyer West + courier COD + total < `cod_service_min_cod_amount` (Flash ~RM5.01, J&T ~RM7.01 — per-courier). | COD disabled + helper "Giá trị đơn tối thiểu để dùng COD là RM X" (X = per-courier min từ API). | AC-2, F10 §20.2 |
| **TC-F36.84** | Money | Critical | COD selected → order fields đúng (codAmount **sen**) | Buyer đủ điều kiện + chọn COD. Place Order. | Order: paymentMethod='cod', **codAmount = snapshot grand total (sen)**, codStatus='pending', paymentStatus='unpaid'. "confirmed but unpaid". | AC-3, NFR-1 |
| **TC-F36.85** | Money | Blocker | **codAmount lưu sen, /100 khi hiển thị (chống 100×)** | codAmount = 5000 sen. Hiển thị. | Display RM = 5000/100 = RM50.00. Cột `cod_amount` lưu **sen**, KHÔNG derive từ `total` (RM-float). | AC-3, additional, NFR-1 |
| **TC-F36.86** | Money | High | COD amount snapshot KHÔNG recalculate sau | Order COD tạo. Sau đó giá SP đổi. | codAmount giữ nguyên snapshot lúc checkout. | AC-3 |
| **TC-F36.87** | Money | Medium | COD fee disclosure (informational) theo courier | Buyer chọn COD. Render payment. | Alert phí COD max(flat,4%): Flash RM5, DHL RM6, J&T RM7, Aramex RM10. Informational — merchant chịu, platform KHÔNG thu/markup. | AC-4 |
| **TC-F36.88** | Money | Critical | **[TBD]** Create label COD gửi cod_enabled + cod_amount (RM) | Order COD West + codAmount trong limit. Tạo label. | POST submit_orders gửi `feature.cod_enabled=true` + `cod_amount` (RM = codAmount/100). Modal hiện COD badge + "Thu hộ: RM X". codStatus='pending'. Cước ship vẫn trừ ví (tách COD). **Param name verify sandbox.** | AC-5, §9 #1 |
| **TC-F36.89** | Func | High | COD East MY tại create-label → block | Order COD địa chỉ East MY. Mở modal Ready-to-Ship. | Block "EasyParcel COD chỉ West Malaysia". Nút tạo label disabled. Merchant xử lý thủ công. | AC-6 |
| **TC-F36.90** | Money | High | COD returned/từ chối → codStatus giữ 'pending', merchant refund | Order COD + shippingTrackingStatus='Returned'. Cron update. | codStatus giữ 'pending' (không thu được). Merchant thấy cảnh báo (cước mất + COD chưa thu). Bấm Refund (F10). | AC-7 |
| **TC-F36.91** | Func | Medium | Tenant EP OFF: COD vẫn khả dụng nếu site.paymentConfig.enableCod | Tenant EP OFF + enableCod=true. | COD khả dụng (không đổi), chỉ mất automation courier thu hộ (merchant tự thu tay). | AC additional |
| **TC-F36.92** | Money | Medium | Platform KHÔNG build reconciliation | Kiểm codebase. | Chỉ lưu codAmount (sen) + codStatus. KHÔNG API đối soát. Merchant tự xem EasyParcel dashboard. | AC additional |

---

### 3.11 Phase C-COD — COD Status Tracking (US-F36-08b)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.93** | UI | Medium | codStatus badge 3 states trên order detail (merchant) | Order COD mở trong OrderDetailPanel. | Badge: pending→"COD — Đang chờ" (grey), collected→"COD — Đã thu" (blue), settled→"COD — Đã đối soát" (green). Badge chỉ hiện khi paymentMethod='cod'. Hiện "Thu hộ: RM X.XX". | US-F36-08b AC-1 |
| **TC-F36.94** | Func | High | Merchant update codStatus thủ công (PATCH) | Merchant bấm update codStatus. | PATCH `/api/orders/[id] {codStatus}`. Badge cập nhật ngay. | AC-2 |
| **TC-F36.95** | Func | High | KHÔNG transition ngược (collected → pending bị chặn) | Order codStatus='collected'. Thử set 'pending'. | Bị chặn — không cho lùi. | AC-2 |
| **TC-F36.96** | Func | Critical | codStatus KHÔNG ảnh hưởng order lifecycle | Update codStatus bất kỳ. | order.status KHÔNG đổi. paymentStatus KHÔNG auto-update (2 field độc lập). | AC-3 |
| **TC-F36.97** | Func | Medium | codStatus default null cho non-COD order | Order non-COD. Check field. | codStatus = null (chỉ liên quan COD orders). Badge ẩn. | AC additional |

---

### 3.12 Phase D — Returns Case A Auto-Return (US-F36-10)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.98** | Func | High | Case A — cron/webhook set shippingTrackingStatus='Returned', KHÔNG EP API call | Delivery fail (buyer no-show/COD refusal/undeliverable). Courier auto-return. Webhook topic 1 hoặc cron nhận status map 'Returned'. | shippingTrackingStatus='Returned'. **KHÔNG EP API call cho return leg. KHÔNG reverse label.** codStatus (nếu COD) giữ 'pending'. Merchant thấy badge "Returned". | US-F36-10 AC-1 |
| **TC-F36.99** | Money | High | Case A — merchant refund qua F10, outbound freight KHÔNG hoàn | shippingTrackingStatus='Returned', merchant inspect goods. Bấm Refund. | POST `/api/orders/[id]/refund` (F10 — refund goods + restock). Inventory restock qua F10. **Cước outbound KHÔNG refund** (freight lost). KHÔNG viết logic refund/restock mới. | AC-2 |
| **TC-F36.100** | Func | Medium | Case A KHÔNG cần cột DB mới | Kiểm schema. | Case A dùng shippingTrackingStatus có sẵn, KHÔNG cột mới. | AC additional |
| **TC-F36.101** | Func | Medium | KHÔNG buyer-facing return UI / RMA | Kiểm storefront. | Không có return-request UI cho buyer, không Returns/RMA collection. | AC additional |

---

### 3.13 Phase D — Cancel Refund by Label Status (US-F36-11)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.102** | Money | Critical | Chưa mua label → /cancel: refund FULL (hàng + ship) + restock | Order chưa có awbNo. Hủy → POST `/api/orders/[id]/cancel`. | Refund FULL (tiền hàng + ship) + restock atomic ngay (reuse F10). | US-F36-11 AC-1 |
| **TC-F36.103** | Money | Critical | Đã mua label chưa pickup → /refund: refund hàng + message hủy cước | Order có awbNo chưa pickup. Hủy → POST `/api/orders/[id]/refund`. | Refund tiền HÀNG + restock. Ship: message hướng dẫn merchant tự hủy shipment trên EP dashboard (credit hoàn ví). MVP KHÔNG wire cancel programmatic. | AC-2 |
| **TC-F36.104** | Money | Critical | Đã pickup → /refund: refund hàng, cước MẤT | Order đã pickup. Hủy → POST `/api/orders/[id]/refund`. | Refund tiền hàng + restock. Cước MẤT (không hoàn) — ghi rõ cho merchant. | AC-3 |
| **TC-F36.105** | Money | Blocker | **Refund tiền hàng KHÔNG qua EasyParcel** | Bất kỳ case refund. | Refund qua provider: Stripe (live) / manual (COD-bank) / Xendit (khi F34). KHÔNG đi qua EasyParcel. | AC-4 |
| **TC-F36.106** | Func | High | 3 case refund đúng nhánh (regression) | Test 3 case: chưa label / chưa pickup / đã pickup. | Mỗi case gọi đúng endpoint (/cancel vs /refund) + đúng phạm vi refund. | AC DoD |

---

### 3.14 Phase D — Manual Buyer-Return Case B (US-F36-12)

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.107** | Func | High | Merchant ghi return details trên order shipped/completed | Order 'shipped'/'completed'. Merchant mở OrderDetailPanel, nhập 6 field return. | Lưu: return_tracking_code (required, free-text), return_tracking_url (optional), return_fee_payer ('buyer'\|'seller'), return_shipping_fee (sen), return_reason (optional), return_status: none→requested. **KHÔNG EP API call.** Tracking free-text (không EP-validated). | US-F36-12 AC-1 |
| **TC-F36.108** | Money | High | return_shipping_fee informational (KHÔNG deduction) | Nhập return_shipping_fee=1500 sen + payer=buyer. | Hiển thị trong return block. **KHÔNG** trừ OrderSummary, KHÔNG trừ revenue, KHÔNG vào analytics (record-only). | AC-1, additional |
| **TC-F36.109** | Func | Medium | Return status transitions (UI-only guardrails) | return_status='requested'. Advance qua PATCH. | requested → in_transit → received. KHÔNG server state machine (UI-only MVP). Mỗi transition PATCH `/api/orders/[id]`. | AC-2 |
| **TC-F36.110** | Money | High | received → Refund → F10 → refunded | return_status='received' (inspect goods). Bấm Refund. | POST `/api/orders/[id]/refund` (F10) — goods refunded + restock. return_status → 'refunded'. KHÔNG logic refund/restock mới (100% reuse F10). | AC-3 |
| **TC-F36.111** | Sec | Blocker | **6 return field KHÔNG lộ ra buyer** | Order có return fields. Buyer-facing `/api/orders/track/[orderNumber]` + `/stream/[orderNumber]` + OrderTrackingClient. | KHÔNG có return_status, return_tracking_code, return_tracking_url, return_shipping_fee, return_fee_payer, return_reason trong response/UI. | AC-4, NFR-10 |
| **TC-F36.112** | Money | Medium | return_shipping_fee lưu sen, hiển thị RM (/100) | return_shipping_fee=1500 sen. Hiển thị. | Display RM = 1500/100 = RM15.00 (consistent codAmount). | AC additional, NFR-1 |
| **TC-F36.113** | Func | Medium | return_tracking_code free-text any courier | Nhập AWB J&T/Pos Laju/Lalamove. | Lưu raw string, không validate format, không EP reverse AWB. | AC-1 |

---

### 3.15 Currency Regression Suite (NFR-1) — MONEY BLOCKER

> Section chống regression **lệch 100×** — bắt buộc pass toàn bộ trước go-live. Nguồn: `src/lib/shipping/easyparcel/normalize.ts` + `get-rates.ts`.

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.114** | Money | Blocker | RM→sen: "8.00" → 800 | normalize("8.00"). | 800 (integer). | NFR-1 |
| **TC-F36.115** | Money | Blocker | RM→sen: "8.50" → 850 | normalize("8.50"). | 850. | NFR-1 |
| **TC-F36.116** | Money | Blocker | RM→sen: "8.55" → 855 (no float drift) | normalize("8.55"). | 855 (KHÔNG 854.9999). | NFR-1 |
| **TC-F36.117** | Money | Critical | RM→sen: "0.10" → 10 | normalize("0.10"). | 10. | NFR-1 |
| **TC-F36.118** | Money | Critical | RM→sen: "1000.00" → 100000 | normalize("1000.00"). | 100000. | NFR-1 |
| **TC-F36.119** | Money | High | sen→RM khi gửi EP: 800 → 8.00 | order weight/COD 800 sen → gửi EP. | Gửi "8.00" (RM). `/100` chính xác. | NFR-1 |
| **TC-F36.120** | Money | High | Weight snapshot kg (GH-1458) + toFixed(2) khi gửi EP | Products.weight nếu lưu gram → aggregate ÷1000 thành parcelWeight (kg). parcelWeight 2.456 kg → gửi EP. | parcelWeight lưu **kg** (KHÔNG gram — GH-1458). Gửi EP weight="2.46" (toFixed(2)). Modal đọc parcelWeight = kg. | §9 rounding, B-1b |
| **TC-F36.121** | Money | High | Dims parseInt floor to integer cm | dims 30.5/20.3/15.8 → gửi EP. | width=30, length=20, height=15 (parseInt floor). | §9 rounding |
| **TC-F36.122** | Money | Critical | codAmount stored sen (5001) not RM (50.01) | COD total RM50.01. Check `cod_amount` column. | cod_amount = 5001 (sen). KHÔNG 50.01. | NFR-1 |
| **TC-F36.123** | Money | Critical | order.shippingFee stored RM-float (distinct from sen) | Rate RM8.00. Check `shippingFee` column. | shippingFee = 8.00 (RM-float, đồng nhất `total`). Phân biệt rõ với cod_amount (sen). | US-04 AC-2, NFR-1 |
| **TC-F36.124** | Money | High | return_shipping_fee stored sen | Nhập RM15.00 return fee. Check column. | return_shipping_fee = 1500 (sen). | US-12 additional |
| **TC-F36.125** | Money | High | Chargeable weight = max(actual, volumetric L×W×H÷5000) | weight 1.0kg, dims 40×30×20 (vol=4.8kg). | Chargeable = 4.8 kg (max). Rate phản ánh 4.8kg. | §9 |

---

### 3.16 Security & Buyer-Safe Projection (NFR-3, NFR-10) — CRITICAL

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.126** | Sec | Blocker | Buyer projection KHÔNG lộ labelUrl | Order có labelUrl. Buyer `/api/orders/track/[orderNumber]`. | Response KHÔNG chứa labelUrl. | NFR-10 |
| **TC-F36.127** | Sec | Blocker | Buyer projection KHÔNG lộ easyParcelOrderNo | Buyer track endpoint. | KHÔNG chứa easyParcelOrderNo. | NFR-10 |
| **TC-F36.128** | Sec | Blocker | Buyer projection KHÔNG lộ codAmount / codStatus | Order COD. Buyer track/stream. | KHÔNG chứa codAmount, codStatus. | NFR-10 |
| **TC-F36.129** | Sec | Blocker | Buyer projection KHÔNG lộ wallet error | Order wallet-low. Buyer track. | KHÔNG chứa EASYPARCEL_WALLET_LOW. | NFR-10 |
| **TC-F36.130** | Sec | High | Buyer projection CHỈ trả subset an toàn | Buyer track order EP. | CHỈ courier name, awbNo/trackingNumber, shippingTrackingStatus. | NFR-10 |
| **TC-F36.131** | Sec | High | Buyer stream (SSE) cùng projection guard | Buyer `/api/orders/stream/[orderNumber]`. | Cùng subset an toàn như track endpoint (không rò field nhạy cảm qua SSE). | NFR-10 |
| **TC-F36.132** | Sec | High | Public track dùng order-number-as-key, không auth → vẫn safe | Guess orderNumber khác. | Chỉ trả subset an toàn của order đó (không field merchant nhạy cảm). | NFR-10 |
| **TC-F36.133** | Sec | Critical | Token không lộ log ở mọi EP call (rate/label/tracking) | Grep server log sau full flow. | Không có access_token/refresh_token/client_secret ở bất kỳ log line. | NFR-3, NFR-8 |
| **TC-F36.134** | Sec | High | No global secret — key per-merchant trong DB | Kiểm code + env. | Chỉ constant base URL (demo/prod). Không có EP secret global trong env. | NFR-8 |
| **TC-F36.135** | Sec | Critical | Cross-tenant — label/tracking dùng đúng OAuth token tenant | Tenant A tạo label cho order tenant A. | Dùng token tenant A → cước ví A. Không dùng token tenant B (IDOR). | NFR-3 |

---

### 3.17 Database & Migration (NFR-9)

> Mọi cột mới → entry `scripts/db-setup.js` MIGRATIONS; CI `check-migrations.js` hard-gate.

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.136** | Func | High | `tenant.easyParcelIntegration.oauthTokens` migration | Run db-setup. | Cột/struct oauthTokens (access, refresh, expires_at, connected_at) tồn tại. CI gate pass. | US-01 DoD, NFR-9 |
| **TC-F36.137** | Func | High | Order cols: shippingCourier, shippingServiceId, parcelWeight | Run db-setup. | 3 cột tồn tại trên orders. | US-04 DoD, NFR-9 |
| **TC-F36.138** | Func | High | Order cols: awbNo, labelUrl, easyParcelOrderNo, shipmentNumber, trackingNumber, shippingTrackingStatus | Run db-setup. | Các cột fulfillment tồn tại. | US-06/09 DoD, NFR-9 |
| **TC-F36.139** | Func | High | Order cols COD: cod_amount (number/sen), cod_status (varchar) | Run db-setup. | 2 cột tồn tại, cod_amount number(sen), cod_status varchar default null. | US-08/08b DoD, NFR-9 |
| **TC-F36.140** | Func | High | Order cols Return (6): return_status/tracking_code/tracking_url/shipping_fee/fee_payer/reason | Run db-setup. | 6 cột tồn tại (return_status default 'none', return_shipping_fee default 0). CI gate reject nếu thiếu. | US-12 additional, NFR-9 |
| **TC-F36.141** | Sec | Critical | CI check-migrations gate reject khi thiếu cột | Thêm cột mới không khai báo MIGRATIONS. Push PR. | CI `check-migrations.js` fail → block PR. | NFR-9 |
| **TC-F36.142** | Edge | Medium | Array vs scalar id convention đúng (nếu có array table) | Kiểm oauthTokens/return nếu dùng array table. | Array tables: varchar id + _parent_id + _order. Scalar cols: đúng type. | database-schema rule |
| **TC-F36.143** | Func | Medium | Non-COD/non-EP order — field mới nullable, không phá order cũ | Order cũ non-EP. Sau migration. | Field EP mới = null/default, order cũ KHÔNG vỡ. | NFR-9 |

---

### 3.18 Sandbox Open Items — TBD Before Go-Live (PRD §9)

> **[TBD]** — 5 open item cần verify sandbox trước production. KHÔNG auto-test cho tới khi confirm. Ghi nhận để QA manual sandbox.

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.144** | Money | Critical | **[TBD]** COD param name trong submit_orders | Sandbox: submit_orders với COD. | Confirm exact param (`feature.cod_enabled` + `cod_amount`?) + types. Update US-08 AC-5. | §9 #1 |
| **TC-F36.145** | Sec | Critical | **[TBD]** Webhook signature verification | Sandbox: trigger webhook topic 1/2/3. | Xác định EP có gửi `X-EasyParcel-Signature` header? Implement validation trước go-live. | §9 #2 |
| **TC-F36.146** | Func | High | **[TBD]** 16 MY subdivision codes (ISO 3166-2) | Sandbox: quotations với mỗi subdivision_code 16 bang. | Tất cả 16 accept. Reject bang nào fail. Tạo const mapping. | §9 #3 |
| **TC-F36.147** | Func | Medium | **[TBD]** AWB PDF delivery timing | Sandbox: submit_orders, check response awb_url. | Xác định awb_url có ngay hay null tới webhook topic 2. Quyết polling loop vs webhook. | §9 #4 |
| **TC-F36.148** | Func | Medium | **[TBD]** Rate limiting headers (429 backoff) | Sandbox: spam requests. | Monitor 429 + response headers. Implement exponential backoff nếu observed. | §9 #5 |
| **TC-F36.149** | Edge | High | **[TBD]** Weight boundary sandbox (0.09/0.1/0/30/50 kg) | Sandbox quotations: weight 0.09, 0.1, 0, 30, 50. | 0.1 accept, 0 reject, 0.09 TBD, 30 (J&T max), 50 (Flash). Ghi kết quả. | §9 checklist |
| **TC-F36.150** | Edge | Medium | **[TBD]** Dim boundary sandbox (>150cm, fractional) | Sandbox: width=160, dims fractional 30.5. | >150 reject/accept? fractional round? Ghi kết quả. | §9 checklist |

### 3.18b Collection method resolution (US-F36-07 correction 2026-07-10)

> Bug live 2026-07-10: chọn Pickup nhưng EP tạo đơn drop-off. Root cause: EP model pickup/drop-off
> là SERVICE VARIANT riêng (submit không có flag method — service_id quyết định); checkout
> `pickCheapest` chốt variant rẻ nhất (thường drop-off) và UI method không được gửi/resolve.
> Fix: giữ `is_pickup`/`is_dropoff` trong RateOption + resolver live tại create-label
> (`resolve-collection-method.ts`) đổi sang variant cùng courier khớp method trước submit.

| TC | Type | Priority | Title | Steps | Expected | Refs |
|----|------|----------|-------|-------|----------|------|
| **TC-F36.151** | Func | Critical | Stored service khớp method → giữ nguyên | Resolver: quote trả stored service `is_pickup=true`, method=pickup. | `{ok:true, changed:false, serviceId=stored}` — không đổi service, không đổi giá. | US-F36-07 |
| **TC-F36.152** | Func | Critical | Stored drop-off-only + method=pickup → đổi variant pickup rẻ nhất cùng courier | Resolver: stored `is_pickup=false,is_dropoff=true`; quote có 2 variant pickup cùng courier_id (giá khác nhau) + 1 variant NaN price. | `{ok:true, changed:true}` với serviceId của variant pickup RẺ NHẤT có giá hợp lệ (NaN bị loại); trả serviceName + priceRm. | US-F36-07 |
| **TC-F36.153** | Func | Critical | Courier không có variant nào cho method → METHOD_NOT_SUPPORTED | Resolver: mọi service cùng courier đều `is_pickup=false`, method=pickup. | `{ok:false, supported:['dropoff']}` → route trả 422 `METHOD_NOT_SUPPORTED`, KHÔNG gọi submit (ví không bị charge). | US-F36-07 |
| **TC-F36.154** | Edge | High | Quotation lỗi → fail-open dùng stored service | Resolver: `quotations` throw. | `{ok:true, changed:false}` — submit vẫn là authority, không chặn label vì quote hỏng. | US-F36-07 |
| **TC-F36.155** | Edge | High | Stored service vắng mặt trong quote → fail-open | Resolver: quote không chứa stored service_id. | `{ok:true, changed:false}`. | US-F36-07 |
| **TC-F36.156** | Func | High | getRates giữ `isPickup`/`isDropoff` từ quotation | getRates với EP quote `is_pickup/is_dropoff`. | RateOption có `isPickup`/`isDropoff` đúng giá trị (flat fallback: absent). | US-F36-07 |

### 3.18c Async AWB — awb_number null lúc submit (verified live 2026-07-10, Pos)

> Submit success có thể trả `awb_number: null` (courier sinh AWB sau) — shipment ĐÃ tạo, ví ĐÃ trừ.
> Bug live: UI gate success trên `awbNo` → vẫn hiện "Ready to Ship" cho label đã mua. Cron sync
> KHÔNG backfill được (trackingStatus query THEO awb) → đường duy nhất nhận AWB là webhook
> match theo `shipment_number`. Yêu cầu ops: đăng ký thêm topic **Shipment AWB Update** trên EP portal.

| TC | Type | Priority | Title | Steps | Expected | Refs |
|----|------|----------|-------|-------|----------|------|
| **TC-F36.157** | Func | Critical | Fulfill state success theo shipment number, không theo AWB | `deriveFulfillState`: `ready_to_ship` + `easyParcelOrderNo` set + `awbNo` null. | `'success'` (banner label created, Print disabled, hint "AWB pending"). `CLAIM:` sentinel → KHÔNG success. | US-F36-05 |
| **TC-F36.158** | Func | Critical | Webhook backfill AWB qua shipment_number khi awb lookup miss | Webhook payload awb + shipment_number + status code; DB không có order nào mang awb đó nhưng có order `easyParcelOrderNo` khớp, `awbNo` null. | Order được update `awbNo`+`trackingNumber` = awb payload, rồi applyTrackingUpdate chạy bình thường (matched:true). Order đã có AWB khác → KHÔNG clobber (order_not_found). | US-F36-06 |

### 3.18d Mark shipment cancelled — merchant attest (mới 2026-07-10)

> Verified live 2026-07-10: EP **không** dispatch webhook cho cancel thao tác trên dashboard
> (EP delivery log trống, pipeline nhận đã chứng minh thông) + cron không poll được đơn chưa có
> AWB → đơn `ready_to_ship` có shipment đã hủy bị kẹt vĩnh viễn (không cancel/refund/re-label/
> self-deliver). Flow mới (THUẦN BỔ SUNG): seller tự xác nhận đã hủy trên EP →
> `POST /api/orders/[id]/mark-shipment-cancelled` clear EP fields (giữ audit trong tracking
> history) → zone quay về màn create-label sẵn có để tạo label mới. Trust model: tiền cước là
> ví EP của chính seller; khai sai chỉ rủi ro ví họ (double booking) — confirm dialog cảnh báo.

| TC | Type | Priority | Title | Steps | Expected | Refs |
|----|------|----------|-------|-------|----------|------|
| **TC-F36.159** | Func | Critical | Mark cancelled happy path — CAS clear + về `confirmed` + audit history | Order `ready_to_ship` + `easyParcelOrderNo` thật. POST mark-shipment-cancelled. | 200 `{status:'confirmed'}`; CAS 1 lần: `status='confirmed'` (mở lại CẢ create-label lẫn /cancel theo BR-Cancel-02) + clear `easyParcelOrderNo/awbNo/trackingNumber/labelUrl(s)/pickupScheduledAt/codStatus`, tracking=`cancelled`; history append entry chứa shipment + AWB cũ. | §3.18d |
| **TC-F36.160** | Func | Critical | Guards: không shipment / CLAIM: / sai status / not found | (a) `easyParcelOrderNo` null → 422 `NO_EP_SHIPMENT`; (b) `CLAIM:` sentinel → 422 `NO_EP_SHIPMENT`; (c) status `shipped` → 422 `INVALID_TRANSITION`; (d) order không tồn tại → 404. | Không có write nào xảy ra ở mọi nhánh guard. | §3.18d |
| **TC-F36.161** | Edge | High | Concurrent: CAS miss → idempotent hoặc 409 | 2 request song song; hoặc order đổi trạng thái giữa chừng. | Loser: nếu shipment đã cleared → 200 `alreadyMarked` (không append history trùng); nếu order còn shipment/đổi status → 409 `CONFLICT`. | §3.18d |
| **TC-F36.162** | Func | High | Sau clear, zone quay về màn create-label + cancel mở lại | `deriveFulfillState`: `confirmed` + không shipment/awb + `shippingCourier` + `parcelWeight` còn. | `'ready'` — hiện lại màn Create label (method + date) sẵn có; create-label chạy lại qua idempotency NULL. Order-actions: nút Cancel hiện lại (`isCancelAllowed('confirmed')`). | §3.18d |
| **TC-F36.163** | Money | Critical | create-label status guard trong claim CAS (review #1582) | Đơn confirmed; /cancel (refund) và create-label chạy song song, /cancel thắng trước. | Claim CAS có `AND status IN ('confirmed','paid','processing')` → create-label thua trả 422 `INVALID_TRANSITION` (không phải 409); KHÔNG charge ví EP, KHÔNG resurrect đơn cancelled lên ready_to_ship. Manual/race test — verify bằng đọc SQL + recheck branch. | §3.18d |
| **TC-F36.164** | Money | Critical | Resolver ưu tiên variant COD khi đơn COD (review #1582) | Đơn COD, method=pickup; courier có variant pickup rẻ KHÔNG COD + variant pickup đắt hơn CÓ COD. | Chọn variant CÓ COD (tránh false `COD_NOT_ELIGIBLE`). Không có variant COD nào → fallback cheapest, COD gate downstream báo chính xác kèm recovery panel. | §3.18b |
| **TC-F36.165** | Func | High | Client dùng `supported[]` từ 422 METHOD_NOT_SUPPORTED (review #1582) | Server trả `supported: []` (courier không hỗ trợ cả 2 method — EP flag anomaly). | Cả 2 option disable, KHÔNG auto-flip vào method cũng unsupported, CTA Ready-to-Ship disable, toast `methodNoneSupported`. Không loop 422. Manual/UI. | §3.18b |
| **TC-F36.166** | Money | Critical | /cancel guard label-free (review #1582 round 2-3) | /cancel chen vào cửa sổ claim→submit của create-label (order đang giữ `CLAIM:` hoặc shipment thật). | Cả 3 CAS tiến của /cancel có `AND easy_parcel_order_no IS NULL` → cancel thua khi label đang/đã book. CAS miss vì label → **409**: shipment thật → `LABEL_EXISTS` ("cancel the EP shipment first"); `CLAIM:` transient → `LABEL_IN_PROGRESS` (retry). 2 CAS rollback KHÔNG có guard (phải luôn restore được). Enum defensive `'paid'` trong db-setup. 3 unit tests + 1 SQL assertion trong test Stripe (TC-F10-03-26) khóa guard ở CAS xendit/stripe. | §3.18d |
| **TC-F36.167** | Func | High | Crash-remnant self-heal trong nhánh alreadyCreated (review #1582 round 3) | create-label ghi shipment + flip status bằng 2 update riêng; crash giữa chừng → order pre-ship (`confirmed/paid/processing`) giữ shipment THẬT. Merchant bấm lại Ready to Ship. | Nhánh idempotency `alreadyCreated` CAS flip status → `ready_to_ship` (WHERE khớp đúng shipment đã đọc, không đụng cancelled/shipped) → UI ra state success, mở lại lối mark-shipment-cancelled → /cancel. Manual/api. | §3.18d |

---

### 3.19 Additional Edge & Integration

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.151** | Edge | High | Rate với weight=0 toàn cart → DEFAULT_PARCEL, không gửi 0 | Cart toàn SP weight=0. Rate. | Gửi DEFAULT_PARCEL weight, không gửi 0 (EP reject weight=0). | US-04 additional |
| **TC-F36.152** | Integration | High | Race: 2 buyer checkout đồng thời cùng site EP ON | 2 buyer concurrent rate + place order. | Cả 2 order persist courier/fee độc lập, không lẫn. | US-04 AC-3 |
| **TC-F36.153** | Integration | Medium | Cron chạy khi 1 tenant token hết hạn → refresh, không fail toàn batch | Batch có tenant token expired. | Tenant đó refresh token; các tenant khác vẫn sync. Không fail cả batch. | US-01 AC-4, US-09 |
| **TC-F36.154** | Edge | Medium | Rate khi EP trả 0 quotation (courier không phục vụ tuyến) | Dest tuyến courier không phục vụ. | Fallback flat + log, không vỡ checkout. | NFR-4 |
| **TC-F36.155** | Edge | Medium | Create-label khi selectedCourier bị đổi giữa order + label | Order lưu J&T, settings đổi Flash sau. Tạo label. | Label dùng shippingServiceId snapshot trên order (không dùng selectedCourier mới). | US-06 |
| **TC-F36.156** | Sec | High | create-label auth — chỉ owner tenant tạo được | User khác tenant POST create-label order tenant B. | 403. Không gọi submit_orders. | NFR-3 |
| **TC-F36.157** | Edge | Medium | Tracking status code chưa map (unknown code) | Nhận code lạ (vd 99). | Không crash; giữ status cũ + log; không đổi lifecycle. | US-09 |
| **TC-F36.158** | Money | High | Free-ship + EP rate: subtotal ≥ freeAbove → fee=0 dù EP trả giá | EP ON, freeAbove=RM100, subtotal RM150, EP trả RM12. | Ship = FREE (fee=0) — free threshold override EP rate. | US-05 AC-3 |
| **TC-F36.159** | Edge | Medium | Disconnect giữa lúc có order shipped chưa delivered | Disconnect EP khi còn order awbNo shipped. | Order cũ giữ awbNo/tracking; cron sync token đã clear → skip/log (không crash). Warn merchant. | US-01 additional |
| **TC-F36.160** | Money | Critical | Non-custody guardrail — platform KHÔNG dùng ví EP chung | Kiểm mọi EP call. | Mỗi call dùng token per-merchant → ví riêng. KHÔNG có ví EP chung platform. | NFR non-custody |

---

### 3.20 Gap-Fill — Address/Phone Transform, 2-Step Label, Pre-Alert, Email (from host PRD FR review)

> Bổ sung sau khi review host PRD F14 §20.2 (B-8/B-10), F10 §20 (C-1/C-6f/C-8a/D-1) + ck:scenario. Đây là logic **chưa cover** trong 160 TC gốc — rủi ro cao (địa chỉ sai → giao thất bại → mất cước; unit sai → lệch tiền).

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.161** | Money | Critical | `mapState()` — 16 bang → subdivision_code ISO 3166-2 | mapState("Pulau Pinang"), mapState("W.P. Kuala Lumpur"), mapState("Sabah"). | "MY-07", "MY-14", "MY-12"... đúng 16 bang. State không map → reject (không gửi EP sai). | B-8, §9 #3 |
| **TC-F36.162** | Sec | High | `mapState()` — state lạ/có dấu/rỗng → reject không gửi | mapState("Tokyo"), mapState("Sélangor"), mapState(""). | Throw/reject rõ ràng, KHÔNG gửi subdivision_code rác lên EP. | B-8 |
| **TC-F36.163** | Money | Critical | `normalizePhone()` — bỏ +60, digits-only, tách country_code | normalizePhone("+60122134567"), ("0122134567"), ("60122134567"), ("012-213 4567"). | phone_number="0122134567" (digits-only, không +60), phone_number_country_code="MY" (tách field). | B-8, PRD §8 params |
| **TC-F36.164** | Edge | High | `normalizePhone()` — số quá ngắn/ký tự lạ | normalizePhone("123"), ("abc"), (null). | Reject/error rõ, không gửi phone rác (EP reject → giao fail). | B-8 |
| **TC-F36.165** | Func | High | `buildAddress()` — split addr1/addr2, city required | buildAddress từ 8 receiver field (name/phone/email/addr1/addr2/city/state/postcode). | address_1 + address_2 tách đúng, city required (thiếu → reject), không cắt cụt ký tự. | B-8 |
| **TC-F36.166** | Money | Critical | **[SPEC-DEP]** 2-step submit+pay — pay fail giữa chừng KHÔNG kẹt/double | (API-key model) EPSubmitOrderBulk OK nhưng EPPayOrderBulk fail. Retry. | Order không kẹt nửa vời; retry pay KHÔNG tạo AWB/submit mới (idempotent theo submit ref). Chỉ 1 lần trừ ví. (OAuth model: N/A — single call.) | C-1, NFR-2, spec-conflict |
| **TC-F36.167** | Func | High | **[SPEC-DEP]** Tracking taxonomy — 13 string enum HOẶC numeric 0-11 | Nhận status từ EPParcelStatusBulk (13 enum) hoặc tracking_status (numeric). | Map đúng về display theo spec đã chốt. Nếu API-key: 13 `ship_status` string; nếu OAuth: numeric 0-11. Doc chốt 1 khi PM resolve. | C-7, §8, spec-conflict |
| **TC-F36.168** | Sec | High | **[SPEC-DEP]** API-key connect — error code + env auto-detect | (API-key model) Test connection: key sai → `EASYPARCEL_INVALID_KEY`; warehouse postcode sai → `EASYPARCEL_INVALID_WAREHOUSE`; env auto-detect production→demo, lưu `detectedEnv`. | Error code đúng, KHÔNG lưu khi fail, không lộ key. (OAuth model: thay bằng TC-F36.01-05.) | A-2, spec-conflict |
| **TC-F36.169** | Money | High | DEFAULT_PARCEL gửi **cả weight + dims** ở rate-check khớp label | Product weight=0 → rate-check. So dims rate vs dims label. | DEFAULT_PARCEL mang cả fallback weight + box dims (W/L/H cm int); gửi dims ở CẢ rate-check lẫn label → volumetric basis khớp (giá rate = giá label, không lệch). | B-1, B-9, C-4b |
| **TC-F36.170** | Money | High | Modal weight validation 0.1–50 kg required | Modal Ready-to-Ship: nhập weight 0.05, 0.1, 50, 51, rỗng. | 0.1–50 accept; <0.1 / >50 / rỗng → nút disable + error. Dims W/L/H cm integer, prefill DEFAULT_PARCEL, always sent. | C-4b, C-5 |
| **TC-F36.171** | Money | Critical | **C-6f** codStatus vs paymentStatus độc lập (COD unpaid→paid on Completed) | Order COD: codStatus='collected' + paymentStatus='unpaid' đồng thời. Sau đó merchant Completed. | 2 field độc lập hợp lệ. codStatus KHÔNG ghi đè paymentStatus. paymentStatus COD: unpaid → paid khi order Completed (payment lifecycle riêng). F36 THÊM codStatus, KHÔNG đổi payment logic. | C-6f |
| **TC-F36.172** | Func | High | **Case A pre-alert** — Delivery On Hold / Exception trước Returned (OPEN) | Cron nhận 'Delivery On Hold' rồi 'Exception' rồi 'Returned'. | On Hold + Exception → amber pre-alert (early warning, KHÔNG đổi lifecycle). Returned → Case A banner definitive. **[OPEN — verify sandbox thời điểm flip; UX chốt sau].** | D-1, F10 §20.3 OPEN |
| **TC-F36.173** | Func | Medium | **C-8a** Email "Shipped" reuse trackingUrl → buyer link "Theo dõi" | Order EP shipped có trackingUrl. Email gửi buyer. | Reuse email hook F14 BR-09: email chứa link "Theo dõi" (trackingUrl). KHÔNG dựng email template mới. | C-8a |
| **TC-F36.174** | UI | Medium | **D-5** Cancel context msg đúng wording theo label state | Cancel: (a) chưa pickup (b) đã pickup. | (a) "Cancel on EP dashboard to recover freight"; (b) "Freight lost — courier processing". Assert đúng wording. | D-5 |
| **TC-F36.175** | UI | Low | **A-3** Hint eKYC/bank verify COD lần đầu | Settings courier COD. | Prime hiện hint "COD payout lần đầu cần eKYC + verify bank trên EasyParcel". Prime CHỈ hiện hint, KHÔNG build verify. | A-3 |
| **TC-F36.176** | UI | Medium | **A-3** Settlement ETA per-courier + cảnh báo Aramex T+30 | Settings courier list. | Mỗi courier hiện settlement ETA (Flash T+1-3, J&T T+7-12, Aramex ~T+30). Aramex cảnh báo "giữ tiền ~1 tháng", KHÔNG default. | A-3, F10 §20.2 |
| **TC-F36.177** | Money | Critical | Currency rounding "8.505" → 851 (half-up, no drift) | normalize("8.505"). | 851 sen (Math.round half-up), KHÔNG 850 (float drift). | NFR-1 |
| **TC-F36.178** | Integration | High | Webhook replay (topic gửi trùng) → idempotent | Webhook topic 1 gửi cùng event 2 lần. | Order update idempotent — không double-apply, không đổi lifecycle 2 lần. | Integration, C-7 |

---

### 3.21 Gap-Fill v1.2 — API Payload Params, Buyer Label Vocab, Token-at-Rest (from PRD/design field-map review)

> Bổ sung sau khi review **Design §9 field map** (§9.1 quotation, §9.2 submit_orders) + §2.4 buyer label + US-01 DoD. Đây là param/behavior **chưa cover** trong 178 TC trước — rủi ro: sai `parcel_value` (lệch insurance/COD), thiếu `feature.*` (buyer không nhận notif), `item[]` gộp sai (giao nhầm), Aramex thiếu cut-off (SLA sai), lộ vocab nội bộ ra buyer.

| ID | Type | Pri | Title | Steps | Expected | Refs |
|---|---|---|---|---|---|---|
| **TC-F36.179** | Money | High | `parcel_value` = order total (RM, `/100`) gửi ở quotation + submit_orders | Order total 5000 sen (RM50.00). Rate-check rồi create-label. | Payload gửi `parcel_value` = 50.00 (RM-float = total/100), **KHÔNG gửi 5000** (sen). Dùng làm insurance/COD basis. Cùng giá trị ở CẢ rate lẫn submit (không lệch). | Design §9.1, §9.2 field map, NFR-1 |
| **TC-F36.180** | Func | Medium | submit_orders `feature.*` tracking booleans map đúng order settings | Tạo label với sms/email tracking bật (whatsapp tắt). | Payload `feature.sms_tracking`/`email_tracking`/`whatsapp_tracking`/`awb_branding` = boolean đúng theo settings (KHÔNG hardcode true). Buyer notif theo cấu hình. | Design §9.2 |
| **TC-F36.181** | Func | Medium | `item[]` build 1 phần tử / product line (content/weight/dims/value/qty) | Order 2 SP: A×2 (0.5kg), B×1 (1.0kg). Tạo label. | `item[]` có 2 entry: mỗi entry content=tên SP, weight, dims, value (RM=/100), quantity đúng line. **KHÔNG gộp thành 1 item.** | Design §9.2 item[] |
| **TC-F36.182** | Func | Medium | COURIER_CUTOFF có **Aramex** (courier COD chọn được) — không thiếu entry | Chọn Aramex, mở date picker. Test cut-off Aramex. | Aramex có cut-off const **xác định** (KHÔNG rơi vào fallback conservative do thiếu entry). Pos Laju (non-COD, không chọn được) không cần trong picker. **[FLAG doc §9 #12 — COURIER_CUTOFF hiện list Pos nhưng THIẾU Aramex].** | US-07 AC-3, Design §2.3 |
| **TC-F36.183** | Sec | Medium | Buyer label **vocab-collapse** — KHÔNG render raw Exception/Admin Cancel/Expired | shippingTrackingStatus ∈ {Exception, Admin Cancel, Expired}. Buyer mở track/label. | Buyer thấy label mềm ("Tạm hoãn"/"Đang xử lý"), **TUYỆT ĐỐI không render chữ** "Exception"/"Admin Cancel"/"Expired". Projection ở tầng display-label (bổ sung field-omission TC-126..132). | NFR-10, Design §2.4 |
| **TC-F36.184** | Sec | Medium | oauthTokens **encrypt at-rest** (assertion riêng, nâng từ note TC-10) | Đọc trực tiếp cột `easyParcelIntegration.oauthTokens` trong DB. | access_token/refresh_token lưu **đã mã hóa** (không plaintext), decrypt khi dùng. (TC-10 chỉ check no-leak ở response/log.) | NFR-3, NFR-8, US-01 DoD |
| **TC-F36.185** | Func | Low | Cron tracking batch chunk ≤100 AWB/call | Tenant có 250 order shipped chưa complete. Chạy cron. | `tracking_status` gọi theo chunk **≤100 AWB** (PRD §8 batch 100), group per tenant + backoff. KHÔNG gửi >100 trong 1 call. | US-09 AC-1, NFR-5, PRD §8 |

---

## 4. End-to-End UAT Flows

### E2E #1: Merchant connect → Buyer checkout West MY (happy path, EP ON)

1. SME login → Settings → Shipping → tab EasyParcel → "Connect with EasyParcel"
2. OAuth popup → login sandbox → grant → callback → "Connected — Account: X (Live)" + wallet balance
3. Nhập warehouse West MY (Selangor, 47800) → Save → rate-check validate pass
4. Chọn courier J&T (single-select, trong 4 courier COD)
5. Buyer (incognito) add SP 1.0kg → checkout → nhập địa chỉ Selangor 50480
6. Order Summary: 1 dòng "Shipping: RM X.XX" (rate thật J&T), KHÔNG section courier, KHÔNG SST
7. Place Order (bank/COD) → order persist shippingCourier=J&T + serviceId + shippingFee (RM-float) + parcelWeight (**kg**, GH-1458)

### E2E #2: Fulfillment — create label + pickup + tracking (money flow)

1. Order paid/confirmed. Merchant mở OrderDetailPanel → "Ready to Ship"
2. Modal prefill weight (parcelWeight) + dims (DEFAULT_PARCEL) + pickup date (cut-off-aware, default earliest)
3. Confirm → POST create-label → submit_orders → **ví trừ 1 lần** → awbNo + tracking_url → order `ready_to_ship`
4. **Idempotent check:** bấm lại "Ready to Ship" → KHÔNG trừ ví lần 2, trả AWB cũ
5. awb_url tới async (webhook topic 2) → nút in label hiện
6. "Ship Order" → xác nhận pickup → shipped (KHÔNG nhập tracking)
7. Cron/webhook: code 4 In Transit → chỉ hiển thị; code 5 Delivered → shippingTrackingStatus=5 **KHÔNG auto-complete**
8. Merchant bấm "Completed" thủ công

### E2E #3: Wallet low → retry (money guard)

1. Ví EP hết tiền. Merchant "Ready to Ship" → confirm
2. submit_orders fail → error `EASYPARCEL_WALLET_LOW` + link nạp ví
3. Order KHÔNG đổi trạng thái (vẫn paid/confirmed), KHÔNG awbNo rác
4. Merchant nạp ví EP dashboard → retry → label tạo OK, ví trừ 1 lần

### E2E #4: Returns Case B manual buyer-return → refund

1. Order 'completed'. Buyer contact out-of-band xin return
2. Merchant nhập return fields: tracking_code (Pos Laju AWB free-text) + fee_payer=buyer + return_shipping_fee=RM15 + reason
3. return_status: none → requested → (buyer ships) in_transit → received
4. **Buyer track endpoint KHÔNG lộ** 6 return field
5. Merchant inspect → Refund (F10) → goods refund + restock → return_status='refunded'
6. return_shipping_fee informational — KHÔNG trừ revenue/analytics

### E2E #5: Hybrid fallback (merchant cũ, EP OFF)

1. Tenant EP OFF (chưa connect)
2. Buyer checkout West → flat RM (F14 rate) — KHÔNG vỡ
3. Merchant "Ship Order" → ShipOrderModal manual → nhập trackingNumber tay → shipped (0 đổi so với hôm nay)

---

## 5. Quality Gates

| Nhóm | TCs | Mục tiêu pass | TCs Blocker/Critical |
|---|---|---|---|
| **A1. OAuth Connect** | TC-F36.01..13 | 13/13 | 01, 02, 04, 07, 09, 10 |
| **A2. Courier Selection** | TC-F36.14..19 | 6/6 | 14, 15 |
| **A3. Hybrid Fallback** | TC-F36.20..24 | 5/5 | 20, 21, 22 |
| **B1. Rate Backend** | TC-F36.25..35 | 11/11 | **30, 31, 32** |
| **B2. Checkout Display** | TC-F36.36..43 | 8/8 | 37, 38 |
| **C1. Create Label** | TC-F36.44..50 | 7/7 | 44, 49 |
| **C2. Idempotency + Wallet** | TC-F36.51..57 | 7/7 | **51, 52, 54, 55** |
| **C3. Pickup/Dropoff** | TC-F36.58..67 | 10/10 | 59, 60, 62, 63 |
| **C4. Tracking Sync** | TC-F36.68..78 | 11/11 | 69, 71, 75 |
| **COD1. Eligibility+Label** | TC-F36.79..92 | (DEFERRED) | 84, 85, 88 (blocked) |
| **COD2. Status Tracking** | TC-F36.93..97 | 5/5 | 96 |
| **D1. Returns Case A** | TC-F36.98..101 | 4/4 | 99 |
| **D2. Cancel/Refund** | TC-F36.102..106 | 5/5 | 102, 103, 104, 105 |
| **D3. Manual Return Case B** | TC-F36.107..113 | 7/7 | 111 |
| **Currency Regression** | TC-F36.114..125 | 12/12 | **114, 115, 116, 118, 122, 123** |
| **Security/Projection** | TC-F36.126..135 | 10/10 | **126, 127, 128, 129, 133, 135** |
| **DB & Migration** | TC-F36.136..143 | 8/8 | 141 |
| **Sandbox TBD** | TC-F36.144..150 | (manual sandbox) | 144, 145 |
| **Edge & Integration** | TC-F36.151..160 | 10/10 | 160 |
| **Gap-Fill (transform/spec/pre-alert)** | TC-F36.161..178 | 18/18 | **161, 163, 166, 171, 177** |
| **Gap-Fill v1.2 (payload/vocab/at-rest)** | TC-F36.179..185 | 7/7 | **179, 183** |
| **E2E UAT** | 5 flow | 5/5 | Tất cả |

**Cổng release:** 100% TCs Blocker/Critical **non-deferred** pass + **money-critical suite (currency + idempotency + wallet + projection) 100%** + 0 Blocker bug open. COD suite (US-08) **DEFERRED** — không block go-live phase A–D nếu COD disabled toàn feature; unblock sau sandbox verify §9 #1.

---

## 6. Traceability Matrix (US/AC/NFR ↔ TC)

| Nguồn | TCs Coverage |
|---|---|
| **US-F36-01** OAuth Connect | TC-F36.01..13, 136, 153, 159 |
| — AC-1 token exchange | 01, 02, 03 |
| — AC-2 warehouse validate | 04, 05, 06 |
| — AC-3 IDOR/auth | 07, 08 |
| — AC-4 token refresh | 09, 153 |
| **US-F36-02** Courier Selection | TC-F36.14..19 |
| **US-F36-03** Hybrid Fallback | TC-F36.20..24, 154 |
| **US-F36-04** Rate Backend | TC-F36.25..35, 137, 151, 152, 158 |
| — AC-2 currency | 30, 31, 32, 114..125 |
| — AC-3 persist courier | 29, 152 |
| **US-F36-05** Checkout Display | TC-F36.36..43, 158 |
| **US-F36-06** Create Label | TC-F36.44..57, 138, 155, 156 |
| — AC-2 idempotent | **51, 52, 53** |
| — AC-3 wallet low | **54, 55, 56, 57** |
| **US-F36-07** Pickup/Dropoff | TC-F36.58..67 |
| — AC-3b server re-validate | **63, 64** |
| **US-F36-08** COD (DEFERRED) | TC-F36.79..92, 144 |
| **US-F36-08b** COD Status | TC-F36.93..97 |
| **US-F36-09** Tracking Sync | TC-F36.68..78, 157 |
| — AC-3 no auto-complete | **75** |
| **US-F36-10** Returns Case A | TC-F36.98..101 |
| **US-F36-11** Cancel/Refund | TC-F36.102..106 |
| **US-F36-12** Manual Return B | TC-F36.107..113 |
| — AC-4 no buyer leak | **111** |
| **NFR-1** Currency sen↔RM | TC-F36.30, 31, 84, 85, 114..125, 158 |
| **NFR-2** Idempotent label | TC-F36.51, 52, 53 |
| **NFR-3** OAuth per-merchant | TC-F36.02, 07, 08, 10, 35, 133, 135, 156 |
| **NFR-4** Hybrid fallback | TC-F36.20..24, 34, 38, 154 |
| **NFR-5** Cron auth/backoff | TC-F36.68, 69, 77 |
| **NFR-6** Perf p95 | TC-F36.34, 48 |
| **NFR-7** Wallet low UX | TC-F36.54..57 |
| **NFR-8** No global secret | TC-F36.10, 24, 133, 134 |
| **NFR-9** Migration gate | TC-F36.136..143 |
| **NFR-10** Buyer-safe projection | TC-F36.56, 111, 126..132 |
| **Non-custody** platform RM0 | TC-F36.32, 92, 105, 160 |
| **B-8** receiver transform (mapState/normalizePhone/buildAddress) | TC-F36.161, 162, 163, 164, 165 |
| **B-1/B-9/C-4b** DEFAULT_PARCEL weight+dims consistency | TC-F36.27, 169, 170 |
| **C-1** 2-step submit+pay (spec-dep) | TC-F36.166 |
| **C-6f** codStatus ⊥ paymentStatus | TC-F36.171, 96 |
| **C-7/C-8a** tracking taxonomy + email link | TC-F36.167, 173, 178 |
| **D-1** Case A pre-alert (On Hold/Exception/Returned) | TC-F36.98, 172 |
| **D-5** cancel context wording | TC-F36.103, 104, 174 |
| **A-2/A-3** connect error codes + COD hint (spec-dep) | TC-F36.168, 175, 176 |
| **Spec conflict** OAuth vs API-key | TC-F36.166, 167, 168 + §9 Q7 |
| **Design §9.1/§9.2** payload field-map (parcel_value/feature/item[]) | TC-F36.179, 180, 181 |
| **COURIER_CUTOFF** Aramex roster (§9 #12) | TC-F36.182, 65 |
| **NFR-10** buyer label vocab-collapse | TC-F36.183, 126..132 |
| **US-01 DoD** token encrypt-at-rest | TC-F36.184, 10, 136 |
| **NFR-5** cron batch chunk≤100 | TC-F36.185, 68, 77 |

**Coverage:** 13/13 US + 10/10 NFR + non-custody guardrails ✅ | Money-critical: currency (12 TC) + idempotency (3 TC) + wallet (4 TC) + projection (7 TC) = 26 dedicated money/security TCs.

---

## 7. Self-Check

```
Self-check QA Test Plan F36 (v1.2 — 2026-07-09):
├── Tổng TCs: 185 (TC-F36.01..185) ✅
├── Gap-fill (v1.2): parcel_value RM/100 (179), feature.* booleans (180),
│   item[] per-line (181), Aramex cut-off (182), buyer vocab-collapse (183),
│   token encrypt-at-rest (184), cron batch chunk≤100 (185) ✅
├── Doc contradiction flagged (v1.2): wallet-balance Design vs NFR-7 + TC-01↔TC-19/57 (§9 #9),
│   courier_logo CSP (§9 #10), COURIER_CUTOFF Aramex/Pos roster (§9 #12) ✅
├── Gap-fill (v1.1): address/phone transform (161..165), 2-step label (166),
│   tracking taxonomy (167), API-key connect (168), DEFAULT_PARCEL dims (169),
│   modal weight validation (170), codStatus/paymentStatus (171), Case A pre-alert (172),
│   email trackingUrl (173), cancel wording (174), eKYC/settlement hint (175/176),
│   currency 8.505 (177), webhook replay (178) ✅
├── Correctness fixes (v1.1): parcelWeight kg (KHÔNG gram, GH-1458) ✅ | COD per-courier limit (KHÔNG hardcode) ✅
├── BLOCKER flagged: spec conflict OAuth vs API-key ✅
├── E2E UAT flow: 5 ✅
├── 100% US mapped: 13/13 (01..12 + 08b) ✅
├── 100% NFR mapped: 10/10 ✅
├── Non-custody guardrail: TC-F36.32, 92, 105, 160 ✅
├── MONEY-CRITICAL:
│   ├── Currency regression (NFR-1): TC-F36.114..125 (12 TC) ✅
│   ├── Idempotency double-charge (NFR-2): TC-F36.51, 52, 53 ✅
│   ├── Wallet-low guard (NFR-7): TC-F36.54..57 ✅
│   └── sen vs RM-float phân biệt: TC-F36.31, 85, 122, 123, 124 ✅
├── SECURITY:
│   ├── Buyer-safe projection (NFR-10): TC-F36.126..132, 56, 111 ✅
│   ├── OAuth IDOR/cross-tenant: TC-F36.07, 08, 35, 135, 156 ✅
│   └── Token no-leak: TC-F36.10, 133, 134 ✅
├── DEFERRED marked: US-F36-08 COD (TC-F36.79..92) — blocked §9 #1 ✅
├── Sandbox TBD marked: TC-F36.144..150 (5 open items + boundary) ✅
├── Order lifecycle no-auto: TC-F36.75 (delivered ≠ complete) ✅
├── Dual-field tracking: TC-F36.71, 73 ✅
├── Cut-off + server re-validate SLA: TC-F36.59..64 ✅
├── DB migration gate (NFR-9): TC-F36.136..143 ✅
├── Nhãn Priority + Type: Tất cả TCs ✅
├── Dữ liệu test cụ thể: Có (sen values, weight/dims boundary, courier, postcode) ✅
└── Out-of-scope: markup, insurance, Delyva, multi-warehouse, COD East, EP reverse label ✅
```

---

## 8. Test Execution Notes

### Pre-conditions
- Test tenant seed `easyParcelIntegration` (4 tenant: EP-West / EP-East / EP-OFF / EP-incomplete)
- Sandbox OAuth creds (KHÔNG production wallet — tránh trừ tiền thật)
- Test products với weight variety (0, 0.5, 1.0, 30, 50 kg) + dims
- Test addresses 16 states + postcode West/East + Labuan
- Ví sandbox: nạp credit + drain-to-zero scenario
- Order fixtures đủ trạng thái (chưa label → delivered → returned)

### Tools
- Unit/API: Vitest — `src/lib/shipping/easyparcel/{normalize,client}.ts`, `get-rates.ts`, `create-label`, `sync-tracking`
- Currency: unit test thuần cho normalize (RM↔sen) — **gold-standard chống regression, chạy mọi PR**
- E2E: Playwright (khi UI implement) cho E2E #1-5
- Sandbox manual: TC-F36.144..150 (webhook/COD param/boundary) — QA chạy tay trên sandbox, ghi kết quả vào bảng §9 PRD

### Coverage targets (theo docs/TEST_CONVENTION.md)
- `normalize.ts` (RM↔sen) ≥ 95% lines (money-critical)
- `get-rates.ts` + create-label + sync-tracking ≥ 80% lines, all happy + 4xx + 5xx + fallback paths
- Idempotency + wallet-low paths: 100% branch

### Không auto-test (manual/sandbox only)
- TC-F36.79..92 COD (DEFERRED — blocked param verify)
- TC-F36.88, 144 COD label param (TBD sandbox)
- TC-F36.145 webhook signature (TBD sandbox)
- TC-F36.146..150 sandbox boundary (manual)

---

## 9. Unresolved Questions

1. **COD submit param (§9 #1):** `feature.cod_enabled` + `cod_amount` chưa confirm với EasyParcel support → US-08 AC-5 + TC-F36.88/144 blocked. Cần verify trước khi implement COD label.
2. **Webhook signature (§9 #2):** Spec 2026-03 không nêu HMAC/signature header → TC-F36.72/145 cần sandbox xác định cơ chế verify trước go-live.
3. **shippingFee unit inconsistency:** US-04 AC-2 lưu `shippingFee` **RM-float** (đồng nhất `total`) nhưng `cod_amount`/`return_shipping_fee` lưu **sen**. Đã tách TC (31/85/122/123/124) — cần dev confirm không nhầm lẫn field khi implement (rủi ro 100× cao nhất ở đây).
4. **F34 Xendit branch:** ✅ RESOLVED 2026-07-10 — `xendit-checkout` wired vào `getRates` (EP-aware, mirror stripe-checkout), persist courier fields + `parcelWeight`; 2 tests `[TC-F36.29]` trong `src/__tests__/api/xendit-checkout.test.ts` (EP persist + flat omit).
5. **AWB PDF timing (§9 #4):** awb_url sync hay async → ảnh hưởng TC-F36.45 (polling vs webhook). Verify sandbox.
6. **Pos Laju cut-off (US-07 AC-3):** 12:50 conservative — PHẢI confirm với Pos/EasyParcel trước go-live; re-verify cuối 2026.
7. **🚨 SPEC CONFLICT (BLOCKER) — OAuth vs API-key:** Overview PRD v2.0 + stories = OAuth 2.0/v2026-03 (`/shipment/*`, refresh token). Host PRD F14 §20 + F10 §20 = API-key (`apiKey`+`authKey`, `EPRateCheckingBulk`, `EPSubmitOrderBulk`+`EPPayOrderBulk`, `EPParcelStatusBulk`, `detectedEnv`). 2 spec KHÔNG thể đúng đồng thời. **PM/dev PHẢI chốt 1 spec** trước implement. Ảnh hưởng: connect flow (TC-01..13 vs 168), label idempotency 1-call vs 2-call (TC-51..53 vs 166), tracking taxonomy numeric vs 13-enum (TC-70 vs 167), error codes. QA cập nhật nhánh TC tương ứng sau khi chốt. → Cần đồng bộ docs (overview PRD ghi 2026-06-25 mới hơn host PRD; nhưng host PRD có data model + error code cụ thể hơn).
8. **parcelWeight unit (GH-1458):** Đã confirm kg (2026-07-06). Nếu Products.weight lưu gram trong DB → dev nhớ ÷1000 khi aggregate. TC-120 test điểm này.
9. **🔶 Wallet-balance display contradiction:** Design §2.1 hiện **wallet balance** trong green "Connected" Alert, nhưng **NFR-7 nói "KHÔNG show số dư ví chủ động"** + NFR-10 xếp wallet là seller-only. Mâu thuẫn cả với **nội bộ QA doc**: TC-01 ("Page hiện Connected + wallet balance") vs TC-19/TC-57 ("KHÔNG show số dư ví"). **PM/design chốt:** nếu theo NFR-7 → sửa TC-01 bỏ "+ wallet balance"; nếu cho hiện lúc connect → nới NFR-7. Chưa fix TC-01 (chờ chốt).
10. **[TBD] courier_logo CSP (Design Open Q §10):** Nếu EP response trả `courier_logo` external URL → cần thêm domain vào `next/image` allowlist + CSP, nếu không logo vỡ. Verify sandbox EP có trả logo URL không → quyết render (next/image vs bỏ). Chưa viết TC firm (blocked xác nhận field).
11. **[TBD] parcel_value decimals:** Design §9 không nêu rounding cho `parcel_value` (khác weight toFixed(2)/dims parseInt). Gửi raw float hay toFixed(2)? Verify trước implement — ảnh hưởng TC-179.
12. **🔶 COURIER_CUTOFF roster misalignment:** Const cut-off hiện list J&T/Flash/**Pos Laju** nhưng Pos là non-COD (KHÔNG chọn được), trong khi **Aramex** (COD, chọn được) **thiếu entry** → rơi vào fallback conservative sai SLA. Sửa: thêm Aramex cut-off, bỏ/giữ Pos tùy scope. TC-182 gate điểm này.
