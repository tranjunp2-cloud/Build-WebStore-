'use client'

import { useI18n } from '@/i18n'
import { type AiUsage, aiTone, backAt, picturesLeft, planName } from './quota-format'

/** The allowance in the shop's words (chip, popover, chat), from one place so they always agree. */
export function useAiUsageText(usage: AiUsage | null) {
    const { t, ti, locale } = useI18n()
    const q = t.aiQuota
    if (!usage) return null
    const tone = aiTone(usage)
    const back = backAt(usage.ai.nextFreeAt, new Date(), locale)
    const time = back ? (back.laterDay ? ti(q.tomorrowAt, { time: back.time }) : back.time) : null
    const pct = usage.paused ? 0 : usage.ai.leftPercent
    const sentence = usage.paused
        ? q.sentencePaused
        : tone === 'out'
          ? time ? ti(q.sentenceOut, { time }) : q.sentenceOutNoTime
          : tone === 'low' && time
            ? ti(q.sentenceLow, { time })
            : q.sentenceOk
    const left = picturesLeft(usage)
    const pictures = left === null ? q.picturesUnlimited : left === 0 ? q.picturesNone : ti(q.picturesLeft, { n: left, limit: usage.pictures.limit ?? 0 })
    const plan = planName(usage.plan)
    return {
        tone,
        pct,
        time,
        chip: ti(q.chip, { pct }),
        chipAria: ti(q.chipAria, { pct }),
        sentence,
        pictures,
        // same rule as the battery: amber at ≤ 20 % of the plan's pictures left, red at none
        picturesTone: left === 0 ? ('out' as const) : left !== null && usage.pictures.limit && left / usage.pictures.limit <= 0.2 ? ('low' as const) : ('ok' as const),
        plan: plan ? ti(q.plan, { plan: q.planNames[plan] }) : null,
        q,
        ti,
    }
}
