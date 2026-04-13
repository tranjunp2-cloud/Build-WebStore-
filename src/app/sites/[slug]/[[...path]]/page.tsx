import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth'
import config from '@payload-config'
import type { Metadata } from 'next'
import { SiteRenderer, type NavPage } from '@/components/site-renderer/SiteRenderer'
import { MaintenancePage } from '@/components/site-renderer/MaintenancePage'
import type { SiteData } from '@/blocks/types'
import type { PageData } from '@/store/editorStore'

// Force dynamic — uses getPayload() + SiteRenderer (jsdom chain) at runtime
export const dynamic = 'force-dynamic'

type Props = {
    params: Promise<{ slug: string; path?: string[] }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function getTenantAndPage(slug: string, pagePath: string) {
    const reqHeaders = await headers()
    const payload = await getPayload({ config })
    const user = await getCurrentUser()

    let tenant;

    /* REQ-F19: Resolve custom domain route */
    if (slug === 'custom') {
        const hostname = reqHeaders.get('x-tenant-hostname')
        if (!hostname) return null
        
        const tenantsResult = await payload.find({
            collection: 'tenants',
            where: { 'customDomains.domain': { equals: hostname } },
            limit: 1,
        })
        tenant = tenantsResult.docs[0]
    } else {
        // Find tenant by subdomain slug
        const tenantsResult = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: slug } },
            limit: 1,
        })
        tenant = tenantsResult.docs[0]
    }

    if (!tenant) return null

    // Find the site for this tenant
    const sitesResult = await payload.find({
        collection: 'sites',
        where: { tenant: { equals: tenant.id } },
        limit: 1,
    })

    const site = sitesResult.docs[0]
    if (!site) return null

    // Require authentication to view draft sites
    if (site.status === 'draft') {
        interface TenantRef {
            tenant: string | number | { id: string | number }
        }

        const isOwner = !!user && (user.tenants?.map((t: TenantRef) =>
            typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
        ) ?? []).includes(String(tenant.id))

        if (!isOwner) {
            // AC-3: Was published → maintenance mode (503); never published → 404
            if (site.publishedAt) {
                return { tenant, site, page: null, pages: [], maintenance: true }
            }
            return null // Never published → 404
        }
    }

    // Find the page by slug
    const pageSlug = pagePath === '' ? '/' : `/${pagePath}`
    const pagesResult = await payload.find({
        collection: 'pages',
        where: {
            and: [
                { site: { equals: site.id } },
                { slug: { equals: pageSlug } },
            ],
        },
        limit: 1,
        depth: 3, // Resolve media relationships
    })

    let page = pagesResult.docs[0]

    // Fallback: homepage may have slug 'home' (legacy) — match by isHomepage flag
    if (!page && pagePath === '') {
        const homepageFallback = await payload.find({
            collection: 'pages',
            where: {
                and: [
                    { site: { equals: site.id } },
                    { isHomepage: { equals: true } },
                ],
            },
            limit: 1,
            depth: 3,
        })
        page = homepageFallback.docs[0]
    }

    const navigationPages = await payload.find({
        collection: 'pages',
        where: {
            site: { equals: site.id },
        },
        limit: 100,
        sort: 'createdAt',
    })

    return { tenant, site, page, pages: navigationPages.docs }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, path } = await params
    const pagePath = (path ?? []).join('/')
    const data = await getTenantAndPage(slug, pagePath)

    if (!data) return { title: 'Not Found', robots: { index: false, follow: false } }
    if ('maintenance' in data && data.maintenance) {
        return { title: 'Maintenance', robots: { index: false, follow: false } }
    }

    const { site, page } = data
    const title = page?.seo?.title || site.seo?.metaTitle || site.name
    const description = page?.seo?.description || site.seo?.metaDescription

    // Resolve canonical URL from middleware-injected headers
    const reqHeaders = await headers()
    const tenantHostname = reqHeaders.get('x-tenant-hostname')
    const tenantSlug = reqHeaders.get('x-tenant-slug')
    const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'

    let baseUrl: string
    if (tenantHostname) {
        baseUrl = `https://${tenantHostname}`
    } else if (tenantSlug) {
        baseUrl = `https://${tenantSlug}.${PLATFORM_DOMAIN}`
    } else if (slug !== 'custom') {
        baseUrl = `https://${slug}.${PLATFORM_DOMAIN}`
    } else {
        baseUrl = ''
    }

    const canonicalPath = pagePath ? `/${pagePath}` : ''
    const canonical = baseUrl ? `${baseUrl}${canonicalPath}` : undefined

    return {
        title,
        description,
        alternates: canonical ? { canonical } : undefined,
        openGraph: {
            title: title ?? undefined,
            description: description ?? undefined,
            type: 'website',
            ...(canonical ? { url: canonical } : {}),
        },
        robots: page?.seo?.noIndex ? { index: false, follow: false } : undefined,
    }
}

export default async function TenantSitePage({ params }: Props) {
    const { slug, path } = await params
    const pagePath = (path ?? []).join('/')
    const data = await getTenantAndPage(slug, pagePath)

    if (!data) {
        notFound()
    }

    // AC-3: Maintenance mode — was published, now draft
    if ('maintenance' in data && data.maintenance) {
        return <MaintenancePage siteName={data.site?.name as string} />
    }

    if (!data.page) {
        notFound()
    }

    const { site, page, pages } = data

    return (
        <SiteRenderer
            site={site as unknown as SiteData}
            page={page as unknown as PageData}
            pages={pages as unknown as NavPage[]}
        />
    )
}
