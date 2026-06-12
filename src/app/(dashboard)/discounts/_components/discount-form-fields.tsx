'use client'

import { Percent, Banknote, Info, CircleAlert } from 'lucide-react'
import { fmtRM, MAX_FIXED_DISCOUNT_RM } from '@/lib/discounts/format'
import { useI18n } from '@/i18n'

export interface DiscountDraft {
    code: string
    description: string
    type: 'percentage' | 'fixed'
    valueInput: string
    status: 'active' | 'inactive'
    usageLimit: string
    startsAt: string
    expiresAt: string
}

export interface DiscountFormErrors {
    code?: string
    value?: string
    usageLimit?: string
    dates?: string
}

interface DiscountFormFieldsProps {
    draft: DiscountDraft
    errors: DiscountFormErrors
    isNew: boolean
    usageCount: number
    set: (k: keyof DiscountDraft, v: string) => void
}

export function DiscountFormFields({ draft, errors, isNew, usageCount, set }: DiscountFormFieldsProps) {
    const { t, ti } = useI18n()
    const d = t.dashboard.discounts.form

    // Only preview when the typed amount is a valid number within the cap — the `max` attribute on a
    // number input doesn't block keyboard entry, so an over-cap value would otherwise render as 1e+.
    const fixedAmount =
        draft.type === 'fixed' && draft.valueInput !== '' && !Number.isNaN(Number(draft.valueInput))
            ? parseFloat(draft.valueInput)
            : null
    const fixedOverCap = fixedAmount != null && fixedAmount > MAX_FIXED_DISCOUNT_RM
    const senPreview =
        fixedAmount != null && !fixedOverCap ? fmtRM(Math.round(fixedAmount * 100)) : null

    const inputBase =
        'w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors'
    const inputStyle = {
        background: 'var(--dash-surface-hover)',
        borderColor: 'var(--dash-border)',
        color: 'var(--dash-text)',
    } as React.CSSProperties
    const inputErrorStyle = { ...inputStyle, borderColor: 'rgb(239,68,68)' }
    const labelStyle = { color: 'var(--dash-text)', fontSize: 13, fontWeight: 500 } as React.CSSProperties
    const helpStyle = { color: 'var(--dash-text-muted)', fontSize: 12 } as React.CSSProperties

    // Native <input type="date"> only opens the picker when its calendar icon is clicked. Calling
    // showPicker() on click lets a tap anywhere in the field open it. `?.()` guards older browsers;
    // try/catch swallows the InvalidStateError thrown if the picker is already open.
    const openDatePicker = (e: React.MouseEvent<HTMLInputElement>) => {
        try { e.currentTarget.showPicker?.() } catch { /* picker already open or unsupported */ }
    }

    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Code */}
            <div className="flex flex-col gap-1.5">
                <label style={labelStyle}>{d.codeLabel} <span className="text-red-400">*</span></label>
                <input
                    className={`${inputBase} font-mono tracking-wider`}
                    style={errors.code ? inputErrorStyle : inputStyle}
                    value={draft.code}
                    onChange={(e) => set('code', e.target.value.replace(/\s/g, '').toUpperCase())}
                    placeholder={d.codePlaceholder}
                    autoComplete="off"
                    maxLength={32}
                    spellCheck={false}
                    aria-invalid={!!errors.code}
                    aria-describedby={errors.code ? 'discount-code-error' : undefined}
                />
                {errors.code
                    ? <span id="discount-code-error" role="alert" className="flex items-center gap-1 text-xs text-red-400"><CircleAlert className="h-3 w-3 shrink-0" />{errors.code}</span>
                    : <span style={helpStyle}>{d.codeHelp}</span>
                }
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
                <label style={labelStyle}>{d.statusLabel}</label>
                <select
                    className={inputBase}
                    style={inputStyle}
                    value={draft.status}
                    onChange={(e) => set('status', e.target.value)}
                >
                    <option value="active">{d.statusActive}</option>
                    <option value="inactive">{d.statusInactive}</option>
                </select>
                <span style={helpStyle}>{d.statusHelp}</span>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label style={labelStyle}>
                    {d.descriptionLabel}{' '}
                    <span style={{ color: 'var(--dash-text-muted)', fontWeight: 400, fontSize: 11 }}>{d.descriptionOptional}</span>
                </label>
                <textarea
                    className={`${inputBase} resize-none`}
                    style={inputStyle}
                    rows={2}
                    value={draft.description}
                    onChange={(e) => set('description', e.target.value.slice(0, 500))}
                    placeholder={d.descriptionPlaceholder}
                />
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label style={labelStyle}>{d.typeLabel} <span className="text-red-400">*</span></label>
                <div className="flex rounded-md border overflow-hidden w-fit" style={{ borderColor: 'var(--dash-border)' }}>
                    {(['percentage', 'fixed'] as const).map((tp) => (
                        <button
                            key={tp}
                            type="button"
                            onClick={() => { set('type', tp); set('valueInput', '') }}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
                            style={
                                draft.type === tp
                                    ? { background: 'var(--brand, #14b8a6)', color: '#fff' }
                                    : { background: 'var(--dash-surface-hover)', color: 'var(--dash-text-muted)' }
                            }
                        >
                            {tp === 'percentage' ? <Percent className="h-3.5 w-3.5" /> : <Banknote className="h-3.5 w-3.5" />}
                            {tp === 'percentage' ? d.typePercentage : d.typeFixed}
                        </button>
                    ))}
                </div>
            </div>

            {/* Value */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label style={labelStyle}>{d.valueLabel} <span className="text-red-400">*</span></label>
                <div className="flex items-center gap-3">
                    {/* Affix-input group (per F33 design): unit label is a sibling panel with a divider,
                        not an overlay — keeps the native number spinner usable without overlapping the
                        RM/% label. Fixed → RM prefix (left); percentage → % suffix (right). */}
                    <div
                        className="flex max-w-[220px] items-center overflow-hidden rounded-md border transition-colors focus-within:border-sky-500"
                        style={{
                            background: 'var(--dash-surface-hover)',
                            borderColor: errors.value ? 'rgb(239,68,68)' : 'var(--dash-border)',
                        }}
                    >
                        {draft.type === 'fixed' && (
                            <span
                                className="flex h-9 shrink-0 items-center border-r px-3 text-xs font-semibold"
                                style={{ color: 'var(--dash-text-muted)', borderColor: 'var(--dash-border)' }}
                            >
                                RM
                            </span>
                        )}
                        <input
                            className="w-28 border-0 bg-transparent px-3 py-2 text-sm outline-none"
                            style={{ color: 'var(--dash-text)' }}
                            type="number"
                            value={draft.valueInput}
                            onChange={(e) => set('valueInput', e.target.value)}
                            placeholder={draft.type === 'percentage' ? '50' : '25.00'}
                            min="0"
                            max={draft.type === 'percentage' ? '100' : String(MAX_FIXED_DISCOUNT_RM)}
                            step={draft.type === 'fixed' ? '0.01' : '1'}
                            aria-invalid={!!errors.value}
                            aria-describedby={errors.value ? 'discount-value-error' : undefined}
                        />
                        {draft.type === 'percentage' && (
                            <span
                                className="flex h-9 shrink-0 items-center border-l px-3 text-xs font-semibold"
                                style={{ color: 'var(--dash-text-muted)', borderColor: 'var(--dash-border)' }}
                            >
                                %
                            </span>
                        )}
                    </div>
                    {draft.type === 'fixed' && senPreview && (
                        <span className="text-sm font-medium" style={{ color: 'var(--dash-text-muted)' }}>
                            = {senPreview}
                        </span>
                    )}
                    {fixedOverCap && (
                        <span className="text-xs font-medium text-red-400">
                            {ti(d.valueMaxError, { max: MAX_FIXED_DISCOUNT_RM.toLocaleString('en-MY') })}
                        </span>
                    )}
                    {draft.type === 'percentage' && (
                        <span className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>{d.valueRangeHint}</span>
                    )}
                </div>
                {errors.value
                    ? <span id="discount-value-error" role="alert" className="flex items-center gap-1 text-xs text-red-400"><CircleAlert className="h-3 w-3 shrink-0" />{errors.value}</span>
                    : <span style={helpStyle}>{draft.type === 'percentage' ? d.valueHelpPercentage : d.valueHelpFixed}</span>
                }
            </div>

            {/* Usage limit */}
            <div className="flex flex-col gap-1.5">
                <label style={labelStyle}>{d.usageLimitLabel}</label>
                <input
                    className={`${inputBase} max-w-[220px]`}
                    style={errors.usageLimit ? inputErrorStyle : inputStyle}
                    type="number"
                    value={draft.usageLimit}
                    onChange={(e) => set('usageLimit', e.target.value)}
                    placeholder={d.usageLimitPlaceholder}
                    min="1"
                    step="1"
                    aria-invalid={!!errors.usageLimit}
                    aria-describedby={errors.usageLimit ? 'discount-usagelimit-error' : undefined}
                />
                {errors.usageLimit
                    ? <span id="discount-usagelimit-error" role="alert" className="flex items-center gap-1 text-xs text-red-400"><CircleAlert className="h-3 w-3 shrink-0" />{errors.usageLimit}</span>
                    : <span style={helpStyle}>{d.usageLimitHelp}</span>
                }
            </div>

            {/* Used so far (read-only, edit/detail only — hidden on create) */}
            {!isNew && (
                <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1" style={labelStyle}>
                        {d.usedSoFarLabel}
                        <span title={d.usedSoFarTitle} style={{ color: 'var(--dash-text-muted)' }}>
                            <Info className="h-3 w-3" />
                        </span>
                    </label>
                    <input
                        className={`${inputBase} max-w-[220px] font-mono`}
                        style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }}
                        value={String(usageCount)}
                        readOnly
                    />
                </div>
            )}

            {/* Date window — Starts at + Expires at always share one row */}
            <div className="grid grid-cols-1 gap-5 sm:col-span-2 sm:grid-cols-2">
                {/* Starts At */}
                <div className="flex flex-col gap-1.5">
                    <label style={labelStyle}>{d.startsAtLabel}</label>
                    <input
                        className={inputBase}
                        style={errors.dates ? inputErrorStyle : inputStyle}
                        type="date"
                        value={draft.startsAt}
                        onChange={(e) => set('startsAt', e.target.value)}
                        onClick={openDatePicker}
                        aria-invalid={!!errors.dates}
                        aria-describedby={errors.dates ? 'discount-dates-error' : undefined}
                    />
                    <span style={helpStyle}>{d.startsAtHelp}</span>
                </div>

                {/* Expires At */}
                <div className="flex flex-col gap-1.5">
                    <label style={labelStyle}>{d.expiresAtLabel}</label>
                    <input
                        className={inputBase}
                        style={errors.dates ? inputErrorStyle : inputStyle}
                        type="date"
                        value={draft.expiresAt}
                        onChange={(e) => set('expiresAt', e.target.value)}
                        onClick={openDatePicker}
                        aria-invalid={!!errors.dates}
                        aria-describedby={errors.dates ? 'discount-dates-error' : undefined}
                    />
                    {errors.dates
                        ? <span id="discount-dates-error" role="alert" className="flex items-center gap-1 text-xs text-red-400"><CircleAlert className="h-3 w-3 shrink-0" />{errors.dates}</span>
                        : <span style={helpStyle}>{d.expiresAtHelp}</span>
                    }
                </div>
            </div>
        </div>
    )
}
