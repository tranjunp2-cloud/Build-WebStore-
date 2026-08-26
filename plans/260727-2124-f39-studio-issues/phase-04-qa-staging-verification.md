# Phase 4: Verify QA and Staging Release

## Context Links

- [Implementation plan](./plan.md)
- [Runtime promotion](./phase-03-runtime-promotion-dedup.md)
- [Test convention](../../docs/TEST_CONVENTION.md)
- [F39 PRD: Definition of Done](../../docs/prd/F39-studio-log-issue-tracking.md#definition-of-done)

## Overview

- **Priority:** P1
- **Status:** In progress; staging gates blocked
- **Effort:** 1h
- **Acceptance criteria:** AC-01–AC-16

## Requirements

### Functional

- Map every AC to a `TC-F39-*` case.
- Cover real super-admin browser flow and non-super-admin denial.
- Verify both live providers on staging.

### Non-functional

- Tests import real source logic, follow AAA, and automate only `[x] AUTO` QA cases.
- Test fixtures contain no production tokens, telemetry, or personal data.
- Each provider returns or terminates within 10 seconds.

## Related Code Files

- **Create:** `docs/qa/F39-studio-live-errors.md`
- **Create:** `e2e/f39-studio-live-errors.spec.ts`
- **Run:** Phase 1 unit/API tests and Phase 3 promotion tests

## Implementation Steps

1. Create the QA matrix before tests; map AC-01–AC-16 and mark browser/unit/API cases `[x] AUTO`.
2. Follow `docs/TEST_CONVENTION.md`: TC IDs, AAA, source imports, and top-level mocks.
3. Unit-test sanitizer canaries, URL/path stripping, provider keys, custom/platform/unknown tenant mapping, every guidance category/fallback, and exact correlation/non-correlation.
4. API-test `400/401/403/502/504`, empty versus unavailable, deadlines/count caps, sanitized DTOs, zero-write reads, provider-refetch promotion identity, create failure, and race-safe deduplication.
5. Playwright-test success, empty source, one failed source, both failed with Tracked Issues usable, detail/unknown/guidance, manual promotion, repeat promotion, promotion failure/retry, close-without-write, and non-super-admin denial.
6. Regression-test tracked issue detail, status, assignee, comments, timeline, and the dynamic route-param fix if Phase 3 required it.
7. Run:
   - `npm run typecheck`
   - `npm run lint`
   - focused `npm test -- <F39 test paths>`
   - `npm run test:e2e -- e2e/f39-studio-live-errors.spec.ts`
   - `npm run db:migrate` against a disposable/staging-like database
8. Smoke both real staging providers and inspect network/DB evidence: no token, raw provider JSON, or excluded field reaches browser/database; browser-edited evidence cannot change provider identity.
9. Record per-source duration, accepted count, fetch time, provider timestamp, and degraded-state result.
10. Verify route/file diffs contain no `/studio/logs`, `/studio/generations`, AI, webhook, Drain, cron, queue, polling, or telemetry-persistence work.

## Todo

- [ ] QA matrix covers AC-01–AC-16 (AC-14 remains explicitly blocked)
- [ ] Unit/API/Playwright suites pass
- [ ] Typecheck and lint pass
- [ ] Migration dry-run is idempotent and non-destructive
- [ ] Both real staging provider contracts pass
- [ ] RBAC, privacy, zero-write, and exact-dedup gates pass
- [x] `/studio/generations` remains unchanged

## Success Criteria

- All Definition of Done items in PRD v4 pass with attached test evidence.
- If either real provider fails, report the affected acceptance criteria blocked; do not claim two-source delivery.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Provider tests become flaky | False release signal | Contract fixtures for CI; real-provider smoke as explicit release gate |
| Staging data leaks into fixtures | Security incident | Synthetic fixtures only; secret scan |
| One-day timebox hides regression | Broken tracked workflow | Preserve lifecycle regression as non-cuttable |

## Next Step

Release only after both real-provider smoke checks and all non-cuttable gates pass.
