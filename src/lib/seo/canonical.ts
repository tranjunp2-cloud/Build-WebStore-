type CustomDomain = { domain?: string; status?: string; isPrimary?: boolean }
export type TenantLike = { slug?: string; customDomains?: CustomDomain[] | null }

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
    const primary = domains.find(d => d?.isPrimary === true && d?.status === 'active' && !!d?.domain)
    if (primary?.domain) return `https://${primary.domain}`
    if (opts?.fallbackHostname) return `https://${opts.fallbackHostname}`
    const root = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'
    const sub = tenant?.slug || (opts?.slug && opts.slug !== 'custom' ? opts.slug : '')
    return sub ? `https://${sub}.${root}` : ''
}
