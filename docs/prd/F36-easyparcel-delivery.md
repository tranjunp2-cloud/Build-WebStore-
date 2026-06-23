# PRD Overview: EasyParcel Delivery Integration — Malaysia (F36)

> **Version:** 1.0 (Draft) | **Updated:** 2026-06-23 | **Owner:** Domin (Product)
> **Priority:** P1 | **Size:** XL
> **Depends on:** F09 Storefront Commerce ✅, F10 Order lifecycle + cancel-restock ✅, F34 Xendit Payment (song hành — luồng tiền hàng)
> **Provider:** **EasyParcel** (aggregator MY) — per-merchant API key, non-custody (platform RM0 chi phí).
> **Auth:** API key (KHÔNG OAuth). Mỗi merchant tự kết nối tài khoản EasyParcel của mình.
> **Status:** Draft — shared context for all F36 sub-PRDs.

---

## Section Index (merged into host PRDs)

Phase-specific Functional Requirements and Acceptance Criteria have been merged into their host PRDs. This file remains the single source for shared context (problem statement, target users, architecture, NFR, costs, resolved questions).

| Phase | Scope | User Stories | Home PRD |
|---|---|---|---|
| **A** | Connect API key + warehouse + select courier + test connection | US-F36-01, US-F36-02, US-F36-03 | [F14-shipping.md § 20.1](./F14-shipping.md#easyparcel--connect--settings) |
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

Tích hợp **EasyParcel** làm courier aggregator, mỗi merchant kết nối **tài khoản EasyParcel riêng** qua API key:

- Merchant dán **API key** + địa chỉ **kho (origin)** + chọn **1 courier** cho shop trong settings (**list chỉ gồm 4 courier hỗ trợ COD** — COD là mặc định toàn platform, đã deploy production). Mirror pattern `Tenants.echIntegration` đã có.
- Checkout gọi **rate real-time** (`EPRateCheckingBulk`) theo origin postcode + dest postcode + cân nặng → trả **giá thật của courier shop đã chọn** (buyer không phải chọn courier). **Hybrid**: chưa cấu hình đủ → fallback flat West/East hiện tại (không phá merchant cũ).
- Merchant **mua nhãn vận đơn (AWB)** qua API (`EPSubmitOrderBulk`) — cước trừ thẳng từ **ví EasyParcel của merchant**. Tracking đồng bộ qua **polling cron** (`EPParcelStatusBulk`).
- **COD** qua EasyParcel COD service: courier thu hộ → settle thẳng về merchant. **Platform RM0, không giữ tiền cước, không markup** (giá hiển thị = giá EasyParcel raw).

> **Decision (kiến trúc):** Codebase đã có `src/lib/shipping/` (flat rate) — giữ nguyên làm **fallback**. Thêm EasyParcel = **file mới** (`src/lib/shipping/easyparcel/*` + API routes), 0 phá flat-rate logic. Per-merchant API key = mirror `echIntegration`. Rủi ro kỹ thuật: **thấp**.

> **Decision (giá flat-rate fallback):** Default hiện tại `SHIPPING_DEFAULTS` (`src/lib/shipping/constants.ts`) = West 800 sen / East 1500 sen (RM8/RM15) là giá 2024–2025, **thấp so với thị trường 2026** (West ~RM7–9 retail, East ~RM10–18). Khi flat-rate kích hoạt (EP OFF / chưa kịp timeline) merchant không có discount EasyParcel → cần khung cao hơn. **Khuyến nghị:** West **1000 sen (RM10)**, East **1600 sen (RM16)**, `freeAbove` giữ 10000 sen (RM100). EasyParcel live rate khi có vẫn override fallback này. Nguồn: `plans/reports/researcher-260618-1344-my-flat-rate-shipping-pricing.md`.

### Vì sao EasyParcel (so vendor)

| Provider | Courier MY | Auth | Chi phí platform | Marketplace fit | Kết luận |
|---|---|---|---|---|---|
| **EasyParcel** | ✅ 60+ (Pos Laju, J&T, Ninja Van, DHL, Flash, City-Link...) | API key (free) | **RM0** | per-merchant API key | ✅ **Chọn** |
| Delyva | ⚠️ 7+ | per-merchant API key | ăn **1%/đơn** | SaaS mode | Dự phòng (nếu cần revenue-share) |
| Direct courier (Pos/J&T/Ninja) | 1 mỗi cái | OAuth/key riêng | hợp đồng doanh nghiệp | ❌ phải ký từng courier | Loại (nặng, phân mảnh) |
| Tracking.my | tracking-only | key | — | chỉ tracking | Bổ trợ (không tạo label) |

> EasyParcel: phủ rộng nhất + free + chuẩn de-facto SME MY (~1tr user). Per-merchant API key giữ non-custody, platform RM0.

> **Lưu ý độ phủ vs picker:** "60+ courier" là **độ phủ của EasyParcel** (aggregator), KHÔNG phải số courier seller chọn được. Vì COD là **mặc định toàn platform (non-negotiable)**, courier picker ở settings **chỉ list 4 courier hỗ trợ COD** (Flash/DHL/J&T/Aramex). Xem `PD-020` (`docs/decisions/decisions-log.md`) + [F14-shipping.md § 20.1](./F14-shipping.md#easyparcel--connect--settings) FR-A-3.

### Mô hình tiền (2 luồng tách biệt)

```
Tiền HÀNG:  Buyer ──checkout──> cổng thanh toán (Xendit/Stripe, F34/F13) ──> merchant
Tiền SHIP:  Merchant ──mua label──> trừ ví EasyParcel của merchant ──> courier
Tiền COD:   Buyer trả mặt khi nhận ──> courier thu hộ ──> EasyParcel settle ──> merchant
```
Platform **không đụng** cả 3 luồng → sạch liability, RM0 chi phí.

### Chi phí (đã verify, nguồn 2026)

| Khoản | Ai chịu | Mức |
|---|---|---|
| Signup + dùng app EasyParcel | — | **Miễn phí** |
| **API** (rate / order / tracking) | — | **Miễn phí hoàn toàn** |
| Cước ship | **Merchant** | trừ ví prepaid; 1kg West MY ~**RM4-8** (J&T từ RM5.42) |
| Nạp ví | Merchant | tùy ý từ RM20, credit hạn 365 ngày, **không có API topup** |
| COD phí | Merchant | max(flat, 4%) trừ vào tiền thu hộ; Flash RM5, DHL RM6, J&T RM7, Aramex RM10; **West MY only**; chỉ 4 courier này hỗ trợ (Pos Laju/Ninja/SPX/City-Link không). Hạn mức + settlement T+X KHÁC theo courier → xem bảng **COD per-courier reference** trong [F10-orders-management.md § 20.2 — EasyParcel — COD (order runtime)](./F10-orders-management.md#easyparcel--cod-order-runtime) |
| **Platform** | — | **RM0** (vs Xendit RM7.50/merchant/tháng) |

> EasyParcel kiếm tiền bằng margin gộp sẵn trong giá cước (mua sỉ volume) — merchant thường trả **rẻ hơn** đi thẳng courier. Giá rate-check = giá all-in.

---

## 4. Architecture (high-level)

```
Buyer ──checkout──> [Next.js storefront]
   │  POST /api/orders/calculate-shipping { siteId, dest postcode, items(weight) }
   ▼
getRates() ──┬─ tenant.easyParcelIntegration.enabled + apiKey + warehouse?
             │     └─YES─> EPRateCheckingBulk (origin↔dest, weight, dims) cho selectedCourier ──> EasyParcel
             │              → giá RM (×100 → sen) + ETA của đúng 1 courier shop chọn
             └─NO──> flat West/East (getShippingRate hiện tại)          [HYBRID FALLBACK]
   ▼
order lưu shippingCourier + shippingServiceId + shippingFee (buyer KHÔNG chọn courier)
   ▼  (buyer trả tiền hàng qua F34/F13 → order paid)
   ▼
[Merchant dashboard] Nút "Ready to Ship" (action inline có sẵn trong OrderDetailPanel)
   │  EP tenant → mở modal tạo label; non-EP → flip status như cũ (no modal). KHÔNG màn riêng.
   │  POST /api/orders/[id]/create-label → EPSubmitOrderBulk → EPPayOrderBulk (api key merchant)
   │     → trừ ví EasyParcel merchant → trả awb_no + label PDF
   ▼  lưu awbNo + labelUrl + easyParcelOrderNo; trackingNumber = awbNo; order → ready_to_ship
   ▼  In label + Pickup/dropoff (collection_date)
   ▼  Nút "Ship Order" (có sẵn): EP → xác nhận courier pickup → shipped (KHÔNG nhập tracking tay)
Cron /api/cron/sync-tracking ──EPParcelStatusBulk──> cập nhật shippingTrackingStatus (display)
   ▼  delivered → merchant tự bấm completed (KHÔNG auto-complete)
Buyer xem tracking trên trang đơn
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

**Routing key:** mọi call EasyParcel dùng **API key của merchant** (`api` param) lấy từ `tenant.easyParcelIntegration.apiKey` → cước vào đúng ví merchant.

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
| **A** | Connect + Settings | Dán API key + warehouse + chọn 1 courier (trong 4 courier hỗ trợ COD — COD mặc định toàn platform) + test connection | Tự dựng UI EasyParcel · auto label · default parcel · courier non-COD |
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
| **NFR-3** | API key per-merchant: lưu trong `tenant.easyParcelIntegration.apiKey`; PATCH có auth + IDOR check; không lộ key ra response/log. Cân nhắc encrypt at-rest. | P0 |
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
3. **Pickup:** dùng `collection_date` trong `EPSubmitOrderBulk` (KHÔNG có `EPPickUpBooking` — đã resolved §8).
4. **Không có webhook tracking:** polling cron có độ trễ 30-60 phút — chấp nhận cho MVP.
5. **Return logistics:** F36 does NOT use EasyParcel reverse label. Case A = courier auto-returns to sender (no new label needed); Case B = manual buyer-return (any courier, free-text tracking code + fee + payer recorded for reference only — not wired into financials). Handled in [F10-orders-management.md § 20.3](./F10-orders-management.md#easyparcel--returns--cancel).
6. **Rate limit:** giả định ≤100 req/min — thêm backoff ở cron + checkout.
7. **Double-charge ví:** create-label phải idempotent theo `awbNo`.

---

## 8. Resolved Open Questions

> Verify nguồn: source PHP wrapper `apih/easyparcel` (`src/Client.php`, maintained, đúng MY API) + 2 research report §9.

- `[RESOLVED]` **Pickup**: KHÔNG có endpoint `EPPickUpBooking` (không tồn tại trong API). Pickup truyền qua tham số `collection_date` trong `EPSubmitOrderBulk`; courier tự sắp theo ngày. **EasyParcel chấp nhận same-day**: trước cut-off (T2–T6) → lấy hôm nay; sau cut-off → API âm thầm bump ngày làm việc kế. Date picker cut-off-aware (xem [F10-orders-management.md § 20.1](./F10-orders-management.md#easyparcel--fulfillment-label--pickup--tracking) FR C-4/C-4c). Dropoff tùy courier. **Tin cậy: cao** (Pos Laju cut-off cần confirm). Nguồn: `plans/reports/researcher-260617-1426-courier-cutoff-verify.md`.
- `[RESOLVED]` **COD remittance**: EasyParcel settle COD về tài khoản ngân hàng merchant; **thời gian KHÁC theo courier** (Flash/DHL T+1–3, J&T T+7–12, Aramex ~T+30 ngày — KHÔNG phải batch tuần cố định). Phí COD max(flat, 4%) trừ thẳng tiền thu hộ. Withdraw **thủ công** trên dashboard (statuses Pending→To Release→Released); **cần eKYC + verify bank trước lần rút đầu**. **KHÔNG có API/webhook đối soát** → merchant tự xem dashboard. Platform chỉ lưu `codAmount`+`codStatus` display-only, không build reconciliation. **Tin cậy: cao** (cross-check help centre + API docs, `plans/reports/researcher-260622-1500-easyparcel-cod-courier-support.md`).
- `[RESOLVED]` **Reverse/return label**: EasyParcel-native reverse label (đảo origin↔dest) is NOT used in F36. Returns = manual model: Case A — failed delivery/COD refusal causes courier to auto-return to sender (no new label); Case B — buyer already received, requests return (RMA): buyer ships back via any courier of their choice, system records tracking code (free-text) + return shipping fee + who pays (buyer or seller); the return fee is recorded on the order for reference only (not added to financial/analytics reports). No EasyParcel API call for returns. Handled in [F10-orders-management.md § 20.3](./F10-orders-management.md#easyparcel--returns--cancel). **Confidence: high.**
- `[RESOLVED]` **Cancel shipment hoàn ví**: Wrapper KHÔNG có endpoint cancel → hủy đơn/hoàn cước xử lý qua **dashboard EasyParcel hoặc support**, không programmatic cho MVP. Quy ước: chưa pickup → merchant tự hủy trên dashboard (credit hoàn về ví); đã pickup → cước mất, ghi rõ. **Tin cậy: trung bình** (nếu cần auto-cancel, mở ticket hỏi EasyParcel endpoint riêng).
- `[RESOLVED]` **Wallet balance API**: **CÓ** — endpoint `EPCheckCreditBalance` (không cần param ngoài auth). **Quyết định F36: KHÔNG show số dư ví chủ động, KHÔNG cron cảnh báo ví** (bỏ cho gọn). Ví thiếu chỉ lộ ra khi tạo label thất bại → `EASYPARCEL_WALLET_LOW` (FR C-3). Endpoint vẫn ghi nhận để dùng sau nếu cần. **Tin cậy: cao.**
- `[RESOLVED]` **Rate limit + API model**: Rate limit KHÔNG công bố → giả định ~100/min + backoff. **Model = Individual API per merchant** (mỗi merchant tự account + ví + key) — KHÔNG dùng Marketplace API (Marketplace = 1 ví platform chung = custody, phá guardrail §4). Platform không cần đăng ký gì với EasyParcel. **Tin cậy: cao.**
- `[RESOLVED]` **Courier/service code**: Response `EPRateCheckingBulk` trả `courier_id` (vd `EP-CR0A`), `service_id` (vd `EP-CS0I`), `courier_name` (vd `Poslaju`), `courier_logo`. Map `selectedCourier` (single) theo **`courier_id`** (mã ổn định); hiển thị `courier_name`+logo; mua label bằng **`service_id`**. **Tin cậy: cao.**

### Phát hiện verify ảnh hưởng các section trước (cần cập nhật FR/NFR)

1. **2 key, không phải 1:** Auth EasyParcel cần `api` (api_key) **+** `authentication` (auth_key). Sửa A-1/A-6/NFR-3: lưu thêm `authKey` trong `tenant.easyParcelIntegration`, form connect nhập 2 ô.
2. **Tạo label = 2 bước:** `EPSubmitOrderBulk` (giữ chỗ, chưa trừ ví) → `EPPayOrderBulk` (trừ ví + sinh AWB). Idempotency (NFR-2) phải khóa theo bước **pay**, không phải submit. Cập nhật flow [F10-orders-management.md § 20.1](./F10-orders-management.md#easyparcel--fulfillment-label--pickup--tracking).
3. **Base URL demo dùng HTTPS:** `https://demo.connect.easyparcel.my/?ac=` (không phải `http://`). Sửa §9.

---

## 9. Open Items — Verify in Sandbox Before Go-Live

The following items are unconfirmed from public API documentation. Each must be tested against the EasyParcel sandbox (demo environment, `https://demo.connect.easyparcel.my/?ac=`) before production go-live.

| # | Item | What is known | Action |
|---|---|---|---|
| 1 | **COD param name** | EasyParcel COD feature confirmed (West MY; couriers: J&T, DHL eCommerce, Flash Express, Aramex — Pos Laju/SPX/City-Link KHÔNG hỗ trợ). Research chỉ ra likely `cod_enabled` (boolean) + `cod_amount` (double, RM) trong EPSubmitOrderBulk; EPRateCheckingBulk trả `cod_service_available` + `cod_service_min/max_cod_amount`. **CHƯA verified từ public API docs — tên param vẫn phải test sandbox.** | Test sandbox với courier COD-eligible (J&T hoặc Flash); verify `cod_enabled` + `cod_amount`; không assume tên param. |
| 2 | **`send_contact` vs `send_mobile`** | `send_mobile` confirmed from SiteGiant examples. Some integrations also send `send_contact` as a separate field. Whether both are required, or one is a fallback, is unknown. | Send only `send_mobile` initially; test sandbox to confirm. |
| 3 | **10 INFERRED state codes** | 6 state codes confirmed (jhr, kdh, ktn, kul, png, sgr). 10 remaining (lbn, mlk, nsn, phg, prk, pls, pjy, sbh, swk, trg) follow ISO 3166-2:MY standard but are not verified against EasyParcel API directly. | Run rate-check for all 16 states in sandbox; fix any rejected codes before go-live. |
| 4 | **Weight/dims precision & behavior** | Spec confirmed (see `plans/reports/researcher-260623-1109-easyparcel-weight-dimension-spec.md`). Confirmed facts and sandbox checklist below. | Run checklist in `demo.connect.easyparcel.my` before go-live; fix `aggregateWeightKg()` rounding per results. |

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

**Sandbox checklist — test in `demo.connect.easyparcel.my` before go-live:**

| Test case | Call | Input | Expected | Status |
|---|---|---|---|:---:|
| Weight 2-decimal accepted | EPRateCheckingBulk | `weight="2.50"` | Rate returned | CONFIRMED |
| Weight 3-decimal edge | EPRateCheckingBulk | `weight="0.001"` | Accept or reject? | TBD |
| Dims fractional | EPRateCheckingBulk | `width="30.5"`, `length="20.3"`, `height="15.8"` | Accept or round to integer? | TBD |
| Dims omitted — rate-check | EPRateCheckingBulk | weight only, width/length/height null | Rate returned (weight-only pricing) | CONFIRMED |
| Dims omitted — order creation | EPSubmitOrderBulk | weight only, width null | Accept or reject? | TBD |
| Min weight boundary | EPRateCheckingBulk | `weight="0.1"` | Rate returned | CONFIRMED |
| Below min weight | EPRateCheckingBulk | `weight="0.09"` | Reject or accept? | TBD |
| Zero weight | EPRateCheckingBulk | `weight="0"` | Rejected | CONFIRMED |
| Max weight 30 kg (J&T) | EPRateCheckingBulk | `weight="30"` | Rate returned for J&T | CONFIRMED |
| Max weight 50 kg (Flash) | EPRateCheckingBulk | `weight="50"`, Flash courier | Rate returned or reject? | TBD |
| Dim > 150 cm | EPRateCheckingBulk | `width="160"` | Reject or accept? | TBD |
| Volumetric example | EPRateCheckingBulk | `weight="1.0"`, dims 40×30×20 → vol=4.8 kg | Rate reflects 4.8 kg chargeable | CONFIRMED |

> Field mapping tables and transform pseudo-code are in `docs/design/F36-easyparcel-delivery-design.md §9`. Source: `plans/reports/researcher-260617-1430-easyparcel-field-mapping-final.md`.

---

## 10. Docs & References

- EasyParcel API landing (free): https://easyparcel.com/my/apilanding/
- Marketplace API docs: https://developers.easyparcel.com/?pg=DocAPI&c=Malaysia&type=MarketPlace
- How it works / AWB: https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223873-how-does-easyparcel-work-
- COD charges: https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224475-how-does-cod-charges-work-
- Research reports: `plans/reports/researcher-260611-1614-my-shipping-aggregators.md`, `researcher-260611-1614-easyparcel-api-deep-dive.md`
- Base URLs (verify wrapper): demo `https://demo.connect.easyparcel.my/?ac=`, prod `https://connect.easyparcel.my/?ac=`
- Source verify endpoint/field: `apih/easyparcel` → `src/Client.php` (GitHub)
- Host PRDs: [F14-shipping.md](./F14-shipping.md), [F10-orders-management.md](./F10-orders-management.md), [F19-store-configuration.md](./F19-store-configuration.md)
