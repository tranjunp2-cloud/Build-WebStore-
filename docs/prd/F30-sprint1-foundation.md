# PRD: Template System v2 — Sprint 1: Foundation (F30-S1)

> **Version:** 1.0 | **Created:** 2026-04-06 | **Agent:** `project-planner`
> **Priority:** P0 | **Sprint:** Wave 2 — Sprint 1 | **Size:** L
> **Depends on:** F04 (Block Renderer) | **Blocks:** F30-S2 (Style Presets), F30-S3 (Template Gallery v2)

---

## 0. Current State Analysis (Source Code Audit)

### What exists today

| File | Current State |
|------|--------------|
| `src/blocks/types.ts` | `ThemeConfig` has 6 fields: `primaryColor`, `secondaryColor`, `backgroundColor`, `fontHeading`, `fontBody`, `colorMode` |
| `src/components/site-renderer/SiteRenderer.tsx` | Injects 4 CSS vars: `--brand-primary`, `--brand-secondary`, `--font-heading`, `--font-body` |
| `src/collections/Sites.ts` | `theme` group has `borderRadius` field (5 options) — **NOT reflected in ThemeConfig type** |
| `src/blocks/hero/index.tsx` | Uses `const pc = theme.primaryColor` inline in 15 places |
| 42 block components total | 28 files use `${pc}` inline (125 occurrences), only 2 files use `var(--` (3 occurrences) |

### Key Problems

1. **ThemeConfig type mismatch**: `Sites.ts` has `borderRadius` but `ThemeConfig` type does not — blocks cannot access it
2. **Only 2 colors**: No accent, surface, text, or muted color tokens — blocks have hardcoded grays/whites
3. **No spacing system**: Every block hardcodes its own padding/gap values
4. **No border radius tokens**: Blocks use hardcoded `rounded-xl`, `rounded-2xl`, `rounded-full` — ignoring site-level `borderRadius`
5. **97% inline color**: 125 `${pc}` inline vs 3 `var(--` — no design token layer
6. **6 fonts, no pairings**: `fontHeading` has 6 options, `fontBody` has 5 — no curated pairings, no preview

---

## 1. Problem Statement

The current theme system supports only 2 colors and 6 individual fonts, with 97% of styling done via inline `${pc}` interpolation. This makes it impossible to create visually distinct templates — every site looks the same regardless of "theme" settings. Expanding the design token system is the prerequisite for template variety, style presets, and AI-driven design in Sprint 2-3.

---

## 2. Target User

- **Primary:** Site owners using AI Builder to generate websites (non-technical SMB owners in Malaysia)
- **Secondary:** AI Builder system (OpenAI) that generates ThemeConfig values for new sites
- **Tertiary:** Developers building new block components

---

## 3. Solution Overview

Expand `ThemeConfig` from 6 fields to ~18 fields organized into 4 token groups: **Colors** (6 tokens), **Typography** (font pairing ID + scale), **Spacing** (preset), and **Shape** (border radius + shadow). Inject all tokens as CSS custom properties in `SiteRenderer.tsx`. Migrate all 42 block components from inline `${pc}` to `var(--token)` usage. Add 20 curated font pairings with preview capability. Maintain full backward compatibility — existing sites with old 6-field ThemeConfig continue to render identically via derive logic.

---

## 4. Scope

### In Scope
- Expand ThemeConfig type: 2 colors to 6 color tokens
- Add spacing presets (compact / default / relaxed)
- Add border radius token (sync with existing Sites.ts field)
- Curate 20 font pairings with metadata
- Font preview system for editor/builder
- Migrate all 42 blocks to CSS custom properties
- Backward compatibility: derive new tokens from old 2-color config
- Update Zod schema validation
- Update SiteRenderer CSS variable injection

### Out of Scope
- Style presets / preset gallery (Sprint 2)
- Template gallery redesign (Sprint 3)
- AI prompt engineering for new tokens (Sprint 2)
- Editor UI for token editing (Sprint 2)
- Animation tokens (future)
- Custom CSS per block (future)

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Inline `${pc}` occurrences in blocks | 0 (from 125) | `grep -r '\${pc}' src/blocks/ --include="*.tsx" -c` |
| CSS variable usage in blocks | 100% of color/font references | `grep -r 'var(--' src/blocks/ --include="*.tsx" -c` |
| Backward compatibility | 100% existing sites render identically | Visual regression test (screenshot diff) |
| Font pairings available | 20 curated pairings | Unit test count |
| Block migration coverage | 42/42 blocks updated | PR review checklist |

---

## 6. User Stories

### US-F30-01: Expanded Color Palette
```
AS A site owner
I WANT my website to have a cohesive color palette beyond just primary/secondary
SO THAT my site looks professionally designed with consistent accent, surface, and text colors
```

### US-F30-02: Font Pairing Selection
```
AS A site owner
I WANT to choose from curated font pairings (heading + body) with preview
SO THAT I can quickly find a typography combination that matches my brand personality
```

### US-F30-03: Spacing & Shape Consistency
```
AS A site owner
I WANT consistent spacing and border radius across all sections of my website
SO THAT my site feels cohesive rather than a patchwork of different styles
```

