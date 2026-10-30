# Quyết Định Kiểm Thử & Testcase Chi Tiết: F34 - Xendit Payment Integration

> **Phiên bản:** 1.2 | **Cập nhật:** 2026-06-12 | **Thực hiện:** QA Team
> **Nguồn tham chiếu:** `docs/prd/F34-xendit-payment.md` (v4.0), `docs/architecture/F34-xendit-payment.md` (nếu có), `docs/qa/scenarios/F34-xendit-payment.md` (86 scenarios)
> **Reference code (F13 patterns reused):** `src/lib/payment/reconcile-order-paid.ts`, `src/lib/payment/types.ts` (`PaymentProvider`)
> **Kỹ thuật:** BDD (Gherkin), BVA, State Transition (account lifecycle + order lifecycle + refund accumulate), Concurrency (CAS stock + atomic reconcile single-winner), Security (`x-callback-token` timing-safe + IDOR + PCI/PDPA non-handling), Provider-Agnostic Integration (Xendit + Stripe routing), NON-CUSTODY guardrails
> **Tổng TCs:** 219 (TC-F34X-01-01 → TC-F34X-23-16)
> **Status:** PRD v4.0 Draft — chưa start implementation; testcase chuẩn bị sẵn cho Phase A → B → C

---

## 1. Mục Tiêu

Bộ testcase này kiểm thử đầy đủ F34 — Xendit Payment Integration cho thị trường Malaysia:

- **US-F34-01..02 (Phase A):** Merchant onboarding qua MANAGED sub-account + hosted KYB Xendit (không tự dựng form).
- **US-F34-03 (Phase A webhook):** Lifecycle account status sync realtime (INVITED→REGISTERED→AWAITING_DOCS→PENDING_VERIFICATION→LIVE/SUSPENDED).
- **US-F34-04..05 (Phase B):** Hosted checkout đa ví (TNG/GrabPay/ShopeePay/DuitNow QR/FPX/CARDS) qua Payment Requests `/v3`.
- **US-F34-06 (Phase B webhook):** Webhook verify `x-callback-token` timing-safe + `reconcileOrderPaid()` atomic single-winner.
- **US-F34-07 (Phase C):** Refund partial/full + webhook `refund.succeeded`/`refund.failed`.
- **US-F34-08 (Phase C reconcile):** Cron self-heal webhook trễ/mất + payment expiry 24h.
- **US-F34-09 (Phase C disburse):** Auto-Withdrawal Dashboard + optional payout chủ động + balance display.

**Business Rule cốt lõi:**

- **BR-01:** Xendit là source of truth cho payment state; PW2 nhận webhook + reconcile, không chủ động query trừ trong cron self-heal.
- **BR-02:** Mỗi merchant = 1 MANAGED sub-account; mọi API call merchant đính header `for-user-id: {xenditAccountId}`.
- **BR-03:** Tiền **LUÔN** settle vào balance sub-account merchant → bank merchant. **TUYỆT ĐỐI KHÔNG** qua balance master (NON-CUSTODY).
- **BR-04: NFR-5b CRITICAL** — Xendit MYR = **RM (major unit)**, Stripe MYR = **sen**. Order DB lưu sen → **/100 trước khi gọi Xendit**, **×100 khi đối chiếu webhook**. Sai = lệch 100× (rủi ro pháp lý lớn).
- **BR-05:** PAN/CVV/ví/QR đi **thẳng buyer → Xendit hosted**, **0 byte qua server Prime** (PCI). KYB doc nộp **trên trang hosted Xendit**, **0 doc qua server Prime** (PDPA).
- **BR-06:** Webhook verify `x-callback-token` **timing-safe** (`timingSafeEqual`) trước mọi xử lý; sai → 401 (NFR-1).
- **BR-07:** Webhook fail nhiều lần → luôn trả **200** (tránh Xendit retry vô hạn); reconcile bù qua cron.
- **BR-08:** Stock decrement **CAS upfront** lúc checkout → giữ chỗ **24h**. `payment.failure` **KHÔNG restock ngay** (buyer retry). Cancel chủ động hoặc cron 24h → restock.
- **BR-09:** `reconcileOrderPaid()` **atomic single-winner** — 1 transition pending→paid bất kể bao nhiêu trigger (webhook/poll/cron).
- **BR-10:** `reference_id` = `orderId` (unique cho CARDS); idempotent tạo payment_request.
- **BR-11:** Refund partial accumulate; total refunded ≤ paid; sau full → `refunded`; chặn double-refund.
- **BR-12:** Payout chủ động dùng `Idempotency-key` chống double-payout.
- **BR-13:** Routing: Xendit cho ví MY/QR/FPX khi tenant LIVE; Stripe cho thẻ quốc tế / merchant non-MY (giữ nguyên F13).
- **BR-14:** Account status ≠ `LIVE` → checkout 422 `XENDIT_NOT_READY`, KHÔNG tạo order, KHÔNG giảm stock.
- **BR-15:** NON-CUSTODY: **KHÔNG** dùng Transfers API; **KHÔNG** hold/freeze balance sub-account; payout LUÔN từ sub-account → bank.

---

## 2. Test Environment

| Thông số | Yêu cầu |
|---|---|
| Môi trường | Staging / Pre-Production / Sandbox Xendit |
| Trình duyệt (E2E) | Chrome v120+, Safari iOS (TNG deep-link test), Samsung S22 |
| Backend | Next.js 15 + Payload CMS 3 + PostgreSQL (Neon) |
| Test runner | Vitest 3 (unit + integration) + Playwright (E2E) |
| Xendit sandbox | Test secret key + test callback token + simulator events |
| Test cards | Xendit test card success/declined/3DS |
| Test e-wallets | Xendit simulator TNG/GrabPay/ShopeePay |
| Test FPX | Xendit FPX test bank |
| Auth fixtures | `BEARER_SUPER_ADMIN`, `BEARER_TENANT_OWNER`, `BEARER_TENANT_STAFF`, `BEARER_GUEST` |
| Tenant fixtures | `tenant-NEW` (no Xendit), `tenant-INVITED`, `tenant-AWAITING`, `tenant-LIVE`, `tenant-SUSPENDED`, `tenant-DUAL` (Xendit+Stripe) |
| Currency | MYR (RM); DB lưu sen (smallest unit); **Xendit gọi RM major unit** |
| Timezone | Asia/Kuala_Lumpur UI; UTC DB |
| SLA | Webhook → paid p95 < 30s · checkout API p95 < 4s · settings load < 1s |
| Webhook tools | `ngrok` cho local; Xendit Dashboard "Replay Event" |
| Stock seed | Product có inventory = 1, 3, 10, 100, 0 (out) cho boundary tests |

---

## 3. Scope Kiểm Thử

### In Scope

- **Phase A:** `POST /api/xendit/connect` (idempotent), redirect onboarding hosted Xendit, 4 webhook events account.*, settings UI 5 trạng thái.
- **Phase B:** `POST /api/orders/xendit-checkout`, Payment Requests `/v3` cho 6 channel (TOUCHNGO/GRABPAY/SHOPEEPAY/DUITNOW_QR/FPX/CARDS), REDIRECT vs PRESENT mode, webhook payment.capture/authorization/failure verify timing-safe, `reconcileOrderPaid()` provider-agnostic, stock CAS, cancel/retry, self-heal poll.
- **Phase C:** `POST /api/orders/[id]/refund` provider=xendit (partial/full), webhook refund.*, cron reconcile pending + payment-expiry, GET /balance UI, optional `POST /api/xendit/payout` với Idempotency-key.
- **Routing:** Xendit (MY) vs Stripe (international) — không cross-process, không double-charge.
- **NON-CUSTODY audit:** đảm bảo codebase KHÔNG có call Transfers API, mọi PaymentRequest có `for-user-id`.
- **Currency conversion:** RM ↔ sen test regression (NFR-5b).
- **Security:** webhook signature, IDOR, PCI 0-byte, PDPA 0-doc.

### Out of Scope (F34)

- Saved cards / tokenized re-purchase.
- Multi-currency payout (chỉ MYR).
- Platform thu phí giao dịch (pure SaaS — merchant chịu MDR).
- Cash on Delivery (thuộc F19 Manual Methods).
- Đổi mô hình custody (giữ MANAGED).
- Stripe regression test (đã cover ở F13).

---

## 4. Quản Lý Truy Vết (Traceability Matrix)

| Khu vực Nghiệp Vụ | User Story | FR Reference | AC Reference | Tổng TCs |
|:---|:---|:---|:---|:---:|
| **1. Phase A — Onboarding API** | US-F34-01 | A-1, A-2, A-3, A-4, A-11 | AC-A1, A2, A3, A4, A11 | 12 |
| **2. Phase A — Webhook lifecycle** | US-F34-03 | A-5, A-6, A-7, A-8 | AC-A5, A6, A7, A10 | 11 |
| **3. Phase A — Settings UI status** | US-F34-02 | A-9, A-10 | AC-A8 | 8 |
| **4. Phase B — Checkout API** | US-F34-04 | B-1, B-2, B-3, B-4, B-11 | AC-B1, B2, B9, B11 | 18 |
| **5. Phase B — Payment methods build** | US-F34-05 | B-5, B-10, B-13 | AC-B9, B10 | 9 |
| **6. Phase B — Webhook verify + reconcile** | US-F34-06 | B-6, B-7, B-8, B-9, B-12 | AC-B3, B4, B5, B7, B8 | 14 |
| **7. Phase B — Stock CAS + retry + cancel** | US-F34-05 | B-2, B-13 | AC-B6, B10 | 11 |
| **8. Phase C — Refund** | US-F34-07 | C-1, C-2, C-3, C-10 | AC-C1, C2, C3, C4, C5 | 13 |
| **9. Phase C — Reconcile cron** | US-F34-08 | C-4, C-5 | AC-C6, C7 | 7 |
| **10. Phase C — Disburse (balance + payout)** | US-F34-09 | C-6, C-7, C-8, C-9 | AC-C8, C9, C10 | 9 |
| **11. Routing Xendit vs Stripe** | US-F34-04 | B-11 | AC-B11 | 6 |
| **12. NON-CUSTODY guardrails** | — | NFR (pháp lý) | — | 5 |
| **13. Currency conversion (NFR-5b)** | US-F34-04, C-7 | NFR-5b | — | 9 |
| **14. Security & PCI/PDPA** | — | NFR-1, NFR-3 | — | 11 |
| **15. E2E Golden Path** | US-F34-01..09 | All | All | 8 |
| **16. DB Schema Migration (v1.1)** | — | All schema-affecting FRs | — | 8 |
| **17. Generalize reconcileOrderPaid (v1.1)** | US-F34-06 | B-9, BR-09 | AC-B7 | 5 |
| **18. Performance NFR-8 (v1.1)** | — | NFR-8, NFR-9 | — | 4 |
| **19. Compliance & Audit Log (v1.1)** | — | NFR-3 + Research Sub-Account Liability | — | 5 |
| **20. Open Questions Resolution (v1.1)** | — | PRD §11 [NEED] 1-8 | — | 8 |
| **21. Checkout UI Buyer-Facing (v1.2)** | US-F34-04, 05 | B-4, B-5, B-3, B-11, B-12, B-13 | — | 12 |
| **22. Order Detail UI Seller View (v1.2)** | US-F34-07 | C-1, C-2, C-3, BR-11 | AC-C1..C4 | 10 |
| **23. Order Detail Buyer + Connect + Balance UI (v1.2)** | US-F34-02, 04, 09 | A-1, A-9, B-10, B-13, C-6, C-8 | AC-A8 | 16 |
| **Tổng cộng** | | | | **219** |

---

## 5. CHI TIẾT TEST CASES

---

