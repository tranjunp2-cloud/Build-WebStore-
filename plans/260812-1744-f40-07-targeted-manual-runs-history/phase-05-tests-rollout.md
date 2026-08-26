# Phase 05 — Acceptance tests and rollout verification

## Context

- Issue DoD, `docs/TEST_CONVENTION.md`, AGENTS P1 new-route E2E requirement.

## Implementation steps

1. Add only `[x] AUTO` F40-07 TC rows to `docs/qa/F40-qa-control-center.md` before writing tests: valid preflight, blocked preflight, idempotent dispatch, cancel permission/race, unified filtered history/evidence expiry, browser flow.
2. Add AAA/unit tests for registry/preflight/quota/context and dispatch state transitions, including concurrent different-fixture global quota. Add route tests for all browser APIs and reconciliation plus existing history compatibility, safe projection, seven-day/default filters, pack/test/result filters and auth boundaries.
3. Add a resettable local/E2E fixture that creates only marked QA dispatch/run/result data; it must not call GitHub or use shared staging records. Add cleanup and document the local test environment.
4. Add authenticated Playwright `f40-manual-runs` coverage for: valid preflight, capacity/fixture block, one confirm dispatch, default-seven-day and target/pack/test/result/profile/PR/SHA history filtering, evidence expiry label, and permitted versus terminal cancellation. Also retain unauthenticated boundary coverage.
5. Run `npm run db:migrate` on a clean local DB and an F40-03-existing DB, focused Vitest/API suites, `npx tsc --noEmit`, new Playwright project, and existing F40 Project Health/E2E suites affected by `/studio/qa`. Record external GitHub/Staging (QC) credentials as rollout gates, not mocked proof.

## Release gates

- Before enabling real manual dispatch on shared staging: configure server-side GitHub App/QA ingest secrets, verify one Smoke and one target-specific Regression against resettable fixtures, and inspect ledger/lease cleanup after successful/cancelled/failed runs.
- Roll back by disabling only the manual-run server route/CTA feature flag if supplied by deployment configuration; do not delete ledger records or drop schema.

## Success criteria

- Every automated test cites TC-F40-07 and follows Arrange/Act/Assert.
- No test reimplements production logic or uses arbitrary workflow execution.

## Execution status — 2026-08-13

TC mapping, unit/API tests, a local fixture route and a dedicated Playwright project have been added. Focused Vitest, TypeScript and local migration were successful in this work session. Authenticated Playwright is not a pass: its local-app port/runtime guard has not been cleared, and the current sandbox blocks Chromium during setup (`sandbox_host_linux.cc`) before it can reach the app. Complete this gate on a runnable local environment with the dedicated super-admin fixture; do not treat skipped or blocked browser tests as acceptance proof.
