---
date: 2026-07-27
session: gh-1663-mobile-layout-plan
status: completed
---

# Journal: 2026-07-27 — GH-1663 Mobile Layout Plan

## Context

Issue #1663 addresses AI product draft cards breaking at mobile widths because the desktop
review-row layout compresses the product name and hides variants. Implementation and fresh browser
verification are complete on branch `fix/f08-1663-ai-drafts-mobile-layout`; PR #1710 remains open,
and the final regression cases live in `e2e/products.spec.ts`.

## What Happened

- Confirmed the root cause in `BulkCreateModal`: fixed-width controls and a non-responsive row squeeze the name, while `hidden md:block` removes variants on mobile.
- Created the implementation plan at `plans/260727-1753-gh-1663-ai-drafts-mobile-layout/`.
- Phase 1 implemented a responsive, single-DOM grid: Product Name spans the mobile card, Price and
  Stock share equal columns, Variants remain visible and wrapping, and the remove target is 44px.
  Existing edit, remove, and save behavior remains unchanged.
- Phase 2 registered TC-F08-04-94 through TC-F08-04-96 and added deterministic viewport regression
  coverage to `e2e/products.spec.ts`.
- Initial evidence: GH-1663 E2E 3/3, targeted unit tests 56/56, TypeScript typecheck and
  `git diff --check` pass.
- The first code review scored 9.3/10 and approved the implementation with no blocker.

## Post-Code-Review Fix Cycle

- A follow-up review found two P1 coverage gaps: staging CI did not include the GH-1663 spec in its
  explicit filename allow-list, while TC-F08-04-96 only
  checked partial viewport visibility without exercising the unsaved-exit flow.
- Root causes were the workflow's explicit filename allow-list and a weak geometry/behavior oracle
  in TC-F08-04-96. The workflow selects `products.spec.ts`; TC-F08-04-96 now
  verifies full containment of the panel and controls, Cancel → Stay state retention, and
  Discard → Exit modal closure.
- Prevention evidence: the current workflow-equivalent suite selects 43 tests/12 files and includes
  TC-F08-04-94 through TC-F08-04-96. GH-1663 browser tests pass 3/3,
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
- Staging workflow includes `products.spec.ts` in its explicit allow-list; the existing `e2e/**`
  path trigger covers changes to that spec.
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
- At that point, browser evidence still predated the TC-F08-04-94 strengthening.
- Non-browser verification passed TypeScript, 56/56 targeted unit tests, lint, build, diff check,
  and Playwright discovery; a subsequent PR review reopened the browser and oracle gates.

## Fourth Review Fix Cycle

- PR #1710 review found a source-trigger gap, weak TC-F08-04-94/95 geometry oracles, stale evidence,
  and a formal wording mismatch between the issue AC and the defined read-only Variants contract.
- The component-only source trigger was not retained after the workflow was restored; the current
  staging workflow runs these cases when an existing E2E-matching path triggers.
- TC-F08-04-94 now requires usable card-relative Name/Price/Stock widths and full containment.
- TC-F08-04-95 now requires desktop left-to-right order, all pairwise non-intersections, and full
  containment for Name, Price, Stock, and Variants.
- Fresh authenticated Chromium setup plus TC-F08-04-94..96 passed 4/4 on 2026-07-28 using the
  designated dev test account; credentials were not added to source.
- Workflow-equivalent discovery selects 43 tests across 12 files.
- Issue comment #5102689051 records the original contract: Product Name is editable; Variants is
  visible, wrapping, and read-only. PR #1710 already discloses this scope.
- Browser and static verification for this cycle passed; a later re-review identified documentation
  drift after the regression cases were consolidated.

## Consolidation Documentation Fix

- Commit `4963dd6c4` moved TC-F08-04-94 through TC-F08-04-96 into the existing
  `e2e/products.spec.ts` suite and removed the standalone regression spec from the PR delta.
- The existing staging allow-list selects `products.spec.ts`; no workflow modification remains in
  the final PR delta.
- Workflow-equivalent discovery reports 43 tests across 12 files, including TC-F08-04-94 through
  TC-F08-04-96.

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

- Commit and push the verified fixes to existing PR #1710 while preserving `Relates to #1663`,
  the read-only Variants disclosure, and the linked issue clarification.
