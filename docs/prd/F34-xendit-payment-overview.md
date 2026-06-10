# PRD: Xendit Payment Integration — Malaysia (F34) — OVERVIEW

> **Version:** 1.0 (Draft) | **Created:** 2026-06-10 | **Owner:** Domin (Product)
> **Priority:** P1 | **Wave:** 7 (sau F13 hardening) | **Size:** XL (per-sprint)
> **Depends on:** F13 Payment Gateway ✅ (Stripe + `PaymentProvider` abstraction), F09 Storefront Commerce ✅
> **Business source:** `[docs/business/payment-xendit-one-page.md](../business/payment-xendit-one-page.md)`
> **MY Ref:** `[docs/malaysia-market-context.md](../malaysia-market-context.md)` — §4 Payment Landscape
> **Status:** Draft — chờ Phase 0 (Xendit sales: giá MY + custody) trước khi build Sprint 1.

---

> [!IMPORTANT]
> Đây là **overview PRD**. Mỗi sprint có file PRD riêng đầy đủ:
>
> - [F34 Sprint 1 — Merchant Onboarding (MANAGED sub-account) + KYB](./F34-xendit-payment-sprint1.md)
> - [F34 Sprint 2 — Checkout + Webhook + Multi-wallet](./F34-xendit-payment-sprint2.md)
> - [F34 Sprint 3 — Refund + Reconcile + Auto-disburse](./F34-xendit-payment-sprint3.md)

---

## 1. Problem Statement

- Stripe MY **không** hỗ trợ ví nội địa MY. **Touch 'n Go (TNG) ~62% thị phần** ví điện tử → thiếu TNG = mất phần lớn buyer ưa ví.
- TNG không có kết nối kiểu Stripe Connect → phải qua provider đã có sẵn rail TNG.
- Hiện codebase chỉ có 1 provider (Stripe Connect Direct Charges). Buyer MY muốn TNG/GrabPay/DuitNow QR/FPX không có đường nào.
- Platform là **pure SaaS** (doanh thu từ phí gói thuê bao), KHÔNG thu phí giao dịch → cần mô hình tiền **settle thẳng về merchant**, platform chỉ orchestrate, không giữ tiền.

## 2. Target User

- **Buyer (Persona C):** thích TNG/GrabPay/DuitNow QR hơn thẻ; mobile-first.
- **SME Owner (Persona A):** muốn tối đa payment options để không mất sale; nhận tiền tự động về bank, không phải đối soát thủ công.
- **Platform (BOD/Finance):** kiểm soát chi phí sub-account/tháng; không gánh phí giao dịch vào P&L.

## 3. Solution Overview

Tích hợp **Xendit (XenPlatform)** làm cổng thanh toán nội địa MY, **song song Stripe** (không đụng logic Stripe):

- Mỗi merchant = một **MANAGED sub-account** Xendit. Tiền settle **thẳng về merchant**, auto-payout về bank theo lịch.
- Platform **chỉ orchestrate**, không giữ tiền, **không thu phí giao dịch** (custody thuộc Xendit — *đang xác nhận Phase 0*).
- Checkout **hosted** (Xendit Invoice/Payment): số thẻ/ví đi **thẳng buyer → Xendit**, không qua server ta. Webhook "đã trả" → tái dùng `reconcileOrderPaid()`.
- Routing: ví MY + DuitNow + FPX → Xendit; thẻ quốc tế / merchant ngoài MY → Stripe (giữ nguyên).
- Mở rộng ví khác = bật config, không code lại.

> **Decision (kiến trúc):** Codebase đã có interface `PaymentProvider` (`src/lib/payment/types.ts`) và `PaymentWebhookEvent.provider` đã liệt kê sẵn provider tương lai. Thêm Xendit = **file mới** (`src/lib/payment/xendit*.ts` + `api/xendit/`* + `api/webhooks/xendit/*`), **0 sửa logic Stripe**. Rủi ro kỹ thuật: **thấp**.

## 4. Scope (toàn feature, chia 3 sprint)


