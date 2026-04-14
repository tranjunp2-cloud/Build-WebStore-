'use client'

import { DashboardTabs } from './DashboardTabs'
import { PeriodSelector } from './PeriodSelector'

export function AnalyticsHeader() {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <DashboardTabs />
            
            <div className="flex items-center flex-wrap gap-3">
                <PeriodSelector />
                <button className="flex items-center px-4 py-[7px] border border-[#1F2937] rounded-lg text-[13px] font-semibold text-white/90 hover:border-blue-500 hover:text-blue-500 transition-colors h-full bg-[#161E2E]">
                    ⚙️ Settings
                </button>
            </div>
        </div>
    )
}
