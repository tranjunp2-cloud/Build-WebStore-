# Phase 02 — Wire category theme into AI happy path

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase-01 (`pickCategoryTheme`)
- Blocks: phase-04 (verification)

## Overview
- Date: 2026-04-14
- Description: In `openai-generator.ts` `generateSiteWithAI()`, after parsing AI response, override `result.theme` with category preset fields. Preserves URL extraction override precedence. Ensures every gen has category-appropriate colors + fonts + spacing + mode.
- Priority: P0

## Key insights
- Current flow builds `result.theme` from AI response at line 95-100 with generic defaults.
- URL extraction `visualStyle` override happens later in `route.ts:252-267` AFTER `generateSiteWithAI` returns. Our override must be inside `generateSiteWithAI` so URL layer still wins.
- `detectedCategory` variable already exists at line 114 (`generate-blocks.ts:BusinessIntent.type`). Use it directly.
- **Precedence order:** URL extraction > Category preset > AI output > generic default.

## Requirements
- Every happy path gen assigns `result.theme.primaryColor` / `.secondaryColor` / `.accentColor` / `.fontHeading` / `.fontBody` / `.colorMode` / `.spacingPreset` / `.borderRadius` / `.shadowPreset` from category preset
- AI's output for these fields is IGNORED (we trust preset library over AI guess)
- Fallback: if `detectedCategory` is undefined, leave as AI output (backward compat)

## Architecture

```
openai-generator.ts flow
├── 1. AI returns parsed.theme (ignored colors, keep personality if any)
├── 2. detectedCategory resolved (existing line 114)
├── 3. seed = Date.now() OR business-name-hash (deterministic per business)
├── 4. preset = pickCategoryTheme(detectedCategory, seed)
├── 5. result.theme = {
│       primaryColor: preset.primaryColor,
│       secondaryColor: preset.secondaryColor,
│       accentColor: preset.accentColor,
│       fontHeading: resolveFontHeading(preset.fontPairingId),
│       fontBody: resolveFontBody(preset.fontPairingId),
│       colorMode: preset.colorMode,
│       spacingPreset: preset.spacingPreset,
│       borderRadius: preset.borderRadius,
│       shadowPreset: preset.shadowPreset,
│    }
└── return result (route.ts still runs URL override after this)
```

## Related code files
- `src/lib/ai/openai-generator.ts:95-100` — MODIFY theme assignment
- `src/lib/ai/category-theme-picker.ts` — IMPORT from phase-01
- `src/lib/ai/font-pairings.ts` — READ (resolve fontPairingId → fontHeading/fontBody)
- `src/app/api/ai/generate-site/route.ts:252-267` — NO CHANGE (URL override precedence preserved)

## Implementation steps
1. Import `pickCategoryTheme` in openai-generator.ts.
2. Compute `themeSeed` — use `hashBusinessName(businessInfo.businessName)` for deterministic per-business + per-category variation (same business always gets same theme).
3. After `parsed` is ready and `detectedCategory` exists, compute `preset = pickCategoryTheme(detectedCategory, themeSeed)`.
4. Replace theme construction with preset fields.
5. Resolve font pairing via `resolveFontPairing(preset.fontPairingId)` from `font-pairings.ts`.
6. Log: `[Theme] Using category preset "${preset.name}" for ${detectedCategory}`.
7. Update existing `generateWithFallback` path to ALSO apply preset (for consistency — currently fallback-adapter already does via composeFromBlueprint).
8. No test changes for this phase (tests in phase-04).

## Todo
- [ ] Import `pickCategoryTheme` + `resolveFontPairing`
- [ ] Compute themeSeed from business name hash
- [ ] Override theme in both paths (happy + fallback)
- [ ] Log preset name for debugging
- [ ] 447 existing tests still pass
- [ ] TypeScript clean

## Success criteria
- [ ] Gen restaurant → primary hex in amber/red range (#c2410c / #dc2626 / #166534 / ...)
- [ ] Gen tech → primary hex in blue/teal/green range
- [ ] Gen beauty → primary hex in pink/purple/rose range
- [ ] Same business name → same theme (deterministic via hash)
- [ ] Log shows `[Theme] Using category preset "Rose Petal" for beauty`

## Risk assessment
- R1: AI might rebel — return theme colors in different shade thinking it knows better. Mitigation: HARD override after parse, AI output for theme ignored.
- R2: URL extraction breakage — URL `visualStyle.primaryColor` override runs AFTER generateSiteWithAI so should still win. Verify via e2e test.
- R3: Dark mode preset forces dark background on business that wanted light. Acceptable — presets per category are curated to feel right per industry.
- R4: fontPairingId resolution mismatch — `font-pairings.ts` might not know a preset's pairingId. Mitigation: fallback to safe default (Outfit + Inter) with warn.

## Security considerations
- No user input touches preset picker. All inputs are internal (detectedCategory, businessName hash).

## Next steps
→ phase-03 adds preset hint to system prompt so AI is aware of the expected color range (reduces rebellion, improves content/color coherence).
