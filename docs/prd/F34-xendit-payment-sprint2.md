# PRD: F34 — Xendit Sprint 2 — Checkout + Webhook + Multi-wallet

> **Version:** 2.0 (Draft) | **Updated:** 2026-06-10 | **Owner:** Domin (Product)
> **Priority:** P1 | **Wave:** 7 | **Size:** L | **Effort:** ~2 tuần
> **Overview:** [F34 Overview](./F34-xendit-payment-overview.md)
> **Depends on:** [F34 Sprint 1](./F34-xendit-payment-sprint1.md) ✅ (merchant status = `LIVE`)
> **Spec source (authoritative):** `docs/xendit-api-reference/create-payment-request.md` (`/v3/payment_requests`), `payment-webhook-notification.md`, `get-payment-request.md`
> **Reuse:** `reconcileOrderPaid()` (`src/lib/payment/reconcile-order-paid.ts`), checkout pattern `src/app/api/orders/stripe-checkout/route.ts`

---

> [!IMPORTANT]
> **v2.0 correction (theo spec thật):** Xendit API hiện đại = **Payment Requests `/v3/payment_requests`** (KHÔNG dùng Invoice API legacy). 1 API gói tất cả ví/QR/FPX/card. Transaction route bằng header **`for-user-id: {xenditAccountId}`**. Webhook events thật: **`payment.capture` / `payment.authorization` / `payment.failure`** (KHÔNG phải `invoice.paid/expired`). Order field đổi `xenditInvoiceId` → `xenditPaymentRequestId`.

---

## 1. Problem Statement

- Merchant đã `LIVE` (Sprint 1) nhưng chưa có đường cho buyer trả qua ví MY.
- Cần **hosted checkout đa ví**: TNG + GrabPay + ShopeePay + DuitNow QR + FPX + card — buyer trả thẳng Xendit, không qua server ta.
- Webhook Xendit verify bằng header `x-callback-token` (token tĩnh) → cần guard chống spoof/replay.
- Tái dùng `reconcileOrderPaid()` để chuyển order → paid (atomic, idempotent) mà không phá luồng Stripe.

## 2. Target User

- **Buyer (Persona C):** chọn ví MY ưa thích, trả nhanh mobile, không nhập thẻ ở server ta.
- **SME Owner:** đơn về `new/paid` tự động.

## 3. Solution Overview (theo spec thật)

Mirror luồng Stripe checkout, provider = Xendit (Payment Requests):

1. `POST /api/orders/xendit-checkout` → validate site/tenant + `xenditAccountStatus='LIVE'` (nếu không → 422 `XENDIT_NOT_READY`).
2. Tạo order `status='pending'`, `payment_provider='xendit'`; decrement stock UPFRONT bằng CAS `WHERE inventory >= qty` (đồng pattern F13).
3. `createPaymentRequest()` gọi `POST /v3/payment_requests` với header `for-user-id: {xenditAccountId}`; body `type:PAY`, `country:MY`, `currency:MYR`, `request_amount`, `channel_code`, `channel_properties.success_return_url/failure_return_url`, `reference_id`(=orderId), `metadata`. Lưu `xenditPaymentRequestId`.
4. Xử lý response `actions`: `REDIRECT_CUSTOMER` (ví/card → redirect URL) hoặc `PRESENT_TO_CUSTOMER` (DuitNow QR → hiển thị QR). Buyer trả; PAN/ví KHÔNG qua server ta.
5. Webhook `/api/webhooks/xendit`: verify `x-callback-token` → normalize event (`payment.capture`/`payment.authorization` = thành công) → `reconcileOrderPaid()` → order `new/paid` (atomic single-winner).
6. Confirm page poll `GET /v3/payment_requests/{id}` self-heal chống webhook trễ (mirror F13).

> **Decision (generalize reconcile):** `reconcileOrderPaid()` hiện persist metadata Stripe-specific. Tách phần **money-critical** (atomic UPDATE + emails — provider-agnostic) khỏi **persist metadata** (provider-specific). Xendit path lưu `xenditPaymentRequestId` + channel_code. KHÔNG sửa hành vi Stripe.

## 4. Functional Requirements

