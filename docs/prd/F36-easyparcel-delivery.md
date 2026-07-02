# PRD Overview: EasyParcel Delivery Integration — Malaysia (F36)

> **Version:** 2.1 | **Updated:** 2026-07-01 | **Owner:** Domin (Product)
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
- Checkout gọi **rate real-time** (`POST /shipment/quotations`, OAuth Bearer auth) theo origin postcode + dest postcode + cân nặng → trả **giá thật của courier shop đã chọn + COD info** (buyer không phải chọn courier). **Hybrid**: chưa kết nối → fallback flat West/East hiện tại (không phá merchant cũ).
- Merchant **mua nhãn vận đơn (AWB)** qua API (`POST /shipment/submit_orders` với `cod_amount` nếu COD enabled) — cước + COD phí trừ thẳng từ **ví EasyParcel của merchant** (wallet auto-deducted on submit). Tracking đồng bộ qua **polling** `GET /shipment/tracking` (Phase B); webhook listeners (Phase C, forward-looking).
- **COD** qua EasyParcel COD service: merchant chọn courier hỗ trợ + kích hoạt COD ở checkout → param `cod_amount` (RM float, read from quotation `features[].cod.available`) gửi submit_orders → courier thu hộ → settle thẳng về merchant. **Platform RM0, không giữ tiền cước, không markup** (giá hiển thị = giá EasyParcel raw). **West-MY default (East blocked by code); COD couriers determined LIVE per route from quotation response, NOT hardcoded**. **EP does NOT validate COD eligibility — code enforces both UI + server-side gating (min/max amount, destination, courier capability)**. Ref: `plans/reports/decision-260702-1503-GH-1333-cod-handoff.md`.

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

> **Lưu ý độ phủ vs picker & COD capability:** "60+ courier" là **độ phủ của EasyParcel** (aggregator). Courier picker ở settings **list tất cả courier live** từ `GET /courier/list?country_code=MY` (không cố định số lượng). **COD-capable couriers are determined LIVE per route** from `POST /shipment/quotations` response `features[].cod.available` + per-courier `min_cod_amount` / `max_cod_amount`. KHÔNG hardcode danh sách 4 courier (sandbox showed 7 COD couriers; list varies by account). Courier picker **filters to COD couriers only** khi merchant bật COD (Phase F). Ref: `plans/reports/ep-cod-matrix-260702.md`.

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
| COD phí + limits | Merchant | **Per-courier min/max** (live from quotation response, not fixed values). Example sandbox: J&T 7.5–1000 RM, DHL 6.5–2000 RM, Aramex 11–1000 RM, Pos/Poslaju 7.5–2000 RM, Lazada/SPX varies. Fee: max(flat, 4%) trừ vào tiền thu hộ. **West MY only (East blocked by default)**. Code enforces min/max validation (EP does NOT). Hạn mức + settlement T+X differ per courier. COD param = `cod_amount` (RM float); full COD gating/validation = Prime responsibility (Phase C/F). Ref: GH-1333, decision-260702-1503. |
| **Platform** | — | **RM0** (vs Xendit RM7.50/merchant/tháng) |

> EasyParcel kiếm tiền bằng margin gộp sẵn trong giá cước (mua sỉ volume) — merchant thường trả **rẻ hơn** đi thẳng courier. Giá rate-check (quotation response) = giá all-in, không hidden fees.

---

## 4. Architecture (high-level)

