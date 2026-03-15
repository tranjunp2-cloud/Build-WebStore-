'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Eye, MousePointerClick, Users, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type AnalyticsSummary = {
    totalViews: number
    uniqueVisitors: number
    topPages: Array<{ pageUrl: string; views: number }>
    eventBreakdown: Record<string, number>
    dailyViews: Array<{ date: string; views: number }>
}

export default function AnalyticsDashboardPage() {
    const [data, setData] = useState<AnalyticsSummary | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [sites, setSites] = useState<Array<{ id: string; name: string }>>([])
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
    const [period, setPeriod] = useState<'7d' | '30d'>('7d')

    // Load sites
    useEffect(() => {
        async function loadSites() {
            try {
                const res = await fetch('/api/sites', { credentials: 'include' })
                if (res.ok) {
                    const d = await res.json()
                    const list = (d.docs || []).map((s: { id: string | number; name: string }) => ({ id: String(s.id), name: s.name }))
                    setSites(list)
                    if (list.length > 0) setSelectedSiteId(list[0].id)
                    else setIsLoading(false)
                }
            } catch {
                toast.error('Failed to load sites')
                setIsLoading(false)
            }
        }
        loadSites()
    }, [])

    // Load analytics
    useEffect(() => {
        if (!selectedSiteId) return
        loadAnalytics(selectedSiteId)
    }, [selectedSiteId, period])

    const loadAnalytics = async (siteId: string) => {
        setIsLoading(true)
        try {
            const days = period === '7d' ? 7 : 30
            const since = new Date()
            since.setDate(since.getDate() - days)

            const res = await fetch(`/api/analytics?where[site][equals]=${siteId}&where[createdAt][greater_than]=${since.toISOString()}&limit=1000`, {
                credentials: 'include',
            })
            if (res.ok) {
                const d = await res.json()
                const docs = d.docs || []

                // Process into summary
                const uniqueIps = new Set(docs.map((d: { ip?: string }) => d.ip))
                const pageViews: Record<string, number> = {}
                const eventCounts: Record<string, number> = {}
                const dailyCounts: Record<string, number> = {}

                for (const doc of docs) {
                    // Top pages
                    const url = doc.pageUrl || '/'
                    pageViews[url] = (pageViews[url] || 0) + 1

                    // Events
                    const event = doc.event || 'pageview'
                    eventCounts[event] = (eventCounts[event] || 0) + 1

                    // Daily
                    const date = new Date(doc.createdAt).toISOString().split('T')[0]
                    dailyCounts[date] = (dailyCounts[date] || 0) + 1
                }

                // Generate daily array (fill missing days with 0)
                const dailyViews: Array<{ date: string; views: number }> = []
                for (let i = days - 1; i >= 0; i--) {
                    const d = new Date()
                    d.setDate(d.getDate() - i)
                    const key = d.toISOString().split('T')[0]
                    dailyViews.push({ date: key, views: dailyCounts[key] || 0 })
                }

                setData({
                    totalViews: docs.length,
                    uniqueVisitors: uniqueIps.size,
                    topPages: Object.entries(pageViews)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .slice(0, 10)
                        .map(([pageUrl, views]) => ({ pageUrl, views: views as number })),
                    eventBreakdown: eventCounts,
                    dailyViews,
                })
            }
        } catch (err) {
            toast.error('Failed to load analytics', {
                action: { label: 'Retry', onClick: () => loadAnalytics(siteId) },
            })
        } finally {
            setIsLoading(false)
        }
    }

    if (!isLoading && sites.length === 0) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center">
                    <BarChart3 className="mx-auto h-12 w-12 text-gray-600" />
                    <h2 className="mt-4 text-lg font-semibold text-white">No sites to analyse</h2>
                    <p className="mt-1 text-sm text-gray-500">Create and publish a site first</p>
                    <a href="/dashboard"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
                        Go to Dashboard
                    </a>
                </div>
            </div>
        )
    }

    const maxViews = data ? Math.max(...data.dailyViews.map(d => d.views), 1) : 1

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Analytics</h1>
                    <p className="mt-1 text-sm text-gray-400">Track your site performance</p>
                </div>
                <div className="flex items-center gap-3">
                    {sites.length > 1 && (
                        <select value={selectedSiteId || ''} onChange={e => setSelectedSiteId(e.target.value)}
                            aria-label="Select site"
                            className="rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none">
                            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                    <div className="flex gap-1 rounded-lg border border-white/10 bg-[#1E293B] p-0.5">
                        {(['7d', '30d'] as const).map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                    period === p ? 'bg-blue-500/15 text-blue-400' : 'text-gray-500 hover:text-gray-300')}>
                                {p === '7d' ? '7 Days' : '30 Days'}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => selectedSiteId && loadAnalytics(selectedSiteId)}
                        aria-label="Refresh analytics"
                        className="rounded-lg bg-white/5 p-2 text-gray-400 hover:bg-white/10 transition-colors">
                        <RefreshCcw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="animate-pulse space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-4 w-4 rounded bg-white/5" />
                                    <div className="h-3 w-16 rounded bg-white/5" />
                                </div>
                                <div className="h-8 w-20 rounded bg-white/5" />
                            </div>
                        ))}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6">
                        <div className="h-4 w-24 rounded bg-white/5 mb-4" />
                        <div className="h-40 rounded bg-white/5" />
                    </div>
                </div>
            ) : data ? (
                <>
                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        {[
                            { label: 'Total Views', value: data.totalViews, icon: Eye, color: 'text-blue-400' },
                            { label: 'Unique Visitors', value: data.uniqueVisitors, icon: Users, color: 'text-green-400' },
                            { label: 'Add to Cart', value: data.eventBreakdown.add_to_cart || 0, icon: MousePointerClick, color: 'text-purple-400' },
                            { label: 'Purchases', value: data.eventBreakdown.purchase || 0, icon: TrendingUp, color: 'text-cyan-400' },
                        ].map(stat => (
                            <div key={stat.label} className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <stat.icon className={cn('h-4 w-4', stat.color)} />
                                    <span className="text-xs text-gray-500">{stat.label}</span>
                                </div>
                                <p className="text-3xl font-bold text-white">{stat.value.toLocaleString()}</p>
                            </div>
                        ))}
                    </div>

                    {/* Bar Chart */}
                    <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6">
                        <h2 className="text-sm font-semibold text-gray-400 mb-4">Daily Views</h2>
                        <div className="flex items-end gap-1" style={{ height: '160px' }}>
                            {data.dailyViews.map(day => (
                                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-[10px] text-gray-600">{day.views || ''}</span>
                                    <div className="w-full rounded-t-sm bg-blue-500/30 hover:bg-blue-500/50 transition-colors"
                                        style={{ height: `${Math.max((day.views / maxViews) * 140, 2)}px` }}
                                        title={`${day.date}: ${day.views} views`} />
                                    <span className="text-[9px] text-gray-700 rotate-[-45deg] origin-top-left w-8 truncate">
                                        {new Date(day.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Pages */}
                    <div className="rounded-xl border border-white/10 bg-[#1E293B]/30">
                        <div className="border-b border-white/10 px-6 py-4">
                            <h2 className="text-sm font-semibold text-gray-400">Top Pages</h2>
                        </div>
                        <div className="divide-y divide-white/5">
                            {data.topPages.length === 0 ? (
                                <div className="px-6 py-8 text-center text-sm text-gray-600">No page views yet</div>
                            ) : (
                                data.topPages.map((page, i) => (
                                    <div key={page.pageUrl} className="flex items-center justify-between px-6 py-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-600 w-5 text-right">{i + 1}</span>
                                            <span className="text-sm text-gray-300 truncate max-w-md">{page.pageUrl}</span>
                                        </div>
                                        <span className="text-sm font-medium text-white">{page.views}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    )
}
