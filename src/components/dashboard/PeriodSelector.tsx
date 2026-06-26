'use client'

import { useEffect, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useI18n } from '@/i18n'

export function PeriodSelector() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { t } = useI18n()
    const [isPending, startTransition] = useTransition()

    const currentPeriod = searchParams.get('period') || '7d'

    const PERIODS = [
        { id: 'today', label: t.dashboard.overview.periods.today },
        { id: '7d', label: t.dashboard.overview.periods['7d'] },
        { id: '30d', label: t.dashboard.overview.periods['30d'] },
    ]

    // While the new period data loads, dim the stream in place (preserves scroll + block heights).
    // Flag lives on <html> so the scoped CSS can fade the whole .dash-revamp stream.
    useEffect(() => {
        const el = document.documentElement
        if (isPending) el.setAttribute('data-period-pending', '1')
        else el.removeAttribute('data-period-pending')
        return () => el.removeAttribute('data-period-pending')
    }, [isPending])

    const handleSelect = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
        // Buttons (not <a href="#">) — guard against any default and stop a scroll-to-top
        e.preventDefault()
        if (id === currentPeriod) return
        const params = new URLSearchParams(searchParams.toString())
        params.set('period', id)
        // scroll:false keeps the viewport where it is; useTransition keeps the old content
        // mounted (no unmount / height collapse) until the refetched data is ready.
        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        })
    }

    // Markup matches the revamp design's `.segmented` pill (styled by dashboard-revamp.css,
    // scoped under .dash-revamp in the dashboard toolbar).
    return (
        <div className="segmented" data-pending={isPending ? '1' : undefined}>
            {PERIODS.map(p => (
                <button
                    key={p.id}
                    type="button"
                    className={currentPeriod === p.id ? 'active' : ''}
                    onClick={(e) => handleSelect(e, p.id)}
                >
                    {p.label}
                </button>
            ))}
        </div>
    )
}
