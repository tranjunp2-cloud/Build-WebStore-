# Final review: `migrate:pw1:delta` (after the M1–M6, H1 and D1 fixes)

Checks: vitest on the 3 files: 25/25 pass. `tsc -p .migration/tsconfig.delta-check.json` shows no errors except the known firebase ones. Old scripts and modules are unmodified (git status shows only `scripts/db-setup.js` +2 and `package.json` +1 among tracked files). `migration_*` is only read with SELECT. Source is CSV only. No hardcoded paths found.

## Verdict: fix first — H1 (small change). M1 is recommended in the same pass.

## Status of each fix
| Item | Status |
|---|---|
| H1/M1 password sync | Correct. Fingerprint and salt are stored in `pw1_delta_credentials`. Each user gets its own txn with `FOR UPDATE`. The raw UPDATE does not change `updated_at`. The delta projection is checked before the import projection. The decision function is pure and tested. One fail-open edge remains (L1). |
| M2 PROJECTION_MISSING / GONE projection | PROJECTION_MISSING is correct for both origins. The GONE projection does not do what was specified: REPORTED stores a live read instead of `prior` (M1). |
| M3 liveProjection | Correct. It reads in the same txn after all writes, including deferred refs, with the same `findByID` depth 0 used by the guard. |
| M4 signals / error listeners / cleanRunDir | OK. Gaps: the runtime pool has no listener, and a lost lock is only logged (L2). Ctrl-C at the y/N prompt is unverified (L4). |
| M5 failedStores | Correct in both modes. |
| M6 counts + index | Correct. The GROUP BY query is parameterized. The index is `IF NOT EXISTS` and registered in db-setup.js:5677. |
| D1 claimed → ledger checksum | Correct for quote fixes, delta-origin claims and RETIRED claims that reappear. It introduces a regression in `--old` reruns (H1). |

## High
**H1. In `--old` mode, a document moved by an earlier delta run gets retired.** Locations: entity-diff.ts:60-61, :72-77; delta-compare.ts:173.
- Run 1 (`--old`): product 9 moved from store 1 to store 2 (tenant changed, so the checksum changed). It is applied as CHANGED, and the delta claim stores the checksum of the store-2 version.
- Run 2 with the same `--old` (this is TC-F42-DELTA-09): in store 2 the checksum equals the claim, so the product counts as *unchanged* and no non-GONE change is emitted. In store 1 the old entity is left over, and the claim is delta-origin but not RETIRED, so it becomes **GONE**. `reconcileMoves` has no partner change for the ref, so the GONE survives. `applyStore('1')` then sets `status: 'archived'` on a live product. It is also recorded with store_id 1 and counts toward the 1% GONE cap. Blogs are affected the same way. Users and media become REPORTED, which marks the claim RETIRED.
- Before D1, `prior` was undefined in store 2, so this case became CHANGED + movedFrom and nothing was retired.
- Fix (delta-compare.ts, after `reconcileMoves`): in `--old` mode, drop GONE changes whose `ledgerKey(sourceEntity, sourceId)` is in `seen`, because the entity still exists in another store. Add a diffStore/compare test for this "unchanged vs claim but moved" case.

## Medium
**M1. REPORTED/RETIRE projections take PW2 edits as the new baseline.** Location: delta-apply.ts:185-197.
- For GONE rows the projection is `liveProjection(keys of prior ⊕ patch)`, so it comes from a live read. The edit guard never runs before a retire or report.
- Scenario: a merchant edits user/media X in PW2. X then disappears from PW1, which records REPORTED with projection = the *edited* live values. X later reappears in PW1 as CHANGED. The guard compares the edited projection with the edited live document, so it passes and the PW2 edit is overwritten. The spec said "REPORTED: prior".
- Fix: REPORTED → store `prior` as it is, with no read-back. RETIRE → check `targetProjectionMatches(prior, current)` before `retireDocument`. If it does not match, store `prior` (or report a conflict) so that a later reappearance conflicts instead of overwriting.

**M2. In `--old` mode, documents created by the delta are never detected as GONE (existed before this change; fix together with H1).** Location: delta-compare.ts:171.
- `ledgerGone` runs only without `--old`. Per-store GONE only covers entities in the *old* snapshot. A document created by run 1 that is later deleted in PW1 is invisible to every `--old` run.
- Fix: in `--old` mode, also add `ledgerGone` for delta-origin claims that are not in `seen` and not already GONE.

## Low
- **L1** password-sync.ts:51, :62-67. When there is no sync row and no projection, or the projection has no string `updatedAt`, the result is `write: true`. That is fail-open, unlike the PROJECTION_MISSING rule. Return `conflict/PROJECTION_MISSING` instead. Also, `Date.parse` on an import projection timestamp without a timezone would be read as local time. The failure is safe (false conflict), but confirm the format.
- **L2** delta-runtime.ts:47: the write pool has no `'error'` listener, so an idle-client drop during apply crashes the process without cleanup and the run stays APPLYING. pw1-delta.ts:86: a lost lock connection is only logged, so apply continues without the mutex. Set a flag and stop before the next store.
- **L3** website-input.ts:244 (existed before): with `--old --store X`, any other store whose website hash changed is still included even though its changes were not applied. Filter by `options.stores`.
- **L4** pw1-delta.ts:156: with readline in raw mode, Ctrl-C at the y/N prompt does not reach `process` SIGINT. Check that the pending `question` rejects, so `finally` runs, and does not hang with source-new/users CSVs on disk.
- **L5** entity-diff.ts:63-64: for delta-origin claims with `--old`, `fields` lists old-vs-new fields, including ones already applied. This only affects the report.
- **L6** delta-apply-run.ts:2: the header still says "takes the delta lock".
- **L7** Tests: nothing covers the GONE/move rerun path (H1) or `liveProjection`/PROJECTION_MISSING. The DB-level checks rely on MANUAL TC-09. TC-IDs, AAA and import-from-source are all compliant.

