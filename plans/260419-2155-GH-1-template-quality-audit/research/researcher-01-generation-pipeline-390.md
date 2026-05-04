# Template Generation Pipeline: 390 Fixtures End-to-End

**Date:** 2026-04-19 | **Status:** Research Complete

## Summary

The 390 template fixtures are generated via a two-path system:
- **Blueprint path (280 fixtures):** 56 hardcoded `TemplatePreset` objects × 5 composition seeds per preset
- **Legacy path (110 fixtures):** 48 `ComposerInputLegacy` definitions × 5 seeds (selective categories only)

Total: (56 + 48) × 5 seeds = 520 potential, but matrix builder skips legacy premium (overlaps blueprint), yielding 280 + 110 = **390 fixtures**.

---

## 1. TEMPLATE_PRESETS Source (56 Blueprints)

**Files:** Three batch imports in `src/lib/ai/template-definitions.ts:231`

| File | Lines | Presets | Categories |
|------|-------|---------|------------|
| `template-presets-batch1.ts` | 1,416 | 20 | restaurant(4), ecommerce(4), beauty(4), fnb(4), tech(4) |
| `template-presets-batch2.ts` | 1,479 | 20 | health(4), education(4), fitness(4), realestate(4), creative(4) |
| `template-presets-batch3.ts` | 1,181 | 16 | business(4), events(4), blog(4), travel(4) |
| **Total** | **4,076** | **56** | **14 categories, 4/5 presets each** |

**Example structure (batch1.ts:10-50):**
```typescript
export const BATCH1_PRESETS: TemplatePreset[] = [
  {
    id: 'restaurant-warung-kampung',
    name: 'Warung Kampung',
    category: 'restaurant',
    businessIndex: 0,        // index into getCategoryContent(category).businesses[]
    personality: 'warm',
    themePreset: RESTAURANT_PRESETS[0]!,
    pages: [
      { name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-image' },
          { blockType: 'menu-display', variant: 'grid' },
          // ... 10–15 total blocks per preset
        ]
      },
      // Sub-pages: /menu, /gallery, /about, /contact (5 pages typical)
    ]
  },
  // ... 3–5 more presets per batch
]
```

---

## 2. TemplatePreset Blueprint Shape

**Type:** `src/lib/ai/template-definitions.ts:36–46`

```typescript
interface TemplatePreset {
  id: string;                           // e.g. 'restaurant-warung-kampung'
  name: string;                         // display name
  category: string;                     // one of 14 business categories
  businessIndex: number;                // indexes into getCategoryContent(cat).businesses
  personality: string;                  // e.g. 'warm', 'dark', 'minimal'
  themePreset: ThemePreset;            // color, typography, mood preset
  pages: PageBlueprint[];               // 5 pages typical (Home, Menu, About, Contact, Blog)
  tags: string[];                       // semantic tags for search
  description: string;                  // for UI preview
}

interface PageBlueprint {
  name: string;
  slug: string;
  isHomepage?: boolean;
  blocks: BlockSpec[];                  // 10–15 blocks per page
}

interface BlockSpec {
  blockType: string;                    // e.g. 'hero', 'features', 'testimonials'
  variant?: string;                     // e.g. 'split-image', 'grid', 'carousel'
  count?: number;                       // for carousels/grids
  overrides?: Record<string, unknown>;  // block-specific tweaks
}
```

**Rendering pipeline:** Each preset is rendered via `composeFromBlueprint(preset, compositionSeed)` → `buildBlockFromSpec()` → content injection + variant selection → `applyContentValidation()`.

---

## 3. Legacy Path (48 Entries, Selective Coverage)

**Location:** `src/lib/ai/template-definitions.ts:66–130`

Type: `ComposerInputLegacy` (deprecated, backward-compat only)

**Coverage by variant (per-category totals):**
- **Starter:** 11 entries (restaurant, ecommerce, beauty, tech, etc.)
- **Professional:** 22 entries (wider spread; some cats get 2–3 professional variants)
- **Premium:** 15 entries (overlaps with blueprint premium; skipped by matrix builder)

