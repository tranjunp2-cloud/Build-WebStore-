# Phase 02 — AC-2 + AC-4: Confirm page polls payment status, clears cart on success

## Context

- AC-2: On confirm page, when payment not yet confirmed (Stripe webhook lag), show "Verifying your payment…" skeleton, then auto-flip to the paid/success UI when `paymentStatus` becomes `paid`.
- AC-4 (confirm side): `clearCart()` runs HERE, exactly once, when success is confirmed — the only correct place to clear.
- File: `src/app/sites/[slug]/order/[orderId]/confirm/ConfirmClient.tsx`.

## Priority / status

P2 · pending · ~2h

## Key insights

- ConfirmClient currently reads `order.paymentStatus` from server-side initial props only — no live updates. After Stripe redirect, the webhook (`checkout.session.completed`) may not have fired yet → page shows stale `paymentStatus !== 'paid'`.
- DRY: REUSE existing SSE `/api/orders/stream/[orderNumber]?slug=` (pushes `{status, paymentStatus, terminal}` on change, 5s DB poll, reconnect/heartbeat). ConfirmClient has `order.orderNumber` + `slug` props → can subscribe exactly like `OrderTrackingClient` does. Do NOT build a new 2s-poll endpoint.
- AC says "poll every 2s" — SSE pushes within ≤5s of DB change which meets the intent (auto-flip without manual refresh). If QA strictly requires 2s cadence, fallback option below. Recommend SSE first (KISS/DRY).
- Only Stripe orders need this verifying state. COD = placed immediately; BT = manual proof. Gate the polling to `isStripe && !isPaid`.
- Cart clear: ConfirmClient does NOT currently import `useCartStore`. Add it. Clear when transition to paid is observed (Stripe) — guard so it runs once. For COD/BT, cart was already cleared at CheckoutClient (non-Stripe branch) so do NOT double-handle here; only clear on the Stripe→paid transition.

## Data flow

```
Stripe success redirect → /order/[id]/confirm?session_id=...
  (server) page.tsx loads order (paymentStatus may be 'awaiting_payment')
  → ConfirmClient initial render:
      isStripe && !isPaid  → show "Verifying your payment…" skeleton  [AC-2]
  → mount effect: open EventSource(/api/orders/stream/{orderNumber}?slug=)
      onmessage: if paymentStatus === 'paid'
        → setLivePaymentStatus('paid')  → UI flips to existing paid block  [AC-2]
        → clearCart() once (Stripe path)                                   [AC-4]
        → es.close() (terminal)
  → existing isPaid-driven UI renders unchanged
```

## Requirements

Functional:
1. Track live payment status in state, seeded from `order.paymentStatus`. Derive `isPaid` from the live value, not the static prop.
2. Add a "verifying" UI state shown when `isStripe && !livePaid && status !== 'payment_failed'`: skeleton/spinner block with i18n `verifyingPayment` ("Verifying your payment…"). Replaces the current static Stripe "Confirmed" block while pending.
3. Subscribe to SSE stream on mount, ONLY when `isStripe && !isPaid` initially. Update live state on message; on `paymentStatus === 'paid'` → flip + `clearCart()` once + close stream. On `terminal` (e.g. `payment_failed`) → show failed state (link to retry handled in phase-03 on tracking page) + close.
4. Reuse OrderTrackingClient's EventSource pattern (errorCount cap, close on terminal, cleanup on unmount).
5. clearCart guarded by a ref so it fires exactly once.

Non-functional:
- No polling for COD/BT (avoid needless connections).
- Stream auto-closes; respect 50s reconnect (EventSource handles it).
- SSR-safe: EventSource only in `useEffect` (client).

## Related code files

Modify:
- `src/app/sites/[slug]/order/[orderId]/confirm/ConfirmClient.tsx`
  - import `useCartStore`
  - add `livePaymentStatus` state + SSE effect (gated to Stripe-pending)
  - add "verifying" render branch before the existing Stripe paid block
  - clearCart-once ref on paid transition

Read for context:
- `src/app/sites/[slug]/orders/[orderNumber]/OrderTrackingClient.tsx:425-465` (EventSource pattern to mirror)
- `src/app/api/orders/stream/[orderNumber]/route.ts` (payload shape: `{status, paymentStatus, trackingNumber, terminal}`)
- `src/app/sites/[slug]/order/[orderId]/confirm/page.tsx` (props passed — `order.orderNumber`, `slug` available)

## Implementation steps

1. Add `import { useCartStore } from '@/store/cartStore'`; `const { clearCart } = useCartStore()`.
2. `const [livePay, setLivePay] = useState(order.paymentStatus)`; replace `const isPaid = order.paymentStatus === 'paid'` → `const isPaid = livePay === 'paid'`.
3. Add `const clearedRef = useRef(false)`.
4. SSE effect (mirror OrderTrackingClient), guard `if (!isStripe || isPaid) return` at top using initial values:
   ```ts
   useEffect(() => {
     if (order.paymentMethod === 'cod' || order.paymentMethod === 'bank_transfer') return
     if (order.paymentStatus === 'paid') return
     const es = new EventSource(`/api/orders/stream/${order.orderNumber}?slug=${encodeURIComponent(slug)}`)
     es.onmessage = (e) => { /* parse, setLivePay, on paid → clearCart once + es.close() */ }
     es.onerror = /* errorCount cap, close on terminal */
     return () => es.close()
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [])
   ```
5. Add verifying branch in the Stripe block: when `isStripe && !isPaid && livePay !== 'payment_failed'` render skeleton + `cp.verifyingPayment`; else existing paid block.
6. Compile.

## Todo

- [ ] Live payment-status state seeded from prop
- [ ] SSE subscription gated to Stripe-pending (reuse stream)
- [ ] "Verifying your payment…" skeleton branch (AC-2)
- [ ] Auto-flip to paid block on `paid` message (AC-2)
- [ ] clearCart() once on paid transition (AC-4)
- [ ] payment_failed terminal → non-spinning failed state
- [ ] Compile clean

## Success criteria (measurable)

- Stripe redirect with webhook not yet fired → page shows "Verifying…" (no manual refresh).
- When webhook flips order to paid, UI auto-switches to paid block within ≤5s; cart cleared exactly once.
- COD/BT confirm pages show NO verifying state and open NO EventSource.
- Reload after paid → still paid (no re-clear attempt; cart already empty).

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Webhook never fires → infinite "verifying" | M×M | SSE has reconnect cap; add visible "taking longer than expected — check My Orders" hint after N reconnects (reuse OrderTrackingClient errorCount idea). Document as known edge; retry available on tracking page (phase-03) |
| 2s-cadence QA requirement not met by 5s SSE | L×M | Fallback: client `setInterval(2000)` fetch to existing `/api/orders/track/[orderNumber]?slug=` (returns same shape). Swap only if QA rejects SSE |
| clearCart double-fire (Strict Mode / reconnect) | M×L | `clearedRef` guard + close stream on paid |
| EventSource needs Suspense (search params) | L×L | No searchParams used here; effect-only — safe |

## Rollback

Single-file revert of `ConfirmClient.tsx`. SSE endpoint is pre-existing and untouched. No cascade.

## Security

- Confirm page already gated by `ct_` cookie (`verifyConfirmToken`) server-side. SSE stream is read-only status by orderNumber+slug (same trust level as existing tracking page). No new exposure.

## Next

Runtime-independent of phase-01/03. Needs phase-04 key `cp.verifyingPayment`. payment_failed handling links to phase-03 retry on the tracking page.
