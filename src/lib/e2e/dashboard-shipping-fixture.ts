import type { Payload, Where } from 'payload'
import { normalizeDashboardBlocks } from '@/lib/dashboard-utils'
import {
    getDefaultWarehouse,
    isWarehouseComplete,
    normalizeWarehouse,
} from '@/lib/shipping/easyparcel/warehouse'
import { lockTenantSiteRows, withTenantRowLock, type TenantTransactionRequest } from '@/lib/payload/tenant-row-lock'

export const DASHBOARD_SHIPPING_FIXTURE_CAPABILITY = 'dashboard-shipping-fixture-v2'
export const DASHBOARD_SHIPPING_FIXTURE_TENANT_SLUG = 'e2e-test'

const MAX_FIXTURE_SITES = 20

export type DashboardShippingPrerequisiteCode =
    | 'TENANT_MISMATCH'
    | 'EASYPARCEL_NOT_READY'
    | 'DASHBOARD_NOT_READY'

export class DashboardShippingPrerequisiteError extends Error {
    readonly code: DashboardShippingPrerequisiteCode

    constructor(code: DashboardShippingPrerequisiteCode) {
        super(code)
        this.name = 'DashboardShippingPrerequisiteError'
        this.code = code
    }
}

type ShippingFixtureTenant = {
    id: string | number
    slug?: string | null
    settings?: unknown
    easyParcelIntegration?: {
        enabled?: boolean
        accessToken?: string | null
        refreshToken?: string | null
        testedAt?: string | null
        warehouse?: unknown
        warehouses?: unknown
    }
}

type ShippingFixtureSite = {
    id: string | number
    themeCustomized?: boolean
    shippingConfig?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function canonicalDashboardPreferences(raw: unknown) {
    const saved = Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === 'string')
        : undefined
    const normalized = normalizeDashboardBlocks(saved)
    return normalized.includes('onboarding') ? normalized : [...normalized, 'onboarding' as const]
}

function sameStringArray(value: unknown, expected: readonly string[]) {
    return Array.isArray(value)
        && value.length === expected.length
        && value.every((item, index) => item === expected[index])
}

function fixtureSiteIds(sites: ShippingFixtureSite[]): number[] {
    const ids = sites.map(({ id }) => typeof id === 'number' ? id : Number(id))
    if (ids.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
        throw new DashboardShippingPrerequisiteError('DASHBOARD_NOT_READY')
    }
    return ids.sort((left, right) => left - right)
}

function sameNumberArray(left: readonly number[], right: readonly number[]) {
    return left.length === right.length && left.every((value, index) => value === right[index])
}

function usableSitesQuery(tenantId: string | number, req: TenantTransactionRequest) {
    const where: Where = {
        and: [
            { tenant: { equals: tenantId } },
            {
                or: [
                    { generationStatus: { equals: 'completed' } },
                    { generationStatus: { equals: 'none' } },
                    { generationStatus: { equals: null } },
                    { generationStatus: { exists: false } },
                ],
            },
        ],
    }
    return {
        collection: 'sites' as const,
        where,
        limit: MAX_FIXTURE_SITES + 1,
        depth: 0,
        overrideAccess: true,
        req,
    }
}

/**
 * Prepare the dedicated staging tenant for GH-1700 without manufacturing an
 * EasyParcel connection. Persistent E2E UI state is reconciled idempotently so
 * retries and prior Editor/Shipping runs converge on the same browser fixture.
 */
export async function prepareDashboardEasyParcelOnlyState(
    payload: Payload,
    tenantId: string | number,
): Promise<{ siteIds: string[] }> {
    return withTenantRowLock(payload, tenantId, async (req) => {
        const [tenant, sitesResult] = await Promise.all([
            payload.findByID({
                collection: 'tenants',
                id: tenantId,
                depth: 0,
                overrideAccess: true,
                showHiddenFields: true,
                req,
            }) as Promise<ShippingFixtureTenant>,
            payload.find(usableSitesQuery(tenantId, req)),
        ])
        const integration = tenant.easyParcelIntegration
        const normalizedIntegration = integration
            ? { ...integration, warehouse: normalizeWarehouse(integration.warehouse) }
            : undefined
        const activationSafe = integration?.enabled === true
            && Boolean(integration.accessToken && integration.refreshToken && integration.testedAt)
            && isWarehouseComplete(getDefaultWarehouse(normalizedIntegration))
        const initialSites = sitesResult.docs as ShippingFixtureSite[]

        if (tenant.slug !== DASHBOARD_SHIPPING_FIXTURE_TENANT_SLUG) {
            throw new DashboardShippingPrerequisiteError('TENANT_MISMATCH')
        }
        if (!activationSafe) {
            throw new DashboardShippingPrerequisiteError('EASYPARCEL_NOT_READY')
        }
        if (initialSites.length < 1 || initialSites.length > MAX_FIXTURE_SITES) {
            throw new DashboardShippingPrerequisiteError('DASHBOARD_NOT_READY')
        }

        const initialSiteIds = fixtureSiteIds(initialSites)
        await lockTenantSiteRows(payload, tenantId, initialSiteIds, req)
        const lockedSitesResult = await payload.find(usableSitesQuery(tenantId, req))
        const sites = lockedSitesResult.docs as ShippingFixtureSite[]
        const lockedSiteIds = fixtureSiteIds(sites)
        if (!sameNumberArray(initialSiteIds, lockedSiteIds)) {
            throw new Error('Dashboard shipping fixture site set changed during preparation')
        }

        const settings = isRecord(tenant.settings) ? tenant.settings : {}
        const dashboardPreferences = canonicalDashboardPreferences(settings.dashboardPreferences)
        if (!sameStringArray(settings.dashboardPreferences, dashboardPreferences)) {
            await payload.update({
                collection: 'tenants',
                id: tenantId,
                data: {
                    settings: {
                        ...settings,
                        dashboardPreferences,
                    },
                },
                overrideAccess: true,
                req,
            })
        }

        for (const site of sites) {
            const resetTheme = site.themeCustomized === true
            const resetSelfDelivery = isRecord(site.shippingConfig)
                && site.shippingConfig.shippingSetupConfirmed === true
            if (resetTheme || resetSelfDelivery) {
                await payload.update({
                    collection: 'sites',
                    id: site.id,
                    data: {
                        ...(resetTheme ? { themeCustomized: false } : {}),
                        ...(resetSelfDelivery
                            ? { shippingConfig: { shippingSetupConfirmed: false } }
                            : {}),
                    },
                    overrideAccess: true,
                    req,
                })
            }
        }

        return {
            siteIds: lockedSiteIds.map(String),
        }
    })
}
