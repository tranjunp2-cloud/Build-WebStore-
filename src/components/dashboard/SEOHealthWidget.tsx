'use client'

import { useState } from 'react'
import { Sparkles, AlertTriangle } from 'lucide-react'
import { useI18n } from '@/i18n'
import { AIFixModal } from './AIFixModal'

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

    return (
        <div className="rounded-[16px] border border-white/10 bg-[#1E293B] flex flex-col p-6 gap-8 h-full min-h-[400px]">
            <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-semibold text-[#F8FAFC] tracking-tight leading-[1.55]">
                    {t.dashboard.overview.seo.title || 'SEO Health'}
                </h2>
            </div>

            <div className="flex-1 flex flex-col items-center">
                <div className="relative flex justify-center items-center w-[153px] h-[153px]">
                    <svg className="w-full h-full rotate-90" viewBox="0 0 153 153">
                        <circle cx="76.5" cy="76.5" r="66" fill="none" stroke="#374151" strokeWidth="12" />
                        <circle cx="76.5" cy="76.5" r="66" fill="none" stroke="#2B7FFF" strokeWidth="12"
                            strokeLinecap="round" strokeDasharray="414.69" strokeDashoffset={414.69 - ((414.69 * score) / 100)}
                            className="transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center pt-2">
                        <span className="text-[30px] font-bold text-white leading-[1.2]">{score}</span>
                        <span className="text-[12px] font-normal text-[#9CA3AF] leading-[1.33]">/100</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-3 w-full mt-auto">
                {issues.length > 0 ? (
                    issues.slice(0, 2).map((issue, index) => (
                        <div key={index} className="flex items-center gap-2 bg-[#F0B100]/10 border border-[#F0B100]/20 rounded-[12px] h-11 px-3.5">
                            <AlertTriangle className="w-4 h-4 text-[#FDC700] shrink-0" strokeWidth={2} />
                            <span className="text-[12px] font-normal text-[#FDC700] leading-[1.33] truncate">
                                [{warnings.warningLabel || 'Warning'}] {issue}
                            </span>
                        </div>
                    ))
                ) : (
                    <div className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 rounded-[12px] h-11 px-3.5">
                        <span className="text-[12px] font-medium text-green-400 leading-[1.33] truncate">
                            {warnings.allGood || 'All good! No critical SEO issues.'}
                        </span>
                    </div>
                )}
            </div>

            <div className="mt-0">
                <button
                    onClick={() => setIsFixModalOpen(true)}
                    disabled={!missingSeoItems || missingSeoItems.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-[12px] h-[46px] text-white text-[16px] font-semibold leading-[1.5] bg-gradient-to-br from-[#3B82F6] to-[#2DD4BF] shadow-[0_10px_15px_-3px_rgba(59,130,246,0.3),_0_4px_6px_-4px_rgba(59,130,246,0.3)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                    <Sparkles className="h-5 w-5" />
                    {t.dashboard.overview.seo.fixAll || '✨ AI Fix All Issues'}
                </button>
            </div>

            <AIFixModal isOpen={isFixModalOpen} onClose={() => setIsFixModalOpen(false)} siteId={siteId} missingSeoItems={missingSeoItems} />
        </div>
    )
}