### NHÓM 01 — Phase A: Onboarding API (12 TCs) — `POST /api/xendit/connect`

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-01-01** | `A-1, A-2, AC-A1, AC-A2` | `API` `[Positive]` | Connect Payment tạo MANAGED sub-account lần đầu | 1. Bearer tenant-owner.<br>2. POST `/api/xendit/connect` (tenant-NEW chưa có xenditAccountId).<br>3. Inspect Xendit API call + DB. | **GIVEN** tenant chưa connect<br>**WHEN** POST connect<br>**THEN** call `POST /v2/accounts` với `{email, type:'MANAGED', public_profile:{business_name}}`; DB lưu `xenditAccountId` + `xenditAccountStatus='INVITED'`; response trả onboarding URL. HTTP 200. | Blocker | [x] |
| **TC-F34X-01-02** | `A-3, AC-A3` | `API` `[Positive]` | Idempotent: connect lần 2 → không tạo account mới | 1. Pre: tenant-INVITED đã có xenditAccountId.<br>2. POST connect lần 2.<br>3. Inspect Xendit calls + DB. | **THEN** KHÔNG call `POST /v2/accounts`; chỉ call `GET /v2/accounts/{id}` để refresh status + trả onboarding URL. HTTP 200. DB không có account thứ 2. | Blocker | [x] |
| **TC-F34X-01-03** | `A-2` | `API` `[Positive]` | Payload chuẩn gửi Xendit: type + email + business_name | 1. POST connect tenant `business_name='Acme Sdn Bhd'`, `email='owner@acme.test'`.<br>2. Inspect request body sent to Xendit. | - Request body chứa `type:'MANAGED'`, `email:'owner@acme.test'`, `public_profile:{business_name:'Acme Sdn Bhd'}`. | Khẩn | [x] |
| **TC-F34X-01-04** | `A-2` | `Logic` `[Edge]` | business_name Unicode + emoji | 1. POST connect `business_name='Acme 商店 🚀 Sdn Bhd'`. | - Lưu UTF-8 đúng vào DB và gửi Xendit không bị encode loss. | High | [x] |
| **TC-F34X-01-05** | `A-2` | `Valid` `[Negative]` | Email invalid format | 1. POST connect với `email='not-an-email'`. | - HTTP 400 validation lỗi trước khi call Xendit. | High | [x] |
| **TC-F34X-01-06** | `A-4, AC-A4` | `API` `[Positive]` | Onboarding URL trả về để redirect | 1. POST connect.<br>2. Inspect response. | - Response có field `onboardingUrl` (hoặc tương đương) — unique link cho tenant đó.<br>- URL trỏ về domain Xendit hosted. | Khẩn | [x] |
| **TC-F34X-01-07** | `A-11, AC-A11` | `Sec` `[Negative]` | `XENDIT_SECRET_KEY` chưa set | 1. Mock env không có `XENDIT_SECRET_KEY`.<br>2. POST connect. | - HTTP 503 hoặc startup-fail với error code rõ `XENDIT_CONFIG_ERROR`.<br>- KHÔNG 500 mơ hồ.<br>- KHÔNG lộ secret trong message. | Khẩn | [x] |
| **TC-F34X-01-08** | `A-11` | `Error` `[Negative]` | Xendit API 500 khi tạo account | 1. Mock Xendit `POST /v2/accounts` trả 500.<br>2. POST connect. | - HTTP 502 `XENDIT_CONNECT_FAILED`.<br>- DB không lưu xenditAccountId (rollback).<br>- Tenant không kẹt status sai. | Khẩn | [x] |
| **TC-F34X-01-09** | `A-1, AC-A1` | `Sec` `[Negative]` | Bearer không có → 401 | 1. POST connect không Authorization header. | - HTTP 401. | Blocker | [x] |
| **TC-F34X-01-10** | `A-1` | `Sec` `[Negative]` | IDOR: tenant A connect với xenditAccountId của tenant B | 1. Bearer tenant-A.<br>2. POST connect với body chứa xenditAccountId của tenant-B. | - HTTP 403 hoặc body bị ignore; xenditAccountId luôn lookup theo `session.tenantId`, không từ payload. | Khẩn | [x] |
| **TC-F34X-01-11** | `A-2` | `API` `[Edge]` | tenant-SUSPENDED gọi lại connect | 1. Pre: status='SUSPENDED'.<br>2. POST connect. | - Không tạo account mới; trả lại onboarding URL hoặc thông báo SUSPENDED rõ ràng.<br>- Document handle theo PRD (chưa rõ → mark `[NEED]`). | Medium | [x] |
| **TC-F34X-01-12** | `A-2` | `API` `[Edge]` | Tenant email được dùng đúng | 1. POST connect; tenant.email = `owner@acme.test`. | - Request Xendit `email:'owner@acme.test'` (không phải session user email khác). | High | [x] |

---

### NHÓM 02 — Phase A: Webhook lifecycle (11 TCs) — `POST /api/webhooks/xendit` (account events)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-02-01** | `A-5, AC-A5` | `API` `[Positive]` | Callback URL set tới `/api/webhooks/xendit` | 1. Verify config trong code hoặc Dashboard.<br>2. Trigger event Xendit test. | - Webhook đến đúng endpoint.<br>- Verify token đúng. | Khẩn | [x] |
| **TC-F34X-02-02** | `A-6, AC-A5` | `API` `[Positive]` | Webhook `account.created` → mark ready transact | 1. POST webhook `{event:'account.created', data:{id:xenditAccountId}}` với token đúng.<br>2. Query DB. | - `xenditAccountStatus` cập nhật phù hợp; flag `ready_to_transact=true` (chưa LIVE).<br>- Response 200. | Khẩn | [x] |
| **TC-F34X-02-03** | `A-7, AC-A6` | `API` `[Positive]` | Webhook `account.updated` REGISTERED | 1. POST webhook `{event:'account.updated', data:{status:'REGISTERED'}}`. | - `xenditAccountStatus='REGISTERED'`. UI hiện "đang duyệt". | Khẩn | [x] |
| **TC-F34X-02-04** | `A-7, AC-A6` | `API` `[Positive]` | Webhook `account.updated` AWAITING_DOCS | 1. POST webhook status='AWAITING_DOCS'. | - DB update đúng.<br>- UI hiện "đang chờ doc". | High | [x] |
| **TC-F34X-02-05** | `A-7, AC-A6` | `API` `[Positive]` | Webhook `account.updated` PENDING_VERIFICATION | 1. POST status='PENDING_VERIFICATION'. | - DB update đúng. | High | [x] |
| **TC-F34X-02-06** | `A-8, AC-A7` | `API` `[Positive]` | Webhook `account.activated` → LIVE + checkout unlock | 1. POST `{event:'account.activated'}`.<br>2. Query DB. | - `xenditAccountStatus='LIVE'`, `xenditOnboardingComplete=true`.<br>- Tenant đủ điều kiện Phase B checkout. | Blocker | [x] |
| **TC-F34X-02-07** | `A-7, AC-A10` | `API` `[Positive]` | Webhook `account.suspended` → SUSPENDED + chặn checkout | 1. POST `{event:'account.suspended'}`.<br>2. Tenant LIVE → SUSPENDED.<br>3. Buyer thử checkout. | - DB status='SUSPENDED'.<br>- Checkout trả 422.<br>- UI banner cảnh báo đỏ. | Khẩn | [x] |
| **TC-F34X-02-08** | `A-7, BR-06, NFR-1, AC-A9` | `Sec` `[Negative]` | Webhook `x-callback-token` sai → 401, KHÔNG xử lý | 1. POST webhook với token sai.<br>2. Inspect DB. | - HTTP 401.<br>- DB KHÔNG update.<br>- Verify dùng `timingSafeEqual` (resistant timing attack). | Blocker | [x] |
| **TC-F34X-02-09** | `BR-07` | `API` `[Edge]` | Webhook trùng (Xendit retry cùng event) | 1. POST webhook `account.activated` 2 lần liên tiếp. | - DB chỉ transition 1 lần (idempotent).<br>- Cả 2 trả 200. | Khẩn | [x] |
| **TC-F34X-02-10** | `BR-06` | `Sec` `[Negative]` | Webhook không có header token | 1. POST không header `x-callback-token`. | - HTTP 401. | Khẩn | [x] |
| **TC-F34X-02-11** | `A-7` | `API` `[Edge]` | Webhook unknown event type | 1. POST `{event:'account.something_new'}` với token đúng. | - Log warning, return 200 (không crash, không retry storm).<br>- DB không thay đổi. | High | [x] |

---

### NHÓM 03 — Phase A: Settings UI Status (8 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-03-01** | `A-9, AC-A8` | `UI` `[Positive]` | tenant-NEW thấy "Connect Payment" button | 1. Login tenant-NEW.<br>2. Vào settings/payments. | - Nút "Connect Payment" hiển thị.<br>- Không có badge/status. | Blocker | [x] |
| **TC-F34X-03-02** | `A-9` | `UI` `[Positive]` | tenant-INVITED thấy "Tiếp tục onboarding" + link | 1. Settings page tenant status='INVITED'. | - Nút "Tiếp tục onboarding" mở onboarding URL Xendit. | Blocker | [x] |
| **TC-F34X-03-03** | `A-9` | `UI` `[Positive]` | tenant-AWAITING_DOCS thấy banner "Đang duyệt 1-5 ngày" | 1. Settings status='AWAITING_DOCS'. | - Banner thông báo.<br>- Nút "Mở lại onboarding" nếu dở dang. | High | [x] |
| **TC-F34X-03-04** | `A-9` | `UI` `[Positive]` | tenant-LIVE thấy badge xanh + checkout unlocked | 1. Settings status='LIVE'. | - Badge LIVE màu xanh.<br>- Card/FPX/wallet toggles enabled. | Khẩn | [x] |
| **TC-F34X-03-05** | `A-9` | `UI` `[Positive]` | tenant-SUSPENDED thấy cảnh báo đỏ + chặn checkout | 1. Settings status='SUSPENDED'. | - Cảnh báo đỏ.<br>- Cả storefront checkout button hidden hoặc disabled. | Khẩn | [x] |
| **TC-F34X-03-06** | `A-10` | `API` `[Positive]` | `GET /api/xendit/connect/status` đọc cached status | 1. Pre: status='LIVE' trong DB.<br>2. GET status. | - Trả `{status:'LIVE'}` < 100ms (cached).<br>- KHÔNG call Xendit. | High | [x] |
| **TC-F34X-03-07** | `A-10` | `API` `[Positive]` | Refresh on-demand → call `GET /v2/accounts/{id}` | 1. POST hoặc GET `/api/xendit/connect/status?refresh=true`. | - Call Xendit GET account.<br>- Cập nhật DB status nếu lệch. | High | [x] |
| **TC-F34X-03-08** | `A-9` | `UI` `[Edge]` | Merchant rời KYB giữa chừng → quay lại Prime | 1. Pre: webhook `account.updated` REGISTERED đã nhận; merchant chưa hoàn KYB.<br>2. Login lại Prime, vào settings. | - Status REGISTERED hiển thị.<br>- Nút "Mở lại onboarding" trỏ đúng URL Xendit (resumable). | Khẩn | [ ] |

---

### NHÓM 04 — Phase B: Checkout API (18 TCs) — `POST /api/orders/xendit-checkout`

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-04-01** | `B-1, BR-14, AC-B1` | `API` `[Positive]` | Tenant LIVE + buyer checkout TNG → tạo order pending + payment request | 1. Pre: tenant-LIVE, product inventory=10.<br>2. POST `/api/orders/xendit-checkout` với cart + channel='TOUCHNGO'.<br>3. Inspect DB + Xendit API call. | **THEN** HTTP 200; order DB `status='pending', payment_provider='xendit', xenditPaymentRequestId` lưu; stock giảm 1 (CAS); response trả redirect URL. | Blocker | [ ] |
| **TC-F34X-04-02** | `B-1, BR-14, AC-B2` | `API` `[Negative]` | Tenant chưa LIVE → 422 XENDIT_NOT_READY | 1. Pre: tenant-INVITED.<br>2. POST xendit-checkout. | - HTTP 422 `{code:'XENDIT_NOT_READY'}`.<br>- KHÔNG tạo order.<br>- KHÔNG giảm stock. | Blocker | [x] |
| **TC-F34X-04-03** | `B-1, BR-14` | `API` `[Negative]` | Tenant SUSPENDED → 422 | 1. Pre: SUSPENDED.<br>2. POST checkout. | - 422. | Khẩn | [x] |
| **TC-F34X-04-04** | `B-2, AC-B6` | `API` `[Negative]` | Stock=0 → 409 OUT_OF_STOCK | 1. Pre: inventory=0.<br>2. POST checkout. | - 409 `OUT_OF_STOCK`.<br>- KHÔNG tạo order.<br>- KHÔNG call Xendit. | Blocker | [x] |
| **TC-F34X-04-05** | `B-2, AC-B6` | `Race` `[Concurrency]` | Stock=1, 2 buyer concurrent | 1. Pre: inventory=1.<br>2. Promise.all 2 POST checkout. | - 1 thành công + 1 nhận 409.<br>- CAS guarantee: chỉ 1 record order tạo. | Blocker | [ ] |
| **TC-F34X-04-06** | `B-3, BR-10` | `API` `[Positive]` | `reference_id = orderId` (unique CARDS) | 1. POST checkout channel='CARDS'.<br>2. Inspect Xendit payload. | - Request có `reference_id=orderId` (unique).<br>- Idempotent: re-call same order không tạo payment_request mới. | Khẩn | [x] |
| **TC-F34X-04-07** | `B-3` | `API` `[Positive]` | Header `for-user-id` đúng xenditAccountId | 1. POST checkout.<br>2. Inspect HTTP request to Xendit. | - Header `for-user-id: {tenant.xenditAccountId}`.<br>- KHÔNG dùng platform master id. | Blocker | [x] |
| **TC-F34X-04-08** | `B-4` | `API` `[Positive]` | Channel TOUCHNGO REDIRECT mode | 1. POST channel='TOUCHNGO'. | - Response có redirect URL.<br>- `mode='REDIRECT'`. | Khẩn | [x] |
| **TC-F34X-04-09** | `B-4` | `API` `[Positive]` | Channel GRABPAY REDIRECT | 1. POST channel='GRABPAY'. | - Redirect URL trả. | High | [x] |
| **TC-F34X-04-10** | `B-4` | `API` `[Positive]` | Channel SHOPEEPAY REDIRECT | 1. POST channel='SHOPEEPAY'. | - Redirect URL. | High | [x] |
| **TC-F34X-04-11** | `B-4` | `API` `[Positive]` | Channel DUITNOW_QR PRESENT mode | 1. POST channel='DUITNOW_QR'. | - Response có QR code data (PRESENT, không redirect).<br>- Buyer ở lại trang. | Khẩn | [x] |
| **TC-F34X-04-12** | `B-4` | `API` `[Positive]` | Channel FPX REDIRECT | 1. POST channel='FPX'. | - Redirect URL. | High | [x] |
| **TC-F34X-04-13** | `B-4` | `API` `[Positive]` | Channel CARDS REDIRECT | 1. POST channel='CARDS'. | - Redirect URL. | High | [x] |
| **TC-F34X-04-14** | `B-4` | `Valid` `[Negative]` | Channel code unknown (typo `TUCHNGO`) | 1. POST channel='TUCHNGO'. | - HTTP 400 trước khi call Xendit. | High | [x] |
| **TC-F34X-04-15** | `B-3, BR-09` | `API` `[Edge]` | Same orderId checkout 2 lần (idempotent) | 1. POST checkout orderId=X.<br>2. POST lại same orderId. | - Lần 2 KHÔNG tạo payment_request mới.<br>- Trả lại existing redirect URL hoặc state hiện tại. | Khẩn | [x] |
| **TC-F34X-04-16** | `B-3` | `Error` `[Negative]` | Xendit `POST /v3/payment_requests` fail → rollback | 1. Mock Xendit trả 500.<br>2. POST checkout. | - HTTP 502 / 503.<br>- Order pending rollback (xóa hoặc cancel).<br>- Stock restock ngay. | Khẩn | [x] |
| **TC-F34X-04-17** | `B-1` | `Valid` `[Negative]` | Amount = 0 (free order) | 1. POST checkout cart total=0. | - HTTP 400 reject hoặc skip payment flow. | High | [x] |
| **TC-F34X-04-18** | `B-1` | `Valid` `[Negative]` | Amount âm | 1. POST checkout cart có item negative price (manipulation). | - HTTP 400.<br>- KHÔNG call Xendit. | Khẩn | [x] |

