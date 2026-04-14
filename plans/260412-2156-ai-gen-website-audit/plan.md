---
title: "AI Website Generation Pipeline — Variety Audit & Fix"
description: "Audit and fix why all AI-generated websites look identical despite 47+ blocks with 100+ variants"
status: in_progress
priority: P1
effort: 8-12d + 8-11h (Phase 06)
branch: feat/F01-ai-gen-variety-fix
tags: [ai, openai, templates, blocks, variety, design-quality]
created: 2026-04-12
updated: 2026-04-14
---

# AI Website Generation Pipeline — Variety Audit & Fix

## Problem
All AI-generated websites look identical despite 47+ blocks with 100+ variants available.

## Root Causes (5 issues + 1 architectural gap)
1. **System prompt lacks variety instructions** — lists blocks but never tells AI to vary them
2. **Sanitization silently kills variety** — invalid variants collapse to same default
3. **Fallback generator is 100% deterministic** — hardcoded blocks + variants + content
4. **Template composer is deterministic** — 14/15 builder functions hardcode one variant
5. **User prompt is flat** — no style/mood/personality signal, same format every time
6. **Fallback NEVER uses composer** *(discovered 2026-04-14)* — `generateWithFallback()` calls `generateBlocks(prompt)` → only 5 categories, hardcoded placeholder content. When OpenAI fails, every restaurant gets the SAME Pad Thai menu, same "Alex Johnson" team. Phase 06 unifies fallback path with the rich composer.

## Progress

| # | Phase | Status | Effort | Key Files | Commits |
|---|-------|--------|--------|-----------|---------|
| 01 | Audit & Diagnosis | **skipped** | - | - | User confirmed root causes |
| 02 | [Fix System Prompt](phase-02-fix-system-prompt.md) | **done** | 1d | system-prompt.ts | `beffa9b` |
| 03 | [Fix Sanitization](phase-03-fix-sanitization.md) | **done** | 1d | openai-generator.ts | `beffa9b`, `1da7134` |
| 04 | [Fix Fallback Generator](phase-04-fix-fallback-generator.md) | **done** | 1d | generate-blocks.ts | `10d2f3d`, `479100a` |
| 05 | [Fix Template Composer](phase-05-fix-template-composer.md) | **done** | 1d | template-composer.ts | `5dde872` |
| 06 | [Fallback → Composer Unify](phase-06-fallback-composer-unify.md) | **pending** | 10-14h (revised) | openai-generator.ts, fallback-adapter.ts (new) | — |
| 07 | [Dynamic Content Gen từ Form Input](phase-07-dynamic-content-gen.md) | **stub** | 6-10h (TBD) | content-extractor.ts (new) | — |

### Phase 06 sub-steps (added 2026-04-14)
| Step | File | Effort | Depends |
|---|---|---|---|
| 06-1 | [Break circular dep](phase-06-step-1-break-circular-dep.md) | 30min | — |
| 06-2 | [Font pairing resolver](phase-06-step-2-font-pairing-resolver.md) | 1-2h | — |
| 06-3 | [Category translator (5→14)](phase-06-step-3-category-translator.md) | 1-2h | — |
| 06-4 | [Shape adapter](phase-06-step-4-shape-adapter.md) | 2-3h | 06-1, 06-2, 06-3 |
| 06-5 | [Fallback rewire](phase-06-step-5-fallback-rewire.md) | 1h | 06-4 |
| 06-6 | [Test + e2e verify](phase-06-step-6-test-e2e-verify.md) | 2h | 06-5 |
| 06-7 | [Cleanup + deprecation](phase-06-step-7-cleanup-deprecation.md) | 30min | 06-6 |

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

### Phase 06 — Fallback → Composer Unify (pending, planned 2026-04-14)
**Discovered:** Phase 04+05 fixed both paths INDEPENDENTLY but never wired them together. `openai-generator.ts:252` still calls `generateBlocks(prompt, Date.now())` instead of `composeFromBlueprint()`. When OpenAI 429s (every quota exhaustion), every site of the same category uses identical placeholder content.

**Goal:** Replace `generateWithFallback()` to call `composeFromBlueprint()` via a new pure adapter. Fallback uses same content layer as AI happy path: 14 categories, real `BusinessSample`s, Phase 04 validation, industry-aware blocks.

**7 sub-steps** (see table above + linked files):
- 06-1: Move `enforceMinContent` to neutral file (break circular dep)
- 06-2: Build `font-pairings.ts` resolver (20 IDs → Google Fonts)
- 06-3: Extend `parseIntent` 5→14 categories
- 06-4: Pure `fallback-adapter.ts` (TemplateSeed → GenerationResult, biz.name override via deep-clone, theme conversion, multi-page extraction)
- 06-5: Rewire `generateWithFallback` (composer-first, try/catch with 2nd-tier safety net to legacy `generateBlocks`)
- 06-6: Run full test suite + manual e2e for 5 categories
- 06-7: Mark `generate-blocks.ts` as legacy safety net + update trackers

**Research:**
- [Researcher 03 — Shape adapter](research/researcher-03-fallback-shape-adapter.md) — shape diff, category mapping (5→14), biz override, font pairing blocker, multi-page extraction
- [Researcher 04 — Streaming + tests](research/researcher-04-fallback-streaming-tests.md) — SSE event sequence, route contract, circular dep solution, test impact (10 files), composer side effects

