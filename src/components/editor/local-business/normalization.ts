import type { LocalBusinessData } from './types'

const SANITIZED_TEXT_FIELDS = [
    'streetAddress',
    'city',
    'postcode',
    'country',
    'serviceAreaDescription',
] as const

/** Match the server's LocalBusiness text normalization before queueing or comparing saves. */
export function sanitizeLocalBusinessText(value: string): string {
    return value.replace(/<[^>]*>/g, '').trim()
}

export function normalizeLocalBusinessSnapshot(value: LocalBusinessData): LocalBusinessData {
    const normalized: LocalBusinessData = { ...value }

    for (const field of SANITIZED_TEXT_FIELDS) {
        const fieldValue = normalized[field]
        if (typeof fieldValue === 'string') {
            normalized[field] = sanitizeLocalBusinessText(fieldValue)
        }
    }

    if (normalized.openingHours) {
        normalized.openingHours = normalized.openingHours.map(row => ({
            ...row,
            ...(typeof row.opens === 'string'
                ? { opens: sanitizeLocalBusinessText(row.opens) }
                : {}),
            ...(typeof row.closes === 'string'
                ? { closes: sanitizeLocalBusinessText(row.closes) }
                : {}),
        }))
    }

    return normalized
}
