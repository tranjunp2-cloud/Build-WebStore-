# Order Fulfillment & Shipping Flow - Fact Map

**Date:** 2026-06-17  
**Project:** ech-prime-web-v2 (Next.js + Payload CMS)  
**Scope:** Read-only investigation of order fulfillment mechanics

---

## 1. ShipOrderModal Component

**File:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/(dashboard)/orders/_components/ShipOrderModal.tsx` (lines 1–141)

### Purpose
Modal dialog that collects a tracking number from the merchant when shipping an order.

### Fields Displayed
- **Single input field:** "Tracking Number" (required, 3–100 chars)
- Modal title: "Mark as Shipped — {orderNumber}"
- Icon: Package (teal, 26×26)

### How Merchant Enters Tracking
```tsx
// Line 78-98: Input field with onChange handler
<input
  id="ship-tracking-input"
  type="text"
  value={trackingNumber}
  onChange={(e) => setTrackingNumber(e.target.value)}
  placeholder={s.trackingPlaceholder}
  disabled={isLoading}
  autoFocus
  ...
/>
```
- Free-text field (no validation beyond min 3, max 100 chars)
- Placeholder and labels loaded from i18n (`t.dashboard.orders.ship.*`)

### Status Transition
```tsx
// Line 120: onConfirm handler
<button
  onClick={() => onConfirm(trackingNumber.trim())}
  disabled={isDisabled}
  ...
>
```
- Callback passes `trackingNumber` to parent (`OrderDetailPanel`)
- Parent calls `handleAction('shipped', trackingNumber)` (line 957 of OrderDetailPanel)
- This PATCH request is sent to `/api/orders/{id}` with `{ status: 'shipped', trackingNumber }`

### Button States
- **Confirm button:** Disabled until `trackingNumber.trim() !== ''` (line 33)
- **Back button:** Cancels and clears the form (line 104)
- Confirm button shows spinner during save (`isLoading`)

---

## 2. Order Detail Page (Merchant/Dashboard)

**Primary Route:** `/api/(dashboard)/orders`  
**Entry Point:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/(dashboard)/orders/page.tsx` (routes to `OrdersClientLayout`)

### Layout & Navigation
- **Main page:** `/src/app/(dashboard)/orders/page.tsx` (simple wrapper)
- **Client component:** `/src/app/(dashboard)/orders/_components/OrdersClientLayout.tsx` (lines 1–100+)
- **Detail panel:** `/src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx` (lines 974–1097)
  - Slides in as a FIXED overlay from the right edge
  - Selected via `searchParams.get('order')` or row click

### Buttons/Actions Available (per OrderDetailPanel)

#### Primary Action Button (Line 860–889)
- **Pending → Confirmed** (blue gradient button)
- **Confirmed → Ready to Ship** ("readyToShip" label)
- **Ready to Ship → Ship Modal** (opens ShipOrderModal)
- **Shipped → Completed** ("completed" label)
- Disabled for terminal statuses (cancelled, refunded, completed)

#### Secondary Actions (Bottom Row, Lines 892–949)
1. **Cancel Order Button** (Red border, line 900–921)
   - Opens `CancelOrderModal` for reason input
   - Available only for: pending, new, confirmed, paid, processing
   - Disabled for shipped, completed, refunded, cancelled

2. **Refund Button** (Neutral border with icon, line 924–946)
   - Available only for: shipped, completed
   - Opens async `handleRefund()` POST to `/api/orders/{id}/refund`

### Order Progress Stepper
Visual timeline (line 330–377) showing: Pending → Confirmed → Ready → Shipped → Completed  
Maps order status to step and highlights active/inactive steps.

---

## 3. Order Status Lifecycle

**File:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/collections/Orders.ts` (lines 15–29)

### Enum: ORDER_STATUS_TRANSITIONS
```typescript
pending: ['new', 'confirmed', 'cancelled']
new: ['confirmed', 'cancelled']
confirmed: ['ready_to_ship', 'cancelled']
ready_to_ship: ['shipped']
shipped: ['completed', 'refunded']
completed: ['refunded']
cancelled: []
refunded: []

