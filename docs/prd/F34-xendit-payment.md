# PRD: Xendit Payment Integration — Malaysia (F34)

> **Version:** 4.0 (Draft — consolidated) | **Updated:** 2026-06-11 | **Owner:** Domin (Product)
> **Priority:** P1 | **Wave:** 7 (sau F13 hardening) | **Size:** XL
> **Depends on:** F13 Payment Gateway ✅ (Stripe + `PaymentProvider` abstraction), F09 Storefront Commerce ✅
> **Provider:** **Xendit (XenPlatform MANAGED)** — đã chốt sau khi loại Stripe (thiếu TNG/DuitNow), Adyen (không support onboard MY), HitPay (onboard thủ công), Hyperswitch (orchestrator thừa).
> **Onboarding:** hosted-redirect (merchant KYB trên trang Xendit) — không tự dựng form KYB.
> **Status:** Draft — technical implementation spec.

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

Tích hợp **Xendit (XenPlatform)** làm cổng thanh toán nội địa MY, **song song Stripe** (không đụng logic Stripe):

- Mỗi merchant = một **MANAGED sub-account** Xendit. Tiền settle **thẳng về merchant**, auto-payout về bank theo lịch.
- Platform **chỉ orchestrate**, không giữ tiền, **không thu phí giao dịch** (custody thuộc Xendit).
- Checkout **hosted** (Xendit Payment Requests): số thẻ/ví đi **thẳng buyer → Xendit**, không qua server ta. Webhook "đã trả" → tái dùng `reconcileOrderPaid()`.
- Routing: ví MY + DuitNow + FPX → Xendit; thẻ quốc tế / merchant ngoài MY → Stripe (giữ nguyên).
- Mở rộng ví khác = bật config, không code lại.

> **Decision (kiến trúc):** Codebase đã có interface `PaymentProvider` (`src/lib/payment/types.ts`) và `PaymentWebhookEvent.provider` đã liệt kê sẵn provider tương lai. Thêm Xendit = **file mới** (`src/lib/payment/xendit*.ts` + `api/xendit/`* + `api/webhooks/xendit/*`), **0 sửa logic Stripe**. Rủi ro kỹ thuật: **thấp**.

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

- **Auto-Withdrawal:** tự quét số dư sub-account về bank merchant theo lịch (ngày/tuần/tháng) — cấu hình trên Xendit Dashboard.
- Merchant cần: đăng ký → **KYB pass (1–5 ngày)** → thêm bank (tên khớp) → bật rút. Chưa KYB → không nhận tiền.
- Settlement vào số dư: **VA T+0 · ví T+2 · thẻ T+7** → rồi auto-payout ra bank. DuitNow ~RM1.50/lần, 99.9% trong 15 phút.
- Ví dụ đơn RM100 qua TNG → merchant nhận ~RM98.5, platform thu RM0 (không thu phí giao dịch).

## 4. Architecture (high-level)

```
Buyer ──checkout──> [Next.js storefront]
                         │ POST /api/orders/xendit-checkout
                         ▼
                 createPaymentRequest() ── for-user-id: xenditAccountId ──> Xendit
                         │  (order status=pending, xenditPaymentRequestId saved)
                         ▼
              redirect buyer ──> Xendit hosted page (card/TNG/GrabPay/DuitNow/FPX)
                                          │ buyer pays (PAN/ví KHÔNG qua server ta)
                                          ▼
        Xendit ──webhook (x-callback-token)──> /api/webhooks/xendit
                         │ verify token → normalize → reconcileOrderPaid()
                         ▼
              order status='new', payment_status='paid'  (atomic single-winner)
                         ▼
        settlement vào số dư sub-account ──Auto-Withdrawal (lịch)──> bank merchant
```

**Tái dùng nguyên (0 sửa hành vi):**

- `reconcileOrderPaid()` — `src/lib/payment/reconcile-order-paid.ts` (atomic transition + emails). Generalize phần persist metadata (hiện Stripe-specific) — xem §6.B.
- `PaymentProvider` interface — `src/lib/payment/types.ts`.

