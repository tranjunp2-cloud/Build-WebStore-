'use client'

import { BarChart3 } from 'lucide-react'
import { useI18n } from '@/i18n'

export function AnalyticsEmptyState() {
    const { t } = useI18n()
    
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#1E293B] p-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0F172A]">
                <BarChart3 className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">{t.dashboard.analytics.empty.title}</h3>
            <p className="mt-1 text-sm text-gray-400 max-w-sm">
                {t.dashboard.analytics.empty.description}
            </p>
        </div>
    )
}
