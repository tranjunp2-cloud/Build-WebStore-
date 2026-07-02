# Phase 01 — Schema + backend foundations

**Priority:** P0 (blocks Phase 03) · **Status:** todo

## Goal
Add the DB fields + API endpoints the new design needs that don't exist yet:
self-delivery (manual courier), persisted pickup schedule, and a COD-block flag surfaced to the client.

## Backend inventory (from survey)
- EXISTS: `POST /orders/[id]/create-label` (single-step, returns `{awbNo, trackingNumber, labelUrl}`, PDF),
  accepts optional `collectionDate` + `parcelWeightGrams` in body.
- EXISTS: `shippingTrackingHistory[]` (`{status, description, eventTime}`) + `shippingTrackingStatus`
  (13 values) synced by cron `src/lib/jobs/sync-tracking.ts`.
- EXISTS: `EAST_MY_STATES` in `src/lib/shipping/constants.ts`.
- MISSING: manual/self-delivery courier metadata; persisted pickup date/slot.

## Schema changes — `src/collections/Orders.ts`
Add near existing EP fields (~line 468):
- `selfDeliveryCourier` — text, admin desc "Manual courier name when EasyParcel not used"
- `pickupScheduledAt` — date (readOnly-ish), admin desc "Chosen courier pickup date/slot"
- `pickupSlot` — text (e.g. `am`/`pm`) — optional; or fold label into `pickupScheduledAt`

Follow schema rule:
- Add matching columns to `scripts/db-setup.js` MIGRATIONS (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN` pattern used elsewhere — copy style of an existing text/date column migration).
- Ensure `scripts/check-migrations.js` passes (`node scripts/check-migrations.js`).
- Never DROP; additive only.

## New API routes
### `POST /orders/[id]/self-deliver`
Body `{ courier: string, trackingNumber: string }`. Auth = same guard as other order routes.
- Validate order is in a shippable status (`confirmed`/`ready_to_ship`), not terminal.
- Set `selfDeliveryCourier`, `trackingNumber`, `shippingTrackingStatus='pending_pickup'` (or leave null),
  flip `status='shipped'`. Return updated `{status, selfDeliveryCourier, trackingNumber}`.
- Reuse the status-transition + toast conventions from existing PATCH route.

### `POST /orders/[id]/pickup` (schedule pickup — lightweight)
Body `{ scheduledAt: ISO, slot?: 'am'|'pm' }`. Persist `pickupScheduledAt` (+ `pickupSlot`).
Informational only (no EP call). Return the saved value.

## COD-block flag
Add a derived boolean to the single-order GET response (or compute client-side).
Prefer a small helper `isCodBlocked(order)` in `src/lib/shipping/` reused by client:
`codAmount>0 && EAST_MY_STATES.includes(shippingAddress.state)`.
Expose `shippingAddress.state` (already present). If computing server-side, add `codBlocked` to GET payload.

## Todo
- [ ] Add `selfDeliveryCourier`, `pickupScheduledAt`, `pickupSlot` to `Orders.ts`
- [ ] Add migrations to `db-setup.js`; run `check-migrations.js` green
- [ ] `POST /orders/[id]/self-deliver/route.ts`
- [ ] `POST /orders/[id]/pickup/route.ts`
- [ ] `isCodBlocked()` helper (+ optional `codBlocked` in GET response)
- [ ] `npm run build` / typecheck passes

## Success criteria
- New columns migrate cleanly; CI schema gate passes.
- New endpoints work end-to-end (manual test via curl or REST client).
- No regression to existing create-label / cancel / refund routes.

## Risks
- EP may not support post-label pickup reschedule → keep `/pickup` local-only (documented).
- Status-transition validation must match `src/lib/orders/status-groups.ts` — reuse, don't reinvent.

## Ownership (atomic)
Schema + db-setup + check-migrations edited together by ONE agent (per orchestration rule).
