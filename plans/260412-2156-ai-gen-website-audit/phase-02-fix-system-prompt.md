# Phase 02: Fix System Prompt for Variety

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (audit data)
- File: `src/lib/ai/system-prompt.ts`
- Priority: P1 — highest-impact single change
- Status: pending

## Overview
System prompt lists all 47 blocks + variants but NEVER instructs GPT-4o to vary them. User prompt is flat 4-line format with no style/mood signal.

## Key Insights
- Rule #1 only says "Generate 4 pages: Homepage (8-14 blocks)" — no block TYPE diversity
- No instruction like "use different variants" or "vary block ordering"
- Category palettes are suggestions only, same format every time
- No randomization seed or style personality concept

## Implementation Steps

### 2.1 Add Variety Rules Section (after line 100)

```
## VARIETY RULES
1. NEVER default to the first variant listed. Choose from the FULL list.
2. For blocks with 3+ variants, rotate — do NOT always pick the same one.
3. Homepage MUST include at least 2 blocks from different categories.
4. Each generation should feel visually unique. Vary:
   - Hero variant (12 options — use them ALL)
   - Features layout (grid-2, grid-3, grid-4, list, icon-top, zigzag, carousel)
   - Testimonials style (cards, carousel, masonry, spotlight, minimal-quote)
   - Footer style (simple, expanded, minimal, centered-stack, mega-footer)
5. Include at least ONE less-common block: step-process, accordion, before-after, countdown-timer, or download-cta.
6. Block ORDER should vary — do not always put features right after hero.
```

### 2.2 Add Style Personality to User Prompt

Add `STYLE_PERSONALITIES` array (8 options):
- Bold and energetic
- Minimal and sophisticated
- Warm and inviting
- Professional and authoritative
- Creative and playful
- Luxurious and premium
- Modern tech
- Editorial and storytelling

In `buildUserPrompt()`, pick one at random:
```typescript
const personality = STYLE_PERSONALITIES[Math.floor(Math.random() * STYLE_PERSONALITIES.length)]
parts.push(`\nDesign personality: ${personality}`)
```

### 2.3 Add Category Block Composition Hints

New `CATEGORY_BLOCK_HINTS` with 3 different block sequences per category. Include a random hint in user prompt: "Consider this composition (feel free to modify): [hint]"

### 2.4 Add Variant Preference by Mood

```
For hero blocks:
- Dramatic: fullscreen, parallax, split-video
- Professional: centered, gradient, minimal
- Creative: magazine, cards-overlay, slideshow
- Personal: split-left, split-right
```

## Related Files
- `src/lib/ai/system-prompt.ts` (main target)
- `src/lib/ai/openai-generator.ts` (calls buildSystemPrompt/buildUserPrompt)

## Todo
- [ ] Add VARIETY RULES section to system prompt
- [ ] Add STYLE_PERSONALITIES array
- [ ] Add random personality selection in buildUserPrompt()
- [ ] Add CATEGORY_BLOCK_HINTS constant
- [ ] Add variant-by-mood hints in system prompt
- [ ] Test: 10 identical inputs should yield 5+ distinct hero variants

## Success Criteria
- [ ] Hero variant diversity: 2 -> 5+ across 10 runs
- [ ] Features variant no longer exclusively grid-3
- [ ] At least 3 different footer variants appear
- [ ] Block ordering varies across runs

## Risk Assessment
- GPT-4o may still gravitate toward "safe" choices despite instructions — mitigated by explicit "NEVER default to first" rule
- Longer prompt = more tokens = higher cost — acceptable tradeoff for variety
- Random personality selection means non-reproducible results — acceptable for AI path (template path uses seeds)
