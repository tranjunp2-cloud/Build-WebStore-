# PW1 batch migration reliability

Scope: P0 reliability plus CLI status/logs/retry, with bounded in-process preparation and serialized writes (one batch/database). No UI, automatic publishing or BE commerce import.

- [x] Isolate per-store validation, quarantine ambiguous identities, persist invalid-input results.
- [x] Persist batch/attempt/stage/error/heartbeat; expose status and logs, target a store, retry failed only.
- [x] Classify transient errors; capped exponential backoff, configurable attempt budget, SIGINT/SIGTERM safe stop.
- [x] Transactional site/page replacement after AI/media preparation; rollback on failure, durable commit receipt for crash recovery.
- [x] Reuse tenant-scoped imported media across attempts; preserve existing account/site mappings.
- [x] Reconcile pages/components/settings and report completed_with_warnings for unsupported/BE-dependent content.
- [x] Verify real local DB rollback/recovery/media reuse plus unit regression cases; document operations and limitations.

Validation: deterministic unit tests for parsing/retry policy; local DB integration with intentional exceptions and process interruption; existing migration regressions; TypeScript. Use synthetic local fixtures for destructive verification. Existing customer site data must not be deleted for testing.

Deferred: concurrency greater than five, dashboards, cost budgets, automatic BE coordination, production scale certification. Retry restarts generation for the failed store; no AI step checkpoint resume.


## Verification completed

- TypeScript and 117 migration tests passed.
- Real local DB: injected write failure, Payload-aborted session, SIGKILL during write, commit-receipt recovery, missing-receipt recovery, media cache/crash-window reuse all passed (`scripts/tests/pw1-reliability.ts`).
- Live synthetic CLI batch: two valid stores completed while one malformed object was recorded as a validation error; exit code 1 as expected.
- Explicit regeneration reused media; `retry --store` skipped an already completed store; status/logs included the invalid object; dry-run left the batch ledger count unchanged.
- Synthetic account/site/media fixtures cleaned up; Amelina and PC_DEMO content were not regenerated for this implementation test.

## Operational limits

Sequential only. Network calls keep existing timeouts; SIGTERM stops at safe boundaries, not by abandoning an unresolved write promise. Media remains durable outside the site/page transaction; cache assumes immutable source URLs and does not HEAD-check stored object availability. Backups/artifacts are retained in the ledger. Commerce bindings carry warnings until the separate BE import is verified. A larger staging pilot is still required before production rollout.

## P1 continuation — issue #1871

- [x] Optional batch generation-attempt and observed native-design token limits; per-store/batch safe-boundary time limits; sequential generation spacing.
- [x] Persist limits; record deferred results when global budgets/stop prevent work; resume using existing retry selection.
- [x] Read-only JSON/CSV batch export, durations, measured native-design usage and explicit unknown monetary cost.
- [x] BE listing availability preflight and optional strict missing-data gate; do not equate counts with verified source mapping.
- [x] Verify local operational integration and regressions after P1 changes.
- [ ] Larger staging pilot: requires destination configuration and representative input from owner.

Still separate follow-up: verified BE source/destination mapping contract, hard provider-wide monetary/request limits, higher concurrency and production load certification. Current token budget is intentionally scoped to observable native-design responses and may overshoot by the in-flight generations.


### P1 verification — 2026-09-15

- TypeScript passed; 131 tests across 12 migration suites passed.
- `scripts/tests/pw1-batch-operations.ts`: three synthetic local stores, generation budget of one, two deferred before provisioning; retry completed remaining stores without regenerating the first. JSON/CSV usage export, strict BE pre-provision gate and dry-run passed. Fixtures cleaned up.
- `scripts/tests/pw1-reliability.ts`: rollback, aborted Payload session fence, killed worker, commit recovery and media reuse still passed.
- Exported the historical two-store real-data pilot as JSON and CSV; both stores present and historical unmeasured tokens/cost remain null.
- Private logs: `/tmp/pw1-p1-unit.log`, `/tmp/pw1-p1-integration.log`, `/tmp/pw1-p1-rollback.log`. Historical reports: `/tmp/pw1-pilot-p1-report.json` and `.csv`.
- No customer site was regenerated for P1 verification. Staging pilot configuration/input requested from owner; not executed.


