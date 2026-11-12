import type { Payload, Where } from 'payload'
import { referencedMediaIds } from '@/lib/ai-platform/media-access'

/**
 * The dashboard Media library of one workspace (TC-PERF-168). Same ownership rule as the copilot's picture library
 * (`lib/ai-platform/media-access.ts`), all file types:
 *   1. media whose `tenant` is the workspace (uploaded by it, stock pictures the copilot saved for it), and
 *   2. legacy media without a tenant (uploaded before the column existed) that the workspace's sites, pages,
 *      products or blogs already use — so a shop still finds the old pictures its storefront shows.
 * Never private rows (buyer payment receipts: the order page shows those), never another shop's files, never an
 * untenanted file nobody here uses (other shops' legacy uploads, the shared stock library, avatars).
 */

type Cms = Pick<Payload, 'find'>
type FindArgs = Parameters<Payload['find']>[0]
type MediaRow = Record<string, unknown> & { id: number | string; createdAt?: string }

export const MEDIA_LIBRARY_LIMIT = 200

const NOT_PRIVATE: Where = { private: { not_equals: true } }
const asId = (value: string | number) => (/^\d+$/.test(String(value)) ? Number(value) : value)

export async function listWorkspaceMediaLibrary(cms: Cms, tenantId: string | number, limit = MEDIA_LIBRARY_LIMIT): Promise<MediaRow[]> {
    if (tenantId === '' || tenantId == null) return []
    const find = (where: Where) =>
        cms.find({ collection: 'media', where, sort: '-createdAt', limit, depth: 0, overrideAccess: true } as FindArgs)

    const [owned, used] = await Promise.all([
        find({ and: [{ tenant: { equals: asId(tenantId) } }, NOT_PRIVATE] }),
        referencedMediaIds(cms, String(tenantId)),
    ])
    const rows = owned.docs as MediaRow[]
    const ownedIds = new Set(rows.map((row) => String(row.id)))
    const legacyIds = [...used].filter((id) => !ownedIds.has(id))
    if (legacyIds.length > 0) {
        const legacy = await find({ and: [{ id: { in: legacyIds.map(asId) } }, { tenant: { exists: false } }, NOT_PRIVATE] })
        rows.push(...(legacy.docs as MediaRow[]))
    }
    return rows
        .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
        .slice(0, limit)
}
