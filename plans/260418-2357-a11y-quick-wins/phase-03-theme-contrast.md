# Phase 03 — Theme Color Contrast Audit

## Context links
- Parent: [plan.md](plan.md)
- Depends on: none (parallel OK)

## Overview
Date: 2026-04-19
Description: Audit 190+ templates failing theme-color-contrast (WCAG AA 4.5:1). Identify failing primary colors, fix specific theme presets.
Priority: P2
Status: pending

## Key Insights
- Evaluator `themeColorContrast`:
  * If `theme.contrastRatio` defined → use it
  * Else compute từ primaryColor vs surfaceColor (fallback #ffffff or #0a0a0a based on colorMode)
- 50% pass = ~195/390 fail. Likely dark mode với wrong primary, hoặc light mode với primary too light
- Fix: adjust specific preset primaryColor để đạt ≥4.5:1

## Requirements
- Script to compute contrast ratio cho 112 theme presets
- Identify failing presets (ratio <4.5)
- Manually adjust primary color (darken/lighten) để pass
- OR add `contrastRatio` explicit field if adjusting color breaks design intent

## Architecture

### Audit script
```ts
// scripts/audit/theme-contrast.ts
import { THEME_PRESETS_ALL } from '@/lib/ai/theme-presets'
import { contrastRatio } from '@/lib/theme/contrast'  // extract from evaluators

for (const preset of THEME_PRESETS_ALL) {
  const surface = preset.colorMode === 'dark' ? '#0a0a0a' : '#ffffff'
  const r = contrastRatio(preset.primaryColor, surface)
  if (r < 4.5) console.log('FAIL', preset.name, preset.primaryColor, surface, '->', r.toFixed(2))
}
```

### Fix strategies
1. **Darken primary** (light mode): primary `#9ca3af` → `#4b5563` to hit 4.5+
2. **Lighten primary** (dark mode): primary `#4b5563` → `#9ca3af` on dark bg
3. **Accept + explicit**: add `contrastRatio: 4.6` nếu tested OK (override computed)

## Related code files
- `src/lib/ai/theme-presets.ts` (fix individual presets)
- `scripts/test-harness/rubric/evaluators.ts` `contrastRatio()` function (already implemented)
- `scripts/audit/theme-contrast.ts` (new audit script)

## Implementation Steps
1. Write audit script — export failing presets list
2. Triage list: group by category + colorMode + failing color
3. For each failing preset: adjust primaryColor (prefer darker shade of same hue)
4. Re-run audit → all pass
5. Regen matrix + score → contrast criterion jumps to 90%+
6. Commit

## Todo list
- [ ] Audit script
- [ ] Triage failing presets
- [ ] Fix each (adjust hex values)
- [ ] Re-audit
- [ ] Regen matrix + score
- [ ] Commit

## Success Criteria
- Rubric `theme-color-contrast` criterion: 50% → 90%+ pass
- 112 presets all ≥4.5:1 ratio với fallback surface
- Visual QA: colors still on-brand (just darker/lighter, not hue change)

## Risk Assessment
- Medium: adjusting colors có thể break brand intent của specific preset. Review each change với category-theme-picker to ensure category tone preserved.
- Low: some presets may need `contrastRatio` explicit override instead of color change (e.g., dark mode 'Noir Steakhouse' can keep dramatic low-contrast primary used on decorative badges, not body text)

## Security Considerations
- Static config change, no runtime risk

## Next steps
- Phase 04: verify final score
