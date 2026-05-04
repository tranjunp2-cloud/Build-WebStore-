# Research #02 — Category-Specific Theme Wiring

> Created: 2026-04-14
> For: plan 260414-1630-phase-08-audit

## 1. Theme Flow — Current State

**Where colors originate:**
- `openai-generator.ts:95-100` — extracts `primaryColor` and `secondaryColor` from AI response JSON
- Fallback (rule-based): hardcoded defaults (`#0ea5e9` sky blue, `#d946ef` magenta)
- Default if AI fails: **always `primaryColor: '#0ea5e9'`** (generic sky blue)

AI is asked to output theme colors in its response, but there is **ZERO category-aware programmatic instruction** telling it WHAT colors to pick.

## 2. Per-Category Theme Existence — NONE

- **No mapping file exists** (e.g., `category-to-theme.ts`)
- Category content files in `src/lib/ai/content/*.ts` contain **only text content**, no theme metadata (no primary/secondary/brand colors)
- `system-prompt.ts` has `CATEGORY_HINTS` dict for text categorization (lines 9-15), empty of color guidance
- System prompt **"CATEGORY PALETTES"** section (lines 116-121) is **purely advisory text** to the AI:
  ```
  Restaurant/F&B: warm tones (amber, orange), Playfair Display
  E-commerce: cool tones (sky blue, indigo), DM Sans
  ```
  **This text is NEVER validated or enforced.**

## 3. Prompt-Level Category DNA — Weak/Unenforceable

System prompt tells AI to "Choose theme colors that match the business category" (line 95), but:
- NO specific hex values provided per category
- AI training may ignore advisory palette section (lines 116-121)
- NO validation that returned colors match category
- `buildUserPrompt()` passes raw `businessInfo.industry` (e.g., "spa", "tech shop"), NOT a normalized category constant
- AI must infer category from text + match to color — unreliable

## 4. Gap — What's Missing

To achieve "spa=warm earth, tech=cool mint, restaurant=warm red, real estate=trust navy":

1. **Explicit category → primary color mapping** (missing)
   ```ts
   const CATEGORY_THEMES = { spa: '#d4a574', tech: '#10b981', ... }
   ```

2. **Enforced category normalization** (missing)
   - Currently: raw `businessInfo.industry` passed to AI
   - Needed: Normalize input to enum `'beauty' | 'tech' | 'restaurant' | 'realestate' | ...`

3. **System prompt injection of category-specific primary** (missing)
   - Currently: AI is only *suggested* palettes
   - Needed: "For this RESTAURANT business, ALWAYS use primaryColor in amber/orange range (#D4741F–#F59E0B)"

4. **Validation layer** (missing)
   - Check: does returned color match category range?
   - Fallback: apply category-mapped primary if AI returns invalid/generic color

## 5. Existing Infrastructure — USABLE

**The pipeline CAN cascade category colors with minimal changes:**

- `generatePalette(primary, mode)` in `color-utils.ts` accepts `primary` as input ✓
- Theme structure already flexible (openai-generator.ts:95-100)
- AI response parsing already extracts theme object ✓
- Database/rendering already applies resolved theme ✓

**If we inject category-mapped primary color at generation time**, the entire pipeline (color resolution → palette generation → rendering) will automatically cascade.

**Example fix location:**
```ts
// In openai-generator.ts, BEFORE sending to AI:
const categoryPrimary = CATEGORY_THEMES[normalizeCategory(businessInfo.industry)]
const userPrompt = buildUserPrompt(businessInfo, extraInstructions, language, referencePrompt, categoryPrimary)
// Then in system-prompt.ts: inject "For this category, use primaryColor: #HEX"
```

## Summary — Root Cause

**Current problem:** Theme color selection is delegated ENTIRELY to AI with weak guidance. No programmatic category → color mapping exists anywhere.

**Why generic blue appears:** AI fallback default is `#0ea5e9`; no category enforcement means AI often ignores advisory palettes or returns generic values. Generic blue is training-data median.

**Path forward:** Create `CATEGORY_THEMES` mapping, normalize category early in pipeline, inject specific primary color into system prompt, validate output against category range. **Infrastructure is ready** — this is data + 1 file, ~2-3h effort.

## Unresolved Questions

1. Do we enforce category primary OR allow AI override if extracted from URL scraping (existing visualStyle override)?
2. How strict should validation be — reject any hex outside category hue range, or just warn?
3. Does the 14 TEMPLATE_PRESETS (used in composer fallback) already have distinct per-category themes we can reuse as the canonical palette?
