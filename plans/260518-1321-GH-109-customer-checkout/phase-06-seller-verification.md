# Phase 06 — Seller Verification (Approve / Reject)

**Status:** pending | **Effort:** 2.5h | **Owner:** fullstack-developer | **Blocks:** Phase 01, Phase 04

## Overview
Admin order detail page gets a `<PaymentVerificationBlock>` for orders with status='pending_verification'. Approve transitions to 'confirmed' + decrements stock. Reject opens `<RejectPaymentModal>` (enum reason picker) → status reverts to 'awaiting_payment' (customer can re-upload), reason recorded.

## Related code files
- Create: `src/app/(admin)/orders/[id]/PaymentVerificationBlock.tsx`
- Create: `src/components/admin/orders/RejectPaymentModal.tsx`
- Create: `src/app/api/orders/[id]/verify-payment/route.ts`
- Modify: existing admin order detail page to mount `PaymentVerificationBlock` (search for current order detail route in `src/app/(admin)/orders/`)
- Reference: `src/collections/Orders.ts` ORDER_STATUS_TRANSITIONS (from Phase 01)

## API contract
`POST /api/orders/[id]/verify-payment`
- Auth: Payload session (admin/super-admin or tenant member with order access). Reuse Orders collection update access predicate.
- Body:
```ts
{ action: 'approve' } | { action: 'reject', reason: 'insufficient_amount'|'wrong_reference'|'illegible_proof'|'other', note?: string }
```
- Validation: status MUST be 'pending_verification' (else 409).

### Approve flow
1. Re-validate stock for each item; if any insufficient → 422 INSUFFICIENT_STOCK with offending product (keeps status as pending_verification).
2. Decrement stock per item (mirror Phase 02 COD logic).
3. Update order: status='confirmed', paymentVerifiedAt=now, paymentVerifiedBy=req.user.id.
4. Fire-and-forget email to customer: "Payment confirmed, order processing".
5. Return updated order.

### Reject flow
1. Update order: status='awaiting_payment', paymentRejectReason, paymentRejectNote, clear paymentProofImage? — keep proof for audit, just change status.
2. Reset paymentExpiresAt? Decision: do NOT extend deadline (prevents abuse). If TTL already passed at reject time, next auto-cancel cycle cancels it.
3. Fire-and-forget email to customer: "Payment receipt rejected: {reason}. Please re-upload."
4. Return updated order.

## UI components

### PaymentVerificationBlock.tsx (≤150 lines)
Renders when `order.status === 'pending_verification'`:
- Proof image preview (zoomable).
- Customer-reported reference (paymentReference).
- "Approve" button (primary) → confirm dialog → POST approve.
- "Reject" button (secondary) → opens RejectPaymentModal.
- Inline status after action.

### RejectPaymentModal.tsx (≤120 lines)
- shadcn/ui Dialog.
- Radio group of 4 enum reasons + "Other".
- Textarea (required when reason='other', optional else).
- Confirm button disabled until reason selected.
- POST reject on confirm; close + refetch order.

## Implementation steps
1. Create verify-payment route with action discriminator + ORDER_STATUS_TRANSITIONS guard.
2. Implement approve stock re-validation + decrement (extract shared helper `src/lib/orders/decrement-stock.ts` if Phase 02 didn't already).
3. Create PaymentVerificationBlock component (read-only proof view + 2 buttons).
4. Create RejectPaymentModal with shadcn/ui Dialog + RadioGroup + Textarea.
5. Mount block on admin order detail page (find existing page in `src/app/(admin)/orders/[id]` or Payload admin custom view — open Q below).
6. Add customer notification emails (lightweight templates; reuse infra from Phase 05 patterns).

## Edge cases
- Approve when stock now insufficient → 422 with product name; UI shows error toast; seller must wait for restock or reject order.
- Double-click approve → server transition guard prevents double-decrement (status check).
- Reject without reason → 400 validation error.
- Reject with reason='other' but no note → 400.
- Approve concurrent with auto-cancel hook (race) → first wins via status transition guard.

## Todo list
- [ ] Create POST /api/orders/[id]/verify-payment
- [ ] Extract decrement-stock helper
- [ ] Create PaymentVerificationBlock.tsx
- [ ] Create RejectPaymentModal.tsx
- [ ] Mount on admin order detail page
- [ ] Add approve + reject customer email stubs

## Success criteria
- Seller sees proof + 2 buttons on pending_verification order.
- Approve → order.status='confirmed', stock decremented, customer email sent.
- Reject (with reason) → order.status='awaiting_payment', reason recorded, customer notified.
- Stock-insufficient approve → 422 + status unchanged.

## Risk / open Q
- Admin order detail page location uncertain (could be Payload's native admin UI or custom `(admin)` route). Confirm during implementation; fallback to Payload custom field component (`admin.components.Field`) if no custom page.
- Reject email + approve email templates new — implement minimal HTML inline; full templating optional follow-up.
