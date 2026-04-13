import type { ThemeConfig } from '@/blocks/types'
import {
    getFontPairing,
    validateFontPairing,
    fontNameToCSSVar,
} from '@/lib/fonts/pairings'
import { generatePalette, validateThemeColors } from './color-utils'

// ── Hex Color Manipulation Helpers ──────────────────────────────────────────

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

function isValidHex(hex: string): boolean {
    return HEX_REGEX.test(hex)
}

export function hexToHSL(hex: string): { h: number; s: number; l: number } {
    if (!isValidHex(hex)) return { h: 0, s: 0, l: 50 }

    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2

    if (max === min) return { h: 0, s: 0, l: l * 100 }

    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    let h = 0
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6

    return { h: h * 360, s: s * 100, l: l * 100 }
}

export function hslToHex(h: number, s: number, l: number): string {
    h = ((h % 360) + 360) % 360
    s = Math.max(0, Math.min(100, s)) / 100
    l = Math.max(0, Math.min(100, l)) / 100

    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => {
        const k = (n + h / 30) % 12
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
        return Math.round(255 * Math.max(0, Math.min(1, color)))
            .toString(16)
            .padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
}

export function lightenHex(hex: string, percent: number): string {
    if (!isValidHex(hex)) return hex
    const hsl = hexToHSL(hex)
    const newL = Math.min(100, hsl.l + percent)
    return hslToHex(hsl.h, hsl.s, newL)
}

// ── Spacing Presets ─────────────────────────────────────────────────────────

export const SPACING_PRESETS = {
    compact: { xs: '0.125rem', sm: '0.25rem', md: '0.5rem', lg: '1rem', xl: '1.5rem', '2xl': '2.5rem', section: '3rem' },
    default: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2.5rem', '2xl': '4rem', section: '5rem' },
    relaxed: { xs: '0.375rem', sm: '0.75rem', md: '1.5rem', lg: '2rem', xl: '3.5rem', '2xl': '6rem', section: '7rem' },
} as const

// ── Border Radius Presets ───────────────────────────────────────────────────

export const RADIUS_PRESETS = {
    sharp: { sm: '0', md: '0', lg: '0', full: '0' },
    subtle: { sm: '2px', md: '4px', lg: '8px', full: '9999px' },
    rounded: { sm: '4px', md: '8px', lg: '16px', full: '9999px' },
    soft: { sm: '8px', md: '16px', lg: '24px', full: '9999px' },
    pill: { sm: '9999px', md: '9999px', lg: '9999px', full: '9999px' },
} as const

// ── Shadow Presets ──────────────────────────────────────────────────────────

export const SHADOW_PRESETS = {
    none: { sm: 'none', md: 'none', lg: 'none' },
    subtle: { sm: '0 1px 2px rgba(0,0,0,0.05)', md: '0 2px 8px rgba(0,0,0,0.08)', lg: '0 4px 16px rgba(0,0,0,0.1)' },
    medium: { sm: '0 1px 3px rgba(0,0,0,0.1)', md: '0 4px 12px rgba(0,0,0,0.15)', lg: '0 8px 30px rgba(0,0,0,0.2)' },
    dramatic: { sm: '0 2px 4px rgba(0,0,0,0.15)', md: '0 8px 24px rgba(0,0,0,0.2)', lg: '0 16px 48px rgba(0,0,0,0.3)' },
} as const

// ── Font Resolution Helpers ─────────────────────────────────────────────────

function resolveHeadingFont(pairingId: string | null | undefined): string {
    if (!pairingId) return 'Outfit'
    const pairing = getFontPairing(pairingId)
    return pairing?.headingFont || 'Outfit'
}

function resolveBodyFont(pairingId: string | null | undefined): string {
    if (!pairingId) return 'Inter'
    const pairing = getFontPairing(pairingId)
    return pairing?.bodyFont || 'Inter'
}

// ── Theme Resolver ──────────────────────────────────────────────────────────
// Resolves a partial theme (from DB with missing fields) into a full ThemeConfig.
// Backward compatible: existing sites with only primaryColor + secondaryColor work identically.

const DEFAULT_HEADING_FONT = 'Outfit'
const DEFAULT_BODY_FONT = 'Inter'

export function resolveTheme(
    partial: Partial<ThemeConfig> & { primaryColor?: string; colorMode?: 'light' | 'dark' },
): ThemeConfig {
    const colorMode = partial.colorMode || 'dark'
    const isDark = colorMode === 'dark'
    const primaryColor = partial.primaryColor || '#0ea5e9'

    // Resolve font pair (pairingId → lookup, fallback to partial overrides)
    let fontHeading = partial.fontHeading || resolveHeadingFont(partial.fontPairingId)
    let fontBody = partial.fontBody || resolveBodyFont(partial.fontPairingId)

    // Phase 02: validate contrast axis — reject same-font pairs silently.
    // Fallback to safe default (Outfit + Inter) + warn. Never throw.
    const validation = validateFontPairing(fontHeading, fontBody)
    if (!validation.valid) {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn(
                `[design-quality] invalid font pairing "${fontHeading} + ${fontBody}": ${validation.reason}. Falling back to ${DEFAULT_HEADING_FONT} + ${DEFAULT_BODY_FONT}.`,
            )
        }
        fontHeading = DEFAULT_HEADING_FONT
        fontBody = DEFAULT_BODY_FONT
    }

    const resolved: ThemeConfig = {
        primaryColor,
        secondaryColor: partial.secondaryColor || '#d946ef',
        accentColor: partial.accentColor || lightenHex(primaryColor, 15),
        surfaceColor: partial.surfaceColor || (isDark ? '#111111' : '#f8f8f8'),
        textColor: partial.textColor || (isDark ? '#fafafa' : '#09090b'),
        mutedColor: partial.mutedColor || (isDark ? '#a1a1aa' : '#71717a'),

        fontPairingId: partial.fontPairingId ?? null,
        fontHeading,
        fontBody,

        spacingPreset: partial.spacingPreset || 'default',
        borderRadius: partial.borderRadius || 'rounded',
        shadowPreset: partial.shadowPreset || 'subtle',

        colorMode,
        backgroundColor: partial.backgroundColor || (isDark ? '#09090b' : '#ffffff'),
    }

    // Phase 03: non-blocking design-quality warnings (pure black text, etc.)
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        const warnings = validateThemeColors({
            textColor: resolved.textColor,
            backgroundColor: resolved.backgroundColor,
            primaryColor: resolved.primaryColor,
        })
        for (const w of warnings) console.warn(w)
    }

    return resolved
}

