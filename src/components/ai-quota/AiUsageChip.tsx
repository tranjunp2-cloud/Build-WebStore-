'use client'

import { BatteryFull, BatteryLow, BatteryMedium, BatteryWarning, ImageIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SSO_PORTAL_URL } from '@/config/app-switcher'
import { cn } from '@/lib/utils'
import { type AiTone, batteryIcon } from './quota-format'
import { useAiUsage } from './use-ai-usage'
import { useAiUsageText } from './ai-usage-text'

const ICONS = { 'battery-full': BatteryFull, 'battery-medium': BatteryMedium, 'battery-low': BatteryLow, 'battery-warning': BatteryWarning }

const toneIcon = (tone: AiTone) => (tone === 'out' ? 'text-destructive' : tone === 'low' ? 'text-warning' : 'text-dash-text-muted')

/**
 * "AI 72%" in the dashboard header and the editor top bar: the shop's AI allowance (assistant + writing tools, one
 * battery; pictures counted apart). Neutral until ≤ 20 % (amber) or empty (red); opens a small popover with the
 * battery, when more comes back, pictures left and the plan. Hidden when the allowance can't be read.
 */
export function AiUsageChip({ variant = 'dashboard' }: { variant?: 'dashboard' | 'editor' }) {
    const { usage, loading } = useAiUsage()
    const text = useAiUsageText(usage)
    const editor = variant === 'editor'
    const height = editor ? 'h-8' : 'h-10'

    if (loading) {
        return (
            <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm text-dash-text-muted', height)} aria-busy="true">
                <BatteryMedium className="size-4" aria-hidden />
                <span className="animate-pulse motion-reduce:animate-none" aria-hidden>AI …</span>
            </span>
        )
    }
    if (!usage || !text) return null

    const Icon = ICONS[batteryIcon(usage)]
    const toneClass =
        text.tone === 'out'
            ? 'bg-destructive/10 ring-1 ring-inset ring-destructive/25 hover:ring-destructive/50'
            : text.tone === 'low'
              ? 'bg-warning/10 ring-1 ring-inset ring-warning/30 hover:ring-warning/60'
              : editor
                ? 'hover:bg-white/[0.06] data-[state=open]:bg-white/[0.06]'
                : 'hover:bg-dash-surface-hover data-[state=open]:bg-dash-surface-hover'
    const fill = text.tone === 'out' ? '' : text.tone === 'low' ? 'bg-warning' : 'bg-primary'

    return (
        <Popover>
            <PopoverTrigger
                type="button"
                aria-label={text.chipAria}
                title={text.chipAria}
                className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-lg border-none px-2.5 text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary',
                    editor ? 'text-[12px] text-slate-200' : 'text-dash-text',
                    height,
                    toneClass,
                )}
            >
                <Icon className={cn('size-4 shrink-0', toneIcon(text.tone))} aria-hidden />
                {text.chip}
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl border-dash-border bg-dash-surface p-4 text-dash-text">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">{text.q.title}</p>
                    <p className="text-sm font-semibold tabular-nums">{text.pct}%</p>
                </div>
                <div
                    className={cn('mt-2 h-2 rounded-full', text.tone === 'out' ? 'bg-destructive/15' : 'bg-dash-text/5')}
                    role="progressbar"
                    aria-label={text.q.title}
                    aria-valuenow={text.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    {text.pct > 0 && <div className={cn('h-2 rounded-full', fill)} style={{ width: `${text.pct}%` }} />}
                </div>
                <p className="mt-2 text-pretty text-sm text-dash-text-muted">{text.sentence}</p>
                <div className="mt-4 flex items-center gap-2 border-t border-dash-border pt-3 text-sm">
                    <ImageIcon className={cn('size-4 shrink-0', toneIcon(text.picturesTone))} aria-hidden />
                    <span>{text.q.pictures}</span>
                    <span className="ml-auto font-medium tabular-nums">{text.pictures}</span>
                </div>
                <p className="mt-3 text-xs text-dash-text-muted">{text.q.hint}</p>
                {(text.plan || text.tone !== 'ok') && (
                    <div className="mt-3 flex items-center gap-3 border-t border-dash-border pt-3 text-xs text-dash-text-muted">
                        {text.plan && <span>{text.plan}</span>}
                        {text.tone !== 'ok' && (
                            <a href={SSO_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex min-h-8 items-center font-medium text-dash-text underline-offset-4 hover:underline">
                                {text.q.upgrade}
                            </a>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
