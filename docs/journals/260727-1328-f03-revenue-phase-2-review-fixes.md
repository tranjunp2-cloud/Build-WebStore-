---
date: 2026-07-27
session: f03-completed-revenue-phase-2-review-fixes
---

# Journal: 2026-07-27 — F03 Revenue Phase 2 review fixes

## Context

Phase 2 activated the dashboard Revenue card after the completed-order aggregate and shared UTC contract were implemented. Code review then identified three release-confidence gaps: mocked SQL could not catch real PostgreSQL placeholder failures, the locale test used a private translation fixture, and a stale `.orig` artifact remained in the worktree. The normal host build also shared a root-owned `.next` with the Docker dev server.

## What Happened

- Kept the runtime fix that groups each UTC daily aggregate by select-column ordinal (`GROUP BY 1`), ensuring the timezone parameter is bound once and avoiding the production placeholder mismatch that crashed the dashboard.
- Added a PostgreSQL integration test that calls the production `getGlanceData` path through real Drizzle SQL. It creates session-local TEMP `analytics` and `orders` tables, so it executes all four aggregates without reading or mutating application rows.
- The database fixture verifies completed-only status, tenant isolation, MYR plus legacy-null currency, current/previous UTC boundaries, COD and payment-status neutrality, and current total/delta/sparkline mapping.
- Kept the PostgreSQL regression opt-in through `DATABASE_URI`. The ordinary coverage suite remains DB-independent, while credentialed local runs can execute the production-query test directly.
- Replaced the private EN/MS translation object in the Revenue component test with the real `I18nProvider` and locale JSON bundles.
- Removed the untracked `docs/architecture/F03-dashboard.md.orig` backup after confirming it had no unique content.
- Verified focused tests, the PostgreSQL test, dashboard regression, TypeScript, lint, diff integrity, and an isolated Docker BuildKit production build. The build did not touch the workspace `.next`, and the dev server continued returning the expected dashboard redirect.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Exercise the production loader against real PostgreSQL | A mocked Drizzle template test cannot detect PostgreSQL parameter identity/type behavior | Credentialed runs protect the exact runtime SQL failure class when `DATABASE_URI` is supplied |
| Use TEMP tables on a single-connection pool | Preserve PostgreSQL semantics while avoiding shared-data writes and concurrent `PoolClient` warnings | Test is repeatable, isolated, and non-destructive |
| Keep the DB regression opt-in | The existing coverage suite intentionally runs without application DB access | Credentialed local runs cover PostgreSQL semantics; staging browser QA covers the deployed Vercel→Neon path |
| Render with the real locale provider | Private fixtures can drift independently from shipped JSON | EN/MS Revenue labels and comparison notes are validated from source bundles |
| Build with Docker BuildKit's isolated builder target | Host and dev container share a root-owned `.next` | Production compilation is verified without disrupting local development |

## Validation

- Focused Revenue unit tests: 9/9 passed.
- PostgreSQL production-query regression: 1/1 passed.
- Dashboard unit suite: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with existing repository warnings only.
- `git diff --check`: passed.
- Isolated `docker buildx build --target builder --output type=cacheonly --progress=plain .`: passed.
- No files were staged or committed.

## Operational Handoff

- Run credentialed browser QA for EN/MS and 375/768/1280 layouts with representative tenants.
- Run read-only `EXPLAIN ANALYZE` against representative staging-like order volume before deciding whether a separate index migration is justified.
- The broad repository suite still has unrelated environment-sensitive failures when run with the current host/container database configuration; the scoped dashboard and Revenue gates are green.
