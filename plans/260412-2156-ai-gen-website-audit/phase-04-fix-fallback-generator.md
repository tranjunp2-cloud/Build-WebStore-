# Phase 04: Fix Fallback Generator Variety

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (confirmed determinism)
- File: `src/lib/ai/generate-blocks.ts` (315 lines)
- Priority: P2
- Status: pending

## Overview
Rule-based fallback is 100% deterministic: fixed block order, hardcoded variants, one theme per category, same content every time.

## Key Insights
- Triggered when OpenAI API key missing or AI call fails
- 7 blocks always in same order: nav -> hero -> about -> features -> testimonials -> contact -> footer
- Only 5 theme palettes (one per business type)
- Features hardcoded per category — same 3 features every "restaurant"
- All variants hardcoded: nav "simple", features "grid-3", testimonials "cards", etc.

## Implementation Steps

### 4.1 Add Seeded PRNG

```typescript
function createSeededRandom(seed?: number): () => number {
    let s = seed ?? Date.now()
    return () => {
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        return (s >>> 0) / 0xFFFFFFFF
    }
}

function pickRandom<T>(arr: T[], rand: () => number): T {
    return arr[Math.floor(rand() * arr.length)]!
}

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!]
    }
    return copy
}
```

### 4.2 Randomize Block Composition

Replace fixed 7-block sequence with pool selection:

```typescript
const MIDDLE_BLOCK_POOL = ['about', 'features', 'stats', 'gallery', 'testimonials', 'faq', 'cta', 'newsletter', 'team']
const middleCount = 4 + Math.floor(rand() * 4) // 4-7 blocks
const middleBlocks = shuffleArray(MIDDLE_BLOCK_POOL, rand).slice(0, middleCount)
```

Keep nav first, footer last. Shuffle everything in between.

### 4.3 Randomize Variant Per Block

```typescript
const VARIANT_OPTIONS: Record<string, string[]> = {
    hero: ['centered', 'split-left', 'split-right', 'fullscreen', 'gradient', 'parallax', 'magazine', 'minimal'],
    features: ['grid-2', 'grid-3', 'grid-4', 'list', 'icon-top', 'icon-left', 'zigzag'],
    testimonials: ['cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote'],
    contact: ['form', 'split', 'card-float', 'minimal-inline'],
    footer: ['simple', 'expanded', 'minimal', 'centered-stack', 'mega-footer', 'dark-gradient'],
    faq: ['accordion', 'grid', 'simple'],
    cta: ['banner', 'inline', 'floating'],
    stats: ['row', 'grid', 'highlight'],
    gallery: ['grid', 'masonry', 'carousel', 'lightbox'],
    navigation: ['simple', 'centered', 'transparent', 'pill'],
}
```

### 4.4 Expand Theme Palettes (3 per category)

```typescript
const THEME_PALETTES: Record<BusinessIntent['type'], GenerationResult['theme'][]> = {
    restaurant: [
        { primaryColor: '#D97706', secondaryColor: '#92400E', fontHeading: 'Playfair Display', fontBody: 'Inter', colorMode: 'light' },
        { primaryColor: '#DC2626', secondaryColor: '#7F1D1D', fontHeading: 'DM Sans', fontBody: 'Lato', colorMode: 'dark' },
        { primaryColor: '#059669', secondaryColor: '#065F46', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
    ],
    // ... 3 per category
}
```

### 4.5 Vary Content Templates (3 per category)

Expand from 1 to 3 content variations per category:
- Different hero headlines
- Different feature descriptions
- Different CTA text

### 4.6 Update Function Signature

```typescript
export function generateBlocks(prompt: string, seed?: number): GenerationResult
```

Caller passes `Date.now()` as seed.

## Related Files
- `src/lib/ai/generate-blocks.ts` (main target)
- `src/lib/ai/openai-generator.ts` (caller, line 209)

## Todo
- [ ] Add seeded PRNG utilities
- [ ] Implement middle block pool + shuffle
- [ ] Add VARIANT_OPTIONS map + random selection
- [ ] Expand THEME_PALETTES to 3 per category
- [ ] Add 3 content variations per category
- [ ] Update function signature with seed param
- [ ] Update caller in openai-generator.ts

## Success Criteria
- [ ] 10 calls with no seed -> 7+ distinct layouts
- [ ] Same seed twice -> identical output
- [ ] Hero variant varies across calls
- [ ] Features/testimonials/footer variants vary
- [ ] Theme colors vary within same category

## Risk Assessment
- Medium: changing fallback behavior affects users without OpenAI key
- Seeded PRNG ensures reproducibility for debugging
- Content variations need careful writing to maintain quality
