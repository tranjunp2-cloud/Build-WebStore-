export function extractFirstGlobalBlock(
    pages: Array<{ layout?: unknown[] }>,
    blockType: string,
): Record<string, unknown> | null {
    for (const page of pages) {
        if (!Array.isArray(page.layout)) continue
        for (const b of page.layout) {
            if (b == null || typeof b !== 'object') continue
            if ((b as { blockType?: string }).blockType === blockType) {
                return b as Record<string, unknown>
            }
        }
    }
    return null
}
