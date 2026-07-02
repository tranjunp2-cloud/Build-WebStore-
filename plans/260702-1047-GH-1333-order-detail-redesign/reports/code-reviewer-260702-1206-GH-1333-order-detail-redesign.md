# Code Review — F36 Order Detail Redesign (GH-1333)

Branch: `feat/1333-F36-easyparcel-delivery` · Read-only review · 2026-07-02

Scope: new `/orders/[id]` full-page route + `_components/detail/*`, self-deliver + pickup API
routes, `Orders.ts` 3 new fields + migration, `cod-block.ts`, i18n, drawer removal.
Build (tsc + next build) and full suite (9211) pass per handoff — this review targets what
build/tests can't catch.

## Verdict: SHIP after fixing the two High items (state-machine ordering + test re-implementation). Everything else is Medium/Low and non-blocking.

---

## Critical
None.

Security posture is sound:
- `/self-deliver` + `/pickup` both wrap `withFeatureGuard('order_management')(withAuth(...))`,
  matching sibling routes. `findByID({ user, overrideAccess: false })` enforces tenant scoping →
  a cross-tenant order returns `null` → 404 before any write. The subsequent
  `payload.update()` without `user` (overrideAccess defaults true) is consistent with
  `create-label`/`cancel` routes (they also update with overrideAccess after the guarded read).
  No cross-tenant write path.
- `labelUrl`/`easyParcelOrderNo` remain `admin.hidden` and are never surfaced to buyers; the
  detail page is behind `orders/layout.tsx` `requirePermission('orders')`.
- `print-label-modal` opens `labelUrl` via `window.open(url, '_blank', 'noopener,noreferrer')`
  and the download anchor sets `rel="noopener noreferrer"` — safe.
- `tracking-timeline` renders `ev.description`/`ev.status` as React text nodes (auto-escaped) —
  no XSS from courier-supplied descriptions.
- Input validation on both routes is explicit (JSON parse guard → 400, required-field → 422,
  slot enum + ISO-date regex on pickup, status gating via `SHIPPABLE_STATUSES`).

---

## High

### H1 — `deriveFulfillState` branch ordering hides the "Confirm order" CTA for EP-off pending orders
`src/app/(dashboard)/orders/_components/detail/fulfillment-zone.tsx:105`

The `!epEnabled || !hasCourier → self-delivery` branch (line 105) runs **before** the
`pending`/`new` branch (line 127). Consequence: a `pending` (unconfirmed, often unpaid COD)
order in a tenant with EasyParcel disabled or no courier selected renders the
**self-delivery ship form** (courier dropdown + "Ship order" button) instead of the
"Awaiting confirmation → Confirm order" pending zone.

Impact: merchant is presented a "ship" action on an order that hasn't been confirmed/paid.
The backend `SHIPPABLE_STATUSES` gate (confirmed/ready_to_ship) will 422 the actual POST, so
no invalid data is written — but the UI is wrong and confusing, and the merchant loses the
confirm entry point on that zone. Common case for COD-only merchants not using EP.

Fix: move the pending/new check above the EP-config branch:
```ts
if (status === 'cancelled' || status === 'refunded') return 'cancelled'
if (status === 'completed') return 'completed'
if (selfDeliveryCourier && status === 'shipped') return 'self-shipped'
if (status === 'shipped') return 'shipping'
if (awbNo && status === 'ready_to_ship') return 'success'
if (status === 'pending' || status === 'new') return 'pending'   // ← hoist here
// ...then EP-config / self-delivery branch
```
Add a regression test: pending + `tenant.easyParcelIntegration.enabled=false` → `pending`.

### H2 — State-machine unit test re-implements source logic instead of importing it
`src/__tests__/unit/orders/fulfillment-zone-state.test.ts:47-89`

