import type { Payload } from 'payload'

/**
 * Fire-and-forget helper: create a notification for all owners of a given tenant.
 * Used by collection afterChange hooks to avoid repeating the same boilerplate.
 */
export async function notifyTenantOwners(
    payload: Payload,
    tenantId: number | string,
    data: {
        type: 'ORDER_NEW' | 'SYSTEM_ALERT' | 'PRODUCT_LOW_STOCK' | 'BLOG_PUBLISHED'
        title: string
        message: string
        actionUrl: string
    },
) {
    const usersResult = await payload.find({
        collection: 'users',
        where: {
            'tenants.tenant': { equals: tenantId },
            'tenants.role': { equals: 'owner' },
            'tenants.status': { equals: 'active' },
        },
        limit: 10,
        depth: 0,
    })

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await Promise.allSettled(
        usersResult.docs.map((user) =>
            payload.create({
                collection: 'notifications',
                data: {
                    tenant: tenantId,
                    user: user.id,
                    type: data.type,
                    title: data.title,
                    message: data.message,
                    actionUrl: data.actionUrl,
                    isRead: false,
                    expiresAt,
                },
            }),
        ),
    )
}