**Phase A + B (built):**
```
Merchant ──settings──> Connect with EasyParcel (OAuth) + warehouses[] + select allowed couriers + test connection
   ▼
order.tenant.easyParcelIntegration = { enabled, accessToken, refreshToken, warehouses[], selectedCouriers[], selectedCourier*, ... }
   ▼
Buyer ──checkout──> [Next.js storefront]
   │  POST /api/orders/calculate-shipping { siteId, dest postcode, items(weight) }
   ▼
getRates() ──┬─ tenant.easyParcelIntegration.enabled + accessToken + allowedCouriers[]
             │     └─YES─> POST /shipment/quotations (origin↔dest, weight, dims) ──> EasyParcel
             │              → filter by allowedCouriers[] → pick cheapest; COD orders → cheapest COD-capable
             │              → giá RM (÷100 → sen) + COD available/max + ETA của courier auto-pick
             └─NO──> flat West/East (getShippingRate hiện tại)          [HYBRID FALLBACK]
   ▼
order lưu shippingCourier + shippingServiceId + shippingFee + codAmount (buyer KHÔNG chọn courier)
   ▼  (buyer trả tiền hàng qua F34/F13 → order paid)
   ▼
Buyer xem tracking trên trang đơn (shippingTrackingStatus = pending khi đơn mới)

* selectedCourier (legacy text field) coalesced via getAllowedCouriers() for back-compat; selectedCouriers[] is current model.
```

