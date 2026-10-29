'use client'

import { PackageCheck } from 'lucide-react'
import { useI18n } from '@/i18n'

/** Why the shop is not finished yet: the generated products have no stock or real photos. */
export function CompletionFinishShopCard() {
    const { t } = useI18n()
    const c = t.onboarding.completion

    return (
        <section
            aria-label={c.finishShopTitle}
            className="flex items-start gap-3 rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-4"
        >
            <PackageCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-sky-300" />
            <div className="min-w-0">
                <p className="text-sm font-semibold text-[#f8fafc]">{c.finishShopTitle}</p>
                <p className="mt-1 text-xs leading-5 text-[#94a3b8]">{c.finishShopDescription}</p>
            </div>
        </section>
    )
}
