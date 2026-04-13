---
title: "AI Website Generation Pipeline — Variety Audit & Fix"
description: "Audit and fix why all AI-generated websites look identical despite 47+ blocks with 100+ variants"
status: done
priority: P1
effort: 8-12d
branch: feat/F01-ai-gen-variety-fix
tags: [ai, openai, templates, blocks, variety, design-quality]
created: 2026-04-12
updated: 2026-04-13
---

# AI Website Generation Pipeline — Variety Audit & Fix

## Problem
All AI-generated websites look identical despite 47+ blocks with 100+ variants available.

## Root Causes (5 issues)
1. **System prompt lacks variety instructions** — lists blocks but never tells AI to vary them
2. **Sanitization silently kills variety** — invalid variants collapse to same default
3. **Fallback generator is 100% deterministic** — hardcoded blocks + variants + content
4. **Template composer is deterministic** — 14/15 builder functions hardcode one variant
5. **User prompt is flat** — no style/mood/personality signal, same format every time

## Progress

| # | Phase | Status | Effort | Key Files | Commits |
|---|-------|--------|--------|-----------|---------|
| 01 | Audit & Diagnosis | **skipped** | - | - | User confirmed root causes |
| 02 | [Fix System Prompt](phase-02-fix-system-prompt.md) | **done** | 1d | system-prompt.ts | `beffa9b` |
| 03 | [Fix Sanitization](phase-03-fix-sanitization.md) | **done** | 1d | openai-generator.ts | `beffa9b`, `1da7134` |
| 04 | [Fix Fallback Generator](phase-04-fix-fallback-generator.md) | **done** | 1d | generate-blocks.ts | `10d2f3d` |
| 05 | [Fix Template Composer](phase-05-fix-template-composer.md) | **done** | 1d | template-composer.ts | `5dde872` |

## Completed Work Summary

### Phase 02 — System Prompt (done)
- PROFESSIONAL DESIGN RULES: hero 5-8 words, 60-30-10 color, typography contrast, AIDA ordering, anti-patterns
- VARIETY RULES: 7 rules cấm default-first, yêu cầu vary hero/features/footer/contact
- Context-aware `selectPersonality(info)`: 8 personalities × keyword matching từ user input
- Dynamic `generateCompositionHint(category)`: vô hạn combinations thay vì 3 hardcoded arrays
- `CATEGORY_SIGNATURE_BLOCKS` + `HERO_VARIANTS_BY_CATEGORY` cho 14 categories

### Phase 03 — Sanitizer (done)
- `fuzzyMatchVariant()`: exact → case-insensitive → alias (3 bước thay vì 1)
- `VARIANT_ALIASES`: 40+ patterns (EN + VI + MS AI output)
- `CATEGORY_VARIANT_WEIGHTS`: 14/14 categories × 5 block types — weighted random thay vì always-default
- `BROKEN_VARIANTS` exclusion: hero:animated-gradient never selected
- `enforceMinContent()`: carousel≥3, masonry≥4, grid-4≥4 — auto-fallback
- Console.warn logging mỗi variant replacement
- Gallery/logo-cloud: giữ alt/caption metadata thay vì xóa sạch

### Phase 04 — Fallback Generator (done)
- Seeded PRNG (`createSeededRandom`, `pickRandom`, `shuffleArray`)
- Middle block pool (9 blocks) → chọn 4-6 random + shuffle
- `VARIANT_OPTIONS` (14 block types) → random variant selection
- 3 theme palettes × 5 categories = 15 themes (was 5)
- 3 content variations × 5 categories = 15 content sets (was 5)
- Reuse `enforceMinContent()` + `BROKEN_VARIANTS` từ Phase 03
- Ordering constraints: features→stats, features→testimonials, about→team
- Function signature: `generateBlocks(prompt, seed?)` — Date.now() from caller

### Phase 05 — Template Composer (done)
- `compositionSeed?: number` trong `ComposerInput` — backward-compatible
- `selectVariant(blockType, seed, category)` dùng `simpleHash` — deterministic per seed
- `buildBlockFromSpec()`: auto-select variant khi `spec.variant` undefined
- `buildHomePage()`: seed-based variant cho tất cả 15 block types
- Middle block shuffle theo seed + ordering constraints
- `enforceMinContent()` wired cho testimonials
- `composeFromBlueprint()`: seed = `businessIndex * 7919` default
- Legacy `composeTemplate()` truyền compositionSeed

## Test Results
- **3694/3694 tests passed** (198 test files)
- 10 tests updated cho behavior mới
- TypeScript: 0 errors
- Lint: 0 errors

## Key Files
- `src/lib/ai/system-prompt.ts` — 403 lines (was 176)
- `src/lib/ai/openai-generator.ts` — 847 lines (was 562)
- `src/lib/ai/generate-blocks.ts` — 315 lines (pending)
- `src/lib/ai/template-composer.ts` — ~1100 lines (pending)
- `src/blocks/registry.ts` — 47 blocks, 142 variants

## Success Metric
Generate 10 sites for same industry input → achieve >= 7 visually distinct layouts.

## Related Docs
- **PRD**: `docs/prd/F01-ai-builder-variety.md` — 20 FRs, 14 ACs
- **QA Test Plan**: `docs/qa/F01-ai-builder-variety.md` — 38 TCs
- **Context Guide**: `docs/standards/AI_WEBSITE_GENERATION_GUIDE.md`
- **Variant Audit**: `plans/260412-2156-ai-gen-website-audit/scout/scout-variant-audit-report.md`
- **Design Quality Plan**: `plans/260412-2300-design-quality-rules/plan.md` (song song)

## Validated Decisions
1. Skip Phase 01 audit — root causes confirmed
2. Fix tất cả 5 phases
3. Invalid variant → weighted by category (14 categories covered)
4. Variant whitelist: 140/142 safe, exclude animated-gradient
5. Personality context-aware (keyword matching)
6. Composition dynamic (infinite combinations)
7. Content-count guard (carousel≥3, masonry≥4)

## Research
- [AI Pipeline Research](research/researcher-01-ai-pipeline.md)
- [Template System Research](research/researcher-02-template-system.md)
