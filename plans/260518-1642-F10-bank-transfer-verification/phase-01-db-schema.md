# Phase 01 — DB Schema + Orders Collection

## Context Links

- PRD §13.2, §13.3 — Data Models + Schema migration plan
- Rule: `.claude/rules/database-schema.md` — Drizzle naming, ALTER IF NOT EXISTS, no DROP
- Existing schema: `src/collections/Orders.ts`, `scripts/db-setup.js` (lines ~231–270, 3810–3812)

## Overview

- **Priority:** P0 (blocker for all downstream phases)
- **Status:** pending
- **Description:** Add 8 new fields + 2 enum extensions for v2.2 Bank Transfer lifecycle, rename `qr_banking` → `bank_transfer` (additive — keep both during transition).

## Key Insights

- Project uses Payload Drizzle auto-generated tables; columns added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `scripts/db-setup.js` MIGRATIONS array (CI hard-gates via `scripts/check-migrations.js`).
- Enums in Payload `select` field are runtime-validated; DB column is plain `varchar` → enum extensions need only Payload-side option additions + optional CHECK constraint (project pattern omits CHECK — keep consistent).
- `paymentReference` unique per tenant — uniqueness handled at app layer (generate-and-retry) since Drizzle composite unique index is more invasive; document collision odds (36^6 = 2.1B). Optional partial unique index on `(tenant_id, payment_reference)` is nice-to-have, NOT required for ship.
- D-13 Wave 8+ pre-build columns (`verificationSource`, `autoVerifiedAt`, `bankTransactionId`) included now to avoid future migration.

## Requirements

### Functional

- Add columns: `payment_reference varchar`, `payment_expires_at timestamp`, `payment_rejection_reason varchar`, `payment_rejection_detail text`, `payment_verified_at timestamp`, `payment_verified_by integer` (FK→users), `magic_link_secret varchar`, `verification_source varchar DEFAULT 'manual'`, `auto_verified_at timestamp`, `bank_transaction_id varchar`.
- `paymentStatus` options extend: add `awaiting_payment`, `pending_verification`.
- `paymentMethod` options extend: add `bank_transfer` (keep `qr_banking` for backcompat).
- `paymentRejectionReason` enum options: `image_blurry`, `wrong_amount`, `duplicate_order`, `other`.
- Data backfill: rows with `payment_method='qr_banking'` → set `payment_method='bank_transfer'` IF created within last 7 days AND `payment_status NOT IN ('paid','cancelled','refunded')` (conservative; old paid orders untouched for audit).
- Index: `orders_payment_expires_at_idx` on `payment_expires_at` (cron query perf).

### Non-Functional

- Migration idempotent (re-runnable, IF NOT EXISTS everywhere).
- No `DROP TABLE` / no destructive change.
- `scripts/check-migrations.js origin/staging` passes locally before PR.

## Architecture

Single migration block appended to `MIGRATIONS` array in `scripts/db-setup.js`. Collection schema updated in lockstep so Payload doesn't reject reads/writes for new fields.

```
scripts/db-setup.js MIGRATIONS  ─┐
                                 ├─► applied at vercel build / docker boot
src/collections/Orders.ts        ─┘  (Payload validates incoming docs)
```

## Related Code Files

- **Modify:** `src/collections/Orders.ts` (add fields + extend enums + extend `ORDER_STATUS_TRANSITIONS` notes for paymentStatus side-effects in `beforeChange`)
- **Modify:** `scripts/db-setup.js` (append migrations)
- **Create:** none
- **Delete:** none

## Implementation Steps

