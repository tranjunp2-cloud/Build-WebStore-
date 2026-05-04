export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { isReservedSlug, validateSlugFormat } from '@/lib/utils/reserved-slugs'
import { ensureUniqueSlug } from '@/lib/utils/slugify'

/**
 * GET /api/slug/check?slug=mybakery
 * Public endpoint — no auth required.
 * Checks slug availability for tenant subdomain.
 */
export async function GET(req: NextRequest) {
    const slug = req.nextUrl.searchParams.get('slug')?.toLowerCase().trim()

    if (!slug) {
        return NextResponse.json(
            { available: false, reason: 'invalid_format', message: 'Slug parameter is required' },
            { status: 422 },
        )
    }

    // Validate format
    const formatError = validateSlugFormat(slug)
    if (formatError) {
        return NextResponse.json(
            { available: false, reason: 'invalid_format', message: formatError },
            { status: 422 },
        )
    }

    // Check reserved words
    if (isReservedSlug(slug)) {
        return NextResponse.json(
            { available: false, reason: 'reserved', message: 'This subdomain is reserved and cannot be used.' },
            { status: 409 },
        )
    }

    try {
        const payload = await getPayload({ config })

        // Check if slug is taken by existing tenant.
        // overrideAccess: true — this is a public availability check, not a data read.
        // Without it, the Tenants access rule returns { id: { in: [] } } for unauthenticated
        // callers, which Drizzle serializes as WHERE id IN () — invalid PostgreSQL → 503.
        const existing = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: slug } },
            limit: 1,
            overrideAccess: true,
        })

        if (existing.docs.length > 0) {
            // Generate a suggestion
            const suggestion = await ensureUniqueSlug(payload, slug)
            return NextResponse.json({ available: false, suggestion })
        }

        return NextResponse.json({ available: true })
    } catch (err) {
        console.error('[slug/check] error:', err instanceof Error ? err.message : err)
        return NextResponse.json(
            { available: false, reason: 'error', message: 'Unable to check slug availability. Please try again.' },
            { status: 503 },
        )
    }
}
