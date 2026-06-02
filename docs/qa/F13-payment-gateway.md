# Quyết Định Kiểm Thử & Testcase Chi Tiết: F13 - Payment Gateway Malaysia

> **Phiên bản:** 1.6 | **Cập nhật:** 2026-05-27 | **Thực hiện:** QA Team  
> **Nguồn tham chiếu:** `docs/prd/F13-payment-gateway.md`, `docs/stories/F13-payment-gateway-stories.md`, `docs/design/F13-payment-gateway-design.md`, `docs/architecture/F13-payment-gateway.md`, `src/lib/payment/stripe.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/collections/Orders.ts`  
> **Changelog v1.6 (Wave 6.5 Hardening, 2026-05-27):** Sync drift corrections: endpoint name corrected to `/api/orders/stripe-checkout`; status contract `status='new' + paymentStatus='paid'` atomic on webhook success (NOT just `paid`); fee=0 (Wave 6, not 3%); payment_failed handler implemented (not "out of scope"); account.deauthorized implemented. Add NHÓM 16 (TC-F13.142..157, Wave 6.5 Flow Hardening): atomic webhook + stock, oversell flag, retry payment, confirm polling, cron reconcile. Total TCs: 157.

---

## 1. Mục Tiêu

Bộ testcase này dùng để kiểm thử đầy đủ F13 - Payment Gateway cho thị trường Malaysia:

- Buyer thanh toán Card + FPX qua **Stripe Checkout Session hosted**.
- Seller kết nối Stripe Connect Standard account và bật/tắt Card/FPX trong Dashboard.
- Backend tạo Direct Charge trên connected account, thu 3% `application_fee_amount`.
- Webhook Stripe được verify signature, xử lý idempotent và cập nhật order đúng trạng thái.
- Không lưu card data server-side, giữ PCI SAQ A.
- Mobile checkout có hitbox >= 54px và không build custom FPX bank picker.

**Contract QA v1.3:** Source code hiện tại cập nhật Stripe order thành `paid` khi webhook `checkout.session.completed` thành công. Nếu PRD/architecture còn ghi `pending -> new`, cần sync lại tài liệu requirement hoặc đổi code trước khi QA chạy release gate.

---

## 2. Scope Kiểm Thử

### In Scope Wave 6

- Card + FPX qua Stripe Checkout hosted.
- Stripe Connect Standard account + Direct Charges.
- Dynamic `payment_method_types`: `['card']`, `['fpx']`, `['card', 'fpx']`.
- Settings UI: Card/FPX toggles, Disabled+Lock+Tooltip, Connect CTA.
- Connect onboarding: first connect, retry, return complete/refresh.
- Checkout UI: Stripe row label dynamic, both-OFF hidden, COD/QR fallback.
- Mobile UX: 375px, method row/toggle hitbox >= 54px, sticky action.
- Webhook: signature, success, failure, duplicate, unhandled event.
- Security: env validation, zero card data, no hardcoded secrets.

### Deferred Wave 7+

- Refund UI trong order detail.
- Dispute/Chargeback persistence + merchant notification.
- Stripe Payment Element inline.
- Touch 'n Go, GrabPay, Boost, saved cards.
- Stripe Connect Express/Custom accounts.

---

## 3. Test Environment

| Hạng mục | Yêu cầu |
|---|---|
| Environment | Staging, Stripe Test Mode (`sk_test_*`, `pk_test_*`) |
| Browsers | Chrome latest, Safari latest, Firefox latest |
| Devices | Desktop 1920x1080, iPhone 14 Pro 375px, Samsung S22 |
| Stripe data | Test card `4242 4242 4242 4242`, declined card `4000 0000 0000 0002`, FPX test bank, Stripe CLI `stripe listen` |
| Tenant data | Tenant onboarded, tenant chưa onboard, tenant có `stripeAccountId` nhưng KYC chưa complete |
| Payment settings | `payment_card`, `payment_fpx`, `payment_cod`, `payment_qr` |
| **Order status contract (v1.6)** | **Success: `status='new'` AND `paymentStatus='paid'` (atomic on webhook); fail/cancel: stay `pending`; payment_failed: `paymentStatus='payment_failed'`** |

---

## 4. Unified Test Cases

