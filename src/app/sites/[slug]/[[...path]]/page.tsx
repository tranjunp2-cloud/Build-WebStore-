import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { SiteRenderer, type NavPage } from '@/components/site-renderer/SiteRenderer'
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
    const { user } = await payload.auth({ headers: reqHeaders })

    // Find tenant by subdomain slug
    const tenantsResult = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        limit: 1,
    })

    const tenant = tenantsResult.docs[0]
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
        if (!user) {
            return null // Visitor hits 404 for draft site (AC-2)
        }

        interface TenantRef {
            tenant: string | number | { id: string | number }
        }
        const tenantIds = user.tenants?.map((t: TenantRef) =>
            typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
        ) ?? []
        
        if (!tenantIds.includes(String(tenant.id))) {
            return null // Visitor hits 404 for draft site (AC-2)
        }
    }

    // Find the page
    const pagesResult = await payload.find({
        collection: 'pages',
        where: {
            and: [
                { site: { equals: site.id } },
                { slug: { equals: pagePath === '' ? '/' : `/${pagePath}` } },
            ],
        },
        limit: 1,
        depth: 3, // Resolve media relationships
    })

    const page = pagesResult.docs[0]

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

    const { site, page } = data
    const title = page?.seo?.title || site.seo?.metaTitle || site.name
    const description = page?.seo?.description || site.seo?.metaDescription

    return {
        title,
        description,
        openGraph: {
            title: title ?? undefined,
            description: description ?? undefined,
            type: 'website',
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
