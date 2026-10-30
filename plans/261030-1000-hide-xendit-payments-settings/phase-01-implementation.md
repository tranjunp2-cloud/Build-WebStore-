# Phase 01 — Xendit temporary hide

**File ownership (single agent, sequential):**
- Create: `src/lib/payment/xendit-visibility.ts`
- Modify: `src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx`
- Modify: `src/app/sites/[slug]/checkout/page.tsx`
- Modify: `src/app/api/orders/xendit-checkout/route.ts`
- Tests: modify `src/__tests__/api/xendit-checkout.test.ts` (mock flag `true` at top via `vi.mock('@/lib/payment/xendit-visibility', ...)`); create `src/__tests__/unit/dashboard/payments-xendit-hidden.test.tsx`, `src/__tests__/unit/storefront/checkout-xendit-hidden.test.tsx` (or extend `checkout-access.test.tsx`), plus API case for 422.
- Docs: `docs/qa/F34-xendit-payment.md` (new TC rows: settings hidden connected/unconnected, checkout option hidden, checkout API 422, in-flight order retry/webhook still OK), `docs/CHANGELOG.md`.

## Steps
1. Create `xendit-visibility.ts` with `XENDIT_ENABLED = false` + restore comment.
2. Settings: import flag, wrap the "Xendit (F34)" `<section>`.
3. Checkout `page.tsx`: import flag; `xenditConnected: XENDIT_ENABLED && !!(tenantFull.xenditSecretKey)`; in `hasPaymentMethods` replace the Xendit clause with `(XENDIT_ENABLED && !!key)`.
4. `xendit-checkout/route.ts`: first statement of `POST`, `if (!XENDIT_ENABLED) return 422 { code: 'PAYMENT_METHOD_DISABLED', message: 'Xendit is not available for this store' }`.
5. Tests (import real code; `vi.mock` top-level; AAA; TC-IDs from QA doc):
   - settings: `xenditConnected` true/false → no Xendit heading/connect button/disconnect; Stripe + manual intact; mocked flag `true` → section back.
   - checkout: SSR `xenditConnected` forced false with key set → no "Pay with Xendit"; with COD disabled and only Xendit → `hasPaymentMethods` false path.
   - API: flag false → 422 `PAYMENT_METHOD_DISABLED`, no order created, no invoice call; existing groups still pass with flag mocked true.
   - regression: retry-payment / webhook tests untouched and green (no flag dependency).
6. Verify: `npx tsc --noEmit`; eslint on touched files; `npx vitest run src/__tests__/api/xendit-checkout.test.ts src/__tests__/unit/dashboard src/__tests__/unit/storefront`; plus `src/__tests__/api/orders-*xendit*` suites.
7. Manual on staging: tenant with key → `/settings/payments` no Xendit (EN/MY); storefront checkout no "Pay with Xendit", default method = COD/QR/Stripe; stale-tab POST → 422; an existing awaiting_payment Xendit order can still be retried/paid and webhook marks paid.

## Acceptance criteria
- Xendit absent in settings and checkout for connected + unconnected tenants.
- New Xendit orders impossible (UI and API); existing Xendit orders fully functional.
- Restore = change one constant (tests prove with flag `true`).
- `git diff` limited to files listed; no schema/env/i18n change; tsc/eslint/vitest green.

## Git
Branch `feat/F34-hide-xendit-temporarily` from `staging`; PR title `feat(f34): temporarily hide xendit in settings and checkout`; `Relates to #N`; no commit until user reviews the diff.
