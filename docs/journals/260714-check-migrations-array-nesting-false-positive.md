# check-migrations.js: false positive on array-nested fields added to a pre-existing array

**Date**: 2026-07-14
**Severity**: Medium (CI-blocking false positive, no real schema gap)
**Component**: `scripts/check-migrations.js` (CI quality-check gate)
**Status**: Fixed, 5 new regression tests

## What happened

Running the exact CI `quality-check` steps locally on `fix/category-tenant-isolation-security` surfaced a migration-check failure:

```
❌ 2 new field(s) WITHOUT migrations:
   sites.opens (added in Sites.ts)
   sites.closes (added in Sites.ts)
```

## Root cause

`Sites.ts`'s `localBusiness.openingHours` array field (added by an earlier, already-merged commit) gained two new sibling sub-fields, `opens`/`closes`, in a later commit. `check-migrations.js`'s diff-based scope tracker (`getNewFieldsFromDiff()`) only recognizes a field as "array-nested" when the array's own `type: 'array'` declaration line is *itself* part of the `git diff` against the base branch. Since `openingHours`'s declaration pre-dates this diff (unchanged vs. `origin/staging`), the scope tracker never pushed an `array` ancestor onto its stack, so `opens`/`closes` were misclassified as new top-level columns on the `sites` table.

The underlying schema migration was actually already complete and correct — `scripts/db-setup.js`'s `sites_local_business_opening_hours.create_table` entry already included `opens varchar` and `closes varchar` columns (verified by reading the CREATE TABLE body directly). This was a pure detection bug in the CI tool, not a real missing migration — adding the naively-suggested `ALTER TABLE sites ADD COLUMN IF NOT EXISTS opens varchar;` would have been actively wrong (a duplicate, unused top-level column, since `opens` correctly lives in the child array table).

## Fix

Added `getArrayNestedFieldNames(source)` — scans the CURRENT full collection file (not just the diff) using the same indentation-based scope-tracking approach, and merges its result into the diff-based `skipFieldNames` set. This catches array-nested fields regardless of whether the array's own declaration was part of the current diff.

First implementation attempt anchored the field-name regex to line-start (`^(\s*)name:`), which fails to match this codebase's common compact single-line field syntax (`{ name: 'opens', type: 'text' },` — `name:` isn't the first token after whitespace). Fixed by matching `name:` anywhere on the line while still measuring indent from leading whitespace, mirroring the diff-based heuristic's own approach. Caught by writing the regression test *before* trusting the first pass — 2 of 5 new tests failed against that version.

Also added a `require.main === module` guard + `module.exports` at the bottom of the script so `getArrayNestedFieldNames` is unit-testable without triggering the CLI's `process.exit()` side effect — zero change to actual CLI behavior (verified: `node scripts/check-migrations.js origin/staging` output identical before/after).

## Verification

- `node scripts/check-migrations.js origin/staging` → exit 0 (was exit 1)
- 5 new tests in `src/__tests__/unit/migration/check-migrations-array-nesting.test.ts`, 2 of which fail against the pre-fix regex (proven via a temporary revert-and-rerun)
- `--baseline` mode (separate, unaffected code path) still produces its usual audit warnings
- Full suite: 588 files / 10302 tests green; `tsc`/`lint` clean

## Lesson

A diff-only heuristic for "is this field new" is fragile against "is this field's ANCESTOR new" — ancestry can predate the diff being inspected. Cross-checking against the current full-file structure (not just added lines) is more robust for any check that depends on nesting/scope, not just this one.
