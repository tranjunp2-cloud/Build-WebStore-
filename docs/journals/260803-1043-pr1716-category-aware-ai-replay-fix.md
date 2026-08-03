# PR 1716: Category-aware AI replay fix

## Context

`saveAiProductAction` could treat a committed product in category A as a successful idempotent replay when a retry requested category B after the original response was lost.

## What happened

- Added `TC-F08-04-113` to reproduce the A → lost response → retry with B flow; it failed on the baseline implementation.
- Rejected the initial approach of filtering the replay query by category. A mismatch would look like no replay, allowing `Products` `formatSlug` auto-suffixing to create a duplicate product.
- Kept replay lookup based on tenant and stable AI draft identity, then added an explicit category comparison before accepting the replay.
- Adversarial review found a second timing window: two requests could both miss the replay lookup, then the later writer could be auto-suffixed to `-1` after the first writer committed.
- Added `TC-F08-04-114` and deterministic unique-collision coverage for same-category and cross-category concurrent recovery.

## Decisions

- Throw the deterministic `AI_DRAFT_CATEGORY_CONFLICT` guard when the persisted and requested category IDs differ.
- Preserve same-category idempotent replay while preventing both false success and duplicate creation on category changes.
- Treat UUID-derived AI draft slugs as immutable idempotency keys when `aiReviewPending` is true. The database unique constraint now arbitrates concurrent writers; ordinary and manual duplicate slugs retain auto-suffix behavior.

## Verification

- `TC-F08-04-113` slug-hook regression: baseline returned `stableSlug-1` → fixed implementation returns the exact stable slug.
- Product action tests: 82/82 pass.
- Product collection hook tests: 26/26 pass.
- Combined action/hook verification: 108/108 pass.
- Bulk-create tests: 59/59 pass.
- Typecheck, lint, and `git diff --check` pass.
- Adversarial re-review: APPROVE, no blocking findings.

## Next

- Commit and push the fix, then reply to the PR review with the regression-test evidence.
