import type { Payload } from 'payload'

/**
 * Convert business name to DNS-safe slug.
 * - Strips diacritics (Vietnamese, accented chars)
 * - Removes non-alphanumeric chars (except hyphens)
 * - Enforces 3-63 chars (DNS label spec)
 */
export function slugify(name: string): string {
    const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip diacritics
        .replace(/[^a-z0-9\s-]/g, '')    // remove special chars
        .trim()
        .replace(/\s+/g, '-')            // spaces → hyphens
        .replace(/-+/g, '-')             // collapse multiple hyphens
        .replace(/^-|-$/g, '')           // trim leading/trailing hyphens
        .slice(0, 63)                    // DNS label max

    // Fallback if empty (emoji-only, pure symbols, etc.)
    return slug.length >= 3 ? slug : 'my-store'
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
): Promise<string> {
    let candidate = baseSlug

    for (let i = 0; i <= maxRetries; i++) {
        const existing = await payload.find({
            collection: 'tenants',
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
