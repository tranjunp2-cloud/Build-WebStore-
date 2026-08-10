# Phase 04 — Verification, staging pilot, and adversarial re-review

**Status:** partially completed — automated verification and review complete; manual staging gate pending external configuration · **Migration:** no · **Depends on:** Phases 01–03

## Automated verification

1. Read `docs/TEST_CONVENTION.md`; execute all new tests with TC IDs and AAA layout. Run focused F40 unit/API suites, then `npm run typecheck`, `npm run lint`, relevant Playwright discovery, and `git diff --check`.
2. Run migration-only validation against a disposable/staging-safe DB path; confirm no `DROP TABLE`, new slugs, collection tables, indexes, and payload field names align.
3. Run targeted Playwright packs independently. Verify test discovery returns exactly the registry count/TC IDs—not 0 and not a broad project.
4. Run API/transaction race test with parallel claim attempts; assert exactly one active capacity-1 lease.
5. Test valid terminal result, forged HMAC, stale HMAC, replay, wrong dispatch ID, wrong SHA, missing TC, extra TC, late terminal, expired lease and safe artifact rejection.

## Manual staging gate

With flag disabled, apply migration. Then manually trigger each of the 3 approved packs on dedicated staging fixtures and record: dispatch ID, GitHub run URL, SHA, named TC results, fixture cleanup/lease release, and safe evidence URL. Execute two concurrent requests against one fixture to prove one `blocked` record and no second browser run. Wait/reconfigure a short test lease to verify expiry recovery.

Enable staging flag only after all evidence is attached to PR. Observe three real mapped staging deploys. A no-map/no-pack deploy must produce a visible non-execution record, not a full fallback. Rollback is flag-off only.

## Code-review protocol

Run `$ck:code-review` on the final PR diff after testing. Its adversarial pass must specifically inspect:

- request/ingest HMAC and timestamp replay boundaries;
- GitHub App token scope, logs, private-key handling and SSRF/injection paths;
- registry parsing/path traversal and shell interpolation;
- transaction isolation, capacity race, expired/late lease behavior and compensation failures;
- immutable identity and terminal result substitution;
- Payload migration and environment-example compliance;
- proof that every Smoke assertion is a real critical-flow TC, not merely a 200 response.

Fix all P0/P1 findings and rerun the relevant tests plus fix-diff review before requesting human review. PR must use `Relates to #1742` and include the AC-to-test matrix.

## Completion criteria

- All automated checks green, manual staging evidence complete, and code-review has no unresolved P0/P1 findings.
- Scope remains US-F40-03; any Studio UI, issue-sync or manual-run request is opened as its corresponding F40 story rather than appended here.
