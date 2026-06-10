# PRD: F34 — Xendit Sprint 3 — Refund + Reconcile + Auto-disburse

> **Version:** 2.0 (Draft) | **Updated:** 2026-06-10 | **Owner:** Domin (Product)
> **Priority:** P1 | **Wave:** 7 | **Size:** M | **Effort:** ~1–2 tuần
> **Overview:** [F34 Overview](./F34-xendit-payment-overview.md)
> **Depends on:** [F34 Sprint 2](./F34-xendit-payment-sprint2.md) ✅ (checkout + webhook live)
> **Spec source (authoritative):** `docs/xendit-api-reference/refund-payment-request.md` (`POST /refunds`), `create-payout.md` (`POST /v2/payouts`), `get-balance.md`, `get-payout-channels.md`
> **Reuse:** cron reconcile `src/lib/jobs/reconcile-orders.ts`, payment-expiry cron `src/app/api/cron/payment-expiry`, refund route `src/app/api/orders/[id]/refund/route.ts`

---

> [!IMPORTANT]
> **v2.0 correction (theo spec thật):** Refund = **`POST /refunds`** (`amount` cho partial, `reason`); webhook **`refund.succeeded` / `refund.failed`**. Payout (rút bank) = **`POST /v2/payouts`** với header **`Idempotency-key`** + `channel_code` (bank MY từ `get-payout-channels`). Balance = **`GET /balance`**. **Auto-Withdrawal lập lịch** là cấu hình phía Xendit Dashboard (per sub-account), KHÔNG phải API — nếu cần lập lịch chủ động, platform tự chạy cron gọi `/v2/payouts`. Tất cả call đính `for-user-id`.

---

## 1. Problem Statement

- Sprint 2 buyer trả được nhưng: (a) chưa có **refund**; (b) webhook trễ/mất chưa có cron dọn cho Xendit; (c) tiền nằm trong **balance sub-account** chưa về bank merchant.
- Merchant cần tiền về bank — qua **Auto-Withdrawal (Dashboard config)** hoặc **payout chủ động** (`/v2/payouts`).
- Đơn `pending` quá hạn cần **dọn + restock** (đồng pattern F13 payment-expiry).

## 2. Target User

- **SME Owner:** nhận tiền về bank; refund buyer khi cần; số dư minh bạch.
- **Buyer:** được refund đúng kênh đã trả.
- **Platform/Finance:** đối soát; 0 tiền kẹt.

## 3. Solution Overview (theo spec thật)

1. **Refund** — `POST /api/orders/[id]/refund` mở rộng cho `payment_provider='xendit'`: gọi **`POST /refunds`** (header `for-user-id`) với `payment_request_id` + `amount`(partial) + `reason`; webhook `refund.succeeded`/`refund.failed` → cập nhật order. Mirror refund Stripe.
2. **Reconcile cron** — mở rộng `reconcile-orders.ts` + payment-expiry cron cho Xendit: pending quá hạn → `getPaymentRequest()`; `SUCCEEDED` → reconcile; `FAILED`/expired → cancel + restock.
3. **Disburse** — 2 cách: (a) merchant bật **Auto-Withdrawal trên Xendit Dashboard** (lập lịch tự rút, không cần code) — khuyến nghị MVP; (b) platform chạy cron gọi **`POST /v2/payouts`** (header `Idempotency-key`, `channel_code` bank, `for-user-id`). Settings hiển thị balance (`GET /balance`) + hướng dẫn.

> **Decision:** MVP dùng **Auto-Withdrawal Dashboard-config** (ít code, giữ "platform không giữ/không tự điều tiền"). API `/v2/payouts` chỉ làm nếu cần payout chủ động theo nghiệp vụ — để optional.

## 4. Functional Requirements

