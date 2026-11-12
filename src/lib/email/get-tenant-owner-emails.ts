import type { Payload } from 'payload'

/**
 * Returns email addresses of users belonging to the given tenant.
 * Without `roles` every member counts (order emails). With `roles` only ACTIVE members
 * holding one of those tenant roles do (e.g. ['owner'] for contact-lead alerts).
 * Returns [] on error — callers use fire-and-forget pattern.
 */
export async function getTenantOwnerEmails(
    payload: Payload,
    tenantId: string | number,
    roles?: string[],
): Promise<string[]> {
    try {
        const result = await payload.find({
            collection: 'users',
            where: {
                and: [
                    { 'tenants.tenant': { equals: tenantId } },
                    { email: { exists: true } },
                    ...(roles?.length
                        ? [{ 'tenants.role': { in: roles } }, { 'tenants.status': { equals: 'active' } }]
                        : []),
                ],
            },
            limit: 20,
            depth: 0,
            overrideAccess: true,
        })
        return result.docs.map((u) => u.email).filter(Boolean) as string[]
    } catch {
        return []
    }
}
