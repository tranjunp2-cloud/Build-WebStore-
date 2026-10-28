/**
 * The editor's automatic translation of a page's sections when a language is added or switched to.
 *
 * Each section is translated FROM the written language (`getSourceBlock`), and its slot is written only when
 * the translation was really made: a failed one leaves the slot empty (so the next switch retries) and is
 * counted for the "could not translate" notice. A superseded switch (`signal` aborted) writes nothing and is
 * not a failure.
 */
import type { BlockData } from '@/store/editorStore'
import { requestTranslation } from './request-translation'
import { isTemplateText } from './template-content'

export type SectionTranslationDeps = {
    /** the section in the written language */
    getSourceBlock: (block: BlockData) => BlockData
    /** the section's current copy in `locale`, if any */
    getSlot: (blockId: string) => Record<string, unknown> | undefined
    /** stores the copy; returns what the slot now holds */
    setSlot: (blockId: string, translated: Record<string, unknown>) => Record<string, unknown> | undefined
    /** fields that are not text to translate (pictures, links, business data, structure) */
    skipFields: ReadonlySet<string>
    signal: AbortSignal
}

export async function translateSectionsIntoSlots(
    blocks: readonly BlockData[],
    locale: string,
    deps: SectionTranslationDeps,
): Promise<{ written: Record<string, Record<string, unknown>>; failed: number }> {
    const written: Record<string, Record<string, unknown>> = {}
    let failed = 0
    await Promise.all(blocks.map(async (block) => {
        if (!block.id) return
        const id = block.id as string
        const existing = deps.getSlot(id)
        if (existing && Object.keys(existing).length > 0) return

        const translatable = Object.fromEntries(
            Object.entries(deps.getSourceBlock(block) as Record<string, unknown>).filter(([key, value]) =>
                !deps.skipFields.has(key) && (typeof value === 'string' || Array.isArray(value) || (value !== null && typeof value === 'object')),
            ),
        )
        if (Object.keys(translatable).length === 0) return

        // F26: cache key = blockType + the block's unique id, so the translate cache is scoped per block
        // instance (no cross-site or cross-page collision) while still reusing on switch-back.
        const result = await requestTranslation({ blockType: `${String(block.blockType || '')}-${id}`, targetLocale: locale, content: translatable, signal: deps.signal })
        if (!result.ok) {
            if (result.reason !== 'aborted') failed++
            return
        }
        // F26-04: stale flow must not write.
        if (deps.signal.aborted) return
        const slot = deps.setSlot(id, result.translated)
        if (slot) written[id] = slot
    }))
    return { written, failed }
}

/**
 * The text of a section just added that is worth translating: the section's own text without the fields that
 * are not text (`skipFields`). Null while that text is still the editor's template text in some language: the
 * merchant has written nothing yet, and a translated template would be filler stored as a translation.
 */
export function ownTextToTranslate(
    source: Record<string, unknown>,
    blockType: string,
    skipFields: ReadonlySet<string>,
    brand: string,
): Record<string, unknown> | null {
    const text = Object.fromEntries(Object.entries(source).filter(([key]) => !skipFields.has(key)))
    if (Object.keys(text).length === 0 || isTemplateText(blockType, text, brand)) return null
    return text
}