| Sprint                           | Tên                           | Nội dung chính                                                                                                              | Out                   |
| -------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **0 (precondition, không code)** | Sales + Legal                 | Chốt giá MY, custody, payout, KYB SLA + ký DPA                                                                              | —                     |
| **1**                            | Onboarding + KYB              | Tạo MANAGED sub-account qua API; merchant verify qua email-invite + Xendit Dashboard; track status qua webhook; settings UI | KYB form tự build     |
| **2**                            | Checkout + Webhook            | Hosted checkout đa ví (TNG+GrabPay+DuitNow QR+FPX+card); webhook verify (`x-callback-token`); reconcile → paid              | Saved cards           |
| **3**                            | Refund + Reconcile + Disburse | Refund qua Xendit; cron reconcile late webhook; Auto-Withdrawal scheduling → bank; đối soát                                 | Multi-currency payout |


### Out of Scope (toàn feature)

- Platform thu phí giao dịch (mô hình pure SaaS — merchant chịu MDR).
- Cash on Delivery (thuộc F19 Manual Methods).
- Lưu thẻ / tokenized re-purchase.
- Đổi mô hình custody (giữ MANAGED — custody thuộc Xendit).

## 5. Architecture (high-level)

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

**Tái dùng nguyên (0 sửa):**

- `reconcileOrderPaid()` — `src/lib/payment/reconcile-order-paid.ts` (atomic transition + emails). Cần generalize phần persist metadata (hiện Stripe-specific) — xem Sprint 2 FR.
- `PaymentProvider` interface — `src/lib/payment/types.ts`.

**File mới (xem từng sprint):** `src/lib/payment/xendit.ts`, `xendit-client.ts`, `src/app/api/xendit/onboard/route.ts`, `src/app/api/orders/xendit-checkout/route.ts`, `src/app/api/webhooks/xendit/route.ts`.

**Schema mới (migrations trong `scripts/db-setup.js`):**

- `tenants`: `xendit_account_id`, `xendit_account_status` (INVITED→REGISTERED→AWAITING_DOCS→PENDING_VERIFICATION→LIVE/SUSPENDED), `xendit_onboarding_complete`.
- `orders`: `payment_provider` (discriminator), `xendit_payment_request_id`, `xendit_channel_code`, `xendit_refund_id`.

## 6. Cost & Risk (tóm tắt — chi tiết ở one-pager)

