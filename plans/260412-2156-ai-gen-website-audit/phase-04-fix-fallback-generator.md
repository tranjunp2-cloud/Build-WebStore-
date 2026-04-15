# Phase 04: Fix Fallback Generator Variety

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 03 (reuse `enforceMinContent`, `BROKEN_VARIANTS`)
- File: `src/lib/ai/generate-blocks.ts` (315 lines)
- Priority: P2
- Status: pending

## Mục tiêu
Rule-based fallback hiện 100% deterministic. Cần seeded PRNG + variety logic.

## Reuse từ Phase 03
- `enforceMinContent()` — import từ openai-generator.ts
- `BROKEN_VARIANTS` — hero:animated-gradient exclusion
- Pattern: content-count guard trước khi assign variant

## Implementation Steps

### 4.1 Seeded PRNG Utilities

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

**Test:** `Date.now()` > 2^32 — `& 0xFFFFFFFF` handles overflow. Verify cùng seed → cùng output.

### 4.2 Variant Options per Block Type

```typescript
const VARIANT_OPTIONS: Record<string, string[]> = {
    hero: ['centered', 'split-left', 'fullscreen', 'gradient', 'parallax', 'magazine', 'minimal', 'slideshow'],
    // ↑ Exclude animated-gradient (broken) + split-right (same as split-left)
    features: ['grid-2', 'grid-3', 'grid-4', 'list', 'icon-top', 'icon-left', 'zigzag'],
    testimonials: ['cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote'],
    contact: ['form', 'split', 'card-float', 'minimal-inline'],
    footer: ['simple', 'expanded', 'minimal', 'centered-stack', 'mega-footer', 'dark-gradient'],
    faq: ['accordion', 'grid', 'simple'],
    cta: ['banner', 'inline', 'floating'],
    stats: ['row', 'grid', 'highlight'],
    gallery: ['grid', 'masonry', 'carousel', 'lightbox'],
    navigation: ['simple', 'centered', 'transparent', 'pill'],
    about: ['simple', 'split', 'story'],
    newsletter: ['inline', 'popup', 'banner'],
    team: ['grid', 'list'],
    pricing: ['cards', 'table', 'horizontal', 'toggle'],
}
```

### 4.3 Middle Block Pool + Shuffle

```typescript
const MIDDLE_BLOCK_POOL = ['about', 'features', 'stats', 'gallery', 'testimonials', 'faq', 'cta', 'newsletter', 'team']

// Chọn 4-7 blocks random, shuffle thứ tự
const middleCount = 4 + Math.floor(rand() * 4)
const middleBlocks = shuffleArray(MIDDLE_BLOCK_POOL, rand).slice(0, middleCount)
```

**Ordering constraints** (từ scenario analysis #25):
- `features` phải trước `stats` (stats cần context)
- `about` phải trước `team`
- `features` phải trước `pricing`

### 4.4 Theme Palettes — 3 per Category

Thay 1 palette cố định bằng 3 options random:

```typescript
const THEME_PALETTES: Record<BusinessIntent['type'], GenerationResult['theme'][]> = {
    restaurant: [
        { primaryColor: '#D97706', secondaryColor: '#92400E', fontHeading: 'Playfair Display', fontBody: 'Inter', colorMode: 'light' },
        { primaryColor: '#DC2626', secondaryColor: '#7F1D1D', fontHeading: 'DM Sans', fontBody: 'Lato', colorMode: 'dark' },
        { primaryColor: '#059669', secondaryColor: '#065F46', fontHeading: 'Raleway', fontBody: 'Open Sans', colorMode: 'light' },
    ],
    ecommerce: [
        { primaryColor: '#0EA5E9', secondaryColor: '#6366F1', fontHeading: 'DM Sans', fontBody: 'Inter', colorMode: 'light' },
        { primaryColor: '#8B5CF6', secondaryColor: '#EC4899', fontHeading: 'Outfit', fontBody: 'Nunito', colorMode: 'dark' },
        { primaryColor: '#10B981', secondaryColor: '#3B82F6', fontHeading: 'Poppins', fontBody: 'Lato', colorMode: 'light' },
    ],
    // ... 3 palettes per remaining categories
}
```

**Font pairing rule:** heading !== body (từ Phase 02 DESIGN RULES). Không dùng Inter+Inter.

### 4.5 Content Variations — 3 per Category

Mỗi category có 3 sets:
- Hero headline + subheadline
- Feature titles + descriptions
- CTA text
- About body text

Random chọn 1 set per generation.

### 4.6 Update Function Signature

```typescript
// TRƯỚC
export function generateBlocks(prompt: string): GenerationResult

// SAU
export function generateBlocks(prompt: string, seed?: number): GenerationResult
```

Caller trong `openai-generator.ts` line 209 truyền `Date.now()`:
```typescript
const generated = generateBlocks(prompt, Date.now())
```

### 4.7 Wire Content Guards

```typescript
import { enforceMinContent } from './openai-generator'

// Sau khi chọn variant, enforce content count
const variant = pickRandom(VARIANT_OPTIONS[blockType], rand)
const finalVariant = enforceMinContent(blockType, variant, contentItems.length)
```

## Todo
- [ ] Thêm seeded PRNG utilities (createSeededRandom, pickRandom, shuffleArray)
- [ ] Thêm VARIANT_OPTIONS (14 block types, exclude broken variants)
- [ ] Implement middle block pool + shuffle + ordering constraints
- [ ] Expand THEME_PALETTES → 3 per category (5 categories × 3 = 15 palettes)
- [ ] Thêm 3 content variations per category
- [ ] Update function signature + caller
- [ ] Wire enforceMinContent() cho mỗi block
- [ ] Test: same seed → same output (reproducibility)
- [ ] Test: 10 calls no seed → 7+ distinct layouts

## Success Criteria
- [ ] 10 calls no seed → 7+ distinct block compositions
- [ ] Same seed → identical output
- [ ] Hero variant varies (không luôn centered)
- [ ] Theme colors vary (không luôn cùng palette)
- [ ] Content varies (không luôn cùng headline)
- [ ] Features before stats ordering maintained
- [ ] No broken variants in output
