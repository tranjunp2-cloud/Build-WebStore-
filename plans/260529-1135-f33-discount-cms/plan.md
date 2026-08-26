---
title: "F33 — Discount Setting CMS"
description: "Port PW1 discount module into PW2: Discounts collection + usage history, admin CRUD, checkout application, CSV export."
status: pending
priority: P1
effort: 23h
branch: feat/F33-discount-cms
tags: [F33, discount, payload, schema, checkout, migration]
created: 2026-05-29
---

# F33 — Discount Setting CMS

Port the CRITICAL-MISSING PW1 Discount module into PW2 (Next.js 15 + Payload 3 + Postgres/Neon).
Core = admin-side management ("Discount **setting** CMS"). Storefront checkout application is IN SCOPE
across **ALL payment methods** (COD, QR/bank-transfer, AND Stripe) via a single gateway-agnostic
order-total function — see Phase 03. Subscription-tier promo codes (TC-F15.14/15, super-admin) are a
SEPARATE concern and OUT OF SCOPE here (see "Scope boundary").

## Scope boundary

| Concern | In scope (F33) | Why |
|---------|----------------|-----|
| Merchant discount CRUD (tenant-scoped) | YES | The core of §2.7 |
| Usage limit + tracking + per-order history | YES | §2.7 explicit |
| CSV export | YES | §2.7 explicit |
| Storefront checkout apply — ALL gateways (COD, QR, Stripe) | YES | Discount applied once in a shared `computeOrderTotal()` → `finalAmount`; every payment path consumes that one number |
| Subscription-plan promo codes (TC-F15.14–17) | NO | Platform-level, super-admin, different table/owner |

**Gateway-agnostic pricing (locked decision 3):** Discount is NOT gateway-specific. There is ONE
centralized total computation — `subtotal → applyDiscount(on subtotal) → + shipping + tax → finalAmount`.
The payment method only RECEIVES `finalAmount`: COD/QR show/collect it; Stripe charges exactly it. No
Stripe Coupon object and no per-line-item coupon mapping. (Concrete Stripe code change documented in
Phase 03 — its session line items are rebuilt to sum to `finalAmount`.)

## Data flow (one-liner)

Admin creates Discount (tenant-scoped, unique code) → buyer enters code at checkout → checkout route
validates (active + in-date + under-limit + tenant match), else silently rejects the code (order proceeds
at full price) → `computeOrderTotal()` applies discount to **subtotal** then adds shipping + tax →
`finalAmount` consumed by the active payment method → on successful order placement, atomic usage-count
increment + DiscountUsageHistory row (idempotent), regardless of gateway.

## Phases

| # | Phase | Status | Effort | Blocks on |
|---|-------|--------|--------|-----------|
| 01 | [Schema & collections](phase-01-schema-and-collections.md) | pending | 6h | — |
| 02 | [Admin CMS config + validation](phase-02-admin-cms-config.md) | pending | 4h | 01 |
| 03 | [Centralized order-total + usage tracking (all gateways)](phase-03-usage-tracking-and-checkout.md) | pending | 6h | 01, 02 |
| 04 | [CSV export](phase-04-csv-export.md) | pending | 2h | 01 |
| 05 | [Tests](phase-05-tests.md) | pending | 4h | 01–04 |
| 06 | [Docs](phase-06-docs.md) | pending | 1h | 01–05 |

## Dependency graph

```
01 (schema) ──┬─→ 02 (admin) ──→ 03 (checkout/usage) ──┐
              ├─→ 04 (export) ───────────────────────────┼─→ 05 (tests) ─→ 06 (docs)
              └──────────────────────────────────────────┘
```

01 is the atomic blocker (collection + payload.config + db-setup + check-migrations together — see
`.claude/rules/database-schema.md`). 02 and 04 may run in parallel after 01 (disjoint files). 03 must
follow 02 (depends on validated field shape). 05 after all code. 06 last.

## Key decisions

- New collections: `discounts` + `discount_usage_history` (NOT an array sub-table on Orders — usage
  history is queried independently for revenue audit, so it's a first-class collection with FK to order).
- Tenant + site scoping mirrors `Orders.ts` / `Customers.ts` exactly (no new access pattern).
- `code` unique **per tenant** (not global) — enforced via partial unique index + beforeChange check.
- Money stored in **sen** (integer), consistent with `Sites.shippingConfig` rates. Percentage 0–100.
- `usageCount` is `readOnly` in admin, mutated only by the atomic redemption + afterChange hook.
- Discount applied to **subtotal only** (Σ unit price × qty); shipping + tax added AFTER discount.
- Gateway-agnostic: one `computeOrderTotal()` returns `finalAmount`; COD/QR/Stripe all consume it.
- At-limit / expired / inactive / wrong-tenant code → silently REJECT the code, order proceeds at full price
  (never hard-fail checkout).

## Resolved product decisions (all 5 confirmed 2026-05-29)

| # | Decision | Resolution |
|---|----------|-----------|
| 1 | Discount base | **Subtotal only** (Σ unit price × qty). Shipping + tax added AFTER discount. |
| 2 | At-limit / invalid-code behavior | **Reject the code, order proceeds at full price.** Same for expired/inactive: silently drop the code, checkout continues. No hard-fail. |
| 3 | Stripe support | **INCLUDED — gateway-agnostic.** Single `computeOrderTotal()` produces `finalAmount`; Stripe charges exactly it (no Stripe Coupon, no per-line-item coupon mapping). No separate Stripe effort. |
| 4 | CSV export | **Self-contained new route.** No shared csv helper extraction; customers export untouched. Small dup OK (KISS/YAGNI). |
| 5 | (was a sub-item of 3) | Folded into decision 3 — all payment methods covered by shared pricing. |

**Remaining open item:** None. GitHub issue created: **#1114** (https://github.com/primeproduction/ech-prime-web-v2/issues/1114) — use `Relates to #1114` in the Phase 06 PR.

## Risks (high-level — per-phase detail in phase files)

| Risk | L×I | Mitigation |
|------|-----|------------|
| Migration naming mismatch → CI gate fail | M×H | Phase 01 gives exact SQL; run `check-migrations.js` before PR |
| `check-migrations.js` does not track new collections | H×M | Add `Discounts.ts`/`DiscountUsageHistory.ts` to TRACKED_COLLECTIONS in same PR |
| Concurrent redemption races past usageLimit | M×M | DB-level conditional UPDATE (Phase 03) |
| Two checkout routes compute totals inline (drift) | M×M | Phase 03 unifies discount step into `computeOrderTotal()`; both routes call it |
| Stripe charge built from line items, not a single total | M×H | Phase 03 rebuilds Stripe line items so their sum == `finalAmount` (concrete change documented) |
```
