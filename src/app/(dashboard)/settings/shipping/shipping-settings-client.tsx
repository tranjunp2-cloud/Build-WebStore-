"use client"

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import type { ShippingConfig } from '@/lib/shipping'
import { SHIPPING_DEFAULTS, RATE_MAX } from '@/lib/shipping'
import { ShippingRatesCard } from './shipping-rates-card'
import { FreeShippingCard } from './free-shipping-card'
import { SettingsFooter } from './settings-footer'

type Props = {
    siteId: string
    initial: ShippingConfig | null
}

const DEFAULTS = {
    westRm: (SHIPPING_DEFAULTS.westRate / 100).toFixed(2),
    eastRm: (SHIPPING_DEFAULTS.eastRate / 100).toFixed(2),
    freeAboveRm: (SHIPPING_DEFAULTS.freeAbove / 100).toFixed(2),
    freeEnabled: true,
} as const

type Snapshot = { westRm: string; eastRm: string; freeEnabled: boolean; freeAboveRm: string }

function senToRm(sen: number | null | undefined): string {
    if (sen == null) return ''
    return (sen / 100).toFixed(2)
}

function snap(w: string, e: string, fe: boolean, fa: string): Snapshot {
    return { westRm: w, eastRm: e, freeEnabled: fe, freeAboveRm: fa }
}

export function ShippingSettingsClient({ siteId, initial }: Props) {
    const { t } = useI18n()
    const s = t.dashboard.settings.shipping
    const [westRateRm, setWestRateRm] = useState(senToRm(initial?.westRate ?? 800))
    const [eastRateRm, setEastRateRm] = useState(senToRm(initial?.eastRate ?? 1500))
    const [freeEnabled, setFreeEnabled] = useState(
        initial != null ? initial.freeAbove != null : DEFAULTS.freeEnabled
    )
    const [freeAboveRm, setFreeAboveRm] = useState(
        senToRm(initial?.freeAbove ?? 10000)
    )
    const [westRateError, setWestRateError] = useState('')
    const [eastRateError, setEastRateError] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaveSucceeded, setLastSaveSucceeded] = useState(false)

    const snapshotRef = useRef<Snapshot>(snap(
        senToRm(initial?.westRate ?? 800),
        senToRm(initial?.eastRate ?? 1500),
        initial != null ? initial.freeAbove != null : DEFAULTS.freeEnabled,
        senToRm(initial?.freeAbove ?? 10000),
    ))

    const isDirty =
        JSON.stringify(snap(westRateRm, eastRateRm, freeEnabled, freeAboveRm)) !==
        JSON.stringify(snapshotRef.current)

    const handleReset = () => {
        setWestRateRm(DEFAULTS.westRm)
        setEastRateRm(DEFAULTS.eastRm)
        setFreeAboveRm(DEFAULTS.freeAboveRm)
        setFreeEnabled(DEFAULTS.freeEnabled)
    }

    const handleSave = async () => {
        const w = parseFloat(westRateRm)
        const e = parseFloat(eastRateRm)
        const wErr = !isNaN(w) && (w < 0 || Math.round(w * 100) > RATE_MAX) ? s.rateError : ''
        const eErr = !isNaN(e) && (e < 0 || Math.round(e * 100) > RATE_MAX) ? s.rateError : ''
        setWestRateError(wErr)
        setEastRateError(eErr)
        if (wErr || eErr) return

        // RF-05: preserve existing enabled state — saving rate settings must not silently re-enable disabled shipping
        const shippingEnabled = initial?.enabled !== false

        setIsSaving(true)
        try {
            const res = await fetch(`/api/sites/${siteId}/shipping-config`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    enabled: shippingEnabled,
                    westRateRm: westRateRm || null,
                    eastRateRm: eastRateRm || null,
                    freeAboveRm: freeEnabled ? (freeAboveRm || null) : null,
                }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error?.message || 'Failed to save')
            snapshotRef.current = snap(westRateRm, eastRateRm, freeEnabled, freeAboveRm)
            setLastSaveSucceeded(true)
            toast.success(s.savedSuccess)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : s.saveError)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="w-full pb-4">
            <div className="space-y-5">
                <ShippingRatesCard
                    westRateRm={westRateRm}
                    eastRateRm={eastRateRm}
                    freeEnabled={freeEnabled}
                    freeAboveRm={freeAboveRm}
                    onWestChange={v => { setWestRateRm(v); setWestRateError('') }}
                    onEastChange={v => { setEastRateRm(v); setEastRateError('') }}
                    westError={westRateError}
                    eastError={eastRateError}
                />
                <FreeShippingCard
                    freeEnabled={freeEnabled}
                    freeAboveRm={freeAboveRm}
                    onToggle={setFreeEnabled}
                    onAmountChange={setFreeAboveRm}
                />
            </div>

            <SettingsFooter
                isDirty={isDirty}
                isSaving={isSaving}
                lastSaveSucceeded={lastSaveSucceeded}
                onReset={handleReset}
                onSave={handleSave}
            />
        </div>
    )
}
