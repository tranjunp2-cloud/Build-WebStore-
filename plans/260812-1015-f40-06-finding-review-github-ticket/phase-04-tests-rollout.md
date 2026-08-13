# Phase 04 — Automated verification and rollout evidence

## Overview

Priority: P1. Add test cases first, then prove lifecycle, security and browser behavior.

## Related files

- Modify `docs/qa/F40-qa-control-center.md`.
- Create `src/__tests__/unit/qa/f40-findings.test.ts` and
  `src/__tests__/api/f40-findings.test.ts`.
- Create `tests/f40-findings.spec.ts`; adjust `playwright.config.ts` only if the fixture project
  needs an explicit safe configuration.

## Steps

1. Define only relevant `[x] AUTO` TC IDs in the F40 QA document before test implementation.
2. Unit-test fingerprint determinism, allowed lifecycle transitions, partial-unique conflict
   reconciliation, required-pass verification and later failure reopening (AAA + TC-ID labels).
3. API-test 401/403, strict validation, safe list/detail, cancel-without-GitHub, confirmation,
   double-submit/retry, returned URL validation and GitHub 5xx/ambiguous failure retention.
4. Add Playwright coverage required by the story: review a fixture finding, cancel promotion with
   zero GitHub creation, confirm once and display linked issue. Use resettable QC fixture IDs;
   skip only with a clear missing-environment reason.
5. Run focused Vitest/API suites, TypeScript/lint checks and Playwright. Run migration-only in
   staging build and capture schema/index evidence.
6. Before rollout, verify GitHub App permissions can create issues and the configured evidence
   URLs remain reachable. Roll back by disabling promotion availability; never delete findings.

## Done

- [x] Definition of Done test coverage is satisfied. Focused unit/API coverage passes (24/24
  assertions) and the authenticated Playwright project passes setup plus
  `TC-F40-06-05` (2/2) against the local PostgreSQL environment.
- [x] No new process environment variable lacks placeholders in both env examples.
- [x] CI/manual staging blockers are reported separately from code failures.

## Execution note

On 2026-08-12, the local Docker PostgreSQL environment was migrated with
`npm run db:migrate`; the configured E2E super-admin was seeded with `npm run db:seed-sso`.
With the app running at the allow-listed `http://localhost:3000`,
`npx playwright test --project=f40-findings` passed setup and `TC-F40-06-05` (2/2).

Staging rollout evidence remains an operational deployment check: run migration-only there and
verify the GitHub App/evidence-link configuration before enabling real issue promotion. The
browser test intentionally intercepts the promotion endpoint, so it never creates an external
GitHub issue during automated testing.
