# Phase 04 — TemplateSeed → GenerationResult adapter

## Context links
- Parent plan: `./phase-06-fallback-composer-unify.md`
- Depends on: **Phase 01** (no circular dep), **Phase 02** (font resolver), **Phase 03** (category translator)
- Blocks: Phase 05 (rewire)
- Research: `./research/researcher-03-fallback-shape-adapter.md` (entire doc), `./research/researcher-04-fallback-streaming-tests.md` Q5

## Overview
- Date: 2026-04-14
- Description: Create a single pure function that takes a user prompt + seed, picks a composer-friendly payload, calls `composeFromBlueprint`, and translates the returned `TemplateSeed` into the `GenerationResult` shape the route handler expects. All name overrides, theme field mapping, and multi-page extraction happen here. No SSE events, no IO.
- Priority: P1
- Status: pending
- Review status: not reviewed

## Key Insights
- Composer is the @non-deprecated path: `composeFromBlueprint(preset: TemplatePreset)` (template-composer.ts:1168-1208). `composeTemplate` is marked `@deprecated` at line 1212. We route through `composeFromBlueprint`.
- `seed.name` is `"${biz.name} — ${themePreset.name}"` (template-composer.ts:1243) — DO NOT use as `siteName`. Use the (possibly overridden) `biz.name`.
- `biz.name` is interpolated into ~15 block fields inside the composer (see researcher-03 Q3 call-site list). Post-compose string-replace is fragile. Correct fix: deep-clone the `BusinessSample` BEFORE calling composer, mutate `name` and `tagline`.
- `getCategoryContent()` returns a CACHED reference — mutation without clone pollutes future calls. Use `structuredClone`.
- Composer ALREADY calls `enforceMinContent` + `applyContentValidation` (template-composer.ts:1249-1255). Adapter MUST NOT re-run them — double processing would erase variety.
- Variant choice: use `'starter'` to get a home-only page (researcher-03 Q5) so nav/footer don't dangle. If a future story wants multipage fallback, bump to `'professional'` and surface `pages[]`.
- Composer throws on unknown category or out-of-range `businessIndex` — adapter wraps the call and lets caller catch.

## Requirements
- File: `src/lib/ai/fallback-adapter.ts`.
- Public API: `composeFallbackResult(prompt: string, seed: number, language: 'en' | 'vi', extractedName?: string): GenerationResult`.
- Pure, synchronous, zero IO.
- Handles: category resolution → businessIndex mod → theme preset selection → biz deep-clone + name override → variant=starter → compose → shape adaptation → return.
- Throws on composer failure (caller handles second-tier fallback).
- 100% unit test coverage on the adapter function.

## Architecture
```
composeFallbackResult(prompt, seed, lang, extractedName?)
    │
    ├─ resolveComposerCategory(prompt)           [Phase 03]
    ├─ content = getCategoryContent(category)
    ├─ businessIndex = seed % content.businesses.length
    ├─ bizClone = structuredClone(content.businesses[businessIndex])
    ├─ if extractedName: bizClone.name = extractedName
    ├─ themePreset = pickThemePreset(category, seed, parseIntent(prompt).style)
    ├─ preset = { category, businessIndex, themePreset, variant:'starter', language:lang, bizOverride: bizClone }
    ├─ templateSeed = composeFromBlueprint(preset)
    │   (composer internally runs enforceMinContent + applyContentValidation)
    │
    └─ return adaptTemplateSeedToGenerationResult(templateSeed, bizClone, language)
         {
           siteName: bizClone.name,
           siteType: mapCategoryToSiteType(category),     // 14 → 5 back-map
           blocks: templateSeed.pages[0].layout,
           pages: templateSeed.pages.map(...)            // optional, include if downstream uses it
           seo: {
             title: `${bizClone.name} — ${bizClone.tagline}`,
             description: truncate(templateSeed.description ?? bizClone.description, 160),
             keywords: […]
           },
           theme: {
             primaryColor: templateSeed.theme.primaryColor,
             secondaryColor: templateSeed.theme.secondaryColor,
             colorMode: templateSeed.theme.colorMode,
             ...resolveFontPairing(templateSeed.theme.fontPairingId)   // [Phase 02]
           },
           language
         }
```

### Open question: pre-compose biz override
Composer currently reads `content = getCategoryContent(category)` internally, ignoring any passed-in clone. Two options:

