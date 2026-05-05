'use client'

import { Eye, Trash2 } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'
import { CustomerAvatar } from './customer-avatar'
import { CustomerStatusBadge } from './customer-status-badge'
import { CustomerSourceBadge } from './customer-source-badge'
import { useI18n } from '@/i18n'
import type { CustomerRecord } from '../_lib/customer-record'

type Props = {
    records: CustomerRecord[]
    total: number
    page: number
    limit: number
    onSelect: (record: CustomerRecord) => void
    onDelete: (record: CustomerRecord) => void
    onPageChange: (page: number) => void
}

export function CustomersCardList({ records, total, page, limit, onSelect, onDelete, onPageChange }: Props) {
    const { t } = useI18n()
    const c = t.dashboard.customers
    const totalPages = Math.ceil(total / limit)

    if (records.length === 0) {
        return <div className="py-16 text-center text-[14px] text-white/30">{c.empty}</div>
    }

    return (
        <div className="flex flex-col gap-4">
            {records.map(record => {
                const displayName = record.source === 'newsletter'
                    ? (record.name ?? 'Guest') + ' (Newsletter)'
                    : (record.name ?? 'Guest')

                return (
                    <div
                        key={record.id}
                        onClick={() => onSelect(record)}
                        className="rounded-[16px] border border-white/[0.08] overflow-hidden cursor-pointer active:opacity-80 transition-opacity"
                        style={{ background: 'rgba(30,41,59,0.6)' }}
                    >
                        {/* Card body */}
                        <div className="flex flex-col gap-[10px] px-[17px] pt-[17px] pb-[14px]">
                            {/* Avatar + Name */}
                            <div className="flex items-center gap-3">
                                <CustomerAvatar name={record.name} email={record.email} source={record.source} size={40} />
                                <span className="text-[14px] font-semibold text-[#f8fafc] truncate">{displayName}</span>
                            </div>

                            {/* Email | Date */}
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] text-white/60 truncate">{record.email}</span>
                                <span className="text-[12px] text-white/60 shrink-0 ml-2">
                                    {new Date(record.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>

                            {/* Source | Status */}
                            <div className="flex items-center justify-between">
                                <CustomerSourceBadge source={record.source} />
                                <CustomerStatusBadge status={record.status} />
                            </div>

                            {/* Message preview */}
                            <p className="text-[12px] text-white/60 truncate">
                                {record.message ?? c.defaultMessage}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 px-[17px] py-[10px] border-t border-white/[0.05]" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => onSelect(record)}
                                className="flex items-center justify-center gap-2 flex-1 h-[37px] rounded-[12px] text-[14px] font-medium border-none cursor-pointer transition-opacity hover:opacity-80"
                                style={{ background: 'rgba(0,201,80,0.1)', color: '#05df72' }}
                            >
                                <Eye className="w-4 h-4" />
                                {c.view}
                            </button>
                            <button
                                onClick={() => onDelete(record)}
                                className="flex items-center justify-center gap-2 flex-1 h-[37px] rounded-[12px] text-[14px] font-medium border-none cursor-pointer transition-opacity hover:opacity-80"
                                style={{ background: 'rgba(251,44,54,0.1)', color: '#ff6467' }}
                            >
                                <Trash2 className="w-4 h-4" />
                                {c.deleteButton}
                            </button>
                        </div>
                    </div>
                )
            })}

            {totalPages > 1 && (
                <div className="flex justify-center py-6 border-t border-white/[0.08] mt-2">
                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
                </div>
            )}
        </div>
    )
}
