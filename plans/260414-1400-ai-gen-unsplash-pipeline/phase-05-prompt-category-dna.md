# Phase 05 — Prompt Category DNA + gap-filler + content padder + few-shot (Scope B)

## Context
- Parent: [plan.md](./plan.md)
- Depends on: none (independent from Scope A media pipeline — can run in parallel branch)
- Related: plan-2156 phase-06 (composer unification — ships shared `fallback-adapter.ts`)
- Research: [researcher-03](./research/researcher-03-prompt-category-dna.md)

## Overview
- Date: 2026-04-14
- Description: Scope B — fix sparse-layout problem. Introduce `CATEGORY_REQUIREMENTS` constant (14 categories × minBlocks/mandatoryBlocks/minItems), add post-AI `enforceMinimumStructure` gap-filler that injects missing mandatory blocks from a shared content-injection helper, extend `enforceMinContent` to PAD items (not just swap variant) from `src/lib/ai/content/*.ts`, add per-category few-shot example in system prompt (only matched category, ~500 extra tokens), and surface content rules (blocked CTAs) in prompt text.
- Priority: P1 — independent from Scope A, biggest structural improvement
- Implementation: pending
- Review: pending

## Key insights
- **Current `CATEGORY_SIGNATURE_BLOCKS` picks 1–2 of 3** — AI can skip signature blocks entirely. Need HARD mandatory list enforced post-AI, not hint-level.
- **`enforceMinContent` currently only swaps variant** (e.g. `carousel` → `simple` when <3 testimonials) — doesn't add items. Need to PAD from pre-authored content library at `src/lib/ai/content/{category}.ts` (14 files already exist!).
- **Composer coupling risk:** gap-filler needs to inject real blocks. Current happy path in `openai-generator.ts` does NOT import `template-composer.ts`. Importing creates cross-module dep. **Decision: create new `src/lib/ai/content-injection.ts` shared helper** — takes blockType + category + content library → returns fully-formed block. Imported by both happy path and composer (future consolidation).
- **Few-shot cost:** 14 examples × 500 tokens = 7000 tokens/gen ($0.0014 at 4.1-mini rates). Too expensive. **Decision: inject ONLY the matched category's example into prompt (+500 tokens, ~$0.0001/gen). Acceptable.**
- **Content depth rules:** AI doesn't know "hero subheadline should be 15–25 words". Add to prompt as hard constraints + examples.
- **Content rules surfacing:** `src/lib/ai/content-rules.ts` has banned CTAs ("Learn More", "Click Here") but only post-hoc sanitizer. Add summary to prompt → AI avoids them in first place.

## Requirements
- **CATEGORY_REQUIREMENTS** covers all 14 categories
- **enforceMinimumStructure** is pure (takes blocks + category → blocks) — testable
- **enforceMinContent** extended to pad items
- **content-injection.ts** is the ONLY place that reads `src/lib/ai/content/*.ts` for gap-filling (single source of truth)
- **Few-shot** injection is per-category, not all-categories
- **Prompt content rules** added without blowing up token budget (<300 extra tokens)

## Architecture

```
src/lib/ai/system-prompt.ts (MODIFY)
├── add CATEGORY_REQUIREMENTS constant
├── add COPY_DEPTH_RULES constant (hero/about/feature length)
├── add buildFewShotExample(category) → string (reads from examples file)
├── buildSystemPrompt() extended:
│     - inject matched category's few-shot
│     - inject COPY_DEPTH_RULES bullet list
│     - inject content rules summary (banned CTAs)
└── export CATEGORY_REQUIREMENTS for consumers

src/lib/ai/content-injection.ts (NEW)
├── buildBlockFromLibrary(blockType, category, seed) → AIBlock
├── padItems(blockType, existingItems, minCount, category) → padded array
└── imports from ./content/index.ts (existing 14 files)

src/lib/ai/openai-generator.ts (MODIFY)
├── post-AI → call enforceMinimumStructure(blocks, category)
│    └── injects missing mandatoryBlocks via content-injection
├── post-AI → call enforceMinItems(blocks, category)
│    └── pads per-block items via content-injection
└── existing enforceMinContent still used for variant-swap fallback

src/lib/ai/few-shot-examples/ (NEW dir)
├── beauty.ts
├── restaurant.ts
├── ... 14 total (each ~500 tokens of minified JSON)
└── index.ts
```

### CATEGORY_REQUIREMENTS shape
```ts
interface CategoryRequirement {
  minBlocks: number
  mandatoryBlocks: string[]
  recommendedBlocks: string[]
  minItems: Partial<Record<string, number>>
}

export const CATEGORY_REQUIREMENTS: Record<string, CategoryRequirement> = {
  beauty: {
    minBlocks: 10,
    mandatoryBlocks: ['navigation', 'hero', 'services', 'team', 'testimonials', 'gallery', 'cta', 'footer'],
    recommendedBlocks: ['before-after', 'faq', 'stats', 'about'],
    minItems: { team: 3, testimonials: 4, services: 4, gallery: 6, features: 4 },
  },
  restaurant: {
    minBlocks: 11,
    mandatoryBlocks: ['navigation', 'hero', 'about', 'gallery', 'testimonials', 'contact', 'footer'],
    recommendedBlocks: ['stats', 'team', 'cta', 'faq'],
    minItems: { gallery: 8, testimonials: 4, features: 4 },
  },
  // ... 12 more (tech, health, education, realestate, fitness, creative, business, fnb, events, blog, travel, ecommerce)
}
```