1. Append to `MIGRATIONS` in `scripts/db-setup.js` (after `orders.payment_status_idx` line ~3812):
   ```js
   { name: 'orders.payment_reference', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference varchar;` },
   { name: 'orders.payment_reference_idx', sql: `CREATE INDEX IF NOT EXISTS orders_payment_reference_idx ON orders (payment_reference);` },
   { name: 'orders.payment_expires_at', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_expires_at timestamp;` },
   { name: 'orders.payment_expires_at_idx', sql: `CREATE INDEX IF NOT EXISTS orders_payment_expires_at_idx ON orders (payment_expires_at);` },
   { name: 'orders.payment_rejection_reason', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_rejection_reason varchar;` },
   { name: 'orders.payment_rejection_detail', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_rejection_detail text;` },
   { name: 'orders.payment_verified_at', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_verified_at timestamp;` },
   { name: 'orders.payment_verified_by_id', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_verified_by_id integer;` },
   { name: 'orders.magic_link_secret', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS magic_link_secret varchar;` },
   { name: 'orders.verification_source', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS verification_source varchar DEFAULT 'manual';` },
   { name: 'orders.auto_verified_at', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_verified_at timestamp;` },
   { name: 'orders.bank_transaction_id', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS bank_transaction_id varchar;` },
   { name: 'orders.backfill_bank_transfer_method', sql: `UPDATE orders SET payment_method='bank_transfer' WHERE payment_method='qr_banking' AND payment_status NOT IN ('paid','cancelled','refunded') AND created_at > NOW() - INTERVAL '7 days';` },
   ```
   Naming convention: payload-Drizzle uses snake_case + `_id` suffix for relations (see existing `stripe_session_id`, `payment_proof_image_id`). Confirmed.
2. Update `src/collections/Orders.ts`:
   - In `paymentStatus.options`, add `{ label: 'Awaiting Payment', value: 'awaiting_payment' }`, `{ label: 'Pending Verification', value: 'pending_verification' }`.
   - In `paymentMethod.options`, add `{ label: 'Bank Transfer', value: 'bank_transfer' }`. Mark `qr_banking` label as `'QR Banking (legacy)'`.
   - Add new fields after `paymentReference`:
     ```ts
     { name: 'paymentExpiresAt', type: 'date', admin: { readOnly: true, description: 'BT order TTL — auto-cancel after this timestamp' } },
     { name: 'paymentRejectionReason', type: 'select', options: [
         { label: 'Ảnh mờ', value: 'image_blurry' },
         { label: 'Sai số tiền', value: 'wrong_amount' },
         { label: 'Trùng đơn', value: 'duplicate_order' },
         { label: 'Khác', value: 'other' },
       ], admin: { description: 'Reason set when seller rejects payment proof' } },
     { name: 'paymentRejectionDetail', type: 'textarea', admin: { description: 'Required if rejectionReason=other (≥10 chars)' } },
     { name: 'paymentVerifiedAt', type: 'date', admin: { readOnly: true } },
     { name: 'paymentVerifiedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
     { name: 'magicLinkSecret', type: 'text', admin: { hidden: true } }, // server-only
     { name: 'verificationSource', type: 'select', defaultValue: 'manual',
       options: [{ label: 'Manual', value: 'manual' }, { label: 'Auto (Open Banking)', value: 'auto' }],
       admin: { readOnly: true } },
     { name: 'autoVerifiedAt', type: 'date', admin: { readOnly: true, hidden: true } }, // Wave 8+
     { name: 'bankTransactionId', type: 'text', admin: { readOnly: true, hidden: true } }, // Wave 8+
     ```
   - Existing `paymentReference` field: update admin description to "Bank Transfer reference code (BT-XXXXXX)".
   - In `hooks.beforeChange`: leave as-is for now (state machine guards live in API routes — keep hook lean).
3. Run `node scripts/check-migrations.js origin/staging` locally — must pass.
4. Spin up local Postgres → `npm run dev` → confirm Payload Admin loads `/admin/collections/orders` without errors.

## Todo List

- [ ] Append 13 new migration entries to `scripts/db-setup.js`
- [ ] Add 2 paymentStatus options + 1 paymentMethod option in `Orders.ts`
- [ ] Add 10 new fields to Orders collection schema
- [ ] Rename `qr_banking` label to "QR Banking (legacy)"
- [ ] Run `check-migrations.js` locally
- [ ] Verify Payload Admin loads orders without TypeScript / schema errors
- [ ] Commit: `feat(orders): add v2.2 bank-transfer verification schema fields`

## Success Criteria

- `scripts/check-migrations.js origin/staging` exit 0.
- `npm run build` succeeds.
- Existing order tests still pass: `npm test -- orders`.
- New columns visible via `psql -c "\d orders"` after `db-setup` runs.
- Existing v2.1 orders untouched (verified by row count diff before/after backfill).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Backfill UPDATE locks `orders` table during deploy | L | M | Limited to last 7 days + non-terminal — small row set. Run during low-traffic window if prod is hot. |
| `magicLinkSecret` accidentally exposed via Payload Admin | L | H | `admin: { hidden: true }` on field + collection `read` access already tenant-scoped + secret only used server-side. |
| `paymentVerifiedBy` relationship FK orphan after user delete | L | L | Users collection currently does not hard-delete; defer concern. |
| Forgetting `payment_method='qr_banking'` legacy rows breaks list views | M | M | Keep `qr_banking` in select options as "legacy"; CMS Orders list filters by both. |

## Security Considerations

- `magicLinkSecret` is server-side only; never returned by GET `/api/orders/:id`. Add explicit `defaultPopulate` / field-level `read` access if Payload exposes it; verify in P03 testing.
- `paymentVerifiedBy` keeps audit trail — required by BR-Payment-07/08.

## Next Steps

Unblocks P02 (checkout), P03 (token/email), P05 (cron), P06 (seller UI).
