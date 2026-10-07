---
phase: 4
title: "Webhook — X Signature verify + reconcile"
status: pending
priority: P1
effort: "8h"
dependencies: [1, 3]
story: US-F43-04
branch: feat/F43-04-billplz-webhook
---

# Phase 4: Webhook — payment completion

## Overview

`POST /api/webhooks/billplz` receives Billplz's form-urlencoded callback, resolves the tenant, verifies X Signature, and flips the order via `reconcileOrderPaid`. Idempotent and always-ACK.

## Requirements

- Functional: parse `request.formData()` (NOT JSON); resolve order via `?o=` query → `reference_2` → `billplzBillId` fallback chain; per-tenant X Signature verify; **post-verify binding: `order.billplzBillId === params.id` + `paymentProvider==='billplz'`**; `paid === 'true'` → reconcile; `state='deleted'`/`paid==='false'` → mark failed; always return 200 post-dispatch.
- Non-functional: timing-safe compare; signature mismatch logged loudly (feeds connect-time typo detection); no order writes before signature passes.

## Architecture

```
POST /api/webhooks/billplz?o={orderId}
1. formData → params Record<string,string>
2. Resolve order:  o param → findByID(orders)            (fast path, unsigned hint)
                   else params.reference_2 (numeric) → findByID
                   else params.id → find orders where billplzBillId = id
   → none found → 200 ACK + warn log (unknown bill — could be a Billplz dashboard test ping; do not 401 or it retries ×5)
3. Resolve tenant from order.tenant → findByID(tenants, overrideAccess)
   → no billplzXSignatureKey → 401 + error log
4. verifyBillplzSignature(params, tenant.billplzXSignatureKey)
   → false → 401 + '[Billplz Webhook] signature mismatch' error log
            (+ console.error marker for alerting; count → future metric)
   → 401 is correct: Billplz retries ×5/24h — recovery happens automatically if seller
     fixes a typo'd key in settings between retries.
5. REPLAY BINDING — ?o= and reference_2 are UNSIGNED (not in the signature whitelist)
   and signed params are visible to every paying buyer via the redirect_url.
   Require: order.paymentProvider === 'billplz' AND order.billplzBillId === params.id
   → mismatch → 401 + error marker 'BILL_ID_MISMATCH' (prevents replaying a valid
     signed payload against a different order).
   → exception: if resolved via ?o=/reference_2 and order.billplzBillId is NULL
     (orphan-window recovery from P3 persist), accept binding after signature
     passes and BACKFILL billplzBillId on reconcile win.
6. Dispatch (key on `paid` alone — it is the authoritative field; do NOT conjunct
   `state==='paid'`, a missing/new state value would silently drop the payment):
   params.paid === 'true' →
     amount check: params.amount vs order.total*100 (mismatch > 1 sen → error log + skip, manual review)
     → result = reconcileOrderPaid(payload, { orderId, source: 'webhook',
            billplzTransactionId: params.transaction_id })
     → if result === 'already_processed' AND order.status === 'cancelled' (or other
        terminal state) → emit '[Billplz] PAID_AFTER_CANCEL order=<id> bill=<params.id>'
        console.error + ops alert hook — money captured on a cancelled order must
        NEVER be silent. Do NOT reuse the xendit already_processed email block.
        POLICY (validation S1): order STAYS cancelled — never auto-revive; seller
        refunds buyer manually (v1: team@billplz.com / dashboard; P6: PO API).
   paid === 'false' or state === 'deleted' → mark payment_failed only if order still
     awaiting_payment (mirrors handlePaymentEvent failure path)
   → 200 ACK always after dispatch (Billplz retries ×5/24h on non-200)
```

### `reconcile-order-paid.ts` extension

- `ReconcileContext` += `billplzTransactionId?: string` — a **single** field, not a `billplzData` bag: `billId` is already persisted at checkout (P3 persists inside the try-block; webhook also backfills it via step 5 exception), and there is no channel value worth persisting in v1.
- On win: persist `paymentProvider:'billplz'`, `billplzBillId` (backfill if absent), `bankTransactionId = billplzTransactionId` (existing generic text column `Orders.ts:326-329` — reuse it).
- **Forbidden:** do not write Billplz channel/status values into `xenditChannelCode` — its label formatter and the `already_processed` email heuristic (`needsEmail = !xenditChannelCode`, reconcile-order-paid.ts:64) assume Xendit semantics and would misfire.

### Redirect URL handler

`redirect_url` → `/order/{id}/confirm` — existing confirm page already polls `payment-status`; the Billplz GET redirect lands there with query params (`billplz[id]`, `billplz[paid]`, `billplz[x_signature]` nested-style). **Do NOT trust it for state change** — UX only. Confirm page (P5) treats provider=billplz → poll webhook-updated status.

## Related Code Files

- Create: `src/app/api/webhooks/billplz/route.ts`, `src/app/api/webhooks/billplz/handlers/payment.ts` (if splitting mirrors xendit), `tests/webhook-billplz.spec.ts` (E2E — required), unit test for order-resolution chain
- Modify: `src/lib/payment/reconcile-order-paid.ts`, `src/lib/payment/types.ts` (ReconcileContext)

## Implementation Steps

1. Extend `ReconcileContext` (`billplzTransactionId` only) + persist `billplzBillId`/`paymentProvider`/`bankTransactionId` on win
2. Route: formData parse → resolve chain → signature verify → **bill-id binding** → dispatch on `paid` alone → ACK
3. `PAID_AFTER_CANCEL` detection (already_processed + terminal status) → error marker + alert
4. Failure path for `state='deleted'`/`paid='false'`
5. Unit tests: resolution fallbacks, bad signature 401, **cross-order replay → 401 `BILL_ID_MISMATCH`**, orphan backfill on `?o=` resolution, unknown order 200-ACK, `paid='true'` with missing `state` still reconciles, `paid='false'` non-transition
6. E2E: POST synthetic signed callback → order flips; replay same callback → no double effect (CAS)

## Success Criteria

- [ ] Valid signed callback flips order exactly once (CAS); replay = no-op
- [ ] Signed params replayed against a DIFFERENT order → 401, no writes (binding check)
- [ ] `paid='true'` with absent/unknown `state` still reconciles (dispatch keys on `paid` only)
- [ ] `paid='true'` on a cancelled order → `PAID_AFTER_CANCEL` error log emitted (test asserts marker)
- [ ] Bad signature → 401, no writes; missing tenant key → 401 + loud log
- [ ] Form-urlencoded body parsed correctly (a JSON POST → 400)
- [ ] Unknown order → 200 ACK, warn only (Billplz dashboard test pings must not 5xx)
- [ ] Amount mismatch → logged + skipped (no silent under/over-payment)

## Risk Assessment

- **Signature whitelist drift** if Billplz adds fields → whitelist is fixed keys only (per official plugin), new fields simply ignored — safe.
- Tenant key typo (untestable at connect) → repeated 401s with clear log marker; Phase 2 modal warns seller.
- Redirect/callback ordering races → CAS makes order irrelevant.
- `formData()` on Node runtime — confirm route runs on Node (Payload requires it); add `export const runtime = 'nodejs'` defensively + `maxDuration`.