// ── CSS Custom Properties Generator ─────────────────────────────────────────

function hexToRGB(hex: string): string {
    if (!isValidHex(hex)) return '0, 0, 0'
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `${r}, ${g}, ${b}`
}

export function generateThemeCSS(theme: ThemeConfig): string {
    try {
        const spacing = SPACING_PRESETS[theme.spacingPreset] || SPACING_PRESETS.default
        const radius = RADIUS_PRESETS[theme.borderRadius] || RADIUS_PRESETS.rounded
        const shadow = SHADOW_PRESETS[theme.shadowPreset] || SHADOW_PRESETS.subtle

        // Phase 03 — Semantic palette (60-30-10) computed from brand + mode.
        // Emitted alongside legacy --brand-* vars so blocks can migrate
        // incrementally in Phase 05 without any breaking change.
        const palette = generatePalette(
            theme.primaryColor || '#0ea5e9',
            theme.colorMode || 'dark',
        )

        return `:root {
  /* Colors (legacy brand vars — preserved for backward compat) */
  --brand-primary: ${theme.primaryColor || '#0ea5e9'};
  --brand-secondary: ${theme.secondaryColor || '#d946ef'};
  --brand-accent: ${theme.accentColor || '#f59e0b'};
  --surface: ${theme.surfaceColor || '#f8f8f8'};
  --text: ${theme.textColor || '#09090b'};
  --muted: ${theme.mutedColor || '#71717a'};
  --background: ${theme.backgroundColor || '#ffffff'};

  /* RGB variants for opacity */
  --brand-primary-rgb: ${hexToRGB(theme.primaryColor || '#0ea5e9')};
  --brand-secondary-rgb: ${hexToRGB(theme.secondaryColor || '#d946ef')};
  --brand-accent-rgb: ${hexToRGB(theme.accentColor || '#f59e0b')};

  /* Semantic color layer (Phase 03 — 60-30-10) */
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

  /* Typography — references next/font scoped vars from AppShell.tsx */
  --font-heading: ${fontNameToCSSVar(theme.fontHeading || 'Outfit', 'heading')};
  --font-body: ${fontNameToCSSVar(theme.fontBody || 'Inter', 'body')};

  /* Spacing */
  --space-xs: ${spacing.xs};
  --space-sm: ${spacing.sm};
  --space-md: ${spacing.md};
  --space-lg: ${spacing.lg};
  --space-xl: ${spacing.xl};
  --space-2xl: ${spacing['2xl']};
  --section-padding: ${spacing.section};

  /* Shape */
  --radius-sm: ${radius.sm};
  --radius-md: ${radius.md};
  --radius-lg: ${radius.lg};
  --radius-full: ${radius.full};
  --shadow-sm: ${shadow.sm};
  --shadow-md: ${shadow.md};
  --shadow-lg: ${shadow.lg};
}`
    } catch {
        // Fallback CSS — prevents blank page on corrupted theme data.
        // Fonts reference the always-loaded next/font vars from AppShell.tsx.
        // Semantic layer uses static dark-mode values as safe defaults.
        return `:root {
  --brand-primary: #0ea5e9; --brand-secondary: #d946ef; --brand-accent: #f59e0b;
  --surface: #f8f8f8; --text: #09090b; --muted: #71717a; --background: #ffffff;
  --brand-primary-rgb: 14, 165, 233; --brand-secondary-rgb: 217, 70, 239; --brand-accent-rgb: 245, 158, 11;
  --accent: #0ea5e9; --accent-hover: #0284c7; --accent-rgb: 14, 165, 233;
  --surface-primary: #0f1114; --surface-secondary: #16181c; --surface-card: #1d2026;
  --text-primary: #f6f8fa; --text-secondary: #a1a9b3; --text-inverse: #0f1114; --text-muted: #71797f;
  --border-semantic: #2a2e34; --divider: #22262b;
  --font-heading: var(--font-outfit), 'Outfit', sans-serif;
  --font-body: var(--font-inter), 'Inter', sans-serif;
  --space-xs: 0.25rem; --space-sm: 0.5rem; --space-md: 1rem; --space-lg: 1.5rem;
  --space-xl: 2.5rem; --space-2xl: 4rem; --section-padding: 5rem;
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 16px; --radius-full: 9999px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05); --shadow-md: 0 2px 8px rgba(0,0,0,0.08); --shadow-lg: 0 4px 16px rgba(0,0,0,0.1);
}`
    }
}

