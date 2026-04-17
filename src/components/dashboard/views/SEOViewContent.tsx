'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { AutoMetaToggle } from './SEOKeywordTracker'
import { GenerateSitemapButton } from './GenerateSitemapButton'
import { AIFixModal } from '@/components/dashboard/AIFixModal'
import type { TrackedKeyword } from './SEOKeywordTracker'
import type { MissingSeoItem } from './SEOView'

interface SEOViewContentProps {
    score: number
    metaTagsScore: number
    contentQualityScore: number
    technicalSeoScore: number
    keywords: TrackedKeyword[]
    autoMetaGenerationEnabled: boolean
    siteId: string | number | null
    missingSeoItems?: MissingSeoItem[]
}

function ScoreBar({ label, score }: { label: string; score: number }) {
    const color = score > 70 ? 'text-emerald-500' : score > 40 ? 'text-amber-500' : 'text-red-500'
    const bgColor = score > 70 ? 'bg-emerald-500' : score > 40 ? 'bg-amber-500' : 'bg-red-500'
    return (
        <div>
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm font-medium text-white">{label}</span>
                <span className={`text-sm font-bold ${color}`}>{score}/100</span>
            </div>
            <div className="h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${bgColor}`} style={{ width: score + '%' }} />
            </div>
        </div>
    )
}

export function SEOViewContent({
    score, metaTagsScore, contentQualityScore, technicalSeoScore,
    keywords, autoMetaGenerationEnabled, siteId, missingSeoItems = [],
}: SEOViewContentProps) {
    const { t, ti } = useI18n()
    const router = useRouter()
    const seo = t.dashboard.seo
    const aifix = seo.aifix
    const [isFixModalOpen, setIsFixModalOpen] = useState(false)

    // Global Ctrl+Z undo — works even when modal is closed (sessionStorage persists)
    const handleUndo = useCallback(async () => {
        const raw = sessionStorage.getItem('seo-fix-undo-backup')
        if (!raw) return
        try {
            const { data, timestamp } = JSON.parse(raw)
            if (Date.now() - timestamp > 5 * 60 * 1000) { sessionStorage.removeItem('seo-fix-undo-backup'); return }
            const res = await fetch('/api/seo/apply-fixes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fixes: data }),
            })
            if (res.ok) {
                sessionStorage.removeItem('seo-fix-undo-backup')
                toast.success(aifix.undoSuccess || 'Batch Fix has been undone')
                router.refresh()
            }
        } catch { /* ignore */ }
    }, [aifix, router])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                const hasUndo = sessionStorage.getItem('seo-fix-undo-backup')
                if (hasUndo) { e.preventDefault(); handleUndo() }
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [handleUndo])

    return (
        <div className="w-full animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* SEO Health Overview */}
                <div className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-6 shadow-sm">
                    <div className="text-base font-bold text-white mb-6 flex items-center gap-2">
                        📋 {seo.healthOverview || 'SEO Health Overview'}
                    </div>

                    <div className="flex items-center gap-[24px] mb-[24px]">
                        <div className="relative w-[100px] h-[100px] shrink-0">
                            <svg className="w-full h-full rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" fill="none" stroke="#374151" strokeWidth="8" opacity="0.6" />
                                <circle
                                    cx="50" cy="50" r="42" fill="none" stroke="#2B7FFF" strokeWidth="8"
                                    strokeLinecap="round" strokeDasharray="263.89"
                                    strokeDashoffset={263.89 - ((263.89 * score) / 100)}
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-[30px] font-bold text-white leading-none">{score}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-[8px]">
                            <div className="text-[16px] leading-[1.375em] font-bold text-white w-full">
                                {ti(seo.scoreLabel || 'Score: {score}/100', { score })}
                            </div>
                            <button
                                onClick={() => setIsFixModalOpen(true)}
                                disabled={!siteId || missingSeoItems.length === 0}
                                className="flex items-center justify-center gap-2 px-[16px] pt-[8.5px] pb-[9px] bg-[linear-gradient(167deg,#3B82F6_0%,#2DD4BF_100%)] text-white rounded-[8px] font-semibold text-[13px] leading-[1.21em] hover:opacity-90 transition-opacity whitespace-nowrap w-fit disabled:opacity-50"
                            >
                                {seo.fixAllButton || '✨ AI Fix All Issues'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <ScoreBar label={seo.breakdown?.meta || 'Meta Tags'} score={metaTagsScore} />
                        <ScoreBar label={seo.contentQuality || 'Content Quality'} score={contentQualityScore} />
                        <ScoreBar label={seo.technicalSeo || 'Technical SEO'} score={technicalSeoScore} />
                    </div>
                </div>

                {/* Sitemap & Meta Tags */}
                <div className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-[25px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.5)]">
                    <div className="text-[16px] leading-[1.375em] font-bold text-white mb-[16px]">
                        🗺️ {seo.sitemapAndMeta || 'Sitemap & Meta Tags'}
                    </div>

                    <div className="mb-[16px]">
                        {siteId ? <GenerateSitemapButton siteId={siteId} /> : (
                            <button disabled className="flex items-center justify-center px-[16px] pt-[8.5px] pb-[9px] bg-transparent border border-solid border-[#374151] text-[#6B7280] rounded-[8px] font-semibold text-[13px] leading-[1.21em] opacity-50 cursor-not-allowed">
                                🗺️ {seo.generateSitemap || 'Generate Sitemap'}
                            </button>
                        )}
                    </div>

                    <div className="text-[13px] leading-[1.69em] text-[#9CA3AF] mb-[8px]">
                        {ti(seo.lastUpdated, { date: new Date().toISOString().split('T')[0] })}
                    </div>

                    <AutoMetaToggle defaultChecked={autoMetaGenerationEnabled} siteId={siteId ?? undefined} />
                </div>
            </div>

            {/* TODO: Re-enable SEOKeywordTracker when Google Search Console integration is ready */}
            {/* <SEOKeywordTracker initialKeywords={keywords} /> */}

            {/* SEO Issues List — replaces Keyword Tracker temporarily */}
            {missingSeoItems.length > 0 && (
                <div className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-6 shadow-sm">
                    <div className="text-base font-bold text-white mb-4 flex items-center gap-2">
                        ⚠️ {seo.issuesList || 'SEO Issues'}
                    </div>
                    <div className="flex flex-col">
                        {missingSeoItems.slice(0, 10).map((item, idx) => (
                            <div key={`${item.collection}-${item.id}`} className="flex items-center gap-3 py-2.5 px-3.5 border-b border-[#1F2937] last:border-0">
                                <div className={`min-w-[28px] h-[28px] rounded-full flex items-center justify-center text-[12px] font-bold ${idx < 3 ? 'bg-amber-500/15 text-amber-500' : 'bg-[#1F2937] text-slate-400'}`}>
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-medium text-white truncate">{item.title}</div>
                                    <div className="text-[11px] text-[#9CA3AF] truncate">
                                        {item.missingFields.map(f => {
                                            if (f === 'title') return seo.missingTitle
                                            return seo.missingDesc
                                        }).join(', ')}
                                    </div>
                                </div>
                                <span className="text-[11px] text-[#6B7280] shrink-0 uppercase">{item.collection}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <AIFixModal
                isOpen={isFixModalOpen}
                onClose={() => setIsFixModalOpen(false)}
                siteId={siteId}
                missingSeoItems={missingSeoItems}
            />
        </div>
    )
}
