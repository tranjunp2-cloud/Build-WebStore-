'use client'

import { ArrowLeft, UndoDot } from 'lucide-react'
import { DiscountStatusBadge } from './discount-status-badge'
import { fmtDate } from '@/lib/discounts/format'
import { useI18n } from '@/i18n'

interface DiscountFormHeaderProps {
    isNew: boolean
    code?: string
    status?: string
    startsAt?: string | null
    expiresAt?: string | null
    usageLimit?: number | null
    usageCount?: number | null
    id?: string
    createdAt?: string
    tenantName?: string
    dirty: boolean
    onBack: () => void
    onRevert: () => void
}

export function DiscountFormHeader({
    isNew,
    code,
    status,
    startsAt,
    expiresAt,
    usageLimit,
    usageCount,
    id,
    createdAt,
    tenantName,
    dirty,
    onBack,
    onRevert,
}: DiscountFormHeaderProps) {
    const { t, ti } = useI18n()
    const d = t.dashboard.discounts.header

    const discountIdChip = id ? `disc_${String(id).padStart(5, '0')}` : null

    return (
        <div className="flex flex-col gap-0">
            {/* Main header row — GH-1511 #36: theo chuẩn Add Product (ProductForm.tsx):
                ArrowLeft h-6 trần + h1 24px font-outfit + sub-line 14px foreground/60.
                Bỏ bar border-b (Add Product không có); giữ badge/meta riêng của discount. */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <button
                        onClick={onBack}
                        className="flex shrink-0 items-center justify-center text-foreground hover:text-foreground/80 transition-colors border-none bg-transparent p-0 cursor-pointer"
                        title={d.backTitle}
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>

                    <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-[24px] font-bold font-outfit text-foreground leading-[1.33] m-0 truncate">
                                {isNew ? d.createTitle : (code ?? d.defaultTitle)}
                            </h1>
                            {!isNew && status && (
                                <DiscountStatusBadge
                                    status={status}
                                    startsAt={startsAt}
                                    expiresAt={expiresAt}
                                    usageLimit={usageLimit}
                                    usageCount={usageCount}
                                />
                            )}
                        </div>

                        {/* Meta row */}
                        {!isNew && discountIdChip ? (
                            <div className="flex items-center gap-1.5 text-[14px] text-foreground/60 leading-[1.43]">
                                <span
                                    className="font-mono px-1 py-0.5 rounded text-[12px]"
                                    style={{ background: 'var(--dash-surface-hover)' }}
                                >
                                    {discountIdChip}
                                </span>
                                {createdAt && (
                                    <>
                                        <span>·</span>
                                        <span>{ti(d.createdOn, { date: fmtDate(createdAt) })}</span>
                                    </>
                                )}
                            </div>
                        ) : isNew && tenantName ? (
                            <p className="text-[14px] text-foreground/60 leading-[1.43] m-0">
                                {ti(d.newCode, { tenantName })}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Dirty bar */}
            {/* Unsaved-changes bar — Edit only. On Create there's nothing saved yet,
                so "unsaved changes" + Revert don't apply (use footer Cancel/Save). */}
            {dirty && !isNew && (
                <div
                    className="flex items-center justify-between gap-4 px-6 py-2 mt-4 text-sm rounded-[10px]"
                    style={{ background: 'hsl(var(--warning)/0.08)', border: '1px solid hsl(var(--warning)/0.2)', color: 'hsl(var(--warning))' }}
                >
                    <span>{d.unsavedChanges}</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onRevert}
                            className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors"
                            style={{ color: 'hsl(var(--warning))', background: 'hsl(var(--warning)/0.12)' }}
                        >
                            <UndoDot className="h-3 w-3" />
                            {d.revert}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
