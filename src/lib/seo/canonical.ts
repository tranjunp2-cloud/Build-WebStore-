type CustomDomain = { domain?: string; status?: string; isPrimary?: boolean }
type TenantLike = { slug?: string; customDomains?: CustomDomain[] | null }

function normalizeDomain(value: string): string {
    return value.trim().toLowerCase().replace(/\.$/, '')
}

function isActiveDomain(domain: unknown): domain is CustomDomain & { domain: string } {
    if (!domain || typeof domain !== 'object') return false
    const candidate = domain as CustomDomain
    return candidate.status === 'active' && typeof candidate.domain === 'string' && Boolean(candidate.domain)
}

/**
 * Validate that a request hostname belongs to an activated tenant domain.
 * Domain records remain stored while pending/failed, so name matching alone
 * is not an authorization boundary for public custom-domain routes.
 */
export function hasActiveCustomDomain(
    tenant: unknown,
    hostname: string,
): boolean {
    const requestedDomain = normalizeDomain(hostname)
    if (!requestedDomain) return false
    if (!tenant || typeof tenant !== 'object' || !('customDomains' in tenant)) return false
    const domains = tenant.customDomains
    if (!Array.isArray(domains)) return false
    return domains.some(domain =>
        isActiveDomain(domain) && normalizeDomain(domain.domain) === requestedDomain,
    )
}

/**
 * Convert a stored content slug into a safe URL path without allowing dot
 * segments to escape the public content prefix. Query/fragment delimiters,
 * whitespace, Unicode, and control characters are percent-encoded per segment.
 */
export function encodePublicSlugPath(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const segments = value.trim().replace(/^\/+/, '').split('/').filter(Boolean)
    if (segments.length === 0 || segments.some(segment => segment === '.' || segment === '..')) return null
    return segments.map(segment => encodeURIComponent(segment)).join('/')
}

/**
 * Canonical public origin (https://host, NO trailing slash) for a tenant's
 * storefront. Prefers the designated primary active custom domain so canonical /
 * OG / sitemap URLs stay stable and don't split SEO signal across the subdomain
 * and a custom domain. Falls back to the request hostname (if provided), then to
 * the {slug}.{PLATFORM_DOMAIN} subdomain.
 */
export function resolveStorefrontOrigin(
    tenant: TenantLike | null | undefined,
    opts?: { fallbackHostname?: string | null; slug?: string },
): string {
    const domains = Array.isArray(tenant?.customDomains) ? tenant!.customDomains! : []
    const primary = domains.find(d => d?.isPrimary === true && isActiveDomain(d))
    if (primary?.domain) return `https://${primary.domain}`
    if (opts?.fallbackHostname) return `https://${opts.fallbackHostname}`
    const root = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'
    const sub = tenant?.slug || (opts?.slug && opts.slug !== 'custom' ? opts.slug : '')
    return sub ? `https://${sub}.${root}` : ''
}
