'use client'

import { useMemo, useState } from 'react'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import {
    configIfChanged, describeChanges, draftFromData, indexErrors, limitChanges, type Draft,
} from '@/lib/admin/ai-settings/draft'
import { ALL_PLAN_CODES, type LimitKind } from '@/lib/admin/ai-settings/plan-groups'
import type { AiSettingsData, FieldError } from '@/lib/admin/ai-settings/types'
import type { ShopOverrideListItem } from '@/lib/admin/ai-caps/shop-overrides'
import type { AlertRow } from '@/lib/admin/ai-caps/status'
import { capsBody, capsDraftFromView, capsProblems, describeCapsChanges, type CapsDraft } from '@/lib/admin/ai-usage/caps-form'
import styles from '../ai-settings.module.css'
import { AiSettingsTabs } from '../../_components/ai-settings-tabs'
import { AlertsSection } from './alerts-section'
import { CapsSection } from './caps-section'
import { LimitsSection } from './limits-section'
import { ModelsLinkSection } from './models-link-section'
import { PricesSection } from './prices-section'
import { SaveBar } from './save-bar'
import { SaveConfirm } from './save-confirm'
import { ShopOverridesSection } from './shop-overrides-section'

interface Props {
    initial: AiSettingsData | null
    failure: string | null
    overrides?: ShopOverrideListItem[] | null
    overridesFailure?: string | null
    alerts?: AlertRow[] | null
    alertsFailure?: string | null
}

const Head = () => (
    <div className={styles.head}>
        <div className="page-head" style={{ marginBottom: 12 }}>
            <div>
                <h1 className="page-title">AI settings</h1>
                <p className="page-sub">Platform caps, limits per plan and per shop, and prices for every AI call. Providers and models have their own tab.</p>
            </div>
        </div>
        <AiSettingsTabs active="limits" />
    </div>
)

const NUMBER_KINDS: LimitKind[] = ['budget', 'pictures', 'monthly', 'site']

export function AiSettingsClient({ initial, failure, overrides = null, overridesFailure = null, alerts = null, alertsFailure = null }: Props) {
    const [data, setData] = useState<AiSettingsData | null>(initial)
    const [draft, setDraft] = useState<Draft | null>(initial ? draftFromData(initial) : null)
    const [capsDraft, setCapsDraft] = useState<CapsDraft | null>(initial ? capsDraftFromView(initial.caps) : null)
    const [errors, setErrors] = useState<FieldError[]>([])
    const [confirming, setConfirming] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saveFailure, setSaveFailure] = useState<string | null>(null)
    const errorMap = useMemo(() => indexErrors(errors), [errors])
    const lines = useMemo(() => (data && draft && capsDraft ? [...describeCapsChanges(capsDraft, data.caps), ...describeChanges(data, draft)] : []), [data, draft, capsDraft])
    const problems = useMemo(() => (capsDraft ? capsProblems(capsDraft) : {}), [capsDraft])

    if (!data || !draft || !capsDraft) {
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

    const touch = () => { setErrors([]); setSaveFailure(null) }
    const update = (patch: Partial<Draft>) => { setDraft({ ...draft, ...patch }); touch() }
    const setLimit = (kind: LimitKind, codes: readonly PlanCode[], value: string) => {
        const next = { ...draft.limits, [kind]: { ...draft.limits[kind] } }
        for (const code of codes) next[kind][code] = value
        update({ limits: next })
    }
    const hasBlank = NUMBER_KINDS.some((kind) => ALL_PLAN_CODES.some((code) => (draft.limits[kind][code] ?? '').trim() === ''))
    const capsChanged = describeCapsChanges(capsDraft, data.caps).length > 0
    const blocked = hasBlank || Object.keys(problems).length > 0

    async function save() {
        if (!data || !draft || !capsDraft) return
        setSaving(true); setSaveFailure(null)
        try {
            const res = await fetch('/api/admin/ai-settings', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limits: limitChanges(data.limits, draft.limits), config: configIfChanged(data, draft), caps: capsChanged ? capsBody(capsDraft) : undefined }),
            })
            const body = (await res.json().catch(() => ({}))) as { errors?: FieldError[]; error?: string; settings?: AiSettingsData }
            if (res.status === 422 && body.errors) { setErrors(body.errors); setConfirming(false); return }
            if (!res.ok) throw new Error(body.error ?? `Save failed (${res.status})`)
            if (body.settings) { setData(body.settings); setDraft(draftFromData(body.settings)); setCapsDraft(capsDraftFromView(body.settings.caps)) }
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
                <CapsSection view={data.caps} draft={capsDraft} problems={problems} onChange={(next) => { setCapsDraft(next); touch() }} />
                <LimitsSection limits={draft.limits} stats={data.stats} errors={errorMap} onSet={setLimit} />
                <ShopOverridesSection initial={overrides} failure={overridesFailure} limits={data.limits} />
                <AlertsSection alerts={alerts} failure={alertsFailure} />
                <ModelsLinkSection />
                <PricesSection draft={draft} unpriced={data.unpriced} errors={errorMap} updatedAt={data.configUpdatedAt} onChange={(next) => update(next)} />
            </div>
            {(lines.length > 0 || saveFailure) && (
                <SaveBar
                    count={lines.length} blocked={blocked} errorCount={errors.length} failure={saveFailure}
                    onDiscard={() => { setDraft(draftFromData(data)); setCapsDraft(capsDraftFromView(data.caps)); touch() }} onSave={() => setConfirming(true)}
                />
            )}
            {confirming && <SaveConfirm lines={lines} saving={saving} onCancel={() => setConfirming(false)} onConfirm={save} />}
        </div>
    )
}
