# Phase 05 — Email Templates v2

**Status:** pending | **Effort:** 1.5h | **Owner:** fullstack-developer | **Blocks:** Phase 02

## Overview
Extend `order-confirmation.ts` to render COD receipt vs BT magic-link email. Add bank details + payment reference + 24h deadline + CTA button linking to `redirectUrl`. EN + MS locales.

## Related code files
- Modify: `src/lib/email/templates/order-confirmation.ts`
- Modify: `src/i18n/locales/en.json` (under `email.order`)
- Modify: `src/i18n/locales/ms.json` (under `email.order`)
- Reference: `src/lib/email/send.ts` (existing send wrapper)
- Reference: `.claude/rules/email-smtp.md` (fire-and-forget pattern)

## Template branch design
Add new `paymentMethod` + `magicLinkUrl` + `paymentReference` + `paymentExpiresAt` + `bankDetails` fields to `OrderEmailData`. Branch in renderer:

### COD branch
- Subject: `{t.subject} — {orderNumber}` (unchanged).
- Body: existing layout + new "View Receipt" CTA → magicLinkUrl.
- No payment instructions block.

### BT branch
- Subject: `Action required: Complete payment for {orderNumber}` (EN) / `Tindakan diperlukan: Lengkapkan pembayaran untuk {orderNumber}` (MS).
- Body insert block ABOVE items table:
  - Bank name, account name, account number (from bankDetails).
  - **Payment reference** (highlighted): `paymentReference` — instruct to include in transfer notes.
  - **Deadline**: "Pay within 24 hours (by {formatDateTime(paymentExpiresAt)})".
  - **CTA button**: "Upload Payment Receipt" → magicLinkUrl.

## i18n keys to add (under `email.order`)
```json
{
  "btSubject": "Action required: Complete payment",
  "btIntro": "Thank you for your order. Please complete payment via bank transfer:",
  "btBankName": "Bank Name",
  "btAccountName": "Account Name",
  "btAccountNumber": "Account Number",
  "btReference": "Payment Reference",
  "btReferenceHint": "Please include this reference in your transfer notes",
  "btDeadline": "Pay before",
  "btDeadlineWarning": "If not paid within 24 hours, your order will be cancelled automatically",
  "btCta": "Upload Payment Receipt",
  "codCta": "View Order Receipt"
}
```

## Implementation steps
1. Extend `OrderEmailData` interface with optional BT fields.
2. Add `paymentMethod: 'cod' | 'bank_transfer'` discriminator.
3. Build `renderBankDetailsBlock()` helper (inline HTML, conditional).
4. Build `renderCtaButton(url, label)` helper.
5. Pick subject by paymentMethod.
6. Update EN + MS locale JSON with new keys.
7. Call from Phase 02 route after `payload.create`:
```ts
payload.sendEmail({
  to: customer.email,
  subject,
  html,
}).catch(err => payload.logger.error({ err }, '[F10] order-confirmation send failed'))
```

## Edge cases
- Bank details missing → email sent with placeholder + flag for seller (don't block customer).
- Locale defaults to `en` if site.locale unset.
- `paymentExpiresAt` formatted in Asia/Kuala_Lumpur tz.

## Todo list
- [ ] Extend OrderEmailData interface
- [ ] Add COD vs BT branching in renderer
- [ ] Add CTA button helper
- [ ] Add bank details block
- [ ] Update en.json + ms.json
- [ ] Wire fire-and-forget send from checkout route

## Success criteria
- COD email contains "View Receipt" CTA → opens magic link.
- BT email contains bank name/account/reference/deadline + "Upload Payment Receipt" CTA.
- Both render in MS locale when site.locale='ms'.
- Email send failure does NOT fail order creation (caught + logged).

## Risk
- Email rendering bug invisible until manual SMTP send — Phase 08 snapshot tests cover both branches.
- PII (customer name + address) logged via failed send error — log only error object, not payload.