| ID | Tham chiếu | Loại | Scenario | Steps & Test Data | Expected Result / Gherkin | Mức độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[NHÓM 1] Stripe Checkout Session - Card + FPX Core Flow** ||||||||
| **TC-F13.01** | FR-01, FR-06, FR-13 | API | **[Positive]** Tạo Checkout Session thành công khi Card + FPX đều ON | 1. Tenant đã onboard Stripe, `payment_card=true`, `payment_fpx=true`.<br>2. Buyer có cart RM 80.<br>3. POST `/api/orders/stripe-checkout` chọn Stripe (corrected endpoint v1.6). | **GIVEN** tenant hỗ trợ Card + FPX **WHEN** tạo Stripe Checkout Session **THEN** response có `sessionId`/`url` hợp lệ, `currency='myr'`, `client_reference_id=orderId`, `payment_method_types=['card','fpx']`, và dùng connected account của tenant. | Blocker | [x] |
| **TC-F13.02** | FR-01, FR-03, FR-07 | E2E | **[Positive]** Thanh toán Card thành công end-to-end | 1. Buyer redirect tới Stripe Checkout.<br>2. Nhập card `4242 4242 4242 4242`, exp `12/30`, CVC `123`.<br>3. Pay và chờ redirect success URL. | **GIVEN** card hợp lệ **WHEN** Stripe payment success **THEN** buyer về confirmation page, webhook `checkout.session.completed` được xử lý, DB order `status='new'` AND `paymentStatus='paid'` (atomic, v1.6), cart preserved until Confirm success, stock decremented. | Blocker | [ ] |
| **TC-F13.03** | BR-01, FR-01 | Logic | **[Positive]** MYR dùng smallest unit sen | 1. Product giá RM 29.90.<br>2. Tạo checkout params. | **THEN** Stripe line item amount là `2990`, currency là `myr`, không có lỗi floating-point rounding. | Blocker | [x] |
| **TC-F13.04** | Business fee | Logic | **[Correction v1.6]** Wave 6 NO application_fee_amount (fee=0) | 1. Order total RM 100 = 10000 sen.<br>2. Tạo session Direct Charge.<br>3. Inspect `payment_intent_data`. | **THEN** `application_fee_amount` NOT sent (Wave 6 fee=0 due to cross-border limit); charge nằm trên connected account, platform không thu fee Wave 6; **3% fee deferred Wave 7+** khi cross-border lifted. | Critical | [x] |
| **TC-F13.05** | Business fee | Logic | **[Correction v1.6]** Wave 6 fee=0 → no rounding needed | 1. Order total RM 33.33 = 3333 sen.<br>2. Checkout session created. | **THEN** `payment_intent_data` không có `application_fee_amount` key (Wave 6); fee=0 → rounding deferred Wave 7+. | High | [x] |
| **TC-F13.06** | FR-04, FR-05, BR-03 | E2E | **[Negative]** Card bị từ chối | 1. Tại Stripe Checkout nhập card declined `4000 0000 0000 0002`.<br>2. Submit payment. | **THEN** Stripe hiển thị lỗi declined, buyer có thể thử lại, order vẫn `pending`, cart không bị xóa, không có webhook success cập nhật `paid`. | Blocker | [ ] |
| **TC-F13.07** | FR-04, FR-05 | UX | **[Negative]** Buyer cancel / back từ Stripe Checkout | 1. Buyer mở Stripe Checkout rồi bấm Back hoặc cancel.<br>2. App nhận `cancel_url` / `stripe_cancelled=1`. | **THEN** app hiển thị toast BM `Pembayaran gagal. Sila cuba lagi.`, cart giữ nguyên, order vẫn `pending`, có CTA thử lại tạo session mới. | High | [x] |
| **TC-F13.08** | UX loading | UI | **[Positive]** Redirect loading state rõ ràng | 1. Buyer chọn Stripe và bấm Place Order.<br>2. API đang tạo session 1-3 giây. | **THEN** button hiển thị loading/disabled, radio disabled, full-page dialog `Redirecting to Stripe Checkout. Please don't close this window.`; nếu redirect chậm có fallback mở Stripe URL thủ công. | Medium | [x] |
| **TC-F13.09** | FR-01, FR-02, FR-03 | E2E | **[Positive]** FPX payment thành công | 1. Session có `payment_method_types` chứa `fpx`.<br>2. Buyer chọn FPX trên Stripe hosted page.<br>3. Chọn FPX test bank và authorize. | **THEN** Stripe redirect bank mock rồi về success URL, webhook `checkout.session.completed` cập nhật order `status='new'` AND `paymentStatus='paid'` (v1.6). | Blocker | [ ] |
| **TC-F13.10** | FR-02, FR-09 | UI | **[Positive]** FPX bank list do Stripe render, app không hardcode dropdown | 1. Mở Stripe hosted Checkout với FPX enabled.<br>2. Chọn FPX. | **THEN** bank picker nằm trên Stripe page, không có custom bank dropdown trong app; các bank Malaysia chính do Stripe quản lý. | High | [ ] |
| **TC-F13.11** | FR-04, FR-05 | Edge | **[Negative]** FPX timeout / bank abandoned | 1. Buyer chọn FPX nhưng không hoàn tất bank authorization.<br>2. Stripe hoặc app đưa buyer về cancel flow. | **THEN** toast BM `Pembayaran gagal. Sila cuba lagi.`, order vẫn `pending`, cart preserved, retry không tạo order duplicate không kiểm soát. | High | [x] |
| **[NHÓM 2] Dynamic Payment Method Picker + Mobile UX** ||||||||
| **TC-F13.12** | FR-13 | UI/API | **[Positive]** Label Stripe khi Card + FPX đều ON | 1. Tenant `payment_card=true`, `payment_fpx=true`.<br>2. Buyer load `/sites/[slug]/checkout`. | **THEN** RadioGroup có 1 Stripe row label `Pay with Stripe (Card · FPX)` và backend pass `['card','fpx']`. | Blocker | [x] |
| **TC-F13.13** | FR-13 | UI/API | **[Positive]** Label Stripe khi chỉ Card ON | 1. Tenant `payment_card=true`, `payment_fpx=false`.<br>2. Buyer checkout. | **THEN** Stripe row label `Pay with Card`, Stripe session chỉ pass `['card']`, FPX không xuất hiện trên Stripe page. | High | [x] |
| **TC-F13.14** | FR-13 | UI/API | **[Positive]** Label Stripe khi chỉ FPX ON | 1. Tenant `payment_card=false`, `payment_fpx=true`.<br>2. Buyer checkout. | **THEN** Stripe row label `Pay with FPX (Online Banking)`, Stripe session chỉ pass `['fpx']`, Card không xuất hiện trên Stripe page. | High | [x] |
| **TC-F13.15** | FR-13, FR-15 | UI | **[Edge]** Stripe row hidden khi Card + FPX đều OFF | 1. Tenant `payment_card=false`, `payment_fpx=false`.<br>2. COD/QR có thể ON. | **THEN** Stripe row không render trong RadioGroup, buyer chỉ thấy COD/QR nếu enabled, không chọn được Stripe bằng UI. | Blocker | [x] |
| **TC-F13.16** | FR-15 | API | **[Negative]** Backend reject nếu client bypass UI khi both-OFF | 1. Tenant both-OFF.<br>2. Gửi POST `/api/orders/stripe-checkout` chọn Stripe trực tiếp. | **THEN** API trả HTTP 422 `{ code: 'NO_PAYMENT_METHODS', message: 'Seller has not enabled Card or FPX' }`, không gọi Stripe API. | Blocker | [x] |
| **TC-F13.17** | 9-point checklist | UI | **[Negative]** Place Order disabled khi chưa chọn payment method | 1. Buyer load checkout, không chọn method.<br>2. Quan sát CTA. | **THEN** Place Order disabled hoặc block submit với validation rõ ràng; không tạo order/session. | High | [x] |
| **TC-F13.18** | FR-08, US-F13-03 AC-1 | Mobile UI | **[Positive]** Mobile payment rows có hitbox >= 54px | 1. Viewport 375px.<br>2. Load checkout payment step.<br>3. Đo Stripe/COD/QR method rows. | **THEN** payment rows stack dọc, min-height >= 54px, active state rõ ràng, không horizontal overflow. | High | [x] |
| **TC-F13.19** | FR-08, FR-09, US-F13-03 AC-2 | Mobile E2E | **[Positive]** Mobile FPX bank picker touch-friendly trên Stripe hosted page | 1. Viewport 375px.<br>2. Buyer chọn Stripe, redirect Stripe Checkout, chọn FPX. | **THEN** bank picker trên Stripe page dùng native/touch-friendly UI; app không render custom cramped dropdown. | High | [ ] |
| **[NHÓM 3] Seller Settings + Stripe Connect Onboarding** ||||||||
| **TC-F13.20** | FR-14, US-F13-02 AC-2 | UI | **[Positive]** Not onboarded: Disabled + Lock + Tooltip | 1. Tenant `stripeOnboardingComplete=false`.<br>2. Seller load `/dashboard/settings/payments`. | **THEN** Card/FPX toggles disabled, có lock icon, tooltip `Connect Stripe to enable`, destructive alert `Connect Stripe to accept Card & FPX`, CTA `Connect Stripe` visible. | Blocker | [x] |
| **TC-F13.21** | FR-14 | UI | **[Negative]** Click toggle khi chưa onboard bị block | 1. Tenant chưa onboard.<br>2. Seller cố click Card/FPX toggle. | **THEN** toggle không đổi state, toast `Connect Stripe first`, focus/scroll đưa seller tới Connect CTA. | High | [x] |
| **TC-F13.22** | FR-06, US-F13-02 AC-1 | UI/API | **[Positive]** Onboarded seller bật/tắt Card/FPX và lưu DB | 1. Tenant `stripeOnboardingComplete=true`.<br>2. Seller toggle Card/FPX và Save. | **THEN** DB lưu đúng `tenant.payment_card`/`tenant.payment_fpx`, toast `Payment methods updated`, checkout dùng setting mới ở lần load tiếp theo. | Blocker | [x] |
| **TC-F13.23** | FR-06, UX | UI | **[Edge]** Settings both-OFF có soft warning nhưng không crash | 1. Seller onboarded tắt cả Card và FPX.<br>2. Save settings. | **THEN** app hiển thị warning `At least one required` hoặc warning tương đương; save không crash; checkout ẩn Stripe row; backend vẫn bảo vệ bằng TC-F13.16. | High | [x] |
| **TC-F13.24** | FR-10, US-F13-04 AC-1 | E2E/API | **[Positive]** First Connect CTA tạo Stripe Standard account | 1. Tenant chưa có `stripeAccountId`.<br>2. Seller click Connect Stripe.<br>3. Client POST `/api/stripe/connect/onboard`. | **THEN** backend tạo Standard account `country='MY'`, lưu `tenant.stripeAccountId`, set `stripeOnboardingComplete=false`, trả `onboardingUrl`, client redirect bằng `window.location.href`. | Blocker | [x] |
| **TC-F13.25** | FR-10, US-F13-04 AC-1 | API | **[Positive]** Retry onboarding không tạo account duplicate | 1. Tenant đã có `stripeAccountId` nhưng KYC chưa xong.<br>2. Seller click Connect Stripe lần 2. | **THEN** backend không tạo account mới; tạo account link mới cho existing account; trả onboarding URL mới. | High | [x] |
| **TC-F13.26** | FR-11, US-F13-04 AC-2 | UI/API | **[Positive]** Return `?stripe=complete` và charges enabled | 1. Stripe redirect về `/dashboard/settings/payments?stripe=complete`.<br>2. GET status trả `chargesEnabled=true`. | **THEN** toast `Stripe connected successfully!`, Card/FPX toggles unlock, destructive alert ẩn, `router.replace` strip query param. | Blocker | [x] |
| **TC-F13.27** | FR-11, US-F13-04 AC-2 | UI/API | **[Edge]** Return complete nhưng KYC pending | 1. Redirect `?stripe=complete`.<br>2. GET status trả `chargesEnabled=false`. | **THEN** toast warning `Stripe account created but KYC verification is pending`, toggles vẫn locked, Connect CTA hoặc retry guidance vẫn rõ. | High | [x] |
| **TC-F13.28** | FR-12, US-F13-04 AC-3 | UI | **[Negative]** Return `?stripe=refresh` khi abandoned KYC | 1. Stripe redirect về `/dashboard/settings/payments?stripe=refresh`. | **THEN** toast warning `Stripe onboarding incomplete. Click Connect again to continue.`, toggles vẫn Disabled+Lock, Connect CTA visible, query param bị strip. | High | [x] |
| **TC-F13.29** | US-F13-04 AC-4 | API | **[Positive]** Backend tạo đúng return URL cho account link | 1. POST `/api/stripe/connect/onboard`.<br>2. Inspect params gọi `createAccountLink`. | **THEN** `return_url` là `${baseUrl}/dashboard/settings/payments?stripe=complete`, `refresh_url` là `${baseUrl}/dashboard/settings/payments?stripe=refresh`, không dùng `/settings?stripe=...`. | Blocker | [x] |
| **TC-F13.30** | Security, tenant isolation | API | **[Negative]** User không thuộc tenant không được onboard/status | 1. Login user A.<br>2. Gửi onboard/status cho tenant B. | **THEN** API trả 401/403, không tạo account, không leak `stripeAccountId`, không cập nhật tenant khác. | Blocker | [x] |
| **[NHÓM 4] Webhook Security & Processing** ||||||||
| **TC-F13.31** | Webhook security | API/Sec | **[Positive]** Webhook signature hợp lệ | 1. Gửi raw body + header `stripe-signature` hợp lệ từ Stripe CLI.<br>2. Endpoint `/api/webhooks/stripe`. | **THEN** `verifyStripeWebhook()` trả Stripe.Event hợp lệ, endpoint xử lý event bình thường. | Blocker | [x] |
| **TC-F13.32** | Webhook security | API/Sec | **[Negative]** Webhook signature tampered | 1. Gửi body giả success event với signature sai. | **THEN** endpoint trả HTTP 400, không cập nhật order/subscription/tenant, log warning/error không chứa secret. | Blocker | [x] |
| **TC-F13.33** | FR-07, FR-16 | API/Logic | **[Positive]** `checkout.session.completed` cập nhật order atomically (v1.6) | 1. Event có `client_reference_id=orderId`, `payment_intent`, connected account nếu có.<br>2. Order đang `pending`. | **THEN** normalize thành `payment_success`, DB cập nhật `status='new'` AND `paymentStatus='paid'` atomically (single UPDATE WHERE status='pending'), lưu `stripeSessionId`/`stripePaymentIntentId`, giảm stock nếu có line items. | Blocker | [x] |
| **TC-F13.34** | Webhook idempotency | API/Edge | **[Edge]** Duplicate success webhook không xử lý hai lần | 1. Gửi cùng event/session success 2 lần. | **THEN** lần 2 được ack 200 nhưng skip vì order đã `paid`; không trừ stock lần 2, không tạo transaction/notification duplicate. | Critical | [x] |
| **TC-F13.35** | Failure handling | API/Logic | **[Positive]** `payment_intent.payment_failed` cập nhật failure | 1. Event failed có `payment_intent.id` hoặc metadata `orderId`.<br>2. Order tồn tại. | **THEN** normalize `payment_failed`, order cập nhật `payment_failed`, lưu `stripePaymentIntentId`, không clear cart bằng success flow. | High | [x] |
| **TC-F13.36** | Robustness | API/Edge | **[Negative]** Unhandled event graceful skip | 1. Gửi event type không map, ví dụ `invoice.created` hoặc `charge.dispute.created` trong Wave 6. | **THEN** endpoint ack 200 hoặc xử lý skip có log warning; server không crash; DB không đổi. | Medium | [x] |
| **TC-F13.37** | Robustness | API/Edge | **[Negative]** Success webhook thiếu `client_reference_id` | 1. Gửi `checkout.session.completed` không có `client_reference_id`. | **THEN** endpoint ack 200, log warning, không cập nhật nhầm order. | High | [x] |
| **[NHÓM 5] Security, PCI & Env Guard** ||||||||
| **TC-F13.38** | PCI SAQ A | Sec | **[Positive]** Zero card data stored server-side | 1. Scan `src/lib/payment`, API routes, collections, logs.<br>2. Tìm `card_number`, `cvv`, `cvc`, `pan`, full card test data. | **THEN** không lưu PAN/CVV/expiry server-side; chỉ lưu Stripe token/session/payment intent; card form hoàn toàn trên Stripe hosted page. | Blocker | [x] |
| **TC-F13.39** | Env | API/Sec | **[Negative]** Missing `STRIPE_SECRET_KEY` fail rõ ràng | 1. Unset `STRIPE_SECRET_KEY` trong test env.<br>2. Gọi flow tạo session hoặc `getStripeClient()`. | **THEN** server throw/internal log rõ, API trả generic 500/502, không fallback secret, không leak secret name/value ra client. | High | [x] |
| **TC-F13.40** | Env | API/Sec | **[Negative]** Missing webhook secret không bypass verify | 1. Unset `STRIPE_WEBHOOK_SECRET` hoặc `STRIPE_CONNECT_WEBHOOK_SECRET` theo event.<br>2. Gửi webhook. | **THEN** endpoint reject 400/500 theo implementation, không process payment event khi thiếu secret. | Blocker | [x] |
| **TC-F13.41** | Security | Static/API | **[Negative]** Không hardcode secret hoặc log sensitive payment data | 1. Scan code/env examples/log statements.<br>2. Kiểm tra Stripe keys, webhook secrets, buyer email/PII logs. | **THEN** không có secret thật trong repo, `.env.*.example` chỉ placeholder, logs không in full secret/card data. | Blocker | [x] |
| **[NHÓM 6] Deferred Wave 7+ - Không Chặn Wave 6** ||||||||
| **TC-F13.42** | Deferred | E2E | ~~**[Positive]** Full refund qua dashboard/app~~ **DEFER Wave 7+** | Refund UI trong order detail ngoài scope Wave 6. | Không dùng làm release gate Wave 6. Nếu test thủ công qua Stripe Dashboard thì ghi report riêng F10/Wave 7. | OOS | [ ] |
| **TC-F13.43** | Deferred | Logic | ~~**[Positive]** Partial refund~~ **DEFER Wave 7+** | Refund partial ngoài scope Wave 6. | Không dùng làm release gate Wave 6. | OOS | [ ] |
| **TC-F13.44** | Deferred | Logic | ~~**[Positive]** `charge.dispute.created` record + notify~~ **DEFER Wave 7+** | Dispute persistence/notification chưa thuộc PRD Wave 6. | Wave 6 chỉ cần TC-F13.36 graceful skip cho unhandled dispute event. | OOS | [ ] |
| **TC-F13.45** | Deferred | Logic | ~~**[Positive]** `charge.dispute.closed` update outcome~~ **DEFER Wave 7+** | Dispute outcome handling chưa thuộc PRD Wave 6. | Không dùng làm release gate Wave 6. | OOS | [ ] |
| **[NHÓM 7] Dev TDD Contract - RED Trước Khi Code** ||||||||
| **TC-F13.46** | TDD, docs | Process | **[RED]** Mỗi requirement F13 có TC-ID và test artifact dự kiến | 1. Dev đọc PRD/stories/design/architecture.<br>2. So khớp FR-01..FR-15 với testcase trong file này.<br>3. Lập danh sách test file cần tạo trước khi code. | **THEN** không có FR nào thiếu TC; mỗi TC `[x] AUTO` có test file đích; PR không bắt đầu implement khi chưa có danh sách RED tests. | Blocker | [x] |
| **TC-F13.47** | TDD, RED gate | Process/CI | **[RED]** Failing tests phải fail trước khi implement | 1. Dev tạo hoặc cập nhật test files theo TC-F13.53..73.<br>2. Chạy targeted tests trước khi code.<br>3. Lưu output fail. | **THEN** các tests mới fail vì behavior chưa implement, không fail vì syntax/import lỗi; nếu test pass khi code chưa có thì sửa lại test. | Blocker | [x] |
| **TC-F13.48** | `docs/TEST_CONVENTION.md` | Static | **[RED]** Test name bắt buộc có TC-ID và AAA pattern | 1. Review test files mới cho F13.<br>2. Kiểm tra describe/it/comment chứa TC-F13.xx.<br>3. Kiểm tra Arrange/Act/Assert. | **THEN** mọi test đều map TC-ID, có assert rõ ràng, không có test tên chung chung kiểu `should work`. | High | [x] |
| **TC-F13.49** | `docs/TEST_CONVENTION.md` | Static | **[RED]** Test import từ source thật, không re-implement logic | 1. Review unit/API/component tests.<br>2. Tìm helper logic copy trong test file. | **THEN** test import từ `@/lib/payment/*`, route handlers, components thật; không tự viết lại `buildPaymentMethodTypes`, fee rounding, validator trong test. | Blocker | [x] |
| **TC-F13.50** | `docs/TEST_CONVENTION.md` | Static | **[RED]** Mock ở top-level và cleanup đầy đủ | 1. Review `vi.mock()` trong F13 tests.<br>2. Kiểm tra `beforeEach/afterEach`. | **THEN** `vi.mock()` nằm trước import source; có `vi.clearAllMocks()`; không có `vi.mock()` trong `it()`, không có `console.log` debug. | High | [x] |
| **TC-F13.51** | TypeScript | Static/CI | **[GREEN]** Payment code mới type-safe | 1. Chạy `npm run typecheck` sau implement.<br>2. Review code payment mới. | **THEN** không thêm `any` không giải thích; error handling explicit; public response không leak Stripe secret/stack trace. | Blocker | [x] |
| **TC-F13.52** | DB migration rule | Review/CI | **[GREEN]** Schema/migration đồng bộ khi đổi `Tenants` hoặc `Orders` | 1. Nếu PR sửa `src/collections/Tenants.ts` hoặc `Orders.ts`, review `scripts/db-setup.js`.<br>2. Chạy migration dry/staging. | **THEN** field mới có migration idempotent `ADD COLUMN IF NOT EXISTS`; không dùng `DROP TABLE`; env staging/prod không drift. | Blocker | [x] |
| **[NHÓM 8] Unit/API TDD - Payment Core** ||||||||
| **TC-F13.53** | FR-06, FR-13 | Unit | **[RED->GREEN]** `buildPaymentMethodTypes`: both ON | 1. Unit test helper với tenant `payment_card=true`, `payment_fpx=true`. | **THEN** trả `['card','fpx']` đúng thứ tự ổn định để Stripe render Card + FPX. Test file gợi ý: `src/__tests__/unit/payment/payment-method-types.test.ts`. | Blocker | [x] |
| **TC-F13.54** | FR-06, FR-13 | Unit | **[RED->GREEN]** `buildPaymentMethodTypes`: Card only | 1. Tenant `payment_card=true`, `payment_fpx=false`. | **THEN** trả `['card']`; không lẫn FPX. | High | [x] |
| **TC-F13.55** | FR-06, FR-13 | Unit | **[RED->GREEN]** `buildPaymentMethodTypes`: FPX only | 1. Tenant `payment_card=false`, `payment_fpx=true`. | **THEN** trả `['fpx']`; không lẫn Card. | High | [x] |
| **TC-F13.56** | FR-15 | Unit | **[RED->GREEN]** `buildPaymentMethodTypes`: both OFF | 1. Tenant `payment_card=false`, `payment_fpx=false`. | **THEN** trả `[]`; caller phải reject 422 `NO_PAYMENT_METHODS`, không fallback hardcoded `['card','fpx']`. | Blocker | [x] |
| **TC-F13.57** | FR-15 | API | **[RED->GREEN]** `/api/orders/stripe-checkout` reject both-OFF trước khi gọi Stripe | 1. Mock Payload tenant both-OFF.<br>2. POST valid cart chọn Stripe.<br>3. Spy `createStripeCheckoutSession`. | **THEN** HTTP 422 `NO_PAYMENT_METHODS`; Stripe function không được gọi; order không bị tạo nếu validation chạy trước create. | Blocker | [x] |
| **TC-F13.58** | FR-10, checkout guard | API | **[RED->GREEN]** `/api/orders/stripe-checkout` reject khi tenant chưa onboard | 1. Tenant thiếu `stripeAccountId` hoặc `stripeOnboardingComplete=false`.<br>2. POST checkout. | **THEN** API trả lỗi cấu hình thanh toán, không tạo Stripe session, không expose Stripe internals. | Blocker | [x] |
| **TC-F13.59** | Data validation | API | **[RED->GREEN]** `/api/orders/stripe-checkout` reject cart không có product hợp lệ | 1. Gửi product ID không tồn tại hoặc quantity invalid.<br>2. Mock Payload không trả product. | **THEN** HTTP 422 `No valid products`; không tạo Stripe session; không tạo order rỗng. | High | [x] |
| **TC-F13.60** | Inventory integrity | API/Edge | **[RED->GREEN]** Checkout không cho trả tiền sản phẩm hết hàng | 1. Product `inventory=0` hoặc nhỏ hơn quantity.<br>2. POST checkout. | **THEN** API reject 409/422 trước Stripe; không tạo pending order có thể dẫn đến oversell. Nếu F13 không xử lý inventory, phải ghi rõ handoff sang F09/F10 và không mark pass. | High | [x] |
| **TC-F13.61** | Direct Charges | Unit/API | **[RED->GREEN]** Connected account được truyền vào Stripe request | 1. Gọi `createStripeCheckoutSession` với `stripeAccountId='acct_123'`.<br>2. Spy Stripe SDK. | **THEN** `stripe.checkout.sessions.create` nhận option `{ stripeAccount: 'acct_123' }`; charge không chạy trên platform account. | Blocker | [x] |
| **TC-F13.62** | Return URL | Unit/API | **[RED->GREEN]** Success/cancel URLs đúng storefront slug | 1. Tạo checkout cho tenant slug `demo-shop`.<br>2. Inspect params gọi Stripe. | **THEN** `success_url` trỏ đúng `/sites/demo-shop/...` có `{CHECKOUT_SESSION_ID}`; `cancel_url` trỏ checkout cancel/fail flow có thể hiển thị BM toast. | High | [x] |
| **TC-F13.63** | Fee/currency | Unit | **[Correction v1.6]** Wave 6 fee=0; rounding deferred Wave 7+ | 1. Test RM 33.33, RM 0.01, RM 9999.99.<br>2. Build line items (no fee in Wave 6). | **THEN** all Stripe amounts là integer sen; NO application_fee_amount sent (Wave 6); rounding logic reserved for Wave 7+. | Critical | [x] |
| **TC-F13.64** | Env guard | Unit/API | **[RED->GREEN]** Missing Stripe env trả lỗi generic ra client | 1. Unset `STRIPE_SECRET_KEY` trong test.<br>2. Gọi tạo session. | **THEN** server log rõ cho dev, client chỉ nhận generic payment/order creation error; không leak env key/value. | High | [x] |
| **TC-F13.65** | Webhook normalize | Unit | **[RED->GREEN]** Normalize đầy đủ success/failure/account/unhandled | 1. Gọi `normalizeStripeEvent()` với `checkout.session.completed`, `payment_intent.payment_failed`, `account.updated`, unknown event. | **THEN** success/failure/account map đúng; unknown throw hoặc skip theo contract endpoint; tests không mock function đang test. | Blocker | [x] |
| **TC-F13.66** | Webhook idempotency | API | **[RED->GREEN]** Duplicate webhook không trừ stock/gửi mail hai lần | 1. Mock order đã `paid` với same `stripeSessionId`.<br>2. POST same webhook lần 2. | **THEN** endpoint 200; `payload.update` stock/order/email/notification không gọi lại. | Critical | [x] |
| **[NHÓM 9] Component/UI TDD - Trước Khi Tester Chạy Browser** ||||||||
| **TC-F13.67** | FR-14 | Component | **[RED->GREEN]** Settings not-onboarded render lock/tooltip/CTA | 1. Render payment settings component với `stripeOnboardingComplete=false`.<br>2. Query toggles/tooltip/CTA. | **THEN** Card/FPX disabled, lock icon visible, tooltip có text `Connect Stripe to enable`, Connect CTA visible. | Blocker | [x] |
| **TC-F13.68** | FR-10, UX | Component/API | **[RED->GREEN]** Connect CTA chống double-click | 1. Render settings not-onboarded.<br>2. Double click Connect nhanh 2 lần. | **THEN** chỉ 1 POST onboard được gửi; button loading/disabled; không tạo 2 account link. | High | [x] |
| **TC-F13.69** | FR-11 | Component | **[RED->GREEN]** Return `?stripe=complete` unlock đúng state | 1. Mock `useSearchParams` trả `stripe=complete`.<br>2. Mock status `chargesEnabled=true`. | **THEN** gọi status API, toast success, unlock toggles, hide alert, `router.replace` strip query. | Blocker | [x] |
| **TC-F13.70** | FR-12 | Component | **[RED->GREEN]** Return `?stripe=refresh` giữ locked và retry CTA | 1. Mock `stripe=refresh`. | **THEN** toast warning, Card/FPX vẫn locked, Connect CTA visible, query bị strip. | High | [x] |
| **TC-F13.71** | FR-13 | Component | **[RED->GREEN]** Checkout Stripe label dynamic đủ 4 tổ hợp | 1. Render checkout payment picker với both ON, Card only, FPX only, both OFF. | **THEN** labels lần lượt đúng; both-OFF không render Stripe row; không split Card/FPX thành 2 row inline. | Blocker | [x] |
| **TC-F13.72** | FR-13, fallback | Component | **[RED->GREEN]** Both-OFF vẫn hiển thị COD/QR fallback nếu enabled | 1. Tenant Card/FPX OFF, COD/QR ON.<br>2. Render checkout picker. | **THEN** COD/QR visible và selectable; Stripe hidden; submit COD/QR không gọi `/api/orders/stripe-checkout` Stripe. | High | [x] |
| **TC-F13.73** | FR-08, mobile | Component | **[RED->GREEN]** Payment rows và switches đạt 54px trên mobile | 1. Render component ở viewport 375px hoặc kiểm class/style contract.<br>2. Measure computed/min-height nếu chạy DOM. | **THEN** payment rows >= 54px, switch hit area >= 54x54px, text không overflow. | High | [x] |
| **[NHÓM 10] Tester UAT, Evidence & Release Handoff** ||||||||
| **TC-F13.74** | UAT happy path | E2E/Manual | **[Tester]** Full path Seller Connect -> Settings -> Card payment | 1. Tester dùng tenant mới.<br>2. Connect Stripe test KYC.<br>3. Bật Card+FPX.<br>4. Buyer thanh toán Card `4242`. | **THEN** tester có screenshot/video: locked state, Stripe redirect, confirmation page, Payload order `paid`, Stripe dashboard charge có application fee. | Blocker | [ ] |
| **TC-F13.75** | UAT FPX | E2E/Manual | **[Tester]** Buyer FPX payment thành công trên staging | 1. Tenant Card+FPX ON.<br>2. Buyer chọn Stripe -> FPX -> test bank. | **THEN** success URL, order `paid`, webhook received; evidence gồm browser screenshot + Stripe event ID. | Blocker | [ ] |
| **TC-F13.76** | UAT failure | E2E/Manual | **[Tester]** Failure/cancel recovery không mất cart | 1. Buyer tạo checkout rồi cancel/back hoặc dùng declined card.<br>2. Quay về storefront. | **THEN** toast BM đúng, cart vẫn còn, order không `paid`, retry tạo session mới thành công. | Blocker | [ ] |
| **TC-F13.77** | Webhook evidence | CLI/Manual | **[Tester]** Stripe CLI verify signature + duplicate replay | 1. Chạy `stripe listen --forward-to <staging>/api/webhooks/stripe`.<br>2. Trigger success event.<br>3. Replay same event. | **THEN** signature valid event xử lý 1 lần; replay ack nhưng skip; report ghi event IDs, order ID, log lines. | Critical | [ ] |
| **TC-F13.78** | Security UAT | API/Manual | **[Tester]** Tenant isolation cho connect/status/orders | 1. Login user tenant A.<br>2. Gọi onboard/status/order create với tenant/site của B. | **THEN** 401/403/404 đúng contract; không leak `stripeAccountId`, order, customer PII, hay tenant config. | Blocker | [ ] |
| **TC-F13.79** | Cross-browser/mobile | Manual/E2E | **[Tester]** Evidence đủ desktop + mobile | 1. Chạy Chrome desktop, Safari/iOS hoặc mobile emulation 375px, Android/Chrome nếu có.<br>2. Capture checkout/settings/payment states. | **THEN** không overflow, hitbox pass, text không che UI, screenshots gắn vào report. | High | [ ] |
| **TC-F13.80** | Release report | Process | **[Tester]** Test report và sumbug map đủ TC-ID | 1. Tester cập nhật `docs/qa/TEST-REPORT/F13-payment-gateway-test-report.md`.<br>2. Bug ghi vào `F13-sumbug.md` nếu có. | **THEN** mỗi TC có PASS/FAIL/BLOCKED, evidence link, env, account/test data, Stripe event ID; bug có severity, repro steps, expected/actual, owner. | Blocker | [ ] |
| **[NHÓM 11] Wave 6 Hardening - Critical Edge Cases (từ scenario gap analysis)** ||||||||
| **TC-F13.81** | S-09, idempotency | E2E/API | **[Critical]** Double-click Place Order không double-charge | 1. Buyer click Place Order 2 lần liên tiếp (200ms gap).<br>2. Spy `createStripeCheckoutSession` + DB orders. | **THEN** client disable button ngay sau click 1; backend dùng idempotency-key/lock theo orderId hoặc cart hash → chỉ 1 Stripe session, 1 order DB; không 2 charges. | Blocker | [x] |
| **TC-F13.82** | S-10, inventory | API/Race | **[Critical]** Race condition 2 buyers cùng mua product `inventory=1` | 1. Product `inventory=1`.<br>2. Đồng thời POST `/api/orders/stripe-checkout` từ 2 buyer (Promise.all). | **THEN** 1 buyer success tạo Stripe session, buyer còn lại reject 409 `OUT_OF_STOCK` TRƯỚC Stripe; hoặc cả 2 tạo session nhưng webhook flow handle oversell qua compensation refund — KHÔNG cả 2 paid với inventory=1. | Blocker | [ ] |
| **TC-F13.83** | S-25, DB outage | API/Webhook | **[Critical]** Webhook DB outage → KHÔNG ack 200 với order chưa update | 1. Mock Payload update throw connection error.<br>2. POST valid webhook `checkout.session.completed`. | **THEN** endpoint trả 500/503 để Stripe retry; KHÔNG return 200 silently; log alert error rõ; sau khi DB up retry webhook → order cập nhật `paid` đúng. | Blocker | [x] |
| **TC-F13.84** | S-35, integrity | DB/API | **[Critical]** UNIQUE constraint trên `stripeSessionId` chặn duplicate replay | 1. Order đã có `stripeSessionId='cs_test_abc'`.<br>2. Cố insert order khác cùng `stripeSessionId`. | **THEN** DB reject với unique violation; migration đảm bảo index unique tồn tại; webhook idempotency dựa trên check status hoặc unique key. | Blocker | [x] |
| **TC-F13.85** | S-37, idempotency | API/Webhook | **[Critical]** `payment_intent.payment_failed` đến SAU `checkout.session.completed` cùng order | 1. Webhook 1: success → order `paid`.<br>2. Webhook 2 (out-of-order): payment_failed cùng `orderId`. | **THEN** lần 2 detect order đã `paid` → skip update, log warning; không revert `paid → payment_failed`. | Blocker | [x] |
| **TC-F13.86** | S-18, integrity | UI/Logic | **[Critical]** Seller tắt Card/FPX sau khi buyer đã paid không retroactive | 1. Buyer hoàn tất Stripe success, order `paid`.<br>2. Seller toggle Card OFF, Save. | **THEN** order paid giữ nguyên status + `paymentMethod` lưu sẵn; không trigger refund; settings change chỉ ảnh hưởng checkout lần sau. | Critical | [x] |
| **TC-F13.87** | S-19, webhook | API/Webhook | **[Critical]** `account.application.deauthorized` lock toggles | 1. Stripe webhook gửi `account.application.deauthorized` với `accountId=acct_xxx`.<br>2. Map về tenant. | **THEN** set `tenant.stripeOnboardingComplete=false`, lock Card/FPX toggles, hiển thị alert cho seller; checkout buyer ẩn Stripe row. | Blocker | [ ] |
| **TC-F13.88** | S-02, authz | API | **[Critical]** Banned/suspended seller không tạo Stripe session được | 1. Tenant `status='suspended'` hoặc `bannedAt!=null`.<br>2. Buyer POST `/api/orders/stripe-checkout` chọn Stripe. | **THEN** API reject 403 trước khi gọi Stripe; không leak `stripeAccountId`; tenant suspended → checkout disabled từ UI. | Critical | [ ] |
| **TC-F13.89** | S-30, security | API/Sec | **[Critical]** CSRF protection cho `/api/stripe/connect/onboard` | 1. Tạo request POST từ origin khác (curl với Origin: evil.com).<br>2. Gửi với cookie session valid. | **THEN** API reject 403 (CORS/CSRF token check); không tạo Stripe account từ cross-origin POST. | Blocker | [x] |
| **TC-F13.90** | S-32, security | API/Sec | **[Critical]** Webhook signature verify bắt buộc, không bypass dù HTTPS off | 1. Test: POST raw body không signature header.<br>2. POST với `stripe-signature: bypass`. | **THEN** endpoint reject 400 trong mọi case; production phải HTTPS-only ở proxy/edge; defense-in-depth verify chạy trên mọi protocol. | Blocker | [x] |
| **TC-F13.91** | S-41, PCI/PII | Static/Log | **[Critical]** Logs không leak buyer email/PII hoặc full Stripe payload | 1. Audit `console.log/console.error` trong `src/app/api/webhooks/stripe/route.ts`, `src/lib/payment/*`, `src/app/api/orders/*`.<br>2. Trigger success + failure path. | **THEN** logs chỉ in: session ID, order ID, status, event type; KHÔNG in: buyer email full, card data, full Stripe response, secrets. | Blocker | [x] |
| **[NHÓM 12] Wave 6 Hardening - High Edge Cases (từ scenario gap analysis)** ||||||||
| **TC-F13.92** | S-06, money | Unit/API | **[High]** Order total RM 99,999.99 không overflow | 1. Order total 9999999 sen (RM 99,999.99).<br>2. Build Stripe params + fee. | **THEN** `amount=9999999`, `application_fee_amount=Math.round(9999999*0.03)=300000` (RM 3000); JS Number safe; Stripe accept; không scientific notation. | High | [x] |
| **TC-F13.93** | S-08, injection | API/Sec | **[High]** Email/name validation chặn XSS/injection trước Stripe | 1. POST `/api/orders/stripe-checkout` với `customer_email='<script>alert(1)</script>@x'`.<br>2. POST với `customerName='"><img onerror=...>'`. | **THEN** Zod/validator reject 422 hoặc sanitize; confirmation page render escaped; Stripe Checkout không nhận malformed email. | High | [x] |
| **TC-F13.94** | S-11, timing | UX | **[High]** Stripe Checkout Session expire (24h default) buyer back → toast + retry | 1. Tạo session 24h trước (mock expired).<br>2. Buyer back về app, app detect session expired. | **THEN** toast BM error rõ ràng; CTA tạo session mới; order cũ vẫn `pending`; không crash. | High | [ ] |
| **TC-F13.95** | S-12, race | E2E | **[High]** Webhook arrive trước success_url load xong | 1. Mock webhook fire trước khi browser redirect xong.<br>2. Confirmation page query DB. | **THEN** DB đã `paid` khi page load; UI hiển thị success state; không show "Awaiting payment" race state lâu. | High | [x] |
| **TC-F13.96** | S-16, retry | E2E | **[High]** Retry checkout cùng cart sau cancel tạo session MỚI | 1. Buyer cancel ở Stripe → cart preserved.<br>2. Click "Try Again". | **THEN** backend tạo Stripe session mới với new `cs_test_*`; KHÔNG dùng lại session cũ đã cancel/expire; order cũ giữ `pending` hoặc tạo order mới theo design. | High | [x] |
| **TC-F13.97** | S-17, retry | API | **[High]** Long-abandoned KYC retry sau 7+ ngày | 1. Tenant có `stripeAccountId` 7+ days, KYC chưa xong.<br>2. Seller click Connect lần nữa. | **THEN** backend tạo new `account_link` cho cùng account; không tạo account duplicate; `chargesEnabled` status refetch chính xác. | High | [x] |
| **TC-F13.98** | S-26, error | API/Robust | **[High]** Stripe API timeout/5xx khi tạo session | 1. Mock Stripe SDK throw timeout error (>10s).<br>2. POST `/api/orders/stripe-checkout` Stripe. | **THEN** backend catch lỗi; trả HTTP 503 với generic message; order KHÔNG tạo nửa vời; client hiển thị retry CTA + BM toast. | High | [x] |
| **TC-F13.99** | S-28, isolation | API/Webhook | **[High]** `notifyTenantOwners` failure không fail webhook (bug đã observed trong test stderr) | 1. Mock `notifyTenantOwners` throw (current bug: `totalDocs` undefined).<br>2. POST valid `checkout.session.completed`. | **THEN** webhook vẫn ack 200; order vẫn `paid`; notification failure log riêng + retry queue; KHÔNG để Stripe retry vô hạn vì notification lỗi. | High | [x] |
| **TC-F13.100** | S-29, authz | UI/API | **[High]** Return `?stripe=complete` khi session expired → redirect login giữ context | 1. Seller logout/cookie expired.<br>2. Stripe redirect về `?stripe=complete`. | **THEN** middleware redirect login với `?next=/dashboard/settings/payments?stripe=complete`; sau login refetch status đúng. | High | [ ] |
| **TC-F13.101** | S-34, integrity | API/Webhook | **[High]** Order đã `cancelled` trước webhook success arrive | 1. Order admin cancel → status `cancelled`.<br>2. Webhook `checkout.session.completed` arrive cho cùng order. | **THEN** detect status `cancelled` → skip update, log warning; KHÔNG revert thành `paid`; có thể trigger Stripe refund flow Wave 7+. | High | [ ] |
| **TC-F13.102** | S-46, money | Unit/API | **[High]** Currency phải MYR — reject hoặc force | 1. Tenant config currency=`USD`.<br>2. POST checkout. | **THEN** backend force `currency='myr'` HOẶC reject 422 `INVALID_CURRENCY`; FPX không available nếu non-MYR; document chính sách. | High | [x] |
| **TC-F13.103** | S-44, business | API/Logic | **[High]** Free order (coupon 100% / total=0) skip Stripe | 1. Cart sau coupon = RM 0.<br>2. Buyer click Place Order. | **THEN** backend KHÔNG tạo Stripe session; order tạo trực tiếp status `paid` với `paymentMethod='free'`; webhook không cần; flow document rõ. | High | [ ] |
| **TC-F13.104** | S-21, mobile | UI/Mobile | **[High]** Mobile 320px (iPhone SE) không overflow | 1. Viewport 320px.<br>2. Load checkout payment + settings payments. | **THEN** payment rows ≥54px height; không horizontal scroll; text không bị cắt; toggle/CTA vẫn click được. | High | [x] |
| **TC-F13.105** | S-24, a11y | A11y | **[High]** Screen-reader ARIA cho lock toggles + tooltip | 1. NVDA/VoiceOver navigate Settings not-onboarded.<br>2. Focus locked Card/FPX toggle. | **THEN** announce: `disabled, Connect Stripe to enable`; tooltip có `role=tooltip` + `aria-describedby`; alert có `role=alert`; CTA có `aria-label` rõ. | High | [ ] |
| **TC-F13.106** | S-03, abuse | API/Sec | **[High]** Rate-limit `/api/orders/stripe-checkout` chống bot/abuse | 1. Gửi 100 req/sec từ 1 IP với valid cart.<br>2. Observe Stripe API calls. | **THEN** rate-limit (token bucket hoặc Upstash) trả 429 sau threshold; không spam tạo Stripe sessions; protect cost + DB. | High | [ ] |
| **TC-F13.107** | S-45, webhook | API/Webhook | **[High]** `charge.refunded` graceful skip Wave 6 | 1. Webhook gửi `charge.refunded` event.<br>2. Wave 6 chưa handle. | **THEN** ack 200, log info "deferred Wave 7+"; server không crash; không update order nhầm; chuẩn bị structure cho Wave 7 dispute/refund. | High | [x] |
| **TC-F13.108** | S-50, PCI/PII | Log/Audit | **[High]** Webhook payload log không in `card.last4`/email full | 1. Trigger success webhook.<br>2. Scan log output. | **THEN** log chỉ có session_id, order_id, status, customer_email hash hoặc redact; KHÔNG có `payment_method.card.last4`, full email/phone/address. | High | [x] |
| **TC-F13.109** | S-36, integration | CI/Static | **[High]** Stripe SDK version locked + webhook signature version match | 1. Inspect `package.json` Stripe SDK version.<br>2. Inspect webhook signature fixture. | **THEN** Stripe SDK pinned (không `^` cho major); webhook signature fixture match SDK; CI test signature verify với fixture đúng version. | High | [x] |
| **TC-F13.110** | S-39, outage | UI/UX | **[High]** Stripe outage (5xx liên tục) UI degrade gracefully | 1. Mock Stripe SDK throw 503.<br>2. Buyer load checkout. | **THEN** Stripe row có thể disabled + banner "Payment temporarily unavailable"; COD/QR fallback vẫn work; không block toàn bộ checkout. | High | [ ] |
| **TC-F13.111** | S-27, error | API/Webhook | **[High]** Email service down post-payment không rollback order | 1. Webhook success arrive.<br>2. Mock email send throw. | **THEN** order vẫn cập nhật `paid`; email failure log + push to retry queue; KHÔNG rollback paid → pending; buyer thấy confirmation page. | High | [x] |
| **TC-F13.112** | S-13, timing | UX | **[High]** Webhook delayed 5+ phút UI fallback | 1. Mock webhook delay 5 phút.<br>2. Buyer ở confirmation page poll order status. | **THEN** UI hiển thị "Awaiting payment confirmation..." spinner; có polling hoặc websocket refetch; sau webhook arrive → toast success update. | High | [ ] |
| **TC-F13.113** | S-23, browser | E2E/Manual | **[High]** iOS Safari Private Mode third-party cookies blocked | 1. iOS Safari Private Mode.<br>2. Buyer checkout Stripe redirect. | **THEN** Stripe hosted page (first-party) vẫn work; sau success redirect về app — session cookie storefront persist; nếu broken document workaround. | High | [ ] |
| **[NHÓM 13] Wave 6 Hardening - Stripe Integration Events & Connect Guards (v1.5 gaps)** ||||||||
| **TC-F13.114** | G01, SCA | E2E | **[High]** Card với 3D Secure (SCA) authentication success | 1. Stripe Checkout với card SCA-required (e.g. `4000002500003155`).<br>2. Buyer hoàn thành OTP challenge. | **THEN** Stripe handle SCA inline; webhook `checkout.session.completed` arrive sau auth; order `paid`; evidence: Stripe event ID + screenshot 3DS challenge. | High | [ ] |
| **TC-F13.115** | G02, SCA | E2E | **[High]** Card SCA challenge fail / abandoned | 1. Card SCA-required.<br>2. Buyer nhập OTP sai / close popup. | **THEN** Order stays `pending`; BM toast `Pembayaran gagal. Sila cuba lagi.`; cart preserved; retry tạo session mới. | High | [ ] |
| **TC-F13.116** | G03, webhook | API/Webhook | **[High]** `checkout.session.expired` event (24h auto-expire) graceful handle | 1. Mock Stripe gửi `checkout.session.expired` cho session chưa paid.<br>2. POST webhook. | **THEN** endpoint ack 200, log info; order vẫn `pending` (cron sẽ cleanup); KHÔNG crash; KHÔNG nhầm `paid`. | High | [x] |
| **TC-F13.117** | G04, webhook | API/Webhook | **[High]** `payment_intent.processing` (async FPX delayed confirmation) | 1. Mock Stripe gửi `payment_intent.processing` (FPX async).<br>2. POST webhook. | **THEN** endpoint ack 200; nếu xử lý: order status `pending_payment` hoặc giữ `pending`; UI hiển thị "Processing..."; KHÔNG mark `paid` premature. | High | [x] |
| **TC-F13.118** | G05, webhook | API/Webhook | **[Medium]** `charge.succeeded` arrive sau `checkout.session.completed` (duplicate signal) | 1. Order đã `paid` qua session.completed.<br>2. Mock Stripe gửi `charge.succeeded` cùng payment intent. | **THEN** webhook ack 200, graceful skip vì order đã `paid`; KHÔNG re-process; KHÔNG duplicate email/notification. | Medium | [x] |
| **TC-F13.119** | G06, webhook | API/Webhook | **[Medium]** `payment_intent.succeeded` duplicate sau session.completed | 1. Mock `payment_intent.succeeded` sau khi đã paid. | **THEN** idempotent skip; log info "already paid via session.completed"; KHÔNG double-update. | Medium | [x] |
| **TC-F13.120** | G07, subscription | API/Webhook | **[High]** `customer.subscription.updated` cập nhật DB subscriptions | 1. Tenant có subscription active.<br>2. Mock Stripe gửi `customer.subscription.updated` với status `past_due`.<br>3. POST webhook. | **THEN** DB `subscriptions.status` cập nhật `past_due`; lưu `currentPeriodStart/End` từ event timestamps; KHÔNG impact orders. | High | [x] |
| **TC-F13.121** | G08, subscription | API/Webhook | **[Medium]** `customer.subscription.deleted` (canceled) update status | 1. Mock `customer.subscription.deleted`. | **THEN** subscription status `canceled`; tenant active flag cập nhật nếu cần; no order impact. | Medium | [x] |
| **TC-F13.122** | G09, Connect | API/Sec | **[Critical]** Connect account country=`MY` enforced — không cho onboard non-MY | 1. Backend gọi `createConnectedAccount`.<br>2. Inspect Stripe API params. | **THEN** `country: 'MY'` hardcoded trong `stripe.ts:51`; nếu future cho user chọn country thì backend whitelist `['MY']`; document policy. | Critical | [x] |
| **TC-F13.123** | G10, Connect | API/Sec | **[High]** Connect account type guard — chỉ accept `standard`, reject Express/Custom | 1. Backend `createConnectedAccount` truyền `type: 'standard'`.<br>2. Audit không có endpoint cho phép tenant chọn Express/Custom. | **THEN** `stripe.ts:49` hardcoded `type: 'standard'`; PRD Wave 6 chỉ Standard; nếu legacy Express account tồn tại → migration plan documented. | High | [x] |
| **[NHÓM 14] Wave 6 Hardening - MY Market & Stripe API Limits (v1.5 gaps)** ||||||||
| **TC-F13.124** | G11, state | E2E | **[High]** Buyer mở Stripe Checkout ở 2 tabs cùng order | 1. Tab 1 redirect Stripe.<br>2. Tab 2 mở lại cart cùng order, retry checkout. | **THEN** cùng `client_reference_id` → webhook fire 1 lần (idempotency); tab 2 detect order paid → redirect confirmation hoặc toast "Already paid"; không double-charge. | High | [ ] |
| **TC-F13.125** | G12, state | E2E | **[High]** Buyer bấm browser back từ Stripe Checkout giữa chừng | 1. Buyer ở Stripe page.<br>2. Bấm back button browser. | **THEN** app detect back-nav, hiển thị checkout state hoặc "Resume payment?" CTA; cart preserved; order vẫn `pending`. | High | [ ] |
| **TC-F13.126** | G13, state | E2E | **[Medium]** Buyer refresh Stripe Checkout page | 1. Buyer ở Stripe hosted page.<br>2. F5 refresh. | **THEN** Stripe handle (hosted); session alive trong 24h; buyer tiếp tục được; không reset form. | Medium | [ ] |
| **TC-F13.127** | G14, limit | API | **[High]** Line items > 100 (Stripe API limit) | 1. Cart có 101+ products.<br>2. POST `/api/orders/stripe-checkout`. | **THEN** backend reject 422 `TOO_MANY_ITEMS` HOẶC auto-batch trước Stripe call; KHÔNG fail mid-Stripe với generic error. | High | [x] |
| **TC-F13.128** | G15, limit | API | **[Medium]** Stripe metadata key > 500 chars hoặc > 50 keys | 1. Tạo session với metadata key dài 600 chars. | **THEN** backend truncate/reject trước Stripe; KHÔNG để Stripe API trả lỗi generic; log warn. | Medium | [x] |
| **TC-F13.129** | G16, MY tax | Logic | **[High]** MY SST 8% tính trong line items đúng | 1. Order subtotal RM 100, SST 8%.<br>2. Build Stripe line items. | **THEN** SST line item riêng `unit_amount: 800` HOẶC unit_amount đã include SST với label rõ; total Stripe = total DB; receipt hiển thị SST breakdown. | High | [x] |
| **TC-F13.130** | G17, money | Unit | **[High]** Application fee precision edge: RM 0.33 → fee 1 sen | 1. Order total 33 sen.<br>2. Build fee. | **THEN** `Math.round(33 * 0.03) = 1`; Stripe nhận integer 1; không decimal/floating. | High | [x] |
| **TC-F13.131** | G18, money | Unit | **[Medium]** Application fee = 0 cho micro-order (RM 0.10 → 0 sen) | 1. Order total 10 sen × 3% = 0.3 → round 0. | **THEN** `application_fee_amount: 0` Stripe chấp nhận; platform không thu fee cho micro-order; document edge. | Medium | [x] |
| **[NHÓM 15] Wave 6 Hardening - Schema, Auth & Reconciliation (v1.5 gaps)** ||||||||
| **TC-F13.132** | G19, input | API | **[Medium]** Customer email > 254 chars (RFC 5321 max) | 1. POST `/api/orders/stripe-checkout` với email 300 chars. | **THEN** Zod/validator reject 422 trước Stripe; KHÔNG để Stripe API trả lỗi; client toast clear. | Medium | [x] |
| **TC-F13.133** | G23, timing | UX | **[High]** Network slow > 30s khi redirect Stripe | 1. Throttle network slow 3G.<br>2. Click Place Order. | **THEN** app có timeout ≤30s với fallback "Open Stripe manually" link; KHÔNG hang forever; user có thể retry. | High | [ ] |
| **TC-F13.134** | G25, integrity | DB | **[Critical]** Order ID/orderNumber collision rejection | 1. Tạo 2 order cùng `orderNumber` (rare nếu serial sequence reset). | **THEN** DB unique constraint reject duplicate; backend retry sequence; webhook `client_reference_id` map đúng order; KHÔNG ghi nhầm payment lên order khác. | Critical | [x] |
| **TC-F13.135** | G26, replay | API/Webhook | **[Critical]** Webhook event arrive > 7 ngày tuổi (replay attack) | 1. Replay Stripe event với `created` timestamp 8 ngày trước.<br>2. POST webhook. | **THEN** Stripe SDK signature verify có default tolerance 5 phút (constructEvent); event quá cũ reject; defense-in-depth check `event.created` tuổi. | Critical | [x] |
| **TC-F13.136** | G27, contract | API/Webhook | **[Critical]** RECONCILE conflict TC-F13.83 vs implementation | 1. Compare: TC-F13.83 yêu cầu 500 cho Stripe retry khi DB outage; unit test confirm code trả 200.<br>2. Decision needed. | **THEN** Option A: fix code → 500 + Stripe retry; Option B: fix doc → 200 + cron reconciliation job; document decision trong journal + update TC-F13.83 hoặc code. | Critical | [x] |
| **TC-F13.137** | G28, PCI/PII | Static | **[High]** Stripe `metadata` không chứa PII (chỉ orderId/refs) | 1. Audit `createStripeCheckoutSession` params.<br>2. Check `metadata` và `payment_intent_data.metadata`. | **THEN** chỉ truyền `orderId` và internal refs; KHÔNG `customerEmail`, `customerName`, `phone`, `address` vào Stripe metadata; Stripe Dashboard không leak PII. | High | [x] |
| **TC-F13.138** | G29, integrity | DB/Schema | **[High]** `stripePaymentIntentId` field tồn tại + populated | 1. Inspect `src/collections/Orders.ts` schema.<br>2. Check webhook handler lưu field. | **THEN** Orders có `stripePaymentIntentId` field; webhook success/failure lưu `stripePaymentIntentId`; field tra cứu được cho refund Wave 7+. | High | [x] |
| **TC-F13.139** | G31, authz | API/Sec | **[High]** Connect onboard role check — chỉ tenant owner | 1. Login user role `staff` của tenant A.<br>2. POST `/api/stripe/connect/onboard` cho tenant A. | **THEN** API reject 403 — chỉ tenant `owner` được Stripe onboard; staff KHÔNG được tạo Connect account; protect business decision authority. | High | [x] |
| **TC-F13.140** | G32, business | API/Logic | **[Critical]** Cart cross-tenant rejection (Wave 6 single-vendor only) | 1. Cart có product A của tenant 1, product B của tenant 2.<br>2. POST `/api/orders/stripe-checkout`. | **THEN** backend reject 422 `CROSS_TENANT_CART` — Wave 6 chỉ 1 tenant/order; document multi-vendor là Wave 8+. | Critical | [x] |
| **TC-F13.141** | G33, webhook | API/Sec | **[High]** Stripe webhook signature timestamp tolerance enforced | 1. Inspect `verifyStripeWebhook` call args.<br>2. Check `tolerance` param. | **THEN** Stripe SDK `constructEvent(body, sig, secret)` default tolerance 300s (5min); KHÔNG override quá lớn; document tolerance trong runbook. | High | [x] |

