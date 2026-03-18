'use client'

import { useI18n } from '@/i18n'
import { PeriodSelector } from './PeriodSelector'

export function AnalyticsHeader() {
    const { t } = useI18n()
    
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className="text-2xl font-bold text-white">{t.dashboard.analytics.title}</h1>
                <p className="mt-1 text-sm text-gray-400">{t.dashboard.analytics.subtitle}</p>
            </div>
            <PeriodSelector />
        </div>
    )
}
