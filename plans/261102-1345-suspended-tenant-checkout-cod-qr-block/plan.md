---
title: Block COD/QR checkout for suspended tenants
status: implemented + reviewed + verified locally (PR to staging)
created: 2026-11-02
issue: "#2179 (item 5)"
branch: fix/F09-suspended-tenant-storefront-block (from staging 69b690a4f)
---

# Block COD/QR checkout for suspended tenants

## Problem
`POST /api/orders/checkout` (COD + `bank_transfer`/QR) never checks `tenants.status`. Every other payment path already blocks suspended tenants with 403 `STORE_UNAVAILABLE`:
- Stripe: `src/app/api/orders/stripe-checkout/validate-store.ts:114-115`, `stripe-checkout/route.ts:141-142` (TC-F13.88)
- Xendit: `src/app/api/orders/xendit-checkout/route.ts:82`
- Retry payment: `src/app/api/orders/[id]/retry-payment/route.ts:140`

Impact: banned stores (SSO `ban-user` / PW1 delta set tenant `suspended`, site stays published) still accept COD/QR orders. #2179: 38 banned stores still open on prod.

## Change (only one)
`src/app/api/orders/checkout/route.ts`, right after `tenantForSlug` is fetched (~L84) and before payment-method checks, product/stock validation, order create, stock decrement, emails:

```ts
if ((tenantForSlug as any)?.status === 'suspended') {
  return NextResponse.json(
    { success: false, error: { code: 'STORE_UNAVAILABLE', message: 'Store is not available' } },
    { status: 403 })
}
```
Response shape/message identical to Stripe/Xendit. Inline check (no shared helper exists; one check → YAGNI).

## Files
| File | Change |
|---|---|
| `src/app/api/orders/checkout/route.ts` | +8 lines guard |
| `src/__tests__/api/orders-checkout.test.ts` | +3 tests (TC-F09.274 COD, TC-F09.275 bank_transfer, TC-F09.276 guard runs before payment-method check) |
| `docs/qa/F09-storefront-commerce.md` | +3 TC rows (GH-2179) |

## Tests
- TC-F09.274: suspended + COD → 403 `STORE_UNAVAILABLE`; order `create` and stock-decrement never called.
- TC-F09.275: suspended + bank_transfer → 403 `STORE_UNAVAILABLE`; `create` never called.
- Existing active-tenant COD/QR tests unchanged and green.

## Verification (done 2026-11-02)
- `npm run typecheck` — pass
- `npx vitest run src/__tests__/api/orders-checkout.test.ts src/__tests__/api/stripe-checkout.test.ts src/__tests__/api/xendit-checkout.test.ts` — 84/84 pass (checkout alone 49/49)
- `ESLINT_USE_FLAT_CONFIG=false npx eslint` on the 2 code files — clean (`npm run lint` = `next lint`, not run)
- Local live test (dev server :3100, fresh `e2e-*` tenant via `/api/e2e/ensure-test-user`, not prod data): tenant `active` + COD → 200, order created, stock 100→99; tenant `suspended` + COD / bank_transfer → 403 `STORE_UNAVAILABLE`, no new order, stock unchanged. Pre-change server returned 422 `PAYMENT_METHOD_DISABLED` for the same suspended tenant.

## Review checklist (for reviewer)
1. Guard runs before ANY side effect (order create, stock decrement, email, customer upsert) — read the full route.
2. Response matches Stripe/Xendit exactly (code, message, status) so storefront handles it the same way; check storefront checkout UI shows a sensible message for 403 `STORE_UNAVAILABLE` on COD/QR.
3. Only `status === 'suspended'` blocked — same as other routes. Other tenant statuses (if any) intentionally untouched.
4. `tenantForSlug` null case: route behaviour unchanged (no new crash path).
5. Tests import the real route, AAA, top-level `vi.mock`, TC-ID in names; no faked pass.
6. No changes outside the 3 files; no migration / storefront rendering / middleware changes.

## Out of scope
- Storefront block for suspended tenants (#2179 item 6) — must wait until the PW1 exporter fix (plan `plans/261102-1019-pw1-stale-expired-store-status/`) is on prod, otherwise 57 wrongly-suspended stores that are correctly open would go dark.
- Unpublishing the 38 banned sites (#2179 item 4) — data op.

## Rollout note
The 96 wrongly-suspended stores are also blocked by this guard until the exporter fix + delta reaches them. Low impact: exporter already set their `payment_cod=false` (COD hidden) and Stripe/Xendit already block them; only a QR-enabled one would newly lose checkout. Prefer releasing together with or after the exporter fix (#2179 items 1-3).

## Commit (after review)
`fix(F09): block cod/qr checkout for suspended tenants` — PR to `staging`, body `Relates to #2179`.
