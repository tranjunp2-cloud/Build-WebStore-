'use client'

import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import { ChevronDown, Download, Award, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { TableSearch } from '@/components/ui/table-search'
import { RankBadge } from './customers-shared-ui'
import type { ShopCustomerRecord } from '../_lib/shop-customer-record'

export type RankFilter = 'all' | 'vip' | 'gold' | 'silver' | 'bronze' | 'none'
export type DateFilter = 'any' | 'today' | 'last7d' | 'last30d' | 'last90d' | 'thisYear' | 'customRange'

type DropdownOption<T extends string> = { key: T; label: string; count?: number; badge?: ReactNode }

function FilterChip<T extends string>({
    value,
    options,
    onChange,
    active,
    prefix,
    icon,
}: {
    value: T
    options: DropdownOption<T>[]
    onChange: (v: T) => void
    active: boolean
    prefix: string
    icon: ReactNode
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const selected = options.find(o => o.key === value) ?? options[0]!

    useEffect(() => {
        if (!open) return
        function onMouseDown(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onMouseDown)
        return () => document.removeEventListener('mousedown', onMouseDown)
    }, [open])

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] font-medium transition-colors cursor-pointer"
                style={{
                    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                    border: active ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--dash-border)',
                    color: active ? '#60a5fa' : 'var(--dash-text-muted)',
                }}
            >
                {icon}
                <span>
                    <span style={{ color: 'var(--dash-text-muted)' }}>{prefix}: </span>
                    {selected!.label}
                </span>
                <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div
                    className="absolute top-[calc(100%+4px)] left-0 min-w-[160px] z-50 rounded-[12px] overflow-hidden"
                    style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                >
                    {options.map(o => (
                        <button
                            key={o.key}
                            type="button"
                            onClick={() => { onChange(o.key); setOpen(false) }}
                            className="w-full px-4 py-[10px] flex items-center justify-between text-left text-[13px] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer"
                            style={{ color: o.key === value ? 'var(--dash-text)' : 'var(--dash-text-muted)' }}
                        >
                            {o.badge ?? <span className={o.key === value ? 'font-medium' : ''}>{o.label}</span>}
                            {o.count !== undefined && (
                                <span className="text-[12px] ml-3" style={{ color: 'var(--dash-text-muted)' }}>{o.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

const DATE_INPUT_CLS = 'h-8 px-2 rounded-[6px] text-[12px] outline-none transition-colors w-full'

function DateFilterChip({
    value,
    onChange,
    customFrom,
    customTo,
    onCustomRangeApply,
    dateOptions,
    fromLabel,
    toLabel,
    applyLabel,
    datePrefix,
}: {
    value: DateFilter
    onChange: (d: DateFilter) => void
    customFrom: string
    customTo: string
    onCustomRangeApply: (from: string, to: string) => void
    dateOptions: DropdownOption<DateFilter>[]
    fromLabel: string
    toLabel: string
    applyLabel: string
    datePrefix: string
}) {
    const [open, setOpen] = useState(false)
    const [localFrom, setLocalFrom] = useState(customFrom)
    const [localTo, setLocalTo] = useState(customTo)
    const ref = useRef<HTMLDivElement>(null)
    const active = value !== 'any'
    const selected = dateOptions.find(o => o.key === value) ?? dateOptions[0]!

    useEffect(() => {
        setLocalFrom(customFrom)
        setLocalTo(customTo)
    }, [customFrom, customTo])

    useEffect(() => {
        if (!open) return
        function onMouseDown(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onMouseDown)
        return () => document.removeEventListener('mousedown', onMouseDown)
    }, [open])

    const chipLabel = value === 'customRange' && customFrom && customTo
        ? `${customFrom} – ${customTo}`
        : selected.label

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] font-medium transition-colors cursor-pointer"
                style={{
                    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                    border: active ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--dash-border)',
                    color: active ? '#60a5fa' : 'var(--dash-text-muted)',
                }}
            >
                <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--dash-text-muted)' }} />
                <span>
                    <span style={{ color: 'var(--dash-text-muted)' }}>{datePrefix}: </span>
                    {chipLabel}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div
                    className="absolute top-[calc(100%+4px)] left-0 min-w-[180px] z-50 rounded-[12px] overflow-hidden"
                    style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                >
                    {dateOptions.filter(o => o.key !== 'customRange').map(o => (
                        <button
                            key={o.key}
                            type="button"
                            onClick={() => { onChange(o.key); setOpen(false) }}
                            className="w-full px-4 py-[10px] text-left text-[13px] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer"
                            style={{ color: o.key === value ? 'var(--dash-text)' : 'var(--dash-text-muted)', fontWeight: o.key === value ? 500 : 400 }}
                        >
                            {o.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => onChange('customRange')}
                        className="w-full px-4 py-[10px] text-left text-[13px] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer"
                        style={{
                            color: value === 'customRange' ? '#60a5fa' : 'var(--dash-text-muted)',
                            fontWeight: value === 'customRange' ? 500 : 400,
                            borderTop: '1px solid var(--dash-border)',
                        }}
                    >
                        {dateOptions.find(o => o.key === 'customRange')?.label}
                    </button>
                    {value === 'customRange' && (
                        <div className="px-4 pb-3 pt-2 space-y-2" style={{ borderTop: '1px solid var(--dash-border)' }}>
                            <div className="flex flex-col gap-1">
                                <label className="text-[11px]" style={{ color: 'var(--dash-text-muted)' }}>{fromLabel}</label>
                                <input
                                    type="date"
                                    value={localFrom}
                                    onChange={e => setLocalFrom(e.target.value)}
                                    className={DATE_INPUT_CLS}
                                    style={{
                                        background: 'var(--dash-surface-hover)',
                                        border: '1px solid var(--dash-border)',
                                        color: 'var(--dash-text)',
                                    }}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[11px]" style={{ color: 'var(--dash-text-muted)' }}>{toLabel}</label>
                                <input
                                    type="date"
                                    value={localTo}
                                    onChange={e => setLocalTo(e.target.value)}
                                    className={DATE_INPUT_CLS}
                                    style={{
                                        background: 'var(--dash-surface-hover)',
                                        border: '1px solid var(--dash-border)',
                                        color: 'var(--dash-text)',
                                    }}
                                />
                            </div>
                            <button
                                type="button"
                                disabled={!localFrom || !localTo || localFrom > localTo}
                                onClick={() => { onCustomRangeApply(localFrom, localTo); setOpen(false) }}
                                className="w-full h-8 rounded-[6px] text-[12px] font-medium border-none cursor-pointer disabled:opacity-40"
                                style={{ background: 'linear-gradient(90deg,#3b82f6 0%,#2dd4bf 100%)', color: '#fff' }}
                            >
                                {applyLabel}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

type Props = {
    search: string
    onSearch: (q: string) => void
    rankFilter: RankFilter
    onRankFilterChange: (r: RankFilter) => void
    dateFilter: DateFilter
    onDateFilterChange: (d: DateFilter) => void
    customFrom: string
    customTo: string
    onCustomRangeApply: (from: string, to: string) => void
    onExport: () => void
    exporting: boolean
    records: ShopCustomerRecord[]
}

export function CustomersListToolbar({
    search,
    onSearch,
    rankFilter,
    onRankFilterChange,
    dateFilter,
    onDateFilterChange,
    customFrom,
    customTo,
    onCustomRangeApply,
    onExport,
    exporting,
    records,
}: Props) {
    const { t } = useI18n()
    const tb = t.dashboard.shopCustomers.toolbar

    const rankCounts = useMemo(() => {
        const c: Record<string, number> = { all: records.length, none: 0, bronze: 0, silver: 0, gold: 0, vip: 0 }
        for (const r of records) {
            if (!r.rank) c.none++
            else c[r.rank] = (c[r.rank] ?? 0) + 1
        }
        return c
    }, [records])

    const unrankedBadge = (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold"
            style={{ background: 'rgba(107,114,128,0.08)', color: 'var(--dash-text-muted)', border: '1px solid rgba(107,114,128,0.20)' }}
        >
            {tb.unranked}
        </span>
    )

    const RANK_OPTIONS: DropdownOption<RankFilter>[] = [
        { key: 'all',    label: tb.allRanks,  count: rankCounts.all },
        { key: 'vip',    label: 'VIP',        count: rankCounts.vip,    badge: <RankBadge rank="vip" /> },
        { key: 'gold',   label: 'Gold',       count: rankCounts.gold,   badge: <RankBadge rank="gold" /> },
        { key: 'silver', label: 'Silver',     count: rankCounts.silver, badge: <RankBadge rank="silver" /> },
        { key: 'bronze', label: 'Bronze',     count: rankCounts.bronze, badge: <RankBadge rank="bronze" /> },
        { key: 'none',   label: tb.unranked,  count: rankCounts.none,   badge: unrankedBadge },
    ]

    const DATE_OPTIONS: DropdownOption<DateFilter>[] = [
        { key: 'any',         label: tb.dateAny },
        { key: 'today',       label: tb.dateToday },
        { key: 'last7d',      label: tb.dateLast7d },
        { key: 'last30d',     label: tb.dateLast30d },
        { key: 'last90d',     label: tb.dateLast90d },
        { key: 'thisYear',    label: tb.dateThisYear },
        { key: 'customRange', label: tb.dateCustomRange },
    ]

    return (
        <div className="flex flex-wrap items-center gap-2">
            <TableSearch
                value={search}
                onSearch={onSearch}
                placeholder={tb.searchPlaceholder}
                className="flex-1 min-w-[200px]"
            />

            <FilterChip<RankFilter>
                value={rankFilter}
                options={RANK_OPTIONS}
                onChange={onRankFilterChange}
                active={rankFilter !== 'all'}
                prefix={tb.rankPrefix}
                icon={<Award className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--dash-text-muted)' }} />}
            />

            <DateFilterChip
                value={dateFilter}
                onChange={onDateFilterChange}
                customFrom={customFrom}
                customTo={customTo}
                onCustomRangeApply={onCustomRangeApply}
                dateOptions={DATE_OPTIONS}
                fromLabel={tb.from}
                toLabel={tb.to}
                applyLabel={tb.apply}
                datePrefix={tb.datePrefix}
            />

            <div className="flex-1" />

            <Button variant="dashSecondary" size="dash" onClick={onExport} disabled={exporting} className="shrink-0">
                <Download className="w-4 h-4" />
                {exporting ? tb.exporting : tb.exportCsv}
            </Button>
        </div>
    )
}
