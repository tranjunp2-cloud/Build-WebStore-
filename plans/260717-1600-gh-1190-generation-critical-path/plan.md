---
title: "GH-1190 generation critical-path optimization"
description: "Bring AI website generation p95 below 60 seconds without emitting done before required site data is complete."
status: in-progress
priority: P1
effort: 5d
issue: 1190
branch: investigate/1190-gen-web-slow
tags: [bugfix, backend, frontend, api, critical, performance]
blockedBy: []
blocks: []
created: 2026-07-17
---

# GH-1190 Generation Critical-Path Optimization

## Overview

Optimize the existing SSE generation pipeline, preserving its current architecture and quality fallbacks. Target the remaining unbounded work in site AI, sample products, blog preparation, completion bookkeeping, and client retry behavior.

The plan holds scope at the route/orchestrator level. It does not introduce a durable job queue, replace Pixabay, parallelize Payload media creates, or redesign page generation.

## Completion Contract

Before SSE `done`:
- Five pages, required blocks, page/block media, site status, six product rows, and three blog rows/content are persisted.
- Product cards and blog cards have valid on-topic fallback media; preview has no blank/grey image slots.
- Required fallbacks have settled; preview cannot expose incomplete page sections.
- `timeMs` includes tenant slug sync and all required completion work.

Allowed after `done`, only when their deadline expires:
- Better-match sample-product image enrichment and blog-thumbnail enrichment may replace already-visible fallback media.
- Deferred updates must target exact rows created by the current generation and must not overwrite newer data.

## Success Targets

- First SSE event p95 <= 5s.
- Time-to-`done` median improves >= 50% versus captured baseline.
- Time-to-`done` p95 <= 60s for EN, MS, VN, and JP staging cohorts.
- No normal successful run triggers the 60s warning.
- Five pages, six visible products, three complete blog posts with thumbnails, required page media, and user input fidelity remain unchanged.
- Disconnect after the stream starts never automatically launches a duplicate generation.

## Cross-Plan Dependencies

| Relationship | Plan | Decision |
|---|---|---|
| Overlap only | [F38 Pixabay provider replacement](../260629-1450-F38-pixabay-replace-unsplash/plan.md) | No dependency; this plan does not change provider contracts |
| Overlap only | [Pixabay multi-provider](../260623-1747-pixabay-unsplash-multi-provider/plan.md) | No dependency; keep media search ownership isolated |
| Future integration | [Sentry integration](../260504-1146-sentry-integration/plan.md) | No dependency; structured timings can later become spans |

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Instrument and Capture Baseline](./phase-01-observability-and-baseline.md) | Instrumented; staging baseline pending |
| 2 | [Bound Site AI and Product Critical Path](./phase-02-bound-ai-and-products.md) | In Progress |
| 3 | [Bound Blog Tail and Fix SSE Completion Semantics](./phase-03-blog-sse-and-completion.md) | In Progress |
| 4 | [Regression QA, Staging Benchmark, and Rollout](./phase-04-qa-staging-rollout.md) | Pending |

## Dependencies

`Phase 1 -> Phase 2 -> Phase 3 -> Phase 4`. Do not tune from local single runs; Phase 1 baseline is the gate for behavioral changes. Do not set route `maxDuration = 60` until Phase 4 proves required work and every `after()` task are bounded within the platform limit.

## Evidence

- [Scout report](./reports/scout-report.md)
- [Red-team review](./reports/red-team-review.md)
- [Existing F01 performance QA](../../docs/qa/F01-gen-perf.md)
- Issue #1190 latest QA verdict: mechanics pass, latency DoD and staging p95 remain unverified/failed.

## Completion Semantics

Deferred work may improve image relevance, but cannot turn incomplete UI into complete UI. If a valid fallback media ID cannot be prepared inside the critical-path budget, the generation must use an existing safe category placeholder or fail the completeness gate; it must not emit `done` with an empty visual slot.
