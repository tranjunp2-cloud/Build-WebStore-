const VALID_HEADING_FONTS = new Set(['Outfit', 'Inter', 'Playfair Display', 'DM Sans', 'Poppins', 'Raleway', 'Plus Jakarta Sans'])
const VALID_BODY_FONTS = new Set(['Inter', 'DM Sans', 'Lato', 'Open Sans', 'Nunito', 'Poppins', 'Plus Jakarta Sans'])
const VALID_COLOR_MODES = new Set(['light', 'dark'])
const VALID_BORDER_RADIUS = new Set(['sharp', 'subtle', 'rounded', 'soft', 'pill'])
const VALID_SPACING = new Set(['compact', 'default', 'relaxed'])
const VALID_SHADOW = new Set(['none', 'subtle', 'medium', 'dramatic'])

/** The same complete template theme for the first preview frame and API persistence. */
export function buildTemplateTheme(defaultTheme?: Record<string, unknown> | null): Record<string, unknown> {
    const rawTheme = defaultTheme || {}
    const rawHeading = String(rawTheme.fontHeading || '')
    const rawBody = String(rawTheme.fontBody || '')
    const rawColorMode = String(rawTheme.colorMode || '')
    const templateTheme: Record<string, unknown> = {
        primaryColor: String(rawTheme.primaryColor || '#0ea5e9'),
        secondaryColor: String(rawTheme.secondaryColor || '#d946ef'),
        fontHeading: VALID_HEADING_FONTS.has(rawHeading) ? rawHeading : 'Outfit',
        fontBody: VALID_BODY_FONTS.has(rawBody) ? rawBody : 'Inter',
        colorMode: VALID_COLOR_MODES.has(rawColorMode) ? rawColorMode : 'dark',
    }
    if (rawTheme.backgroundColor) templateTheme.backgroundColor = String(rawTheme.backgroundColor)
    if (rawTheme.accentColor) templateTheme.accentColor = String(rawTheme.accentColor)
    if (rawTheme.surfaceColor) templateTheme.surfaceColor = String(rawTheme.surfaceColor)
    if (rawTheme.textColor) templateTheme.textColor = String(rawTheme.textColor)
    if (rawTheme.mutedColor) templateTheme.mutedColor = String(rawTheme.mutedColor)
    const rawBorderRadius = String(rawTheme.borderRadius || '')
    if (VALID_BORDER_RADIUS.has(rawBorderRadius)) templateTheme.borderRadius = rawBorderRadius
    const rawSpacing = String(rawTheme.spacingPreset || '')
    if (VALID_SPACING.has(rawSpacing)) templateTheme.spacingPreset = rawSpacing
    const rawShadow = String(rawTheme.shadowPreset || '')
    if (VALID_SHADOW.has(rawShadow)) templateTheme.shadowPreset = rawShadow
    return templateTheme
}
