# Phase 03 — Randomize Template Composition

## Context
`template-composer.ts` hien tai la 100% deterministic:
- `buildHomePage()` (line 795-858): block order LUON la nav→hero→features→stats→gallery→industry→testimonials→faq→cta→pricing→team→newsletter→contact→footer
- Moi block builder return CUNG variant (e.g. features luon 'grid-3', testimonials luon 'cards', contact luon 'split')
- 2 restaurant professional templates chi khac: businessIndex va themePreset. CUNG block structure.

## Related Code Files
- `src/lib/ai/template-composer.ts` — `buildHomePage()` (line 795-858), `composeTemplate()` (line 934-976)
- `src/lib/ai/template-definitions.ts` — `TEMPLATE_DEFINITIONS` array (48 entries)
- `src/blocks/hero/config.ts` — heroMeta.variants (12 variants available)
- `src/blocks/features/config.ts` — featuresMeta.variants
- `src/blocks/testimonials/config.ts` — testimonialsMeta.variants

## Key Insight
KHONG can random runtime. Can **deterministic but VARIED** composition.
Moi template definition nen co 1 `compositionSeed` number → seed quyet dinh: block order, which optional blocks included, variant per block.

## Requirements
1. Template definitions include `compositionSeed` → deterministic permutation
2. Block order permutation cho middle blocks (giu nav first, footer last)
3. Optional blocks included/excluded per template
4. Variant selection per block type per template

## Implementation Steps

### Step 1: Add `compositionSeed` to ComposerInput
File: `src/lib/ai/template-composer.ts`

```ts
export type ComposerInput = {
  category: string
  businessIndex: number
  variant: 'starter' | 'professional' | 'premium'
  themePreset: ThemePreset
  compositionSeed?: number  // NEW — 0-99, drives all randomization
}
```

### Step 2: Create seeded randomization helpers
File: `src/lib/ai/template-composer.ts` — add near top

```ts
// Simple seeded pseudo-random (deterministic)
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const rand = seededRandom(seed)
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

function pickVariant(variants: string[], seed: number): string {
  return variants[seed % variants.length]!
}
```

### Step 3: Create variant selection map
File: `src/lib/ai/template-composer.ts`

```ts
const BLOCK_VARIANTS: Record<string, string[]> = {
  hero: ['centered', 'split-left', 'split-right', 'gradient', 'parallax', 'fullscreen', 'minimal', 'magazine', 'slideshow', 'cards-overlay', 'split-video'],
  features: ['grid-3', 'grid-2', 'alternating', 'icon-left', 'minimal', 'cards', 'timeline', 'bento', 'masonry'],
  testimonials: ['cards', 'carousel', 'masonry', 'minimal', 'quote-highlight', 'grid', 'slider', 'avatar-row', 'featured'],
  pricing: ['cards', 'comparison', 'minimal', 'toggle', 'feature-list', 'tiered', 'enterprise', 'slider', 'compact', 'highlighted'],
  gallery: ['grid', 'masonry', 'carousel', 'lightbox', 'filmstrip', 'collage', 'featured', 'minimal'],
  contact: ['split', 'centered', 'minimal', 'cards', 'map-side', 'floating', 'modern', 'detailed'],
  footer: ['simple', 'expanded', 'minimal', 'centered', 'mega', 'dark-contrast', 'gradient', 'modern'],
  stats: ['row', 'grid', 'highlight'],
  team: ['grid', 'list', 'cards'],
  newsletter: ['inline', 'banner'],
  faq: ['accordion', 'grid'],
  cta: ['banner', 'split', 'floating'],
  about: ['split', 'centered', 'timeline'],
}
```

### Step 4: Modify `buildHomePage()` — use seed for variant + order
File: `src/lib/ai/template-composer.ts` — replace `buildHomePage()` function

Key changes:
1. Lay variant per block tu `pickVariant(BLOCK_VARIANTS[blockType], seed + blockIndex)`
2. Shuffle middle blocks (between hero va footer) dung `shuffleWithSeed()`
3. Optional blocks: include/exclude based on seed

```ts
// Middle blocks pool (professional+premium)
const OPTIONAL_MIDDLE_BLOCKS = ['stats', 'gallery', 'cta', 'faq', 'about']

function buildHomePage(biz, content, category, variant, seed, pages) {
  const rand = seededRandom(seed)
  const blocks = []
  
  // Fixed: nav first
  blocks.push(buildNavigation(biz, pages))
  
  // Fixed: hero second (but variant varies)
  blocks.push(buildHero(biz, category, seed)) // seed thay cho businessIndex
  
  // Core blocks with varied variants
  blocks.push({ ...buildFeatures(biz, category), variant: pickVariant(BLOCK_VARIANTS.features!, seed + 1) })
  
  // Optional middle blocks — include 60-80% based on seed
  const middleBlocks = []
  if (variant !== 'starter') {
    for (const bt of OPTIONAL_MIDDLE_BLOCKS) {
      if (rand() > 0.3) { // 70% chance include
        middleBlocks.push(buildBlock(bt, ...))
      }
    }
    // Shuffle order
    const shuffled = shuffleWithSeed(middleBlocks, seed + 10)
    blocks.push(...shuffled)
  }
  
  // ...rest
}
```

### Step 5: Update template-definitions.ts — add compositionSeed
File: `src/lib/ai/template-definitions.ts`

Add `compositionSeed` to each definition. Use index * 7 (prime) for good distribution:
```ts
TEMPLATE_DEFINITIONS.map((def, i) => ({
  ...def,
  compositionSeed: (i * 7 + 13) % 100,
}))
```

## Todo
- [ ] Add `compositionSeed` field to `ComposerInput` type
- [ ] Implement `seededRandom()`, `shuffleWithSeed()`, `pickVariant()` helpers
- [ ] Create `BLOCK_VARIANTS` map voi tat ca available variants per block
- [ ] Modify `buildHomePage()` — variant selection per block dung seed
- [ ] Modify `buildHomePage()` — optional block inclusion based on seed
- [ ] Modify `buildHomePage()` — shuffle middle block order based on seed
- [ ] Update `buildHero()` — use seed thay cho businessIndex
- [ ] Add `compositionSeed` to all 48 entries in `template-definitions.ts`
- [ ] Test: 2 restaurant professional templates cho ra KHAC NHAU block order + variants

## Success Criteria
- Cung category + cung tier cho ra >3 distinct layouts (khac block order + variants)
- Composition van deterministic (cung seed = cung output)
- Existing template preview khong break (backward compatible)

## Risk Assessment
- LOW: Chi thay doi composition logic, khong anh huong blocks hay rendering
- Seed approach dam bao deterministic — khong co random behavior trong production
- Test: generate all 48 templates, verify moi cai render dung