---

### NHÓM 05 — Phase B: Payment Methods Build (9 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-05-01** | `B-5` | `API` `[Positive]` | Tenant bật TNG + Card → buildPaymentMethodTypes trả cả 2 | 1. Pre: tenant LIVE, settings enable TNG + Card.<br>2. GET storefront checkout config. | - List methods chứa TOUCHNGO + CARDS. | High | [x] |
| **TC-F34X-05-02** | `B-5` | `API` `[Negative]` | Tenant tắt toàn bộ Xendit → 422 NO_PAYMENT_METHODS | 1. Pre: tenant LIVE, disable hết methods.<br>2. POST checkout. | - HTTP 422 `NO_PAYMENT_METHODS`. | High | [x] |
| **TC-F34X-05-03** | `B-5` | `API` `[Positive]` | Site override tenant: enable FPX only | 1. Site config FPX only.<br>2. Checkout. | - Chỉ FPX khả dụng. | Medium | [x] |
| **TC-F34X-05-04** | `B-10, AC-B8` | `API` `[Positive]` | Self-heal poll: confirm page pending → check status → reconcile | 1. Pre: order pending nhưng webhook chưa đến.<br>2. Confirm page poll endpoint.<br>3. Mock Xendit GET payment_request trả SUCCEEDED. | - Reconcile → status='new', paid. < 30s. | Khẩn | [ ] |
| **TC-F34X-05-05** | `B-10` | `API` `[Edge]` | Poll khi Xendit còn pending | 1. Pre: order pending, Xendit cũng PENDING.<br>2. Poll. | - Không reconcile.<br>- Trả "still pending". | High | [x] |
| **TC-F34X-05-06** | `B-13` | `API` `[Positive]` | retry-payment route hỗ trợ provider=xendit | 1. Pre: order pending xendit, payment_failed.<br>2. POST retry-payment. | - Tạo payment_request **MỚI** trên same order.<br>- Stock KHÔNG giảm thêm. | Khẩn | [x] |
| **TC-F34X-05-07** | `B-13, BR-08` | `API` `[Positive]` | cancel-payment provider=xendit → restock ngay | 1. Pre: order pending.<br>2. POST cancel-payment. | - status='cancelled', payment_status='cancelled'.<br>- Stock restock ngay (CAS-winning).<br>- Không double-restock. | Khẩn | [x] |
| **TC-F34X-05-08** | `B-13` | `API` `[Negative]` | retry sau khi paid → reject | 1. Pre: order paid.<br>2. POST retry. | - 422 — terminal state. | High | [x] |
| **TC-F34X-05-09** | `B-13` | `API` `[Negative]` | retry sau khi cancelled → reject | 1. Pre: order cancelled.<br>2. POST retry. | - 422. | High | [x] |

---

### NHÓM 06 — Phase B: Webhook Verify + Reconcile (14 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-06-01** | `B-6, BR-06, NFR-1, AC-B4` | `Sec` `[Negative]` | Webhook token sai → 401 timing-safe | 1. POST webhook với `x-callback-token` sai. | - HTTP 401.<br>- Verify `timingSafeEqual` (test với token gần đúng, chỉ khác 1 byte). | Blocker | [x] |
| **TC-F34X-06-02** | `B-6` | `Sec` `[Negative]` | Webhook không có token | 1. POST không header. | - 401. | Blocker | [x] |
| **TC-F34X-06-03** | `B-7, AC-B3` | `API` `[Positive]` | Webhook `payment.capture` → reconcileOrderPaid → paid | 1. Pre: order pending.<br>2. POST webhook `{event:'payment.capture', data:{reference_id:orderId, status:'SUCCEEDED'}}`. | - DB order `status='new', payment_status='paid'` atomic.<br>- Gửi email confirmation 1 lần.<br>- HTTP 200. | Blocker | [x] |
| **TC-F34X-06-04** | `B-7` | `API` `[Positive]` | Webhook `payment.authorization` cũng coi là paid signal | 1. POST `{event:'payment.authorization'}`. | - reconcileOrderPaid kích hoạt.<br>- Logic xử lý cả 2 events. | High | [x] |
| **TC-F34X-06-05** | `B-8, BR-09, AC-B5` | `API` `[Positive]` | Webhook trùng → atomic single-winner | 1. POST webhook payment.capture orderId=X 2 lần liên tiếp.<br>2. Inspect DB + email log. | - DB chỉ 1 transition.<br>- Email gửi đúng 1 lần.<br>- Lần 2 → `already_processed`. | Blocker | [x] |
| **TC-F34X-06-06** | `B-8, BR-09` | `Race` `[Concurrency]` | Webhook + poll + cron đồng thời reconcile | 1. Promise.all 3 trigger reconcile cùng order. | - 1 winner thực, 2 còn lại no-op.<br>- Lock hoặc atomic UPDATE WHERE status='pending'. | Khẩn | [ ] |
| **TC-F34X-06-07** | `B-9` | `API` `[Positive]` | Persist `xenditPaymentRequestId` + `channel_code` sau paid | 1. Pre: order paid via TOUCHNGO.<br>2. Query DB. | - `xenditPaymentRequestId` lưu.<br>- `channel_code='TOUCHNGO'` lưu (cho refund/audit). | Khẩn | [x] |
| **TC-F34X-06-08** | `B-9` | `API` `[Edge]` | Persist metadata fail → order vẫn paid | 1. Mock metadata write fail nhưng status update OK.<br>2. POST webhook. | - Order paid (truth source).<br>- Log warning về metadata fail.<br>- HTTP 200. | High | [x] |
| **TC-F34X-06-09** | `B-12, BR-08, BR-07` | `API` `[Positive]` | Webhook `payment.failure` → payment_failed, KHÔNG restock | 1. Pre: order pending.<br>2. POST `{event:'payment.failure'}`. | - DB `payment_status='payment_failed'`.<br>- Order status vẫn `pending` (giữ chỗ stock 24h).<br>- KHÔNG restock.<br>- HTTP 200. | Blocker | [x] |
| **TC-F34X-06-10** | `B-12, BR-07` | `API` `[Edge]` | Webhook payment.failure đến 3 lần | 1. POST 3 lần. | - DB không thay đổi sau lần 1.<br>- Mọi lần trả 200. | High | [x] |
| **TC-F34X-06-11** | `BR-07` | `Error` `[Edge]` | Webhook handler DB write fail | 1. Mock DB throw.<br>2. POST webhook. | - HTTP 500 → Xendit retry sau.<br>- KHÔNG return 200 (mất event). | Khẩn | [x] |
| **TC-F34X-06-12** | `B-7` | `Sec` `[Negative]` | Webhook `reference_id` không match order nào | 1. POST webhook với `reference_id='ghost-order'`. | - Log alert (possibly stale or malicious).<br>- HTTP 200 (Xendit không retry).<br>- KHÔNG crash. | Khẩn | [x] |
| **TC-F34X-06-13** | `B-7` | `Sec` `[Negative]` | Webhook `for-user-id` mismatch order tenant | 1. POST webhook orderId=X (tenant A) nhưng `for-user-id` của tenant B. | - Reject 401 hoặc log + ignore.<br>- KHÔNG cross-tenant transition. | Khẩn | [x] |
| **TC-F34X-06-14** | `B-7` | `API` `[Edge]` | Webhook unknown event type → 200 không crash | 1. POST `{event:'payment.unknown_v4'}`. | - Log warning + return 200. | Medium | [x] |

---

### NHÓM 07 — Phase B: Stock CAS + Retry + Cancel (11 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-07-01** | `B-2, BR-08, AC-B6` | `Race` `[Concurrency]` | Stock=1, 5 buyer concurrent | 1. Pre: inventory=1.<br>2. Promise.all 5 POST checkout.<br>3. Query stock + orders. | - Đúng 1 thành công + 4 nhận 409.<br>- inventory=0 cuối cùng.<br>- KHÔNG oversell. | Blocker | [ ] |
| **TC-F34X-07-02** | `B-2, BR-08` | `API` `[Positive]` | Stock decrement CAS-winning | 1. Inventory=10, POST checkout qty=3.<br>2. Query stock. | - Inventory=7 ngay sau checkout (upfront giảm). | Khẩn | [x] |
| **TC-F34X-07-03** | `B-13, BR-08` | `API` `[Positive]` | Buyer cancel chủ động → restock ngay | 1. Pre: order pending, stock đã giảm.<br>2. POST cancel-payment. | - Status='cancelled', restock immediately, CAS-winning. | Blocker | [x] |
| **TC-F34X-07-04** | `B-13, BR-08` | `API` `[Edge]` | Cancel 2 lần → không double-restock | 1. POST cancel × 2. | - Lần 1: cancel + restock; lần 2: no-op (already cancelled). | Khẩn | [x] |
| **TC-F34X-07-05** | `B-13, BR-08` | `API` `[Positive]` | Retry sau failure → KHÔNG giảm stock lần nữa | 1. Pre: order payment_failed, stock đã giữ.<br>2. POST retry-payment. | - Stock không thay đổi.<br>- Payment_request mới tạo. | Khẩn | [x] |
| **TC-F34X-07-06** | `B-12, BR-08` | `Cron` `[Edge]` | 24h cron payment-expiry → cancel + restock | 1. Pre: order pending quá 24h.<br>2. Run cron payment-expiry. | - Status='cancelled', `cancel_reason='Auto-cancelled 24h'`, stock restock 1 lần. | Khẩn | [ ] |
| **TC-F34X-07-07** | `BR-08` | `Race` `[Edge]` | Cron expiry vs paid race (< 1s gap) | 1. Pre: order pending, paymentExpiresAt = now + 100ms.<br>2. Webhook payment.capture đến lúc T=200ms.<br>3. Cron chạy lúc T=300ms. | - Order paid wins (status='paid').<br>- Cron skip vì status != pending.<br>- Stock không restock nhầm. | Khẩn | [ ] |
| **TC-F34X-07-08** | `BR-08` | `API` `[Edge]` | Restock CAS-winning chống double | 1. Trigger 2 source restock cùng order (cron + cancel race).<br>2. Query stock. | - Inventory chỉ tăng 1 lần. | Khẩn | [ ] |
| **TC-F34X-07-09** | `B-13` | `API` `[Negative]` | Retry order đã paid → 422 | 1. Pre: paid.<br>2. POST retry. | - 422 terminal. | High | [x] |
| **TC-F34X-07-10** | `B-13` | `API` `[Negative]` | Cancel order đã paid → 422 | 1. Pre: paid.<br>2. POST cancel-payment. | - 422 (phải dùng refund flow thay vì cancel). | Khẩn | [x] |
| **TC-F34X-07-11** | `B-12` | `API` `[Edge]` | Multi payment.failure liên tiếp → giữ pending | 1. Pre: order pending.<br>2. POST payment.failure × 3 (buyer retry fail nhiều lần). | - Order pending suốt, payment_failed.<br>- Stock giữ chỗ 24h. | High | [x] |

---

