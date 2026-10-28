import { cookies, headers } from 'next/headers'
import { siteLanguagesOf, VISITOR_LANGUAGE_COOKIE, visitorLanguage } from '@/lib/site-languages'
import { getCachedTenantBySlug, getCachedTenantByDomain, getCachedSiteByTenant } from '@/lib/cache/tenant'
import { HtmlLang } from '@/components/site-renderer/html-lang'

/**
 * Storefront route-group layout. Resolves the language the page is served in (cached site lookup, so it
 * dedupes with the page's own lookups — no extra DB cost): the site's published primary language, or the
 * one a visitor chose in the language switcher. `Sites.locale` is not it — it only remembers the language last
 * viewed in the editor. Syncs <html lang> via a client setter, so the page's language signal matches its text.
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
            if (site) {
                const languages = siteLanguagesOf(site as Parameters<typeof siteLanguagesOf>[0], 'live')
                locale = visitorLanguage(languages, (await cookies()).get(VISITOR_LANGUAGE_COOKIE)?.value)
            }
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
