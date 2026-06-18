# PRD: EasyParcel Delivery Integration — Malaysia (F36)

> **Version:** 1.0 (Draft) | **Updated:** 2026-06-11 | **Owner:** Domin (Product)
> **Priority:** P1 | **Size:** XL
> **Depends on:** F09 Storefront Commerce ✅, F10 Order lifecycle + cancel-restock ✅, F34 Xendit Payment (song hành — luồng tiền hàng)
> **Provider:** **EasyParcel** (aggregator MY) — per-merchant API key, non-custody (platform RM0 chi phí).
> **Auth:** API key (KHÔNG OAuth). Mỗi merchant tự kết nối tài khoản EasyParcel của mình.
> **Status:** Draft — technical implementation spec.

---

## 1. Problem Statement

- Shipping hiện tại chỉ là **flat rate cứng West/East Malaysia** (800 sen / 1500 sen) trong `Sites.shippingConfig` — không phản ánh cước thật theo courier, cân nặng, khoảng cách.
- **Không có courier thật**: order chỉ có `trackingNumber` (text trống), merchant nhập tay; không mua được nhãn vận đơn, không đặt pickup, không đồng bộ trạng thái giao hàng.
- **Buyer không chọn được courier** — không thấy lựa chọn nhanh/rẻ, không thấy giá thật.
- Email template có tham số `shippingProvider` (chỉ là param của hàm template, **KHÔNG phải cột trong Orders schema**) — hiện không bao giờ được truyền giá trị.
- Merchant SME MY hầu hết đã quen EasyParcel (~70.000 SME dùng) → kỳ vọng tích hợp courier liền mạch như Shopify/WooCommerce.
- Platform là **pure SaaS** (doanh thu từ phí gói) → cần mô hình shipping mà platform **không giữ tiền cước, không gánh chi phí** vào P&L.

## 2. Target Users

- **SME Owner (Persona A):** chọn **1 courier** cho shop; tự tính cước chính xác; mua nhãn + đặt pickup ngay trong dashboard Prime, không phải rời platform; tự quản ví EasyParcel.
- **Buyer (Persona C):** tại checkout thấy **giá ship thật** của courier shop dùng (EasyParcel) + thời gian giao; theo dõi tracking sau khi đặt.
- **Platform (BOD/Finance):** **RM0 chi phí** (EasyParcel free signup + free API); không giữ tiền cước/COD → không cần giấy phép tài chính; chỉ orchestrate.

## 3. Solution Overview

Tích hợp **EasyParcel** làm courier aggregator, mỗi merchant kết nối **tài khoản EasyParcel riêng** qua API key:

- Merchant dán **API key** + địa chỉ **kho (origin)** + chọn **1 courier** cho shop trong settings. Mirror pattern `Tenants.echIntegration` đã có.
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
| COD phí | Merchant | max(flat, 4%) trừ vào tiền thu hộ; Flash RM5, DHL RM6, J&T RM7, Aramex RM10; **West MY only**; Pos Laju/SPX/City-Link không hỗ trợ |
| **Platform** | — | **RM0** (vs Xendit RM7.50/merchant/tháng) |

> EasyParcel kiếm tiền bằng margin gộp sẵn trong giá cước (mua sỉ volume) — merchant thường trả **rẻ hơn** đi thẳng courier. Giá rate-check = giá all-in.

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
- F10 cancel-restock (`/api/orders/[id]/cancel`) + refund (`/api/orders/[id]/refund`, Stripe/manual, tự restock, idempotent) + nút Refund/Cancel inline — **reuse 100% cho Phase D** (return = bấm Refund; KHÔNG dựng RMA mới).
- Order lifecycle hiện có: `pending → new → confirmed → ready_to_ship → shipped → completed` (+ `cancelled`, `refunded`).
- **Geo cascade MY — 4 endpoint NATIVE có sẵn, reuse 100%, KHÔNG build mới** (warehouse dropdown + autofill):
  - `GET /api/geo/states` → 16 bang + `zone` (west/east) · `src/app/api/geo/states/route.ts`
  - `GET /api/geo/districts?stateId=` → city/district theo bang · `src/app/api/geo/districts/route.ts`
  - `GET /api/geo/postcodes?districtId=` → postcode theo district · `src/app/api/geo/postcodes/route.ts`
  - `GET /api/geo/lookup/[postcode]` → reverse: postcode → {district, state, zone} · `src/app/api/geo/lookup/[postcode]/route.ts`
  - Dataset: bảng `malaysia_states/districts/postcodes` (seed `scripts/seed-malaysia-geo-boot.js`). Checkout đã dùng cascade này.
  - **Recommend (DRY):** tách cascade inline của `CheckoutAddressForm.tsx` thành component dùng chung (`AddressCascadeFields`) cho cả checkout + warehouse; né rủi ro đụng checkout → F36 gọi thẳng 4 endpoint trên.
  > **Ranh giới native vs build mới:** 4 geo endpoint + dataset = **reuse**. Backend EasyParcel (test-connection, save `easyParcelIntegration`, rate/label/tracking) = **build mới** (chưa có dòng easyparcel nào trong `src/`).

**File mới:** `src/lib/shipping/easyparcel/{client,types,normalize}.ts`, `src/lib/shipping/get-rates.ts`, `src/app/api/orders/[id]/create-label/route.ts`, `src/app/api/cron/sync-tracking/route.ts`. Mở rộng: `calculate-shipping/route.ts`, settings shipping, `CheckoutClient.tsx`, `OrderDetailPanel` (gắn tạo label vào nút "Ready to Ship" + nút reverse label cạnh Refund), `ShipOrderModal.tsx` (giữ nhánh manual non-EP). **Reuse 0 đổi:** `api/orders/[id]/{refund,cancel}/route.ts`.

**Routing key:** mọi call EasyParcel dùng **API key của merchant** (`api` param) lấy từ `tenant.easyParcelIntegration.apiKey` → cước vào đúng ví merchant.

### NON-CUSTODY GUARDRAILS (bắt buộc)
- ✅ Cước trừ thẳng ví merchant; COD settle thẳng EasyParcel → merchant.
- ❌ Platform KHÔNG cầm/giữ/markup tiền cước hay tiền COD.
- ❌ Platform KHÔNG dùng ví EasyParcel chung cho mọi merchant.

## 5. Scope & Roadmap

```
Phase A (Connect) ─▶ Phase B (Rate@Checkout) ─▶ Phase C (Fulfillment) ─▶ Phase D (Returns) ─▶ staging
```