// Legacy Stripe statuses (backward compat)
paid: ['processing', 'cancelled']
payment_failed: []
processing: ['shipped', 'cancelled']
```

### Status Field Definition (Lines 189–207)
```typescript
{
  name: 'status',
  type: 'select',
  required: true,
  defaultValue: 'pending',
  index: true,
  options: [
    { label: 'Pending', value: 'pending' },
    { label: 'New', value: 'new' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Ready to Ship', value: 'ready_to_ship' },
    { label: 'Shipped', value: 'shipped' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'Refunded', value: 'refunded' },
    { label: 'Paid', value: 'paid' },
    { label: 'Payment Failed', value: 'payment_failed' },
    { label: 'Processing', value: 'processing' },
  ]
}
```

---

## 4. Tracking Fields on Orders Collection

**File:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/collections/Orders.ts` (lines 368–373)

### trackingNumber Field
```typescript
{
  name: 'trackingNumber',
  type: 'text',
  admin: { description: 'Shipping tracking number' },
}
```

**Characteristics:**
- **Type:** Free-text (no enum, no constraints at schema level)
- **Validation:** Applied only at API layer (line 68 of `/src/lib/validations/orders.ts`)
  ```typescript
  trackingNumber: z.string().min(3).max(100).optional(),
  ```
- **Populated by:** Manual merchant entry via `ShipOrderModal`
- **Read-only:** No (merchant can modify via PATCH request)
- **Indexed:** No explicit index on this field

### No Other Shipping Fields
No separate fields for:
- `shippingProvider`
- `shippingCourier`
- `shippingDate`
- `estimatedDelivery`
- `carrier`

---

## 5. How Status Transitions Happen

### Mechanism: Modal-Per-Action Pattern

#### Confirm/Ready/Completed Flow
1. Merchant clicks primary action button in `OrderDetailPanel`
2. For **ready_to_ship → shipped**: Opens `ShipOrderModal` (line 952)
   ```tsx
   <ShipOrderModal
     orderNumber={orderNumber}
     isOpen={isShipModalOpen}
     isLoading={isLoading}
     onBack={() => setIsShipModalOpen(false)}
     onConfirm={(trackingNumber) => { 
       setIsShipModalOpen(false)
       handleAction('shipped', trackingNumber) 
     }}
   />
   ```
3. For other transitions: Direct `handleAction()` call (line 863)

#### Cancel Flow
1. Merchant clicks "Cancel Order" button (line 900)
2. Opens `CancelOrderModal` for mandatory reason entry
3. Modal validates non-empty reason (≥1 char, max 500)
4. POST to `/api/orders/{id}/cancel` with `{ reason }`

#### Refund Flow
1. Merchant clicks "Refund" button (line 924)
2. Direct POST to `/api/orders/{id}/refund`
3. No modal—async operation with loading state

### API Route: PATCH /api/orders/[id]

**File:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/api/orders/[id]/route.ts` (lines 26–88)

```typescript
export const PATCH = withFeatureGuard('order_management')(
  withAuth<RouteContext>(async (user, request, ctx) => {
    const { id } = await ctx.params
    const { data, errorResponse } = await parseRequest(request, orderStatusUpdateSchema)
    
    const { status: newStatus, trackingNumber, notes } = data!
    
    // Validate transition via ORDER_STATUS_TRANSITIONS
    const currentStatus = order.status as string
    const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus] || []
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json({ success: false, error: { ... } }, { status: 422 })
    }
    
    // Require tracking number when shipping
    if (newStatus === 'shipped' && !trackingNumber) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Tracking number is required when shipping' } },
        { status: 422 }
      )
    }
    
    // Build update
    const updateData: Record<string, unknown> = { status: newStatus }
    if (trackingNumber) updateData.trackingNumber = trackingNumber
    if (notes) updateData.notes = notes
    if (newStatus === 'cancelled' && notes) updateData.cancelReason = notes
    
    const updated = await payload.update({
      collection: 'orders',
      id,
      data: updateData,
      user,
      overrideAccess: false,
    })
  })
)
```

**Key Validation:**
- Line 60: Enforces `ORDER_STATUS_TRANSITIONS` rules
- Line 74–78: **Requires tracking number for 'shipped' status**
- Sends buyer notification emails for: confirmed, completed, cancelled, refunded (line 99)

---

## Summary: Fulfillment UX for Merchant

| Step | Component | User Action | Data Collected | Status Change |
|------|-----------|-------------|-----------------|---------------|
| 1 | Order Detail Panel | Click "Confirm Order" | — | pending → confirmed |
| 2 | Order Detail Panel | Click "Ready to Ship" | — | confirmed → ready_to_ship |
| 3 | ShipOrderModal | Enter tracking number | `trackingNumber` | ready_to_ship → shipped |
| 4 | Order Detail Panel | Click "Mark Completed" | — | shipped → completed |
| 5 | Order Detail Panel | Click "Refund" | — | shipped/completed → refunded |
| X | CancelOrderModal | Enter cancel reason | `cancelReason` | pending/new/confirmed → cancelled |

---

## Implementation Notes

- **No bulk shipping actions:** Individual order modals only
- **Tracking is per-order:** Not per-item or per-shipment
- **Manual entry only:** No carrier API integration visible (Shopify/EasyPost not integrated)
- **Idempotency:** PATCH is safe; transitions are validated server-side
- **Email notifications:** Sent automatically on confirmed/completed/cancelled/refunded
- **Order access control:** Collection-level IDOR protection (tenant-scoped reads/updates)

