# Phase 04 — High-Impact Fixes

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 03 (baseline report identifies priorities)
- Research: researcher-02 inventory gaps

## Overview
Date: 2026-04-18
Description: Fix top 3 systemic gaps affecting all 56 templates: Logo Cloud missing, category-color flat, testimonials no avatar.
Priority: P1
Implementation status: pending
Review status: not started

## Key Insights
- 3 gaps = 100% of templates affected (universal ROI)
- Logo Cloud: add block to all 56 preset `pages[0].blocks` after Hero
- Category colors: implement `CATEGORY_THEMES` map in theme resolver, override AI default
- Avatar schema: add `avatarUrl?` to TestimonialSample + render support in testimonials block

## Requirements

### 4.1 Logo Cloud everywhere
- Add `{ blockType: 'client-logos', variant: 'scroll' }` to all 56 presets after Hero
- Use existing `pickLogosByCategory()` data source (already returns MY brand names per category)
- Position: row 3 of homepage blocks (per standard section 1.1)

### 4.2 Category-aware theming
- Create `CATEGORY_THEMES: Record<string, { primary, secondary, accent }>` in `src/lib/ai/category-theme-picker.ts` (exists? check)
- 14 categories × 3 color values each:
  - Restaurant: warm red/orange/cream
  - Beauty: pink/rose/gold
  - Tech: navy/cyan/mint
  - Fitness: bold red/black/electric
  - Events: gold/burgundy/ivory
  - (etc.)
- Override composer's default `#0ea5e9` with category hue
- All 4 presets within category still differ via lightness/saturation variation

### 4.3 Testimonial avatars
- Update `TestimonialSample` type: add `avatarUrl?: string`
- Update content library: 14 categories × 4 testimonials = 56 avatars
  - Option A: Generated AI avatars (DALL-E) with business-appropriate personas
  - Option B: Placeholder AVATAR_FALLBACK_SVG with initials
  - Recommend B initially (zero cost), swap to A later
- Update testimonials block renderer to show avatar when URL provided, fallback to initials badge

## Architecture

```
src/lib/ai/
  ├── template-composer.ts        (add Logo Cloud to all presets — batch mutation)
  ├── category-theme-picker.ts    (existing, extend with CATEGORY_THEMES)
  ├── content/<cat>.ts             (add avatarUrl to testimonials — 14 files × 4 testimonials)
  └── content/types.ts             (extend TestimonialSample)

src/blocks/testimonials/
  └── index.tsx                   (render avatar from url OR initials)
```

## Related code files
- `src/lib/ai/template-presets-batch{1,2,3}.ts` — 56 preset definitions
- `src/lib/ai/category-theme-picker.ts` — theme resolution logic
- `src/lib/ai/content/*.ts` — 14 category content files
- `src/lib/ai/content/types.ts` — shared types
- `src/blocks/testimonials/index.tsx` — renderer
- `src/blocks/logo-cloud/index.tsx` — existing renderer (working per recent fix)
- `src/lib/ai/client-logos-library.ts` — logo data source

## Implementation Steps

### 4.1 Logo Cloud (2h)
1. Write script `scripts/add-logo-cloud-to-presets.ts` — reads 3 batch files, inserts Logo Cloud block at index 2 (after Hero) in each preset's home page, writes back
2. Verify 56 presets now have Logo Cloud (grep)
3. Regen matrix, verify logo-cloud block count per fixture = 1 (not duplicate)
4. Visual check 3 fixtures in harness

### 4.2 Category colors (3h)
1. Audit existing `category-theme-picker.ts` for structure
2. Define 14-category × 3-color mapping (research Wix references + Malaysian brand color trends)
3. Integrate into composer: when no user override, use CATEGORY_THEMES[preset.category]
4. Variation within category: seed × salt to pick between 4 tonal variants
5. Regen matrix, verify theme.primaryColor differs per category
6. Visual check 5 categories in harness (restaurant ≠ tech ≠ beauty)

### 4.3 Testimonial avatars (1h)
1. Extend `TestimonialSample` type with `avatarUrl?: string`
2. Update testimonials block renderer: if `avatarUrl` → `<img>`, else → initials badge (same as LogoPlaceholder pattern)
3. Content library stays WITHOUT real URLs initially (placeholder slot ready)
4. Test in harness

## Todo list
- [ ] Script add Logo Cloud to 56 presets
- [ ] Verify + regen matrix
- [ ] Design CATEGORY_THEMES map (14 cats × 3 hues)
- [ ] Wire into composer
- [ ] Verify theme diversity in matrix
- [ ] Add avatarUrl to TestimonialSample
- [ ] Update testimonials renderer fallback
- [ ] Visual QA 5+ fixtures
- [ ] Commit

## Success Criteria
- 56/56 presets show Logo Cloud block after Hero (standard section 1.1 row 3 ✅)
- 56/56 theme.primaryColor matches category palette (no more uniform #0ea5e9)
- Testimonials render avatar placeholder (badge) when no URL, ready for real URL swap
- Re-run Phase 02 scorer: Visual Richness + Social Proof dimension scores bumped significantly

## Risk Assessment
- **Medium**: Batch edit 56 preset files risk touching wrong JSON shape. Write script with dry-run flag + diff preview before write.
- **Low**: Category colors may clash with existing themePreset overrides. Priority chain: user-override > themePreset > CATEGORY_THEMES > default.
- **Low**: Testimonial avatar fallback must handle RTL languages (Arabic initials). Use character first-letter heuristic.

## Security Considerations
- No user input affected.
- Testimonial URLs when real: validate format (https only), no XSS via alt text.

## Next steps
- Phase 05: Category-specific enhancements (can run parallel with 04).
