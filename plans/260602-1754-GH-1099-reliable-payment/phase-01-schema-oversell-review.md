# Phase 01 — Schema: oversell_review column

**Priority:** P1 | **Status:** pending | **AC:** AC-2/AC-3 prereq | **TC:** TC-F13.157 | **Effort:** 1h

## Overview
Add `oversellReview` boolean to Orders. Flag (NOT a status) set when stock decrement detects oversell.
Despite TC-157 marked done, the column is missing from both Orders.ts and db-setup.js.

## Related code files
- MODIFY `scripts/db-setup.js` — add migration entry
- MODIFY `src/collections/Orders.ts` — add field after `cancelReason` (~line 362)

## Implementation steps
1. `db-setup.js` MIGRATIONS array, add (group with Orders ALTERs):
   ```js
   { name: 'orders.oversell_review',
     sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS oversell_review boolean DEFAULT false;` },
   ```
2. `Orders.ts` after cancelReason field:
   ```ts
   {
     name: 'oversellReview',
     type: 'checkbox',
     defaultValue: false,
     index: true,
     admin: { description: 'Stock oversold after payment captured — seller must decide on manual refund' },
   },
   ```
3. Run `node scripts/check-migrations.js origin/staging` — must pass.

## Todo
- [ ] db-setup.js migration entry
- [ ] Orders.ts checkbox field
- [ ] check-migrations passes

## Success criteria
- `check-migrations.js` green; replay idempotent (IF NOT EXISTS).
- Payload admin shows the field; defaults false on existing rows.

## Risk
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Drizzle skeleton table missing column | Low×Med | ADD COLUMN IF NOT EXISTS fallback (per database-schema.md) |
| Wrong column name vs Payload convention | Low×High | `oversellReview` → snake `oversell_review` (Payload default); verified pattern |

## Rollback
Field + migration are additive; revert commit. Existing rows keep `false`. No data loss (never DROP).

## Next
Unblocks 02 (reconcile lib writes this flag).