1. **Option A (preferred):** add an optional `bizOverride?: BusinessSample` param to `composeFromBlueprint` + `composeTemplate` that replaces `content.businesses[businessIndex]` with the clone when provided. Tiny, backward-compatible signature change. Single-file edit in composer.
2. **Option B:** Mutate the cached `content.businesses[businessIndex]` in place, compose, then restore the original. Fragile, not thread-safe (but JS is single-threaded per request).

Choose Option A. Flagged for Phase 04 implementation.

## Related code files
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/template-composer.ts` (composeFromBlueprint 1168-1208, composeTemplate 1213-1266)
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/theme-presets.ts` (preset arrays per category)
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/content/index.ts` (getCategoryContent + categoryMap)
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/generate-blocks.ts` (lines 34-48 GenerationResult target shape, lines 83-116 parseIntent reuse for style)
- NEW: `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/fallback-adapter.ts`
- NEW test: `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/__tests__/unit/lib/ai/fallback-adapter.test.ts`

## Implementation Steps
1. Define local helpers inside `fallback-adapter.ts`:
   - `pickThemePreset(category, seed, style)` — imports `{CATEGORY}_PRESETS` arrays, biases by style keyword, defaults to `seed % presets.length`.
   - `mapCategoryToSiteType(category)` — 14→5 reverse map (see Research Q2 table).
   - `truncate(str, n)` inline.
2. Modify `composeFromBlueprint` + `composeTemplate` in `template-composer.ts` to accept optional `bizOverride?: BusinessSample`. When provided, the composer uses it as `biz` instead of `content.businesses[businessIndex]`. Keep backward compat — default stays unchanged.
3. Write `composeFallbackResult(prompt, seed, language, extractedName?)` per architecture diagram.
4. Write `adaptTemplateSeedToGenerationResult(templateSeed, biz, language)` — pure mapping, no async.
5. Unit tests:
   - Every category produces a valid `GenerationResult` (14 tests).
   - `extractedName` override propagates to `siteName` AND hero/footer blocks within `result.blocks`.
   - `theme.fontHeading` + `theme.fontBody` are concrete strings, never `undefined`.
   - `seo.description` ≤ 160 chars.
   - `result.blocks.length > 0`.
   - Unknown category id throws via composer (assert via mock that adapter re-throws).
   - Deterministic: same prompt + same seed → identical result.
6. Snapshot test for restaurant category: verify `menu-display`, `booking-widget`, `faq` blocks present in `result.blocks`.

## Todo list
- [ ] Add `bizOverride` param to composer (backward-compat)
- [ ] Write `pickThemePreset`, `mapCategoryToSiteType`, `truncate`
- [ ] Write `composeFallbackResult`
- [ ] Write `adaptTemplateSeedToGenerationResult`
- [ ] 14 category unit tests
- [ ] Name override propagation test
- [ ] Theme font resolution test
- [ ] Deterministic replay test
- [ ] Restaurant snapshot test with required blocks

## Success Criteria
- `pnpm vitest run src/__tests__/unit/lib/ai/fallback-adapter.test.ts` all green.
- `tsc --noEmit` clean.
- Existing `template-composer.test.ts` still passes (backward-compat of composer signature holds).
- Manual verification: call `composeFallbackResult("modern dental clinic in Saigon", 42, "en")` in a scratch script and eyeball the output — blocks should reference dentistry services, theme should be health-appropriate, siteName should be the clinic name from content pack.

## Risk Assessment
| Risk | Likelihood | Mitigation |
|---|---|---|
| Composer signature change breaks seed route | Low | Optional param, default behavior unchanged, run `templates.test.ts` + `template-smoke.test.ts` |
| `structuredClone` not available in Node target | Very low | Node 18+ has it; project runs Node 20 per Dockerfile |
| `GenerationResult.pages[]` not consumed downstream → wasted work | Medium | Grep `result.pages` in route.ts first; if unused, skip multi-page mapping to save cycles |
| Preset arrays differ in length across categories → biased distribution | Low | Test all 14 with seed=0..9 to confirm good spread |
| Composer throws internally on missing industry block for a category | Medium | Wrap in try/catch in Phase 05; adapter itself lets the throw bubble |
| A category has 0 businesses in content file | Medium | Phase 04 test suite iterates 14 categories — will surface immediately |

## Security Considerations
- Prompt is user input but only used for keyword matching.
- `extractedName` is user input interpolated into blocks — must be sanitized downstream by the existing block sanitizer (`route.ts:348-393`). Adapter itself does not XSS-escape; that is the route's job and has not changed.

## Next steps
Phase 05 imports `composeFallbackResult` and wires it into `generateWithFallback`.
