import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import type { MarkReadPayload } from '@/types/notification'

import { z } from 'zod'

const MarkReadSchema = z.object({
    mark_all: z.boolean().optional(),
    notificationIds: z.array(z.string()).optional(),
}).refine(data => data.mark_all || (data.notificationIds && data.notificationIds.length > 0), {
    message: "Must provide either mark_all=true or an array of notificationIds",
})

export const dynamic = 'force-dynamic'

/**
 * POST /api/notifications/mark-read
 *
 * Mark one, many, or all notifications as read for the authenticated user.
 * Body: { notificationIds: string[] } | { mark_all: true }
 * Response: { success: true }
 */
export const POST = withAuth(async (user, request) => {
    try {
        const payload = await getPayload({ config })
        const jsonBody = await request.json()
        const parsed = MarkReadSchema.safeParse(jsonBody)

        if (!parsed.success) {
            return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
        }
        const body = parsed.data as MarkReadPayload

        // Resolve tenant ID
        const userWithTenants = user as unknown as {
            tenants?: Array<{ tenant: string | { id: string } }>
        }
        const firstTenant = userWithTenants.tenants?.[0]?.tenant
        const tenantId = typeof firstTenant === 'object' ? firstTenant?.id : firstTenant

        if (!tenantId) {
            return NextResponse.json({ success: false, error: 'No tenant found' }, { status: 400 })
        }

        if (body.mark_all) {
            // Find all unread notifications for this user/tenant then bulk update
            const unread = await payload.find({
                collection: 'notifications',
                where: {
                    and: [
                        { user: { equals: user.id } },
                        { tenant: { equals: tenantId } },
                        { isRead: { equals: false } },
                    ],
                },
                limit: 200,
                depth: 0,
                user,
                overrideAccess: false,
            })

            // Update each notification (Payload doesn't have bulk update in access-controlled mode)
            await Promise.all(
                unread.docs.map((doc) =>
                    payload.update({
                        collection: 'notifications',
                        id: doc.id,
                        data: { isRead: true },
                        user,
                        overrideAccess: false,
                    })
                )
            )

            return NextResponse.json({ success: true, updated: unread.docs.length })
        }

        if (!body.notificationIds || body.notificationIds.length === 0) {
            return NextResponse.json({ success: false, error: 'notificationIds required' }, { status: 400 })
        }

        // Update specific notifications (access control ensures user owns them)
        await Promise.all(
            body.notificationIds.map((id) =>
                payload.update({
                    collection: 'notifications',
                    id,
                    data: { isRead: true },
                    user,
                    overrideAccess: false,
                })
            )
        )

        return NextResponse.json({ success: true, updated: body.notificationIds.length })
    } catch (error) {
        console.error('[Notifications Mark-Read Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notifications as read' } },
            { status: 500 }
        )
    }
})
