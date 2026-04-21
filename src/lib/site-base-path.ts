import { headers } from 'next/headers'

/**
 * Returns the URL prefix that storefront <Link> hrefs must use so that the
 * address bar stays clean on deployed sites while still working on local dev.
 *
 * - local direct access (`localhost:3000/sites/<slug>/...`) → `/sites/<slug>`
 * - subdomain (`<slug>.primeweb.app`) and custom domain → `''`
 *
 * The `x-tenant-type` header is set by `src/middleware.ts`.
 */
export async function getSiteBasePath(slug: string): Promise<string> {
    const h = await headers()
    const type = h.get('x-tenant-type')
    if (type === 'subdomain' || type === 'custom-domain') return ''
    return `/sites/${slug}`
}
