import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'

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
            return { isMaintenance: true, site }
        }

        const tenantIds = user.tenants?.map((t: any) =>
            typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
        ) ?? []
        
        if (!tenantIds.includes(String(tenant.id))) {
            return { isMaintenance: true, site }
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

    if (!data || data.isMaintenance) return { title: data?.site ? `${data.site.name} - Under Maintenance` : 'Not Found', robots: { index: false, follow: false } }

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

    if (data.isMaintenance) {
        // Return 503 Maintenance Page UI
        // In Next.js App Router Server Component 'page.tsx', 
        // to strictly return 503 we'd need a route handler or middleware. 
        // But for UI rendering, we show a maintenance screen without exposing content.
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-gray-900">
                <div className="mx-auto max-w-md text-center p-8 bg-white rounded-2xl shadow-xl border border-gray-100">
                    <div className="mb-6 flex justify-center">
                        <div className="rounded-full bg-blue-50 p-4">
                            <svg className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                    </div>
                    <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-gray-900">Đang bảo trì</h1>
                    <p className="text-lg text-gray-500 mb-8">
                        Đội ngũ của chúng tôi hiện đang tiến hành bảo trì website <strong>{data.site?.name}</strong>. Vui lòng quay lại sau ít phút.
                    </p>
                    <div className="mt-8 border-t border-gray-100 pt-6">
                        <p className="text-xs text-gray-400">
                            Powered by <strong className="font-semibold text-gray-500">Prime Web AI</strong>
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (!data.page) {
        notFound()
    }

    const { site, page, pages } = data

    return (
        <SiteRenderer
            site={site as any}
            page={page as any}
            pages={pages as any[]}
        />
    )
}
