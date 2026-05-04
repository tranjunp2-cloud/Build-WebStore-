---
title: "Wave 1 Completion — sync + close A3.3 dedup gap"
description: "F05 branch 19 commits behind staging. Merge staging (brings wave1+wave2), then wire dedupSectionLabel into 3 builders, then verify 5 success metrics."
status: done
priority: P1
effort: 2-4h
branch: fix/F01-wave1-completion
tags: [wave1, wix, ai-gen, completion, branch-sync]
created: 2026-04-18
---

# Wave 1 Completion — Close the Last Mile

## Context

Parent plan: [`260417-0817-wave1-wix-detailed-plan`](../260417-0817-wave1-wix-detailed-plan/plan.md) (in_progress).

PR #690 (`fb9579e7`) shipped most of Wave 1 (A1 pools, A2 light theme, C2 placehold.co purge, fallback-svg module) to `origin/staging`. PR #697 shipped Wave 2 on top. **F05 branch is 19 commits behind staging** and missing everything.

## Current state (2026-04-18)

| Phase | Staging | F05 HEAD | Gap |
|---|---|---|---|
| A1 pools + rotate export | ✅ shipped | ❌ not exported | merge staging |
| A2 theme fallback refactor | ✅ shipped (FALLBACK_COLOR_MODE const) | ❌ dark default | merge staging |
| A3.1 hero overlay | ❓ unclear | ❌ not started | verify post-merge |
| A3.2 BROKEN_VARIANTS | ❓ partial | ❌ only hero | verify post-merge |
| **A3.3 dedupSectionLabel** | ⚠️ **helper only, not wired** | ⚠️ same | **close gap** |
| C2.1 BLOCK_IMAGE_SPEC 7→15 | ❓ verify | ❌ 7 entries | verify post-merge |
| C2.2 placehold.co purge | ✅ 0 emissions | ❌ 30 emissions | merge staging |
| C2.3 fallback-svg module | ✅ shipped | ⚠️ untracked files | merge staging |

## Phase Overview

| # | Phase | Effort | Depends |
|---|---|---|---|
| [01](phase-01-sync-branch-and-audit.md) | Sync F05 with staging + post-merge audit | 45m-1h | — |
| [02](phase-02-wire-dedup-section-label.md) | Wire `dedupSectionLabel` into 3 builders | 45m-1h | 01 |
| [03](phase-03-verify-success-metrics.md) | Verify 5 Wave 1 success metrics | 30-45m | 02 |

**Total**: 2-4h

## Dependency Graph

```
01 (sync + audit) ─> 02 (wire dedup) ─> 03 (verify metrics) ─> mark parent plan "done"
```

Sequential. Each phase can surface new gaps that extend effort.

## Wave 1 Success Metrics (from parent plan)

1. Variant distribution ≥ 80% pool utilization per block (10 seeds × 14 categories)
2. 0 sites render fallback dark cyan/magenta
3. `BLOCK_IMAGE_SPEC` ≥ 15 entries, 0 `placehold.co` in composer
4. 11/11 hero variants pass overlay check
5. 0 "unknown variant" fallback in staging logs

## Discovery scope

Phase 01 audit may surface additional gaps (A3.1, A3.2, C2.4, C2.5). If surfaced, decide:
- **Ship now** (add to Phase 02/03) if ≤ 1h each
- **Defer to Wave 2** (document in parent plan "Open Questions") if larger

## Research

- [Researcher 01 — A1 + A2 audit](research/researcher-01-a1-a2-audit.md)
- [Researcher 02 — A3 + C2 audit](research/researcher-02-a3-c2-audit.md)

## Related Plans

- [`260417-0817-wave1-wix-detailed-plan`](../260417-0817-wave1-wix-detailed-plan/plan.md) — parent (this plan closes it)
- [`260415-1344-wix-deep-rebuild`](../260415-1344-wix-deep-rebuild/plan.md) — grandparent (Wave 1 + Wave 2 + ext)

## Open Questions

1. Why was `dedupSectionLabel` shipped as helper but never wired in PR #690? Merge conflict or intentional deferral?
2. Wave 2 already expanded 6 block variant counts — is A1 validator scope (11 blocks) stale for those?
3. Should Phase 01 rebase F05 onto staging (clean history) vs merge (preserves F05 commits)?

## Changelog

- **2026-04-18** — Plan created after audit revealed wave1 is on staging but F05 branch is 19 commits behind + one genuine gap (A3.3 dedup wiring).
- **2026-04-19** — Worktree branched from `origin/staging` (skipped Phase 01 merge step). Re-audit corrected 2 false positives: hero overlay "8/11 gap" (7 variants don't use image BG → overlay N/A) + BLOCK_IMAGE_SPEC count "10" (regex miss, actual 15). Phase 02 wired `dedupSectionLabel` at 6 missed sites (`add-section.ts` + `generate-blocks.ts` + `seed-templates.ts`). All 5 success metrics ✅. Tests 6058/6058 pass. Report: [`reports/wave1-completion-260419.md`](reports/wave1-completion-260419.md). Status → done.
