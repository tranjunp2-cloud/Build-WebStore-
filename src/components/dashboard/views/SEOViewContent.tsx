'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Gauge, Map, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import { AutoMetaToggle, AiCrawlersToggle } from './SEOKeywordTracker'
import { GenerateSitemapButton } from './GenerateSitemapButton'
import { AIFixModal } from '@/components/dashboard/AIFixModal'
import { Button } from '@/components/ui/button'
import type { TrackedKeyword } from './SEOKeywordTracker'
import type { MissingSeoItem } from './SEOView'

interface SEOViewContentProps {
    score: number
    metaTagsScore: number
    contentQualityScore: number
    technicalSeoScore: number
    keywords: TrackedKeyword[]
    autoMetaGenerationEnabled: boolean
    aiCrawlersEnabled: boolean
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
    keywords, autoMetaGenerationEnabled, aiCrawlersEnabled, siteId, missingSeoItems = [],
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
                        <Gauge className="w-5 h-5 shrink-0" aria-hidden />
                        {seo.healthOverview || 'SEO Health Overview'}
                    </div>

                    <div className="flex items-center gap-[24px] mb-[24px]">
                        <div className="relative w-[100px] h-[100px] shrink-0">
                            <svg className="w-full h-full rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--dash-border)" strokeWidth="8" opacity="0.6" />
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
                            {/* Shared <Button variant="dashPrimary"> — same blue→teal gradient DS token. */}
                            <Button
                                variant="dashPrimary"
                                size="dash"
                                onClick={() => setIsFixModalOpen(true)}
                                disabled={!siteId || missingSeoItems.length === 0}
                                className="w-fit"
                            >
                                <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
                                {seo.fixAllButton || 'AI Fix All Issues'}
                            </Button>
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
                    <div className="text-[16px] leading-[1.375em] font-bold text-white mb-[20px] flex items-center gap-2">
                        <Map className="w-5 h-5 shrink-0" aria-hidden />
                        {seo.sitemapAndMeta || 'Sitemap & Meta Tags'}
                    </div>

                    {/* Sub-section: Sitemap Configuration */}
                    <div className="pb-[20px]">
                        <div className="text-[12px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-[12px]">
                            {seo.sitemapConfig || 'Sitemap Configuration'}
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-col gap-[4px] min-w-0">
                                {/* TODO: status is currently static/cosmetic — wire real sitemap-freshness data when available */}
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" aria-hidden />
                                    <span className="text-[14px] font-semibold text-white">
                                        {seo.statusLabel || 'Status:'} {seo.statusUpToDate || 'Up-to-date'}
                                    </span>
                                </div>
                                <div className="text-[12px] leading-[1.5] text-[#9CA3AF] pl-[24px]">
                                    {ti(seo.lastUpdated, { date: new Date().toISOString().split('T')[0] })}
                                </div>
                            </div>
                            <div className="shrink-0">
                                {siteId ? <GenerateSitemapButton siteId={siteId} /> : (
                                    <button disabled className="flex items-center justify-center px-[16px] pt-[8.5px] pb-[9px] bg-transparent border border-solid border-[#374151] text-[#6B7280] rounded-[8px] font-semibold text-[13px] leading-[1.21em] opacity-50 cursor-not-allowed">
                                        {seo.generateSitemap || 'Generate Sitemap'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Divider between the two functional areas */}
                    <div className="h-[1px] w-full bg-[#1F2937]" />

                    {/* Sub-section: Automatic Meta Tags */}
                    <div className="pt-[20px]">
                        <div className="text-[12px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-[12px]">
                            {seo.metaTagsSection || 'Automatic Meta Tags'}
                        </div>
                        <AutoMetaToggle defaultChecked={autoMetaGenerationEnabled} siteId={siteId ?? undefined} />
                    </div>

                    {/* Divider between the two functional areas */}
                    <div className="h-[1px] w-full bg-[#1F2937] my-[20px]" />

                    {/* Sub-section: AI Crawler Permissions (US-F37-03) */}
                    <div>
                        <div className="text-[12px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-[12px]">
                            {seo.aiCrawlersSection || 'AI Crawler Permissions'}
                        </div>
                        <AiCrawlersToggle defaultChecked={aiCrawlersEnabled} siteId={siteId ?? undefined} />
                    </div>
                </div>
            </div>

            {/* TODO: Re-enable SEOKeywordTracker when Google Search Console integration is ready */}
            {/* <SEOKeywordTracker initialKeywords={keywords} /> */}

            {/* SEO Issues List — replaces Keyword Tracker temporarily */}
            {missingSeoItems.length > 0 && (
                <div className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-6 shadow-sm">
                    <div className="text-base font-bold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" aria-hidden />
                        {seo.issuesList || 'SEO Issues'}
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
