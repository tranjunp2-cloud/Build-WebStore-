# F13 — Stripe Payment Flow Hardening

> Branch: `F13-stripe-payment` · Created 2026-05-27 · Status: PLANNED (no code yet)
> Scope: fix payment-flow correctness bugs + close UX gaps in Stripe checkout (F13, Wave 6/7).

## Goal

Make the Stripe checkout flow **correct and recoverable**: payment success reliably reflected in DB + UI, no oversell on concurrent buys, accurate payment method recorded, buyers can recover from interrupted/failed payments, and a backstop reconciles orders when webhooks are late.

## Locked decisions (from refinement 2026-05-27)

1. **Oversell** (stock gone after payment captured) → **manual handle**. Flag order for seller review + notify + wire existing refund API to an admin button. No auto-refund this round.
2. **No buyer order-list page** — preserve no-auth checkout model. "Pay Now" lives only on the order-detail page reached via email magic link.
3. **Phased delivery** — Sprint 1 = blocker/logic fixes; Sprint 2 = UX + cron.
4. **`paymentStatus` bug is in-scope** (prerequisite for the whole Confirm flow).

## Sprint 1 — Blocker / logic fixes (this sprint)

| Phase | Title | Depends on |
|-------|-------|-----------|
| [01](phase-01-fix-payment-status-and-reconcile.md) | Fix `paymentStatus=paid` on Stripe success + extract shared `reconcileOrderPaid()` | — |
| [02](phase-02-atomic-stock-and-oversell.md) | Atomic stock decrement + oversell-review flag + seller notify | 01 |
| [03](phase-03-payment-method-detection.md) | Accurate card/fpx detection (expand PaymentIntent on connected account) | 01 |
| [04](phase-04-cart-clear-and-cancel-toast.md) | Move `clearCart` to Confirm-success + cancel toast on checkout | — |

## Sprint 2 — UX + reconciliation (next sprint)

| Phase | Title | Depends on |
|-------|-------|-----------|
| [05](phase-05-confirm-polling-ui.md) | Confirm page: status endpoint + polling + skeleton + failed state | 01 |
| [06](phase-06-pay-now-retry.md) | "Pay Now" on order detail + retry-payment endpoint | 01, 05 |
| [07](phase-07-cron-reconcile-and-cleanup.md) | Cron reconcile late webhooks + cleanup stale pending + oversell refund button | 01, 02 |

## Key shared artifact

`src/lib/payment/reconcile-order.ts` — single source of truth for "mark order paid": atomic status+paymentStatus transition, accurate method, stock decrement (+oversell flag), emails, notifications. Called by: webhook (01), confirm status endpoint (05), cron (07).

## Cross-cutting constraints

- **Schema**: new fields → entry in `scripts/db-setup.js` MIGRATIONS + pass `node scripts/check-migrations.js origin/staging`. (Adding a `select` option to existing varchar column needs no column migration; a new boolean field does.)
- **Raw SQL bypasses Payload hooks** — current `status` transition already does. Verify no product/order hook side-effect is lost (e.g. low-stock alerts) before converting more writes to SQL.
- **Vercel Cron (Phase 07)** touches `vercel.json` `crons[]` — read `.claude/rules/vercel-deploy.md` first; do NOT alter `git.deploymentEnabled`.
- Each code file ≤200 lines; TC-IDs from `docs/qa/F13-payment-gateway.md` for tests.

## Open design note (needs 1 confirm before Phase 02 code)

Decision 1 says "change status to `Oversell_Review`". Recommendation: implement as a **dedicated boolean field `oversellReview`** rather than a `status` enum value, so the fulfillment state machine (new→confirmed→shipped) stays intact for an order that *is* paid. Surfaced in admin + notification the same way. Confirm before building Phase 02.
