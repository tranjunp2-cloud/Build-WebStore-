# Phase 03 — Magic Link JWT + Email Templates

## Context Links

- PRD FR-15, FR-16, FR-21, BR-Payment-05, AC-9
- Rule: `.claude/rules/email-smtp.md` — `payload.sendEmail()` fire-and-forget pattern
- Existing JWT usage: `src/middleware.ts`, `src/lib/auth.ts`, `src/collections/Users.ts` (uses `jose`)
- Existing template: `src/lib/email/templates/order-confirmation.ts` (style reference)

## Overview

- **Priority:** P0
- **Status:** pending
- **Depends on:** P01 (need `magicLinkSecret` field)
- **Description:** Implement signed JWT helper for post-order magic link + 4 email templates (BT instructions, payment confirmed, payment rejected, order expired). All emails fire-and-forget.

## Key Insights

- `jose` is the project standard (Edge-runtime compatible). Use `SignJWT` / `jwtVerify`.
- Per-order `magicLinkSecret` is the HMAC key — rotation on Reject invalidates old links automatically (no global revocation list needed). KISS.
- JWT payload: `{ sub: orderId, scope: 'order_upload' }` + `exp = paymentExpiresAt`. No PII.
- `payload.sendEmail()` is the standard wrapper; templates return `{subject, html}` (see existing `order-confirmation.ts`).
- For i18n, follow existing `en` / `ms` pattern but Wave 6 ship can be EN-only for new templates (PRD does not mandate ms here). Add i18n string keys but default fallback to EN if missing.

## Requirements

### Functional

- `signOrderToken({ orderId, secret, expSec }) → string` (JWT HS256, `exp` claim).
- `verifyOrderToken({ token, secret }) → { orderId } | { error: 'expired' | 'invalid' }`.
- 4 templates each export `(data) → { subject, html }`:
  1. `bank-transfer-instructions.ts` — Place Order success + magic link + Reference Code + bank details + QR url + expiry.
  2. `payment-confirmed.ts` — Approve flow.
  3. `payment-rejected.ts` — Reject flow + reason + new magic link.
  4. `order-expired.ts` — TTL expiry.
- All templates render absolute URL using `process.env.NEXT_PUBLIC_SITE_URL` (existing convention; verify) and gracefully degrade if missing.

### Non-Functional

- Token expiry strictly enforced via `jose.jwtVerify` (`exp` claim).
- HS256 signature; reject `alg: none`.
- Templates pure functions (no IO, easy to unit test).
- HTML emails inline-styled (no external CSS); reuse layout pattern from existing template.

## Architecture

```
src/lib/auth/order-token.ts
  signOrderToken(orderId, secret, expSec) → JWT string
  verifyOrderToken(token, secret) → { ok:true, orderId } | { ok:false, error }

src/lib/email/templates/bank-transfer-instructions.ts
src/lib/email/templates/payment-confirmed.ts
src/lib/email/templates/payment-rejected.ts
src/lib/email/templates/order-expired.ts
  each: (OrderEmailData) → { subject, html }
```

## Related Code Files

- **Create:** `src/lib/auth/order-token.ts`
- **Create:** `src/lib/email/templates/bank-transfer-instructions.ts`
- **Create:** `src/lib/email/templates/payment-confirmed.ts`
- **Create:** `src/lib/email/templates/payment-rejected.ts`
- **Create:** `src/lib/email/templates/order-expired.ts`
- **Modify:** `src/lib/email/templates/index.ts` (export new templates)
- **Read for style:** `src/lib/email/templates/order-confirmation.ts`

## Implementation Steps

