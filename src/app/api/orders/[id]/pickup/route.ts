import 'server-only'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_SLOTS = new Set(['am', 'pm'])
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:+Z.-]+)?$/

/**
 * POST /api/orders/[id]/pickup
 *
 * Persists a merchant-chosen pickup schedule for an order.
 * Body: { scheduledAt: ISO string, slot?: 'am' | 'pm' }
 * Local-only — does NOT call EasyParcel API.
 * Returns the saved pickupScheduledAt and pickupSlot values.
 */
export const POST = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const orderId = Number.isFinite(Number(id)) ? Number(id) : id

        let scheduledAt: string | undefined
        let slot: string | undefined
        try {
            const body = await request.json()
            if (typeof body?.scheduledAt === 'string' && body.scheduledAt.trim()) scheduledAt = body.scheduledAt.trim()
            if (typeof body?.slot === 'string') slot = body.slot
        } catch {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_BODY', message: 'Request body must be JSON with scheduledAt' } },
                { status: 400 },
            )
        }

        if (!scheduledAt) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'scheduledAt is required (ISO date string)' } },
                { status: 422 },
            )
        }

        if (!ISO_DATE_RE.test(scheduledAt)) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'scheduledAt must be a valid ISO date string' } },
                { status: 422 },
            )
        }

        // Reject dates before today — client validates too, but server is the trust boundary
        const dateStr = scheduledAt.substring(0, 10)
        const today = new Date()
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        if (dateStr < todayStr) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'scheduledAt must not be in the past' } },
                { status: 422 },
            )
        }

        if (slot !== undefined && !VALID_SLOTS.has(slot)) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: "slot must be 'am' or 'pm'" } },
                { status: 422 },
            )
        }

        const payload = await getPayload({ config })

        const order = await payload.findByID({
            collection: 'orders',
            id: orderId,
            user,
            overrideAccess: false,
        })

        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 },
            )
        }

        const updateData: Record<string, unknown> = { pickupScheduledAt: scheduledAt }
        if (slot !== undefined) updateData.pickupSlot = slot

        await payload.update({
            collection: 'orders',
            id: orderId,
            data: updateData as any,
        })

        return NextResponse.json({
            success: true,
            data: {
                pickupScheduledAt: scheduledAt,
                ...(slot !== undefined ? { pickupSlot: slot } : {}),
            },
        })
    } catch (error: unknown) {
        console.error('[Pickup Schedule Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save pickup schedule' } },
            { status: 500 },
        )
    }
}))
