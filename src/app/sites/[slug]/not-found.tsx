import Link from 'next/link'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { SiteRenderer, type SiteRendererProps, type NavPage } from '@/components/site-renderer/SiteRenderer'
import { I18nText } from '@/components/storefront/I18nText'

export const dynamic = 'force-dynamic'

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'

export default async function NotFound() {
    const headersList = await headers()

    // Attempt to extract tenant slug from request headers
    let tenantSlug = headersList.get('x-tenant-slug')

    // Fallback: parse from host header exactly like middleware does
    if (!tenantSlug) {
        const host = headersList.get('host') || ''
        const isSubdomain =
            host.endsWith(`.${PLATFORM_DOMAIN}`) &&
            host !== `www.${PLATFORM_DOMAIN}` &&
            host !== `admin.${PLATFORM_DOMAIN}`

        if (isSubdomain) {
            tenantSlug = host.replace(`.${PLATFORM_DOMAIN}`, '').split(':')[0]
        }
    }

    if (!tenantSlug) {
        return <Fallback404 />
    }

    const payload = await getPayload({ config })

    // Find tenant
    const tenantsResult = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: tenantSlug } },
        limit: 1,
    })
    const tenant = tenantsResult.docs[0]
    if (!tenant) return <Fallback404 />

    // Only show published sites to public visitors
    const sitesResult = await payload.find({
        collection: 'sites',
        where: {
            and: [
                { tenant: { equals: tenant.id } },
                { status: { equals: 'published' } },
            ],
        },
        limit: 1,
    })
    const site = sitesResult.docs[0]
    if (!site) return <Fallback404 />

    // Find 404 page — only published version for public visitors (BUG-F05-09)
    const pagesResult = await payload.find({
        collection: 'pages',
        where: {
            and: [
                { site: { equals: site.id } },
                {
                    or: [
                        { slug: { equals: '/404' } },
                        { slug: { equals: '404' } },
                    ]
                }
            ],
        },
        limit: 1,
        depth: 3,
    })
    const page404 = pagesResult.docs[0]

    const navigationPages = await payload.find({
        collection: 'pages',
        where: { site: { equals: site.id } },
        limit: 100,
        sort: 'createdAt',
    })

    // If 404 page exists WITH actual layout content, render it via SiteRenderer
    const layout = (page404 as Record<string, unknown> | undefined)?.layout as unknown[] | undefined
    if (page404 && Array.isArray(layout) && layout.length > 0) {
        return <SiteRenderer
            site={site as SiteRendererProps['site']}
            page={page404 as SiteRendererProps['page']}
            pages={navigationPages.docs as unknown as NavPage[]}
        />
    }

    // Themed 404: render with site's navigation + footer + centered 404 message
    // This covers: empty 404 page layout, missing 404 page, or any other fallback
    return (
        <SiteRenderer
            site={site as SiteRendererProps['site']}
            page={{
                id: 0,
                title: '404 — Page Not Found',
                slug: '404',
                layout: [
                    { blockType: 'hero', variant: 'centered', headline: '404', subheadline: 'Page Not Found — The page you are looking for does not exist or has been moved.' },
                ],
            } as SiteRendererProps['page']}
            pages={navigationPages.docs as unknown as NavPage[]}
        />
    )
}

function Fallback404() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
            <h1 style={{ fontSize: '3rem', margin: 0, fontWeight: 700 }}><I18nText render={t => t.storefront.notFound.code} /></h1>
            <p style={{ fontSize: '1.25rem', color: '#666', marginTop: '0.5rem' }}><I18nText render={t => t.storefront.notFound.title} /></p>
            <Link href="/" style={{ marginTop: '1.5rem', color: '#0ea5e9', textDecoration: 'none', fontWeight: 500, padding: '0.5rem 1rem', border: '1px solid #0ea5e9', borderRadius: '0.375rem' }}><I18nText render={t => t.storefront.notFound.backHome} /></Link>
        </div>
    )
}
