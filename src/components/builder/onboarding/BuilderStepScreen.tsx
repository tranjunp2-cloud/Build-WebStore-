import type { ReactNode } from 'react'
import { BuilderMotionStyles } from '@/components/builder/BuilderMotion'
import { BuilderOnboardingShell } from '@/components/builder/onboarding/BuilderOnboardingShell'
import { BuilderStepHeader } from '@/components/builder/onboarding/BuilderStepHeader'
import { cn } from '@/lib/utils'

interface BuilderStepScreenProps {
    title: string
    subtitle: string
    description?: string
    leftBody: ReactNode
    leftFooter?: ReactNode
    right?: ReactNode
    /**
     * `form` — info step: two equal columns, the right one centres a card.
     * `chat` — generating / done: narrow chat column (min(440px, 40%)) and a
     * right column that the generating card or the preview fills.
     */
    layout?: 'form' | 'chat'
    gridClassName?: string
    rightPaneClassName?: string
    rightContentClassName?: string
    floatingControls?: ReactNode
}

const FORM_RIGHT_BG =
    '[background:radial-gradient(ellipse_at_100%_0%,rgba(20,90,90,.35),transparent_55%),radial-gradient(ellipse_at_0%_100%,rgba(20,90,90,.3),transparent_55%),linear-gradient(160deg,#0f1b33_0%,#0d1a2b_50%,#0b1424_100%)]'
const CHAT_RIGHT_BG =
    '[background:radial-gradient(ellipse_at_100%_0%,rgba(20,90,90,.25),transparent_50%),#0b1222]'

export function BuilderStepScreen({
    title,
    subtitle,
    description = '',
    leftBody,
    leftFooter,
    right,
    layout = 'form',
    gridClassName,
    rightPaneClassName,
    rightContentClassName,
    floatingControls,
}: BuilderStepScreenProps) {
    const isForm = layout === 'form'
    const leftPane = (
        <div
            className={cn(
                'flex h-[100dvh] w-full min-w-0 flex-col px-6',
                isForm ? 'pb-4 pt-6 sm:px-10 lg:pl-[42px] lg:pr-[30px]' : 'pb-6 pt-3.5 sm:px-8',
            )}
        >
            <BuilderStepHeader
                description={description}
                subtitle={subtitle}
                title={title}
                variant={layout}
            />

            <div
                className={cn(
                    'min-h-0 flex-1 overflow-y-auto overflow-x-hidden',
                    isForm ? '-ml-4 mt-9 pl-4 pr-3.5 pt-1' : '-mx-1 mt-7 px-1 pb-5 pt-1',
                )}
            >
                {leftBody}
            </div>

            {leftFooter ? (
                <div className={cn('flex-none', !isForm && 'pt-3')}>
                    {leftFooter}
                </div>
            ) : null}
        </div>
    )

    return (
        <>
            <BuilderMotionStyles />
            <BuilderOnboardingShell
                left={leftPane}
                right={right}
                gridClassName={cn(!isForm && 'lg:grid-cols-[min(440px,40%)_minmax(0,1fr)]', gridClassName)}
                rightContentClassName={cn(
                    isForm ? 'm-auto max-w-[540px]' : 'flex flex-1 flex-col',
                    rightContentClassName,
                )}
                rightPaneClassName={cn(
                    isForm ? `px-10 py-8 ${FORM_RIGHT_BG}` : `flex-col pb-2.5 pr-2.5 pt-[18px] ${CHAT_RIGHT_BG}`,
                    rightPaneClassName,
                )}
            />
            {floatingControls ? (
                <div className="fixed bottom-6 right-6 z-[70]">
                    {floatingControls}
                </div>
            ) : null}
        </>
    )
}
