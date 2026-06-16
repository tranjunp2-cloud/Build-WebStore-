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
- Email template tham chiếu `shippingProvider` nhưng **không bao giờ được populate**.
- Merchant SME MY hầu hết đã quen EasyParcel (~70.000 SME dùng) → kỳ vọng tích hợp courier liền mạch như Shopify/WooCommerce.
- Platform là **pure SaaS** (doanh thu từ phí gói) → cần mô hình shipping mà platform **không giữ tiền cước, không gánh chi phí** vào P&L.

## 2. Target Users

- **SME Owner (Persona A):** bật/tắt courier muốn dùng; tự tính cước chính xác; mua nhãn + đặt pickup ngay trong dashboard Prime, không phải rời platform; tự quản ví EasyParcel.
- **Buyer (Persona C):** tại checkout thấy danh sách courier + giá thật + thời gian giao, chọn cái phù hợp; theo dõi tracking sau khi đặt.
- **Platform (BOD/Finance):** **RM0 chi phí** (EasyParcel free signup + free API); không giữ tiền cước/COD → không cần giấy phép tài chính; chỉ orchestrate.

## 3. Solution Overview

Tích hợp **EasyParcel** làm courier aggregator, mỗi merchant kết nối **tài khoản EasyParcel riêng** qua API key:

- Merchant dán **API key** + địa chỉ **kho (origin)** + bật **courier** muốn dùng trong settings. Mirror pattern `Tenants.echIntegration` đã có.
- Checkout gọi **rate real-time** (`EPRateCheckingBulk`) theo origin postcode + dest postcode + cân nặng → buyer chọn courier + giá. **Hybrid**: chưa cấu hình đủ → fallback flat West/East hiện tại (không phá merchant cũ).
- Merchant **mua nhãn vận đơn (AWB)** qua API (`EPSubmitOrderBulk`) — cước trừ thẳng từ **ví EasyParcel của merchant**. Tracking đồng bộ qua **polling cron** (`EPParcelStatusBulk`).
- **COD** qua EasyParcel COD service: courier thu hộ → settle thẳng về merchant. **Platform RM0, không giữ tiền cước, không markup** (giá hiển thị = giá EasyParcel raw).

> **Decision (kiến trúc):** Codebase đã có `src/lib/shipping/` (flat rate) — giữ nguyên làm **fallback**. Thêm EasyParcel = **file mới** (`src/lib/shipping/easyparcel/*` + API routes), 0 phá flat-rate logic. Per-merchant API key = mirror `echIntegration`. Rủi ro kỹ thuật: **thấp**.

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
| COD | Merchant | max(**RM7**, **4%** COD), trừ vào tiền thu hộ; **West MY only** |
| **Platform** | — | **RM0** (vs Xendit RM7.50/merchant/tháng) |

> EasyParcel kiếm tiền bằng margin gộp sẵn trong giá cước (mua sỉ volume) — merchant thường trả **rẻ hơn** đi thẳng courier. Giá rate-check = giá all-in.

## 4. Architecture (high-level)

```
Buyer ──checkout──> [Next.js storefront]
   │  POST /api/orders/calculate-shipping { siteId, dest postcode, items(weight) }
   ▼
getRates() ──┬─ tenant.easyParcelIntegration.enabled + apiKey + warehouse?
             │     └─YES─> EPRateCheckingBulk (origin↔dest, weight, dims) ──> EasyParcel
             │              → list courier + giá RM (×100 → sen) + ETA, lọc enabledCouriers
             └─NO──> flat West/East (getShippingRate hiện tại)          [HYBRID FALLBACK]
   ▼
Buyer chọn courier → order lưu shippingCourier + shippingServiceId + shippingFee
   ▼  (buyer trả tiền hàng qua F34/F13 → order paid)
   ▼
[Merchant dashboard] Tạo vận đơn (manual 1-click HOẶC auto-khi-paid)
   │  POST /api/orders/[id]/create-label → EPSubmitOrderBulk (for merchant's api key)
   │     → trừ ví EasyParcel merchant → trả awb_no + label PDF
   ▼  lưu awbNo + labelUrl + easyParcelOrderNo; order → ready_to_ship/shipped
   ▼
Pickup/dropoff (collection_date / EPPickUpBooking)
   ▼
Cron /api/cron/sync-tracking ──EPParcelStatusBulk──> cập nhật shippingTrackingStatus
   ▼  delivered → (option) order completed
Buyer xem tracking trên trang đơn
```