| FR | Mô tả | Story Ref |
|----|-------|-----------|
| **FR-1** | `POST /api/orders/xendit-checkout` validate site → tenant → `xenditAccountStatus='LIVE'`; nếu không → 422 `XENDIT_NOT_READY`. | US-F34-04 |
| **FR-2** | Tạo order `status='pending'`, `payment_provider='xendit'`; stock decrement CAS `WHERE inventory >= qty` (chống oversell). | US-F34-04 |
| **FR-3** | `createPaymentRequest()` → `POST /v3/payment_requests` header `for-user-id`; lưu `xenditPaymentRequestId`; xử lý `actions` (redirect/QR). | US-F34-04 |
| **FR-4** | Hỗ trợ channel: **TOUCHNGO, GRABPAY, SHOPEEPAY (EWALLET); DuitNow QR (QR_CODE); FPX; CARDS** (`channel_code` theo Channel Data Finder MY). | US-F34-04 |
| **FR-5** | Method enabled build từ config tenant/site (mirror `buildPaymentMethodTypes`); rỗng → 422 `NO_PAYMENT_METHODS`. | US-F34-05 |
| **FR-6** | `POST /api/webhooks/xendit` verify header `x-callback-token === XENDIT_WEBHOOK_TOKEN` (timing-safe); sai → 401, KHÔNG xử lý. | US-F34-06 |
| **FR-7** | Webhook normalize event `payment.capture`/`payment.authorization` → `PaymentWebhookEvent{ provider:'xendit', type:'payment_success' }` → `reconcileOrderPaid()`. | US-F34-06 |
| **FR-8** | Idempotency: webhook + poll + cron cùng gọi `reconcileOrderPaid()`; atomic single-winner đảm bảo 1 transition (đã có sẵn). | US-F34-06 |
| **FR-9** | Persist Xendit metadata sau paid: `xenditPaymentRequestId`, channel_code (TNG/GrabPay/...). Lỗi persist = non-critical, order vẫn paid. | US-F34-06 |
| **FR-10** | Confirm page poll `GET /api/orders/[id]/payment-status` self-heal: pending mà Xendit `SUCCEEDED` → reconcile (mirror F13). | US-F34-05 |
| **FR-11** | Routing: storefront chọn Xendit khi tenant `LIVE` + buyer chọn ví MY; thẻ quốc tế / merchant non-MY → Stripe (giữ nguyên). | US-F34-04 |
| **FR-12** | Webhook event `payment.failure` → order giữ pending/đánh dấu failed; return 200 (tránh retry vô hạn); cron Sprint 3 dọn. | US-F34-06 |

## 5. Non-Functional Requirements

| NFR | Yêu cầu | Mức |
|-----|---------|-----|
| **NFR-1** | Webhook verify timing-safe (`timingSafeEqual`) trên `x-callback-token`; chống replay bằng idempotency reconcile. | P0 |
| **NFR-2** | PCI/PDPA: PAN/ví đi thẳng buyer → Xendit hosted, **0 byte nhạy cảm qua server ta**. | P0 |
| **NFR-3** | Webhook → order paid p95 < 30s. | P1 |
| **NFR-4** | Checkout API p95 < 4s (tạo order + payment_request 1 round-trip). | P1 |
| **NFR-5** | Stock decrement atomic CAS — 0 oversell. | P0 |
| **NFR-6** | `reference_id` = orderId (unique cho CARDS theo spec); idempotent tạo payment_request. | P0 |

## 6. Acceptance Criteria (GIVEN/WHEN/THEN)

1. **AC-1** GIVEN merchant `LIVE` WHEN buyer checkout Xendit THEN order `pending` tạo, stock giảm, nhận redirect URL / QR từ `actions`.
2. **AC-2** GIVEN merchant chưa `LIVE` WHEN checkout Xendit THEN 422 `XENDIT_NOT_READY`, KHÔNG tạo order, KHÔNG giảm stock.
3. **AC-3** GIVEN buyer chọn TNG và trả thành công WHEN Xendit gửi `payment.capture` THEN order → `new/paid`.
4. **AC-4** GIVEN webhook `x-callback-token` sai WHEN gọi THEN 401, order KHÔNG đổi.
5. **AC-5** GIVEN webhook đến 2 lần (retry) WHEN xử lý THEN order chỉ transition 1 lần (`already_processed`), KHÔNG email 2 lần.
6. **AC-6** GIVEN stock=1, 2 buyer checkout đồng thời WHEN cả 2 tạo order THEN chỉ 1 thành công, buyer kia 409 OUT_OF_STOCK (CAS).
7. **AC-7** GIVEN buyer trả qua DuitNow QR (`PRESENT_TO_CUSTOMER`) WHEN paid THEN `payment_provider='xendit'`, channel_code persist đúng.
8. **AC-8** GIVEN webhook trễ/mất WHEN buyer ở confirm page poll `GET /v3/payment_requests/{id}` THEN self-heal reconcile < 30s.
9. **AC-9** GIVEN tenant tắt hết payment method WHEN checkout THEN 422 `NO_PAYMENT_METHODS`.
10. **AC-10** GIVEN event `payment.failure` WHEN webhook THEN return 200, order failed/pending (cron Sprint 3 dọn + restock).
11. **AC-11** GIVEN tạo payment_request lỗi WHEN checkout THEN rollback: order không tạo / pending huỷ + stock restock; buyer thấy lỗi rõ.
12. **AC-12** GIVEN merchant MY có cả Stripe + Xendit WHEN buyer chọn FPX THEN route đúng provider, KHÔNG double-charge.
13. **AC-13** GIVEN persist metadata Xendit lỗi WHEN sau paid THEN order VẪN `paid` (non-critical), chỉ thiếu channel hiển thị.

