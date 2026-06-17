'use client'

import { Trash2, Users } from 'lucide-react'
import { useI18n } from '@/i18n'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import { CustomerAvatar } from './customer-avatar'
import { CustomerStatusBadge } from './customer-status-badge'
import { CustomerSourceBadge } from './customer-source-badge'
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    TableActionButton,
} from '@/components/ui/table'
import { TablePagination } from '@/components/ui/table-pagination'
import type { CustomerRecord } from '../_lib/customer-record'

type Props = {
    records: CustomerRecord[]
    loading?: boolean
    total: number
    page: number
    limit: number
    selectedId: string | null
    onSelect: (record: CustomerRecord) => void
    onDelete: (record: CustomerRecord) => void
    onPageChange: (page: number) => void
}

function SkeletonRow() {
    return (
        <TableRow>
            <TableCell>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full animate-pulse shrink-0" style={{ background: 'var(--dash-border)' }} />
                    <div className="h-3 w-28 rounded animate-pulse" style={{ background: 'var(--dash-border)' }} />
                </div>
            </TableCell>
            <TableCell><div className="h-3 w-32 rounded animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
            <TableCell><div className="h-5 w-20 rounded-full animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
            <TableCell><div className="h-3 w-40 rounded animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
            <TableCell><div className="h-3 w-20 rounded animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
            <TableCell><div className="h-5 w-16 rounded-full animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
            <TableCell><div className="h-8 w-8 rounded-[8px] animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
        </TableRow>
    )
}

export function CustomersTable({ records, loading = false, total, page, limit, selectedId, onSelect, onDelete, onPageChange }: Props) {
    const { t } = useI18n()
    const c = t.dashboard.customers

    const footer = !loading && total > 0
        ? (
            <TablePagination
                page={page}
                total={total}
                limit={limit}
                onPageChange={onPageChange}
            />
        )
        : undefined

    if (!loading && records.length === 0) {
        return (
            <TableEmptyState icon={<Users />} title={c.empty} />
        )
    }

    return (
        <Table minWidth={780} className="table-fixed w-full" footer={footer}>
            {/* table-fixed + % colgroup: even, stable columns. Message (lead text) is
                widest; Actions stays compact at the edge. */}
            <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '21%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '6%' }} />
            </colgroup>
            <TableHeader>
                <TableRow>
                    <TableHead>{c.colProfile}</TableHead>
                    <TableHead>{c.colEmail}</TableHead>
                    <TableHead>{c.colSource}</TableHead>
                    <TableHead>{c.colMessage}</TableHead>
                    <TableHead>{c.colDate}</TableHead>
                    <TableHead>{c.colStatus}</TableHead>
                    <TableHead>{c.colActions}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)
                    : records.map(record => {
                        const displayName = record.source === 'newsletter'
                            ? (record.name ?? 'Guest') + ' (Newsletter)'
                            : (record.name ?? 'Guest')

                        return (
                            <TableRow
                                key={record.id}
                                onClick={() => onSelect(record)}
                                clickable
                                style={selectedId === record.id
                                    ? { background: 'var(--dash-border)' }
                                    : undefined
                                }
                            >
                                {/* Profile */}
                                <TableCell>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <CustomerAvatar name={record.name} email={record.email} source={record.source} />
                                        <span title={displayName} className="text-[13px] font-semibold truncate max-w-[140px]" style={{ color: 'var(--dash-text)' }}>
                                            {displayName}
                                        </span>
                                    </div>
                                </TableCell>

                                {/* Email */}
                                <TableCell>
                                    <span title={record.email} className="text-[13px] truncate block max-w-[180px]" style={{ color: 'var(--dash-text-muted)' }}>
                                        {record.email}
                                    </span>
                                </TableCell>

                                {/* Source */}
                                <TableCell>
                                    <CustomerSourceBadge source={record.source} />
                                </TableCell>

                                {/* Message */}
                                <TableCell>
                                    <span title={record.message ?? c.defaultMessage} className="text-[13px] truncate block max-w-[280px]" style={{ color: 'var(--dash-text-muted)' }}>
                                        {record.message ?? c.defaultMessage}
                                    </span>
                                </TableCell>

                                {/* Date */}
                                <TableCell className="whitespace-nowrap">
                                    <span className="text-[12px]" style={{ color: 'var(--dash-text-muted)' }}>
                                        {new Date(record.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </TableCell>

                                {/* Status */}
                                <TableCell>
                                    <CustomerStatusBadge status={record.status} />
                                </TableCell>

                                {/* Actions — stop propagation so row click doesn't fire */}
                                <TableCell onClick={e => e.stopPropagation()}>
                                    <TableActionButton
                                        variant="danger"
                                        onClick={() => onDelete(record)}
                                        title={c.deleteButton}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </TableActionButton>
                                </TableCell>
                            </TableRow>
                        )
                    })
                }
            </TableBody>
        </Table>
    )
}
