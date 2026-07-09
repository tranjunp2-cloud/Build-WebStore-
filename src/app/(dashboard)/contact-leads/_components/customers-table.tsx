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
    onLimitChange?: (limit: number) => void
}

function SkeletonRow() {
    return (
        <TableRow>
            {/* Customer (avatar) */}
            <TableCell>
                <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: 'var(--dash-border)' }} />
            </TableCell>
            {/* Profile (name) */}
            <TableCell><div className="h-3 w-28 rounded animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
            <TableCell><div className="h-3 w-32 rounded animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
            <TableCell><div className="h-5 w-20 rounded-full animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
            <TableCell><div className="h-3 w-40 rounded animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
            <TableCell><div className="h-3 w-20 rounded animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
            <TableCell><div className="h-5 w-16 rounded-full animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
            <TableCell><div className="h-8 w-8 rounded-[8px] animate-pulse" style={{ background: 'var(--dash-border)' }} /></TableCell>
        </TableRow>
    )
}

export function CustomersTable({ records, loading = false, total, page, limit, selectedId, onSelect, onDelete, onPageChange, onLimitChange }: Props) {
    const { t } = useI18n()
    const c = t.dashboard.customers

    const footer = !loading && total > 0
        ? (
            <TablePagination
                page={page}
                total={total}
                limit={limit}
                onPageChange={onPageChange}
                onLimitChange={onLimitChange}
            />
        )
        : undefined

    if (!loading && records.length === 0) {
        return (
            <TableEmptyState icon={<Users />} title={c.empty} subtitle={c.emptySubtitle} />
        )
    }

    // Matches /blog convention: `dash-table-compact` (globals.css) shrinks font+padding below xl
    // and NO min-w floor → table-fixed w-full shrinks to fit any iPad width (no horizontal scroll).
    // min-w only at desktop (>=1280) restores the original 780px floor → desktop byte-identical.
    return (
        <Table className="table-fixed w-full dash-table-compact min-[1280px]:min-w-[780px]" footer={footer}>
            {/* Responsive colgroup. The Profile column is split into Customer (avatar only) +
                Profile (name text). Customer stays narrow (fits the 32px avatar); the sum of
                Customer+Profile equals the old Profile width so every other column keeps its ratio.
                Below xl (iPad band, table ~756px) widths fit each nowrap header + content: Email +
                Message truncate (…); Source pill wraps (see badge); Date/Status hold nowrap badges.
                Sums to 100% → table-fixed w-full fits the viewport, no horizontal scroll. At >=1280px
                the desktop ratios are restored (6+12=18 / 18 / 12 / 21 / 12 / 13 / 6). */}
            <colgroup>
                <col className="w-[9%]  min-[1280px]:w-[7%]" />{/* Customer (avatar) */}
                <col className="w-[16%] min-[1280px]:w-[12%]" />{/* Profile (name)    */}
                <col className="w-[12%] min-[1280px]:w-[18%]" />{/* Email   */}
                <col className="w-[16%] min-[1280px]:w-[12%]" />{/* Source  */}
                <col className="w-[12%] min-[1280px]:w-[21%]" />{/* Message */}
                <col className="w-[13%] min-[1280px]:w-[12%]" />{/* Date    */}
                <col className="w-[14%] min-[1280px]:w-[13%]" />{/* Status  */}
                <col className="w-[8%]  min-[1280px]:w-[5%]" />{/* Actions */}
            </colgroup>
            <TableHeader>
                <TableRow>
                    <TableHead>{c.colCustomer}</TableHead>
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
                                {/* Customer (avatar) */}
                                <TableCell>
                                    <CustomerAvatar name={record.name} email={record.email} source={record.source} />
                                </TableCell>

                                {/* Profile (name) */}
                                <TableCell>
                                    <span title={displayName} className="text-[13px] font-semibold truncate block max-w-[140px]" style={{ color: 'var(--dash-text)' }}>
                                        {displayName}
                                    </span>
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