**Tái dùng (0 phá hành vi):**
- `src/lib/shipping/calculate-fee.ts` + `constants.ts` — flat rate, làm nhánh fallback.
- F10 cancel-restock — tái dùng cho nhánh return "buyer tự gửi".
- Order lifecycle hiện có: `pending → new → confirmed → ready_to_ship → shipped → completed` (+ `cancelled`, `refunded`).

**File mới:** `src/lib/shipping/easyparcel/{client,types,normalize}.ts`, `src/lib/shipping/get-rates.ts`, `src/app/api/orders/[id]/create-label/route.ts`, `src/app/api/cron/sync-tracking/route.ts`. Mở rộng: `calculate-shipping/route.ts`, settings shipping, `CheckoutClient.tsx`, `ShipOrderModal.tsx`.

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
| **A** | Connect + Settings | Dán API key + warehouse + toggle courier + test connection + default parcel + chọn auto/manual label | Tự dựng UI EasyParcel |
| **B** | Rate @ Checkout | Real-time multi-courier rate + buyer chọn + lưu order; hybrid fallback flat | Markup cước |
| **C** | Fulfillment | Mua label (manual/auto) + pickup/dropoff + COD + tracking sync cron + cảnh báo ví hết | Multi-warehouse |
| **D** | Returns + Refund | Reverse label HOẶC buyer tự gửi + refund/restock + cancel refund theo trạng thái label | Auto refund cước |

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

#### Flow connect

```
A1. Merchant vào settings/shipping → tab "EasyParcel"
A2. Dán API key + chọn environment (demo/production) + nhập warehouse address (origin)
A3. Bấm "Test connection" → backend gọi EPRateCheckingBulk thử (origin→origin, 1kg)
      ├─ OK   → lưu key, hiện danh sách courier khả dụng để toggle
      └─ FAIL → báo lỗi rõ (key sai / env sai), KHÔNG lưu
A4. Merchant toggle courier muốn bật (enabledCouriers) + set default parcel weight/dims
A5. Chọn chế độ tạo label: manual (default) HOẶC auto-khi-paid
A6. enabled=true → Phase B mở khoá cho site của tenant
```

| FR | Mô tả | Story |
|---|---|---|
| **A-1** | Tab "EasyParcel" trong `settings/shipping`: input API key, select environment (demo/production), form warehouse address (line1/2, city, state, postcode, country). | US-F36-01 |
| **A-2** | "Test connection" gọi `EPRateCheckingBulk` thử bằng key + warehouse postcode; OK → lưu + trả list courier; FAIL → error code rõ (`EASYPARCEL_INVALID_KEY`), KHÔNG lưu. | US-F36-01 |
| **A-3** | Toggle `enabledCouriers` (hasMany) từ list courier khả dụng; chỉ courier bật mới hiện ở checkout. | US-F36-02 |
| **A-4** | `defaultParcel`: weight (gram) + dimensions (cm) — fallback khi product thiếu số đo. | US-F36-02 |
| **A-5** | `autoCreateLabel` checkbox: bật = tự tạo label khi order paid; tắt (default) = merchant bấm tay. | US-F36-02 |
| **A-6** | API key lưu trong `tenant.easyParcelIntegration.apiKey`; **PATCH yêu cầu auth + IDOR check** (chỉ owner tenant sửa được, mirror `hasSiteAccess`). | US-F36-01 |
| **A-7** | `enabled=false` hoặc thiếu key/warehouse → checkout dùng **flat rate fallback** (không vỡ). | US-F36-03 |
| **A-8** | EasyParcel API lỗi → log + error code, không lộ key, tenant không kẹt trạng thái sai. | US-F36-01 |

### 6.B — Phase B: Rate @ Checkout (hybrid multi-courier)

> Dùng `EPRateCheckingBulk` (free, không trừ ví). Hybrid: EasyParcel khi cấu hình đủ; flat khi chưa.

#### Flow rate

