'use client'

import { Check, Lock } from 'lucide-react'
import type { ThemeConfig } from '@/blocks/types'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { useElementSize, usePrefersReducedMotion } from './generation-hooks'
import type { BriefRow, GenerationBlock } from './generation-utils'
import { GenerationBriefPanel } from './GenerationBriefPanel'
import { GenerationPreviewFrames } from './GenerationPreviewFrames'
import { GenerationWireframe } from './GenerationWireframe'
import { paletteOf } from './GenerationWireframeShapes'

interface GenerationStageProps {
    rows: BriefRow[]
    readCount: number
    theme: ThemeConfig | null
    blocks: GenerationBlock[]
    painted: boolean
    ready: boolean
    businessName: string
    /** Host shown in the URL bar (slug + platform domain). */
    siteHost: string
    /** Block stream went quiet: sections are planned, content can be written in. */
    settled: boolean
}

// Prototype stage base size; content zooms up to fill larger stages (brief ≤1.35×, wireframe ≤2.2×).
const BASE_W = 504
const BASE_H = 272

function Zoom({ size, max, children }: { size: { width: number; height: number }; max: number; children: React.ReactNode }) {
    const ratio = size.width && size.height ? Math.min(size.width / BASE_W, size.height / BASE_H) : 1
    const z = Math.max(1, Math.min(ratio, max))
    return (
        <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: size.width ? size.width / z : '100%', height: size.height ? size.height / z : '100%', transform: `scale(${z})` }}
        >
            {children}
        </div>
    )
}

/**
 * Mini browser with three crossfading layers (prototype layerA / wireframe / layerC):
 * brief (no blocks yet) -> wireframe (blocks streaming, painted at >=95) -> preview frames (ready).
 */
export function GenerationStage({ rows, readCount, theme, blocks, painted, ready, businessName, siteHost, settled }: GenerationStageProps) {
    const { t } = useI18n()
    const reduced = usePrefersReducedMotion()
    const phase = ready ? 2 : blocks.length > 0 ? 1 : 0
    const bg = paletteOf(theme).bg
    const tr = (cls: string) => (reduced ? '' : cls)
    const [stageRef, size] = useElementSize<HTMLDivElement>()

    return (
        <div className="relative mt-5 flex min-h-[272px] flex-1 flex-col overflow-hidden rounded-xl border border-[rgba(148,163,184,0.14)] bg-[#0b1222] shadow-[0_14px_30px_-14px_rgba(0,0,0,0.7)]">
            <div className="flex h-8 shrink-0 items-center gap-2.5 border-b border-[rgba(148,163,184,0.1)] bg-[#0f1729] px-3">
                <span aria-hidden className="flex w-[34px] gap-[5px]">
                    {[0, 1, 2].map((i) => <span className="size-[7px] rounded-full bg-[#334155]" key={i} />)}
                </span>
                <div className="flex min-w-0 flex-1 justify-center">
                    <div className="flex h-5 min-w-0 max-w-full items-center gap-1.5 rounded-md border border-[rgba(148,163,184,0.1)] bg-[#172033] px-2.5 text-[#64748b]">
                        <Lock aria-hidden className="size-2.5 shrink-0" />
                        {businessName
                            ? <span className="truncate text-[10.5px] leading-[14px] text-[#94a3b8] motion-safe:animate-pw-fade">{siteHost}</span>
                            : <span className="block h-1.5 w-[130px] rounded-[3px] bg-[rgba(148,163,184,0.12)] bg-[linear-gradient(90deg,rgba(148,163,184,0)_0%,rgba(148,163,184,0.3)_50%,rgba(148,163,184,0)_100%)] bg-[length:200%_100%] motion-safe:animate-pw-shimmer" />}
                    </div>
                </div>
                <span className="w-[34px]" />
            </div>
            <div className="relative min-h-[240px] flex-1 overflow-hidden" ref={stageRef}>
                <div
                    className={cn('pointer-events-none absolute inset-0 overflow-hidden', tr('transition-[opacity,transform] duration-[450ms]'), phase === 0 ? 'opacity-100' : '-translate-y-2 scale-[0.98] opacity-0')}
                    data-layer="brief"
                >
                    <Zoom max={1.35} size={size}><GenerationBriefPanel readCount={readCount} rows={rows} scanning={phase === 0 && !theme} theme={theme} /></Zoom>
                </div>
                <div
                    className={cn('pointer-events-none absolute inset-0 overflow-hidden', tr('transition-[opacity,transform,background-color] duration-[550ms]'), phase >= 1 ? 'opacity-100' : 'translate-y-2.5 opacity-0')}
                    data-layer="wireframe"
                    style={{ backgroundColor: painted ? bg : 'rgba(247,245,239,0)' }}
                >
                    <Zoom max={2.2} size={size}><GenerationWireframe blocks={blocks} businessName={businessName} painted={painted} settled={settled} theme={theme} /></Zoom>
                </div>
                <div
                    className={cn('pointer-events-none absolute inset-0 overflow-hidden', tr('transition-[opacity,transform] duration-[600ms]'), phase === 2 ? 'opacity-100' : 'opacity-0')}
                    data-layer="preview"
                >
                    {ready && <Zoom max={2.2} size={size}><GenerationPreviewFrames name={businessName} reduced={reduced} theme={theme} visible /></Zoom>}
                    {ready && !reduced && (
                        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-[3] w-[35%] bg-[linear-gradient(100deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.45)_50%,rgba(255,255,255,0)_100%)] animate-pw-shine" data-testid="shine-sweep" />
                    )}
                </div>
                <div
                    className={cn('absolute bottom-3.5 left-3.5 z-[2] box-border flex h-[30px] items-center gap-[7px] whitespace-nowrap rounded-full border border-[rgba(45,212,191,0.45)] bg-[rgba(11,18,34,0.92)] pl-1.5 pr-3 text-xs font-semibold text-white shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55),0_0_18px_rgba(45,212,191,0.25)]', tr('transition-[opacity,transform] duration-[400ms] ease-[cubic-bezier(.2,.9,.3,1.3)]'), ready ? 'opacity-100' : 'translate-y-1.5 scale-[0.94] opacity-0')}
                    data-testid="preview-ready"
                    aria-hidden={!ready}
                >
                    <span className="relative flex size-[18px] items-center justify-center rounded-full bg-[#2dd4bf] text-[#0b1222]">
                        {ready && <span aria-hidden className="absolute inset-0 rounded-full border border-[#2dd4bf] motion-safe:animate-pw-ring" />}
                        <Check className="size-[11px]" strokeWidth={3} />
                    </span>
                    {t.onboarding.generating.previewReady}
                </div>
            </div>
        </div>
    )
}