### enforceMinimumStructure pseudo-code
```ts
export function enforceMinimumStructure(blocks: AIBlock[], category: string, ctx): AIBlock[] {
  const req = CATEGORY_REQUIREMENTS[category] ?? DEFAULT_REQUIREMENTS
  const present = new Set(blocks.map(b => b.blockType))
  const missing = req.mandatoryBlocks.filter(b => !present.has(b))
  const out = [...blocks]
  for (const blockType of missing) {
    const injected = buildBlockFromLibrary(blockType, category, ctx)
    if (injected) {
      const insertIdx = findInsertionIndex(out, blockType)  // before footer, after hero, etc.
      out.splice(insertIdx, 0, injected)
      console.info(`[AI Gap-filler] injected missing ${blockType} for ${category}`)
    }
  }
  // pad to minBlocks using recommended
  while (out.length < req.minBlocks) {
    const nextBlock = pickNextFromRecommended(req.recommendedBlocks, out)
    if (!nextBlock) break
    out.splice(out.length - 1, 0, buildBlockFromLibrary(nextBlock, category, ctx))
  }
  return out
}
```

### enforceMinItems pseudo-code
```ts
export function enforceMinItems(blocks, category) {
  const req = CATEGORY_REQUIREMENTS[category] ?? {}
  for (const block of blocks) {
    const mins = req.minItems ?? {}
    const itemField = ITEM_FIELD_BY_BLOCK[block.blockType]  // 'testimonials' | 'members' | 'features' | ...
    if (!itemField) continue
    const current = block[itemField] as unknown[]
    const min = mins[block.blockType] ?? 0
    if (Array.isArray(current) && current.length < min) {
      const pad = padItems(block.blockType, current, min, category)
      block[itemField] = pad
      console.info(`[AI Padder] padded ${block.blockType}: ${current.length} → ${pad.length}`)
    }
  }
  return blocks
}
```

## Related code files
- `src/lib/ai/system-prompt.ts` lines 88–250 (MODIFY — add constants + extend `buildSystemPrompt`)
- `src/lib/ai/openai-generator.ts` — add calls to `enforceMinimumStructure` + `enforceMinItems` after AI parse, before sanitizer
- `src/lib/ai/variant-validation.ts` — keep (variant swap is complementary, not replaced)
- `src/lib/ai/content/index.ts` + 14 category files (READ — consumed by content-injection)
- `src/lib/ai/content-injection.ts` (NEW)
- `src/lib/ai/few-shot-examples/*.ts` (NEW, 14 files)
- `src/lib/ai/content-rules.ts` (READ — surface banned CTAs list to prompt)
- `src/lib/ai/template-composer.ts` (REFERENCE — for block shape when building content-injection templates)

## Implementation steps

### 5.1 Define CATEGORY_REQUIREMENTS (1h)
1. Open `src/lib/ai/system-prompt.ts`.
2. Add interface + const for all 14 categories. Mirror keys from `CATEGORY_SIGNATURE_BLOCKS`.
3. For each: pick `minBlocks` 10–12, list `mandatoryBlocks` (must-haves), `recommendedBlocks` (fills-to-min), `minItems` (per-block).
4. Export for openai-generator.

### 5.2 Build content-injection helper (2h)
1. Create `src/lib/ai/content-injection.ts`; `import 'server-only'`.
2. Implement `buildBlockFromLibrary(blockType, category, ctx)`:
   - lookup `contentByCategory[category]` from `./content/index.ts`
   - find matching block sample (e.g. `testimonials` → `category.testimonials` array)
   - return a fully-formed block: `{ blockType, variant: defaultVariant, ...fields }`
   - return `null` if no sample found (caller logs warn)
3. Implement `padItems(blockType, existing, min, category)`:
   - get candidate items from category content
   - pick random non-duplicates until `length >= min`
   - modify text (append suffix `~ ${name}`) so items differ
4. Implement `ITEM_FIELD_BY_BLOCK` map for walking block arrays.
5. Unit tests: `src/__tests__/unit/lib/ai/content-injection.test.ts`.

### 5.3 Gap-filler + item padder in openai-generator (2h)
1. Open `src/lib/ai/openai-generator.ts`.
2. After AI response parsed and validated, BEFORE sanitizer:
```ts
let blocks = parsed.blocks
blocks = enforceMinimumStructure(blocks, category, { businessName, industry })
blocks = enforceMinItems(blocks, category)
```
3. Implement `enforceMinimumStructure` + `enforceMinItems` as private funcs in same file OR extract to `src/lib/ai/structure-enforcer.ts` (preferred — testable).
4. `findInsertionIndex` — smart placement: `hero` after nav, `footer` last, `cta` before footer, etc.
5. Update `openai-generator.test.ts` with cases: AI returns 5 blocks → enforcer brings to 10; missing testimonials → injected; 2 team members → padded to 3.

