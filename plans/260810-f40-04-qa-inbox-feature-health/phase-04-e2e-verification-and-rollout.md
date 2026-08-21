# Phase 04 — E2E, migration verification and rollout

## Context links

- Parent: [plan.md](plan.md); depends on [Phases 01–03](phase-03-inbox-and-feature-detail-ui.md).
- Docs: `docs/TEST_CONVENTION.md`, F40 QA test-case document, AGENTS.md testing/migration rules.

## Overview

- Date: 2026-08-10; Description: prove issue ACs against persisted QA data and roll out safely; Priority: P1; Implementation status: pending; Review status: pending.

## Key Insights

- New API/UI routes require browser E2E, not mocked client unit coverage.
- Smoke only proves availability; acceptance needs priority, evidence and action flow tests.

## Requirements

- Map every automated test to F40 TC IDs; use AAA and existing Playwright conventions.
- Cover authenticated super-admin Inbox priority, detail fields, safe/expired evidence, unknown state, visual pending-review/no ticket, 375px and keyboard flow.
- Verify migration in staging-like DB and ensure legacy/missing data stays Unknown.

## Architecture

- Seed/ingest approved test runs/results through QA contract; assert browser-visible behaviour and outbound GitHub non-creation.
- Run focused F40 E2E locally/CI, then deployment smoke plus the defined critical workflows on staging.

## Related code files

- `tests/*.spec.ts`, `docs/TEST_CONVENTION.md`, `scripts/db-setup.js`, QA workflow/config files changed by prior phases.

## Implementation Steps

1. Add/update F40 test case mapping and browser fixtures through sanctioned setup routes.
2. Write AC-mapped E2E scenarios including ordering and Product Grid evidence detail.
3. Run lint/typecheck, targeted E2E, regression set required by changed flows, migration verification, then code review.
4. Deploy to staging, validate real non-sensitive results and mobile/keyboard manually; monitor errors before PR handoff.

## Todo list

- [ ] Add E2E only for auto-marked F40 cases.
- [ ] Test authorization and error/empty/unknown states.
- [ ] Verify migration and query performance.
- [ ] Record test evidence and PR description `Relates to #1743`.

## Success Criteria

- All approved #1743 ACs pass in staging; any deferred functional retest is explicitly excluded/approved, never masked by a fake CTA.

## Risk Assessment

- CI data/keys may be unavailable; tests must fail clearly or use approved seeded contract, never silently report Healthy.

## Security Considerations

- Test fixtures contain no real credentials; evidence assertions use sanitized metadata and protected routes.

## Next steps

- Open one conventional-commit PR to `staging`, request review, then coordinate F40-05/F40-07 integration only after their gates pass.
