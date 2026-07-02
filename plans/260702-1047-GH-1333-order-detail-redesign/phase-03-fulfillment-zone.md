# Phase 03 — Shipping Fulfillment Zone (left column)

**Priority:** P0 (core feature) · **Status:** todo · **Depends:** 01, 02

## Goal
Build `<FulfillmentZone>` = design `ActionZone` with ALL states, wired to real APIs.
Design ref: `f36/screen-c-label.jsx` (`ActionZone`, `SchedulePickupPopover`, `SelfDeliveryZone`,
`CodRecovery`, `PrintLabelModal`, `ShipSteps`, `CourierPreset`, `WalletLine`).

## State machine (derive from order, not mock)
| Design state | Trigger (real) | Action |
|---|---|---|
| `pending` (COD awaiting) | `status in [pending,new]` | **Confirm order** → PATCH status `confirmed` |
| `ready` (confirmed, EP on + courier) | `status=confirmed && epEnabled && hasCourier && !awbNo` | **Ready to Ship** → `POST create-label` |
| `submitting`/`paying` | transient during create-label | staged spinner (single API call; show 2 phases cosmetically or one spinner) |
| `success` | `awbNo && status=ready_to_ship` | AWB copyfield + Print label + Schedule pickup |
| `shipping` | `status=shipped` (EP) | tracking timeline (phase 05 shares timeline) |
| `completed` | `status=completed` | delivered timeline |
| `cancelled` | `status=cancelled` | cancelled banner |
| `cod-blocked` | `isCodBlocked(order)` (phase 01 helper) | `<CodRecovery>` |
| `missing-data` | confirmed + EP on + no `parcelWeight` | weight form → then create-label |
| `self-delivery` | `!epEnabled || !hasCourier`, not yet shipped | `<SelfDeliveryZone>` form |
| `self-shipped` | `selfDeliveryCourier && status=shipped` | locked read-only card |

Reuse existing config resolution from `OrderDetailPanel.ActionButtons` (tenantEp, epEnabled, hasCourier).

## Sub-components (each < 200 lines, kebab-case files under `_components/detail/`)
- `fulfillment-zone.tsx` — state router.
- `create-label-flow.tsx` — courier preset + wallet line + CTA; calls `create-label`; staged UI.
  (Wallet balance: only if API returns it; else show cost only / omit balance.)
- `schedule-pickup-popover.tsx` — port design popover (date Today/Tomorrow/other with Sun+holiday
  disable, cut-off logic; am/pm slots). On confirm → `POST /orders/[id]/pickup`.
- `print-label-modal.tsx` — preview + open/download/print of `labelUrl` PDF. A4/A6 toggle informational.
- `self-delivery-zone.tsx` — courier select + AWB input → `POST /orders/[id]/self-deliver`;
  locked state when already shipped manually.
- `cod-recovery.tsx` — "Ship manually" (→ self-deliver). "Re-pick EP prepaid" = disabled/"coming soon"
  (flagged out of scope v1).
- `missing-weight-form.tsx` — weight input → passes `parcelWeightGrams` to create-label.
- Reuse `CancelOrderModal` (existing) for cancel; refund handled in right column actions/phase 05.

## API wiring
- Confirm/ready/complete → existing `PATCH /orders/[id]`.
- Create label → existing `POST /orders/[id]/create-label` (+ `parcelWeightGrams`, `collectionDate`).
  Handle errors: `WALLET_LOW`→top-up state, `EP_NOT_READY`/`MISSING_*`→missing-data.
- Self-deliver / pickup → new endpoints (phase 01).
- On success re-fetch order (parent `onUpdate`).

## Todo
- [ ] fulfillment-zone state router from real order
- [ ] create-label flow (ready → submitting → success) + error states (wallet-low)
- [ ] schedule-pickup popover + `/pickup` wiring
- [ ] print-label modal (PDF)
- [ ] self-delivery form + `/self-deliver` wiring + locked state
- [ ] cod-recovery (manual path only)
- [ ] missing-weight form → create-label
- [ ] copyfield (AWB copy), courier logo tiles (port from atoms `CourierLogo`/`COURIERS`)

## Success criteria
- Each real order status renders the correct zone with working actions.
- No mock data; all buttons hit real endpoints and re-fetch.

## Risks
- Design shows 2-step reserve/charge; backend is single-step → present as one action (don't fake 2 calls).
- Wallet balance not in current API → show cost only unless balance endpoint exists.
