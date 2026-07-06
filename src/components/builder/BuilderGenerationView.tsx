'use client'

import type { ReactNode } from 'react'
import { Check, Loader2, Rocket, X } from 'lucide-react'
import { BuilderStepScreen } from '@/components/builder/onboarding/BuilderStepScreen'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

interface BuilderGenerationViewProps {
    message?: string
    progress: number
    floatingControls?: ReactNode
    elapsedSeconds?: number
    onCancel?: () => void
    showTimeoutWarning?: boolean
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
function computeEffectiveProgress(eventProgress: number, elapsedSeconds?: number): number {
    const rawEvent = Number.isFinite(eventProgress) ? eventProgress : 0
    const clampedEvent = Math.max(10, Math.min(100, rawEvent))
    if (clampedEvent >= 92) return clampedEvent

    const t = typeof elapsedSeconds === 'number' && elapsedSeconds > 0 ? elapsedSeconds : 0
    const timeBased = 10 + 82 * (1 - Math.exp(-t / 45))
    return Math.max(clampedEvent, Math.min(92, timeBased))
}

/**
 * Map raw server-side event progress to the active step in the 3-phase indicator.
 *   step 0 — Analyzing business information  (progress < 20)
 *   step 1 — Generating content & design    (20 ≤ progress < 60)
 *   step 2 — Preparing preview               (progress ≥ 60)
 * Steps with index < active render as "done" (green check),
 * step === active renders as "in progress" (gradient spinner),
 * step > active renders as "pending" (muted number).
 */
function getActiveStep(rawProgress: number): 0 | 1 | 2 {
    if (rawProgress >= 60) return 2
    if (rawProgress >= 20) return 1
    return 0
}

function BuilderGenerationCard({
    progress,
    elapsedSeconds,
    onCancel,
    showTimeoutWarning,
}: {
    progress: number
    elapsedSeconds?: number
    onCancel?: () => void
    showTimeoutWarning?: boolean
}) {
    const { t, ti } = useI18n()
    const activeStep = getActiveStep(progress)
    return (
        <div className="mx-auto flex w-full max-w-[864px] items-center justify-center px-6 sm:px-12">
            <div className="relative w-full max-w-[448px] rounded-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] p-8 shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3)]">
                <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]" />
                <div className="relative">
                    <div className="mb-6 flex justify-center">
                        <div className="flex size-20 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)] shadow-[0px_0px_24px_0px_rgba(59,130,246,0.6),0px_0px_40px_0px_rgba(45,212,191,0.3)]">
                            <Loader2 className="size-10 animate-spin text-white" />
                        </div>
                    </div>

                    <div className="mb-8 text-center">
                        <h2 className="bg-[linear-gradient(173.5deg,#3b82f6_0%,#2dd4bf_100%)] bg-clip-text text-2xl font-semibold leading-8 text-transparent">
                            {t.onboarding.generating.creatingTitle}
                        </h2>
                        <p className="mx-auto mt-3 max-w-[372px] text-sm leading-5 text-[#94a3b8]">
                            {t.onboarding.generating.creatingSubtitle}
                        </p>
                    </div>

                    <div className="mb-6 flex flex-col gap-4">
                        {[
                            t.onboarding.generating.stepAnalyzing,
                            t.onboarding.generating.stepGenerating,
                            t.onboarding.generating.stepPreparing,
                        ].map((label, index) => {
                            const state: 'done' | 'active' | 'pending' =
                                index < activeStep ? 'done' : index === activeStep ? 'active' : 'pending'
                            return (
                                <div
                                    className={cn(
                                        'flex items-center gap-3 transition-opacity duration-500',
                                        state === 'pending' && 'opacity-50',
                                    )}
                                    key={label}
                                >
                                    {state === 'done' && (
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[rgba(0,201,80,0.2)] text-[#00C950]">
                                            <Check className="size-4" strokeWidth={3} />
                                        </div>
                                    )}
                                    {state === 'active' && (
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)]">
                                            <Loader2 className="size-4 animate-spin text-white" />
                                        </div>
                                    )}
                                    {state === 'pending' && (
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)]">
                                            <span className="text-sm font-medium text-[#94a3b8]">{index + 1}</span>
                                        </div>
                                    )}
                                    <span
                                        className={cn(
                                            'text-sm leading-5',
                                            state === 'pending' ? 'text-[#94a3b8]' : 'text-[#f8fafc]',
                                        )}
                                    >
                                        {label}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs leading-4 text-[#94a3b8]">{t.onboarding.generating.progressLabel}</span>
                            <span className="text-xs font-medium leading-4 text-[#3b82f6]">{t.onboarding.generating.processing}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                            <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] transition-[width] duration-700 ease-out"
                                style={{ width: `${computeEffectiveProgress(progress, elapsedSeconds)}%` }}
                            />
                        </div>
                        {typeof elapsedSeconds === 'number' && elapsedSeconds > 0 && (
                            <div className="mt-1 text-center text-xs text-[#64748b]">
                                {ti(t.onboarding.generating.elapsed, { seconds: elapsedSeconds })}
                            </div>
                        )}
                    </div>

                    {showTimeoutWarning && onCancel && (
                        <div
                            className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
                            role="alert"
                        >
                            <p className="text-center text-sm text-amber-300/90">
                                {t.onboarding.generating.timeoutWarning}
                            </p>
                            <button
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                onClick={onCancel}
                                type="button"
                            >
                                <X className="size-3.5" />
                                {t.onboarding.generating.cancelButton}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function BuilderGenerationView({
    message,
    progress,
    floatingControls,
    elapsedSeconds,
    onCancel,
    showTimeoutWarning,
}: BuilderGenerationViewProps) {
    const { t } = useI18n()

    const leftBody = (
        <div className="flex flex-col gap-6">
            <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)]">
                    <Rocket className="h-4 w-4 text-white" aria-hidden />
                </div>
                <div className="relative rounded-bl-2xl rounded-br-2xl rounded-tl-lg rounded-tr-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] px-[17px] py-[13px] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3)]">
                    <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]" />
                    <p className="relative text-sm leading-5 text-[#f8fafc]">
                        {message || t.onboarding.generating.startingMessage}
                    </p>
                </div>
            </div>

            <div className="lg:hidden">
                <BuilderGenerationCard
                    elapsedSeconds={elapsedSeconds}
                    onCancel={onCancel}
                    progress={progress}
                    showTimeoutWarning={showTimeoutWarning}
                />
            </div>
        </div>
    )

    return (
        <BuilderStepScreen
            floatingControls={floatingControls}
            leftBody={leftBody}
            right={
                <BuilderGenerationCard
                    elapsedSeconds={elapsedSeconds}
                    onCancel={onCancel}
                    progress={progress}
                    showTimeoutWarning={showTimeoutWarning}
                />
            }
            subtitle={t.onboarding.generating.subtitle}
            title={t.onboarding.generating.title}
        />
    )
}
