import { extractFirstGlobalBlock } from './extract-first-global-block'
import { detectCommercePresence } from './detect-commerce-presence'
import { hasHeaderCart } from './has-header-cart'

type PreviewBlock = { blockType: string; __editorBlockIndex?: number; [key: string]: unknown }

type GlobalBlocks = {
    cartWidget?: Record<string, unknown> | null
    whatsappButton?: Record<string, unknown> | null
    socialWidget?: Record<string, unknown> | null
} | null | undefined

/**
 * Applies a single global floating block (cart, whatsapp, social) to nextBlocks.
 *
 * Priority:
 *  1. site.globalBlocks[key] present → use it, strip stale floating copies from page layout.
 *  2. BC fallback → existing page-scan (extractFirstGlobalBlock) + optional auto-inject.
 *
 * Inline-variant blocks from page.layout are NEVER stripped.
 */
export function applyGlobalBlock(
    nextBlocks: PreviewBlock[],
    blockType: string,
    globalEntry: Record<string, unknown> | null | undefined,
    pages: Array<{ layout?: unknown[] }>,
    options?: {
        autoInject?: boolean
        siteHeaderBlock?: PreviewBlock | null
    },
): PreviewBlock[] {
    if (globalEntry) {
        // Global path: strip stale floating copies, push the authoritative global entry.
        const deduped = nextBlocks.filter(
            b => b.blockType !== blockType || (b as Record<string, unknown>).variant === 'inline',
        )
        deduped.push({ ...globalEntry, blockType, variant: 'floating', __editorBlockIndex: -1 })
        return deduped
    }

    // BC fallback: page-scan first, auto-inject second (cart only).
    const placedBlock = extractFirstGlobalBlock(pages, blockType)
    if (placedBlock) {
        const hasFloating = nextBlocks.some(
            b => b.blockType === blockType && (b as Record<string, unknown>).variant !== 'inline',
        )
        if (!hasFloating) {
            return [...nextBlocks, { blockType, ...placedBlock, variant: 'floating', __editorBlockIndex: -1 }]
        }
        return nextBlocks
    }

    if (options?.autoInject && detectCommercePresence(pages) && !hasHeaderCart(options.siteHeaderBlock)) {
        const hasAny = nextBlocks.some(b => b.blockType === blockType)
        if (!hasAny) {
            return [...nextBlocks, { blockType, variant: 'floating', __editorBlockIndex: -1 }]
        }
    }

    return nextBlocks
}