**File mới:** `src/lib/payment/xendit.ts`, `src/app/api/xendit/connect/route.ts`, `src/app/api/orders/xendit-checkout/route.ts`, `src/app/api/webhooks/xendit/route.ts`.

**Routing:** mọi API call cho merchant đính header `**for-user-id: {xenditAccountId}`** → tiền vào sub-account (không cần API key riêng từng merchant).

## 5. Scope & Roadmap

```
Phase A (onboard, 1–2t) ──▶ Phase B (checkout, 2t) ──▶ Phase C (refund/disburse, 1–2t) ──▶ staging
```


| Phase | Tên                           | Nội dung chính                                                                                                                         | Out                   |
| ----- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **A** | Onboarding + KYB              | Tạo MANAGED sub-account qua API; **redirect merchant sang trang hosted Xendit** để claim + KYB; track status qua webhook + settings UI | Tự dựng form KYB      |
| **B** | Checkout + Webhook            | Hosted checkout đa ví (TNG+GrabPay+DuitNow QR+FPX+card); webhook verify (`x-callback-token`); reconcile → paid                         | Saved cards           |
| **C** | Refund + Reconcile + Disburse | Refund qua Xendit; cron reconcile late webhook; Auto-Withdrawal scheduling → bank; đối soát                                            | Multi-currency payout |


### Out of Scope (toàn feature)

- Platform thu phí giao dịch (mô hình pure SaaS — merchant chịu MDR).
- Cash on Delivery (thuộc F19 Manual Methods).
- Lưu thẻ / tokenized re-purchase.
- Đổi mô hình custody (giữ MANAGED — custody thuộc Xendit).

---

## 6. Functional Requirements

### 6.A — Phase A: Onboarding + KYB (HOSTED-REDIRECT — kiểu Stripe Connect)

> **Cách làm (KISS):** Prime tạo MANAGED sub-account qua API rồi **redirect merchant sang trang onboarding hosted của Xendit** để tự làm KYB. Prime **không tự dựng form KYB, không xử lý doc nhạy cảm** — Xendit lo hết (tăng trust, giảm tải build UI). Prime chỉ **theo dõi status qua webhook** và hiển thị badge.
>
> **Mô hình (KHÔNG phải OAuth Stripe Connect):** Xendit không có "merchant đăng nhập account có sẵn rồi authorize app". Platform tạo sub-account → merchant claim + KYB trên trang Xendit. Merchant đã có Xendit account riêng → vẫn tạo sub-account mới (không link được).
>
> ⚠️ **Khác Stripe 1 điểm:** Xendit **KHÔNG có `return_url` auto-redirect ngược** sau khi KYB xong (đã verify — "callback" của Xendit = webhook server-to-server, không phải browser redirect). → Prime **không phụ thuộc auto-redirect**: dùng webhook cập nhật status + trang "đang chờ duyệt" để merchant tự quay lại.

#### Account status lifecycle (Xendit thật)

```
INVITED ──claim+KYB trên Xendit──> REGISTERED → AWAITING_DOCS → PENDING_VERIFICATION ──Xendit duyệt──> LIVE
                                                                                                  └─(từ chối/vi phạm)─> SUSPENDED
```


| Status                                                  | Nghĩa                                  | UI Prime hiển thị                                            | Nhận tiền? |
| ------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------ | ---------- |
| `NOT_CONNECTED`                                         | (nội bộ) chưa tạo account              | nút "Connect Payment"                                        | ❌          |
| `INVITED`                                               | account vừa tạo, chờ merchant onboard  | nút "Tiếp tục onboarding" (mở link Xendit)                   | ❌          |
| `REGISTERED` / `AWAITING_DOCS` / `PENDING_VERIFICATION` | merchant đang/đã nộp KYB, Xendit xử lý | banner "Đang duyệt — 1–5 ngày" + nút mở lại link nếu dở dang | ❌          |
| `LIVE`                                                  | duyệt xong                             | badge xanh, bật checkout                                     | ✅          |
| `SUSPENDED`                                             | bị khoá                                | cảnh báo đỏ, chặn checkout                                   | ❌          |