| FR | Mô tả | Story Ref |
|----|-------|-----------|
| **FR-1** | `POST /api/orders/[id]/refund` hỗ trợ `payment_provider='xendit'`: `POST /refunds` (`payment_request_id`, `amount`, `reason`) header `for-user-id`; lưu refund id + status. | US-F34-07 |
| **FR-2** | Refund partial + full; validate `amount` ≤ paid; chặn khi chưa paid / đã refund full. | US-F34-07 |
| **FR-3** | Webhook `refund.succeeded`/`refund.failed` → cập nhật order `payment_status='refunded'`/`partially_refunded`. | US-F34-07 |
| **FR-4** | Reconcile cron: pending Xendit quá ngưỡng → `getPaymentRequest()`; `SUCCEEDED` → `reconcileOrderPaid()`; `FAILED`/expired → cancel + restock. | US-F34-08 |
| **FR-5** | Payment-expiry cron cover Xendit: `payment.failure` hoặc quá TTL → order `cancelled`, restock (mirror existing). | US-F34-08 |
| **FR-6** | Settings UI: hiển thị balance sub-account (`GET /balance` + `for-user-id`) + hướng dẫn bật Auto-Withdrawal trên Xendit Dashboard. | US-F34-09 |
| **FR-7** | (Optional) `POST /api/xendit/payout` chạy payout chủ động: `POST /v2/payouts` header `Idempotency-key` + `channel_code` + `for-user-id`. | US-F34-09 |
| **FR-8** | Hiển thị balance + (nếu dùng) lịch sử payout (read-only từ Xendit). | US-F34-09 |
| **FR-9** | Payout chủ động: validate bank `channel_code` hợp lệ (từ `get-payout-channels` MY) + amount ≤ balance. | US-F34-09 |
| **FR-10** | Refund/payout API lỗi → log + error code rõ; KHÔNG để order/payout ở trạng thái sai (idempotency-key chống double). | US-F34-07 |

## 5. Non-Functional Requirements

| NFR | Yêu cầu | Mức |
|-----|---------|-----|
| **NFR-1** | Refund + payout idempotent: payout dùng header `Idempotency-key`; refund chống double bằng check status order trước. | P0 |
| **NFR-2** | Cron reconcile auth bằng cron secret (đồng pattern existing). | P0 |
| **NFR-3** | Payout config server-side; bank channel_code chỉ ref, không lưu plaintext nhạy cảm. | P0 |
| **NFR-4** | Cron idempotent — chạy nhiều lần không double-process (reconcile already_processed guard). | P0 |
| **NFR-5** | Refund webhook → order cập nhật p95 < 30s. | P1 |

## 6. Acceptance Criteria (GIVEN/WHEN/THEN)

1. **AC-1** GIVEN order Xendit `paid` WHEN seller refund full THEN `POST /refunds` ok, order `payment_status='refunded'`.
2. **AC-2** GIVEN order Xendit `paid` RM100 WHEN refund RM40 (`amount=40`) THEN order `partially_refunded`.
3. **AC-3** GIVEN order chưa paid WHEN refund THEN 422 `NOT_REFUNDABLE`.
4. **AC-4** GIVEN refund đã full WHEN refund lần nữa THEN bị chặn (không double-refund).
5. **AC-5** GIVEN webhook `refund.succeeded` WHEN xử lý THEN order `payment_status` cập nhật đúng.
6. **AC-6** GIVEN order Xendit pending + webhook mất WHEN cron reconcile THEN `getPaymentRequest()` `SUCCEEDED` → order `new/paid`.
7. **AC-7** GIVEN order Xendit pending quá TTL / `payment.failure` WHEN cron THEN order `cancelled` + restock.
8. **AC-8** GIVEN merchant xem settings WHEN load THEN thấy balance (`GET /balance`) + hướng dẫn Auto-Withdrawal Dashboard.
9. **AC-9** GIVEN payout chủ động amount > balance WHEN gọi `/v2/payouts` THEN reject.
10. **AC-10** GIVEN payout cùng `Idempotency-key` gọi 2× WHEN xử lý THEN chỉ 1 payout (không double).
11. **AC-11** GIVEN cron chạy 2× cùng order paid WHEN reconcile THEN chỉ transition 1 lần.
12. **AC-12** GIVEN Xendit refund/payout API timeout WHEN gọi THEN order/payout KHÔNG mark sai; cho retry.

