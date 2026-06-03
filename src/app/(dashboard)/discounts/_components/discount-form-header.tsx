'use client'

import { ArrowLeft, Trash2, UndoDot, Check } from 'lucide-react'
import { DiscountStatusBadge } from './discount-status-badge'
import { fmtDate } from '@/lib/discounts/format'

interface DiscountFormHeaderProps {
    isNew: boolean
    code?: string
    status?: string
    id?: string
    createdAt?: string
    tenantName?: string
    saving: boolean
    dirty: boolean
    onBack: () => void
    onSave: () => void
    onRevert: () => void
    onDelete?: () => void
}

export function DiscountFormHeader({
    isNew,
    code,
    status,
    id,
    createdAt,
    tenantName,
    saving,
    dirty,
    onBack,
    onSave,
    onRevert,
    onDelete,
}: DiscountFormHeaderProps) {
    const discountIdChip = id ? `disc_${String(id).padStart(5, '0')}` : null

    return (
        <div className="flex flex-col gap-0">
            {/* Main header row */}
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b" style={{ borderColor: 'var(--dash-border)' }}>
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={onBack}
                        className="flex items-center justify-center h-8 w-8 rounded-md transition-colors shrink-0"
                        style={{ color: 'var(--dash-text-muted)', background: 'rgba(255,255,255,0.04)' }}
                        title="Back to discounts"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>

                    <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                            <h1
                                className="text-[15px] font-semibold truncate"
                                style={{ color: 'var(--dash-text)' }}
                            >
                                {isNew ? 'Create discount' : (code ?? 'Discount')}
                            </h1>
                            {!isNew && status && <DiscountStatusBadge status={status} />}
                        </div>

                        {/* Meta row */}
                        {!isNew && discountIdChip ? (
                            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--dash-text-muted)' }}>
                                <span
                                    className="font-mono px-1 py-0.5 rounded text-[10px]"
                                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--dash-text-muted)' }}
                                >
                                    {discountIdChip}
                                </span>
                                {createdAt && (
                                    <>
                                        <span>·</span>
                                        <span>Created {fmtDate(createdAt)}</span>
                                    </>
                                )}
                            </div>
                        ) : isNew && tenantName ? (
                            <p className="text-[11px]" style={{ color: 'var(--dash-text-muted)' }}>
                                New code · {tenantName}
                            </p>
                        ) : null}
                    </div>
                </div>

                {!isNew && onDelete && (
                    <button
                        onClick={onDelete}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border transition-colors disabled:opacity-50 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10"
                        style={{ color: 'var(--dash-text-muted)', borderColor: 'var(--dash-border)', background: 'transparent' }}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                    </button>
                )}
            </div>

            {/* Dirty bar */}
            {dirty && (
                <div
                    className="flex items-center justify-between gap-4 px-6 py-2 text-sm"
                    style={{ background: 'rgba(234,179,8,0.08)', borderBottom: '1px solid rgba(234,179,8,0.2)', color: 'rgb(234,179,8)' }}
                >
                    <span>You have unsaved changes.</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onRevert}
                            className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors"
                            style={{ color: 'rgb(234,179,8)', background: 'rgba(234,179,8,0.12)' }}
                        >
                            <UndoDot className="h-3 w-3" />
                            Revert
                        </button>
                        <button
                            onClick={onSave}
                            disabled={saving}
                            className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
                            style={{ background: 'var(--brand, #14b8a6)', color: '#fff' }}
                        >
                            <Check className="h-3 w-3" />
                            Save
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
