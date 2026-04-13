# Phase 05: Fix Template Composer

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 03 (reuse enforceMinContent), Phase 04 (reuse PRNG utils)
- Files: `src/lib/ai/template-composer.ts` (~1100 lines), `src/lib/ai/template-definitions.ts`
- Priority: P2
- Status: pending

## Mục tiêu
14/15 builder functions hardcode 1 variant. Cần seed-based variety cho templates.

## Reuse từ Phase 03 + 04
- `enforceMinContent()` — content-count guard
- `BROKEN_VARIANTS` — exclude animated-gradient
- `createSeededRandom()`, `pickRandom()`, `shuffleArray()` — PRNG utilities
  - **Option A:** Import từ generate-blocks.ts
  - **Option B:** Extract vào shared `src/lib/ai/utils.ts` (recommended — DRY)

## Implementation Steps

### 5.1 Extract Shared PRNG Utilities

Tạo `src/lib/ai/utils.ts`:
```typescript
export function createSeededRandom(seed?: number): () => number
export function pickRandom<T>(arr: T[], rand: () => number): T
export function shuffleArray<T>(arr: T[], rand: () => number): T[]
export function simpleHash(str: string): number
```

Cả Phase 04 + 05 import từ đây.

### 5.2 Add compositionSeed to ComposerInput

```typescript
export type ComposerInput = {
    category: string
    businessIndex: number
    variant: 'starter' | 'professional' | 'premium'
    themePreset: ThemePreset
    compositionSeed?: number  // NEW — undefined = backward-compatible
}
```

### 5.3 Seed-Based Variant Selector

```typescript
function selectVariant(blockType: string, seed: number, category: string): string {
    const meta = blockRegistry.getBlockMeta(blockType)
    if (!meta || meta.variants.length <= 1) return meta?.defaultVariant ?? 'default'

    // Exclude broken variants
    const broken = BROKEN_VARIANTS[blockType] ?? []
    const safe = meta.variants.filter(v => !broken.includes(v))
    if (safe.length === 0) return meta.defaultVariant ?? meta.variants[0]!

    const hash = simpleHash(blockType + category + seed)
    return safe[hash % safe.length]!
}
```

### 5.4 Refactor 15 Builder Functions

Add optional `variant?: string` param. Existing hardcode = default fallback:

```typescript
// TRƯỚC
function buildFeatures(biz, category) {
    return { blockType: 'features', variant: 'grid-3', ... }
}

// SAU
function buildFeatures(biz, category, variant?: string) {
    return { blockType: 'features', variant: variant ?? 'grid-3', ... }
}
```

**15 functions:**
buildNavigation, buildHero, buildFeatures, buildTestimonials, buildContact, buildFooter, buildStats, buildGallery, buildFAQ, buildCTA, buildAbout, buildPricing, buildTeam, buildNewsletter + tất cả industry block builders (buildMenuDisplay, buildBookingWidget, etc.)

### 5.5 Shuffle Middle Blocks in buildHomePage

```typescript
function buildHomePage(biz, content, category, variant, themePresetIndex, pages, compositionSeed?) {
    const blocks = []
    
    // Fixed: nav first
    blocks.push(buildNavigation(biz, pages, selectVariant('navigation', seed, category)))
    
    // Fixed: hero second
    blocks.push(buildHero(biz, category, themePresetIndex, selectVariant('hero', seed, category)))
    
    // Middle blocks: build all, then shuffle
    const middleBlocks = []
    middleBlocks.push(buildFeatures(biz, category, selectVariant('features', seed, category)))
    // ... stats, gallery, industry blocks, testimonials, faq, cta, pricing, team, newsletter
    
    // Shuffle middle section (seed-based)
    if (compositionSeed != null) {
        const rand = createSeededRandom(compositionSeed)
        // Ordering constraints: features before stats, about before team
        const shuffled = shuffleWithConstraints(middleBlocks, rand)
        blocks.push(...shuffled)
    } else {
        blocks.push(...middleBlocks) // backward-compatible: no shuffle
    }
    
    // Fixed: footer last
    blocks.push(buildFooter(biz, pages, selectVariant('footer', seed, category)))
}
```

### 5.6 Optional Block Inclusion

Professional/premium tiers: 70% chance per optional block:
```typescript
const optionalTypes = ['newsletter', 'team', 'faq']
// rand() > 0.3 → include (seed-based, reproducible)
```

### 5.7 Update Template Definitions

48 old definitions: thêm `compositionSeed`:
```typescript
TEMPLATE_DEFINITIONS.map((def, i) => ({ ...def, compositionSeed: i * 7919 }))
```

56 new blueprints: trong `composeFromBlueprint()`, khi `BlockSpec.variant` undefined → dùng `selectVariant()`.

### 5.8 Wire Content Guards

Mỗi builder function output → run `enforceMinContent()`:
```typescript
const variant = selectVariant('testimonials', seed, category)
const finalVariant = enforceMinContent('testimonials', variant, content.testimonials.length)
```

## Todo
- [ ] Extract shared PRNG vào `src/lib/ai/utils.ts`
- [ ] Add compositionSeed to ComposerInput type
- [ ] Implement selectVariant() + simpleHash()
- [ ] Add variant param to 15 builder functions
- [ ] Wire seed-based variant selection in buildHomePage()
- [ ] Implement middle block shuffle with ordering constraints
- [ ] Add optional block inclusion logic (70% probability)
- [ ] Add compositionSeed to 48 old template definitions
- [ ] Update composeFromBlueprint() for undefined variants
- [ ] Wire enforceMinContent() cho mỗi builder output
- [ ] Test: 4 same-category templates → different variant combos
- [ ] Test: same seed → same output

## Success Criteria
- [ ] No two templates in same category have identical block order + variant combination
- [ ] Same seed → same output (reproducibility)
- [ ] compositionSeed undefined → behavior cũ (backward-compatible)
- [ ] No broken variants in output
- [ ] Content-count guard active cho template path
- [ ] Features before stats ordering maintained

## Risk Assessment
- **High**: 15 builder functions × 1100-line file
- **Mitigation**: optional variant param, hardcoded default = fallback
- **Mitigation**: compositionSeed undefined → no change (backward-compatible)
- **Must test**: all 142 variants still render correctly (visual regression)
