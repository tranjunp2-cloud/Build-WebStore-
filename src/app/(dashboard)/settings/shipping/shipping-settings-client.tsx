"use client"

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import type { ShippingConfig } from '@/lib/shipping'
import { SHIPPING_DEFAULTS, RATE_MAX, FREE_ABOVE_MAX, validateRate, parseRateRm, validateCrossField } from '@/lib/shipping'
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
    const [freeAboveRm, setFreeAboveRm] = useState(senToRm(initial?.freeAbove ?? 10000))
    const [westRateError, setWestRateError] = useState('')
    const [eastRateError, setEastRateError] = useState('')
    const [freeAboveError, setFreeAboveError] = useState('')
    const [westRateWarning, setWestRateWarning] = useState('')
    const [eastRateWarning, setEastRateWarning] = useState('')
    const [freeAboveWarning, setFreeAboveWarning] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const savingRef = useRef(false)

    const snapshotRef = useRef<Snapshot>(snap(
        senToRm(initial?.westRate ?? 800),
        senToRm(initial?.eastRate ?? 1500),
        initial != null ? initial.freeAbove != null : DEFAULTS.freeEnabled,
        senToRm(initial?.freeAbove ?? 10000),
    ))

    const isDirty =
        JSON.stringify(snap(westRateRm, eastRateRm, freeEnabled, freeAboveRm)) !==
        JSON.stringify(snapshotRef.current)

    const msgs = {
        errorEmpty: s.errorEmpty,
        errorNegative: s.errorNegative,
        errorTooHigh: s.errorTooHigh,
        errorFormat: s.errorFormat,
        warnFree: s.warnFree,
    }
    // Free threshold has a different max (RM 100,000) so its too-high message uses freeError
    const freeMsgs = { ...msgs, errorTooHigh: s.freeError }

    const runCrossField = (w: string, e: string, fa: string) => {
        const { warning } = validateCrossField(w, e, fa, freeEnabled, { warnThresholdBelowRate: s.warnThresholdBelowRate })
        setFreeAboveWarning(warning ?? '')
    }

    // raw defaults to current state; paste handlers pass the new value directly to avoid stale closure
    // Empty field treated as 0 (free shipping) instead of Required error
    const handleWestBlur = (raw = westRateRm) => {
        const effective = raw.trim() === '' ? '0' : raw
        const r = validateRate(effective, { maxSen: RATE_MAX, messages: msgs })
        setWestRateError(r.error)
        if (!r.error) {
            const p = parseRateRm(effective)
            if (p !== null) setWestRateRm(p.toFixed(2))
            setWestRateWarning(r.warning ?? '')
        } else {
            setWestRateWarning('')
        }
        runCrossField(effective, eastRateRm, freeAboveRm)
    }

    const handleEastBlur = (raw = eastRateRm) => {
        const effective = raw.trim() === '' ? '0' : raw
        const r = validateRate(effective, { maxSen: RATE_MAX, messages: msgs })
        setEastRateError(r.error)
        if (!r.error) {
            const p = parseRateRm(effective)
            if (p !== null) setEastRateRm(p.toFixed(2))
            setEastRateWarning(r.warning ?? '')
        } else {
            setEastRateWarning('')
        }
        runCrossField(westRateRm, effective, freeAboveRm)
    }

    const handleFreeBlur = (raw = freeAboveRm) => {
        const r = validateRate(raw, { maxSen: FREE_ABOVE_MAX, minSen: 1, required: freeEnabled, messages: freeMsgs })
        setFreeAboveError(r.error)
        if (r.error) {
            setFreeAboveWarning('')
        } else {
            const p = parseRateRm(raw)
            if (p !== null && raw.trim() !== '') setFreeAboveRm(p.toFixed(2))
        }
        runCrossField(westRateRm, eastRateRm, raw)
    }

    const handleReset = () => {
        setWestRateRm(DEFAULTS.westRm)
        setEastRateRm(DEFAULTS.eastRm)
        setFreeAboveRm(DEFAULTS.freeAboveRm)
        setFreeEnabled(DEFAULTS.freeEnabled)
        setWestRateError(''); setEastRateError(''); setFreeAboveError('')
        setWestRateWarning(''); setEastRateWarning(''); setFreeAboveWarning('')
    }

    const handleSave = async () => {
        if (savingRef.current) return
        savingRef.current = true

        const effectiveWest = westRateRm.trim() === '' ? '0' : westRateRm
        const effectiveEast = eastRateRm.trim() === '' ? '0' : eastRateRm
        const wR = validateRate(effectiveWest, { maxSen: RATE_MAX, messages: msgs })
        const eR = validateRate(effectiveEast, { maxSen: RATE_MAX, messages: msgs })
        const fR = freeEnabled
            ? validateRate(freeAboveRm, { maxSen: FREE_ABOVE_MAX, minSen: 1, required: true, messages: freeMsgs })
            : { error: '' }
        setWestRateError(wR.error)
        setEastRateError(eR.error)
        setFreeAboveError(fR.error)
        if (wR.error || eR.error || fR.error) {
            savingRef.current = false
            return
        }

        // Normalize to formatted RM string so body and post-save state are consistent
        const savedWest = parseRateRm(effectiveWest)?.toFixed(2) ?? effectiveWest
        const savedEast = parseRateRm(effectiveEast)?.toFixed(2) ?? effectiveEast

        // RF-05: preserve existing enabled state — saving rate settings must not silently re-enable disabled shipping
        const shippingEnabled = initial == null ? true : initial.enabled !== false

        setIsSaving(true)
        try {
            const res = await fetch(`/api/sites/${siteId}/shipping-config`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    enabled: shippingEnabled,
                    westRateRm: savedWest,
                    eastRateRm: savedEast,
                    freeAboveRm: freeEnabled ? (freeAboveRm || null) : null,
                }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error?.message || 'Failed to save')
            setWestRateRm(savedWest)
            setEastRateRm(savedEast)
            setWestRateWarning(wR.warning ?? '')
            setEastRateWarning(eR.warning ?? '')
            snapshotRef.current = snap(savedWest, savedEast, freeEnabled, freeAboveRm)
            toast.success(s.savedSuccess)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : s.saveError)
        } finally {
            setIsSaving(false)
            savingRef.current = false
        }
    }

    // GH-1538: pb-4 -> pb-24 — SettingsFooter is `position: fixed`, doesn't push
    // content up on its own; matches pb-24 used by ProductForm/customers-detail's
    // same fixed-save-bar pattern so the bar stops overlapping the last field.
    return (
        <div className="w-full pb-24">
            <div className="mb-6">
                <h1 className="text-[32px] font-black text-[var(--dash-text)] tracking-[-0.9px] leading-10">{s.pageTitle}</h1>
                <p className="mt-2 text-[14px] text-[var(--dash-text-muted)]">{s.pageSubtitle}</p>
            </div>
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
                    onWestBlur={handleWestBlur}
                    onEastBlur={handleEastBlur}
                    westWarning={westRateWarning}
                    eastWarning={eastRateWarning}
                    helperText={s.helperRange}
                />
                <FreeShippingCard
                    freeEnabled={freeEnabled}
                    freeAboveRm={freeAboveRm}
                    freeAboveError={freeAboveError}
                    onToggle={v => { setFreeEnabled(v); if (!v) { setFreeAboveError(''); setFreeAboveWarning('') } }}
                    onAmountChange={v => { setFreeAboveRm(v); setFreeAboveError('') }}
                    onAmountBlur={handleFreeBlur}
                    freeAboveWarning={freeAboveWarning}
                />
            </div>

            <SettingsFooter
                isDirty={isDirty}
                isSaving={isSaving}
                onReset={handleReset}
                onSave={handleSave}
            />
        </div>
    )
}
