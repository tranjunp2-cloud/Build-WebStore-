# Phase 05 — Right column + tracking timeline

**Priority:** P1 · **Status:** todo · **Depends:** 02

## Goal
Build the right 35% column (`.od2-side`) and the shared tracking timeline used by the
shipping/completed fulfillment states.
Design ref: `f36/screen-c-label.jsx` → right column (Customer / Payment / Order Actions cards) +
`ActionZone` shipping/completed branch (`.track-timeline`, `.tl-*`).

## Right column cards (`.od-card`)
- `customer-card.tsx`: Name, Phone, Email, Address (InfoRow with icons per design). COD-block →
  `.od-region .region-badge.blocked` when `isCodBlocked`. Notes row if `order.notes`/`customerNote`.
- `payment-card.tsx`: Method (map via existing `fmtPaymentMethod`/xendit label), Status
  (paid/awaiting/COD colors). Reuse logic from current `PaymentInformation`.
- `order-actions-card.tsx`: shown only for non-terminal, pre-ship states → Cancel order button
  (opens existing `CancelOrderModal`) + note. Refund button for shipped/completed (reuse existing
  `handleRefund` → `POST /orders/[id]/refund`).
- Keep `ManualPaymentVerificationBlock` (BT proof) — render in right column or above grid when
  `paymentMethod=bank_transfer && paymentStatus in [pending_verification, paid]` (preserve current behavior).

## Tracking timeline
- `tracking-timeline.tsx` — render `order.shippingTrackingHistory[]` (`{status, description, eventTime}`)
  as `.track-timeline`/`.tl-row` (dot, title, date, note), newest first; mark latest as `live`/`last`.
- Map status → friendly label via existing `src/lib/shipping/easyparcel/status-map.ts`.
- Shown in fulfillment zone for `shipping`/`completed` (phase 03 imports this), + AWB + Print + Track link.
- Empty history → minimal "awaiting first update" note.

## Todo
- [ ] customer-card (+ COD region badge, notes)
- [ ] payment-card (reuse method/status formatting)
- [ ] order-actions-card (cancel + refund, conditional)
- [ ] preserve BT verification block
- [ ] tracking-timeline from real `shippingTrackingHistory`
- [ ] port InfoRow + icons (reuse existing SVG icons from OrderDetailPanel)

## Success criteria
- Right column matches design; cancel/refund work as before.
- Timeline reflects real synced tracking events with correct labels/order.

## Risks
- `shippingTrackingHistory` event ordering — sort by `eventTime` desc explicitly.
- Notes field name — confirm actual field on Orders collection.
