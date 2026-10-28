# Re-review — `migrate:pw1:delta` (after fixes H1–H4, M2/M3, L1/L2/L6, D7, tracking)

Checks: vitest 3 files / 23 tests pass; `tsc -p .migration/tsconfig.delta-check.json` → no non-firebase errors.

## Verdict on the first-review fixes
| Item | Status |
|---|---|
| H1 edit guard via ledger projection | Fixed for import-origin and delta UPDATE/CREATE. **Gaps:** delta rows with `projection=null` skip the guard without a trace (see M2). Clock-less projections cause false conflicts (see M3). |
| H2 run-wide advisory lock | Fixed. Released in `finally`. The lock client has no `error` listener (see M4). |
| H3 cleanup + `--out` confinement | Fixed on normal and exception paths. **Not on SIGINT/SIGTERM/crash** (see M4). |
| H4 IMPORT_NOT_VERIFIED | Fixed. |
| M2 GONE 1% / M3 key check / L2 REPORTED / L6 help | Done. M3 checks only that the keys are present, not that they are valid (Low). |
| L1 website-input excludes failed/conflict stores | **Only without `--old`** (see M5). |
| D7 password sync | Works for one run. Re-runs and PW2-side changes are unguarded (see H1). It may bump `updated_at` (see M1). |
| Unknown-store last, FAILED on crash | Correct (comparator delta-apply.ts:107). |
| Tracking | Read-only, Super Admin, parameterized. Counts are wrong for stores with more than 500 changes (see M6). |

## High (conditional)
**H1. Password sync can overwrite a password the user set in PW2, and repeats on every `--old` run.** password-sync.ts:16-25, 32-46.
- `changedPasswords` diffs old CSV vs new CSV only. Nothing records that a credential was already synced, and nothing checks the live PW2 hash/salt.
- Scenario: the delta syncs user 42. On 30/10 the user resets the password in PW2. Any later run with `--old <imported 16/09>` sees the same PW1 change again and writes the PW1 password back. The user is locked out of the password they just set.
- Rated High if PW2 logins are live for migrated users when deltas run; Low otherwise.
- Fix: (a) add a `pw1_delta_credentials(source_id, fingerprint=sha256(key_string‖hash), salt_written, run_id)` row in the same txn and skip when the fingerprint is unchanged; (b) before writing, compare the live `users.salt` with the salt the delta last wrote. For import-origin users, at least refuse when `users.updated_at` is past the import time, or report them.

## Medium
**M1. Password write probably bumps `users.updated_at`, which makes every synced user a permanent PW2_EDITED_CONFLICT (unverified).** password-sync.ts:43.
- `payload.db.updateOne` has no `restoreTimestamps`. If the drizzle adapter fills `updatedAt` on update, the live value no longer equals `projection.updatedAt` (import or delta). Every later CHANGED for that user then conflicts. This also covers users that were CHANGED in the same run, because the password write runs after `upsertMap` recorded the source updatedAt.
- Verify on the DB copy: compare `updated_at` of the verified user before and after.
- Fix: do a raw `UPDATE users SET hash=$1, salt=$2, key_string=$3 WHERE id=$4` inside the txn, or include the current `updatedAt` in `data`.

**M2. Edit guard is silently skipped for delta-origin claims whose projection is NULL.** delta-apply.ts:65-67; delta-ledger.ts:60-68.
- RETIRE/REPORTED rows store `projection=null`, and so do rows written before the column existed (rehearsal DBs).
- Scenario: product retired by run 1, then merchant edits it in PW2. It reappears in PW1, so `entity-diff.ts:66` marks it CHANGED and `previous=null`. `updateDocument` overwrites without any check, and the outcome is `written`.
- Fix: throw PROJECTION_MISSING for null on *both* origins. For RETIRE/REPORTED, store `prior projection ⊕ retire patch` as the projection when writing the row.

**M3. False PW2_EDITED_CONFLICT for docs whose source timestamps are null.** delta-apply.ts:89-91; delta-writer.ts:37-43, 86.
- NEW users/sites/media: `withClock` fills the clock into the written data. The recorded projection re-runs `resolveData` without the clock, so it keeps `createdAt/updatedAt: null` while the live row has the clock value. The next CHANGED then conflicts.
- CHANGED with null timestamps: Payload sets updatedAt=now, and `restoreTimestamps` is skipped because it needs both. The projection keeps null, so the next run conflicts.
- The import avoided this because `expected()` applied the clock and verified the result after the write.
- Fix: record the data actually written (return it from create/update, with the clock applied), or read back after the write and `match()` like writer.ts:379. That also catches hook transforms at write time instead of on the next run.

