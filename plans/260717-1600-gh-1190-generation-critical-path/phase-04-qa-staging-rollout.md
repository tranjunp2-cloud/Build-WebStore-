# Phase 04 - Regression QA, Staging Benchmark, and Rollout

> **Release amendment (2026-07-24):** Benchmark latency without adding a generation deadline, request abort, client hard timeout, or forced `maxDuration = 60`. Missing the p95 target keeps GH-1190 open; it does not justify terminating otherwise valid generation.

## Context Links

- [Plan](./plan.md)
- [Existing test convention](../../docs/TEST_CONVENTION.md)
- [Existing F01 performance QA](../../docs/qa/F01-gen-perf.md)
- [Red-team review](./reports/red-team-review.md)

## Overview

- Priority: P1
- Status: pending
- Effort: 1.5 days
- Goal: prove latency and completeness together, satisfy issue #1190 AC, and roll out with a fast rollback path.

## Key Insights

- Existing 101 tests prove orchestration mechanics but not staging p50/p95.
- User-reported regression requires browser E2E coverage, not only mocked route tests.
- A 60-second warning cannot coexist cleanly with p95 > 60s; do not hide the warning by raising it before fixing the SLA.
- Vercel `after()` work still counts against function duration. Route `maxDuration` must include bounded deferred tasks.

## Requirements

### Automated Coverage

- Add/update TC IDs in `docs/qa/F01-gen-perf.md` before writing tests.
- Unit: deadline calculation, split-call timeout/fallback, product/blog ownership guards, benchmark percentile calculation.
- API/integration: named completion barrier, product/blog rows with fallback media before `done`, page media before `done`, slug sync included in `timeMs`, deferred upgrade Promise captured by `after()`.
- Frontend: no duplicate retry after first SSE event; retry allowed before acceptance.
- Playwright E2E: real Generate Website flow waits for `done`, then asserts complete five-page navigation, content, images/no grey boxes, three blogs, and stable site status after refresh.

### Benchmark and Rollout

- Benchmark staging with valid QC/E2E auth: EN/MS/VN/JP, five industries, >= 20 successful runs per language.
- Report p50/p95/p99, first-event p95, warning rate, failure/fallback rate, and quality/completeness failures.
- Compare against Phase 1 baseline using the same model flags, cohort, concurrency, and cold/warm classification.
- Canary deferred enrichment flag before default-on production.
- Set route `maxDuration = 60` only after required work targets <=50s and all `after()` upgrades stop by <=58s; otherwise keep issue open and escalate the durable-job scope.

## Architecture

Use four release gates: deterministic unit/API fault injection, real-browser completeness E2E, controlled staging latency distribution, then production canary. Each gate consumes the same completion contract and request-correlated timing fields. A failure blocks the next gate; latency success cannot override a completeness failure.

The benchmark artifact is evidence, not runtime code. Production rollback disables only deferred better-match enrichment while preserving bounded AI calls, visible fallback media, and instrumentation.

## Related Code Files

### Modify

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/docs/qa/F01-gen-perf.md` - Wave 3 TC matrix, benchmark evidence, final verdict.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/api/ai.test.ts` - completion and deferred-work integration tests.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/gen-page-split.test.ts` - timeout/deadline fallback cases.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/sample-products-image-fallback.test.ts` - product split and ownership cases.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/seed-blog-posts.test.ts` - content/thumbnail cases.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/app/api/ai/generate-site/route.ts` - final platform duration after evidence gate.

### Create

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/generation-timings.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/tests/ai-builder-generation.spec.ts` - real browser generation/completeness regression flow.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/plans/260717-1600-gh-1190-generation-critical-path/reports/staging-benchmark.md`

## Implementation Steps

1. Extend the QA matrix with TC-GENPERF-W3 IDs and mark only real automated cases `[x] AUTO`.
2. Add fake-timer/fault-injection tests for hung OpenAI, Pixabay timeout, Payload create/update failure, client disconnect, and stale deferred update.
3. Add route assertions for the completion contract. Mutation check by delaying each required promise and verifying `done` cannot appear first.
4. Add browser E2E for generation and refresh. Assert actual rendered content; do not merely count SSE frames.
5. Run focused Vitest files, then typecheck, lint, and the relevant Playwright project. Record commands and results.
6. Deploy staging with deferred image behavior behind its rollback flag. Run 10% canary or QC-only cohort first.
7. Execute the full benchmark matrix with concurrency matching expected production use. Keep raw timings separate from summary.
8. Compare p50/p95 and quality gates. Investigate any fallback-rate increase before enabling globally.
9. Enable production gradually. Monitor for 24 hours: p95, warning rate, OpenAI/Pixabay failures, `products_no_image`, missing blog thumbnail, incomplete pages, duplicate request IDs.
10. If all work fits, reduce `maxDuration` from 300 to repository-compliant 60. If deferred tasks cannot fit, stop rollout and open a queue/job follow-up instead of silently violating the limit.

## Test Matrix

| Case | Expected |
|---|---|
| Site AI call hangs | Bounded fallback; five pages; no route overrun |
| Product image search hangs | Six rows with category fallback images before `done`; exact IDs may upgrade later |
| Blog thumbnail hangs | Three full posts with category fallback thumbnails before `done`; exact IDs may upgrade later |
| Page/block image upload delays | `done` waits; no incomplete preview |
| SSE disconnect after accepted | No browser re-POST; backend status completes |
| Disconnect before accepted | Bounded transport retry allowed |
| Regeneration before old enrichment finishes | Old task skips stale/deleted/reassigned rows |
| Slug sync delays | `timeMs` and client `done` include delay |

## Todo List

- [ ] Add Wave 3 TC IDs and focused automated coverage.
- [ ] Add real Playwright regression flow.
- [ ] Run typecheck, lint, Vitest, and Playwright.
- [ ] Complete staging p50/p95 benchmark matrix.
- [ ] Canary and verify 24-hour production metrics.
- [ ] Enforce platform duration only after evidence gate.

## Success Criteria

- All issue #1190 AC pass with staging evidence.
- Median improvement >= 50%; p95 <= 60s; first event p95 <= 5s.
- 0 incomplete-page previews and 0 duplicate accepted browser generations in the benchmark cohort.
- Quality checks pass for five pages, input fidelity, six visible products, three full blog posts with thumbnails, page media, and site status.
- Production can be rolled back by one documented environment flag without reverting instrumentation.

## Risk Assessment

- Benchmark auth unavailable: treat as release blocker; QC supplies scoped staging credentials, never commit them.
- Provider/model variance: use distributions and failure rates, not one run.
- `after()` exceeds platform duration: bound work; if still over, escalate to durable queue instead of fire-and-forget.
- Test flakiness: assert event ordering/state, not strict local wall-clock milliseconds.

## Security Considerations

- Benchmark account must be scoped to staging tenant and rotated after use.
- Reports exclude tokens, prompts, emails, and business-sensitive content.
- E2E cleanup deletes only records created by its request IDs.

## Next Steps

On pass, update issue #1190 with benchmark report and `Relates to #1190` in the PR. On fail, retain instrumentation, disable deferred enrichment, and use phase timings to define the smallest follow-up.
