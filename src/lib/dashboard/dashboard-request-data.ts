import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { findDashboardSites, type DashboardSiteRow } from './get-tenant-site-state'

/**
 * Reads the dashboard layout and the dashboard page both need, once per request (React `cache()` is scoped to one
 * server render): the tenant's sites, and the few tenant settings the page reads (TC-PERF-055, TC-PERF-056).
 */
export const getDashboardSites = cache(async (tenantId: string): Promise<DashboardSiteRow[]> => {
    const payload = await getPayload({ config })
    return findDashboardSites(payload, tenantId)
})

export interface DashboardTenantSettings {
    dashboardPreferences?: string[]
    easyParcelEnabled: boolean
}

/** Widget layout + EasyParcel switch: one row, two columns (was a depth-2 read of the whole tenant row). */
export const getDashboardTenantSettings = cache(async (tenantId: string): Promise<DashboardTenantSettings> => {
    const payload = await getPayload({ config })
    const tenant = (await payload.findByID({
        collection: 'tenants',
        id: tenantId,
        depth: 0,
        overrideAccess: true,
        select: { settings: { dashboardPreferences: true }, easyParcelIntegration: { enabled: true } },
    })) as { settings?: { dashboardPreferences?: string[] | null } | null; easyParcelIntegration?: { enabled?: boolean | null } | null }
    return {
        dashboardPreferences: tenant?.settings?.dashboardPreferences ?? undefined,
        easyParcelEnabled: tenant?.easyParcelIntegration?.enabled === true,
    }
})