### US-F30-04: Backward Compatible Theme
```
AS A returning user with an existing site
I WANT my current site to look exactly the same after the theme system upgrade
SO THAT I don't lose my current design when the platform updates
```

### US-F30-05: Developer Token System
```
AS A developer building new blocks
I WANT a clear design token system with CSS custom properties
SO THAT I can build blocks that automatically adapt to any theme configuration
```

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | ThemeConfig type MUST support 6 color tokens: `primaryColor`, `secondaryColor`, `accentColor`, `surfaceColor`, `textColor`, `mutedColor` | US-F30-01 | P0 | Expand from 2 to 6 |
| FR-02 | ThemeConfig MUST include `spacingPreset` field with values: `compact`, `default`, `relaxed` | US-F30-03 | P0 | Maps to CSS spacing scale |
| FR-03 | ThemeConfig MUST include `borderRadius` field matching Sites.ts options: `sharp`, `subtle`, `rounded`, `soft`, `pill` | US-F30-03 | P0 | Sync with existing DB field |
| FR-04 | ThemeConfig MUST include `fontPairingId` field referencing one of 20 curated pairings | US-F30-02 | P0 | Replaces separate fontHeading/fontBody |
| FR-05 | ThemeConfig MUST retain `fontHeading` and `fontBody` as resolved values (derived from fontPairingId or set directly) | US-F30-02 | P0 | Backward compat |
| FR-06 | System MUST define 20 curated font pairings with metadata: id, name, category, headingFont, bodyFont, description | US-F30-02 | P0 | Exported from `src/lib/fonts/pairings.ts` |
| FR-07 | SiteRenderer MUST inject all design tokens as CSS custom properties on `:root` | US-F30-05 | P0 | Currently only 4 vars |
| FR-08 | All 42 block components MUST use `var(--token)` instead of inline `${pc}` for colors | US-F30-05 | P0 | Migration from 125 inline refs |
| FR-09 | All block components MUST use `var(--radius-*)` tokens instead of hardcoded Tailwind radius classes | US-F30-05 | P1 | ~64 hardcoded radius refs |
| FR-10 | System MUST derive missing tokens from legacy 2-field config using deterministic algorithm | US-F30-04 | P0 | See Section 14 |
| FR-11 | Font preview component MUST render sample text in both heading and body fonts without full page reload | US-F30-02 | P1 | For editor/builder |
| FR-12 | ThemeConfig Zod schema MUST validate all new fields with correct defaults | US-F30-01 | P0 | Fail-safe defaults |
| FR-13 | System MUST include `shadowPreset` field with values: `none`, `subtle`, `medium`, `dramatic` | US-F30-03 | P1 | Box-shadow consistency |
| FR-14 | Google Fonts Loader MUST preload fonts from selected pairing | US-F30-02 | P1 | Update GoogleFontsLoader |
| FR-15 | Each font pairing MUST include `category` tag for filtering: `modern`, `classic`, `playful`, `minimal`, `bold` | US-F30-02 | P1 | For future gallery filter |

---

## 8. Business Rules

- **BR-01:** `fontPairingId` takes precedence over individual `fontHeading`/`fontBody` when both are present
- **BR-02:** If `fontPairingId` is not set but `fontHeading`/`fontBody` are set, use them directly (backward compat)
- **BR-03:** Default theme for new sites: `fontPairingId: 'modern-clean'`, `spacingPreset: 'default'`, `borderRadius: 'rounded'`
- **BR-04:** Color tokens MUST be valid 6-digit hex codes (`#RRGGBB`), validated by Zod regex
- **BR-05:** AI Builder prompt MUST be updated to generate all 6 color tokens (not just primary/secondary)
- **BR-06:** Spacing presets are site-wide — individual blocks cannot override the preset (ensures consistency)
- **BR-07:** Legacy sites (pre-upgrade) MUST continue to work with only `primaryColor` + `secondaryColor` set

---

## 9. User Flow

### Flow 1: New Site Creation (AI Builder)
```
User enters business description in AI Builder
  |
AI generates ThemeConfig with all 18 fields (6 colors, fontPairingId, spacing, radius, shadow)
  |
SiteRenderer receives ThemeConfig
  |
  +-- Resolves fontPairingId -> fontHeading + fontBody
  +-- Maps spacingPreset -> CSS spacing scale vars
  +-- Maps borderRadius -> CSS radius vars
  +-- Maps shadowPreset -> CSS shadow vars
  +-- Injects all 20+ CSS custom properties into :root
  |
Blocks render using var(--token) references
  |
Site displays with cohesive design system
```

### Flow 2: Existing Site (Backward Compatibility)
```
Existing site loaded from DB with old ThemeConfig (only primaryColor, secondaryColor, fontHeading, fontBody, colorMode)
  |
SiteRenderer detects missing tokens
  |
  +-- accentColor = derive from primaryColor (lighten 15%)
  +-- surfaceColor = derive from colorMode (dark: #111, light: #f8f8f8)
  +-- textColor = derive from colorMode (dark: #fafafa, light: #09090b)
  +-- mutedColor = derive from colorMode (dark: #a1a1aa, light: #71717a)
  +-- spacingPreset = 'default'
  +-- borderRadius = 'rounded' (or from Sites.ts DB if available)
  +-- shadowPreset = 'subtle'
  +-- fontPairingId = null (use fontHeading/fontBody directly)
  |
Result: Site renders identically to before upgrade
```

