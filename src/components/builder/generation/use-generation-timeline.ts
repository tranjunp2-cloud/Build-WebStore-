'use client'

import { PAINT_PROGRESS, computeEffectiveProgress, getCaptionKey, getStageProgressCap, type CaptionKey, type GenerationBlock } from './generation-utils'
import { useBriefReadCount, useDelayedTrue, usePacedCount } from './generation-hooks'

// The stream sends the theme and every section within a few seconds, then stays silent while it
// saves pages and images. These beats stretch the animation across that wait so the screen does
// not run out of story long before the site is done.
const BRIEF_HOLD_MS = 2500
const SECTION_INTERVAL_MS = 2400
const SETTLE_HOLD_MS = 1500
const CONTENT_HOLD_MS = 4500
const READY_DELAY_MS = 1600
/** Section count assumed for the connector fill until the stream says how many there are. */
const PLANNED_SECTIONS = 6

export interface GenerationTimeline {
    readCount: number
    shownBlocks: GenerationBlock[]
    settled: boolean
    painted: boolean
    ready: boolean
    activeStep: 0 | 1 | 2
    stepFills: [number, number]
    progress: number
    caption: CaptionKey
}

export function useGenerationTimeline(args: {
    rowCount: number
    hasTheme: boolean
    blocks: GenerationBlock[]
    progress: number
    elapsedSeconds?: number
    reduced: boolean
}): GenerationTimeline {
    const { rowCount, hasTheme, blocks, progress, elapsedSeconds, reduced } = args
    const readCount = useBriefReadCount(rowCount, hasTheme, reduced)
    const briefDone = hasTheme && readCount >= rowCount
    const wireframeOn = useDelayedTrue(briefDone, BRIEF_HOLD_MS, reduced)
    const revealed = usePacedCount(blocks.length, SECTION_INTERVAL_MS, wireframeOn, reduced)
    // All sections have arrived once the stream reaches its saving step.
    const streamDone = progress >= PAINT_PROGRESS
    const settled = useDelayedTrue(streamDone && revealed >= blocks.length, SETTLE_HOLD_MS, reduced)
    const painted = useDelayedTrue(settled, CONTENT_HOLD_MS, reduced)
    const ready = useDelayedTrue(painted, READY_DELAY_MS, reduced)

    const planned = streamDone ? Math.max(blocks.length, 1) : Math.max(PLANNED_SECTIONS, blocks.length)
    const activeStep: 0 | 1 | 2 = painted ? 2 : revealed > 0 ? 1 : 0
    const stepFills: [number, number] = [
        activeStep > 0 ? 100 : rowCount ? (readCount / rowCount) * 100 : 0,
        activeStep > 1 ? 100 : activeStep < 1 ? 0 : Math.min(95, (revealed / planned) * 100),
    ]
    const cap = getStageProgressCap({ readFraction: rowCount ? readCount / rowCount : 1, revealed, planned, settled, painted, ready })
    const effective = Math.min(computeEffectiveProgress(progress, elapsedSeconds), cap)

    return {
        readCount,
        shownBlocks: blocks.slice(0, revealed),
        settled,
        painted,
        ready,
        activeStep,
        stepFills,
        progress: Math.round(effective * 10) / 10,
        caption: getCaptionKey({ ready, painted, revealed, hasTheme, briefDone: rowCount > 0 && readCount >= rowCount - 1 }),
    }
}
