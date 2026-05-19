# Phase 05 — Background Job: payment-expiry Cron

## Context Links

- PRD FR-22, BR-Payment-04, AC-8
- Vercel Cron: existing entry in `vercel.json` (`/api/cron/keep-alive`, `*/4 * * * *`)
- Rule: `.claude/rules/vercel-deploy.md` (no webhook deploy — CI driven; `vercel.json` allowed to change cron section)

## Overview

- **Priority:** P0
- **Status:** pending
- **Depends on:** P01 (schema), P03 (order-expired email)
- **Description:** Vercel Cron route running every 15 minutes; auto-cancels Bank Transfer orders past `paymentExpiresAt` and not yet paid; sends "Order Expired" email; no restock side-effect needed (BT never decremented).

## Key Insights

- Vercel free/team plan supports a small number of cron entries; `*/15 * * * *` is a sane upper bound (PRD says ≤15 min cadence).
- Vercel Cron requests carry header `x-vercel-cron: 1` and Authorization: `Bearer $CRON_SECRET` if configured. Use `CRON_SECRET` env var (existing convention; verify via grep) for defense.
- "Restock" in PRD §9.2 step TIMEOUT: BT path NEVER decremented inventory, so restock is a no-op for BT orders. **Important:** keep filter strict to `paymentMethod='bank_transfer'` to avoid double-restocking COD/Stripe.
- Job is idempotent: once `status='cancelled'` set, filter excludes it next run.

## Requirements

### Functional

- `paymentExpiryJob(payload)` finds orders where:
  - `paymentMethod = 'bank_transfer'`
  - `paymentStatus IN ('awaiting_payment','pending_verification')`
  - `paymentExpiresAt < now`
- For each:
  - Update: `status='cancelled'`, `paymentStatus='cancelled'`, `cancelReason='Auto-cancelled: payment not received within 24h'`.
  - Send "Order Expired" email (fire-and-forget).
  - Log structured: `{orderId, orderNumber, action:'auto-cancel', reason:'ttl'}`.
- Returns `{ processed: number, errors: number }`.
- Route handler at `/api/cron/payment-expiry`:
  - GET only (Vercel cron uses GET).
  - Check `Authorization: Bearer $CRON_SECRET` header (if env set); reject otherwise.
  - Calls job, returns summary JSON.
- `vercel.json` adds cron entry `{ path: '/api/cron/payment-expiry', schedule: '*/15 * * * *' }`.

### Non-Functional

- Bounded: process at most 200 orders per run (LIMIT) to avoid timeout (60s `maxDuration` set globally per vercel.json).
- Idempotent on re-run.
- Errors logged but do not fail the whole batch (per-order try/catch).

## Architecture

```
Vercel Cron */15 → GET /api/cron/payment-expiry
  auth check → paymentExpiryJob(payload) → return {processed, errors}

paymentExpiryJob:
  find(limit=200, sort='paymentExpiresAt asc')
  for each:
    update status + paymentStatus + cancelReason
    sendEmail(orderExpired).catch(log)
```

## Related Code Files

- **Create:** `src/lib/jobs/payment-expiry.ts` (pure logic, takes `payload` instance, testable)
- **Create:** `src/app/api/cron/payment-expiry/route.ts` (thin handler)
- **Modify:** `vercel.json` (add cron entry)
- **Read:** `src/lib/email/templates/order-expired.ts` (P03)
- **Read:** `src/app/api/cron/keep-alive/route.ts` (style reference for cron auth)

## Implementation Steps