> **Nguồn giá (2026-06-10):** [xendit.co/en-my/pricing](https://www.xendit.co/en-my/pricing/) + support Xendit. **Không có setup fee** — chỉ tính trên giao dịch hoàn tất.


| Khoản                       | Ai chịu            | Mức thật (MY)                                                                 |
| --------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| MDR — thẻ                   | **Merchant**       | local credit **2.0%** · local debit **1.2%** · foreign **3.0%**               |
| MDR — FPX                   | **Merchant**       | personal **RM1.20** · corporate **RM2.00**                                    |
| MDR — ví                    | **Merchant**       | TNG local **1.30%** (foreign 1.70%) · GrabPay **1.30%** · ShopeePay **1.30%** |
| MDR — Virtual Account       | **Merchant**       | **0.50%** (min RM1)                                                           |
| MDR — DuitNow QR            | **Merchant**       | `[NEED: không có trên trang pricing — hỏi support]`                           |
| Phí rút (DuitNow payout)    | **Merchant**       | **RM1.50/giao dịch**                                                          |
| **XenPlatform account fee** | **Platform (bạn)** | **RM7.50 / active account / tháng** ⚠️                                        |
| In-house transfer fee       | Platform           | 0.50% (cap RM3) — chỉ khi chuyển nội bộ giữa account (ít dùng)                |
| Dev (1 lần)                 | Platform           | ~3–6 tuần                                                                     |


> ⚠️ **Chi phí ròng platform = RM7.50 × số merchant active/tháng + dev.** Cao hơn cả mức cao one-pager đoán (RM6.50). **10.000 merchant active = RM75.000/tháng.** Cần làm rõ "active" = có giao dịch hay chỉ cần tồn tại (hỏi support — xem reply nháp). MDR/phí rút KHÔNG vào P&L (merchant chịu).

**Top risks (chi tiết ở từng sprint):**

1. **Custody pháp lý (MANAGED)** — [research](../plans/reports/researcher-260610-1541-xendit-managed-custody.md): **Xendit/Payex PLT** (BNM-licensed Merchant Acquiring) giữ tiền trong **balance sub-account merchant**; platform = orchestrator, **không cần giấy phép MY**. Cần Xendit legal xác nhận văn bản (Phase 0). **Design rule giữ vị thế: KHÔNG dùng Transfers API, KHÔNG giữ tiền ở master, KHÔNG hold balance.**
2. KYB lead time (email-invite + Dashboard) → merchant chưa LIVE không nhận tiền (UX phải báo rõ).
3. Webhook verify khác Stripe (`x-callback-token` tĩnh, không HMAC body) → replay/spoof guard.

## 7. Success Metrics (toàn feature)


| Metric                           | Target             | Đo bằng                                      |
| -------------------------------- | ------------------ | -------------------------------------------- |
| Webhook → order paid latency     | p95 < 30s          | log reconcile                                |
| KYB pass rate merchant onboard   | ≥ 80% trong 5 ngày | Xendit dashboard                             |
| Phantom double-pay (idempotency) | 0                  | `reconcileOrderPaid` already_processed count |


## 8. Roadmap & Dependencies

```
Phase 0 (sales/DPA, 1–2 tuần) ──MUST DONE──▶ Sprint 1 (onboard, 1–2t) ──▶ Sprint 2 (checkout, 2t) ──▶ Sprint 3 (refund/disburse, 1–2t) ──▶ staging
```

- Phase 0 (Phê duyệt + sales Xendit + DPA) **phải xong** trước Sprint 1.
- Nhân sự: 1 fullstack-developer + 1 QA.
- BOD decisions cần duyệt: xem one-pager §"Quyết định cần duyệt" (4 mục).

## 9. Open Questions / [NEED]

- ✅ ~~Phí sub-account MY/tháng~~ — GIẢI QUYẾT: **RM7.50/active account/tháng** (pricing MY). Còn cần làm rõ định nghĩa "active".
- `[NEED]` DuitNow QR MDR (không có trên trang pricing) — hỏi support.
- ⚠️ Custody MANAGED ([research](../plans/reports/researcher-260610-1541-xendit-managed-custody.md)): Xendit/Payex giữ tiền, platform không cần license MY. **Cần Xendit legal xác nhận VĂN BẢN:** (a) tiền vào sub-account merchant (KHÔNG master); (b) platform = orchestrator không phải custodian; (c) DPA ghi rõ custody + AML/KYC. Support reply generic ("your balance→your bank") chưa phân biệt master vs sub-account → phải làm rõ.
- `[NEED]` Baseline checkout success rate hiện tại (analytics) để đặt target.
- ✅ Pháp nhân MY: **đã có** (xác nhận 2026-06-10) — đủ điều kiện đăng ký Xendit MY.
- ✅ ~~Invoice API vs Payment Request~~ — GIẢI QUYẾT: dùng Payment Requests `/v 3/payment_requests` (Invoice API là legacy).

## 10. Sandbox Secret Keys:

- Public key: xnd_public_development_nGCH4_676vd9MDGL8yEqDRJDn8UGaVWOKfP7UW3eYQ49r2DysTPxQ8p4Q3TXom4R
- Secret key: xnd_development_1c0bE6IF5NtK6mDYkjXv0TostFnZlpZ51IipqZGRCekuIot7p3UWUqe4husJE0D
- Webhook token: ZbezuvL0e0QSrKmA9k50wFOBOisfjExbblLIahtgpim66S71
- xenPlatform docs: [https://docs.xendit.co/llms.txt](https://docs.xendit.co/llms.txt)