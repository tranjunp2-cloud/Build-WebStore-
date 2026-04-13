'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

export function DashboardTabs() {
    const searchParams = useSearchParams()
    const { t } = useI18n()

    const currentTab = searchParams.get('tab') || 'overview'

    const TABS = [
        { id: 'overview', label: `📊 Overview` },
        { id: 'analytics', label: `📈 Analytics` },
        { id: 'seo', label: `🔍 SEO Health` },
    ]

    return (
        <div className="w-full sm:w-auto">
            <div className="flex w-full sm:inline-flex gap-1 rounded-[8px] bg-[#1F2937] p-1 h-[49px]">
                {TABS.map((tab) => {
                    const isActive = currentTab === tab.id
                    // Preserve existing search params like period
                    const params = new URLSearchParams(searchParams.toString())
                    params.set('tab', tab.id)
                    const href = `/dashboard?${params.toString()}`
                    
                    return (
                        <Link
                            key={tab.id}
                            href={href}
                            className={cn(
                                "flex flex-1 sm:flex-none items-center justify-center sm:justify-start px-[14px] py-[8px] text-[13px] font-semibold rounded-[6px] transition-all h-full whitespace-nowrap",
                                isActive 
                                    ? "bg-[#161E2E] text-[#3B82F6] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.5)] ring-1 ring-white/5" 
                                    : "text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-white/5"
                            )}
                        >
                            <span className="leading-[1.69em]">{tab.label}</span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
