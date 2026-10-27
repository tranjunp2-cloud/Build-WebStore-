import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BuilderOnboardingShell } from '@/components/builder/onboarding/BuilderOnboardingShell'
import { BuilderStepHeader } from '@/components/builder/onboarding/BuilderStepHeader'

interface BuilderStepScreenProps {
    title: string
    subtitle: string
    description?: string
    leftBody: ReactNode
    leftFooter?: ReactNode
    right?: ReactNode
    gridClassName?: string
    rightPaneClassName?: string
    rightContentClassName?: string
    floatingControls?: ReactNode
    /** Narrow chat column (generation/completion): 32px gutters, no scrollbar gap. */
    compactLeft?: boolean
}

export function BuilderStepScreen({
    title,
    subtitle,
    description = '',
    leftBody,
    leftFooter,
    right,
    gridClassName,
    rightPaneClassName,
    rightContentClassName,
    floatingControls,
    compactLeft,
}: BuilderStepScreenProps) {
    const leftPane = (
        <div className={cn('mx-auto flex h-[100dvh] w-full flex-col px-6', compactLeft ? 'sm:px-8' : 'max-w-[920px] sm:px-10 lg:ml-auto lg:mr-0 lg:max-w-[880px] lg:px-10')}>
            <div className="sticky top-0 z-10 bg-[#0b1120] pb-8 pt-6">
                <BuilderStepHeader
                    description={description}
                    subtitle={subtitle}
                    title={title}
                />
            </div>

            {/* overflow-x-hidden: card hairlines/glows sit 1px outside their box and must not create a horizontal scrollbar. */}
            <div className={cn('min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[19px]', compactLeft ? '-mx-1 px-1' : 'lg:pr-[19px]')}>
                {leftBody}
            </div>

            {leftFooter ? (
                <div className="sticky bottom-0 z-10 bg-[#0b1120] pb-6 pt-4">
                    {leftFooter}
                </div>
            ) : null}
        </div>
    )

    return (
        <>
            <BuilderOnboardingShell
                left={leftPane}
                right={right}
                gridClassName={gridClassName}
                rightContentClassName={rightContentClassName}
                rightPaneClassName={rightPaneClassName}
            />
            {floatingControls ? (
                <div className="fixed bottom-6 right-6 z-[70]">
                    {floatingControls}
                </div>
            ) : null}
        </>
    )
}