1. **`src/lib/auth/order-token.ts`**:
   ```ts
   import { SignJWT, jwtVerify } from 'jose'
   const enc = (s:string) => new TextEncoder().encode(s)

   export async function signOrderToken(opts: { orderId: number|string, secret: string, expSec: number }): Promise<string> {
       return await new SignJWT({ scope: 'order_upload' })
           .setProtectedHeader({ alg: 'HS256' })
           .setSubject(String(opts.orderId))
           .setIssuedAt()
           .setExpirationTime(opts.expSec)
           .sign(enc(opts.secret))
   }
   export async function verifyOrderToken(opts: { token: string, secret: string }): Promise<{ ok: true, orderId: string } | { ok: false, error: 'expired' | 'invalid' }> {
       try {
           const { payload } = await jwtVerify(opts.token, enc(opts.secret), { algorithms: ['HS256'] })
           if (payload.scope !== 'order_upload' || !payload.sub) return { ok: false, error: 'invalid' }
           return { ok: true, orderId: String(payload.sub) }
       } catch (e: any) {
           if (e?.code === 'ERR_JWT_EXPIRED') return { ok: false, error: 'expired' }
           return { ok: false, error: 'invalid' }
       }
   }
   ```
2. **`bank-transfer-instructions.ts`**:
   - Input: `{ orderNumber, customerName, total, currency, paymentReference, magicLinkUrl, expiresAtIso, bankName, bankAccountNo, bankAccountHolder, merchantQrUrl? }`.
   - HTML mirrors `order-confirmation.ts` layout. Hero: "Order Received — Please Complete Payment". Body sections: order summary card, bank details table, **reference code prominent box**, magic link CTA button, expiry countdown text, anti-fraud advisory (PRD §10.4).
3. **`payment-confirmed.ts`**:
   - Input: `{ orderNumber, customerName, total, currency, magicLinkUrl }`.
   - Body: "Payment Confirmed", order summary, "Track Order" CTA → magic link (still valid until expiry or you can drop here — set magicLink to plain order page, no token, since paid is terminal for upload).
4. **`payment-rejected.ts`**:
   - Input: `{ orderNumber, customerName, rejectionReason, rejectionDetail?, magicLinkUrl, expiresAtIso }`.
   - Body: "Payment Couldn't Be Confirmed", reason translation map (`image_blurry`→"Ảnh mờ — Receipt image unclear", etc), CTA to re-upload via new magic link.
5. **`order-expired.ts`**:
   - Input: `{ orderNumber, customerName, total, currency, productListUrl }`.
   - Body: "Your order has been cancelled (payment not received within 24h)", CTA "Browse Products" → productListUrl.
6. **`templates/index.ts`**: add `export * from './bank-transfer-instructions' …` for each.
7. Unit tests in `src/__tests__/unit/lib/order-token.test.ts`:
   - sign+verify round-trip succeeds
   - tampered token returns `invalid`
   - expired token returns `expired`
   - wrong secret returns `invalid`
   - wrong `scope` returns `invalid`

## Todo List

- [ ] Create `order-token.ts` with sign/verify
- [ ] Create 4 email templates
- [ ] Update `templates/index.ts` exports
- [ ] Unit tests for token (5 cases)
- [ ] Manual: render each template to HTML file → eyeball in browser
- [ ] Commit: `feat(orders): magic link JWT + bank-transfer email templates`

## Success Criteria

- Unit tests pass (5/5).
- `signOrderToken` returns ~200-char JWT with `exp` claim ≈ provided.
- Each template returns valid `{subject, html}` with no template literal undefined leaks.
- Email rendered in Gmail/Apple Mail looks structurally similar to existing `order-confirmation` template (header gradient, body padding, footer).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Forgery via `alg: none` | L | H | `jwtVerify` is called with explicit `algorithms: ['HS256']`. |
| Per-order secret leaked via Payload field read | L | H | P01 marks `magicLinkSecret` hidden; verify no API surface returns it (assertion test in P04 GET route). |
| Email HTML breaks in Outlook | M | L | Inline-style tables; mirror existing pattern. |
| `NEXT_PUBLIC_SITE_URL` missing → links broken | M | M | Helper `buildAbsoluteUrl(path)` that throws-and-logs if missing in prod; falls back to relative in dev. |

## Security Considerations

- Token includes `scope='order_upload'` — refuse if missing. Prevents cross-feature reuse if same secret pattern adopted elsewhere.
- No PII in JWT payload (only `sub=orderId`).
- Anti-fraud warning copy text per PRD §10.4 included.

## Next Steps

Unblocks P04 (upload page imports `verifyOrderToken` + bank-transfer email), P06 (Approve/Reject import payment-confirmed/payment-rejected).
