# QA Test Plan: F34 — Xendit Payment Integration (Malaysia)

> **Version:** 1.0 | **Created:** 2026-06-10 | **Owner:** QC
> **PRD:** [Overview](../prd/F34-xendit-payment-overview.md) · [S1](../prd/F34-xendit-payment-sprint1.md) · [S2](../prd/F34-xendit-payment-sprint2.md) · [S3](../prd/F34-xendit-payment-sprint3.md)
> **UI:** [F34 Design](../design/F34-xendit-payment-design.md)
> **Convention:** [TEST_CONVENTION.md](../TEST_CONVENTION.md) — TC-ID, AAA, import from source
> **Skill:** ✅ `ck-scenario` (12 dimensions)

---

## 1. Scope & Strategy

- **Money-critical** feature → ưu tiên Critical/High: webhook spoof/replay, idempotency, oversell/restock, double-refund, KYB gating.
- **0 regression Stripe**: chạy full Stripe payment test suite trước + sau mỗi PR (existing `src/__tests__/unit/payment/*`).
- Import logic từ source — KHÔNG re-implement (verify token, normalize, reconcile, stock CAS).
- Mock Xendit API (không gọi thật trong unit/integration); E2E dùng Xendit sandbox.

### Dimensions analyzed
1 User Types · 2 Input Extremes · 3 Timing · 4 Scale · 5 State Transitions · 7 Error Cascades · 8 Authorization · 9 Data Integrity · 10 Integration · 11 Compliance · 12 Business Logic
### Skipped
6 Environment (UI a11y/responsive covered in design spec + visual tests, không thuộc money-logic) — vẫn có 2 TC mobile cho buyer flow.

---

## 2. Scenario Report (12 dimensions, 38 scenarios)

| # | Dimension | Scenario | Severity | Expected | Maps AC |
|---|-----------|----------|----------|----------|---------|
| 1 | Integration | Webhook `x-callback-token` sai/thiếu | **Critical** | 401, order KHÔNG đổi | S2-AC4 |
| 2 | Integration | Webhook replay (cùng event 2×) | **Critical** | transition 1 lần, email 1 lần (already_processed) | S2-AC5 |
| 3 | Integration | Webhook đến trước khi order lưu xong (race) | High | reconcile not_found → Xendit retry / cron self-heal | S2-AC8 |
| 4 | Integration | Webhook event lạ / `payment.failure` | Medium | return 200, order giữ pending/failed | S2-AC10 |
| 5 | Integration | Xendit invoice creation timeout | High | rollback: order không tạo / pending huỷ + restock | S2-AC11 |
| 6 | Integration | Xendit API version drift payload schema | Medium | normalize trả null an toàn, log, 200 | S2-AC10 |
| 7 | Integration | Webhook account.activated đến | High | onboardingComplete=true, status LIVE | S1-AC6 |
| 8 | Timing | 2 buyer checkout cùng lúc, stock=1 | **Critical** | 1 thành công, 1 nhận 409 OUT_OF_STOCK (CAS) | S2-AC6 |
| 9 | Timing | Webhook + poll + cron cùng fire 1 order | **Critical** | atomic single-winner: 1 transition | S2-AC5, S3-AC11 |
| 10 | Timing | Buyer trả ngay khi cron đang dọn expired | High | không cancel order đã paid (atomic guard) | S3-AC7 |
| 11 | Timing | Webhook trễ > 30s, buyer poll confirm | High | self-heal reconcile → paid | S2-AC8 |
| 12 | Timing | Onboard click double (double-submit) | Medium | không tạo 2 sub-account (idempotent) | S1-AC3 |
| 13 | Authorization | Connect API forge tenantId (no ownership check) | **Critical** | 403, không tạo account cho tenant khác | S1-AC10 |
| 14 | Authorization | Checkout khi account chưa LIVE | High | 422 XENDIT_NOT_READY, không tạo order | S2-AC2, S1-AC11 |
| 15 | Authorization | Reconcile gọi không qua ownership check | **Critical** | caller phải verify trước (webhook IDOR guard) | S2-AC4 |
| 16 | Authorization | Cron reconcile thiếu cron secret | High | 401 | S3-AC11 |
| 17 | Authorization | Tenant A refund order của tenant B | **Critical** | 403/404, không refund | S3-AC1 |
| 18 | Authorization | `XENDIT_SECRET_KEY` chưa set | High | throw config error rõ, không 500 mơ hồ | S1-AC10 |
| 19 | Business Logic | Refund full order paid | High | Xendit refund ok, status refunded | S3-AC1 |
| 20 | Business Logic | Refund partial RM40/RM100 | High | partially_refunded, amount đúng | S3-AC2 |
| 21 | Business Logic | Refund khi chưa paid | High | 422 NOT_REFUNDABLE | S3-AC3 |
| 22 | Business Logic | Refund 2× full (double-refund) | **Critical** | idempotent, không double-refund | S3-AC4 |
| 23 | Business Logic | Refund amount > paid | High | reject validate | S3-AC2 |
| 24 | Business Logic | Tenant tắt hết payment method → checkout | Medium | 422 NO_PAYMENT_METHODS | S2-AC9 |
| 25 | Business Logic | Merchant có cả Stripe+Xendit, buyer chọn FPX | High | route đúng provider, không double-charge | S2-AC12 |
| 26 | Business Logic | Auto-Withdrawal bật khi thiếu bank | High | chặn + báo "thêm bank khớp KYB" | S3-AC9 |
| 27 | Business Logic | Đơn RM0 / âm | High | reject tạo invoice | S2-AC11 |
| 28 | State Transitions | KYB pending → rejected | Medium | hiện lý do + CTA nộp lại | S1-AC7 |
| 29 | State Transitions | Disconnect khi còn pending Xendit order | High | chặn "còn đơn chưa thanh toán" | S1-AC8 |
| 30 | State Transitions | Buyer abort giữa Xendit hosted page | Medium | order pending → cron expiry cancel+restock | S3-AC7 |
| 31 | State Transitions | Retry pay trên order failed | Medium | tạo invoice mới, không double stock | S2-AC1 |
| 32 | Data Integrity | 2 order cùng `xenditPaymentRequestId` (unique idx) | High | DB reject duplicate | S2 schema |
| 33 | Data Integrity | Persist metadata Xendit fail sau paid | Medium | order VẪN paid (non-critical) | S2-AC13 |
| 34 | Data Integrity | Cron restock phantom (đã giảm ở checkout) | High | chỉ restock đúng trạng thái pending Xendit | S3-AC7 |
| 35 | Error Cascades | DB down giữa stock CAS + invoice create | High | rollback, không kẹt stock | S2-AC11 |
| 36 | Error Cascades | Xendit refund API timeout | High | order không mark refunded sai, cho retry | S3-AC12 |
| 37 | Compliance | PAN/ví đi qua server ta (PDPA/PCI) | **Critical** | 0 byte nhạy cảm qua server (hosted) | S2-NFR2 |
| 38 | Compliance | KYB data lưu trên server ta | High | chỉ lưu id+status, data ở Xendit | S1-NFR5 |

