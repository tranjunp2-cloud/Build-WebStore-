# Phase 02 - Bound Site AI and Product Critical Path

> **Superseded constraint (2026-07-24):** Do not implement the route-level deadline, route abort controller, client hard timeout, or forced `maxDuration = 60` described below. Those controls were rejected after causing staging failures. Use [the corrective locale/performance plan](../260724-1034-locale-safe-generation-performance/plan.md) for current page-call and fallback policy.

## Context Links

- [Plan](./plan.md)
- [Phase 01](./phase-01-observability-and-baseline.md)
- [Red-team review](./reports/red-team-review.md)
- Source: [split page generation](../../src/lib/ai/gen-page-split.ts)
- Source: [sample products](../../src/lib/ai/generate-sample-products.ts)

## Overview

- Priority: P1
- Status: pending
- Effort: 1.5 days
- Goal: cap the two unbounded long poles while preserving five-page output and preventing image ownership regressions.

## Key Insights

- OpenAI SDK defaults permit roughly 10-minute requests and two internal retries; route/user SLA is much shorter.
- AI-first launches three large calls; failed subpage batches can add another main-model call.
- Product AI uses three manual attempts on top of SDK retries, then resolves six images sequentially before route completion.
- PR #1644 moved too much image work and was reverted by #1656 after block images fell back. Product enrichment must be isolated from page/block media promises.

## Requirements

### Functional

- Introduce one route-level critical-path deadline based on monotonic time and pass remaining budget to AI/product helpers.
- Bound each OpenAI request with explicit timeout and retry policy; disable hidden SDK retries where application fallback already exists.
- Keep composer/curated fallbacks and the exact-five-page validation.
- Split sample product preparation into data and image enrichment.
- Persist six product rows before `done`, even when image enrichment times out.
- Every persisted product has an on-topic fallback media ID before `done`; enrichment may replace it but never fills an initially blank card.
- Deferred image updates may target only exact product IDs created by this run.
- Page/block image pool, pre-upload, fulfillment, and media completeness remain mandatory and isolated.

### Non-Functional

- No concurrent Payload media creates outside `withMediaCreateLock`.
- No DB schema change.
- No general-purpose queue in this issue.
- One kill switch for deferred product images is acceptable; document it in both environment examples.

## Architecture

Create a deadline utility that derives `remainingMs` and refuses to start optional work once exhausted. Initial budget proposal, calibrated with Phase 1 evidence: route ceiling 58s, `done` barrier target 50s, final 8s reserved for bounded `after()` enrichment and cleanup. Site generation uses bounded calls and preserves the current call-level fallback order. Retry only invalid/missing batch output when enough budget remains; timeout/network failure falls directly to deterministic composer output.

Refactor product generation into:

1. `prepareSampleProductData`: bounded AI call, validated six-product data, curated fallback.
2. `prepareProductFallbackMedia`: prefetch bounded, category-curated fallback media after required page pool pre-upload gets lock priority; downloads may be concurrent but Payload creates remain globally serialized.
3. `enrichSampleProductImages`: better-match stock search/download/upload with per-item timeout and existing media lock.
4. Route persistence: create rows with ready matched images or fallback media IDs; schedule one returned `after()` Promise only to improve fallback images.

The deferred closure receives immutable `{productId, siteId, generationRequestId}` ownership. Before update, re-read the row and skip if deleted, reassigned, or already has a newer image.

## Related Code Files

### Modify

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/app/api/ai/generate-site/route.ts` - deadline propagation, product row-first persistence, returned deferred task.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/openai-generator.ts` - explicit bounded site-generation client/call options.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/gen-page-split.ts` - remaining-budget retry decision and fallback timing.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/generate-sample-products.ts` - split data preparation from image enrichment.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/.env.staging.example` - rollback flag placeholder/default.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/.env.production.example` - rollback flag placeholder/default.

### Tests

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/gen-page-split.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/sample-products-image-fallback.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/api/ai.test.ts`

## Implementation Steps

1. Add a small monotonic deadline helper. Keep constants centralized; avoid many environment knobs.
2. Configure OpenAI clients/calls with explicit timeout and `maxRetries: 0` where existing application retries/fallbacks apply.
3. On first site-call timeout/network error, use composer fallback. Retain one main-model retry only for structurally incomplete subpage output and only when remaining budget can cover it.
4. Add timing/outcome fields per split call: model task, duration, timeout, validation failure, retry, fallback. Never log prompt content.
5. Extract product data generation and validation from image resolution. Keep six-item curated fallback deterministic.
6. Prepare deterministic category fallback media during the AI window, only after required page pre-upload has priority. Reuse safely where needed; never create product rows with empty image arrays.
7. Start better-match enrichment concurrently after product data settles, but never gate page/block media on it.
8. Persist product rows in the route. Attach completed matched images or fallback media; register a returned `after()` task only for fallback upgrades.
9. In deferred updates, address exact IDs, re-check ownership/state, and update idempotently. A failed upgrade leaves the visible fallback intact.
10. Add regression tests proving page/block media still resolves before `done` and no product task consumes or blocks the page image pool.

## Todo List

- [ ] Add critical-path deadline and bounded OpenAI policy.
- [ ] Preserve five-page validation and deterministic fallback.
- [ ] Split product data from image enrichment.
- [ ] Persist product rows with visible fallback media before `done`.
- [ ] Defer only better-match image upgrades with exact-row ownership.
- [ ] Add block-image regression tests for the #1644/#1656 failure mode.

## Success Criteria

- A stuck site/product OpenAI call cannot extend the route beyond its declared budget.
- Five valid pages are produced by AI or composer fallback.
- Six product rows with non-empty images exist at `done`; better matches may update the same rows later.
- Regeneration/deletion cannot be overwritten by an old deferred task.
- Page/block image completeness is unchanged.

## Risk Assessment

- Lower timeout reduces AI quality: retain deterministic composer fallback and benchmark content fixtures.
- Deferred task outlives request: return the Promise to `after()`, bound every network operation, and keep total under platform duration.
- Stale writes: exact IDs plus ownership/state re-check; never query broad SKU/site sets for updates.
- Provider overlap: do not change `pixabay-client` or provider router contracts in this plan.

## Security Considerations

- Product data remains schema-validated and tenant/site-scoped.
- Deferred reads/updates use server-side Payload override only with exact tenant-owned IDs.
- Do not expose model errors or stock URLs in client responses.

## Next Steps

Phase 3 applies the same deadline semantics to blog completion and fixes duplicate client retries.
