import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import type { NotificationsResponse } from '@/types/notification'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/notifications?limit=20&offset=0&since=ISO8601
 *
 * Returns paginated notifications for the authenticated user within their tenant.
 * Optional `since` param filters to notifications created after the given timestamp.
 * Always scoped to the current user (user_id + tenant_id) for data isolation.
 */
export const GET = withAuth(async (user, request) => {
    try {
        // Rate limit: 30 requests per minute per user
        const rateCheck = await checkRateLimit(`notifications:get:${user.id}`, 30, 60_000)
        if (!rateCheck.allowed) {
            return NextResponse.json(
                { success: false, error: 'Too many requests' },
                { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rateCheck.resetAt - Date.now()) / 1000))) } },
            )
        }

        const payload = await getPayload({ config })
        const url = new URL(request.url)
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const since = url.searchParams.get('since')

        // Resolve tenant ID for this user
        const userWithTenants = user as unknown as {
            tenants?: Array<{ tenant: string | { id: string } }>
        }
        const firstTenant = userWithTenants.tenants?.[0]?.tenant
        const tenantId = typeof firstTenant === 'object' ? firstTenant?.id : firstTenant

        if (!tenantId) {
            return NextResponse.json<NotificationsResponse>({ unreadCount: 0, items: [] })
        }

        // Build where filter
        const sinceFilter = since ? (() => {
            const sinceDate = new Date(since)
            const now = new Date()
            const effectiveSince = sinceDate > now ? new Date(now.getTime() - 60_000) : sinceDate
            return { createdAt: { greater_than: effectiveSince.toISOString() } }
        })() : null

        // Fetch notifications (Payload access control enforces user scoping)
        const result = await payload.find({
            collection: 'notifications',
            where: {
                and: [
                    { user: { equals: user.id } },
                    { tenant: { equals: tenantId } },
                    ...(sinceFilter ? [sinceFilter] : []),
                ],
            },
            sort: '-createdAt',
            limit,
            page: Math.floor(offset / limit) + 1,
            depth: 0,
            user,
            overrideAccess: false,
        })

        // Count unread separately (minimal query)
        const unreadResult = await payload.find({
            collection: 'notifications',
            where: {
                and: [
                    { user: { equals: user.id } },
                    { tenant: { equals: tenantId } },
                    { isRead: { equals: false } },
                ],
            },
            limit: 1,
            depth: 0,
            user,
            overrideAccess: false,
        })

        const items = result.docs.map((doc) => ({
            id: String(doc.id),
            type: doc.type as NotificationsResponse['items'][number]['type'],
            title: doc.title as string,
            message: (doc.message as string) ?? '',
            actionUrl: (doc.actionUrl as string | null) ?? null,
            isRead: Boolean(doc.isRead),
            createdAt: doc.createdAt as string,
        }))

        return NextResponse.json<NotificationsResponse>({
            unreadCount: unreadResult.totalDocs,
            items,
        })
    } catch (error) {
        console.error('[Notifications GET Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load notifications' } },
            { status: 500 }
        )
    }
})
