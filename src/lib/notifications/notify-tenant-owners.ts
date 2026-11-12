import type { Payload } from 'payload'
import { signalNotificationUsers } from './signal-notification'
import { sendPushToUser } from './send-push'

type NotificationType = 'ORDER_NEW' | 'SYSTEM_ALERT' | 'PRODUCT_LOW_STOCK' | 'BLOG_PUBLISHED' | 'LEAD_NEW'

/** Default roles per notification type */
const ROLES_BY_TYPE: Record<NotificationType, string[]> = {
    ORDER_NEW: ['owner', 'admin'],
    PRODUCT_LOW_STOCK: ['owner', 'admin', 'editor'],
    BLOG_PUBLISHED: ['owner', 'admin', 'editor'],
    SYSTEM_ALERT: ['owner', 'admin', 'editor', 'viewer'],
    LEAD_NEW: ['owner'],
}

/**
 * Fire-and-forget helper: create a notification for tenant members matching
 * the target roles. By default, roles are determined by notification type.
 * Used by collection afterChange hooks to avoid repeating the same boilerplate.
 */
export async function notifyTenantOwners(
    payload: Payload,
    tenantId: number | string,
    data: {
        type: NotificationType
        title: string
        message: string
        actionUrl: string
        metadata?: Record<string, string>
        roles?: string[]
        /**
         * Stable per-event idempotency key (e.g. `ORDER_NEW:ORD-123`). When set,
         * the same event firing more than once — multiple lifecycle paths,
         * sequential OR concurrent webhook/cron retries — never produces a
         * duplicate notification row per user, so the unread badge stays correct.
         *
         * Two layers:
         *  1. App pre-check below skips recipients who already have this key
         *     (fast path, avoids most redundant inserts).
         *  2. The partial UNIQUE index on (tenant_id, user_id, dedupe_key) is the
         *     real source of truth — it closes the read-then-write race window;
         *     a conflicting concurrent insert rejects and is swallowed by
         *     `Promise.allSettled`. Keyed on the stable event id (not the display
         *     title) so money/format drift in the title can't break dedupe.
         */
        dedupeKey?: string
    },
) {
    const targetRoles = data.roles ?? ROLES_BY_TYPE[data.type]

    const roleFilter = targetRoles.length === 1
        ? { equals: targetRoles[0] }
        : { in: targetRoles }

    // Both the recipient query and the dedupe query are bounded by the same cap
    // so they can never drift out of sync (a larger recipient set than the dedupe
    // lookup would silently re-allow duplicates).
    const RECIPIENT_LIMIT = 200

    const usersResult = await payload.find({
        collection: 'users',
        where: {
            'tenants.tenant': { equals: tenantId },
            'tenants.role': roleFilter,
            'tenants.status': { equals: 'active' },
        },
        limit: RECIPIENT_LIMIT,
        depth: 0,
    })

    if (usersResult.totalDocs > usersResult.docs.length) {
        console.warn(`[Notification] Tenant ${tenantId} has ${usersResult.totalDocs} matching users but only ${usersResult.docs.length} were notified (limit: ${RECIPIENT_LIMIT})`)
    }

    let recipients = usersResult.docs

    // Idempotency fast-path: drop recipients who already have a notification with
    // this dedupeKey in this tenant, so we don't even attempt a redundant insert.
    // The partial unique index is the real guarantee (see dedupeKey docs) — this
    // just avoids the noise of conflict-rejected inserts on the common retry path.
    if (data.dedupeKey && recipients.length > 0) {
        const existing = await payload.find({
            collection: 'notifications',
            where: {
                and: [
                    { tenant: { equals: tenantId } },
                    { dedupeKey: { equals: data.dedupeKey } },
                    { user: { in: recipients.map((u) => u.id) } },
                ],
            },
            limit: RECIPIENT_LIMIT,
            depth: 0,
        })
        const alreadyNotified = new Set(
            existing.docs.map((d) => (typeof d.user === 'object' ? d.user?.id : d.user)),
        )
        recipients = recipients.filter((u) => !alreadyNotified.has(u.id))
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // allSettled, not all: a concurrent insert that loses the unique-index race
    // rejects for that one row — we swallow it (the row already exists) instead
    // of failing the whole batch.
    //
    // `skipPush`: the Notifications afterChange hook runs INSIDE the create
    // transaction; awaiting web-push there would hold a pooled connection while
    // sendPushToUser asks for a second one (pool max 25 → deadlock under load).
    // We send the realtime signal first (1 request), then push once rows are committed.
    const results = await Promise.allSettled(
        recipients.map((user) =>
            payload.create({
                collection: 'notifications',
                data: {
                    tenant: tenantId,
                    user: user.id,
                    type: data.type,
                    title: data.title,
                    message: data.message,
                    actionUrl: data.actionUrl,
                    ...(data.metadata ? { metadata: data.metadata } : {}),
                    ...(data.dedupeKey ? { dedupeKey: data.dedupeKey } : {}),
                    isRead: false,
                    expiresAt,
                },
                context: { skipPush: true },
            }),
        ),
    )

    const created = results.flatMap((r, i) =>
        r.status === 'fulfilled' ? [{ user: recipients[i], doc: r.value }] : [],
    )
    if (created.length === 0) return

    await signalNotificationUsers(created.map((c) => c.user.id))

    await Promise.allSettled(
        created.map(({ user, doc }) =>
            sendPushToUser(
                user.id,
                tenantId,
                {
                    id: String(doc.id),
                    title: data.title,
                    body: data.message || undefined,
                    tag: data.type,
                    actionUrl: data.actionUrl || undefined,
                },
                payload,
            ).catch((err) => console.error('[Push] send failed', err)),
        ),
    )
}
