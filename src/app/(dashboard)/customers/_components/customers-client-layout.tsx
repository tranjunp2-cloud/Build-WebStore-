'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { CustomersListToolbar } from './customers-list-toolbar'
import { CustomersListTable } from './customers-list-table'
import { getShopCustomersAction, exportShopCustomersCsvAction } from '../actions'
import { useAgentChanges } from '@/lib/agent-changes/use-agent-changes'
import type { ShopCustomerRecord } from '../_lib/shop-customer-record'
import type { RankFilter, DateFilter } from './customers-list-toolbar'
import type { SortKey } from '../_lib/shop-customer-record'
import {
    getBrowserViewerTimeZone,
    getViewerCustomDateRange,
    getViewerDateTimeParts,
    getViewerPeriodStart,
    shiftViewerDateKey,
    toViewerDateKey,
    viewerDateKeyToUtc,
} from '@/lib/viewer-timezone'

function toDateRange(f: DateFilter, customFrom?: string, customTo?: string): { dateFrom?: string; dateTo?: string } {
    const now = new Date()
    const viewerTimeZone = getBrowserViewerTimeZone()
    const todayKey = toViewerDateKey(getViewerDateTimeParts(now, viewerTimeZone))

    if (f === 'today') {
        return {
            dateFrom: getViewerPeriodStart(now, viewerTimeZone, 'today').toISOString(),
            dateTo: now.toISOString(),
        }
    }

    const rollingDays = f === 'last7d'
        ? 7
        : f === 'last30d'
            ? 30
            : f === 'last90d'
                ? 90
                : null

    if (rollingDays) {
        const startKey = shiftViewerDateKey(todayKey, -(rollingDays - 1))
        const start = startKey ? viewerDateKeyToUtc(startKey, viewerTimeZone) : null
        return start ? { dateFrom: start.toISOString() } : {}
    }

    if (f === 'thisYear') {
        return {
            dateFrom: getViewerPeriodStart(now, viewerTimeZone, 'thisYear').toISOString(),
        }
    }

    if (f === 'customRange' && customFrom && customTo) {
        const range = getViewerCustomDateRange(customFrom, customTo, viewerTimeZone)
        return range
            ? {
                dateFrom: range.start.toISOString(),
                dateTo: range.endInclusive.toISOString(),
            }
            : {}
    }

    return {}
}

