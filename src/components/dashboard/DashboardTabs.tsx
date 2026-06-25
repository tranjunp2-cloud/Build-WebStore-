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
            {/* Underline tabs — matches Team & Account / Discounts (view navigation).
                Reuses the global `.dash-tab-trigger` underline (data-state=active). */}
            <div className="flex w-full sm:w-auto gap-0" style={{ borderBottom: '1px solid var(--dash-divider)' }}>
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            data-state={isActive ? 'active' : 'inactive'}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "dash-tab-trigger flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-2 px-4 pb-2.5 rounded-none text-sm font-medium transition-colors -mb-px cursor-pointer whitespace-nowrap",
                                isActive
                                    ? "text-[var(--dash-text)]"
                                    : "text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
                            )}
                        >
                            <tab.Icon className="w-4 h-4 shrink-0" aria-hidden />
                            {tab.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