### NHÓM 08 — Phase C: Refund (13 TCs) — `POST /api/orders/[id]/refund`

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-08-01** | `C-1, AC-C1` | `API` `[Positive]` | Refund full đơn paid | 1. Pre: order paid RM 100.<br>2. POST refund (no amount = full). | - Call `POST /refunds` với header `for-user-id`, payment_request_id.<br>- DB lưu refund id + status.<br>- Webhook sau → `payment_status='refunded'`. | Blocker | [x] |
| **TC-F34X-08-02** | `C-2, AC-C2` | `API` `[Positive]` | Refund partial RM 40 | 1. Pre: paid RM 100.<br>2. POST refund amount=40. | - Call refund với `amount:40`.<br>- Sau webhook: `payment_status='partially_refunded'`.<br>- Lưu accumulated refunds. | Khẩn | [x] |
| **TC-F34X-08-03** | `C-3, AC-C5` | `API` `[Positive]` | Webhook `refund.succeeded` partial → partially_refunded | 1. Pre: order paid, refund đã gửi.<br>2. POST webhook `{event:'refund.succeeded'}`. | - DB `payment_status='partially_refunded'`. | Khẩn | [x] |
| **TC-F34X-08-04** | `C-3, AC-C5` | `API` `[Positive]` | Webhook `refund.succeeded` full → refunded | 1. Pre: refund full gửi.<br>2. POST webhook. | - DB `payment_status='refunded'`. | Khẩn | [x] |
| **TC-F34X-08-05** | `C-3` | `API` `[Positive]` | Webhook `refund.failed` → giữ nguyên + báo seller | 1. POST webhook `{event:'refund.failed'}`. | - DB không transition.<br>- Notification cho seller. | High | [x] |
| **TC-F34X-08-06** | `C-2, BR-11, AC-C3` | `API` `[Negative]` | Order chưa paid → 422 NOT_REFUNDABLE | 1. Pre: order pending.<br>2. POST refund. | - HTTP 422 `NOT_REFUNDABLE`. | Khẩn | [x] |
| **TC-F34X-08-07** | `C-2, BR-11, AC-C4` | `API` `[Negative]` | Refund đã full → reject lần nữa | 1. Pre: order refunded.<br>2. POST refund. | - 422 — chặn double-refund. | Khẩn | [x] |
| **TC-F34X-08-08** | `C-2, BR-11` | `API` `[Negative]` | Partial accumulate > paid → reject | 1. Pre: paid RM 100, đã refund RM 80.<br>2. POST refund amount=30 (sẽ vượt). | - 422 (80+30=110 > 100). | Khẩn | [x] |
| **TC-F34X-08-09** | `C-2, BR-11` | `API` `[Positive]` | 3 partial refunds tổng = paid → refunded | 1. Refund RM 30, RM 30, RM 40 lần lượt.<br>2. Sau 3 webhooks. | - Sau lần 3: `payment_status='refunded'`. | High | [x] |
| **TC-F34X-08-10** | `C-1` | `Sec` `[Negative]` | Refund không phải owner → 403 | 1. Bearer tenant-B.<br>2. POST refund order của tenant-A. | - HTTP 403. | Khẩn | [x] |
| **TC-F34X-08-11** | `C-10` | `Error` `[Negative]` | Xendit refund API 500 | 1. Mock /refunds trả 500.<br>2. POST refund. | - HTTP 502 + error code.<br>- DB không transition.<br>- Retry button cho seller. | Khẩn | [x] |
| **TC-F34X-08-12** | `C-10` | `API` `[Edge]` | Refund event đến cho order đã cancelled | 1. Pre: order cancelled (edge case).<br>2. POST webhook refund.succeeded. | - Log warning, không transition.<br>- 200. | High | [x] |
| **TC-F34X-08-13** | `C-2` | `Valid` `[Negative]` | Refund amount âm | 1. POST amount=-10. | - 400. | High | [x] |

---

### NHÓM 09 — Phase C: Reconcile Cron (7 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-09-01** | `C-4, AC-C6` | `Cron` `[Positive]` | Cron reconcile: pending quá ngưỡng + Xendit SUCCEEDED → paid | 1. Pre: order pending 10 phút, webhook mất.<br>2. Mock Xendit GET payment_request trả SUCCEEDED.<br>3. Run cron. | - reconcileOrderPaid kích hoạt.<br>- Order paid.<br>- Atomic single-winner. | Blocker | [ ] |
| **TC-F34X-09-02** | `C-4, AC-C7` | `Cron` `[Positive]` | Cron: Xendit FAILED → cancel + restock | 1. Pre: order pending.<br>2. Mock Xendit trả FAILED.<br>3. Run cron. | - Status='cancelled', restock. | Khẩn | [ ] |
| **TC-F34X-09-03** | `C-4` | `Cron` `[Edge]` | Cron rerun → idempotent | 1. Run cron 2 lần. | - Order đã paid: skip.<br>- Không double-process. | Khẩn | [ ] |
| **TC-F34X-09-04** | `C-5` | `Cron` `[Positive]` | Cron payment-expiry: quá TTL 24h | 1. Pre: order pending paymentExpiresAt < now.<br>2. Run cron. | - Status='cancelled', `cancel_reason='Auto-cancelled 24h'`, restock. | Khẩn | [ ] |
| **TC-F34X-09-05** | `NFR-7` | `Sec` `[Negative]` | Cron endpoint không có secret → 401 | 1. POST cron URL không secret header. | - HTTP 401. | Khẩn | [x] |
| **TC-F34X-09-06** | `C-4` | `Cron` `[Edge]` | Cron Xendit getPaymentRequest fail → skip order, retry sau | 1. Mock Xendit GET trả 500.<br>2. Run cron. | - Skip order đó, log, không crash batch. | High | [x] |
| **TC-F34X-09-07** | `C-4` | `Cron` `[Scale]` | Cron 1000 pending orders | 1. Pre: 1000 pending.<br>2. Run cron. | - Batch process, không OOM.<br>- Rate limit Xendit API (không trigger 429). | High | [ ] |

---

### NHÓM 10 — Phase C: Disburse (Balance + Payout) (9 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-10-01** | `C-6, AC-C8` | `API` `[Positive]` | Settings UI: GET /balance hiển thị | 1. GET balance via `/balance` + `for-user-id`.<br>2. Inspect UI. | - Hiển thị số dư sub-account.<br>- Hướng dẫn bật Auto-Withdrawal Dashboard. | Khẩn | [x] |
| **TC-F34X-10-02** | `C-6` | `API` `[Positive]` | Settlement TTL hiển thị đúng | 1. Pre: có settlement thẻ T+7, ví T+2.<br>2. GET balance. | - Balance available reflect timeline đúng. | High | [x] |
| **TC-F34X-10-03** | `C-7` | `API` `[Positive]` | Optional: POST /api/xendit/payout với Idempotency-key | 1. POST payout amount=100.<br>2. Inspect Xendit call. | - Header `Idempotency-key` set.<br>- `channel_code` + `for-user-id`.<br>- Call `POST /v2/payouts`. | Khẩn | [x] |
| **TC-F34X-10-04** | `C-7, BR-12, AC-C10` | `API` `[Edge]` | Payout cùng Idempotency-key 2× → chỉ 1 payout | 1. POST payout với key=X.<br>2. POST lại same key. | - Lần 2 trả existing payout (Xendit dedup). | Khẩn | [x] |
| **TC-F34X-10-05** | `C-9, AC-C9` | `Valid` `[Negative]` | Payout amount > balance → reject | 1. Pre: balance RM 50.<br>2. POST payout amount=100. | - HTTP 422 INSUFFICIENT_BALANCE. | Khẩn | [x] |
| **TC-F34X-10-06** | `C-9` | `Valid` `[Negative]` | channel_code không hợp lệ | 1. POST channel_code='UNKNOWN_BANK'. | - HTTP 400 trước call Xendit (validate qua `get-payout-channels` MY). | High | [x] |
| **TC-F34X-10-07** | `C-8` | `UI` `[Positive]` | Hiển thị balance + history payout (read-only) | 1. Settings page balance + history tab. | - List payouts từ Xendit, không edit. | Medium | [x] |
| **TC-F34X-10-08** | `BR-15` | `Sec` `[Negative]` | NON-CUSTODY: Auto-Withdrawal chưa LIVE → block | 1. Pre: account chưa LIVE, merchant bật Auto-Withdrawal Dashboard.<br>2. Inspect. | - Xendit block payout server-side.<br>- Prime UI banner "cần KYB LIVE". | Khẩn | [x] |
| **TC-F34X-10-09** | `C-10` | `Error` `[Negative]` | Xendit payout API lỗi → log + không state sai | 1. Mock /payouts trả 500. | - HTTP 502.<br>- Idempotency-key chống double trên retry. | Khẩn | [x] |

---

### NHÓM 11 — Routing Xendit vs Stripe (6 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-11-01** | `B-11, BR-13, AC-B11` | `API` `[Positive]` | Merchant dual (Xendit+Stripe), buyer FPX → route Xendit | 1. Pre: tenant-DUAL có cả 2 enabled.<br>2. Buyer chọn FPX checkout. | - Route POST /api/orders/xendit-checkout.<br>- Single charge qua Xendit. | Khẩn | [x] |
| **TC-F34X-11-02** | `B-11, BR-13` | `API` `[Positive]` | Dual, buyer international card → route Stripe | 1. Pre: tenant-DUAL.<br>2. Buyer chọn Card (intl). | - Route Stripe (giữ F13 flow).<br>- Không gọi Xendit. | Khẩn | [x] |
| **TC-F34X-11-03** | `B-11` | `API` `[Positive]` | Dual, buyer TNG → route Xendit | 1. Buyer chọn TOUCHNGO. | - Route Xendit. | High | [x] |
| **TC-F34X-11-04** | `B-11` | `API` `[Edge]` | Stripe webhook đến cho order Xendit (mistake) | 1. POST Stripe webhook với `client_reference_id` = order Xendit. | - Route theo `order.payment_provider`.<br>- Không cross-process.<br>- Log + 200. | Khẩn | [x] |
| **TC-F34X-11-05** | `B-11` | `API` `[Edge]` | Xendit webhook đến cho order Stripe | 1. POST Xendit webhook với `reference_id` = order Stripe. | - Tương tự: route đúng provider, không cross. | Khẩn | [x] |
| **TC-F34X-11-06** | `B-11` | `API` `[Edge]` | Merchant non-MY (giả định) → mặc định Stripe only | 1. Pre: tenant không có xenditAccountId.<br>2. Buyer checkout. | - Route Stripe.<br>- Không offer Xendit channels. | High | [x] |

---

### NHÓM 12 — NON-CUSTODY Guardrails (5 TCs) — Pháp lý CRITICAL

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-12-01** | `BR-15` | `Static` `[Critical]` | Codebase KHÔNG có call Transfers API | 1. grep `/transfers` toàn codebase.<br>2. grep `xendit.transfers` hoặc tương đương. | - 0 occurrence.<br>- Lint rule chặn nếu add sau này. | Blocker | [x] |
| **TC-F34X-12-02** | `BR-03` | `Static` `[Critical]` | Mọi PaymentRequest call có `for-user-id` header | 1. grep `createPaymentRequest` trong codebase.<br>2. Verify mọi call set header. | - 100% call có `for-user-id`.<br>- Lint rule require. | Blocker | [x] |
| **TC-F34X-12-03** | `BR-03, BR-15` | `Static` `[Critical]` | Mọi Payout call có `for-user-id` (không qua master) | 1. grep `/v2/payouts` calls.<br>2. Verify header. | - 100% có `for-user-id`. | Blocker | [x] |
| **TC-F34X-12-04** | `BR-15` | `Static` `[Critical]` | KHÔNG có code hold/freeze balance | 1. grep `freeze` / `hold` / `delay` trên balance code. | - 0 logic delay payout. | Khẩn | [x] |
| **TC-F34X-12-05** | `BR-03` | `Audit` `[Critical]` | Sandbox test: tiền 1 đơn TNG → flow đúng sub-account → bank | 1. Sandbox flow.<br>2. Verify Xendit Dashboard balance sub-account.<br>3. Auto-Withdrawal trigger → bank merchant. | - Tiền KHÔNG xuất hiện ở master balance.<br>- Settle thẳng sub → bank. | Blocker | [ ] |

---

