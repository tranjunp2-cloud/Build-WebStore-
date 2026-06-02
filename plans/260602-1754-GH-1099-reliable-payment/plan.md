---
title: "US-F13-06 Reliable payment confirmation"
description: "Shared reconcileOrderPaid() + oversell flag + active-reconcile endpoint + cron self-heal"
status: pending
priority: P1
effort: 13h
branch: feat/1099-F13-06-reliable-payment-confirmation
tags: [stripe, payment, webhook, cron, reconciliation, F13]
created: 2026-06-02
---

# US-F13-06 — Reliable payment confirmation (GH #1099)

Make Stripe payment confirmation reliable: extract a single idempotent `reconcileOrderPaid()` used by
webhook + active endpoint + cron, detect oversell, and self-heal pending orders when the webhook is
missed. AC-1 (atomic webhook) and AC-4 (payment method) already pass — preserved via refactor, not rebuilt.

## Phases

| # | Phase | Status | AC | Effort | Depends |
|---|-------|--------|----|--------|---------|
| 01 | [Schema: oversell_review column](phase-01-schema-oversell-review.md) | pending | AC-2/3 (TC-157) | 1h | — |
| 02 | [Extract reconcileOrderPaid() + refactor webhook](phase-02-reconcile-order-paid.md) | pending | AC-1 (TC-143) | 4h | 01 |
| 03 | [Oversell detect + flag + SYSTEM_ALERT + admin refund surface](phase-03-oversell-detect-refund.md) | pending | AC-2/3 (TC-145/146) | 3h | 02 |
| 04 | [AC-5 payment-status active-reconcile endpoint + confirm page](phase-04-payment-status-endpoint.md) | pending | AC-5 (TC-150/152) | 2h | 02 |
| 05 | [AC-6 cron reconcile-orders + stale handling](phase-05-cron-reconcile.md) | pending | AC-6 (TC-155/156) | 2h | 02 |
| 06 | [i18n (en+ms) + tests](phase-06-i18n-tests.md) | pending | all | 1h | 03,04,05 |

## Dependency graph

```
01 (schema) ──► 02 (reconcile lib) ──┬─► 03 (oversell + refund UI)
                                     ├─► 04 (active endpoint + confirm)
                                     └─► 05 (cron)
                                            └─► 06 (i18n + tests) ◄── 03,04
```
Phases 03/04/05 parallelizable after 02 (disjoint globs). 06 last (touches tests across all).

## Data flow (the "order is now paid" path)

```
[webhook checkout.session.completed]  [POST /payment-status (ct_)]  [cron /reconcile-orders (CRON_SECRET)]
                  │                              │                            │
                  └──────────────► reconcileOrderPaid(payload, ctx) ◄─────────┘
                                   atomic UPDATE WHERE status='pending' (single winner)
                                   ├─ no rows → return {alreadyProcessed} (idempotent, NO side effects)
                                   └─ won → record IDs+method, decrementStock(→oversell), emails, ORDER_NEW
```

## Cross-cutting decisions (see Unresolved Qs)

- **D1 stale status:** enum has NO `'expired'` value. Reuse `'cancelled'` + `cancelReason` (mirror payment-expiry job). Avoids enum migration. TC-156 doc says 'expired' — flag for QA.
- **D2 confirm page:** keep SSE for live UI flip (TC-150 already GREEN); payment-status endpoint called once on mount + short retry to self-heal. NO double-flip mechanism — SSE owns UI, endpoint owns reconcile. Aligns TC-152.
- **D3 refund gate:** oversell orders are `status='new'` — current refund API + UI block this. Add narrow exception: `oversellReview===true` orders are refundable regardless of status (both API gate + UI gate). Does NOT open refund to all `new` orders.

## File ownership (no overlap across parallel phases)

- 01: `scripts/db-setup.js`, `src/collections/Orders.ts`
- 02: `src/lib/payment/reconcile-order-paid.ts` (new), `src/app/api/webhooks/stripe/handlers/checkout-completed.ts`, `src/lib/payment/stripe.ts` (session-retrieve helper)
- 03: `reconcile-order-paid.ts` stock fn (owned by 02 — sequential after 02), `OrderDetailPanel.tsx`, `refund/route.ts`
- 04: `src/app/api/orders/[id]/payment-status/route.ts` (new), `confirm/ConfirmClient.tsx`
- 05: `src/app/api/cron/reconcile-orders/route.ts` (new), `src/lib/jobs/reconcile-orders.ts` (new), `vercel.json`
- 06: `src/i18n/locales/{en,ms}.json`, `src/__tests__/**`

NOTE: phase 03 edits `reconcile-order-paid.ts` (stock/oversell) — sequential after 02, not parallel with it.

## Key reused helpers (DRY)

`verifyConnectedAccountOwnership`, `getTenantOwnerEmails`, `getTemplateConfig`, `notifyTenantOwners(SYSTEM_ALERT)`,
`verifyConfirmToken` (ct_ cookie), email templates, `getStripeClient`, payment-expiry cron/job pattern.

## Constraints

- File < 200 lines (reconcile lib may split: stock+oversell into helper)
- ADD COLUMN IF NOT EXISTS only; db-setup.js + `check-migrations.js` gate (CRITICAL)
- YAGNI/KISS/DRY; no auto-refund; no fake data
- Relates to #1099
