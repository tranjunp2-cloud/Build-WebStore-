# Research #03 — System Prompt + Category DNA + Min Content Rules (Scope B)

> Created: 2026-04-14 (main-agent inline research)
> For: plan 260414-1400-ai-gen-unsplash-pipeline

## Current State of System Prompt (`src/lib/ai/system-prompt.ts`)

### Already implemented (from Plan A Phase 02, done 2026-04-13)

1. **`CATEGORY_SIGNATURE_BLOCKS` (lines 92-107)** — 14 categories, each with 3 signature blocks:
```ts
restaurant: ['menu-display', 'booking-widget', 'gallery']
beauty: ['before-after', 'booking-widget', 'gallery']
// ... 12 more
```
Used by `generateCompositionHint()` to pick 1-2 per gen.

2. **`HERO_VARIANTS_BY_CATEGORY` (lines 113-128)** — hero variant pool per category.

3. **`generateCompositionHint(category)` (lines 152-?)** — dynamic composition:
   - hero variant random from category pool
   - 1-2 signature blocks
   - 3-4 common blocks random from `COMMON_BLOCKS = ['features', 'testimonials', 'about', 'stats', 'faq', 'cta', 'newsletter', 'team']`
   - Shuffle middle section
   - Footer variant random

4. **PROFESSIONAL DESIGN RULES** (line 268) + **VARIETY RULES** (line 323) in system prompt text.

5. **8 personalities with keyword matching** — `selectPersonality(info)` matches user input to Bold/Minimal/Warm/Professional/Creative/Luxurious/Tech/Editorial.

## What's MISSING for B scope

### 1. No hard minimum block count enforcement
- AI often returns 5-7 blocks (sparse). User screenshot shows 6 sections = "xấu".
- Need `MIN_BLOCKS_PER_CATEGORY` map — e.g. beauty=10, restaurant=11, ecommerce=10.
- Server-side validation after AI response: if below minimum, INJECT missing blocks from signature/common pool BEFORE save.

### 2. No minimum items per block
- AI gen 2 testimonials, 2 team members, 3 features → looks sparse.
- Need per-block `min_items`:
  - testimonials ≥4
  - team ≥3
  - features ≥4-6
  - services ≥4
  - gallery ≥6 (once media pipeline lands)
  - faq ≥5
- Sanitizer should PAD (duplicate + modify) if below min, not drop.

### 3. No industry-MANDATORY blocks enforcement
- `CATEGORY_SIGNATURE_BLOCKS` only picks 1-2 of 3. AI can skip signature blocks.
- For spa/beauty: MUST have `booking-widget` (can't skip)
- For restaurant: MUST have `menu-display` + `gallery`
- For portfolio/creative: MUST have `portfolio-grid` + `gallery`
- Need `MANDATORY_BLOCKS_PER_CATEGORY` enforced post-AI (inject if AI skipped).

### 4. No few-shot examples in system prompt
- System prompt describes blocks generically. AI defaults to safe layouts (nav/hero/features/team/footer).
- Add 1-2 example JSON per category showing rich 10-12 block layouts.
- Increases token cost but improves output structure.

### 5. No content depth rules
- Hero subheadline often 5 words. Should be 15-25.
- About section often empty bullet list. Should have full paragraphs.
- CTA descriptions shallow.
- Need content length rules baked into prompt.

### 6. Content rules file exists but not surfaced to prompt
- `src/lib/ai/content-rules.ts` has blocked CTAs + line length rules.
- Not mentioned in system prompt → AI doesn't know. Only enforced post-hoc in sanitizer.
- Should include summary in prompt text: "NEVER use 'Learn More', 'Click Here', 'Submit'".

## Proposed changes for Scope B

### Phase 5 (B1): `CATEGORY_REQUIREMENTS` constant
New constant in system-prompt.ts:
```ts
interface CategoryRequirement {
    minBlocks: number
    mandatoryBlocks: string[]   // MUST appear
    recommendedBlocks: string[] // SHOULD appear
    minItems: Record<string, number> // per-block min items
}

const CATEGORY_REQUIREMENTS: Record<string, CategoryRequirement> = {
    beauty: {
        minBlocks: 10,
        mandatoryBlocks: ['hero', 'booking-widget', 'team', 'testimonials', 'footer'],
        recommendedBlocks: ['gallery', 'before-after', 'service-cards', 'faq'],
        minItems: { team: 3, testimonials: 4, gallery: 6, services: 4 }
    },
    restaurant: {
        minBlocks: 11,
        mandatoryBlocks: ['hero', 'menu-display', 'gallery', 'testimonials', 'contact', 'footer'],
        // ...
    },
    // ... 12 more
}
```

### Phase 5 (B2): Post-AI gap-filler
New function in validateBlocks (openai-generator.ts):
```ts
function enforceMinimumStructure(blocks, category) {
    const req = CATEGORY_REQUIREMENTS[category]
    const present = new Set(blocks.map(b => b.blockType))
    const missing = req.mandatoryBlocks.filter(b => !present.has(b))
    // Inject missing blocks from composer's pre-authored content
    for (const blockType of missing) {
        blocks.push(injectBlockFromComposer(blockType, category, seed))
    }
    return blocks
}
```

### Phase 5 (B3): Min items PAD in sanitizer
Extend existing `enforceMinContent()` in sanitizer:
```ts
// Before: just swaps variant if count < min
// After: also PADS items from pre-authored content library
if (block.testimonials.length < MIN.testimonials) {
    block.testimonials.push(...fillFromCategoryContent(category, 'testimonials', diff))
}
```

### Phase 5 (B4): Few-shot examples in system prompt
Add 1 example JSON per category to system prompt:
```
CATEGORY EXAMPLE: beauty (Asian spa, District 1)
{
  "pages": [{
    "blocks": [
      {"blockType": "navigation", "variant": "pill", ...},
      {"blockType": "hero", "variant": "gradient", ...},
      {"blockType": "booking-widget", ...},
      {"blockType": "features", ...},
      // ... 10 total
    ]
  }]
}
```

## Estimated effort for Scope B
- B1 constant: 1h
- B2 gap-filler: 2-3h
- B3 content padder: 2h
- B4 few-shot (14 examples): 3-4h
- Tests: 2h
- **Total: ~10-12h (~1.5 days)**

## Unresolved Questions
1. **Token cost of few-shot** — adding 14 examples of 500 tokens each = 7000 extra input tokens per gen. Worth it? Maybe include only matched category's example.
2. **Inject-from-composer coupling** — gap-filler needs composer access. Does happy path already have composer imported? If not, adds cross-module coupling.
3. **PAD vs regenerate** — if AI gives 2 testimonials and min is 4, pad from curated content OR re-call AI? PAD cheaper, regenerate more brand-coherent.
4. **Priority ordering** — if many fixes, which phase first: A (media pipeline) or B (prompt rewrite)? Recommend A first (biggest visual impact).
