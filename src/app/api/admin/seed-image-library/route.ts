/**
 * POST /api/admin/seed-image-library
 * Dev/admin-only: manually trigger IMAGE_LIBRARY seeder for an existing site.
 * Body: { siteId, category }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { seedImageLibraryForSite } from '@/lib/images/image-library-seeder'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    const user = await getCurrentUser(req)
    if (!user || !(user as { roles?: string[] }).roles?.includes('super-admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { siteId, category } = await req.json()
    if (!siteId || !category) {
        return NextResponse.json({ error: 'siteId, category required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Derive tenantId from the site record — never trust the request body for this,
    // since a mismatched {siteId, tenantId} pair would corrupt cross-tenant media.
    const site = await payload.findByID({ collection: 'sites', id: siteId, depth: 0 })
    if (!site) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }
    const tenantId = typeof site.tenant === 'object' ? site.tenant.id : site.tenant
    if (!tenantId) {
        return NextResponse.json({ error: 'Site has no tenant' }, { status: 422 })
    }

    const result = await seedImageLibraryForSite(payload, tenantId, siteId, category)

    return NextResponse.json({ ok: true, result })
}
