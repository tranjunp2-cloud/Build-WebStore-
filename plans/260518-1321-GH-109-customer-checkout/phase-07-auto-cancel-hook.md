# Phase 07 — Auto-Cancel TTL Hook

**Status:** pending | **Effort:** 1.5h | **Owner:** fullstack-developer | **Blocks:** Phase 01

## Overview
No cron infra available — use Payload `afterRead` (lazy) + `afterOperation` (eager on order list/read) hooks to detect expired BT orders and auto-cancel them. Strategy: every time an order with status='awaiting_payment' is read or listed, if `paymentExpiresAt < now`, cancel it inline (idempotent + side-effect-safe).

## Related code files
- Modify: `src/collections/Orders.ts` (add hooks)
- Create: `src/lib/orders/auto-cancel-expired.ts` — pure function `maybeAutoCancel(payload, order)`
- Optional: `src/app/api/cron/cancel-expired-orders/route.ts` — manual sweep endpoint (Vercel cron or admin button)

## Hook design — "check at read time"

### Why this works
- Customer hitting post-order magic-link page → triggers afterRead → expired order auto-cancels before render.
- Seller listing pending_verification queue → afterRead on each row → no expired rows leak through.
- No background worker, no extra infra (per user decision).

### Tradeoff (documented)
- Order can technically remain 'awaiting_payment' in DB until someone reads it.
- Acceptable because: (a) customer cannot place dependent action while expired, (b) admin queue auto-flushes on view, (c) optional manual sweep endpoint covers stale rows.

## Implementation

### `src/lib/orders/auto-cancel-expired.ts`
```ts
export async function maybeAutoCancelExpiredBT(payload, order) {
  if (order.status !== 'awaiting_payment') return order
  if (!order.paymentExpiresAt) return order
  if (new Date(order.paymentExpiresAt).getTime() > Date.now()) return order
  // Race-safe: re-fetch + transition guard inside update
  const updated = await payload.update({
    collection: 'orders',
    id: order.id,
    data: {
      status: 'cancelled',
      cancelReason: 'Payment deadline exceeded (auto-cancel)',
    },
    overrideAccess: true,
  })
  // Fire-and-forget customer notification (optional)
  return updated
}
```

### Orders.ts hook wiring
```ts
hooks: {
  afterRead: [
    async ({ doc, req }) => {
      if (!doc || !req?.payload) return doc
      // Avoid recursion: skip if already cancelled or non-BT
      if (doc.status !== 'awaiting_payment') return doc
      const { maybeAutoCancelExpiredBT } = await import('@/lib/orders/auto-cancel-expired')
      return maybeAutoCancelExpiredBT(req.payload, doc).catch(() => doc)
    },
  ],
}
```

### Guards
- Don't run during `payload.update` itself (would recurse). Detect via `req.context?.skipAutoCancel = true` set inside `maybeAutoCancelExpiredBT`.
- Don't run in collection `afterChange` (avoids loops during create).
- Disable via env: `if (process.env.DISABLE_BT_AUTO_CANCEL === '1') return doc`.

## Manual sweep endpoint (optional, recommended)
`POST /api/cron/cancel-expired-orders` — admin/superadmin only.
- Query: `payload.find({ collection: 'orders', where: { status: { equals: 'awaiting_payment' }, paymentExpiresAt: { less_than: new Date().toISOString() } }, limit: 500 })`.
- Loop + maybeAutoCancelExpiredBT each.
- Return summary `{ cancelled: N }`.
- Use case: Vercel cron OR admin "force sweep" button.

## Implementation steps
1. Create `src/lib/orders/auto-cancel-expired.ts`.
2. Wire `afterRead` hook in `Orders.ts` with recursion guard + env flag.
3. Create manual sweep endpoint with admin access guard.
4. Verify guard: read a BT order with passed expiry → status flips, second read no-ops.

## Edge cases
- Two parallel reads → both try to update. Second update succeeds with no-op (status already 'cancelled'); transition validation passes only first time. Wrap in try/catch + treat "invalid transition" as success.
- Customer just uploaded proof at expiry boundary → race possible: status='pending_verification' won't auto-cancel (guard fails on first check). Safe.
- Seller approve race vs auto-cancel → approve checks status='pending_verification' (Phase 06); auto-cancel checks status='awaiting_payment'. No overlap unless reject just happened. Acceptable.

## Todo list
- [ ] Create auto-cancel-expired.ts helper
- [ ] Wire afterRead hook in Orders.ts
- [ ] Add env-flag bypass DISABLE_BT_AUTO_CANCEL
- [ ] Create manual sweep endpoint
- [ ] Verify recursion guard with manual test

## Success criteria
- Read BT order with `paymentExpiresAt < now` → returned doc has status='cancelled'.
- DB row updated (verifiable via psql).
- Subsequent reads no-op (idempotent).
- `DISABLE_BT_AUTO_CANCEL=1` skips behavior cleanly.

## Risk
- afterRead hooks run on every read — small perf cost. Mitigation: status guard at top exits in ~1ns for non-BT.
- Stale orders never read remain in DB — covered by manual sweep + acceptable per user decision (no infra).
