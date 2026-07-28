---
date: 2026-07-27
session: gh-1663-mobile-layout-plan
status: verification_pending
---

# Journal: 2026-07-27 — GH-1663 Mobile Layout Plan

## Context

Issue #1663 addresses AI product draft cards breaking at mobile widths because the desktop
review-row layout compresses the product name and hides variants. Implementation is complete, but
fresh browser verification of the latest TC-F08-04-94 oracle and final approval remain pending; no
commit or PR has been created yet.

## What Happened

- Confirmed the root cause in `BulkCreateModal`: fixed-width controls and a non-responsive row squeeze the name, while `hidden md:block` removes variants on mobile.
- Created the implementation plan at `plans/260727-1753-gh-1663-ai-drafts-mobile-layout/`.
- Phase 1 implemented a responsive, single-DOM grid: Product Name spans the mobile card, Price and
  Stock share equal columns, Variants remain visible and wrapping, and the remove target is 44px.
  Existing edit, remove, and save behavior remains unchanged.
- Phase 2 registered TC-F08-04-94 through TC-F08-04-96 and added deterministic viewport regression
  coverage at `e2e/gh-1663-ai-drafts-mobile.spec.ts`.
- Initial evidence: GH-1663 E2E 3/3, targeted unit tests 56/56, TypeScript typecheck and
  `git diff --check` pass.
- The first code review scored 9.3/10 and approved the implementation with no blocker.

## Post-Code-Review Fix Cycle

- A follow-up review found two P1 coverage gaps: staging CI did not include the GH-1663 spec in its
  explicit filename allow-list, while TC-F08-04-96 only
  checked partial viewport visibility without exercising the unsaved-exit flow.
- Root causes were the workflow's explicit filename allow-list and a weak geometry/behavior oracle
  in TC-F08-04-96. The workflow now selects `gh-1663-ai-drafts-mobile.spec.ts`; TC-F08-04-96 now
  verifies full containment of the panel and controls, Cancel → Stay state retention, and
  Discard → Exit modal closure.
- Prevention evidence: the workflow-equivalent suite increased from 38 tests/11 files to 41
  tests/12 files and includes TC-F08-04-94 through TC-F08-04-96. GH-1663 browser tests pass 3/3,
  targeted unit tests pass 56/56, and TypeScript
  typecheck plus `git diff --check` pass.
- Generated auth state and test/report artifacts were cleaned after verification. The test
  deliberately does not click Approve All.

## Second Review Fix Cycle

- A stricter review identified five evidence/documentation gaps: TC-F08-04-96 did not reassert
  Price and Stock after Stay, did not prove DOM removal or body-scroll restoration after Exit,
  the staging workflow did not select the new spec, the documented unit
  command reproduced only 49 rather than the recorded 56 tests, and the test wording inferred
  product non-persistence without observing the save boundary.
- TC-F08-04-96 now reasserts Name `Edited mobile draft`, Price `88.5`, Stock `7`, and the remaining
  draft count after Cancel → Stay. After Discard → Exit it requires the review panel and
  confirmation dialog to be absent from the DOM and the body's pre-modal overflow value to be
  restored.
- The test never invokes Approve All and records POST requests to Next.js server actions, requiring
  the observed list to remain empty. Documentation now states this observable boundary instead of
  claiming database/product non-persistence.
- Staging workflow now includes `gh-1663-ai-drafts-mobile.spec.ts` in its explicit allow-list; the
  existing `e2e/**` path trigger already covers this spec.
- The targeted unit verification command now includes `bulk-create-parse.test.tsx`, matching the
  three suites that produced the recorded 56/56 result.
- Verification before the latest review cycle passed: GH-1663 browser regression 3/3 with the strengthened TC-F08-04-96
  oracle; targeted unit tests 56/56; and the staging-equivalent selection includes
  TC-F08-04-94 through TC-F08-04-96. TypeScript typecheck and `git diff --check` also passed.
- Generated authentication state and Playwright test/report artifacts were removed after that
  browser run; the latest fixes require fresh verification and re-review before final approval.

## Third Review Fix Cycle

- The final strict review found that TC-F08-04-89 through TC-F08-04-91 were already owned by
  existing API tests, and that TC-F08-04-94 did not prove the complete mobile field/control
  geometry described by its QA row.
- The GH-1663 cases were atomically reassigned to TC-F08-04-94 through TC-F08-04-96 after checking
  `docs/qa`, `src/__tests__`, `e2e`, `tests`, and Git history. Each executable ID now has one owner;
  94 through 96 have no committed historical owner.
- TC-F08-04-94 now requires Price and Stock to share a row, Name to finish above both controls,
  and all six pairs among Name, Price, Stock, and Remove to have zero intersection.
- Parent-plan and journal status remain `verification_pending`. All historical browser `3/3`
  evidence is explicitly qualified as predating the strengthened TC-F08-04-94 oracle.
- Fresh non-browser verification passed: TypeScript, 56/56 targeted unit tests, lint with only
  pre-existing warnings, production build with 113/113 pages, `git diff --check`, targeted
  Playwright discovery, and exact staging-workflow discovery with 41 tests across 12 files.
- Final holistic review approved code/spec/docs at 9.7/10; adversarial and documentation reviews
  returned no actionable findings. Fresh TC-F08-04-94 through TC-F08-04-96 browser execution is
  still pending because the unchanged local auth setup rejects the configured test credentials.

## Reflection

The one-DOM grid preserved product-draft behavior while viewport tests supplied the missing geometry
proof.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Keep Variants visible, wrapping, and read-only despite the issue's literal wording | Variant editing was explicitly excluded from the approved scope | Fixes mobile readability without expanding state or save behavior |
| Use one responsive DOM tree | Avoid duplicate inputs and divergent handlers | Mobile and desktop share existing edit/remove/save logic |
| Place GH-1663 regression in `e2e/` | Match the repository's active Playwright structure | No shared discovery/config change is needed |

## Next

- Refresh the local Playwright test credentials, then require a fresh 3/3 pass for
  TC-F08-04-94 through TC-F08-04-96 before marking the work PR-ready.
- After that gate passes, create the conventional commit and PR to `staging`; record
  `Relates to #1663` and preserve the approved read-only variant scope in the PR description.
