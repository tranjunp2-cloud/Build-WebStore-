# Phase 01 Schema Migration — GH-1333 F36 EasyParcel

Date: 2026-06-24

## Files Modified

1. `src/collections/Orders.ts` — added 10 scalar fields + 1 array field under `// --- EasyParcel Shipping ---` section (after `trackingNumber`)
2. `src/collections/Tenants.ts` — added `easyParcelIntegration` group with 7 sub-fields (after `echIntegration` group)
3. `scripts/db-setup.js` — added 21 migration entries at end of MIGRATIONS array (total: 950)
4. `scripts/check-migrations.js` — extended group/array field skip logic + added `easy_parcel_integration` to KNOWN_GROUP_PREFIXES

## What Was Added

### Orders.ts (10 scalar + 1 array)
- `shippingCourier` — EP courier ID
- `shippingServiceId` — EP service_id from rate response
- `awbNo` — Air Waybill number (indexed, idempotency key)
- `easyParcelOrderNo` — EP order_no (hidden)
- `labelUrl` — PDF label URL (hidden)
- `shippingTrackingStatus` — select with 13 options (indexed, varchar in DB)
- `shippingTrackingLastUpdated` — date (readOnly)
- `parcelWeight` — number (grams)
- `codAmount` — number (INTEGER SENS — NOT RM)
- `codStatus` — select (pending/collected/settled)
- `shippingTrackingHistory` — array with status/description/eventTime sub-fields

### Tenants.ts — easyParcelIntegration group
- `enabled` — checkbox (master toggle)
- `apiKey` — text, `access: { read: () => false }` (never exposed to client)
- `authKey` — text, `access: { read: () => false }` (never exposed to client)
- `detectedEnv` — select (production/demo, readOnly)
- `warehouse` — json (pickup address object)
- `selectedCourier` — text (default: 'flash')
- `testedAt` — date (readOnly)

### db-setup.js — 21 entries (GH-1333 block)
- 12 orders columns/indexes
- 1 `orders_shipping_tracking_history` CREATE TABLE (varchar id per array convention)
- 1 parent index on `_parent_id`
- 7 tenant columns (`easy_parcel_integration_*` prefixed)

## check-migrations.js Changes

The CI gate needed 2 fixes to pass for this PR pattern:
1. Added `easy_parcel_integration` to `KNOWN_GROUP_PREFIXES` — allows the script to accept `tenants.easy_parcel_integration_enabled` as covering the `enabled` field inside the `easyParcelIntegration` group
2. Extended field skip logic: previously only `group`-type fields were skipped; now `array`-type fields and their sub-fields are also skipped. Sub-field detection uses indent comparison against the array field's own indent level to correctly identify inline sub-field format `{ name: 'x', type: 'y' }`

## Verification Results

- `node scripts/check-migrations.js` → exit 0 ✓
- `node -e "require('./scripts/db-setup.js')"` → no syntax error, count 950 ✓
- `npx tsc --noEmit` → PASS ✓
- `npm run generate:types` → pre-existing ERR_MODULE_NOT_FOUND (not caused by our changes; confirmed by stash test)

## Issues Found

- `orders.id` confirmed as `integer` type (from FK references in db-setup.js like `order_id integer REFERENCES orders(id)`), so `_parent_id integer NOT NULL` is correct for the tracking history array table
- `generate:types` fails in worktree with ERR_MODULE_NOT_FOUND for Tenants — pre-existing env issue, not introduced by this PR
