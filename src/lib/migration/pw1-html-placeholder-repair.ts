import { load } from 'cheerio'
import { pw1PlaceholderFilename } from './pw1-placeholder-image-repair'

type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }>

/** Absolute <img> sources inside every html string of the adapted PW1 contract (entities decoded): the images the migration tried to rehost. */
export function htmlImageUrls(value: unknown, found = new Set<string>()): Set<string> {
    if (typeof value === 'string') {
        if (value.includes('<img')) load(value, null, false)('img').each((_, element) => {
            const src = (element.attribs?.src ?? '').trim()
            if (/^https?:\/\//i.test(src)) found.add(src)
        })
    } else if (Array.isArray(value)) for (const item of value) htmlImageUrls(item, found)
    else if (value && typeof value === 'object') for (const item of Object.values(value)) htmlImageUrls(item, found)
    return found
}

export type HtmlPlaceholder = { url: string; placeholderUrl: string }

/** Source images whose rehosted copy in the html is still the neutral placeholder (found by the placeholder file name, which encodes the tenant and the URL hash; the migration hashes the https form of the URL). */
export function htmlPlaceholders(urls: Iterable<string>, tenantId: number | string, placeholders: Array<{ filename: string; url: string | null }>): HtmlPlaceholder[] {
    const byName = new Map(placeholders.flatMap(media => media.url ? [[media.filename, media.url] as const] : []))
    return [...urls].flatMap(url => {
        const placeholderUrl = byName.get(pw1PlaceholderFilename(tenantId, url.replace(/^http:\/\//i, 'https://')))
        return placeholderUrl ? [{ url, placeholderUrl }] : []
    })
}

/** The html with every occurrence of one image URL replaced; the new URL is written entity-encoded, as an attribute value. */
export const swapImageSource = (html: string, from: string, to: string) => html.replaceAll(from, to.replaceAll('&', '&amp;'))

export type HtmlBlockRow = { id: string; page_id: number; html: string }

/**
 * Replaces one image URL in the html of a site's blocks and in the draft versions of those pages.
 * Only that URL changes, so edits elsewhere in the block survive; a block edited since the read is skipped.
 * `beforeWrite` receives each block's previous html (for the backup). Returns the number of blocks updated.
 */
export async function swapHtmlImageSource(query: Query, siteId: number, from: string, to: string, beforeWrite: (block: HtmlBlockRow) => Promise<void>): Promise<number> {
    const { rows } = await query<HtmlBlockRow>(
        `SELECT b.id, b._parent_id AS page_id, b.html FROM pages_blocks_custom_html b JOIN pages p ON p.id = b._parent_id
         WHERE p.site_id = $1 AND strpos(b.html, $2) > 0`, [siteId, from])
    let updated = 0
    for (const block of rows) {
        await beforeWrite(block)
        const current = await query('UPDATE pages_blocks_custom_html SET html = $2 WHERE id = $1 AND html = $3', [block.id, swapImageSource(block.html, from, to), block.html])
        await query(
            `UPDATE _pages_v_blocks_custom_html v SET html = replace(v.html, $2, $3) FROM _pages_v pv
             WHERE v._parent_id = pv.id AND pv.parent_id = $1 AND strpos(v.html, $2) > 0`, [block.page_id, from, to.replaceAll('&', '&amp;')])
        updated += current.rowCount ?? 0
    }
    return updated
}
