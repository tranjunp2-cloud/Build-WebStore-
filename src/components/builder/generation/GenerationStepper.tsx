'use client'

import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSegmentFill } from './generation-utils'

interface GenerationStepperProps {
    labels: string[]
    activeStep: number
    progress: number
    /** Final step shows as done once the preview is ready. */
    ready?: boolean
    /** Explicit connector fills (0–100); falls back to progress-based fills. */
    fills?: [number, number]
}

/** Horizontal 3-step stepper. Connector tracks sit between dot centres and fill with the real progress. */
export function GenerationStepper({ labels, activeStep, progress, ready = false, fills }: GenerationStepperProps) {
    return (
        <ol className="relative mx-auto mt-[22px] grid w-full max-w-[820px] grid-cols-3">
            {[0, 1].map((i) => (
                <span
                    aria-hidden
                    className="absolute top-[13px] h-0.5 overflow-hidden rounded-sm bg-[#2a3446]"
                    key={i}
                    style={{ left: `calc(${((i * 2 + 1) * 100) / 6}% + 20px)`, width: 'calc(33.333% - 40px)' }}
                >
                    <span
                        className="block h-full bg-[linear-gradient(90deg,#3b82f6,#2dd4bf)] transition-[width] duration-[600ms] ease-out motion-reduce:transition-none"
                        data-testid="stepper-fill"
                        style={{ width: `${fills ? fills[i] : getSegmentFill(i as 0 | 1, activeStep, progress)}%` }}
                    />
                </span>
            ))}
            {labels.map((label, index) => {
                const done = index < activeStep || (index === 2 && ready)
                const active = index === activeStep && !done
                const lit = active || done
                return (
                    <li
                        aria-current={active ? 'step' : undefined}
                        className="relative flex min-w-0 flex-col items-center gap-2 px-1 text-center"
                        data-state={done ? 'done' : active ? 'active' : 'pending'}
                        key={label}
                    >
                        <span
                            className={cn(
                                'relative z-[1] box-border flex size-7 items-center justify-center rounded-full border text-xs font-semibold transition-[background-color,border-color,color] duration-[350ms]',
                                lit ? 'border-white/20 bg-[#2f9be6] bg-[linear-gradient(135deg,#3b82f6,#2dd4bf)] text-white' : 'border-[rgba(148,163,184,0.2)] bg-[#1e293b] text-[#64748b]',
                            )}
                        >
                            {active && <span aria-hidden className="pointer-events-none absolute -inset-px rounded-full motion-safe:animate-pw-glow" />}
                            {active && <Loader2 className="size-3.5 motion-safe:animate-spin" strokeWidth={2.5} />}
                            {done && <Check className="size-3.5" strokeWidth={2.5} />}
                            {!lit && index + 1}
                        </span>
                        <span
                            className={cn(
                                'max-w-[150px] text-[11.5px] leading-[15px] [text-wrap:balance] transition-colors duration-300',
                                active ? 'font-semibold text-white' : done ? 'text-[#cbd5e1]' : 'text-[#64748b]',
                            )}
                        >
                            {label}
                        </span>
                    </li>
                )
            })}
        </ol>
    )
}
