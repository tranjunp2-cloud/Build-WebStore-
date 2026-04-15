'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export type TabId = 'overview' | 'analytics' | 'seo'

const TabContext = createContext<{ activeTab: TabId; setActiveTab: (tab: TabId) => void }>({
    activeTab: 'overview',
    setActiveTab: () => {},
})

export function useTabContext() {
    return useContext(TabContext)
}

export function DashboardTabContent({ defaultTab, children }: { defaultTab: string; children: ReactNode }) {
    const [activeTab, setActiveTab] = useState<TabId>((defaultTab || 'overview') as TabId)
    const router = useRouter()
    const searchParams = useSearchParams()

    const handleSetTab = useCallback((tab: TabId) => {
        setActiveTab(tab) // Instant UI update for active indicator
        // Trigger server re-render so only the new tab's queries execute
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', tab)
        router.push(`/dashboard?${params.toString()}`)
    }, [router, searchParams])

    return (
        <TabContext.Provider value={{ activeTab, setActiveTab: handleSetTab }}>
            {children}
        </TabContext.Provider>
    )
}