---

## 10. Architecture

### 10.1 System Architecture (ASCII)

```
                    ┌──────────────────────────────────┐
                    |        Sites Collection          |
                    |   (Payload CMS / PostgreSQL)     |
                    |  theme.primaryColor               |
                    |  theme.secondaryColor             |
                    |  theme.accentColor       [NEW]    |
                    |  theme.surfaceColor      [NEW]    |
                    |  theme.textColor         [NEW]    |
                    |  theme.mutedColor        [NEW]    |
                    |  theme.fontPairingId     [NEW]    |
                    |  theme.spacingPreset     [NEW]    |
                    |  theme.borderRadius      [EXISTS] |
                    |  theme.shadowPreset      [NEW]    |
                    |  theme.colorMode                  |
                    └──────────────┬───────────────────┘
                                  |
                                  v
                    ┌──────────────────────────────────┐
                    |        SiteRenderer.tsx           |
                    |  1. Receive raw theme from DB     |
                    |  2. resolveTheme() — fill gaps    |
                    |  3. resolveFont() — pairing->font |
                    |  4. Inject CSS custom properties  |
                    └──────────────┬───────────────────┘
                                  |
                    ┌─────────────┼─────────────┐
                    |             |             |
                    v             v             v
            ┌──────────┐ ┌──────────┐ ┌──────────┐
            | :root    | | Blocks   | | Google   |
            | CSS vars | | use      | | Fonts    |
            | (20+)    | | var(--)  | | Loader   |
            └──────────┘ └──────────┘ └──────────┘

CSS Custom Properties (injected by SiteRenderer):

  Colors:       --brand-primary, --brand-secondary, --brand-accent
                --surface, --text, --muted

  Typography:   --font-heading, --font-body

  Spacing:      --space-xs, --space-sm, --space-md, --space-lg
                --space-xl, --space-2xl, --section-padding

  Shape:        --radius-sm, --radius-md, --radius-lg, --radius-full
                --shadow-sm, --shadow-md, --shadow-lg
```

### 10.2 File Structure

| Component | File | Description |
|-----------|------|-------------|
| `ThemeConfig` type | `src/blocks/types.ts` | Expanded type definition + Zod schema |
| `resolveTheme()` | `src/lib/theme/resolve.ts` | **[NEW]** Fills missing tokens from legacy config |
| `FONT_PAIRINGS` | `src/lib/fonts/pairings.ts` | **[NEW]** 20 curated font pairings data |
| `FontPreview` | `src/components/fonts/FontPreview.tsx` | **[NEW]** Font preview component |
| `SiteRenderer` | `src/components/site-renderer/SiteRenderer.tsx` | Updated CSS variable injection |
| `GoogleFontsLoader` | `src/components/site-renderer/GoogleFontsLoader.tsx` | Updated for pairing-based loading |
| `Sites` collection | `src/collections/Sites.ts` | New theme fields |
| 42 block components | `src/blocks/*/index.tsx` | Migrate from `${pc}` to `var(--token)` |

---

## 11. Data Model Changes

### 11.1 ThemeConfig Type — BEFORE

```typescript
// src/blocks/types.ts — CURRENT (6 fields)
export type ThemeConfig = {
    primaryColor: string
    secondaryColor: string
    backgroundColor: string
    fontHeading: string
    fontBody: string
    colorMode: 'light' | 'dark'
}
```

### 11.2 ThemeConfig Type — AFTER

```typescript
// src/blocks/types.ts — NEW (18 fields)
export type ThemeConfig = {
    // ── Colors (6 tokens) ──
    primaryColor: string       // Brand primary (#hex)
    secondaryColor: string     // Brand secondary (#hex)
    accentColor: string        // Accent for highlights, badges (#hex)
    surfaceColor: string       // Card/section backgrounds (#hex)
    textColor: string          // Primary text color (#hex)
    mutedColor: string         // Secondary text, placeholders (#hex)

    // ── Typography ──
    fontPairingId: string | null  // Reference to FONT_PAIRINGS, null = custom
    fontHeading: string           // Resolved heading font family
    fontBody: string              // Resolved body font family

    // ── Spacing ──
    spacingPreset: 'compact' | 'default' | 'relaxed'

    // ── Shape ──
    borderRadius: 'sharp' | 'subtle' | 'rounded' | 'soft' | 'pill'
    shadowPreset: 'none' | 'subtle' | 'medium' | 'dramatic'

    // ── Mode ──
    colorMode: 'light' | 'dark'
    backgroundColor: string  // Page background (#hex)
}
```

### 11.3 CSS Variables — BEFORE

```css
/* SiteRenderer.tsx — CURRENT (4 variables) */
:root {
    --brand-primary: #0ea5e9;
    --brand-secondary: #d946ef;
    --font-heading: 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
}
```

### 11.4 CSS Variables — AFTER