### Summary
- **Critical: 9** · High: 21 · Medium: 8 · Low: 0
- **Total: 38** scenarios / 11 dimensions

---

## 3. Test Cases (TC-ID → AAA)

> Naming: `TC-F34.{sprint}{nn}`. Import logic từ source; mock Xendit client.

### Sprint 1 — Onboarding + KYB

| TC-ID | Title | Type | Maps |
|-------|-------|------|------|
| TC-F34.101 | BasicAuth header build đúng (key:empty) | unit | S1-AC2 |
| TC-F34.102 | Webhook x-callback-token tamper → 401 | unit | S1-AC8, #13 |
| TC-F34.103 | Onboard tạo MANAGED sub-account (mock) | integration | S1-AC2 |
| TC-F34.104 | Onboard idempotent — không tạo sub-account 2× | integration | S1-AC3, #12 |
| TC-F34.105 | Webhook account.activated → LIVE + onboardingComplete | integration | S1-AC6, #7 |
| TC-F34.106 | Webhook AWAITING_DOCS/PENDING/SUSPENDED → status map | integration | S1-AC7/AC9, #28 |
| TC-F34.107 | Disconnect bị chặn khi còn pending order | integration | S1-AC8, #29 |
| TC-F34.108 | `XENDIT_SECRET_KEY` missing → config error | unit | S1-AC10, #18 |
| TC-F34.109 | Onboard API timeout → state an toàn | integration | S1-AC9 |
| TC-F34.110 | Migrations apply (check-migrations pass) | ci | S1 schema |

### Sprint 2 — Checkout + Webhook

