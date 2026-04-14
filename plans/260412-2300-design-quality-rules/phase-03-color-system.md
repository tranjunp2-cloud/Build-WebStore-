# Phase 03: Color System (60-30-10) — Additive Semantic Layer

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (tokens), Phase 02 (typography + font CSS var fix)
- Priority: P1
- Status: pending
- Approach: **Option C — additive semantic layer** (validated 2026-04-13)
- Scout ref: `scout/scout-design-quality-scan.md` section 1 + 6

## Mục tiêu

Enforce 60-30-10 color distribution, contrast ratio WCAG AA, never pure black, brand-tinted neutrals, **add semantic color roles ALONGSIDE existing brand vars** — no codemod rename, no breaking change.

## Strategy Decision (from Option Analysis)

**Option A rejected** — Rename 496 legacy `--brand-*` usages triệt để had:
- Semantic mismatch (brand-secondary is a magenta brand color, NOT a neutral surface)
- High codemod risk (496 regex replaces across mixed patterns)
- Duplicate work with Phase 05 block audit
- Git blame wipe, review infeasibility, no rollback

**Option C chosen** — Additive layer:
- Legacy `--brand-*`, `--surface`, `--text`, `--muted`, `--background` untouched
- New semantic vars: `--accent`, `--accent-hover`, `--accent-rgb`, `--surface-primary/secondary/card`, `--text-primary/secondary/inverse/muted`, `--border`, `--divider`
- New vars **computed from brand colors**, not just aliased — real 60-30-10 palette
- `CSS_VARS` object gets new camelCase accessors (legacy accessors stay)
- Phase 05 block audit migrates consumers to semantic names naturally
- Rollback trivial (revert 1 commit)

## Key Insights

- Current palette: 3 brand colors + 4 utility vars = not enough semantic granularity
- 60-30-10 rule requires **3 surface levels** (not just 1) + 1 accent = 4 distinct roles
- "AI slop" problem: `bg-white text-black` looks sterile — brand-tinted neutrals fix this cheaply
- WCAG 2.1 AA: normal text ≥ 4.5:1, large text ≥ 3:1 — cần helper, không giả định user chọn
- Dark mode: invert surface/text, desaturate accent (avoid eye strain on CRTs/OLED)
- Phase 05 consumers: blocks refactor to `<SectionWrapper background="default|alternate|card">` which reads `--surface-*` semantic vars

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User theme config (primaryColor, secondaryColor, colorMode)│
└─────────────────────┬───────────────────────────────────────┘
                      │
                      v
         ┌────────────────────────────┐
         │ generatePalette()          │  ← NEW in color-utils.ts
         │ - tintNeutral(primary)     │
         │ - adjustForMode(mode)      │
         │ - checkContrast guardrails │
         └────────────┬───────────────┘
                      │
                      v
         ┌────────────────────────────┐
         │ generateThemeCSS()         │  ← EXTENDED
         │                            │
         │ :root {                    │
         │   /* Legacy (kept) */      │
         │   --brand-primary: #...    │
         │   --brand-secondary: #...  │
         │   --surface: #...          │
         │   ...                      │
         │                            │
         │   /* NEW Semantic Layer */ │
         │   --accent: #...           │
         │   --accent-hover: #...     │
         │   --accent-rgb: r, g, b    │
         │   --surface-primary: #...  │
         │   --surface-secondary: #..│
         │   --surface-card: #...     │
         │   --text-primary: #...     │
         │   --text-secondary: #...   │
         │   --text-inverse: #...     │
         │   --text-muted: #...       │
         │   --border: #...           │
         │   --divider: #...          │
         │ }                          │
         └────────────┬───────────────┘
                      │
                      v
    ┌─────────────────────────────────────────┐
    │  Consumers (now have 2 choices)         │
    │  - Legacy blocks: var(--brand-primary)  │
    │  - NEW SectionWrapper: var(--surface-*) │
    │  - Phase 05 refactor: migrate to new    │
    └─────────────────────────────────────────┘
```

## Related Code Files

- `src/lib/theme/resolve.ts` — `generateThemeCSS()`, `CSS_VARS` object (EXTEND)
- `src/lib/theme/color-utils.ts` — NEW file with `tintNeutral`, `checkContrast`, `generatePalette`, `adjustForMode`
- `src/blocks/types.ts` — `ThemeConfig` (may extend with optional `accentColor` resolver)
- `src/app/globals.css` — baseline root vars (add semantic fallbacks)
- `src/__tests__/unit/theme/color-utils.test.ts` — NEW tests

## Implementation Steps

### 3.1 Create `src/lib/theme/color-utils.ts`

```typescript
import { hexToHSL, hslToHex } from './resolve'

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

