import type { Payload } from 'payload'
import { pinyin } from 'pinyin-pro'
import transliterateSlug from 'slugify'
import { toRomaji } from 'wanakana'

function romanizeCjk(value: string): string {
    const hasKana = /[\u3040-\u30FF]/u.test(value)
    if (hasKana) {
        const separatedScripts = value
            .replace(/([\u3040-\u309F])([\u30A0-\u30FF])/gu, '$1 $2')
            .replace(/([\u30A0-\u30FF])([\u3040-\u309F])/gu, '$1 $2')
        return toRomaji(separatedScripts).replace(/([aeiou])\1+/gi, '$1')
    }

    if (/[\u3400-\u4DBF\u4E00-\u9FFF]/u.test(value)) {
        return pinyin(value, { toneType: 'none', type: 'array' }).join(' ')
    }

    return value
}

function stableSlugSuffix(value: string): string {
    let hash = 2166136261
    for (const char of value.normalize('NFKC')) {
        hash ^= char.codePointAt(0) ?? 0
        hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 7)
}

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
