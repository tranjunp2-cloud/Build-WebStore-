'use client'

import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { useI18n } from '@/i18n'

type AiReviewIndicatorProps = {
    pending?: boolean
    t: ReturnType<typeof useI18n>['t']
}

/**
 * Pulsing dot + tooltip marking a product created via AI bulk-create as pending
 * human review. Renders nothing when `pending` is falsy. Trigger is a focusable
 * button (not a hover-only span) so it's reachable via keyboard.
 */
export function AiReviewIndicator({ pending, t }: AiReviewIndicatorProps) {
    if (!pending) return null

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={t.dashboard.products.list.aiReviewAriaLabel}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex shrink-0 cursor-help items-center justify-center"
                >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
                </button>
            </TooltipTrigger>
            <TooltipContent>
                <p>{t.dashboard.products.list.aiReviewTooltip}</p>
            </TooltipContent>
        </Tooltip>
    )
}
