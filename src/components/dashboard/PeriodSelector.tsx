'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export function PeriodSelector() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { t } = useI18n()

    const currentPeriod = searchParams.get('period') || '7d'

    const PERIODS = [
        { id: 'today', label: t.dashboard.overview.periods.today },
        { id: '7d', label: t.dashboard.overview.periods['7d'] },
        { id: '30d', label: t.dashboard.overview.periods['30d'] },
    ]

    const handleSelect = (id: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('period', id)
        router.push(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="flex flex-1 sm:flex-none items-center gap-[2px] rounded-[8px] bg-[hsl(var(--secondary))] p-[3px]">
            {PERIODS.map(p => {
                const isActive = currentPeriod === p.id
                return (
                    <button
                        key={p.id}
                        onClick={() => handleSelect(p.id)}
                        className={cn(
                            "px-[14px] py-[6px] text-[13px] font-semibold rounded-[6px] transition-all leading-none",
                            isActive
                                ? "bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.5)]"
                                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/5"
                        )}
                    >
                        {p.label}
                    </button>
                )
            })}
        </div>
    )
}
