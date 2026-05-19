# Phase 02 — Checkout API Bank Transfer Branch

## Context Links

- PRD FR-14, AC-4, BR-Payment-03, BR-Payment-04, BR-Payment-08
- Existing: `src/app/api/orders/checkout/route.ts`, `src/lib/validations/orders.ts`
- Client: `src/app/sites/[slug]/checkout/CheckoutClient.tsx` (paymentMethod handling)

## Overview

- **Priority:** P0
- **Status:** pending
- **Depends on:** P01 (schema)
- **Description:** Branch checkout API for `bank_transfer`: NO proof at checkout, NO stock decrement, generate `paymentReference`, set `paymentExpiresAt`, create `magicLinkSecret`, fire email with magic link (handoff to P03). Existing `cod` path unchanged.

## Key Insights

- Existing route already centralizes stock check + order create. We split the post-create branch by `paymentMethod`.
- The legacy enum value `qr_banking` (still accepted by Zod) maps to the new `bank_transfer` lifecycle. Either: (a) accept both Zod values and normalize internally; (b) bump Zod to only accept `bank_transfer` and update Client. **Choose (b)** — client + server change together (small, atomic). Keep legacy `qr_banking` row reads working via P01 backfill.
- Stock decrement currently happens for BOTH `cod` and `qr_banking` (lines 188–207). v2.2: decrement **only** for `cod`; `bank_transfer` is reserved (no decrement, no separate counter — see Risk in plan.md).
- Reference generator must avoid 0/O/I/1 — small util.
- Magic link URL is generated here and returned in response so Client can redirect (resilience vs email delay).

## Requirements

### Functional

- Accept `paymentMethod ∈ {cod, bank_transfer}` (drop `qr_banking` from Zod; Client must send `bank_transfer`).
- For `bank_transfer`:
  - Reject if `site.paymentConfig.enableQrBanking === false` (reuse existing config; renamed flag is out of scope this PR — keep `enableQrBanking` as the gate, document for follow-up).
  - DO NOT require / accept `paymentProofImage` (Zod refine: forbid it on bank_transfer).
  - Set `paymentStatus = 'awaiting_payment'`.
  - Generate `paymentReference = 'BT-' + 6 alphanum (excl. 0/O/I/1)`.
  - Set `paymentExpiresAt = now + 24h`.
  - Generate `magicLinkSecret = crypto.randomBytes(32).toString('hex')`.
  - DO NOT decrement inventory.
  - After create: sign JWT via `src/lib/auth/order-token.ts` (P03) and fire-and-forget send email via P03 template.
  - Response includes `redirectUrl: '/sites/{slug}/orders/{id}?token=<JWT>'`.
- For `cod`: unchanged behavior. Response shape stable.

### Non-Functional

- Stock check still happens at create time (race on commit deferred to P06 Approve).
- Email send is fire-and-forget — never blocks order creation.
- Validation errors return existing error envelope.

## Architecture

```
POST /api/orders/checkout
  validate (Zod)
  resolve site + tenant + payment config
  validate stock (no decrement for BT)
  branch:
    if paymentMethod=='cod':
       create order (paymentStatus=unpaid)
       decrement inventory     ◄── unchanged
    if paymentMethod=='bank_transfer':
       paymentReference = generatePaymentReference(payload, tenantId)  // retry on collision
       magicLinkSecret  = randomHex(32)
       paymentExpiresAt = now + 24h
       create order (paymentStatus=awaiting_payment, no proof)
       token = signOrderToken(orderId, magicLinkSecret, exp=paymentExpiresAt)  // P03
       redirectUrl = `/sites/${siteSlug}/orders/${orderId}?token=${token}`
       payload.sendEmail(bankTransferInstructionsEmail(...)).catch(log)  // P03
  return { success, data: { orderId, orderNumber, total, currency, paymentMethod, redirectUrl? } }
```

## Related Code Files

- **Modify:** `src/app/api/orders/checkout/route.ts`
- **Modify:** `src/lib/validations/orders.ts`
- **Modify:** `src/app/sites/[slug]/checkout/CheckoutClient.tsx` (string change: `paymentMethod` literal `qr_banking` → `bank_transfer`; remove pre-checkout proof upload requirement; on success, redirect to `data.redirectUrl` when present else fall back to old confirm route)
- **Create:** `src/lib/payment/reference.ts` — `generatePaymentReference(payload, tenantId): Promise<string>`
- **Create (P03 dep):** import path `@/lib/auth/order-token` and `@/lib/email/templates/bank-transfer-instructions` (created in P03; this phase imports them but P03 lands first via dependency chain)

## Implementation Steps