```css
/* SiteRenderer.tsx — NEW (20+ variables) */
:root {
    /* Colors */
    --brand-primary: #0ea5e9;
    --brand-secondary: #d946ef;
    --brand-accent: #f59e0b;
    --surface: #111111;
    --text: #fafafa;
    --muted: #a1a1aa;
    --background: #09090b;

    /* Typography */
    --font-heading: 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;

    /* Spacing (varies by preset) */
    --space-xs: 0.25rem;   /* 4px */
    --space-sm: 0.5rem;    /* 8px */
    --space-md: 1rem;      /* 16px */
    --space-lg: 1.5rem;    /* 24px */
    --space-xl: 2.5rem;    /* 40px */
    --space-2xl: 4rem;     /* 64px */
    --section-padding: 5rem; /* 80px */

    /* Shape */
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 16px;
    --radius-full: 9999px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.15);
    --shadow-lg: 0 8px 30px rgba(0,0,0,0.2);
}
```

### 11.5 Spacing Preset Values

| Token | `compact` | `default` | `relaxed` |
|-------|-----------|-----------|-----------|
| `--space-xs` | 0.125rem (2px) | 0.25rem (4px) | 0.375rem (6px) |
| `--space-sm` | 0.25rem (4px) | 0.5rem (8px) | 0.75rem (12px) |
| `--space-md` | 0.5rem (8px) | 1rem (16px) | 1.5rem (24px) |
| `--space-lg` | 1rem (16px) | 1.5rem (24px) | 2rem (32px) |
| `--space-xl` | 1.5rem (24px) | 2.5rem (40px) | 3.5rem (56px) |
| `--space-2xl` | 2.5rem (40px) | 4rem (64px) | 6rem (96px) |
| `--section-padding` | 3rem (48px) | 5rem (80px) | 7rem (112px) |

### 11.6 Border Radius Preset Values

| Token | `sharp` | `subtle` | `rounded` | `soft` | `pill` |
|-------|---------|----------|-----------|--------|--------|
| `--radius-sm` | 0 | 2px | 4px | 8px | 9999px |
| `--radius-md` | 0 | 4px | 8px | 16px | 9999px |
| `--radius-lg` | 0 | 8px | 16px | 24px | 9999px |
| `--radius-full` | 0 | 9999px | 9999px | 9999px | 9999px |

### 11.7 Shadow Preset Values

| Token | `none` | `subtle` | `medium` | `dramatic` |
|-------|--------|----------|----------|------------|
| `--shadow-sm` | none | 0 1px 2px rgba(0,0,0,0.05) | 0 1px 3px rgba(0,0,0,0.1) | 0 2px 4px rgba(0,0,0,0.15) |
| `--shadow-md` | none | 0 2px 8px rgba(0,0,0,0.08) | 0 4px 12px rgba(0,0,0,0.15) | 0 8px 24px rgba(0,0,0,0.2) |
| `--shadow-lg` | none | 0 4px 16px rgba(0,0,0,0.1) | 0 8px 30px rgba(0,0,0,0.2) | 0 16px 48px rgba(0,0,0,0.3) |

### 11.8 Sites.ts Collection Changes

New fields to add to `theme` group:

```typescript
// Add to src/collections/Sites.ts theme.fields[]
{ name: 'accentColor',   type: 'text', defaultValue: '#f59e0b' },
{ name: 'surfaceColor',  type: 'text', defaultValue: '#ffffff' },
{ name: 'textColor',     type: 'text', defaultValue: '#09090b' },
{ name: 'mutedColor',    type: 'text', defaultValue: '#71717a' },
{ name: 'fontPairingId', type: 'text', defaultValue: 'modern-clean' },
{ name: 'spacingPreset', type: 'select', defaultValue: 'default',
  options: ['compact', 'default', 'relaxed'] },
{ name: 'shadowPreset',  type: 'select', defaultValue: 'subtle',
  options: ['none', 'subtle', 'medium', 'dramatic'] },
// borderRadius already exists - no change needed
```

---

## 12. Font Pairings (20 Curated)

| # | ID | Name | Category | Heading Font | Body Font |
|---|-----|------|----------|--------------|-----------|
| 1 | `modern-clean` | Modern Clean | modern | Inter | Inter |
| 2 | `editorial` | Editorial | classic | Playfair Display | Lora |
| 3 | `tech-forward` | Tech Forward | modern | Space Grotesk | Inter |
| 4 | `warm-friendly` | Warm & Friendly | playful | Nunito | Nunito Sans |
| 5 | `bold-impact` | Bold Impact | bold | Oswald | Source Sans 3 |
| 6 | `elegant-serif` | Elegant Serif | classic | Cormorant Garamond | Proza Libre |
| 7 | `startup-vibe` | Startup Vibe | modern | Outfit | DM Sans |
| 8 | `creative-studio` | Creative Studio | playful | Sora | Work Sans |
| 9 | `minimal-swiss` | Minimal Swiss | minimal | Helvetica Neue | Inter |
| 10 | `luxury-brand` | Luxury Brand | classic | Playfair Display | Raleway |
| 11 | `geometric` | Geometric | modern | Poppins | Open Sans |
| 12 | `humanist` | Humanist | minimal | DM Sans | DM Sans |
| 13 | `retro-modern` | Retro Modern | playful | Archivo Black | DM Mono |
| 14 | `news-editorial` | News Editorial | classic | Merriweather | Source Serif 4 |
| 15 | `fresh-rounded` | Fresh Rounded | playful | Varela Round | Nunito |
| 16 | `pro-corporate` | Pro Corporate | minimal | Manrope | Inter |
| 17 | `artisan` | Artisan | classic | Lora | Karla |
| 18 | `futuristic` | Futuristic | bold | Rajdhani | Exo 2 |
| 19 | `cafe-bistro` | Cafe & Bistro | playful | Josefin Sans | Quicksand |
| 20 | `bold-geometric` | Bold Geometric | bold | Montserrat | Hind |

