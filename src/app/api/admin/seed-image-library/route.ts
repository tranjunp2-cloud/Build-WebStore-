/**
 * POST /api/admin/seed-image-library
 * Dev/admin-only: manually trigger IMAGE_LIBRARY seeder for an existing site.
 * Body: { siteId, tenantId, category }
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

    const { siteId, tenantId, category } = await req.json()
    if (!siteId || !tenantId || !category) {
        return NextResponse.json({ error: 'siteId, tenantId, category required' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const result = await seedImageLibraryForSite(payload, tenantId, siteId, category)

    return NextResponse.json({ ok: true, result })
}
