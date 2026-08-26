export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/slug/redirect?slug=old-slug
 * Internal endpoint called by middleware to check if a slug is in previousSlugs.
 * Returns { redirect: true, newSlug: "current-slug" } if found and not expired.
 */
export async function GET(req: NextRequest) {
    const slug = req.nextUrl.searchParams.get('slug')
    if (!slug) {
        return NextResponse.json({ redirect: false })
    }

    try {
        const payload = await getPayload({ config })

        // First check if slug is a current tenant — no redirect needed
        const currentTenant = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: slug } },
            limit: 1,
        })
        if (currentTenant.docs.length > 0) {
            // BUG-F05-006: Also return site status for maintenance mode check
            const tenantId = currentTenant.docs[0].id
            const siteResult = await payload.find({
                collection: 'sites',
                where: { tenant: { equals: tenantId } },
                limit: 1,
                depth: 0,
            })
            const site = siteResult.docs[0]
            const maintenance = site?.status === 'draft' && !!site?.publishedAt
            return NextResponse.json({
                redirect: false,
                maintenance,
                siteName: maintenance ? (site?.name || '') : undefined,
            })
        }

        // Check previousSlugs across all tenants
        // Query tenants where previousSlugs array contains this slug
        const tenantsWithOldSlug = await payload.find({
            collection: 'tenants',
            where: {
                'previousSlugs.slug': { equals: slug },
            },
            limit: 1,
        })

        if (tenantsWithOldSlug.docs.length > 0) {
            const tenant = tenantsWithOldSlug.docs[0]
            const previousSlugs = (tenant.previousSlugs as Array<{ slug: string; expiresAt: string }>) || []
            const match = previousSlugs.find((ps) => ps.slug === slug)

            if (match && new Date(match.expiresAt) > new Date()) {
                return NextResponse.json({ redirect: true, newSlug: tenant.slug })
            }
        }

        return NextResponse.json({ redirect: false })
    } catch {
        return NextResponse.json({ redirect: false })
    }
}
