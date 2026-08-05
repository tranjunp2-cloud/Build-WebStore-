---
title: "GH-1588 — Fail-closed unmatched AI category guard"
description: "Reject allowlisted but semantically implausible AI category assignments and return null for merchant review."
status: in_progress
priority: P1
effort: "~8–10h engineering + external QA wait"
issue: 1588
branch: fix/f08-1588-unmatched-category-guard
tags: [f08, bugfix, backend, api, ai]
blockedBy: []
blocks: [260710-1625-f08-category-integrity]
created: 2026-08-04
---

# GH-1588 — Fail-closed unmatched AI Category Guard

## Overview

Latest QA found that `4-Person Camping Tent` receives the tenant's only category, `QA Skincare`, and remains approvable. The route rejects unknown IDs but accepts every tenant-allowlisted ID without checking semantic plausibility.

## Scope challenge

- Fix only QA bug 1; the 375px modal issue remains separate.
- Keep the existing UI/server-action contract: `categoryId: null` blocks Approve and requires an existing tenant category.
- No schema, migration, new environment variable, category creation, dependency, or second AI/embedding call.
- PR #1710 is unrelated and outside this plan.

## Target contract

```text
AI result -> tenant-ID allowlist -> scan capped candidates for plausibility
├─ proposed ID is the unique plausible candidate -> canonical tenant ID
└─ unknown, unrelated, or 0/>1 plausible candidates -> null -> merchant review
```

Use only the parsed product name and trusted category path. Never use AI-generated description/SEO text as matching evidence.

## Cross-plan dependencies

| Plan | Relationship |
|------|--------------|
| [F08 category integrity](../260710-1625-f08-category-integrity/plan.md) | Its Phase 10 QA sign-off is blocked until this regression is green. |

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 01 | [Lock contract and regression matrix](phase-01-lock-fail-closed-category-contract.md) | completed | 2h |
| 02 | [Implement conservative category guard](phase-02-implement-conservative-category-guard.md) | completed | 4h |
| 03 | [Regression and staging closeout](phase-03-regression-and-staging-closeout.md) | in_progress | 1–2h + QA wait |

## Key decisions

- Prompt hardening is defense in depth; deterministic post-validation is the safety boundary.
- Favor false-null over false-positive. Normalize NFKD/case/punctuation, remove a finite reviewed noise set, singularize only narrow plurals, then require exact identity-token set equality or a finite directional contextual rule with explicit required/allowed tokens.
- Never use arbitrary prefix, substring, fuzzy, or material/color overlap. `car ↔ carpet` and `Leather Sofa → Leather Shoes` must reject.
- Scan the route's already-capped candidate list; accept only a unique plausible candidate matching the model-proposed allowlisted ID.
- Keep latency/cost flat. Use production `selectModel('bulk-parse')`; the existing `AI_MODEL_BULK_PARSE` remains only an override/canary input.
- Emit one aggregate logger event with reason counts only; never log merchant text, category paths, prompts, outputs, or IDs.

## Success criteria

- Tent/skincare and all ambiguous/adversarial cases return `categoryId: null`; serum/skincare retains the canonical ID.
- Null result keeps the existing empty dropdown, validation message, and disabled Approve behavior.
- Deterministic TC120–TC123 pass.
- Manual TC124: authenticated staging verifies tent/skincare stays uncategorized and serum/skincare retains the existing category; no category is created.
- Focused/full tests, typecheck, lint, and staging QA pass with no DB/env changes.

## Handoff

`/ck:cook /home/liam/data/worktrees/ech-prime-web-v2-worktree-2/plans/260804-1543-gh-1588-unmatched-category-guard/plan.md`
