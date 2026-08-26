# Phase 01 — Persisted finding contract and atomic lifecycle

## Overview

Priority: P1. Establish the only source of truth for findings before building UI or GitHub
promotion.

## Related files

- Create `src/collections/QaFindings.ts`.
- Create `src/lib/admin/qa/findings.ts` and, only if transaction coordination needs it,
  `src/lib/payload/qa-findings-transaction.ts`.
- Modify `src/payload.config.ts`, `scripts/db-setup.js`,
  `src/app/api/admin/qa/ingest/route.ts`, and `src/lib/admin/qa/health-calculator.ts`.

## Data contract

Persist scalar fields/relationships only: canonical fingerprint; target ID; run/result
relations; suite, TC-ID, assertion code, expected/actual counts; constrained severity and
lifecycle; owner; latest safe evidence reference/expiry; promotion state; linked mirrored
GitHub issue; timestamps; bounded lifecycle audit. Server-controlled writes; super-admin
reads.

`qa_findings` migration must use `CREATE TABLE IF NOT EXISTS`, additive columns and indexes,
including a global unique fingerprint index. Add the collection slug. Do not use a Payload array
unless its exact child-table migration convention is also supplied.

## Steps

1. Define strict TypeScript/Zod domain types, lifecycle transition table and a canonical
   fingerprint function. Reject unsafe/malformed inputs.
2. Add `QaFindings`, Payload registration and idempotent SQL migration/indexes.
3. Extend signed ingestion, after run/result persistence, to process failed test results in
   the same transaction. Acquire sorted fingerprint advisory locks then use conflict-safe
   insert/read rather than a racy find/create or an aborted transaction after unique violation.
4. On same active fingerprint, retain the one finding and append/update only safe latest
   run/result evidence. On a matching later failure after `verify_fix`, reopen it.
5. Define and implement the narrow verification API used by a required matching retest pack:
   only a suitable terminal pass may move a finding to `verify_fix`; a generic pass cannot.
6. Feed active findings into health precedence after existing F40-05 critical issue behavior;
   do not make a terminal/verified finding look open.

## Risks and checks

- Concurrency is the primary risk: prove lock ordering, global unique fingerprint and conflict
  handling with tests.
- Keep evidence safe: retain only existing approved/signed projection, never raw trace/video.
- Document severity source; do not infer one from unsanitized test output.

## Done

- [x] Migration and collection satisfy repo P0 schema rules.
- [x] Fingerprint is stable and secrets-free.
- [x] Duplicate active failures and post-fix reopen are deterministic.
- [x] Health uses open finding evidence without false green.