### 5.4 Few-shot examples per category (2h)
1. Create `src/lib/ai/few-shot-examples/` dir.
2. For each of 14 categories, write `{category}.ts` exporting `export const {category}Example = ...` — minified JSON string of a 10–12 block layout with realistic Vietnamese copy (bilingual-friendly).
3. Create `index.ts` with `getFewShotExample(category)` lookup.
4. In `system-prompt.ts` `buildSystemPrompt()`: append matched category's example. NOT all 14.
5. Test: token count delta <600 per gen.

### 5.5 Content depth + content rules in prompt (1h)
1. Add to system prompt text (in `buildSystemPrompt`):
```
## CONTENT DEPTH RULES
- Hero headline: 4–10 words, benefit-driven (NOT "Welcome to X")
- Hero subheadline: 15–25 words, specific value proposition
- Section headings: 3–7 words, action-oriented
- Feature descriptions: 50–150 chars, concrete
- About paragraphs: 60–120 words, story-driven
- Team bios: 20–40 words per person
- Testimonial quotes: 25–60 words, specific benefit

## FORBIDDEN CTAs (never use)
- "Learn More", "Click Here", "Submit", "Read More", "Find Out More"
- Use specific verbs: "Book a Free Consult", "See Menu", "Get Your Quote"
```
2. Source the banned list from `src/lib/ai/content-rules.ts` (DRY — import constant, format as bullets).
3. Assert token budget: `buildSystemPrompt` output ≤ 4500 tokens (currently ~3500, +500 few-shot, +200 rules = ~4200).

### 5.6 Tests
1. `src/__tests__/unit/lib/ai/structure-enforcer.test.ts`:
   - beauty gen with 5 blocks → enforcer adds services, team, testimonials, cta, gallery → 10
   - restaurant gen missing `gallery` → injected
   - unknown category → default requirements applied
2. `src/__tests__/unit/lib/ai/content-injection.test.ts`:
   - `buildBlockFromLibrary('testimonials', 'beauty')` → returns valid AIBlock with ≥4 items
   - `padItems('team', [m1, m2], 3, 'beauty')` → returns 3 unique members
3. `system-prompt.test.ts` — few-shot injected only for matched category, token count <4500.

## Todo
- [ ] `CATEGORY_REQUIREMENTS` for 14 categories
- [ ] `content-injection.ts` implements `buildBlockFromLibrary` + `padItems`
- [ ] `structure-enforcer.ts` implements `enforceMinimumStructure` + `enforceMinItems`
- [ ] `few-shot-examples/` dir with 14 files + index
- [ ] `buildSystemPrompt` injects matched category few-shot only
- [ ] Content depth rules + banned CTAs in prompt text
- [ ] Unit tests for all new modules
- [ ] Token budget assertion (≤4500 input tokens)
- [ ] 367 existing tests green

## Success criteria
- [ ] On 5 canonical inputs (beauty, restaurant, tech, fnb, fitness) × 3 runs: every run has ≥10 blocks post-enforcement
- [ ] Mandatory blocks always present (no run skips booking/menu/gallery for their industry)
- [ ] Items meet minimums (testimonials ≥4, team ≥3, features ≥4) in every run
- [ ] Zero "Learn More" / "Click Here" in AI output
- [ ] Hero subheadline word count distribution 15–25 in ≥90% of gens
- [ ] Token cost <$0.01/gen at 4.1-mini rates

## Risk assessment
- **R1 — Injected blocks feel generic (not brand-coherent):** mitigation = `content-injection` uses `businessName` substitution tokens in samples.
- **R2 — Gap-filler inserts at wrong position:** mitigation = `findInsertionIndex` unit-tested per block type.
- **R3 — Few-shot example biases AI to copy structure verbatim:** mitigation = example prefix "the following is ONE valid shape — use as structural reference, content must be unique". Temperature ≥0.7.
- **R4 — `content-injection` coupling to composer becomes duplicated logic:** mitigation = `content-injection` is the shared helper; `template-composer.ts` refactors to use it (followup, not this phase).
- **R5 — 14 few-shot example files balloon PR size:** acceptable — data files, not logic. Review via sampling 3 random examples.
- **R6 — Happy path vs fallback path divergence:** fallback (`fallback-adapter.ts`) already uses composer output which tends to be structurally complete. Apply `enforceMinItems` also to fallback path for parity (add 1 line in fallback-adapter).

## Security considerations
- `buildBlockFromLibrary` outputs strings from static content files — no user input injection.
- `businessName` substitution is literal `.replace('${businessName}', name)` — NO `eval`, NO template engine. Name is plain text, not HTML/rich text.
- Few-shot examples are static JSON strings, bundled at build time — can't be tampered via env.
- Token budget is a cost guard + DoS guard — log gen cost per request.

## Next steps
→ phase-06 (e2e tests — verify prompt changes + media pipeline together across 5 categories)
