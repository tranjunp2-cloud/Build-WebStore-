import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { isNotFoundError } from '@/lib/api/is-not-found-error'
import { jsonWithEtag } from '@/lib/api/json-etag'
import type { NotificationsResponse } from '@/types/notification'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications?limit=20&offset=0&since=ISO8601
 *
 * Returns paginated notifications for the authenticated user within their tenant.
 * Optional `since` param filters to notifications created after the given timestamp.
 * Always scoped to the current user (user_id + tenant_id) for data isolation.
 *
 * Read by every open dashboard (NotificationProvider: on the Firebase signal, else a 60 s fallback), so it stays
 * cheap: two indexed queries run together (latest `limit` rows without a total count, and the unread count), the
 * body carries a weak ETag and `Cache-Control: private, max-age=0`, and a request whose `If-None-Match` matches the
 * new body gets `304` with no body.
 */
export const GET = withAuth(async (user, request) => {
    try {
        // Rate limit: 60 requests per minute per user (supports multi-tab polling)
        const rateCheck = await checkRateLimit(`notifications:get:${user.id}`, 60, 60_000)
        if (!rateCheck.allowed) {
            return NextResponse.json(
                { success: false, error: 'Too many requests' },
                { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rateCheck.resetAt - Date.now()) / 1000))) } },
            )
        }

        const payload = await getPayload({ config })
        const url = new URL(request.url)
        // Coerce to safe defaults so non-numeric input (e.g. ?limit=abc → NaN)
        // can't flow into payload.find and surface as a 500 (GH #1519 bug class).
        const parsedLimit = parseInt(url.searchParams.get('limit') || '20', 10)
        const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 50)
        const parsedOffset = parseInt(url.searchParams.get('offset') || '0', 10)
        const offset = Number.isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset
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

        // Parse + validate `since`. Accept either epoch milliseconds (all digits)
        // or a date string. Reject unparseable values with 400 instead of letting
        // `new Date(...).toISOString()` throw and surface as a 500 (GH #1519 Bug 1).
        let sinceFilter: { createdAt: { greater_than: string } } | null = null
        if (since) {
            const raw: string | number = /^\d+$/.test(since) ? Number(since) : since
            const sinceDate = new Date(raw)
            if (isNaN(sinceDate.getTime())) {
                return NextResponse.json(
                    { success: false, error: { code: 'INVALID_SINCE', message: 'Invalid "since" timestamp' } },
                    { status: 400 },
                )
            }
            const now = new Date()
            const effectiveSince = sinceDate > now ? new Date(now.getTime() - 60_000) : sinceDate
            sinceFilter = { createdAt: { greater_than: effectiveSince.toISOString() } }
        }

        // Latest rows + unread count, together. `pagination: false` (offset 0 only; see below) skips the total count Payload
        // would run for the list (the response has no total); the count is a plain COUNT on (tenant_id, user_id) + is_read.
        // Payload access control enforces user scoping.
        const [result, unread] = await Promise.all([
            payload.find({
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
                // offset 0 = poll path: skip the total count. offset > 0 = "load more" page: pagination must be on,
                // otherwise Payload ignores `page` and returns the first rows again (GH #2331).
                pagination: offset > 0,
                depth: 0,
                user,
                overrideAccess: false,
            }),
            payload.count({
                collection: 'notifications',
                where: {
                    and: [
                        { user: { equals: user.id } },
                        { tenant: { equals: tenantId } },
                        { isRead: { equals: false } },
                    ],
                },
                user,
                overrideAccess: false,
            }),
        ])

        const items = result.docs.map((doc) => ({
            id: String(doc.id),
            type: doc.type as NotificationsResponse['items'][number]['type'],
            title: doc.title as string,
            message: (doc.message as string) ?? '',
            ...(doc.metadata ? { metadata: doc.metadata as Record<string, string> } : {}),
            actionUrl: (doc.actionUrl as string | null) ?? null,
            isRead: Boolean(doc.isRead),
            createdAt: doc.createdAt as string,
        }))

        const body: NotificationsResponse = { unreadCount: unread.totalDocs, items }
        // `hasMore` only when the page was fetched with pagination (offset > 0); first page lets the client infer it.
        if (offset > 0) body.hasMore = Boolean(result.hasNextPage)

        return jsonWithEtag(body, request)
    } catch (error) {
        console.error('[Notifications GET Error]', error)
        // A NotFound thrown from Payload is a client-side (bad reference) error,
        // not a server crash — reclassify as 404 (GH #1519).
        if (isNotFoundError(error)) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } },
                { status: 404 },
            )
        }
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load notifications' } },
            { status: 500 }
        )
    }
})