**Phase C + D (NOT BUILT — forward-looking):**
Create label → submit order → tracking sync via webhooks/polling → returns/refund.
```

### Data Schema — `Tenant.easyParcelIntegration`

| Field | Type | Constraint | Purpose |
|---|---|---|---|
| `enabled` | boolean | — | Master toggle; OFF = fallback flat rate |
| `accessToken`* | text | server-only | OAuth access token; 10h expiry |
| `refreshToken`* | text | server-only | OAuth refresh token; 1yr expiry |
| `tokenExpiresAt`* | timestamp | server-only | Access token expiry; auto-refresh if <60s to expiry |
| `tokenRefreshExpiresAt`* | timestamp | server-only | Refresh token expiry; needs reconnect if expired |
| `selectedCouriers` | json array | current | **Allowlist of courier IDs** (e.g., `["flash", "jnt", "poslaju"]`). Checkout auto-quotes cheapest allowlisted courier serving route; COD orders → cheapest COD-capable. UX default/recommend 1 courier, multiple allowed. |
| `selectedCourier` | text | legacy | Deprecated: Merchant's single chosen courier (e.g., "flash"). Coalesced via `getAllowedCouriers()` for back-compat if `selectedCouriers` empty; will phase-out after migration. |
| `warehouses` | json (array) | current | `[{id?, label?, phone, address1, address2?, city, state, postcode, country, isDefault?}]` — multiple pickup addresses; one marked `isDefault` (origin for rates/labels) |
| `warehouse` | json | legacy | Deprecated single warehouse field; phase-out after migration |
| `testedAt`* | timestamp | readOnly | Last successful test-connection; shows merchant connection health |
| `accountName`* | text | readOnly | Merchant's EasyParcel account name (from `GET /account/get_account_information`) |
| `accountEmail`* | text | readOnly | Merchant's EasyParcel account email (from account endpoint) |

\* = server-only, never leak to public API / front-end session.

**Multiple warehouse support (Phase B):** Merchant can add/edit/delete warehouses; one `isDefault` is the rate-check + label origin. Phase C will allow per-order warehouse selection.

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

**Phase A+B files (built):**
- `src/lib/shipping/easyparcel/{client,types,normalize}.ts` — EP API client + helpers
- `src/lib/shipping/get-rates.ts` — rate calculation (EP + flat fallback)
- `src/app/api/tenant/[id]/easyparcel-oauth-start/route.ts` — OAuth start
- `src/app/api/easyparcel/oauth-callback/route.ts` — OAuth callback + token exchange
- `src/app/api/tenant/[id]/easyparcel-save/route.ts` — Save warehouse + courier
- `src/app/api/tenant/[id]/easyparcel-test/route.ts` — Test connection
- `src/app/api/tenant/[id]/easyparcel-couriers/route.ts` — List live couriers + wallet
- `src/app/api/tenant/[id]/easyparcel-disconnect/route.ts` — Disconnect
- `src/app/api/orders/calculate-shipping/route.ts` — Mở rộng with EP logic
- Settings shipping UI — warehouse CRUD + courier picker

**Phase C+D files (NOT BUILT yet):**
- `src/app/api/orders/[id]/create-label/route.ts`
- `src/app/api/cron/sync-tracking/route.ts`
- OrderDetailPanel (label modal)
- Tracking sync webhook listeners

**Routing auth:** mọi call EasyParcel dùng **OAuth access token của merchant** (`Authorization: Bearer`) lấy từ `tenant.easyParcelIntegration.accessToken` → cước vào đúng ví merchant.

### NON-CUSTODY GUARDRAILS (bắt buộc)
- ✅ Cước trừ thẳng ví merchant; COD settle thẳng EasyParcel → merchant.
- ❌ Platform KHÔNG cầm/giữ/markup tiền cước hay tiền COD.
- ❌ Platform KHÔNG dùng ví EasyParcel chung cho mọi merchant.

---

## 5. Scope & Roadmap

> **Build Status (2026-07-01):** Phase A + B are **fully implemented** (Connect+Settings + Rate@Checkout live). Phase C + D are **NOT BUILT** — forward-looking design below.

```
Phase A (Connect) ─▶ Phase B (Rate@Checkout) ─▶ [PHASE C+D — NOT BUILT]
```

| Phase | Tên | Nội dung chính | Out |
|---|---|---|---|
| **A** ✅ | Connect + Settings | Connect with EasyParcel (OAuth redirect) + multiple warehouses + chọn 1 courier (tất cả live couriers) + test connection | Tự dựng UI EasyParcel · auto label · default parcel |
| **B** ✅ | Rate @ Checkout | Real-time rate (đúng 1 courier shop chọn) + COD info + lưu order; hybrid fallback flat | Markup cước · buyer chọn courier |
| **C** ⚠️ NOT BUILT | Fulfillment | Mua label gắn vào nút "Ready to Ship" có sẵn + in label + pickup/dropoff + tracking sync webhook | Multi-warehouse select · auto label · auto-complete · show số dư ví · màn tạo vận đơn riêng · tab toggle manual |
| **D** ⚠️ NOT BUILT | Returns + Refund | Reuse `/refund` & `/cancel` + restock có sẵn; Case A auto-return (courier) + Case B manual buyer-return with fee tracking. Reuse F10 /refund & /cancel. | Auto refund cước · RMA collection · buyer return-request UI · return fee in financial reports |

### Out of Scope (toàn feature)
- **Markup cước** (giá hiển thị = raw EasyParcel).
- **Insurance / parcel protection** (addon EasyParcel).
- **Delyva** + provider khác (chỉ EasyParcel MVP).
- API nạp ví (EasyParcel không hỗ trợ — merchant tự nạp trên dashboard EasyParcel).
- **Multi-warehouse routing per order** (1 default warehouse dùng cho rate/label; Phase B select warehouse; Phase C multi-warehouse per order TBD).
- COD ngoài West Malaysia (**default BLOCKED by code; official EP policy = West only; opening East Malaysia COD requires EP support confirmation, not sandbox validation**).
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

### Top risks (Phase A+B)
1. **Currency sen↔RM (NFR-1):** sai = lệch 100×. Test sandbox 1 đơn nhỏ trước khi go-live.
2. **Rate timeout:** checkout rate-check must p95 < 4s; timeout → fallback flat (KHÔNG chặn checkout).
3. **Token refresh:** auto-refresh trước khi hết; thrown `AUTH_EXPIRED` → user must reconnect.
4. **Hybrid fallback:** EasyParcel disabled/error → flat West/East (KHÔNG phá checkout merchant cũ).
5. **Phone normalization:** raw input → "60XXXXXXXXX" format (not "MY" + "0" prefix); test all input patterns.
6. **Multiple warehouses:** 1 warehouse marked `isDefault` → origin cho rate/label (Phase C sẽ allow per-order warehouse select).

### Top risks (Phase C/D — NOT BUILT yet)
7. **Ví merchant hết tiền:** create-label fail → cần UX cảnh báo + link nạp.
8. **Webhook tracking:** signature + ordering (Phase C feature).
9. **Rate limit on cron:** backoff + batch logic (Phase C feature).
10. **Double-charge ví:** create-label idempotent (Phase C feature).
11. **Return logistics:** no EasyParcel reverse label; manual model (Phase D feature).

---

## 8. Key API Contract Decisions (v2026-03 spec)

> **Source:** EasyParcel OpenAPI v2026-03 (GitHub official: https://github.com/easyparcel/OpenAPI, main branch)

**Auth:** OAuth 2.0 Authorization-Code. No API keys. Merchant redirects to `https://api.easyparcel.com/oauth/login`, logs in, grants scope, callback returns `code`. Backend POSTs to `https://api.easyparcel.com/oauth/token` with `code` + Basic auth `client_id:client_secret` → receives access token (10h) + refresh token (1yr). All API calls use `Authorization: Bearer {access_token}`. **Sandbox = same base URL; use sandbox OAuth credentials only.**

