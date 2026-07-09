'use client'

import { Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/i18n'
import type { ShopCustomerRecord, AddressRecord } from '../_lib/shop-customer-record'
import type { EditableFields } from './customers-detail'

// Radix SelectItem rejects an empty-string value — sentinel for "no rank" (same convention as CategoryManager.tsx).
const RANK_UNRANKED_VALUE = '__none__'

const INPUT_CLS = 'h-10 px-3 rounded-[8px] border border-[var(--cus-border-medium)] bg-[var(--cus-surface-input)] text-[14px] text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary)/0.4)] transition-colors w-full'
const INPUT_READONLY_CLS = 'h-10 px-3 rounded-[8px] border border-white/[0.04] bg-white/[0.02] text-[14px] font-mono text-white/40 w-full flex items-center select-all cursor-default'
const TEXTAREA_CLS = 'px-3 py-2.5 rounded-[8px] border border-[var(--cus-border-medium)] bg-[var(--cus-surface-input)] text-[14px] text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary)/0.4)] transition-colors w-full resize-none'
const LABEL_CLS = 'text-[12px] font-semibold [color:var(--cus-text-secondary)]'
const HELP_CLS = 'text-[11px] [color:var(--cus-text-muted)]'
const ERROR_CLS = 'text-[11px] text-[hsl(var(--destructive))] flex items-center gap-1'

type Props = {
    draft: ShopCustomerRecord
    onChange: (updates: Partial<EditableFields>) => void
    errors: Record<string, string>
    original: ShopCustomerRecord
}

function fmtDateTime(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-MY', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    })
}

function fmtCurrency(v: number): string {
    return 'RM ' + v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildAddressDisplay(addr?: AddressRecord): string {
    if (!addr) return ''
    return [addr.line1, addr.line2, addr.city, addr.state, addr.postcode, addr.country]
        .filter(Boolean)
        .join(', ')
}

export function CustomersDetailDefaultTab({ draft, onChange, errors, original }: Props) {
    const { t } = useI18n()
    const cd = t.dashboard.shopCustomers.detail
    const RANKS = [
        { id: 'vip',    label: cd.rankVip      },
        { id: 'gold',   label: cd.rankGold     },
        { id: 'silver', label: cd.rankSilver   },
        { id: 'bronze', label: cd.rankBronze   },
        { id: '',       label: cd.rankUnranked },
    ] as const
    const addressValue = buildAddressDisplay(draft.addresses[0])

    return (
        <TooltipProvider delayDuration={200}>
        {/* 2-col (form + 300px stats) only from xl — at iPad Pro (≤1279) the content with the sidebar
            open (~710px) is too narrow for 1fr+300px, so stack to 1 col below xl. */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
            {/* Left: form card */}
            <div className="rounded-[16px] p-6" style={{ background: 'var(--cus-surface-card)', border: '1px solid var(--cus-border-medium)' }}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5">

                    {/* Email — read-only identity (col 1) */}
                    <div className="flex flex-col gap-1.5 pb-5" style={{ borderBottom: '1px solid var(--cus-border-medium)' }}>
                        <label className={LABEL_CLS}>{cd.fieldEmail} <span style={{ color: 'hsl(var(--destructive))' }}>*</span></label>
                        <div className={INPUT_READONLY_CLS}>{draft.email}</div>
                        <span className={HELP_CLS}>{cd.fieldEmailHelp}</span>
                    </div>

                    {/* Name (col 2) */}
                    <div className="flex flex-col gap-1.5 pb-5" style={{ borderBottom: '1px solid var(--cus-border-medium)' }}>
                        <label className={LABEL_CLS}>{cd.fieldName} <span style={{ color: 'hsl(var(--destructive))' }}>*</span></label>
                        <input
                            type="text"
                            value={draft.name || ''}
                            onChange={e => onChange({ name: e.target.value })}
                            className={INPUT_CLS + (errors.name ? ' border-[hsl(var(--destructive)/0.5)]' : '')}
                            placeholder={cd.fieldNamePlaceholder}
                        />
                        {errors.name && <span className={ERROR_CLS}>{errors.name}</span>}
                    </div>

                    {/* Phone — read-only, synced from latest order */}
                    <div className="flex flex-col gap-1.5 pb-5" style={{ borderBottom: '1px solid var(--cus-border-medium)' }}>
                        <label className={LABEL_CLS}>{cd.fieldPhone}</label>
                        <div className={INPUT_READONLY_CLS}>{draft.phone || '—'}</div>
                        <span className={HELP_CLS}>{cd.fieldPhoneHelp}</span>
                    </div>

                    {/* Rank — shared ui/select.tsx (Radix, DS-consistent); side="bottom" + avoidCollisions={false}
                        keeps it always opening downward so it never flips up and disrupts the form layout. */}
                    <div className="flex flex-col gap-1.5 pb-5" style={{ borderBottom: '1px solid var(--cus-border-medium)' }}>
                        <label className={LABEL_CLS}>{cd.fieldRank}</label>
                        <Select
                            value={draft.rank || RANK_UNRANKED_VALUE}
                            onValueChange={v => onChange({ rank: (v === RANK_UNRANKED_VALUE ? null : v) as ShopCustomerRecord['rank'] })}
                        >
                            <SelectTrigger className={INPUT_CLS + ' cursor-pointer data-[state=open]:border-[hsl(var(--primary))]'}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent side="bottom" align="start" avoidCollisions={false} style={{ background: 'var(--cus-surface-dropdown)' }}>
                                {RANKS.map(r => (
                                    <SelectItem key={r.id || RANK_UNRANKED_VALUE} value={r.id || RANK_UNRANKED_VALUE}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className={HELP_CLS}>{cd.fieldRankHelp}</span>
                    </div>

                    {/* Address — read-only, synced from order shippingAddress */}
                    <div className="flex flex-col gap-1.5 pb-5" style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--cus-border-medium)' }}>
                        <label className={LABEL_CLS}>{cd.fieldAddress}</label>
                        <div
                            className="px-3 py-2.5 rounded-[8px] border border-white/[0.04] bg-white/[0.02] text-[14px] text-white/40 w-full min-h-[42px]"
                            style={{ fontFamily: 'inherit', lineHeight: 1.6 }}
                        >
                            {addressValue || '—'}
                        </div>
                        <span className={HELP_CLS}>{cd.fieldAddressHelp}</span>
                    </div>

                    {/* Notes */}
                    <div className="flex flex-col gap-1.5 pb-5" style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--cus-border-medium)' }}>
                        <label className={LABEL_CLS}>
                            {cd.fieldNotes}{' '}
                            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--cus-text-faint)' }}>{cd.fieldNotesInternal}</span>
                        </label>
                        <textarea
                            className={TEXTAREA_CLS}
                            rows={5}
                            value={draft.notes || ''}
                            onChange={e => onChange({ notes: e.target.value || null })}
                            placeholder={cd.fieldNotesPlaceholder}
                        />
                    </div>

                    {/* Read-only date + ID fields */}
                    <div className="flex flex-col gap-1.5 pb-5" style={{ borderBottom: '1px solid var(--cus-border-medium)' }}>
                        <label className={LABEL_CLS + ' flex items-center gap-1'}>
                            {cd.fieldLatestOrder}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex cursor-default"><Info className="w-3 h-3 text-white/30 shrink-0" /></span>
                                </TooltipTrigger>
                                <TooltipContent>{cd.fieldLatestOrderTooltip}</TooltipContent>
                            </Tooltip>
                        </label>
                        <div className={INPUT_READONLY_CLS}>{fmtDateTime(original.latestOrderAt)}</div>
                    </div>

                    <div className="flex flex-col gap-1.5 pb-5" style={{ borderBottom: '1px solid var(--cus-border-medium)' }}>
                        <label className={LABEL_CLS + ' flex items-center gap-1'}>
                            {cd.fieldOldestOrder}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex cursor-default"><Info className="w-3 h-3 text-white/30 shrink-0" /></span>
                                </TooltipTrigger>
                                <TooltipContent>{cd.fieldOldestOrderTooltip}</TooltipContent>
                            </Tooltip>
                        </label>
                        <div className={INPUT_READONLY_CLS}>{fmtDateTime(original.firstOrderAt)}</div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className={LABEL_CLS}>{cd.fieldLastUpdated}</label>
                        <div className={INPUT_READONLY_CLS}>{fmtDateTime(original.updatedAt)}</div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className={LABEL_CLS}>{cd.fieldCustomerId}</label>
                        <div className={INPUT_READONLY_CLS}>{`cus_${String(original.id).padStart(6, '0')}`}</div>
                    </div>

                </div>
            </div>

            {/* Right: stats rail */}
            <div className="flex flex-col gap-4 sticky top-4">
                {/* Stats card */}
                <div className="rounded-[14px] overflow-hidden" style={{ background: 'var(--cus-surface-card)', border: '1px solid var(--cus-border-medium)' }}>
                    {[
                        { k: cd.statTotalOrder,    v: String(original.orderCount) },
                        { k: cd.statTotalSpending, v: fmtCurrency(original.lifetime) },
                        { k: cd.statCompleteRate,  v: `${original.completedRate}%` },
                        { k: cd.statFailedRate,    v: `${original.failedRate}%` },
                    ].map(({ k, v }, i) => (
                        <div
                            key={k}
                            className="flex flex-col gap-1 px-4 py-3"
                            style={{ borderTop: i > 0 ? '1px solid var(--cus-border-subtle)' : undefined }}
                        >
                            <span className="text-[11px] font-bold uppercase tracking-wide text-white/35">{k}</span>
                            <span className="text-[20px] font-bold tabular-nums text-foreground">{v}</span>
                        </div>
                    ))}
                </div>

                {/* Auto-link info box */}
                <div className="rounded-[14px] px-4 py-3" style={{ background: 'var(--cus-surface-info)', border: '1px solid var(--cus-border-medium)' }}>
                    <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/45 mb-2">
                        <Info className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(var(--info))' }} />
                        {cd.autoLinkTitle}
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--cus-text-faint)', lineHeight: 1.6 }}>
                        {cd.autoLinkBody.split('{hook}')[0]}
                        <code className="font-mono px-1 py-0.5 rounded-[3px]" style={{ fontSize: 11, background: 'var(--cus-code-bg)', color: 'var(--cus-code-fg)', border: '1px solid var(--cus-code-border)' }}>
                            autoLinkCustomer
                        </code>
                        {cd.autoLinkBody.split('{hook}')[1] ?? ''}
                    </p>
                </div>
            </div>
        </div>
        </TooltipProvider>
    )
}