```
B1. Buyer nhập địa chỉ (state → district → postcode) tại checkout
B2. POST /api/orders/calculate-shipping { siteId, dest postcode/state, items }
      → tính tổng weight từ product.weight (hoặc defaultParcel)
B3. getRates():
      ├─ EasyParcel ON → EPRateCheckingBulk(origin warehouse, dest, weight, dims)
      │     → list { courier, service_id, price(RM→sen), eta }, lọc enabledCouriers
      └─ OFF → flat West/East (1 option)
B4. Checkout UI:
      ├─ nhiều courier → radio list (tên + giá + ETA), buyer chọn
      └─ fallback → hiển thị 1 fee như hiện tại
B5. Tạo order: lưu shippingCourier + shippingServiceId + shippingFee (sen)
```

| FR | Mô tả | Story |
|---|---|---|
| **B-1** | `calculate-shipping` nhận thêm `items` → tính tổng weight (sum product.weight × qty; thiếu → defaultParcel). | US-F36-04 |
| **B-2** | Tenant EasyParcel ON → trả mảng courier options `{ courier, serviceId, fee(sen), eta }`; OFF → trả flat fee đơn (giữ shape cũ tương thích). | US-F36-04 |
| **B-3** | Checkout UI render radio list courier khi >1 option; chọn → cập nhật total realtime. Fallback → giữ UI fee đơn hiện tại. | US-F36-05 |
| **B-4** | Lưu `shippingCourier`, `shippingServiceId`, `shippingFee` vào order ở **cả** nhánh checkout (`/api/orders/checkout` COD/bank + `/api/orders/stripe-checkout` + xendit-checkout F34). | US-F36-04 |
| **B-5** | EasyParcel rate API lỗi/timeout → **fallback flat rate** (không chặn checkout); log cảnh báo. | US-F36-05 |
| **B-6** | Giá hiển thị = **raw EasyParcel** (RM→sen ×100), KHÔNG markup. | US-F36-04 |
| **B-7** | Free-shipping threshold (`freeAbove`) vẫn áp được lên option rẻ nhất nếu merchant bật. | US-F36-05 |

### 6.C — Phase C: Fulfillment (label + pickup + COD + tracking)

> `EPSubmitOrderBulk` tạo label (trừ ví). `EPParcelStatusBulk` poll tracking. COD = EasyParcel COD service.

#### Flow mua label

```
C1. Order paid → merchant mở order trong dashboard
C2a. Manual (default): merchant xác nhận courier + cân nặng → bấm "Tạo vận đơn"
C2b. Auto (nếu bật): hook order paid → tự gọi create-label
C3. POST /api/orders/[id]/create-label → EPSubmitOrderBulk(api key merchant, serviceId)
      ├─ OK   → trừ ví → trả awb_no + label PDF link
      │         lưu awbNo + labelUrl + easyParcelOrderNo; order → ready_to_ship
      └─ FAIL (ví hết / lỗi) → KHÔNG đổi order; báo merchant + link nạp ví EasyParcel
C4. Merchant in label (labelUrl) + dán lên gói
C5. Pickup (collection_date) HOẶC dropoff (merchant chọn); default pickup
C6. order → shipped (require awbNo/trackingNumber — giữ validation hiện có)
```

#### Flow COD

```
Buyer chọn COD tại checkout (chỉ West MY)
   → order paymentMethod='cod', codAmount = total
Merchant tạo label với cờ COD + codAmount → EasyParcel
   → courier thu tiền mặt khi giao → trừ phí COD max(RM7, 4%)
   → EasyParcel settle phần còn lại về merchant (platform KHÔNG đụng)
```

#### Flow tracking sync

```
Cron /api/cron/sync-tracking (mỗi 30-60 phút)
   → gom orders shipped/chưa completed có awbNo, group theo tenant (đúng api key)
   → EPParcelStatusBulk → cập nhật shippingTrackingStatus
   → delivered → (option) order completed; buyer xem trên trang đơn
```