### Font Pairing Type

```typescript
// src/lib/fonts/pairings.ts
export type FontPairing = {
    id: string
    name: string
    category: 'modern' | 'classic' | 'playful' | 'minimal' | 'bold'
    headingFont: string
    bodyFont: string
    headingWeight: number    // default weight for headings (600-900)
    bodyWeight: number       // default weight for body (300-500)
    description: string      // e.g. "Clean and contemporary, perfect for tech startups"
    sampleText?: string      // preview sentence
}

export const FONT_PAIRINGS: FontPairing[] = [ /* 20 entries */ ]

export function getFontPairing(id: string): FontPairing | undefined
export function getFontsByCategory(category: FontPairing['category']): FontPairing[]
export function getGoogleFontsUrl(pairing: FontPairing): string
```

---

## 13. Acceptance Criteria

### AC-01: ThemeConfig Expanded Type

```gherkin
GIVEN  a developer imports ThemeConfig from 'src/blocks/types.ts'
WHEN   they inspect the type definition
THEN   it MUST include all 6 color tokens (primaryColor, secondaryColor, accentColor, surfaceColor, textColor, mutedColor)
  AND  it MUST include spacingPreset, borderRadius, shadowPreset fields
  AND  it MUST include fontPairingId (nullable string)
  AND  it MUST retain fontHeading, fontBody, colorMode, backgroundColor
```

### AC-02: CSS Variables Injected

```gherkin
GIVEN  a site is rendered via SiteRenderer
WHEN   the page loads in the browser
THEN   :root MUST contain all 20+ CSS custom properties
  AND  --brand-primary, --brand-secondary, --brand-accent MUST be valid hex colors
  AND  --surface, --text, --muted MUST be valid hex colors
  AND  --space-xs through --section-padding MUST have rem/px values
  AND  --radius-sm, --radius-md, --radius-lg MUST have px values
  AND  --shadow-sm, --shadow-md, --shadow-lg MUST have valid box-shadow values
```

### AC-03: Block Migration Complete

```gherkin
GIVEN  the block migration is complete
WHEN   running `grep -r '\${pc}' src/blocks/ --include="*.tsx" -c`
THEN   all files MUST return 0 occurrences
  AND  running `grep -r 'var(--brand' src/blocks/ --include="*.tsx" -c` returns matches in >= 28 files
```

### AC-04: Backward Compatibility — Legacy Site

```gherkin
GIVEN  an existing site with only primaryColor (#0ea5e9) and secondaryColor (#d946ef) set
  AND  accentColor, surfaceColor, textColor, mutedColor are null/undefined
WHEN   SiteRenderer resolves the theme via resolveTheme()
THEN   accentColor MUST be derived as primaryColor lightened by 15%
  AND  surfaceColor MUST be #111111 (dark mode) or #f8f8f8 (light mode)
  AND  textColor MUST be #fafafa (dark mode) or #09090b (light mode)
  AND  mutedColor MUST be #a1a1aa (dark mode) or #71717a (light mode)
  AND  spacingPreset MUST default to 'default'
  AND  borderRadius MUST default to 'rounded'
  AND  the rendered site MUST be visually identical to pre-upgrade
```

### AC-05: Backward Compatibility — Legacy Fonts

```gherkin
GIVEN  an existing site with fontHeading='Outfit' and fontBody='Inter' but no fontPairingId
WHEN   SiteRenderer resolves the theme
THEN   fontHeading MUST remain 'Outfit'
  AND  fontBody MUST remain 'Inter'
  AND  fontPairingId MUST be null
  AND  GoogleFontsLoader MUST load 'Outfit' and 'Inter' correctly
```

### AC-06: Font Pairing Resolution

```gherkin
GIVEN  a site with fontPairingId='editorial'
WHEN   SiteRenderer resolves the theme
THEN   fontHeading MUST be 'Playfair Display'
  AND  fontBody MUST be 'Lora'
  AND  --font-heading CSS var MUST be "'Playfair Display', serif"
  AND  --font-body CSS var MUST be "'Lora', sans-serif"
  AND  GoogleFontsLoader MUST preload both fonts
```

### AC-07: Font Preview Component

```gherkin
GIVEN  the FontPreview component is rendered with pairingId='startup-vibe'
WHEN   the component mounts
THEN   it MUST display heading text in 'Outfit' font
  AND  it MUST display body text in 'DM Sans' font
  AND  fonts MUST load without full page reload
  AND  a loading state MUST show while fonts are loading
```

### AC-08: Spacing Preset Applied

```gherkin
GIVEN  a site with spacingPreset='compact'
WHEN   the CSS variables are injected
THEN   --section-padding MUST be 3rem
  AND  --space-lg MUST be 1rem
  AND  all blocks using var(--section-padding) MUST render with tighter spacing
```

