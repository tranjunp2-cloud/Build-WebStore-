'use client'

import { ShieldCheck } from 'lucide-react'
import { fmtValue, fmtDate, MAX_FIXED_DISCOUNT_SEN } from '@/lib/discounts/format'
import { draftValueToStored } from '@/lib/discounts/draft-value'
import { DiscountUsageMeter } from './discount-usage-meter'
import { DiscountTypeBadge } from './discount-type-badge'
import type { DiscountDraft } from './discount-form-fields'
import { useI18n } from '@/i18n'

interface DiscountLivePreviewProps {
    draft: DiscountDraft
    tenantName?: string
    usageCount: number
    isNew: boolean
}

export function DiscountLivePreview({ draft, tenantName, usageCount, isNew }: DiscountLivePreviewProps) {
    const { t, ti } = useI18n()
    const d = t.dashboard.discounts.preview

    const stored = draftValueToStored(draft.type, draft.valueInput)
    // Guard against an over-cap fixed amount overflowing to 1e+ notation in the preview.
    const overCap = stored != null && draft.type === 'fixed' && stored > MAX_FIXED_DISCOUNT_SEN
    const valueDisplay = stored != null && !overCap ? fmtValue(draft.type, stored) : '—'
    const usageLimitNum = draft.usageLimit === '' ? null : Number(draft.usageLimit)

    const cardStyle = {
        background: 'var(--dash-surface)',
        borderColor: 'var(--dash-border)',
    } as React.CSSProperties

    const mutedStyle = { color: 'var(--dash-text-muted)', fontSize: 11 } as React.CSSProperties
    const labelStyle = { color: 'var(--dash-text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }

    return (
        <div className="flex flex-col gap-3">
            {/* Live preview card */}
            <div className="rounded-lg border p-4" style={cardStyle}>
                <p style={labelStyle} className="mb-3">{d.heading}</p>

                {/* Code chip + type badge */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span
                        className="px-2 py-0.5 rounded text-sm font-mono font-semibold"
                        style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text)' }}
                    >
                        {draft.code || d.codePlaceholder}
                    </span>
                    <DiscountTypeBadge type={draft.type} />
                </div>

                {/* Value */}
                <p className="text-2xl font-bold mb-0.5" style={{ color: 'var(--dash-text)' }}>
                    {valueDisplay}
                    {stored != null && (
                        <span className="text-sm font-normal ml-1.5" style={{ color: 'var(--dash-text-muted)' }}>
                            {d.offSubtotal}
                        </span>
                    )}
                </p>

                <hr className="my-3" style={{ borderColor: 'var(--dash-border)' }} />

                {/* Usage */}
                <div className="flex flex-col gap-1 mb-3">
                    <span style={labelStyle}>{d.usageLabel}</span>
                    <DiscountUsageMeter count={isNew ? 0 : usageCount} limit={usageLimitNum} />
                </div>

                {/* Window */}
                <div className="flex flex-col gap-0.5">
                    <span style={labelStyle}>{d.windowLabel}</span>
                    <p className="text-[13px]" style={{ color: 'var(--dash-text)' }}>
                        {draft.startsAt || draft.expiresAt
                            ? <>{fmtDate(draft.startsAt || null)} → {fmtDate(draft.expiresAt || null)}</>
                            : <span style={mutedStyle}>{d.alwaysAvailable}</span>
                        }
                    </p>
                </div>
            </div>

            {/* Tenant-scoped card */}
            <div className="rounded-lg border p-4" style={cardStyle}>
                <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(var(--info))' }} />
                    <span style={{ ...labelStyle, color: 'hsl(var(--info))' }}>{d.tenantScopedLabel}</span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--dash-text-muted)' }}>
                    {tenantName
                        ? <>{ti(d.tenantScopedNamed, { tenantName })}{' '}</>
                        : <>{d.tenantScopedGeneric}{' '}</>
                    }
                    {d.discountSubtotalNote}
                </p>
            </div>
        </div>
    )
}
