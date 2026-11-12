import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { PageStatus } from './page-manager-helpers'

const BADGE_BASE = 'inline-flex items-center gap-1.5 rounded-[5px] px-[7px] py-px text-xs font-medium leading-[18px]'

const KIND_STYLE: Record<PageStatus['kind'], { badge: string; dot: string }> = {
    live: {
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-[hsl(var(--success)/0.14)] dark:text-green-400',
        dot: 'bg-[hsl(var(--success))]',
    },
    hidden: {
        badge: 'bg-slate-200 text-slate-700 dark:bg-[var(--editor-overlay-bg)] dark:text-[var(--editor-text-muted)]',
        dot: 'bg-[var(--editor-text-subtle)]',
    },
    draft: {
        badge: 'border border-[var(--editor-border)] bg-[var(--editor-surface-elevated)] text-[var(--editor-text-muted)]',
        dot: '',
    },
}

interface PageStatusBadgeProps {
    status: PageStatus
    labels: { live: string; draft: string; hidden: string; noLink: string }
}

/** Live / Draft / Hidden badge (+ "No Link" for live pages missing from the menu), with explanatory tooltip. */
export function PageStatusBadge({ status, labels }: PageStatusBadgeProps) {
    const style = KIND_STYLE[status.kind]
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex shrink-0 cursor-default items-center gap-1 rounded-[5px] outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]">
                    <span className={cn(BADGE_BASE, style.badge)}>
                        {style.dot ? <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} /> : null}
                        {labels[status.kind]}
                    </span>
                    {status.noLink ? (
                        <span className={cn(BADGE_BASE, 'border border-amber-600/30 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300')}>
                            {labels.noLink}
                        </span>
                    ) : null}
                </span>
            </TooltipTrigger>
            <TooltipContent side="top">{status.tooltip}</TooltipContent>
        </Tooltip>
    )
}
