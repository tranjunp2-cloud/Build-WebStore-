# Phase 03 - Bound Blog Tail and Fix SSE Completion Semantics

## Context Links

- [Plan](./plan.md)
- [Phase 02](./phase-02-bound-ai-and-products.md)
- Source: [blog preparation](../../src/lib/ai/seed-blog-posts.ts)
- Source: [builder SSE client](../../src/app/(builder)/builder/new/AIBuilderPageClient.tsx)

## Overview

- Priority: P1
- Status: pending
- Effort: 1 day
- Goal: remove the fixed 15-second tail, make `done` truthful, improve first-event latency, and prevent reconnects from rerunning accepted work.

## Key Insights

- Blog thumbnail work waits for the complete sample-product promise, then runs sequentially.
- The route can add a fixed 15-second `GEN_BLOG_PREP_GRACE_MS` after other required work.
- Capture DB creation and input translation occur before useful generator events.
- Client retries the whole POST after an SSE disconnect, while backend intentionally continues after disconnect.
- Durable idempotent resume would require persisted job state; that architecture is out of scope.

## Requirements

### Functional

- Generate and persist three blog rows/content before `done`.
- On AI content timeout, build complete deterministic localized articles; a one-paragraph excerpt is not a valid completeness fallback.
- Decouple blog text generation from thumbnail gating.
- Replace fixed blog grace with remaining-deadline logic; persist on-topic fallback thumbnails before `done` and defer only better-match upgrades.
- Emit an accepted/started SSE event as soon as auth, rate limit, subscription, and request validation pass.
- Preserve backend completion after client disconnect.
- Client may automatically retry only when the request was never accepted and no SSE event was received.
- Once any event is received, disconnect must not POST a second generation automatically.
- Send `done` only after site completion, required rows, slug sync, and final timing snapshot.

### Non-Functional

- Preserve existing SSE event order after the new accepted event.
- No in-memory dedupe claim for serverless instances.
- No new DB collection or generation-job schema.

## Architecture

Split blog preparation into content, fallback thumbnail preparation, and better-match thumbnail enrichment, mirroring product ownership without coupling the two pipelines. Content generation stays after the site AI long pole to avoid competing for model capacity, but uses the remaining deadline and a complete deterministic article fallback. Thumbnail search can use product keyword context when available, but it cannot wait for product image uploads.

For streaming, establish a simple acceptance boundary:

- Before first event: validation/auth/subscription failures can return normal HTTP errors and client may retry transport failures.
- After first event: backend owns completion; client does not launch a duplicate request. It shows a recoverable connection state and refreshes site status/list after a bounded delay.

Move translation into the streamed pipeline after acceptance. Start generation capture after the first event or concurrently with early work; capture failures remain non-fatal. Do not move authorization or subscription checks after stream acceptance.

## Related Code Files

### Modify

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/app/api/ai/generate-site/route.ts` - early accepted event, completion barrier, deadline-based blog path, final `done` placement.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/app/(builder)/builder/new/AIBuilderPageClient.tsx` - accepted-event tracking and safe retry policy.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/seed-blog-posts.ts` - content/thumbnail split and exact-row enrichment.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/openai-generator.ts` - capture timing placement without weakening error capture.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/user-input-translator.ts` - integrate existing 8-second bound into route deadline.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/api/ai.test.ts` - completion barrier and event contract tests.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/seed-blog-posts.test.ts` - blog split/ownership tests.

### Create

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/builder/generation-sse-retry.test.tsx` - retry-before-acceptance and no-retry-after-acceptance behavior.

## Implementation Steps

1. Refactor blog helper into validated content preparation, row persistence, and optional thumbnail enrichment.
2. Remove the product-image completion gate from blog content. Pass product keywords as an opportunistic promise/value with a short bound.
3. Persist three text-complete blog rows with valid fallback thumbnails before `done`. Attach better matches already resolved; defer only upgrades via exact blog IDs and a returned `after()` Promise.
4. Replace `GEN_BLOG_PREP_GRACE_MS` wait with `min(remainingCriticalPathBudget, smallGrace)` or zero once benchmark shows no benefit. Keep the env knob only during rollout if needed and document both examples.
5. Emit `generation_accepted` immediately after mandatory preflight. Move translation and non-critical capture start behind it, preserving all auth/subscription gates.
6. Track `responseAccepted`/`receivedAnyEvent` in the client. Retry transport only before acceptance; after acceptance, stop automatic POST retry and enter status-recovery UI.
7. Add a completion barrier with named required promises. Resolve it before site status `completed`, slug sync, terminal timing log, and `done`, in that order.
8. Ensure disconnect/abort does not cancel server completion or leave `generationStatus='generating'`.

## Todo List

- [ ] Split blog text/fallback persistence from thumbnail enrichment.
- [ ] Remove product-image gate and fixed 15-second tail.
- [ ] Emit accepted event within preflight SLA.
- [ ] Stop duplicate POST retries after stream acceptance.
- [ ] Make completion barrier and `done` ordering explicit.
- [ ] Add route, helper, and client retry regression tests.

## Success Criteria

- Three complete blog rows with non-empty thumbnails exist when `done` is received.
- Slow thumbnail search cannot add an unbounded tail.
- First event p95 <= 5s on staging.
- An accepted request produces at most one generation from the browser retry logic.
- `generationStatus` settles after client refresh/close.
- `timeMs` matches client-observed time-to-`done` within normal network overhead.

## Risk Assessment

- Early event masks later preflight failure: keep all access/subscription checks before acceptance.
- Browser cannot reconnect to exact stream: do not claim resume; use status recovery and preserve backend completion.
- Lower-relevance fallback visible briefly: require on-topic curated media and never expose a blank/grey slot.

## Security Considerations

- No tenant/site identifiers are trusted from reconnect state without server authorization.
- Accepted event exposes only request ID and generic state.
- Capture/logging continues to redact prompt and user PII.

## Next Steps

Phase 4 validates quality/completeness under fault injection, then runs the required staging distribution before rollout.
