---
title: "AI Gen Variety Root-Cause Fix (tactical)"
description: "Fix 7/13 root causes making AI-gen sites collapse to same variant/preset/content. Designed to ship in parallel with sibling plan 260414-2249 Wix-parity."
status: code-complete
priority: P1
effort: 8h (4 phases)
branch: feat/F01-ai-gen-variety-tactical
pr: '#603'
tags: [ai-gen, variety, templates, f01, root-cause, parallel]
created: 2026-04-14
---

## Problem statement

Anh Nhan (PM): **"gen website vẫn giống template với nhau"**. Symptom này ẩn 2 vấn đề khác nhau:

1. **Quality fundamentals missing** — user data dropped, sub-pages stub, no SEO → site trông như demo
2. **Output distribution collapse** — same variant/skeleton/content lặp lại trong cùng category → site giống nhau

Plan này chỉ chẩn đoán và fix **vấn đề #2** bằng phương pháp tactical (parameter tuning + seeding + library rotation). Vấn đề #1 do sibling plan `260414-2249-ai-gen-wix-level-optimize/` xử lý với approach strategic (architecture rewrite).

## Parallel execution với sibling plan 2249

Plan này ship **song song** với `plans/260414-2249-ai-gen-wix-level-optimize/`, phân chia rõ scope:

| Plan | Approach | Effort | Fixes |
|---|---|---|---|
| **2253 (this)** | Tactical — parameter tuning, seeded shuffle, library rotation | 8h (2 ngày) | R2, R3, R4, R5, R6, R9, R10 + measurement harness |
| **2249 (sibling)** | Strategic — architecture rewrite, mood bundle, hand-curated recipes | 41-52h (1.5 tuần) | R1, R7, R8, R11, R12, R13 + user data threading + multipage + SEO |

**Execution**: Phase 04 (variety harness) của plan này chạy **TRƯỚC** để baseline → ship Phase 01-03 trong 2 ngày đầu → re-run harness để đo delta quick wins → sibling 2249 ship tiếp strategic work → re-run harness lần cuối để verify không regress.

**File conflict avoidance**: Plan này không touch file mà 2249 rewrite (theme-presets bundle, image pool, layout recipes, sub-pages, SEO generator). Chỉ expand/dedupe/seed hoá những file existing. Merge sẽ clean.

## 13 Root causes — split giữa 2 plans

| # | Impact | Root cause | File | Plan fix |
|---|---|---|---|---|
| R1 | HIGH | `mandatoryBlocks` cố định → skeleton identical | `category-requirements.ts:32-117` | **2249** Phase 04 |
| R2 | HIGH | `CATEGORY_VARIANT_WEIGHTS` pool cố định → 1-2 variant dominant | `openai-generator.ts:452-722` | **2253** Phase 01 |
| R3 | HIGH | Chỉ 5 preset/category, modulo-5 hash cluster | `theme-presets.ts`, `category-theme-picker.ts:42-48` | **2253** Phase 02 |
| R4 | HIGH | `buildBlockFromLibrary` hardcode `businesses[0]` | `content-injection.ts:66` | **2253** Phase 03 |
| R5 | MED | `padItems` reuse 5-sample pool | `content-injection.ts:294-358` | **2253** Phase 03 |
| R6 | MED | 17 `fontPairingId` → ~10 unique pairs | `font-pairings.ts:17-37` | **2253** Phase 02 |
| R7 | MED | `CATEGORY_BASE_KEYWORDS` 3-5 terms → Unsplash repeat | `image-keywords.ts:20-35` | **2249** Phase 03 (image pool) |
| R8 | MED | `selectPersonality` keyword clustering | `system-prompt.ts:105-125` | **2249** Phase 02 (theme moods) |
| R9 | MED | `NAV_VARIANT_BY_CATEGORY` force single variant/category | `category-requirements.ts:129-144` | **2253** Phase 01 |
| R10 | MED | `template-composer.simpleHash` determinism | `template-composer.ts:43-65` | **2253** Phase 01 |
| R11 | LOW | System prompt 85% boilerplate → median output | `system-prompt.ts` (471 lines) | **2249** Phase 02 (hard hex injection) |
| R12 | LOW | `generateCompositionHint` soft guidance ignored | `system-prompt.ts:191-214` | **2249** Phase 04 (hard recipe constraint) |
| R13 | LOW | Theme override post-parse → AI copy blind | `openai-generator.ts:136` | **2249** Phase 02 (pre-parse injection) |

