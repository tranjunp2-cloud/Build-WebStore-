'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
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

const LIMIT = 10

export function CustomersClientLayout() {
    const { t } = useI18n()
    const c = t.dashboard.customers
    const [records, setRecords] = useState<CustomerRecord[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
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
            const res = await getCustomersAction({ search, status, source, page, limit: LIMIT })
            setRecords(res.data)
            setTotal(res.meta.total)
        } catch {
            toast.error(c.loadFailed)
        } finally {
            setLoading(false)
        }
    }, [search, status, source, page, c])

    useEffect(() => { setPage(1) }, [status, source, search])
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

            {/* Mobile: card list — still gates on loading to avoid flash */}
            <div className="md:hidden">
                {loading ? (
                    <div className="py-16 text-center text-[14px]" style={{ color: 'var(--dash-text-muted)' }}>{c.loading}</div>
                ) : (
                    <CustomersCardList
                        records={records}
                        total={total}
                        page={page}
                        limit={LIMIT}
                        onSelect={handleSelect}
                        onDelete={setPendingDelete}
                        onPageChange={setPage}
                    />
                )}
            </div>

            {/* Desktop: table with inline skeleton rows */}
            <div className="hidden md:block">
                <CustomersTable
                    records={records}
                    loading={loading}
                    total={total}
                    page={page}
                    limit={LIMIT}
                    selectedId={selected?.id ?? null}
                    onSelect={handleSelect}
                    onDelete={setPendingDelete}
                    onPageChange={setPage}
                />
            </div>

            <CustomerDetailPanel
                record={selected}
                onClose={() => setSelected(null)}
                onStatusUpdate={handleStatusUpdateFromPanel}
            />

            {/* Delete confirmation dialog */}
            <Dialog open={!!pendingDelete} onOpenChange={open => { if (!open) setPendingDelete(null) }}>
                <DialogContent
                    className="max-w-[360px] rounded-[20px] p-6 gap-0"
                    style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
                >
                    {/* dash-shell wrapper re-activates globals.css scoped overrides inside RadixUI portal.
                        bg transparent: tránh .dash-shell{background:--dash-bg} đè lên nền --dash-surface của DialogContent (gây "2 màu"). */}
                    <div className="dash-shell" style={{ background: 'transparent' }}>
                    <DialogHeader className="mb-3">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="flex items-center justify-center w-10 h-10 rounded-[12px] shrink-0" style={{ background: 'hsl(var(--destructive)/0.12)' }}>
                                <Trash2 className="w-5 h-5 text-[hsl(var(--destructive))]" />
                            </div>
                            <DialogTitle className="text-[18px] font-bold" style={{ color: 'var(--dash-text)' }}>
                                {c.deleteTitle}
                            </DialogTitle>
                        </div>
                    </DialogHeader>

                    <p className="text-[14px] leading-relaxed mb-6" style={{ color: 'var(--dash-text-muted)' }}>
                        {c.deleteConfirmPre}{' '}
                        <span className="font-medium" style={{ color: 'var(--dash-text)' }}>{deleteDisplayName}</span>
                        {' '}{c.deleteConfirmPost}
                    </p>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setPendingDelete(null)}
                            className="flex-1 h-[44px] rounded-[10px] text-[14px] font-medium bg-transparent hover:opacity-80 transition-opacity cursor-pointer"
                            style={{ color: 'var(--dash-text-muted)', border: '1px solid hsl(var(--input-border))' }}
                        >
                            {c.cancel}
                        </button>
                        <button
                            type="button"
                            onClick={confirmDelete}
                            className="flex-1 h-[44px] rounded-[10px] text-[14px] font-medium !text-white transition-opacity hover:opacity-90 cursor-pointer border-none"
                            style={{ background: 'hsl(var(--destructive))' }}
                        >
                            {c.deleteButton}
                        </button>
                    </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