### NHÓM 13 — Currency Conversion (NFR-5b CRITICAL) (9 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-13-01** | `NFR-5b, BR-04` | `Logic` `[Positive]` | RM 100 → Xendit request_amount=100 (không 10000) | 1. Order DB amount=10000 (sen).<br>2. Call createPaymentRequest.<br>3. Inspect Xendit payload. | - `request_amount: 100` (RM major).<br>- KHÔNG `request_amount: 10000`. | Blocker | [x] |
| **TC-F34X-13-02** | `NFR-5b` | `Logic` `[Positive]` | Stripe RM 100 → amount=10000 sen | 1. Same order route Stripe.<br>2. Inspect Stripe payload. | - `amount: 10000`.<br>- Khác Xendit. | Blocker | [x] |
| **TC-F34X-13-03** | `NFR-5b` | `Logic` `[Edge]` | RM 0.01 (1 sen) | 1. Order DB amount=1.<br>2. Call Xendit. | - `request_amount: 0.01` (precision đúng). | Khẩn | [x] |
| **TC-F34X-13-04** | `NFR-5b` | `Logic` `[Edge]` | RM 1.50 (precision 2 decimal) | 1. amount=150 sen.<br>2. Call Xendit. | - `request_amount: 1.50` không `1.5`. | Khẩn | [x] |
| **TC-F34X-13-05** | `NFR-5b` | `Logic` `[Edge]` | Webhook RM 100 từ Xendit → DB sen | 1. Webhook `payment.capture` với amount=100.<br>2. Verify DB. | - Reconcile lưu sen=10000.<br>- ×100 khi receive. | Blocker | [x] |
| **TC-F34X-13-06** | `NFR-5b` | `Logic` `[Edge]` | Refund RM 40 → Xendit amount=40 | 1. Pre: order paid RM 100.<br>2. POST refund 4000 sen DB.<br>3. Inspect Xendit call. | - `amount: 40` không `4000`. | Khẩn | [x] |
| **TC-F34X-13-07** | `NFR-5b` | `Logic` `[Regression]` | Stripe regression: RM 100 vẫn 10000 sen | 1. Run F13 Stripe test suite. | - 100% pass.<br>- NFR-5b không break Stripe path. | Blocker | [x] |
| **TC-F34X-13-08** | `NFR-5b` | `Logic` `[Edge]` | RM 999,999.99 (max) | 1. amount=99999999 sen.<br>2. Call Xendit. | - `request_amount: 999999.99`. | Medium | [x] |
| **TC-F34X-13-09** | `NFR-5b` | `E2E` `[Critical]` | Sandbox: thật sự pay RM 1 → balance hiển thị RM 1 (không 100 hay 0.01) | 1. Sandbox test order RM 1.<br>2. Pay TNG.<br>3. Verify Xendit Dashboard balance + DB. | - Balance += RM 1.<br>- DB lưu sen=100.<br>- Conversion đúng 2 chiều. | Blocker | [ ] |

---

### NHÓM 14 — Security & PCI/PDPA (11 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-14-01** | `NFR-1, BR-06` | `Sec` `[Critical]` | Webhook verify dùng `timingSafeEqual` | 1. Inspect code webhook handler. | - Dùng `crypto.timingSafeEqual` hoặc tương đương.<br>- KHÔNG dùng `===`. | Blocker | [x] |
| **TC-F34X-14-02** | `NFR-1` | `Sec` `[Negative]` | Replay webhook old event | 1. Capture webhook payload.<br>2. POST lại lần 2 sau khi đã xử lý. | - Idempotent: không re-process; trả 200. | Khẩn | [x] |
| **TC-F34X-14-03** | `NFR-3, BR-05` | `Sec` `[Critical]` | PCI: PAN/CVV KHÔNG qua server Prime | 1. E2E checkout card.<br>2. Inspect Network tab + server logs. | - Card data POST thẳng Xendit hosted.<br>- 0 byte PAN trong logs Prime. | Blocker | [ ] |
| **TC-F34X-14-04** | `NFR-3, BR-05` | `Sec` `[Critical]` | PDPA: KYB doc KHÔNG qua server Prime | 1. Onboard E2E.<br>2. Inspect Prime server logs + DB. | - Doc upload trên Xendit hosted.<br>- 0 doc trong Prime storage/DB. | Blocker | [ ] |
| **TC-F34X-14-05** | `NFR-2` | `Sec` `[Critical]` | Secrets không trong git/logs | 1. grep `XENDIT_SECRET_KEY` trong git history.<br>2. Inspect logs. | - Secret chỉ trong Vercel Dashboard.<br>- KHÔNG hardcode.<br>- Log mask. | Blocker | [x] |
| **TC-F34X-14-06** | `NFR-2` | `Sec` `[Critical]` | Webhook token log mask | 1. Trigger webhook.<br>2. Check application log. | - `x-callback-token` masked (***).<br>- KHÔNG clear text. | Khẩn | [x] |
| **TC-F34X-14-07** | `B-1` | `Sec` `[Critical]` | IDOR: Refund order tenant khác → 403 | 1. Bearer tenant-A.<br>2. POST refund cho orderId của tenant-B. | - HTTP 403. | Khẩn | [x] |
| **TC-F34X-14-08** | `A-1` | `Sec` `[Critical]` | IDOR: GET balance của xenditAccountId khác | 1. Bearer tenant-A.<br>2. GET balance với `?accountId=B`. | - 403 hoặc ignore param (chỉ dùng session). | Khẩn | [x] |
| **TC-F34X-14-09** | `NFR-3` | `Sec` `[Negative]` | Response checkout không leak xenditAccountId của merchant khác | 1. Inspect responses. | - Chỉ scope tenant hiện tại. | Khẩn | [x] |
| **TC-F34X-14-10** | `NFR-2` | `Sec` `[Negative]` | SQL injection vào reference_id | 1. POST checkout với `reference_id="' OR 1=1; DROP TABLE orders;--"`. | - ORM escape; DB an toàn. | High | [x] |
| **TC-F34X-14-11** | `NFR-7` | `Sec` `[Negative]` | Cron public URL không secret → 401 | 1. POST cron URL without secret header. | - 401.<br>- Không expose state. | Khẩn | [x] |

---

### NHÓM 15 — E2E Golden Path (8 TCs) — Playwright

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-15-01** | `US-F34-01..02` | `E2E` `[Positive]` | Full onboarding: Connect → KYB → LIVE | 1. Login merchant.<br>2. Settings → Connect Payment.<br>3. Redirect Xendit hosted KYB.<br>4. Submit doc trên Xendit.<br>5. Sandbox webhook `account.activated`.<br>6. Quay lại Prime. | - End-to-end: badge LIVE hiển thị.<br>- Checkout button enabled. | Blocker | [ ] |
| **TC-F34X-15-02** | `US-F34-04..06` | `E2E` `[Positive]` | Full checkout TNG → paid | 1. Buyer add to cart → checkout chọn TNG.<br>2. Redirect Xendit hosted.<br>3. Sandbox pay TNG simulator.<br>4. Webhook payment.capture.<br>5. Verify confirm page + email. | - Order paid, stock giảm, email sent. < 30s. | Blocker | [ ] |
| **TC-F34X-15-03** | `US-F34-04` | `E2E` `[Positive]` | DuitNow QR PRESENT mode | 1. Buyer checkout chọn DuitNow QR.<br>2. Trang hiển thị QR (no redirect).<br>3. Sandbox scan + pay.<br>4. Webhook → reconcile. | - Buyer ở lại trang, paid. | Khẩn | [ ] |
| **TC-F34X-15-04** | `US-F34-04` | `E2E` `[Negative]` | Stock=1, 2 buyer race | 1. 2 browser concurrent checkout. | - 1 buyer paid, 1 nhận 409 OUT_OF_STOCK UI. | Khẩn | [ ] |
| **TC-F34X-15-05** | `US-F34-04` | `E2E` `[Negative]` | Buyer cancel chủ động → restock | 1. Buyer checkout → trên Xendit page → back/cancel.<br>2. POST cancel-payment hoặc UI cancel button.<br>3. Verify stock. | - Stock restock visible trên storefront product page. | Khẩn | [ ] |
| **TC-F34X-15-06** | `US-F34-07` | `E2E` `[Positive]` | Refund full UI flow | 1. Seller dashboard → order detail → "Hoàn tiền" full.<br>2. Confirm → call Xendit refund.<br>3. Webhook refund.succeeded.<br>4. Order status hiển thị refunded. | - Status update, email gửi cho buyer. | Khẩn | [ ] |
| **TC-F34X-15-07** | `US-F34-07` | `E2E` `[Positive]` | Refund partial → 3 lần tới full | 1. Refund RM 30 → RM 30 → RM 40 lần lượt. | - Sau lần 3 status='refunded' tự động. | High | [ ] |
| **TC-F34X-15-08** | `US-F34-09` | `E2E` `[Positive]` | Settings UI hiển thị balance + Auto-Withdrawal banner | 1. Settings → Payment tab.<br>2. View balance + history. | - Balance đúng từ Xendit.<br>- Banner hướng dẫn Auto-Withdrawal. | High | [ ] |

---

## 6. Test Files Layout

```
src/__tests__/
├── unit/payment/xendit/
│   ├── xendit-currency.test.ts            # TC-F34X-13-* (NFR-5b)
│   ├── xendit-types.test.ts                # Logic helper functions
│   └── xendit-channel-codes.test.ts        # Channel code validation
├── api/xendit/
│   ├── connect.test.ts                     # TC-F34X-01-* + TC-F34X-03-06..07
│   ├── webhook-account.test.ts             # TC-F34X-02-* (account events)
│   ├── webhook-payment.test.ts             # TC-F34X-06-* (payment events)
│   ├── webhook-refund.test.ts              # TC-F34X-08-03..05, 12
│   ├── checkout.test.ts                    # TC-F34X-04-* + TC-F34X-05-01..03
│   ├── refund.test.ts                      # TC-F34X-08-* (route logic)
│   ├── payout.test.ts                      # TC-F34X-10-*
│   ├── reconcile-cron.test.ts              # TC-F34X-09-*
│   ├── stock-cas.test.ts                   # TC-F34X-07-* (concurrency)
│   ├── routing.test.ts                     # TC-F34X-11-*
│   └── security.test.ts                    # TC-F34X-14-*
├── static/
│   └── non-custody-guardrails.test.ts      # TC-F34X-12-* (grep-based)
└── concurrency/
    └── xendit-race.test.ts                 # TC-F34X-04-05, 06-06, 07-01, 07-07

e2e/
└── f34-xendit-payment.spec.ts              # TC-F34X-15-*
```

---

## 7. Test Data Fixtures

### Tenant fixtures

| Fixture | Status | Mô tả |
|---|---|---|
| `tenant-NEW` | NOT_CONNECTED | No xenditAccountId, dùng cho test connect lần đầu |
| `tenant-INVITED` | INVITED | Có xenditAccountId, chưa KYB |
| `tenant-AWAITING` | AWAITING_DOCS | Đang nộp KYB |
| `tenant-LIVE` | LIVE | Hoạt động bình thường, dùng cho checkout/refund tests |
| `tenant-SUSPENDED` | SUSPENDED | Bị khoá |
| `tenant-DUAL` | LIVE + Stripe connected | Test routing |

### Channel codes (verify với Channel Data Finder MY)

```
TOUCHNGO        — E-wallet TNG
GRABPAY         — E-wallet GrabPay
SHOPEEPAY       — E-wallet ShopeePay
DUITNOW_QR      — QR code (PRESENT mode) ⚠️ NEED verify exact name
FPX             — Bank transfer (bank-specific sub-codes)
CARDS           — Credit/debit cards
```

### Test cards & wallets (Xendit sandbox)

| Phương thức | Test data |
|---|---|
| Card success | Xendit test card success |
| Card declined | Xendit test card declined |
| Card 3DS | Xendit test card 3DS |
| TNG | Sandbox simulator success/fail |
| GrabPay | Sandbox simulator |
| FPX | Test bank simulator |

### Sample payloads

```json
// POST /api/xendit/connect
{} // no body — tenant from session

// POST /api/orders/xendit-checkout
{
  "siteId": "site-123",
  "cart": [{"productId": "p1", "qty": 1}],
  "channel": "TOUCHNGO",
  "successUrl": "https://shop.test/confirm/order-x",
  "failureUrl": "https://shop.test/checkout"
}

// POST /api/orders/[id]/refund (partial)
{ "amount": 4000, "reason": "buyer-request" }  // 4000 sen DB → 40 RM Xendit

// Webhook payment.capture
{
  "event": "payment.capture",
  "data": {
    "reference_id": "order-x",
    "status": "SUCCEEDED",
    "request_amount": 100,    // RM major
    "currency": "MYR",
    "channel_code": "TOUCHNGO",
    "payment_request_id": "pr_abc"
  }
}
```

### Bearer tokens

| Token | Role | Dùng cho |
|---|---|---|
| `BEARER_SUPER_ADMIN` | super-admin | Admin operations |
| `BEARER_TENANT_OWNER` | tenant-owner | Connect, checkout config, refund |
| `BEARER_TENANT_STAFF` | tenant-staff | Read-only check |
| `BEARER_GUEST` | (no auth) | Storefront checkout |
| `BEARER_EXPIRED` | super-admin (expired) | Security tests |

---

## 8. Risk Assessment (Mapping với Test Cases)

