'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useTablePageClamp } from '@/components/ui/table-pagination'
import { CustomersActionBar } from './customers-action-bar'
import { CustomersTable } from './customers-table'
import { CustomersCardList } from './customers-card-list'
import { CustomerDetailPanel } from './customer-detail-panel'
import {
    getCustomersAction,
    deleteCustomerAction,
    exportCustomersCsvAction,
} from '../actions'
import type { CustomerRecord } from '../_lib/customer-record'
import { useAgentChanges } from '@/lib/agent-changes/use-agent-changes'

export function CustomersClientLayout() {
    const { t } = useI18n()
    const c = t.dashboard.customers
    const [records, setRecords] = useState<CustomerRecord[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    // Rows-per-page stateful for the DS pagination selector ([10,25,50,100]) (GH-1290 Bug 4)
    const [limit, setLimit] = useState(10)
    const [status, setStatus] = useState('')
    const [source, setSource] = useState('')
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)
    const [selected, setSelected] = useState<CustomerRecord | null>(null)
    const [pendingDelete, setPendingDelete] = useState<CustomerRecord | null>(null)

    // Generation ref — stale fetch guard (same pattern as discounts layout): overlapping
    // loads are otherwise last-resolve-wins, which can commit stale records.
    const genRef = useRef(0)

    // silent = an assistant-driven refetch: keep the rows on screen, no spinner, no toast on failure
    const load = useCallback(async (silent = false) => {
        const gen = ++genRef.current
        if (!silent) setLoading(true)
        try {
            const res = await getCustomersAction({ search, status, source, page, limit })
            if (gen !== genRef.current) return
            setRecords(res.data)
            setTotal(res.meta.total)
        } catch (err) {
            if (gen !== genRef.current) return
            if (silent) console.error('[Contact leads refresh]', err)
            else toast.error(c.loadFailed)
        } finally {
            if (gen === genRef.current) setLoading(false)
        }
    }, [search, status, source, page, limit, c])

    // Latest-load ref: post-delete reconciliation must fetch with the CURRENT
    // page/filters, not the ones captured at confirm time (GH-1579 re-review M1).
    const loadRef = useRef(load)
    loadRef.current = load

    useEffect(() => { setPage(1) }, [status, source, search])
    const handleLimitChange = (n: number) => { setLimit(n); setPage(1) }
    // GH-1579: snap back when deletions strand page past the last page
    useTablePageClamp(page, total, limit, setPage, !loading)
    useEffect(() => { load() }, [load])

    // The assistant approved / undid a change (a status, a reply): fetch the current page again (same filters, page)
    useAgentChanges({ kinds: ['contact_lead', 'lead_reply'] }, () => { void loadRef.current(true) })

    async function confirmDelete() {
        if (!pendingDelete) return
        const record = pendingDelete
        setPendingDelete(null)
        try {
            await deleteCustomerAction(record.rawId, record.source)
            if (selected?.id === record.id) setSelected(null)
            toast.success(c.deleteSuccess)
        } catch {
            toast.error(c.deleteFailed)
        } finally {
            // Refetch AFTER the server settles to reconcile records + total in one shot:
            // a manual decrement strands the row on the next server page when a delete
            // crosses the 11→10 hide boundary, and refetching post-commit means the
            // GH-1579 clamp can never race an in-flight DELETE (ghost row). Via ref so
            // it always uses the CURRENT page/filters, not confirm-time ones.
            loadRef.current()
        }
    }

    async function handleExport() {
        setExporting(true)
        try {
            const csv = await exportCustomersCsvAction({ search, status, source })
            const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
            const encoder = new TextEncoder()
            // strip Unicode BOM char if csv-exporter prepended it — avoid double BOM
            const csvBody = csv.startsWith('﻿') ? csv.slice(1) : csv
            const blob = new Blob([bom, encoder.encode(csvBody)], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            setTimeout(() => URL.revokeObjectURL(url), 100)
        } catch {
            toast.error(c.exportFailed)
        } finally {
            setExporting(false)
        }
    }

    function handleSelect(record: CustomerRecord) {
        setSelected(prev => prev?.id === record.id ? null : record)
    }

    function handleStatusUpdateFromPanel(record: CustomerRecord, newStatus: string) {
        setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: newStatus as CustomerRecord['status'] } : r))
        setSelected(prev => prev?.id === record.id ? { ...prev, status: newStatus as CustomerRecord['status'] } : prev)
    }

    const deleteDisplayName = pendingDelete
        ? pendingDelete.source === 'newsletter'
            ? (pendingDelete.name ?? 'Guest') + ' (Newsletter)'
            : (pendingDelete.name ?? pendingDelete.email)
        : ''

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div>
                <h1 className="text-[24px] font-bold" style={{ color: 'var(--dash-text)' }}>{c.title}</h1>
                <p className="text-[14px] mt-1" style={{ color: 'var(--dash-text-muted)' }}>{c.subtitle}</p>
            </div>

            <CustomersActionBar
                status={status}
                source={source}
                exporting={exporting}
                onSearch={setSearch}
                onStatusChange={setStatus}
                onSourceChange={(s: string) => {
                    setSource(s)
                    // Reset incompatible status when switching sources
                    if (s === 'newsletter' && status !== '' && status !== 'subscribed') setStatus('')
                    if (s === 'contact-form' && status === 'subscribed') setStatus('')
                }}
                onExport={handleExport}
            />

            {/* Card list (mobile + iPad mini, < 820px) — still gates on loading to avoid flash */}
            <div className="min-[820px]:hidden">
                {loading ? (
                    <div className="py-16 text-center text-[14px]" style={{ color: 'var(--dash-text-muted)' }}>{c.loading}</div>
                ) : (
                    <CustomersCardList
                        records={records}
                        total={total}
                        page={page}
                        limit={limit}
                        onSelect={handleSelect}
                        onDelete={setPendingDelete}
                        onPageChange={setPage}
                        onLimitChange={handleLimitChange}
                    />
                )}
            </div>

            {/* iPad Air and up (>=820px): table (compact below xl, original at xl+) */}
            <div className="hidden min-[820px]:block">
                <CustomersTable
                    records={records}
                    loading={loading}
                    total={total}
                    page={page}
                    limit={limit}
                    selectedId={selected?.id ?? null}
                    onSelect={handleSelect}
                    onDelete={setPendingDelete}
                    onPageChange={setPage}
                    onLimitChange={handleLimitChange}
                />
            </div>

            <CustomerDetailPanel
                record={selected}
                onClose={() => setSelected(null)}
                onStatusUpdate={handleStatusUpdateFromPanel}
            />

            {/* Delete confirmation — shared ConfirmModal (GH-1290 Bug 5) */}
            <ConfirmModal
                open={!!pendingDelete}
                onCancel={() => setPendingDelete(null)}
                onConfirm={confirmDelete}
                title={c.deleteTitle}
                description={
                    <>
                        {c.deleteConfirmPre}{' '}
                        <span className="font-medium" style={{ color: 'var(--dash-text)' }}>{deleteDisplayName}</span>
                        {' '}{c.deleteConfirmPost}
                    </>
                }
                cancelLabel={c.cancel}
                confirmLabel={c.deleteButton}
                variant="danger"
            />
        </div>
    )
}
