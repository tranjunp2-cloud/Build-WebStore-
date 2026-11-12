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

/** The columns the dashboard layout + page read off a tenant's sites (onboarding steps, usable / failed). */
export interface DashboardSiteRow {
    id: number | string
    status?: string | null
    generationStatus?: string | null
    themeCustomized?: boolean | null
    shippingConfig?: { shippingSetupConfirmed?: boolean | null } | null
}

/**
 * A tenant's sites, newest first, as one statement: `depth: 0` + `select` + no COUNT. This read used Payload's
 * defaults (depth 2: the whole tenant row and its media per site, plus a COUNT) for a yes/no answer (TC-PERF-055).
 * Sites per workspace are bounded by the plan (1 expected); 100 is a safety cap.
 */
export async function findDashboardSites(payload: Payload, tenantId: string | number): Promise<DashboardSiteRow[]> {
    const result = await payload.find({
        collection: 'sites',
        where: { tenant: { equals: tenantId } },
        sort: '-createdAt',
        limit: 100,
        pagination: false,
        depth: 0,
        overrideAccess: true,
        select: {
            status: true,
            generationStatus: true,
            themeCustomized: true,
            shippingConfig: { shippingSetupConfirmed: true },
        },
    })
    return result.docs as unknown as DashboardSiteRow[]
}

/**
 * Resolve whether a tenant has at least one usable website. Takes an injected
 * `payload` (no @payload-config import) so it can be unit-tested with a mock and
 * piggyback on a caller's existing payload session. `sites` = rows already read in this request.
 */
export async function getTenantSiteState(
    payload: Payload,
    tenantId: string | null | undefined,
    sites?: Promise<DashboardSiteRow[]>,
): Promise<TenantSiteState> {
    if (tenantId == null) return { hasUsableSite: false }
    const rows = await (sites ?? findDashboardSites(payload, tenantId))
    return { hasUsableSite: rows.some(isUsableSite) }
}