1. **Seller Connect:** Seller mở `/dashboard/settings/payments`, thấy Card/FPX locked, click Connect Stripe, được redirect tới Stripe KYC hosted page, quay về `?stripe=complete`, status refetch và toggles unlock. Covers TC-F13.20, TC-F13.24, TC-F13.26.
2. **Seller Settings:** Seller bật Card + FPX, save thành công, checkout buyer hiển thị `Pay with Stripe (Card · FPX)`. Covers TC-F13.12, TC-F13.22.
3. **Buyer Card:** Buyer checkout với card `4242...`, Stripe success redirect về confirmation, webhook cập nhật order `paid`. Covers TC-F13.01, TC-F13.02, TC-F13.31, TC-F13.33.
4. **Buyer FPX:** Buyer checkout FPX test bank, Stripe/bank success, webhook cập nhật order `paid`. Covers TC-F13.09, TC-F13.10.
5. **Failure Recovery:** Buyer cancel hoặc payment fail, app hiển thị `Pembayaran gagal. Sila cuba lagi.`, cart preserved, order vẫn `pending`. Covers TC-F13.06, TC-F13.07, TC-F13.11.
6. **Defense-in-depth:** Set Card + FPX OFF, checkout ẩn Stripe row, API bypass trả 422 `NO_PAYMENT_METHODS`. Covers TC-F13.15, TC-F13.16.
7. **Mobile:** 375px checkout rows >= 54px, no overflow, Stripe hosted FPX picker touch-friendly. Covers TC-F13.18, TC-F13.19.

