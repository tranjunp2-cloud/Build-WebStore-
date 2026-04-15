# Research: Block / Layout / Variant Similarity Root Causes

**Scope**: Why AI-generated sites still share identical block skeletons, variant picks, and padded content after theme-presets wiring (commit `4659837d`).

---

## HIGH IMPACT

### 1. Mandatory block list per category = fixed skeleton
**File**: `src/lib/ai/category-requirements.ts:32-117`

Every category defines `mandatoryBlocks` array. Restaurant example (line 41):
```ts
mandatoryBlocks: ['navigation', 'hero', 'about', 'gallery', 'testimonials', 'contact', 'footer']
```
`structure-enforcer.ts:findInsertionIndex()` places them in deterministic positions (hero after nav, testimonials after features, contact before footer). All restaurants → identical block order: `nav → hero → about → gallery → testimonials → contact → footer`.

### 2. `CATEGORY_VARIANT_WEIGHTS` pool collapses to 2-3 dominant variants
**File**: `src/lib/ai/openai-generator.ts:452-650` (weights), `707` (picker)

When AI variant is invalid, `pickWeightedVariant()` selects from a **fixed ordered list** per `category × blockType`. Restaurant/hero pool = `['split-left', 'magazine', 'gradient', 'parallax', 'fullscreen']`. Random within pool, but pool is shared across all restaurants → statistical convergence on modal variant (1-2 dominate production output).

```ts
const preferred = catWeights.filter(v => pool.includes(v))
return preferred[Math.floor(Math.random() * preferred.length)]!
```

### 3. Deterministic `simpleHash()` locks same-named businesses to same variant
**File**: `src/lib/ai/template-composer.ts:43-65`

`selectVariant(blockType, seed, category)` = `simpleHash(blockType + category + seed) % safe.length`. Seed = `hashBusinessName()`. Two cafés with similar names → same hash → identical variant picks across ALL block types.

```ts
const hash = simpleHash(blockType + category + seed)
return safe[hash % safe.length]!
```

---

## MEDIUM IMPACT

### 4. `padItems()` reuses same library pool → identical testimonials/FAQs
**File**: `src/lib/ai/content-injection.ts:294-358`

When AI under-fills (e.g. 2 testimonials but `minItems=4`), padder pulls from `getCategoryContent(category).testimonials` (4-item pool). Two restaurants padding to 4 → both get same "John Smith: Great service!" quote. Same for team members, FAQs.

### 5. `buildBlockFromLibrary()` injects hardcoded stubs for missing mandatory blocks
**File**: `src/lib/ai/content-injection.ts:56-288`

When structure-enforcer injects missing block (e.g. `service-cards` not in AI output), library returns **hardcoded content every time**:
```ts
case 'service-cards':
  return { services: [
    { icon: '⭐', title: 'Premium Service', description: 'Our flagship offering.' },
    { icon: '🚀', title: 'Fast Delivery', ... }, // HARDCODED
  ]}
```
All beauty salons missing AI-generated service-cards → identical "Premium Service / Fast Delivery / Custom Solutions".

### 6. `NAV_VARIANT_BY_CATEGORY` forces single nav variant per category
**File**: `src/lib/ai/category-requirements.ts:129-144`, `structure-enforcer.ts:86`

`NAV_VARIANT_BY_CATEGORY['beauty'] = 'pill'`. Every beauty nav overridden to pill regardless of AI choice. Top-of-fold UX feels identical across category.

---

## LOW IMPACT

### 7. Composition hint is soft-guidance only
**File**: `src/lib/ai/system-prompt.ts:191-214`

`generateCompositionHint()` produces unique sequence per gen but AI often ignores → default training-data order dominates.

---

## Impact Ranking

| Root Cause | Impact | Scope |
|---|---|---|
| Mandatory blocks fixed per category | **HIGH** | Skeleton identical |
| `CATEGORY_VARIANT_WEIGHTS` pool static | **HIGH** | Dominant variant per block type |
| `simpleHash()` determinism | **MEDIUM** | Same-name businesses collapse |
| `padItems` library reuse | **MEDIUM** | Testimonials/FAQs/team identical |
| `buildBlockFromLibrary` hardcoded stubs | **MEDIUM** | Injected blocks all same |
| `NAV_VARIANT_BY_CATEGORY` override | **LOW** | Nav visual only |
| Soft composition hint | **LOW** | AI ignores |

---

## Git Log Confirmation
- `4659837d` wires theme-presets (color/font) — does NOT touch variant/block selection
- `0e62c423` Unsplash + category DNA — solves image variety, not layout
- `5b7594ac` content validation — enforces copy quality, not diversity

**Conclusion**: Theme-preset wiring fixes color/font. Block layout + variant + padding content still collapses to category templates.

---

## Unresolved Questions
1. What % of production variation comes from AI hallucination vs forced structure? Need gen-stats telemetry.
2. `CATEGORY_VARIANT_WEIGHTS` distribution: do any pools have <3 entries (hard-lock)?
3. Is `simpleHash()` deterministic seed **intentional** (reproducibility) or accidental?
4. Observed variant frequency across last 100 gens — is any variant >50% share?
5. Do users perceive identical skeletons as "templates" even with different colors?
