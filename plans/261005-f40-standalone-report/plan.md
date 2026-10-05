---
title: F40 standalone report isolation
status: in-progress
priority: P1
effort: medium
branch: fix/F40-1907-standalone-report
tags: [f40, migration-report, isolation]
created: 2026-10-05
---

# F40 standalone report isolation

Approved scope: ship only F40 QA functionality; no F42 importer, exporter,
storefront, schema pipeline, or user-owned assets.

- [x] Create clean branch from fresh origin/staging.
- [x] Port F40-only QA UI, APIs, helpers, tests and documentation.
- [x] Decouple the reader contract from F42 exporter implementation.
- [x] Return structured 503 source-unavailable when required schema is absent.
- [x] Verify the isolated branch (typecheck, unit tests, focused browser tests).
- [x] Review isolated scope/security; final review reports no blockers.
- [ ] Push the F40 branch and open PR into staging.

Verification complete: isolated TypeScript check and 58/58 unit tests passed.
Real-browser TC12 against a schema-only database without F42 passed (6.2s);
TC09 against the existing database, read-only via the isolated app on port 3105,
passed (33.8s). Lint reported 0 errors and 8 Hook warnings; diff check passed.
An unrelated F35 test was excluded from this branch; the reviewed image-loader
issue was fixed. Push and PR creation remain pending.

Missing F42 data must never become synthetic evidence or a successful result.
No automatic F42 migrations or data writes are part of this branch.
