/**
 * Content Quality Score calculator.
 *
 * Scoring per Plan 1 + docs/architecture/F11-seo-dashboard.md:
 * - H1 (hero block) exists on each page: -10 per missing (max -30)
 * - Content length >= 300 words: -10 per thin page (max -20)
 * - Product images have alt text: -10 per missing (max -20)
 * - Contact section exists: -10 if missing
 */

interface PageLayout {
    blockType?: string
    headline?: string
    description?: string
    content?: string
    sectionLabel?: string
    subheadline?: string
    body?: string
}

interface ContentScoreInput {
    pages: Array<{ layout?: PageLayout[] }>
    productMissingAltCount: number
    hasContactSection: boolean
}

function estimateWordCount(blocks: PageLayout[]): number {
    const text = blocks
        .map(b => [b.headline, b.subheadline, b.description, b.content, b.body, b.sectionLabel].filter(Boolean).join(' '))
        .join(' ')
    return text.split(/\s+/).filter(Boolean).length
}

export function calculateContentQualityScore(input: ContentScoreInput): number {
    let score = 100

    // H1 check: hero block = H1
    let missingH1Count = 0
    let thinPageCount = 0

    for (const page of input.pages) {
        const layout = page.layout || []
        const hasHero = layout.some(b => b.blockType === 'hero')
        if (!hasHero) missingH1Count++

        if (estimateWordCount(layout) < 300) thinPageCount++
    }

    score -= Math.min(30, missingH1Count * 10)
    score -= Math.min(20, thinPageCount * 10)

    // Alt text
    score -= Math.min(20, input.productMissingAltCount * 10)

    // Contact section
    if (!input.hasContactSection) score -= 10

    return Math.max(0, score)
}