| FR | Mô tả | Story |
|---|---|---|
| **C-1** | `POST /api/orders/[id]/create-label` gọi `EPSubmitOrderBulk` (api key merchant, serviceId từ order); lưu `awbNo`, `labelUrl`, `easyParcelOrderNo`; order → `ready_to_ship`. | US-F36-06 |
| **C-2** | **Idempotent**: order đã có `awbNo` → KHÔNG tạo label lần 2 (chống double-charge ví). | US-F36-06 |
| **C-3** | Ví hết / API fail → order KHÔNG đổi trạng thái; error rõ (`EASYPARCEL_WALLET_LOW`) + link nạp ví; merchant retry được. | US-F36-06 |
| **C-4** | `autoCreateLabel=true` → hook khi order paid tự gọi create-label; fail → fallback về manual + notify merchant. | US-F36-07 |
| **C-5** | Pickup/dropoff: merchant chọn; pickup truyền `collection_date` (hoặc `EPPickUpBooking` — verify demo); default pickup. | US-F36-07 |
| **C-6** | `ShipOrderModal` hiển thị: courier, AWB, nút in label, nút đặt pickup; **giữ nhánh nhập tracking thủ công** (merchant chưa dùng EasyParcel). | US-F36-06 |
| **C-7** | COD: order `paymentMethod='cod'` + `codAmount` → tạo label cờ COD; **West MY only** (validate state). | US-F36-08 |
| **C-8** | `GET /api/cron/sync-tracking` (cron secret auth) poll `EPParcelStatusBulk` theo batch tenant; cập nhật `shippingTrackingStatus`. | US-F36-09 |
| **C-9** | Trang đơn buyer (`sites/[slug]/orders/[orderNumber]`) hiển thị courier + AWB + trạng thái tracking. | US-F36-09 |
| **C-10** | `shipped → completed` khi delivered: option auto (cron) hoặc merchant xác nhận. | US-F36-09 |

### 6.D — Phase D: Returns + Refund

> Cả 2 nhánh return. Cancel refund theo trạng thái label. Tái dùng F10 restock.

#### Flow return (merchant chọn)

```
Buyer request return → merchant duyệt → chọn nhánh:
   ├─ A. Reverse label: EPSubmitOrderBulk đảo origin↔dest → label trả hàng
   │       → track hàng về → merchant xác nhận nhận → refund + restock
   └─ B. Buyer tự gửi: không tạo label → merchant xác nhận nhận hàng → refund + restock (tái dùng F10)
```

#### Flow cancel refund (theo trạng thái label)

```
Hủy đơn:
   ├─ CHƯA mua label  → refund FULL (hàng + ship) + restock
   └─ ĐÃ mua label    → refund tiền HÀNG; cước xử lý theo policy EasyParcel
         (nếu chưa pickup → cancel shipment hoàn ví; đã pickup → cước mất)
```

| FR | Mô tả | Story |
|---|---|---|
| **D-1** | Merchant duyệt return → chọn "Tạo nhãn trả hàng" (reverse label) HOẶC "Buyer tự gửi". | US-F36-10 |
| **D-2** | Reverse label: `EPSubmitOrderBulk` đảo origin↔dest (kho merchant = dest); lưu return AWB; track hàng về. | US-F36-10 |
| **D-3** | Buyer tự gửi: bỏ qua label; merchant bấm "Đã nhận hàng trả" → refund + restock (tái dùng F10 cancel-restock). | US-F36-10 |
| **D-4** | Cancel **chưa mua label** → refund full (hàng + ship) + restock ngay. | US-F36-11 |
| **D-5** | Cancel **đã mua label** → refund tiền hàng; ship: nếu chưa pickup → cancel shipment (hoàn ví nếu EasyParcel cho); đã pickup → cước mất, ghi rõ cho merchant. | US-F36-11 |
| **D-6** | Refund tiền hàng đi qua provider thanh toán (F34/F13 refund flow), KHÔNG qua EasyParcel. | US-F36-11 |

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
| **NFR-7** | Ví hết tiền: bắt error EasyParcel, hiện cảnh báo + link nạp; KHÔNG để order kẹt. | P1 |
| **NFR-8** | Secrets: không có secret global (key per-merchant trong DB). Chỉ constant base URL (demo/prod) trong code. | P0 |
| **NFR-9** | Schema: cột mới → `scripts/db-setup.js` MIGRATIONS; CI `check-migrations.js` gate. | P0 |

---

## 8. Acceptance Criteria (GIVEN/WHEN/THEN)

