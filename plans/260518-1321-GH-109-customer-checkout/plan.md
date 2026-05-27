---
title: "US-F10-02: Customer Checkout (COD + Bank Transfer v2.2)"
description: "COD synchronous + Bank Transfer 3-step async checkout with magic-link post-order page, seller verification, TTL auto-cancel"
status: pending
priority: P1
effort: 18h
branch: feat/F10-109-customer-checkout
tags: [F10, orders, checkout, payment, bank-transfer, COD]
created: 2026-05-18
---

# US-F10-02 — Customer Checkout

GH Issue: #109 | Branch: `feat/F10-109-customer-checkout` | Spec: `docs/prd/F10*.md`, `docs/qa/F10-orders-management.md`

## Goal
Replace current proof-at-checkout flow with v2.2 3-step async Bank Transfer (place → email magic link → upload → seller verify → auto-cancel TTL), keep COD synchronous, add JWT-signed post-order page.

## Phases

| # | File | Status | Effort | Blocks |
|---|------|--------|--------|--------|
| 01 | [phase-01-schema-migration.md](phase-01-schema-migration.md) | pending | 1.5h | — |
| 02 | [phase-02-checkout-api.md](phase-02-checkout-api.md) | pending | 3h | 01 |
| 03 | [phase-03-checkout-ui.md](phase-03-checkout-ui.md) | pending | 2.5h | 02 |
| 04 | [phase-04-post-order-page.md](phase-04-post-order-page.md) | pending | 3h | 02 |
| 05 | [phase-05-email-templates.md](phase-05-email-templates.md) | pending | 1.5h | 02 |
| 06 | [phase-06-seller-verification.md](phase-06-seller-verification.md) | pending | 2.5h | 01, 04 |
| 07 | [phase-07-auto-cancel-hook.md](phase-07-auto-cancel-hook.md) | pending | 1.5h | 01 |
| 08 | [phase-08-tests.md](phase-08-tests.md) | pending | 2.5h | 02-07 |

## Critical dependencies
- Phase 01 (schema) MUST land before 02 — `paymentExpiresAt` + new status enums are FK to all later flows.
- Phase 02 produces JWT token format consumed by 04 (post-order) and 05 (email link).
- Phase 06 + 07 both depend on new `status` enum from 01.
- Phase 03 (UI) blocked by 02 (new API response shape: `redirectUrl`, `token`).

## File ownership map (no overlap)
- 01: `src/collections/Orders.ts`, `scripts/db-setup.js`
- 02: `src/app/api/orders/checkout/route.ts`, `src/lib/validations/orders.ts`, `src/lib/payment/bank-transfer.ts` (new), `src/lib/payment/jwt-magic-link.ts` (new)
- 03: `src/app/sites/[slug]/checkout/page.tsx`, `src/lib/storefront/checkout.ts`
- 04: `src/app/sites/[slug]/orders/[id]/page.tsx` (new), `src/app/api/orders/[id]/upload-proof/route.ts` (new), `src/app/api/orders/[id]/verify-magic-link/route.ts` (new)
- 05: `src/lib/email/templates/order-confirmation.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/ms.json`
- 06: `src/app/(admin)/orders/[id]/PaymentVerificationBlock.tsx` (new), `src/components/admin/orders/RejectPaymentModal.tsx` (new), `src/app/api/orders/[id]/verify-payment/route.ts` (new)
- 07: `src/collections/Orders.ts` afterOperation hook, `src/lib/orders/auto-cancel-expired.ts` (new)
- 08: `src/__tests__/api/orders-checkout.test.ts`, `src/__tests__/api/orders-bank-transfer.test.ts` (new), `src/__tests__/lib/jwt-magic-link.test.ts` (new)

## Risk register (High)
| Risk | Mitigation |
|------|-----------|
| Stock race condition on BT approve | Re-check stock at approval time; fail with INSUFFICIENT_STOCK and keep awaiting_payment |
| JWT secret rotation invalidates active magic links | Use `PAYLOAD_SECRET` as signing key; document TTL = 24h aligned to paymentExpiresAt |
| Auto-cancel hook fires while seller mid-approve | Use status guard: only cancel if status='awaiting_payment' AND no proof uploaded |
| Migration order-of-ops breaks existing pending orders | Existing 'pending' status preserved as legacy COD value; new orders use 'unpaid'/'awaiting_payment' |
| Re-upload after rejection breaks seller queue | Reset status to pending_verification; clear prior rejectReason |

## Rollback plan
- Phase 01 schema: ALTER TABLE columns are additive (no DROP). Reverting code uses old enum values; new columns become unused.
- Phase 02-04: Revert via git; new orders fall back to old POST shape (COD only since BT routes removed).
- Phase 07 hook: Disable via env flag `DISABLE_BT_AUTO_CANCEL=1`.

## Success criteria
- All 14 TC-F10-02-* + 40 TC-F10-06-* pass (see phase-08).
- Mobile 375px no horizontal scroll (visual test).
- CI green: `scripts/check-migrations.js` + `npm test` + `npm run lint`.
- Manual smoke: COD order → email → status='unpaid'; BT order → magic link → upload → seller approve → stock decremented.

## Open questions
- Is `PAYLOAD_SECRET` already env-rotated in staging/prod? (If yes, magic links break on rotation — document.)
- Should auto-cancel restore reserved stock? (BT doesn't reserve in DB, so no-op — confirm with PM.)
