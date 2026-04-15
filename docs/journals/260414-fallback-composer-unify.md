---
date: 2026-04-14
branch: feat/F01-ai-gen-variety-fix
pr: '#555'
commits: [9bf02d4c, 90f8f69a]
tags: [ai, fallback, composer, phase-06, regression-fix]
plan: plans/260412-2156-ai-gen-website-audit/
---

# 2026-04-14 — Phase-06: fallback path → composer unify

## Problem

When OpenAI errored out (429, quota, network), `generateWithFallback()` called the legacy `generateBlocks(prompt)` — a thin 5-category mapper with no industry content, no Phase-04 validation. Users hitting the fallback saw a generic 6-block skeleton regardless of their business category. Happy path delivered 22 blocks with rich content, fallback delivered stub. Every OpenAI quota exhaustion meant every user got identical placeholder.

## Decision

Rewire `generateWithFallback()` to call `composeFromBlueprint()` via a new shape adapter, so the fallback uses the same content pipeline as the happy path: 14 industry categories, real `BusinessSample`s, Phase-04 validation, industry-aware block builders, full theme presets. Keep legacy `generateBlocks` as a second-tier safety net if the composer itself throws.

## Implementation

7 sub-steps, all shipped in `9bf02d4c`:

1. **Break circular dep** — `enforceMinContent` + `VARIANT_MIN_CONTENT` moved from `openai-generator.ts` to new `src/lib/ai/variant-validation.ts`. Both consumers (`openai-generator`, `template-composer`) now import from the neutral module. Re-export kept in `openai-generator` for source compat.

2. **Font pairing resolver** — new `src/lib/ai/font-pairings.ts` maps 19 `ThemePreset.fontPairingId` strings to concrete `{fontHeading, fontBody}` Google Font family names. Constrained to Payload allowlist (6 heading + 5 body). All 70 presets across 14 categories resolve without warning.

3. **Category translator (5→14)** — new `src/lib/ai/composer-category-resolver.ts`. Word-boundary scoring against `COMPOSER_TYPE_KEYWORDS` (14 buckets including Vietnamese tokens for `nha khoa`, `quán cafe`, etc). Deterministic tie-break array. Zero matches → `business` sink.

4. **Shape adapter** — new `src/lib/ai/fallback-adapter.ts`. `composeFallbackResult(prompt, seed, language, extractedName)` pipeline: resolve category → pick preset by `seed % candidates.length` → call `composeFromBlueprint(preset, seed, bizOverride)` → adapt `TemplateSeed.pages[0].layout` → `GenerationResult.blocks`. Added `bizOverride?: Partial<BusinessSample>` param to `composeFromBlueprint` so user-provided business name propagates to all blocks without mutating cached `content.businesses[]`.

5. **Rewire** — `generateWithFallback` now emits granular `fallback_analyzing` → `fallback_composing` → `fallback_validating` → per-block `fallback_block_N` → `saving` → `done` SSE events. Matches happy-path cadence. Wraps composer call in try/catch with tier-2 fallback to legacy `generateBlocks` on throw (logs `[Fallback] composer failed` for diagnostics).

6. **Tests** — 45 new unit tests (font-pairings 4, category-resolver 20, fallback-adapter 21) + smoke script `scripts/ai/smoke-fallback.ts` running 5 categories (restaurant, health, fitness, tech, creative) end-to-end. All pass. Also updated existing tests: `openai-generator.test.ts` matcher for new event names, `template-composer.test.ts` block count upper bound removed.

7. **Cleanup** — `@deprecated` JSDoc on `generate-blocks.ts` marking it as legacy safety net only. Plan frontmatter status → `done`.

## Regression caught + fixed (`90f8f69a`)

During `/qa-full:regression` check: `fc0020d` had added a drop list for blocks needing media pipeline (gallery, before-after, portfolio-grid, menu-display, review-cards, booking-widget), inline in `generateSiteWithAI.validateBlocks()`. It only applied to the AI happy path. **Phase-06 fallback path now emits the same unsupported blocks** → Payload 500 on save when user hits fallback for health/fitness/creative.

Fix: extract drop list to new `src/lib/ai/unsupported-blocks.ts` with `isUnsupportedBlock()` + `filterUnsupportedBlocks()` helpers. Apply filter to both paths.

Smoke test re-run after fix:
- health seed 7: 12 → 11 blocks (booking-widget + gallery dropped)
- fitness seed 11: 12 → 11 blocks (before-after + gallery)
- creative seed 5: 11 → 10 blocks (portfolio-grid)
- restaurant seed 42: 12 blocks (no changes needed)
- tech seed 3: 12 blocks (gallery dropped)

All 5 categories still pass structural assertions.

## Outcome

797/799 tests pass (2 failing pre-existing `sanitize-block-data.test.ts` stat suffix bug — unrelated, later fixed by anh in `3e7fe8cd`). TS clean on touched files. PR #555 updated with phase-06 commits.

**Fallback path now delivers rich content.** When OpenAI fails:
- 11-12 blocks per site (vs 6 before)
- Industry-appropriate block mix (doctor-profile for health, class-schedule for fitness)
- Real business samples from `content/*.ts` packs
- Full theme presets with resolved fonts
- Tier-2 safety net intact for composer failures

## Decisions worth remembering

1. **`generateBlocks()` is now a safety net, not a primary path**. Don't add new industry content there — put it in `src/lib/ai/content/*.ts` and let the composer consume it. The `@deprecated` JSDoc enforces this via TS language service.
2. **`bizOverride?` on `composeFromBlueprint` is the right pattern for user data injection**. Simpler than mutating cached `content.businesses[]` and restoring, and avoids thread-safety questions even though JS is single-threaded per request.
3. **Shared drop list lives in its own module**. Having `isUnsupportedBlock` in both `openai-generator.ts` and `fallback-adapter.ts` inline would drift. Single source of truth required.
4. **Shape adapter is pure and sync** — no IO, no async. Makes unit testing trivial and composer deterministic.

## Followups

- **Restaurant preset signature blocks** — the `restaurant` TEMPLATE_PRESETS don't always emit `menu-display`/`booking-widget` (blocks now dropped by unsupported-blocks anyway). Preset authoring concern, belongs in plan-2156 phase-07 (dynamic content gen from form input).
- **Multi-page fallback** — currently `variant: 'starter'` (home only). Bump to `'professional'` once downstream actually consumes `GenerationResult.pages[]`.
- **Vietnamese keyword expansion** in `composer-category-resolver.ts` — baseline covered, can expand with real-world user prompt data.

## Related files

- Plan: `plans/260412-2156-ai-gen-website-audit/phase-06-fallback-composer-unify.md`
- Step reports: `phase-06-step-1` through `phase-06-step-7` (all marked done)
- Key code: `src/lib/ai/fallback-adapter.ts`, `variant-validation.ts`, `font-pairings.ts`, `composer-category-resolver.ts`, `unsupported-blocks.ts`
- Smoke: `scripts/ai/smoke-fallback.ts`
