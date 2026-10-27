'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Loader2, Sparkles, X } from 'lucide-react'
import type { ThemeConfig } from '@/blocks/types'
import { GoogleFontsLoader } from '@/components/site-renderer/GoogleFontsLoader'
import { BuilderGenerationBrief, type GenerationBrief } from '@/components/builder/BuilderGenerationBrief'
import { BuilderGenerationPreview } from '@/components/builder/BuilderGenerationPreview'
import { BuilderGenerationWireframe } from '@/components/builder/BuilderGenerationWireframe'
import { BuilderMiniBrowser } from '@/components/builder/BuilderMiniBrowser'
import { BUILDER_CARD_BORDER, BuilderGradientBorder } from '@/components/builder/BuilderMotion'
import { BuilderStepList, type BuilderStepState } from '@/components/builder/onboarding/BuilderStepList'
import { computeEffectiveProgress, useGenerationStage, type GenerationCaption } from '@/components/builder/builder-generation-stage'
import { getStagePalette } from '@/components/builder/builder-stage-palette'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export interface BuilderGenerationCardProps {
    progress: number
    elapsedSeconds?: number
    onCancel?: () => void
    showTimeoutWarning?: boolean
    brief: GenerationBrief
    theme?: ThemeConfig | null
    blockCount?: number
    previewContent?: ReactNode
    urlHost?: string | null
    /** Fill the right column (desktop) instead of sizing to content (mobile). */
    fill?: boolean
}

const BASE_W = 504
const BASE_H = 272
const CAPTIONS: GenerationCaption[] = ['reading', 'style', 'planning', 'writing', 'applying', 'assembling', 'mobile', 'finishing', 'opening']

