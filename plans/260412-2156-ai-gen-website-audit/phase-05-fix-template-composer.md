# Phase 05: Fix Template Composer

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 04 (shared PRNG utilities)
- Files: `src/lib/ai/template-composer.ts` (~1100 lines), `src/lib/ai/template-definitions.ts`
- Priority: P2
- Status: pending

## Overview
14/15 builder functions hardcode a single variant. `buildHomePage()` always produces same block order per tier. 48 old templates only vary businessIndex + themePreset, NOT block structure.

## Key Insights
- Only `buildHero` varies (via `themePresetIndex % variants.length`)
- buildFeatures always "grid-3", buildTestimonials always "cards", buildContact always "split", etc.
- Block order in `buildHomePage()` is fixed: nav -> hero -> features -> [stats, gallery, industry] -> testimonials -> [faq, cta] -> [pricing, team, newsletter] -> footer
- New blueprints (56 presets) have `BlockSpec[]` but many leave variant undefined

## Implementation Steps

### 5.1 Add compositionSeed to ComposerInput

```typescript
export type ComposerInput = {
    category: string
    businessIndex: number
    variant: 'starter' | 'professional' | 'premium'
    themePreset: ThemePreset
    compositionSeed?: number  // NEW
}
```

### 5.2 Create Seed-Based Variant Selector

```typescript
function selectVariant(blockType: string, seed: number, category: string): string {
    const meta = blockRegistry.getBlockMeta(blockType)
    if (!meta || meta.variants.length <= 1) return meta?.defaultVariant ?? 'default'
    const hash = simpleHash(blockType + category + seed)
    return meta.variants[hash % meta.variants.length]!
}
```

### 5.3 Refactor All 15 Builder Functions

Add optional `variant?: string` parameter to each:

```typescript
// Before:
function buildFeatures(biz, category) {
    return { blockType: 'features', variant: 'grid-3', ... }
}
// After:
function buildFeatures(biz, category, variant?: string) {
    return { blockType: 'features', variant: variant ?? 'grid-3', ... }
}
```

Apply to: buildNavigation, buildFeatures, buildTestimonials, buildContact, buildFooter, buildStats, buildGallery, buildFAQ, buildCTA, buildAbout, buildPricing, buildTeam, buildNewsletter, + all industry block builders.

### 5.4 Shuffle Middle Blocks in buildHomePage

After building all blocks, shuffle everything between nav (first) and footer (last):

```typescript
const rand = createSeededRandom(compositionSeed)
const shuffled = shuffleArray(middleBlocks.filter(Boolean), rand)
blocks = [navBlock, ...shuffled, footerBlock]
```

### 5.5 Optional Block Inclusion by Seed

For professional/premium tiers, 70% chance per optional block:

```typescript
const optionalBlocks = ['newsletter', 'team', 'faq']
const included = optionalBlocks.filter(() => rand() > 0.3)
```

### 5.6 Update Template Definitions

Add `compositionSeed` to each of 48 definitions:
```typescript
TEMPLATE_DEFINITIONS.map((def, i) => ({ ...def, compositionSeed: i * 7919 }))
```

### 5.7 Update composeFromBlueprint

For 56 new presets: if `BlockSpec.variant` is undefined, use `selectVariant()` instead of letting builder use hardcoded default.

## Related Files
- `src/lib/ai/template-composer.ts` (main target — 15 builder functions)
- `src/lib/ai/template-definitions.ts` (48 old + 56 new definitions)
- `src/blocks/registry.ts` (variant metadata source)

## Todo
- [ ] Add compositionSeed to ComposerInput type
- [ ] Implement selectVariant() + simpleHash()
- [ ] Add variant param to all 15 builder functions
- [ ] Wire seed-based variant selection in buildHomePage()
- [ ] Implement middle block shuffling
- [ ] Add optional block inclusion logic
- [ ] Add compositionSeed to 48 old template definitions
- [ ] Update composeFromBlueprint for undefined variants
- [ ] Test: 4 same-category templates have different variant combos

## Success Criteria
- [ ] No two templates in same category have identical block order + variant combination
- [ ] 4 restaurant templates: features/testimonials/footer variants all differ
- [ ] Same seed -> same output (reproducibility)
- [ ] New blueprints get varied variants when spec.variant is undefined

## Risk Assessment
- High: touching 15 builder functions across 1100-line file
- Mitigated by: optional variant param with existing hardcoded default as fallback
- Seed approach ensures backward compatibility: seed=undefined -> current behavior
- Must validate all 47 blocks still render correctly with non-default variants