---

## 6. Quality Gates

| Nhóm kiểm thử | Active TCs | Gate |
|---|---:|---|
| Stripe Checkout Session - Card + FPX | 11 | 100% Blocker pass; Card + FPX sandbox success verified |
| Dynamic Picker + Mobile UX | 8 | All Blocker/High pass; 375px no overflow |
| Seller Settings + Connect Onboarding | 11 | All Blocker pass; tenant isolation pass |
| Webhook Security & Processing | 7 | 100% Blocker/Critical pass; signature + idempotency confirmed |
| Security, PCI & Env Guard | 4 | 100% Blocker pass; zero card data confirmed |
| Dev TDD Contract | 7 | RED evidence exists before implementation; tests follow `docs/TEST_CONVENTION.md` |
| Unit/API TDD - Payment Core | 14 | Targeted Vitest/API tests fail first, then pass after implementation |
| Component/UI TDD | 7 | Render tests cover Settings + Checkout states before browser UAT |
| Tester UAT + Evidence Handoff | 7 | Manual/E2E report includes screenshots, Stripe event IDs, logs, PASS/FAIL/BLOCKED |
| Wave 6 Hardening - Critical (NHÓM 11) | 11 | 100% Critical/Blocker pass; idempotency + DB outage + integrity + authz confirmed |
| Wave 6 Hardening - High (NHÓM 12) | 22 | All High pass hoặc explicit accept/defer với justification trong report |
| Stripe Integration Events & Connect Guards (NHÓM 13) | 10 | All Critical/High pass; SCA + subscription + Connect MY/Standard guards confirmed |
| MY Market & API Limits (NHÓM 14) | 8 | All High pass; SST math correct; Stripe API limits handled; multi-tab idempotent |
| Schema, Auth & Reconciliation (NHÓM 15) | 10 | 100% Critical pass; TC-F13.83 conflict resolved; cross-tenant + role-based authz confirmed |
| Deferred Wave 7+ | 4 | Not required for Wave 6 release |

