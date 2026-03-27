import Link from 'next/link'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'

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
            // e.g. "tenant.primeweb.app:3000" -> "tenant"
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

    // Find published site
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

    // Find 404 page
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
        where: {
            site: { equals: site.id },
        },
        limit: 100,
        sort: 'createdAt',
    })

    // Render exact matching 404 page from Payload
    if (page404) {
        return <SiteRenderer site={site as any} page={page404 as any} pages={navigationPages.docs as any[]} />
    }

    // Default UI if site exists but missing 404 page in DB
    return <Fallback404 />
}

function Fallback404() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
            <h1 style={{ fontSize: '3rem', margin: 0, fontWeight: 700 }}>404</h1>
            <p style={{ fontSize: '1.25rem', color: '#666', marginTop: '0.5rem' }}>Page Not Found</p>
            <Link href="/" style={{ marginTop: '1.5rem', color: '#0ea5e9', textDecoration: 'none', fontWeight: 500, padding: '0.5rem 1rem', border: '1px solid #0ea5e9', borderRadius: '0.375rem' }}>Back to Homepage</Link>
        </div>
    )
}
