/**
 * Enforce visual variety between AI-generated pages.
 *
 * BUG-F01-23: AI sometimes generates 4 pages with near-identical block
 * compositions → site feels boring. Prompt-engineering alone isn't enough.
 *
 * Strategy: deterministic post-processing.
 * - For each page (after homepage), compute Jaccard-like overlap with the
 *   previous page using `blockType:variant` keys
 * - If overlap > threshold (default 60%), swap variants on a couple of
 *   blocks to break symmetry
 * - Variant swap only — never change blockType (preserves semantic intent)
 *
 * Trade-off: variant swap may produce slightly less "designed" combinations,
 * but visible difference > monotony.
 */

import type { PageShape, PageBlockShape } from './ensure-navigation'

const DEFAULT_OVERLAP_THRESHOLD = 0.6

// Variant fallback chains — each block type cycles through these so we
// always have something different to pick. Order = preference.
const VARIANT_CYCLES: Record<string, string[]> = {
    hero: ['centered', 'split-left', 'split-right', 'video', 'minimal'],
    features: ['grid-3', 'grid-2', 'list', 'cards', 'icons'],
    about: ['split-image', 'centered', 'stacked', 'with-stats'],
    testimonials: ['carousel', 'grid', 'single', 'masonry'],
    contact: ['split-form', 'centered', 'with-map', 'minimal'],
    cta: ['centered', 'split', 'banner', 'gradient'],
    pricing: ['three-column', 'two-column', 'comparison', 'minimal'],
    gallery: ['grid', 'masonry', 'carousel', 'lightbox'],
    stats: ['inline', 'cards', 'grid', 'highlighted'],
    team: ['grid-3', 'grid-4', 'cards', 'list'],
}

function blockKey(block: PageBlockShape): string {
    const type = String(block?.blockType ?? '')
    const variant = String((block as { variant?: unknown })?.variant ?? '')
    return `${type}:${variant}`
}

function computeOverlap(prev: PageBlockShape[], curr: PageBlockShape[]): number {
    if (!prev.length || !curr.length) return 0
    const prevKeys = new Set(prev.map(blockKey))
    let matches = 0
    for (const block of curr) {
        if (prevKeys.has(blockKey(block))) matches += 1
    }
    return matches / curr.length
}

function pickDifferentVariant(blockType: string, currentVariant: string, pageIndex: number): string | null {
    const cycle = VARIANT_CYCLES[blockType]
    if (!cycle || cycle.length < 2) return null
    const filtered = cycle.filter((v) => v !== currentVariant)
    return filtered[pageIndex % filtered.length] ?? null
}

/**
 * Ensure pages have ≥40% block-key variety vs the previous page.
 * Mutates a copy; returns new array.
 */
export function enforcePageVariety(
    pages: PageShape[],
    threshold: number = DEFAULT_OVERLAP_THRESHOLD,
): PageShape[] {
    if (pages.length < 2) return pages

    const result: PageShape[] = [pages[0]]

    for (let i = 1; i < pages.length; i++) {
        const prevLayout = result[i - 1].layout ?? []
        const currLayout = [...(pages[i].layout ?? [])]
        const overlap = computeOverlap(prevLayout, currLayout)

        if (overlap > threshold) {
            // Swap variant on up to 2 blocks — skip first (nav) and last (footer)
            let swaps = 0
            for (let j = 1; j < currLayout.length - 1 && swaps < 2; j++) {
                const block = currLayout[j]
                const type = typeof block?.blockType === 'string' ? block.blockType : ''
                const variant = typeof (block as { variant?: unknown })?.variant === 'string'
                    ? ((block as { variant: string }).variant)
                    : ''
                const next = pickDifferentVariant(type, variant, i)
                if (next) {
                    currLayout[j] = { ...block, variant: next }
                    swaps += 1
                }
            }
        }

        result.push({ ...pages[i], layout: currLayout })
    }

    return result
}
