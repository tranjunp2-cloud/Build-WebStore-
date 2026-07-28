# Phase 01 - Freeze Contracts and Baseline

## Context Links

- [Plan](./plan.md)
- [Impact Analysis](./reports/current-branch-impact.md)
- [GH-1190 Plan](../260717-1600-gh-1190-generation-critical-path/plan.md)
- [Test Convention](../../docs/TEST_CONVENTION.md)
- [F01 Performance QA](../../docs/qa/F01-gen-perf.md)

## Overview

- Priority: P1
- Status: pending
- Effort: 0.5 day
- Goal: turn the user's functional and latency expectations into executable contracts before control-flow edits.

## Requirements

### Functional

- Define one generation contract for English, dedicated non-English locales, and dynamic non-English locales.
- Required output: five pages, all intended block structures, all existing CTA slots, six products, exactly three generated blogs.
- A detector warning must not convert a structurally valid result into a failed generation.
- No local fallback may introduce English text into a non-English site.

### Performance

- Record normal page GPT call count and retry reason.
- Record `site_ai`, blog preparation/grace, products, media fulfilment, and total timings.
- Use the same model flags and environment for baseline and candidate.
- Explicitly assert no awaited dynamic translator in the normal request path.

## Architecture

Create a small test-only generation-call ledger around existing OpenAI mocks. Classify each call by owner:

- `page-home`
- `page-batch-about-services`
- `page-batch-contact-blog`
- `page-structural-retry`
- `blog-seeds`
- `blog-article`
- `locale-translator`

Tests assert budgets by owner, not fragile total mock order.

## Related Code Files

### Modify

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/docs/qa/F01-gen-perf.md` - add TC IDs for locale correctness plus call-budget invariants.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/gen-page-split.test.ts` - call counts and retry reasons.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/api/ai.test.ts` - completion counts and phase timing contract.

### Create

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/generation-locale-call-budget.test.ts` - focused network-call budget tests.

## Implementation Steps

1. Add QA cases for five-page locale output, preserved CTA slots, three localized blogs, and zero locale-triggered retry.
2. Capture an `origin/staging` baseline and current-branch baseline with identical mocked response fixtures.
3. Add a test fixture where every page is structurally valid but the detector reports the wrong locale.
4. Add a cold dynamic-locale fixture with no cached structural strings.
5. Add a blog fixture where the detector rejects otherwise returned content.
6. Assert the current regression first: extra calls or terminal locale error. Keep tests behavior-oriented so Phase 2-4 make them pass.
7. Record real local timing samples using the existing generation latency script; do not treat one run as p95 evidence.

## Todo List

- [ ] Add TC IDs before new tests.
- [ ] Establish PR #1658 and current-branch call-count baselines.
- [ ] Add locale mismatch, cold-cache, and blog mismatch fixtures.
- [ ] Lock five-page/six-product/three-blog/CTA contracts.

## Success Criteria

- Tests can distinguish structural retry from locale retry.
- Baseline report shows exactly which added awaits/calls belong to the branch.
- No implementation starts without a failing regression test for its behavior.

## Risks

- Detector mocks may hide real false positives: include short labels and mixed proper nouns seen in screenshots.
- Wall-clock unit tests are flaky: assert call topology and use timing harness only for distributions.

## Security Considerations

- Test fixtures contain synthetic businesses only.
- No prompts, API keys, or user data enter benchmark artifacts.

## Next Steps

Phase 2 supplies locale context through an existing page call, removing the need for a blocking translator.