## Orphan-media cleanup — 2026-09-15

- [x] Explicit `cleanup-media --store` with dry-run default, opt-in apply, seven-day default retention and bounded cursor pagination.
- [x] Track cache last use, require migration cache + exact tenant/hash filename provenance, retain references across DB tables including drafts/versions/HTML and backup artifacts.
- [x] Share batch advisory lock; reject unresolved running work; lock writes and recheck references before Payload/storage deletion; fail closed on contention/RLS/query errors.
- [x] Local synthetic integration verifies orphan deletion/cache cascade, relation and version-only HTML retention, last-use retention and concurrent migration refusal. No customer media cleanup was run.
- [x] 137 migration unit tests and TypeScript passed. Evidence: `/tmp/pw1-cleanup-integration.log`, `/tmp/pw1-cleanup-unit.log`.

Standalone cleanup remains a maintenance command; automatic terminal-failure cleanup is added below. Unknown/unregistered files remain untouched; conservative matches/backups may retain unused files. Storage/DB deletion is not distributed-transactional; report errors and retry orphan cleanup if either side fails.


## Automatic terminal-failure cleanup

- [x] Track actual new uploads in an async store scope spanning retries; exclude cache/filename reuse.
- [x] After final store failure and resolved rollback, queue shared cleanup until all store work drains; then invoke it under the runner lock without retention delay. Skip deferred/interrupted, unresolved or committed work.
- [x] Preserve live/version/other-store and pre-migration backup references; ignore only temporary runtime artifacts from this store's failed attempts.
- [x] Persist cleanup outcome alongside original failure; include it in JSON/CSV; cleanup failure never prevents the next store.
- [x] Real CLI: import logo, fail favicon, remove new orphan, complete next store in the same invocation. Additional local safety test protects committed/unresolved attempts and referenced media. 138 unit tests and TypeScript passed.

Evidence: `/tmp/pw1-auto-cleanup-integration.log`, `/tmp/pw1-auto-cleanup-safety.log`, `/tmp/pw1-auto-cleanup-unit.log`. Synthetic fixtures only; customer stores unchanged. Process death and uploads without confirmed IDs/provenance still require recovery/maintenance; never guess ownership.

## Bounded Promise pool — 2026-09-15

- [x] One existing CLI command; default concurrency 2, configurable 1–5, no external workers.
- [x] Same-account stores run sequentially; active jobs include prepared jobs waiting to write.
- [x] Lazy website transactions: AI/media preparation holds no site transaction. Provisioning, upload creation and website writes share the Payload adapter gate.
- [x] Shared generation-start reservations preserve attempt budgets and start spacing; observed token limits remain soft for in-flight work.
- [x] Drain active jobs before shutdown; terminal-failure cleanup runs after all preparation/writes drain.
- [x] Deterministic pool/mutex tests and real PostgreSQL overlap/stale-snapshot/rollback checks.

Production-scale throughput and a representative staging pilot remain unverified.

- [x] Real concurrent CLI testing exposed transactions switching connections because of installed `pg` Pool-class mismatches. CLI transaction setup now acquires/releases a dedicated connection, also covering Payload uploads. A real DB regression check asserts backend PID/transaction ID stay constant during concurrent pool reads.
- [x] 142 migration unit tests, TypeScript, real rollback/recovery tests and real CLI failure-cleanup/budget/retry/report/BE-gate scenarios passed. Evidence: `/tmp/pw1-pool-unit.log`, `/tmp/pw1-pool-tsc.log`, `/tmp/pw1-pool-db.log`, `/tmp/pw1-pool-batch.log`.
- [x] Standalone media-cleanup integration passed after connection pinning (`/tmp/pw1-pool-cleanup.log`). Removed synthetic fixtures left by the reproduced pre-fix transaction bug; no customer data reset.

## Expanded local PW1 snapshot pilot — 2026-09-15