## 7. Architecture & Code

### 7.1 Schema (migrations — `scripts/db-setup.js`)

```js
{ name: 'orders.xendit_refund_id',
  sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS xendit_refund_id varchar;` },
```

> `orders.payment_status` đã có refunded states ở F13 → tái dùng. `[NEED: xác nhận đã có 'partially_refunded']`.
> Payout MVP = Dashboard config → **không cần** field payout (bỏ `xendit_payout_*` của v1). Chỉ thêm nếu làm FR-7 optional.

### 7.2 xendit.ts — refund + payout + balance (extend)

```ts
/** POST /refunds — refund payment_request (partial qua amount). for-user-id = sub-account. */
export async function refundPayment(params: {
    accountId: string; paymentRequestId: string; amount?: number; reason?: string;
}): Promise<{ id: string; status: string }> {
    const res = await fetch(`${XENDIT_BASE}/refunds`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'for-user-id': params.accountId, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            payment_request_id: params.paymentRequestId,
            ...(params.amount ? { amount: params.amount } : {}),   // bỏ amount = full refund
            reason: params.reason ?? 'REQUESTED_BY_CUSTOMER',
        }),
    })
    if (!res.ok) throw new Error(`XENDIT_REFUND_FAILED: ${res.status}`)
    return await res.json()
}

/** GET /balance — số dư sub-account. */
export async function getBalance(accountId: string): Promise<{ balance: number } | null> {
    const res = await fetch(`${XENDIT_BASE}/balance`,
        { headers: { Authorization: authHeader(), 'for-user-id': accountId } })
    return res.ok ? await res.json() : null
}

/** (Optional FR-7) POST /v2/payouts — rút về bank. Idempotency-key bắt buộc. */
export async function createPayout(params: {
    accountId: string; idempotencyKey: string; channelCode: string;
    accountNumber: string; amount: number; referenceId: string;
}): Promise<{ id: string; status: string }> {
    const res = await fetch(`${XENDIT_BASE}/v2/payouts`, {
        method: 'POST',
        headers: {
            Authorization: authHeader(), 'for-user-id': params.accountId,
            'Idempotency-key': params.idempotencyKey, 'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            reference_id: params.referenceId, channel_code: params.channelCode,
            channel_properties: { account_number: params.accountNumber },
            amount: params.amount, currency: 'MYR',
        }),
    })
    if (!res.ok) throw new Error(`XENDIT_PAYOUT_FAILED: ${res.status}`)
    return await res.json()
}

