# Phase 05 — AC-6 cron reconcile-orders + stale handling

**Priority:** P1 | **Status:** pending | **AC:** AC-6 | **TC:** TC-F13.155, TC-F13.156 | **Effort:** 2h
**Depends:** 02

## Overview
Cron every 10 min: find pending Stripe orders, query their Stripe session; if paid → `reconcileOrderPaid({source:'cron'})`
(self-heal, idempotent, re-sends emails). Stale pending >24h with no/expired Stripe session → mark terminal.
Reject without `CRON_SECRET`. Mirrors existing payment-expiry cron/job pattern exactly.

## Related code files
- CREATE `src/app/api/cron/reconcile-orders/route.ts` (mirror payment-expiry/route.ts — Bearer CRON_SECRET)
- CREATE `src/lib/jobs/reconcile-orders.ts` (mirror payment-expiry.ts job)
- MODIFY `vercel.json` crons array (line ~19) — add schedule

## Architecture

### Route (verbatim mirror of payment-expiry/route.ts)
```ts
export const dynamic = 'force-dynamic'; export const maxDuration = 60
GET: authHeader !== `Bearer ${CRON_SECRET}` → 401; else reconcileOrdersJob(payload) → JSON result
```

### Job (reconcile-orders.ts)
```
find orders WHERE paymentMethod IN ('card','fpx') AND status='pending', depth 2, limit 200, sort createdAt
for each:
  A. has stripeSessionId:
       session = retrieveCheckoutSession(stripeSessionId, tenant.stripeAccountId)
       if session paid → reconcileOrderPaid({ source:'cron' }) → healed++
       else if createdAt > 24h ago → markStale(order) → expired++
  B. no stripeSessionId AND createdAt > 24h → markStale(order) → expired++
return { healed, expired, errors, total }
```

### markStale (D1 — enum has NO 'expired'; reuse 'cancelled')
```sql
UPDATE orders SET status='cancelled'::enum_orders_status,
  payment_status='payment_failed',
  cancel_reason='Auto-expired: payment not completed within 24h'
WHERE id=? AND status='pending'
RETURNING id   -- atomic guard, mirror payment-expiry
```
Optionally fire orderExpiredEmail (reuse template, like payment-expiry job). FLAG: TC-156 doc says
`status='expired'` — we use 'cancelled'. See Unresolved Q1.

### vercel.json
```json
{ "path": "/api/cron/reconcile-orders", "schedule": "*/10 * * * *" }
```

## Data flow
Vercel cron → GET (CRON_SECRET) → job queries pending Stripe orders → Stripe session lookup →
paid: reconcileOrderPaid (DB heal + emails) | stale: cancel + expiry email. Returns counts (logged).

## Todo
- [ ] reconcile-orders.ts job (heal + stale branches)
- [ ] reconcile-orders/route.ts (CRON_SECRET auth)
- [ ] vercel.json cron entry */10
- [ ] batch-limit log (mirror payment-expiry line 102)
- [ ] tsc clean

## Success criteria
- TC-155: order pending >15min, Stripe session paid → cron heals to paid via reconcile; reconciled count logged.
- TC-156: pending >24h, no/expired session → cancelled (D1); request without CRON_SECRET → 401.
- Idempotent: healing an order already healed by webhook → already_processed, no dup email.

## Risk
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Cron heals + webhook arrives simultaneously | Med×Low | reconcile atomic guard = single winner |
| 'expired' status doc/code mismatch | High×Low | D1: reuse 'cancelled'+cancelReason; flag to QA (Q1) |
| Stripe N+1 calls (200 orders × retrieve) | Med×Med | limit 200/run; */10 cadence; acceptable for volume; paginate later if needed (YAGNI) |
| markStale cancels an order that just got paid | Low×High | atomic `WHERE status='pending'`; paid order already moved off pending |

## Security
CRON_SECRET Bearer (env var, GH secret for CI / Vercel dashboard for runtime). 401 fail-closed if missing.

## Rollback
Delete route+job, remove vercel.json entry. No schema change. Orders cancelled by a bad run are recoverable
via retry-payment (status=cancelled → 409, but oversell/manual path exists) — low risk given 24h gate.

## Next
Feeds 06 (cron auth + heal + stale tests).
