'use client'

import { Sparkles, X } from 'lucide-react'
import type { ThemeConfig } from '@/blocks/types'
import { useI18n } from '@/i18n'
import type { BusinessInfo } from '@/store/builderStore'
import { buildBriefRows, type GenerationBlock } from './generation-utils'
import { GenerationCaption } from './GenerationCaption'
import { usePrefersReducedMotion, useSmoothNumber } from './generation-hooks'
import { useGenerationTimeline } from './use-generation-timeline'
import { GenerationStage } from './GenerationStage'
import { getPreviewSiteHost } from '@/components/builder/builder-site-host'
import { GenerationStepper } from './GenerationStepper'

export interface GenerationCardProps {
    progress: number
    elapsedSeconds?: number
    onCancel?: () => void
    showTimeoutWarning?: boolean
    businessInfo?: BusinessInfo | null
    theme?: ThemeConfig | null
    blocks?: GenerationBlock[]
}

export function GenerationCard({
    progress,
    elapsedSeconds,
    onCancel,
    showTimeoutWarning,
    businessInfo = null,
    theme = null,
    blocks = [],
}: GenerationCardProps) {
    const { t, ti } = useI18n()
    const g = t.onboarding.generating
    const form = t.onboarding.form
    const rows = buildBriefRows(businessInfo, {
        businessName: form.businessName,
        industry: form.industry,
        products: form.products,
        shortDescription: form.shortDescription,
        industryOptions: form.industryOptions as Record<string, string> | undefined,
    })
    const businessName = businessInfo?.businessName?.trim() ?? ''
    const reduced = usePrefersReducedMotion()
    // Visual beats are paced on top of the SSE stream; see use-generation-timeline.
    const tl = useGenerationTimeline({ rowCount: rows.length, hasTheme: !!theme, blocks, progress, elapsedSeconds, reduced })
    const percent = useSmoothNumber(Math.round(tl.progress), reduced)

    return (
        <div className="relative flex w-full flex-1 flex-col rounded-2xl border border-white/10 bg-[rgba(30,41,59,0.6)] p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] motion-safe:animate-pw-in lg:h-full">
            <div className="flex items-center gap-3.5">
                <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#2dd4bf)] text-white">
                    <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl motion-safe:animate-pw-glow motion-reduce:shadow-[0_0_16px_rgba(45,212,191,0.4)]" />
                    <Sparkles aria-hidden className="size-[22px]" />
                </span>
                <div className="min-w-0">
                    <h2 className="w-max max-w-full bg-[linear-gradient(90deg,#3b82f6,#2dd4bf)] bg-clip-text text-xl font-semibold leading-7 text-transparent">
                        {g.creatingTitle}
                    </h2>
                    <p className="mt-0.5 text-[13px] leading-[18px] text-[#94a3b8]">{g.creatingSubtitle}</p>
                </div>
            </div>

            <GenerationStepper
                activeStep={tl.activeStep}
                fills={tl.stepFills}
                progress={progress}
                ready={tl.ready}
                labels={[g.stepAnalyzing, g.stepGenerating, g.stepPreparing]}
            />

            <GenerationStage
                blocks={tl.shownBlocks}
                businessName={businessName}
                settled={tl.settled}
                siteHost={getPreviewSiteHost(businessName, businessInfo?.slug)}
                painted={tl.painted}
                ready={tl.ready}
                readCount={tl.readCount}
                rows={rows}
                theme={theme}
            />

            <GenerationCaption caption={tl.caption} name={businessName} percent={percent} ready={tl.ready} />
            <div
                aria-label={g.progressLabel}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(tl.progress)}
                className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#2a3446]"
                role="progressbar"
            >
                <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#3b82f6,#2dd4bf)] transition-[width] duration-700 ease-out"
                    style={{ width: `${tl.progress}%` }}
                />
            </div>
            {typeof elapsedSeconds === 'number' && elapsedSeconds > 0 && (
                <p className="mt-3 text-xs text-[#94a3b8]">{ti(g.elapsed, { seconds: elapsedSeconds })}</p>
            )}

            {showTimeoutWarning && onCancel && (
                <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4" role="alert">
                    <p className="text-center text-sm text-amber-300/90">{g.timeoutWarning}</p>
                    <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        onClick={onCancel}
                        type="button"
                    >
                        <X className="size-3.5" />
                        {g.cancelButton}
                    </button>
                </div>
            )}
        </div>
    )
}