| # | Risk | Impact | Likelihood | Test Cases liên quan |
|---|------|--------|------------|---------------------|
| **R1** | **Currency lệch 100×** (RM vs sen confusion) | Critical | High | TC-F34X-13-* (full nhóm 9 TCs) |
| **R2** | Webhook signature spoof/replay | Critical | Medium | TC-F34X-06-01..02, TC-F34X-14-01..02 |
| **R3** | Stock oversell race (CAS bug) | Critical | Medium | TC-F34X-04-05, 07-01, 07-07 |
| **R4** | Double webhook → email/transition 2 lần | Critical | High | TC-F34X-06-05..06 |
| **R5** | PCI violation: PAN qua server Prime | Critical | Low | TC-F34X-14-03 |
| **R6** | PDPA violation: KYB doc qua server | Critical | Low | TC-F34X-14-04 |
| **R7** | NON-CUSTODY: dùng Transfers API hoặc tiền qua master | Critical | Low | TC-F34X-12-01..05 |
| **R8** | Cross-provider routing wrong (Xendit↔Stripe webhook) | High | Medium | TC-F34X-11-04..05 |
| **R9** | Double-refund / over-refund | Critical | Medium | TC-F34X-08-07..08 |
| **R10** | Cron rerun double-process | High | Medium | TC-F34X-09-03 |
| **R11** | KYB lead time UX không rõ → merchant kẹt | High | High | TC-F34X-03-02..04, TC-F34X-03-08 |
| **R12** | XenPlatform cost RM7.50/active/tháng không monitor | Medium | High | (operational, không phải TC code) |
| **R13** | Channel code DUITNOW_QR sai exact name | Critical | Medium | TC-F34X-04-11, TC-F34X-15-03, TC-F34X-20-03 — verify Channel Data Finder |
| **R14** | `reconcileOrderPaid` refactor break F13 Stripe regression | Critical | High | TC-F34X-17-01..05, TC-F34X-17-02 (162 F13 TCs full pass) |
| **R15** | Aggregator-vs-Switcher: codebase có logic disbursement → de facto aggregator | Critical | Low | TC-F34X-19-01 static grep, document architecture decision |
| **R16** | Sub-Account Liability merchant bán hàng cấm | Critical | Medium | TC-F34X-19-05 fraud monitoring queue + manual review process |
| **R17** | Performance regression — webhook latency > 30s SLA | High | Medium | TC-F34X-18-01..03 load test trước go-live |
| **R18** | UI/UX inconsistency với F13 (Stripe pattern) → buyer confused dual provider | High | Medium | TC-F34X-21-03 dual provider rows, TC-F34X-23-06..11 mirror F13 Connect pattern |

---

## 9. Coverage Summary

| Loại | Số TCs |
|:---|:---:|
| Unit (Logic) | 27 |
| API Integration | 84 |
| Race / Concurrency | 6 |
| Cron | 6 |
| Static (grep + lint) | 6 |
| Security | 12 |
| **UI (Checkout + Order Detail + Settings + Connect)** | **38** |
| E2E (Playwright) | 9 |
| DB Migration | 8 |
| Performance (load/SLA) | 4 |
| Audit / Compliance | 5 |
| Integration Spike | 8 |
| Mobile UI | 3 |
| **Tổng** | **219** |

### Priority breakdown (v1.2)
| Priority | Số TCs |
|:---|:---:|
| Blocker | 39 |
| Khẩn | 95 |
| High | 65 |
| Medium | 19 |
| Low | 1 |
| **Tổng** | **219** |

### AC Coverage (32 ACs)

| AC Group | Test Cases | Coverage |
|:---|:---|:---:|
| AC-A1..A11 (Phase A) | TC-F34X-01-* + 02-* + 03-* | ✅ Full |
| AC-B1..B11 (Phase B) | TC-F34X-04-* + 05-* + 06-* + 07-* + 11-* | ✅ Full |
| AC-C1..C10 (Phase C) | TC-F34X-08-* + 09-* + 10-* | ✅ Full |

### FR Coverage

| FR Group | Coverage |
|:---|:---:|
| A-1..A-11 (Onboarding) | ✅ |
| B-1..B-13 (Checkout + Webhook + Routing) | ✅ |
| C-1..C-10 (Refund + Reconcile + Payout) | ✅ |
| NFR-1..NFR-9 | ✅ NFR-5b dedicated nhóm 13 |

---

## 10. Open Questions (cần resolve trước test)

Liệt kê các `[NEED]` từ PRD §11 mà test phải clarify trước khi code:

1. **Onboarding URL field name** trong response `POST /v2/accounts` → ảnh hưởng TC-F34X-01-06
2. **`account.updated` callback có field `status`** cho từng transition không → ảnh hưởng TC-F34X-02-03..05
3. **Channel code chính xác** FPX + DuitNow QR MY (`DUITNOW_QR` vs `QR_DUITNOW`?) → ảnh hưởng TC-F34X-04-11, TC-F34X-15-03
4. **`request_amount` MYR = RM hay sen** → BR-04 critical, sandbox test 1 đơn nhỏ trước (TC-F34X-13-09)
5. **Cách set callback URL**: API `/callback_urls/{type}` hay Dashboard config → TC-F34X-02-01
6. **`orders.payment_status` đã có `partially_refunded`** chưa (F13 schema) → TC-F34X-08-02..03
7. **Auto-Withdrawal MY MANAGED bật trên Dashboard** không cần API → TC-F34X-10-08
8. **`xenditOnboardingComplete` flag** lưu ở field nào của Tenant collection → migration cần thiết

---

## 11. Definition of Done — F34 QA Gate

- [ ] Tất cả 31 Blocker TCs pass.
- [ ] Tất cả 75 Khẩn TCs pass.
- [ ] **NFR-5b currency conversion** (Nhóm 13) verify 100% với sandbox test thật (TC-F34X-13-09).
- [ ] **NON-CUSTODY audit** (Nhóm 12) pass static check + sandbox flow test (TC-F34X-12-05).
- [ ] **Stripe regression** TC-F34X-13-07 pass — F13 suite không break.
- [ ] CI gate: lint + typecheck + test + build xanh trên PR.
- [ ] Webhook timing-safe verify (TC-F34X-14-01) pass.
- [ ] Concurrency tests (TC-F34X-04-05, 06-06, 07-01) chạy stable 10 lần liên tiếp.
- [ ] E2E golden path TC-F34X-15-01..02 pass trên staging với sandbox Xendit.
- [ ] PCI/PDPA verification (TC-F34X-14-03..04) qua manual audit trên staging.
- [ ] 8 Open Questions §10 resolved trước go-live Phase B.

---

## 12. Change Log

| Version | Date | Changes |
|---|---|---|
| **1.2** | 2026-06-12 | UI/UX scope. **THÊM 3 nhóm UI** (21-23): Checkout UI Buyer (12 TCs), Order Detail UI Seller (10 TCs), Order Detail Buyer + Connect + Balance UI (16 TCs). Mirror F13 TC-F13.08, 12-28, 81, 94-96 patterns. **THÊM 1 risk** R18. **Tổng TCs**: 181 → 219. |
| **1.1** | 2026-06-12 | Gap analysis vs PRD §3-11 + research report + implementation reality. **THÊM 5 nhóm** (16-20): DB Schema Migration (8), Generalize reconcileOrderPaid (5), Performance NFR-8 (4), Compliance Audit Log (5), Open Questions resolution (8). **THÊM 4 risks** R14..R17. **Tổng TCs**: 151 → 181. |
| **1.0** | 2026-06-12 | Initial draft từ PRD v4.0. 219 TCs, 15 nhóm, 13 risks. Match format `docs/qa/F13-payment-gateway.md`. Scenarios reference `docs/qa/scenarios/F34-xendit-payment.md` (86 scenarios × 12 dim). |

---

## 13. NHÓM 16-20 — Supplementary v1.1 (30 TCs)

### NHÓM 16 — DB Schema Migration (8 TCs)

> Bổ sung sau khi đối chiếu: codebase chưa có Xendit field nào. PRD §6 không liệt kê schema cụ thể. Test migration phải có trước implement.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-16-01** | `A-2`, `J1` | `DB` `[Positive]` | Migration: Tenants thêm `xenditAccountId varchar` | 1. Fresh DB → chạy `db-setup.js`.<br>2. Query schema `tenants` table. | - Column `xenditAccountId varchar` tồn tại, nullable.<br>- Index trên column cho lookup nhanh.<br>- `IF NOT EXISTS`. | Blocker | [x] |
| **TC-F34X-16-02** | `A-7`, `J1` | `DB` `[Positive]` | Migration: Tenants thêm `xenditAccountStatus` enum/varchar | 1. Migration chạy xong.<br>2. Query schema. | - Column lưu được 6 giá trị: NOT_CONNECTED, INVITED, REGISTERED, AWAITING_DOCS, PENDING_VERIFICATION, LIVE, SUSPENDED.<br>- Default NULL. | Blocker | [x] |
| **TC-F34X-16-03** | `A-8`, `J1` | `DB` `[Positive]` | Migration: Tenants thêm `xenditOnboardingComplete boolean` | 1. Migration.<br>2. Query schema. | - Column boolean, default `false`.<br>- Update khi webhook account.activated. | Khẩn | [x] |
| **TC-F34X-16-04** | `B-3`, `J2` | `DB` `[Positive]` | Migration: Orders thêm `xenditPaymentRequestId varchar UNIQUE` | 1. Migration.<br>2. Query schema + indexes. | - Column varchar, UNIQUE constraint.<br>- Index cho webhook lookup theo reference. | Blocker | [x] |
| **TC-F34X-16-05** | `B-9`, `J2` | `DB` `[Positive]` | Migration: Orders thêm `channel_code varchar` | 1. Migration.<br>2. Verify. | - Column lưu TOUCHNGO/GRABPAY/DUITNOW_QR/FPX/CARDS.<br>- Nullable (Stripe orders = null). | Khẩn | [x] |
| **TC-F34X-16-06** | `C-1`, `J3` | `DB` `[Positive]` | Migration: Tạo bảng `xendit_refunds` accumulate refunds | 1. Migration.<br>2. Query schema. | - Bảng có `order_id FK`, `xendit_refund_id varchar`, `amount integer (sen)`, `status varchar`, `reason varchar`, `created_at timestamptz`.<br>- UNIQUE(order_id, xendit_refund_id).<br>- Index order_id. | Khẩn | [x] |
| **TC-F34X-16-07** | `C-3`, `J4` | `DB` `[Positive]` | Migration: payment_status enum thêm `partially_refunded` (nếu F13 chưa có) | 1. Check F13 schema hiện có.<br>2. Nếu thiếu → ALTER TYPE ADD VALUE.<br>3. Verify. | - Enum có giá trị `partially_refunded`.<br>- Stripe partial refund vẫn work (regression). | Blocker | [x] |
| **TC-F34X-16-08** | `BR-10`, `J1` | `DB` `[Positive]` | Idempotent: chạy migration lần 2 không lỗi | 1. Chạy `db-setup.js` lần 2 trên DB đã có data.<br>2. Verify schema không thay đổi. | - `IF NOT EXISTS` chặn duplicate.<br>- Không drop column.<br>- CI gate `check-migrations.js` pass. | Khẩn | [x] |

---

### NHÓM 17 — Generalize `reconcileOrderPaid` (5 TCs) — Critical refactor

> Hiện tại `src/lib/payment/reconcile-order-paid.ts` Stripe-specific (param `session: Record<string, any>` + `connectedAccountId`). PRD §6.B BR-09 yêu cầu generalize. Phải đảm bảo refactor KHÔNG break F13 Stripe.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-17-01** | `B-9`, `K1` | `Logic` `[Positive]` | Interface mới: `reconcileOrderPaid` provider-agnostic | 1. Inspect signature mới.<br>2. Test cả Stripe + Xendit path. | - Interface: `{ orderId, provider: 'stripe' \| 'xendit', metadata: Record<string,any>, source: 'webhook'\|'poll'\|'cron' }`.<br>- Atomic single-winner UPDATE giữ nguyên (không động).<br>- Persist metadata polymorphic theo provider. | Blocker | [x] |
| **TC-F34X-17-02** | `K2`, `R8` | `Regression` `[Critical]` | F13 Stripe test suite full pass sau refactor | 1. Chạy 162 TCs F13.<br>2. Inspect coverage. | - 162/162 pass (TC-F13.01..162).<br>- Stripe behavior identical: order paid + emails + discount redemption + connected account ID lưu đúng. | Blocker | [x] |
| **TC-F34X-17-03** | `B-9`, `K3` | `Logic` `[Positive]` | Xendit path persist `xenditPaymentRequestId` + `channel_code` | 1. Pre: order pending xendit, mock webhook.<br>2. Gọi `reconcileOrderPaid({provider:'xendit', metadata:{...}})`.<br>3. Query DB. | - DB lưu `xenditPaymentRequestId` + `channel_code`.<br>- KHÔNG lưu Stripe field (`connectedAccountId` null cho xendit). | Khẩn | [x] |
| **TC-F34X-17-04** | `K1`, `BR-09` | `Logic` `[Positive]` | Stripe path KHÔNG lưu Xendit field | 1. Pre: order pending Stripe.<br>2. Gọi `reconcileOrderPaid({provider:'stripe', metadata:{session, connectedAccountId}})`. | - DB lưu Stripe fields.<br>- `xenditPaymentRequestId` + `channel_code` = null. | Khẩn | [x] |
| **TC-F34X-17-05** | `K1` | `Logic` `[Edge]` | Persist metadata fail → order vẫn paid (truth = atomic UPDATE) | 1. Mock metadata write throw.<br>2. Gọi reconcile.<br>3. Query order. | - Order `paid` (atomic UPDATE thắng).<br>- Log warning metadata fail.<br>- Return `reconciled`.<br>- Behavior provider-agnostic identical. | Khẩn | [x] |

---

