'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n'

type QuantityStepperProps = {
    value: number
    /** Upper bound (stock left). Values < 1 disable the stepper. */
    max: number
    onChange: (next: number) => void
    disabled?: boolean
}

const btnStyle = (off: boolean): React.CSSProperties => ({
    width: 40,
    height: 40,
    border: '1px solid rgba(128,128,128,0.35)',
    background: 'transparent',
    color: 'inherit',
    fontSize: 18,
    cursor: off ? 'not-allowed' : 'pointer',
    opacity: off ? 0.4 : 1,
})

/** GH-2100: PDP quantity picker `[ - 1 + ]`, clamped to [1, max]. */
export function QuantityStepper({ value, max, onChange, disabled }: QuantityStepperProps) {
    const { t } = useI18n()
    // Raw text while typing, so the field can be cleared before a new number is entered
    const [draft, setDraft] = useState<string | null>(null)
    const label = t.storefront.products.quantity
    const off = Boolean(disabled) || max < 1
    const clamp = (n: number) => Math.min(Math.max(1, Math.floor(n)), Math.max(1, max))
    const step = (n: number) => {
        setDraft(null)
        onChange(clamp(n))
    }

    return (
        <div role="group" aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16 }}>
            <button type="button" aria-label={`${label} −`} disabled={off || value <= 1} onClick={() => step(value - 1)} style={{ ...btnStyle(off || value <= 1), borderRadius: '8px 0 0 8px' }}>
                −
            </button>
            <input
                type="number"
                inputMode="numeric"
                aria-label={label}
                min={1}
                max={Math.max(1, max)}
                value={draft ?? value}
                disabled={off}
                onChange={e => {
                    const n = Number(e.target.value)
                    const valid = e.target.value !== '' && Number.isFinite(n) && n >= 1
                    // Over-stock input shows the clamped value right away (GH-2100 review)
                    setDraft(valid ? String(clamp(n)) : e.target.value)
                    if (valid) onChange(clamp(n))
                }}
                onBlur={() => setDraft(null)}
                style={{ width: 56, height: 40, textAlign: 'center', border: '1px solid rgba(128,128,128,0.35)', borderLeft: 'none', borderRight: 'none', background: 'transparent', color: 'inherit', fontSize: 16 }}
            />
            <button type="button" aria-label={`${label} +`} disabled={off || value >= max} onClick={() => step(value + 1)} style={{ ...btnStyle(off || value >= max), borderRadius: '0 8px 8px 0' }}>
                +
            </button>
        </div>
    )
}
