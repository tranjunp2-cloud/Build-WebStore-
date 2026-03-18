'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n'
import { FileText, ShoppingBag, PenTool } from 'lucide-react'

export type PerformingItem = {
    id: string
    name: string
    url?: string
    value: number
}

type Props = {
    pages: PerformingItem[]
    products: PerformingItem[]
    blogs: PerformingItem[]
}

export function TopPerformingList({ pages, products, blogs }: Props) {
    const { t } = useI18n()
    const [activeTab, setActiveTab] = useState<'pages' | 'products' | 'blogs'>('pages')

    const TABS = [
        { id: 'pages', label: t.dashboard.analytics.topPages, icon: FileText, data: pages },
        { id: 'products', label: t.dashboard.analytics.topProducts, icon: ShoppingBag, data: products },
        { id: 'blogs', label: t.dashboard.analytics.topBlogs, icon: PenTool, data: blogs },
    ] as const

    const activeData = TABS.find(t => t.id === activeTab)?.data || []

    return (
        <div className="flex flex-col h-[400px] rounded-xl border border-white/10 bg-[#1E293B] shadow-sm">
            {/* Tabs */}
            <div className="flex border-b border-white/10 p-2">
                {TABS.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as 'pages' | 'products' | 'blogs')}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            <Icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
                {activeData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500">
                        {t.dashboard.analytics.empty.description}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {activeData.map((item, index) => (
                            <div key={item.id || index} className="flex items-center justify-between rounded-lg p-3 hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F172A] text-xs font-bold text-gray-400">
                                        {index + 1}
                                    </div>
                                    <div className="flex flex-col truncate">
                                        <span className="truncate font-medium text-white">{item.name}</span>
                                        {item.url && <span className="truncate text-xs text-gray-500">{item.url}</span>}
                                    </div>
                                </div>
                                <div className="shrink-0 font-semibold text-white">
                                    {item.value.toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
