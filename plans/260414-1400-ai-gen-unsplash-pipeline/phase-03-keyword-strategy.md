# Phase 03 — Keyword strategy (category × block × VN fallback)

## Context
- Parent: [plan.md](./plan.md)
- Depends on: none (pure data module)
- Blocks: phase-04
- Research: [researcher-01 §5](./research/researcher-01-unsplash-api.md), [researcher-03](./research/researcher-03-prompt-category-dna.md)

## Overview
- Date: 2026-04-14
- Description: Pure data+functions module that turns `(category, blockType, businessName, industry)` → `string[]` of Unsplash search keywords. Handles VN→EN fallback table (no LLM translate). Handles generic→specific drill-down on empty results.
- Priority: P1 — quality of imagery depends 100% on keyword quality
- Implementation: pending
- Review: pending

## Key insights
- **Unsplash search is fuzzy AND** — `vietnamese pho noodles` returns better than just `food`. Be specific.
- **Non-English queries fail silently** — Unsplash returns almost-empty. Must detect VN input and map to EN.
- **Generic category keywords produce cliché results** — don't pass `business`. Drill into subcategory (`consulting office modern`).
- **Block type matters more than category for some blocks:** `team` block = `professional team portrait diverse`, regardless of whether it's a spa or tech startup.
- **Randomize within top-N** — if we always pick `results[0]`, every "coffee shop" site uses the same hero. Pick randomly from top 10.

## Requirements
- **Input:** `(category: string, blockType: string, ctx: { businessName, industry, language?: 'en'|'vi' })`
- **Output:** `string[]` — 2–5 keywords to `.join(' ')` into Unsplash query
- **Constraints:** pure function, no I/O, no async, no imports except types. Unit-testable in isolation.

## Architecture

```
src/lib/ai/image-keywords.ts
├── CATEGORY_BASE_KEYWORDS    [14 categories → 3–5 English base terms]
├── BLOCK_MODIFIER_KEYWORDS   [blockType → modifier bag]
├── VN_TO_EN_FALLBACKS        [common VN industry terms → EN]
├── deriveKeywords(category, blockType, ctx)   [public]
└── fallbackBroaden(keywords)                  [returns broader set on empty]
```

Data shape:
```ts
const CATEGORY_BASE_KEYWORDS: Record<string, string[]> = {
  restaurant: ['restaurant interior', 'food plating', 'dining'],
  beauty:     ['spa treatment', 'wellness', 'skincare'],
  tech:       ['modern office', 'software team', 'laptop workspace'],
  health:     ['medical clinic', 'doctor', 'hospital modern'],
  education:  ['classroom modern', 'students learning', 'library'],
  fitness:    ['gym workout', 'yoga studio', 'fitness class'],
  creative:   ['design studio', 'creative workspace', 'art'],
  business:   ['corporate meeting', 'modern office', 'handshake'],
  fnb:        ['coffee shop', 'cafe interior', 'barista'],
  realestate: ['luxury home interior', 'modern architecture', 'real estate'],
  events:     ['event venue', 'wedding ceremony', 'conference stage'],
  blog:       ['writing desk', 'magazine layout', 'journalism'],
  travel:     ['travel destination', 'landscape', 'tourist'],
  ecommerce:  ['product photography', 'retail', 'shopping'],
}

const BLOCK_MODIFIER_KEYWORDS: Record<string, string[]> = {
  hero:          [],                          // use base as-is, landscape
  gallery:       ['detail', 'closeup'],
  'portfolio-grid': ['portfolio work sample'],
  about:         ['team at work', 'founder'],
  team:          ['professional portrait headshot'],
  testimonials:  ['happy customer smiling portrait'],
  'service-cards': ['service detail'],
  'product-card': ['product flatlay'],
  'before-after': ['transformation result'],
}

const VN_TO_EN_FALLBACKS: Record<string, string> = {
  'nhà hàng': 'restaurant vietnamese',
  'cà phê': 'cafe coffee',
  'spa': 'spa wellness',
  'phòng khám': 'medical clinic',
  'thẩm mỹ viện': 'beauty clinic',
  'khóa học': 'online course',
  'thiết kế': 'design studio',
  'du lịch': 'travel destination',
  'bánh': 'pastry bakery',
  'trà sữa': 'bubble tea',
  // ... 30 total
}

export function deriveKeywords(category, blockType, ctx) {
  const base = CATEGORY_BASE_KEYWORDS[category] ?? ['modern business']
  const modifiers = BLOCK_MODIFIER_KEYWORDS[blockType] ?? []
  const industryBoost = translateVnIfNeeded(ctx.industry)
  // pick 1 random base + 1 random modifier + industryBoost = stable variety
  return [pickRandom(base), ...(modifiers.length ? [pickRandom(modifiers)] : []), industryBoost].filter(Boolean)
}

function translateVnIfNeeded(str) {
  const lower = str?.toLowerCase() ?? ''
  for (const [vn, en] of Object.entries(VN_TO_EN_FALLBACKS)) {
    if (lower.includes(vn)) return en
  }
  // No VN match → strip to ASCII, return or empty
  return /^[a-zA-Z0-9\s]+$/.test(str ?? '') ? str : ''
}

export function fallbackBroaden(keywords: string[]): string[] {
  // drop last (most specific) term, keep first
  return keywords.slice(0, Math.max(1, keywords.length - 1))
}
```

