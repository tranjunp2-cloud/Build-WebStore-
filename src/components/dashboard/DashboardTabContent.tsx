'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'

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
    const searchParams = useSearchParams()

    const handleSetTab = useCallback((tab: TabId) => {
        setActiveTab(tab)
        // Update URL without triggering server re-render; pushState creates history entry for Back/Forward
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', tab)
        window.history.pushState(null, '', `/dashboard?${params.toString()}`)
    }, [searchParams])

    // Sync activeTab when browser Back/Forward changes the URL
    useEffect(() => {
        const handlePopState = () => {
            const tab = new URLSearchParams(window.location.search).get('tab')
            if (tab && (tab === 'overview' || tab === 'analytics' || tab === 'seo')) {
                setActiveTab(tab)
            }
        }
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [])

    return (
        <TabContext.Provider value={{ activeTab, setActiveTab: handleSetTab }}>
            {children}
        </TabContext.Provider>
    )
}

/** Renders children but hides via CSS when tab is inactive */
export function TabPanel({ tabId, children }: { tabId: TabId; children: ReactNode }) {
    const { activeTab } = useTabContext()
    return <div className={activeTab !== tabId ? 'hidden' : undefined}>{children}</div>
}
