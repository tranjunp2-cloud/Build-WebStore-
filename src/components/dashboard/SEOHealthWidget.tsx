'use client'

import { useState } from 'react'
import { Sparkles, AlertTriangle } from 'lucide-react'
import { useI18n } from '@/i18n'
import { AIFixModal } from './AIFixModal'
import { useTabContext } from './DashboardTabContent'

export interface SEOIssueCounts {
    missingTitle: number
    missingPageTitle: number
    missingBlogTitle: number
    missingDesc: number
    missingAlt: number
}

import type { MissingSeoItem } from './views/SEOView'

export function SEOHealthWidget({ score, issueCounts, siteId, missingSeoItems }: {
    score: number
    issueCounts?: SEOIssueCounts
    siteId?: string | number | null
    missingSeoItems?: MissingSeoItem[]
}) {
    const { t, ti } = useI18n()
    const { setActiveTab } = useTabContext()
    const warnings = t.dashboard.seo
    const [isFixModalOpen, setIsFixModalOpen] = useState(false)

    // Build i18n issue strings from counts
    const issues: string[] = []
    if (issueCounts) {
        if (issueCounts.missingTitle > 0)
            issues.push(ti(warnings.issueMissingProductTitle, { count: issueCounts.missingTitle }))
        if (issueCounts.missingPageTitle > 0)
            issues.push(ti(warnings.issueMissingPageTitle, { count: issueCounts.missingPageTitle }))
        if (issueCounts.missingBlogTitle > 0)
            issues.push(ti(warnings.issueMissingBlogTitle, { count: issueCounts.missingBlogTitle }))
        if (issueCounts.missingDesc > 0)
            issues.push(ti(warnings.issueMissingDesc, { count: issueCounts.missingDesc }))
        if (issueCounts.missingAlt > 0)
            issues.push(ti(warnings.issueMissingAlt, { count: issueCounts.missingAlt }))
    }

    // If score is low but no meta issues, show score-based warning
    if (issues.length === 0 && score < 90) {
        issues.push(ti(warnings.issueScoreLow || 'SEO score is {score}/100 — check Content & Technical', { score }))
    }

    const handleNavigate = (e: React.MouseEvent | React.KeyboardEvent) => {
        if ((e.target as HTMLElement).closest('button, [role="dialog"]')) return
        setActiveTab('seo')
    }

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={t.dashboard.overview.seo.title || 'SEO Health'}
            onClick={handleNavigate}
            onKeyDown={(e) => {
                if (e.currentTarget !== e.target) return
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleNavigate(e)
                }
            }}
            className="relative flex-1 min-w-0 flex flex-col justify-between rounded-[16px] border border-solid border-white/10 bg-[#1E293B] p-5 shadow-sm transition-colors duration-200 hover:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none cursor-pointer overflow-hidden min-h-[260px]">
            {/* Top Row: Icon and Fix Button */}
            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#3B82F6] to-[#2DD4BF] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-white" strokeWidth={2.5} />
                </div>
                <button
                    onClick={() => setIsFixModalOpen(true)}
                    disabled={!missingSeoItems || missingSeoItems.length === 0}
                    className="flex shrink-0 items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-white text-[12px] font-semibold leading-none bg-gradient-to-br from-[#3B82F6] to-[#2DD4BF] shadow-[0_4px_10px_-2px_rgba(59,130,246,0.4)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                    title={t.dashboard.overview.seo.fixAll || 'Fix All Issues'}
                >
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                    {t.dashboard.overview.seo.fixAll || 'AI Fix All Issues'}
                </button>
            </div>

            {/* Middle Row: Text and Value */}
            <div className="flex flex-col gap-2 mb-4 relative z-10">
                <span className="text-[18px] text-slate-50/60 font-medium">{t.dashboard.overview.seo.title || 'SEO Health'}</span>
                <div className="flex items-center gap-3">
                    <div className="flex items-baseline gap-1">
                        <span className="text-[48px] font-bold text-[#F8FAFC] tracking-tight leading-none">{score}</span>
                        <span className="text-[20px] font-normal text-[#9CA3AF]">/ 100</span>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Score Circle and Status */}
            <div className="mt-auto relative z-10 flex items-center justify-between">
                <div className="flex-1 mr-3 min-w-0">
                    {issues.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-[#FDC700] shrink-0" />
                                <span className="text-[12px] font-medium text-[#FDC700] leading-tight truncate">
                                    {issues.length} {issues.length === 1 ? t.dashboard.overview.seo.issue : t.dashboard.overview.seo.issues}
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-400 truncate w-full block">
                                {issues[0]}
                            </span>
                        </div>
                    ) : (
                        <span className="text-[12px] font-medium text-green-400 leading-tight">
                            {warnings.allGood || 'Looking great'}
                        </span>
                    )}
                </div>
                
                {/* Mini Circle Chart */}
                <div className="relative flex justify-center items-center w-10 h-10 shrink-0">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#374151" strokeWidth="4" />
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#2B7FFF" strokeWidth="4"
                            strokeLinecap="round" strokeDasharray="100" strokeDashoffset={100 - score}
                            className="transition-all duration-1000 ease-out" />
                    </svg>
                </div>
            </div>

            <AIFixModal isOpen={isFixModalOpen} onClose={() => setIsFixModalOpen(false)} siteId={siteId} missingSeoItems={missingSeoItems} />
        </div>
    )
}
