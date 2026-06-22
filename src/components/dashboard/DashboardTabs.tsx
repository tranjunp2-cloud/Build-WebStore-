'use client'

import { LayoutDashboard, BarChart3, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { useTabContext } from './DashboardTabContent'

export function DashboardTabs() {
    const { t } = useI18n()
    const { activeTab, setActiveTab } = useTabContext()

    const TABS = [
        { id: 'overview' as const, Icon: LayoutDashboard, label: t.dashboard.overview.tabs.overview },
        { id: 'analytics' as const, Icon: BarChart3, label: t.dashboard.overview.tabs.analytics },
        { id: 'seo' as const, Icon: Search, label: t.dashboard.overview.tabs.seo },
    ]

    return (
        <div className="w-full sm:w-auto">
            <div className="flex w-full sm:inline-flex gap-1 rounded-[8px] bg-[hsl(var(--secondary))] p-1 h-[49px]">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id

                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex flex-1 sm:flex-none items-center justify-center sm:justify-start px-[14px] py-[8px] text-[13px] font-semibold rounded-[6px] transition-all h-full whitespace-nowrap",
                                isActive
                                    ? "bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.5)] ring-1 ring-white/5"
                                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/5"
                            )}
                        >
                            <span className="flex items-center gap-1.5 leading-[1.69em]">
                                <tab.Icon className="w-4 h-4 shrink-0" aria-hidden />
                                {tab.label}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
