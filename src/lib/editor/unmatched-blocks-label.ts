type BlockNames = Record<string, { name?: string } | undefined>

/** "custom-html" → "Custom html": a block type the name table does not know yet still reads as words. */
function words(type: string): string {
    const text = type.replace(/[-_]+/g, ' ').trim()
    return text ? text[0]!.toUpperCase() + text.slice(1) : type
}

/**
 * The template-swap toast names the sections left out as the merchant knows them (the Components panel names),
 * never raw block types: "portfolio-grid, carousel" → "Portfolio grid, Carousel". The same type twice reads "Carousel ×2".
 */
export function unmatchedBlocksLabel(types: readonly string[], names: BlockNames): string {
    const counts = new Map<string, number>()
    for (const type of types) {
        const name = names[type]?.name?.trim() || words(type)
        counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ')
}
