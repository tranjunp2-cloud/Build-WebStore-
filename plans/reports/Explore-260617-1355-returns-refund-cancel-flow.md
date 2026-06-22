# Returns / Refund / Cancel-Restock Flow Exploration

**Date:** 2026-06-17 13:55  
**Scope:** Features F10 (order lifecycle + cancel-restock) & F34 (Xendit payment refund)  
**Status:** READ-ONLY EXPLORATION

---

## Executive Summary

The codebase implements:
- ✅ **Cancel-restock flow (F10)**: FULLY IMPLEMENTED via POST `/api/orders/[id]/cancel` with atomic SQL CAS and inventory recomputation
- ✅ **Refund flow**: IMPLEMENTED for Stripe + manual methods (COD, bank transfer) via POST `/api/orders/[id]/refund`
- ✅ **Refund status enum**: Present in both `order.status` and `order.paymentStatus` fields
- ✅ **Inventory restock mechanism**: Variant-aware atomic SQL UPDATE on `products_variants.stock` + `products.inventory` aggregate recomputation
- ❌ **Returns feature (RMA)**: NOT IMPLEMENTED — No returns collection, no return-merchandise flow
- ❌ **Xendit integration**: NOT FOUND — No Xendit code in src/; only Stripe integration exists

---

## 1. Cancel-Restock Logic (F10)

### Location & Entry Point
**File:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/api/orders/[id]/cancel/route.ts` (lines 1-222)

**Route:** `POST /api/orders/[id]/cancel`

**Trigger:** Seller-only endpoint (requires `withAuth` + `order_management` feature guard)

### How It Works

1. **Status Validation** (lines 53-70)
   - Uses `ORDER_STATUS_TRANSITIONS` from Orders collection to validate allowed cancellation states
   - Defined in `/src/collections/Orders.ts:15-29`
   - Allowed source statuses: `pending`, `new`, `confirmed`, `ready_to_ship` → `cancelled`

2. **Atomic CAS (Compare-And-Swap)** (lines 72-82)
   ```typescript
   UPDATE orders
   SET status = 'cancelled', cancel_reason = ${reason}, updated_at = NOW()
   WHERE id = ${orderId} AND status = ${currentStatus}
   RETURNING id
   ```
   - Prevents concurrent double-restock via SQL atomic transaction
   - Only first requester's CAS succeeds; others see 0 rows and return idempotent success
   - Comment at line 75: "Two concurrent cancel requests both pass the validation above, but only the one whose CAS succeeds proceeds to restock"

3. **Discount Release** (line 111)
   - Calls `releaseDiscountRedemption(payload, Number(orderId))`
   - Runs only on CAS-winning path to prevent double-release
   - Idempotent + non-throwing if order had no discount

4. **Inventory Restock** (lines 113-134)
   - For each order item, calls `restockItem(payload, productId, item.variant, item.quantity)`
   - Variant-aware: calls atomic SQL on `products_variants.stock`
   - Non-variant products: increments `products.inventory` directly
   - Comment at line 122: "All payment methods decrement stock at checkout — always restock on cancel"

5. **Customer Email Notification** (lines 149-207)
   - Sends order-cancelled email to customer
   - Uses template from `/lib/email/templates/order-cancelled`
   - Respects email template settings per tenant/locale

6. **Response**
   ```typescript
   { success: true, data: updated, restock: restockResults }
   ```
   - Returns updated order + array of RestockResult[] showing per-item restock success/failure

### UI Integration

**File:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/(dashboard)/orders/_components/CancelOrderModal.tsx` (lines 1-219)

- Modal component with required reason textarea (max 500 chars)
- Shows warning at line 105-118: "WARNING: This will automatically restock all inventory"
- Disabled on terminal statuses (line 479): `if (order.status === 'cancelled' || order.status === 'refunded')`
- Called from OrderDetailPanel (line 808-820) on button click

---

## 2. Refund Flow

