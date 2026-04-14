'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n'

export type PerformingItem = {
    id: string
    name: string
    url?: string
    value: number
}

type Props = {
    pages: PerformingItem[]
    // TODO: Require products when F10 is ready and uncomment
    products?: PerformingItem[]
    blogs: PerformingItem[]
    referrers?: PerformingItem[]
}

export function TopPerformingList({ pages, products, blogs }: Props) {
    const { t } = useI18n()
    const [activeTab, setActiveTab] = useState<'pages' | 'products' | 'blogs'>('pages')

    const TABS = [
        { id: 'pages' as const, icon: '📄', name: t.dashboard.analytics.topPages, data: pages },
        // TODO: Re-enable unconditionally when F10 is ready
        ...(products ? [{ id: 'products' as const, icon: '📦', name: t.dashboard.analytics.topProducts, data: products }] : []),
        { id: 'blogs' as const, icon: '📝', name: t.dashboard.analytics.topBlogs, data: blogs },
    ]

    const activeData = TABS.find(t => t.id === activeTab)?.data || []
    
    // Calculate total for percentage
    const totalValue = activeData.reduce((acc, curr) => acc + curr.value, 0)

    const getRankClass = (index: number) => {
        switch(index) {
            case 0: return 'bg-amber-500/15 text-amber-500' // r1
            case 1: return 'bg-blue-500/15 text-blue-500' // r2
            case 2: return 'bg-emerald-500/15 text-emerald-500' // r3
            default: return 'bg-[#1F2937] text-slate-400' // r4, r5
        }
    }

    return (
        <div className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-6 shadow-sm">
            {/* Tabs */}
            <div className="flex w-full gap-2 mb-6 sm:mb-4">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as 'pages' | 'products' | 'blogs')}
                            className={`flex flex-col sm:flex-row items-start sm:items-center justify-start sm:justify-center gap-[2px] sm:gap-1.5 p-3 px-3 sm:px-3.5 sm:py-1.5 flex-1 w-full sm:w-auto sm:flex-none rounded-[20px] sm:rounded-full transition-all border border-solid text-left ${
                                isActive 
                                    ? 'bg-[#3B82F6] text-white border-[#3B82F6]' 
                                    : 'bg-transparent text-[#9CA3AF] border-[#1F2937] hover:border-[#3B82F6] hover:text-[#3B82F6]'
                            }`}
                        >
                            <span className="flex items-center gap-1 font-semibold text-[13px] sm:text-xs truncate">
                                <span>{tab.icon}</span>
                                <span>{tab.name}</span>
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* List */}
            <div className="flex flex-col">
                {activeData.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500 italic">
                        {t.dashboard.analytics.noData}
                    </div>
                ) : (
                    activeData.map((item, index) => {
                        const percentage = totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0
                        
                        return (
                            <div 
                                key={item.id || index} 
                                className="flex items-center py-2.5 border-b border-[#1F2937] last:border-0"
                            >
                                <div className={`min-w-[28px] h-[28px] rounded-full flex items-center justify-center text-[12px] font-bold mr-3 ${getRankClass(index)}`}>
                                    {index + 1}
                                </div>
                                <div className="flex-1 text-[13px] font-medium text-white truncate pr-4">
                                    {item.name}
                                </div>
                                <div className="text-[13px] font-semibold text-white mr-2 whitespace-nowrap">
                                    {item.value.toLocaleString()} {t.dashboard.analytics.views.toLowerCase()}
                                </div>
                                <div className="text-[12px] text-[#9CA3AF] w-12 text-right">
                                    ({percentage}%)
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
