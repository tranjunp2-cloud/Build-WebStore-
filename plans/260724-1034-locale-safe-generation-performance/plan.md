---
title: "Locale-safe generation without latency regression"
description: "Keep all locale correctness fixes while restoring the PR #1658 generation critical path and call budget."
status: pending
priority: P1
effort: 3.5d
branch: codex/fix-cjk-products-blog-placeholders
tags: [bugfix, backend, api, localization, performance, critical]
blockedBy: []
blocks: [260717-1600-gh-1190-generation-critical-path]
created: 2026-07-24
---

# Locale-Safe Generation Without Latency Regression

## Overview

Refactor the current branch so dynamic locales remain complete and free of injected English text without adding synchronous translation calls, locale-driven retries, fatal language-detector gates, or changes to the media/product concurrency introduced by PR #1658.

The implementation keeps all required pages, blocks, CTA slots, six products, and three blog posts. It does not solve locale correctness by deleting content.

## Hard Invariants

### Performance

- Normal page generation remains exactly three parallel GPT calls.
- Locale mismatch never triggers another page GPT call.
- Only structural batch failure may trigger one existing 10-second retry.
- Dynamic structural strings add zero network round-trips to the request path.
- Blog generation makes at most one seed call plus three parallel article calls.
- No new generation deadline, route abort controller, client hard timeout, or `maxDuration` change.
- Image pool, pool pre-upload, media fulfilment, product overlap, and `after()` imglib seeding remain unchanged.

### Correctness

- Preserve the five-page contract, selected block structure, and every required CTA slot.
- Preserve two hero CTAs when the generated/template block has two.
- Local code must not insert English human-facing text into a non-English site.
- Dynamic locale handling must not add per-locale branches or tables.
- Persist exactly three generated/localized blog posts; never append a default English post.
- Keep existing CJK slug, product count, blog-label persistence, and migration fixes.

## Cross-Plan Dependencies

| Relationship | Plan | Decision |
|---|---|---|
| Blocks | [GH-1190 Generation Critical Path](../260717-1600-gh-1190-generation-critical-path/plan.md) | GH-1190 Phase 4 cannot benchmark/close against a branch that adds locale retry and translator tails |
| Overlap only | [F26-02 Localized Block Defaults](../260526-1116-f26-02-localized-block-defaults/plan.md) | Reuse locale-string ownership; do not change editor add-block behavior |

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Freeze Contracts and Baseline](./phase-01-freeze-contracts-and-baseline.md) | Pending |
| 2 | [Produce Dynamic Locale Context In-Band](./phase-02-in-band-locale-context.md) | Pending |
| 3 | [Restore Split Critical Path and Safe Fallbacks](./phase-03-restore-critical-path.md) | Pending |
| 4 | [Localize Blogs Without Retry Tail](./phase-04-blog-localization-budget.md) | Pending |
| 5 | [Regression QA and Performance Gate](./phase-05-regression-and-benchmark.md) | Pending |

## Delivery Order

`Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5`.

Phase 2 must land before removing fatal locale gates in Phase 3 so a non-English composer fallback never becomes visible. Phase 5 is a release gate, not optional follow-up work.

## Non-Goals

- No durable job queue or generation-status redesign.
- No new locale-specific dictionaries for `de`, `fr`, `es`, or future locales.
- No removal of hero CTA, blog labels, newsletter fields, FAQ, testimonial, team, service, or pricing content.
- No Pixabay/media/product scheduling refactor.
- No relaxation of five-page, six-product, or three-blog completion counts.
- No timeout/deadline changes intended to force the 60-second target.

## Success Criteria

- Locale fixtures `vi`, `fr`, `es`, `de`, plus one previously unseen locale produce no injected English labels.
- Blog hero secondary CTA is localized and still links to `/about`.
- Five pages, all intended blocks/CTA slots, six products, and three localized blogs remain present.
- Normal page call count is three; locale mismatch adds zero calls.
- Dynamic locale-string resolution contributes no awaited network time.
- Same-cohort total p95 does not regress more than 5% versus the PR #1658 baseline; the GH-1190 <=60s target remains visible if not yet achieved.
- No `NON_ENGLISH_PAGE_GENERATION_FAILED` or `LOCALE_STRUCTURAL_STRINGS_UNAVAILABLE` terminal generation error.

## Evidence

- [Current Branch Impact Analysis](./reports/current-branch-impact.md)
- [GH-1190 Baseline and Optimization Plan](../260717-1600-gh-1190-generation-critical-path/plan.md)
- [F01 Performance QA](../../docs/qa/F01-gen-perf.md)

