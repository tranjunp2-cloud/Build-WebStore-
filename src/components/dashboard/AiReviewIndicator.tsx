'use client'

import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useTapToggleTooltip } from '@/hooks/use-tap-toggle-tooltip'
import type { useI18n } from '@/i18n'

type AiReviewIndicatorProps = {
    pending?: boolean
    t: ReturnType<typeof useI18n>['t']
}

/**
 * Pulsing dot + tooltip marking a product created via AI bulk-create as pending
 * human review. Renders nothing when `pending` is falsy. Trigger is a focusable
 * button (not a hover-only span) so it's reachable via keyboard.
 *
 * `open` is controlled via `useTapToggleTooltip` so a tap opens/closes it on
 * touch devices (Radix Tooltip only reacts to hover/focus by default) and taps
 * outside the trigger close it — desktop hover/focus behavior is unchanged.
 */
export function AiReviewIndicator({ pending, t }: AiReviewIndicatorProps) {
    const { open, onOpenChange, onPointerDown, onFocus, onClick, ref } = useTapToggleTooltip<HTMLButtonElement>()
    if (!pending) return null

    return (
        <Tooltip open={open} onOpenChange={onOpenChange}>
            <TooltipTrigger asChild>
                <button
                    ref={ref}
                    type="button"
                    aria-label={t.dashboard.products.list.aiReviewAriaLabel}
                    onPointerDown={onPointerDown}
                    onFocus={onFocus}
                    onClick={onClick}
                    className="inline-flex shrink-0 items-center justify-center"
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