#### Flow onboarding (hosted-redirect, từng bước)

```
A1. Merchant bấm "Connect Payment" trên Prime dashboard
      │
      ▼
A2. POST /api/xendit/connect
      → POST /v2/accounts { email, type:'MANAGED', public_profile:{ business_name } }
      → lưu xenditAccountId + status='INVITED'
      → CHỜ webhook account.created (BẮT BUỘC trước khi transact)   [Xendit rule]
      → lấy onboarding/invitation URL (unique link) từ response/GET account
      │
      ▼
A3. Redirect merchant → trang onboarding HOSTED của Xendit
      → merchant claim + nộp KYB (doc SSM, IC director, bank...) TRÊN TRANG XENDIT
      → 0 form/doc nhạy cảm qua server Prime
      │
      ▼
A4. Merchant xong KYB trên Xendit (KHÔNG auto-redirect về Prime)
      → merchant tự quay lại Prime, HOẶC Prime gửi email "đã kích hoạt" khi LIVE
      │
      ▼
A5. Webhook cập nhật status realtime:
      account.updated (REGISTERED/AWAITING_DOCS/PENDING_VERIFICATION) → Prime hiện "đang duyệt"
      account.activated → status='LIVE', xenditOnboardingComplete=true → badge xanh, Phase B mở khoá
```

> **Header routing:** mọi call cho merchant đính `for-user-id: {xenditAccountId}`.
> **email field:** bắt buộc khi tạo account — dùng email merchant đã có trong Prime.


| FR       | Mô tả                                                                                                                                                  | Story     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| **A-1**  | "Connect Payment" button trong `settings/payments` cho tenant chưa có `xenditAccountId`.                                                               | US-F34-01 |
| **A-2**  | `POST /api/xendit/connect` gọi `POST /v2/accounts` (MANAGED, `business_name` + `email` từ tenant); lưu `xenditAccountId`, status `INVITED`.            | US-F34-01 |
| **A-3**  | Idempotent: tenant đã có `xenditAccountId` → KHÔNG tạo account mới; chỉ trả onboarding URL + refresh status.                                           | US-F34-01 |
| **A-4**  | Lấy onboarding/invitation URL (unique link) từ Xendit → **redirect merchant sang trang hosted Xendit** để claim + KYB.                                 | US-F34-01 |
| **A-5**  | Set Xendit callback URL (qua `/callback_urls/{type}` hoặc Dashboard) trỏ về `/api/webhooks/xendit`.                                                    | US-F34-03 |
| **A-6**  | Webhook `account.created` → đánh dấu sẵn sàng transact (chưa LIVE).                                                                                    | US-F34-03 |
| **A-7**  | Webhook `account.updated` (`REGISTERED`/`AWAITING_DOCS`/`PENDING_VERIFICATION`/`SUSPENDED`) → cập nhật `xenditAccountStatus`.                          | US-F34-03 |
| **A-8**  | Webhook `account.activated` → status `LIVE`, `xenditOnboardingComplete=true`.                                                                          | US-F34-03 |
| **A-9**  | Settings UI map status → 4 trạng thái: chưa connect / tiếp tục onboarding / đang duyệt / LIVE; SUSPENDED → cảnh báo đỏ. Không phụ thuộc auto-redirect. | US-F34-02 |
| **A-10** | `GET /api/xendit/connect/status` đọc status (cached); refresh on-demand gọi `GET /v2/accounts/{id}`.                                                   | US-F34-02 |
| **A-11** | Xendit API lỗi → log + error code rõ (`XENDIT_CONNECT_FAILED`), không lộ secret, tenant không kẹt trạng thái sai.                                      | US-F34-01 |


### 6.B — Phase B: Checkout + Webhook + Multi-wallet

> Dùng **Payment Requests `/v3/payment_requests`** (KHÔNG dùng Invoice API legacy). 1 API gói tất cả ví/QR/FPX/card. Webhook events: `**payment.capture` / `payment.authorization` / `payment.failure**`.

#### Flow checkout (thành công)

