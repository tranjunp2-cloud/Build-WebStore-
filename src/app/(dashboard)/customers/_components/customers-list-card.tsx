'use client'

import type { ReactNode } from 'react'
import { Phone, ShoppingBag } from 'lucide-react'
import { useI18n } from '@/i18n'
import { RankBadge, CustomerAvatar } from './customers-shared-ui'
import { Badge } from '@/components/ui/badge'
import type { ShopCustomerRecord } from '../_lib/shop-customer-record'
import { formatRelativeDate } from '../_lib/relative-time'

/** Tablet/mobile (<lg) card list for the shop-customers table.
 *  Desktop (>=lg) keeps the original <Table>; this view avoids the
 *  horizontal scroll that a 760px-min table causes on iPad portrait. */

type Props = {
    records: ShopCustomerRecord[]
    loading: boolean
    onRowClick: (id: number) => void
    /** Same pagination node rendered under the desktop table. */
    footer?: ReactNode
}

function SkeletonCard() {
    return (
        <div className="rounded-[16px] p-[17px]" style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/[0.06] animate-pulse shrink-0" />
                <div className="flex flex-col gap-2">
                    <div className="h-3 w-32 rounded bg-white/[0.06] animate-pulse" />
                    <div className="h-3 w-24 rounded bg-white/[0.06] animate-pulse" />
                </div>
            </div>
        </div>
    )
}

export function CustomersListCards({ records, loading, onRowClick, footer }: Props) {
    const { t } = useI18n()
    const tb = t.dashboard.shopCustomers.table

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
            </div>
        )
    }

    return (
        // 1 col on mobile, 2 cols from md (tablet) so the wide iPad width isn't a single sparse column.
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
            {records.map((c) => (
                <div
                    key={c.id}
                    onClick={() => onRowClick(c.id)}
                    className="rounded-[16px] px-[17px] py-[14px] cursor-pointer active:opacity-80 transition-opacity"
                    style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                >
                    {/* Avatar + name + rank */}
                    <div className="flex items-center gap-3">
                        <CustomerAvatar name={c.name} email={c.email} size={40} square />
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--dash-text)' }}>
                                {c.name || c.email || '—'}
                            </span>
                            <span className="text-[12px] truncate" style={{ color: 'var(--dash-text-muted)' }}>
                                {c.email ?? '—'}
                            </span>
                        </div>
                        {c.rank
                            ? <RankBadge rank={c.rank} />
                            : <Badge variant="secondary" className="rounded-full shrink-0">{tb.unranked}</Badge>}
                    </div>

                    {/* Phone | orders | last order */}
                    <div className="flex items-center justify-between gap-2 mt-3 text-[12px]" style={{ color: 'var(--dash-text-muted)' }}>
                        <span className="inline-flex items-center gap-1.5 font-mono truncate">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            {c.phone || '—'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 shrink-0">
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span className="tabular-nums" style={{ color: 'var(--dash-text)' }}>{c.orderCount}</span>
                        </span>
                        <span className="shrink-0">
                            {c.latestOrderAt ? formatRelativeDate(c.latestOrderAt, tb) : '—'}
                        </span>
                    </div>
                </div>
            ))}

            {footer && (
                <div className="pt-3 md:col-span-2">
                    {footer}
                </div>
            )}
        </div>
    )
}
