export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { isReservedSlug, validateSlugFormat } from '@/lib/utils/reserved-slugs'

/**
 * PATCH /api/tenant/slug
 * Change tenant subdomain slug. Auth required.
 * Body: { slug: string }
 *
 * - Validates format + reserved words
 * - Checks availability (tenants.slug + previousSlugs)
 * - Saves old slug to previousSlugs with 30-day expiry
 */
export async function PATCH(req: NextRequest) {
    const user = await getCurrentUser(req)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { slug?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const newSlug = body.slug?.toLowerCase().trim()
    if (!newSlug) {
        return NextResponse.json({ error: 'INVALID_SLUG', message: 'Slug is required' }, { status: 422 })
    }

    // Validate format
    const formatError = validateSlugFormat(newSlug)
    if (formatError) {
        return NextResponse.json({ error: 'INVALID_SLUG', message: formatError }, { status: 422 })
    }

    // Check reserved
    if (isReservedSlug(newSlug)) {
        return NextResponse.json({ error: 'RESERVED_SLUG', message: 'This subdomain is reserved.' }, { status: 409 })
    }

    try {
        const payload = await getPayload({ config })

        // Resolve tenant from user
        const userTenants = (user as { tenants?: Array<{ tenant: unknown }> }).tenants
        let tenantId = userTenants?.[0]?.tenant
        if (typeof tenantId === 'object' && tenantId !== null) {
            tenantId = (tenantId as Record<string, unknown>).id
        }
        if (!tenantId) {
            return NextResponse.json({ error: 'NO_TENANT', message: 'No tenant found for this user.' }, { status: 404 })
        }

        // Get current tenant
        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId as string | number })
        if (!tenant) {
            return NextResponse.json({ error: 'NO_TENANT', message: 'Tenant not found.' }, { status: 404 })
        }

        const currentSlug = tenant.slug
        if (currentSlug === newSlug) {
            return NextResponse.json({ slug: newSlug, previousSlugs: tenant.previousSlugs || [] })
        }

        // Check if new slug is taken by another tenant
        const existing = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: newSlug } },
            limit: 1,
        })
        if (existing.docs.length > 0) {
            return NextResponse.json(
                { error: 'SLUG_TAKEN', message: 'Slug is already in use.' },
                { status: 409 },
            )
        }

        // Build new previousSlugs array
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        const existingPreviousSlugs = (tenant.previousSlugs as Array<{ slug: string; expiresAt: string }>) || []
        const updatedPreviousSlugs = [
            ...existingPreviousSlugs,
            { slug: currentSlug, expiresAt },
        ].slice(-20) // Keep max 20 entries (FIFO)

        // Update tenant
        const updated = await payload.update({
            collection: 'tenants',
            id: tenantId as string | number,
            data: {
                slug: newSlug,
                previousSlugs: updatedPreviousSlugs,
            } as Record<string, unknown>,
        })

        return NextResponse.json({
            slug: updated.slug,
            previousSlugs: updated.previousSlugs,
        })
    } catch (err) {
        console.error('[PATCH /api/tenant/slug] Error:', err)
        return NextResponse.json(
            { error: 'INTERNAL', message: 'Failed to update slug. Please try again.' },
            { status: 500 },
        )
    }
}