| Phase | Tên | Nội dung chính | Out |
|---|---|---|---|
| **A** | Connect + Settings | Dán API key + warehouse + chọn 1 courier + test connection | Tự dựng UI EasyParcel · auto label · default parcel |
| **B** | Rate @ Checkout | Real-time rate (đúng 1 courier shop chọn) + lưu order; hybrid fallback flat | Markup cước · buyer chọn courier |
| **C** | Fulfillment | Mua label gắn vào nút "Ready to Ship" có sẵn + in label + pickup/dropoff + COD + tracking sync cron | Multi-warehouse · auto label · auto-complete · show số dư ví · màn tạo vận đơn riêng · tab toggle manual |
| **D** | Returns + Refund | Reverse label (nút mới cạnh Refund) + reuse `/refund` & `/cancel` + restock có sẵn; cancel refund theo trạng thái label | Auto refund cước · RMA collection · buyer return-request UI |

### Out of Scope (toàn feature)
- **Markup cước** (giá hiển thị = raw EasyParcel).
- **Insurance / parcel protection** (addon EasyParcel).
- **Delyva** + provider khác (chỉ EasyParcel MVP).
- API nạp ví (EasyParcel không hỗ trợ — merchant tự nạp trên dashboard EasyParcel).
- Multi-warehouse per merchant (1 origin/merchant cho MVP).
- COD ngoài West Malaysia (giới hạn của EasyParcel COD).

---

## 6. Functional Requirements

### 6.A — Phase A: Connect + Settings (per-merchant API key)

> **Cách làm (KISS):** Merchant tự đăng ký EasyParcel, lấy API key, dán vào `settings/shipping` trên Prime. Mirror `echIntegration`. KHÔNG OAuth. Platform lưu key + validate bằng "test connection".

> **Decision — Warehouse origin = Prime là source of truth (KHÔNG sync từ EP):** EasyParcel Individual API **không có endpoint đọc địa chỉ kho/sender** từ account (verify: wrapper `apih/easyparcel` + Help Centre — profile address chỉ là default cho UI dashboard, không expose qua API; mọi call truyền `pick_*`/origin per-request). → Merchant nhập warehouse **1 lần** trong Prime; Payload `tenant.easyParcelIntegration.warehouse` là **single source of truth** dùng cho **cả** rate-check (`pick_code/pick_state`) **lẫn** tạo label/pickup (`pick_*`). KHÔNG cần set/sync gì trên dashboard EP. **Force validate:** warehouse postcode được kiểm tra ngay tại "Test connection" — sai → KHÔNG lưu. Nguồn: `plans/reports/researcher-260617-1107-easyparcel-address-sync.md`.

#### Flow connect

```
A1. Merchant vào settings/shipping → tab "EasyParcel"
A2. Dán API key (api + auth) + nhập warehouse address (origin) — KHÔNG chọn environment (warehouse là Prime SoT, không sync từ EP)
A3. Bấm "Test connection" → backend tự dò env: thử EPRateCheckingBulk bằng CHÍNH warehouse postcode trên production trước, FAIL → thử demo (origin→dest mẫu, 1kg)
      ├─ OK   → lưu key + env đã dò được (detectedEnv) + warehouse đã validate, hiện danh sách courier khả dụng để toggle
      ├─ FAIL key (cả 2 env) → báo lỗi rõ (`EASYPARCEL_INVALID_KEY`), KHÔNG lưu
      └─ FAIL warehouse postcode (key OK nhưng origin invalid) → `EASYPARCEL_INVALID_WAREHOUSE`, KHÔNG lưu
A4. Merchant chọn **1 courier** cho shop (radio single-select; default J&T)
A5. enabled=true → Phase B mở khoá cho site của tenant
```

