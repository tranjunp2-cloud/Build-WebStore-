/**
 * POST /api/sites/[siteId]/seed-images
 * Seed gallery images from Unsplash → S3 for a site the current user owns.
 * Awaits seed completion then returns the imageLibraryS3 map so the editor
 * can push it into the iframe via postMessage (no iframe reload needed).
 * Idempotent: if gallery slots are already seeded the seeder skips after one DB query.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { seedImageLibraryForSite } from '@/lib/images/image-library-seeder'
import { resolveImageLibraryS3Map } from '@/lib/images/image-library-resolver'

type TenantRef = string | number | { id: string | number } | null | undefined
const resolveTenantId = (t: TenantRef): string | null =>
    t == null ? null : String(typeof t === 'object' ? t.id : t)

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ siteId: string }> },
) {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { siteId } = await params
    const payload = await getPayload({ config })

    const site = await payload.findByID({ collection: 'sites', id: siteId, depth: 1 })
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

    const siteTenantId = resolveTenantId(site.tenant as TenantRef)
    const userTenants = (user as { tenants?: Array<{ tenant: TenantRef }> }).tenants ?? []
    if (!siteTenantId || !userTenants.some(t => resolveTenantId(t.tenant) === siteTenantId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const category = (site.siteType as string) || 'business'

    // Await seed so we can return the S3 map immediately for postMessage live-update.
    // Only gallery slots (~6 images, ~5–10s). Never throws.
    await seedImageLibraryForSite(payload, siteTenantId, siteId, category,
        (slot) => slot.startsWith('gallery'),
    )

    const imageLibraryS3 = await resolveImageLibraryS3Map(payload, siteId)

    return NextResponse.json({ ok: true, imageLibraryS3 })
}