### Phase A
1. GIVEN tenant chưa connect WHEN mở settings/shipping THEN thấy tab EasyParcel + form API key.
2. GIVEN dán key đúng + warehouse WHEN "Test connection" THEN OK, lưu key, hiện list courier.
3. GIVEN key sai WHEN test THEN error `EASYPARCEL_INVALID_KEY`, KHÔNG lưu.
4. GIVEN connect xong WHEN toggle courier THEN chỉ courier bật hiện ở checkout.
5. GIVEN user không thuộc tenant WHEN PATCH settings THEN 403 (IDOR chặn).
6. GIVEN enabled=false THEN checkout dùng flat rate fallback.

### Phase B
1. GIVEN tenant EasyParcel ON + product có weight WHEN buyer nhập địa chỉ THEN thấy list courier + giá thật + ETA.
2. GIVEN tenant OFF THEN checkout hiện flat West/East như cũ (không vỡ).
3. GIVEN buyer chọn courier WHEN tạo order THEN order lưu đúng shippingCourier + serviceId + fee (sen).
4. GIVEN EasyParcel rate API timeout THEN fallback flat rate, checkout không chặn.
5. GIVEN giá EasyParcel RM8 THEN order shippingFee = 800 sen (×100 đúng, không lệch 100×).

### Phase C
1. GIVEN order paid WHEN merchant bấm "Tạo vận đơn" THEN trừ ví, trả AWB + label PDF, order → ready_to_ship.
2. GIVEN order đã có awbNo WHEN tạo label lần 2 THEN bị chặn (idempotent, không trừ ví 2 lần).
3. GIVEN ví EasyParcel hết WHEN tạo label THEN error `EASYPARCEL_WALLET_LOW` + link nạp; order không đổi.
4. GIVEN autoCreateLabel ON WHEN order paid THEN tự tạo label; fail → fallback manual + notify.
5. GIVEN COD West MY THEN tạo label cờ COD + codAmount OK.
6. GIVEN COD East MY THEN bị chặn (EasyParcel COD West only).
7. GIVEN order shipped có awbNo WHEN cron chạy THEN shippingTrackingStatus cập nhật; buyer xem được.

### Phase D
1. GIVEN merchant duyệt return + chọn reverse label THEN tạo return AWB (đảo origin↔dest).
2. GIVEN chọn "buyer tự gửi" WHEN merchant xác nhận nhận hàng THEN refund + restock (tái dùng F10).
3. GIVEN hủy đơn chưa mua label THEN refund full + restock.
4. GIVEN hủy đơn đã mua label, chưa pickup THEN refund hàng + cancel shipment (hoàn ví nếu được).
5. GIVEN hủy đơn đã pickup THEN refund hàng; cước mất, ghi rõ cho merchant.

---

## 9. Cost & Risk

> **Nguồn (2026-06-11):** EasyParcel help centre + API landing. Signup/API **free**, không setup fee.

**Chi phí platform = RM0.** Merchant chịu cước + phí COD (xem §3).

### Top risks
1. **Currency sen↔RM (NFR-1):** sai = lệch 100×. Test sandbox 1 đơn nhỏ trước khi go-live.
2. **Ví merchant hết tiền:** create-label fail giữa chừng → cần UX cảnh báo + link nạp rõ ràng (không có API topup).
3. **Pickup endpoint chưa chắc:** `EPPickUpBooking` vs `collection_date` trong submit order — verify trên demo trước Phase C.
4. **Không có webhook tracking:** polling cron có độ trễ 30-60 phút — chấp nhận cho MVP.
5. **Reverse label API shape:** chưa rõ EasyParcel hỗ trợ đảo origin↔dest thế nào — verify Phase D, fallback "buyer tự gửi".
6. **Rate limit:** giả định ≤100 req/min — thêm backoff ở cron + checkout.
7. **Double-charge ví:** create-label phải idempotent theo `awbNo`.

---

## 10. Open Questions — [RESOLVED 2026-06-12]

> Verify nguồn: source PHP wrapper `apih/easyparcel` (`src/Client.php`, maintained, đúng MY API) + 2 research report §11.