**Example:**
```typescript
{ category: 'restaurant', businessIndex: 0, variant: 'starter', themePreset: RESTAURANT_PRESETS[0]! },
{ category: 'restaurant', businessIndex: 1, variant: 'professional', themePreset: RESTAURANT_PRESETS[1]! },
```

**Why thin coverage?** Plan 2253 deprecated legacy path; premium fixtures route exclusively through blueprints. Legacy fixtures only generated for categories lacking blueprint premium coverage (e.g., blog/events at starter/professional tiers).

**Matrix builder filter (matrix.ts:101–122):**
```typescript
// Skip if (1) premium + presets exist for category, OR (2) no legacy def for this variant
if (variant === 'premium' && presetsInCat.length > 0) continue;
const legacyDef = TEMPLATE_DEFINITIONS.find(d => d.category === category && d.variant === variant);
if (!legacyDef) continue;  // Skip cleanly, no false-positive failures
```

---

## 4. Composition Seed Effect

**Type:** `template-composer.ts:18, 2018, 2104`

```typescript
export type ComposerInput = {
  compositionSeed?: number;  // Seed for variety — undefined = backward-compatible (no shuffle)
}
```

**What seed controls:**
1. **Variant selection** (line 58–68): `selectVariant(blockType, seed, category)` → deterministic hash → picks from `blockRegistry.getBlockMeta(blockType).variants`
2. **Recipe reordering** (line 2033): `pickRecipe(category, seed, { name: biz.name })` → shuffles block sequence on homepage only
3. **Structural rotation** (line 2069): `rotateStructuralVariants(pages, category, seed)` → rotates nav/footer/contact variants

**Determinism:** Same (category, businessIndex, seed) always produces identical rendered output. Seeds are deterministic from fixture ID via `seedFromString()` (matrix.ts:29–36).

---

## 5. Composition Pipeline

**Blueprint path flowchart:**
```
composeFromBlueprint(preset, seed) @ template-composer.ts:1992
  ├─ getCategoryContent(category) → BusinessSample[] + products
  ├─ pickRecipe(category, seed, biz) → block reordering instructions
  ├─ For each page in preset.pages:
  │  └─ For each BlockSpec:
  │     └─ buildBlockFromSpec() @ line:1679
  │        ├─ selectVariant(blockType, seed, category)
  │        ├─ Build block-type-specific content:
  │        │  ├─ hero → buildHero(biz) + variant
  │        │  ├─ features → featuresFromProducts(biz.products)
  │        │  ├─ testimonials → buildTestimonials(content, biz)
  │        │  ├─ menu-display → buildMenuDisplay(category, biz, content)
  │        │  └─ [12+ other block builders]
  │        └─ return { blockType, variant, ...blockData }
  ├─ enrichSubPages() → Add missing About/Blog/Contact pages
  ├─ rotateStructuralVariants() → Vary nav/footer across same-category seeds
  └─ applyContentValidation() on each block
     └─ enforce min/max lengths, block CTA rules, content array minimums
     └─ log [design-quality] warnings (src/lib/theme/color-utils.ts:line varies)

Legacy path (deprecated): composeTemplate() → buildHomePage/buildAboutPage/etc.
```

**Key function locations:**
- `buildBlockFromSpec()` (1679): Routes blockType to specialized builders
- `featuresFromProducts()` (1322): Generates feature cards from `content.businesses[idx].products`
- `enrichSubPages()` (1884): Ensures 5-page completeness (Home/About/Contact/Blog/Services)
- `applyContentValidation()` (imported from content-rules.ts): Enforces PRD rules

---

## 6. Quality Signals (Harness Guards)

**Location:** `scripts/test-harness/assertions/`