export function isValidHex(hex: string): boolean {
  return HEX_REGEX.test(hex)
}

/**
 * Generate brand-tinted neutral by taking brand hue, low saturation, target lightness.
 * Impeccable-style: chroma 0.005-0.015 (we approximate with saturation 5-8%).
 */
export function tintNeutral(brandHex: string, targetLightness: number): string {
  if (!isValidHex(brandHex)) return '#f5f5f5'
  const { h } = hexToHSL(brandHex)
  // Very low saturation keeps it "neutral" but with a hue whisper
  const saturation = 6
  const lightness = Math.max(0, Math.min(100, targetLightness))
  return hslToHex(h, saturation, lightness)
}

/**
 * Relative luminance per WCAG 2.1 — used for contrast ratio.
 */
function relativeLuminance(hex: string): number {
  if (!isValidHex(hex)) return 0
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const transform = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b)
}

export type ContrastResult = {
  ratio: number
  passAA: boolean       // normal text — 4.5:1
  passAALarge: boolean  // large text (18pt+/14pt bold) — 3:1
  passAAA: boolean      // enhanced — 7:1
}

export function checkContrast(foreground: string, background: string): ContrastResult {
  const l1 = relativeLuminance(foreground)
  const l2 = relativeLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  const ratio = (lighter + 0.05) / (darker + 0.05)
  return {
    ratio: Math.round(ratio * 100) / 100,
    passAA: ratio >= 4.5,
    passAALarge: ratio >= 3,
    passAAA: ratio >= 7,
  }
}

/**
 * Brand-tinted "dark" text — never pure #000000.
 * For light mode: lightness 10-15 preserving brand hue.
 */
export function brandTintedDark(brandHex: string): string {
  if (!isValidHex(brandHex)) return '#0f0f14'
  const { h } = hexToHSL(brandHex)
  return hslToHex(h, 20, 12) // hue + mild saturation + dark lightness
}

/**
 * Brand-tinted "light" text / inverse — never pure #ffffff.
 */
export function brandTintedLight(brandHex: string): string {
  if (!isValidHex(brandHex)) return '#fafafa'
  const { h } = hexToHSL(brandHex)
  return hslToHex(h, 10, 97)
}

export type SemanticPalette = {
  accent: string
  accentHover: string
  accentRgb: string          // "r, g, b" string for rgba() usage
  surface: {
    primary: string
    secondary: string
    card: string
  }
  text: {
    primary: string
    secondary: string
    inverse: string
    muted: string
  }
  border: string
  divider: string
}

/**
 * Generate full 60-30-10 semantic palette from brand + mode.
 * - 60% neutrals (surface-primary/secondary) tinted toward brand hue
 * - 30% cards/panels (surface-card) slightly different
 * - 10% accent (CTA only)
 */
export function generatePalette(
  primaryHex: string,
  mode: 'light' | 'dark',
): SemanticPalette {
  const safePrimary = isValidHex(primaryHex) ? primaryHex : '#0ea5e9'
  const { h } = hexToHSL(safePrimary)

  if (mode === 'dark') {
    return {
      accent: safePrimary,
      accentHover: hslToHex(h, 80, 55),
      accentRgb: hexToRGBString(safePrimary),
      surface: {
        primary: tintNeutral(safePrimary, 8),   // near-black with brand hint
        secondary: tintNeutral(safePrimary, 12),
        card: tintNeutral(safePrimary, 16),
      },
      text: {
        primary: brandTintedLight(safePrimary),
        secondary: tintNeutral(safePrimary, 70),
        inverse: brandTintedDark(safePrimary),
        muted: tintNeutral(safePrimary, 55),
      },
      border: tintNeutral(safePrimary, 22),
      divider: tintNeutral(safePrimary, 18),
    }
  }

  // light mode
  return {
    accent: safePrimary,
    accentHover: hslToHex(h, 75, 42),
    accentRgb: hexToRGBString(safePrimary),
    surface: {
      primary: tintNeutral(safePrimary, 99),    // almost-white with hue whisper
      secondary: tintNeutral(safePrimary, 96),
      card: tintNeutral(safePrimary, 93),
    },
    text: {
      primary: brandTintedDark(safePrimary),
      secondary: tintNeutral(safePrimary, 30),
      inverse: brandTintedLight(safePrimary),
      muted: tintNeutral(safePrimary, 45),
    },
    border: tintNeutral(safePrimary, 85),
    divider: tintNeutral(safePrimary, 90),
  }
}

