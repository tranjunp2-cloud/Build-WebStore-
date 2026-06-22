/**
 * Variant validation — neutral module to break circular dep between
 * openai-generator.ts (happy path) and template-composer.ts (fallback path).
 * Pure function, no IO, no AI, no Payload.
 */

/** Minimum content items required per variant — if below, fallback to simpler variant */
export const VARIANT_MIN_CONTENT: Record<string, Record<string, number>> = {
    // cards = 3-col grid → needs 3 items (GH-1252: was 2, caused empty cell on non-English sites)
    testimonials: { carousel: 3, masonry: 4, 'avatar-row': 3, 'video-text': 2, spotlight: 1, cards: 3, simple: 1, 'minimal-quote': 1 },
    features: { 'grid-4': 4, 'grid-3': 3, 'grid-2': 2, carousel: 3, zigzag: 2, list: 2, 'icon-top': 2, 'icon-left': 2 },
    gallery: { masonry: 6, carousel: 3, grid: 4, lightbox: 4, filmstrip: 3, justified: 4 },
    pricing: { comparison: 2, table: 2, slider: 3, cards: 2, horizontal: 2, toggle: 2, tiered: 2, minimal: 1 },
    // grid = 3-col → needs 3 items (GH-1252: was 2, caused empty cell on non-English sites)
    team: { grid: 3, list: 2 },
    stats: { grid: 3, cards: 3, 'chart-bars': 3, row: 2, highlight: 1, 'inline-text': 1 },
}

/**
 * Enforce minimum content count for a variant.
 * If block doesn't have enough items, fallback to a simpler variant that fits.
 */
export function enforceMinContent(blockType: string, variant: string, contentCount: number): string {
    const mins = VARIANT_MIN_CONTENT[blockType]
    if (!mins) return variant

    const required = mins[variant]
    if (required && contentCount < required) {
        // Find best variant that fits current count (largest min that still fits)
        const fitting = Object.entries(mins)
            .filter(([, min]) => contentCount >= min)
            .sort((a, b) => b[1] - a[1])
        if (fitting.length > 0) {
            const fallback = fitting[0]![0]
            console.warn(
                `[AI Content Guard] "${blockType}": variant "${variant}" needs ${required} items but got ${contentCount} → fallback to "${fallback}"`
            )
            return fallback
        }
    }
    return variant
}