1. **Create `src/lib/payment/reference.ts`**:
   ```ts
   const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // exclude 0/O/I/1
   export function generateCandidate(): string {
       let s = ''
       const bytes = crypto.randomBytes(6)
       for (let i = 0; i < 6; i++) s += ALPHABET[bytes[i] % ALPHABET.length]
       return `BT-${s}`
   }
   export async function generatePaymentReference(payload, tenantId): Promise<string> {
       for (let i = 0; i < 5; i++) {
           const ref = generateCandidate()
           const found = await payload.find({ collection: 'orders', where: { and: [{ tenant: { equals: tenantId } }, { paymentReference: { equals: ref } }] }, limit: 1, depth: 0, overrideAccess: true })
           if (found.docs.length === 0) return ref
       }
       throw new Error('Failed to generate unique paymentReference after 5 retries')
   }
   ```
2. **Update `src/lib/validations/orders.ts`**:
   - `paymentMethod: z.enum(['cod', 'bank_transfer'])`.
   - Refine: `data.paymentMethod !== 'bank_transfer' || !data.paymentProofImage` (forbid proof at checkout for BT).
   - Remove the QR-requires-proof refine.
3. **Update `src/app/api/orders/checkout/route.ts`**:
   - Replace `paymentMethod === 'qr_banking'` config gate with `paymentMethod === 'bank_transfer'` (still reads `pc.enableQrBanking` until config rename in future).
   - Compute `paymentReference`, `magicLinkSecret`, `paymentExpiresAt` only for `bank_transfer`.
   - `paymentStatus: paymentMethod === 'bank_transfer' ? 'awaiting_payment' : 'unpaid'`.
   - Move the inventory decrement loop inside `if (paymentMethod === 'cod')` block.
   - After `payload.create`, if `bank_transfer`:
     - `const token = await signOrderToken({ orderId: order.id, secret: magicLinkSecret, expSec: Math.floor(paymentExpiresAt.getTime()/1000) })`
     - `const siteSlug = (site as any).slug`
     - `const redirectUrl = `/sites/${siteSlug}/orders/${order.id}?token=${token}``
     - Fire-and-forget: `payload.sendEmail(bankTransferInstructionsEmail({ ... })).catch(err => console.error('[Email BT]', err))`
     - Return `redirectUrl` in response payload.
4. **Update `CheckoutClient.tsx`** (minimal):
   - Replace literal `'qr_banking'` with `'bank_transfer'` (state type + setter + checks).
   - When `paymentMethod === 'bank_transfer'`: hide pre-checkout upload box + skip media upload step in `handlePlaceOrder`.
   - On success: if `data.data.redirectUrl` present → `router.push(data.data.redirectUrl)`; else fallback to current `/order/${id}/confirm`.
   - Update `canPlaceOrder` to drop the `proofFile` requirement for `bank_transfer`.
5. Run `npm test` for `orders` + `checkout` test files; fix.

## Todo List

- [ ] Create `src/lib/payment/reference.ts` + unit test
- [ ] Update Zod schema for `bank_transfer`
- [ ] Branch checkout route: BT path (no decrement, gen ref, ttl, email)
- [ ] Update CheckoutClient string + flow + redirect
- [ ] Unit: reference generator excludes 0/O/I/1, format matches `/^BT-[A-Z2-9]{6}$/`
- [ ] Integration: BT checkout returns redirectUrl, order has paymentStatus=awaiting_payment, no inventory diff
- [ ] Integration: COD path unchanged (regression)
- [ ] Commit: `feat(orders): bank-transfer checkout creates awaiting_payment order with magic link`

## Success Criteria

- POST checkout with `bank_transfer` returns `{success:true, data:{orderId, redirectUrl, paymentMethod:'bank_transfer'}}`.
- Order row has: `paymentStatus='awaiting_payment'`, `paymentReference` set, `paymentExpiresAt` ≈ now+24h, `magicLinkSecret` non-empty, `paymentProofImage` null.
- Inventory unchanged after BT checkout (`SELECT inventory FROM products WHERE id=X` matches pre-checkout).
- AC-4 manually validated.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Concurrent BT checkouts oversell stock (no real reservation) | M | M | Stock check at create-time blocks obvious oversell. Approve-time decrement clamps to ≥0 (existing `Math.max(0, …)`). Document as acceptable for Wave 6. |
| Client still sends `qr_banking` after deploy (stale JS) | M | L | Server Zod rejects → user re-submits after refresh. Client cache busts on next deploy. |
| Reference generator collision after 5 retries | L | L | Throw 500 with retryable error code — buyer retries. Probability negligible (~10⁻¹³ at 10K orders). |
| `paymentExpiresAt` clock skew with cron | L | L | Cron uses `NOW()` server-side; identical clock. |

## Security Considerations

- `magicLinkSecret` stored on order — never returned in API responses. Verify Payload `read` access doesn't expose `magicLinkSecret` field (collection field has `admin.hidden: true` but that's UI only). If exposed, P01 needs explicit field-level access — flag for re-check.
- Email error must not leak to response body.

## Next Steps

Unblocks P04 (upload page consumes redirectUrl + token).
