import type { LucideIcon } from 'lucide-react'
import { Image as ImageIcon, Lock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    BAR_CLASS,
    SECTION_CLASS,
    liveClass,
    productChips,
    slotClass,
    type BlueprintState,
} from '@/components/builder/onboarding/builder-blueprint-styles'

export interface BlueprintWireframeProps extends BlueprintState {
    businessName: string
    shortDescription: string
    products: string
    siteHost: string
    industryIcon: LucideIcon
    industryLabel: string
    /** True while an industry card (other than the selected one) is hovered. */
    industryHovered: boolean
    labels: { businessName: string; shortDescription: string; products: string }
}

const AI_CHIP = (
    <span className="absolute right-2 top-0 z-[1] flex h-3.5 -translate-y-1/2 items-center gap-[3px] rounded-full border border-[rgba(45,212,191,0.4)] bg-[#0b1222] px-[5px] text-[8.5px] font-semibold leading-none tracking-[0.04em] text-[#5eead4]">
        <Sparkles aria-hidden className="size-2" strokeWidth={2.5} />
        AI
    </span>
)

function Caret({ show }: { show: boolean }) {
    if (!show) return null
    return <span className="ml-0.5 inline-block h-[0.95em] w-[1.5px] align-[-0.1em] bg-[#38bdf8] motion-safe:animate-pulse" />
}

