# PRD: Xendit Payment Integration — Malaysia (F34)

> **Version:** 5.0 (Model C — Merchant's Own Account) | **Updated:** 2026-06-16 | **Owner:** Domin (Product)
> **Priority:** P1 | **Wave:** 7 (sau F13 hardening) | **Size:** L
> **Depends on:** F13 Payment Gateway ✅ (Stripe + `PaymentProvider` abstraction), F09 Storefront Commerce ✅
> **Provider:** **Xendit (Invoice API — Merchant's Own Xendit Account)** — đã chốt sau khi loại Stripe (thiếu TNG/DuitNow), Adyen (không support onboard MY), HitPay (onboard thủ công), Hyperswitch (orchestrator thừa).
> **Model:** Merchant tự có Xendit account (đã KYB với Xendit), nhập Secret Key + Webhook Token vào ECH Settings. ECH dùng key đó gọi Invoice API.
> **Status:** Implementation spec — Model C validated against codebase.

---

## 1. Problem Statement

- Stripe MY **không** hỗ trợ ví nội địa MY. **Touch 'n Go (TNG) ~62% thị phần** ví điện tử → thiếu TNG = mất phần lớn buyer ưa ví.
- TNG không có kết nối kiểu Stripe Connect → phải qua provider đã có sẵn rail TNG.
- Hiện codebase chỉ có 1 provider (Stripe Connect Direct Charges). Buyer MY muốn TNG/GrabPay/DuitNow QR/FPX không có đường nào.
- Platform là **pure SaaS** (doanh thu từ phí gói thuê bao), KHÔNG thu phí giao dịch → cần mô hình tiền **settle thẳng về merchant**, platform chỉ orchestrate, không giữ tiền.

## 2. Target Users

- **Buyer (Persona C):** thích TNG/GrabPay/DuitNow QR hơn thẻ; mobile-first.
- **SME Owner (Persona A):** muốn tối đa payment options để không mất sale; nhận tiền tự động về bank, không phải đối soát thủ công.
- **Platform (BOD/Finance):** kiểm soát chi phí sub-account/tháng; không gánh phí giao dịch vào P&L.

## 3. Solution Overview

Tích hợp **Xendit (Invoice API)** làm cổng thanh toán nội địa MY, **song song Stripe** (không đụng logic Stripe):

- Merchant tự có **Xendit account riêng** (KYB trực tiếp với Xendit — ECH không can thiệp). Merchant nhập **Secret Key + Webhook Token** vào ECH Settings → ECH lưu per-tenant.
- ECH dùng **Secret Key của merchant** gọi Xendit Invoice API (`POST /v2/invoices`), nhận `invoice_url` → redirect buyer tới hosted checkout page.
- Tiền settle **thẳng về bank merchant**, auto-payout qua Auto-Withdrawal (Dashboard config của Xendit, không phải API).
- Platform **chỉ orchestrate** (tạo invoice), **không giữ tiền, không thu phí giao dịch** (MDR merchant chịu).
- Hosted checkout: TNG/GrabPay/ShopeePay/DuitNow QR/FPX/Card — Xendit tự hiện option dựa merchant account settings.
- Routing: ví MY + DuitNow + FPX → Xendit; thẻ quốc tế / merchant ngoài MY → Stripe (giữ nguyên).

> **Decision (kiến trúc):** Codebase đã có interface `PaymentProvider` (`src/lib/payment/types.ts`) + `PaymentWebhookEvent.provider`. Thêm Xendit = **file mới** (`src/lib/payment/xendit*.ts` + `api/orders/xendit-checkout/` + `api/webhooks/xendit/*`), **0 sửa logic Stripe**. Rủi ro kỹ thuật: **thấp**.

### Vì sao Xendit (so vendor)


| PSP                 | TNG/ví MY           | Sub-merchant model      | Onboarding                            | Kết luận               |
| ------------------- | ------------------- | ----------------------- | ------------------------------------- | ---------------------- |
| **Xendit**          | ✅ đủ                | ✅ MANAGED, API-driven   | platform tạo account + hosted KYB     | ✅ **Chọn**             |
| HitPay              | ✅ đủ                | ✅ Platform API          | ⚠️ merchant tự signup + paste API key | Dự phòng (0 phí/tháng) |
| Fiuu                | ✅ đủ                | ✅ marketplace split     | ⚠️ enterprise, nặng                   | Dự phòng (scale lớn)   |
| Adyen for Platforms | ⚠️                  | ✅ hosted + returnUrl    | ❌ **không onboard merchant MY**       | Loại                   |
| Stripe Connect      | ❌ thiếu TNG/DuitNow | ✅ Connect               | ✅ tốt nhất                            | Giữ cho thẻ quốc tế    |
| Hyperswitch         | (orchestrator)      | — route tới Fiuu/Xendit | thêm self-host, không gỡ KYC          | Loại (thừa)            |


> Xendit là lựa chọn cân bằng nhất cho MY: đủ ví + sub-account API-driven (platform chủ động tạo account) + hosted KYB. Chi tiết so sánh: xem báo cáo research nếu cần.

### Merchant nhận tiền (auto-disburse)

- **Auto-Withdrawal:** Merchant bật trên Xendit Dashboard (cấu hình lịch rút: ngày/tuần/tháng). ECH chỉ hiển thị balance thông tin + hướng dẫn (không tự điều tiền).
- Merchant cần: đăng ký Xendit + **KYB pass (1–5 ngày)** + thêm bank + bật Auto-Withdrawal. Chưa KYB → không nhận tiền.
- Settlement vào số dư: **VA T+0 · ví T+2 · thẻ T+7** → rồi auto-payout ra bank. DuitNow ~RM1.50/lần, 99.9% trong 15 phút.
- Ví dụ đơn RM100 qua TNG → merchant nhận ~RM98.5, ECH thu RM0 (không thu phí giao dịch).

## 4. Architecture (high-level)

```
Buyer ──checkout──> [Next.js storefront]
                         │ POST /api/orders/xendit-checkout
                         ▼
                 POST /v2/invoices (merchant's Secret Key) ──> Xendit
                         │  return invoice_url (hosted checkout)
                         │  (order status=pending, xenditPaymentRequestId saved)
                         ▼
              redirect buyer ──> Xendit hosted checkout page
                               (buyer picks TNG/GrabPay/ShopeePay/DuitNow QR/FPX/Card)
                                          │ buyer pays (PAN/ví KHÔNG qua server ta)
                                          ▼
        Xendit ──webhook (x-callback-token)──> /api/webhooks/xendit
                         │ verify token (merchant's Webhook Token) → reconcileOrderPaid()
                         ▼
              order status='new', payment_status='paid'  (atomic single-winner)
                         ▼
        settlement vào bank merchant ──Auto-Withdrawal (Dashboard config)──> bank merchant
```

**Tái dùng nguyên (0 sửa hành vi):**

- `reconcileOrderPaid()` — `src/lib/payment/reconcile-order-paid.ts` (atomic transition + emails). Tách provider-specific metadata persist.
- `PaymentProvider` interface — `src/lib/payment/types.ts`.

**File mới:** `src/lib/payment/xendit.ts`, `src/app/api/orders/xendit-checkout/route.ts`, `src/app/api/webhooks/xendit/route.ts`.

**Per-tenant config:** `tenant.xenditSecretKey` + `tenant.xenditCallbackToken` (saved từ Settings UI). Dùng key của merchant từng tenant (không cần `for-user-id` header).

## 5. Scope & Roadmap

```
Phase A (API Key connect, 1t) ──▶ Phase B (checkout, 1.5t) ──▶ Phase C (refund, 1t) ──▶ staging
```


| Phase | Tên                           | Nội dung chính                                                                                                                    | Out                   |
| ----- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **A** | API Key Connection            | Settings UI: input Secret Key + Webhook Token; save per-tenant; validate connectivity; show "connected" status                  | KYB form              |
| **B** | Checkout + Webhook            | Invoice API hosted checkout (TNG+GrabPay+ShopeePay+DuitNow QR+FPX+Card); webhook verify token; reconcile → paid               | Saved cards           |
| **C** | Refund + Reconcile            | Refund qua invoice_id; cron reconcile trễ webhook; hiển thị balance + hướng dẫn Auto-Withdrawal                                 | Payout API chủ động   |


### Out of Scope (toàn feature)

- Platform thu phí giao dịch (mô hình pure SaaS — merchant chịu MDR).
- Cash on Delivery (thuộc F19 Manual Methods).
- Lưu thẻ / tokenized re-purchase.
- KYB/onboarding flow (merchant tự đăng ký Xendit).
- Payout API chủ động (dùng Dashboard Auto-Withdrawal).

---

## 6. Functional Requirements

### 6.A — Phase A: API Key Connection

> **Cách làm (KISS):** Merchant tự có Xendit account (KYB trực tiếp với Xendit — ECH không can thiệp). Merchant nhập **Secret Key + Webhook Token** vào ECH Settings → ECH lưu per-tenant. ECH hiển thị "connected" khi có key.

#### Connection status

| Status                | Nghĩa                       | UI ECH hiển thị                    | Checkout? |
| --------------------- | --------------------------- | ---------------------------------- | --------- |
| `NOT_CONNECTED`       | chưa nhập key               | nút "Connect Payment"              | ❌        |
| `CONNECTED`           | đã nhập key, validated      | badge xanh "API key connected"     | ✅        |
| `INVALID` / `EXPIRED` | key hết hạn / sai           | cảnh báo đỏ "Key invalid"          | ❌        |

#### Flow API Key connection (đơn giản)

```
A1. Merchant bấm "Connect Payment" trên ECH Settings
      │
      ▼
A2. Modal form: nhập Secret Key + Webhook Token
      → validate format (not empty)
      │
      ▼
A3. POST /api/payments/xendit-connect
      → validate key (gọi Xendit API test — e.g. GET /account)
      → lưu vào tenant: xenditSecretKey + xenditCallbackToken
      → status = 'CONNECTED'
      │
      ▼
A4. Settings UI hiện "API key connected · Payments active"
      → merchant cấu hình Auto-Withdrawal trên Xendit Dashboard (ngoài ECH)
```

> **Merchant setup trước:** Merchant phải self-signup tại xendit.co, KYB xong, copy Secret Key từ Dashboard → Settings → API Keys.
> **Webhook config:** Merchant tự set webhook URL (`/api/webhooks/xendit`) + Verification Token trên Xendit Dashboard.

| FR       | Mô tả                                                                                                                | Story     |
| -------- | -------------------------------------------------------------------------------------------------------------------- | --------- |
| **A-1**  | "Connect Payment" button trong `settings/payments` cho tenant chưa có `xenditSecretKey`.                             | US-F34-01 |
| **A-2**  | Modal form: Secret Key + Webhook Token input fields (required).                                                      | US-F34-01 |
| **A-3**  | `POST /api/payments/xendit-connect` validate key (gọi Xendit API test); lưu `xenditSecretKey` + `xenditCallbackToken`. | US-F34-01 |
| **A-4**  | Validate error (invalid key / API error) → hiện rõ, không 500 mơ hồ.                                                 | US-F34-01 |
| **A-5**  | Settings UI hiện status: "API key connected" (xanh) / "Not connected" (xám) / "Invalid" (đỏ).                       | US-F34-02 |
| **A-6**  | Merchant có thể update/rotate key vào lúc bất kỳ (form dùng lại).                                                     | US-F34-01 |


### 6.B — Phase B: Checkout + Webhook + Multi-wallet

> Dùng **Invoice API `/v2/invoices`** (dùng Secret Key của merchant per-tenant). 1 API hosted checkout gồm tất cả ví/QR/FPX/card. Webhook event: **Invoice `PAID`** (khi buyer thanh toán).

#### Flow checkout (thành công)

```
B1. Buyer chọn payment method + bấm "Thanh toán"  →  POST /api/orders/xendit-checkout
       │  validate site → tenant có xenditSecretKey  (không → 422 XENDIT_NOT_CONNECTED)
       ▼
B2. Tạo order status=pending + giảm stock (CAS, chống oversell)
       │  tạo invoice trên Xendit (dùng merchant's Secret Key)
       ▼
B3. POST /v2/invoices { external_id, amount (RM), payer_email, description, 
                        success_redirect_url, failure_redirect_url, currency: 'MYR' }
       │  Xendit trả invoice_url (hosted checkout page)
       ├─ redirect buyer sang invoice_url
       │  (buyer tự chọn payment method: TNG/GrabPay/ShopeePay/DuitNow QR/FPX/Card)
       └─ lưu invoice_id → order.xenditPaymentRequestId
       ▼
B4. Buyer trả xong:
       ├─ redirect về success_return_url (UX "cảm ơn")  [không đáng tin 100%]
       └─ Xendit gửi webhook (Invoice PAID) → /api/webhooks/xendit
       ▼
B5. Verify x-callback-token (merchant's xenditCallbackToken) → reconcileOrderPaid() → order = new/paid (atomic, 1 lần)
       │  gửi email xác nhận
       ▼
B6. (self-heal) Confirm page poll trạng thái → nếu webhook trễ/mất mà Xendit đã PAID → reconcile < 30s
```

#### Flow thanh toán KHÔNG thành công

> **Nguyên tắc stock (mirror F13):** stock giảm **upfront** lúc checkout → **giữ chỗ tối đa 24h**. `payment.failure` đơn lẻ **KHÔNG restock ngay** (để buyer thử lại). Chỉ **restock** khi: buyer **huỷ chủ động** HOẶC **hết hạn 24h** (cron). Mọi restock chạy trên path CAS-winning → 0 double-restock.

**Các trường hợp & xử lý:**

| Tình huống | Trigger | Order | Stock | Buyer |
|------------|---------|-------|-------|-------|
| **Thẻ/ví bị từ chối** | webhook `payment.failure` | `payment_status=payment_failed` (GIỮ order, chưa huỷ) | **giữ chỗ** (chưa restock) | hiện lỗi + nút "Thử lại" |
| **Buyer huỷ chủ động** | `POST /api/orders/[id]/cancel-payment` | `status=cancelled`, `payment_status=cancelled` | **restock ngay** | về trang đơn, báo đã huỷ |
| **Buyer bỏ ngang / không trả** | quá `paymentExpiresAt` (24h) → cron payment-expiry | `status=cancelled`, `payment_status=payment_failed`, `cancel_reason='Auto-cancelled 24h'` | **restock** | email order-expired |
| **Lỗi tạo payment request** (ngay checkout) | API Xendit fail | rollback: order pending huỷ | **restock ngay** | báo lỗi, thử lại |
| **Webhook fail đến nhiều lần** | Xendit retry | luôn trả **200** (tránh retry vô hạn) | — | — |

**Flow retry (thử lại sau khi fail):**

```
Buyer bấm "Thử lại" (order còn pending / payment_failed, chưa quá 24h)
   │  guard: order CHƯA terminal (không paid/cancelled/expired)
   ▼
Tạo payment request MỚI trên cùng order  → KHÔNG giảm stock lần nữa (dùng lại chỗ đã giữ)
   ▼
Buyer trả → webhook payment.capture → reconcileOrderPaid() → new/paid
```

> **Vì sao không restock ngay khi `payment.failure`:** ví/QR fail thường là tạm thời (hết tiền, thoát app) — buyer hay thử lại trong vài phút. Restock ngay rồi buyer retry = phải giảm stock lại, dễ kẹt nếu vừa hết hàng. Giữ chỗ 24h là cân bằng giữa "không oversell" và "không chặn buyer retry".


| FR       | Mô tả                                                                                                                                                    | Story     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **B-1**  | `POST /api/orders/xendit-checkout` validate site → tenant → có `xenditSecretKey`; nếu không → 422 `XENDIT_NOT_CONNECTED`.                               | US-F34-04 |
| **B-2**  | Tạo order `pending`, `payment_provider='xendit'`; stock decrement CAS `WHERE inventory >= qty` (chống oversell).                                         | US-F34-04 |
| **B-3**  | `POST /v2/invoices` (dùng merchant's Secret Key): `external_id` (orderId), `amount` (RM major unit), `payer_email`, `description`, `currency: 'MYR'`.    | US-F34-04 |
| **B-4**  | Response: `{ id: "inv-...", invoice_url: "...", status: "PENDING" }` → lưu invoice_id vào `order.xenditPaymentRequestId`.                               | US-F34-04 |
| **B-5**  | Redirect buyer → `invoice_url` (Xendit hosted checkout page). Buyer tự chọn payment method (TNG/GrabPay/ShopeePay/DuitNow QR/FPX/Card — Xendit tự hiện). | US-F34-04 |
| **B-6**  | `POST /api/webhooks/xendit` verify `x-callback-token` (timing-safe, dùng merchant's `xenditCallbackToken`); sai → 401, KHÔNG xử lý.                     | US-F34-06 |
| **B-7**  | Webhook event: Invoice `PAID` → `PaymentWebhookEvent{provider:'xendit', type:'payment_success'}` → `reconcileOrderPaid()`.                              | US-F34-06 |
| **B-8**  | Idempotency: webhook + poll + cron cùng gọi `reconcileOrderPaid()`; atomic single-winner 1 transition.                                                   | US-F34-06 |
| **B-9**  | Persist Xendit metadata sau paid: `xenditPaymentRequestId` (invoice id). Lỗi persist = non-critical, order vẫn paid.                                    | US-F34-06 |
| **B-10** | Confirm page poll self-heal: pending mà Xendit invoice `PAID` → reconcile (mirror F13).                                                                 | US-F34-05 |
| **B-11** | Routing: Xendit khi tenant `CONNECTED` + buyer chọn ví MY; thẻ quốc tế / merchant non-MY → Stripe.                                                     | US-F34-04 |
| **B-12** | (Truyền) Webhook failure (e.g. invoice payment failure từ Xendit) → xử lý theo Phase C flow.                                                            | US-F34-06 |
| **B-13** | `cancel-payment` + `retry-payment` (route F13 sẵn có) hỗ trợ `payment_provider='xendit'`: cancel → cancelled + **restock ngay**; retry → tạo invoice MỚI, **KHÔNG giảm stock lần nữa**. | US-F34-05 |


> **Decision (generalize reconcile):** Tách phần **money-critical** (atomic UPDATE + emails — provider-agnostic) khỏi **persist metadata** (provider-specific). Xendit path lưu `xenditPaymentRequestId`. KHÔNG sửa hành vi Stripe.

### 6.C — Phase C: Refund + Reconcile

> Refund = `/refunds` endpoint (partial/full qua `amount`). Auto-Withdrawal = Dashboard config, không phải API. Settings chỉ hiển thị balance + hướng dẫn.

#### Flow refund (full / partial)

```
Seller bấm "Hoàn tiền" (1 đơn Xendit đã paid)
   │  validate: đã paid? amount ≤ số đã trả? chưa refund full?  (không → 422 NOT_REFUNDABLE)
   ▼
Gọi refund qua invoice_id (dùng merchant's Secret Key)
   ▼
POST /refunds { invoice_id, amount, reason: 'REQUESTED_BY_CUSTOMER' }
   ▼
Order reconcile: payment_status = refunded (full) / partially_refunded (partial)
```

#### Flow reconcile (webhook trễ/mất — self-heal)

```
Cron định kỳ quét order Xendit còn pending quá ngưỡng
   │  hỏi lại trạng thái invoice từ Xendit
   ├─ status: PAID          → reconcileOrderPaid() → new/paid  (bù webhook đã mất)
   └─ status: EXPIRED/FAILED → order cancelled + restock
   (idempotent: chạy nhiều lần không double — atomic single-winner)
```

#### Flow nhận tiền về bank (Auto-Withdrawal)

```
Tiền buyer trả  → settlement vào bank merchant (VA T+0 · ví T+2 · thẻ T+7)
   ▼
Auto-Withdrawal (merchant bật lịch trên Xendit Dashboard)  → tự rút → bank merchant
   ⚠️ Tiền LUÔN ở Xendit → bank merchant. ECH chỉ hiển thị balance thông tin.
```

| FR       | Mô tả                                                                                                                                                    | Story     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **C-1**  | `POST /api/orders/[id]/refund` hỗ trợ `payment_provider='xendit'`: `POST /refunds` (`invoice_id`, `amount`, `reason`); dùng merchant's Secret Key.       | US-F34-07 |
| **C-2**  | Refund partial + full; validate `amount` ≤ paid; chặn khi chưa paid / đã refund full.                                                                   | US-F34-07 |
| **C-3**  | Webhook (if merchant configured) `refund event` hoặc poll: order `payment_status='refunded'`/`partially_refunded`. (MVP: poll on-demand, không webhook). | US-F34-07 |
| **C-4**  | Reconcile cron: pending Xendit quá ngưỡng → `GET /v2/invoices/{id}`; status `PAID` → reconcile; `EXPIRED`/`FAILED` → cancel + restock.                 | US-F34-08 |
| **C-5**  | Payment-expiry cron cover Xendit: invoice expired hoặc quá TTL → order `cancelled`, restock.                                                           | US-F34-08 |
| **C-6**  | Settings UI: hiển thị balance (tính từ Xendit nếu cần) + hướng dẫn bật Auto-Withdrawal trên Xendit Dashboard.                                         | US-F34-09 |
| **C-7**  | Refund API lỗi → log + error code rõ; KHÔNG để order trạng thái sai.                                                                                   | US-F34-07 |

> **Decision (MVP):** Auto-Withdrawal = Dashboard config (0 API). Settings chỉ hiển thị hướng dẫn + balance (nếu merchant cấu hình webhook).

---

## 7. Non-Functional Requirements


| NFR        | Yêu cầu                                                                                                                                                                                   | Mức |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| **NFR-1**  | Webhook verify `x-callback-token` timing-safe (`timingSafeEqual`) trước khi xử lý; chống replay bằng idempotency reconcile.                                                               | P0  |
| **NFR-2**  | Merchant Secret Key + Webhook Token lưu per-tenant (encrypted at rest); không lộ secret trong logs / errors.                                                                             | P0  |
| **NFR-3**  | PCI/PDPA: PAN/ví đi thẳng buyer → Xendit hosted, **0 byte nhạy cảm qua server ECH**. KYB (merchant tự làm với Xendit) → 0 doc nhạy cảm qua server ECH.                                  | P0  |
| **NFR-4**  | Stock decrement atomic CAS — 0 oversell.                                                                                                                                                  | P0  |
| **NFR-5**  | `external_id` = orderId (unique, idempotent tạo invoice).                                                                                                                                 | P0  |
| **NFR-5b** | **Đơn vị tiền:** Invoice API amount = RM (major unit). Order nội bộ lưu sen → **/100 trước gọi Invoice, ×100 khi webhook**. Sai = lệch 100×. Có test chống regression.                       | P0  |
| **NFR-6**  | Refund idempotent: check order status trước; invoice_id unique per refund request.                                                                                                         | P0  |
| **NFR-7**  | Cron reconcile auth bằng cron secret; idempotent (already_processed guard).                                                                                                               | P0  |
| **NFR-8**  | Webhook → order paid p95 < 30s; checkout API p95 < 4s; settings load < 1s.                                                                                                                | P1  |
| **NFR-9**  | Invoice API rate limit per Xendit spec (100 req/s).                                                                                                                                       | P1  |


---

## 8. Acceptance Criteria (GIVEN/WHEN/THEN)

### Phase A

1. GIVEN tenant chưa có `xenditSecretKey` WHEN mở settings/payments THEN thấy "Connect Payment" button.
2. GIVEN bấm Connect WHEN modal form nhập Secret Key + Webhook Token THEN validate (call Xendit test API).
3. GIVEN key valid WHEN submit THEN key + token lưu, status `CONNECTED`, UI hiện badge xanh.
4. GIVEN key invalid WHEN submit THEN error hiện, không lưu, tenant giữ nguyên status.
5. GIVEN đã có key WHEN bấm Connect lần nữa THEN form pre-fill, có thể update/rotate key.
6. GIVEN key hết hạn / sai WHEN checkout THEN 422 `XENDIT_NOT_CONNECTED` (không lộ secret).
7. GIVEN webhook token không match WHEN webhook đến THEN 401, order KHÔNG reconcile.

### Phase B

1. GIVEN merchant `CONNECTED` WHEN buyer checkout THEN order `pending`, stock giảm, nhận invoice_url (redirect).
2. GIVEN merchant chưa `CONNECTED` THEN 422 `XENDIT_NOT_CONNECTED`, KHÔNG tạo order, KHÔNG giảm stock.
3. GIVEN buyer trả TNG thành công WHEN webhook (invoice PAID) THEN order → `new/paid`.
4. GIVEN webhook token sai THEN 401, order KHÔNG đổi.
5. GIVEN webhook đến 2 lần THEN order chỉ transition 1 lần (`already_processed`), KHÔNG email 2 lần.
6. GIVEN stock=1, 2 buyer đồng thời THEN chỉ 1 thành công, buyer kia 409 OUT_OF_STOCK (CAS).
7. GIVEN webhook trễ/mất WHEN buyer poll confirm page THEN self-heal reconcile < 30s (get invoice status).
8. GIVEN tạo invoice lỗi THEN rollback restock; buyer thấy lỗi rõ.
9. GIVEN merchant có cả Stripe + Xendit WHEN buyer chọn FPX THEN route Xendit, KHÔNG double-charge (check routing logic).

### Phase C

1. GIVEN order Xendit `paid` WHEN refund full THEN `POST /refunds` ok, order `refunded`.
2. GIVEN order `paid` RM100 WHEN refund RM40 THEN order `partially_refunded`.
3. GIVEN order chưa paid WHEN refund THEN 422 `NOT_REFUNDABLE`.
4. GIVEN refund đã full WHEN refund lần nữa THEN bị chặn (không double-refund).
5. GIVEN order pending + webhook mất WHEN cron THEN `GET /v2/invoices/{id}` status `PAID` → `new/paid`.
6. GIVEN order pending quá TTL / invoice expired WHEN cron THEN order `cancelled` + restock.
7. GIVEN settings load THEN thấy hướng dẫn Auto-Withdrawal (bật trên Xendit Dashboard).

---

## 9. Cost & Risk

> **Nguồn giá (2026-06-16):** [xendit.co/en-my/pricing](https://www.xendit.co/en-my/pricing/) + Xendit support. **Không có setup fee.**


| Khoản                   | Ai chịu      | Mức thật (MY)                                                                 |
| ----------------------- | ------------ | ----------------------------------------------------------------------------- |
| MDR — thẻ               | **Merchant** | local credit **2.0%** · local debit **1.2%** · foreign **3.0%**               |
| MDR — FPX               | **Merchant** | personal **RM1.20** · corporate **RM2.00**                                    |
| MDR — ví                | **Merchant** | TNG local **1.30%** · GrabPay **1.30%** · ShopeePay **1.30%**                 |
| MDR — Virtual Account   | **Merchant** | **0.50%** (min RM1)                                                           |
| MDR — DuitNow QR        | **Merchant** | `[NEED: hỏi support — không có trên pricing]`                                 |
| Phí rút (DuitNow)       | **Merchant** | **RM1.50/giao dịch**                                                          |
| Dev (1 lần)             | **Platform** | ~2–3 tuần                                                                     |

> **Chi phí ròng platform = dev cost.** MDR/phí rút KHÔNG vào P&L (merchant chịu). Merchant tự gánh Xendit account + KYB (ngoài ECH scope).

### Top risks

1. **Custody pháp lý (merchant's own account):** Tiền vào **bank merchant trực tiếp** (Auto-Withdrawal); ECH chỉ orchestrate, **không cần giấy phép MY**.
2. **Merchant KYB lead time** (merchant self-signup + KYB với Xendit 1–5 ngày) → merchant chưa sẵn sàng không thể checkout (UX phải báo rõ Phase A status).
3. **Key management:** Merchant Secret Key lưu per-tenant, cần encryption at rest + không lộ log/error.
4. **Webhook verify** khác Stripe (`x-callback-token` tĩnh, không HMAC body) → timing-safe compare.
5. **Double-refund:** Check order paid status trước refund.

### ⚠️ NON-CUSTODY GUARDRAILS (pháp lý)

Để platform KHÔNG bị coi là bên giữ tiền (avoid financial license MY):

- ✅ Tiền vào **Xendit sub-account merchant** → **bank merchant** (Auto-Withdrawal).
- ✅ ECH orchestrate (tạo invoice), KHÔNG move/hold/delay tiền.
- ✅ Merchant chịu toàn bộ KYB + compliance với Xendit.
- ❌ KHÔNG dùng Transfers API, KHÔNG để tiền ở master account.

---

## 10. Success Metrics


| Metric                           | Target             | Đo bằng                                      |
| -------------------------------- | ------------------ | -------------------------------------------- |
| Webhook → order paid latency     | p95 < 30s          | log reconcile                                |
| API Key connection success rate  | ≥ 95%              | error log (invalid key / API fail)           |
| Phantom double-pay (idempotency) | 0                  | `reconcileOrderPaid` already_processed count |
| Oversell                         | 0                  | stock CAS audit                              |
| Stripe regression                | 100% pass          | test suite                                   |


---

## 11. Open Questions / [NEED] (technical)

- `[NEED]` **Invoice API spec:** Confirm `amount` in RM (major unit) vs sen. Test POST /v2/invoices với order nhỏ trước (NFR-5b).
- `[NEED]` **Webhook event:** Confirm event type khi invoice paid — "invoice.paid", "payment.succeeded", hay khác?
- `[NEED]` **Refund endpoint:** POST /refunds parameters — `invoice_id` hay `payment_request_id`? Full/partial how?
- `[NEED]` **Reconcile API:** Confirm GET invoice status endpoint path + response format.
- `[NEED]` **DuitNow QR:** Confirm channel_code value cho DuitNow QR method.
- ℹ️ **Decision:** Chọn **Merchant's own Xendit account (Model C)** — đơn giản hơn Model B (managed). Merchant tự KYB, ECH chỉ nhập key.
- ✅ **Invoice API (not Payment Request):** `/v2/invoices` hosted checkout (simpler, bao gồm tất cả ví).

## 12. Xendit Docs

- Xendit API docs: [https://docs.xendit.co](https://docs.xendit.co)
- Invoice API: [https://docs.xendit.co/api-reference#create-invoice](https://docs.xendit.co/api-reference)