```
B1. Buyer chọn ví/thẻ + bấm "Thanh toán"  →  POST /api/orders/xendit-checkout
       │  validate site → tenant status = LIVE  (không → 422 XENDIT_NOT_READY)
       ▼
B2. Tạo order status=pending + giảm stock (CAS, chống oversell)
       │  tạo payment request trên sub-account (for-user-id)
       ▼
B3. Rẽ nhánh theo phương thức:
       ├─ Ví/Thẻ/FPX (REDIRECT)  → redirect buyer sang trang Xendit trả tiền
       └─ DuitNow QR (PRESENT)   → hiển thị QR, buyer quét, ở lại trang
       │  (PAN/ví KHÔNG qua server Prime)
       ▼
B4. Buyer trả xong:
       ├─ redirect về success_return_url (UX "cảm ơn")  [không đáng tin 100%]
       └─ Xendit gửi webhook payment.capture → /api/webhooks/xendit
       ▼
B5. Verify x-callback-token → reconcileOrderPaid() → order = new/paid (atomic, 1 lần)
       │  gửi email xác nhận
       ▼
B6. (self-heal) Confirm page poll trạng thái → nếu webhook trễ/mất mà Xendit đã SUCCEEDED → reconcile < 30s
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
| **B-1**  | `POST /api/orders/xendit-checkout` validate site → tenant → status `LIVE`; nếu không → 422 `XENDIT_NOT_READY`.                                           | US-F34-04 |
| **B-2**  | Tạo order `pending`, `payment_provider='xendit'`; stock decrement CAS `WHERE inventory >= qty` (chống oversell).                                         | US-F34-04 |
| **B-3**  | `createPaymentRequest()` → `POST /v3/payment_requests` header `for-user-id`; lưu `xenditPaymentRequestId`; xử lý `actions`.                              | US-F34-04 |
| **B-4**  | Channel: **TOUCHNGO, GRABPAY, SHOPEEPAY (EWALLET); DuitNow QR (QR_CODE); FPX; CARDS** (`channel_code` theo Channel Data Finder MY).                      | US-F34-04 |
| **B-5**  | Method enabled build từ config tenant/site (mirror `buildPaymentMethodTypes`); rỗng → 422 `NO_PAYMENT_METHODS`.                                          | US-F34-05 |
| **B-6**  | `POST /api/webhooks/xendit` verify `x-callback-token` (timing-safe); sai → 401, KHÔNG xử lý.                                                             | US-F34-06 |
| **B-7**  | Webhook normalize `payment.capture`/`payment.authorization` → `PaymentWebhookEvent{provider:'xendit', type:'payment_success'}` → `reconcileOrderPaid()`. | US-F34-06 |
| **B-8**  | Idempotency: webhook + poll + cron cùng gọi `reconcileOrderPaid()`; atomic single-winner 1 transition.                                                   | US-F34-06 |
| **B-9**  | Persist Xendit metadata sau paid: `xenditPaymentRequestId`, channel_code. Lỗi persist = non-critical, order vẫn paid.                                    | US-F34-06 |
| **B-10** | Confirm page poll self-heal: pending mà Xendit `SUCCEEDED` → reconcile (mirror F13).                                                                     | US-F34-05 |
| **B-11** | Routing: Xendit khi tenant `LIVE` + buyer chọn ví MY; thẻ quốc tế / merchant non-MY → Stripe.                                                            | US-F34-04 |
| **B-12** | Webhook `payment.failure` → order failed/pending; return 200 (tránh retry vô hạn); cron Phase C dọn.                                                     | US-F34-06 |
| **B-13** | `cancel-payment` + `retry-payment` (route F13 sẵn có) hỗ trợ `payment_provider='xendit'`: cancel → cancelled + **restock ngay**; retry → tạo payment request MỚI, **KHÔNG giảm stock lần nữa**. | US-F34-05 |


> **Decision (generalize reconcile):** Tách phần **money-critical** (atomic UPDATE + emails — provider-agnostic) khỏi **persist metadata** (provider-specific). Xendit path lưu `xenditPaymentRequestId` + channel_code. KHÔNG sửa hành vi Stripe.

### 6.C — Phase C: Refund + Reconcile + Auto-disburse

> Refund = `**POST /refunds`** (`amount` partial, `reason`); webhook `**refund.succeeded`/`refund.failed**`. Payout = `**POST /v2/payouts**` với header `**Idempotency-key**`. Balance = `**GET /balance**`. Auto-Withdrawal lập lịch = cấu hình Xendit Dashboard (per sub-account), KHÔNG phải API.

#### Flow refund (full / partial)

```
Seller bấm "Hoàn tiền" (1 đơn Xendit đã paid)
   │  validate: đã paid? amount ≤ số đã trả? chưa refund full?  (không → 422 NOT_REFUNDABLE)
   ▼
