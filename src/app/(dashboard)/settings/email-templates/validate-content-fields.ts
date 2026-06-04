import type { ContentFields } from './actions'

/** Max character length per email-template content field. */
export const CONTENT_FIELD_LIMITS = {
    subject: 200,
    greeting: 500,
    ctaLabel: 100,
    closing: 2000,
} as const

/**
 * Validate per-field character limits for an email-template content block.
 * Returns an error string on the first violation, or `null` when all fields pass.
 *
 * Guards each field with `typeof === 'string'` because Payload persists unset
 * group/text fields as `null` (not `undefined`). A bare `!== undefined` check
 * lets `null` through and crashes on `null.length` when an existing config row
 * (with blank fields stored as null) is re-saved.
 */
export function validateContentFields(fields: ContentFields, label: string): string | null {
    if (typeof fields.subject === 'string' && fields.subject.length > CONTENT_FIELD_LIMITS.subject) {
        return `${label} subject exceeds ${CONTENT_FIELD_LIMITS.subject} characters`
    }
    if (typeof fields.greeting === 'string' && fields.greeting.length > CONTENT_FIELD_LIMITS.greeting) {
        return `${label} greeting exceeds ${CONTENT_FIELD_LIMITS.greeting} characters`
    }
    if (typeof fields.ctaLabel === 'string' && fields.ctaLabel.length > CONTENT_FIELD_LIMITS.ctaLabel) {
        return `${label} ctaLabel exceeds ${CONTENT_FIELD_LIMITS.ctaLabel} characters`
    }
    if (typeof fields.closing === 'string' && fields.closing.length > CONTENT_FIELD_LIMITS.closing) {
        return `${label} closing exceeds ${CONTENT_FIELD_LIMITS.closing} characters`
    }
    return null
}
