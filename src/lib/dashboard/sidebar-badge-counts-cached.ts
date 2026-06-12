import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { SidebarBadgeKey } from '@/components/dashboard/Sidebar'
import { getSidebarBadgeCounts } from './sidebar-badge-counts'

/**
 * Cached wrapper for the sidebar badge counts (F18 #1138).
 *
 * The raw counts run ~6 DB queries; the dashboard layout renders on EVERY route, so without
 * caching every navigation would re-query and block paint. Badges don't need to be realtime,
 * so we cache per-tenant for 60s — keeping the counts off the critical render path. Pure
 * compute (and its unit tests) live in ./sidebar-badge-counts; this file owns the Next cache +
 * payload session so the pure module stays free of framework/config imports.
 *
 * Invalidate early via revalidateTag(`sidebar-badge-counts:${tenantId}`) if/when needed.
 */
export function getCachedSidebarBadgeCounts(
    tenantId: string | null,
): Promise<Partial<Record<SidebarBadgeKey, number>>> {
    if (!tenantId) return Promise.resolve({})

    return unstable_cache(
        async () => {
            const payload = await getPayload({ config: configPromise })
            return getSidebarBadgeCounts(payload, tenantId)
        },
        ['sidebar-badge-counts', tenantId],
        { revalidate: 60, tags: [`sidebar-badge-counts:${tenantId}`] },
    )()
}