`deriveFulfillState` is copy-pasted into the test file (the file even says "This extracts…").
This violates the project testing rule (`testing.md`: "Import from source — NEVER re-implement
logic in tests"). The 18 TC-F36.F* tests validate a *copy*; the source function can diverge
(e.g. the H1 ordering bug) and the suite stays green — which is exactly what happened (no test
catches H1 because the copy has the same ordering).

Fix: `export function deriveFulfillState` from `fulfillment-zone.tsx` and import it in the test.
Delete the inline copy. This both restores the guarantee and makes H1 test-catchable.

---

## Medium

### M1 — User-facing English hardcoded in several new components (i18n gap)
en/ms key parity is perfect (0 keys diverge), but several new user-visible strings bypass i18n:
- `order-detail-view.tsx:34-51` — `getStatusBadge` text: "Completed", "Shipping",
  "Ready to ship", "Pending", "Payment failed", "Refunded", "Cancelled" all hardcoded.
- `order-detail-view.tsx:109-113,132` — not-found view ("Order not found", "The order … does
  not exist or you do not have access", "Back to orders") and the "Order Details" title / card
  captions ("Order Progress", "Shipping Fulfillment", "Order Items") are literals.
- `fulfillment-zone.tsx:305,310-311,324` — COD-blocked zone: "Ready to Ship", "COD unavailable
  for this destination", "EasyParcel only supports COD in West Malaysia…" hardcoded.
- `fulfillment-zone.tsx:193` + `schedule-pickup-popover.tsx:73` — "Morning (08:00–12:00)" /
  "Afternoon (13:00–18:00)" slot labels hardcoded (and duplicated across two files).
- `fulfillment-zone.tsx:417,513` — `'Courier'` fallback.

MS users will see English for these. Move to `t.dashboard.orders.*` keys (the rest of the
feature is already fully keyed, so this is an oversight, not a pattern gap).

### M2 — `onUpdate` triggers both `fetchOrder()` and `router.refresh()` (double network work)
`order-detail-view.tsx:162,200,212`

Every mutation callback runs `() => { fetchOrder(); router.refresh() }`. `fetchOrder` re-pulls
the order client-side (correct); `router.refresh()` re-renders server components (needed only
for the sidebar pending-badge). Both fire on every action — a client refetch + a full RSC
round-trip. Functionally fine, but on slower connections the label/ship flows double up. The
drawer previously only called `refreshAfterMutation` (which already does `router.refresh`).
Consider dropping `fetchOrder()` where `router.refresh()` alone suffices, or vice-versa.
Non-blocking.

### M3 — `handleConfirmOrder` useCallback omits `f`/`t` from deps (stale i18n closure)
`fulfillment-zone.tsx:198-217`

Deps are `[order.id, onUpdate]` but the body reads `f.orderConfirmed` / `f.confirmFailed`
(derived from `t`). If the user switches locale while on the page, the toast could show the
previous locale's string. Edge case; add `f` (or the specific strings) to deps, or inline them.

### M4 — Pickup route accepts any past date; UI prevents it but API doesn't
`src/app/api/orders/[id]/pickup/route.ts:46`

`ISO_DATE_RE` validates *shape* only. The popover blocks past dates (`min`, cutoff logic), but
a direct API caller can POST `scheduledAt` in the past. Low real-world impact (local-only field,
display), but the server is the trust boundary — consider rejecting dates before `today`.

---

## Low / Nit

- **L1** `order-actions-card.tsx:33` `PRE_COLLECT` set contains both `undefined` and `null` plus
  `''` — then `PRE_COLLECT.has(epTrackingStatus as never)`. Works, but the `as never` cast is a
  smell; a `!epTrackingStatus || ['order_created','pending_pickup'].includes(...)` guard reads
  clearer.
- **L2** `order-detail-view.tsx:121,182,183,209,210` — multiple `(order as unknown as …)` casts
  for `createdAt`, `codAmount`, `notes`, `awbNo`, `shippingTrackingStatus`. All are real fields
  present at `?depth=2`, so no runtime undefined risk (each uses `?? null`). Acceptable given no
  generated Payload types (tracked in OPEN_BLOCKERS), but a shared `RawOrder` interface would
  beat scattering casts.
- **L3** `tracking-timeline.tsx:74` uses array index `i` as React `key`. Events are append-mostly
  and sorted each render; if two events share a timestamp the sort isn't stable. Prefer
  `${ev.status}-${ev.eventTime}-${i}` if events can reorder.
- **L4** `schedule-pickup-popover.tsx:9` `HOLIDAYS = ['2026-06-25']` is a hardcoded single past
  date — will silently go stale. Fine for v1 (informational), but flag for a real holiday source.
- **L5** `create-label-flow.tsx:43` cosmetic `setTimeout(1400ms)` → `paying`. If the real POST
  resolves in <1.4s the timer is cleared (good), but if the component unmounts mid-flight (user
  navigates back) the timer isn't cleared on unmount → `setState` on unmounted component warning.
  Minor; wrap in a ref + cleanup if it surfaces in console.
- **L6** `OrdersTable.tsx` still receives `onSelectOrder`/`selectedOrderId` props (now dead in the
  new nav model) — `navigateToOrder` calls both `router.push` and the legacy callback. Harmless
  dead path; remove props on a later cleanup pass.
- **L7** `OrdersClientLayout.tsx:19` legacy `?order=<id>` redirect renders the full table for one
  frame before `router.replace`. Acceptable (deep-link only), but a flash exists.

---

## Positive
- Backend routes mirror the established `withFeatureGuard → withAuth → findByID(overrideAccess:false)`
  pattern precisely; the deliberate `SHIPPABLE_STATUSES` exemption from `ORDER_STATUS_TRANSITIONS`
  is well-documented (fulfillment-zone route comment) and correctly does NOT weaken the shared
  transition table.
- Migration is additive, matches db-setup style, and `check-migrations.js origin/staging` passes
  (verified — all 3 new columns detected).
- Drawer removal is clean: portal + all drawer state gone, no dangling refs, `?order=` handled.
- `cod-block.ts` is a pure, well-guarded function reused consistently (fulfillment-zone +
  customer-card) — single source of truth for COD-block logic.
- `codAmount` sen→RM (`/100`) and `discountAmount` sen→RM conversions are correct and consistent
  across fulfillment-zone (`fmtMYR(codAmount/100)`) and order-items-card (`discountAmount/100`).
- Portals (payment-proof lightbox) clean up their Escape-key listener on unmount; schedule
  popover cleans up its `mousedown` listener.

---

## Unresolved questions
1. H1: is EP-off + pending a real state in prod (COD-only merchants), or are all orders EP-enabled
   by the time they reach `pending`? If the former, H1 is user-visible; confirm with PM.
2. M4: should pickup `scheduledAt` reject past dates server-side, or is client-side enough given
   it's a local display-only field?

**Status:** DONE_WITH_CONCERNS
**Summary:** F36 redesign is secure and well-structured; ship after fixing H1 (state-machine
branch ordering hides Confirm CTA for EP-off pending orders) and H2 (state test re-implements
source instead of importing). Medium i18n gap (hardcoded English in status badge / COD-blocked /
not-found views) should follow.
**Concerns/Blockers:** H1 is a correctness/UX bug reachable in prod; H2 means current tests can't
catch it. Both are small fixes.
