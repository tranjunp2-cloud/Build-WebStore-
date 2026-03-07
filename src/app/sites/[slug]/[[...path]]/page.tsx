import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'

type Props = {
    params: Promise<{ slug: string; path?: string[] }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function getTenantAndPage(slug: string, pagePath: string) {
    const payload = await getPayload({ config })

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
        where: {
            and: [
                { tenant: { equals: tenant.id } },
                { status: { equals: 'published' } },
            ],
        },
        limit: 1,
    })

    const site = sitesResult.docs[0]
    if (!site) return null

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

    return { tenant, site, page }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, path } = await params
    const pagePath = (path ?? []).join('/')
    const data = await getTenantAndPage(slug, pagePath)

    if (!data) return { title: 'Not Found' }

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

    if (!data || !data.page) {
        notFound()
    }

    const { site, page } = data

    return (
        <SiteRenderer
            site={site as any}
            page={page as any}
        />
    )
}
