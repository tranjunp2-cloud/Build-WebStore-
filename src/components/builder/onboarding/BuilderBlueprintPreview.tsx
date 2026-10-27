import { Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GradientHairline } from '@/components/builder/onboarding/GradientHairline'
import {
    BuilderBlueprintWireframe,
    type BlueprintWireframeProps,
} from '@/components/builder/onboarding/BuilderBlueprintWireframe'
import { productChips, type BlueprintField } from '@/components/builder/onboarding/builder-blueprint-styles'

interface BuilderBlueprintPreviewProps extends BlueprintWireframeProps {
    industry: string
    title: string
    description: string
    steps: [string, string, string]
    caption: string
    readyCaption: string
    /** Accessible label for the n/4 counter, e.g. "2 of 4 details added". */
    countLabel: (count: number) => string
}

const FIELDS: BlueprintField[] = ['businessName', 'industry', 'products', 'shortDescription']

// Right column of the info step: a live template wireframe that fills in as the user types,
// with a 3-step stepper and an n/4 "details added" counter.
export function BuilderBlueprintPreview(props: BuilderBlueprintPreviewProps) {
    const filled: Record<BlueprintField, boolean> = {
        businessName: !!props.businessName.trim(),
        industry: !!props.industry,
        products: productChips(props.products).length > 0,
        shortDescription: !!props.shortDescription.trim(),
    }
    const count = FIELDS.filter((field) => filled[field]).length
    const ready = count === FIELDS.length

    return (
        <div className="relative mx-auto w-full max-w-[540px] rounded-2xl border border-[rgba(148,163,184,0.1)] bg-[#141d2d] p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)]">
            {/* Top-lit gradient hairline border (mask keeps only the 1px ring, not the card fill). */}
            <GradientHairline gradient="linear-gradient(165deg,rgba(56,189,248,0.28) 0%,rgba(56,189,248,0.06) 32%,rgba(148,163,184,0.03) 58%,rgba(45,212,191,0.2) 100%)" />

            <div className="flex items-center gap-3.5">
                <svg aria-hidden className="absolute size-0" focusable="false">
                    <defs>
                        <linearGradient gradientUnits="userSpaceOnUse" id="builder-blueprint-spark" x1="2" x2="22" y1="2" y2="22">
                            <stop offset="0" stopColor="#3b82f6" />
                            <stop offset="1" stopColor="#2dd4bf" />
                        </linearGradient>
                    </defs>
                </svg>
                <Sparkles aria-hidden className="size-[30px] shrink-0" stroke="url(#builder-blueprint-spark)" />
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-[26px] text-white">{props.title}</h2>
                    <p className="mt-0.5 text-xs leading-[17px] text-[#94a3b8] [text-wrap:pretty]">{props.description}</p>
                </div>
            </div>

            <ol className="relative mt-[22px] grid grid-cols-3">
                <span aria-hidden className="absolute left-[calc(16.667%+20px)] top-[13px] h-0.5 w-[calc(33.333%-40px)] overflow-hidden rounded-sm bg-[#2a3446]">
                    <span className="block h-full bg-[linear-gradient(90deg,#3b82f6,#2dd4bf)] transition-[width] duration-500" style={{ width: `${(count / FIELDS.length) * 100}%` }} />
                </span>
                <span aria-hidden className="absolute left-[calc(50%+20px)] top-[13px] h-0.5 w-[calc(33.333%-40px)] rounded-sm bg-[#2a3446]" />
                {props.steps.map((label, i) => (
                    <li aria-current={i === 0 ? 'step' : undefined} className="flex min-w-0 flex-col items-center gap-2 px-1 text-center" key={label}>
                        <span
                            className={cn(
                                'relative z-[1] flex size-7 items-center justify-center rounded-full border text-xs font-semibold',
                                i === 0
                                    ? 'border-white/20 bg-[linear-gradient(135deg,#3b82f6,#2dd4bf)] text-white shadow-[0_0_12px_rgba(45,212,191,0.3)]'
                                    : 'border-[rgba(148,163,184,0.2)] bg-[#1e293b] text-[#94a3b8]',
                            )}
                        >
                            {i === 0 ? <span aria-hidden className="absolute inset-0 rounded-full ring-2 ring-[rgba(56,189,248,0.5)] motion-safe:animate-ping motion-safe:[animation-duration:2.4s]" /> : null}
                            {i + 1}
                        </span>
                        <span className={cn('max-w-[150px] text-xs leading-4 [text-wrap:balance]', i === 0 ? 'font-semibold text-white' : 'text-[#94a3b8]')}>{label}</span>
                    </li>
                ))}
            </ol>

            <BuilderBlueprintWireframe {...props} />

            <div className="mt-3.5 flex items-center gap-2.5">
                <span
                    className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full transition-[background-color,color,box-shadow] duration-300',
                        ready ? 'bg-[#2dd4bf] text-[#0b1222] shadow-[0_0_12px_rgba(45,212,191,0.45)]' : 'bg-[rgba(56,189,248,0.12)] text-[#38bdf8]',
                    )}
                >
                    {ready ? <Check aria-hidden className="size-[11px]" strokeWidth={3} /> : <Sparkles aria-hidden className="size-[11px]" strokeWidth={2.25} />}
                </span>
                <p aria-live="polite" className="min-w-0 flex-1 text-[12.5px] font-medium leading-[18px] text-[#e2e8f0] [text-wrap:pretty]">
                    {ready ? props.readyCaption : props.caption}
                </p>
                <div aria-label={props.countLabel(count)} className="flex shrink-0 items-center gap-2" role="img">
                    <div className="flex gap-[3px]">
                        {FIELDS.map((field) => (
                            <span
                                className={cn(
                                    'block h-1 w-3.5 rounded-sm transition-colors duration-200',
                                    props.errors[field] ? 'bg-[#f87171]' : filled[field] ? 'bg-[#2dd4bf]' : props.focus === field ? 'bg-[#38bdf8]' : 'bg-[#2a3446]',
                                )}
                                key={field}
                            />
                        ))}
                    </div>
                    <span className="text-xs font-semibold leading-[18px] text-[#38bdf8] tabular-nums">{count}/4</span>
                </div>
            </div>
        </div>
    )
}
