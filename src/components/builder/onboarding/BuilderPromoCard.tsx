import type { ReactNode } from 'react'
import { BUILDER_CARD_BORDER, BuilderGradientBorder, BuilderSparkleGradient } from '@/components/builder/BuilderMotion'
import { BuilderStepList } from '@/components/builder/onboarding/BuilderStepList'

interface BuilderPromoCardProps {
    title: string
    description: string
    steps: Array<{ id: number; label: string; active?: boolean }>
    /** Fill (0–100) of the stepper connectors. */
    connectorFill?: number[]
    /** Live template preview + caption rendered under the stepper. */
    children?: ReactNode
}

/** Right-hand "AI website builder" card on the info step. */
export function BuilderPromoCard({
    title,
    description,
    steps,
    connectorFill,
    children,
}: BuilderPromoCardProps) {
    return (
        <div className="relative mx-auto box-border flex w-full max-w-[540px] flex-col rounded-2xl border border-solid border-[rgba(148,163,184,.1)] bg-[rgba(30,41,59,.6)] p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,.45)]">
            <BuilderGradientBorder gradient={BUILDER_CARD_BORDER} />
            <div className="flex items-center gap-3.5">
                <span className="flex flex-none">
                    <BuilderSparkleGradient size={30} />
                </span>
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-[26px] text-white">{title}</h2>
                    <p className="mt-0.5 text-xs leading-[17px] text-[#94a3b8] [text-wrap:pretty]">{description}</p>
                </div>
            </div>
            <div className="mt-[22px]">
                <BuilderStepList connectorFill={connectorFill} steps={steps} variant="promo" />
            </div>
            {children}
        </div>
    )
}
