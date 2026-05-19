# Phase 06 — Seller Dashboard Verification UI + Approve/Reject APIs

## Context Links

- PRD FR-19, FR-20, FR-21, BR-Payment-03, BR-Payment-07, AC-6, AC-7, §10.1, §10.2, §10.5, §13.1
- Existing: `src/app/(dashboard)/orders/page.tsx`, `src/app/(dashboard)/orders/_components/*`, `src/app/api/orders/[id]/route.ts`
- Existing components: status timeline, OrderDetailDrawer

## Overview

- **Priority:** P0
- **Status:** pending
- **Depends on:** P01 (schema), P03 (payment-confirmed + payment-rejected emails + order-token signer)
- **Description:** Dashboard surfaces v2.2: (a) "Awaiting Verification" filter chip in list, (b) `ManualPaymentVerificationBlock` inside order detail, (c) `RejectPaymentModal` reason picker, (d) two new dedicated APIs — `approve-payment` (commits stock + sets paid + email) and `reject-payment` (rolls status back, rotates magic link secret, emails new link).

## Key Insights

- Existing PATCH `/api/orders/[id]` only handles `status` transitions; payment decisions deserve dedicated endpoints because they have richer side-effects (stock decrement, magicLinkSecret rotation, email content variance).
- Approve commits inventory NOW (the deferred reservation). Use same loop as today's checkout decrement (with `Math.max(0, ...)`).
- Reject rotates `magicLinkSecret` to invalidate the link in the rejection email's predecessor — security best practice; new link uses fresh secret.
- Filter chip is preset query — adds `&where[paymentStatus][equals]=pending_verification` to existing list URL (don't reinvent filter machinery).
- Seller email notification on upload (from P04) and dashboard polling/refresh already in place via existing notification system — no extra work needed here.

## Requirements

### Functional

#### List screen (`page.tsx`)
- Add `AwaitingVerificationChip` near Stats Bar.
- Chip displays count of `pending_verification` orders for active tenant; clicking applies that filter.
- New column: `Payment Ref` (paymentReference) when payment method = bank_transfer.
- Payment Status badge color map: `awaiting_payment`=gray, `pending_verification`=amber, `paid`=green, `cancelled`=red.

#### Order Detail Drawer
- Insert `ManualPaymentVerificationBlock` between status timeline and customer block, ONLY when:
  - `paymentMethod === 'bank_transfer'` AND `paymentStatus === 'pending_verification'`.
- Block contains:
  - Reference code (mono, large, copyable).
  - Proof preview (click → full-screen modal — keep using existing Image Viewer / new lightweight modal).
  - Amount expected.
  - Buyer name + phone.
  - **Approve** button (primary green).
  - **Reject** button (red — opens `RejectPaymentModal`).
- For `paid` BT orders: small audit panel showing `paymentVerifiedAt` + `paymentVerifiedBy` (read from depth=1 user relation).

#### RejectPaymentModal
- Radio options: Ảnh mờ / Sai số tiền / Trùng đơn / Khác.
- If `Khác`: textarea required, min 10 chars.
- Submit → calls API → on success closes + toast + drawer refresh.

#### APIs

**`PATCH /api/orders/[id]/approve-payment`** (authed via `withAuth`)
- Guard: caller has tenant access (existing access control).
- Guard: `paymentMethod==='bank_transfer'` AND `paymentStatus==='pending_verification'`.
- Update: `paymentStatus='paid'`, `paymentVerifiedAt=now`, `paymentVerifiedBy=user.id`, `verificationSource='manual'`, `status` from `pending` → `confirmed` (only if currently `pending`).
- Decrement inventory for each item (same logic as old checkout decrement).
- Fire-and-forget: send `payment-confirmed` email (P03).

**`PATCH /api/orders/[id]/reject-payment`** (authed)
- Body schema (zod): `{ reason: enum, detail?: string }` — `detail` required + ≥10 chars when reason==='other'.
- Guard: `paymentMethod==='bank_transfer'` AND `paymentStatus==='pending_verification'`.
- Rotate `magicLinkSecret = crypto.randomBytes(32).toString('hex')`.
- Extend `paymentExpiresAt = now + 24h` (BR-Payment-05).
- Update: `paymentStatus='awaiting_payment'`, `paymentRejectionReason`, `paymentRejectionDetail`, new `magicLinkSecret`, new `paymentExpiresAt`. Clear `paymentProofImage`? — **No**; keep for audit. Buyer re-upload replaces.
- Sign new JWT with new secret + new exp.
- Fire-and-forget: send `payment-rejected` email (P03) with new magic link.

### Non-Functional

- Approve/Reject endpoints are idempotent against same final state? Approve: re-call returns 422 (status guard). Reject: re-call same status would rotate secret again — guard against by checking status is `pending_verification`.
- Page-level perf: filter chip count fetched once on mount (cache 60s).

## Architecture

```
List page (page.tsx)
  AwaitingVerificationChip ── fetch /api/orders?where[paymentStatus][equals]=pending_verification&limit=0 (count)
  applies filter on click

Order Detail Drawer
  if BT + pending_verification:
    <ManualPaymentVerificationBlock>
       [Approve] → PATCH approve-payment → refresh
       [Reject]  → open <RejectPaymentModal>
                  → PATCH reject-payment → refresh

PATCH /api/orders/[id]/approve-payment
  withAuth → guard → decrement inventory → update order → email

PATCH /api/orders/[id]/reject-payment
  withAuth → guard → rotate secret + new exp → update order → sign+send email
```

## Related Code Files

- **Create:** `src/app/(dashboard)/orders/_components/ManualPaymentVerificationBlock.tsx`
- **Create:** `src/app/(dashboard)/orders/_components/RejectPaymentModal.tsx`
- **Create:** `src/app/(dashboard)/orders/_components/AwaitingVerificationChip.tsx`
- **Create:** `src/app/(dashboard)/orders/_components/ProofViewerModal.tsx` (lightweight; reuse existing image viewer if present)
- **Create:** `src/app/api/orders/[id]/approve-payment/route.ts`
- **Create:** `src/app/api/orders/[id]/reject-payment/route.ts`
- **Modify:** `src/app/(dashboard)/orders/page.tsx` (mount chip + payment ref column)
- **Modify:** existing OrderDetailDrawer component (insert block; minimal patch — single insertion point)
- **Modify:** `src/lib/validations/orders.ts` (add `rejectPaymentSchema`)
- **Read:** `src/lib/auth/order-token.ts`, `src/lib/email/templates/payment-confirmed.ts`, `src/lib/email/templates/payment-rejected.ts`

## Implementation Steps

1. **Validation schema** (`src/lib/validations/orders.ts`):
   ```ts
   export const rejectPaymentSchema = z.object({
     reason: z.enum(['image_blurry','wrong_amount','duplicate_order','other']),
     detail: z.string().optional(),
   }).refine(d => d.reason !== 'other' || (d.detail && d.detail.trim().length >= 10), { message: 'Detail required (≥10 chars) when reason=other', path: ['detail'] })
   ```
2. **`approve-payment/route.ts`**:
   ```ts
   export const PATCH = withAuth<RouteContext>(async (user, _req, ctx) => {
     const { id } = await ctx.params
     const payload = await getPayload({ config })
     const order = await payload.findByID({ collection:'orders', id, user, overrideAccess:false, depth:0 })
     if (!order) return 404
     if (order.paymentMethod !== 'bank_transfer' || order.paymentStatus !== 'pending_verification') return 422
     // commit inventory
     for (const item of order.items as any[]) {
       try {
         const p = await payload.findByID({ collection:'products', id: item.product, depth:0, overrideAccess:true }) as any
         if (p.inventory != null) {
           await payload.update({ collection:'products', id: item.product, data: { inventory: Math.max(0, p.inventory - item.quantity) } as any, overrideAccess:true })
         }
       } catch (e:any) { console.warn('[Approve decrement]', e) }
     }
     const updated = await payload.update({ collection:'orders', id, data: {
       paymentStatus: 'paid',
       paymentVerifiedAt: new Date().toISOString(),
       paymentVerifiedBy: user.id,
       verificationSource: 'manual',
       status: order.status === 'pending' ? 'confirmed' : order.status,
     } as any, user, overrideAccess:false })
     payload.sendEmail(paymentConfirmedEmail({...})).catch(log)
     return { success: true, data: updated }
   })
   ```
3. **`reject-payment/route.ts`**:
   ```ts
   export const PATCH = withAuth<RouteContext>(async (user, req, ctx) => {
     const { id } = await ctx.params
     const { data, errorResponse } = await parseRequest(req, rejectPaymentSchema)
     if (errorResponse) return errorResponse
     const payload = await getPayload({ config })
     const order = await payload.findByID({ collection:'orders', id, user, overrideAccess:false, depth:0 })
     if (!order || order.paymentMethod !== 'bank_transfer' || order.paymentStatus !== 'pending_verification') return 422
     const newSecret = crypto.randomBytes(32).toString('hex')
     const newExpires = new Date(Date.now() + 24*3600*1000)
     await payload.update({ collection:'orders', id, data: {
       paymentStatus: 'awaiting_payment',
       paymentRejectionReason: data!.reason,
       paymentRejectionDetail: data!.detail ?? null,
       magicLinkSecret: newSecret,
       paymentExpiresAt: newExpires.toISOString(),
     } as any, overrideAccess: true })
     const token = await signOrderToken({ orderId: id, secret: newSecret, expSec: Math.floor(newExpires.getTime()/1000) })
     const site = await payload.findByID({ collection:'sites', id: order.site, depth:0, overrideAccess:true }) as any
     const magicLinkUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/sites/${site.slug}/orders/${id}?token=${token}`
     payload.sendEmail(paymentRejectedEmail({ ..., magicLinkUrl, expiresAtIso: newExpires.toISOString() })).catch(log)
     return { success: true }
   })
   ```
4. **UI components**: see Related Files. Each ~80–120 lines, kebab-cased dirs, PascalCase filenames (React convention).
5. **List page mount** chip + payment ref column.
6. **Tests** (integration):
   - Approve: pending_verification → paid + status promoted + inventory −N.
   - Approve from `awaiting_payment` → 422.
   - Reject `other` without detail → 400.
   - Reject success → status=awaiting_payment + new magicLinkSecret (verify by signing old token, expect verify fail after).
   - Re-approve after reject → blocked (status now awaiting_payment).

## Todo List

- [ ] Add `rejectPaymentSchema` to validations
- [ ] Implement `approve-payment/route.ts` + tests
- [ ] Implement `reject-payment/route.ts` + tests
- [ ] Build `ManualPaymentVerificationBlock`, `RejectPaymentModal`, `AwaitingVerificationChip`, `ProofViewerModal`
- [ ] Mount block inside OrderDetailDrawer (single patch)
- [ ] Add chip + paymentRef column to list page
- [ ] Manual E2E: full approve loop; full reject + re-upload loop
- [ ] Commit: `feat(orders): seller approve/reject bank-transfer verification ui + apis`

## Success Criteria

- AC-6 (Approve) + AC-7 (Reject) pass.
- Approve email received within 1 min.
- Reject email contains new magic link; old link returns 401 invalid after rotation.
- `paymentVerifiedBy` audit visible in CMS for paid BT order.
- Filter chip count matches `pending_verification` order count.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Two sellers click Approve concurrently → double-decrement | L | M | Status guard returns 422 on second call (status changes to `paid` after first); second call sees mismatch. |
| Inventory decrement partially fails (3 of 4 items) | L | M | Per-item try/catch; log. Manual restock by support if needed. Accept tradeoff (existing pattern). |
| Reject flow rotates secret but email delivery fails → buyer locked out | M | H | Email is fire-and-forget; seller can re-issue via Reject-again (idempotent: still 422 because status now awaiting_payment — block re-reject). **Mitigation:** add seller-facing "Resend magic link" button as follow-up (P07 backlog). |
| Old magic link still cached in buyer's email client | M | L | Secret rotation invalidates JWT; opening old link shows "Link Invalid" (P04 handles). |

## Security Considerations

- Both endpoints under `withAuth` + Payload tenant access.
- `magicLinkSecret` rotated on Reject — old links cryptographically invalid.
- `paymentVerifiedBy` recorded as user.id for audit.

## Next Steps

- Backlog: "Resend magic link" button for seller (covers email delivery failure during Reject).
- Backlog (D-14): Bulk Approve for pending_verification.
- Wave 8+: wire up `verificationSource='auto'` path when Open Banking lands.
