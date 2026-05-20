'use client'

import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Pagination } from '@/components/ui/Pagination'
import { CustomerAvatar } from './customer-avatar'
import { CustomerStatusBadge } from './customer-status-badge'
import { CustomerSourceBadge } from './customer-source-badge'
import { useI18n } from '@/i18n'
import type { CustomerRecord } from '../_lib/customer-record'

// Figma: 7 cols — Profile(237) | Email(flex) | Source(218) | Message(412→flex) | Date(flex) | Status(flex) | Actions(119)
// Actions=119px per Figma spec (was wrongly coded as 64px which caused header text overflow → spurious scrollbar)
const COLS = 'grid-cols-[minmax(130px,237px)_minmax(100px,1fr)_minmax(130px,218px)_minmax(120px,1.8fr)_minmax(90px,1fr)_minmax(90px,1fr)_119px]'

const HEADER_TEXT = 'text-[12px] font-semibold uppercase tracking-[0.3px] text-white/60'
const CELL_PAD = 'px-6 py-5'

type Props = {
    records: CustomerRecord[]
    total: number
    page: number
    limit: number
    selectedId: string | null
    onSelect: (record: CustomerRecord) => void
    onDelete: (record: CustomerRecord) => void
    onPageChange: (page: number) => void
}

export function CustomersTable({ records, total, page, limit, selectedId, onSelect, onDelete, onPageChange }: Props) {
    const { t } = useI18n()
    const c = t.dashboard.customers
    const totalPages = Math.ceil(total / limit)

    if (records.length === 0) {
        return <div className="py-16 text-center text-[14px] text-white/30">{c.empty}</div>
    }

    return (
        <div className="w-full min-w-0 rounded-[16px] border border-white/[0.08] bg-[#1e293b]/60">
            {/* Scrollable table area */}
            <div className="overflow-x-auto">
                {/* Header */}
                <div className={cn('min-w-[779px] grid gap-0', COLS, 'bg-[#0b1120]/50 border-b border-white/5')}>
                    <div className={cn(CELL_PAD, HEADER_TEXT)}>{c.colProfile}</div>
                    <div className={cn(CELL_PAD, HEADER_TEXT)}>{c.colEmail}</div>
                    <div className={cn(CELL_PAD, HEADER_TEXT)}>{c.colSource}</div>
                    <div className={cn(CELL_PAD, HEADER_TEXT)}>{c.colMessage}</div>
                    <div className={cn(CELL_PAD, HEADER_TEXT)}>{c.colDate}</div>
                    <div className={cn(CELL_PAD, HEADER_TEXT)}>{c.colStatus}</div>
                    <div className={cn(CELL_PAD, HEADER_TEXT)}>{c.colActions}</div>
                </div>

                {/* Rows */}
                <div className="min-w-[779px] flex flex-col divide-y divide-white/[0.05]">
                    {records.map(record => {
                        const displayName = record.source === 'newsletter'
                            ? (record.name ?? 'Guest') + ' (Newsletter)'
                            : (record.name ?? 'Guest')

                        return (
                            <div
                                key={record.id}
                                onClick={() => onSelect(record)}
                                className={cn(
                                    'grid gap-0 items-center cursor-pointer transition-colors h-[81px]',
                                    COLS,
                                    selectedId === record.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]',
                                )}
                            >
                                {/* Customer Profile */}
                                <div className={cn(CELL_PAD, 'flex items-center gap-3 min-w-0')}>
                                    <CustomerAvatar name={record.name} email={record.email} source={record.source} />
                                    <span className="text-[14px] font-semibold text-[#f8fafc] truncate">{displayName}</span>
                                </div>

                                {/* Email */}
                                <div className={cn(CELL_PAD, 'min-w-0')}>
                                    <p className="text-[14px] text-white/70 truncate">{record.email}</p>
                                </div>

                                {/* Source & Site */}
                                <div className={CELL_PAD}>
                                    <CustomerSourceBadge source={record.source} />
                                </div>

                                {/* Message */}
                                <div className={cn(CELL_PAD, 'min-w-0')}>
                                    <p className="text-[14px] text-white/70 truncate">
                                        {record.message ?? c.defaultMessage}
                                    </p>
                                </div>

                                {/* Latest Date */}
                                <div className={CELL_PAD}>
                                    <p className="text-[14px] text-white/70">
                                        {new Date(record.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>

                                {/* Status */}
                                <div className={CELL_PAD}>
                                    <CustomerStatusBadge status={record.status} />
                                </div>

                                {/* Actions */}
                                <div className={cn(CELL_PAD, 'flex items-center justify-center')} onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => onDelete(record)}
                                        className="flex items-center justify-center w-8 h-8 rounded-[8px] text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors border-none bg-transparent cursor-pointer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Pagination — inside card, right-aligned, matches products layout */}
            {totalPages > 1 && (
                <div className="flex justify-end items-center p-[16px] border-t border-white/[0.08]">
                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
                </div>
            )}
        </div>
    )
}