- Exported 14 additional demo/test stores from the restored PW1 MySQL snapshot. Appended to the same external collection input (16 stores total), preserving the original two bundles byte-equivalent as JSON objects. Full source archives exclude credentials; website projection includes branding, favicon, contacts, SEO, menus, components, banners and media references. Symbolic references validated before append. Unattached/cross-store components remain in source archives and are reported, not attached to another store.
- Batch `6c0f10ca-8fa7-407a-81e3-9ce245ea2e1f`: 10 stores, concurrency 5; 3 completed with warnings, 2 skipped, 5 failed; ledger duration 9.151 seconds.
- Batch `8473d66d-c9eb-4252-b971-39f804019311`: 16 stores, concurrency 5; 5 completed with warnings, 5 skipped, 6 failed; ledger duration 12.212 seconds. Five successful store attempt intervals overlap. No successful store was regenerated in the second run.
- Across both batches: 8 newly migrated stores. Read-back verified logo/favicon presence and normalized contact values for all eight.
- Source failures retained: stores 1036/986 have duplicate active page paths. Stores 1044/1042 use `images.ecommercehub.unifi.com.my`; 1033/1004 use `storage.dev.ecommercehub.my`. These hosts are outside the current media allowlist; no unverified host was allowed or URL rewritten to force success.
- Completed stores retain known BE/pending-feature warnings. These timings include early failures/skips and are not a production throughput estimate.
- Private input: `~/Downloads/stores-205-285-pw2-current-schema-collection-only(1).json`. Private evidence: `~/Work/pw1-exports/reconstruction/pilot-20260915-concurrency5/`. Pre-run local DB backup: `/tmp/pw1-before-10-store-pilot-20260915.dump`. PW1 snapshot was read only; destination was local PostgreSQL, no production reset/publish.

## 30-store stratified local pilot — 2026-09-15

- Appended 14 sampled stores to the same external input; total 30 unique stores, previous 16 unchanged. Seed 20260915; 5 small, 5 medium, 4 large page-count strata from 572 eligible snapshot stores. Did not filter host/path failures out of the sample.
- Batch `b7f8e21b-fea4-4644-8468-f2cf608ff782`, concurrency 5: 11 newly completed with warnings, 10 skipped, 9 failed. New 14-store subset: 11 completed, 3 failed. Ledger 30.891 s; command plus monitoring 35.318 s. Successful-attempt median 7.868 s, nearest-rank p95 11.657 s (n=11).
- 250 ms stage samples observed 5 active generation-stage attempts and 1 write/verify at a time. Read-back verified branding/contact/social/SEO for all 11 successes; 58 persisted pages including 404s.
- New failures: store 18 array-valued legacy banner config; 257 duplicate paths; 185 ICO favicon outside accepted MIME types. Earlier path/media-host failures retained. Exporter social-array projection corrected before measuring; extra same-platform link for store 939 retained in source archive/report.
- Full source archives retain out-of-scope commerce data; website projection does not import it. Private detailed evidence: `~/Work/pw1-exports/reconstruction/pilot-30-20260915/`. Local DB backup: `/tmp/pw1-before-30-store-pilot-20260915.dump`.
- One exploratory local run; skipped/failed stores are not full-generation throughput. No concurrency-1 baseline or production-scale certification. No production mutation.

## Fresh 30-store local rerun — 2026-09-15

- User-requested reset of the exact input scope: 26 previously provisioned sites/tenants and migration cache/history removed; login accounts preserved. DB backup taken first. 248 imported media deleted; 35 conservatively retained possible references. No old cache or media IDs reused.
- Batch `c198e123-08a3-43b7-966a-60350a518b73`, concurrency 5: 21 completed with warnings, 9 source failures, 0 skipped/deferred. Ledger 47.321 s; full command 50.937 s.
- Read-back verified 110 pages and branding/contact/social/SEO for all 21 successful stores. Same known source failures retained; this is not 30 successful migrations or a production throughput guarantee.
- Private evidence: `~/Work/pw1-exports/reconstruction/pilot-30-fresh-20260915/`; backup `/tmp/pw1-before-full-30-reset-20260915.dump`. TypeScript and six cleanup unit tests passed.
