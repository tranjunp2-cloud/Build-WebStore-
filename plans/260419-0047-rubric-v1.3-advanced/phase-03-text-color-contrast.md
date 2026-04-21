# Phase 03 — textColor Body-Text Contrast

## Context links
- Parent: [plan.md](plan.md)

## Overview
Date: 2026-04-19
Description: Add `theme.textColor` field + evaluator check textColor vs surface ≥4.5:1 (WCAG AA body text, stricter than primary's 3.0:1 UI/large text).
Priority: P2
Status: pending

## Key Insights
- Current `theme-color-contrast` checks primary vs surface (UI element 3.0:1)
- Missing: body text readability. Body text needs 4.5:1.
- Composer không set theme.textColor — always inherit từ colorMode. Explicit makes rubric measurable + allows custom body text per preset (e.g., warm cream text on dark bg).

## Requirements
- ThemePreset extension: `textColor?: string` optional
- Composer output: if preset.textColor defined → use, else fallback từ colorMode (#111 light, #fff dark)
- Evaluator `textColorBodyContrast`: compute textColor vs surface, require ≥4.5
- Add criterion trong Accessibility dim (weight +2)

## Architecture

```ts
// theme-presets.ts
export type ThemePreset = {
  // ...existing
  textColor?: string  // NEW optional
}

// template-composer.ts theme output:
const defaultText = preset.themePreset.colorMode === 'dark' ? '#fafafa' : '#111111'
theme: {
  ...preset.themePreset,
  textColor: preset.themePreset.textColor ?? defaultText,
  // ...existing fonts + focusStyle
}

// evaluators.ts
textColorBodyContrast: ({ theme }) => {
  const text = theme?.textColor as string | undefined
  const surface = (theme?.surfaceColor ?? (theme?.colorMode === 'dark' ? '#0a0a0a' : '#ffffff')) as string
  if (!text) return { pass: false, reason: 'no textColor' }
  const ratio = contrastRatio(text, surface)
  if (ratio === null) return { pass: false, reason: 'invalid hex' }
  return { pass: ratio >= 4.5, reason: `${ratio.toFixed(2)}:1 (body text)` }
}
```

## Related code files
- `src/lib/ai/theme-presets.ts` (ThemePreset + default)
- `src/lib/ai/template-composer.ts` (2 theme output locations)
- `scripts/test-harness/rubric/evaluators.ts` (new evaluator)
- `scripts/test-harness/rubric/rubric-v1.3.json` (criterion trong Accessibility dim)

## Implementation Steps
1. Extend ThemePreset type với optional textColor
2. Composer output với textColor fallback logic
3. Add textColorBodyContrast evaluator
4. Add criterion in v1.3 spec
5. Regen + score

## Success Criteria
- New criterion 90%+ pass (defaults guarantee ≥10:1 contrast)
- Accessibility dim stable/improve
- v1.3 baseline shows clear signal when preset overrides textColor poorly

## Risk Assessment
- Low: additive, safe defaults

## Security Considerations
- None

## Next steps
- Phase 04: Runtime a11y