**Key decisions:**
- Use `composeFromBlueprint` (not deprecated `composeTemplate`)
- `variant: 'starter'` to skip multi-page → home only
- Deep-clone `BusinessSample` BEFORE compose (cache pollution risk)
- Try/catch composer call → 2nd-tier fallback to `generateBlocks`
- DO NOT double-validate (composer already runs `applyContentValidation`)

**Related to bug fix `479100a`** (2026-04-14): Fixed faq field name + removed empty gallery + added 5 industry block builders inline in `generate-blocks.ts`. That commit was the minimum-viable patch; Phase 06 is the architectural fix.

### Phase 07 — Dynamic Content Gen từ Form Input (stub)
**Trigger:** Sau khi Phase 06 ship + verified. **Why:** Phase 06 unify fallback với composer NHƯNG content vẫn pre-curated. 2 cafe khác nhau cùng nhận menu Pad Thai từ canned sample. Phase 07 parse form input (`products`, `description`, `phone`...) để personalize từng block content WITHOUT LLM call. See [phase-07-dynamic-content-gen.md](phase-07-dynamic-content-gen.md).

**Out of scope Phase 07:** local LLM, image gen, multi-lang content gen, complex rephrasing.

## Test Results
- **3694/3694 tests passed** (198 test files)
- 10 tests updated cho behavior mới
- TypeScript: 0 errors
- Lint: 0 errors

### Render-level coverage (added 2026-04-14)
- **AI Gen Test Harness** shipped — see `plans/260414-0837-ai-gen-test-harness/plan.md`
- Matrix runner: 14 categories × 3 variants × 5 seeds = 210 fixtures, ~90ms structural pass (`735fa85` + `8598e64`)
- 6 structural guards caught 185 real bugs in `template-composer.ts` → fixed in `8598e64`
- 12 new TCs (TC-F01-V.39..50) appended to `docs/qa/F01-ai-builder-variety.md` §4.8 — covers Ben-Ben class bugs that 3694 unit tests miss
- CI workflow `.github/workflows/ai-harness.yml` (label-only `run-harness` trigger), uploads artifact 14d, smart-notify on fail
- **Phase 03/04 (visual render + HTML report) still pending** in harness plan — TC-F01-V.43, V.48, V.49 marked pending

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

## Phase 06 Validation (2026-04-14)

**Validated:** 2026-04-14 | **Questions asked:** 8

### Confirmed decisions
1. **Composer signature**: Add optional `bizOverride?: BusinessSample` param to `composeFromBlueprint()` — backward-compat preserved
2. **Composer throws**: 2nd-tier fallback to legacy `generateBlocks(prompt)` inside try/catch — user always gets a site
3. **Multi-page output**: ⚠️ Use `variant: 'premium'` (5 pages: home + about + contact + services + blog) — NOT 'starter'. Adapter MUST surface `pages[]`. Heavier output but full multi-page experience.
4. **Legacy `generate-blocks.ts`**: Keep as 2nd-tier safety net, mark `@deprecated` in JSDoc
5. **Font pairing**: Hardcode 20 mappings if `font-pairings.ts` doesn't exist (after Phase 02 grep verifies)
6. **Vietnamese keywords**: ⚠️ Use langdetect library (`franc`) for auto language detection — NOT manual keyword translation. Affects Phase 03 scope.
7. **Step events**: Match AI happy path step-by-step (~12 events: analyzing, composing, building-page-X for 5 pages, saving)
8. **Name override**: Extract user's business name from prompt and override `biz.name` after deep-clone

### Action items (revise phase files BEFORE coding)
- [ ] **Phase 04**: Change `variant: 'starter'` → `variant: 'premium'` in adapter. Surface `pages[]` in `GenerationResult`. Verify `route.ts` consumes `pages[]` (grep `result.pages` in route.ts) — if not, add consumer or mark as future work.
- [ ] **Phase 04**: Update success criteria — adapter must produce 5 pages (home + about + contact + services + blog), each non-empty
- [ ] **Phase 03**: Replace manual VN keyword extension with `franc` library install + integration. Add new sub-step or expand effort estimate (1-2h → 2-3h).
- [ ] **Phase 03**: Add tests for VN, EN, MS prompt detection (Plan A supports en/ms/vi per `BusinessIntent.language`)
- [ ] **Phase 04**: Adapter must support 5-page premium output. Test all 14 categories produce 5 valid pages each.
- [ ] **Phase 05**: Step events — emit `step:building-page-${i}` for each of 5 pages. Match happy-path cadence.
- [ ] **Phase 06**: Add e2e test verifying multi-page output renders correctly, nav/footer reference all 5 pages, no dangling links.

### Updated effort estimate
- Phase 03: 1-2h → **2-3h** (add franc lib + multi-language tests)
- Phase 04: 2-3h → **3-4h** (multi-page output + 5-page testing)
- **Total Phase 06: 8-11h → 10-14h**

### Recommendation
**Revise 3 phase files** (03, 04, 05) per action items above, then `/cook` Phase 06. Two non-default choices (premium pages + franc lib) materially increase scope but produce richer fallback output.

## Research
- [AI Pipeline Research](research/researcher-01-ai-pipeline.md)
- [Template System Research](research/researcher-02-template-system.md)
