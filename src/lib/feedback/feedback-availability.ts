import { getPayload } from 'payload'
import config from '@payload-config'

/** Feedback closes after 15/11/2026 23:59:59 MYT (UTC+8), i.e. at 16:00 UTC; before that it is always open. */
const WINDOW_END_MS = Date.UTC(2026, 10, 15, 16, 0, 0)

export const isFeedbackWindowOpen = (now: number = Date.now()) => now < WINDOW_END_MS

export type FeedbackTypeKey = 'problem' | 'mismatch' | 'suggestion'

/** "Data mismatch" only makes sense for stores that moved over from V1. */
export const feedbackTypesFor = (isMigratedStore: boolean): FeedbackTypeKey[] =>
    isMigratedStore ? ['problem', 'mismatch', 'suggestion'] : ['problem', 'suggestion']

export type TenantInfo = { storeName: string | null; isMigratedStore: boolean }

/** Store name + migration flag from the DB (never the client). Fail-open: a lookup error only drops them. */
export async function lookupTenantInfo(tenantId: string | number | null): Promise<TenantInfo> {
    if (!tenantId) return { storeName: null, isMigratedStore: false }
    try {
        const payload = await getPayload({ config })
        const tenant = (await payload.findByID({
            collection: 'tenants',
            id: tenantId,
            depth: 0,
            select: { name: true, migrationStatus: true },
        })) as { name?: string; migrationStatus?: string }
        return { storeName: tenant.name?.trim() || null, isMigratedStore: tenant.migrationStatus === 'migrated' }
    } catch (err) {
        console.error('[feedback] tenant lookup failed', err instanceof Error ? err.message : err)
        return { storeName: null, isMigratedStore: false }
    }
}
