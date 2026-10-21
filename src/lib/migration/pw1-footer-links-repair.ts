type Link = { label: string; url?: string; imageUrl?: string }
type Column = { title?: string; text?: string; links?: Link[] }

export type FooterLinksRepair = { changed: false } | { changed: true; footer: Record<string, unknown>; columns: string[] }

const sameTitle = (a?: string, b?: string) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
const asLink = ({ label, url, imageUrl }: Link) => ({ label, url: url ?? '', ...(imageUrl ? { imageUrl } : {}) })

/**
 * Older migrations kept footer rich-text lines as plain text, so a column such as "Our Services" lost its
 * hyperlinks (the label text stays). `sourceColumns` are the columns the current input adapter produces from the PW1 export (links
 * already resolved to PW2 routes). A generated column with text that holds fewer links than its source counterpart takes the
 * source links (minus the footer's social icon links) and text; every other column and footer field stays exactly as it is.
 */
export function repairFooterLinks(footer: unknown, sourceColumns: Column[]): FooterLinksRepair {
    if (!footer || typeof footer !== 'object' || !Array.isArray((footer as { columns?: unknown }).columns)) return { changed: false }
    const current = footer as { columns: Column[]; socials?: Array<{ url?: string }> }
    // PW1 lists icon links (Facebook, YouTube...) in the column too; the migration shows them as the footer's social icons only
    const socialUrls = new Set((current.socials ?? []).map(social => social.url))
    const repaired: string[] = []
    const columns = current.columns.map(column => {
        const source = sourceColumns.find(candidate => sameTitle(candidate.title, column.title))
        const sourceLinks = (source?.links ?? []).filter(link => !socialUrls.has(link.url))
        // A flattened column keeps its link labels as text; a column without text lost links on purpose (broken or unresolved source links are dropped)
        if (!source || !sourceLinks.length || !column.text?.trim() || (column.links?.length ?? 0) >= sourceLinks.length) return column
        repaired.push(column.title ?? '')
        const { text: _text, ...rest } = column
        return { ...rest, links: sourceLinks.map(asLink), ...(source.text ? { text: source.text } : {}) }
    })
    return repaired.length ? { changed: true, footer: { ...current, columns }, columns: repaired } : { changed: false }
}
