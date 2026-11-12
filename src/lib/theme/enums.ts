/**
 * Single source of truth for theme enum values.
 * Consumed by:
 *  - `src/collections/Sites.ts`                (fontHeading/fontBody select options)
 *  - `src/lib/theme/sanitize-theme.ts`          (runtime validation via Set<string>: editor save + copilot theme edits)
 */
/**
 * Fonts the renderer loads (`src/lib/fonts/variables.ts`) and the template
 * presets use (`src/lib/fonts/pairings.ts`). Heading and body share one list so
 * applying a template never falls back to Outfit/Inter (GH-2419).
 * Keep in sync with the `enum_sites_theme_font_*` migrations in `scripts/db-setup.js`.
 */
export const THEME_FONTS = [
    'Outfit', 'Inter', 'Playfair Display', 'DM Sans', 'Poppins', 'Raleway', 'Lato', 'Open Sans', 'Nunito',
    'Archivo Black', 'Cormorant Garamond', 'DM Mono', 'Exo 2', 'Hind', 'Josefin Sans', 'Karla', 'Lora',
    'Manrope', 'Merriweather', 'Montserrat', 'Nunito Sans', 'Oswald', 'Proza Libre', 'Quicksand',
    'Rajdhani', 'Sora', 'Source Sans 3', 'Source Serif 4', 'Space Grotesk', 'Varela Round', 'Work Sans',
] as const

export const THEME_ENUMS = {
    fontHeading: THEME_FONTS,
    fontBody: THEME_FONTS,
    colorMode: ['light', 'dark'] as const,
    borderRadius: ['sharp', 'subtle', 'rounded', 'soft', 'pill'] as const,
    spacingPreset: ['compact', 'default', 'relaxed'] as const,
    shadowPreset: ['none', 'subtle', 'medium', 'dramatic'] as const,
} as const

/** Build { field: Set<validValue> } map for the save-route sanitizer. */
export function buildEnumSets(): Record<string, Set<string>> {
    const sets: Record<string, Set<string>> = {}
    for (const [key, values] of Object.entries(THEME_ENUMS)) {
        sets[key] = new Set(values)
    }
    return sets
}

/** Build prompt-friendly list for the AI system prompt. */
export function buildEnumPrompt(): string {
    return Object.entries(THEME_ENUMS)
        .map(([key, values]) => `- ${key}: ${values.map(v => `"${v}"`).join(' | ')}`)
        .join('\n')
}
