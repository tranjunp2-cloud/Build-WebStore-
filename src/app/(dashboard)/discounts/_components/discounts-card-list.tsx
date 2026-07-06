'use client'

import type { ReactNode } from 'react'
import { Pencil, Trash2, Banknote, Percent } from 'lucide-react'
import { DiscountStatusBadge } from './discount-status-badge'
import { DiscountUsageMeter } from './discount-usage-meter'
import { fmtValue, fmtDate } from '@/lib/discounts/format'
import { useI18n } from '@/i18n'
import type { Discount } from './discounts-table'

/** Card list shown below xl (mobile / tablet / small-desktop) for the discounts
 *  table — matches the Blog/Orders breakpoint. Desktop (>=xl) keeps the original
 *  <Table>; this view avoids the 920px-min table's horizontal scroll. */

type Props = {
    discounts: Discount[]
    onEdit: (id: string) => void
    onDelete: (discount: Discount) => void
    /** Same pagination node rendered under the desktop table. */
    footer?: ReactNode
}

function TypeBadge({ type, fixedLabel, pctLabel }: { type: Discount['type']; fixedLabel: string; pctLabel: string }) {
    return type === 'fixed' ? (
        <span className="inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-[3px] text-[11px] font-semibold bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]">
            <Banknote className="w-3 h-3 shrink-0" />{fixedLabel}
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-[3px] text-[11px] font-semibold bg-[hsl(var(--info)/0.15)] text-[hsl(var(--info))]">
            <Percent className="w-3 h-3 shrink-0" />{pctLabel}
        </span>
    )
}

export function DiscountsCardList({ discounts, onEdit, onDelete, footer }: Props) {
    const { t } = useI18n()
    const d = t.dashboard.discounts.table

    return (
        // 1 col on mobile, 2 cols from md (tablet) so the wide iPad width isn't a single sparse column.
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
            {discounts.map((discount) => (
                <div
                    key={discount.id}
                    onClick={() => onEdit(discount.id)}
                    className="rounded-[16px] overflow-hidden cursor-pointer active:opacity-80 transition-opacity"
                    style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                >
                    <div className="flex flex-col gap-[10px] px-[17px] pt-[15px] pb-[13px]">
                        {/* Code chip + type badge */}
                        <div className="flex items-center justify-between gap-2">
                            <span
                                className="inline-flex w-fit items-center rounded-[4px] border px-2.5 py-[3px] font-mono text-[12px] font-semibold tracking-wide"
                                style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text)', borderColor: 'var(--dash-border)' }}
                            >
                                {discount.code}
                            </span>
                            <TypeBadge type={discount.type} fixedLabel={d.typeFixed} pctLabel={d.typePercentage} />
                        </div>

                        {/* Description — always render + reserve one line so cards
                            without a description keep the same height/layout (rows align). */}
                        <p className="text-[12px] leading-[16px] truncate min-h-[16px]" style={{ color: 'var(--dash-text-muted)' }}>
                            {discount.description || ''}
                        </p>

                        {/* Value | Status */}
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--dash-text)' }}>
                                {fmtValue(discount.type, discount.value)}
                            </span>
                            <DiscountStatusBadge
                                status={discount.status}
                                startsAt={discount.startsAt}
                                expiresAt={discount.expiresAt}
                                usageLimit={discount.usageLimit}
                                usageCount={discount.usageCount}
                            />
                        </div>

                        {/* Usage meter | Expires */}
                        <div className="flex items-center justify-between gap-2">
                            <DiscountUsageMeter count={discount.usageCount} limit={discount.usageLimit ?? null} />
                            <span className="text-[12px] whitespace-nowrap shrink-0" style={{ color: 'var(--dash-text-muted)' }}>
                                {fmtDate(discount.expiresAt)}
                            </span>
                        </div>
                    </div>

                    {/* Actions — no top divider (cleaner, continuous card) */}
                    <div
                        className="flex gap-2 px-[17px] pb-[13px]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => onEdit(discount.id)}
                            className="flex items-center justify-center gap-1.5 flex-1 min-w-0 h-[37px] px-2 rounded-[12px] text-[14px] font-medium border-none cursor-pointer transition-opacity hover:opacity-80"
                            style={{ background: 'hsl(var(--primary)/0.1)', color: 'hsl(var(--primary))' }}
                        >
                            <Pencil className="w-4 h-4 shrink-0" /><span className="truncate">{d.editTitle}</span>
                        </button>
                        <button
                            onClick={() => onDelete(discount)}
                            className="flex items-center justify-center gap-1.5 flex-1 min-w-0 h-[37px] px-2 rounded-[12px] text-[14px] font-medium border-none cursor-pointer transition-opacity hover:opacity-80"
                            style={{ background: 'hsl(var(--destructive)/0.1)', color: 'hsl(var(--destructive))' }}
                        >
                            <Trash2 className="w-4 h-4 shrink-0" /><span className="truncate">{d.deleteTitle}</span>
                        </button>
                    </div>
                </div>
            ))}

            {footer && (
                <div className="pt-1 md:col-span-2">
                    {footer}
                </div>
            )}
        </div>
    )
}
