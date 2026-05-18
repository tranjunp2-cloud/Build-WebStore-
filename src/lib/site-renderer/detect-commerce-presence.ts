const COMMERCE_BLOCK_TYPES = new Set(['products-grid', 'products-featured', 'product-quick-view'])

export function detectCommercePresence(pages: Array<{ layout?: unknown[] }>): boolean {
    return pages.some(p =>
        Array.isArray(p.layout) &&
        p.layout.some(b =>
            b != null &&
            typeof b === 'object' &&
            COMMERCE_BLOCK_TYPES.has((b as { blockType?: string }).blockType ?? '')
        )
    )
}
