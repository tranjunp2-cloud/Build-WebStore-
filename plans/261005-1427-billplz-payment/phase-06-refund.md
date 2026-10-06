---
phase: 6
title: "Refund via Payment Order API v5 (stretch)"
status: pending
priority: P2
effort: "12h"
dependencies: [4]
story: US-F43-06
branch: feat/F43-06-billplz-refund
stretch: true
---

# Phase 6: Refund via Payment Order API v5 *(stretch)*

## Overview

Billplz has no refund endpoint on Bills. Refunds go through the v5 Payment Order (disbursement) API — separate collection type, pre-funded balance, buyer bank account required, and V5 checksum auth (HMAC-SHA512). **Until this phase ships, P5 already guards `/refund` with `BILLPLZ_MANUAL_REFUND` 422 + points to dashboard manual refund — this phase upgrades that guard to a real disbursement flow.**

## Requirements

- Functional: seller initiates refund on a paid Billplz order → ECH creates Payment Order to buyer's bank account → status tracked → order `refunded`.
- Non-functional: V5 checksum signing; requires seller's Payment Order collection to be pre-funded — insufficient funds must surface a clear error, not a silent failure.

## Architecture

### Preconditions (seller-side, outside ECH)

- Payment Order collection created + funded on Billplz dashboard (requires its own X Signature/config — likely separate keys or same account? **OPEN**: verify whether PO collection shares API key — assume yes, separate collection id)
- Seller must collect buyer bank details → refund form fields: bank code (`GET /v4/payment_gateways` or bank index), account number, account holder name, ID number (Billplz PO requires recipient verification fields)

### `src/lib/payment/billplz.ts` additions

```ts
// V5 checksum: HMAC-SHA512(params-string, xSignatureKey) + epoch — per research.md auth table
function signV5(params, xSignatureKey): { checksum, epoch }
export async function createPaymentOrder(apiKey, xSignatureKey, p: CreatePaymentOrderParams)  // POST /v5/payment_orders (verify exact path — docs reference payout collections + payment orders)
export async function getPaymentOrder(apiKey, xSignatureKey, id)
```

### Order refund flow

- `orders/[id]/refund` route: branch `paymentProvider==='billplz'` → collect/require buyer bank fields → `createPaymentOrder` → store `billplzPaymentOrderId` (new order field + migration) → status `refund_pending` (new paymentStatus option? evaluate — reuse `refunded` only on confirmed credit)
- PO status check: reconcile cron pass (P5 pattern) or PO callback (Billplz PO has its own callback — verify at implementation time)

## Related Code Files

- Modify: `src/lib/payment/billplz.ts`, `src/app/api/orders/[id]/refund/route.ts`, `src/collections/Orders.ts` (`billplzPaymentOrderId`, maybe `paymentStatus` option), `scripts/db-setup.js`
- UI: refund modal additions for bank detail collection

## Implementation Steps

1. Verify v5 endpoint contract against docs (payment_orders vs payouts naming)
2. `signV5` + client calls + unit tests (checksum vectors)
3. Refund route branch + buyer-bank form + field persistence
4. Status tracking via cron/callback → `refunded` on credit confirmation
5. Seller-facing copy: pre-fund requirement, T+N settlement expectations

## Success Criteria

- [ ] Refund creates Payment Order with correct checksum auth
- [ ] Insufficient PO balance → explicit seller-facing error
- [ ] Confirmed credit → order `refunded` exactly once
- [ ] Buyer bank fields validated (bank code from `payment_gateways` index)

## Risk Assessment

- **Scope risk highest of all phases** — PO is a disbursement product with its own onboarding/pre-fund requirements; may be rejected outright at review as out-of-scope for v1. If so, keep manual refund + delete this phase.
- Buyer bank details = sensitive PII — collection UX + storage policy need product/security review before building.
- V5 checksum differs from X Signature (SHA512 + epoch) — separate code path, do not conflate.
