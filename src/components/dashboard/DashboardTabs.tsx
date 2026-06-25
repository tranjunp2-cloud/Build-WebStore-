'use client'

import { LayoutDashboard, BarChart3, Search } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useTabContext } from './DashboardTabContent'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function DashboardTabs() {
    const { t } = useI18n()
    const { activeTab, setActiveTab } = useTabContext()

    const TABS = [
        { id: 'overview', Icon: LayoutDashboard, label: t.dashboard.overview.tabs.overview },
        { id: 'analytics', Icon: BarChart3, label: t.dashboard.overview.tabs.analytics },
        { id: 'seo', Icon: Search, label: t.dashboard.overview.tabs.seo },
    ] as const

    // View switcher — shared <Tabs variant="underline"> (same component as Discounts / Products / Team).
    return (
        <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as Parameters<typeof setActiveTab>[0])}
            className="w-full sm:w-auto"
        >
            <TabsList variant="underline" className="sm:w-auto">
                {TABS.map((tab) => (
                    <TabsTrigger
                        key={tab.id}
                        variant="underline"
                        value={tab.id}
                        className="flex-1 sm:flex-none justify-center sm:justify-start"
                    >
                        <tab.Icon className="w-4 h-4 shrink-0" aria-hidden />
                        {tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    )
}
