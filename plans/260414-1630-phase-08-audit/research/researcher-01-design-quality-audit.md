# Research #01 — Design Quality Plan B Audit (CORRECTED)

> Created: 2026-04-14
> For: plan 260414-1630-phase-08-audit

## Summary

User remembers Phase 8-like design work was done. Found: **Plan B `260412-2300-design-quality-rules` — ALL 5 phases DONE and ON current branch `feat/F01-ai-gen-variety-fix`**. Initial researcher claim of "not on current branch" was **WRONG** — verified via `git log`.

## 1. Plan B Phases Status

| Phase | Commit | What shipped |
|---|---|---|
| 01 Design Tokens | `5a1a6997` | `src/lib/design-tokens.ts` (SPACING 8px grid, RADIUS, SHADOW, ICON_SIZE, SECTION_PADDING, CONTAINER), `src/blocks/shared/SectionWrapper.tsx` + 25 tests |
| 02 Typography | `4050a136` | Font validator (contrast axis), font pairing data, typography tokens |
| 03 Color System | `373554f2` | Semantic color layer (60-30-10), `generatePalette()`, WCAG AA contrast utils, `--accent`, `--surface-*`, `--text-*` CSS vars |
| 04 Content Validation | `5b7594ac` | `content-rules.ts` — word count limits, blocked CTAs, headline rules, prose size |
| 05 Block Audit | 14 commits | All 47 blocks refactored to use design tokens: `4be2fe2f` (pilot), `b2103880` footer, `9e4fe878` navigation, `25d7e970` testimonials, `71c65f34` hero, `3092451d` pricing, `537f61bf` gallery, `dc357f98` contact, `a66b71bc` (13 small blocks), `f43ea1bd` (8 batch c2), `1113b32e` (6 c1 industry) |
| Final | `64b3f824` | Plan marked done |

## 2. What's Actually Wired

**Design tokens layer — WORKING:**
- `src/lib/design-tokens.ts` — SPACING, RADIUS, SHADOW, ICON_SIZE, SECTION_PADDING constants
- `src/blocks/shared/SectionWrapper.tsx` — consistent section padding
- `src/blocks/**/index.tsx` (47 blocks) — all import + use these constants

**Color palette layer — WORKING:**
- `src/lib/theme/color-utils.ts` `generatePalette(primary, mode)` — emits `--surface-*`, `--text-*`, `--accent-*` CSS vars
- `src/lib/theme/resolve.ts` — writes CSS vars into SiteRenderer injected `<style>` block
- Blocks reference these vars in inline styles

**Content validation — WORKING:**
- `src/lib/ai/content-rules.ts` — blocked CTAs, word count limits
- Applied post-hoc in sanitizer (warnings + auto-fix)

## 3. The ACTUAL Gap

**Infrastructure IS done, but category-awareness IS NOT.**

Plan B built the **FOUNDATION** (tokens, color engine, validation) but never added **CATEGORY-SPECIFIC DATA LAYER**:

- `generatePalette(primary, mode)` accepts ONE `primary` hex — cascades beautifully
- But **no code picks category-specific primary**. Primary comes from AI response which defaults to `#0ea5e9` (generic sky blue) for everything
- Result: spa + tech + restaurant all look identical (same blue palette, same padding, same typography)

**Design tokens are category-INDEPENDENT** by design:
- Spacing 8px grid = universal
- Typography scale = universal
- Shadow/radius = universal
- **COLOR PALETTE is the only category-differentiating axis** — and it's broken (see researcher-02)

## 4. Why User Thinks "Nothing Applied"

**User's expectation:** each category has distinct visual character (spa warm, tech cool, etc)

**Reality:** design tokens work (spacing correct, typography consistent, WCAG contrast), but the ONE dimension that creates visual DNA (color palette) is non-deterministic ad-hoc AI output → everything looks the same.

**Verified by re-inspecting real gen output:**
- Bo Bo Spa V5: primary `#0ea5e9` (generic blue, not warm spa)
- Saigon Premier Realty: primary `#0ea5e9` (same generic blue)
- Every gen: same blue because AI doesn't have category→color rule to follow

## 5. Root Cause Hypothesis

The "design-quality-rules" plan built the **render layer** perfectly (tokens + semantic colors + content rules). But it stopped short of wiring **AI prompt → category → color mapping**. That's the missing bridge.

Phase 05 Block Audit assumed "AI will pick good primary colors if asked nicely." AI doesn't — it defaults to training-data median blue.

## 6. Infrastructure Ready for Fix

To deliver "chuẩn theo từng cate" user vision, **no new infrastructure needed**. Just add:

1. `CATEGORY_THEMES` constant — map 14 categories → primary hex + secondary hex
2. Inject into system prompt: "Use primaryColor=${CATEGORY_THEMES[category]}"
3. Validate AI response: if returned color hue far from category range, override
4. OPTIONAL: category → font pairing override (typography DNA per category)

Effort: ~3-5h (1 file + 1 prompt edit + validation). No schema migration, no block refactor, no new renderer.

## Unresolved Questions

1. Should CATEGORY_THEMES be DETERMINISTIC (same category always same color) or per-BUSINESS variation within category?
2. Do we override AI hue completely OR allow AI to pick SHADE within category hue range?
3. Should TEMPLATE_PRESETS (existing composer fallback, 14 categories × 4 variants) already have distinct themes — can we reuse those?
