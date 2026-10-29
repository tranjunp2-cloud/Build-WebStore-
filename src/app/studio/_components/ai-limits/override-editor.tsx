'use client'

import { useState } from 'react'
import {
    OVERRIDE_MODES, OVERRIDE_NUMBER_FIELDS, emptyOverrideForm, formFromOverride, mapServerErrors, validateOverrideForm,
    type OverrideErrors, type OverrideForm, type OverrideMode, type OverrideSource, type PlanHints,
} from '@/lib/admin/ai-usage/override-form'
import { Dialog } from './dialog'
import './ai-limits.css'

interface Props {
    tenantId: number
    shopName: string | null
    /** null = a new override */
    existing: OverrideSource | null
    planLabel: string
    planHints?: PlanHints
    onClose: () => void
    /** the override was saved: refresh the data behind the screen */
    onSaved: () => void
}

const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function OverrideEditor({ tenantId, shopName, existing, planLabel, planHints = {}, onClose, onSaved }: Props) {
    const [form, setForm] = useState<OverrideForm>(existing ? formFromOverride(existing) : emptyOverrideForm())
    const [errors, setErrors] = useState<OverrideErrors>({})
    const [saving, setSaving] = useState(false)
    const set = <K extends keyof OverrideForm>(key: K, value: OverrideForm[K]) => { setForm((prev) => ({ ...prev, [key]: value })); setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined })) }
    const custom = form.mode === 'custom'

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        const checked = validateOverrideForm(form)
        setErrors(checked.errors)
        if (!checked.body) return
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/ai-settings/shops/${tenantId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(checked.body),
            })
            const body = (await res.json().catch(() => ({}))) as { errors?: Array<{ path: string[]; message: string }>; error?: string }
            if (res.status === 422 && body.errors) { setErrors(mapServerErrors(body.errors)); return }
            if (!res.ok) { setErrors({ form: body.error ?? `Save failed (${res.status})` }); return }
            onSaved()
        } catch (error) {
            setErrors({ form: error instanceof Error ? error.message : 'Save failed' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog title={`${existing ? 'Edit' : 'Set'} AI override: ${shopName ?? `Shop #${tenantId}`}`} busy={saving} onClose={onClose}>
            <form className="acl-form" onSubmit={submit} noValidate>
                <p className="acl-hint">The override replaces the {planLabel} plan values it sets. Platform caps still apply on top.</p>
                <div role="radiogroup" aria-label="Mode" className="acl-modes">
                    {OVERRIDE_MODES.map((mode) => (
                        <button key={mode.id} type="button" role="radio" aria-checked={form.mode === mode.id} className="acl-mode" onClick={() => set('mode', mode.id as OverrideMode)}>
                            {mode.label}
                        </button>
                    ))}
                </div>
                <p className="acl-hint">{OVERRIDE_MODES.find((mode) => mode.id === form.mode)?.help}</p>
                {errors.mode && <p className="acl-err" role="alert">{errors.mode}</p>}
                {custom && (
                    <div className="acl-two">
                        {OVERRIDE_NUMBER_FIELDS.map((field) => {
                            const id = `ovr-${field.key}`
                            return (
                                <div className="acl-field" key={field.key}>
                                    <label htmlFor={id}>{field.label}</label>
                                    <span className="acl-num" data-invalid={errors[field.key] ? '' : undefined}>
                                        {field.unit && <span>{field.unit}</span>}
                                        <input
                                            id={id} inputMode="decimal" value={form[field.key]} placeholder={planHints[field.key] ? `Plan: ${planHints[field.key]}` : 'Keep plan'}
                                            aria-invalid={errors[field.key] ? true : undefined} aria-describedby={errors[field.key] ? `${id}-e` : undefined}
                                            style={{ width: '100%' }} onChange={(e) => set(field.key, e.target.value)}
                                        />
                                    </span>
                                    {errors[field.key] && <p className="acl-err" id={`${id}-e`}>{errors[field.key]}</p>}
                                </div>
                            )
                        })}
                    </div>
                )}
                <div className="acl-field">
                    <label htmlFor="ovr-reason">Reason (required)</label>
                    <textarea
                        id="ovr-reason" className="acl-text" rows={2} maxLength={500} value={form.reason} placeholder="e.g. Pilot customer, approved by the owner"
                        aria-invalid={errors.reason ? true : undefined} aria-describedby={errors.reason ? 'ovr-reason-e' : undefined} onChange={(e) => set('reason', e.target.value)}
                    />
                    {errors.reason && <p className="acl-err" id="ovr-reason-e">{errors.reason}</p>}
                </div>
                <div className="acl-field">
                    <label htmlFor="ovr-expires">Ends on (optional, Malaysia time)</label>
                    <input
                        id="ovr-expires" type="date" className="acl-text" value={form.expiresOn} min={toDay(Date.now())} style={{ maxWidth: 200 }}
                        aria-invalid={errors.expiresOn ? true : undefined} aria-describedby="ovr-expires-h" onChange={(e) => set('expiresOn', e.target.value)}
                    />
                    <p className="acl-hint" id="ovr-expires-h">Empty = until you remove it. After the end of that day the plan applies again.</p>
                    {errors.expiresOn && <p className="acl-err">{errors.expiresOn}</p>}
                </div>
                {errors.form && <p className="acl-err" role="alert">{errors.form}</p>}
                <div className="acl-actions">
                    <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
                    <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save override'}</button>
                </div>
            </form>
        </Dialog>
    )
}
