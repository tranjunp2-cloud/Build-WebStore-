/**
 * Build the public-facing URL for a storefront page.
 *
 * On local dev: /sites/{slug}{path} (Next.js route, served from localhost)
 * On staging / production: https://{slug}.{PLATFORM_DOMAIN}{path} (subdomain)
 *
 * Never use NEXT_PUBLIC_SERVER_URL + /sites/{slug} in non-local environments —
 * that path is the internal Next.js route and is not publicly routed on staging/prod.
 */
export function buildStorefrontUrl(slug: string, path = ''): string {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN
    const isLocal = serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1')

    if (!isLocal && platformDomain) {
        const proto = serverUrl.startsWith('https') ? 'https' : 'http'
        return `${proto}://${slug}.${platformDomain}${path}`
    }
    return `${serverUrl}/sites/${slug}${path}`
}
