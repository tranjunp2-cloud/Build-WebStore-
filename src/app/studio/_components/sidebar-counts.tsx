/**
 * SidebarCounts — server component that fetches real nav badge counts.
 * Runs in parallel via Promise.allSettled so a single query failure shows 0.
 * Called from studio/layout.tsx and passed as prop to AdminSidebar.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

export type SidebarCounts = {
    templates: number
    drafts: number
    review: number
    scheduled: number
    issues: number
}

async function safeCount(
    fn: () => Promise<number>,
    fallback = 0,
): Promise<number> {
    try {
        return await fn()
    } catch {
        return fallback
    }
}

export async function fetchSidebarCounts(): Promise<SidebarCounts> {
    const payload = await getPayload({ config })

    const [templates, drafts, review, scheduled, issues] = await Promise.all([
        safeCount(async () => {
            const r = await payload.count({ collection: 'templates' })
            return r.totalDocs
        }),
        safeCount(async () => {
            const r = await payload.count({
                collection: 'templates',
                where: { status: { equals: 'draft' } },
            })
            return r.totalDocs
        }),
        safeCount(async () => {
            const r = await payload.count({
                collection: 'templates',
                where: { status: { equals: 'review' } },
            })
            return r.totalDocs
        }),
        safeCount(async () => {
            const r = await payload.count({
                collection: 'templates',
                where: { status: { equals: 'scheduled' } },
            })
            return r.totalDocs
        }),
        safeCount(async () => {
            const r = await payload.count({
                collection: 'template-issues',
                where: { status: { in: ['open', 'in-review'] } },
            })
            return r.totalDocs
        }),
    ])

    return { templates, drafts, review, scheduled, issues }
}
