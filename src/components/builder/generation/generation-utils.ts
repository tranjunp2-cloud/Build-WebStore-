import type { ThemeConfig } from '@/blocks/types'
import type { BusinessInfo } from '@/store/builderStore'

/** Minimal block shape needed by the generating screen (store blocks are `any[]`). */
export interface GenerationBlock {
    _id?: string
    blockType?: string
}

/** Event progress at/after which the SSE stream is parsing/saving (design is painted). */
export const PAINT_PROGRESS = 95

/**
 * Blend discrete SSE step progress (10→20→60→95→100) with a time-based
 * asymptotic curve so the bar keeps advancing during the long silent
 * OpenAI call phase: 10 + 82·(1 − e^(−t/45)), capped at 92 so the bar never
 * fills without a real signal. Event progress ≥ 92 is honoured verbatim.
 */
export function computeEffectiveProgress(eventProgress: number, elapsedSeconds?: number): number {
    const rawEvent = Number.isFinite(eventProgress) ? eventProgress : 0
    const clampedEvent = Math.max(10, Math.min(100, rawEvent))
    if (clampedEvent >= 92) return clampedEvent

    const t = typeof elapsedSeconds === 'number' && elapsedSeconds > 0 ? elapsedSeconds : 0
    const timeBased = 10 + 82 * (1 - Math.exp(-t / 45))
    return Math.max(clampedEvent, Math.min(92, timeBased))
}

export type CaptionKey =
    | 'captionReading'
    | 'captionStyle'
    | 'captionPlanning'
    | 'captionWriting'
    | 'captionPainting'
    | 'captionAssembling'
    | 'captionFinishing'

/** Caption for the current animation beat (brief → sections → paint → ready). */
export function getCaptionKey(args: {
    ready: boolean
    painted: boolean
    revealed: number
    hasTheme: boolean
    briefDone: boolean
}): CaptionKey {
    const { ready, painted, revealed, hasTheme, briefDone } = args
    if (ready) return 'captionAssembling'
    if (painted) return 'captionPainting'
    if (revealed > 0) return 'captionWriting'
    if (hasTheme) return 'captionPlanning'
    return briefDone ? 'captionStyle' : 'captionReading'
}

/**
 * Highest % the bar may show for the current beat, so it climbs with the animation instead of
 * jumping to 95 as soon as the stream reaches its (long) saving step.
 */
export function getStageProgressCap(args: {
    readFraction: number
    revealed: number
    planned: number
    settled: boolean
    painted: boolean
    ready: boolean
}): number {
    const { readFraction, revealed, planned, settled, painted, ready } = args
    if (ready) return 99
    if (painted) return 95
    if (settled) return 88
    if (revealed > 0) return 45 + 40 * Math.min(1, revealed / planned)
    return 20 + 25 * readFraction
}

export interface BriefRow {
    key: 'name' | 'industry' | 'products' | 'description'
    label: string
    value: string
}

interface BriefLabels {
    businessName: string
    industry: string
    products: string
    shortDescription: string
    industryOptions?: Record<string, string>
}

/** Rows for the "Business brief" list; empty values are skipped. */
export function buildBriefRows(info: BusinessInfo | null | undefined, labels: BriefLabels): BriefRow[] {
    if (!info) return []
    const industry = info.industry ? (labels.industryOptions?.[info.industry] ?? info.industry) : ''
    const rows: BriefRow[] = [
        { key: 'name', label: labels.businessName, value: info.businessName },
        { key: 'industry', label: labels.industry, value: industry },
        { key: 'products', label: labels.products, value: info.products },
        { key: 'description', label: labels.shortDescription, value: info.shortDescription },
    ]
    return rows.filter((r) => typeof r.value === 'string' && r.value.trim().length > 0)
}

/** Distinct, defined palette swatches from a theme. */
export function getPaletteColors(theme: ThemeConfig | null | undefined): string[] {
    if (!theme) return []
    const all = [theme.primaryColor, theme.secondaryColor, theme.accentColor, theme.surfaceColor, theme.backgroundColor]
    return all.filter((c, i): c is string => typeof c === 'string' && c.length > 0 && all.indexOf(c) === i)
}

export const CAPTION_ORDER: CaptionKey[] = [
    'captionReading',
    'captionStyle',
    'captionPlanning',
    'captionWriting',
    'captionPainting',
    'captionAssembling',
    'captionFinishing',
]

/** Fill % (0-100) of the connector segment after step `index` (0 or 1). */
export function getSegmentFill(index: 0 | 1, activeStep: number, progress: number): number {
    if (activeStep > index) return 100
    if (activeStep < index) return 0
    const [from, span] = index === 0 ? [10, 10] : [20, 40]
    return Math.max(0, Math.min(100, ((progress - from) / span) * 100))
}

export type WireframeKind = 'nav' | 'hero' | 'features' | 'tiles' | 'testimonials' | 'footer' | 'generic'

const KIND_BY_TYPE: Record<string, WireframeKind> = {
    navigation: 'nav',
    hero: 'hero',
    features: 'features',
    about: 'features',
    pricing: 'tiles',
    gallery: 'tiles',
    'content-cards': 'tiles',
    testimonials: 'testimonials',
    footer: 'footer',
}

export function getWireframeKind(blockType: string | undefined): WireframeKind {
    return (blockType && KIND_BY_TYPE[blockType]) || 'generic'
}

/** flex-basis/min-height weights (px) mirroring the prototype's section heights. */
export const KIND_HEIGHT: Record<WireframeKind, number> = {
    nav: 16, hero: 84, features: 40, tiles: 44, testimonials: 20, footer: 14, generic: 28,
}

/** Heuristic for the "Style" insight: serif heading fonts read as classic, everything else as modern. */
export function isSerifFont(font: string): boolean {
    return /serif|playfair|lora|cormorant|garamond|merriweather|baskerville|proza|fraunces|libre|crimson|spectral/i.test(font) && !/sans/i.test(font)
}
