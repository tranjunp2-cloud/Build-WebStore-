# PRD Overview: EasyParcel Delivery Integration — Malaysia (F36)

> **Version:** 2.0 | **Updated:** 2026-06-25 | **Owner:** Domin (Product)
> **Priority:** P1 | **Size:** XL
> **Depends on:** F09 Storefront Commerce ✅, F10 Order lifecycle + cancel-restock ✅, F34 Xendit Payment (song hành — luồng tiền hàng)
> **Provider:** **EasyParcel** (aggregator MY) — OAuth 2.0 Authorization-Code per merchant, non-custody (platform RM0 chi phí).
> **Auth:** OAuth 2.0 (Authorization-Code Grant). Merchant redirects to EasyParcel, grants access → refresh token (1 year) stored securely.
> **Status:** Active — aligned to EasyParcel v2026-03 OpenAPI (GitHub official spec).

---

## Section Index (merged into host PRDs)

Phase-specific Functional Requirements and Acceptance Criteria have been merged into their host PRDs. This file remains the single source for shared context (problem statement, target users, architecture, NFR, costs, resolved questions).

| Phase | Scope | User Stories | Home PRD |
|---|---|---|---|
| **A** | Connect via OAuth + warehouse + select courier + test connection | US-F36-01, US-F36-02, US-F36-03 | [F14-shipping.md § 20.1](./F14-shipping.md#easyparcel--connect--settings) |
| **B** | Real-time rate @ checkout + hybrid flat fallback | US-F36-04, US-F36-05 | [F14-shipping.md § 20.2](./F14-shipping.md#easyparcel--real-time-rates-hybrid) |
| **C** | Buy label + pickup/dropoff + tracking sync cron | US-F36-06, US-F36-07, US-F36-09 | [F10-orders-management.md § 20.1](./F10-orders-management.md#easyparcel--fulfillment-label--pickup--tracking) |
| **C-COD** | COD runtime: codAmount + codStatus on order | US-F36-08 | [F10-orders-management.md § 20.2](./F10-orders-management.md#easyparcel--cod-order-runtime) |
| **F-COD** | COD eligibility gating + fee disclosure | US-F36-08 | [F19-store-configuration.md § EasyParcel COD](./F19-store-configuration.md#easyparcel-cod-gating--fee-disclosure) |
| **D** | Returns + refund + cancel + manual buyer-return with fee tracking | US-F36-10, US-F36-11, US-F36-12 | [F10-orders-management.md § 20.3](./F10-orders-management.md#easyparcel--returns--cancel) |

Sub-PRDs have been merged into their home PRDs; this file is the overview + index. Shared context (NFR, architecture, cost, resolved questions) lives here.

---

## 1. Problem Statement

- Shipping hiện tại chỉ là **flat rate cứng West/East Malaysia** (800 sen / 1500 sen) trong `Sites.shippingConfig` — không phản ánh cước thật theo courier, cân nặng, khoảng cách.
- **Không có courier thật**: order chỉ có `trackingNumber` (text trống), merchant nhập tay; không mua được nhãn vận đơn, không đặt pickup, không đồng bộ trạng thái giao hàng.
- **Buyer không chọn được courier** — không thấy lựa chọn nhanh/rẻ, không thấy giá thật.
- Email template có tham số `shippingProvider` (chỉ là param của hàm template, **KHÔNG phải cột trong Orders schema**) — hiện không bao giờ được truyền giá trị.
- Merchant SME MY hầu hết đã quen EasyParcel (~70.000 SME dùng) → kỳ vọng tích hợp courier liền mạch như Shopify/WooCommerce.
- Platform là **pure SaaS** (doanh thu từ phí gói) → cần mô hình shipping mà platform **không giữ tiền cước, không gánh chi phí** vào P&L.

---

## 2. Target Users

- **SME Owner (Persona A):** chọn **1 courier** cho shop; tự tính cước chính xác; mua nhãn + đặt pickup ngay trong dashboard Prime, không phải rời platform; tự quản ví EasyParcel.
- **Buyer (Persona C):** tại checkout thấy **giá ship thật** của courier shop dùng (EasyParcel) + thời gian giao; theo dõi tracking sau khi đặt.
- **Platform (BOD/Finance):** **RM0 chi phí** (EasyParcel free signup + free API); không giữ tiền cước/COD → không cần giấy phép tài chính; chỉ orchestrate.

---

## 3. Solution Overview

Tích hợp **EasyParcel** làm courier aggregator, mỗi merchant kết nối **tài khoản EasyParcel riêng** qua **OAuth 2.0 Authorization-Code flow**:

- Merchant clicks **"Connect with EasyParcel"** button → redirected to `https://api.easyparcel.com/oauth/login` → logs in + grants access → callback returns `code` → backend exchanges for access + refresh token (10h + 1yr), stored securely per tenant.
- Checkout gọi **rate real-time** (`POST /shipment/quotations`, OAuth Bearer auth) theo origin postcode + dest postcode + cân nặng → trả **giá thật của courier shop đã chọn** (buyer không phải chọn courier). **Hybrid**: chưa kết nối → fallback flat West/East hiện tại (không phá merchant cũ).
- Merchant **mua nhãn vận đơn (AWB)** qua API (`POST /shipment/submit_orders` → `POST /shipment/list` để fetch `awb_url`) — cước trừ thẳng từ **ví EasyParcel của merchant** (wallet auto-deducted on submit). Tracking đồng bộ qua **webhook listeners** (primary, topics 1/2/3) hoặc **polling cron** qua `POST /shipment/details` + `POST /shipment/tracking_status`.
- **COD** qua EasyParcel COD service: courier thu hộ → settle thẳng về merchant. **Platform RM0, không giữ tiền cước, không markup** (giá hiển thị = giá EasyParcel raw). **Deferred to post-MVP** — spec 2026-03 exposes COD pricing in quotation but submit_orders request doesn't have explicit COD amount field; verify param format with EasyParcel support.

> **Decision (kiến trúc):** Codebase đã có `src/lib/shipping/` (flat rate) — giữ nguyên làm **fallback**. Thêm EasyParcel = **file mới** (`src/lib/shipping/easyparcel/*` + API routes), 0 phá flat-rate logic. OAuth token per merchant = mirror `echIntegration.oauthTokens`. Rủi ro kỹ thuật: **thấp**.

> **Decision (giá flat-rate fallback):** Default hiện tại `SHIPPING_DEFAULTS` (`src/lib/shipping/constants.ts`) = West 800 sen / East 1500 sen (RM8/RM15) là giá 2024–2025, **thấp so với thị trường 2026** (West ~RM7–9 retail, East ~RM10–18). Khi flat-rate kích hoạt (EP OFF / chưa kịp timeline) merchant không có discount EasyParcel → cần khung cao hơn. **Khuyến nghị:** West **1000 sen (RM10)**, East **1600 sen (RM16)**, `freeAbove` giữ 10000 sen (RM100). EasyParcel live rate khi có vẫn override fallback này. Nguồn: `plans/reports/researcher-260618-1344-my-flat-rate-shipping-pricing.md`.

### Vì sao EasyParcel (so vendor)

| Provider | Courier MY | Auth | Chi phí platform | Marketplace fit | Kết luận |
|---|---|---|---|---|---|
| **EasyParcel** | ✅ 60+ (Pos Laju, J&T, Ninja Van, DHL, Flash, City-Link...) | OAuth (free) | **RM0** | per-merchant OAuth | ✅ **Chọn** |
| Delyva | ⚠️ 7+ | per-merchant API key | ăn **1%/đơn** | SaaS mode | Dự phòng (nếu cần revenue-share) |
| Direct courier (Pos/J&T/Ninja) | 1 mỗi cái | OAuth/key riêng | hợp đồng doanh nghiệp | ❌ phải ký từng courier | Loại (nặng, phân mảnh) |
| Tracking.my | tracking-only | key | — | chỉ tracking | Bổ trợ (không tạo label) |

> EasyParcel: phủ rộng nhất + free + chuẩn de-facto SME MY (~1tr user). Per-merchant OAuth account giữ non-custody, platform RM0.

> **Lưu ý độ phủ vs picker:** "60+ courier" là **độ phủ của EasyParcel** (aggregator), KHÔNG phải số courier seller chọn được. Vì COD là **mặc định toàn platform (non-negotiable)**, courier picker ở settings **chỉ list 4 courier hỗ trợ COD** (Flash/DHL/J&T/Aramex). Xem `PD-020` (`docs/decisions/decisions-log.md`) + [F14-shipping.md § 20.1](./F14-shipping.md#easyparcel--connect--settings) FR-A-3.

### Mô hình tiền (2 luồng tách biệt)

```
Tiền HÀNG:  Buyer ──checkout──> cổng thanh toán (Xendit/Stripe, F34/F13) ──> merchant
Tiền SHIP:  Merchant ──mua label──> trừ ví EasyParcel của merchant ──> courier
Tiền COD:   Buyer trả mặt khi nhận ──> courier thu hộ ──> EasyParcel settle ──> merchant   (DEFERRED — xem §8/§9)
```
Platform **không đụng** cả 3 luồng → sạch liability, RM0 chi phí.

### Chi phí (đã verify từ spec v2026-03, GitHub official)

| Khoản | Ai chịu | Mức |
|---|---|---|
| Signup + dùng app EasyParcel | — | **Miễn phí** |
| **API** (rate / order / tracking / webhooks) | — | **Miễn phí hoàn toàn** |
| OAuth setup (no additional cost) | — | **Miễn phí** |
| Cước ship | **Merchant** | trừ ví prepaid; 1kg West MY ~**RM4-8** (J&T từ RM5.42) |
| Nạp ví | Merchant | tùy ý từ RM20, credit hạn 365 ngày, **không có API topup** |
| COD phí | Merchant | max(flat, 4%) trừ vào tiền thu hộ; Flash RM5, DHL RM6, J&T RM7, Aramex RM10; **West MY only**; chỉ 4 courier này hỗ trợ (Pos Laju/Ninja/SPX/City-Link không). Hạn mức + settlement T+X KHÁC theo courier. **[DEFERRED — xác nhận COD param name với EasyParcel support trước khi implement]** |
| **Platform** | — | **RM0** (vs Xendit RM7.50/merchant/tháng) |

> EasyParcel kiếm tiền bằng margin gộp sẵn trong giá cước (mua sỉ volume) — merchant thường trả **rẻ hơn** đi thẳng courier. Giá rate-check (quotation response) = giá all-in, không hidden fees.

---

## 4. Architecture (high-level)

```
Buyer ──checkout──> [Next.js storefront]
   │  POST /api/orders/calculate-shipping { siteId, dest postcode, items(weight) }
   ▼
getRates() ──┬─ tenant.easyParcelIntegration.connected + oauthTokens.accessToken + warehouse?
             │     └─YES─> POST /shipment/quotations (origin↔dest, weight, dims) cho selectedCourier ──> EasyParcel
             │              → giá RM (÷100 → sen) + ETA của đúng 1 courier shop chọn
             └─NO──> flat West/East (getShippingRate hiện tại)          [HYBRID FALLBACK]
   ▼
order lưu shippingCourier + shippingServiceId + shippingFee (buyer KHÔNG chọn courier)
   ▼  (buyer trả tiền hàng qua F34/F13 → order paid)
   ▼
[Merchant dashboard] Nút "Ready to Ship" (action inline có sẵn trong OrderDetailPanel)
   │  EP tenant → mở modal tạo label; non-EP → flip status như cũ (no modal). KHÔNG màn riêng.
   │  POST /api/orders/[id]/create-label → POST /shipment/submit_orders (OAuth Bearer token)
   │     → trừ ví EasyParcel merchant (wallet auto-deduct) → trả shipment_number + awb_number + tracking_url
   ▼  lưu shipmentNumber + awbNumber + trackingUrl; trackingNumber = awbNumber; order → ready_to_ship
   ▼  In label (PDF — fetch awb_url async via webhook + /shipment/details) + Pickup/dropoff (collection_date)
   ▼  Nút "Ship Order" (có sẵn): EP → xác nhận courier pickup → shipped (KHÔNG nhập tracking tay)
Webhook listeners (topic 1 status + topic 2 awb + topic 3 tracking) ──> cập nhật order realtime
   └─ FALLBACK: Cron /api/cron/sync-tracking ──POST /shipment/details + /shipment/tracking_status──> sync tracking (numeric status code)
   ▼  delivered (code 5) → merchant tự bấm completed (KHÔNG auto-complete)
Buyer xem tracking trên trang đơn (dual-field: order.status lifecycle vs shippingTrackingStatus display)
```

**Tái dùng (0 phá hành vi):**
- `src/lib/shipping/calculate-fee.ts` + `constants.ts` — flat rate, làm nhánh fallback.
- F10 cancel-restock (`/api/orders/[id]/cancel`) + refund (`/api/orders/[id]/refund`, Stripe/manual, tự restock, idempotent) + nút Refund/Cancel inline — **reuse 100% cho Phase D** (returns handled via Refund; KHÔNG dựng RMA mới).
- Order lifecycle hiện có: `pending → new → confirmed → ready_to_ship → shipped → completed` (+ `cancelled`, `refunded`).
- **Geo cascade MY — 4 endpoint NATIVE có sẵn, reuse 100%, KHÔNG build mới** (warehouse dropdown + autofill):
  - `GET /api/geo/states` → 16 bang + `zone` (west/east) · `src/app/api/geo/states/route.ts`
  - `GET /api/geo/districts?stateId=` → city/district theo bang · `src/app/api/geo/districts/route.ts`
  - `GET /api/geo/postcodes?districtId=` → postcode theo district · `src/app/api/geo/postcodes/route.ts`
  - `GET /api/geo/lookup/[postcode]` → reverse: postcode → {district, state, zone} · `src/app/api/geo/lookup/[postcode]/route.ts`
  - Dataset: bảng `malaysia_states/districts/postcodes` (seed `scripts/seed-malaysia-geo-boot.js`). Checkout đã dùng cascade này.
  - **Recommend (DRY):** tách cascade inline của `CheckoutAddressForm.tsx` thành component dùng chung (`AddressCascadeFields`) cho cả checkout + warehouse; né rủi ro đụng checkout → F36 gọi thẳng 4 endpoint trên.
  > **Ranh giới native vs build mới:** 4 geo endpoint + dataset = **reuse**. Backend EasyParcel (test-connection, save `easyParcelIntegration`, rate/label/tracking) = **build mới** (chưa có dòng easyparcel nào trong `src/`).

**File mới:** `src/lib/shipping/easyparcel/{client,types,normalize}.ts`, `src/lib/shipping/get-rates.ts`, `src/app/api/orders/[id]/create-label/route.ts`, `src/app/api/cron/sync-tracking/route.ts`. Mở rộng: `calculate-shipping/route.ts`, settings shipping, `CheckoutClient.tsx`, `OrderDetailPanel` (gắn tạo label vào nút "Ready to Ship"), `ShipOrderModal.tsx` (giữ nhánh manual non-EP). **Reuse 0 đổi:** `api/orders/[id]/{refund,cancel}/route.ts`.

**Routing auth:** mọi call EasyParcel dùng **OAuth access token của merchant** (`Authorization: Bearer`) lấy từ `tenant.easyParcelIntegration.accessToken` → cước vào đúng ví merchant.

### NON-CUSTODY GUARDRAILS (bắt buộc)
- ✅ Cước trừ thẳng ví merchant; COD settle thẳng EasyParcel → merchant.
- ❌ Platform KHÔNG cầm/giữ/markup tiền cước hay tiền COD.
- ❌ Platform KHÔNG dùng ví EasyParcel chung cho mọi merchant.

---

## 5. Scope & Roadmap

```
Phase A (Connect) ─▶ Phase B (Rate@Checkout) ─▶ Phase C (Fulfillment) ─▶ Phase D (Returns) ─▶ staging
```

| Phase | Tên | Nội dung chính | Out |
|---|---|---|---|
| **A** | Connect + Settings | Connect with EasyParcel (OAuth redirect) + warehouse + chọn 1 courier (trong 4 courier hỗ trợ COD — COD mặc định toàn platform) + test connection | Tự dựng UI EasyParcel · auto label · default parcel · courier non-COD |
| **B** | Rate @ Checkout | Real-time rate (đúng 1 courier shop chọn) + lưu order; hybrid fallback flat | Markup cước · buyer chọn courier |
| **C** | Fulfillment | Mua label gắn vào nút "Ready to Ship" có sẵn + in label + pickup/dropoff + COD + tracking sync cron | Multi-warehouse · auto label · auto-complete · show số dư ví · màn tạo vận đơn riêng · tab toggle manual |
| **D** | Returns + Refund | Reuse `/refund` & `/cancel` + restock có sẵn; Case A auto-return (courier) + Case B manual buyer-return with fee tracking (tracking code + fee + payer recorded on order for reference only — not added to financial/analytics reports). Reuse F10 /refund & /cancel. | Auto refund cước · RMA collection · buyer return-request UI · return fee in financial reports |

### Out of Scope (toàn feature)
- **Markup cước** (giá hiển thị = raw EasyParcel).
- **Insurance / parcel protection** (addon EasyParcel).
- **Delyva** + provider khác (chỉ EasyParcel MVP).
- API nạp ví (EasyParcel không hỗ trợ — merchant tự nạp trên dashboard EasyParcel).
- Multi-warehouse per merchant (1 origin/merchant cho MVP).
- COD ngoài West Malaysia (giới hạn của EasyParcel COD).
- EasyParcel-native reverse label is NOT used — returns use a manual model (see [F10-orders-management.md § 20.3](./F10-orders-management.md#easyparcel--returns--cancel)).

---

## 6. Non-Functional Requirements (shared)

Sub-PRDs reference these NFRs by ID. No duplication needed.

| NFR | Yêu cầu | Mức |
|---|---|---|
| **NFR-1** | **Đơn vị tiền:** internal lưu **sen**, EasyParcel dùng **RM** → `/100` khi gửi rate/order, `×100` khi nhận giá. Sai = lệch 100×. **Test chống regression bắt buộc.** | P0 |
| **NFR-2** | **Idempotent create-label:** order có `awbNo` → không gọi lại; chống double-charge ví merchant. | P0 |
| **NFR-3** | OAuth token per-merchant: lưu `tenant.easyParcelIntegration.accessToken`/`refreshToken`; connect/disconnect có auth + IDOR check; auto-refresh trước khi hết hạn; không lộ token ra response/log. Cân nhắc encrypt at-rest. | P0 |
| **NFR-4** | Hybrid fallback: EasyParcel lỗi/timeout/chưa cấu hình → flat rate, KHÔNG chặn checkout. | P0 |
| **NFR-5** | Cron sync-tracking: cron-secret auth; idempotent; không spam API (batch theo tenant, backoff). | P1 |
| **NFR-6** | Rate API p95 < 4s tại checkout (timeout → fallback flat). Create-label p95 < 6s. | P1 |
| **NFR-7** | Ví hết tiền: khi tạo label thất bại → bắt error EasyParcel, hiện `EASYPARCEL_WALLET_LOW` + link nạp; KHÔNG để order kẹt. (KHÔNG show số dư ví chủ động, KHÔNG cron cảnh báo ví — đã bỏ.) | P1 |
| **NFR-8** | Secrets: không có secret global (key per-merchant trong DB). Chỉ constant base URL (demo/prod) trong code. | P0 |
| **NFR-9** | Schema: cột mới → `scripts/db-setup.js` MIGRATIONS; CI `check-migrations.js` gate. | P0 |
| **NFR-10** | **Buyer-safe projection:** endpoint buyer public (`api/orders/track/[orderNumber]`, `api/orders/stream/[orderNumber]`, `OrderTrackingClient`) chỉ trả **subset an toàn**: courier name, `awbNo`/`trackingNumber`, `shippingTrackingStatus`. **TUYỆT ĐỐI không lộ** `labelUrl`, `easyParcelOrderNo`, `codAmount`, `codStatus`, lỗi ví (`EASYPARCEL_WALLET_LOW`) — các field này chỉ cho seller (dashboard, admin session). Public dùng order-number-as-key, không auth → field nhạy cảm rò là lộ dữ liệu merchant. Nguồn: `plans/reports/Explore-260618-1344-f36-delivery-status-buyer-seller-split.md`. | P0 |

---

## 7. Cost & Risk

> **Nguồn (2026-06-11):** EasyParcel help centre + API landing. Signup/API **free**, không setup fee.

**Chi phí platform = RM0.** Merchant chịu cước + phí COD (xem §3).

### Top risks
1. **Currency sen↔RM (NFR-1):** sai = lệch 100×. Test sandbox 1 đơn nhỏ trước khi go-live.
2. **Ví merchant hết tiền:** create-label fail giữa chừng → cần UX cảnh báo + link nạp rõ ràng (không có API topup).
3. **Pickup:** dùng `collection_date` trong `POST /shipment/submit_orders` (không có endpoint đặt pickup riêng — đã resolved §8).
4. **Webhook tracking:** primary qua webhook (topics 1/2/3). Rủi ro: signature chưa rõ + có thể trễ/miss → cần verify signature ở sandbox và giữ polling `POST /shipment/tracking_status` làm fallback.
5. **Return logistics:** F36 does NOT use EasyParcel reverse label. Case A = courier auto-returns to sender (no new label needed); Case B = manual buyer-return (any courier, free-text tracking code + fee + payer recorded for reference only — not wired into financials). Handled in [F10-orders-management.md § 20.3](./F10-orders-management.md#easyparcel--returns--cancel).
6. **Rate limit:** giả định ≤100 req/min — thêm backoff ở cron + checkout.
7. **Double-charge ví:** create-label phải idempotent theo `awbNo`.

---

## 8. Key API Contract Decisions (v2026-03 spec)

> **Source:** EasyParcel OpenAPI v2026-03 (GitHub official: https://github.com/easyparcel/OpenAPI, main branch)

**Auth:** OAuth 2.0 Authorization-Code. No API keys. Merchant redirects to `https://api.easyparcel.com/oauth/login`, logs in, grants scope, callback returns `code`. Backend POSTs to `https://api.easyparcel.com/oauth/token` with `code` + Basic auth `client_id:client_secret` → receives access token (10h) + refresh token (1yr). All API calls use `Authorization: Bearer {access_token}`.

**Base URL:** `https://api.easyparcel.com/open_api/2026-03/` (production). Sandbox = same base URL, sandbox OAuth creds only.

**Quotation:** `POST /shipment/quotations` → body `{shipment: [{sender, receiver, weight, width, length, height, parcel_value}]}` → response `data[].quotations[].courier.service_id` + `pricing.total_amount` (RM string) + `features[].cod`.

**Submit order (single step, wallet auto-deduct):** `POST /shipment/submit_orders` → body `{shipment: [{reference, service_id, collection_date, weight, width/length/height, item, sender, receiver, feature}]}` → response `data[].shipment_number` + `order_number` + `awb_number` + `tracking_url`. AWB PDF (`awb_url`) assigned **async** → arrives via webhook topic 2 (shipment.awb.update) or polling `POST /shipment/list`/`POST /shipment/details`.

**Params (key mapping changes from legacy):**
- `subdivision_code`: ISO 3166-2 (e.g., "MY-07" Penang, "MY-14" Kuala Lumpur) — not 3-letter state code
- `phone_number_country_code`: separate field (e.g., "MY")
- `phone_number`: separate field, digits-only no +60 prefix (e.g., "0122134567")
- `address_1` / `address_2`: separate fields
- `city`: required
- `weight`: kg (double), not grams

**Status codes (numeric, not strings):** 0=Cancel, 2=To Be Collected, 3=Collected, 4=Delivery In Transit, 5=Delivered, 6=Returned, 7=Schedule In Arrangement, 8=On Hold, 11=Drop Off. Map to existing dual-field: `order.status` (lifecycle) vs `shippingTrackingStatus` (display, 13 normalized statuses EasyParcel).

**Tracking:** Primary = webhooks (topics 1 status update, 2 awb update, 3 tracking event). Fallback = polling `POST /shipment/details` + `POST /shipment/tracking_status` (batch 100 AWBs). Both return numeric `shipment_status_code`.

**Cancel:** `POST /shipment/cancel` → body `{cancel_list: [{shipment_number, remark}]}` (7-day window from collection). HTTP 200 with per-item `status: "success"` or `"error"`. **MVP product decision:** không wire programmatic cancel — merchant tự hủy shipment trên dashboard EasyParcel (credit hoàn ví) hoặc gọi support. Endpoint có sẵn cho phase sau.

**COD:** Spec shows COD availability + pricing in quotation response but submit_orders request doesn't expose explicit COD amount field. **Deferred — verify param format (likely `cod_enabled: boolean`, `cod_amount: double` in RM) with EasyParcel support before implementing payment-method-specific logic.**

---

## 9. Open Items — Verify in Sandbox Before Go-Live

The following items require confirmation with EasyParcel sandbox (same base URL, sandbox OAuth creds) before production deployment.

| # | Item | What is known | Action |
|---|---|---|---|
| 1 | **COD param in submit_orders** | Spec 2026-03 exposes COD availability in quotation response (`features[].cod.available`, min/max amounts, charging rate). But submit_orders request spec doesn't show explicit COD fields. Likely candidate: `shipment[].feature.cod_enabled` (bool) + `shipment[].feature.cod_amount` (double, RM). **Spec silent — MUST verify with EasyParcel support.** | Contact EasyParcel API support; verify exact param names + types for specifying COD in submit request. Update AC in US-F36-08 AC-5 once confirmed. |
| 2 | **Webhook signature verification** | Spec 2026-03 §9 lists webhook topics + payloads but does NOT mention HMAC signing, request signature headers, or callback validation. | Test webhook delivery in sandbox: does EP send X-EasyParcel-Signature header or similar? Implement validation accordingly before go-live. |
| 3 | **All 16 MY subdivision codes (ISO 3166-2)** | 6 confirmed from spec examples (MY-07 Penang, MY-14 Kuala Lumpur, MY-02, MY-10, etc.). 10 inferred follow ISO standard but not directly tested. | Test rate-check + submit for all 16 states in sandbox (`POST /shipment/quotations` with each subdivision_code); reject any failing. Create const mapping. |
| 4 | **AWB PDF delivery timing** | Spec shows `awb_url` assigned async after submit (via webhook topic 2 shipment.awb.update). But response at submit may include `awb_url` field (possibly null). | Test submit_orders response: does `awb_url` appear immediately or remain null until webhook fires? Determine if polling loop needed or webhook sufficient. |
| 5 | **Rate limiting headers** | Spec §11 notes rate limit not explicitly documented; implementation assumes ~100 req/min. Response headers (X-RateLimit-Remaining, etc.) not mentioned. | Monitor sandbox requests for any 429 responses; log response headers. Implement exponential backoff if 429 observed. |

**Confirmed field spec** (source: report above; high confidence from official docs + PHP wrapper):

| Field | EP param | Unit | Required (API) | Recommended bounds | Decimals |
|---|---|---|:---:|---|:---:|
| Weight | `weight` | kg | YES (both calls) | 0.1–50 kg* | 2 |
| Width | `width` | cm | OPTIONAL† | 1–150 cm | 0 (integer) |
| Length | `length` | cm | OPTIONAL† | 1–150 cm | 0 (integer) |
| Height | `height` | cm | OPTIONAL† | 1–150 cm | 0 (integer) |

*Bounds are recommended safe ranges. 0.1 kg floor and 50 kg ceiling: recommended (Flash allows up to 50 kg; J&T/Pos Laju/Ninja Van = 30 kg). Hard floor / exact ceiling TBD in sandbox.  
†Dims are OPTIONAL per API schema but FUNCTIONALLY REQUIRED for accurate pricing. F36 product decision: always send dims (prefilled from `DEFAULT_PARCEL`, seller may override) — see [F10-orders-management.md § 20.1](./F10-orders-management.md#easyparcel--fulfillment-label--pickup--tracking) FR-C-4b.  
**Rounding rule:** weight → `toFixed(2)` (e.g. 2.456 → "2.46"); dims → `parseInt()` floor to integer cm.  
**Unit note:** weight is always **kg** (NOT grams). If stored as grams in DB, divide ÷1000 before API call.  
**Chargeable weight:** max(actual weight, volumetric = L×W×H÷5000). Same ÷5000 divisor for all couriers — no per-courier variance on formula or field names.

**Sandbox checklist — test in sandbox (same base URL, sandbox OAuth creds) before go-live:**

| Test case | Call | Input | Expected | Status |
|---|---|---|---|:---:|
| Weight 2-decimal accepted | `POST /shipment/quotations` | `weight=2.50` | Rate returned | TBD |
| Weight 3-decimal edge | `POST /shipment/quotations` | `weight=0.001` | Accept or reject? | TBD |
| Dims fractional | `POST /shipment/quotations` | `width=30.5`, `length=20.3`, `height=15.8` | Accept or round to integer? | TBD |
| Dims omitted — rate-check | `POST /shipment/quotations` | weight only, width/length/height null | Rate returned (weight-only pricing) | TBD |
| Dims omitted — order creation | `POST /shipment/submit_orders` | weight only, width null | Accept or reject? | TBD |
| Min weight boundary | `POST /shipment/quotations` | `weight=0.1` | Rate returned | TBD |
| Below min weight | `POST /shipment/quotations` | `weight=0.09` | Reject or accept? | TBD |
| Zero weight | `POST /shipment/quotations` | `weight=0` | Rejected | TBD |
| Max weight 30 kg (J&T) | `POST /shipment/quotations` | `weight=30` | Rate returned for J&T | TBD |
| Max weight 50 kg (Flash) | `POST /shipment/quotations` | `weight=50`, Flash courier | Rate returned or reject? | TBD |
| Dim > 150 cm | `POST /shipment/quotations` | `width=160` | Reject or accept? | TBD |
| Volumetric example | `POST /shipment/quotations` | `weight=1.0`, dims 40×30×20 → vol=4.8 kg | Rate reflects 4.8 kg chargeable | TBD |

> Field mapping tables and transform pseudo-code are in `docs/design/F36-easyparcel-delivery-design.md §9`. Source: `plans/reports/researcher-260617-1430-easyparcel-field-mapping-final.md`.

---

## 10. Authoritative References

**Official EasyParcel OpenAPI v2026-03 (PRIMARY SOURCE):**
- GitHub repo: https://github.com/easyparcel/OpenAPI (main branch)
- Spec directory: source/includes/2026-03/ (raw markdown files for each endpoint)
- Documentation site: https://easyparcel.github.io/OpenAPI/
- Developer portal: https://api.easyparcel.com/

**Key spec files used in this PRD:**
- `_authentication.md` — OAuth 2.0 flow, token endpoints, refresh token
- `_quotation.md` — POST /shipment/quotations request/response
- `_submitorder.md` — POST /shipment/submit_orders (wallet auto-deduct, single-step)
- `_shipmentlisting.md` — POST /shipment/list with pagination
- `_shipmentdetail.md` — POST /shipment/details (fetch awb_url async)
- `_tracking_status.md` — POST /shipment/tracking_status + numeric status codes
- `_cancelshipment.md` — POST /shipment/cancel (7-day window)
- `_webhooks.md` — Topics 1/2/3 payloads (status, awb update, tracking event)
- `_wallet.md` — GET /wallet balance check
- `_account.md` — POST /account/get_account_information

**Research report (analysis of spec 2026-03):**
- `/plans/reports/Explore-260625-1527-easyparcel-openapi-spec.md` — complete spec contract summary + implementation notes

**Related PRDs (host spec):**
- [F14-shipping.md](./F14-shipping.md) — flat-rate fallback
- [F10-orders-management.md](./F10-orders-management.md) — order lifecycle, returns, refunds
- [F19-store-configuration.md](./F19-store-configuration.md) — settings, COD gating (future)