## 7. Architecture & Code

### 7.1 Schema (migrations — `scripts/db-setup.js`)

```js
{ name: 'orders.payment_provider',
  sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider varchar DEFAULT 'stripe';` },
{ name: 'orders.xendit_payment_request_id',
  sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS xendit_payment_request_id varchar;` },
{ name: 'orders.xendit_payment_request_id_idx',
  sql: `CREATE UNIQUE INDEX IF NOT EXISTS orders_xendit_payment_request_id_idx ON orders (xendit_payment_request_id);` },
{ name: 'orders.xendit_channel_code',
  sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS xendit_channel_code varchar;` },
```

### 7.2 Order fields (`src/collections/Orders.ts`) — mirror `stripeSessionId`

```ts
{
    name: 'paymentProvider',
    type: 'select',
    defaultValue: 'stripe',
    options: [
        { label: 'Stripe', value: 'stripe' },
        { label: 'Xendit', value: 'xendit' },
    ],
    admin: { readOnly: true, description: 'Cổng thanh toán dùng cho đơn này' },
},
{
    name: 'xenditPaymentRequestId',
    type: 'text',
    unique: true,
    index: true,
    admin: { readOnly: true, description: 'Xendit Payment Request ID (/v3/payment_requests)' },
},
{
    name: 'xenditChannelCode',
    type: 'text',
    admin: { readOnly: true, description: 'Channel thực: TOUCHNGO / GRABPAY / SHOPEEPAY / DUITNOW QR / FPX / CARDS' },
},
```

### 7.3 Extend provider union (`src/lib/payment/types.ts`)

`PaymentWebhookEvent.provider` **đã có** `'stripe' | 'ipay88' | 'revenue_monster' | 'toyyibpay'` → thêm `'xendit'`. Thay đổi type duy nhất chạm file chung; KHÔNG sửa logic Stripe.

### 7.4 Payment Request + webhook (`src/lib/payment/xendit.ts` — extend Sprint 1)

```ts
const XENDIT_BASE = 'https://api.xendit.co'

/** POST /v3/payment_requests trên sub-account (for-user-id). Trả id + actions (redirect/QR). */
export async function createPaymentRequest(params: {
    accountId: string; orderId: string; amountMYR: number; channelCode: string;
    successUrl: string; failureUrl: string; customerEmail: string;
}): Promise<{ id: string; actions: any[]; status: string }> {
    const res = await fetch(`${XENDIT_BASE}/v3/payment_requests`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'for-user-id': params.accountId, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            reference_id: params.orderId,           // unique (bắt buộc cho CARDS)
            type: 'PAY', country: 'MY', currency: 'MYR',
            request_amount: params.amountMYR, capture_method: 'AUTOMATIC',
            channel_code: params.channelCode,       // TOUCHNGO | GRABPAY | SHOPEEPAY | <FPX> | <DUITNOW QR> | CARDS
            channel_properties: { success_return_url: params.successUrl, failure_return_url: params.failureUrl },
            metadata: { orderId: params.orderId },
        }),
    })
    if (!res.ok) throw new Error(`XENDIT_PAYMENT_REQUEST_FAILED: ${res.status}`)
    const d = await res.json()
    return { id: d.id, actions: d.actions ?? [], status: d.status }
}

/** GET /v3/payment_requests/{id} — confirm poll self-heal. */
export async function getPaymentRequest(id: string, accountId: string): Promise<{ status: string } | null> {
    const res = await fetch(`${XENDIT_BASE}/v3/payment_requests/${id}`,
        { headers: { Authorization: authHeader(), 'for-user-id': accountId } })
    return res.ok ? await res.json() : null
}