**Release recommendation:** Chỉ bật Stripe Live Mode khi toàn bộ **Blocker/Critical active TCs (TC-F13.01..141)** pass trên staging Stripe Test Mode, webhook được test bằng `stripe listen --forward-to`, zero-card-data audit pass, **TC-F13.136 conflict reconcile xong** (decide 200 vs 500 + cron), và test report map đủ TC-F13.01..141. NHÓM 11..15 (hardening + integration + schema) là gate quality cho production-grade; nếu deferred phải có decision log + risk acceptance.

---

## 7. TDD Workflow Từ Coding Đến Tester Test

### 7.1. RED - Trước Khi Coding

Dev phải tạo failing tests trước khi implement các phần F13 mới. Các tests cần theo `docs/TEST_CONVENTION.md`:

- TC-ID xuất hiện trong `describe`, `it`, hoặc comment header.
- Dùng AAA pattern.
- Import từ source code thật qua alias `@/`.
- `vi.mock()` nằm top-level trước import.
- Không re-implement logic trong test.
- Không có `console.log`, empty catch, conditional assertion.

**Command gợi ý:**

```bash
npm run test -- src/__tests__/unit/payment src/__tests__/api/stripe-connect.test.ts src/__tests__/api/stripe-webhook.test.ts src/__tests__/api/orders.test.ts
```

