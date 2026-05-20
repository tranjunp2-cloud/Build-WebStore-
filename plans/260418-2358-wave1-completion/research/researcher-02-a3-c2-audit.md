# Researcher 02 — A3 + C2 Post-Ship Audit

**Date**: 2026-04-18
**Audit scope**: Wave 1 Phase 03 (A3 defect quick wins) + Phase 04 (C2 image pool coverage) on `origin/staging`.
**Context**: PR #690 merged `fb9579e7` to staging. Helpers `fallback-svg.ts` + `dedup-section-label.ts` shipped.

## A3.1 — Hero overlay consistency — **status unclear, verify post-sync**

**To check on staging**:
- `src/blocks/hero/_overlay.tsx` exists?
- All 11 hero variants call HeroOverlay or render gradient?
- Likely partial — earlier audit on F05 showed 3/11 variants with overlay; unclear if fb9579e7 extended to 11

**Files**:
- `src/blocks/hero/variants/*.tsx` (11 variants: cards-overlay, centered, fullscreen, gradient, magazine, minimal, parallax, slideshow, split, split-video, video)

## A3.2 — BROKEN_VARIANTS expansion — **likely partial**

- Plan scope: audit all block Zod enums vs switch-case coverage
- Likely only `hero:['animated-gradient']` tracked → orphan check incomplete
- No per-block orphan detection test found
- Effort if gap: 1-1.5h

## A3.3 — Title dedup — **shipped helper only, NOT WIRED** ❌

**Confirmed on `origin/staging`**:
- `src/lib/ai/dedup-section-label.ts` exists (44 lines)
- `src/__tests__/unit/ai/dedup-section-label.test.ts` passes (7 cases)
- **`grep -c "dedupSectionLabel" src/lib/ai/template-composer.ts` → 0** on staging

**Gap — must wire** (A3.3 incomplete):
- `buildFeatures()` in template-composer.ts (~L341) — add `dedupSectionLabel(eyebrow, headline)` before emit
- `buildTestimonials()` (~L433) — same pattern
- `buildAbout()` (~L622) — same pattern

**Effort**: 45min wire + unit coverage confirmation.

## C2.1 — BLOCK_IMAGE_SPEC 7→15 — **shipped (verify on staging)**

- Plan target: 15 entries (7 existing + 8 new)
- F05 HEAD has 7. Staging needs verification post-merge

## C2.2 — placehold.co purge — **shipped** ✅

**Confirmed on `origin/staging`**:
- `grep -c "placehold.co" src/lib/ai/template-composer.ts` → **0** on staging
- vs F05 HEAD → 30
- Replaced by `NEUTRAL_FALLBACK_SVG`, `PORTRAIT_FALLBACK_SVG`, `AVATAR_FALLBACK_SVG` from `fallback-svg.ts`

## C2.3 — fallback-svg module — **shipped** ✅

**Confirmed on `origin/staging`**: `src/lib/ai/fallback-svg.ts` present, imported by composer.

## C2.4 — ImageRole type extension — **status unclear**

- Plan: add `'feature' | 'service' | 'property' | 'person-professional' | 'case-study'` to `ImageRole`
- Verify post-sync in `src/lib/ai/image-pool.ts`

## C2.5 — Hero dual-image sampling — **status unclear, verify**

- Plan: sample 2 distinct images for `hero.image` vs `hero.backgroundImage`
- Verify `pickManyFromPool('hero', 2)` or equivalent in `media-injector.ts`

## Summary — gaps likely remaining after staging sync

| Item | Est. effort | Severity |
|---|---|---|
| A3.3 dedupSectionLabel wire | 45m | **confirmed gap** |
| A3.1 hero overlay for 8 variants | 1-2h | unclear |
| A3.2 BROKEN_VARIANTS per-block audit | 1h | unclear |
| C2.4 ImageRole extension | 30m | unclear |
| C2.5 Hero dual-image | 15m | unclear |

Most likely real remaining = **A3.3 dedup wire** (45m) + verification sweep (30m).

## Unresolved Questions

1. Why was `dedupSectionLabel` shipped as a helper but never wired into composer? Intentional deferral or merge conflict?
2. Did PR #690 ship A3.1 (hero overlay) for all 11 variants or only the 3 originally overlay-equipped?
3. Is Wave 2's variant expansion (wave2 a5: newsletter 3→6, faq 3→6, about 3→7, stats 3→6, cta 4→8, team 2→6) making A1 validator scope (11 blocks) stale?
