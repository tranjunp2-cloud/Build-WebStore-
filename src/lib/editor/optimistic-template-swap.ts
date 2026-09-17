import { BLOCKS_TEMP_HIDDEN } from '@/lib/ai/unsupported-blocks'
import { coerceVideoVariants } from '@/lib/ai/coerce-video-variants'
import { mergeUserContent } from '@/lib/ai/merge-user-content'
import { sanitizeBlocksForPayload } from '@/lib/ai/pages-schema'
import { normalizeBlocksForPersistence } from '@/lib/block-normalization'
import { ensureCartGlobalBlock } from '@/lib/ai/ensure-cart-global-block'
import { restoreTemplateRenderMedia } from './template-render-media'
import { buildTemplateTheme } from '@/lib/ai/template-theme'

export type OptimisticTemplateInput = {
    defaultBlocks?: Record<string, unknown>[] | null
    templatePages?: Array<{
        isHomepage?: boolean
        layout?: Record<string, unknown>[] | null
    }> | null
    defaultTheme?: Record<string, unknown> | null
}

export type OptimisticTemplateSwapState = {
    blocks: Record<string, unknown>[]
    theme: Record<string, unknown>
    headerBlock: Record<string, unknown> | null
    footerBlock: Record<string, unknown> | null
    globalBlocks: Record<string, unknown> | null
}

type TemplateSystemBlocks = Pick<OptimisticTemplateSwapState, 'headerBlock' | 'footerBlock' | 'globalBlocks'>

/** Shared canonical mapping for the optimistic preview and persisted swap. */
export function buildTemplateSystemBlocks(
    templateBlocks: Record<string, unknown>[],
    current: Partial<TemplateSystemBlocks>,
    layout: Record<string, unknown>[],
): TemplateSystemBlocks {
    const mergeSystemBlock = (type: string, block: Record<string, unknown> | null | undefined) => {
        const templateBlock = templateBlocks.find(candidate => candidate.blockType === type)
        if (!templateBlock) return block ?? null
        const [merged] = normalizeBlocksForPersistence(mergeUserContent([templateBlock], block ? [block] : []))
        // Sites canonical blocks are JSON, not upload relationship columns.
        // Keep known media URLs here too so reloading the saved draft renders logos.
        return restoreTemplateRenderMedia(merged, [block])
    }
    const headerBlock = mergeSystemBlock('navigation', current.headerBlock)
    const footerBlock = mergeSystemBlock('footer', current.footerBlock)
    const cartPatch = ensureCartGlobalBlock(current.globalBlocks, [{ layout }], headerBlock)
    return {
        headerBlock,
        footerBlock,
        globalBlocks: 'globalBlocks' in cartPatch ? cartPatch.globalBlocks : current.globalBlocks ?? null,
    }
}

const TEMPLATE_STRUCTURE_FIELDS = [
    'variant', 'layout', 'style', 'badge', 'showSocialLinks', 'showMap',
] as const

export function applyTemplateStructureToLayout(
    templateBlocks: Record<string, unknown>[],
    currentBlocks: Record<string, unknown>[],
): Record<string, unknown>[] {
    const structureByType: Record<string, Record<string, unknown>> = {}
    for (const templateBlock of templateBlocks) {
        const blockType = templateBlock.blockType as string
        if (!blockType || structureByType[blockType]) continue
        const structure: Record<string, unknown> = {}
        for (const field of TEMPLATE_STRUCTURE_FIELDS) {
            if (templateBlock[field] !== undefined) structure[field] = templateBlock[field]
        }
        structureByType[blockType] = structure
    }

    return currentBlocks.map(block => {
        const structure = structureByType[block.blockType as string]
        return structure && Object.keys(structure).length > 0
            ? { ...block, ...structure }
            : block
    })
}

/**
 * Build the visible homepage swap without waiting for the persistence round trip.
 * The API repeats the same sanitise + smart-map pipeline inside its transaction and
 * returns the committed snapshot that replaces this optimistic state on success.
 */
export function buildOptimisticTemplateSwap(
    template: OptimisticTemplateInput,
    currentBlocks: Record<string, unknown>[],
    _currentTheme: Record<string, unknown>,
    options: { isHomepage?: boolean } & Partial<TemplateSystemBlocks> = {},
): OptimisticTemplateSwapState | null {
    const templatePage = template.templatePages?.find(page => page.isHomepage)
        ?? template.templatePages?.[0]
    const sourceBlocks = templatePage?.layout?.length
        ? templatePage.layout
        : template.defaultBlocks
    if (!sourceBlocks?.length) return null

    const allSourceBlocks = template.templatePages?.length
        ? template.templatePages.flatMap(page => page.layout ?? [])
        : sourceBlocks
    const clonedBlocks = structuredClone(options.isHomepage === false ? allSourceBlocks : sourceBlocks)
    coerceVideoVariants(clonedBlocks)
    const sanitized = sanitizeBlocksForPayload(clonedBlocks)
        .filter(block => block.blockType !== 'google-maps')
        .filter(block => !BLOCKS_TEMP_HIDDEN.has(block.blockType as string))
    const merged = options.isHomepage === false
        ? applyTemplateStructureToLayout(sanitized, currentBlocks)
        : mergeUserContent(sanitized, currentBlocks)
    const normalized = normalizeBlocksForPersistence(merged)
    const footer = normalized.find(block => block.blockType === 'footer')
    const body = normalized.filter(block => block.blockType !== 'footer')
    const canonicalSource = structuredClone(sourceBlocks)
    coerceVideoVariants(canonicalSource)
    const systemBlocks = buildTemplateSystemBlocks(sanitizeBlocksForPayload(canonicalSource), {
        headerBlock: options.headerBlock ?? currentBlocks.find(block => block.blockType === 'navigation'),
        footerBlock: options.footerBlock ?? currentBlocks.find(block => block.blockType === 'footer'),
        globalBlocks: options.globalBlocks,
    }, normalized)

    return restoreTemplateRenderMedia({
        ...systemBlocks,
        blocks: footer ? [...body, footer] : body,
        theme: buildTemplateTheme(template.defaultTheme),
    }, [currentBlocks, options.headerBlock, options.footerBlock, options.globalBlocks])
}
