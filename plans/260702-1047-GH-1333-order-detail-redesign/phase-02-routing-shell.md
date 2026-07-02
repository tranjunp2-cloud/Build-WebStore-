# Phase 02 — Routing + page shell + CSS

**Priority:** P0 · **Status:** todo · **Depends:** 01

## Goal
Replace the right-slide drawer with a full-page route and build the page skeleton:
header + full-width progress + 2-column grid. Port the design's order-detail CSS.

## Design ref
`f36/screen-c-label.jsx` → `LabelScreen`: `.od-page` → `.od-page-head` (back link, title row: h1 +
`.od-id-pill` + `.od-status <cls>` + `.od-date`) → full-width `.od-card.od-progress` (Stepper) →
`.od2` grid (`.od2-main` 65% left, `.od2-side` 35% right). CSS in `design-reference/f36.css`.

## Routing changes
- New: `src/app/(dashboard)/orders/[id]/page.tsx` — server component: auth guard (match orders page),
  render client `OrderDetailView` with `orderId` param.
- `OrdersTable.tsx`: row click → `router.push('/orders/'+id)` (keep `?` back to list). Remove
  `onSelectOrder` drawer toggle (or repurpose to navigation).
- `OrdersClientLayout.tsx`: remove the portal drawer (backdrop + `OrderDetailPanel`) and
  `selectedOrderId` overlay state. Keep list/metrics/filters intact.
- Back link (`.od-back`) → `router.push('/orders')`.

## Page shell (`OrderDetailView` client component)
- Fetch order `GET /api/orders/[id]?depth=2` (reuse existing fetch logic from OrderDetailPanel).
- Loading + not-found states.
- Header: title `Order Details`, `ORD-…` pill, status badge (map `status`→{cls,icon,text} like design
  `statusBadge`), created date.
- Progress card = refactor existing `OrderProgress` stepper (already status-driven) into full-width card;
  add step dates + cancelled state per design `Stepper` (dates optional if not tracked).
- Grid: left `<FulfillmentZone>` + `<OrderItemsCard>` (phase 03/04); right `<CustomerCard>` +
  `<PaymentCard>` + `<OrderActionsCard>` (phase 05).

## CSS integration
- Add order-detail styles to the dashboard stylesheet (find where `--dash-*` tokens + existing order CSS
  live — likely a global `.css` or Tailwind layer). Port `.od-*`, `.od2`, `.action-zone`, `.ship-*`,
  `.tl-*`, `.itab`, `.sched-*`, `.plabel-*`, `.self-deliver`, `.cod-recovery`, `.copyfield`,
  `.courier-preset`, `.wallet`, `.awb-*` from `f36.css`.
- Map design tokens (`--bg-app`, `--fg-1`, `--border-1`, `--success-fg`, etc.) → existing `--dash-*`
  equivalents so it matches current dark theme. Do NOT hardcode a second theme.
- Scope under a root class (e.g. `.od-page`) to avoid leaking.

## Todo
- [ ] `orders/[id]/page.tsx` + `OrderDetailView.tsx` shell
- [ ] Navigate from table row; remove drawer from layout
- [ ] Header + status badge mapping
- [ ] Full-width progress card (reuse stepper)
- [ ] Port + token-map order-detail CSS
- [ ] Responsive: 2-col → 1-col stack on mobile (`m375`/`@media`)

## Success criteria
- Clicking an order opens `/orders/[id]` full page; back returns to list.
- Layout matches design at desktop + stacks on mobile.
- No leftover drawer code / dead state.

## Risks
- URL `?order=` deep-link (old) — preserve by redirecting to `/orders/[id]`.
- Ancestor stacking/overflow from dashboard layout — verify page scrolls correctly.