| TC-ID | Title | Type | Maps |
|-------|-------|------|------|
| TC-F34.201 | Checkout account LIVE → order pending + payment_request | integration | S2-AC1 |
| TC-F34.202 | Checkout account chưa LIVE → 422 NOT_READY | integration | S2-AC2, #14 |
| TC-F34.203 | Webhook token sai → 401, order không đổi | unit+int | S2-AC4, #1 |
| TC-F34.204 | Webhook token verify timing-safe | unit | S2-NFR1, #1 |
| TC-F34.205 | Webhook replay → transition 1 lần | integration | S2-AC5, #2 |
| TC-F34.206 | normalizeXenditEvent map đúng/null | unit | S2-AC10, #6 |
| TC-F34.207 | Stock CAS oversell — 2 concurrent, stock=1 | integration | S2-AC6, #8 |
| TC-F34.208 | Webhook+poll+cron đồng thời → single-winner | integration | S2-AC5, #9 |
| TC-F34.209 | Paid qua DuitNow → provider+method persist | integration | S2-AC7 |
| TC-F34.210 | Webhook trễ → confirm poll self-heal < 30s | integration | S2-AC8, #11 |
| TC-F34.211 | Tắt hết method → 422 NO_PAYMENT_METHODS | integration | S2-AC9, #24 |
| TC-F34.212 | `payment.failure` event → 200, order failed/pending | integration | S2-AC10, #4 |
| TC-F34.213 | Invoice create fail → rollback restock | integration | S2-AC11, #5,#35 |
| TC-F34.214 | Routing Stripe+Xendit không double-charge | integration | S2-AC12, #25 |
| TC-F34.215 | Persist metadata fail → order vẫn paid | integration | S2-AC13, #33 |
| TC-F34.216 | Duplicate xenditPaymentRequestId → DB reject | integration | #32 |
| TC-F34.217 | **REGRESSION** Stripe checkout+webhook vẫn pass | regression | S2 risk |
| TC-F34.218 | Order RM0/âm → reject | unit | #27 |
| TC-F34.219 | Buyer mobile 375px checkout method picker | e2e/visual | UI |

### Sprint 3 — Refund + Reconcile + Disburse

| TC-ID | Title | Type | Maps |
|-------|-------|------|------|
| TC-F34.301 | Refund full → status refunded | integration | S3-AC1, #19 |
| TC-F34.302 | Refund partial → partially_refunded | integration | S3-AC2, #20 |
| TC-F34.303 | Refund chưa paid → 422 | integration | S3-AC3, #21 |
| TC-F34.304 | Refund 2× full → idempotent, no double | integration | S3-AC4, #22 |
| TC-F34.305 | Refund amount > paid → reject | unit | S3-AC2, #23 |
| TC-F34.306 | Refund cross-tenant → 403/404 | integration | #17 |
| TC-F34.307 | Refund webhook → status cập nhật | integration | S3-AC5 |
| TC-F34.308 | Cron reconcile pending → check invoice paid | integration | S3-AC6, #9 |
| TC-F34.309 | Cron expiry → cancel + restock | integration | S3-AC7, #30 |
| TC-F34.310 | Cron restock không phantom | integration | S3-AC7, #34 |
| TC-F34.311 | Cron idempotent (chạy 2×) | integration | S3-AC11, #9 |
| TC-F34.312 | Cron thiếu secret → 401 | integration | #16 |
| TC-F34.313 | Auto-Withdrawal bật khi đủ bank → schedule set | integration | S3-AC8 |
| TC-F34.314 | Auto-Withdrawal thiếu bank → chặn | integration | S3-AC9, #26 |
| TC-F34.315 | Balance display read-only | integration | S3-AC10 |
| TC-F34.316 | Refund API timeout → không mark sai | integration | S3-AC12, #36 |
| TC-F34.317 | **REGRESSION** Stripe refund vẫn pass | regression | S3 risk |

---

## 4. Traceability Matrix (AC → TC)

| Sprint | AC | TC | Covered |
|--------|----|----|---------|
| S1 | AC1–AC12 | 101–110 | ✅ (AC1,5,12 = UI verify thủ công + 103/105/settings) |
| S2 | AC1–AC13 | 201–218 | ✅ 100% |
| S3 | AC1–AC12 | 301–317 | ✅ 100% |

> AC ↔ TC coverage: **S2/S3 = 100%**. S1 AC1/AC5/AC12 (UI states) verify qua component test + manual (design spec). Tổng AC = 37, TC = 47.

---

## 5. Risk-Based Priority (chạy trước)

1. **TC-F34.203/204/205** webhook spoof + replay (Critical security/money).
2. **TC-F34.207/208** oversell + single-winner (Critical money).
3. **TC-F34.304** double-refund (Critical money).
4. **TC-F34.217/317** Stripe regression (chặn merge nếu fail).
5. **TC-F34.102** webhook token verify + connect-auth (#13).

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation TC |
|------|-----------|--------|---------------|
| Webhook static token lộ → spoof | Trung bình | Critical | 203,204 + idempotency 205 |
| Generalize reconcile phá Stripe | Trung bình | High | 217 regression gate |
| Oversell dưới concurrency | Thấp (CAS) | High | 207,208 |
| Double-refund tiền merchant | Thấp (idem) | Critical | 304,316 |
| Phantom restock | Trung bình | High | 310,334 |

---

## 7. [NEED]

- `[NEED]` Xendit sandbox creds cho E2E (test KYB + checkout + refund thật).
- `[NEED]` Xendit webhook event names + payload schema thật (cố định TC-F34.206).
- `[NEED]` Xác nhận `payment_status` enum đã có `partially_refunded` (ảnh hưởng TC-F34.302).
- `[NEED]` Baseline số liệu để đặt ngưỡng p95 < 30s (TC self-heal).
