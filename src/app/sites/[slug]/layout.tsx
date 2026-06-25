import { headers } from 'next/headers'
import { getCachedTenantBySlug, getCachedTenantByDomain, getCachedSiteByTenant } from '@/lib/cache/tenant'
import { HtmlLang } from '@/components/site-renderer/html-lang'

/**
 * Storefront route-group layout. Resolves the site's locale (cached, so it
 * dedupes with the page's own lookups — no extra DB cost) and syncs <html lang>
 * via a client setter, so non-English sites emit the correct language signal.
 * Renders nothing else — pages keep full control of their own markup/metadata.
 */
export default async function StorefrontLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params

    let locale: string | null = null
    try {
        let tenant
        if (slug === 'custom') {
            const hostname = (await headers()).get('x-tenant-hostname') || ''
            tenant = hostname ? await getCachedTenantByDomain(hostname) : null
        } else {
            tenant = await getCachedTenantBySlug(slug)
        }
        if (tenant) {
            const site = await getCachedSiteByTenant(String(tenant.id))
            locale = (site as { locale?: string } | null)?.locale ?? null
        }
    } catch {
        // Best-effort — fall back to the root <html lang="en"> on any failure.
    }

    return (
        <>
            <HtmlLang locale={locale} />
            {children}
        </>
    )
}
