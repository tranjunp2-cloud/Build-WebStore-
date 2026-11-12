'use client'

import { BatteryLow, BatteryWarning } from 'lucide-react'
import type { ReactNode } from 'react'
import { SSO_PORTAL_URL } from '@/config/app-switcher'
import { useAiUsage, useRefreshAiUsageAfterReply } from './use-ai-usage'
import { useAiUsageText } from './ai-usage-text'
import { SHOW_AI_LEVEL } from './quota-format'

/**
 * What an assistant chat shows about the shop's AI allowance: nothing while there is plenty; a slim amber line at
 * ≤ 20 %; when it is used up a box with when it comes back (+ Upgrade plan), the composer closed and the starters
 * gone. `busy` is the chat's reply-in-progress flag: the allowance is re-read when a reply finishes. `showLevel`
 * off (default while SHOW_AI_LEVEL is off) drops the ≤ 20 % line; the used-up state still shows.
 */
export function useAiChatQuota({ busy, editor = false, showLevel = SHOW_AI_LEVEL }: { busy: boolean; editor?: boolean; showLevel?: boolean }): {
    notice?: ReactNode
    locked?: { placeholder: string }
    out: boolean
} {
    const { usage } = useAiUsage()
    useRefreshAiUsageAfterReply(busy)
    const text = useAiUsageText(usage)
    if (!text || text.tone === 'ok' || (text.tone === 'low' && !showLevel)) return { out: false }
    const { q, ti, time } = text

    if (text.tone === 'low') {
        return {
            out: false,
            notice: (
                <div role="status" className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-[13px] text-dash-text">
                    <BatteryLow className="size-4 shrink-0 text-warning" aria-hidden />
                    <span className="min-w-0 text-pretty">
                        {ti(q.lowLine, { pct: text.pct })}
                        {time && <span className="whitespace-nowrap text-dash-text-muted"> · {ti(q.moreAt, { time })}</span>}
                    </span>
                </div>
            ),
        }
    }

    return {
        out: true,
        locked: { placeholder: time ? ti(q.placeholder, { time }) : q.placeholderNoTime },
        notice: (
            <div role="status" className="mx-3 mb-2 flex items-start gap-3 rounded-2xl border border-dash-border bg-dash-bg p-3">
                <BatteryWarning className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-dash-text">{q.outTitle}</p>
                    <p className="mt-0.5 text-pretty text-[13px] text-dash-text-muted">
                        {usage?.paused ? q.sentencePaused : `${time ? `${ti(q.outBack, { time })} ` : ''}${editor ? q.outBodyEditor : q.outBody}`}
                    </p>
                    {!usage?.paused && (
                        <a href={SSO_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-8 items-center text-[13px] font-medium text-dash-text underline-offset-4 hover:underline">
                            {q.upgrade}
                        </a>
                    )}
                </div>
            </div>
        ),
    }
}