Gọi refund trên sub-account (full = bỏ amount · partial = truyền amount)
   ▼
Webhook refund.succeeded  → order payment_status = refunded (full) / partially_refunded (partial)
Webhook refund.failed     → giữ nguyên + báo lỗi cho seller
```

#### Flow reconcile (webhook trễ/mất — self-heal)

```
Cron định kỳ quét order Xendit còn pending quá ngưỡng
   │  hỏi lại trạng thái payment request từ Xendit
   ├─ SUCCEEDED       → reconcileOrderPaid() → new/paid  (bù webhook đã mất)
   └─ FAILED/expired  → order cancelled + restock
   (idempotent: chạy nhiều lần không double — atomic single-winner)
```

#### Flow nhận tiền về bank (disburse)

```
Tiền buyer trả  → settlement vào số dư sub-account merchant (VA T+0 · ví T+2 · thẻ T+7)
   ▼
Auto-Withdrawal (lịch merchant bật trên Xendit Dashboard)  → tự rút số dư → bank merchant
   │  (MVP: Dashboard-config, KHÔNG cần code)
   └─ (optional) Prime gọi payout chủ động → rút thẳng sub-account → bank  [Idempotency-key chống double]
   ⚠️ Tiền LUÔN ở sub-account merchant → bank merchant. KHÔNG qua master (xem NON-CUSTODY GUARDRAILS).
