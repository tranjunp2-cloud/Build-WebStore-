'use client'

import type { ReactNode } from 'react'
import type { ThemeConfig } from '@/blocks/types'
import { BuilderChatBubble } from '@/components/builder/BuilderChatBubble'
import { BuilderGenerationCard } from '@/components/builder/BuilderGenerationCard'
import type { GenerationBrief } from '@/components/builder/BuilderGenerationBrief'
import { BuilderStepScreen } from '@/components/builder/onboarding/BuilderStepScreen'
import { useI18n } from '@/i18n'

interface BuilderGenerationViewProps {
    message?: string
    /** Raw progress from the latest SSE `step` event. */
    progress: number
    floatingControls?: ReactNode
    elapsedSeconds?: number
    onCancel?: () => void
    showTimeoutWarning?: boolean
    /** What the user submitted — read back in the first stage. */
    brief?: GenerationBrief
    /** Theme from the `theme_set` event (null until the AI picks it). */
    theme?: ThemeConfig | null
    blockCount?: number
    /** Streamed blocks rendered with the theme, shown as the desktop preview in the last stage. */
    previewContent?: ReactNode
    urlHost?: string | null
    /** Narrow viewport: the card sits under the chat instead of in the right column. */
    compact?: boolean
}

const EMPTY_BRIEF: GenerationBrief = { businessName: '', industryLabel: '', products: '', shortDescription: '' }

export default function BuilderGenerationView({
    message,
    progress,
    floatingControls,
    elapsedSeconds,
    onCancel,
    showTimeoutWarning,
    brief = EMPTY_BRIEF,
    theme,
    blockCount,
    previewContent,
    urlHost,
    compact = false,
}: BuilderGenerationViewProps) {
    const { t } = useI18n()

    const card = (
        <BuilderGenerationCard
            blockCount={blockCount}
            brief={brief}
            elapsedSeconds={elapsedSeconds}
            fill={!compact}
            onCancel={onCancel}
            previewContent={previewContent}
            progress={progress}
            showTimeoutWarning={showTimeoutWarning}
            theme={theme}
            urlHost={urlHost}
        />
    )

    const leftBody = (
        <div className="flex flex-col gap-3.5">
            <BuilderChatBubble>{message || t.onboarding.generating.startingMessage}</BuilderChatBubble>
            {compact ? card : null}
        </div>
    )

    return (
        <BuilderStepScreen
            floatingControls={floatingControls}
            layout="chat"
            leftBody={leftBody}
            right={compact ? undefined : card}
            subtitle={t.onboarding.generating.subtitle}
            title={t.onboarding.generating.title}
        />
    )
}