// ── CSS Var Constants (for blocks to import) ───────────────────────────────
// Use these instead of raw strings to prevent typos (Scenario #25)

export const CSS_VARS = {
    // Colors — legacy brand (kept for backward compat with 60+ file consumers)
    primary: 'var(--brand-primary, #0ea5e9)',
    secondary: 'var(--brand-secondary, #d946ef)',
    brandAccent: 'var(--brand-accent, #f59e0b)',
    surface: 'var(--surface, #f8f8f8)',
    text: 'var(--text, #09090b)',
    muted: 'var(--muted, #71717a)',
    background: 'var(--background, #ffffff)',
    // RGB (for opacity) — legacy brand
    primaryRgb: 'var(--brand-primary-rgb, 14, 165, 233)',
    secondaryRgb: 'var(--brand-secondary-rgb, 217, 70, 239)',
    brandAccentRgb: 'var(--brand-accent-rgb, 245, 158, 11)',
    // Typography — --font-heading/--font-body are populated by generateThemeCSS
    // with var(--font-<pairing>) references, falling back to --font-outfit/inter.
    fontHeading: 'var(--font-heading, var(--font-outfit))',
    fontBody: 'var(--font-body, var(--font-inter))',
    // Spacing
    spaceXs: 'var(--space-xs, 0.25rem)',
    spaceSm: 'var(--space-sm, 0.5rem)',
    spaceMd: 'var(--space-md, 1rem)',
    spaceLg: 'var(--space-lg, 1.5rem)',
    spaceXl: 'var(--space-xl, 2.5rem)',
    space2xl: 'var(--space-2xl, 4rem)',
    sectionPadding: 'var(--section-padding, 5rem)',
    // Shape
    radiusSm: 'var(--radius-sm, 4px)',
    radiusMd: 'var(--radius-md, 8px)',
    radiusLg: 'var(--radius-lg, 16px)',
    radiusFull: 'var(--radius-full, 9999px)',
    shadowSm: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
    shadowMd: 'var(--shadow-md, 0 2px 8px rgba(0,0,0,0.08))',
    shadowLg: 'var(--shadow-lg, 0 4px 16px rgba(0,0,0,0.1))',

    // ── Semantic layer (Phase 03 — 60-30-10) ────────────────────────────
    // Added alongside legacy vars. Fallback chain keeps pre-Phase-03 sites
    // working until blocks migrate in Phase 05.
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
    borderSemantic: 'var(--border-semantic, #2a2e34)',
    divider: 'var(--divider, var(--border-semantic, #22262b))',
} as const
