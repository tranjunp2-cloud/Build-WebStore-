'use client'

import { Percent, Banknote, Info, CircleAlert } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fmtRM, MAX_FIXED_DISCOUNT_RM } from '@/lib/discounts/format'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

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

// Error border for the shared <Input> controls (preflight OFF → destructive border needs an explicit
// utility). Matches the error styling already used in discount-form-header.
const errorRing = 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive'

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
                <Label>{d.codeLabel} <span className="text-destructive">*</span></Label>
                <Input
                    className={cn('font-mono tracking-wider', errors.code && errorRing)}
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
                    ? <span id="discount-code-error" role="alert" className="flex items-center gap-1 text-xs text-destructive"><CircleAlert className="h-3 w-3 shrink-0" />{errors.code}</span>
                    : <span style={helpStyle}>{d.codeHelp}</span>
                }
            </div>

            {/* Status — shared <Select> (Radix) */}
            <div className="flex flex-col gap-1.5">
                <Label>{d.statusLabel}</Label>
                <Select value={draft.status} onValueChange={(v) => set('status', v)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">{d.statusActive}</SelectItem>
                        <SelectItem value="inactive">{d.statusInactive}</SelectItem>
                    </SelectContent>
                </Select>
                <span style={helpStyle}>{d.statusHelp}</span>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>
                    {d.descriptionLabel}{' '}
                    <span style={{ color: 'var(--dash-text-muted)', fontWeight: 400, fontSize: 11 }}>{d.descriptionOptional}</span>
                </Label>
                <Textarea
                    rows={2}
                    value={draft.description}
                    onChange={(e) => set('description', e.target.value.slice(0, 500))}
                    placeholder={d.descriptionPlaceholder}
                />
            </div>

            {/* Type — bespoke segmented toggle (kept per design): two labeled options with icons, not a
                boolean switch. Only the container radius is token-synced to rounded-lg. */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>{d.typeLabel} <span className="text-destructive">*</span></Label>
                <div className="flex rounded-lg border border-solid overflow-hidden w-fit" style={{ borderColor: 'hsl(var(--input-border))' }}>
                    {(['percentage', 'fixed'] as const).map((tp) => (
                        <button
                            key={tp}
                            type="button"
                            onClick={() => { set('type', tp); set('valueInput', '') }}
                            className={cn(
                                // No focus ring at all (per request): outline-none kills Chrome's
                                // default blue ring, and we add no replacement ring.
                                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors outline-none',
                                draft.type === tp && 'bg-[hsl(var(--primary))] !text-white'
                            )}
                            style={
                                draft.type === tp
                                    ? undefined
                                    : { background: 'hsl(var(--card))', color: 'var(--dash-text-muted)' }
                            }
                        >
                            {tp === 'percentage' ? <Percent className="h-3.5 w-3.5" /> : <Banknote className="h-3.5 w-3.5" />}
                            {tp === 'percentage' ? d.typePercentage : d.typeFixed}
                        </button>
                    ))}
                </div>
            </div>

            {/* Value — bespoke affix group (kept per F33): RM/% unit panel shares the border box, so the
                inner number input stays bare. Container token-synced to card bg + rounded-lg. */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>{d.valueLabel} <span className="text-destructive">*</span></Label>
                <div className="flex items-center gap-3">
                    <div
                        className="flex max-w-[220px] items-center overflow-hidden rounded-lg border border-solid bg-[hsl(var(--card))] transition-colors focus-within:border-[hsl(var(--primary))]"
                        style={{
                            borderColor: errors.value ? 'hsl(var(--destructive))' : 'hsl(var(--input-border))',
                        }}
                    >
                        {draft.type === 'fixed' && (
                            <span
                                className="flex h-9 shrink-0 items-center pl-3 pr-1 text-xs font-semibold"
                                style={{ color: 'var(--dash-text-muted)' }}
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
                                className="flex h-9 shrink-0 items-center pl-1 pr-3 text-xs font-semibold"
                                style={{ color: 'var(--dash-text-muted)' }}
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
                        <span className="text-xs font-medium text-destructive">
                            {ti(d.valueMaxError, { max: MAX_FIXED_DISCOUNT_RM.toLocaleString('en-MY') })}
                        </span>
                    )}
                    {draft.type === 'percentage' && (
                        <span className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>{d.valueRangeHint}</span>
                    )}
                </div>
                {errors.value
                    ? <span id="discount-value-error" role="alert" className="flex items-center gap-1 text-xs text-destructive"><CircleAlert className="h-3 w-3 shrink-0" />{errors.value}</span>
                    : <span style={helpStyle}>{draft.type === 'percentage' ? d.valueHelpPercentage : d.valueHelpFixed}</span>
                }
            </div>

            {/* Usage limit */}
            <div className="flex flex-col gap-1.5">
                <Label>{d.usageLimitLabel}</Label>
                <Input
                    className={cn('max-w-[220px]', errors.usageLimit && errorRing)}
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
                    ? <span id="discount-usagelimit-error" role="alert" className="flex items-center gap-1 text-xs text-destructive"><CircleAlert className="h-3 w-3 shrink-0" />{errors.usageLimit}</span>
                    : <span style={helpStyle}>{d.usageLimitHelp}</span>
                }
            </div>

            {/* Used so far (read-only, edit/detail only — hidden on create) */}
            {!isNew && (
                <div className="flex flex-col gap-1.5">
                    <Label className="flex items-center gap-1.5">
                        {d.usedSoFarLabel}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span
                                    tabIndex={0}
                                    aria-label={d.usedSoFarTitle}
                                    className="inline-flex cursor-default rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                                    style={{ color: 'var(--dash-text-muted)' }}
                                >
                                    <Info className="h-4 w-4" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent
                                side="top"
                                align="start"
                                className="max-w-[260px] whitespace-normal"
                                // Match the form input palette (per design feedback) instead of the
                                // default dark popover color.
                                style={{ background: 'var(--dash-surface-hover)', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
                            >
                                {d.usedSoFarTitle}
                            </TooltipContent>
                        </Tooltip>
                    </Label>
                    <Input
                        className="max-w-[220px] cursor-not-allowed font-mono opacity-60"
                        value={String(usageCount)}
                        readOnly
                    />
                </div>
            )}

            {/* Date window — Starts at + Expires at always share one row */}
            <div className="grid grid-cols-1 gap-5 sm:col-span-2 sm:grid-cols-2">
                {/* Starts At */}
                <div className="flex flex-col gap-1.5">
                    <Label>{d.startsAtLabel}</Label>
                    <Input
                        className={cn(errors.dates && errorRing)}
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
                    <Label>{d.expiresAtLabel}</Label>
                    <Input
                        className={cn(errors.dates && errorRing)}
                        type="date"
                        value={draft.expiresAt}
                        onChange={(e) => set('expiresAt', e.target.value)}
                        onClick={openDatePicker}
                        aria-invalid={!!errors.dates}
                        aria-describedby={errors.dates ? 'discount-dates-error' : undefined}
                    />
                    {errors.dates
                        ? <span id="discount-dates-error" role="alert" className="flex items-center gap-1 text-xs text-destructive"><CircleAlert className="h-3 w-3 shrink-0" />{errors.dates}</span>
                        : <span style={helpStyle}>{d.expiresAtHelp}</span>
                    }
                </div>
            </div>
        </div>
    )
}
