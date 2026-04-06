import type { ThemeConfig } from '@/blocks/types'
import { getFontPairing } from '@/lib/fonts/pairings'

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

export function resolveTheme(
    partial: Partial<ThemeConfig> & { primaryColor?: string; colorMode?: 'light' | 'dark' },
): ThemeConfig {
    const colorMode = partial.colorMode || 'dark'
    const isDark = colorMode === 'dark'
    const primaryColor = partial.primaryColor || '#0ea5e9'

    return {
        primaryColor,
        secondaryColor: partial.secondaryColor || '#d946ef',
        accentColor: partial.accentColor || lightenHex(primaryColor, 15),
        surfaceColor: partial.surfaceColor || (isDark ? '#111111' : '#f8f8f8'),
        textColor: partial.textColor || (isDark ? '#fafafa' : '#09090b'),
        mutedColor: partial.mutedColor || (isDark ? '#a1a1aa' : '#71717a'),

        fontPairingId: partial.fontPairingId ?? null,
        fontHeading: partial.fontHeading || resolveHeadingFont(partial.fontPairingId),
        fontBody: partial.fontBody || resolveBodyFont(partial.fontPairingId),

        spacingPreset: partial.spacingPreset || 'default',
        borderRadius: partial.borderRadius || 'rounded',
        shadowPreset: partial.shadowPreset || 'subtle',

        colorMode,
        backgroundColor: partial.backgroundColor || (isDark ? '#09090b' : '#ffffff'),
    }
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
    const spacing = SPACING_PRESETS[theme.spacingPreset]
    const radius = RADIUS_PRESETS[theme.borderRadius]
    const shadow = SHADOW_PRESETS[theme.shadowPreset]

    return `:root {
  /* Colors */
  --brand-primary: ${theme.primaryColor};
  --brand-secondary: ${theme.secondaryColor};
  --brand-accent: ${theme.accentColor};
  --surface: ${theme.surfaceColor};
  --text: ${theme.textColor};
  --muted: ${theme.mutedColor};
  --background: ${theme.backgroundColor};

  /* RGB variants for opacity */
  --brand-primary-rgb: ${hexToRGB(theme.primaryColor)};
  --brand-secondary-rgb: ${hexToRGB(theme.secondaryColor)};
  --brand-accent-rgb: ${hexToRGB(theme.accentColor)};

  /* Typography */
  --font-heading: '${theme.fontHeading}', sans-serif;
  --font-body: '${theme.fontBody}', sans-serif;

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
}
