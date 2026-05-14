import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/storefront/site-by-slug?slug=xxx
 * Public endpoint — resolves tenant slug to siteId + tenantId.
 * Uses local Payload API (overrideAccess) to bypass restricted read access on Tenants collection.
 * Returns only the minimum fields needed; never exposes billing, subdomain, or other tenant data.
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url)
        const slug = url.searchParams.get('slug')?.trim()

        if (!slug || slug.length > 63) {
            return NextResponse.json({ error: 'slug is required' }, { status: 400 })
        }

        const payload = await getPayload({ config })

        const tenantResult = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: slug } },
            limit: 1,
            depth: 0,
            select: { id: true },
            overrideAccess: true,
        })

        const tenant = tenantResult.docs[0]
        if (!tenant) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const siteResult = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenant.id } },
            limit: 1,
            depth: 0,
            select: { id: true },
            overrideAccess: true,
        })

        const site = siteResult.docs[0]
        if (!site) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        return NextResponse.json({
            siteId: site.id,
            tenantId: tenant.id,
        })
    } catch (error) {
        console.error('[Storefront site-by-slug]', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
