'use client'

import { useState, useEffect } from 'react'
import { Search, AlertTriangle, CheckCircle, Info, Sparkles, Loader2, RefreshCcw, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

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

function ScoreGauge({ score }: { score: number }) {
    const color = score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'
    const bgColor = score >= 80 ? 'from-green-500/20' : score >= 50 ? 'from-yellow-500/20' : 'from-red-500/20'
    const label = score >= 80 ? 'Good' : score >= 50 ? 'Needs Work' : 'Poor'

    return (
        <div className={cn('relative flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br to-transparent p-8', bgColor)}>
            <div className="relative h-32 w-32">
                {/* Background circle */}
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

export default function SEODashboardPage() {
    const [seoData, setSeoData] = useState<SEOData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isFixing, setIsFixing] = useState(false)
    const [fixResult, setFixResult] = useState<string | null>(null)
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
    const [sites, setSites] = useState<Array<{ id: string; name: string }>>([])

    // Load user's sites
    useEffect(() => {
        async function loadSites() {
            try {
                const res = await fetch('/api/sites', { credentials: 'include' })
                if (res.ok) {
                    const data = await res.json()
                    const siteList = (data.docs || []).map((s: any) => ({ id: String(s.id), name: s.name }))
                    setSites(siteList)
                    if (siteList.length > 0) {
                        setSelectedSiteId(siteList[0].id)
                    } else {
                        setIsLoading(false)
                    }
                }
            } catch (err) {
                console.error('Failed to load sites', err)
                setIsLoading(false)
            }
        }
        loadSites()
    }, [])

    // Analyse selected site
    useEffect(() => {
        if (!selectedSiteId) return
        analyseSite(selectedSiteId)
    }, [selectedSiteId])

    const analyseSite = async (siteId: string) => {
        setIsLoading(true)
        setFixResult(null)
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
            }
        } catch (err) {
            console.error('SEO analysis failed', err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleFixAll = async () => {
        if (!selectedSiteId || isFixing) return
        setIsFixing(true)
        setFixResult(null)
        try {
            const res = await fetch('/api/seo/fix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId: selectedSiteId }),
                credentials: 'include',
            })
            if (res.ok) {
                const data = await res.json()
                if (data.success) {
                    setFixResult(`✅ Fixed ${data.data.fixedPages} of ${data.data.totalPages} pages`)
                    // Re-analyse
                    setTimeout(() => analyseSite(selectedSiteId), 1000)
                }
            }
        } catch (err) {
            setFixResult('❌ Fix failed — please try again')
        } finally {
            setIsFixing(false)
        }
    }

    // Empty state
    if (!isLoading && sites.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <Search className="mx-auto h-12 w-12 text-gray-600" />
                    <h2 className="mt-4 text-lg font-semibold text-white">No sites to analyse</h2>
                    <p className="mt-1 text-sm text-gray-500">Create a site first to use the SEO Dashboard</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">SEO Dashboard</h1>
                    <p className="mt-1 text-sm text-gray-400">Analyse and optimise your site's search engine performance</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Site selector */}
                    {sites.length > 1 && (
                        <select value={selectedSiteId || ''} onChange={e => setSelectedSiteId(e.target.value)}
                            className="rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none">
                            {sites.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}
                    <button onClick={() => selectedSiteId && analyseSite(selectedSiteId)}
                        disabled={isLoading}
                        className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50">
                        <RefreshCcw className={cn('h-4 w-4', isLoading && 'animate-spin')} /> Re-analyse
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
                        <p className="mt-3 text-sm text-gray-400">Analysing your site...</p>
                    </div>
                </div>
            ) : seoData ? (
                <>
                    {/* Score Overview */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <ScoreGauge score={seoData.score} />

                        {/* Stats */}
                        <div className="flex flex-col justify-center space-y-4 rounded-2xl bg-[#1E293B]/50 p-6">
                            <div>
                                <p className="text-3xl font-bold text-white">{seoData.totalIssues}</p>
                                <p className="text-sm text-gray-400">Total Issues</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-purple-400">{seoData.fixableIssues}</p>
                                <p className="text-sm text-gray-400">Auto-Fixable by AI</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-cyan-400">{seoData.pages.length}</p>
                                <p className="text-sm text-gray-400">Pages Analysed</p>
                            </div>
                        </div>

                        {/* Fix All */}
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-purple-500/30 bg-purple-500/5 p-6">
                            <Sparkles className="h-8 w-8 text-purple-400" />
                            <h3 className="mt-3 text-sm font-semibold text-white">AI SEO Fix</h3>
                            <p className="mt-1 text-center text-xs text-gray-500">
                                Auto-generate missing meta titles & descriptions with AI
                            </p>
                            <button onClick={handleFixAll} disabled={isFixing || seoData.fixableIssues === 0}
                                className="mt-4 flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-500 transition-colors disabled:opacity-50 shadow-lg shadow-purple-500/25">
                                {isFixing ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Fixing...</>
                                ) : (
                                    <><Sparkles className="h-4 w-4" /> Fix All with AI</>
                                )}
                            </button>
                            {fixResult && (
                                <p className="mt-3 text-xs text-green-400">{fixResult}</p>
                            )}
                        </div>
                    </div>

                    {/* Per-Page Breakdown */}
                    <div className="rounded-xl border border-white/10 bg-[#1E293B]/30">
                        <div className="border-b border-white/10 px-6 py-4">
                            <h2 className="text-lg font-semibold text-white">Page-by-Page Analysis</h2>
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
                                                    <CheckCircle className="h-3.5 w-3.5" /> All good
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-500">
                                                    {page.issues.length} issue{page.issues.length !== 1 ? 's' : ''}
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
        </div>
    )
}
