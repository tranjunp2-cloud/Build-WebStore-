# Phase 03 — System prompt injection (soft guidance)

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase-01 (picker helper)
- Can run parallel with phase-02

## Overview
- Date: 2026-04-14
- Description: Inject the chosen category preset's colors into `buildSystemPrompt()` output so AI is aware of the expected palette. Reduces rebellion, improves content/color coherence (AI writes copy that matches the warm/cool mood).
- Priority: P1 (nice-to-have, phase-02 hard override is authoritative)

## Key insights
- System prompt has vague "CATEGORY PALETTES" advisory text at lines 116-121 (researcher-02). Current text is too generic, not enforced.
- Replace with specific hex values for the PICKED preset (not all 5 options).
- Soft guidance means AI KNOWS the target but phase-02 hard override is fallback.

## Requirements
- `buildSystemPrompt()` accepts optional `themeContext?: { preset, category }` param
- When provided, append section to prompt with exact hex values + font + mood rationale
- Backward compat: if themeContext missing, existing prompt output unchanged

## Architecture

```
buildSystemPrompt(language, themeContext?)
├── existing sections...
├── NEW: if themeContext:
│    prompt += `
│    ## REQUIRED THEME (MUST use these exact values in your theme object)
│    primaryColor: "${preset.primaryColor}"
│    secondaryColor: "${preset.secondaryColor}"
│    accentColor: "${preset.accentColor}"
│    fontHeading: "${fontHeading}"
│    fontBody: "${fontBody}"
│    colorMode: "${preset.colorMode}"
│
│    These are curated for ${category} businesses. Use them as the foundation
│    and let your section copy (CTAs, taglines, headings) match this mood:
│    ${moodHint(preset)} — e.g. "warm appetite-driving urgency" for restaurant
│    warm tones, or "calm trustworthy stability" for health clinics.
│    `
└── return prompt
```

## Related code files
- `src/lib/ai/system-prompt.ts:268-400` — MODIFY buildSystemPrompt signature + append logic
- `src/lib/ai/category-theme-picker.ts` — consumed (phase-01)

## Implementation steps
1. Extend `buildSystemPrompt(language, themeContext?)` signature — optional 2nd param.
2. Add `moodHint(preset)` helper — derives mood from colorMode + primary hue (warm/cool/neutral/bold).
3. Append `REQUIRED THEME` section when themeContext present.
4. Caller `openai-generator.ts` passes `{ preset, category }` alongside building user prompt.
5. Log token count delta (expect ~100-150 extra tokens per gen).
6. Remove or dim the old "CATEGORY PALETTES" advisory text (lines 116-121) to avoid conflict.
7. Test: gen restaurant → response JSON should have primary in warm range (even if AI ignores, phase-02 forces it).

## Todo
- [ ] buildSystemPrompt signature extended
- [ ] moodHint helper
- [ ] Preset injection tested via `buildSystemPrompt(...).includes(preset.primaryColor)`
- [ ] Old "CATEGORY PALETTES" section removed or dimmed
- [ ] Token count delta < 200
- [ ] 447 existing tests pass

## Success criteria
- [ ] AI prompt contains exact hex values for selected preset
- [ ] Token count stays under prior budget (<4500 input tokens)
- [ ] AI responses more often match preset colors (even without hard override)
- [ ] No regression in other prompt behaviors

## Risk assessment
- R1: token budget bloat. Mitigation: inject only for MATCHED category, not all 14 (already ensured).
- R2: AI ignores hard instruction anyway. Mitigation: phase-02 hard override is authoritative.
- R3: removing old CATEGORY PALETTES breaks other categories not in preset map. Mitigation: only remove if ALL 14 categories mapped — they are (phase-01).

## Security considerations
- Preset hex values are static, no user-controlled data in prompt.

## Next steps
→ phase-04 verification across 5 canonical categories.
