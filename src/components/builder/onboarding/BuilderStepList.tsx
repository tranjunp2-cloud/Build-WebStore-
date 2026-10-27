import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BuilderStepState = 'active' | 'done' | 'todo'

interface BuilderStepListItem {
    id: number
    label: string
    /** Shorthand for `state: 'active'`. */
    active?: boolean
    state?: BuilderStepState
}

interface BuilderStepListProps {
    steps: BuilderStepListItem[]
    /** Fill (0–100) of each connector between consecutive steps. */
    connectorFill?: number[]
    /**
     * `promo` — info-step card: numbered dots, the active one pulses.
     * `progress` — generating card: spinner on the active step, check marks on done ones.
     */
    variant?: 'promo' | 'progress'
}

function resolveState(step: BuilderStepListItem): BuilderStepState {
    return step.state ?? (step.active ? 'active' : 'todo')
}

/** Horizontal 3-step stepper: dots joined by gradient-filled connectors. */
export function BuilderStepList({ steps, connectorFill = [], variant = 'promo' }: BuilderStepListProps) {
    const columns = Math.max(steps.length, 1)
    return (
        <div
            className="relative grid"
            data-testid="builder-step-list"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
            {steps.slice(1).map((step, index) => (
                <span
                    aria-hidden
                    className="absolute top-[13px] h-0.5 overflow-hidden rounded-sm bg-[#2a3446]"
                    key={`connector-${step.id}`}
                    style={{
                        left: `calc(${((index * 2 + 1) * 100) / (columns * 2)}% + 20px)`,
                        width: `calc(${100 / columns}% - 40px)`,
                    }}
                >
                    <span
                        className="block h-full transition-[width] duration-500 ease-out [background-image:linear-gradient(90deg,#3b82f6,#2dd4bf)]"
                        data-testid="builder-step-connector-fill"
                        style={{ width: `${Math.max(0, Math.min(100, connectorFill[index] ?? 0))}%` }}
                    />
                </span>
            ))}
            {steps.map((step) => {
                const state = resolveState(step)
                const lit = state !== 'todo'
                return (
                    <div
                        className="flex min-w-0 flex-col items-center gap-2 px-1 text-center"
                        data-state={state}
                        key={step.id}
                    >
                        <span
                            className={cn(
                                'relative z-[1] box-border flex size-7 flex-none items-center justify-center rounded-full border border-solid text-xs font-semibold transition-colors duration-300',
                                lit
                                    ? 'border-[rgba(255,255,255,.2)] text-white [background-image:linear-gradient(135deg,#3b82f6,#2dd4bf)]'
                                    : cn('border-[rgba(148,163,184,.2)] bg-[#1e293b]', variant === 'promo' ? 'text-[#94a3b8]' : 'text-[#64748b]'),
                            )}
                            data-testid="builder-step-dot"
                        >
                            {state === 'active' ? (
                                <span aria-hidden className={cn('bld-glow pointer-events-none absolute rounded-full', variant === 'promo' ? 'inset-0' : '-inset-px')} />
                            ) : null}
                            {variant === 'progress' && state === 'active' ? (
                                <Loader2 aria-hidden className="size-3.5 animate-spin" strokeWidth={2.5} />
                            ) : variant === 'progress' && state === 'done' ? (
                                <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                            ) : (
                                step.id
                            )}
                        </span>
                        <span
                            className={cn(
                                'max-w-[150px] transition-colors duration-300 [text-wrap:balance]',
                                variant === 'promo' ? 'text-xs leading-4' : 'text-[11.5px] leading-[15px]',
                                state === 'active'
                                    ? 'font-semibold text-white'
                                    : state === 'done'
                                        ? 'text-[#cbd5e1]'
                                        : variant === 'promo' ? 'text-[#94a3b8]' : 'text-[#64748b]',
                            )}
                        >
                            {step.label}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
