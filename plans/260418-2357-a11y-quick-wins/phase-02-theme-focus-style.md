# Phase 02 — Theme focusStyle Token

## Context links
- Parent: [plan.md](plan.md)
- Depends on: none (parallel with Phase 01)

## Overview
Date: 2026-04-18
Description: Add `focusStyle` field vào ThemePreset type + update all 112 presets với default. Rubric evaluator `focusIndicatorDefined` looks for keys: `focusStyle`, `focusRing`, `focusOutlineColor`, `focusIndicator`.
Priority: P1
Status: pending

## Key Insights
- 112 theme presets (14 cat × 8 presets) trong `theme-presets.ts`
- Simplest: add single `focusStyle: string` field, default `'ring-2 ring-offset-2'` (Tailwind class)
- Alternative: category-specific focus colors — skip for v1, use consistent brand ring

## Requirements
- `ThemePreset.focusStyle: string` (required field)
- All 112 presets updated với value (default template)
- Composer `composeFromBlueprint` passes `focusStyle` through theme output
- Real CSS application (later, not this phase): `:focus-visible { outline: var(--focus-style) }`

## Architecture
```ts
// theme-presets.ts
export type ThemePreset = {
  ...existing...
  focusStyle: string   // NEW e.g. 'ring-2 ring-offset-2 ring-primary'
}

// Bulk add to 112 presets via script OR sed replacement:
// Pattern: add `, focusStyle: 'ring-2 ring-offset-2'` before `}` of each preset
```

## Related code files
- `src/lib/ai/theme-presets.ts` (112 entries, ~600 lines)
- `src/lib/ai/template-composer.ts` composeFromBlueprint() — return theme object includes new field
- `scripts/test-harness/rubric/evaluators.ts` focusIndicatorDefined (already checks these keys)

## Implementation Steps
1. Add `focusStyle: string` to ThemePreset type
2. Bulk-edit 112 presets — append `, focusStyle: 'ring-2 ring-offset-2 ring-primary'` into each literal
   - Use sed or tsx script with AST transform
3. Update composeFromBlueprint output: `theme: { ...preset, focusStyle: preset.focusStyle }`
4. Typecheck (force all 112 presets có field)
5. Regen matrix → verify theme.focusStyle present in matrix.json
6. Commit

## Todo list
- [ ] Add focusStyle to ThemePreset type
- [ ] Bulk update 112 presets
- [ ] Composer output passes through
- [ ] Typecheck
- [ ] Regen matrix
- [ ] Verify
- [ ] Commit

## Success Criteria
- All 112 presets có focusStyle
- matrix.json theme object có focusStyle key
- Rubric `focus-indicator-defined` criterion: 0% → 100% pass
- typecheck clean

## Risk Assessment
- Medium: bulk edit 112 presets risky — typecheck catches missing entries
- Low: CSS application deferred (just data field for now)

## Security Considerations
- Tailwind class string không user-controlled, no injection risk

## Next steps
- Phase 03: theme contrast audit
