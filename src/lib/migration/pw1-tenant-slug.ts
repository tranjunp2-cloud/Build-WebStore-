import { isReservedSlug, validateSlugFormat } from '@/lib/utils/reserved-slugs'

/** Preserve the PW1 hostname label; www custom domains use their next label. */
export function pw1SlugCandidate(websiteUrl: string, storeId: string, collision = 0): string {
    if (!/^\d+$/.test(storeId)) throw new Error('Invalid source store ID')
    const url = new URL(websiteUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid source website URL')
    const labels = url.hostname.toLowerCase().replace(/^www\./, '').split('.')
    const base = labels[0].replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/, '')
    if (!collision && !validateSlugFormat(base) && !isReservedSlug(base)) return base
    const suffix = `-${storeId}${collision > 1 ? `-${collision}` : ''}`
    const prefix = (base || 'store').slice(0, 63 - suffix.length).replace(/-+$/, '')
    const slug = `${/^\d+$/.test(prefix) ? 's' + prefix.slice(1) : prefix}${suffix}`
    if (validateSlugFormat(slug) || isReservedSlug(slug)) throw new Error('Cannot derive a valid source tenant slug')
    return slug
}

export async function selectPw1TenantSlug(websiteUrl: string, storeId: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
    for (let index = 0; index < 100; index++) {
        const slug = pw1SlugCandidate(websiteUrl, storeId, index)
        if (!await isTaken(slug)) return slug
    }
    throw new Error('Unable to allocate a unique source tenant slug')
}
