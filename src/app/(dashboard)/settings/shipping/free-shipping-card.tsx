"use client"

import { Gift, Info, AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { INPUT_FILTER } from '@/lib/shipping/validate-rate'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'

type Props = {
    freeEnabled: boolean
    freeAboveRm: string
    freeAboveError?: string
    onToggle: (v: boolean) => void
    onAmountChange: (v: string) => void
    onAmountBlur: (raw?: string) => void
    freeAboveWarning?: string
}

export function FreeShippingCard({ freeEnabled, freeAboveRm, freeAboveError, onToggle, onAmountChange, onAmountBlur, freeAboveWarning }: Props) {
    const { t } = useI18n()
    const s = t.dashboard.settings.shipping
    const parsedAmount = parseFloat(freeAboveRm)
    const showHelper = freeEnabled && freeAboveRm !== '' && !isNaN(parsedAmount)

    return (
        <div className="flex flex-col rounded-[16px] border border-solid border-dash-border bg-[hsl(var(--card))] overflow-hidden">
            {/* Card header: icon + title + subtitle + toggle. GH-1538 #7: dropped the border-b
                divider here — PaymentMethodCard (the sync target) uses a single outer border
                only, no internal header/body separator. */}
            <div className="flex items-start justify-between gap-4 px-6 py-5">
                <div className="flex items-start gap-4">
                    <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-warning/10 border border-warning/20 shrink-0">
                        <Gift className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                        <h3 className="text-[18px] font-semibold text-[var(--dash-text)]">{s.freeTitle}</h3>
                        <p className="mt-1 text-[13px] text-[var(--dash-text-muted)]">{s.freeSubtitle}</p>
                    </div>
                </div>
                <Switch
                    checked={freeEnabled}
                    onCheckedChange={onToggle}
                    aria-label={s.freeTitle}
                    className="mt-1 shrink-0"
                />
            </div>

            {/* Input section */}
            <div className={cn("flex flex-col gap-2 px-6 py-5 transition-opacity", !freeEnabled && "opacity-40")}>
                <label htmlFor="ship-free-threshold" className="text-[14px] font-semibold text-[var(--dash-text)]">{s.freeMinLabel}</label>
                <div className="relative w-full">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--dash-text-muted)] select-none pointer-events-none">
                        RM
                    </span>
                    <Input
                        id="ship-free-threshold"
                        type="text"
                        inputMode="decimal"
                        disabled={!freeEnabled}
                        aria-invalid={freeAboveError ? true : undefined}
                        aria-describedby={freeAboveError ? 'ship-free-threshold-err' : undefined}
                        className={cn(
                            "h-10 rounded-lg pl-10 pr-3 text-[13px]",
                            freeAboveError && "border-[hsl(var(--destructive))] focus-visible:border-[hsl(var(--destructive))] focus-visible:ring-[hsl(var(--destructive)/0.3)]"
                        )}
                        placeholder="100.00"
                        value={freeAboveRm}
                        onChange={e => {
                            const v = e.target.value
                            if (v === '' || INPUT_FILTER.test(v)) onAmountChange(v)
                        }}
                        onBlur={() => onAmountBlur()}
                        onPaste={e => {
                            e.preventDefault()
                            const raw = e.clipboardData.getData('text').trim()
                            // Strip "RM " prefix from Excel/Sheets copy-paste (AC-11)
                            const stripped = raw.replace(/^RM\s*/i, '')
                            const filtered = INPUT_FILTER.test(stripped) ? stripped : ''
                            onAmountChange(filtered)
                            onAmountBlur(filtered)
                        }}
                    />
                </div>
                {freeAboveError && (
                    <p id="ship-free-threshold-err" role="alert" className="mt-1 flex items-center gap-1.5 text-sm font-medium text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {freeAboveError}
                    </p>
                )}
                {freeAboveWarning && !freeAboveError && (
                    <p role="status" className="mt-1 text-xs text-warning">{freeAboveWarning}</p>
                )}
                {showHelper && !freeAboveError && (
                    <p className="flex items-center gap-1.5 text-[13px] text-[var(--dash-text-muted)]">
                        <Info className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        {s.freeHelper.replace('{amount}', parsedAmount.toFixed(2))}
                    </p>
                )}
            </div>
        </div>
    )
}
