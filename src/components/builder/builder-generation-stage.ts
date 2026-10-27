import { useRef } from 'react'

/**
 * Maps the real generation signals (SSE step progress, theme_set, streamed
 * block_complete events, the elapsed-seconds ticker) onto the three visual
 * stages of the generating panel:
 *   phase 0 — the business brief is read row by row (elapsed ticker),
 *   phase 1 — the page wireframe is laid out, the name typed, then painted
 *             with the real theme once `theme_set` arrives,
 *   phase 2 — the streamed blocks render as the desktop preview, the mobile
 *             frame slides in, "Preview ready" once the `saving` step lands.
 * Nothing advances past a stage the server has not reached.
 */

export const BRIEF_ROW_COUNT = 4
export const WIREFRAME_SECTION_COUNT = 6
/** The brief stays on screen at least this long (it is only a ~1 s server step). */
const BRIEF_MIN_SECONDS = 5
/** Seconds the painted wireframe stays before the real preview takes over. */
const PAINT_HOLD_SECONDS = 2
/** Seconds after the wireframe starts before the business name is typed in. */
export const CONTENT_AFTER_SECONDS = WIREFRAME_SECTION_COUNT
const TYPING_SECONDS = 2

export type GenerationCaption =
    | 'reading' | 'style' | 'planning' | 'writing' | 'applying'
    | 'assembling' | 'mobile' | 'finishing' | 'opening'

export interface GenerationStageInput {
    /** Raw progress from the latest SSE `step` event. */
    progress: number
    elapsedSeconds: number
    hasTheme: boolean
    blockCount: number
}

export interface GenerationStageMemory {
    wireframeAt: number | null
    paintedAt: number | null
    previewAt: number | null
}

export interface GenerationStage {
    phase: 0 | 1 | 2
    /** Brief rows already read; the row at this index is being read. */
    briefRead: number
    sectionsShown: number
    /** Section being laid out right now (-1 when none). */
    currentSection: number
    content: boolean
    typing: boolean
    painted: boolean
    /** True for the first moments after painting (sweep highlight). */
    justPainted: boolean
    phoneShown: boolean
    ready: boolean
    caption: GenerationCaption
    connectorFill: [number, number]
}

export const EMPTY_STAGE_MEMORY: GenerationStageMemory = { wireframeAt: null, paintedAt: null, previewAt: null }

export function deriveGenerationStage(
    input: GenerationStageInput,
    previous: GenerationStageMemory = EMPTY_STAGE_MEMORY,
): { stage: GenerationStage; memory: GenerationStageMemory } {
    const e = Math.max(0, input.elapsedSeconds || 0)
    const progress = Number.isFinite(input.progress) ? input.progress : 0
    const memory = { ...previous }

    if (memory.wireframeAt === null && progress >= 20 && e >= BRIEF_MIN_SECONDS) memory.wireframeAt = e
    const t1 = memory.wireframeAt === null ? -1 : e - memory.wireframeAt
    const sectionsShown = t1 < 0 ? 0 : Math.min(WIREFRAME_SECTION_COUNT, t1 + 1)
    const content = t1 >= CONTENT_AFTER_SECONDS
    const painted = content && input.hasTheme
    if (painted && memory.paintedAt === null) memory.paintedAt = e

    const paintHeld = memory.paintedAt !== null && e - memory.paintedAt >= PAINT_HOLD_SECONDS
    const previewReady = paintHeld && (input.blockCount > 0 || progress >= 90)
    if (memory.wireframeAt !== null && memory.previewAt === null && (previewReady || progress >= 95)) memory.previewAt = e

    const phase: 0 | 1 | 2 = memory.previewAt !== null ? 2 : memory.wireframeAt !== null ? 1 : 0
    const t2 = memory.previewAt === null ? -1 : e - memory.previewAt
    const phoneShown = phase === 2 && t2 >= 1
    const ready = phase === 2 && progress >= 95
    const briefRead = phase > 0 ? BRIEF_ROW_COUNT : Math.min(BRIEF_ROW_COUNT, e)

    let caption: GenerationCaption
    if (phase === 0) caption = briefRead < BRIEF_ROW_COUNT ? 'reading' : 'style'
    else if (phase === 1) caption = painted ? 'applying' : content ? 'writing' : 'planning'
    else caption = ready ? 'opening' : progress >= 90 ? 'finishing' : phoneShown ? 'mobile' : 'assembling'

    const wireframeFill = (sectionsShown / WIREFRAME_SECTION_COUNT) * 50 + (content ? 25 : 0) + (painted ? 20 : 0)
    const connectorFill: [number, number] = [
        phase > 0 ? 100 : Math.min(100, (e / BRIEF_MIN_SECONDS) * 100),
        phase > 1 ? 100 : phase === 1 ? Math.min(95, wireframeFill) : 0,
    ]

    return {
        memory,
        stage: {
            phase,
            briefRead,
            sectionsShown,
            currentSection: phase === 1 && !painted ? (content ? 1 : sectionsShown - 1) : -1,
            content,
            typing: content && t1 < CONTENT_AFTER_SECONDS + TYPING_SECONDS,
            painted,
            justPainted: painted && memory.paintedAt !== null && e - memory.paintedAt < PAINT_HOLD_SECONDS,
            phoneShown,
            ready,
            caption,
            connectorFill,
        },
    }
}

/** Keeps the first-reached time of each stage across renders so stages never go backwards. */
export function useGenerationStage(input: GenerationStageInput): GenerationStage {
    const memoryRef = useRef<GenerationStageMemory>(EMPTY_STAGE_MEMORY)
    const { stage, memory } = deriveGenerationStage(input, memoryRef.current)
    memoryRef.current = memory
    return stage
}

/**
 * Blend discrete SSE step progress (10→20→60→95→100) with a time-based
 * asymptotic curve so the bar keeps advancing during the long silent
 * OpenAI call phase. Without this the bar visibly stalls at ~20% for
 * the 40–90s it takes gpt-4.1-mini to return.
 *
 * Curve: 10 + 82·(1 − e^(−t/45))
 *   t=0s  →10%   t=15s→33%   t=30s→52%   t=45s→66%
 *   t=60s →78%   t=90s→89%   t=120s→92%  asymptote→92%
 *
 * We cap time-based output at 92 so the bar never fills without a real
 * signal. Once an event reports ≥92 (parsing/saving/done) we honour it
 * verbatim so the final snap to 100% happens on the `done` event.
 */
export function computeEffectiveProgress(eventProgress: number, elapsedSeconds?: number): number {
    const rawEvent = Number.isFinite(eventProgress) ? eventProgress : 0
    const clampedEvent = Math.max(10, Math.min(100, rawEvent))
    if (clampedEvent >= 92) return clampedEvent

    const t = typeof elapsedSeconds === 'number' && elapsedSeconds > 0 ? elapsedSeconds : 0
    const timeBased = 10 + 82 * (1 - Math.exp(-t / 45))
    return Math.max(clampedEvent, Math.min(92, timeBased))
}