/** Normalize Xendit payment webhook → PaymentWebhookEvent. Events thật: payment.capture/authorization/failure. */
export function normalizeXenditEvent(body: any): PaymentWebhookEvent | null {
    const map: Record<string, PaymentEventType> = {
        'payment.capture': 'payment_success',
        'payment.authorization': 'payment_success', // capture_method AUTOMATIC → authorized=captured
        'payment.failure': 'payment_failed',
    }
    const type = map[body?.event]
    if (!type) return null
    return { provider: 'xendit', type, data: body.data ?? body, rawEvent: body }
}
// verifyXenditWebhook() đã định nghĩa ở Sprint 1 (x-callback-token timing-safe).
```

### 7.5 Files

**Create:**
- `src/app/api/orders/xendit-checkout/route.ts` — mirror `stripe-checkout/route.ts` (validate chain + payment_request + stock CAS).
- `src/app/api/orders/xendit-checkout/build-order-items.ts` — reuse/mirror.
- `src/app/api/webhooks/xendit/route.ts` — extend Sprint 1: thêm xử lý `payment.*` → reconcile.

**Modify:**
- `src/lib/payment/xendit.ts` — `createPaymentRequest`, `getPaymentRequest`, `normalizeXenditEvent`.
- `src/lib/payment/types.ts` — thêm `'xendit'` vào provider union.
- `src/lib/payment/reconcile-order-paid.ts` — generalize: tách metadata persist provider-specific (giữ Stripe path nguyên).
- `src/collections/Orders.ts` — 3 fields trên.
- `scripts/db-setup.js` — 4 migrations.
- Storefront checkout component — provider routing + channel picker (FR-4, FR-11).
- `src/app/api/orders/[id]/payment-status/route.ts` — Xendit self-heal poll.

## 8. Implementation Steps

1. Schema + Orders fields (atomic commit). → verify: `check-migrations.js` pass.
2. Extend `types.ts` provider union + generalize `reconcileOrderPaid` (Stripe regression pass). → verify: Stripe tests xanh.
3. `xendit.ts`: createPaymentRequest + getPaymentRequest + normalize. → verify: unit test normalize (`payment.capture`→success), verify token.
4. `xendit-checkout/route.ts` validate chain + stock CAS. → verify: integration test validate + oversell.
5. `webhooks/xendit/route.ts` payment.* → reconcile. → verify: `payment.capture` → new/paid; replay idempotent.
6. Confirm poll self-heal + storefront routing + channel picker. → verify: webhook-miss self-heal < 30s.

## 9. Todo

- [ ] Schema + Orders fields (payment_provider, xendit_payment_request_id, xendit_channel_code)
- [ ] types.ts provider union + reconcile generalize (Stripe regression)
- [ ] xendit.ts createPaymentRequest/getPaymentRequest/normalize
- [ ] xendit-checkout route + stock CAS
- [ ] webhooks/xendit payment.* → reconcile
- [ ] confirm poll self-heal + storefront routing + channel picker
- [ ] Tests (TC-F34.2xx)

## 10. Success Criteria

- Buyer trả qua TNG/GrabPay/ShopeePay/DuitNow/FPX/card → order `new/paid` < 30s.
- Webhook spoof chặn (AC-4); replay idempotent (AC-5).
- 0 oversell (AC-6); 0 double-charge (AC-12).
- Stripe tests vẫn 100% pass.

## 11. Risks

| Risk | Mức | Mitigation |
|------|-----|------------|
| Generalize `reconcileOrderPaid` phá Stripe | Cao | Tách provider path; full Stripe suite trước merge |
| Channel_code FPX/DuitNow MY sai | Trung bình | Tra Channel Data Finder MY (`[NEED]`); spike đầu sprint |
| `x-callback-token` tĩnh lộ → spoof | Trung bình | Token chỉ ở Vercel env; idempotency reconcile; xoay token |
| Stock CAS + payment_request fail giữa chừng | Cao | Rollback restock khi tạo PR fail (AC-11) |
| `payment.authorization` vs `payment.capture` nhầm khi capture_method=MANUAL | Trung bình | Dùng `capture_method: AUTOMATIC` → capture = paid |

## 12. Security

- Webhook token timing-safe (NFR-1, FR-6).
- 0 PAN/ví qua server (NFR-2).
- Idempotency chống replay (FR-8).
- Reconcile auth: caller verify ownership trước khi gọi (note sẵn trong `reconcile-order-paid.ts`).

## 13. [NEED]

- `[NEED]` **Channel_code chính xác cho FPX + DuitNow QR ở MY** — tra Xendit "Channel Data Finder" (create-payment-request.md tham chiếu external). TNG=`TOUCHNGO`, GrabPay=`GRABPAY`, ShopeePay=`SHOPEEPAY`, card=`CARDS` đã rõ.
- `[NEED]` `payment.authorization` có cần capture riêng không (xác nhận với `capture_method: AUTOMATIC` thì = paid).
- `[NEED]` Settlement timeline thực tế hiển thị UX (one-pager: VA T+0 · ví T+2 · thẻ T+7).
