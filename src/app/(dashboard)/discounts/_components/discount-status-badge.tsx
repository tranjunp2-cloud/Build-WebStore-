'use client'

import { useI18n } from '@/i18n'
import { computeEffectiveDiscountStatus } from '@/lib/discounts/effective-status'

interface DiscountStatusBadgeProps {
    status: string
    startsAt?: string | Date | null
    expiresAt?: string | Date | null
    usageLimit?: number | null
    usageCount?: number | null
}

/**
 * Renders only two states — Active / Inactive (F33 design).
 * Inactive when the discount is no longer usable AND can't recover on its own:
 * raw status inactive, EXPIRED, or USED UP. A scheduled (future start) discount is
 * still shown Active — it's intentionally enabled to go live later. Cron only flips
 * EXPIRED in DB (monotonic); used-up is display-only and auto-recovers on slot release
 * (Option B, GH-1282 / BR-10).
 */
export function DiscountStatusBadge({ status, startsAt, expiresAt, usageLimit, usageCount }: DiscountStatusBadgeProps) {
    const { t } = useI18n()
    const b = t.dashboard.discounts.badges

    const eff = computeEffectiveDiscountStatus({ status, startsAt, expiresAt, usageLimit, usageCount })
    const isActive = eff === 'active' || eff === 'scheduled'

    return (
        // F33 design: full pill with a tinted background (emerald = active, slate =
        // inactive) + leading dot + 11px label.
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-semibold ${
                isActive
                    ? 'bg-success/[0.12] text-success dark:text-success'
                    : 'bg-slate-400/[0.14] text-slate-600 dark:text-slate-400'
            }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    isActive ? 'bg-success dark:bg-success' : 'bg-slate-500 dark:bg-slate-400'
                }`}
            />
            {isActive ? b.active : b.inactive}
        </span>
    )
}
