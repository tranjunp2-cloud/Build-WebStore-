# Phase 01 — Category theme picker helper

## Context
- Parent: [plan.md](./plan.md)
- Depends on: none (pure function, consumes existing `theme-presets.ts`)
- Blocks: phase-02 (happy path integration)

## Overview
- Date: 2026-04-14
- Description: Small helper function `pickCategoryTheme(category, seed)` that returns a deterministic preset from the 14×5 library at `src/lib/ai/theme-presets.ts`. Same `(category, seed)` → same preset. Used by both the openai happy path and system prompt builder.
- Priority: P0 — foundation for phase-02
- Implementation: pending

## Key insights
- `theme-presets.ts` already exports `RESTAURANT_PRESETS`, `BEAUTY_PRESETS`, `TECH_PRESETS`, ... 14 arrays of 5 `ThemePreset` objects each.
- Fallback path `fallback-adapter.ts:57-64` already has `pickPreset(category, seed)` but takes `TemplatePreset` (composition preset, different type). Don't reuse — create a new helper focused on theme colors only.
- Deterministic hashing via `Math.abs(seed) % array.length` — same seed → same preset.

## Requirements
- **Input:** `(category: string, seed: number)` — category is one of 14 known keys, seed is any number (typically `Date.now()` or business-derived).
- **Output:** `ThemePreset` object (existing type from theme-presets.ts).
- **Fallback:** if category unknown → return `BUSINESS_PRESETS[0]` (generic neutral default).

## Architecture

```
src/lib/ai/category-theme-picker.ts (NEW)
├── import all 14 *_PRESETS from './theme-presets'
├── CATEGORY_PRESET_MAP: Record<string, ThemePreset[]>
├── pickCategoryTheme(category, seed) → ThemePreset
└── getCategoryThemeOptions(category) → ThemePreset[] (for system prompt hint)
```

Pseudo-code:
```ts
import {
    RESTAURANT_PRESETS, ECOMMERCE_PRESETS, BEAUTY_PRESETS,
    TECH_PRESETS, HEALTH_PRESETS, EDUCATION_PRESETS,
    REALESTATE_PRESETS, FITNESS_PRESETS, CREATIVE_PRESETS,
    BUSINESS_PRESETS, FNB_PRESETS, EVENTS_PRESETS,
    BLOG_PRESETS, TRAVEL_PRESETS,
    type ThemePreset,
} from './theme-presets'

const CATEGORY_PRESET_MAP: Record<string, ThemePreset[]> = {
    restaurant: RESTAURANT_PRESETS,
    ecommerce: ECOMMERCE_PRESETS,
    beauty: BEAUTY_PRESETS,
    tech: TECH_PRESETS,
    health: HEALTH_PRESETS,
    education: EDUCATION_PRESETS,
    realestate: REALESTATE_PRESETS,
    fitness: FITNESS_PRESETS,
    creative: CREATIVE_PRESETS,
    business: BUSINESS_PRESETS,
    fnb: FNB_PRESETS,
    events: EVENTS_PRESETS,
    blog: BLOG_PRESETS,
    travel: TRAVEL_PRESETS,
}

export function pickCategoryTheme(category: string, seed: number): ThemePreset {
    const presets = CATEGORY_PRESET_MAP[category] ?? BUSINESS_PRESETS
    if (presets.length === 0) return BUSINESS_PRESETS[0]!
    const index = Math.abs(Math.floor(seed)) % presets.length
    return presets[index]!
}

export function getCategoryThemeOptions(category: string): ThemePreset[] {
    return CATEGORY_PRESET_MAP[category] ?? BUSINESS_PRESETS
}
```

## Related code files
- `src/lib/ai/theme-presets.ts` — consumed
- `src/lib/ai/category-theme-picker.ts` — NEW, this phase

## Implementation steps
1. Create `src/lib/ai/category-theme-picker.ts` with imports, `CATEGORY_PRESET_MAP`, `pickCategoryTheme`, `getCategoryThemeOptions`.
2. Export `ThemePreset` type re-export for downstream consumers.
3. Add JSDoc: "Deterministic theme picker — same (category, seed) always returns same preset. Used by AI happy path (openai-generator.ts) to ensure every gen has category-appropriate colors."
4. Unit test `src/__tests__/unit/lib/ai/category-theme-picker.test.ts`:
   - All 14 categories return non-empty preset
   - Same (category, seed) → same preset (determinism)
   - Different seeds produce variation across 5 preset options
   - Unknown category → BUSINESS_PRESETS[0] fallback
   - Restaurant primary hue check — should be in warm range (orange/red/amber)
   - Tech primary hue check — should be in cool range (blue/teal/green)

## Todo
- [ ] File created + compiles
- [ ] All 14 categories mapped
- [ ] Deterministic (stable index)
- [ ] Tests cover happy path + fallback
- [ ] JSDoc documents usage
- [ ] No side effects

## Success criteria
- [ ] `pnpm test category-theme-picker.test.ts` green
- [ ] TypeScript strict mode clean
- [ ] Module size <100 LOC

## Risk assessment
- R1: category naming drift (e.g. `real-estate` vs `realestate`). Mitigation: canonicalize via lowercase + strip-dashes before lookup.

## Security considerations
- Pure data function, no user input injection risks.

## Next steps
→ phase-02 wires `pickCategoryTheme` into `openai-generator.ts` post-AI theme override.