### AC-09: Border Radius Token Applied

```gherkin
GIVEN  a site with borderRadius='pill'
WHEN   blocks render buttons and cards
THEN   buttons MUST use var(--radius-md) which resolves to 9999px
  AND  cards MUST use var(--radius-lg) which resolves to 9999px
  AND  no hardcoded Tailwind rounded-* classes remain for theme-controlled elements
```

### AC-10: Shadow Preset Applied

```gherkin
GIVEN  a site with shadowPreset='dramatic'
WHEN   blocks render cards with shadows
THEN   cards MUST use var(--shadow-md) which resolves to '0 8px 24px rgba(0,0,0,0.2)'
  AND  elevated elements MUST use var(--shadow-lg)
```

### AC-11: Zod Schema Validation

```gherkin
GIVEN  a ThemeConfig with invalid values
WHEN   validated against ThemeConfigSchema
THEN   missing fields MUST be filled with correct defaults
  AND  invalid hex codes MUST fail validation
  AND  invalid preset values (e.g. spacingPreset='huge') MUST fail validation
  AND  fontPairingId can be null (valid)
```

### AC-12: Surface Color in Dark/Light Mode

```gherkin
GIVEN  a site in dark mode with no surfaceColor set
WHEN   resolveTheme() runs
THEN   surfaceColor MUST be '#111111' (dark surface for cards)
  AND  textColor MUST be '#fafafa'
  AND  --surface CSS var MUST be '#111111'
```

```gherkin
GIVEN  a site in light mode with no surfaceColor set
WHEN   resolveTheme() runs
THEN   surfaceColor MUST be '#f8f8f8' (light surface for cards)
  AND  textColor MUST be '#09090b'
  AND  --surface CSS var MUST be '#f8f8f8'
```

### AC-13: 20 Font Pairings Available

```gherkin
GIVEN  the FONT_PAIRINGS array is exported from 'src/lib/fonts/pairings.ts'
WHEN   a developer imports it
THEN   it MUST contain exactly 20 entries
  AND  each entry MUST have: id, name, category, headingFont, bodyFont, description
  AND  categories MUST include at least: modern, classic, playful, minimal, bold
  AND  getFontPairing('modern-clean') MUST return the correct pairing object
```

### AC-14: Google Fonts Loader Updated

```gherkin
GIVEN  a site with fontPairingId='bold-impact' (Oswald + Source Sans 3)
WHEN   GoogleFontsLoader renders
THEN   it MUST generate a Google Fonts URL including both 'Oswald' and 'Source+Sans+3'
  AND  it MUST include appropriate font weights (600-900 for heading, 300-500 for body)
  AND  fonts MUST be loaded via <link rel="stylesheet"> in the document head
```

### AC-15: No Visual Regression

```gherkin
GIVEN  a set of 5 representative existing sites (different siteTypes)
WHEN   rendered with the new theme system (resolveTheme filling defaults)
THEN   screenshot comparison MUST show < 1% pixel difference vs pre-upgrade
  AND  no layout shifts, no color changes, no font changes
```

---

## 14. Backward Compatibility — Derive Logic

### `resolveTheme()` function specification

```typescript
// src/lib/theme/resolve.ts
import type { ThemeConfig } from '@/blocks/types'
import { lightenHex } from './color-utils'

type PartialTheme = Partial<ThemeConfig> & {
    primaryColor?: string
    secondaryColor?: string
    colorMode?: 'light' | 'dark'
}

export function resolveTheme(raw: PartialTheme): ThemeConfig {
    const isDark = (raw.colorMode || 'dark') === 'dark'
    const pc = raw.primaryColor || '#0ea5e9'

    return {
        // Colors
        primaryColor:   pc,
        secondaryColor: raw.secondaryColor || '#d946ef',
        accentColor:    raw.accentColor    || lightenHex(pc, 15),
        surfaceColor:   raw.surfaceColor   || (isDark ? '#111111' : '#f8f8f8'),
        textColor:      raw.textColor      || (isDark ? '#fafafa' : '#09090b'),
        mutedColor:     raw.mutedColor     || (isDark ? '#a1a1aa' : '#71717a'),
        backgroundColor: raw.backgroundColor || (isDark ? '#09090b' : '#ffffff'),

        // Typography
        fontPairingId: raw.fontPairingId || null,
        fontHeading:   resolveFont(raw, 'heading'),
        fontBody:      resolveFont(raw, 'body'),

        // Spacing & Shape
        spacingPreset:  raw.spacingPreset  || 'default',
        borderRadius:   raw.borderRadius   || 'rounded',
        shadowPreset:   raw.shadowPreset   || 'subtle',

        // Mode
        colorMode: raw.colorMode || 'dark',
    }
}
```

### Derive Rules Summary

| Token | If missing, derive from... | Dark mode default | Light mode default |
|-------|---------------------------|-------------------|--------------------|
| `accentColor` | `lightenHex(primaryColor, 15)` | — | — |
| `surfaceColor` | `colorMode` | `#111111` | `#f8f8f8` |
| `textColor` | `colorMode` | `#fafafa` | `#09090b` |
| `mutedColor` | `colorMode` | `#a1a1aa` | `#71717a` |
| `backgroundColor` | `colorMode` | `#09090b` | `#ffffff` |
| `spacingPreset` | constant | `'default'` | `'default'` |
| `borderRadius` | constant (or Sites.ts DB) | `'rounded'` | `'rounded'` |
| `shadowPreset` | constant | `'subtle'` | `'subtle'` |
| `fontPairingId` | null (use fontHeading/fontBody) | — | — |