Expected ở RED phase: tests mới fail vì behavior chưa implement hoặc contract chưa đúng. Nếu pass ngay khi chưa có code, testcase/test code đang sai.

### 7.2. GREEN - Coding Để Làm Tests Pass

Dev implement tối thiểu để pass các TC `[x] AUTO`, ưu tiên thứ tự:

1. Helper/core payment: TC-F13.53..66.
2. UI component states: TC-F13.67..73.
3. API + tenant isolation: TC-F13.57..58, TC-F13.61..66.
4. Typecheck + migration/env guards: TC-F13.51..52.

**Command gợi ý:**

```bash
npm run test
npm run typecheck
```

### 7.3. VERIFY - Trước Khi Giao Tester

Trước khi tester nhận build, dev phải cung cấp:

- Commit/PR link.
- Danh sách TC auto đã pass.
- Output `npm run test` và `npm run typecheck`.
- Test data: tenant IDs, site slug, product IDs, Stripe test account, Stripe event IDs nếu có.
- Ghi chú các TC manual còn cần tester chạy: TC-F13.74..80.

### 7.4. TESTER - Manual/E2E Evidence

Tester chạy UAT theo TC-F13.74..80 và tạo report:

- `docs/qa/TEST-REPORT/F13-payment-gateway-test-report.md`
- `docs/qa/TEST-REPORT/F13-sumbug.md` nếu có bug

