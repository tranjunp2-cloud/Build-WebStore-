---
title: "AI Gen — Wire category theme presets to happy path (Phase 08 audit fix)"
description: "Category theme-presets.ts (70 curated themes) exist but only consumed by fallback composer. Wire to AI happy path so every gen uses category-appropriate colors + fonts deterministically."
status: abandoned
priority: P0
effort: 3-5h
branch: feat/F01-ai-gen-variety-fix
tags: [ai, theme, category-dna, quick-win]
created: 2026-04-14
---

## TL;DR

Anh nhớ đúng — **design quality work + category themes ĐÃ LÀM RỒI**. Nhưng AI happy path KHÔNG CONSUME chúng → mỗi gen vẫn bland generic blue.

**Fix = wire existing assets (2-3h), no new infrastructure needed.**

## Forensic findings

### ✅ What's DONE (Plan B `260412-2300-design-quality-rules`, 18 commits on current branch)

- **Phase 01** `5a1a6997` — design-tokens.ts (spacing/radius/shadow/icon sizes)
- **Phase 02** `4050a136` — typography tokens + font validator
- **Phase 03** `373554f2` — semantic color layer (60-30-10), `generatePalette()`, WCAG AA
- **Phase 04** `5b7594ac` — content validation rules
- **Phase 05** 14 commits — all 47 blocks refactored to use tokens (pilot `4be2fe2f` through `1113b32e`)

### ✅ What ALSO exists (discovered today)

**`src/lib/ai/theme-presets.ts`** — 70 category-specific themes:
```
RESTAURANT_PRESETS[5]:  Warm Spice, Night Market, Garden Dining, Hawker Neon, Heritage Gold
BEAUTY_PRESETS[5]:      Rose Petal, Lavender Dream, Midnight Glam, Soft Blush, Natural Glow
TECH_PRESETS[5]:        Cyber Blue, Neon Teal, Clean SaaS, Minimal Code, Dark Console
HEALTH_PRESETS[5]:      Clinical Clean, Healing Green, Trust Blue, Warm Wellness, Night Care
... 10 more categories × 5 variants = 70 total
```
Each preset has: `primaryColor`, `secondaryColor`, `accentColor`, `fontPairingId`, `colorMode`, `spacingPreset`, `borderRadius`, `shadowPreset`.

### ❌ What's NOT wired (the gap)

**AI happy path doesn't consume theme-presets.ts.**

Current flow in `openai-generator.ts:95-100`:
```ts
theme: {
    primaryColor: parsed.theme?.primaryColor || '#0ea5e9',  // AI output or generic blue
    secondaryColor: parsed.theme?.secondaryColor || '#d946ef',
    ...
}
```

AI generates ad-hoc theme, usually `#0ea5e9` generic. No category lookup, no preset injection, no validation.

**Only `composeFromBlueprint()` (fallback path) uses presets** via `TEMPLATE_PRESETS` picker → fallback sites look distinct, happy path sites look identical generic blue.

## Phases

| # | Phase | Effort | Status |
|---|---|---|---|
| 01 | [Category theme picker helper](./phase-01-category-theme-picker.md) | 30m | pending |
| 02 | [Wire into openai-generator happy path](./phase-02-happy-path-integration.md) | 1h | pending |
| 03 | [System prompt injection (soft guidance)](./phase-03-prompt-injection.md) | 1h | pending |
| 04 | [E2E verification + visual check](./phase-04-verify.md) | 30m | pending |

**Total:** 3h hands-on. Zero new infrastructure. Zero schema changes. Zero new dependencies.

## Strategy — 2 complementary layers

### Layer 1: HARD override (deterministic)
After AI returns, in `generateSiteWithAI()`:
1. Detect category from `businessInfo.industry` (already done via `detectedCategory`)
2. Pick preset: `pickCategoryTheme(category, seed)` — deterministic per category+seed, or random within category's 5 variants
3. Override `result.theme` with preset values (primary/secondary/accent/font/mode/spacing/radius/shadow)
4. **Exception:** if URL extraction provided `visualStyle.primaryColor`, respect that (existing override logic at route.ts:252-267)

**Pros:** 100% reliable. Every gen has category-appropriate theme.
**Cons:** Loses AI's brand-specific color matching if business has distinct identity.

### Layer 2: SOFT guidance (AI-aware)
Add to system prompt when building:
```
For this ${category} business, use these exact theme colors:
  primaryColor: "${preset.primaryColor}"
  secondaryColor: "${preset.secondaryColor}"
  accentColor: "${preset.accentColor}"
  fontHeading: "${fontPair.heading}"
  fontBody: "${fontPair.body}"
  colorMode: "${preset.colorMode}"
```

AI uses these as defaults but MAY override if the business has a known brand color in scraped content.

**Recommended:** Do BOTH layers. Soft guidance reduces AI resistance, hard override catches AI disobedience.

## Success metrics

1. Gen restaurant → primary in amber/red/orange range, NOT generic blue
2. Gen tech → cool blue/teal/green range with `tech-forward` font
3. Gen beauty → pink/purple/rose range with `elegant-serif` font
4. Same category × same seed → same theme (deterministic)
5. Same category × different seed → variation within 5 preset options
6. 447/447 existing unit tests still green

## Related existing code

- `src/lib/ai/theme-presets.ts` — READ (contains 70 presets)
- `src/lib/ai/template-definitions.ts` — READ (`pickPreset()` pattern in `fallback-adapter.ts:57-64`)
- `src/lib/ai/openai-generator.ts:95-100` — MODIFY (theme assignment)
- `src/lib/ai/system-prompt.ts` — MODIFY (prompt injection)
- `src/lib/theme/resolve.ts` — NO CHANGE (already cascades correctly from primary)
- `src/lib/theme/color-utils.ts` `generatePalette()` — NO CHANGE (already accepts any primary)
- `src/app/api/ai/generate-site/route.ts:252-267` — NO CHANGE (URL visualStyle override still respected via layer precedence)

## Research

- `research/researcher-01-design-quality-audit.md` — Plan B status, all phases done, infrastructure ready
- `research/researcher-02-category-theme-wiring.md` — wiring gap, fix location, cascading analysis

## Out of scope (defer)

- Fonts loading per preset (Google Fonts already supports all pairings)
- New theme preset authoring (70 already exist)
- Block refactor (already done Plan B Phase 05)
- Per-category few-shot examples (separate, Phase 09)
- TEMPLATE_PRESETS themselves (composer already uses them)

## Validation questions

1. **Layer choice:** hard override only, soft guidance only, or BOTH? Recommend BOTH.
2. **Deterministic vs variation:** same category always same preset (deterministic) OR pick from 5 via seed (variation)? Recommend variation.
3. **URL extraction precedence:** if user provides URL and `visualStyle.primaryColor` extracted, should it OVERRIDE the category preset? Recommend yes (existing behavior).
4. **Font override:** should we also override AI's font choice with preset's `fontPairingId`, or only colors? Recommend yes — fonts are category DNA.
