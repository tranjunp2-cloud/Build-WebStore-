'use client'

/**
 * GenerationsLiveFeed — client component that polls /api/admin/generations every 10s.
 * Renders a filterable table with status dot, user, category, endpoint, duration, cost,
 * timestamp and an actions menu (View / Rerun).
 *
 * No TanStack Query — plain fetch + useState + setInterval (KISS, consistent with
 * other Phase 02-04 components).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Download } from 'lucide-react'
import { StatusDot } from './status-dot'
import { GenerationDetailDrawer } from './generation-detail-drawer'
import type { GenerationRecord, GenerationsFilters, GenerationsListResponse } from './generation-types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return new Date(iso).toLocaleDateString()
}

function getUserLabel(user: GenerationRecord['user']): string {
    if (!user) return '—'
    if (typeof user === 'number') return `#${user}`
    return user.email?.split('@')[0] ?? `#${user.id}`
}

function buildUrl(filters: GenerationsFilters): string {
    const params = new URLSearchParams()
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.endpoint) params.set('endpoint', filters.endpoint)
    if (filters.category) params.set('category', filters.category)
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (filters.search) params.set('search', filters.search)
    params.set('page', String(filters.page))
    params.set('limit', String(filters.limit))
    return `/api/admin/generations?${params.toString()}`
}

const STATUS_OPTIONS = ['all', 'running', 'success', 'failed'] as const
const LIMIT_OPTIONS = [25, 50, 100] as const
const POLL_INTERVAL_MS = 10_000

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
    initialData: GenerationsListResponse
}

export function GenerationsLiveFeed({ initialData }: Props) {
    const [records, setRecords] = useState<GenerationRecord[]>(initialData.data)
    const [meta, setMeta] = useState(initialData.meta)
    const [loading, setLoading] = useState(false)
    const [lastPoll, setLastPoll] = useState<Date>(new Date())
    const [selectedRecord, setSelectedRecord] = useState<GenerationRecord | null>(null)

    const [filters, setFilters] = useState<GenerationsFilters>({
        status: 'all',
        endpoint: '',
        category: '',
        dateFrom: '',
        dateTo: '',
        search: '',
        page: 1,
        limit: 50,
    })

    // Keep filters in a ref so the interval callback has latest value
    const filtersRef = useRef(filters)
    filtersRef.current = filters

    const fetchData = useCallback(async (f: GenerationsFilters, isManual = false) => {
        if (isManual) setLoading(true)
        try {
            const res = await fetch(buildUrl(f))
            if (!res.ok) return
            const json = await res.json() as GenerationsListResponse
            setRecords(json.data)
            setMeta(json.meta)
            setLastPoll(new Date())
        } catch {
            // silent — poll failure must not crash the page
        } finally {
            if (isManual) setLoading(false)
        }
    }, [])

    // Initial fetch on filter change
    useEffect(() => {
        void fetchData(filters, true)
    }, [filters, fetchData])

    // Polling every 10s
    useEffect(() => {
        const id = setInterval(() => {
            void fetchData(filtersRef.current)
        }, POLL_INTERVAL_MS)
        return () => clearInterval(id)
    }, [fetchData])

    function setFilter<K extends keyof GenerationsFilters>(key: K, val: GenerationsFilters[K]) {
        setFilters((prev) => ({ ...prev, [key]: val, page: key !== 'page' ? 1 : (val as number) }))
    }

    function handleExport() {
        const params = new URLSearchParams()
        if (filters.status && filters.status !== 'all') params.set('status', filters.status)
        if (filters.endpoint) params.set('endpoint', filters.endpoint)
        if (filters.category) params.set('category', filters.category)
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
        if (filters.dateTo) params.set('dateTo', filters.dateTo)
        window.open(`/api/admin/generations/export?${params.toString()}`, '_blank')
    }

    const inputStyle: React.CSSProperties = {
        padding: '5px 10px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        background: 'var(--bg-elev)',
        color: 'var(--text)',
        fontSize: 13,
    }

    const chipStyle = (active: boolean): React.CSSProperties => ({
        padding: '4px 12px',
        borderRadius: 'var(--radius)',
        border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
        background: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--bg-elev)',
        color: active ? 'var(--accent)' : 'var(--text-2)',
        fontSize: 12,
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
    })

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Filter bar ── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {/* Status chips */}
                {STATUS_OPTIONS.map((s) => (
                    <button key={s} onClick={() => setFilter('status', s)} style={chipStyle(filters.status === s)}>
                        {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                ))}

                <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

                {/* Search */}
                <input
                    style={{ ...inputStyle, width: 180 }}
                    placeholder="Search endpoint / category…"
                    value={filters.search}
                    onChange={(e) => setFilter('search', e.target.value)}
                />

                {/* Date range */}
                <input
                    type="date"
                    style={inputStyle}
                    value={filters.dateFrom}
                    onChange={(e) => setFilter('dateFrom', e.target.value)}
                    title="From date"
                />
                <input
                    type="date"
                    style={inputStyle}
                    value={filters.dateTo}
                    onChange={(e) => setFilter('dateTo', e.target.value)}
                    title="To date"
                />

                {/* Limit */}
                <select
                    style={inputStyle}
                    value={filters.limit}
                    onChange={(e) => setFilter('limit', Number(e.target.value) as 25 | 50 | 100)}
                >
                    {LIMIT_OPTIONS.map((l) => (
                        <option key={l} value={l}>{l}/page</option>
                    ))}
                </select>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Last poll indicator */}
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Updated {relativeTime(lastPoll.toISOString())}
                </span>

                <button
                    onClick={() => fetchData(filters, true)}
                    disabled={loading}
                    title="Refresh now"
                    style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                >
                    <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
                    Refresh
                </button>

                <button
                    onClick={handleExport}
                    title="Export CSV (top 500)"
                    style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                >
                    <Download size={12} />
                    Export CSV
                </button>
            </div>

            {/* ── Stats row ── */}
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {meta.totalDocs} total · page {meta.page}/{meta.totalPages} · polling every 10s
            </div>

            {/* ── Table ── */}
            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <table className="gen-table">
                    <thead>
                        <tr>
                            <th style={{ width: 28 }} />
                            <th>User</th>
                            <th>Endpoint</th>
                            <th>Category</th>
                            <th>Duration</th>
                            <th>Cost</th>
                            <th>Created</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {records.length === 0 && (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                                    No generations found.
                                </td>
                            </tr>
                        )}
                        {records.map((rec) => (
                            <tr key={rec.id}>
                                <td style={{ paddingRight: 4 }}>
                                    <StatusDot status={rec.status} />
                                </td>
                                <td style={{ color: 'var(--text-2)' }}>{getUserLabel(rec.user)}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{rec.endpoint}</td>
                                <td style={{ color: 'var(--text-2)' }}>{rec.category ?? '—'}</td>
                                <td style={{ color: 'var(--text-2)' }}>
                                    {rec.durationMs ? `${(rec.durationMs / 1000).toFixed(1)}s` : '—'}
                                </td>
                                <td style={{ color: 'var(--text-2)' }}>
                                    {rec.costUsd != null ? `$${rec.costUsd.toFixed(4)}` : '—'}
                                </td>
                                <td style={{ color: 'var(--text-3)', fontSize: 11 }}>{relativeTime(rec.createdAt)}</td>
                                <td>
                                    <button
                                        onClick={() => setSelectedRecord(rec)}
                                        style={{
                                            padding: '3px 10px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--border)',
                                            background: 'transparent',
                                            color: 'var(--text-2)',
                                            fontSize: 12,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Pagination ── */}
            {meta.totalPages > 1 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <button
                        disabled={!meta.hasPrevPage}
                        onClick={() => setFilter('page', filters.page - 1)}
                        style={{ ...inputStyle, cursor: meta.hasPrevPage ? 'pointer' : 'not-allowed', opacity: meta.hasPrevPage ? 1 : 0.4 }}
                    >
                        Previous
                    </button>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                        {meta.page} / {meta.totalPages}
                    </span>
                    <button
                        disabled={!meta.hasNextPage}
                        onClick={() => setFilter('page', filters.page + 1)}
                        style={{ ...inputStyle, cursor: meta.hasNextPage ? 'pointer' : 'not-allowed', opacity: meta.hasNextPage ? 1 : 0.4 }}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* ── Detail drawer ── */}
            <GenerationDetailDrawer
                record={selectedRecord}
                onClose={() => setSelectedRecord(null)}
            />
        </div>
    )
}
