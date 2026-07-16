# Phase 02 — DROP INDEX Guard — Implementation Report

## Executed Phase
- Phase: phase-02-db-setup-drop-index-guard
- Plan: plans/260714-0943-GH-1587-category-field-access-fixes
- Status: completed

## Files Modified
- `scripts/db-setup.js` (+12/-3 net, single MIGRATIONS entry only)

## Diff summary
Lines 4969-4974 (original `categories.drop_global_slug_unique` entry) replaced with a
guarded version at ~4969-4986. Old:
```
sql: `DROP INDEX IF EXISTS categories_slug_idx;
      DROP INDEX IF EXISTS categories_slug_unique;
      DROP INDEX IF EXISTS categories_slug_key;`,
```
New: `DO $$ BEGIN ... END $$;` block, one `IF EXISTS (SELECT 1 FROM pg_indexes WHERE
indexname = '<name>' AND indexdef LIKE 'CREATE UNIQUE%') THEN EXECUTE 'DROP INDEX <name>';
END IF;` per index name (`categories_slug_idx`, `categories_slug_unique`,
`categories_slug_key`). `MIGRATIONS` entry `name` field unchanged
(`categories.drop_global_slug_unique`). Added a 3-line comment explaining rationale.

Adjacent `categories.tenant_slug_unique` entry (creates `categories_tenant_slug_uniq`, now
at ~4988-4990) — confirmed untouched via `git diff` (no `+`/`-` lines in that hunk).

## Tasks Completed
- [x] Read exact lines (4955-4985 region)
- [x] Conditional UNIQUE-only DROP block (guards each of 3 index names independently)
- [x] `MIGRATIONS` entry name kept stable
- [x] `categories.tenant_slug_unique` entry confirmed untouched
- [x] Idempotency preserved — no `DROP TABLE`, all guarded by `IF EXISTS`

## Validation
- `node --check scripts/db-setup.js` → **JS SYNTAX OK** (confirms template literal / DO $$
  block well-formed as a JS string; SQL body is standard PL/pgSQL, matches the style already
  used in this file's `verifyCriticalIndexes()`).
- No local `psql` client available in this environment — SQL validated by inspection only, not
  dry-run executed against a live Postgres.
- `node scripts/check-migrations.js origin/staging` → **FAILS**, but confirmed **pre-existing
  and unrelated** to this change:
  - Failure: `sites.opens` / `sites.closes` fields in `Sites.ts` reported as missing migrations.
  - Root cause: this feature branch (`feat/f08-1587-category-integrity-fixes`) is currently
    behind `origin/staging` on `src/collections/Sites.ts` — `git diff origin/staging..HEAD --
    src/collections/Sites.ts` shows HEAD has an *older* version (missing opening-hours
    `opens`/`closes` fields that origin/staging already has, likely from a separate merged PR
    e.g. F37 local-business work). This branch needs a rebase/merge from `origin/staging` to
    pick up the matching `db-setup.js` migrations for those fields — unrelated to categories.
  - Verified independent of my edit: `git stash push -- scripts/db-setup.js` (reverting to
    original DROP INDEX statements) then re-ran `check-migrations.js` → **identical failure**,
    same 2 fields, same exit code 1. Restored via `git stash pop`.
  - Out of scope per phase file (single-file `db-setup.js` DDL guard for categories only) —
    flagging for whoever merges/rebases this branch, not fixing here (would require editing
    `Sites.ts` / adding unrelated migrations, outside this phase's file ownership).

## Issues Encountered
- `check-migrations.js` cannot cleanly pass on this branch until it's rebased onto current
  `origin/staging` — this is a branch-staleness issue, not a defect introduced by Phase 02.
  Recommend a rebase before Phase 06 (code review) / PR, or note it in the PR description.

## Next Steps
- No git commit made — changes left staged/unstaged per constraint, for review.
- Phase 06 (code review) should be aware of the branch-staleness / `check-migrations.js`
  finding above.

## Unresolved Questions
1. Should the branch be rebased onto `origin/staging` before or after Phase 05 (testing)? Not
   my call — flagging since `check-migrations.js` is a hard CI gate per
   `.claude/rules/database-schema.md` and will block the PR regardless of Phase 02's changes.
