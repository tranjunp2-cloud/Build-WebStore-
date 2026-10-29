'use client'

import { useMemo, useState } from 'react'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import {
    configIfChanged, describeChanges, draftFromData, indexErrors, limitChanges, type Draft,
} from '@/lib/admin/ai-settings/draft'
import type { LimitKind } from '@/lib/admin/ai-settings/plan-groups'
import type { AiSettingsData, FieldError } from '@/lib/admin/ai-settings/types'
import styles from '../ai-settings.module.css'
import { ChainsSection } from './chains-section'
import { LimitsSection } from './limits-section'
import { PricesSection } from './prices-section'
import { SaveConfirm } from './save-confirm'

interface Props {
    initial: AiSettingsData | null
    failure: string | null
}

const Head = () => (
    <div className="page-head">
        <div>
            <h1 className="page-title">AI limits &amp; prices</h1>
            <p className="page-sub">Daily limits per plan, model chains and prices for every AI call.</p>
        </div>
    </div>
)

export function AiSettingsClient({ initial, failure }: Props) {
    const [data, setData] = useState<AiSettingsData | null>(initial)
    const [draft, setDraft] = useState<Draft | null>(initial ? draftFromData(initial) : null)
    const [errors, setErrors] = useState<FieldError[]>([])
    const [confirming, setConfirming] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saveFailure, setSaveFailure] = useState<string | null>(null)
    const errorMap = useMemo(() => indexErrors(errors), [errors])
    const lines = useMemo(() => (data && draft ? describeChanges(data, draft) : []), [data, draft])

    if (!data || !draft) {
        return (
            <div className="page aiq-page">
                <Head />
                <section className="aiq-card"><div className={styles.notice} role="alert">
                    <b>Could not load AI settings</b>
                    <p className={styles.small}>{failure ?? 'plan-features did not answer.'}</p>
                    <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>Retry</button>
                </div></section>
            </div>
        )
    }

    const update = (patch: Partial<Draft>) => { setDraft({ ...draft, ...patch }); setErrors([]); setSaveFailure(null) }
    const setLimit = (kind: LimitKind, codes: readonly PlanCode[], value: string) => {
        const next = { ...draft.limits, [kind]: { ...draft.limits[kind] } }
        for (const code of codes) next[kind][code] = value
        update({ limits: next })
    }
    const hasBlank = (['budget', 'pictures'] as LimitKind[]).some((kind) => Object.values(draft.limits[kind]).some((v) => v.trim() === ''))

    async function save() {
        if (!data || !draft) return
        setSaving(true); setSaveFailure(null)
        try {
            const res = await fetch('/api/admin/ai-settings', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limits: limitChanges(data.limits, draft.limits), config: configIfChanged(data, draft) }),
            })
            const body = (await res.json().catch(() => ({}))) as { errors?: FieldError[]; error?: string; settings?: AiSettingsData }
            if (res.status === 422 && body.errors) { setErrors(body.errors); setConfirming(false); return }
            if (!res.ok) throw new Error(body.error ?? `Save failed (${res.status})`)
            if (body.settings) { setData(body.settings); setDraft(draftFromData(body.settings)) }
            else window.location.reload()
            setErrors([]); setConfirming(false)
        } catch (error) {
            setSaveFailure(error instanceof Error ? error.message : 'Save failed')
            setConfirming(false)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className={`page aiq-page ${styles.pb}`}>
            <Head />
            <div className={styles.stack}>
                {data.configInvalid && (
                    <section className="aiq-card"><p className={`${styles.notice} ${styles.err}`} role="alert">The saved platform config is invalid, so prices and chains start empty. Saving replaces it.</p></section>
                )}
                <LimitsSection limits={draft.limits} stats={data.stats} errors={errorMap} onSet={setLimit} />
                <ChainsSection draft={draft} errors={errorMap} updatedAt={data.configUpdatedAt} onChange={(key, models) => update({ chains: { ...draft.chains, [key]: models } })} />
                <PricesSection draft={draft} unpriced={data.unpriced} errors={errorMap} updatedAt={data.configUpdatedAt} onChange={(next) => update(next)} />
            </div>
            {(lines.length > 0 || saveFailure) && (
                <div className={styles.saveBar} role="region" aria-label="Unsaved changes">
                    <span>
                        <b>{lines.length} unsaved {lines.length === 1 ? 'change' : 'changes'}</b>
                        {hasBlank && <> · <span className={styles.err} style={{ display: 'inline' }}>fix the field in red</span></>}
                        {errors.length > 0 && <> · <span className={styles.err} style={{ display: 'inline' }}>{errors.length} {errors.length === 1 ? 'problem' : 'problems'} to fix</span></>}
                        {saveFailure && <> · <span className={styles.err} style={{ display: 'inline' }}>{saveFailure}</span></>}
                    </span>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setDraft(draftFromData(data)); setErrors([]); setSaveFailure(null) }}>Discard</button>
                    <button type="button" className="btn btn-sm btn-primary" disabled={hasBlank || lines.length === 0} onClick={() => setConfirming(true)}>Save changes</button>
                </div>
            )}
            {confirming && <SaveConfirm lines={lines} saving={saving} onCancel={() => setConfirming(false)} onConfirm={save} />}
        </div>
    )
}
