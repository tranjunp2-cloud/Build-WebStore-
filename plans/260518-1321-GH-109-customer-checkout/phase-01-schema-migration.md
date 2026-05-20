# Phase 01 — Schema Migration

**Status:** pending | **Effort:** 1.5h | **Owner:** fullstack-developer | **Blocks:** —

## Overview
Add new status enums, `paymentExpiresAt`, `paymentRejectReason`, `paymentVerifiedAt`, `paymentVerifiedBy` fields to Orders collection + matching `scripts/db-setup.js` migrations. Update `ORDER_STATUS_TRANSITIONS` to model BT flow.

## Related code files
- Modify: `src/collections/Orders.ts`
- Modify: `scripts/db-setup.js` (append entries to MIGRATIONS array)
- Verify: `scripts/check-migrations.js` passes against `origin/staging`

## Data model changes

### `status` enum (add 3 values; preserve existing)
Existing: pending, confirmed, ready_to_ship, shipped, completed, cancelled, refunded, paid, payment_failed, processing.
Add: `unpaid` (COD placed), `awaiting_payment` (BT placed, no proof), `pending_verification` (BT proof uploaded, awaiting seller).

### New columns on `orders` table
| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `payment_expires_at` | timestamp | yes | null | BT TTL; auto-cancel after this |
| `payment_reject_reason` | varchar | yes | null | Enum: insufficient_amount, wrong_reference, illegible_proof, other |
| `payment_reject_note` | text | yes | null | Free-text when reason=other |
| `payment_verified_at` | timestamp | yes | null | Seller approve timestamp |
| `payment_verified_by_id` | integer (FK users) | yes | null | Seller who approved |

### `ORDER_STATUS_TRANSITIONS` updates
```
unpaid: ['confirmed', 'cancelled']
awaiting_payment: ['pending_verification', 'cancelled']
pending_verification: ['confirmed', 'awaiting_payment', 'cancelled']  // approve → confirmed; reject → awaiting_payment
```

## Implementation steps
1. Open `src/collections/Orders.ts`. Append new `status` options (after 'refunded'): `unpaid`, `awaiting_payment`, `pending_verification`.
2. Add 5 new fields under `// --- Payment ---` section using Payload field types (`date`, `select` for reason, `textarea`, `date`, `relationship` to users).
3. Update `ORDER_STATUS_TRANSITIONS` map with new keys + add `pending_verification` transitions.
4. Add `paymentRejectReason` select options: `insufficient_amount`, `wrong_reference`, `illegible_proof`, `expired`, `other`.
5. Open `scripts/db-setup.js`. Append migration entries (ALTER TABLE ADD COLUMN IF NOT EXISTS pattern):
   - `orders.payment_expires_at` → `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_expires_at timestamp;`
   - `orders.payment_reject_reason` → varchar
   - `orders.payment_reject_note` → text
   - `orders.payment_verified_at` → timestamp
   - `orders.payment_verified_by_id` → integer
   - Add index: `orders.payment_expires_at_idx` → `CREATE INDEX IF NOT EXISTS orders_payment_expires_at_idx ON orders(payment_expires_at) WHERE payment_expires_at IS NOT NULL;`
6. Run `node scripts/check-migrations.js origin/staging` — must pass.
7. Run `npx payload generate:types` locally to refresh `payload-types.ts`.

## Todo list
- [ ] Add 3 status enum values to Orders.ts
- [ ] Add 5 payment fields to Orders.ts
- [ ] Update ORDER_STATUS_TRANSITIONS
- [ ] Append 6 entries to db-setup.js MIGRATIONS
- [ ] Run check-migrations.js
- [ ] Regenerate payload-types.ts
- [ ] Commit: `feat(F10): add bank transfer status + TTL fields to orders`

## Success criteria
- `node scripts/check-migrations.js origin/staging` exits 0.
- `npm run build` compiles (no TS errors from new fields).
- New columns visible in Neon dev DB after running `node scripts/db-setup.js --migrate-only`.

## Risk
- Forgot index on `payment_expires_at` → auto-cancel query full-table-scans. Mitigated by partial index.
- Reusing existing `paymentReference` field for BT-XXXXXX — confirm no collision with Stripe usage (only set when stripeSessionId present).