| Guard | Purpose | Severity | Source |
|-------|---------|----------|--------|
| `signature-blocks.ts:11` | Every category must have mandatory blocks (e.g., restaurant = menu-display, booking-widget) | FAIL if all missing; WARN if partial | `CATEGORY_REQUIREMENTS.mandatoryBlocks` |
| `block-count.ts` | Block count within [minBlocks, maxBlocks] range per category | FAIL | Derived from `CATEGORY_REQUIREMENTS.minBlocks ± 3/4` |
| `no-empty-data.ts:83` | Carousels/grids/testimonials have ≥3 items; grid-4 ≥4 items | FAIL | Variant regex + content array length check |
| `ordering.ts` | Sub-pages follow preset sequence; no orphaned blocks | FAIL | Block sequence validation |
| `variant-whitelist.ts` | Block variants must be registered in blockRegistry | FAIL | Cross-check against block registry |

**Design-quality warnings** (not guards — log to console):
- `src/lib/theme/color-utils.ts`: Pure black text (use `brandTintedDark()`), white-on-white contrast, WCAG AA fail
- `src/__tests__/unit/lib/ai/content-rules.test.ts`: Hero CTA text blocked (e.g., "Submit" not allowed; use verbs like "Book Now")
- No line-length guard yet (per PM note: "quote 223 chars > 200 max" — not enforced in code)

**Variety metrics aggregated per category (variety-metrics.ts:16–63):**
- Hero variants per category (min 3 across 5 seeds)
- Feature variants per category (min 2)
- Footer variants per category (min 2)
- Unique block orderings per category

---

## 7. Variety Capture: Diversity vs Repetition

**Metrics dimensions (check.ts:94, variety-metrics.ts:44–49):**
```typescript
byCategory[cat] = {
  heroVariants: Set<string>,           // E.g., ['gradient', 'split-left', 'parallax']
  featureVariants: Set<string>,        // E.g., ['grid-3', 'cards']
  footerVariants: Set<string>,         // E.g., ['mega', 'minimal']
  uniqueOrderings: number,             // Count of distinct block sequences
}
```

**Thresholds (WARN, not FAIL):**
- Hero: ≥3 variants per category (across 5 seeds) when ≥3 results exist
- Features: ≥2 variants
- Footer: ≥2 variants

**Interpretation:**
- **Low diversity** = same hero variant across all 5 seeds of a category → stale designs
- **High ordering variation** = unique block sequences → more interesting template variety
- **Thin coverage** = only 2–3 categories exercise full preset set; others fall back to minimal legacy fixtures

**Current state assessment:** 56 blueprints × 5 seeds + 48 legacy × 5 seeds should produce moderate variety per category. Variety warnings in report would surface if a category's hero/feature blocks are repetitive.

---

## Unresolved Questions (Product Decision Required)

1. **Blog/Events tier strategy?** Blog + Events have only 4 presets each vs. 5 in other categories. Do blog/events intentionally limit to starter/professional legacy tiers, or should they ship premium blueprints?

2. **Content pool size?** Each category's `BusinessSample[]` pool drives feature card + testimonial variety. What's the target pool size per category? (E.g., 20 businesses, 10 businesses?) Affects diversity across seeds.

3. **Seed multiplier ROI?** 5 seeds per fixture is hardcoded in matrix builder. How many unique designs do we actually see? Could 3 seeds be sufficient? (Saves 40% harness compute.)

4. **Quality rule enforcement gap?** Design-quality warnings (color contrast, CTA text) are logged but not enforced in guards. Should we FAIL on these, or keep them as CI warnings?

5. **Legacy deprecation timeline?** When can we delete `ComposerInputLegacy` + the deprecated `composeTemplate()` function entirely? (Blocks cleanup of content builders + theme-preset backwards-compat.)

---

**Files cited:**
- `scripts/test-harness/matrix.ts` (fixture enumeration)
- `src/lib/ai/template-definitions.ts` (presets + legacy defs)
- `src/lib/ai/template-composer.ts` (composition pipeline)
- `scripts/test-harness/assertions/*.ts` (quality guards)
- `src/lib/ai/content-rules.ts` (validation rules)

