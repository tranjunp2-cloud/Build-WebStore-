import type { ReactNode } from 'react'
import { BuilderOnboardingShell } from '@/components/builder/onboarding/BuilderOnboardingShell'
import { BuilderStepHeader } from '@/components/builder/onboarding/BuilderStepHeader'

interface BuilderStepScreenProps {
    title: string
    subtitle: string
    description?: string
    leftBody: ReactNode
    leftFooter?: ReactNode
    right?: ReactNode
    rightPaneClassName?: string
    rightContentClassName?: string
    floatingControls?: ReactNode
}

export function BuilderStepScreen({
    title,
    subtitle,
    description = '',
    leftBody,
    leftFooter,
    right,
    rightPaneClassName,
    rightContentClassName,
    floatingControls,
}: BuilderStepScreenProps) {
    const leftPane = (
        <div className="mx-auto flex h-[100dvh] w-full max-w-[920px] flex-col px-6 sm:px-10 lg:ml-auto lg:mr-0 lg:max-w-[880px] lg:px-10">
            <div className="sticky top-0 z-10 bg-[#0b1120] pb-11">
                <BuilderStepHeader
                    description={description}
                    subtitle={subtitle}
                    title={title}
                />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-0 pb-[19px] lg:pr-[19px]">
                {leftBody}
            </div>

            {leftFooter ? (
                <div className="sticky bottom-0 z-10 bg-[#0b1120] pb-8 pt-[19px] sm:pb-10 lg:pb-[60px]">
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
