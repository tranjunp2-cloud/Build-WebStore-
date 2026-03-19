'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import {
    Search, AlertTriangle, CheckCircle, Info, Sparkles, Loader2, RefreshCcw,
    FileText, BookOpen, Code, Map
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

type SEOIssue = {
    type: 'error' | 'warning' | 'info'
    field: string
    message: string
    autoFixable: boolean
}

type PageAnalysis = {
    pageId: string | number
    title: string
    slug: string
    score: number
    issues: SEOIssue[]
}

type SEOData = {
    siteId: string
    siteName: string
    score: number
    totalIssues: number
    fixableIssues: number
    pages: PageAnalysis[]
}

type ProposedFix = {
    id: string
    targetId: string
    collection: 'pages' | 'products'
    name: string
    proposedTitle?: string
    proposedDescription?: string
}

type BatchFix = {
    targetId: string
    collection: 'pages' | 'products'
    seo: { title?: string; description?: string }
}

function ScoreGauge({ score, t }: { score: number; t: any }) {
    const color = score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'
    const bgColor = score >= 80 ? 'from-green-500/20' : score >= 50 ? 'from-yellow-500/20' : 'from-red-500/20'
    const label = score >= 80 ? t.score.good : score >= 50 ? t.score.needsWork : t.score.poor

    return (
        <div className={cn('relative flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br to-transparent p-8', bgColor)}>
            <div className="relative h-32 w-32">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-white/10" strokeWidth="8" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className={color}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${score * 2.51} 251`}
                        style={{ transition: 'stroke-dasharray 1s ease-out' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn('text-4xl font-bold', color)}>{score}</span>
                    <span className="text-xs text-gray-500">/100</span>
                </div>
            </div>
            <p className={cn('mt-3 text-sm font-medium', color)}>{label}</p>
        </div>
    )
}

function IssueIcon({ type }: { type: string }) {
    if (type === 'error') return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
    if (type === 'warning') return <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
    return <Info className="h-3.5 w-3.5 text-blue-400" />
}

function CategoryBreakdown({ pages, t }: { pages: PageAnalysis[]; t: any }) {
    const allIssues = pages.flatMap(p => p.issues)

    const metaIssues = allIssues.filter(i => i.field === 'metaTitle' || i.field === 'metaDescription')
    const contentIssues = allIssues.filter(i => i.field === 'content')
    const technicalIssues = allIssues.filter(i => i.field === 'images' || i.field === 'schema' || i.field === 'speed')

    const categories = [
        { icon: FileText, label: t.breakdown.meta, issues: metaIssues, color: 'text-orange-400', bg: 'bg-orange-500/10' },
        { icon: BookOpen, label: t.breakdown.content, issues: contentIssues, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { icon: Code, label: t.breakdown.technical, issues: technicalIssues, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    ]

    return (
        <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6">
            <h2 className="mb-4 text-base font-semibold text-white">{t.breakdown.title}</h2>
            <div className="grid grid-cols-3 gap-4">
                {categories.map(({ icon: Icon, label, issues, color, bg }) => (
                    <div key={label} className={cn('rounded-xl p-4', bg)}>
                        <div className="flex items-center gap-2 mb-2">
                            <Icon className={cn('h-4 w-4', color)} />
                            <span className="text-xs font-medium text-gray-300">{label}</span>
                        </div>
                        {issues.length === 0 ? (
                            <div className="flex items-center gap-1 text-xs text-green-400 mt-2">
                                <CheckCircle className="h-3 w-3" />
                                <span>{t.breakdown.noIssues}</span>
                            </div>
                        ) : (
                            <div className="mt-2">
                                <p className={cn('text-2xl font-bold', color)}>{issues.length}</p>
                                <p className="text-xs text-gray-500">
                                    {issues.length === 1 ? t.pages.issue : t.pages.issues}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

function SEODashboardInner() {
    const { t } = useI18n()
    const st = t.dashboard.seo

    const [seoData, setSeoData] = useState<SEOData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isFixing, setIsFixing] = useState(false)
    const [isGeneratingSitemap, setIsGeneratingSitemap] = useState(false)
    const [fixResult, setFixResult] = useState<string | null>(null)
    const [hasError, setHasError] = useState(false)
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
    const [sites, setSites] = useState<Array<{ id: string; name: string }>>([])
    
    // AI Fix All States
    const [isFixAllModalOpen, setIsFixAllModalOpen] = useState(false)
    const [proposedFixes, setProposedFixes] = useState<ProposedFix[]>([])
    const [approvedFixIds, setApprovedFixIds] = useState<Set<string>>(new Set())
    const [appliedBackup, setAppliedBackup] = useState<BatchFix[]>([])
    const [isApplyingFixes, setIsApplyingFixes] = useState(false)

    const trackEvent = useCallback(async (eventName: string, metadata?: any) => {
        if (!selectedSiteId) return
        try {
            await fetch('/api/analytics/track', {
                method: 'POST',
                body: JSON.stringify({
                    siteId: selectedSiteId,
                    event: eventName,
                    pageUrl: window.location.pathname,
                    metadata
                })
            })
        } catch {}
    }, [selectedSiteId])

    // Load user's sites
    useEffect(() => {
        async function loadSites() {
            try {
                const res = await fetch('/api/sites', { credentials: 'include' })
                if (res.ok) {
                    const data = await res.json()
                    const siteList = (data.docs || []).map((s: { id: string | number; name: string }) => ({ id: String(s.id), name: s.name }))
                    setSites(siteList)
                    if (siteList.length > 0) {
                        setSelectedSiteId(siteList[0].id)
                    } else {
                        setIsLoading(false)
                    }
                }
            } catch {
                toast.error(st.error.failed)
                setIsLoading(false)
            }
        }
        loadSites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Analyse selected site
    useEffect(() => {
        if (!selectedSiteId) return
        analyseSite(selectedSiteId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSiteId])

    const analyseSite = async (siteId: string) => {
        setIsLoading(true)
        setFixResult(null)
        setHasError(false)
        try {
            const res = await fetch('/api/seo/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId }),
                credentials: 'include',
            })
            if (res.ok) {
                const data = await res.json()
                if (data.success) setSeoData(data.data)
                else throw new Error(data.error?.message || 'Unknown error')
            } else {
                throw new Error('API returned an error')
            }
        } catch {
            setHasError(true)
            toast.error(st.error.failed, {
                action: { label: st.error.retry, onClick: () => analyseSite(siteId) },
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleFixAll = async () => {
        if (!selectedSiteId || isFixing || !seoData) return
        setIsFixing(true)
        setFixResult(null)
        trackEvent('ai_fix_all_seo_started')

        try {
            // Collect fixable items
            const missingSeo = seoData.pages.filter(p => p.issues.some(i => i.autoFixable)).map(p => {
                const autoFixableIssues = p.issues.filter(i => i.autoFixable).map(i => i.field)
                return {
                    collection: 'pages' as const,
                    id: p.pageId,
                    title: p.title,
                    missingFields: autoFixableIssues
                }
            })

            if (missingSeo.length === 0) {
                toast.info("No auto-fixable issues found.")
                setIsFixing(false)
                return
            }

            const res = await fetch('/api/seo/fix-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId: selectedSiteId, missingSeo }),
                credentials: 'include',
            })
            
            if (res.ok) {
                const data = await res.json()
                if (data.success) {
                    setProposedFixes(data.data)
                    setApprovedFixIds(new Set(data.data.map((f: ProposedFix) => f.id)))
                    setIsFixAllModalOpen(true)
                } else {
                    throw new Error(data.error?.message || 'Failed')
                }
            } else if (res.status === 504) {
                toast.error('Không thể hoàn tất AI Fix All (Timeout), vui lòng thử lại')
                setFixResult('Timeout. Vui lòng thử lại.')
            } else {
                throw new Error('API returned an error')
            }
        } catch {
            setFixResult('Fix failed — please try again')
            toast.error('Không thể hoàn tất AI Fix All, vui lòng thử lại')
        } finally {
            setIsFixing(false)
        }
    }

    const handleApplyFixes = async () => {
        if (!selectedSiteId || isApplyingFixes) return
        setIsApplyingFixes(true)
        try {
            const approvedPrs = proposedFixes.filter(f => approvedFixIds.has(f.id))
            const fixes: BatchFix[] = approvedPrs.map(f => ({
                targetId: f.targetId,
                collection: f.collection,
                seo: { title: f.proposedTitle, description: f.proposedDescription }
            }))

            const res = await fetch('/api/seo/apply-fixes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fixes }),
                credentials: 'include',
            })

            if (res.ok) {
                const data = await res.json()
                const undoData = data.undoData || []
                setAppliedBackup(undoData)
                setIsFixAllModalOpen(false)
                toast.success(`Đã apply ${fixes.length} fixes thành công`, {
                    action: {
                        label: 'Undo (Ctrl+Z)',
                        onClick: () => handleUndoFixes(undoData)
                    },
                    duration: 8000
                })
                setFixResult(`Fixed ${fixes.length} issues`)
                trackEvent('ai_fix_all_seo_completed', { issues_fixed_count: fixes.length })
                setTimeout(() => analyseSite(selectedSiteId), 500)
            } else {
               toast.error('Apply Failed')
            }
        } catch (error) {
           toast.error('Apply Failed')
        } finally {
            setIsApplyingFixes(false)
        }
    }

    const handleUndoFixes = useCallback(async (revertFixes: BatchFix[]) => {
        try {
            const res = await fetch('/api/seo/apply-fixes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fixes: revertFixes }),
                credentials: 'include',
            })

            if (res.ok) {
                toast.success('Đã Undo Batch Fix')
                setAppliedBackup([]) // Clear state to avoid multiple undos
                if (selectedSiteId) analyseSite(selectedSiteId)
            }
        } catch {
            toast.error('Undo Failed')
        }
    }, [selectedSiteId])

    // AC-1/FR-12: Keyboard shortcut for Undo Batch Fix
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (appliedBackup.length > 0) {
                    e.preventDefault()
                    handleUndoFixes(appliedBackup)
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [appliedBackup, handleUndoFixes])

    const handleGenerateSitemap = async () => {
        if (!selectedSiteId || isGeneratingSitemap) return
        setIsGeneratingSitemap(true)
        try {
            const res = await fetch('/api/seo/sitemap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId: selectedSiteId }),
                credentials: 'include',
            })
            if (res.ok) {
                const data = await res.json()
                if (data.success) {
                    toast.success(`${st.sitemapSuccess} — ${data.data.pageCount} pages`)
                } else {
                    toast.error(st.sitemapError)
                }
            } else {
                toast.error(st.sitemapError)
            }
        } catch {
            toast.error(st.sitemapError)
        } finally {
            setIsGeneratingSitemap(false)
        }
    }

    // AC-3: Error state — shows instead of score when API fails
    if (!isLoading && hasError) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
                    <h2 className="mt-4 text-lg font-semibold text-white">{st.error.failed}</h2>
                    <p className="mt-1 text-sm text-gray-500">The SEO scan could not be completed. Please try again.</p>
                    <button
                        onClick={() => selectedSiteId && analyseSite(selectedSiteId)}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        {st.error.retry}
                    </button>
                </div>
            </div>
        )
    }

    // Empty state
    if (!isLoading && sites.length === 0) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center">
                    <Search className="mx-auto h-12 w-12 text-gray-600" />
                    <h2 className="mt-4 text-lg font-semibold text-white">{st.empty.title}</h2>
                    <p className="mt-1 text-sm text-gray-500">{st.empty.description}</p>
                    <a href="/dashboard"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
                        {st.empty.cta}
                    </a>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{st.title}</h1>
                    <p className="mt-1 text-sm text-gray-400">{st.subtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Site selector */}
                    {sites.length > 1 && (
                        <select value={selectedSiteId || ''} onChange={e => setSelectedSiteId(e.target.value)}
                            aria-label="Select site"
                            className="rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none">
                            {sites.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}
                    {/* AC-2: Generate Sitemap */}
                    <button
                        onClick={handleGenerateSitemap}
                        disabled={isGeneratingSitemap || isLoading}
                        className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        {isGeneratingSitemap
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Map className="h-4 w-4" />
                        }
                        {st.generateSitemap}
                    </button>
                    <button onClick={() => selectedSiteId && analyseSite(selectedSiteId)}
                        disabled={isLoading}
                        className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50">
                        <RefreshCcw className={cn('h-4 w-4', isLoading && 'animate-spin')} /> {st.reAnalyse}
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="animate-pulse space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="rounded-2xl bg-[#1E293B]/50 p-8 flex flex-col items-center">
                            <div className="h-32 w-32 rounded-full bg-white/5" />
                            <div className="mt-3 h-4 w-16 rounded bg-white/5" />
                        </div>
                        <div className="rounded-2xl bg-[#1E293B]/50 p-6 space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i}>
                                    <div className="h-8 w-12 rounded bg-white/5" />
                                    <div className="mt-1 h-3 w-20 rounded bg-white/5" />
                                </div>
                            ))}
                        </div>
                        <div className="rounded-2xl border border-dashed border-white/10 p-6 flex flex-col items-center justify-center">
                            <div className="h-8 w-8 rounded bg-white/5" />
                            <div className="mt-3 h-4 w-20 rounded bg-white/5" />
                            <div className="mt-4 h-10 w-36 rounded-lg bg-white/5" />
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6">
                        <div className="h-5 w-40 rounded bg-white/5 mb-4" />
                        <div className="grid grid-cols-3 gap-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-20 rounded-xl bg-white/5" />
                            ))}
                        </div>
                    </div>
                </div>
            ) : seoData ? (
                <>
                    {/* Score Overview */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <ScoreGauge score={seoData.score} t={st} />

                        {/* Stats */}
                        <div className="flex flex-col justify-center space-y-4 rounded-2xl bg-[#1E293B]/50 p-6">
                            <div>
                                <p className="text-3xl font-bold text-white">{seoData.totalIssues}</p>
                                <p className="text-sm text-gray-400">{st.stats.totalIssues}</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-purple-400">{seoData.fixableIssues}</p>
                                <p className="text-sm text-gray-400">{st.stats.fixable}</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-cyan-400">{seoData.pages.length}</p>
                                <p className="text-sm text-gray-400">{st.stats.pages}</p>
                            </div>
                        </div>

                        {/* Fix All */}
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-purple-500/30 bg-purple-500/5 p-6">
                            <Sparkles className="h-8 w-8 text-purple-400" />
                            <h3 className="mt-3 text-sm font-semibold text-white">{st.aifix.title}</h3>
                            <p className="mt-1 text-center text-xs text-gray-500">
                                {st.aifix.description}
                            </p>
                            <button onClick={handleFixAll} disabled={isFixing || seoData.fixableIssues === 0}
                                className="mt-4 flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-500 transition-colors disabled:opacity-50 shadow-lg shadow-purple-500/25">
                                {isFixing ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> {st.aifix.fixing}</>
                                ) : (
                                    <><Sparkles className="h-4 w-4" /> {st.aifix.button}</>
                                )}
                            </button>
                            {fixResult && (
                                <div className="mt-3 flex items-center gap-1.5 text-xs">
                                    {fixResult.startsWith('Fix failed') ? (
                                        <><AlertTriangle className="h-3 w-3 text-red-400" /><span className="text-red-400">{fixResult}</span></>
                                    ) : (
                                        <><CheckCircle className="h-3 w-3 text-green-400" /><span className="text-green-400">{fixResult}</span></>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AC-1: Category Breakdown */}
                    <CategoryBreakdown pages={seoData.pages} t={st} />

                    {/* Per-Page Breakdown */}
                    <div className="rounded-xl border border-white/10 bg-[#1E293B]/30">
                        <div className="border-b border-white/10 px-6 py-4">
                            <h2 className="text-lg font-semibold text-white">{st.pages.title}</h2>
                        </div>
                        <div className="divide-y divide-white/5">
                            {seoData.pages.map(page => (
                                <div key={page.pageId} className="px-6 py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold',
                                                page.score >= 80 ? 'bg-green-500/15 text-green-400' :
                                                    page.score >= 50 ? 'bg-yellow-500/15 text-yellow-400' :
                                                        'bg-red-500/15 text-red-400'
                                            )}>
                                                {page.score}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white">{page.title}</p>
                                                <p className="text-xs text-gray-500">{page.slug}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {page.issues.length === 0 ? (
                                                <span className="flex items-center gap-1 text-xs text-green-400">
                                                    <CheckCircle className="h-3.5 w-3.5" /> {st.pages.allGood}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-500">
                                                    {page.issues.length} {page.issues.length !== 1 ? st.pages.issues : st.pages.issue}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {page.issues.length > 0 && (
                                        <div className="mt-3 space-y-1.5 pl-11">
                                            {page.issues.map((issue, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs">
                                                    <IssueIcon type={issue.type} />
                                                    <span className={cn(
                                                        issue.type === 'error' ? 'text-red-300' :
                                                            issue.type === 'warning' ? 'text-yellow-300' : 'text-blue-300'
                                                    )}>
                                                        {issue.message}
                                                    </span>
                                                    {issue.autoFixable && (
                                                        <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-400">
                                                            AI fixable
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : null}

            {/* AI Review Modal */}
            {isFixAllModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-[#1E293B] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between border-b border-white/10 p-5 bg-[#1E293B]/80 backdrop-blur">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-400" /> Review AI Fixes
                            </h2>
                            <button onClick={() => setIsFixAllModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-4 flex-1">
                            {proposedFixes.map((fix) => (
                                <div key={fix.id} className="rounded-lg border border-white/5 bg-white/5 p-4 relative">
                                    <div className="absolute right-4 top-4">
                                        <input
                                            type="checkbox"
                                            checked={approvedFixIds.has(fix.id)}
                                            onChange={(e) => {
                                                const next = new Set(approvedFixIds)
                                                if (e.target.checked) next.add(fix.id)
                                                else next.delete(fix.id)
                                                setApprovedFixIds(next)
                                            }}
                                            className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-800"
                                        />
                                    </div>
                                    <h3 className="font-medium text-white mb-3 pr-8">{fix.name} <span className="text-xs text-gray-500 uppercase">({fix.collection})</span></h3>
                                    
                                    <div className="space-y-3">
                                        {fix.proposedTitle && (
                                            <div className="text-sm">
                                                <div className="text-xs text-green-400 mb-1">New Title:</div>
                                                <div className="text-gray-200 border-l-2 border-green-500/50 pl-2 py-1 bg-green-500/5 rounded-r">{fix.proposedTitle}</div>
                                            </div>
                                        )}
                                        {fix.proposedDescription && (
                                            <div className="text-sm">
                                                <div className="text-xs text-green-400 mb-1">New Description:</div>
                                                <div className="text-gray-200 border-l-2 border-green-500/50 pl-2 py-1 bg-green-500/5 rounded-r">{fix.proposedDescription}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between border-t border-white/10 p-5 bg-[#1E293B]">
                            <p className="text-sm text-gray-400">{approvedFixIds.size} of {proposedFixes.length} selected</p>
                            <div className="flex gap-3">
                                <button onClick={() => setIsFixAllModalOpen(false)} className="px-4 py-2 text-sm text-gray-300 hover:text-white">Cancel</button>
                                <button onClick={handleApplyFixes} disabled={isApplyingFixes || approvedFixIds.size === 0}
                                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 transition-colors">
                                    {isApplyingFixes ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                    Apply Approved Fixes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function SEODashboardPage() {
    return (
        <Suspense>
            <SEODashboardInner />
        </Suspense>
    )
}
