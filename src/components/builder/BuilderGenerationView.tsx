'use client'

import type { ReactNode } from 'react'
import { Rocket } from 'lucide-react'
import { BuilderStepScreen } from '@/components/builder/onboarding/BuilderStepScreen'
import { GenerationCard, type GenerationCardProps } from '@/components/builder/generation/GenerationCard'
import { useMediaQuery } from '@/components/builder/generation/generation-hooks'
import { useI18n } from '@/i18n'

interface BuilderGenerationViewProps extends GenerationCardProps {
    message?: string
    floatingControls?: ReactNode
}

export default function BuilderGenerationView({
    message,
    floatingControls,
    ...cardProps
}: BuilderGenerationViewProps) {
    const { t } = useI18n()
    // Render exactly one card: in the right pane on lg+, inline below the chat bubble otherwise.
    // jsdom/SSR (no matchMedia) default to the desktop layout.
    const isDesktop = useMediaQuery('(min-width: 1024px)', true, true)

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

            {!isDesktop && (
                <div className="lg:hidden">
                    <GenerationCard {...cardProps} />
                </div>
            )}
        </div>
    )

    return (
        <BuilderStepScreen
            floatingControls={floatingControls}
            compactLeft
            gridClassName="lg:grid-cols-[min(440px,40%)_1fr]"
            leftBody={leftBody}
            right={isDesktop ? <GenerationCard {...cardProps} /> : undefined}
            rightContentClassName="h-full max-w-none px-0 py-4 pr-3 xl:px-0 xl:pr-3"
            rightPaneClassName="lg:items-stretch lg:justify-stretch"
            subtitle={t.onboarding.generating.subtitle}
            title={t.onboarding.generating.title}
        />
    )
}