function hexToRGBString(hex: string): string {
  if (!isValidHex(hex)) return '0, 0, 0'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}
```

### 3.2 Extend `generateThemeCSS()` in `resolve.ts`

Inside the try-block, after the existing `:root {}` content, append semantic vars:

```typescript
const palette = generatePalette(theme.primaryColor || '#0ea5e9', theme.colorMode)

return `:root {
  /* Legacy brand vars — kept for backward compat */
  --brand-primary: ${theme.primaryColor || '#0ea5e9'};
  --brand-secondary: ${theme.secondaryColor || '#d946ef'};
  ... (existing output unchanged)

  /* Semantic layer (Phase 03 — 60-30-10) */
  --accent: ${palette.accent};
  --accent-hover: ${palette.accentHover};
  --accent-rgb: ${palette.accentRgb};

  --surface-primary: ${palette.surface.primary};
  --surface-secondary: ${palette.surface.secondary};
  --surface-card: ${palette.surface.card};

  --text-primary: ${palette.text.primary};
  --text-secondary: ${palette.text.secondary};
  --text-inverse: ${palette.text.inverse};
  --text-muted: ${palette.text.muted};

  --border-semantic: ${palette.border};
  --divider: ${palette.divider};
}`
```

**Note on naming conflict:** legacy `--border` already exists in globals.css. To avoid ambiguity Phase 03 uses `--border-semantic` during transition; Phase 05 block audit switches to it. Later cleanup can alias `--border` → `--border-semantic`.

### 3.3 Extend `CSS_VARS` accessor object

Append (not replace) new keys to `CSS_VARS`:

```typescript
export const CSS_VARS = {
  // ... existing legacy keys preserved ...
  primary: 'var(--brand-primary, #0ea5e9)',
  secondary: 'var(--brand-secondary, #d946ef)',
  // ...

  // NEW semantic accessors (Phase 03)
  accent: 'var(--accent, var(--brand-primary))',
  accentHover: 'var(--accent-hover, var(--brand-primary))',
  accentRgb: 'var(--accent-rgb, var(--brand-primary-rgb))',
  surfacePrimary: 'var(--surface-primary, var(--surface))',
  surfaceSecondary: 'var(--surface-secondary, var(--surface))',
  surfaceCard: 'var(--surface-card, var(--surface))',
  textPrimary: 'var(--text-primary, var(--text))',
  textSecondary: 'var(--text-secondary, var(--muted))',
  textInverse: 'var(--text-inverse, #ffffff)',
  textMuted: 'var(--text-muted, var(--muted))',
  borderSemantic: 'var(--border-semantic, var(--border))',
  divider: 'var(--divider, var(--border))',
} as const
```

Existing 60+ file imports stay working because all legacy keys preserved.

### 3.4 Update `globals.css` baseline

Add semantic var fallbacks in `:root {}` so admin / non-theme contexts render:

```css
:root {
  /* ... existing legacy vars ... */

  /* Semantic fallbacks (dark baseline) */
  --accent: var(--brand-primary);
  --accent-hover: #d946ef;
  --surface-primary: var(--surface-1);
  --surface-secondary: var(--surface-2);
  --surface-card: var(--surface-3);
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-inverse: #09090b;
  --text-muted: #71717a;
  --border-semantic: var(--border);
  --divider: var(--border);
}
```

### 3.5 Anti-pattern color validation (optional Phase 03, defer to Phase 05 if tight)

```typescript
// src/lib/theme/color-utils.ts append
export function validateThemeColors(theme: { textColor?: string; backgroundColor?: string }): string[] {
  const warnings: string[] = []
  if (theme.textColor === '#000000') warnings.push('Pure black text — use brandTintedDark()')
  if (theme.backgroundColor === '#000000') warnings.push('Pure black background — use tintNeutral()')
  // extend with contrast check if both provided
  return warnings
}
```

Wire into `resolveTheme()` as non-blocking warn.

### 3.6 Update `SectionWrapper` `SECTION_BACKGROUND` token

Switch from legacy `--surface-1/2/3` to new semantic `--surface-primary/secondary/card`:

```typescript
// src/lib/design-tokens.ts
export const SECTION_BACKGROUND = {
    default: 'bg-[var(--surface-primary)]',
    alternate: 'bg-[var(--surface-secondary)]',
    accent: 'bg-[var(--surface-card)]',
    transparent: 'bg-transparent',
} as const
```

Update tests accordingly.

### 3.7 Tests

NEW `src/__tests__/unit/theme/color-utils.test.ts`:

```
- tintNeutral preserves hue, clamps lightness
- checkContrast WCAG AA boundary (4.5:1)
- checkContrast WCAG AA large boundary (3:1)
- checkContrast WCAG AAA boundary (7:1)
- checkContrast pure black on white = 21
- checkContrast same color = 1
- brandTintedDark never returns #000000
- brandTintedLight never returns #ffffff
- generatePalette light mode full shape
- generatePalette dark mode full shape
- generatePalette accent === primary input
- generatePalette text-primary passes AA against surface-primary
- validateThemeColors flags pure black text
```

Extend `src/__tests__/unit/theme/resolve-theme.test.ts`:

```
- generateThemeCSS output contains --accent
- generateThemeCSS output contains --surface-primary/secondary/card
- generateThemeCSS output contains --text-primary/secondary/inverse/muted
- legacy vars still present (backward compat)
- CSS_VARS object has both legacy and semantic keys
```

Extend `src/__tests__/unit/blocks/design-tokens.test.tsx`:

```
- SECTION_BACKGROUND now uses --surface-primary/secondary/card
- Token shape invariant still holds
```

## Todo

- [ ] Create `src/lib/theme/color-utils.ts` with tintNeutral, checkContrast, brandTintedDark/Light, generatePalette, validateThemeColors
- [ ] Extend `generateThemeCSS()` to emit 12 new semantic vars alongside legacy
- [ ] Extend `CSS_VARS` object with 12 new camelCase accessors (preserving legacy)
- [ ] Add semantic fallbacks to `src/app/globals.css` `:root {}`
- [ ] Update `SECTION_BACKGROUND` token in `design-tokens.ts` to consume new semantic vars
- [ ] Update `design-tokens.test.tsx` assertions for new bg var references
- [ ] Write `color-utils.test.ts` (~15 tests for helpers)
- [ ] Extend `resolve-theme.test.ts` for semantic CSS output (~5 tests)
- [ ] Typecheck + full test suite + build

## Success Criteria

- [ ] `generateThemeCSS()` outputs both legacy `--brand-*` AND new semantic vars
- [ ] `CSS_VARS` exports legacy + 12 new semantic accessors
- [ ] `checkContrast('#000', '#fff')` returns 21 (pass AAA)
- [ ] `tintNeutral('#0ea5e9', 95)` returns a near-white with sky-blue hue (s ≤ 10)
- [ ] `generatePalette` light mode output satisfies WCAG AA for text-primary on surface-primary
- [ ] `generatePalette` dark mode output satisfies WCAG AA
- [ ] No pure `#000000` or `#ffffff` in `brandTintedDark/Light` output
- [ ] SectionWrapper tests updated, still pass
- [ ] Full test suite 3803+ pass (no regression)
- [ ] `pnpm tsc --noEmit` = 0 errors
- [ ] `pnpm build` = success

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Color math bug (HSL round-trip loss) | Medium | Low | Boundary tests, hex round-trip invariant test |
| WCAG AA calculation off-by-one | Low | Medium | Test at exact 4.5, 3.0, 7.0 thresholds |
| globals.css override by block styles | Low | Low | `!important` not needed (cascade order OK) |
| Existing tests hardcode legacy CSS output string | Medium | Low | Run full suite, fix assertions that expect exact output |
| Phase 05 refactor forgets to migrate some blocks | Low | Low | Phase 05 checklist explicit: `--brand-*` usage OK during transition, tracked |

## Security Considerations

- Color math helpers operate on user-provided hex strings → validate format before parsing (`HEX_REGEX`)
- No eval / innerHTML / RCE surface
- CSS injection prevention: generated var values are simple hex/rgb strings, not interpolated HTML
- `generateThemeCSS()` already wraps in try/catch with safe fallback

## Next Steps

- Phase 04: Content validation wires into sanitizer + template composer
- Phase 05: Block audit migrates 47 blocks to consume semantic `--surface-*`, `--text-*`, `--accent` — legacy `--brand-*` usages become Phase 05 work item per block, not a blanket codemod
