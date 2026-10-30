'use client'

import { useMemo, useState } from 'react'
import { ConfirmDialog } from '@/app/studio/_components/ai-limits/confirm-dialog'
import { callApi } from '@/lib/admin/ai-providers/browser-api'
import {
    applyRoutingPatch, routingBody, routingChanges, routingDraftFromView, routingProblems, type RoutingPatch, type TierDraft,
} from '@/lib/admin/ai-providers/routing-draft'
import { TIER_META } from '@/lib/admin/ai-providers/status'
import { TIER_IDS, type SettingsView, type TierId } from '@/lib/admin/ai-providers/types'
import { ChangesDialog } from './changes-dialog'
import { SectionSaveBar } from './save-bar'
import { TierBlock } from './tier-block'
import { useViewState } from './use-view-state'
import { Toast, useWriter } from './use-writer'

const TIER_ENV: Record<TierId, string> = { fast: 'AI_MODEL_FAST', balanced: 'AI_MODEL_BALANCED', quality: 'AI_MODEL_QUALITY', image: 'AI_MODEL_IMAGE' }

export function RoutingClient({ initial, priced }: { initial: SettingsView; priced: string[] | null }) {
    const [view, setView] = useViewState(initial)
    const [patch, setPatch] = useState<RoutingPatch>({})
    const [confirming, setConfirming] = useState(false)
    const [resetting, setResetting] = useState<TierId | null>(null)
    const writer = useWriter(setView)
    const draft = useMemo(() => applyRoutingPatch(routingDraftFromView(view), patch), [view, patch])
    const lines = routingChanges(view, draft)
    const problems = routingProblems(draft)
    const pricedSet = useMemo(() => (priced ? new Set(priced) : null), [priced])

    async function save() {
        if (await writer.run(() => callApi<SettingsView>('PUT', '/routing', routingBody(view, draft)))) { setPatch({}); setConfirming(false) }
    }
    async function reset(tier: TierId) {
        const ok = await writer.run(() => callApi<SettingsView>('PUT', '/routing', { tiers: { [tier]: null } }), `${TIER_META[tier].name} is back on the environment values.`)
        if (ok) {
            setPatch(({ [tier]: _dropped, ...rest }) => rest)
            setResetting(null)
        }
    }

    return (
        <>
            <section className="aiq-card" aria-label="Model chains">
                {TIER_IDS.map((tier) => (
                    <TierBlock
                        key={tier} view={view} tier={tier} draft={draft[tier]} problem={problems[tier]} priced={pricedSet}
                        onChange={(next: TierDraft) => setPatch((current) => ({ ...current, [tier]: next }))} onReset={() => setResetting(tier)}
                    />
                ))}
            </section>
            {lines.length > 0 && (
                <SectionSaveBar section="routing" count={lines.length} blocked={Object.keys(problems).length > 0} failure={confirming || resetting ? null : writer.error}
                    onDiscard={() => setPatch({})} onSave={() => setConfirming(true)} />
            )}
            {confirming && <ChangesDialog lines={lines} busy={writer.busy} error={writer.error} onCancel={() => { setConfirming(false); writer.setError(null) }} onConfirm={save} />}
            {resetting && (
                <ConfirmDialog
                    title={`Reset ${TIER_META[resetting].name} to the environment?`} confirmLabel="Reset" busy={writer.busy} error={writer.error}
                    onCancel={() => { setResetting(null); writer.setError(null) }} onConfirm={() => reset(resetting)}
                >
                    <p className="acl-hint">
                        The chain, effort and timeout saved in Studio for this tier are removed, and the values from the environment
                        (<span className="acl-mono">{TIER_ENV[resetting]}</span> and its neighbours) apply again. Saved as a new version in History.
                    </p>
                </ConfirmDialog>
            )}
            <Toast message={writer.note} />
        </>
    )
}
