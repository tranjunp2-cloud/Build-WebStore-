# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F13 - Payment Gateway (Malaysia)
> **Phiên bản:** 1.0 | **Cập nhật:** 2026-03-26 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F13-payment-gateway.md`), Stripe Integration (`src/lib/payment/stripe.ts`), Payment Types (`src/lib/payment/types.ts`), Checkout Flow (`src/lib/storefront/checkout.ts`)
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin Expectations), Malaysia Market Compliance (MYR/FPX/SST), Security PCI-DSS Context, Webhook Integrity Validators, Stripe Test Mode Automation.

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này được xây dựng nhằm đảm bảo chất lượng toàn diện cho **Payment Gateway (F13)** — hệ thống thanh toán tích hợp Stripe Connect (Direct Charges model) phục vụ thị trường Malaysia. Mục tiêu cốt lõi:

- **Checkout conversion > 50%** — flow thanh toán mượt mà, không rào cản thừa
- **Payment failure rate < 5%** — xử lý lỗi graceful, retry mechanism
- **PCI Compliance** — zero card data stored server-side, Stripe Checkout hosted
- **Webhook reliability 100%** — signature verification, idempotent event handling
- **Malaysia market**: MYR currency, FPX bank transfer, Stripe Connect seller payouts, application fee 3%

Bộ kiểm thử bao gồm **25 kịch bản chi tiết** bao quát: Stripe Checkout flow (card + FPX), Webhook handling, Stripe Connect onboarding, Refund, Security, Error handling.

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging (Stripe Test Mode — `sk_test_*`, `pk_test_*`) |
| Browsers | Chrome (v110+), Safari (Latest), Firefox |
| Devices (Responsive) | Desktop (1920x1080), Mobile (iPhone 14 Pro 375px, Samsung S22) |
| Test Data | Stripe test cards (`4242424242424242`), FPX test bank codes, Webhook CLI (`stripe listen`), MYR currency, Connected Account test mode |
| Stripe Config | Direct Charges model, `payment_method_types: ['card', 'fpx']`, `application_fee_amount: 3%`, `country: 'MY'` |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[NHOM 1] Stripe Checkout Session — Card Payment Flow** |
| **TC-F13.01** | `Checkout` | `E2E` | **[Positive]** Tạo Checkout Session thành công (Card payment MYR) | **1.** User thêm 2 sản phẩm vào giỏ (RM 50 + RM 30).<br>**2.** Bấm Checkout.<br>**3.** API gọi `createStripeCheckoutSession()` với `currency: 'MYR'`, `stripeAccountId`. | **GIVEN** Cart có 2 items tổng RM 80 **WHEN** `createStripeCheckoutSession()` được gọi **THEN** Stripe trả về `CheckoutResult` với `sessionId` và `url` hợp lệ. User được redirect tới Stripe Checkout hosted page. `payment_method_types` chứa `['card', 'fpx']`. `client_reference_id` khớp `orderId`. | Blocker | [x] |
| **TC-F13.02** | `Checkout` | `E2E` | **[Positive]** Thanh toán Card thành công end-to-end | **1.** Tại Stripe Checkout page, nhập test card `4242 4242 4242 4242`, exp `12/30`, CVC `123`.<br>**2.** Bấm Pay.<br>**3.** Stripe redirect về `successUrl`. | **GIVEN** User điền card hợp lệ trên Stripe hosted page **WHEN** Payment processed **THEN** Redirect về success URL với session_id param. DB: Order status chuyển từ `pending` sang `paid`. Cart cleared. Confirmation page hiển thị mã đơn hàng. | Blocker | [x] |
| **TC-F13.03** | `Checkout` | `Logic` | **[Positive]** Application fee 3% tính đúng (Direct Charges) | **1.** Checkout order tổng RM 100 (10000 sen).<br>**2.** Kiểm tra Stripe Dashboard -> Payment Intent. | **GIVEN** Order total = 10000 sen, `applicationFeePercent = 3` **WHEN** `createStripeCheckoutSession()` **THEN** `application_fee_amount = 300` (RM 3.00). Merchant nhận RM 97.00. PrimeWeb platform nhận RM 3.00. Stripe Dashboard confirm Direct Charge model. | Critical | [x] |
| **TC-F13.04** | `Checkout` | `Logic` | **[Negative]** Card bị từ chối (Declined card) | **1.** Tại Stripe Checkout, nhập test card `4000000000000002` (always declined).<br>**2.** Bấm Pay. | **GIVEN** User dùng card bị declined **WHEN** Stripe reject payment **THEN** Stripe Checkout hiện thông báo lỗi "Card was declined". User ở lại trang checkout để thử lại. DB: Order status vẫn `pending`. Cart KHÔNG bị xóa. | Blocker | [x] |
| **TC-F13.05** | `Checkout` | `UX` | **[Negative]** User cancel checkout (nhấn Back/Close) | **1.** User tại Stripe Checkout page bấm nút quay lại hoặc đóng tab.<br>**2.** Sau đó truy cập `cancelUrl`. | **GIVEN** User không hoàn thành thanh toán **WHEN** Redirect về cancel URL **THEN** Hiện thông báo "Thanh toán bị hủy". Cart giữ nguyên items. User có thể thử checkout lại. DB: Order status vẫn `pending` hoặc `cancelled`. | High | [ ] |
| **[NHOM 2] FPX Bank Transfer Flow (Malaysia)** |
| **TC-F13.06** | `FPX` | `E2E` | **[Positive]** Thanh toán FPX thành công (Malaysia bank transfer) | **1.** Tại Stripe Checkout, chọn payment method "FPX".<br>**2.** Chọn bank "Maybank" từ dropdown.<br>**3.** Authorize payment trên bank mock page. | **GIVEN** Checkout session có `payment_method_types` chứa `fpx` **WHEN** User chọn FPX và authorize **THEN** Payment processed thành công. Redirect về success URL. DB: Order `paid`. Stripe event `checkout.session.completed` fire. | Blocker | [ ] |
| **TC-F13.07** | `FPX` | `Logic` | **[Negative]** FPX payment timeout (bank không phản hồi) | **1.** Tại bank redirect page, đợi quá thời gian timeout (simulate).<br>**2.** Kiểm tra order status. | **GIVEN** FPX redirect nhưng bank không confirm **WHEN** Session expires **THEN** Order status vẫn `pending`. User được thông báo "Payment timed out, please try again". Cart giữ nguyên. Không tạo đơn hàng mới trùng lặp. | High | [ ] |
| **TC-F13.08** | `FPX` | `UI` | **[Positive]** Hiển thị danh sách bank Malaysia đầy đủ | **1.** Tại Stripe Checkout, chọn FPX.<br>**2.** Mở dropdown bank list. | **GIVEN** Payment method FPX được kích hoạt **WHEN** User xem bank list **THEN** Hiển thị các bank Malaysia chính: Maybank, CIMB, Public Bank, RHB, Hong Leong, AmBank, Bank Islam, Bank Rakyat. List do Stripe quản lý (không hardcode). | High | [ ] |
| **[NHOM 3] Webhook Handling & Event Processing** |
| **TC-F13.09** | `Webhook` | `Sec` | **[Positive]** Webhook signature verification thành công | **1.** Stripe gửi event `checkout.session.completed` với signature header `stripe-signature`.<br>**2.** API gọi `verifyStripeWebhook(body, signature)`. | **GIVEN** Webhook request có signature hợp lệ **WHEN** `verifyStripeWebhook()` dùng `STRIPE_WEBHOOK_SECRET` **THEN** Returns Stripe.Event object hợp lệ. Không throw error. Event được process bình thường. | Blocker | [x] |
| **TC-F13.10** | `Webhook` | `Sec` | **[Negative]** Webhook signature không hợp lệ (tampered request) | **1.** Gửi POST request tới webhook endpoint với signature giả `whsec_fake123`.<br>**2.** Body chứa fake payment success event. | **GIVEN** Signature không khớp webhook secret **WHEN** `verifyStripeWebhook()` **THEN** Throw error "Webhook signature verification failed". HTTP 400 response. DB: KHÔNG cập nhật order status. Log warning cho security monitoring. | Blocker | [x] |
| **TC-F13.11** | `Webhook` | `Logic` | **[Positive]** Event `checkout.session.completed` cập nhật order | **1.** Stripe fire event `checkout.session.completed` với `client_reference_id = orderId`.<br>**2.** `normalizeStripeEvent()` map sang `payment_success`. | **GIVEN** Valid webhook event type `checkout.session.completed` **WHEN** `normalizeStripeEvent()` **THEN** Returns `PaymentWebhookEvent` với `type: 'payment_success'`, `provider: 'stripe'`. DB: Order status update sang `paid`. `connectedAccountId` populated nếu có. | Blocker | [x] |
| **TC-F13.12** | `Webhook` | `Logic` | **[Positive]** Event `payment_intent.payment_failed` xử lý đúng | **1.** Stripe fire event `payment_intent.payment_failed`.<br>**2.** Normalize event. | **GIVEN** Payment failed event **WHEN** `normalizeStripeEvent()` **THEN** Returns `type: 'payment_failed'`. DB: Order status update sang `payment_failed`. Notification gửi cho merchant. User nhận email thông báo lỗi thanh toán. | High | [x] |
| **TC-F13.13** | `Webhook` | `Logic` | **[Negative]** Unhandled event type (graceful skip) | **1.** Stripe gửi event type `charge.dispute.created` (không nằm trong typeMap).<br>**2.** `normalizeStripeEvent()` xử lý. | **GIVEN** Event type không nằm trong mapping (`typeMap`) **WHEN** `normalizeStripeEvent()` **THEN** Throw error "Unhandled Stripe event type: charge.dispute.created". Webhook endpoint trả 200 (acknowledge receipt) hoặc log warning. Không crash server. | Medium | [x] |
| **TC-F13.14** | `Webhook` | `Logic` | **[Edge]** Idempotent webhook processing (duplicate events) | **1.** Stripe gửi cùng 1 event `checkout.session.completed` 2 lần (retry).<br>**2.** Kiểm tra DB. | **GIVEN** Cùng event ID được gửi 2 lần **WHEN** Process event lần 2 **THEN** Order status không thay đổi (đã là `paid`). Không tạo duplicate transaction records. System nhận biết event đã xử lý (idempotency key hoặc status check). | Critical | [ ] |
| **[NHOM 4] Stripe Connect — Merchant Onboarding** |
| **TC-F13.15** | `Connect` | `E2E` | **[Positive]** Tạo Connected Account cho merchant Malaysia | **1.** Merchant mới đăng ký, trigger `createConnectedAccount(email, businessName)`.<br>**2.** Kiểm tra Stripe Dashboard. | **GIVEN** Merchant email + business name **WHEN** `createConnectedAccount()` với `country: 'MY'` **THEN** Returns `account.id` (acct_xxx). Stripe Dashboard hiện Standard account mới. `type: 'standard'`, `country: 'MY'`. | Blocker | [x] |
| **TC-F13.16** | `Connect` | `E2E` | **[Positive]** Generate Account Link cho KYC onboarding | **1.** Gọi `createAccountLink(accountId, refreshUrl, returnUrl)` với `type: 'account_onboarding'`.<br>**2.** Merchant click link. | **GIVEN** Connected account đã tạo **WHEN** `createAccountLink()` **THEN** Returns URL dẫn tới Stripe-hosted onboarding page. Merchant điền KYC info, bank details. Sau hoàn thành redirect về `returnUrl`. | High | [ ] |
| **TC-F13.17** | `Connect` | `Logic` | **[Positive]** Kiểm tra trạng thái account (charges_enabled) | **1.** Gọi `getConnectedAccountStatus(accountId)` sau khi merchant hoàn thành onboarding.<br>**2.** Kiểm tra response. | **GIVEN** Merchant hoàn thành KYC **WHEN** `getConnectedAccountStatus()` **THEN** Returns `ConnectAccountStatus` với `chargesEnabled: true`, `payoutsEnabled: true`, `detailsSubmitted: true`. Merchant sẵn sàng nhận thanh toán. | High | [x] |
| **TC-F13.18** | `Connect` | `Logic` | **[Negative]** Chặn checkout khi merchant chưa verify (charges_enabled = false) | **1.** Buyer cố checkout tại shop của merchant chưa hoàn thành onboarding.<br>**2.** `getConnectedAccountStatus()` returns `chargesEnabled: false`. | **GIVEN** Merchant account chưa verified **WHEN** Buyer bấm Checkout **THEN** Hiện thông báo "Shop chưa sẵn sàng nhận thanh toán". Checkout bị chặn. Không tạo Stripe session. Merchant nhận notification nhắc hoàn thành KYC. | Blocker | [ ] |
| **[NHOM 5] Currency & Amount Handling (MYR)** |
| **TC-F13.19** | `Currency` | `Logic` | **[Positive]** Currency MYR — smallest unit = sen (100 sen = RM 1) | **1.** Sản phẩm giá RM 29.90.<br>**2.** Kiểm tra `price` truyền vào Stripe. | **GIVEN** Product price RM 29.90 **WHEN** Build checkout params **THEN** `item.price = 2990` (sen, smallest unit). Stripe `currency: 'myr'` (lowercase). Checkout page hiển thị "RM 29.90" cho user. Không lỗi float rounding. | Blocker | [x] |
| **TC-F13.20** | `Currency` | `Logic` | **[Edge]** Làm tròn application fee (sen precision) | **1.** Order total = RM 33.33 (3333 sen). Fee 3% = 99.99 sen.<br>**2.** Kiểm tra `application_fee_amount`. | **GIVEN** Fee calculation: `Math.round(3333 * 0.03) = 100` **WHEN** `createStripeCheckoutSession()` **THEN** `application_fee_amount = 100` (RM 1.00). Không lỗi decimal. Stripe accept integer value. Merchant nhận 3233 sen (RM 32.33). | High | [x] |
| **[NHOM 6] Refund Flow** |
| **TC-F13.21** | `Refund` | `E2E` | **[Positive]** Full refund qua Stripe Dashboard | **1.** Merchant vào Stripe Dashboard -> chọn payment -> Issue Refund (full amount).<br>**2.** Stripe fire webhook `charge.refunded`. | **GIVEN** Payment đã completed **WHEN** Merchant issue full refund **THEN** Buyer nhận tiền hoàn. DB: Order status update sang `refunded`. Application fee cũng được hoàn (Direct Charges model). Email notification gửi cho buyer. | High | [ ] |
| **TC-F13.22** | `Refund` | `Logic` | **[Positive]** Partial refund (hoàn 1 phần) | **1.** Order RM 100, merchant refund RM 40.<br>**2.** Kiểm tra Stripe balance. | **GIVEN** Partial refund RM 40 trên order RM 100 **WHEN** Refund processed **THEN** Buyer nhận RM 40. Merchant balance giảm RM 40. Application fee hoàn tỉ lệ (RM 1.20 / RM 3.00). DB ghi nhận refund amount + remaining balance. | Medium | [ ] |
| **[NHOM 7] Security & PCI Compliance** |
| **TC-F13.23** | `Sec` | `PCI` | **[Positive]** Zero card data stored server-side (PCI compliance) | **1.** Kiểm tra toàn bộ codebase: `src/lib/payment/`, API routes, logs.<br>**2.** Chạy grep "card_number", "cvv", "cvc", "pan". | **GIVEN** Stripe Checkout hosted mode **WHEN** Audit server-side code **THEN** ZERO card data (PAN, CVV, expiry) xuất hiện trong codebase, DB, hoặc logs. Chỉ có `sessionId`, `paymentIntentId` (tokens). Card input hoàn toàn trên Stripe hosted page (PCI SAQ A). | Blocker | [x] |
| **TC-F13.24** | `Sec` | `Env` | **[Negative]** Missing STRIPE_SECRET_KEY throw error rõ ràng | **1.** Xóa env `STRIPE_SECRET_KEY`.<br>**2.** Gọi `getStripeClient()`. | **GIVEN** Env variable không set **WHEN** `getStripeClient()` **THEN** Throw Error("STRIPE_SECRET_KEY is not set"). Không expose default key, không fallback. Server log error rõ ràng. Checkout endpoint trả 500 với message generic (không leak secret name). | High | [x] |
| **TC-F13.25** | `Sec` | `Env` | **[Negative]** Missing STRIPE_WEBHOOK_SECRET reject webhook | **1.** Xóa env `STRIPE_WEBHOOK_SECRET`.<br>**2.** Webhook endpoint nhận request. | **GIVEN** Webhook secret không set **WHEN** `verifyStripeWebhook()` **THEN** Throw Error("STRIPE_WEBHOOK_SECRET is not set"). Webhook request bị reject 500. Không bypass verification. Không process payment event khi thiếu secret. | Blocker | [x] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
_Mô tả kịch bản kiểm thử dựa trên hành vi thực tế: Merchant onboard -> Buyer checkout -> Payment -> Webhook -> Confirmation._

1. **[Merchant Onboard]**: Merchant đăng ký shop trên ECH Prime. Hệ thống gọi `createConnectedAccount()` tạo Stripe Standard account (`country: 'MY'`). Merchant click Account Link hoàn thành KYC, upload NRIC, thêm bank account Malaysia. `getConnectedAccountStatus()` trả `chargesEnabled: true` (TC-F13.15, 16, 17).
2. **[Buyer Checkout Card]**: Buyer chọn 2 sản phẩm (RM 80 total), bấm Checkout. `createStripeCheckoutSession()` tạo session với `currency: 'myr'`, `payment_method_types: ['card', 'fpx']`. Buyer redirect sang Stripe hosted page, nhập card `4242...`, Pay. Redirect về success URL (TC-F13.01, 02, 19).
3. **[Webhook Update]**: Stripe fire `checkout.session.completed`. Webhook endpoint verify signature OK. `normalizeStripeEvent()` map sang `payment_success`. DB: Order `paid`. Application fee RM 2.40 (3%) ghi nhận cho PrimeWeb platform (TC-F13.09, 11, 03).
4. **[FPX Alternative]**: Buyer khác chọn FPX, select "Maybank", authorize trên bank page. Payment success. Cùng webhook flow (TC-F13.06, 08).
5. **[Refund]**: Merchant phát hiện hàng lỗi, issue full refund qua Stripe Dashboard. Buyer nhận tiền hoàn. Order status `refunded` (TC-F13.21).

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes) |
|---|---|---|
| **1. Stripe Checkout Flow (Card + FPX)** | [ ] Đã chạy 0/8 TC | Card + FPX payment end-to-end success. Cancel/decline handling graceful. Cart persist khi fail. |
| **2. Webhook Security & Processing** | [ ] Đã chạy 0/6 TC | Signature verification 100%. Idempotent processing. Unhandled events graceful skip. |
| **3. Stripe Connect (Merchant Onboard)** | [ ] Đã chạy 0/4 TC | Standard account Malaysia. KYC flow. charges_enabled gate checkout. |
| **4. MYR Currency & Fee Calculation** | [ ] Đã chạy 0/2 TC | Sen precision (integer). Application fee 3% rounding Math.round(). |
| **5. Refund Flow** | [ ] Đã chạy 0/2 TC | Full + partial refund. Fee proportional refund. |
| **6. PCI & Security** | [ ] Not Run | Zero card data server-side. Env secrets validated. No secret leak in error messages. |
| **7. E2E UAT Approval** | [ ] Not Run | Full Merchant onboard -> Buyer checkout -> Webhook -> Confirmation flow. |

---
> **Khuyến Nghị Release:** Payment Gateway là critical path của business — ảnh hưởng trực tiếp tới doanh thu. Yêu cầu **100% Blocker TCs pass trên Stripe Test Mode** + **Webhook signature verification confirmed** + **Zero card data audit pass** trước khi bật Stripe Live Mode. Khuyến nghị chạy `stripe listen --forward-to` trên staging để test webhook flow liên tục trước release.
