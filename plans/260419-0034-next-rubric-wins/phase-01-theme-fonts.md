# Phase 01 — Theme fontHeading + fontBody

## Context links
- Parent: [plan.md](plan.md)

## Overview
Date: 2026-04-19
Description: Evaluator `themeHeadingBodyDistinct` requires explicit `fontHeading` + `fontBody` strings distinct. Current: presets only define `fontPairingId` → evaluator rejects. Fix: composer resolves pairing ID → emit both font name strings.
Priority: P1
Status: pending

## Key Insights
- `src/lib/fonts/pairings.ts` maps 20+ pairing IDs → { heading, body } font names
- Composer can look up pairing và emit: `theme.fontHeading = pairing.heading`, `theme.fontBody = pairing.body`
- Presets stay lean (just pairingId), no need to duplicate fonts

## Requirements
- Composer output theme có explicit fontHeading + fontBody
- Both derived từ existing pairing map
- No preset file changes

## Architecture
```ts
// template-composer.ts composeFromBlueprint + composeTemplate outputs:
const pairing = FONT_PAIRINGS[preset.themePreset.fontPairingId] ?? FONT_PAIRINGS.default
theme: {
  ...preset.themePreset,
  fontHeading: pairing.heading,   // NEW
  fontBody: pairing.body,         // NEW
  focusStyle: ... ?? DEFAULT_FOCUS_STYLE,
}
```

## Related code files
- `src/lib/fonts/pairings.ts` (pairing map)
- `src/lib/ai/template-composer.ts` (both composer outputs)

## Implementation Steps
1. Import FONT_PAIRINGS + lookup helper
2. Update 2 composer theme outputs
3. Regen matrix → verify theme.fontHeading + fontBody present
4. Typecheck

## Success Criteria
- `themeHeadingBodyDistinct` criterion: 0% → 100% pass
- Typography dim 8.3 → 9.5+

## Risk Assessment
- Low: additive fields, no existing consumer breakage

## Security Considerations
- None

## Next steps
- Phase 02: testimonial avatars