**Base URL:** `https://api.easyparcel.com/open_api/2026-03/` (production + sandbox). No separate sandbox base URL — credentials determine environment.

**Quotation:** `POST /shipment/quotations` → body `{shipment: [{sender, receiver, weight, width, length, height, parcel_value}]}` → response includes `data[].quotations[].courier.service_id` + `pricing.total_amount` (RM string) + `features[].cod` (availability + min/max).

**Submit order (single step, wallet auto-deduct):** `POST /shipment/submit_orders` → body `{shipment: [{reference, service_id, collection_date, weight, width/length/height, item, sender, receiver, feature{sms_tracking?, email_tracking?, whatsapp_tracking?, cod_amount?}}]}`. `cod_amount` = RM float (enabled if COD selected). Response: `data[].shipment_number` + `order_number` + `awb_number` + `tracking_url` (awb_url assigned async via webhook or polling). **CRITICAL:** EP sandbox accepts invalid COD (under-min, over-max, non-COD courier, East-MY) with **zero server-side validation**. **Prime MUST hard-gate COD eligibility at BOTH UI (courier picker filter) and server (order submit validation)** — see decision-260702-1503-GH-1333-cod-handoff.md.

**Params (key mapping):**
- `subdivision_code`: ISO 3166-2 (e.g., "MY-07" Penang, "MY-14" Kuala Lumpur)
- `phone_number`: 60-prefixed format (e.g., "60122134567"); normalized from raw input
- `address_1` / `address_2`: separate fields
- `city`: required
- `weight`: kg (double), min 0.1, max 50 (varies per courier); round to 2 decimals

**Tracking (Phase B — polling):** `GET /shipment/tracking?tracking_number=…` → returns shipment status object. **Primary for Phase B**: polls individual tracking on demand. **Webhooks (Phase C):** topics 1 (status), 2 (awb), 3 (tracking event) — forward-looking, not implemented yet.

**Account info:** `GET /open_api/2026-03/account/get_account_information` — returns merchant account name, email, pickup addresses (empty until configured in EP dashboard).

**Wallet:** `GET /open_api/2026-03/wallet` — returns array of wallet objects (by currency).

**Cancel:** `POST /shipment/cancel` → body `{cancel_list: [{shipment_number, remark}]}` (7-day window, NOT `shipment[{tracking_number}]`). **Not wired to Phase B** — merchant cancels via EP dashboard or support; Phase D may wire to `/api/orders/[id]/cancel` refund flow.