---

## 15. Non-Functional Requirements

| ID | Category | Requirement | Target | Notes |
|----|----------|-------------|--------|-------|
| NFR-01 | **Performance** | Adding CSS variables MUST NOT increase First Contentful Paint | +0ms (variables are in initial HTML) | No external fetch for tokens |
| NFR-02 | **Performance** | Google Fonts MUST be loaded with `font-display: swap` | FOUT < 200ms on 4G | Prevent invisible text flash |
| NFR-03 | **Bundle Size** | `pairings.ts` + `resolve.ts` combined | < 5KB gzipped | Static data, tree-shakeable |
| NFR-04 | **Type Safety** | All theme tokens MUST be typed — no `any`, no `as unknown` | 0 TypeScript errors on `tsc --noEmit` | Strict mode |
| NFR-05 | **Backward Compat** | 100% of existing sites MUST render identically after deploy | 0 visual regressions | Screenshot diff test |
| NFR-06 | **DX** | Block developers MUST be able to use tokens via `var(--token-name)` without importing anything | Self-documenting CSS vars | No JS import needed in blocks |
| NFR-07 | **Accessibility** | Text color MUST maintain WCAG AA contrast ratio (4.5:1) against surface color for all presets | WCAG 2.1 AA | Validate in resolve logic |

---

## 16. Phase Breakdown (5 days)

### Phase 1.1: Expand ThemeConfig + resolveTheme (2 days)

**Day 1:**
- [ ] Expand `ThemeConfig` type in `src/blocks/types.ts` (6 color tokens + spacing + shape)
- [ ] Update `ThemeConfigSchema` Zod validation with new fields and defaults
- [ ] Create `src/lib/theme/resolve.ts` with `resolveTheme()` function
- [ ] Create `src/lib/theme/color-utils.ts` with `lightenHex()`, `darkenHex()`
- [ ] Add new fields to `src/collections/Sites.ts` theme group
- [ ] Add DB migration to `scripts/db-setup.js` for new columns

**Day 2:**
- [ ] Update `SiteRenderer.tsx` to use `resolveTheme()` and inject 20+ CSS vars
- [ ] Update `SiteRendererProps` type to accept new theme fields
- [ ] Write unit tests for `resolveTheme()` (legacy input, full input, edge cases)
- [ ] Write unit tests for `color-utils.ts`
- [ ] Verify backward compat: existing site preview renders identically

### Phase 1.2: Font Pairings + Preview System (1 day)

**Day 3:**
- [ ] Create `src/lib/fonts/pairings.ts` with 20 curated pairings
- [ ] Create `FontPairing` type with id, name, category, headingFont, bodyFont, weights, description
- [ ] Export `getFontPairing()`, `getFontsByCategory()`, `getGoogleFontsUrl()`
- [ ] Create `src/components/fonts/FontPreview.tsx` component
- [ ] Update `GoogleFontsLoader.tsx` to support font pairing loading
- [ ] Write unit tests for font pairing functions
- [ ] Write component test for FontPreview

### Phase 1.3: Block Migration (2 days)

**Day 4 — High-impact blocks (15 files):**
- [ ] Migrate `hero/index.tsx` (15 `${pc}` occurrences)
- [ ] Migrate `contact/index.tsx` (15 occurrences)
- [ ] Migrate `feature-comparison/index.tsx` (7 occurrences)
- [ ] Migrate `navigation/index.tsx` (6 occurrences)
- [ ] Migrate `cta/index.tsx` (6 occurrences)
- [ ] Migrate `download-cta/index.tsx` (6 occurrences)
- [ ] Migrate `footer/index.tsx` (5 occurrences)
- [ ] Migrate `carousel/index.tsx` (5 occurrences)
- [ ] Migrate `pricing-table/index.tsx` (5 occurrences)
- [ ] Migrate `menu-food/index.tsx` (6 occurrences)
- [ ] Migrate `service-cards/index.tsx` (6 occurrences)
- [ ] Migrate `step-process/index.tsx` (6 occurrences)
- [ ] Migrate `shared/decorative.tsx` (update color parameter to use CSS var where possible)
- [ ] Update `shared/animations.tsx` (1 secondary color ref)
- [ ] Update `cart-widget/index.tsx` (1 secondary color ref)

**Day 5 — Remaining blocks (13 files) + verification:**
- [ ] Migrate remaining 13 block files with `${pc}` usage
- [ ] Replace hardcoded `rounded-*` classes with `var(--radius-*)` in theme-controlled elements
- [ ] Run full `grep` verification: 0 `${pc}` occurrences
- [ ] Run `tsc --noEmit` — 0 errors
- [ ] Run existing tests — 0 regressions
- [ ] Manual visual check: 3 sample sites (dark mode, light mode, custom colors)

---