export function ShopCustomersClientLayout() {
    const router = useRouter()
    const { t, ti } = useI18n()
    const c = t.dashboard.shopCustomers

    const [records, setRecords]     = useState<ShopCustomerRecord[]>([])
    const [total, setTotal]         = useState(0)
    const [page, setPage]           = useState(1)
    const [limit, setLimit]         = useState(10)
    const [search, setSearch]       = useState('')
    const [rankFilter, setRankFilter]   = useState<RankFilter>('all')
    const [dateFilter, setDateFilter]   = useState<DateFilter>('any')
    const [sortBy, setSortBy]       = useState<SortKey>('latestOrderAt')
    const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc')
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo]     = useState('')
    const [loading, setLoading]     = useState(true)
    const [exporting, setExporting] = useState(false)

    // genRef tracks the "generation" of the latest fetch. Each load() call increments it;
    // a resolved response is discarded if its generation no longer matches the current one.
    // Using a ref (not state) avoids extra renders and dep-array churn on load.
    const genRef = useRef(0)

    // Extract translation string so useCallback dep-array can capture it
    // (c is stable per locale, but ESLint cannot verify property access on outer objects)
    const loadFailedMsg = c.loadFailed

    // silent = an assistant-driven refetch: keep the rows on screen, no spinner, no toast on failure
    const load = useCallback(async (silent = false) => {
        const gen = ++genRef.current
        if (!silent) setLoading(true)
        try {
            const { dateFrom, dateTo } = toDateRange(dateFilter, customFrom, customTo)
            const res = await getShopCustomersAction({
                search: search || undefined,
                rank: rankFilter,
                dateFrom,
                dateTo,
                page,
                limit,
                sortBy,
                sortDir,
            })
            // Discard stale responses — only the latest fetch wins
            if (gen !== genRef.current) return
            setRecords(res.data)
            setTotal(res.meta.total)
        } catch (err) {
            if (gen !== genRef.current) return
            if (silent) console.error('[Customers refresh]', err)
            else toast.error(loadFailedMsg)
        } finally {
            // Only the latest call clears the loading spinner
            if (gen === genRef.current) setLoading(false)
        }
    }, [search, rankFilter, dateFilter, customFrom, customTo, page, limit, sortBy, sortDir, loadFailedMsg])

    useEffect(() => { load() }, [load])

    // The assistant approved / undid a customer change: fetch the current page again (same filters, sort, page)
    const loadRef = useRef(load)
    loadRef.current = load
    useAgentChanges({ kinds: ['store_customer'] }, () => { void loadRef.current(true) })

    // Stable handler refs via useCallback([], []) — state setters have stable identity per React.
    // Prevents child re-renders and debounce reset on every parent render.
    const handleSearchChange       = useCallback((q: string)                  => { setSearch(q);                  setPage(1) }, [])
    const handleRankFilterChange   = useCallback((r: RankFilter)              => { setRankFilter(r);              setPage(1) }, [])
    const handleDateFilterChange   = useCallback((d: DateFilter)              => { setDateFilter(d);              setPage(1) }, [])
    const handleCustomRangeApply   = useCallback((from: string, to: string)   => { setCustomFrom(from); setCustomTo(to); setPage(1) }, [])
    const handleSetSortBy          = useCallback((key: SortKey)               => { setSortBy(key);     setPage(1) }, [])
    const handleSetSortDir         = useCallback((dir: 'asc' | 'desc')        => { setSortDir(dir);    setPage(1) }, [])

    async function handleExport() {
        setExporting(true)
        try {
            const { dateFrom, dateTo } = toDateRange(dateFilter, customFrom, customTo)
            const result = await exportShopCustomersCsvAction({
                search: search || undefined,
                rank: rankFilter,
                dateFrom,
                dateTo,
            })
            if (result.truncated) {
                toast.warning(ti(c.exportLimited, { total: result.total }))
            }
            // Blob URL approach: browser encodes the JS string as UTF-8, preserving
            // the ﻿ BOM that toCsv prepends. The `download` attribute is reliably
            // respected on all platforms (including Linux/Chromium) with Blob URLs.
            const filename = `customers-${new Date().toISOString().slice(0, 10)}.csv`
            const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.setAttribute('download', filename)
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            setTimeout(() => URL.revokeObjectURL(url), 100)
        } catch (err) {
            console.error('[exportShopCustomers]', err)
            toast.error(c.exportFailed)
        } finally {
            setExporting(false)
        }
    }

    const hasFilters = !!(search || rankFilter !== 'all' || dateFilter !== 'any')

    return (
        <div className="space-y-5 pb-20">
            <div>
                <h1 className="text-[24px] font-bold" style={{ color: 'var(--dash-text)' }}>{c.title}</h1>
                <p className="text-[14px] mt-1" style={{ color: 'var(--dash-text-muted)' }}>{c.subtitle}</p>
            </div>

            <CustomersListToolbar
                search={search}
                onSearch={handleSearchChange}
                rankFilter={rankFilter}
                onRankFilterChange={handleRankFilterChange}
                dateFilter={dateFilter}
                onDateFilterChange={handleDateFilterChange}
                customFrom={customFrom}
                customTo={customTo}
                onCustomRangeApply={handleCustomRangeApply}
                onExport={handleExport}
                exporting={exporting}
                records={records}
            />

            <CustomersListTable
                records={records}
                loading={loading}
                total={total}
                page={page}
                setPage={setPage}
                limit={limit}
                setLimit={setLimit}
                sortBy={sortBy}
                setSortBy={handleSetSortBy}
                sortDir={sortDir}
                setSortDir={handleSetSortDir}
                onRowClick={id => router.push(`/customers/${id}`)}
                hasFilters={hasFilters}
            />
        </div>
    )
}
