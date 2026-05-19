import { extractFirstGlobalBlock } from './extract-first-global-block'
import { detectCommercePresence } from './detect-commerce-presence'
import { hasHeaderCart } from './has-header-cart'

type PreviewBlock = { blockType: string; __editorBlockIndex?: number; [key: string]: unknown }

// Each floating global block type gets a unique negative editor index so the editor
// can distinguish them by blockIndex (avoiding the "first -1 wins" lookup bug).
// These values must stay stable — they're stored in data-block-index attributes.
const FLOATING_BLOCK_EDITOR_INDICES: Record<string, number> = {
    cartWidget: -1,
    'whatsapp-button': -2,
    socialWidget: -3,
}
function floatingEditorIndex(blockType: string): number {
    const idx = FLOATING_BLOCK_EDITOR_INDICES[blockType]
    if (idx === undefined) {
        // Unregistered block type — defaulting to -1 would collide with cartWidget.
        // Add the new type to FLOATING_BLOCK_EDITOR_INDICES above.
        throw new Error(`floatingEditorIndex: unknown floating block type "${blockType}" — add it to FLOATING_BLOCK_EDITOR_INDICES`)
    }
    return idx
}

/**
 * Applies a single global floating block (cart, whatsapp, social) to nextBlocks.
 *
 * Priority:
 *  1. site.globalBlocks[key] present → strip any stale copies from page layout, push global entry.
 *  2. BC fallback → page-scan (extractFirstGlobalBlock) + optional auto-inject (cart only).
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
        // Strip any stale copies of this block type, then push the authoritative global entry.
        const deduped = nextBlocks.filter(b => b.blockType !== blockType)
        deduped.push({ ...globalEntry, blockType, variant: 'floating', __editorBlockIndex: floatingEditorIndex(blockType) })
        return deduped
    }

    // null = user explicitly disabled this block; strip stale copies and skip all fallbacks.
    if (globalEntry === null) {
        return nextBlocks.filter(b => b.blockType !== blockType)
    }

    // undefined = not yet configured; use BC fallbacks below.
    // BC fallback: promote the first page-level copy found.
    const placedBlock = extractFirstGlobalBlock(pages, blockType)
    if (placedBlock) {
        const alreadyPresent = nextBlocks.some(b => b.blockType === blockType)
        if (!alreadyPresent) {
            return [...nextBlocks, { blockType, ...placedBlock, variant: 'floating', __editorBlockIndex: floatingEditorIndex(blockType) }]
        }
        return nextBlocks
    }

    if (options?.autoInject && detectCommercePresence(pages) && !hasHeaderCart(options.siteHeaderBlock)) {
        const alreadyPresent = nextBlocks.some(b => b.blockType === blockType)
        if (!alreadyPresent) {
            return [...nextBlocks, { blockType, variant: 'floating', __editorBlockIndex: floatingEditorIndex(blockType) }]
        }
    }

    return nextBlocks
}
