type Link = { label: string; url?: string; imageUrl?: string }
type Column = { title?: string; text?: string; links?: Link[] }

export type FooterLinksRepair = { changed: false } | { changed: true; footer: Record<string, unknown>; columns: string[] }

const sameTitle = (a?: string, b?: string) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
const asLink = ({ label, url, imageUrl }: Link) => ({ label, url: url ?? '', ...(imageUrl ? { imageUrl } : {}) })

/**
 * Older migrations kept footer rich-text lines as plain text, so a column such as "Our Services" lost its
 * hyperlinks. `sourceColumns` are the columns the current input adapter produces from the PW1 export (links
 * already resolved to PW2 routes). A generated column that holds fewer links than its source counterpart takes the
 * source links and text; every other column and footer field stays exactly as it is.
 */
export function repairFooterLinks(footer: unknown, sourceColumns: Column[]): FooterLinksRepair {
    if (!footer || typeof footer !== 'object' || !Array.isArray((footer as { columns?: unknown }).columns)) return { changed: false }
    const current = footer as { columns: Column[] }
    const repaired: string[] = []
    const columns = current.columns.map(column => {
        const source = sourceColumns.find(candidate => sameTitle(candidate.title, column.title))
        if (!source?.links?.length || (column.links?.length ?? 0) >= source.links.length) return column
        repaired.push(column.title ?? '')
        const { text: _text, ...rest } = column
        return { ...rest, links: source.links.map(asLink), ...(source.text ? { text: source.text } : {}) }
    })
    return repaired.length ? { changed: true, footer: { ...current, columns }, columns: repaired } : { changed: false }
}
