# Scout Report — US-F10-02 Customer Checkout

**Issue:** #109 | **Branch:** feat/F10-109-customer-checkout | **Date:** 2026-05-18

---

## Relevant Files

### Checkout UI & API
- `src/app/sites/[slug]/checkout/page.tsx` (722 lines) — Checkout page, COD + qr_banking UI, proof upload for bank transfer
- `src/app/api/orders/checkout/route.ts` (214 lines) — POST /api/orders/checkout, order creation
- `src/app/api/orders/route.ts` (85 lines) — GET /api/orders, list only (not checkout-related)
- `src/lib/storefront/checkout.ts` (41 lines) — validateCheckoutForm, calculateOrderTotals, generateOrderNumber

### Data Layer
- `src/collections/Orders.ts` (269 lines) — Order schema (paymentMethod, paymentReference, paymentProofImage, Stripe fields)
- `src/store/cartStore.ts` (105 lines) — Cart state, clearCart() on checkout complete
- `src/lib/payment/types.ts` (77 lines) — Stripe-focused types, PaymentProvider interface
- `src/lib/validations/orders.ts` (55 lines) — orderCreateSchema (supports cod + qr_banking only)
- `src/components/storefront/CartDrawer.tsx` (173 lines) — Cart UI, links to /sites/{slug}/checkout

### Email Templates
- `src/lib/email/templates/order-confirmation.ts` — Generic template (items, totals, address) — no magic link, no payment instructions
- `src/lib/email/templates/order-status.ts` — Status emails (processing/shipped/delivered/cancelled)

### Tests
- `src/__tests__/api/orders-checkout.test.ts` — Checkout API tests (OOS, SST, shipping, cross-tenant)

### Docs
- `docs/prd/F10-orders-management.md` — Full spec incl. Bank Transfer v2.2 (FR-14 to FR-17+)
- `docs/qa/F10-orders-management.md` — TC-F10-02-01~14 (checkout), TC-F10-06-01~40 (bank transfer 3-step)

---

## Current State vs AC

### AC-1: COD Happy Path
| Requirement | Status |
|---|---|
| Order created, paymentStatus='unpaid' | ❌ Missing — collection has no `paymentStatus` field; API sets `status:'pending'` only |
| Redirect to /sites/[slug]/orders/[id]?token=JWT | ❌ Missing — redirects to inline success screen |
| COD confirmation email | ❌ TODO comment in route.ts (line 193), not implemented |

### AC-2: Error Handling
| Requirement | Status |
|---|---|
| Error toast displayed | ✅ Implemented (line 276 checkout/page.tsx) |
| Cart preserved on failure | ✅ clearCart() only called on success |

### AC-3: Bank Transfer (v2.2 — 3-step async)
| Requirement | Status |
|---|---|
| paymentStatus='awaiting_payment' | ❌ Missing — field doesn't exist in schema |
| paymentReference auto-generated (BT-XXXXXX) | ❌ Missing — no generation logic |
| paymentExpiresAt = createdAt + 24h | ❌ Missing — field doesn't exist |
| Stock reserved NOT decremented | ❌ Bug — stock decremented immediately for all methods (route.ts line 172) |
| Confirmation email with magic link JWT | ❌ Missing — email not sent; no JWT generation |
| Redirect to /sites/[slug]/orders/[id]?token=JWT | ❌ Missing — route doesn't exist |
| No upload at checkout (D-04 PD-018) | ⚠️ Current UI has proof upload at checkout — violates v2.2 spec |

---

## Missing Routes/Pages
- `/sites/[slug]/orders/[id]` — Post-order summary / upload page **does not exist**
- No `orders` directory under `src/app/sites/[slug]/`

## Missing Schema Fields (Orders collection)
- `paymentStatus` — enum: unpaid | awaiting_payment | pending_verification | paid | failed
- `paymentExpiresAt` — DateTime (Bank Transfer TTL)
- Stock reservation vs. decrement logic

## Missing Backend Logic
- paymentReference generator (BT-XXXXXX, excluding 0/O/I/1)
- JWT magic link signer for post-order page
- Stock reservation path (no decrement for bank_transfer)
- Background job: auto-cancel when paymentExpiresAt exceeded

## Missing Email Logic
- order-confirmation.ts: payment-method-aware rendering (COD receipt vs Bank Transfer instructions + magic link + reference code)

## Missing Test Coverage (per QA doc)
- TC-F10-02-05: double-submit guard
- TC-F10-06-xx: Bank Transfer flow, reference code, JWT, stock reservation, TTL auto-cancel, re-upload

---

## Unresolved Questions
- Is Bank Transfer v2.2 (no upload at checkout) the target for this sprint, or keep current qr_banking proof-at-checkout?
- Which background job runner handles paymentExpiresAt auto-cancel (cron? Payload hooks? Queue)?
- Should `paymentStatus` be a new field alongside existing `status` or replace it?
- JWT signing key — stored as env var or tenant-level config?