```


| FR       | Mô tả                                                                                                                                                                       | Story     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **C-1**  | `POST /api/orders/[id]/refund` hỗ trợ `payment_provider='xendit'`: `POST /refunds` (`payment_request_id`, `amount`, `reason`) header `for-user-id`; lưu refund id + status. | US-F34-07 |
| **C-2**  | Refund partial + full; validate `amount` ≤ paid; chặn khi chưa paid / đã refund full.                                                                                       | US-F34-07 |
| **C-3**  | Webhook `refund.succeeded`/`refund.failed` → order `payment_status='refunded'`/`partially_refunded`.                                                                        | US-F34-07 |
| **C-4**  | Reconcile cron: pending Xendit quá ngưỡng → `getPaymentRequest()`; `SUCCEEDED` → reconcile; `FAILED`/expired → cancel + restock.                                            | US-F34-08 |
| **C-5**  | Payment-expiry cron cover Xendit: `payment.failure` hoặc quá TTL → order `cancelled`, restock.                                                                              | US-F34-08 |
| **C-6**  | Settings UI: hiển thị balance (`GET /balance` + `for-user-id`) + hướng dẫn bật Auto-Withdrawal trên Dashboard.                                                              | US-F34-09 |
| **C-7**  | (Optional) `POST /api/xendit/payout` payout chủ động: `POST /v2/payouts` header `Idempotency-key` + `channel_code` + `for-user-id`.                                         | US-F34-09 |
| **C-8**  | Hiển thị balance + (nếu dùng) lịch sử payout (read-only từ Xendit).                                                                                                         | US-F34-09 |
| **C-9**  | Payout chủ động: validate bank `channel_code` hợp lệ (`get-payout-channels` MY) + amount ≤ balance.                                                                         | US-F34-09 |
| **C-10** | Refund/payout API lỗi → log + error code rõ; KHÔNG để order/payout trạng thái sai (idempotency-key chống double).                                                           | US-F34-07 |


> **Decision:** MVP dùng **Auto-Withdrawal Dashboard-config** (ít code, giữ "platform không giữ/không tự điều tiền"). API `/v2/payouts` chỉ làm nếu cần payout chủ động — optional.

---

## 7. Non-Functional Requirements


| NFR        | Yêu cầu                                                                                                                                                                                       | Mức |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| **NFR-1**  | Webhook verify `x-callback-token` timing-safe (`timingSafeEqual`) trước khi xử lý; chống replay bằng idempotency reconcile.                                                                   | P0  |
| **NFR-2**  | Secrets ở Vercel Dashboard: `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`; thêm `.env.staging.example` + `.env.production.example`.                                                             | P0  |
| **NFR-3**  | PCI/PDPA: PAN/ví đi thẳng buyer → Xendit hosted, **0 byte nhạy cảm qua server ta**. KYB doc merchant nộp **trên trang hosted Xendit** → 0 doc nhạy cảm qua server Prime (PDPA nhẹ).           | P0  |
| **NFR-4**  | Stock decrement atomic CAS — 0 oversell.                                                                                                                                                      | P0  |
| **NFR-5**  | `reference_id` = orderId (unique cho CARDS); idempotent tạo payment_request.                                                                                                                  | P0  |
| **NFR-5b** | **Đơn vị tiền:** Xendit MYR = RM (major unit), Stripe MYR = sen. Order nội bộ lưu sen → **/100 trước khi gọi Xendit, ×100 khi đối chiếu webhook**. Sai = lệch 100×. Có test chống regression. | P0  |
| **NFR-6**  | Refund + payout idempotent: payout dùng `Idempotency-key`; refund check status order trước.                                                                                                   | P0  |
| **NFR-7**  | Cron reconcile auth bằng cron secret; idempotent (already_processed guard).                                                                                                                   | P0  |
| **NFR-8**  | Webhook → order paid p95 < 30s; checkout API p95 < 4s; settings load < 1s (cached status).                                                                                                    | P1  |
| **NFR-9**  | Rate limit `/v2/accounts` ≤ 5 write/s (spec).                                                                                                                                                 | P1  |


---

## 8. Acceptance Criteria (GIVEN/WHEN/THEN)

### Phase A

1. GIVEN tenant chưa có `xenditAccountId` WHEN mở settings/payments THEN thấy "Connect Payment".
2. GIVEN bấm Connect WHEN `POST /v2/accounts` ok THEN `xenditAccountId` lưu, status `INVITED`, nhận onboarding URL.
3. GIVEN đã có `xenditAccountId` WHEN bấm Connect lần nữa THEN KHÔNG tạo account mới (idempotent), chỉ trả onboarding URL + status.
4. GIVEN có onboarding URL WHEN merchant tiếp tục THEN **redirect sang trang hosted Xendit** để claim + KYB (0 form/doc qua server Prime).
5. GIVEN webhook `account.created` THEN account sẵn sàng transact (chưa LIVE).
6. GIVEN merchant đang/đã nộp KYB trên Xendit WHEN `account.updated` THEN status (`REGISTERED`/`AWAITING_DOCS`/`PENDING_VERIFICATION`) cập nhật, UI hiện "đang duyệt 1–5 ngày".
7. GIVEN webhook `account.activated` THEN status `LIVE`, `xenditOnboardingComplete=true`, badge xanh.
8. GIVEN merchant rời Xendit giữa chừng (không auto-redirect) WHEN quay lại Prime THEN settings hiện đúng status từ webhook + nút mở lại onboarding URL.
9. GIVEN webhook `x-callback-token` sai THEN 401, KHÔNG cập nhật tenant.
10. GIVEN `account.suspended` THEN status `SUSPENDED`, cảnh báo đỏ, Phase B chặn checkout.
11. GIVEN `XENDIT_SECRET_KEY` chưa set WHEN connect THEN config error rõ, không 500 mơ hồ.

### Phase B

1. GIVEN merchant `LIVE` WHEN buyer checkout THEN order `pending`, stock giảm, nhận redirect URL / QR.
2. GIVEN merchant chưa `LIVE` THEN 422 `XENDIT_NOT_READY`, KHÔNG tạo order, KHÔNG giảm stock.
3. GIVEN buyer trả TNG thành công WHEN `payment.capture` THEN order → `new/paid`.
4. GIVEN webhook token sai THEN 401, order KHÔNG đổi.
5. GIVEN webhook đến 2 lần THEN order chỉ transition 1 lần (`already_processed`), KHÔNG email 2 lần.
6. GIVEN stock=1, 2 buyer đồng thời THEN chỉ 1 thành công, buyer kia 409 OUT_OF_STOCK (CAS).
7. GIVEN DuitNow QR (`PRESENT_TO_CUSTOMER`) WHEN paid THEN channel_code persist đúng.
8. GIVEN webhook trễ/mất WHEN buyer poll confirm page THEN self-heal reconcile < 30s.
9. GIVEN tenant tắt hết payment method THEN 422 `NO_PAYMENT_METHODS`.
10. GIVEN tạo payment_request lỗi THEN rollback restock; buyer thấy lỗi rõ.
11. GIVEN merchant có cả Stripe + Xendit WHEN buyer chọn FPX THEN route đúng provider, KHÔNG double-charge.

### Phase C

1. GIVEN order Xendit `paid` WHEN refund full THEN `POST /refunds` ok, order `refunded`.
2. GIVEN order `paid` RM100 WHEN refund RM40 THEN order `partially_refunded`.
3. GIVEN order chưa paid WHEN refund THEN 422 `NOT_REFUNDABLE`.
4. GIVEN refund đã full WHEN refund lần nữa THEN bị chặn (không double-refund).
5. GIVEN webhook `refund.succeeded` THEN order `payment_status` cập nhật đúng.
6. GIVEN order pending + webhook mất WHEN cron THEN `getPaymentRequest()` `SUCCEEDED` → `new/paid`.
7. GIVEN order pending quá TTL / `payment.failure` WHEN cron THEN order `cancelled` + restock.
8. GIVEN settings load THEN thấy balance + hướng dẫn Auto-Withdrawal.
9. GIVEN payout amount > balance THEN reject.
10. GIVEN payout cùng `Idempotency-key` gọi 2× THEN chỉ 1 payout.

---

## 9. Cost & Risk

> **Nguồn giá (2026-06-10):** [xendit.co/en-my/pricing](https://www.xendit.co/en-my/pricing/) + support Xendit. **Không có setup fee.**


| Khoản                       | Ai chịu      | Mức thật (MY)                                                                 |
| --------------------------- | ------------ | ----------------------------------------------------------------------------- |
| MDR — thẻ                   | **Merchant** | local credit **2.0%** · local debit **1.2%** · foreign **3.0%**               |
| MDR — FPX                   | **Merchant** | personal **RM1.20** · corporate **RM2.00**                                    |
| MDR — ví                    | **Merchant** | TNG local **1.30%** (foreign 1.70%) · GrabPay **1.30%** · ShopeePay **1.30%** |
| MDR — Virtual Account       | **Merchant** | **0.50%** (min RM1)                                                           |
| MDR — DuitNow QR            | **Merchant** | `[NEED: hỏi support — không có trên trang pricing]`                           |
| Phí rút (DuitNow payout)    | **Merchant** | **RM1.50/giao dịch**                                                          |
| **XenPlatform account fee** | **Platform** | **RM7.50 / active account / tháng** ⚠️                                        |
| In-house transfer fee       | Platform     | 0.50% (cap RM3) — chỉ khi chuyển nội bộ (ít dùng)                             |
| Dev (1 lần)                 | Platform     | ~3–6 tuần                                                                     |


> ⚠️ **Chi phí ròng platform = RM7.50 × số merchant active/tháng + dev.** 10.000 merchant active = RM75.000/tháng. Cần làm rõ "active" = có giao dịch hay chỉ tồn tại (hỏi support). MDR/phí rút KHÔNG vào P&L (merchant chịu).

### Top risks

1. **Custody pháp lý (MANAGED):** **Xendit/Payex PLT** (BNM-licensed Merchant Acquiring) giữ tiền trong **balance sub-account merchant**; platform = orchestrator, **không cần giấy phép MY**.
2. **KYB lead time** (merchant KYB trên trang Xendit + Xendit duyệt 1–5 ngày) → merchant chưa LIVE không nhận tiền (UX phải báo rõ từng bước).
3. **Webhook verify** khác Stripe (`x-callback-token` tĩnh, không HMAC body) → replay/spoof guard.
4. **Generalize `reconcileOrderPaid`** phá Stripe → tách provider path; full Stripe suite trước merge.
5. **Channel_code FPX/DuitNow MY sai** → tra Channel Data Finder MY; spike đầu Phase B.
6. **Double-refund / double-payout** → check status order trước + `Idempotency-key`.

### ⚠️ NON-CUSTODY GUARDRAILS (pháp lý — bắt buộc)

Để platform KHÔNG bị coi là bên giữ tiền (tránh cần giấy phép tài chính MY):

- ❌ **KHÔNG dùng Transfers API** chuyển tiền giữa account (rủi ro cao nhất).
- ❌ **KHÔNG để tiền vào balance master** rồi mới disburse — tiền phải ở sub-account merchant.
- ❌ **KHÔNG hold/freeze/delay** balance sub-account.
- ✅ Payout = Xendit Auto-Withdrawal (Dashboard) HOẶC `/v2/payouts` rút thẳng sub-account → bank merchant; KHÔNG qua master.

---

## 10. Success Metrics


| Metric                           | Target             | Đo bằng                                      |
| -------------------------------- | ------------------ | -------------------------------------------- |
| Webhook → order paid latency     | p95 < 30s          | log reconcile                                |
| KYB pass rate merchant onboard   | ≥ 80% trong 5 ngày | Xendit dashboard                             |
| Phantom double-pay (idempotency) | 0                  | `reconcileOrderPaid` already_processed count |
| Oversell                         | 0                  | stock CAS audit                              |
| Stripe regression                | 100% pass          | test suite                                   |


---

## 11. Open Questions / [NEED] (technical)

- `[NEED]` **Onboarding URL field chính xác** trong response `POST /v2/accounts` (hoặc `GET /v2/accounts/{id}`) để redirect merchant — xác nhận tên field (`invitation_url`?) + cách lấy lại link nếu merchant làm dở.
- `[NEED]` `account.updated` callback có field `status` cho từng transition (`REGISTERED`/`AWAITING_DOCS`/`PENDING_VERIFICATION`) hay event riêng.
- `[NEED]` Channel_code chính xác FPX + DuitNow QR ở MY (Channel Data Finder). TNG=`TOUCHNGO`, GrabPay=`GRABPAY`, ShopeePay=`SHOPEEPAY`, card=`CARDS` đã rõ.
- `[NEED]` Xác nhận `request_amount` cho MYR là **RM (major unit)** hay sen — test sandbox 1 đơn nhỏ trước (NFR-5b). Sai = lệch 100×.
- `[NEED]` Cách set callback URL: API `/callback_urls/{type}` hay Dashboard config.
- `[NEED]` `orders.payment_status` đã có `partially_refunded` chưa (xác nhận F13 schema).
- `[NEED]` Auto-Withdrawal: MY MANAGED bật được trên Dashboard sub-account (vs cần platform API).
- ℹ️ **Quyết định:** chọn **hosted-redirect** (merchant KYB trên trang Xendit) thay vì embedded Verification API — đơn giản hơn, Xendit lo KYB UI + doc nhạy cảm. Đánh đổi: **KHÔNG có auto-redirect ngược** (đã verify) → xử lý bằng webhook + trang "đang chờ duyệt".
- ✅ Invoice API vs Payment Request: dùng Payment Requests `/v3/payment_requests` (Invoice API legacy).

## 12. xenPlatform Docs

- xenPlatform docs: [https://docs.xendit.co/llms.txt](https://docs.xendit.co/llms.txt)