| FR | Mô tả | Story |
|---|---|---|
| **A-1** | Tab "EasyParcel" trong `settings/shipping`: input API key (api + auth), form warehouse address. Warehouse = **Prime SoT**, dùng cho cả rate + label/pickup; **KHÔNG sync từ EP** (API không có endpoint đọc address). Form dùng **geo cascade NATIVE có sẵn** (State → City → Postcode = 3 dropdown qua `/api/geo/{states,districts,postcodes}` + reverse `/api/geo/lookup/[postcode]`, dataset `malaysia_*` đã seed — reuse, KHÔNG build mới; xem §4); chỉ `line1/2` free text. Cascade trả `zone` (west/east) → tái dùng cho COD West-MY (C-7). **KHÔNG có selector environment** — env auto-detect ở bước test. | US-F36-01 |
| **A-2** | "Test connection" gọi `EPRateCheckingBulk` bằng key + **chính warehouse postcode**, **tự dò env** (production trước, fail → demo); OK → lưu key + `detectedEnv` + warehouse (đã validate) + trả list courier. FAIL key → `EASYPARCEL_INVALID_KEY`; FAIL warehouse postcode → `EASYPARCEL_INVALID_WAREHOUSE`. **Force validate: sai → KHÔNG lưu.** | US-F36-01 |
| **A-3** | Chọn **1 courier** cho shop (`selectedCourier` = single `courier_id`, **radio single-select, KHÔNG hasMany** — chỉ 1 courier active mỗi lúc) từ list khả dụng. Default = **J&T** (#1 SME); top 3 (J&T, Pos Laju, Flash) có badge "Phổ biến SME"; còn lại gập "＋ Xem thêm courier". **KHÔNG show giá cước ở settings** (chưa có origin/dest/weight → "from RM X" dễ sai/nhầm); giá thật chỉ ở checkout (B). List chỉ name + logo + badge; list thật từ response EasyParcel. Nguồn top-3: `plans/reports/researcher-260617-1150-my-sme-top-couriers.md`. | US-F36-02 |
| **A-4** | API key lưu trong `tenant.easyParcelIntegration.apiKey`; **PATCH yêu cầu auth + IDOR check** (chỉ owner tenant sửa được, mirror `hasSiteAccess`). | US-F36-01 |
| **A-5** | `enabled=false` hoặc thiếu key/warehouse → checkout dùng **flat rate fallback** (không vỡ). | US-F36-03 |
| **A-6** | EasyParcel API lỗi → log + error code, không lộ key, tenant không kẹt trạng thái sai. | US-F36-01 |

> **Bỏ khỏi Phase A (KISS):** (1) **Label mode setting** — tạo vận đơn luôn **manual** (merchant bấm nút "Ready to Ship" có sẵn), không có checkbox auto/manual. (2) **Default parcel** — weight/dims lấy từ `Products.*`, fallback hằng số (xem B-1). (3) **Hiển thị số dư ví EP** — không show balance chủ động; chỉ báo lỗi khi tạo label thất bại do ví thiếu (`EASYPARCEL_WALLET_LOW`).

### 6.B — Phase B: Rate @ Checkout (hybrid, 1 courier/shop)

> Dùng `EPRateCheckingBulk` (free, không trừ ví). Hybrid: EasyParcel khi cấu hình đủ; flat khi chưa. **Chỉ rate đúng 1 courier shop đã chọn** (`selectedCourier`) — buyer KHÔNG chọn courier.

#### Flow rate

```
B1. Buyer nhập địa chỉ — reuse cascade F14 (state → city → postcode, /api/geo/* + CheckoutForm), KHÔNG dựng form mới
B2. POST /api/orders/calculate-shipping { siteId, dest postcode/state, items }
      → tính tổng weight từ Products.weight/dimensions; product=0 → hằng số DEFAULT_PARCEL
B3. getRates():
      ├─ EasyParcel ON → EPRateCheckingBulk(origin warehouse, dest, weight, dims) cho selectedCourier
      │     → { courier, service_id, price(RM→sen), eta } của đúng courier shop chọn
      └─ OFF → flat West/East (1 option)
B4. Checkout UI: phí ship vào thẳng Order Summary (1 dòng "Shipping"); KHÔNG section vận chuyển, KHÔNG SST; fallback → 1 fee flat như hiện tại
B5. Tạo order: lưu shippingCourier + shippingServiceId + shippingFee (RM-float, đồng nhất field hiện tại & total)
```

| FR | Mô tả | Story |
|---|---|---|
| **B-0** | Buyer shipping-address form **reuse cascade F14** (State → City → Postcode `<Select>` × 3, `/api/geo/*` + `CheckoutForm`) — KHÔNG dựng form/endpoint mới. | US-F36-05 |
| **B-1** | `calculate-shipping` nhận thêm `items` → tính tổng weight (sum `Products.weight` × qty; product = 0/thiếu → hằng số hệ thống `DEFAULT_PARCEL`, KHÔNG có field per-tenant). | US-F36-04 |
| **B-1b** | **Snapshot `parcelWeight` (gram) lên order lúc checkout** (= tổng weight đã tính ở B-1) — để modal Ready-to-Ship đọc lại khớp đúng cước đã báo, KHÔNG re-join Products. Order items hôm nay KHÔNG snapshot weight/dims. | US-F36-04 |
| **B-2** | Tenant EasyParcel ON → rate `selectedCourier` (1 courier shop chọn), trả `{ courier, serviceId, fee(sen), eta }` đơn; OFF → trả flat fee đơn (giữ shape cũ tương thích). | US-F36-04 |
| **B-3** | Checkout UI: phí ship hiển thị **1 dòng "Shipping" trong Order Summary** — KHÔNG có section vận chuyển (shop chốt 1 courier, buyer không chọn), KHÔNG có dòng SST (gỡ ở checkout từ F33 phase-06). Fallback → giữ UI fee đơn hiện tại. | US-F36-05 |
| **B-4** | Lưu `shippingCourier`, `shippingServiceId`, `shippingFee` vào order. `shippingFee` lưu **RM-float** (đồng nhất field hiện tại & `total`; compute bằng sen rồi `/100` khi lưu — KHÔNG lưu sen vào cột này). Wire ở nhánh `/api/orders/checkout` (COD/bank) + `/api/orders/stripe-checkout`. Nhánh Xendit thuộc **F34 (nhánh riêng)** — wire khi F34 merge. | US-F36-04 |
| **B-5** | EasyParcel rate API lỗi/timeout → **fallback flat rate** (không chặn checkout); log cảnh báo. | US-F36-05 |
| **B-6** | Giá hiển thị = **raw EasyParcel** (RM→sen ×100), KHÔNG markup. | US-F36-04 |
| **B-7** | Free-shipping threshold (`freeAbove`) vẫn áp được lên phí ship nếu merchant bật. | US-F36-05 |
| **B-8** | **Buyer checkout đã thu đủ 8 receiver fields** (name, phone, email, addr1, addr2, city, state, postcode) — KHÔNG cần thêm input field mới cho buyer. Backend transform `mapState()` + `normalizePhone()` + `buildAddress()` trước khi gửi EasyParcel (xem §field-mapping trong design doc). | US-F36-04 |
| **B-9** | **Product weight/dimensions phải được snapshot vào order** tại thời điểm checkout (grams); aggregated thành `parcelWeight` (grams) trên order để rate call và modal "Ready to Ship" dùng lại. Hiện tại chưa wired — flat-rate path không dùng weight. Phase B phải wiring này. Default `DEFAULT_PARCEL` khi product weight = 0. | US-F36-04 |
| **B-10** | **EasyParcel normalize per-courier differences** — cùng 1 field set cho mọi courier (J&T, Pos Laju, Flash, Ninja Van, v.v.). Per-courier variance là operational (cut-off time, COD geography), không phải schema variance. Backend gửi cùng field set bất kể `selectedCourier`. | US-F36-04 |

### 6.C — Phase C: Fulfillment (label + pickup + COD + tracking)

> `EPSubmitOrderBulk`+`EPPayOrderBulk` tạo label (trừ ví). `EPParcelStatusBulk` poll tracking. COD = EasyParcel COD service.
> **KHÔNG có màn "Tạo vận đơn" riêng.** Mua label gắn thẳng vào nút **"Ready to Ship"** đã có inline trong `OrderDetailPanel` (hiện chỉ flip status confirmed→ready_to_ship). EP tenant: nút này mở modal tạo label; non-EP: giữ flip như cũ. **KHÔNG có tab "nhập tracking thủ công"** — nhánh manual do cấu hình tenant quyết, không phải lựa chọn per-order.

> **Gating nút Ready to Ship — chấp nhận MỌI trạng thái đã-trả-tiền-chưa-ship, KHÔNG chỉ `confirmed`:** đơn Stripe (F13) land ở `status='new'` + `paymentStatus='paid'` (webhook `checkout.session.completed`), KHÔNG phải `confirmed`. Đơn Bank Transfer Approve → `confirmed`. Đơn COD → `pending`/`confirmed`. → Nút tạo label PHẢI hiện khi `status ∈ {new, paid, confirmed}` (hoặc tiêu chí thực dụng hơn: `paymentStatus='paid'` HOẶC COD đã `confirmed`, VÀ chưa có `awbNo`). Nếu chỉ gate `confirmed` → đơn Stripe-paid không tạo được label. Verify danh sách state với `OrderDetailPanel` hiện tại lúc implement.

#### Flow mua label

```
C1. Order paid/confirmed → merchant mở order trong OrderDetailPanel (đã có sẵn)
C2. Bấm "Ready to Ship" → EP tenant + order có serviceId: mở modal confirm
      • weight prefill = order.parcelWeight (Σ qty×weight đã snapshot); dims = thùng thật (prefill DEFAULT_PARCEL box); cả 2 sửa được
      • KHÔNG hiển thị courier ở đâu trong modal (đã khoá 1 courier; dùng selectedCourier ngầm)
      • pickup date (cut-off-aware): min=HÔM NAY nếu T2–T6 & giờ MYT < cut-off(selectedCourier), ngược lại min=ngày làm việc kế; default=min; chặn quá khứ+T7/CN
C3. POST /api/orders/[id]/create-label → EPSubmitOrderBulk → EPPayOrderBulk (api key merchant, serviceId)
      ├─ OK   → trừ ví → trả awb_no + label PDF
      │         lưu awbNo + labelUrl + easyParcelOrderNo; trackingNumber = awbNo; order → ready_to_ship
      └─ FAIL (ví hết / lỗi) → KHÔNG đổi order; báo merchant + link nạp ví EasyParcel
C4. Merchant in label (labelUrl) + dán lên gói
C5. Pickup (collection_date) HOẶC dropoff (merchant chọn); default pickup
C6. Bấm "Ship Order" (nút có sẵn): EP → xác nhận courier đã pickup → shipped (KHÔNG nhập tracking tay, AWB đã có).
     Non-EP → ShipOrderModal hiện tại (nhập trackingNumber free-text) giữ NGUYÊN.
     (mọi chuyển trạng thái đều MANUAL — đúng order lifecycle hiện tại; không auto-transition)
```

#### Flow COD

```
Buyer chọn COD tại checkout (chỉ West MY)
   → order paymentMethod='cod', codAmount = snapshot grand total (sen), codStatus='pending'
Merchant tạo label với cờ COD + codAmount (RM) → EasyParcel
   → courier thu tiền mặt khi giao → trừ phí COD max(flat, 4%)
   → EasyParcel settle phần còn lại về merchant (platform KHÔNG đụng)
```

#### Use Cases — COD

**Normal Flow (West MY, courier hỗ trợ COD, trong giới hạn):**

```
1. Buyer ở West MY nhập địa chỉ → checkout tính đủ điều kiện COD (state West MY + courier COD-enabled + total [RM5.01, RM7000])
2. Buyer chọn COD → order tạo: paymentMethod='cod', codAmount=grand total, codStatus='pending', paymentStatus='unpaid'
   → "confirmed but unpaid" — tiền CHƯA thu tại đây
3. Merchant mở order → tạo label → EPSubmitOrderBulk gửi cod_enabled=true + cod_amount (RM) →
   cần verify param name trong sandbox (§11 item #1)
4. Courier giao hàng → thu tiền mặt từ buyer → trừ phí COD max(flat, 4%) → settle phần còn lại về EasyParcel
5. EasyParcel settle về merchant (1–30 ngày tuỳ courier; merchant tự withdraw trên dashboard EasyParcel)
6. Merchant nhận tiền → đánh dấu codStatus='collected' (display-only); bấm "Completed" thủ công
```

**Alternative Flow A — COD + Dropoff (không pickup):**
- Merchant chọn dropoff thay vì pickup khi tạo label; cờ COD + codAmount vẫn gửi bình thường; courier vẫn thu tại nhà buyer.

**Alternative Flow B — COD + Free-Shipping Threshold:**
- Merchant bật freeAbove → shippingFee = 0; codAmount = subtotal (không cộng ship); cờ COD vẫn gửi theo codAmount.
- Lưu ý: phí COD max(flat, 4%) vẫn bị trừ từ tiền thu hộ của courier — merchant vẫn chịu phí này dù ship miễn phí.

**Alternative Flow C — COD với tenant non-EasyParcel:**
- Merchant dùng flat-rate fallback (EP OFF) → checkout vẫn hiện tùy chọn COD nếu `site.paymentConfig.enableCod=true`.
- paymentMethod='cod', codAmount lưu như bình thường; label tạo tay (ShipOrderModal thủ công).
- Không có automation courier thu hộ qua EasyParcel; merchant tự thu COD tay và ghi chú.

**Exception E1 — East MY (Sabah/Sarawak):**
- Địa chỉ buyer thuộc Sabah/Sarawak → hệ thống ẩn/disable tùy chọn COD với helper text.
- Buyer phải chọn phương thức thanh toán khác (online/bank transfer).

**Exception E2 — Tổng đơn vượt RM7,000:**
- codAmount > RM7,000 → COD option ẩn/disable với message; buyer không thể chọn COD.

**Exception E3 — Courier shop chọn không hỗ trợ COD:**
- selectedCourier là Pos Laju, SPX, City-Link hoặc courier không có `cod_service_available=true` → COD option ẩn/disable.

**Exception E4 — Ví merchant thiếu tiền mua label COD:**
- Label COD cần prepay cước thường từ ví merchant (shipping fee) dù COD. Ví hết → `EASYPARCEL_WALLET_LOW`; codAmount chưa thu, không ảnh hưởng.

**Exception E5 — Buyer từ chối nhận hàng:**
- Courier trả hàng về; shippingTrackingStatus → 'Returned'; codStatus giữ 'pending' (không thu được tiền).
- Merchant xem xét: nhận hàng về → bấm Refund (reuse endpoint F10); cước đi mất; COD không thu được.

> **"Confirmed but unpaid" model:** COD order khác prepaid — tiền KHÔNG được capture lúc checkout. paymentStatus='unpaid' cho đến khi merchant xác nhận nhận tiền qua EasyParcel settlement + bấm Completed. KHÔNG có auto-transition. Platform RM0, không đụng tiền COD.

#### Flow tracking sync

```
Cron /api/cron/sync-tracking (mỗi 30-60 phút)
   → gom orders shipped/chưa completed có awbNo, group theo tenant (đúng api key)
   → EPParcelStatusBulk → cập nhật shippingTrackingStatus (field hiển thị)
   → delivered → CHỈ update shippingTrackingStatus; KHÔNG auto-complete order
   → merchant tự bấm "Completed" (giữ manual lifecycle); buyer xem tracking trên trang đơn
```

**Dual-field tracking (decouple courier status khỏi lifecycle):** EasyParcel **normalize mọi courier** (J&T, Pos Laju, Flash, Ninja Van... top 10) về **1 enum 13 status chuẩn** — `EPParcelStatusBulk` không trả status raw của từng hãng → KHÔNG cần xử lý per-courier. Lưu vào field display `shippingTrackingStatus`; `order.status` (lifecycle) vẫn manual. Chỉ 4/13 là gợi ý transition (merchant vẫn bấm tay).

> **`order.status` thật = 11 giá trị** (`src/collections/Orders.ts:189`): **7 fulfillment** `pending → confirmed → ready_to_ship → shipped → completed` + `cancelled` + `refunded`; **4 payment/legacy** `new`, `paid`, `payment_failed`, `processing`. Field thứ 2 riêng `paymentStatus` (8 giá trị). **Delivery (F36) CHỈ gợi ý vào subset fulfillment** — mọi target trong bảng dưới (`shipped`/`completed`/`refunded`/`cancelled`) là enum hợp lệ sẵn có; KHÔNG thêm value mới vào `order.status`.

> **Buyer projection (public, KHÔNG show raw lifecycle):** trang đơn buyer đã có sẵn 1 lớp đơn giản hoá **6 giá trị** — `getTrackingStatus()` type `TrackingStatus` (`OrderTrackingClient.tsx:13`): `processing` (pending/confirmed/new/ready_to_ship/paid) · `in-transit` (shipped) · `delivered` (completed) · `cancelled` · `refunded` · `payment_failed`. **F36 chỉ làm giàu nhánh `in-transit`** bằng sub-timeline courier từ `shippingTrackingStatus`, **collapse 13 EP → nhãn thân thiện** và **ẩn vocab nội bộ**: `Exception`/`On Hold` → "Tạm hoãn"; `Admin Cancel`/`Expired`/`Cancelled` → "Đã huỷ". Buyer KHÔNG thấy từ "Exception/Admin Cancel/Expired" (per NFR-10 — chỉ subset an toàn + nhãn public).

| `shippingTrackingStatus` (13 EasyParcel) | Gợi ý `order.status` (manual) |
|---|---|
| Scheduled · Pending For Collection | — (chờ lấy) |
| **Collected** · Drop Off | → merchant bấm `shipped` |
| In Transit · Out for Delivery | — (chỉ display) |
| Delivery On Hold · Exception | — (mốc cảnh báo, KHÔNG đổi state) |
| **Delivered** | → merchant tự bấm `completed` (KHÔNG auto-complete) |
| **Returned** | → `refunded` sau khi kiểm |
| **Cancelled · Admin Cancel · Expired** | → `cancelled` |

> Nguồn: `plans/reports/researcher-260617-1406-easyparcel-status-mapping.md`.

| FR | Mô tả | Story |
|---|---|---|
| **C-1** | Nút "Ready to Ship" (EP tenant) → `POST /api/orders/[id]/create-label` gọi `EPSubmitOrderBulk`+`EPPayOrderBulk` (api key merchant, serviceId từ order); lưu `awbNo`, `labelUrl`, `easyParcelOrderNo`, `trackingNumber=awbNo`; order → `ready_to_ship`. **KHÔNG màn riêng.** | US-F36-06 |
| **C-2** | **Idempotent**: order đã có `awbNo` → KHÔNG tạo label lần 2 (chống double-charge ví). | US-F36-06 |
| **C-3** | Ví hết / API fail → order KHÔNG đổi trạng thái; error rõ (`EASYPARCEL_WALLET_LOW`) + link nạp ví; merchant retry được. | US-F36-06 |
| **C-4** | Pickup/dropoff: merchant chọn; pickup truyền `collection_date` (`YYYY-MM-DD`, giờ MY UTC+8; KHÔNG có `EPPickUpBooking` — xem §10); default pickup. **Date picker CUT-OFF-AWARE (sync logic courier thật):** EasyParcel **chấp nhận same-day** — `min = HÔM NAY` nếu hôm nay là T2–T6 **VÀ** giờ hiện tại (tính theo **MYT/UTC+8, server-side**) `< cut-off(selectedCourier)`; **ngược lại `min = ngày làm việc kế`**. `default = min`. Disable quá khứ + T7/CN; public holiday để **API tự bump** (KHÔNG build lịch lễ MY cho MVP). KHÔNG time picker. Backstop: gửi sau cut-off → API âm thầm bump, không vỡ. Server validate format trước khi gửi. Dropoff vẫn truyền `collection_date`. | US-F36-07 |
| **C-4c** | **Cut-off per courier** (const `COURIER_CUTOFF` trong code, MYT): J&T `13:50`, Flash `14:00`, Pos Laju `12:50` (conservative — **verify với Pos/EasyParcel trước go-live**), courier khác/chưa biết → fallback conservative (vd `12:00` hoặc chỉ cho ngày mai). Hardcode → đặt task **re-verify ~cuối 2026**. Nguồn: `plans/reports/researcher-260617-1426-courier-cutoff-verify.md`. | US-F36-07 |
| **C-4d** | **Khóa 2 lớp, 1 nguồn sự thật (DRY):** 1 helper `earliestPickupDate(courier, nowMYT)` (skip cut-off + T7/CN) dùng cho **CẢ** render picker (`min`/`default`) **LẪN** server validate lúc submit. **Server (create-label route) BẮT BUỘC re-tính `earliest` theo MYT tại thời điểm request — KHÔNG tin `collection_date` client gửi.** Nếu `collection_date < earliest` (vd merchant mở modal trước cut-off, bấm sau cut-off) → **clamp lên `earliest` + trả về ngày đã dời** để UI báo "đã dời sang DD/MM" (không gửi same-day sai SLA). Đây là chốt chặn đúng SLA courier — picker client chỉ là UX. | US-F36-07 |
| **C-4b** | Weight/dims trong modal: weight prefill = `order.parcelWeight` (snapshot, sửa được); dims = **thùng thật merchant gói** (prefill `DEFAULT_PARCEL` box; đơn 1 món → `Products.dimensions`) — **KHÔNG cộng dims đa-SP**. | US-F36-06 |
| **C-5** | Modal "Ready to Ship" (EP): **KHÔNG hiển thị courier** (đã khoá 1 courier; dùng `selectedCourier` ngầm), weight/dims prefill (sửa được), pickup date (rule C-4), nút tạo label; sau OK → AWB + nút in label. Non-EP: `ShipOrderModal` hiện tại (trackingNumber free-text) giữ NGUYÊN — nhánh manual do **config tenant** quyết, **KHÔNG phải tab toggle** per-order. | US-F36-06 |
| **C-6a** | **COD eligibility gating tại checkout:** Tùy chọn COD hiển thị VÀ cho phép chọn CHỈ khi ĐỒNG THỜI: (1) địa chỉ buyer thuộc West Malaysia (state zone='west' từ `/api/geo/lookup/[postcode]`); (2) `selectedCourier` có `cod_service_available=true` trong response EPRateCheckingBulk (J&T, DHL eCommerce, Flash, Aramex — không phải Pos Laju, SPX, City-Link); (3) order grand total ≥ RM5.01 (min COD) VÀ ≤ RM7,000 (max COD của courier). Thiếu bất kỳ điều kiện nào → COD option ẩn hoặc disabled với helper text lý do. **Tenant EP OFF:** COD vẫn khả dụng như cũ (không thay đổi `site.paymentConfig.enableCod`) — chỉ không có automation courier thu hộ. | US-F36-08 |
| **C-6b** | **`codAmount` snapshot:** Khi buyer chọn COD, `codAmount` = snapshot grand total (sen) tại thời điểm checkout (= subtotal + shippingFee − discount). Lưu nội bộ bằng **sen**; chuyển sang RM khi gửi EasyParcel (`/100`). KHÔNG recalculate sau khi order tạo. **Schema:** cột MỚI `cod_amount` (number, sen) trên `orders` — KHÔNG derive từ `total` (field `total` lưu RM-float, khác đơn vị) → yêu cầu entry `scripts/db-setup.js` MIGRATIONS (NFR-9). | US-F36-08 |
| **C-6c** | **`codStatus` field (display-only, NOT reconciliation engine):** Thêm field `codStatus` enum vào Orders với 3 giá trị: `pending` (default, tiền chưa thu) → `collected` (merchant xác nhận nhận COD từ courier/EasyParcel settlement) → `settled` (merchant đã rút tiền, đối soát xong). KHÔNG có API đối soát — merchant tự check dashboard EasyParcel. **Schema:** cột scalar `cod_status` varchar trên `orders` → yêu cầu entry trong `scripts/db-setup.js` MIGRATIONS (per NFR-9). | US-F36-08 |
| **C-6f** | **`codStatus` là TẦNG RIÊNG, KHÔNG thay `paymentStatus` (ranh giới với F10/F13):** `codStatus` chỉ track việc **courier thu tiền mặt + settle về merchant** (tầng giao vận). `paymentStatus` của đơn COD GIỮ NGUYÊN logic có sẵn (đơn COD: `unpaid` → `paid` khi order chuyển `completed`) — F36 KHÔNG đụng. Hai field độc lập: 1 đơn COD có thể `paymentStatus='unpaid'` mà `codStatus='collected'` (courier đã thu, merchant chưa bấm Completed). F36 chỉ THÊM `codStatus`, không ghi đè cơ chế COD/payment hiện hữu; tenant EP OFF → không có `codStatus`, COD chạy y như cũ. | US-F36-08 |
| **C-6d** | **COD fee disclosure:** Khi buyer chọn COD, hiện thông tin phí COD ước tính (max(flat, 4%) theo courier đã chọn) là INFORMATIONAL — merchant chịu, trừ từ tiền thu hộ; platform RM0. Không hiển thị phí này trong giá buyer thấy (phí là của merchant, không phải buyer). | US-F36-08 |
| **C-6e** | **Label COD:** Khi tạo label cho order COD (paymentMethod='cod', West MY validated, codAmount trong giới hạn), gửi `cod_enabled=true` + `cod_amount` (RM) trong EPSubmitOrderBulk. **Param name chưa confirmed** — verify trong sandbox trước go-live (§11 item #1). | US-F36-08 |
| **C-6** | *(Deprecated — xem C-6a..C-6e)* COD: order `paymentMethod='cod'` + `codAmount` → tạo label cờ COD; **West MY only** (validate state). | US-F36-08 |
| **C-7** | `GET /api/cron/sync-tracking` (cron secret auth) poll `EPParcelStatusBulk` theo batch tenant; cập nhật `shippingTrackingStatus` (1 trong 13 enum chuẩn EasyParcel). | US-F36-09 |
| **C-8** | Tracking **nhúng vào order detail có sẵn, KHÔNG màn riêng**: buyer = làm giàu `OtShippingCard` + `OtTimeline` trong `OrderTrackingClient` (courier + AWB + trạng thái); merchant = badge tracking trong `OrderDetailPanel`. | US-F36-09 |
| **C-8a** | **Reuse hook email tracking của F14 (DRY, KHÔNG dựng mới):** email "Shipped" đã hỗ trợ sẵn — có `trackingUrl` → render `<a href>` clickable; chỉ có `trackingNumber` → plain text (F14 BR-09 / TC-F14.121, `src/lib/email`). F36 chỉ cần **truyền `trackingUrl` = deep-link courier** (vd `https://www.tracking.my/...` hoặc URL hãng theo `awbNo`) vào email Shipped có sẵn → buyer có link "Theo dõi" tự động. KHÔNG viết template/email mới. Link courier trên trang đơn buyer (`OrderTrackingClient`) cũng dùng chung URL này. | US-F36-09 |
| **C-9** | `shipped → completed` **chỉ manual** (merchant bấm). Cron delivered chỉ update `shippingTrackingStatus`, **KHÔNG auto-complete** (giữ manual order lifecycle). | US-F36-09 |

### 6.D — Phase D: Returns + Refund (reuse refund/cancel có sẵn)

> **Codebase đã có `POST /api/orders/[id]/refund` (Stripe + manual, tự restock, idempotent) và `POST /api/orders/[id]/cancel` (F10 restock atomic) + nút Refund/Cancel inline trong `OrderDetailPanel`.** Phase D **KHÔNG dựng Returns/RMA collection, KHÔNG buyer return-request UI.** Return = merchant nhận hàng về → bấm **Refund** (đã restock sẵn). Phần EP-specific duy nhất = **nút "Tạo nhãn trả hàng" (reverse label)** cạnh nút Refund.

#### Flow return (merchant-driven, reuse refund)

```
Merchant quyết refund 1 đơn → (tuỳ chọn) bấm "Tạo nhãn trả hàng":
   ├─ Reverse label: EPSubmitOrderBulk đảo origin↔dest (pick=địa chỉ buyer, send=kho merchant) → return AWB
   │       → buyer gửi hàng về → merchant nhận → bấm Refund (endpoint có sẵn → refund + restock)
   └─ Không tạo label (buyer tự gửi / nhận tay): merchant nhận hàng → bấm Refund (refund + restock có sẵn)
```

#### Flow cancel refund (theo trạng thái label — chỉ chọn endpoint + message)

```
   ├─ CHƯA mua label (no awbNo) → POST /api/orders/[id]/cancel (có sẵn): refund FULL + restock
   └─ ĐÃ mua label              → POST /api/orders/[id]/refund (có sẵn): refund tiền HÀNG + restock
         (chưa pickup → message: merchant tự hủy shipment trên dashboard EP để hoàn ví; đã pickup → cước mất)
```

| FR | Mô tả | Story |
|---|---|---|
| **D-1** | Nút **"Tạo nhãn trả hàng" (reverse label)** mới cạnh nút Refund có sẵn (tuỳ chọn). **KHÔNG có RMA collection / buyer return-request UI** cho MVP. | US-F36-10 |
| **D-2** | Reverse label: `EPSubmitOrderBulk` đảo origin↔dest (kho merchant = dest); lưu return AWB riêng; track hàng về. | US-F36-10 |
| **D-3** | Refund + restock **reuse 100%** `/api/orders/[id]/refund` + `/api/orders/[id]/cancel` đã có (F10). **KHÔNG viết logic refund/restock mới.** | US-F36-10 |
| **D-4** | Cancel **chưa mua label** → gọi `/cancel` có sẵn: refund full (hàng + ship) + restock ngay. | US-F36-11 |
| **D-5** | Cancel **đã mua label** → gọi `/refund` có sẵn: refund tiền hàng + restock; cước: chưa pickup → message hủy trên dashboard EP (hoàn ví); đã pickup → cước mất, ghi rõ. | US-F36-11 |
| **D-6** | Refund tiền hàng qua provider thanh toán có sẵn (Stripe live; manual cho COD/bank; Xendit = F34). KHÔNG qua EasyParcel. | US-F36-11 |

---

## 7. Non-Functional Requirements

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

## 8. Acceptance Criteria (GIVEN/WHEN/THEN)

### Phase A
1. GIVEN tenant chưa connect WHEN mở settings/shipping THEN thấy tab EasyParcel + form API key.
2. GIVEN dán key đúng + warehouse WHEN "Test connection" THEN OK, lưu key, hiện list courier.
3. GIVEN key sai WHEN test THEN error `EASYPARCEL_INVALID_KEY`, KHÔNG lưu.
4. GIVEN connect xong WHEN chọn 1 courier THEN chỉ courier đó hiện ở checkout.
5. GIVEN user không thuộc tenant WHEN PATCH settings THEN 403 (IDOR chặn).
6. GIVEN enabled=false THEN checkout dùng flat rate fallback.

### Phase B
1. GIVEN tenant EasyParcel ON + product có weight WHEN buyer nhập địa chỉ THEN thấy phí ship thật của courier shop chọn + ETA (1 dòng, không chọn courier).
2. GIVEN tenant OFF THEN checkout hiện flat West/East như cũ (không vỡ).
3. GIVEN buyer đặt hàng THEN order lưu đúng shippingCourier (courier shop chọn) + serviceId + shippingFee (RM-float, đồng nhất field hiện tại).
4. GIVEN EasyParcel rate API timeout THEN fallback flat rate, checkout không chặn.
5. GIVEN giá EasyParcel RM8 THEN compute nội bộ = 800 sen, order.shippingFee lưu = 8.00 (RM-float, đồng nhất `total`); KHÔNG lưu 800 vào shippingFee (lệch 100× so với `total`).

### Phase C
1. GIVEN order paid/confirmed WHEN merchant bấm "Ready to Ship" (EP tenant) THEN trừ ví, trả AWB + label PDF, trackingNumber=awbNo, order → ready_to_ship (không màn riêng).
2. GIVEN order đã có awbNo WHEN tạo label lần 2 THEN bị chặn (idempotent, không trừ ví 2 lần).
3. GIVEN ví EasyParcel hết WHEN tạo label THEN error `EASYPARCEL_WALLET_LOW` + link nạp; order không đổi.
4. GIVEN order COD + buyer West MY + courier COD-enabled + total [RM5.01, RM7,000] WHEN tạo label THEN gửi cod_enabled=true + cod_amount (RM) → EasyParcel; codStatus='pending'.
5. GIVEN buyer East MY (Sabah/Sarawak) WHEN chọn COD tại checkout THEN COD option disabled/ẩn; buyer không tạo được order COD.
6. GIVEN buyer West MY nhưng selectedCourier KHÔNG hỗ trợ COD (vd Pos Laju, SPX) WHEN render tùy chọn thanh toán THEN COD option disabled với helper "Courier đang chọn không hỗ trợ COD".
7. GIVEN order total > RM7,000 WHEN render tùy chọn COD THEN COD option disabled với helper "Đơn vượt hạn mức COD (RM7,000)".
8. GIVEN buyer chọn COD WHEN order tạo THEN codAmount = snapshot grand total (sen); paymentStatus='unpaid' (tiền chưa thu); codStatus='pending'.
9. GIVEN order COD đã shipped, buyer từ chối nhận WHEN cron nhận status Returned THEN shippingTrackingStatus='Returned'; codStatus giữ 'pending' (không thu được tiền); merchant xử lý refund thủ công.
10. GIVEN order shipped có awbNo WHEN cron chạy THEN shippingTrackingStatus cập nhật; buyer xem được.
11. GIVEN order delivered (cron) THEN chỉ update tracking; order completed do merchant bấm tay.

### Phase D
1. GIVEN merchant bấm "Tạo nhãn trả hàng" (reverse) THEN tạo return AWB (đảo origin↔dest).
2. GIVEN merchant nhận hàng trả WHEN bấm Refund (endpoint có sẵn) THEN refund + restock (reuse, không logic mới).
3. GIVEN hủy đơn chưa mua label THEN gọi `/cancel` có sẵn: refund full + restock.
4. GIVEN hủy đơn đã mua label, chưa pickup THEN gọi `/refund`: refund hàng + restock; message hủy cước trên dashboard EP.
5. GIVEN hủy đơn đã pickup THEN refund hàng; cước mất, ghi rõ cho merchant.

---

## 9. Cost & Risk

> **Nguồn (2026-06-11):** EasyParcel help centre + API landing. Signup/API **free**, không setup fee.

**Chi phí platform = RM0.** Merchant chịu cước + phí COD (xem §3).

### Top risks
1. **Currency sen↔RM (NFR-1):** sai = lệch 100×. Test sandbox 1 đơn nhỏ trước khi go-live.
2. **Ví merchant hết tiền:** create-label fail giữa chừng → cần UX cảnh báo + link nạp rõ ràng (không có API topup).
3. **Pickup:** dùng `collection_date` trong `EPSubmitOrderBulk` (KHÔNG có `EPPickUpBooking` — đã resolved §10).
4. **Không có webhook tracking:** polling cron có độ trễ 30-60 phút — chấp nhận cho MVP.
5. **Reverse label API shape:** chưa rõ EasyParcel hỗ trợ đảo origin↔dest thế nào — verify Phase D, fallback "buyer tự gửi".
6. **Rate limit:** giả định ≤100 req/min — thêm backoff ở cron + checkout.
7. **Double-charge ví:** create-label phải idempotent theo `awbNo`.

---

## 10. Open Questions — [RESOLVED 2026-06-12]

> Verify nguồn: source PHP wrapper `apih/easyparcel` (`src/Client.php`, maintained, đúng MY API) + 2 research report §11.

- `[RESOLVED]` **Pickup**: KHÔNG có endpoint `EPPickUpBooking` (không tồn tại trong API). Pickup truyền qua tham số `collection_date` trong `EPSubmitOrderBulk`; courier tự sắp theo ngày. **EasyParcel chấp nhận same-day**: trước cut-off (T2–T6) → lấy hôm nay; sau cut-off → API âm thầm bump ngày làm việc kế. Date picker cut-off-aware (xem C-4/C-4c). Dropoff tùy courier. **Tin cậy: cao** (Pos Laju cut-off cần confirm). Nguồn: `plans/reports/researcher-260617-1426-courier-cutoff-verify.md`.
- `[RESOLVED]` **COD remittance**: EasyParcel settle COD về tài khoản ngân hàng merchant theo **batch tuần**; phí max(RM7, 4%) trừ thẳng tiền thu hộ. **KHÔNG có API đối soát** → merchant tự xem dashboard. Platform chỉ lưu `codAmount`, không build reconciliation. **Tin cậy: trung bình.**
- `[RESOLVED]` **Reverse/return label**: KHÔNG có flag reverse native. Tạo **đơn mới** qua `EPSubmitOrderBulk` đảo origin↔dest (pick=địa chỉ buyer, send=kho merchant), lưu thành return AWB riêng. **Tin cậy: cao.**
- `[RESOLVED]` **Cancel shipment hoàn ví**: Wrapper KHÔNG có endpoint cancel → hủy đơn/hoàn cước xử lý qua **dashboard EasyParcel hoặc support**, không programmatic cho MVP. Quy ước: chưa pickup → merchant tự hủy trên dashboard (credit hoàn về ví); đã pickup → cước mất, ghi rõ. **Tin cậy: trung bình** (nếu cần auto-cancel, mở ticket hỏi EasyParcel endpoint riêng).
- `[RESOLVED]` **Wallet balance API**: **CÓ** — endpoint `EPCheckCreditBalance` (không cần param ngoài auth). **Quyết định F36: KHÔNG show số dư ví chủ động, KHÔNG cron cảnh báo ví** (bỏ cho gọn). Ví thiếu chỉ lộ ra khi tạo label thất bại → `EASYPARCEL_WALLET_LOW` (C-3). Endpoint vẫn ghi nhận để dùng sau nếu cần. **Tin cậy: cao.**
- `[RESOLVED]` **Rate limit + API model**: Rate limit KHÔNG công bố → giả định ~100/min + backoff. **Model = Individual API per merchant** (mỗi merchant tự account + ví + key) — KHÔNG dùng Marketplace API (Marketplace = 1 ví platform chung = custody, phá guardrail §4). Platform không cần đăng ký gì với EasyParcel. **Tin cậy: cao.**
- `[RESOLVED]` **Courier/service code**: Response `EPRateCheckingBulk` trả `courier_id` (vd `EP-CR0A`), `service_id` (vd `EP-CS0I`), `courier_name` (vd `Poslaju`), `courier_logo`. Map `selectedCourier` (single) theo **`courier_id`** (mã ổn định); hiển thị `courier_name`+logo; mua label bằng **`service_id`**. **Tin cậy: cao.**

### ⚠️ Phát hiện verify ảnh hưởng các section trước (cần cập nhật FR/NFR)

1. **2 key, không phải 1:** Auth EasyParcel cần `api` (api_key) **+** `authentication` (auth_key). Sửa A-1/A-6/NFR-3: lưu thêm `authKey` trong `tenant.easyParcelIntegration`, form connect nhập 2 ô.
2. **Tạo label = 2 bước:** `EPSubmitOrderBulk` (giữ chỗ, chưa trừ ví) → `EPPayOrderBulk` (trừ ví + sinh AWB). Idempotency (C-2/NFR-2) phải khóa theo bước **pay**, không phải submit. Cập nhật flow §6.C.
3. **Base URL demo dùng HTTPS:** `https://demo.connect.easyparcel.my/?ac=` (không phải `http://`). Sửa §12.

## 11. Open Items — Verify in Sandbox Before Go-Live

The following items are unconfirmed from public API documentation. Each must be tested against the EasyParcel sandbox (demo environment, `https://demo.connect.easyparcel.my/?ac=`) before production go-live.

| # | Item | What is known | Action |
|---|---|---|---|
| 1 | **COD param name** | EasyParcel COD feature confirmed (West MY; couriers: J&T, DHL eCommerce, Flash Express, Aramex — Pos Laju/SPX/City-Link KHÔNG hỗ trợ). Research chỉ ra likely `cod_enabled` (boolean) + `cod_amount` (double, RM) trong EPSubmitOrderBulk; EPRateCheckingBulk trả `cod_service_available` + `cod_service_min/max_cod_amount`. **CHƯA verified từ public API docs — tên param vẫn phải test sandbox.** | Test sandbox với courier COD-eligible (J&T hoặc Flash); verify `cod_enabled` + `cod_amount`; không assume tên param. |
| 2 | **`send_contact` vs `send_mobile`** | `send_mobile` confirmed from SiteGiant examples. Some integrations also send `send_contact` as a separate field. Whether both are required, or one is a fallback, is unknown. | Send only `send_mobile` initially; test sandbox to confirm. |
| 3 | **10 INFERRED state codes** | 6 state codes confirmed (jhr, kdh, ktn, kul, png, sgr). 10 remaining (lbn, mlk, nsn, phg, prk, pls, pjy, sbh, swk, trg) follow ISO 3166-2:MY standard but are not verified against EasyParcel API directly. | Run rate-check for all 16 states in sandbox; fix any rejected codes before go-live. |
| 4 | **Weight/dims decimal precision** | Decimal supported (`weight: "2.5"` confirmed). Max precision for weight (kg) and dimensions (cm) is untested — edge cases like `0.001 kg` or `10.5 cm` may be rejected. | Test sandbox with fractional values; set rounding rule in `aggregateWeightKg()` accordingly. |

> Field mapping tables and transform pseudo-code are in `docs/design/F36-easyparcel-delivery-design.md §9`. Source: `plans/reports/researcher-260617-1430-easyparcel-field-mapping-final.md`.

## 12. Docs & References

- EasyParcel API landing (free): https://easyparcel.com/my/apilanding/
- Marketplace API docs: https://developers.easyparcel.com/?pg=DocAPI&c=Malaysia&type=MarketPlace
- How it works / AWB: https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223873-how-does-easyparcel-work-
- COD charges: https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224475-how-does-cod-charges-work-
- Research reports: `plans/reports/researcher-260611-1614-my-shipping-aggregators.md`, `researcher-260611-1614-easyparcel-api-deep-dive.md`
- Base URLs (verify wrapper): demo `https://demo.connect.easyparcel.my/?ac=`, prod `https://connect.easyparcel.my/?ac=`
- Source verify endpoint/field: `apih/easyparcel` → `src/Client.php` (GitHub)
