'use client'

import { Eye, Trash2, Users } from 'lucide-react'
import { TablePagination } from '@/components/ui/table-pagination'
import { TableEmptyState } from '@/components/ui/table-empty-state'
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
    onLimitChange?: (limit: number) => void
}

export function CustomersCardList({ records, total, page, limit, onSelect, onDelete, onPageChange, onLimitChange }: Props) {
    const { t } = useI18n()
    const c = t.dashboard.customers

    if (records.length === 0) {
        return <TableEmptyState icon={<Users />} title={c.empty} />
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
                        className="rounded-[16px] overflow-hidden cursor-pointer active:opacity-80 transition-opacity"
                        style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                    >
                        {/* Card body */}
                        <div className="flex flex-col gap-[10px] px-[17px] pt-[17px] pb-[14px]">
                            {/* Avatar + Name */}
                            <div className="flex items-center gap-3">
                                <CustomerAvatar name={record.name} email={record.email} source={record.source} size={40} />
                                <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{displayName}</span>
                            </div>

                            {/* Email | Date */}
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] truncate" style={{ color: 'var(--dash-text-muted)' }}>{record.email}</span>
                                <span className="text-[12px] shrink-0 ml-2" style={{ color: 'var(--dash-text-muted)' }}>
                                    {new Date(record.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>

                            {/* Source | Status */}
                            <div className="flex items-center justify-between">
                                <CustomerSourceBadge source={record.source} />
                                <CustomerStatusBadge status={record.status} />
                            </div>

                            {/* Message preview */}
                            <p className="text-[12px] truncate" style={{ color: 'var(--dash-text-muted)' }}>
                                {record.message ?? c.defaultMessage}
                            </p>
                        </div>

                        {/* Actions */}
                        <div
                            className="flex gap-2 px-[17px] py-[10px]"
                            style={{ borderTop: '1px solid var(--dash-border)' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => onSelect(record)}
                                className="flex items-center justify-center gap-2 flex-1 h-[37px] rounded-[12px] text-[14px] font-medium border-none cursor-pointer transition-opacity hover:opacity-80"
                                style={{ background: 'hsl(var(--success)/0.1)', color: 'hsl(var(--success))' }}
                            >
                                <Eye className="w-4 h-4" />
                                {c.view}
                            </button>
                            <button
                                onClick={() => onDelete(record)}
                                className="flex items-center justify-center gap-2 flex-1 h-[37px] rounded-[12px] text-[14px] font-medium border-none cursor-pointer transition-opacity hover:opacity-80"
                                style={{ background: 'hsl(var(--destructive)/0.1)', color: 'hsl(var(--destructive))' }}
                            >
                                <Trash2 className="w-4 h-4" />
                                {c.deleteButton}
                            </button>
                        </div>
                    </div>
                )
            })}

            {total > 0 && (
                <div className="pt-4" style={{ borderTop: '1px solid var(--dash-border)' }}>
                    <TablePagination
                        page={page}
                        total={total}
                        limit={limit}
                        onPageChange={onPageChange}
                        onLimitChange={onLimitChange}
                    />
                </div>
            )}
        </div>
    )
}
