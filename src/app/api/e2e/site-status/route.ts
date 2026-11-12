import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { z } from 'zod'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RelationshipValue = string | number | { id?: string | number } | null

const requestSchema = z.object({
    siteId: z.union([
        z.string().regex(/^\d{1,20}$/),
        z.number().int().positive(),
    ]).transform(String),
    status: z.enum(['draft', 'published']),
}).strict()

function relationshipId(value: RelationshipValue | undefined): string | null {
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    if (!value || typeof value !== 'object') return null
    return typeof value.id === 'string' || typeof value.id === 'number'
        ? String(value.id)
        : null
}

export async function PATCH(req: NextRequest) {
    const expectedEmail = process.env.TEST_EMAIL?.trim().toLowerCase()
    if (!expectedEmail) {
        return NextResponse.json({ error: 'E2E test identity is not configured' }, { status: 503 })
    }
    if (process.env.NODE_ENV === 'production' && process.env.APP_ENV !== 'staging') {
        return NextResponse.json({ error: 'E2E setup forbidden in production' }, { status: 403 })
    }

    const user = await getCurrentUser(req)
    if (!user) {
        return NextResponse.json({ error: 'Authenticated test user required' }, { status: 401 })
    }
    if (user.email?.trim().toLowerCase() !== expectedEmail) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const parsed = requestSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Invalid request', details: parsed.error.flatten() },
            { status: 400 },
        )
    }

    try {
        const activeTenantIds = new Set(
            ((user as unknown as {
                tenants?: Array<{ tenant?: RelationshipValue; status?: string }>
            }).tenants ?? [])
                .filter(membership => membership.status === 'active')
                .map(membership => relationshipId(membership.tenant))
                .filter((id): id is string => Boolean(id)),
        )
        if (activeTenantIds.size !== 1) {
            return NextResponse.json(
                { error: 'E2E test user must have exactly one active tenant' },
                { status: 409 },
            )
        }

        const payload = await getPayload({ config })
        const site = await payload.findByID({
            collection: 'sites',
            id: parsed.data.siteId,
            depth: 0,
            disableErrors: true,
            overrideAccess: true,
        })
        if (!site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 })
        }
        if (!activeTenantIds.has(relationshipId(site.tenant) ?? '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const updated = await payload.update({
            collection: 'sites',
            id: site.id,
            data: { status: parsed.data.status },
            depth: 0,
            overrideAccess: true,
        })

        return NextResponse.json({
            success: true,
            data: { id: updated.id, status: updated.status },
        })
    } catch (error) {
        console.error(
            '[E2E site status] Error:',
            error instanceof Error ? error.message : 'Unknown error',
        )
        return NextResponse.json({ error: 'Failed to update E2E site status' }, { status: 500 })
    }
}