// Mini-browser website skeleton whose dashed slots fill live with the info-step form values.
export function BuilderBlueprintWireframe(props: BlueprintWireframeProps) {
    const { businessName, shortDescription, products, siteHost, labels, focus } = props
    const IndustryIcon = props.industryIcon
    const name = businessName.trim()
    const description = shortDescription.trim()
    const chips = productChips(products)

    return (
        <div aria-hidden className="mt-5 overflow-hidden rounded-xl border border-[rgba(148,163,184,0.14)] bg-[#0b1222] shadow-[0_14px_30px_-14px_rgba(0,0,0,0.7)]">
            <div className="flex h-8 items-center gap-2.5 border-b border-[rgba(148,163,184,0.1)] bg-[#0f1729] px-3">
                <div className="flex w-[34px] shrink-0 gap-[5px]">
                    {[0, 1, 2].map((i) => <span className="size-[7px] rounded-full bg-[#334155]" key={i} />)}
                </div>
                <div className="flex min-w-0 flex-1 justify-center">
                    <div className="flex h-5 min-w-0 max-w-full items-center gap-1.5 rounded-md border border-[rgba(148,163,184,0.1)] bg-[#172033] px-2.5 text-[#64748b]">
                        <Lock className="size-2.5 shrink-0" strokeWidth={2.5} />
                        {name ? (
                            <span className={cn('truncate text-[10.5px] leading-[14px] transition-colors', focus === 'businessName' ? 'text-[#7dd3fc]' : 'text-[#94a3b8]')}>{siteHost}</span>
                        ) : (
                            <span className="block h-1.5 w-[130px] rounded-[3px] bg-[rgba(148,163,184,0.18)]" />
                        )}
                    </div>
                </div>
                <span className="w-[34px] shrink-0" />
            </div>

            <div className="flex flex-col gap-2 p-3">
                {/* Navigation */}
                <div className={cn(SECTION_CLASS, 'flex h-[30px] items-center justify-between gap-2.5 px-2')}>
                    <div className="flex min-w-0 items-center gap-1.5">
                        <span className="size-2.5 shrink-0 rounded-[3px] bg-[rgba(148,163,184,0.35)]" />
                        {name ? (
                            <span className={cn('max-w-[150px] truncate px-0.5 text-[10px] font-bold leading-[14px] text-[#f1f5f9]', liveClass(props, 'businessName'))}>{name}</span>
                        ) : (
                            <span className={slotClass(props, 'businessName')}>{labels.businessName}</span>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-[7px]">
                        {[0, 1, 2].map((i) => <span className={cn(BAR_CLASS, 'h-[3px] w-4 bg-[rgba(148,163,184,0.25)]')} key={i} />)}
                        <span className="block h-2.5 w-[26px] rounded-[3px] bg-[rgba(148,163,184,0.3)]" />
                    </div>
                </div>

                {/* Hero */}
                <div className={cn(SECTION_CLASS, 'grid min-h-[116px] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3 p-3')}>
                    <div className="flex min-w-0 flex-col items-start justify-center gap-2">
                        {name ? (
                            <div className={cn('-mx-[3px] line-clamp-2 max-w-full break-words px-[3px] text-base font-bold leading-5 text-[#f8fafc]', liveClass(props, 'businessName'))}>
                                {name}<Caret show={focus === 'businessName'} />
                            </div>
                        ) : (
                            <span className={slotClass(props, 'businessName', 'h-[26px] rounded-md px-2.5 text-[11.5px] leading-4')}>{labels.businessName}</span>
                        )}
                        {description ? (
                            <div className={cn('-mx-[3px] line-clamp-2 max-w-full break-words px-[3px] py-px text-[10px] leading-[14px] text-[#cbd5e1]', liveClass(props, 'shortDescription'))}>
                                {description}<Caret show={focus === 'shortDescription'} />
                            </div>
                        ) : (
                            <span className={slotClass(props, 'shortDescription', 'flex h-[34px] w-full items-start px-2 py-[5px]')}>{labels.shortDescription}</span>
                        )}
                        <div className="mt-0.5 flex gap-1.5">
                            <span className="block h-3 w-[38px] rounded-[3px] bg-[rgba(148,163,184,0.3)]" />
                            <span className="block h-3 w-8 rounded-[3px] border border-[rgba(148,163,184,0.3)]" />
                        </div>
                    </div>
                    <div
                        className={cn(
                            'relative flex min-w-0 flex-col items-center justify-center gap-[7px] rounded-md border p-2 transition-[border-color,background-color,box-shadow] duration-200',
                            props.industryHovered
                                ? 'border-solid border-[#38bdf8] bg-[rgba(56,189,248,0.12)] shadow-[0_0_0_3px_rgba(56,189,248,0.1),0_0_18px_rgba(56,189,248,0.25)]'
                                : 'border-dashed border-[rgba(56,189,248,0.5)] bg-[rgba(56,189,248,0.05)]',
                        )}
                    >
                        <span className="flex size-9 items-center justify-center rounded-[10px] border border-[rgba(56,189,248,0.35)] bg-[rgba(56,189,248,0.12)] text-[#7dd3fc]">
                            <IndustryIcon className="size-[18px]" />
                        </span>
                        <span className="max-w-full text-center text-[10px] font-medium leading-[13px] text-[#e0f2fe] [text-wrap:balance]">{props.industryLabel}</span>
                    </div>
                </div>

                {/* Features (AI) */}
                <div className={cn(SECTION_CLASS, 'grid grid-cols-3 gap-[7px] p-[7px]')}>
                    {AI_CHIP}
                    {[0, 1, 2].map((i) => (
                        <div className="flex h-[26px] min-w-0 items-center gap-1.5 rounded-[5px] bg-[rgba(148,163,184,0.06)] px-[7px]" key={i}>
                            <span className="size-2.5 shrink-0 rounded-full bg-[rgba(148,163,184,0.25)]" />
                            <div className="grid min-w-0 flex-1 gap-[3px]">
                                <span className={cn(BAR_CLASS, 'h-[3px] w-[85%] bg-[rgba(148,163,184,0.3)]')} />
                                <span className={cn(BAR_CLASS, 'h-[3px] w-[60%] bg-[rgba(148,163,184,0.2)]')} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Products */}
                <div className={cn(SECTION_CLASS, 'grid grid-cols-4 gap-[7px] px-[7px] pb-[7px] pt-2')}>
                    {[0, 1, 2, 3].map((j) => (
                        <div className="flex min-w-0 flex-col gap-[5px]" key={j}>
                            <div className="flex h-[30px] items-center justify-center rounded bg-[rgba(148,163,184,0.08)] text-[#475569]">
                                <ImageIcon className="size-[11px]" />
                            </div>
                            {chips[j] ? (
                                <span className={cn('-mx-0.5 block truncate px-0.5 text-[9.5px] font-medium leading-3 text-[#f1f5f9]', liveClass(props, 'products'))}>{chips[j]}</span>
                            ) : (
                                <span className={cn(BAR_CLASS, 'my-1 h-1 w-[70%] bg-[rgba(148,163,184,0.25)]')} />
                            )}
                            <span className={cn(BAR_CLASS, 'h-1 w-[32%] bg-[rgba(148,163,184,0.2)]')} />
                        </div>
                    ))}
                    {chips.length === 0 ? (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <span className={slotClass(props, 'products', props.errors.products ? 'bg-[#2a1418]' : focus === 'products' ? 'bg-[#0f2a40]' : 'bg-[#0e1a2c]')}>{labels.products}</span>
                        </div>
                    ) : null}
                </div>

                {/* Testimonials (AI) */}
                <div className={cn(SECTION_CLASS, 'flex h-6 items-center justify-center gap-2')}>
                    {AI_CHIP}
                    <div className="flex">
                        {[0.4, 0.3, 0.22].map((alpha, i) => (
                            <span className={cn('block size-[9px] rounded-full border border-[#0b1222]', i && '-ml-[3px]')} key={alpha} style={{ backgroundColor: `rgba(148,163,184,${alpha})` }} />
                        ))}
                    </div>
                    <span className={cn(BAR_CLASS, 'h-1 w-[30%] bg-[rgba(148,163,184,0.25)]')} />
                </div>

                {/* Footer */}
                <div className={cn(SECTION_CLASS, 'flex h-5 items-center justify-between px-2')}>
                    <span className={cn(BAR_CLASS, 'h-[3px] w-7 bg-[rgba(148,163,184,0.25)]')} />
                    <div className="flex gap-[5px]">
                        {[0, 1, 2].map((i) => <span className={cn(BAR_CLASS, 'h-[3px] w-3 bg-[rgba(148,163,184,0.25)]')} key={i} />)}
                    </div>
                </div>
            </div>
        </div>
    )
}
