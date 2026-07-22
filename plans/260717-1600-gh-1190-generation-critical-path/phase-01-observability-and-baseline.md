# Phase 01 - Instrument and Capture Baseline

## Context Links

- [Plan](./plan.md)
- [Scout report](./reports/scout-report.md)
- [Existing QA baseline](../../docs/qa/F01-gen-perf.md)
- Source: [generate-site route](../../src/app/api/ai/generate-site/route.ts)

## Overview

- Priority: P1
- Status: pending
- Effort: 1 day
- Goal: replace the current `ai/media/db/other` approximation with client-visible, correlated phase timings and establish a repeatable staging baseline.

## Key Insights

- Current `ai` includes capture writes and post-processing; `media` excludes pool/pre-upload waits; `db` excludes site/product/blog writes.
- `timeMs` is calculated before `syncTenantSlug()`, so logs under-report time-to-`done`.
- Source flags may differ from staging Vercel values; benchmark results are invalid without recording effective runtime configuration.
- `scripts/measure-variety.ts` is useful for content variety, not latency distribution or SSE timestamps.

## Requirements

### Functional

- Assign one non-PII `generationRequestId` per client attempt and include it in client, route, and phase logs.
- Record `request_received`, `first_sse_event`, `done_sent`, and failure timestamps.
- Record phases: `preflight`, `translation`, `capture_start`, `image_pool`, `pool_preupload`, `site_ai`, `media_fulfill`, `site_write`, `pages_write`, `products_data`, `product_images`, `products_write`, `blog_prepare`, `blog_grace`, `blog_write`, `site_complete`, `slug_sync`.
- Log overlap explicitly; do not sum overlapping phases as total wall time.
- Report both `pipelineMs` and `clientDoneMs`; keep existing `timeMs` compatibility until consumers/tests migrate.
- Add a dedicated SSE benchmark runner that measures TTFB, first event, `done`, HTTP/SSE failures, and phase breakdowns.

### Non-Functional

- No new SaaS dependency or DB schema.
- No business input, prompt, token, email, or auth header in timing logs.
- Instrumentation overhead target <= 50ms per run.

## Architecture

Use a small request-scoped timing recorder in the route. It stores `{startedAt, endedAt, durationMs, outcome}` by phase, emits one structured terminal log, and exposes only safe aggregate fields in the SSE `done` payload. Promise creation and settlement timestamps must be measured separately so concurrent work remains visible.

The benchmark runner consumes the raw SSE stream and timestamps bytes/events at the client boundary. It outputs JSON for comparison and a short Markdown summary with p50/p95/p99 by language, industry, cold/warm start, and success/failure.

## Related Code Files

### Modify

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/app/api/ai/generate-site/route.ts` - request correlation, complete phase timings, final clock placement.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/app/(builder)/builder/new/AIBuilderPageClient.tsx` - generate/send request ID and record first accepted SSE event.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/api/ai.test.ts` - timing and payload compatibility tests.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/docs/qa/F01-gen-perf.md` - new TC IDs and benchmark protocol.

### Create

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/generation-timings.ts` - request-scoped timing type/helper if route-local code becomes noisy.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/scripts/measure-generation-latency.ts` - authenticated SSE benchmark runner.

## Implementation Steps

1. Capture effective model/flag names without secret values: generation mode, page split, pool pre-upload, model task aliases, blog grace, and route deployment SHA.
2. Add `GenerationTimings` with explicit start/settle APIs and terminal outcome. Preserve concurrent promise timing instead of wrapping only later `await` points.
3. Move terminal duration computation until after required completion and `syncTenantSlug()`. Emit `done_sent` immediately before enqueueing the SSE `done` frame.
4. Add `generationRequestId` to request body/header, route logs, error logs, and safe `done` metadata. Reject malformed or oversized IDs and generate a server fallback.
5. Build `measure-generation-latency.ts` using the existing E2E authentication setup. Keep credentials in environment variables; never add working tokens to repository files.
6. Run a baseline matrix before Phase 2: EN/MS/VN/JP, five representative industries, minimum 20 successful samples per language. Separate cold starts and retries.
7. Save raw JSON and summarized p50/p95/p99 as a dated report under this plan's `reports/`; do not commit secrets or full prompts.

## Todo List

- [ ] Add correlated, overlap-aware phase timings.
- [ ] Make `timeMs` include slug sync and required completion work.
- [ ] Add benchmark runner and QA TC IDs.
- [ ] Capture effective staging runtime flags.
- [ ] Produce baseline distribution with failure rate.

## Success Criteria

- A single request can be traced from browser start to SSE `done` by ID.
- Timings account for >= 95% of client-observed wall time without double-counting overlaps.
- Existing SSE consumers remain compatible.
- Baseline includes p50/p95/p99 and failure counts, not single-run anecdotes.

## Risk Assessment

- High-cardinality logs: use request ID only; do not create metric labels from business names.
- Benchmark quota/cost: throttle cohorts and record model usage; abort after error threshold.
- Misleading totals: document overlap and compare critical path, not summed durations.

## Security Considerations

- Preserve auth/rate-limit/subscription checks before generation work.
- Validate request ID as UUID or bounded ASCII token.
- Redact prompts, user input, cookies, tokens, and tenant personal data.

## Next Steps

Phase 2 starts only after the baseline identifies the observed long pole and confirms staging flags.
