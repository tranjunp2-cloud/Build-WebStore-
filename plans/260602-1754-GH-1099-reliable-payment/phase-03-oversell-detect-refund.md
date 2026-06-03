# Phase 03 — Oversell detect + flag + SYSTEM_ALERT + admin refund surface

**Priority:** P1 | **Status:** pending | **AC:** AC-2, AC-3 | **TC:** TC-F13.145, TC-F13.146 | **Effort:** 3h
**Depends:** 02

## Overview
AC-2: stock decrement must detect when ordered qty exceeded available stock (oversell after capture).
AC-3: set `oversellReview=true` (flag, NOT status — order stays new/paid), SYSTEM_ALERT to seller,
NO auto-refund. Surface existing admin "Refund customer" button for these orders.

## Key insight
Oversell = `inventory < qty` at decrement time. Current `GREATEST(0, inventory-qty)` clamps to 0 but
loses the signal. Use `RETURNING inventory` (post-update) + compare, OR detect via the pre-clamp delta.
Cleanest: `RETURNING inventory` where we also capture whether clamp occurred.

## Related code files
- MODIFY `src/lib/payment/reconcile-order-paid.ts` — decrementStock returns oversell signal; set flag
- MODIFY `src/app/api/orders/[id]/refund/route.ts` — allow refund when `oversellReview===true`
- MODIFY `src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx` — surface refund button + flag badge

## Architecture

### AC-2 oversell detect (decrementStock)
```sql
UPDATE products
SET inventory = GREATEST(0, inventory - ${qty})
WHERE id = ${productId} AND inventory IS NOT NULL
RETURNING (inventory + ${qty}) < ${qty} AS oversold  -- pre-update stock < qty
```
Return boolean per item; reconcile aggregates `oversell = items.some(oversold)`.

### AC-3 flag + alert (in reconcileOrderPaid, after stock loop)
```ts
if (oversell) {
  await payload.update({ collection:'orders', id, data:{ oversellReview:true } })
  await notifyTenantOwners(payload, tenantId, {
    type:'SYSTEM_ALERT',
    title:`Oversell on order #${order.orderNumber}`,
    message:`Stock oversold after payment. Review and decide on refund.`,
    actionUrl:'/orders',
    metadata:{ orderNumber: order.orderNumber },
  })
}
```
Order STAYS status='new', payment_status='paid'. NO auto-refund.

### AC-3 admin refund surface (D3 decision)
- `refund/route.ts` line ~61 gate: `refundableStatuses=['shipped','completed']` → add: OR `order.oversellReview===true`.
  Also the SQL CAS `status = ANY(ARRAY['shipped','completed'])` must include the oversell case — for
  oversell orders status is 'new', so widen CAS to also match when oversellReview true. Keep narrow:
  ```sql
  WHERE id=? AND (status = ANY(ARRAY['shipped','completed']::enum_orders_status[]) OR oversell_review = true)
  ```
  On success also clear flag: `oversell_review = false` in same UPDATE.
- `OrderDetailPanel.tsx` line ~881 gate: `refundDisabled = !(['shipped','completed'].includes(status) || order.oversellReview)`.
  Add a visible badge/warning when `oversellReview` true so seller knows why refund is offered.

## Data flow
2nd concurrent webhook → reconcile wins atomic? NO (1st already set new) → already_processed. The oversell
case is: BOTH win their atomic transition (2 different orders, same product). 2nd order's decrementStock
sees inventory already 0 → oversold=true → flag 2nd order. (TC-145 scenario.)

## Todo
- [ ] decrementStock RETURNING oversold; aggregate in reconcile
- [ ] set oversellReview + SYSTEM_ALERT (no auto-refund)
- [ ] refund route: allow oversellReview orders + clear flag on refund
- [ ] OrderDetailPanel: enable refund button + oversell badge for flagged orders
- [ ] tsc clean

## Success criteria
- TC-145: 2 orders, stock=1 → 1st decrements to 0, 2nd flagged oversellReview, both stay new/paid, seller alerted, no auto-refund.
- TC-146: flagged order → admin sees badge + Refund button → POST refund → paymentStatus=refunded, flag cleared.
- Non-oversell orders unaffected (refund still gated to shipped/completed).

## Risk
| Risk | L×I | Mitigation |
|------|-----|-----------|
| RETURNING expr wrong (clamp masks signal) | Med×High | compute `(inventory+qty)<qty` from post-update value = pre-update<qty; unit test both branches |
| Widening refund gate opens refund to all 'new' orders | Med×High | gate strictly on `oversell_review=true`, NOT status='new' |
| SYSTEM_ALERT spam if reconcile retried | Low×Med | alert inside reconciled branch only (already_processed never reaches it) |
| Flag not cleared after refund → repeat alerts | Low×Med | clear oversell_review=false in refund CAS |

## Security
Refund route keeps IDOR check (user tenant must own order). Flag-based gate does not bypass ownership.

## Rollback
Revert 3 files. Flag column stays (phase 01). Orders already flagged keep flag=true (harmless; seller can ignore).

## Next
Feeds 06 (i18n badge text + tests).