**COD (Phase B — resolved):** `cod_amount` (RM float) param in submit_orders when COD enabled. Rate quotation exposes COD availability + pricing via `features[].cod` (available/min/max per courier). **West-MY default; COD couriers read live (NOT hardcoded); EP validates NOTHING — Prime enforces all gates.**

**COD Validation Responsibility (CRITICAL for Phase B/F):**
- **COD eligibility check:** destination = West Malaysia (reject East) + courier.cod.available = true + amount ∈ [min_cod_amount, max_cod_amount].
- **EP behavior:** submit_orders accepts ANY amount/courier/destination combo; sandbox accepted under-min, over-max, non-COD courier, East-MY without error.
- **Decision authority:** `plans/reports/decision-260702-1503-GH-1333-cod-handoff.md` (PA2: code enforces, EP does not).
- **Evidence:** `plans/reports/ep-cod-matrix-260702.md` (sandbox validation sweep; 7 COD couriers confirmed, NOT fixed 4).
- **Issue:** GH-1333.

---

## 9. Open Items — Verify Before Each Phase Deployment

Items marked ✅ RESOLVED are confirmed by as-built code (Phase A+B). Items marked ⏳ DEFER are Phase C/D forward-looking.

| # | Item | Status | Details | Action |
|---|---|---|---|---|
| 1 | **COD param in submit_orders** | ✅ RESOLVED | Param: `shipment[].feature.cod_amount` (double, RM float). Code confirmed; passed to EP on submit. | None — implemented. |
| 2 | **Webhook signature verification** | ⏳ DEFER (Phase C) | Phase B uses polling `GET /shipment/tracking` only. Webhooks (signature, topics 1/2/3) forward-looking. | Test webhook delivery + signing in sandbox when Phase C starts. |
| 3 | **All 16 MY subdivision codes (ISO 3166-2)** | ⏳ TBD | 6 confirmed from spec + geo dataset. 10 inferred — test coverage pending Phase C full integration. | Test rate-check + submit for all 16 states; verify against `malaysia_states` seed table. |
| 4 | **AWB PDF delivery timing** | ⏳ DEFER (Phase C) | Phase B does not wire create-label; Phase C will handle async `awb_url` delivery. | Test submit_orders response when Phase C implements label creation. |
| 5 | **Rate limiting + backoff** | ⏳ DEFER (Phase C) | Phase B rate-check is per-checkout (user-initiated). Phase C cron will require backoff. Spec assumes ~100 req/min. | Implement exponential backoff in Phase C cron; monitor sandbox for 429 responses. |
| 6 | **Sandbox base URL toggle** | ✅ RESOLVED | Same base URL (`https://api.easyparcel.com/open_api/2026-03/`) for sandbox + prod; OAuth credentials determine environment. | None — confirmed. |

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
- `_submitorder.md` — POST /shipment/submit_orders (wallet auto-deduct, single-step, cod_amount param)
- `_shipmentlisting.md` — POST /shipment/list with pagination
- `_shipmentdetail.md` — POST /shipment/details (fetch awb_url async — Phase C deferred)
- `_tracking.md` — GET /shipment/tracking (Phase B primary) + polling fallback
- `_tracking_status.md` — POST /shipment/tracking_status (Phase C deferred)
- `_cancelshipment.md` — POST /shipment/cancel (7-day window)
- `_webhooks.md` — Topics 1/2/3 payloads (Phase C deferred)
- `_wallet.md` — GET /wallet balance check (merchant account)
- `_account.md` — GET /account/get_account_information (merchant profile)

**Research report (analysis of spec 2026-03):**
- `/plans/reports/Explore-260625-1527-easyparcel-openapi-spec.md` — complete spec contract summary + implementation notes

**Related PRDs (host spec):**
- [F14-shipping.md](./F14-shipping.md) — flat-rate fallback
- [F10-orders-management.md](./F10-orders-management.md) — order lifecycle, returns, refunds
- [F19-store-configuration.md](./F19-store-configuration.md) — settings, COD gating (future)
