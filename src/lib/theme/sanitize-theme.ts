import { buildEnumSets } from './enums'

/** Only persist theme fields defined in the Sites collection schema.
 *  Extra keys (from AI or stale client state) are stripped so Payload
 *  does not throw a validation error (BUG-F05-025). */
export const ALLOWED_THEME_KEYS = new Set([
    'primaryColor', 'secondaryColor', 'backgroundColor',
    'fontHeading', 'fontBody', 'borderRadius', 'colorMode',
    'accentColor', 'surfaceColor', 'textColor', 'mutedColor',
    'spacingPreset', 'shadowPreset',
])

/** Valid enum values for select fields — strip invalid selections so
 *  Payload does not throw "This field has an invalid selection".
 *  Sourced from `@/lib/theme/enums` so save + AI prompt stay in sync. */
const SELECT_FIELD_VALUES: Record<string, Set<string>> = buildEnumSets()

export function sanitizeTheme(raw: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(raw)) {
        if (ALLOWED_THEME_KEYS.has(key) && value !== undefined && value !== null && value !== '') {
            // Validate select field values — drop invalid selections
            const validValues = SELECT_FIELD_VALUES[key]
            if (validValues && !validValues.has(String(value))) continue
            clean[key] = value
        }
    }
    return clean
}