- `[RESOLVED]` **Pickup**: KHÔNG có endpoint `EPPickUpBooking` (không tồn tại trong API). Pickup truyền qua tham số `collection_date` trong `EPSubmitOrderBulk`; courier tự sắp theo ngày. Default = ngày làm việc kế tiếp. Dropoff tùy courier. **Tin cậy: cao.**
- `[RESOLVED]` **COD remittance**: EasyParcel settle COD về tài khoản ngân hàng merchant theo **batch tuần**; phí max(RM7, 4%) trừ thẳng tiền thu hộ. **KHÔNG có API đối soát** → merchant tự xem dashboard. Platform chỉ lưu `codAmount`, không build reconciliation. **Tin cậy: trung bình.**
- `[RESOLVED]` **Reverse/return label**: KHÔNG có flag reverse native. Tạo **đơn mới** qua `EPSubmitOrderBulk` đảo origin↔dest (pick=địa chỉ buyer, send=kho merchant), lưu thành return AWB riêng. **Tin cậy: cao.**
- `[RESOLVED]` **Cancel shipment hoàn ví**: Wrapper KHÔNG có endpoint cancel → hủy đơn/hoàn cước xử lý qua **dashboard EasyParcel hoặc support**, không programmatic cho MVP. Quy ước: chưa pickup → merchant tự hủy trên dashboard (credit hoàn về ví); đã pickup → cước mất, ghi rõ. **Tin cậy: trung bình** (nếu cần auto-cancel, mở ticket hỏi EasyParcel endpoint riêng).
- `[RESOLVED]` **Wallet balance API**: **CÓ** — endpoint `EPCheckCreditBalance` (không cần param ngoài auth). Dùng để: (a) cảnh báo ví thấp chủ động trước khi merchant tạo label; (b) check trước `EPPayOrderBulk`. Bổ sung vào NFR-7 + cron cảnh báo ví. **Tin cậy: cao.**
- `[RESOLVED]` **Rate limit + API model**: Rate limit KHÔNG công bố → giả định ~100/min + backoff. **Model = Individual API per merchant** (mỗi merchant tự account + ví + key) — KHÔNG dùng Marketplace API (Marketplace = 1 ví platform chung = custody, phá guardrail §4). Platform không cần đăng ký gì với EasyParcel. **Tin cậy: cao.**
- `[RESOLVED]` **Courier/service code**: Response `EPRateCheckingBulk` trả `courier_id` (vd `EP-CR0A`), `service_id` (vd `EP-CS0I`), `courier_name` (vd `Poslaju`), `courier_logo`. Map `enabledCouriers` theo **`courier_id`** (mã ổn định); hiển thị `courier_name`+logo; mua label bằng **`service_id`**. **Tin cậy: cao.**

### ⚠️ Phát hiện verify ảnh hưởng các section trước (cần cập nhật FR/NFR)

1. **2 key, không phải 1:** Auth EasyParcel cần `api` (api_key) **+** `authentication` (auth_key). Sửa A-1/A-6/NFR-3: lưu thêm `authKey` trong `tenant.easyParcelIntegration`, form connect nhập 2 ô.
2. **Tạo label = 2 bước:** `EPSubmitOrderBulk` (giữ chỗ, chưa trừ ví) → `EPPayOrderBulk` (trừ ví + sinh AWB). Idempotency (C-2/NFR-2) phải khóa theo bước **pay**, không phải submit. Cập nhật flow §6.C.
3. **Base URL demo dùng HTTPS:** `https://demo.connect.easyparcel.my/?ac=` (không phải `http://`). Sửa §11.

## 11. Docs & References

- EasyParcel API landing (free): https://easyparcel.com/my/apilanding/
- Marketplace API docs: https://developers.easyparcel.com/?pg=DocAPI&c=Malaysia&type=MarketPlace
- How it works / AWB: https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223873-how-does-easyparcel-work-
- COD charges: https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224475-how-does-cod-charges-work-
- Research reports: `plans/reports/researcher-260611-1614-my-shipping-aggregators.md`, `researcher-260611-1614-easyparcel-api-deep-dive.md`
- Base URLs (verify wrapper): demo `https://demo.connect.easyparcel.my/?ac=`, prod `https://connect.easyparcel.my/?ac=`
- Source verify endpoint/field: `apih/easyparcel` → `src/Client.php` (GitHub)
