'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { useI18n } from '@/i18n'

export function PeriodSelector() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { t } = useI18n()

    const currentPeriod = searchParams.get('period') || '30d'

    const PERIODS = [
        { id: 'today', label: t.dashboard.overview.periods.today },
        { id: '7d', label: t.dashboard.overview.periods['7d'] },
        { id: '30d', label: t.dashboard.overview.periods['30d'] },
    ]

    const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('period', e.target.value)
        router.push(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5">
            <Calendar className="h-4 w-4 text-gray-400" />
            <select
                value={currentPeriod}
                onChange={handleSelect}
                className="bg-transparent text-sm font-medium text-white outline-none focus:ring-0 [&>option]:bg-[#1E293B] [&>option]:text-white"
            >
                {PERIODS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                ))}
            </select>
        </div>
    )
}
