import type { Payload } from 'payload'

/**
 * A site is "usable" when it isn't mid/failed AI generation — i.e. it has no
 * generationStatus, or its status is 'none' or 'completed'. This single
 * predicate is the source of truth for dashboard and site availability checks.
 */
export function isUsableSite(site: unknown): boolean {
    const gs = (site as Record<string, unknown>)?.generationStatus
    return !gs || gs === 'none' || gs === 'completed'
}

export interface TenantSiteState {
    hasUsableSite: boolean
}

/**
 * Resolve whether a tenant has at least one usable website. Takes an injected
 * `payload` (no @payload-config import) so it can be unit-tested with a mock and
 * piggyback on a caller's existing payload session.
 */
export async function getTenantSiteState(
    payload: Payload,
    tenantId: string | null | undefined,
): Promise<TenantSiteState> {
    if (tenantId == null) return { hasUsableSite: false }

    const result = await payload.find({
        collection: 'sites',
        where: { tenant: { equals: tenantId } },
        limit: 5, // 1 site/tenant expected, extra for safety
    })

    return { hasUsableSite: result.docs.some(isUsableSite) }
}
