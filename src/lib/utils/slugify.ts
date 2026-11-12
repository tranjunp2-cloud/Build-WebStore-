import type { Payload, PayloadRequest } from 'payload'
import transliterateSlug from 'slugify'
import { romanizeCjk, stableSlugSuffix } from './slug-romanize'

/**
 * Convert business name to DNS-safe slug.
 * - Strips diacritics (Vietnamese, accented chars)
 * - Removes non-alphanumeric chars (except hyphens)
 * - Enforces 3-63 chars (DNS label spec)
 */
export function slugify(name: string): string {
    const normalizedName = name.normalize('NFKC').trim()
    const transliterated = transliterateSlug(romanizeCjk(normalizedName), {
        lower: true,
        strict: true,
        trim: true,
    }).slice(0, 63).replace(/-+$/g, '')

    if (transliterated.length >= 3) return transliterated

    const suffix = stableSlugSuffix(normalizedName || 'store')
    return transliterated ? `${transliterated}-${suffix}`.slice(0, 63) : `site-${suffix}`
}

/**
 * Generate a unique tenant slug, retrying with random suffix on collision.
 * Max 5 retries before falling back to store-{userId}.
 */
export async function ensureUniqueSlug(
    payload: Payload,
    baseSlug: string,
    userId?: number | string,
    maxRetries = 5,
    req?: Pick<PayloadRequest, 'transactionID'>,
): Promise<string> {
    let candidate = baseSlug

    for (let i = 0; i <= maxRetries; i++) {
        const existing = await payload.find({
            collection: 'tenants',
            req,
            where: { slug: { equals: candidate } },
            limit: 1,
        })

        if (existing.docs.length === 0) return candidate

        // Append random 3-char alphanumeric suffix
        const suffix = Math.random().toString(36).slice(2, 5)
        candidate = `${baseSlug}-${suffix}`
    }

    // Ultimate fallback
    return userId ? `store-${userId}` : `${baseSlug}-${Date.now().toString(36).slice(-4)}`
}
