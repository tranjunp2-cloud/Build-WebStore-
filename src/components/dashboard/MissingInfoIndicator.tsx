'use client'

import { AlertTriangle } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useTapToggleTooltip } from '@/hooks/use-tap-toggle-tooltip'
import type { MissingField } from '@/lib/products/missing-fields'
import type { useI18n } from '@/i18n'

type MissingInfoIndicatorProps = {
    missing: MissingField[]
    t: ReturnType<typeof useI18n>['t']
}

/**
 * Soft, read-only warning icon + tooltip for products missing ALT text and/or
 * category (GH-1457). Renders nothing when `missing` is empty. Trigger is a
 * focusable button (not a hover-only span) so it's reachable via keyboard.
 *
 * `open` is controlled via `useTapToggleTooltip` so a tap opens/closes it on
 * touch devices (Radix Tooltip only reacts to hover/focus by default) and taps
 * outside the trigger close it — desktop hover/focus behavior is unchanged.
 */
export function MissingInfoIndicator({ missing, t }: MissingInfoIndicatorProps) {
    const { open, setOpen, triggerRef, toggle } = useTapToggleTooltip<HTMLButtonElement>()
    if (!missing.length) return null

    const label = (field: MissingField) =>
        field === 'alt' ? t.dashboard.products.list.missingAlt : t.dashboard.products.list.missingCategory

    return (
        <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger asChild>
                <button
                    ref={triggerRef}
                    type="button"
                    aria-label={t.dashboard.products.list.missingInfoTitle}
                    onClick={toggle}
                    className="inline-flex shrink-0 cursor-help items-center justify-center"
                >
                    <AlertTriangle className="w-4 h-4 text-warning" aria-hidden="true" />
                </button>
            </TooltipTrigger>
            <TooltipContent>
                <p className="font-medium mb-1">{t.dashboard.products.list.missingInfoTitle}</p>
                <ul className="list-disc pl-4">
                    {missing.map((field) => (
                        <li key={field}>{label(field)}</li>
                    ))}
                </ul>
            </TooltipContent>
        </Tooltip>
    )
}
