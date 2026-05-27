# Phase 02 — Checkout API (COD/BT split)

**Status:** pending | **Effort:** 3h | **Owner:** fullstack-developer | **Blocks:** Phase 01

## Overview
Split `POST /api/orders/checkout` logic by `paymentMethod`. COD path: status='unpaid', decrement stock immediately. BT path: status='awaiting_payment', NO stock decrement, generate `paymentReference` (BT-XXXXXX), set `paymentExpiresAt = now+24h`. Both paths return JWT-signed magic-link URL.

## Related code files
- Modify: `src/app/api/orders/checkout/route.ts`
- Modify: `src/lib/validations/orders.ts` (extend enum to include `bank_transfer`, drop proof-at-checkout)
- Create: `src/lib/payment/bank-transfer.ts` — `generateBankReference()` (BT- + 6 chars excluding `0OI1`)
- Create: `src/lib/payment/jwt-magic-link.ts` — `signOrderToken(orderId, expiresIn)` + `verifyOrderToken(token)`

## API contract changes

### Request (extended)
```ts
{ siteId, items, customer, paymentMethod: 'cod'|'bank_transfer' }
// REMOVED: paymentProofImage at checkout
```

### Response (new fields)
```ts
{
  success: true,
  data: {
    orderId, orderNumber, total, currency, status,
    paymentMethod,
    paymentReference?: string,        // BT only
    paymentExpiresAt?: string,        // ISO, BT only
    redirectUrl: string,              // /sites/{slug}/orders/{id}?token=...
    magicLinkToken: string,           // also embedded in redirectUrl
  }
}
```

## JWT design
- Library: `jsonwebtoken` (already in deps via Payload).
- Algorithm: HS256, secret = `process.env.PAYLOAD_SECRET`.
- Payload: `{ orderId, sub: 'order-access', iat, exp }`. Exp = 24h for BT, 7d for COD (post-order receipt page).
- Verify returns `{ valid: boolean, orderId?: number, reason?: 'expired'|'invalid' }`.

## Stock handling
- COD: decrement immediately (current behavior).
- BT: do NOT decrement on order create. Decrement happens on seller approve (Phase 06).
- Both: re-validate stock at create time (`stock >= quantity`).

## Reference generator (BT-XXXXXX)
```ts
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // excludes 0,O,I,1
function generateBankReference(): string {
  let s = 'BT-'
  for (let i = 0; i < 6; i++) s += ALPHABET[crypto.randomInt(0, ALPHABET.length)]
  return s
}
```
Uniqueness: query `payload.find({ collection: 'orders', where: { paymentReference: { equals: ref } } })`. Retry up to 5 times on collision.

## Implementation steps
1. Update `orderCreateSchema` in `src/lib/validations/orders.ts`: `paymentMethod: z.enum(['cod', 'bank_transfer'])`; remove `paymentProofImage`. Keep legacy `qr_banking` accepted with deprecation log (optional).
2. Create `src/lib/payment/jwt-magic-link.ts` with `signOrderToken` + `verifyOrderToken`. Use `jsonwebtoken`.
3. Create `src/lib/payment/bank-transfer.ts` with `generateBankReference` + `ensureUniqueReference(payload)`.
4. In `route.ts`: after order data prep, branch on `paymentMethod`:
   - `cod`: status='unpaid', existing stock decrement loop runs.
   - `bank_transfer`: status='awaiting_payment', paymentReference=generated, paymentExpiresAt=now+24h, NO stock decrement.
5. After `payload.create`, sign JWT and build `redirectUrl = /sites/{site.slug}/orders/{order.id}?token={jwt}`.
6. Trigger email (Phase 05 templates) via fire-and-forget `payload.sendEmail()`.
7. Return new response shape.

## Edge cases
- BT reference collision after 5 retries → 500 with `REFERENCE_GEN_FAILED` (operational alarm, not user-fixable).
- Site has no slug → fall back to `/sites/{site.id}/orders/...` (already handled by Next dynamic routing).
- `PAYLOAD_SECRET` missing → throw at signOrderToken (fail fast at startup, not per request).
- Mixed cart (some products OOS) → return OUT_OF_STOCK before create (unchanged).

## Todo list
- [ ] Create `src/lib/payment/jwt-magic-link.ts`
- [ ] Create `src/lib/payment/bank-transfer.ts`
- [ ] Update `orderCreateSchema`
- [ ] Refactor `route.ts` COD/BT branch
- [ ] Add email fire-and-forget call (stub if Phase 05 not done)
- [ ] Return `redirectUrl` + `magicLinkToken`
- [ ] Unit test JWT round-trip (Phase 08)

## Success criteria
- POST with `paymentMethod=cod` → order.status='unpaid', stock decremented, response has redirectUrl.
- POST with `paymentMethod=bank_transfer` → order.status='awaiting_payment', stock unchanged, paymentReference matches `^BT-[A-Z2-9]{6}$`, paymentExpiresAt = createdAt+24h ±1s.
- `verifyOrderToken(redirectUrl.token)` returns `{ valid: true, orderId }`.

## Risk
- Email-send failure must NOT block order creation — use fire-and-forget pattern per `email-smtp.md`.
- JWT secret rotation invalidates pending magic links; documented in plan.md open Qs.
