# Phase 04 — E2E verification + visual check

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase-01, 02, 03
- Final phase of this mini-plan

## Overview
- Date: 2026-04-14
- Description: Run curl e2e gen for 5 canonical categories (beauty, restaurant, tech, health, realestate), verify theme primary hex matches expected category range, verify preset consistency for same business name, visual eyeball check of 3 preview URLs.
- Priority: P0 (gate for ship)

## Key insights
- Tests from phase-01 (picker unit tests) are isolated — need e2e for real AI path.
- Each category has a hex range we can assert on (restaurant = warm 0-60° hue, tech = 180-240° hue, etc).
- Deterministic per-business check: same businessName → same preset index.

## Requirements
- 5 canonical inputs from plan-2156 eval harness, extended:
  - beauty: "Bo Bo Spa Wellness" → expected warm pink/purple
  - restaurant: "Pho Hong Vietnam" → expected warm red/amber
  - tech: "CloudBase Labs" → expected cool blue/teal
  - health: "Saigon Dental Clinic" → expected cool blue/green
  - realestate: "Saigon Premier Realty" → expected navy/indigo
- For each: POST `/api/ai/generate-site`, verify response `theme.primaryColor` hex is in expected hue range
- Capture preview URLs for visual QA

## Architecture

```
scripts/ai/verify-category-themes.ts (NEW)
├── CANONICAL_INPUTS: 5 × BusinessInfo
├── EXPECTED_HUE_RANGES: Record<category, [h_min, h_max]>
├── for input in CANONICAL_INPUTS:
│   - auth
│   - POST generate-site
│   - parse theme
│   - assert hue in range
│   - log preview URL
└── summary table
```

## Related code files
- `scripts/ai/verify-category-themes.ts` — NEW
- No production code changes (phase-04 is verification only)

## Implementation steps
1. Create script `scripts/ai/verify-category-themes.ts` (or extend `scripts/ai/smoke-fallback.ts`).
2. Define `CANONICAL_INPUTS` array with 5 businesses × distinct categories.
3. Define `EXPECTED_HUE_RANGES`:
   - beauty: [280, 360] (pink/purple/rose)
   - restaurant: [0, 60] (red/orange/amber)
   - tech: [180, 240] (cyan/blue)
   - health: [150, 220] (teal/green/blue)
   - realestate: [210, 260] (navy/indigo)
4. For each input: auth test1, POST generate-site, parse JSON theme, run `hexToHSL(primaryColor)`, assert hue in range.
5. Print summary table: category, preset name, primary hex, hue, expected range, PASS/FAIL, preview URL.
6. Run script + fix any mismatches from phase-01/02 wiring.
7. Manual browser visual check on 3 preview URLs (1 per major mood: warm, cool, neutral).

## Todo
- [ ] Script created + runs
- [ ] 5/5 canonical inputs pass hue range check
- [ ] Deterministic: same businessName produces same theme across 3 runs
- [ ] Preview URL screenshots saved (3 minimum)
- [ ] Visual QA: sites LOOK different (spa warm, tech cool, restaurant appetizing)
- [ ] 447 existing unit tests still pass

## Success criteria
- [ ] Script exits 0 — all 5 pass assertion
- [ ] Visual regression: spa, tech, restaurant look MEANINGFULLY DIFFERENT from each other
- [ ] User confirmation: "yeah this looks like a spa / tech / restaurant site, not generic blue SaaS"

## Risk assessment
- R1: AI refuses preset colors — phase-02 hard override should catch. If still failing, add validation layer that re-overrides.
- R2: hue range too tight — some presets might have colors at boundary. Widen range if test flake.
- R3: determinism broken by Math.random in seed calculation. Verify seed = hash(businessName) not Date.now().

## Security considerations
- Script runs against local dev server only. No production side effects.

## Next steps
After pass: commit + push to PR + mark plan done.
After fail: iterate phase-02 logic, re-verify.