Mỗi dòng report phải có: TC-ID, PASS/FAIL/BLOCKED, environment, browser/device, evidence screenshot/video/log, Stripe event ID nếu liên quan, và bug link nếu fail.

| **[NHÓM 16] Wave 6.5 — Flow Hardening (NEW, v1.6)** ||||||||
| **TC-F13.142** | FR-16, US-F13-06 | API/Logic | **[Critical]** Webhook success sets `status='new'` AND `paymentStatus='paid'` atomically | 1. Mock `checkout.session.completed` event, order pending.<br>2. Trigger webhook handler.<br>3. Spy `UPDATE orders SET` query. | **THEN** single UPDATE WHERE status='pending' executes atomically; lần 2 webhook skip vì WHERE fails; Confirm page render success; stock decremented once. | Blocker | [x] |
| **TC-F13.143** | FR-16, US-F13-06 | API/Edge | **[Critical]** `reconcileOrderPaid` idempotent — invoked twice (webhook+poll) processes exactly once | 1. Call reconcile with order ID, context='webhook'.<br>2. Immediately call reconcile again, context='poll'. | **THEN** lần 2 detect order đã `paid` → skip stock/emails/notifications; cùng 1 order không giảm kho hay gửi mail 2 lần. | Critical | [x] |
| **TC-F13.144** | FR-17, rel TC-F13.82 | API/Race | **[Critical]** Atomic stock decrement — N concurrent paid orders on stock M never go negative | 1. Product `inventory=2`.<br>2. Simultaneously POST `/api/orders/stripe-checkout` từ N=3 buyers (Promise.all).<br>3. Mock Stripe success cho cả 3, trigger webhooks concurrently. | **THEN** 2 buyers succeed paid; 1 buyer reject inventory before Stripe (or webhook handles 3rd atomically via GREATEST); inventory never <0. | Blocker | [x] |
| **TC-F13.145** | FR-18, US-F13-06 | Logic/Webhook | **[Critical]** Oversell after capture → `oversellReview=true`, order stays paid, seller SYSTEM_ALERT | 1. 2 webhooks succeed concurrently on 1 product stock=1.<br>2. Both decrement stock. | **THEN** 1st order decrements to 0, 2nd webhook detects inventory<qty → set order.oversellReview=true, order stays status='new'+paymentStatus='paid', send SYSTEM_ALERT to seller; NO auto-refund. | Critical | [x] |
| **TC-F13.146** | FR-18, US-F13-06 | Admin UI | **[High]** Seller admin "Refund customer" on oversellReview → refund API wired, status→refunded | 1. Order with oversellReview=true.<br>2. Admin panel shows "Refund customer" button.<br>3. Click button → POST `/api/orders/[id]/refund`. | **THEN** button click triggers refund flow, order paymentStatus='refunded', flag cleared; seller manually decides refund amount/method. | High | [ ] |
| **TC-F13.147** | FR-19, US-F13-06 | Webhook | **[High]** Accurate payment method (card vs fpx) from PaymentIntent on connected account | 1. Tenant card+fpx both enabled.<br>2. Buyer pays via FPX.<br>3. Webhook expands PaymentIntent on connected account. | **THEN** read payment_method → detect fpx, set order.paymentMethod='fpx' (not default 'card'). | High | [x] |
| **TC-F13.148** | FR-20, US-F13-05 | E2E/UX | **[Blocker]** **REVISED** (design change): cart cleared on placement; cancel/back → confirm Pay Now (no checkout toast) | 1. Buyer load checkout, add items.<br>2. Select Stripe, click "Place Order".<br>3. Cancel or browser-back at Stripe. | **THEN** order placed → **cart cleared on placement** (prevents duplicate orders); both cancel_url and browser-back land on `/order/[id]/confirm?cancelled=1` → Payment Failed screen with **Retry Payment** CTA (order-based retry). No checkout toast (superseded by confirm screen). | Blocker | [x] |
| **TC-F13.149** | FR-20, US-F13-05 | E2E/UX | **[High]** **REVISED** (design change): cart cleared on order placement, not at confirm success | 1. Place Stripe order.<br>2. Pay or abandon. | **THEN** cart cleared once when the order is created (before Stripe redirect), for ALL methods — retry after abandon is order-based (Pay Now re-validates stock), so cart need not persist. Confirm-page clearCart kept as idempotent safety net. | High | [x] |
| **TC-F13.150** | FR-21, US-F13-05/06, rel TC-F13.95 | E2E/UI | **[Blocker]** Confirm page: "Verifying" skeleton → auto-flips to success when paid | 1. Webhook delayed (mock 5s).<br>2. Buyer at Confirm page, order.status='pending'.<br>3. Page subscribes to live status. | **THEN** show "Verifying your payment…" skeleton; **reuses existing SSE `/api/orders/stream/[orderNumber]`** (pushes paymentStatus on change ≤5s) instead of a new 2s-poll endpoint (DRY); auto-flip to success + clearCart once when paid; no white screen/reload. | Blocker | [x] |
| **TC-F13.151** | FR-21, US-F13-05 | UI | **[High]** Confirm renders payment_failed state + explicit retry CTA | 1. Order with paymentStatus='payment_failed'.<br>2. Load Confirm page. | **THEN** show error state "Payment declined"; "Pay Now" CTA visible → POST `/api/orders/[id]/retry-payment`; no ambiguous "awaiting" state. | High | [x] |
| **TC-F13.152** | FR-21/FR-23, US-F13-06 | API/Webhook | **[Critical]** **DEFERRED** — `payment-status` active-reconcile endpoint not built; live status via SSE stream instead | — | **THEN** (US-F13-05 scope) live status uses existing SSE `/api/orders/stream/[orderNumber]`; active Stripe-session reconcile (self-heal pending→paid by querying Stripe) is a separate US-F13-06 task, not implemented here. | Critical | [ ] |
| **TC-F13.153** | FR-22, US-F13-05, rel TC-F13.96 | E2E | **[Blocker]** "Pay Now" on pending/payment_failed order → new Stripe session; blocked if already paid/cancelled/shipped | 1. Order status=pending or payment_failed.<br>2. Order detail page shows "Pay Now" CTA.<br>3. Click → POST `/api/orders/[id]/retry-payment`. | **THEN** create new stripeSessionId, return new { sessionUrl }, client redirects; once status='new'/'paid'/'shipped', button hidden. | Blocker | [x] |
| **TC-F13.154** | FR-22, US-F13-05 | API | **[High]** Pay Now re-validates stock — out of stock → friendly error, no session | 1. Order pending, product now out of stock.<br>2. POST `/api/orders/[id]/retry-payment`. | **THEN** reject 409/422, friendly "Product no longer available", do NOT create Stripe session. | High | [x] |
| **TC-F13.155** | FR-23, US-F13-06 | Cron | **[Critical]** Cron reconcile — order paid at Stripe but webhook never arrived → self-heal within one cycle | 1. Order pending > 15 min, stripeSessionId set; Stripe session shows paid.<br>2. Cron GET `/api/cron/reconcile-orders`. | **THEN** cron finds order, queries Stripe session, detects paid, calls reconcileOrderPaid() → heals to paid; log reconciled count. | Critical | [x] |
| **TC-F13.156** | FR-23, US-F13-06 | Cron/Sec | **[High]** Cron expires stale pending >24h; rejects request without valid CRON_SECRET | 1. Order pending > 24h, no stripeSessionId / session expired at Stripe.<br>2. Cron GET `/api/cron/reconcile-orders` with/without CRON_SECRET. | **THEN** cron expires stale, sets status='expired' (buyer notified); reject 401 if CRON_SECRET missing/invalid. | High | [x] |
| **TC-F13.157** | FR-18 schema, v1.6 | Schema/CI | **[Medium]** `oversell_review` column migration idempotent, check-migrations passes | 1. `scripts/db-setup.js` has entry `ALTER TABLE orders ADD COLUMN IF NOT EXISTS oversell_review BOOLEAN DEFAULT false`.<br>2. Run `node scripts/check-migrations.js origin/staging`. | **THEN** migration apply idempotent; no errors on replay; schema consistent staging/prod. | Medium | [x] |
| **TC-F13.158** | FR-22, US-F13-05 | API | **[High]** Retry handles dual failure value `'failed'` (webhook) and `'payment_failed'` (cron) | 1. Order from `payment_intent.payment_failed` webhook → status='payment_failed', paymentStatus='failed'.<br>2. POST `/api/orders/[id]/retry-payment`. | **THEN** order is retryable (NOT 409); new Stripe session created; order reset to status='pending'/paymentStatus='awaiting_payment'. Auto-cancelled order (status='cancelled') → 409 NOT_RETRYABLE. | High | [x] |
| **TC-F13.159** | FR-22, US-F13-05 | UI | **[High]** Tracking-page Pay Now gated to Stripe + both failure values; hidden for BT/COD | 1. Stripe order paymentStatus in {awaiting_payment, failed, payment_failed}.<br>2. BT order awaiting_payment.<br>3. Load tracking page. | **THEN** Pay Now shows only for Stripe (card/fpx) awaiting/failed orders; BT awaiting shows receipt-upload flow (no Stripe Pay Now); paid/cancelled hide it. | High | [x] |
| **TC-F13.160** | FR-22, US-F13-05 | API/Auth | **[High]** Buyer cancel of awaiting order via `/cancel-payment` (ct_ cookie or magic-link) | 1. Awaiting Stripe/BT order.<br>2. POST `/api/orders/[id]/cancel-payment` with ct_ cookie or `?token=`.<br>3. Repeat / paid order. | **THEN** order → cancelled (atomic CAS, no stock restore needed); ct_ cookie cleared; 401 without auth; 409 if already paid; idempotent success if already cancelled. | High | [x] |
| **TC-F13.161** | FR-20/FR-23, US-F13-05 | UX | **[High]** Browser Back from Stripe → confirm Pay Now (no checkout flash) | 1. Place Stripe order → redirect Stripe.<br>2. Press browser Back (no-store fresh load + bfcache). | **THEN** inline script (parse-time) + pageshow redirect to `/order/[id]/confirm?cancelled=1`; no checkout flash; cart already empty. | High | [x] |
| **TC-F13.162** | FR-23, US-F13-05 | Cron | **[High]** 24h payment-expiry auto-cancels unpaid Stripe (card/fpx) orders | 1. Stripe order paymentExpiresAt < now, paymentStatus in {awaiting_payment, failed, payment_failed}, status in {pending,new,payment_failed}.<br>2. Run payment-expiry job. | **THEN** order → cancelled, payment_status='payment_failed', order-expired email sent; paid/terminal orders untouched. | High | [x] |