### Location & Entry Point
**File:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/api/orders/[id]/refund/route.ts` (lines 1-307)

**Route:** `POST /api/orders/[id]/refund`

**Trigger:** Seller-only endpoint (requires `withAuth` + `order_management` feature guard + feature flag check)

### Refundable Order States

Lines 69-70:
```typescript
const refundableStatuses = ['shipped', 'completed']
```

- Only `shipped` or `completed` orders can be refunded
- Already-refunded orders rejected at line 63-67

### Implementation by Payment Method

#### A. Manual Methods (COD / Bank Transfer) — Lines 155-183

```typescript
if (['bank_transfer', 'cod'].includes(order.paymentMethod)) {
    UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = NOW()
    WHERE id = ${order.id}
    AND status = ANY(ARRAY['shipped','completed']::enum_orders_status[])
    RETURNING id
```

- Simple status update; no Stripe call needed
- Discount release + restock run after CAS success (lines 179-181)
- Fire-and-forget email (line 181)

#### B. Stripe Orders — Lines 185-307

**Connected Account Resolution** (lines 186-193)
- Fetches `tenant.stripeAccountId` from order tenant
- Returns error if not configured

**Payment Intent Resolution** (lines 195-219)
- Uses cached `order.stripePaymentIntentId` if available
- Falls back to fetching via Stripe Session if not cached
- Backfills cache for future calls (line 210)

**Atomic CAS** (lines 238-258)
- Pre-sets order status to `refunded` BEFORE calling Stripe
- Prevents double-email if charge.refunded webhook fires during request
- Idempotent: if already refunded, CAS returns 0 rows → returns 400 ALREADY_REFUNDED

**Stripe Refund Call** (lines 260-265)
```typescript
const refund = await stripe.refunds.create(
    { payment_intent: stripePaymentIntentId },
    { stripeAccount: stripeAccountId, idempotencyKey: `refund-${id}` }
)
```

- Uses idempotency key to prevent duplicate refunds on network timeout
- Idempotency key format: `refund-${id}` (line 264)

**Error Handling** (lines 274-306)
- `charge_already_refunded` error → idempotent success (refund exists on Stripe; line 278)
- Genuine Stripe failure → rollback order status to pre-refund state (lines 292-300)
- Comment at lines 287-291: Known race where charge.refunded webhook arrives after our CAS; acceptable given narrow timing window

**Discount + Restock + Email** (lines 270-282)
- All three run only after Stripe succeeds (or already-refunded idempotent path)
- Ensures financial commitment before releasing inventory

### Response
```typescript
{ success: true, data: { refundId: refund.id | null }, restock: restockResults }
```

### UI Integration

**File:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx` (lines 808-944)

- Refund button visible only when order is `shipped` or `completed` (line 896)
- Disabled button + opacity when loading or terminal status (line 925-934)
- Icon: Custom `IconRefund()` component (line 195-198)
- Called via fetch at line 811: `POST /api/orders/${id}/refund`

---

## 3. Refund Status Fields

### Order Collection (`/src/collections/Orders.ts`)

**Field 1: `order.status`** (lines 189-208)
- Type: select enum
- Values include: `'refunded'` (line 202)
- Status transitions defined at lines 15-29
- Refunded is a TERMINAL state: no outbound transitions (line 24)

**Field 2: `order.paymentStatus`** (lines 210-225)
- Type: select
- Values include: `'refunded'` (line 222)
- Independent of `order.status`; tracks payment lifecycle separately

### Database Representation
- `orders.status` → Postgres enum field `enum_orders_status`
- `orders.payment_status` → VARCHAR field
- Both updated atomically in refund/cancel flows via SQL CAS

---

## 4. Inventory Restock Mechanism

### Location
**File:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/api/orders/lib/stock-utils.ts` (lines 1-214)

### Two Functions

#### A. `decrementVariantStock()` (lines 22-102)

**Purpose:** Called at order checkout to reserve stock

**Atomic CAS Pattern** (lines 51-59):
```typescript
UPDATE products_variants
SET stock = stock - ${quantity}
WHERE _parent_id = ${productId}
  AND name = ${trimmedVariant}
  AND stock IS NOT NULL
  AND stock >= ${quantity}
RETURNING id
```

- Fails if stock < quantity (prevents oversell)
- Rejects negative/NaN quantities (line 33-36)
- Recomputes `products.inventory` SUM after successful decrement (lines 85-92)

**Return Type:**
```typescript
{ ok: true; decremented: number } | { ok: false; reason: 'insufficient_stock' | 'product_not_found' | 'variant_not_found' | 'null_inventory' | 'write_failed' }
```

#### B. `restockItem()` (lines 115-213)

**Purpose:** Called on cancel/refund to restore stock

**Variant Path** (lines 145-195):
```typescript
UPDATE products_variants
SET stock = stock + ${quantity}
WHERE _parent_id = ${productId} AND name = ${trimmedVariant} AND stock IS NOT NULL
RETURNING id
```

- Rejects if variant not found or tracking disabled (NULL stock)
- Recomputes `products.inventory` SUM (lines 182-189)

**Non-Variant Path** (lines 197-207):
```typescript
UPDATE products SET inventory = inventory + ${quantity}
WHERE id = ${productId} AND inventory IS NOT NULL
RETURNING id
```

- Simple atomic increment on aggregate field
- Skips if tracking disabled (NULL inventory)

**Return Type:**
```typescript
{ productId, restocked: number, skipped?: boolean, reason?: 'product_not_found' | 'variant_not_found' | 'null_inventory' | 'write_failed' }
```

### Products Collection (`/src/collections/Products.ts`)

**Field: `inventory`** (lines 339-345)
```typescript
{
    name: 'inventory',
    type: 'number',
    min: 0,
    max: 1000000,
    defaultValue: 0,
    admin: { description: 'Stock quantity' }
}
```

- Single field for non-variant products
- Aggregate computed from variants for variant-enabled products (line 121-123)
- NULL value disables tracking (respected in stock-utils line 155, 200)

### Atomic Guarantees

**Concurrent Safety** (comment at lines 16-20):
- SQL CAS on `products_variants` table ensures exactly N decrements possible from stock=N
- No read-modify-write race; pure SQL UPDATE with WHERE clause guarantees atomicity

**Pre-#1082 Migration Note** (lines 109-113):
- Old orders created before variant stock decrement fix never had per-variant stock adjusted
- Calling restockItem on those orders phantom-increments variant stock
- Requires one-time reconciliation migration

---

## 5. Order Cancellation UI

### Location
**File:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx` (lines 778-950)

### Button Placement & Visibility

**Lines 850-950:** Action buttons section

**Cancel Button** (lines 850-894):
- Visible unless order is terminal (cancelled/refunded/completed)
- Disabled if loading or order not in cancellable state
- Opens CancelOrderModal on click

**Refund Button** (lines 923-944):
- Visible unless order is terminal
- Enabled only for `shipped` or `completed` status
- Shows loading spinner + "Confirming..." text while refunding

### Modal Behavior

**CancelOrderModal** (lines 105-118):
- Required reason textarea (max 500 chars)
- Yellow warning: "This will automatically restock all inventory"
- Disabled during request (isLoading state)
- Clears form on close

### Error Handling
- Toast notifications via `sonner` package
- Logs to console on fetch failure
- No explicit UI error modal shown (relies on toast)

---

## 6. Stripe Webhook Refund Integration

### File
`/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/api/webhooks/stripe/handlers/charge-refunded.ts` (lines 1-138)

### Trigger
`charge.refunded` Stripe webhook event — fired when refund is issued from Stripe Dashboard (outside ECH)

### Flow

1. **Connected Account Verification** (lines 21-25)
   - Guards against IDOR: connected merchant must own the payment intent
   - Calls `verifyConnectedAccountOwnership()`

2. **Order Lookup** (lines 34-44)
   - Finds order via `stripePaymentIntentId`

3. **Atomic Status Update** (lines 54-62)
   ```typescript
   UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = NOW()
   WHERE id = ${order.id} AND status != 'refunded'
   RETURNING id
   ```
   - Only first concurrent webhook delivery wins (at-least-once guarantee)
   - Prevents duplicate emails

4. **Discount Release** (lines 66-73)
   - Calls `releaseDiscountRedemption()` only on CAS-winning path
   - Comment: "a Stripe Dashboard refund is a terminal non-sale, same as the in-app refund route"

5. **Inventory Restock** (lines 75-98)
   - Best-effort restock via `restockItem()` for each item
   - Logs warn/error but doesn't throw on failure

6. **Email Notification** (lines 100-137)
   - Sends order-refunded email to customer
   - Uses email template config from tenant

### Integration Point
- Runs in parallel to `refund/route.ts` for Stripe-initiated refunds
- `refund/route.ts` pre-sets status to 'refunded' before Stripe call to prevent this webhook from firing duplicate emails (design at lines 235-237)

---

## 7. Returns Feature (RMA)

### Status: NOT IMPLEMENTED

**Files Searched:**
- `/src/collections/` — No Returns.ts or similar collection
- `/src/app/api/orders/*/route.ts` — No return endpoint
- Codebase grep for "rma\|return-merchandise\|returns collection" — No matches

**What Exists:**
- No returns collection in Payload CMS
- No return-merchandise UI in dashboard
- No return request workflow
- No RMA status enum in Orders collection

**Implications:**
- Returns feature (F10 subtask or new feature) is entirely new work
- Will require: Returns collection, return status states, return approval workflow, inventory hold logic, refund linking

---

## 8. Xendit Payment Refund

### Status: NOT IMPLEMENTED

**Search Results:**
- Codebase grep for "xendit\|Xendit" across src/ — NO MATCHES
- Only Stripe integration exists in `/src/app/api/webhooks/stripe/`

**What Exists:**
- Stripe refunds fully implemented (charge.refunded webhook, refunds.create API)
- Manual refunds for COD/Bank Transfer (status update only, no external API)

**Implications:**
- Feature F34 (Xendit payment refund) requires new implementation
- Would add similar pattern to Stripe: webhook handler + refund API call
- Xendit integration not yet started

---

## 9. Concurrent Cancel/Refund Safety

### Idempotency Mechanisms

**SQL Compare-And-Swap (CAS)** — All three flows use this:
1. `/api/orders/[id]/cancel` (line 76-82)
2. `/api/orders/[id]/refund` (lines 158-162, 240-245)
3. `/api/orders/[id]/cancel-payment` (lines 65-74)

**Pattern:**
```typescript
UPDATE orders SET status = 'cancelled|refunded', ... 
WHERE id = ${orderId} AND status = ${expectedStatus}
RETURNING id
```
- First concurrent request succeeds (RETURNING has rows)
- Later requests fail (RETURNING is empty) and return 400 ALREADY_REFUNDED or idempotent success
- Prevents double-restock, double-email, double-payment

**Stripe Idempotency Key** (line 264):
```typescript
idempotencyKey: `refund-${id}`
```
- Prevents duplicate Stripe refunds on network timeout
- Combined with CAS for 2-layer idempotency

---

## 10. Discount Release on Cancel/Refund

### Function
`releaseDiscountRedemption()` from `/lib/discounts/release-discount-redemption`

### Called In:
1. `/api/orders/[id]/cancel` (line 111)
2. `/api/orders/[id]/refund` (lines 179, 270, 280)
3. `/api/orders/[id]/cancel-payment` (line 88)

### Semantics:
- Releases the reserved "slot" for a discount code
- Runs only on CAS-winning path to prevent double-release
- Idempotent + non-throwing (order may have no discount)
- Comment at line 177-178: "refund frees the promo seat like cancel does"

---

## 11. Stock Decrement Timing

### Payment Method Breakdown

**All Methods Decrement at Checkout:**
- **Stripe:** `/api/orders/stripe-checkout/route.ts` — stock decremented when session created
- **Bank Transfer / COD:** `/api/orders/checkout/route.ts` — stock decremented at checkout (since 2026-06-03)
- **Historical note:** Bank Transfer orders created before 2026-06-03 had stock decremented at approval, not checkout

### Implication for Cancel/Refund
- Line 117-122 in `/api/orders/[id]/cancel/route.ts`: "All payment methods decrement stock at checkout — always restock on cancel"
- Always safe to restock on any cancel/refund, regardless of payment state
- No need to check payment verification status before restocking

---

## 12. Email Templates Used

**On Cancel:**
- Template: `order-cancelled`
- Function: `orderCancelledEmail()` from `/lib/email/templates/order-cancelled`
- Called in: `/api/orders/[id]/cancel` (line 176)

**On Refund:**
- Template: `order-refunded`
- Function: `orderRefundedEmail()` from `/lib/email/templates/order-refunded`
- Called in: `/api/orders/[id]/refund` (line 93), charge.refunded webhook (line 110)

**Template Config:**
- Fetched via `getTemplateConfig(tenantId, templateName, 'buyer', locale)`
- Respects per-tenant enable/disable flag
- Locale-aware: 'en' or 'ms' (Malay)

---

## Key Code Locations (Quick Reference)

| Component | File | Lines | Type |
|-----------|------|-------|------|
| Cancel endpoint | `/api/orders/[id]/cancel/route.ts` | 1-222 | API route |
| Refund endpoint | `/api/orders/[id]/refund/route.ts` | 1-307 | API route |
| Buyer cancel-payment | `/api/orders/[id]/cancel-payment/route.ts` | 1-127 | API route |
| Stock utils | `/api/orders/lib/stock-utils.ts` | 1-214 | Utilities |
| Stripe webhook (refund) | `/api/webhooks/stripe/handlers/charge-refunded.ts` | 1-138 | Webhook handler |
| Cancel modal UI | `/(dashboard)/orders/_components/CancelOrderModal.tsx` | 1-219 | Component |
| Order detail panel | `/(dashboard)/orders/_components/OrderDetailPanel.tsx` | 1-950 | Component |
| Orders collection | `/collections/Orders.ts` | 15-29 (transitions), 189-208 (status), 210-225 (payment status) | Collection config |
| Products collection | `/collections/Products.ts` | 339-345 (inventory field) | Collection config |

---

## Unresolved Questions

1. **Pre-#1082 Orders:** Are there production orders from before variant stock decrement fix? If so, cancelling them now will phantom-increment variant stock. Need migration audit.

2. **Xendit Integration Timeline:** When is F34 (Xendit refund) scheduled? Requires new webhook handler + refund API similar to Stripe pattern.

3. **Returns Feature (RMA) Scope:** Is returns/RMA planned as part of F10 expansion or separate feature? Scope affects inventory hold logic (reserve vs. full restock).

4. **Discount Redemption Idempotency:** The `releaseDiscountRedemption()` function is called multiple times in same flow. Is it truly idempotent (idempotent-key in function, or just checks existence)?

5. **Refund Rollback Race:** Line 287-291 notes a known race where charge.refunded webhook arrives while status is already 'refunded'. Full fix would add a schema marker (e.g., `stripeRefundId`). Is this on roadmap?