function useElementSize() {
    const ref = useRef<HTMLDivElement | null>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })
    useEffect(() => {
        const el = ref.current
        if (!el || typeof ResizeObserver !== 'function') return
        const observer = new ResizeObserver(([entry]) => {
            const width = Math.round(entry.contentRect.width)
            const height = Math.round(entry.contentRect.height)
            setSize((current) => (current.width === width && current.height === height ? current : { width, height }))
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])
    return [ref, size] as const
}

/** "Creating your website…" card: stepper, mini-browser stage, live caption + progress. */
export function BuilderGenerationCard({
    progress,
    elapsedSeconds = 0,
    onCancel,
    showTimeoutWarning,
    brief,
    theme = null,
    blockCount = 0,
    previewContent,
    urlHost,
    fill,
}: BuilderGenerationCardProps) {
    const { t, ti } = useI18n()
    const g = t.onboarding.generating
    const stage = useGenerationStage({ progress, elapsedSeconds, hasTheme: !!theme, blockCount })
    const palette = useMemo(() => getStagePalette(theme), [theme])
    const [stageRef, size] = useElementSize()
    const width = size.width || BASE_W
    const height = size.height || BASE_H
    const zoom = Math.min(width / BASE_W, height / BASE_H)
    // Layers are designed at 504×272 and scaled up to fill larger stages (never down — narrow stages reflow).
    const briefScale = Math.max(1, Math.min(zoom, 1.35))
    const sketchScale = Math.max(1, Math.min(zoom, 2.2))
    const percent = Math.round(computeEffectiveProgress(progress, elapsedSeconds))

    const stepState = (index: number): BuilderStepState =>
        index < stage.phase || (index === 2 && stage.ready) ? 'done' : index === stage.phase ? 'active' : 'todo'
    const captionText: Record<GenerationCaption, string> = {
        reading: g.captionReading,
        style: g.captionStyle,
        planning: g.captionPlanning,
        writing: ti(g.captionWriting, { name: brief.businessName.trim() || g.captionYourBusiness }),
        applying: g.captionApplying,
        assembling: g.captionAssembling,
        mobile: g.captionMobile,
        finishing: g.captionFinishing,
        opening: g.captionOpening,
    }
    const captionIndex = CAPTIONS.indexOf(stage.caption)

    return (
        <div
            className={cn(
                'bld-in relative box-border flex w-full flex-col rounded-2xl border border-solid border-[rgba(148,163,184,.1)] bg-[rgba(30,41,59,.6)] p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,.45)]',
                fill && 'flex-[1_0_auto]',
            )}
            data-phase={stage.phase}
            data-testid="builder-generation-card"
        >
            <BuilderGradientBorder gradient={BUILDER_CARD_BORDER} />
            {theme ? <GoogleFontsLoader fontBody={theme.fontBody} fontHeading={theme.fontHeading} /> : null}

            <div className="flex items-center gap-3.5">
                <span className="relative flex size-11 flex-none items-center justify-center rounded-xl text-white [background-image:linear-gradient(135deg,#3b82f6,#2dd4bf)]">
                    <span aria-hidden className="bld-glow pointer-events-none absolute inset-0 rounded-xl" />
                    <Sparkles aria-hidden className="size-[22px]" />
                </span>
                <div className="min-w-0">
                    <h2 className="w-max max-w-full bg-clip-text text-xl font-semibold leading-7 text-transparent [background-image:linear-gradient(90deg,#3b82f6,#2dd4bf)]">
                        {g.creatingTitle}
                    </h2>
                    <p className="mt-0.5 text-[13px] leading-[18px] text-[#94a3b8] [text-wrap:pretty]">{g.creatingSubtitle}</p>
                </div>
            </div>

            <div className="mx-auto mt-[22px] w-full max-w-[820px]">
                <BuilderStepList
                    connectorFill={stage.connectorFill}
                    steps={[g.stepAnalyzing, g.stepGenerating, g.stepPreparing].map((label, index) => ({ id: index + 1, label, state: stepState(index) }))}
                    variant="progress"
                />
            </div>

            <BuilderMiniBrowser className="relative mt-5 flex min-h-0 flex-auto flex-col" urlHost={elapsedSeconds >= 1 ? urlHost : null} urlLoading>
                <div className="relative min-h-[272px] flex-auto overflow-hidden" ref={stageRef}>
                    <BuilderGenerationBrief brief={brief} briefRead={stage.briefRead} height={height} palette={palette} scale={briefScale} visible={stage.phase === 0} width={width} />
                    <BuilderGenerationWireframe
                        businessName={brief.businessName}
                        height={height}
                        leaving={stage.phase === 2}
                        palette={palette}
                        scale={sketchScale}
                        stage={stage}
                        visible={stage.phase === 1 || (stage.phase === 2 && !previewContent)}
                        width={width}
                    />
                    <BuilderGenerationPreview
                        businessName={brief.businessName}
                        entering={stage.phase === 2 && !stage.phoneShown}
                        height={height}
                        palette={palette}
                        phoneShown={stage.phoneShown}
                        previewContent={previewContent}
                        ready={stage.ready}
                        scale={sketchScale}
                        visible={stage.phase === 2 && !!previewContent}
                        width={width}
                    />
                </div>
            </BuilderMiniBrowser>

            <div className="mt-4 flex items-center gap-2.5">
                <span className={cn('flex size-5 flex-none items-center justify-center rounded-full transition-colors duration-300', stage.ready ? 'bg-[#2dd4bf] text-[#0b1222]' : 'bg-[rgba(56,189,248,.12)] text-[#38bdf8]')}>
                    {stage.ready ? <Check aria-hidden className="size-3" strokeWidth={3} /> : <Loader2 aria-hidden className="size-3 animate-spin" strokeWidth={2.5} />}
                </span>
                <div aria-live="polite" className="relative h-5 min-w-0 flex-1" data-caption={stage.caption}>
                    {CAPTIONS.map((key, index) => (
                        <span
                            aria-hidden={index !== captionIndex}
                            className="absolute inset-x-0 top-0 block truncate text-[13px] font-medium leading-5 text-[#f1f5f9] transition-[opacity,transform] duration-300"
                            key={key}
                            style={{ opacity: index === captionIndex ? 1 : 0, transform: index === captionIndex ? 'none' : `translateY(${index < captionIndex ? -6 : 6}px)` }}
                        >
                            {captionText[key]}
                        </span>
                    ))}
                </div>
                <span className="flex-none text-[13px] font-semibold leading-5 text-[#38bdf8] [font-variant-numeric:tabular-nums]">{percent}%</span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#2a3446]">
                <div
                    className="h-1.5 rounded-full transition-[width] duration-700 ease-out [background-image:linear-gradient(90deg,#3b82f6,#2dd4bf)]"
                    data-testid="builder-generation-progress-bar"
                    style={{ width: `${computeEffectiveProgress(progress, elapsedSeconds)}%` }}
                />
            </div>
            {elapsedSeconds > 0 ? (
                <p className="mt-3 text-xs leading-4 text-[#94a3b8]">{ti(g.elapsed, { seconds: elapsedSeconds })}</p>
            ) : null}

            {showTimeoutWarning && onCancel ? (
                <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-solid border-amber-500/20 bg-amber-500/5 p-4" role="alert">
                    <p className="text-center text-sm text-amber-300/90">{g.timeoutWarning}</p>
                    <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-solid border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        onClick={onCancel}
                        type="button"
                    >
                        <X className="size-3.5" />
                        {g.cancelButton}
                    </button>
                </div>
            ) : null}
        </div>
    )
}