---

## 8. Traceability Summary

| Requirement | Testcase coverage |
|---|---|
| FR-01 Card + FPX hosted Checkout | TC-F13.01, 02, 09 |
| FR-02 FPX bank dropdown by Stripe | TC-F13.10, 19 |
| FR-03 Stripe/bank return success/cancel | TC-F13.02, 07, 09, 11 |
| FR-04 BM payment failure toast | TC-F13.07, 11 |
| FR-05 Cart preserved on fail | TC-F13.06, 07, 11 |
| FR-06 Seller Card/FPX settings | TC-F13.12, 13, 14, 22, 23 |
| FR-07 Webhook order update | TC-F13.31, 32, 33, 34, 35, 36, 37 |
| FR-08 Mobile hitbox >= 54px | TC-F13.18 |
| FR-09 Native/touch-friendly FPX picker | TC-F13.19 |
| FR-10 Connect Stripe CTA/onboard | TC-F13.24, 25, 29, 30 |
| FR-11 Return `?stripe=complete` | TC-F13.26, 27 |
| FR-12 Return `?stripe=refresh` | TC-F13.28 |
| FR-13 Dynamic Stripe row label / hidden | TC-F13.12, 13, 14, 15 |
| FR-14 Disabled+Lock+Tooltip | TC-F13.20, 21 |
| FR-15 Backend 422 both-OFF | TC-F13.16 |
| **FR-16 Atomic webhook (Wave 6.5)** | **TC-F13.142, 143** |
| **FR-17 Atomic stock (Wave 6.5)** | **TC-F13.144** |
| **FR-18 Oversell flag + seller notify (Wave 6.5)** | **TC-F13.145, 146** |
| **FR-19 Accurate payment method (Wave 6.5)** | **TC-F13.147** |
| **FR-20 Cart handling (Wave 6.5)** | **TC-F13.148, 149, 161** (revised: cart cleared on placement; back→confirm) |
| **FR-21 Confirm polling + self-heal (Wave 6.5)** | **TC-F13.150, 151** (SSE stream); **152 deferred to US-F13-06** |
| **FR-22 Pay Now retry (Wave 6.5)** | **TC-F13.153, 154, 158, 159, 160** |
| **FR-23 Cron reconcile (Wave 6.5)** | **TC-F13.155, 156, 162** (Stripe 24h auto-cancel) |
| Dev RED test hygiene | TC-F13.46, 47, 48, 49, 50 |
| Typecheck/migration/env coding gates | TC-F13.51, 52, 64 |
| Payment core unit/API coverage | TC-F13.53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 65, 66 |
| Component/UI coding coverage | TC-F13.67, 68, 69, 70, 71, 72, 73 |
| Tester UAT and release evidence | TC-F13.74, 75, 76, 77, 78, 79, 80 |
| Idempotency / Race / Concurrency | TC-F13.81 (double-click), TC-F13.82 (inventory race), TC-F13.84 (UNIQUE stripeSessionId), TC-F13.85 (out-of-order webhook) |
| DB / Stripe / Email outage resilience | TC-F13.83 (DB down), TC-F13.98 (Stripe timeout), TC-F13.99 (notify failure), TC-F13.110 (Stripe outage), TC-F13.111 (email down) |
| Authz / Security hardening | TC-F13.88 (banned seller), TC-F13.89 (CSRF), TC-F13.90 (signature mandatory), TC-F13.100 (expired session) |
| Webhook integrity edge | TC-F13.87 (deauthorized), TC-F13.95 (race success_url), TC-F13.101 (cancelled-then-success), TC-F13.107 (charge.refunded skip) |
| Settings retroactive guard | TC-F13.86 (post-paid setting change), TC-F13.96 (retry expired session) |
| Money / Currency / Free order | TC-F13.92 (max RM 99,999.99), TC-F13.102 (currency MYR), TC-F13.103 (free order) |
| Input validation / Abuse | TC-F13.93 (email injection), TC-F13.106 (rate-limit) |
| PCI/PII log audit | TC-F13.91 (zero PII logs), TC-F13.108 (webhook payload log) |
| Mobile / A11y deep | TC-F13.104 (320px), TC-F13.105 (ARIA lock), TC-F13.113 (iOS Private Mode) |
| Integration robustness | TC-F13.94 (session expire), TC-F13.97 (long-abandoned KYC), TC-F13.109 (SDK version), TC-F13.112 (delayed webhook) |
| SCA / 3D Secure | TC-F13.114 (SCA success), TC-F13.115 (SCA fail) |
| Stripe webhook event coverage | TC-F13.116 (session.expired), TC-F13.117 (payment_intent.processing), TC-F13.118 (charge.succeeded dup), TC-F13.119 (payment_intent.succeeded dup), TC-F13.120 (subscription.updated), TC-F13.121 (subscription.deleted) |
| Stripe Connect guard | TC-F13.122 (country=MY), TC-F13.123 (type=standard), TC-F13.139 (role-based) |
| Multi-tab / Browser nav | TC-F13.124 (multi-tab idempotent), TC-F13.125 (browser back), TC-F13.126 (refresh on Stripe) |
| Stripe API limits | TC-F13.127 (line items >100), TC-F13.128 (metadata size) |
| MY tax / Money | TC-F13.129 (SST in line items), TC-F13.130 (fee precision), TC-F13.131 (fee=0 micro) |
| Schema / Authz / Multi-vendor | TC-F13.132 (email max length), TC-F13.133 (slow network), TC-F13.134 (order ID collision), TC-F13.138 (`stripePaymentIntentId` field), TC-F13.140 (cross-tenant cart) |
| Webhook signature replay | TC-F13.135 (event >7 days), TC-F13.141 (timestamp tolerance) |
| Contract reconciliation | TC-F13.136 (TC-F13.83 conflict: 200 vs 500) |
| PII in Stripe metadata | TC-F13.137 (no PII in metadata) |