## Related code files
- `src/lib/ai/image-keywords.ts` (NEW, this phase)
- `src/lib/ai/system-prompt.ts` (read-only reference — existing `CATEGORY_SIGNATURE_BLOCKS` keys list)
- `src/lib/ai/media-pipeline.ts` (phase-02 consumer)

## Implementation steps
1. Create `src/lib/ai/image-keywords.ts`.
2. Populate `CATEGORY_BASE_KEYWORDS` for all 14 categories from `CATEGORY_SIGNATURE_BLOCKS` keys. 3–5 terms each; prefer specific over generic.
3. Populate `BLOCK_MODIFIER_KEYWORDS` for the 10 most-used block types (hero, gallery, portfolio-grid, about, team, testimonials, service-cards, product-card, before-after, stats).
4. Populate `VN_TO_EN_FALLBACKS` with ~30 common Vietnamese business terms.
5. Implement `deriveKeywords(category, blockType, ctx)` — returns 2–3 keyword strings ready for `.join(' ')`.
6. Implement `translateVnIfNeeded` — substring match, fallback to ASCII strip.
7. Implement `fallbackBroaden` for empty-result retry (pops most-specific term).
8. Unit tests `src/__tests__/unit/lib/ai/image-keywords.test.ts`:
   - Each of 14 categories returns non-empty array
   - `vi` input `nhà hàng phở` maps to `restaurant vietnamese`-family
   - Unknown category → generic fallback
   - `fallbackBroaden(['spa', 'wellness', 'detail'])` → `['spa', 'wellness']`
   - Variety assertion: 100 calls for `(beauty, hero)` produce ≥3 distinct keyword sets

## Todo
- [ ] 14 categories covered in `CATEGORY_BASE_KEYWORDS`
- [ ] 10 block types in `BLOCK_MODIFIER_KEYWORDS`
- [ ] 30 VN→EN entries
- [ ] `deriveKeywords` randomization produces variety
- [ ] Pure function — no `fetch`, no `Math.random` at module top (inject/stable-seed for tests)
- [ ] Tests cover category×block matrix via `it.each`
- [ ] Export sorted for tree-shake friendliness

## Success criteria
- [ ] 14×10 = 140 (category, blockType) combos all return ≥1 keyword
- [ ] VN test input produces EN output
- [ ] Variety metric: 10 calls per (category, blockType) produce ≥3 unique results
- [ ] Unit tests green

## Risk assessment
- **R1 — keyword quality is subjective:** mitigation = iterate based on phase-06 e2e test visual audit (anh/PM eyeballs 5 gens).
- **R2 — new category added later without keywords:** mitigation = fallback `modern business` + warn log.
- **R3 — VN substring matching over-eager (e.g. `spa` inside `space`):** mitigation = word-boundary regex, not `.includes`.

## Security considerations
- Pure data module; no user input reaches unsanitized output. `ctx.businessName` NOT embedded in keywords (privacy — we don't leak "Tuấn's Spa" as search term).
- `ctx.industry` is used but ASCII-stripped if contains suspicious chars.

## Next steps
→ phase-04 wires `deriveKeywords → getMediaForBlock` inside generate-site route.
