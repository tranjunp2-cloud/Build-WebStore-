# Phase 05 - Regression QA and Performance Gate

## Context Links

- [Plan](./plan.md)
- [Phase 01](./phase-01-freeze-contracts-and-baseline.md)
- [GH-1190 Phase 4](../260717-1600-gh-1190-generation-critical-path/phase-04-qa-staging-rollout.md)
- [Test Convention](../../docs/TEST_CONVENTION.md)
- [F01 Performance QA](../../docs/qa/F01-gen-perf.md)

## Overview

- Priority: P1
- Status: pending
- Effort: 0.75 day
- Goal: prove locale completeness and PR #1658 performance invariants in the same release gate.

## Automated Test Matrix

| Case | Expected |
|---|---|
| Structurally valid output, detector says wrong locale | Five pages persist; no retry; warning only |
| Cold dynamic locale, no cache | No translator call/await; generation succeeds |
| Homepage omits `localeStrings` | Preserve localized AI fields; no English fill; no terminal error |
| Dynamic locale hero has two CTAs | Both remain; `/about` label localized |
| Blog page hero | Secondary CTA localized; no hardcoded `About Us` |
| Newsletter/blog-list labels | Target locale; persisted labels beat renderer defaults |
| Seed/article wrong-language response | No retry; exactly three locale-safe posts |
| Structural subpage failure | One 10s retry maximum, then locale-safe fallback |
| English generation | Existing English defaults and output remain unchanged |
| Product/media scheduling | Six products and required media completion unchanged |

## Locale Matrix

- `vi`: dedicated non-Latin-diacritic regression case.
- `fr`, `es`, `de`: dynamic Latin locales from reported bugs.
- `zh`: dedicated CJK control.
- One previously unseen locale, such as `pt-BR`: proves the design is dynamic.

Tests may use locale-specific expected fixtures. Production logic may not add locale-specific branches.

## Related Code Files

### Modify

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/docs/qa/F01-gen-perf.md` - final TC mapping and evidence.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/api/ai.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/gen-page-split.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/openai-generator.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/post-ai-swap.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/seed-blog-posts.test.ts`

### Create

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/tests/ai-builder-generation-locales.spec.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/plans/260724-1034-locale-safe-generation-performance/reports/staging-benchmark.md`

## Verification Commands

1. Focused Vitest files for split, locale strings, post-AI swap, hero injection, blogs, and route.
2. `npm run typecheck`.
3. `npm run lint`.
4. Playwright real browser flow for generated locale pages and refresh persistence.
5. Existing generation latency harness against baseline and candidate using identical flags.

## Benchmark Design

- Cohorts: `en`, `vi`, `fr`, `es`, `de`, `zh`.
- Minimum 20 successful runs per cohort for release p95 evidence.
- Same industries, service counts, model flags, provider keys, and cold/warm classification.
- Record:
  - first SSE event;
  - page call count/retry reason;
  - `site_ai`;
  - locale-string source and awaited time;
  - blog preparation/grace;
  - products/media phases;
  - total time;
  - fallback and failure rates.

## Release Gates

### Correctness Gate

- 0 terminal locale guard errors.
- 0 known English fallback labels in non-English rendered output.
- 100% five-page, six-product, three-blog completion.
- 100% intended hero CTA cardinality retained.

### Performance Gate

- Normal page call count exactly three.
- Locale mismatch retry count exactly zero.
- Dynamic translator request-path call count exactly zero.
- Same-cohort `site_ai` and total p95 regress no more than 5% versus PR #1658 baseline.
- GH-1190 target remains total p95 <=60s. If it misses without regression, keep GH-1190 open; do not add a deadline or hide the measurement.

## Implementation Steps

1. Run focused unit/API tests first; fix contract failures before browser/benchmark work.
2. Run typecheck/lint and existing F01 suites.
3. Run browser E2E against a clean account/site and assert rendered content after refresh.
4. Run local timing smoke tests to catch obvious call-tail regressions.
5. Deploy to staging and run the controlled distribution.
6. Compare candidate versus PR #1658 baseline by cohort and cold/warm state.
7. Block merge on correctness failure or >5% p95 regression.
8. Publish benchmark evidence and update both plans' status.

## Todo List

- [ ] Pass focused unit/API suites.
- [ ] Pass typecheck and lint.
- [ ] Add real browser locale regression flow.
- [ ] Complete staging distribution.
- [ ] Publish call-count and p50/p95 evidence.
- [ ] Unblock GH-1190 only after both gates pass.

## Risks

- Model/provider variance: compare distributions under identical cohorts, not isolated screenshots.
- Language detector is unreliable for short labels: E2E asserts rendered labels/fixtures; detector metrics remain advisory.
- Staging account contamination: use clean tenant state and verify exactly three new blog rows.

## Security Considerations

- Use scoped staging credentials and never commit them.
- Reports exclude prompts, tokens, emails, secrets, and business-sensitive text.

## Next Steps

On pass, mark this plan completed, remove it from GH-1190 `blockedBy`, and continue GH-1190 Phase 4 evidence. On fail, revert only the failing locale change; do not alter timeout/media/product optimization to compensate.

