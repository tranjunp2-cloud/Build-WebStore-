/**
 * Unsupported-block drop list — shared between AI happy path (openai-generator)
 * and fallback path (fallback-adapter / composer output).
 *
 * Reason these blocks are dropped:
 *   1. MEDIA_PIPELINE: Payload upload fields require Media IDs, but AI + composer
 *      only provide URL strings. Until a download-and-upload pipeline lands, the
 *      blocks render as empty placeholders or trigger 500 on save.
 *   2. NOT_IN_PAYLOAD: blockType not registered in `src/collections/Pages.ts`
 *      `layout.blocks` — Payload silently drops on save. Better to drop early so
 *      SSE event count matches what the user actually sees in the builder.
 *
 * Historical context: commit fc0020d introduced these lists inline in
 * `generateSiteWithAI.validateBlocks()`. Phase-06 (commit 9bf02d4) rewired the
 * fallback path to composer output, which also emits these blocks — so the same
 * filter must apply there. Extracted here to avoid drift.
 */

/** Blocks needing a media pipeline that does not exist yet.
 *  Re-enabled via plan 260414-1400-ai-gen-unsplash-pipeline phase-04:
 *    - gallery, portfolio-grid → now filled by media-pipeline.ts (Unsplash)
 *  Still dropped (separate followup):
 *    - before-after (needs Payload schema migration per validation Q3)
 *    - menu-display, review-cards, booking-widget (not image-related)
 *  GH-820: google-maps temporarily disabled — embedUrl cannot be auto-generated
 */
export const BLOCKS_REQUIRE_MEDIA_PIPELINE: ReadonlySet<string> = new Set([
    'before-after',
    'menu-display',
    'review-cards',
    'booking-widget',
    'google-maps',
])

/** Blocks registered in Payload schema but not yet production-ready.
 *  Dropped from all generation paths until implementation is complete.
 *  Remove entry here + from EDITOR_HIDDEN_BLOCKS in block-registry-reader when ready.
 */
export const BLOCKS_NOT_READY: ReadonlySet<string> = new Set([
    'class-schedule',
])

/** Blocks missing from Payload Pages.ts layout.blocks — silently dropped on save. */
export const BLOCKS_NOT_IN_PAYLOAD: ReadonlySet<string> = new Set([
    'before-after',
    'menu-display',
    'review-cards',
    'booking-widget',
])

/**
 * Returns true if the given blockType should be dropped before reaching Payload.
 * Both lists OR'd together — the union is what ends up being rejected.
 */
export function isUnsupportedBlock(blockType: string): boolean {
    return BLOCKS_REQUIRE_MEDIA_PIPELINE.has(blockType)
        || BLOCKS_NOT_IN_PAYLOAD.has(blockType)
        || BLOCKS_NOT_READY.has(blockType)
}

/**
 * Filter an array of blocks, removing any that match the drop list.
 * Logs a warning for each dropped block so ops can trace SSE event count drops.
 */
export function filterUnsupportedBlocks<T extends { blockType?: unknown }>(
    blocks: readonly T[],
    context: 'ai' | 'fallback',
): T[] {
    const out: T[] = []
    for (const block of blocks) {
        const blockType = typeof block.blockType === 'string' ? block.blockType : ''
        if (!blockType) continue
        if (isUnsupportedBlock(blockType)) {
            console.warn(
                `[${context === 'ai' ? 'AI' : 'Fallback'}] Dropping "${blockType}" — needs media pipeline or not in Payload schema`,
            )
            continue
        }
        out.push(block)
    }
    return out
}