**Split summary**: Plan 2253 covers 7 root causes (R2/R3/R4/R5/R6/R9/R10) + measurement. Plan 2249 covers 6 root causes (R1/R7/R8/R11/R12/R13) + 3 new quality axes (user data, multipage, SEO) not in R1-R13.

## Phase overview

| # | Phase | Effort | Status | Fixes |
|---|-------|--------|--------|-------|
| [01](./phase-01-variant-pool-randomization.md) | Variant pool randomization | 2h | ✅ shipped (`269d1248`) | R2, R9 (R10 deferred per non-goals) |
| [02](./phase-02-theme-preset-expansion.md) | Theme preset + font pair expansion | 2h | ✅ shipped (`b20dd88d`) | R3, R6 |
| [03](./phase-03-content-library-rotation.md) | Content library rotation + gap-fill seed | 2h | ✅ shipped (`339e96f2`) | R4, R5 |
| [04](./phase-04-variety-measurement.md) | E2E variety measurement harness | 1.5h | ✅ shipped (`980d3906`) | — (verification) |

All 4 phases shipped in PR #603. 533/533 AI unit tests pass (+78 new). Baseline + post-fix measurement in progress.

**Execution order**: Phase 04 baseline → 01 → 02 → 03 → Phase 04 re-run (measure delta). Phases 01/02/03 độc lập với nhau — có thể ship random order.

## Non-goals (explicitly deferred to sibling plan 2249)

- **R1 flexible skeleton** — 2249 Phase 04 layout recipes A/B/C (hand-curated, tốt hơn seeded pick của plan này)
- **R7 image keywords** — 2249 Phase 03 image pool consistency (1 search/site approach tốt hơn keyword expansion)
- **R8 personality** — 2249 Phase 02 theme moods (thay thế personalities bằng 6 moods archetypes)
- **R11-R13 prompt entropy** — 2249 Phase 02 hard hex injection + Phase 04 hard recipe constraint
- **User data threading (Symptom A)** — 2249 Phase 01 (không trong R1-R13, nhưng là bug lớn nhất)
- **Multi-page completeness** — 2249 Phase 05
- **SEO + JSON-LD** — 2249 Phase 06

Plan này **không** touch: `theme-presets.ts` mood field, `image-keywords.ts` mood filter, `template-composer.ts` recipe selection, sub-page builders, SEO generator, consistency validator, `fallback-adapter.ts` user data mapper.

## Success metrics (measurable)

Phase 04 harness measure 5 metrics:

1. **Variant diversity** (fix R2/R9/R10): 20 beauty gens → không variant hero nào chiếm >35% (baseline ~60%)
2. **Theme distribution** (fix R3/R6): 20 same-category gens với 20 tên khác → ≥6 distinct `(primaryColor, fontPairingId)` combos (baseline ~2-3)
3. **Content uniqueness** (fix R4/R5): 20 same-category gens → <20% testimonial text collision (baseline ~80%)
4. **Business rotation** (fix R4): 10 seeds × beauty → ≥5 distinct businesses[i] picked (baseline 1)
5. **Regression gate**: all 455 existing AI unit tests pass, +new tests cho deterministic seed → varied output

Note: metrics cho R1/R7/R8/R11-R13 do sibling plan 2249 đo riêng (multipage completeness, image cohesion, SEO uniqueness).

## Related docs

- Research: [researcher-01-block-variant-similarity](./research/researcher-01-block-variant-similarity.md), [researcher-02-theme-content-similarity](./research/researcher-02-theme-content-similarity.md)
- **Sibling plan**: `plans/260414-2249-ai-gen-wix-level-optimize/plan.md` (strategic Wix-parity, ship parallel)
- Flow diagrams: `docs/architecture/ai-gen-flow-diagrams.md`
- Session context: `docs/journals/260414-session-ai-gen-deep-dive.md`
- Parent plans done: `plans/260412-2156-ai-gen-website-audit/` (A), `plans/260412-2300-design-quality-rules/` (B), `plans/260414-1400-ai-gen-unsplash-pipeline/` (D), `plans/260414-1630-phase-08-audit/` (E)