### NHÓM 18 — Performance NFR-8 (4 TCs) — SLA Validation

> PRD §7 NFR-8: Webhook → paid p95 < 30s; checkout API p95 < 4s; settings load < 1s. Chưa có TC nào kiểm tra.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-18-01** | `NFR-8`, `G1` | `Perf` `[SLA]` | Webhook → order paid latency p95 < 30s | 1. k6/JMeter spawn 1000 webhook concurrent.<br>2. Đo từ POST webhook → DB status='paid'.<br>3. Report P50, P95, P99. | - **P95 < 30s** (SLA).<br>- P99 < 60s.<br>- Không 5xx error rate > 0.1%. | Khẩn | [ ] |
| **TC-F34X-18-02** | `NFR-8`, `G2` | `Perf` `[SLA]` | Checkout API p95 < 4s (gồm Xendit call) | 1. k6 100 RPS sustained checkout 5 phút.<br>2. Đo từ POST `/api/orders/xendit-checkout` → response.<br>3. Report. | - **P95 < 4s** gồm tạo order + Xendit createPaymentRequest.<br>- Throughput stable ≥ 100 RPS. | Khẩn | [ ] |
| **TC-F34X-18-03** | `NFR-8`, `G3` | `Perf` `[SLA]` | Settings page load < 1s (cached status) | 1. Pre: status cached.<br>2. Lighthouse hoặc Playwright load settings/payments.<br>3. Đo TTI. | - **TTI < 1s**.<br>- KHÔNG block render bằng Xendit API call (dùng cache). | High | [ ] |
| **TC-F34X-18-04** | `NFR-9` | `Perf` `[Rate Limit]` | `POST /v2/accounts` ≤ 5 write/s | 1. Spam 10 connect requests trong 1s.<br>2. Verify backpressure / queue. | - Queue/throttle để không vượt 5/s.<br>- KHÔNG gửi tất cả 10 cùng lúc (Xendit reject 429). | High | [x] |

---

### NHÓM 19 — Compliance & Audit Log (5 TCs)

> Research report nhấn mạnh "Sub-Account Liability" + Aggregator-vs-Switcher distinction. Audit log critical cho legal defense.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-19-01** | `I3`, `BR-15` | `Static` `[Critical]` | Aggregator-vs-Switcher: codebase 0 auto-withdrawal scheduling code | 1. grep `autoWithdrawal` / `disbursement-rule` / `splitRule` / `withdrawal-schedule` toàn codebase.<br>2. Verify config Dashboard-only. | - 0 occurrence trong source code.<br>- Auto-Withdrawal chỉ qua Xendit Dashboard config — bảo vệ non-aggregator status. | Blocker | [x] |
| **TC-F34X-19-02** | `I1`, `M1` | `Audit` `[Compliance]` | Audit log: mỗi account status transition lưu row | 1. Trigger 5 webhook account.* sequence.<br>2. Query audit log table. | - Mỗi event → 1 row: `{event_id, tenant_id, from_status, to_status, timestamp, webhook_token_hash}`.<br>- KHÔNG mất event. | Khẩn | [x] |
| **TC-F34X-19-03** | `I1`, `M2` | `Audit` `[Compliance]` | Audit log: mỗi refund (full/partial) lưu row | 1. POST refund 3 lần partial.<br>2. Query audit log. | - 3 rows: `{order_id, amount, reason, by_user_id, xendit_refund_id, created_at}`. | High | [x] |
| **TC-F34X-19-04** | `I1`, `M3` | `Audit` `[Sec]` | Audit log: failed webhook attempts (401 token sai) | 1. POST webhook 5 lần với token sai.<br>2. Query audit log + alert system. | - 5 rows log `{ip, attempted_token_hash, timestamp}`.<br>- Alert nếu > 10 lần/giờ (possible attack). | Medium | [x] |
| **TC-F34X-19-05** | `Research Sub-Account Liability` | `Process` `[Compliance]` | Merchant fraud monitoring queue cho new merchants | 1. New merchant onboard 7 ngày đầu → review queue admin.<br>2. Verify dashboard internal có list. | - Admin có view "Pending Review (7 days)".<br>- Suspended manually nếu detect fraud (chống Sub-Account Liability clause).<br>- Process documented, không phải code. | Khẩn | [ ] |

---

### NHÓM 20 — Open Questions Resolution (8 TCs)

> PRD §11 có 8 `[NEED]` chưa resolve. Mỗi item phải có TC ràng buộc để verify hoặc document outcome trước go-live.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-20-01** | `PRD §11 [NEED] 1`, `B1` | `Integration` `[Spike]` | Onboarding URL field name discovery + fallback | 1. Sandbox: POST /v2/accounts. Log response.<br>2. Nếu URL không có field → GET /v2/accounts/{id}.<br>3. Verify field name + structure. | - Field name documented (vd `invitation_url`, `onboarding_url`).<br>- Fallback path implement.<br>- Test cả happy + fallback. | Blocker | [x] |
| **TC-F34X-20-02** | `PRD §11 [NEED] 2` | `Integration` `[Spike]` | `account.updated` payload structure | 1. Sandbox: trigger các status transitions.<br>2. Log webhook payload mỗi event. | - Document payload schema cho từng status (REGISTERED, AWAITING_DOCS, PENDING_VERIFICATION).<br>- Parser handle đầy đủ. | Blocker | [x] |
| **TC-F34X-20-03** | `PRD §11 [NEED] 3`, `R13` | `Integration` `[Spike]` | Channel code DUITNOW exact name | 1. Channel Data Finder MY hoặc sandbox test.<br>2. Verify exact: `DUITNOW_QR` vs `QR_DUITNOW` vs khác. | - Tên chính xác documented.<br>- Code constant export đúng. | Blocker | [x] |
| **TC-F34X-20-04** | `PRD §11 [NEED] 4`, `BR-04` | `E2E` `[Critical]` | Sandbox: thật pay RM 1 → verify currency unit | 1. Sandbox test 1 đơn RM 1 qua TNG.<br>2. Inspect Xendit Dashboard balance + DB. | - Confirmed: Xendit MYR = RM major unit.<br>- DB sen=100, Xendit balance = RM 1.<br>- BR-04 conversion logic correct. | Blocker | [ ] |
| **TC-F34X-20-05** | `PRD §11 [NEED] 5`, `A-5` | `Integration` `[Spike]` | Callback URL setup: API hay Dashboard | 1. Sandbox: thử cả `/callback_urls/{type}` API + Dashboard.<br>2. Verify webhook đến đúng endpoint. | - Method work documented.<br>- Implementation align method chọn. | Khẩn | [x] |
| **TC-F34X-20-06** | `PRD §11 [NEED] 6`, `J4` | `DB` `[Schema]` | `partially_refunded` enum F13 schema check | 1. Inspect `payment_status` enum F13.<br>2. Nếu có → reuse; nếu thiếu → migration ALTER. | - Confirm có hay không.<br>- TC-F34X-16-07 cover migration. | Khẩn | [x] |
| **TC-F34X-20-07** | `PRD §11 [NEED] 7`, `E1` | `Integration` `[Spike]` | Auto-Withdrawal MANAGED config method | 1. Sandbox: bật Auto-Withdrawal trên Dashboard sub-account.<br>2. Test payout từ sub-account → bank merchant. | - Confirm Dashboard config work MANAGED.<br>- KHÔNG cần platform API code → giữ non-custody status. | Blocker | [ ] |
| **TC-F34X-20-08** | `PRD §11 [NEED] 8`, `J1` | `DB` `[Schema]` | `xenditOnboardingComplete` field placement on Tenant | 1. Add field vào Tenant collection.<br>2. Migration test. | - Field tồn tại, default false.<br>- Update khi webhook account.activated.<br>- TC-F34X-02-06 verify update flow. | Khẩn | [x] |

---

### NHÓM 21 — Checkout UI Buyer-Facing (12 TCs) — `/sites/[slug]/checkout`

> Bổ sung v1.2: doc trước thiếu UI checkout page. Mirror F13 TC-F13.08, 12-19, 81, 94-96 patterns. Test bằng Playwright + React Testing Library.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-21-01** | `B-4, B-5` | `UI` `[Positive]` | Payment method picker hiển thị channels enabled động | 1. Pre: tenant LIVE bật TNG + GrabPay + CARDS.<br>2. Buyer load `/sites/[slug]/checkout`. | - RadioGroup có rows: Xendit (TNG · GrabPay · Card) + COD/QR nếu enabled.<br>- Label đúng channels.<br>- Không hiển thị channel disabled. | Blocker | [ ] |
| **TC-F34X-21-02** | `B-5` | `UI` `[Edge]` | Tenant tắt hết Xendit methods → row hidden | 1. Pre: disable hết Xendit channels.<br>2. Load checkout. | - Xendit row KHÔNG render.<br>- Nếu cả Stripe + Xendit + COD/QR off → message "Liên hệ shop để thanh toán". | Khẩn | [x] |
| **TC-F34X-21-03** | `B-11` | `UI` `[Positive]` | Dual provider: Stripe + Xendit row coexist | 1. Pre: tenant-DUAL LIVE cả 2.<br>2. Load checkout. | - 2 rows separate: "Pay with Stripe (Card)" + "Pay with Xendit (TNG · QR · FPX)".<br>- Buyer chọn 1. | Khẩn | [ ] |
| **TC-F34X-21-04** | `B-1` | `UI` `[Negative]` | Place Order disabled khi chưa chọn method | 1. Buyer load checkout, không chọn method. | - Place Order disabled.<br>- Validation message "Vui lòng chọn phương thức thanh toán". | Khẩn | [x] |
| **TC-F34X-21-05** | `B-3` | `UI` `[Positive]` | Place Order loading state khi createPaymentRequest 1-3s | 1. Buyer chọn TNG + click Place Order.<br>2. Mock Xendit API delay 2s. | - Button disabled + spinner.<br>- Full-page dialog "Đang chuyển hướng đến Xendit. Vui lòng không đóng cửa sổ này".<br>- Radio disabled trong khi loading. | Khẩn | [ ] |
| **TC-F34X-21-06** | `B-3, R3` | `Race` `[Critical]` | Double-click Place Order trong 200ms không double-charge | 1. Buyer click Place Order 2 lần liên tiếp 200ms gap.<br>2. Spy `POST /api/orders/xendit-checkout` calls + DB orders. | - Client disable button ngay sau click 1.<br>- Backend dùng idempotency-key/reference_id check → chỉ 1 order tạo, 1 payment_request.<br>- KHÔNG 2 charges. | Blocker | [x] |
| **TC-F34X-21-07** | `B-4` | `UI` `[Positive]` | DuitNow QR PRESENT mode hiển thị QR canvas + countdown | 1. Buyer chọn DuitNow QR + Place Order.<br>2. Response trả QR data.<br>3. Trang render. | - QR canvas/image hiển thị (base64 hoặc URL từ Xendit).<br>- Countdown timer đếm ngược từ QR expiry (ví dụ 5 phút).<br>- Poll status mỗi 2s. | Khẩn | [ ] |
| **TC-F34X-21-08** | `B-4` | `UI` `[Edge]` | DuitNow QR countdown hết hạn → nút "Tạo QR mới" | 1. Pre: QR đã expire (countdown=0).<br>2. Buyer click "Tạo QR mới". | - UI tạo payment_request mới, QR canvas refresh.<br>- KHÔNG tạo order mới (cùng orderId).<br>- Countdown reset. | High | [x] |
| **TC-F34X-21-09** | `B-12, B-13` | `UX` `[Negative]` | Buyer cancel/back từ Xendit hosted page → toast BM | 1. Buyer redirect Xendit → bấm Back/cancel.<br>2. App nhận `cancel_url` hoặc `xendit_cancelled=1`. | - Toast BM "Pembayaran gagal. Sila cuba lagi."<br>- Cart KHÔNG bị xóa.<br>- Order vẫn `pending`.<br>- CTA "Thử lại" tạo payment_request mới. | Khẩn | [x] |
| **TC-F34X-21-10** | `R3` | `Mobile UI` `[Positive]` | Mobile 375px method rows hitbox ≥ 54px | 1. Viewport 375px.<br>2. Load checkout payment step.<br>3. Đo Xendit/Stripe/COD/QR rows. | - Min-height ≥ 54px.<br>- Stack dọc.<br>- Active state rõ.<br>- KHÔNG horizontal overflow. | Khẩn | [ ] |
| **TC-F34X-21-11** | `B-3` | `UI` `[Edge]` | Xendit createPaymentRequest fail → error state rõ | 1. Mock Xendit trả 500.<br>2. Buyer click Place Order. | - Toast/banner "Không kết nối được Xendit, vui lòng thử lại sau".<br>- Cart preserved.<br>- Stock restock (qua API).<br>- Nút Retry. | Khẩn | [x] |
| **TC-F34X-21-12** | `B-3` | `Sec` `[Negative]` | Form submit không có CSRF token → 403 | 1. POST checkout không CSRF token (Postman). | - HTTP 403.<br>- UI "Session expired, please reload". | High | [x] |

---

### NHÓM 22 — Order Detail UI Seller View (10 TCs) — `/dashboard/orders/[id]`

