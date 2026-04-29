/**
 * POST /api/sites/[siteId]/seed-images
 * Seed gallery images from Unsplash → S3 for a site the current user owns.
 * Returns 202 immediately; seeder runs in background (fire-and-forget).
 * Gallery renders with CDN category fallback right away; S3 images appear on next session load.
 * Idempotent: if gallery slots are already seeded the seeder skips after one DB query.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

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

    // Fire-and-forget: seed only gallery slots (~6 images) so it's lightweight
    import('@/lib/images/image-library-seeder')
        .then(({ seedImageLibraryForSite }) =>
            seedImageLibraryForSite(payload, siteTenantId, siteId, category,
                (slot) => slot.startsWith('gallery'),
            ),
        )
        .catch(err =>
            console.error('[seed-images] seeder failed', err instanceof Error ? err.message : err),
        )

    return NextResponse.json({ ok: true, queued: true }, { status: 202 })
}