/** Normalize refund webhook → refund_completed. Events: refund.succeeded / refund.failed. */
export function normalizeXenditRefundEvent(body: any): PaymentWebhookEvent | null {
    if (body?.event !== 'refund.succeeded' && body?.event !== 'refund.failed') return null
    return { provider: 'xendit', type: 'refund_completed', data: body.data ?? body, rawEvent: body }
}
```

### 7.3 Files

**Create:**
- (Optional FR-7) `src/app/api/xendit/payout/route.ts` — payout chủ động.
- `src/app/(dashboard)/settings/payments/XenditBalanceBlock.tsx` — balance + hướng dẫn Auto-Withdrawal.

**Modify:**
- `src/app/api/orders/[id]/refund/route.ts` — branch theo `payment_provider`.
- `src/lib/jobs/reconcile-orders.ts` — cover Xendit pending (`getPaymentRequest`).
- `src/app/api/cron/payment-expiry/route.ts` — cover Xendit expired + restock.
- `src/app/api/webhooks/xendit/route.ts` — handle `refund.*` (extend Sprint 2 webhook).
- `src/lib/payment/xendit.ts` — refund/balance/payout/normalizeRefund.
- `src/collections/Orders.ts` (+`xenditRefundId`).
- `scripts/db-setup.js` — migration.

## 8. Implementation Steps

1. Schema + field (atomic). → verify: `check-migrations.js`.
2. `refundPayment` + refund route branch. → verify: full/partial refund test, idempotent, Stripe refund regression.
3. Webhook `refund.*` handling. → verify: `refund.succeeded` → status đúng.
4. Cron reconcile + payment-expiry cover Xendit. → verify: webhook-miss → cron reconcile; expired → cancel+restock.
5. Balance block + (optional) payout. → verify: balance hiển thị; payout idempotent.

## 9. Todo

- [ ] Schema xendit_refund_id
- [ ] refundPayment + refund route branch (Stripe regression)
- [ ] webhook refund.* event
- [ ] cron reconcile + payment-expiry cover Xendit
- [ ] balance block + Auto-Withdrawal hướng dẫn
- [ ] (optional) payout route + idempotency
- [ ] Tests (TC-F34.3xx)

## 10. Success Criteria

- Refund full/partial qua `/refunds`, idempotent (AC-1,2,4).
- Cron self-heal pending Xendit + dọn expired + restock (AC-6,7).
- Balance hiển thị; Auto-Withdrawal hoạt động (Dashboard) hoặc payout `/v2/payouts` idempotent (AC-8,10).
- Stripe refund + cron không regression. Đẩy staging end-to-end.

## 11. Risks

| Risk | Mức | Mitigation |
|------|-----|------------|
| Double-refund | Cao | Check order status trước + Xendit refund idempotent (AC-4) |
| Double-payout | Cao | Header `Idempotency-key` (NFR-1, AC-10) |
| Auto-Withdrawal là Dashboard-only, merchant quên bật | Trung bình | Settings hướng dẫn + balance hiển thị; FR-7 payout chủ động là fallback |
| Cron restock phantom (đã giảm ở checkout) | Trung bình | Guard F13: chỉ restock khi đúng trạng thái pending Xendit |
| Settlement timeline làm merchant tưởng mất tiền | Thấp | Hiển thị rõ T+0/T+2/T+7 + balance chờ settle |

## 12. Security

- Refund check-then-act + payout `Idempotency-key` (NFR-1).
- Cron secret auth (NFR-2).
- Bank channel_code chỉ ref (NFR-3).
- Payout server-side only.

> **⚠️ NON-CUSTODY GUARDRAILS (pháp lý — [research](../plans/reports/researcher-260610-1541-xendit-managed-custody.md)):** để platform KHÔNG bị coi là bên giữ tiền (tránh cần giấy phép tài chính MY):
> - ❌ **KHÔNG dùng Transfers API** chuyển tiền giữa account (rủi ro cao nhất).
> - ❌ **KHÔNG để tiền vào balance master** rồi mới disburse — tiền phải ở sub-account merchant.
> - ❌ **KHÔNG hold/freeze/delay** balance sub-account.
> - ✅ Payout = Xendit Auto-Withdrawal (Dashboard) HOẶC `/v2/payouts` rút thẳng sub-account → bank merchant; KHÔNG qua master.

## 13. [NEED] (đã giảm nhờ specs)

- `[NEED]` `orders.payment_status` đã có `partially_refunded` chưa (xác nhận F13 schema).
- `[NEED]` Auto-Withdrawal: xác nhận MY MANAGED bật được trên Dashboard sub-account (vs cần platform API). Phase 0 hỏi sales.
- `[NEED]` Channel_code bank MY cho payout chủ động — tra `get-payout-channels.md` (đã tải) khi làm FR-7.
- `[NEED]` Phí rút (one-pager ~RM1.50/đợt) hiển thị cho merchant.
