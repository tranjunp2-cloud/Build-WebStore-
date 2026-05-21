import type { Payload } from 'payload'

/**
 * Returns email addresses of all users belonging to the given tenant.
 * Returns [] on error — callers use fire-and-forget pattern.
 */
export async function getTenantOwnerEmails(
    payload: Payload,
    tenantId: string | number,
): Promise<string[]> {
    try {
        const result = await payload.find({
            collection: 'users',
            where: {
                and: [
                    { 'tenants.tenant': { equals: tenantId } },
                    { email: { exists: true } },
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
