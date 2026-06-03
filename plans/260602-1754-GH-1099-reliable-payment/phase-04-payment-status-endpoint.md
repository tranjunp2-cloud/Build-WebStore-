# Phase 04 — AC-5 payment-status active-reconcile endpoint + confirm page

**Priority:** P1 | **Status:** pending | **AC:** AC-5 | **TC:** TC-F13.150, TC-F13.152 | **Effort:** 2h
**Depends:** 02

## Overview
Active self-heal: `POST /api/orders/[id]/payment-status` retrieves the Stripe checkout session on the
connected account; if Stripe shows paid AND order pending → call `reconcileOrderPaid({source:'poll'})`.
Confirm page calls it on mount (+ a few retries) so the order self-heals even if the webhook never arrives.

## Key insight (D2)
SSE `/api/orders/stream/[orderNumber]` (US-F13-05, TC-150 GREEN) already pushes live status to the confirm
page UI. We do NOT add a second polling-for-UI mechanism (DRY). Division of labor:
- **payment-status endpoint** = the *reconcile* trigger (queries Stripe, heals DB).
- **SSE** = the *UI flip* (detects DB change, pushes to client).
Confirm page calls payment-status on mount to *cause* the heal; SSE then *reflects* it. Aligns TC-152.

## Related code files
- CREATE `src/app/api/orders/[id]/payment-status/route.ts`
- MODIFY `src/app/sites/[slug]/order/[orderId]/confirm/ConfirmClient.tsx` — call endpoint on mount

## Architecture

### Endpoint (auth: ct_ cookie, mirror retry-payment lines 72-76)
```
POST /api/orders/[id]/payment-status
1. findByID order (depth to resolve tenant.stripeAccountId, site for session)
2. Auth: cookie ct_${order.id} → verifyConfirmToken(token, order.id, order.orderNumber); 401 if invalid
3. If order.status !== 'pending' → return { status: order.status, paymentStatus } (nothing to heal)
4. If no stripeSessionId → return { status:'pending', reconciled:false } (cron will expire it)
5. retrieveCheckoutSession(stripeSessionId, tenant.stripeAccountId)  [helper from phase 02]
6. If session.payment_status === 'paid' (or status 'complete'):
     await reconcileOrderPaid(payload, { orderId, session, connectedAccountId, source:'poll' })
7. Re-read order, return { status, paymentStatus, reconciled: result.status==='reconciled' }
```
Returns 200 on transient Stripe error (log only) — let SSE/cron retry. Idempotent: reconcile's atomic guard.

### Confirm page integration (ConfirmClient.tsx)
On mount, for Stripe order not yet paid: `POST /api/orders/${order.id}/payment-status` once, then 2-3
retries at ~3s spacing if still pending (covers webhook-missed). SSE handles the actual UI flip + clearCart.
Do NOT duplicate clearCart — leave it in the existing SSE handler (line ~190 useEffect).

## Data flow
buyer lands on confirm → POST payment-status → endpoint queries Stripe → if paid, reconcileOrderPaid heals DB
→ SSE detects status change → pushes → UI flips to success. If webhook already healed: step 3 short-circuits.

## Todo
- [ ] Create payment-status route (ct_ auth, Stripe retrieve, reconcile call)
- [ ] ConfirmClient: call endpoint on mount + bounded retries
- [ ] Verify no double clearCart / double UI mechanism
- [ ] tsc clean

## Success criteria
- TC-150: webhook delayed → confirm page heals via endpoint within retries → SSE flips to success.
- TC-152: endpoint self-heals pending→paid by querying Stripe; idempotent vs webhook.
- Invalid/absent ct_ cookie → 401.
- Already-paid order → endpoint no-op, returns current status.

## Risk
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Double UI flip (endpoint + SSE both update UI) | Med×Med | endpoint returns data only; SSE owns UI flip + clearCart (D2) |
| Stripe rate limit from aggressive retries | Low×Med | bounded retries (≤3), short-circuit if already paid |
| Endpoint called by non-owner | Med×High | ct_ cookie scoped per order.id (same as retry-payment) |
| Polling races webhook on same order | Med×Low | reconcile atomic guard = single winner |

## Security
ct_ HttpOnly cookie per order; verifyConfirmToken binds token↔order.id↔orderNumber. No tenant-user auth needed
(buyer-facing). Endpoint never returns other orders' data.

## Rollback
Delete route + revert ConfirmClient mount effect. SSE-only behavior restored (US-F13-05 baseline).

## Next
Feeds 06 (tests for endpoint + idempotency).
