# Phase 01 — DB schema field + migration (`aiReviewPending`)

## Context Links
- Scout: `plans/reports/scout-260706-1327-GH-1502-ai-bulk-create-ux.md` §DB Schema & Migration
- Rule: `.claude/rules/database-schema.md` (ADD COLUMN IF NOT EXISTS, never DROP)
- Pattern: `src/collections/Products.ts` L359-364 (`hasVariants`), L444-449 (`halalCertified`)
- Migration example: `scripts/db-setup.js` L258-262 (`products.halal_certified`)

## Overview
- **Priority:** Blocker (everything else reads/writes this column)
- **Status:** completed
- Add a `aiReviewPending` boolean checkbox to Products + matching migration. Atomic phase — collection + migration edited together, single agent (per orchestration.md: schema changes never split).

## Key Insights
- `getProductsAction` uses `depth: 1` with no field selection → the new column flows to the client automatically once it exists in the DB and Payload schema. No read-path code change needed here (the client `Product` type is updated in Phase 05).
- `saveProductAction` uses `.passthrough()` so `aiReviewPending` in a payload passes to Payload without schema-side allowlisting.
- Column name in snake_case: `ai_review_pending` (per CODE_STANDARDS DB table convention).

## Requirements
- Functional: persist a per-product boolean marking AI-bulk-created products pending review; default `false`.
- Non-functional: passes CI gate `scripts/check-migrations.js`; idempotent migration.

## Architecture
- Data in: Payload field definition (source of truth) + raw SQL migration (Neon executor).
- Data out: column readable via Payload find/findByID; writable via create/update.
- No hooks, no conditional admin UI needed (unlike `halalCertImage`), keep it flat.

## Related Code Files
- **Modify** `src/collections/Products.ts` — add field after `halalCertified`/`halalCertImage` group (or adjacent to other booleans).
- **Modify** `scripts/db-setup.js` — add entry to `MIGRATIONS` array (near the `products.*` block ~L258-262).

## Implementation Steps
1. In `src/collections/Products.ts`, add:
   ```ts
   {
     name: 'aiReviewPending',
     type: 'checkbox',
     defaultValue: false,
     admin: { description: 'Marks a product created via AI bulk-create as pending human review. Cleared on manual edit or activation.' },
   },
   ```
2. In `scripts/db-setup.js` `MIGRATIONS` array, add (in the Products section):
   ```js
   {
     name: 'products.ai_review_pending',
     sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_pending boolean DEFAULT false;`,
   },
   ```
3. Run `node scripts/check-migrations.js origin/staging` to confirm the gate is satisfied.
4. `npm run typecheck` to confirm Payload types regenerate cleanly.

## Todo List
- [x] Add `aiReviewPending` checkbox to `Products.ts`
- [x] Add `products.ai_review_pending` migration to `db-setup.js`
- [x] `node scripts/check-migrations.js origin/staging` passes
- [x] `npm run typecheck` passes

## Success Criteria
- `check-migrations.js` exits 0 (no missing/mis-named migration).
- Payload generated types include `aiReviewPending?: boolean | null` on Products.
- New product rows default to `ai_review_pending = false`.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Wrong snake_case/naming → CI gate fails | Low | Med | Copy exact `halal_certified` pattern; run gate locally before PR |
| Migration re-run on existing DB errors | Very low | Med | `ADD COLUMN IF NOT EXISTS` is idempotent |
| Forgetting migration (schema-only) | Low | High | check-migrations.js hard-gates; step 3 verifies |

## Security Considerations
- Boolean flag, no PII. No access-control change; inherits Products tenant scoping.

## Next Steps
- Unblocks Phase 02 (write flag) and Phase 05 (read flag on list). No behavior visible to users until later phases.
