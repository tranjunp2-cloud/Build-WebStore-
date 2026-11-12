import type { Payload } from 'payload'
import { hasStaffRole } from '@/lib/admin/studio-roles'

/** One merchant account as the support page lists it. */
export type MerchantAccountSummary = {
    id: number
    email: string
    name: string
    tenants: { id: number; name: string; status: string | null }[]
}

const SEARCH_LIMIT = 20

type TenantLike = { id?: number | string; name?: string | null; status?: string | null }
type UserDoc = {
    id: number | string
    email: string
    firstName?: string | null
    lastName?: string | null
    roles?: string[] | null
    tenants?: { tenant?: TenantLike | number | string | null }[] | null
}

function toSummary(user: UserDoc): MerchantAccountSummary {
    const tenants = (user.tenants ?? [])
        .map((m) => m.tenant)
        .filter((t): t is TenantLike => Boolean(t) && typeof t === 'object')
        .map((t) => ({ id: Number(t.id), name: t.name ?? '', status: t.status ?? null }))
    return {
        id: Number(user.id),
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(' '),
        tenants,
    }
}

/**
 * Finds merchant accounts by email or company (tenant) name. Staff accounts are never returned, so the
 * support page can only ever offer links into merchant CMS accounts.
 */
export async function findMerchantAccounts(payload: Payload, query: string): Promise<MerchantAccountSummary[]> {
    const q = query.trim()
    if (q.length < 3) return []

    const tenants = await payload.find({
        collection: 'tenants',
        where: { name: { like: q } },
        limit: SEARCH_LIMIT,
        depth: 0,
        overrideAccess: true,
    })
    const tenantIds = tenants.docs.map((t) => t.id)

    const users = await payload.find({
        collection: 'users',
        where: {
            or: [
                { email: { like: q } },
                ...(tenantIds.length > 0 ? [{ 'tenants.tenant': { in: tenantIds } }] : []),
            ],
        },
        limit: SEARCH_LIMIT,
        depth: 1,
        overrideAccess: true,
    })

    return (users.docs as unknown as UserDoc[])
        .filter((u) => !hasStaffRole(u.roles))
        .map(toSummary)
}
