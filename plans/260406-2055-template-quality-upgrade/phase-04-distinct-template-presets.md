# Phase 04 — 30 Distinct Template Presets

## Context
Hien tai 48 templates = 11 categories x ~4-5 variants. Nhung visual diversity thap vi:
- Cung category share cung block builders (cung features content, cung stats data)
- Variant chi anh huong so luong blocks (starter < professional < premium), KHONG anh huong style
- businessIndex chi thay doi ten + tagline, khong thay doi layout

Sau Phase 01-03, blocks da co variants va composition da random. Phase nay tao 30 **named presets** voi unique "visual fingerprint" — combination cua: block selection, variant per block, theme, va layout feel.

## Related Code Files
- `src/lib/ai/template-definitions.ts` — TEMPLATE_DEFINITIONS array (replace)
- `src/lib/ai/template-composer.ts` — ComposerInput type, composeTemplate()
- `src/lib/ai/theme-presets.ts` — 55 theme presets available
- `src/lib/ai/content/*.ts` — 11 content files voi businesses

## Key Insight
Moi "distinct" template can unique combination cua 4 yeu to:
1. **Block selection** — which blocks included (6-12 blocks)
2. **Variant per block** — hero:parallax vs hero:magazine vs hero:minimal
3. **Theme preset** — colors + spacing + radius + shadow
4. **Content category** — restaurant vs tech vs beauty

30 presets = ~3 per category, moi cai co KHAC NHAU block combo va variant selection.

## Requirements
1. 30 named template presets (replace hien tai 48)
2. Moi preset specify: explicit block list + variant per block + theme preset
3. Visual diversity: no 2 templates trong cung category nhin giong nhau
4. Cover tat ca 11 categories (2-3 per category)

## Implementation Steps

### Step 1: Define TemplatePreset type
File: `src/lib/ai/template-definitions.ts`

```ts
export type BlockSpec = {
  blockType: string
  variant: string
}

export type TemplatePreset = {
  id: string                    // e.g. 'restaurant-warm-classic'
  name: string                  // display name
  category: string
  businessIndex: number
  tier: 'starter' | 'professional' | 'premium'
  themePreset: ThemePreset
  compositionSeed: number
  // NEW — explicit block lineup per page
  homeBlocks: BlockSpec[]       // ordered list of blocks for homepage
  aboutBlocks?: BlockSpec[]     // optional — if undefined, use default
  servicesBlocks?: BlockSpec[]
}
```

### Step 2: Create 30 presets — 3 per category (trung binh)

Moi category co 3 presets voi KHAC NHAU feel:

**Restaurant (3):**
```
1. "Warm Classic" — hero:split-left, features:alternating, menu-display:tabs, gallery:masonry, testimonials:quote-highlight, footer:expanded
   Theme: Warm Spice (light, relaxed, soft, subtle shadow)

2. "Night Market Vibe" — hero:fullscreen, stats:highlight, menu-display:tabs, review-cards:grid, cta:split, footer:minimal
   Theme: Night Market (dark, default, rounded, medium shadow)

3. "Heritage Fine Dining" — hero:magazine, about:split, gallery:collage, booking-widget:inline, testimonials:featured, newsletter:banner, footer:mega
   Theme: Heritage Gold (light, relaxed, soft, medium shadow)
```

**Tech (3):**
```
1. "Clean SaaS" — hero:gradient, features:grid-3, pricing:comparison, testimonials:cards, cta:banner, footer:expanded
   Theme: Clean SaaS (light, default, rounded, subtle)

2. "Dark Console" — hero:split-video, features:bento, stats:grid, feature-comparison:table, pricing-table:columns, footer:dark-contrast
   Theme: Dark Console (dark, compact, subtle radius, medium shadow)

3. "Startup Launch" — hero:cards-overlay, features:timeline, video-showcase:grid, testimonials:carousel, pricing:toggle, newsletter:banner, footer:modern
   Theme: Neon Teal (dark, compact, subtle, dramatic)
```

**Beauty (3):**
```
1. "Rose Petal" — hero:gradient, features:icon-left, gallery:lightbox, booking-widget:inline, testimonials:masonry, footer:centered
   Theme: Rose Petal (light, relaxed, pill, subtle)

2. "Glam Studio" — hero:parallax, before-after:slider, service-cards:grid, review-cards:grid, cta:floating, footer:gradient
   Theme: Midnight Glam (dark, default, rounded, dramatic)

3. "Natural Glow" — hero:minimal, features:cards, gallery:carousel, testimonials:avatar-row, newsletter:inline, footer:simple
   Theme: Natural Glow (light, default, soft, subtle)
```

Tuong tu cho: ecommerce (3), health (3), education (2), realestate (3), fitness (3), creative (3), business (3), fnb (2).

### Step 3: Update template-definitions.ts
Replace `TEMPLATE_DEFINITIONS` array voi 30 `TemplatePreset` objects.

### Step 4: Update template-composer.ts — use explicit block specs
Modify `buildHomePage()` de accept `BlockSpec[]` thay vi hardcoded block order.

```ts
function buildHomePageFromSpecs(
  specs: BlockSpec[],
  biz: BusinessSample,
  content: CategoryContent,
  category: string,
  pages: string[],
): TemplatePage {
  const blocks = specs.map(spec => {
    const block = buildBlockByType(spec.blockType, biz, content, category, pages)
    if (block) block.variant = spec.variant
    return block
  }).filter(Boolean)
  
  return { title: 'Home', slug: '/', layout: blocks }
}
```

### Step 5: Verify diversity
Script/test: generate all 30 templates, extract block lineup per template, assert no duplicates.

## Todo
- [ ] Define `TemplatePreset` va `BlockSpec` types
- [ ] Create 30 presets: 3 restaurant, 3 tech, 3 beauty, 3 ecommerce, 3 health, 2 education, 3 realestate, 3 fitness, 3 creative, 3 business, 2 fnb
- [ ] Each preset: unique block selection (6-12 blocks) + variant per block
- [ ] Update `template-definitions.ts` — replace TEMPLATE_DEFINITIONS
- [ ] Update `template-composer.ts` — `buildHomePageFromSpecs()` function
- [ ] Update `composeTemplate()` — read block specs from preset
- [ ] Test: generate all 30, verify unique visual fingerprints
- [ ] Update seed route (`src/app/api/templates/seed/route.ts`) if needed

## Success Criteria
- 30 templates, no 2 in same category co identical block lineup
- Moi template co 6-12 blocks voi explicit variant selection
- Preview moi template nhin VISUALLY DISTINCT
- Backward compatible: existing sites khong bi anh huong

## Risk Assessment
- MEDIUM: Replace 48 templates voi 30 — existing template references co the break
- Mitigation: keep old template IDs as aliases, or re-seed
- Phai re-run seed script sau khi deploy
- Test thoroughly tren staging truoc khi merge