## Verified OK
- Security: the fingerprint is sha256(key_string‖bcrypt), not reversible in practice, and the secret is never stored. Logs and error codes keep only the first token. All SQL is parameterized; `tableName`/`goneDocumentStores` check identifiers against a regex. The tracking route uses `withSuperAdmin`, a zod numeric id and a generic 503.
- Schema: everything is `CREATE … IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, there is no DROP, it is registered in `runMigrations`, and the FK to runs uses RESTRICT.
- D1 + parity/quoteFix: in `--old` mode quote rows become CHANGED with `fields: []` + `quoteFix`, excluded from the 5% cap. The gate only checks import-origin claims. Delta-origin claims no longer re-apply changes from earlier runs, which fixes the earlier repeat issue. RETIRED claims that reappear are guarded with the RETIRE projection, and rows written before the projection column existed give PROJECTION_MISSING.
- Password ordering: CHANGED writes never carry auth fields. The delta projection, which comes from a live read, matches the live `updated_at` after a same-run update.

## Unresolved questions
1. Does a Payload login/session update bump `users.updated_at`? If so, active users always get PW2_EDITED_CONFLICT on their first password sync. That is safe but makes D7 ineffective for them.
2. What format is the import projection's `updatedAt` (ISO with Z)? See L1.

**Status:** DONE_WITH_CONCERNS
**Summary:** M1–M6 and the password-sync fixes are correct. The D1 change introduces H1: `--old` reruns archive products moved by an earlier run.
**Concerns/Blockers:** Fix H1 (filter GONE by `seen` in --old mode, add a test) before commit. M1 (REPORTED projection = prior, guard before retire) is recommended.

## Re-check 18:10

Checks: vitest on the 3 files: 27/27 pass. tsc: no errors except the firebase ones. Old pw1 scripts and modules are still unmodified.

| Item | Result |
|---|---|
| H1 + M2 `finalizeChanges` (delta-compare.ts:67-72) | Fixed. Tests cover the move-then-rerun case and a delta-created document that disappears with `--old`. |
| M1 GONE guard (delta-apply.ts:88-113) | Fixed. A retire runs only after `targetProjectionMatches(prior, live)`. REPORTED stores `prior` (keys `[]` → fallback). RETIRE stores a live read of prior+patch. |
| L1 PROJECTION_MISSING (password-sync.ts:53) | Fixed and tested. Now fail-closed. |
| L2 pool/lock `error` | Fixed. delta-runtime.ts:50 logs. pw1-delta.ts:87 sends SIGTERM, which goes through the cleanup handler. |
| L3 `onlyStores` | Fixed (website-input.ts:47, delta-apply-run.ts:64). |
| L4 prompt SIGINT | Fixed (delta-apply-run.ts:26). The handler is registered before the confirm step, so cleanup runs and the exit code is 130. |
| L6 header | Fixed. |

Your specific questions:
- **(a) Can the GONE filter hide a real removal?** No. `seen` holds the ledger key of every entity built from the whole new snapshot (all stores). `(source_entity, source_id)` is the PK and is unique per store at import (CROSS_STORE_SOURCE_CONFLICT), so a key in `seen` means the document still exists in PW1. Without `--old` the filter does nothing, because `ledgerGone` already skips `seen`. A moved document that is unchanged against its claim keeps its old `store_id` in `pw1_delta_map` until its next update. That only affects tracking attribution (cosmetic).
- **(b) Can a GONE be duplicated?** No. With `--old`, `ledgerGone` only receives delta-origin claims whose key is not already in `goneKeys` (diffStore GONE). Import-origin claims are not passed. The parity gate's `missingFromRebuild` guarantees every import claim is in the old rebuild, so diffStore covers them. Both paths skip RETIRED claims.
- **(c) Does a GONE conflict let the run continue?** Yes. The conflict path does not throw, so the store txn commits the other writes. The outcome is `conflict` with a code, so it lands in `summary.issues` and in `failedStores` (website input excluded). One side effect: the claim is stored as RETIRED/REPORTED, so later runs never list this conflict again, and the PW2 document stays live. The operator has to act on this run's issues. That is acceptable, but put it in the runbook (Low).
- **(d) What if SIGTERM fires before cleanOnSignal is registered?** If the lock errors before `createRunDir`, there is no SIGTERM handler, so Node's default action kills the process (exit 143). `finally` does not run, but no run directory or CSV copy exists yet, and the server frees the lock and pool when the connection drops, so nothing leaks. There is no window between the run directory existing and the handler being registered: `cleanOnSignal` runs synchronously in the same continuation right after mkdir resolves. Minor point: the handlers stay registered after the normal `finally`, so a lock error during `pool.end()` would exit 130 instead of the real code (cosmetic).

No new regressions found.

Remaining Low (not blocking): document in the runbook that a GONE conflict is reported once only.

**Verdict: OK to commit.**
