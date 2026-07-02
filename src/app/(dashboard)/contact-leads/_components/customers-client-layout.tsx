'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { ConfirmModal } from '@/components/ui/confirm-modal'
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

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await getCustomersAction({ search, status, source, page, limit })
            setRecords(res.data)
            setTotal(res.meta.total)
        } catch {
            toast.error(c.loadFailed)
        } finally {
            setLoading(false)
        }
    }, [search, status, source, page, limit, c])

    useEffect(() => { setPage(1) }, [status, source, search])
    const handleLimitChange = (n: number) => { setLimit(n); setPage(1) }
    useEffect(() => { load() }, [load])

    async function confirmDelete() {
        if (!pendingDelete) return
        const record = pendingDelete
        setPendingDelete(null)
        setRecords(prev => prev.filter(r => r.id !== record.id))
        setTotal(n => n - 1)
        if (selected?.id === record.id) setSelected(null)
        try {
            await deleteCustomerAction(record.rawId, record.source)
            toast.success(c.deleteSuccess)
        } catch {
            load()
            toast.error(c.deleteFailed)
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