> Refund button + modal + history table. Mirror F13 deferred refund UI nhưng Phase C Xendit có refund production-grade.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-22-01** | `C-1, AC-C1` | `UI` `[Positive]` | Refund button visible cho order paid Xendit | 1. Pre: order paid via Xendit.<br>2. Seller load order detail. | - Nút "Hoàn tiền" visible.<br>- Click mở modal. | Blocker | [ ] |
| **TC-F34X-22-02** | `C-2, BR-11` | `UI` `[Negative]` | Refund button disabled khi order chưa paid | 1. Pre: order pending hoặc payment_failed.<br>2. Load order detail. | - Nút disabled hoặc hidden.<br>- Tooltip "Order chưa thanh toán". | Khẩn | [x] |
| **TC-F34X-22-03** | `C-2, BR-11` | `UI` `[Negative]` | Refund button disabled khi đã refunded full | 1. Pre: order refunded full.<br>2. Load detail. | - Disabled.<br>- Tooltip "Đã hoàn tiền toàn bộ". | Khẩn | [x] |
| **TC-F34X-22-04** | `C-2` | `UI` `[Positive]` | Modal refund full vs partial input | 1. Click "Hoàn tiền".<br>2. Modal mở. | - Radio: Full / Partial.<br>- Partial → input amount visible.<br>- Reason dropdown.<br>- Confirm button. | Khẩn | [ ] |
| **TC-F34X-22-05** | `C-2, BR-11` | `Valid` `[Negative]` | Validate amount partial > paid → inline error | 1. Pre: paid RM 100.<br>2. Modal input amount=150. | - Error inline "Số tiền hoàn vượt quá thanh toán".<br>- Confirm button disabled. | Khẩn | [x] |
| **TC-F34X-22-06** | `C-2` | `Valid` `[Negative]` | Validate amount = 0 → error | 1. Input amount=0. | - Error "Số tiền hoàn phải > 0".<br>- Disabled. | High | [x] |
| **TC-F34X-22-07** | `C-2, BR-11` | `UI` `[Positive]` | Partial refunded → modal hiển thị remaining | 1. Pre: order paid RM 100, đã refund RM 30.<br>2. Click Refund.<br>3. Inspect modal max amount. | - Modal pre-fill max=RM 70 (remaining).<br>- Input không cho > 70.<br>- Hiển thị "Còn lại: RM 70.00". | Khẩn | [x] |
| **TC-F34X-22-08** | `C-3` | `UI` `[Positive]` | Refund history table list các refunds | 1. Pre: order có 3 partial refunds.<br>2. Load detail. | - Table: Date / Amount / Reason / Status / Refund ID.<br>- 3 rows.<br>- Sort by date DESC. | Khẩn | [ ] |
| **TC-F34X-22-09** | `B-7` | `UI` `[Positive]` | Status badge màu theo state | 1. Pre: orders với 6 statuses khác nhau.<br>2. Load list. | - Badge: paid (xanh), pending (vàng), payment_failed (đỏ), cancelled (xám), refunded (xám), partially_refunded (cam).<br>- Color WCAG AA contrast. | High | [x] |
| **TC-F34X-22-10** | `B-9` | `UI` `[Positive]` | Provider badge + channel_code icon | 1. Load order Xendit TNG.<br>2. Inspect detail. | - Badge "Xendit" + icon TNG.<br>- Tooltip channel_code đúng.<br>- Stripe order: badge "Stripe" + icon Card/FPX. | Medium | [x] |

---

### NHÓM 23 — Order Detail Buyer + Connect Payment UI (16 TCs)

> Phần 1: Buyer track order Xendit (`/sites/[slug]/orders/[orderNumber]`). Phần 2: Connect Payment UI seller mirror F13 patterns. Phần 3: Balance display UI.

#### 23.1 — Buyer Track Order Xendit (5 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-23-01** | `B-10` | `UI` `[Positive]` | Buyer track Xendit order real-time status update | 1. Pre: order pending.<br>2. Buyer load `/sites/[slug]/orders/[orderNumber]`.<br>3. Trigger webhook payment.capture. | - Status badge update từ "Pending" → "Paid" không cần reload (SSE/poll). | Khẩn | [ ] |
| **TC-F34X-23-02** | `B-10` | `UI` `[Positive]` | Confirm page sau Xendit redirect success | 1. Buyer pay xong → Xendit redirect `success_url`.<br>2. Load confirm page. | - Hiển thị order summary, badge "Paid", thông báo "Email xác nhận đã gửi".<br>- Self-heal poll cứ 2s max 30s nếu pending. | Khẩn | [ ] |
| **TC-F34X-23-03** | `B-13` | `UI` `[Positive]` | Buyer thấy nút Retry khi payment_failed | 1. Pre: order payment_failed.<br>2. Buyer load detail. | - Nút "Thử lại" visible.<br>- Click → tạo payment_request mới, redirect Xendit. | Khẩn | [x] |
| **TC-F34X-23-04** | `B-12` | `UI` `[Positive]` | Buyer thấy "Đã huỷ" + lý do nếu cancelled | 1. Pre: order cancelled.<br>2. Buyer load detail. | - Message "Đơn đã huỷ".<br>- Lý do hiển thị (24h timeout hoặc manual).<br>- Contact support link. | High | [x] |
| **TC-F34X-23-05** | `A-1` | `Sec` `[Negative]` | Buyer truy cập order tenant khác qua URL guess | 1. Bearer guest.<br>2. URL `/sites/X/orders/orderY` không thuộc tenant X. | - 404 hoặc 403.<br>- KHÔNG leak order info. | Khẩn | [x] |

#### 23.2 — Connect Payment UI Seller (6 TCs) — Mirror F13 TC-F13.20-28

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-23-06** | `A-1, A-9` | `UI` `[Positive]` | Not LIVE: Disabled + Lock + Tooltip pattern | 1. Pre: tenant chưa LIVE.<br>2. Load `/dashboard/settings/payments`. | - Toggle TNG/Card/FPX disabled.<br>- Lock icon.<br>- Tooltip "Connect Xendit to enable".<br>- Banner đỏ "Connect Xendit to accept TNG/QR/FPX/Card".<br>- CTA "Connect Xendit" visible. | Blocker | [x] |
| **TC-F34X-23-07** | `A-1` | `UI` `[Negative]` | Click toggle khi chưa LIVE → toast + scroll | 1. Pre: chưa LIVE.<br>2. Seller cố click toggle TNG. | - Toggle không đổi state.<br>- Toast "Connect Xendit first".<br>- Focus/scroll đưa seller tới Connect CTA. | High | [x] |
| **TC-F34X-23-08** | `A-9` | `UI` `[Positive]` | After LIVE: toggle Save DB | 1. Pre: tenant LIVE.<br>2. Toggle TNG/Card và Save. | - DB lưu `payment_touchngo`, `payment_card`.<br>- Toast "Payment methods updated".<br>- Checkout lần sau dùng setting mới. | Khẩn | [x] |
| **TC-F34X-23-09** | `A-9` | `UI` `[Edge]` | Tất cả Xendit methods OFF → soft warning | 1. Pre: LIVE.<br>2. Tắt hết Xendit methods. | - Warning "Ít nhất 1 method bắt buộc".<br>- Save không crash.<br>- Backend chặn checkout (TC-F34X-05-02). | High | [x] |
| **TC-F34X-23-10** | `A-9` | `UI` `[Positive]` | Connect CTA flow: click → redirect Xendit hosted | 1. Click "Connect Xendit".<br>2. POST `/api/xendit/connect`. | - `window.location.href` redirect Xendit URL.<br>- Loading state trước redirect. | Blocker | [ ] |
| **TC-F34X-23-11** | `A-9` | `UI` `[Positive]` | Return Prime với ?xendit=complete → refresh status + toast | 1. Xendit redirect back `?xendit=complete`. | - Toast success "Xendit connected!".<br>- Toggle unlock.<br>- Banner ẩn.<br>- `router.replace` strip query param. | Khẩn | [ ] |

#### 23.3 — Balance Display UI Settings (5 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-23-12** | `C-6, AC-C8` | `UI` `[Positive]` | Balance card hiển thị available + pending breakdown | 1. Pre: tenant LIVE có balance.<br>2. Load settings/payments. | - Card hiển thị "Available: RM X.XX" + "Pending settlement: RM Y.YY" breakdown (thẻ T+7, ví T+2, VA T+0). | Khẩn | [ ] |
| **TC-F34X-23-13** | `C-6` | `UI` `[Positive]` | Refresh button bypass cache | 1. Click "Refresh" button. | - Call `GET /v2/accounts/{id}/balance` fresh (không cached).<br>- Balance update trên UI. | High | [x] |
| **TC-F34X-23-14** | `C-6, F1` | `UI` `[Edge]` | GET /balance fail → fallback UI | 1. Mock Xendit /balance trả 500.<br>2. Load settings. | - Balance card hiển thị "Không lấy được balance" + nút retry.<br>- KHÔNG crash settings page. | Khẩn | [x] |
| **TC-F34X-23-15** | `C-8` | `UI` `[Positive]` | Payout history table read-only | 1. Load settings. | - Table list payouts từ Xendit (date, amount, status, bank).<br>- KHÔNG nút edit/delete.<br>- Pagination nếu nhiều. | Medium | [x] |
| **TC-F34X-23-16** | `R11` | `UI` `[Positive]` | KYB lead time banner countdown | 1. Pre: tenant INVITED đã 3 ngày.<br>2. Load settings. | - Banner "Đã 3 ngày, KYB thường mất 1-5 ngày. Liên hệ Xendit support nếu chờ lâu hơn."<br>- CTA "Liên hệ support". | High | [ ] |

---

### NHÓM 24 — Tạm ẩn Xendit (GH-2132) (11 TCs) — flag `XENDIT_ENABLED=false`

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34X-24-01** | `GH-2132 AC-01` | `UI` `[Positive]` | Settings không hiện Xendit (tenant chưa kết nối) | 1. Vào settings/payments (EN + MY). | - Không có section Xendit.<br>- Stripe + COD + Bank/QR giữ nguyên. | Khẩn | [x] |
| **TC-F34X-24-02** | `GH-2132 AC-01` | `UI` `[Positive]` | Settings không hiện Xendit (tenant đã có key) | 1. Tenant có `xenditSecretKey`.<br>2. Vào settings/payments. | - Không có Connected bar / nút disconnect. | Khẩn | [x] |
| **TC-F34X-24-03** | `GH-2132 AC-03` | `API` `[Negative]` | `POST /api/orders/xendit-checkout` bị chặn | 1. Tenant có key.<br>2. POST payload hợp lệ. | - 422 `PAYMENT_METHOD_DISABLED`.<br>- Không tạo order, không gọi Xendit. | Blocker | [x] |
| **TC-F34X-24-04** | `GH-2132 AC-05` | `UI` `[Positive]` | Bật flag → section Xendit trở lại | 1. `XENDIT_ENABLED=true`.<br>2. Render settings. | - Section Xendit hiển thị. | High | [x] |
| **TC-F34X-24-05** | `GH-2132 AC-02` | `UI` `[Positive]` | Checkout: tenant đã kết nối không còn option Xendit | 1. Tenant có key, render checkout SSR. | - `xenditConnected=false`.<br>- Xendit không tính vào `hasPaymentMethods`. | Khẩn | [x] |
| **TC-F34X-24-06** | `GH-2132 AC-02` | `UI` `[Positive]` | Checkout: phương thức khác không bị ảnh hưởng | 1. Tenant có key + COD bật. | - COD vẫn bật, `hasPaymentMethods=true`. | High | [x] |
| **TC-F34X-24-07** | `GH-2132 AC-05` | `UI` `[Positive]` | Checkout: bật flag → option Xendit trở lại | 1. `XENDIT_ENABLED=true`. | - `xenditConnected=true`. | High | [x] |
| **TC-F34X-24-08** | `GH-2132 AC-04` | `E2E` `[Regression]` | Đơn Xendit đang dở vẫn xử lý được khi flag tắt | 1. Có đơn Xendit `awaiting_payment` tạo trước đó.<br>2. Retry payment, trả tiền, nhận webhook, cancel/refund. | - Tất cả hoạt động bình thường (không bị chặn bởi flag). | Blocker | [ ] |
| **TC-F34X-24-09** | `GH-2132 AC-05` | `Unit` `[Guard]` | Flag mặc định tắt khi ship | 1. Import `XENDIT_ENABLED`. | - Giá trị `false` (đổi test này khi chủ động bật lại). | High | [x] |
| **TC-F34X-24-10** | `GH-2132 AC-01` | `API` `[Negative]` | Server action `saveXenditKeys` bị chặn khi flag tắt | 1. Gọi `saveXenditKeys('xnd_…','token')` trực tiếp. | - `{success:false}`; không đọc DB, không gọi Xendit, không ghi key. | Khẩn | [x] |
| **TC-F34X-24-11** | `GH-2132` | `API` `[Positive]` | `disconnectXendit` vẫn dùng được khi flag tắt | 1. Tenant có key.<br>2. Gọi `disconnectXendit()`. | - Key bị xoá (`null`), `success:true`. | High | [x] |
