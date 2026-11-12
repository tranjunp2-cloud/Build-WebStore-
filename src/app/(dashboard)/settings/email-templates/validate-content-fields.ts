import type { ContentFields } from './actions'

/** Max character length per email-template content field. */
export const CONTENT_FIELD_LIMITS = {
    subject: 200,
    greeting: 500,
    ctaLabel: 100,
    closing: 2000,
} as const

/** Owner-facing field names used in validation messages (never raw schema keys). */
const FIELD_NAMES = {
    subject: 'Subject',
    greeting: 'Greeting',
    ctaLabel: 'Button label',
    closing: 'Closing',
} as const

/**
 * Validate per-field character limits for an email-template content block.
 * Returns a human-readable error on the first violation, or `null` when all fields pass.
 * `language` is the content language shown to the shop owner (e.g. "English", "Malay").
 *
 * Guards each field with `typeof === 'string'` because Payload persists unset
 * group/text fields as `null` (not `undefined`). A bare `!== undefined` check
 * lets `null` through and crashes on `null.length` when an existing config row
 * (with blank fields stored as null) is re-saved.
 */
export function validateContentFields(fields: ContentFields, language: string): string | null {
    for (const key of Object.keys(FIELD_NAMES) as (keyof typeof FIELD_NAMES)[]) {
        const value = fields[key]
        if (typeof value === 'string' && value.length > CONTENT_FIELD_LIMITS[key]) {
            return `${FIELD_NAMES[key]} (${language}) can be at most ${CONTENT_FIELD_LIMITS[key]} characters`
        }
    }
    return null
}
