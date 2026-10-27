# Code review — `migrate:pw1:delta` (F42, uncommitted)

Scope: scripts/pw1-delta.ts, scripts/pw1-delta-migration-schema.js (+db-setup call), src/lib/migration/pw1-delta/*.ts (17), 2 unit test files. ~1.7k LOC.
Checks: vitest 18/18 pass; `tsc -p .migration/tsconfig.delta-check.json` → 0 pw1-delta errors.

## High

**H1. Default mode (the planned production path, no `--old`) overwrites PW2 edits without any check; `targetChecksum` is loaded but never used.**
- delta-apply.ts:44-49, 72-74 (`oldEntity` returns undefined → `previous=null`); delta-writer.ts:571 skips the check; ledger-lookup.ts:13/45 loads `targetChecksum`, no consumer.
- Plan D4 says "vẫn giữ kiểm tra target_checksum". Scenario: a merchant or admin edits product 123 in PW2 after the 07/10 import. PW1 also changed it, so it is CHANGED. `payload.update` overwrites the PW2 edit without a trace (the outcome is `written`).
- Fix: the import ledger already holds the projection (`migration_entity_map.detail->'projection'`, the same field writer.ts:296/353 uses). For CHANGED rows with `origin='import'`, SELECT that and run `targetProjectionMatches(projection, current)` → PW2_EDITED_CONFLICT. For `origin='delta'`, store the projection (jsonb) in `pw1_delta_map` and do the same.

**H2. Changes are classified before the advisory lock, so two overlapping runs create duplicates.**
- pw1-delta.ts:58-92 loads claims and compares (≈25 min). The lock is taken only at delta-apply-run.ts:195, and nothing is checked again inside the store transaction.
- Scenario: an operator starts a second terminal (or retries thinking the first hung). Run A applies and commits. Run B gets the lock afterwards and applies its stale NEW list. Every NEW product/customer/order is created a second time. Only unique slugs/emails would stop some of these, and when they do the whole store rolls back.
- Fix: take `pg_try_advisory_lock` at the start of `main` on a dedicated session. Also, in `applyStore`, SELECT `pw1_delta_map` for the store's keys inside the transaction and drop rows already recorded with the same sourceChecksum.

**H3. Recoverable user credentials stay in the run directory as plain CSV.**
- csv-normalize.ts:112 copies every CSV, including `users_*.csv` (`key_string` + bcrypt `password`), to `<out>/source-new` (and `source-old`). Nothing deletes them. `key_string` + PW1_APP_KEY gives back the plaintext password (user-auth.ts:18). The original pipeline seals these fields into an HKDF-encrypted sidecar (pw1-json/credentials.ts).
- `--out` is not confined: pw1-delta.ts:22-29 only enforces this when the basename is `delta-runs`. So `--out ./tmp/x` inside the repo writes them into an un-ignored path.
- Fix: in the normalized copy, drop or blank `password`/`key_string`, and read credentials straight from `--new` at apply time (or `rm -r source-*` in a finally block once runApply/compare is done). Refuse an `--out` inside the repo unless it is under `.migration/`.

**H4 (conditional; must be asserted on prod). Only `state='VERIFIED'` claims are loaded, so documents of unverified stores look NEW.**
- ledger-lookup.ts:39. If any import store stopped at CREATED (partial batch, `pendingStoreIds`), its PW2 documents have active CREATE claims that the delta ignores. All of them are classified NEW and created again. The rehearsal DB shows nothing because every store there was verified.
- Fix: load `claim_active AND action='CREATE'` whatever the state, and stop with a clear error when any state ≠ VERIFIED.

## Medium

**M1. `--old` after an earlier delta run gives false PW2_EDITED_CONFLICT.** delta-apply.ts:44-49/72: `previous` is always the projection from the *old snapshot*. If the document was already updated by a delta, the current row is the delta version, so the match fails. Scenario: run 1 (default) applies v2. Later `--old v1 --new v3` reports a conflict and v3 is never applied (the same happens when PW1 reverts to v1). Fix: when `claim.origin==='delta'`, compare against the delta-recorded projection (see H1), not the old entity.

**M2. Default mode has no truncation guard. Destructive GONE retirement is gated only by 5% of all claims.** input-guards.ts:553 skips the row-count and header comparison without `--old`. delta-compare.ts:410: the limit is 5% of the total claim count, which is a large absolute number. Scenario: `stores_*.csv` truncated by a few hundred rows → those tenants are `suspended`, their products `archived`, their blogs `draft` on prod, all under the limit. Fix: use a separate small cap for GONE+RETIRE (absolute and per collection), or compare the new CSV row counts with ledger/evidence counts per table, or require `--old`/an explicit flag before retiring tenants.

**M3. Credential and env failures surface only after confirmation, inside each store transaction.** delta-writer.ts:549 → passwordFor checks PW1_APP_KEY/SSO_ENCRYPTION_KEY lazily. If one is missing or wrong, every store containing a NEW user rolls back while the other stores commit, leaving a partial run. A single SOURCE_PASSWORD_MISMATCH also rolls back the whole store. Fix: dry-run `passwordFor` for all NEW users before `confirmApply`, and list which users are reset-required and which would fail.

**M4. Possible gap: PW1 password changes after 16/09 are not propagated.** Updates use only `entity.data`. Credentials are a sidecar, probably not part of `sourceChecksum`. A user who changed their PW1 password keeps the old one in PW2. Verify, and document it or handle it.

## Low

- **L1.** delta-apply-run.ts:206: `siteChanged` comes from `input.changes`, not outcomes, so stores that failed or conflicted still go into `website-input.json`. `pages` is not a writable collection, so that branch never fires.
- **L2.** These are never recorded in the ledger: REPORT_ONLY NEW/CHANGED, conflicts, and `--old` GONE without a claim (delta-apply.ts:59, 79, 88). They are listed again on every rerun and count toward the mass limit.
- **L3.** ledger-lookup.ts:66-72: GONE store resolution uses `collection.replaceAll('-','_')`, not the Payload `dbName`. Unresolved rows all share one `'unknown'` transaction, so one failure rolls back all of them. The exact store is available via `migration_entity_map.run_id = migration_import_stores.run_id → source_store_id` (as destination-map.ts does).
- **L4.** parity-gate.ts:629: after delta runs, the overlay replaces `origin='import'`, so those keys count as "unclaimed" and are no longer covered by the gate.
- **L5.** delta-writer.ts:572-578: there is no `SELECT … FOR UPDATE` between the conflict read and the update. Live traffic can change the row in that window (the original writer locks the row).
- **L6.** `--store` is documented as "to report (rehearsal only)" (delta-options.ts:159) but it applies writes (pw1-delta.ts:67).

## Positives
- All SQL is parameterized and identifiers are regex-checked. The compare phase uses a read-only pool (`default_transaction_read_only`). The old ledger is only SELECTed.
- Business writes and `pw1_delta_map` commit in one per-store transaction. A store failure is isolated, and a rerun after a crash is safe.
- Email is hard-disabled, hooks go through the importer's `guardCollection`, and `describeTarget` masks credentials. Files are 0600/0700 and `wx` prevents overwrites.

## Unresolved questions
1. Can store bundles carry refs to entities owned by *another* store, or to new PW1 actors with no SKIP binding? If so, `RELATIONSHIP_NOT_READY` (required) rolls the store back on every run. Worth a rehearsal check of `failed` outcomes.
2. Is the target DB on 28/10 already serving live merchant edits? This decides whether H1 blocks the release.
3. Does any source key appear in more than one store's entities (shared users)? Duplicate NEW → the second store fails.
</content>
</invoke>
