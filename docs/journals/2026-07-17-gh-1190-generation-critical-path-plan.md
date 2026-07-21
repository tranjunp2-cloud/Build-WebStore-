# 2026-07-17 - GH-1190 Generation Critical-Path Plan

## Context

Issue #1190 remains open because the current parallel generation mechanics pass tests, but staging p50/p95 is unverified and local JP/VN results still exceed the 60-second target.

## Findings

- Remaining long poles are site AI retries/timeouts and sample-product image work.
- Product/blog/image work is hidden in the current `other` timing bucket.
- `timeMs` excludes tenant slug sync even though the browser waits for it.
- The client can retry a full accepted generation after disconnect while the backend continues.
- Fixed blog grace and product-to-blog image gating amplify the tail.

## Decision

Plan a four-phase critical-path optimization: accurate baseline, bounded AI/product work, blog/SSE completion semantics, then staging benchmark and canary. Keep page/block media, product/blog rows, full content, and visible category fallback images mandatory before `done`; allow only better-match image upgrades later under strict ownership and bounded `after()` tasks.

## Scope Guard

No durable queue, image-provider redesign, DB schema, or concurrent Payload media creates in this issue. If deferred work cannot fit the 60-second Vercel duration, escalate to a separate durable-job design instead of weakening completion guarantees.

## Notes

Repository `docs/development-rules.md` is absent. The plan follows root `AGENTS.md`, `docs/TEST_CONVENTION.md`, and `docs/qa/F01-gen-perf.md` instead.
