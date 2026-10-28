import type { Payload } from 'payload'

/**
 * The layout a new page starts from: the homepage's navigation and footer
 * (system fields stripped so Payload creates fresh rows) around the page's own
 * sections. Used by POST /api/sites/[siteId]/pages and the web builder
 * copilot's `site.page_create`.
 */

export type LayoutBlock = Record<string, unknown> & { blockType: string }

const STRIP_KEYS = new Set(['id', '_order', '_parent_id', '_path', '_uuid', 'createdAt', 'updatedAt'])

/** Recursively strip Payload system fields so Payload creates fresh records. */
export function stripSystemFields(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(stripSystemFields)
    if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(obj)) {
            if (STRIP_KEYS.has(key)) continue
            result[key] = stripSystemFields(val)
        }
        return result
    }
    return obj
}

/** The homepage's navigation and footer blocks, or null when there is none. Throws on a failed read. */
export async function homepageFrame(
    payload: Payload,
    siteId: string | number,
    req?: unknown,
): Promise<{ nav: LayoutBlock | null; footer: LayoutBlock | null; found: boolean }> {
    const homepageResult = await payload.find({
        collection: 'pages',
        where: { site: { equals: siteId }, isHomepage: { equals: true } },
        limit: 1,
        depth: 2,
        ...(req ? { req } : {}),
    } as Parameters<Payload['find']>[0])
    const homepage = homepageResult.docs[0] as { layout?: LayoutBlock[] } | undefined
    if (!homepage?.layout) return { nav: null, footer: null, found: false }
    const nav = homepage.layout.find(b => b.blockType === 'navigation')
    const footer = homepage.layout.find(b => b.blockType === 'footer')
    return {
        nav: nav ? (stripSystemFields(nav) as LayoutBlock) : null,
        footer: footer ? (stripSystemFields(footer) as LayoutBlock) : null,
        found: true,
    }
}
