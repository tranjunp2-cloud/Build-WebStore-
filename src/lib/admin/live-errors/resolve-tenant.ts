import 'server-only'

import type { LiveErrorTenantMatch } from './contracts'
import { sanitizeHost } from './sanitize-evidence'
import {
    getCachedTenantByDomain,
    getCachedTenantBySlug,
} from '@/lib/cache/tenant'

type TenantCandidate = {
    id: number | string
    slug?: string | null
    name?: string | null
    customDomains?: Array<{
        domain?: string | null
        status?: string | null
    }> | null
}

export type TenantLookup = {
    bySlug: (slug: string) => Promise<TenantCandidate | null>
    byDomain: (domain: string) => Promise<TenantCandidate | null>
}

const defaultLookup: TenantLookup = {
    bySlug: async slug => getCachedTenantBySlug(slug) as Promise<TenantCandidate | null>,
    byDomain: async domain => getCachedTenantByDomain(domain) as Promise<TenantCandidate | null>,
}

function safeTenant(candidate: TenantCandidate | null): LiveErrorTenantMatch | null {
    if (!candidate || !candidate.slug || !candidate.name) return null
    return {
        id: String(candidate.id),
        slug: candidate.slug,
        name: candidate.name,
    }
}

export async function resolveTenant(
    rawHost: string | null,
    lookup: TenantLookup = defaultLookup,
): Promise<LiveErrorTenantMatch | null> {
    const host = sanitizeHost(rawHost)
    if (!host) return null

    const platformDomain = sanitizeHost(
        process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app',
    )
    const platformSuffix = platformDomain ? `.${platformDomain}` : null

    if (
        platformDomain
        && platformSuffix
        && host.endsWith(platformSuffix)
        && host !== `www.${platformDomain}`
        && host !== `admin.${platformDomain}`
    ) {
        const slug = host.slice(0, -platformSuffix.length)
        if (!slug || slug.includes('.')) return null
        return safeTenant(await lookup.bySlug(slug))
    }

    const candidate = await lookup.byDomain(host)
    const activeMatch = candidate?.customDomains?.some(domain =>
        sanitizeHost(domain.domain) === host && domain.status === 'active',
    )
    return activeMatch ? safeTenant(candidate) : null
}
