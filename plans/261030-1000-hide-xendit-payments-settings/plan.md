---
title: "Temporarily hide Xendit (settings page + storefront checkout)"
issue: https://github.com/primeproduction/ech-prime-web-v2/issues/2132
branch: feat/F34-hide-xendit-temporarily (base: staging)
status: implemented
priority: P2
---

# GH-2132 — Temporarily hide Xendit — dashboard settings AND storefront checkout

Verified against `staging @ bd388f7d8`. Decisions from user: (1) hide at checkout too, even for already-connected tenants; (2) **temporary** → must be one-switch reversible, no deletions.

## Findings (verified in code)

| # | Surface | Location | Today |
|---|---|---|---|
| 1 | Settings section (header + Connected bar / Connect block) | `src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx:764-788` | always rendered |
| 2 | Settings connected flag | `payments/page.tsx:15-34` → prop `xenditConnected` → state `:111` | from `tenant.xenditSecretKey` |
| 3 | Checkout SSR data | `src/app/sites/[slug]/checkout/page.tsx:140` `xenditConnected`, `:146-147` `hasPaymentMethods` includes Xendit | connected = key set |
| 4 | Checkout option "Pay with Xendit" | `CheckoutClient.tsx:901` (`xenditConnected &&`); default auto-select `:109`; submit branch `:557` | shown if connected |
| 5 | Checkout create-order API | `src/app/api/orders/xendit-checkout/route.ts:79` only checks key exists | callable by stale tab / direct POST |
| 6 | Client-fallback API `/api/storefront/site-by-slug` | `route.ts:113-117` | does **not** return `xenditConnected` and excludes Xendit from `hasPaymentMethods` → already consistent with "hidden"; no change |
| 7 | In-flight Xendit orders | `retry-payment` (`:148`), `payment-status`, webhook `/api/webhooks/xendit`, `reconcile-orders` job, `cancel-order`, `refund-order`, confirm page, `pw_xendit_pending` back-redirect | must keep working |
| 8 | Legacy tenant toggles `xendit_tng/...` | `generation-facts.ts:93-99`, `shop-setup.ts:64` | old flags, not set by current settings UI → out of scope |

## Design

One shared switch: `src/lib/payment/xendit-visibility.ts` → `export const XENDIT_ENABLED = false` (comment: temporary hide, flip to `true` to restore; no env var — avoids Vercel Dashboard + `.env.*.example` churn; no schema).

Gated (new activity / UI):
- A. Settings: wrap section `:764-788` with `{XENDIT_ENABLED && (...)}`.
- B. Checkout SSR (`page.tsx`): `xenditConnected: XENDIT_ENABLED && !!key`; drop Xendit term from `hasPaymentMethods` when disabled. `CheckoutClient` needs **no change** (option, default pick, submit branch all derive from `xenditConnected`).
- C. Server guard: `xendit-checkout/route.ts` returns 422 `PAYMENT_METHOD_DISABLED` ("Xendit is not available for this store") as the first statement of `POST` (before body parse/DB reads) when `!XENDIT_ENABLED` — blocks stale open checkout tabs and direct POSTs. Same code/shape as `orders/checkout/route.ts:93-99`.

NOT gated (must stay, otherwise paid/pending orders break): retry-payment, payment-status, webhook, reconcile job, cancel, refund, confirm page, DB/schema, i18n keys, `actions.ts`, Connect components (kept as dead-but-reachable code).

## Phases
1. [phase-01-implementation.md](phase-01-implementation.md) — flag + 3 gates + tests + docs

## Risks / things to tell the user
- **Tenants whose only online/enabled method is Xendit** → `hasPaymentMethods` becomes false → checkout shows "no payment methods" and blocks ordering (CheckoutClient `:802`). Before merging to `main`, count such tenants (`xenditSecretKey IS NOT NULL` and COD/QR/Stripe all off) via psql and warn them.
- Buyers mid-payment on Xendit hosted page: webhook/confirm/retry unaffected → they can finish. Only *new* Xendit orders are blocked.
- Connected tenants cannot disconnect/rotate keys in UI while hidden.
- Existing xendit-checkout API tests must mock the flag `true` for TC-F34 groups 04/05; new tests cover `false`.

## Open questions
None blocking. (Optional: show tenants a notice that Xendit is temporarily paused — not planned, YAGNI.)
