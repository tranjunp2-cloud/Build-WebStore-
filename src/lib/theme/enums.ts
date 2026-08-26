/**
 * Single source of truth for theme enum values.
 * Consumed by:
 *  - `src/collections/Sites.ts`                (fontHeading/fontBody select options)
 *  - `src/app/api/sites/[siteId]/save/route.ts` (runtime validation via Set<string>)
 *  - `src/app/api/ai/edit-block/route.ts`      (AI system prompt constraints)
 */
export const THEME_ENUMS = {
    fontHeading: ['Outfit', 'Inter', 'Playfair Display', 'DM Sans', 'Poppins', 'Raleway'] as const,
    fontBody: ['Inter', 'DM Sans', 'Lato', 'Open Sans', 'Nunito'] as const,
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
