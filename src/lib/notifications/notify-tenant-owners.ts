import type { Payload } from 'payload'

/** Default roles per notification type */
const ROLES_BY_TYPE: Record<string, string[]> = {
    ORDER_NEW: ['owner', 'admin'],
    PRODUCT_LOW_STOCK: ['owner', 'admin', 'editor'],
    BLOG_PUBLISHED: ['owner', 'admin', 'editor'],
    SYSTEM_ALERT: ['owner', 'admin', 'editor', 'viewer'],
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
        type: 'ORDER_NEW' | 'SYSTEM_ALERT' | 'PRODUCT_LOW_STOCK' | 'BLOG_PUBLISHED'
        title: string
        message: string
        actionUrl: string
        roles?: string[]
    },
) {
    const targetRoles = data.roles ?? ROLES_BY_TYPE[data.type] ?? ['owner']

    const roleFilter = targetRoles.length === 1
        ? { equals: targetRoles[0] }
        : { in: targetRoles }

    const usersResult = await payload.find({
        collection: 'users',
        where: {
            'tenants.tenant': { equals: tenantId },
            'tenants.role': roleFilter,
            'tenants.status': { equals: 'active' },
        },
        limit: 50,
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