## 17. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | **Block migration breaks existing styles** — removing `${pc}` inline and replacing with `var(--brand-primary)` may change rendering if CSS specificity differs | Medium | High | Write visual regression tests before migration. Compare screenshots before/after for 5 representative sites. Migrate one block at a time, not batch. |
| 2 | **Google Fonts loading regression** — adding new fonts to the loader may increase LCP or cause FOUT | Medium | Medium | Use `font-display: swap` + `<link rel="preconnect">`. Limit each pairing to max 3 weights. Measure LCP before/after with Lighthouse. |
| 3 | **DB migration fails on existing data** — adding new columns to Sites theme group may conflict with Payload pushDevSchema | Low | High | Use `ALTER TABLE ADD COLUMN IF NOT EXISTS` pattern in `db-setup.js`. Test migration locally and on staging before production. Never use DROP TABLE. |
| 4 | **AI Builder generates invalid new tokens** — OpenAI prompt needs updating to generate 6 colors instead of 2, may produce ugly palettes | Medium | Medium | Defer AI prompt update to Sprint 2. In Sprint 1, AI continues generating only primaryColor/secondaryColor; resolveTheme() fills the rest via derive logic. |
| 5 | **CSS variable performance in 42 blocks** — replacing inline styles with CSS vars changes how browsers compute styles | Low | Low | CSS custom properties are resolved once at `:root` level. No measurable perf impact per MDN benchmarks. Validate with Chrome DevTools Performance panel. |

---

## 18. Block Migration Strategy

### Migration pattern for each block

**Before** (inline `${pc}`):
```tsx
// hero/index.tsx
const pc = theme.primaryColor
// ...
style={{ background: `linear-gradient(135deg, ${pc}, ${pc}cc)` }}
style={{ border: `2px solid ${pc}50` }}
style={{ boxShadow: `0 8px 30px ${pc}35` }}
```

**After** (CSS var + helper):
```tsx
// hero/index.tsx
// No more: const pc = theme.primaryColor
// ...
style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-primary-light))` }}
style={{ border: `2px solid var(--brand-primary-border)` }}
style={{ boxShadow: `var(--shadow-lg)` }}
```

### Challenge: Alpha/opacity variants

Current blocks use `${pc}50` (hex + alpha suffix) extensively. CSS custom properties cannot be concatenated with alpha values directly. Solutions:

1. **Option A (Recommended):** Add opacity-variant CSS vars:
   ```css
   --brand-primary: #0ea5e9;
   --brand-primary-rgb: 14, 165, 233;  /* for rgba() usage */
   ```
   Block usage: `rgba(var(--brand-primary-rgb), 0.3)`

2. **Option B:** Use `color-mix()` (modern CSS, 95%+ browser support):
   ```css
   background: color-mix(in srgb, var(--brand-primary) 30%, transparent);
   ```

3. **Decision:** Use Option A (`--brand-primary-rgb`) for maximum compat. Add RGB variants for `primary`, `secondary`, and `accent` colors.

### Additional CSS vars for opacity patterns

```css
:root {
    /* RGB variants for rgba() usage in blocks */
    --brand-primary-rgb: 14, 165, 233;
    --brand-secondary-rgb: 217, 70, 239;
    --brand-accent-rgb: 245, 158, 11;
}
```

Usage in blocks:
```tsx
// Instead of: ${pc}50  (hex alpha)
// Use:       rgba(var(--brand-primary-rgb), 0.31)
style={{ border: `2px solid rgba(var(--brand-primary-rgb), 0.31)` }}
style={{ boxShadow: `0 8px 30px rgba(var(--brand-primary-rgb), 0.21)` }}
style={{ background: `rgba(var(--brand-primary-rgb), 0.05)` }}
```

---

## 19. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should we expose spacing/radius controls in the editor UI in Sprint 1 or defer to Sprint 2? | PM | Resolved: Defer to Sprint 2 |
| 2 | Should AI Builder prompt be updated now to generate 6 colors, or rely on derive logic? | PM | Resolved: Defer to Sprint 2, use derive logic |
| 3 | Do we need `color-mix()` fallbacks for Safari < 16.4? | Dev | Open — check analytics for Safari version distribution |
| 4 | Should fontPairingId override be allowed per-page or only site-wide? | PM | Resolved: Site-wide only for Sprint 1 |

---

## 20. Definition of Done

- [ ] ThemeConfig type expanded to 18 fields with Zod validation
- [ ] `resolveTheme()` correctly derives all missing tokens from legacy config
- [ ] SiteRenderer injects 20+ CSS custom properties including RGB variants
- [ ] 20 font pairings defined with metadata in `src/lib/fonts/pairings.ts`
- [ ] FontPreview component renders heading + body preview
- [ ] GoogleFontsLoader updated for pairing-based loading
- [ ] All 42 blocks migrated from `${pc}` to `var(--token)` (0 inline color refs)
- [ ] Hardcoded `rounded-*` replaced with `var(--radius-*)` in theme-controlled elements
- [ ] Sites.ts collection updated with new theme fields
- [ ] DB migration added to `scripts/db-setup.js`
- [ ] Unit tests: resolveTheme, color-utils, font pairings (>80% coverage)
- [ ] Visual regression: 5 sample sites render identically post-upgrade
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] `eslint` passes with 0 errors
- [ ] PR reviewed and approved
