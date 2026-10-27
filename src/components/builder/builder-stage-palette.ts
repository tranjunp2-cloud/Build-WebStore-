import type { ThemeConfig } from '@/blocks/types'
import { resolveTheme } from '@/lib/theme/resolve'

/** Colours and fonts from the generated theme, used to paint the generating-panel wireframes. */
export interface StagePalette {
    background: string
    surface: string
    text: string
    muted: string
    primary: string
    secondary: string
    accent: string
    footer: string
    headingFont: string
    bodyFont: string
    dark: boolean
    swatches: string[]
}

export function getStagePalette(theme: ThemeConfig | null): StagePalette | null {
    if (!theme) return null
    const resolved = resolveTheme(theme)
    const dark = resolved.colorMode === 'dark'
    return {
        background: resolved.backgroundColor,
        surface: resolved.surfaceColor,
        text: resolved.textColor,
        muted: resolved.mutedColor,
        primary: resolved.primaryColor,
        secondary: resolved.secondaryColor,
        accent: resolved.accentColor,
        footer: dark ? resolved.surfaceColor : resolved.textColor,
        headingFont: resolved.fontHeading,
        bodyFont: resolved.fontBody,
        dark,
        swatches: [resolved.primaryColor, resolved.secondaryColor, resolved.accentColor, resolved.surfaceColor, resolved.textColor],
    }
}

/** `color` at `percent`% opacity (works for any CSS colour string). */
export function fade(color: string, percent: number): string {
    return `color-mix(in srgb, ${color} ${percent}%, transparent)`
}

export function fontStack(font: string, fallback: 'serif' | 'sans-serif' = 'sans-serif'): string {
    return `'${font}', ${fallback === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif'}`
}