1. **`src/lib/jobs/payment-expiry.ts`**:
   ```ts
   import type { Payload } from 'payload'
   import { orderExpiredEmail } from '@/lib/email/templates/order-expired'

   export async function paymentExpiryJob(payload: Payload, opts = { limit: 200 }) {
     const now = new Date().toISOString()
     const result = await payload.find({
       collection: 'orders',
       where: { and: [
         { paymentMethod: { equals: 'bank_transfer' } },
         { paymentStatus: { in: ['awaiting_payment','pending_verification'] } },
         { paymentExpiresAt: { less_than: now } },
       ]},
       sort: 'paymentExpiresAt',
       limit: opts.limit,
       depth: 1,
       overrideAccess: true,
     })
     let processed = 0, errors = 0
     for (const order of result.docs as any[]) {
       try {
         await payload.update({
           collection: 'orders', id: order.id,
           data: { status:'cancelled', paymentStatus:'cancelled', cancelReason: 'Auto-cancelled: payment not received within 24h' },
           overrideAccess: true,
         })
         payload.sendEmail(orderExpiredEmail({
           orderNumber: order.orderNumber, customerName: order.customerName,
           total: order.total, currency: order.currency, customerEmail: order.customerEmail,
           productListUrl: `/sites/${(order.site as any)?.slug ?? ''}/products`,
         })).catch((e:any) => payload.logger.error({ err:e, orderId: order.id }, 'order-expired email failed'))
         processed++
       } catch (e:any) {
         payload.logger.error({ err:e, orderId: order.id }, 'payment-expiry update failed')
         errors++
       }
     }
     return { processed, errors, total: result.totalDocs }
   }
   ```
2. **`src/app/api/cron/payment-expiry/route.ts`**:
   ```ts
   import { NextResponse } from 'next/server'
   import { getPayload } from 'payload'
   import config from '@payload-config'
   import { paymentExpiryJob } from '@/lib/jobs/payment-expiry'

   export const maxDuration = 60

   export async function GET(req: Request) {
     const auth = req.headers.get('authorization')
     if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
       return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
     }
     const payload = await getPayload({ config })
     const result = await paymentExpiryJob(payload)
     return NextResponse.json({ success: true, ...result })
   }
   ```
3. **`vercel.json`**: append to `crons` array:
   ```json
   { "path": "/api/cron/payment-expiry", "schedule": "*/15 * * * *" }
   ```
4. Unit test `src/__tests__/unit/lib/payment-expiry.test.ts`:
   - mocks `payload.find` returns 3 orders → `payload.update` called 3x with `status='cancelled'`.
   - orders not matching filter (e.g. `paid`) excluded by the where clause (verified by call args).
   - email send error doesn't bubble (try/catch).
5. Manual test on staging: insert order with `paymentExpiresAt=now-1min`, hit `/api/cron/payment-expiry` with `CRON_SECRET`, verify auto-cancel + email log.

## Todo List

- [ ] `src/lib/jobs/payment-expiry.ts`
- [ ] `src/app/api/cron/payment-expiry/route.ts`
- [ ] Add cron entry to `vercel.json`
- [ ] Unit test (3 cases)
- [ ] Confirm `CRON_SECRET` env var exists in Vercel Dashboard (per env-vars rule); flag for PM if not
- [ ] Manual staging E2E: expired order → cron → cancelled + email
- [ ] Commit: `feat(orders): cron auto-cancel bank-transfer orders past TTL`

## Success Criteria

- AC-8 passes manually on staging.
- Vercel cron dashboard shows successful invocations every 15 min.
- Idempotency: running cron back-to-back doesn't re-cancel already-cancelled orders.
- Strict scope: COD or paid orders never touched.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cron schedule limit on Vercel plan exceeded | L | M | Project already has 1 cron; adding a 2nd. Verify plan supports ≥2 crons; if not, multiplex through `keep-alive` route. |
| Long-running job exceeds 60s `maxDuration` | L | H | LIMIT=200; loop is O(N) with single update each. ~200 updates × ~50ms ≈ 10s well under cap. |
| Cron auth bypass (missing CRON_SECRET) | M | H | If env missing in prod, route logs warning and rejects unauthenticated calls; deploy-time check via `scripts/check-env-vars.js`. |
| Email failure storm during outage | L | M | Per-order .catch; structured log; no retry queue (acceptable — buyer can re-checkout). |

## Security Considerations

- `CRON_SECRET` required env var. Document in `.env.staging.example` / `.env.production.example` per env-vars rule.
- Public route, but body returns only counts (no order data).

## Next Steps

After ship: monitor Vercel cron dashboard + log volume for 1 week before considering reservation counter feature.
