/**
 * Color utilities — semantic palette generation for Plan B Phase 03.
 *
 * Pure functions. No side effects. Consumed by `generateThemeCSS()` in
 * resolve.ts to emit the semantic color layer (60-30-10 rule):
 *   - 60% neutral surface (surface-primary/secondary/card)
 *   - 30% subdued (text-secondary/muted, borders)
 *   - 10% accent (CTA only)
 *
 * This module is the single source of truth for color primitives (hex/HSL
 * conversion, contrast checking, palette generation). resolve.ts imports
 * and re-exports the low-level helpers for backward compatibility with
 * existing test files.
 *
 * Reference: plans/260412-2300-design-quality-rules/phase-03-color-system.md
 */

// ── Hex Validation ──────────────────────────────────────────────────────────

export const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

export function isValidHex(hex: string): boolean {
    return HEX_REGEX.test(hex)
}

/** Convert a #rrggbb string to "r, g, b" for use in rgba(). */
export function hexToRGBString(hex: string): string {
    if (!isValidHex(hex)) return '0, 0, 0'
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `${r}, ${g}, ${b}`
}

// ── HSL Conversion (moved from resolve.ts to break circular import) ────────

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

// ── Brand-Tinted Neutrals ───────────────────────────────────────────────────

/**
 * Generate a brand-tinted neutral — the hue is preserved but saturation drops
 * to near-zero so the result still reads as "neutral" with a brand whisper.
 *
 * Impeccable-style: very low chroma (we approximate with 6% saturation).
 *
 * @param brandHex Primary brand color hex (#rrggbb)
 * @param targetLightness 0-100 lightness value
 * @returns Tinted neutral hex
 */
export function tintNeutral(brandHex: string, targetLightness: number): string {
    if (!isValidHex(brandHex)) return '#f5f5f5'
    const { h } = hexToHSL(brandHex)
    const saturation = 6
    const lightness = Math.max(0, Math.min(100, targetLightness))
    return hslToHex(h, saturation, lightness)
}

/**
 * Brand-tinted "dark" text — never pure #000000. Keeps brand hue with mild
 * saturation and very dark lightness. Used for primary text in light mode
 * and inverse text in dark mode.
 */
export function brandTintedDark(brandHex: string): string {
    if (!isValidHex(brandHex)) return '#0f0f14'
    const { h } = hexToHSL(brandHex)
    return hslToHex(h, 20, 12)
}

/**
 * Brand-tinted "light" text — never pure #ffffff. Used for inverse text in
 * light mode and primary text in dark mode.
 */
export function brandTintedLight(brandHex: string): string {
    if (!isValidHex(brandHex)) return '#fafafa'
    const { h } = hexToHSL(brandHex)
    return hslToHex(h, 10, 97)
}

// ── Contrast Checking (WCAG 2.1) ────────────────────────────────────────────

/** Relative luminance per WCAG 2.1 formula. Returns 0 for invalid hex. */
export function relativeLuminance(hex: string): number {
    if (!isValidHex(hex)) return 0
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    const transform = (c: number) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b)
}

export type ContrastResult = {
    ratio: number         // rounded to 2 decimals
    passAA: boolean       // normal text — 4.5:1
    passAALarge: boolean  // large text (18pt+/14pt bold) — 3:1
    passAAA: boolean      // enhanced — 7:1
}

/**
 * Check WCAG 2.1 contrast ratio between foreground and background hex colors.
 * Returns ratio (2 decimals) and pass flags for AA / AA Large / AAA.
 *
 * Invalid hex inputs resolve to ratio 1.0 (same color) and all flags false.
 */
export function checkContrast(foreground: string, background: string): ContrastResult {
    if (!isValidHex(foreground) || !isValidHex(background)) {
        return { ratio: 1, passAA: false, passAALarge: false, passAAA: false }
    }
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

// ── Semantic Palette Generation ─────────────────────────────────────────────

export type SemanticPalette = {
    accent: string
    accentHover: string
    accentRgb: string
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
 * Generate a full 60-30-10 semantic palette from a brand color + color mode.
 *
 * Light mode:
 *   - Surface: near-white with brand hue whisper (99% → 93% lightness)
 *   - Text primary: brand-tinted dark (never #000)
 *   - Accent: brand color unchanged
 *
 * Dark mode:
 *   - Surface: near-black with brand hue whisper (8% → 16% lightness)
 *   - Text primary: brand-tinted light (never #fff)
 *   - Accent: brand color + brighter hover
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
                primary: tintNeutral(safePrimary, 8),
                secondary: tintNeutral(safePrimary, 12),
                card: tintNeutral(safePrimary, 16),
            },
            text: {
                primary: brandTintedLight(safePrimary),
                secondary: tintNeutral(safePrimary, 70),
                inverse: brandTintedDark(safePrimary),
                muted: tintNeutral(safePrimary, 55),
            },
            // L=42/44 ensures ≥3:1 contrast vs surface.primary (L=8) across all hues (WCAG AA-Large)
            border: tintNeutral(safePrimary, 44),
            divider: tintNeutral(safePrimary, 42),
        }
    }

    // light mode
    return {
        accent: safePrimary,
        accentHover: hslToHex(h, 75, 42),
        accentRgb: hexToRGBString(safePrimary),
        surface: {
            primary: tintNeutral(safePrimary, 99),
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

// ── Theme Color Validation ──────────────────────────────────────────────────

/**
 * Non-blocking validation of theme colors.
 * Returns warning messages for anti-patterns (pure black/white).
 * Used by resolveTheme() to log design-quality hints.
 */
export function validateThemeColors(theme: {
    textColor?: string
    backgroundColor?: string
    primaryColor?: string
}): string[] {
    const warnings: string[] = []

    if (theme.textColor === '#000000') {
        warnings.push('[design-quality] pure black text — use brandTintedDark() for a subtle brand hue')
    }
    if (theme.backgroundColor === '#000000') {
        warnings.push('[design-quality] pure black background — use tintNeutral() for a subtle brand hue')
    }
    if (theme.textColor === '#ffffff' && theme.backgroundColor === '#ffffff') {
        warnings.push('[design-quality] white on white — unreadable')
    }

    // Cross-check contrast if both provided
    if (theme.textColor && theme.backgroundColor) {
        const contrast = checkContrast(theme.textColor, theme.backgroundColor)
        if (!contrast.passAA) {
            warnings.push(
                `[design-quality] text contrast ${contrast.ratio}:1 fails WCAG AA (requires >= 4.5:1)`,
            )
        }
    }

    return warnings
}