**M4. Exit paths that skip cleanup and lock handling.** pw1-delta.ts:138-148; delta-ledger.ts:19-24.
- (a) No SIGINT/SIGTERM handler. Ctrl-C during the 25-50 min compare/apply skips `finally`, so `source-new/users_*.csv` (key_string + bcrypt) and the artifacts stay on disk. The server frees the lock on disconnect, so the lock is fine.
- (b) The checked-out lock client and both pools have no `'error'` listener. A dropped connection (Neon compute restart, network) emits an unhandled `error` and crashes the process. Same result: no cleanup, and `pw1_delta_runs.state` stays `APPLYING` forever, as the tracking UI will show.
- Fix: `process.once('SIGINT'|'SIGTERM')` that runs `cleanRunDir` (sync rm is fine) and then exits; add `client.on('error')`/`pool.on('error')` that flags the loss so applyChanges stops before the next store. Better still, keep password columns out of the normalized copy and read credentials from `--old/--new` directly.
- Also: cleanRunDir:45 runs `cp` before `rm`. If the cp fails, both rm's for that side, and the whole `new` side, are skipped. Do the rm's in their own try/finally.

**M5. L1 is incomplete with `--old`: failed/conflict stores still go into website-input.json.** delta-apply-run.ts:61-64 vs website-input.ts:45.
- With `input.old`, `changed` comes from the old/new bundle hash and ignores the filtered `siteChanged`.
- Scenario: store 900's site content changed but its store txn failed. It still gets handed to `migrate:pw1:website` with a destination.
- Fix: pass `failedStores` to `buildWebsiteInput` and `continue` for those ids.

**M6. Tracking run counts are computed from the 500-row page.** pw1-delta-tracking-reader.ts:54-66, 75-91.
- For a store with more than 500 delta rows, the per-run counts are low. Runs whose rows all fall outside the newest 500 are dropped unless they have issues.
- Fix: run a separate `SELECT run_id, action, count(*) … WHERE store_id=$1 GROUP BY 1,2`. Optionally add `CREATE INDEX IF NOT EXISTS pw1_delta_map_store_idx ON pw1_delta_map(store_id, updated_at DESC)` in the schema script. Both queries currently seq-scan; that is fine at today's size.

## Low
- password-sync.ts:43: `db.updateOne` on a PW2 user that was deleted may return without error and be counted as `written`. Check the returned row.
- Passwords are written even when the user's store txn failed or conflicted (delta-apply-run.ts:56). This is probably acceptable; document it.
- M3 (first review), partial: `credentialKeyIssue` checks that PW1_APP_KEY exists, not that it is right. A wrong key leads to every NEW-user store rolling back and every password `failed`, after confirm. Dry-run `passwordFor` on one changed/NEW credential before confirm.
- M2 (first review), residual: the GONE cap is 1% of *all* claims (~1.5k). That still covers most tenants, and there is no per-collection cap (e.g. tenants GONE > 1% of tenant claims → block).
- No `SELECT … FOR UPDATE` between the guard read and the update (L5 from the first review, unchanged).
- delta-apply-run.ts:1-3: the header comment still says it "takes the delta lock".
- Neon precondition: the session advisory lock and `options=-c …` need a direct (non `-pooler`) DATABASE_URI. The env examples are direct; state it in the runbook.

## Verified OK
- Lock: taken before any read, on its own session. Release and `pool.end` in `finally`. If acquire fails it throws before `try`, and the process exits. runApply's separate pool doesn't need the lock (mutex between delta processes only). A pool max of 2 with 1 held is enough (sequential queries).
- priorProjection: SELECT only. Import projection exists for every VERIFIED CREATE (writer.ts:374 requires it). Delta projection is recorded after deferred refs resolve.
- Password targeting: only CREATE claims or delta claims with `targetCollection='users'`, so SKIP/external-actor users are never touched. NEW users are excluded because claims load before apply. preserveInvalidEmail users are safe because `db.updateOne` skips email validation. A CHANGED write never carries hash/salt, so the order is safe.
- Secrets: apply-result and the tracking API expose only sourceId/targetId/codes. Error strings are codes. `describeTarget` masks credentials. The tracking route has zod-validated numeric store_id, `withSuperAdmin`, and a generic 503.
- Tests exist for TC-06/07/08 (`massChange`, `changedPasswords`, tracking reader).

## Unresolved questions
1. Are PW2 logins/password resets live for migrated users when the delta runs (decides H1 severity)?
2. Does `payload.db.updateOne` set `updated_at` in the installed @payloadcms/drizzle (M1)? Verify on the copy.
3. Can `migration_entity_map` hold active CREATE claims in a terminal non-VERIFIED state (e.g. superseded)? If so, H4 blocks prod permanently.
