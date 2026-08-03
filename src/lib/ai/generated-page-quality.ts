type Block = Record<string, unknown>

export interface GeneratedQualityPage {
    slug?: string
    isHomepage?: boolean
    blocks: Block[]
}

const SINGLETON_BLOCK_TYPES = new Set(['contact'])

function normalizeText(value: unknown): string {
    return typeof value === 'string'
        ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
        : ''
}

function serviceCardsFingerprint(block: Block): string | null {
    if (block.blockType !== 'service-cards' || !Array.isArray(block.services)) return null

    const services = block.services
        .filter((service): service is Block => Boolean(service) && typeof service === 'object')
        .map((service) => [
            normalizeText(service.title),
            normalizeText(service.description),
            normalizeText(service.icon),
        ].join('|'))
        .filter((service) => service !== '||')
        .sort()

    return services.length > 0 ? JSON.stringify(services) : null
}

function canonicalSlug(page: GeneratedQualityPage): string {
    if (page.isHomepage) return '/'
    const slug = String(page.slug ?? '').trim().toLocaleLowerCase()
    if (!slug || slug === '/') return '/'
    return `/${slug.replace(/^\/+/, '')}`
}

/**
 * Keep one canonical instance of block types that represent a single page
 * capability. Aliases are normalized before this runs, so `contact-form` and
 * `contact` both arrive as `contact`.
 */
export function dedupePageSingletonBlocks(blocks: Block[]): Block[] {
    const seen = new Set<string>()
    return blocks.filter((block) => {
        const blockType = typeof block.blockType === 'string' ? block.blockType : ''
        if (!SINGLETON_BLOCK_TYPES.has(blockType)) return true
        if (seen.has(blockType)) return false
        seen.add(blockType)
        return true
    })
}

/**
 * Exact service-card payloads should have one semantic owner across a site.
 * Prefer `/services`, then the homepage, then the first occurrence. Unique
 * service-card sections remain untouched.
 */
export function dedupeRepeatedServiceCardsAcrossPages<T extends GeneratedQualityPage>(
    pages: T[],
): { pages: T[]; removedCount: number } {
    const occurrences = new Map<string, Array<{ pageIndex: number; blockIndex: number }>>()

    pages.forEach((page, pageIndex) => {
        page.blocks.forEach((block, blockIndex) => {
            const fingerprint = serviceCardsFingerprint(block)
            if (!fingerprint) return
            const entries = occurrences.get(fingerprint) ?? []
            entries.push({ pageIndex, blockIndex })
            occurrences.set(fingerprint, entries)
        })
    })

    const removals = new Map<number, Set<number>>()
    let removedCount = 0

    for (const entries of occurrences.values()) {
        if (entries.length < 2) continue

        const owner = [...entries].sort((a, b) => {
            const priority = (entry: { pageIndex: number }) => {
                const slug = canonicalSlug(pages[entry.pageIndex]!)
                if (slug === '/services') return 0
                if (slug === '/') return 1
                return 2
            }
            return priority(a) - priority(b) || a.pageIndex - b.pageIndex
        })[0]!

        for (const entry of entries) {
            if (entry.pageIndex === owner.pageIndex && entry.blockIndex === owner.blockIndex) continue
            const pageRemovals = removals.get(entry.pageIndex) ?? new Set<number>()
            pageRemovals.add(entry.blockIndex)
            removals.set(entry.pageIndex, pageRemovals)
            removedCount++
        }
    }

    if (removedCount === 0) return { pages, removedCount }

    return {
        pages: pages.map((page, pageIndex) => {
            const pageRemovals = removals.get(pageIndex)
            if (!pageRemovals) return page
            return {
                ...page,
                blocks: page.blocks.filter((_block, blockIndex) => !pageRemovals.has(blockIndex)),
            }
        }),
        removedCount,
    }
}
