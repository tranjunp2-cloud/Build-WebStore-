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
                <h1 className="text-[24px] font-bold text-[#F8FAFC]">{c.title}</h1>
                <p className="text-[14px] text-white/60 mt-1">{c.subtitle}</p>
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

            {loading ? (
                <div className="py-16 text-center text-[14px] text-white/30">{c.loading}</div>
            ) : (
                <>
                    {/* Mobile: card list */}
                    <div className="md:hidden">
                        <CustomersCardList
                            records={records}
                            total={total}
                            page={page}
                            limit={LIMIT}
                            onSelect={handleSelect}
                            onDelete={setPendingDelete}
                            onPageChange={setPage}
                        />
                    </div>
                    {/* Desktop: table */}
                    <div className="hidden md:block">
                        <CustomersTable
                            records={records}
                            total={total}
                            page={page}
                            limit={LIMIT}
                            selectedId={selected?.id ?? null}
                            onSelect={handleSelect}
                            onDelete={setPendingDelete}
                            onPageChange={setPage}
                        />
                    </div>
                </>
            )}

            <CustomerDetailPanel
                record={selected}
                onClose={() => setSelected(null)}
                onStatusUpdate={handleStatusUpdateFromPanel}
            />

            {/* Delete confirmation dialog */}
            <Dialog open={!!pendingDelete} onOpenChange={open => { if (!open) setPendingDelete(null) }}>
                <DialogContent
                    className="border-white/[0.08] max-w-[360px] rounded-[20px] p-6 gap-0"
                    style={{ background: 'var(--dash-surface)' }}
                >
                    {/* dash-shell wrapper re-activates globals.css scoped overrides inside RadixUI portal */}
                    <div className="dash-shell">
                    <DialogHeader className="mb-3">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="flex items-center justify-center w-10 h-10 rounded-[12px] shrink-0" style={{ background: 'rgba(239,68,68,0.12)' }}>
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </div>
                            <DialogTitle className="text-[18px] font-bold text-[#f8fafc]">
                                {c.deleteTitle}
                            </DialogTitle>
                        </div>
                    </DialogHeader>

                    <p className="text-[14px] text-white/60 leading-relaxed mb-6">
                        {c.deleteConfirmPre}{' '}
                        <span className="text-white font-medium">{deleteDisplayName}</span>
                        {' '}{c.deleteConfirmPost}
                    </p>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setPendingDelete(null)}
                            className="flex-1 h-[44px] rounded-[10px] text-[14px] font-medium text-white/70 border border-white/[0.08] bg-transparent hover:bg-white/[0.05] transition-colors cursor-pointer"
                        >
                            {c.cancel}
                        </button>
                        <button
                            type="button"
                            onClick={confirmDelete}
                            className="flex-1 h-[44px] rounded-[10px] text-[14px] font-medium text-white transition-opacity hover:opacity-90 cursor-pointer border-none"
                            style={{ background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)' }}
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
