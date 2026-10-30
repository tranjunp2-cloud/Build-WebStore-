'use client'

import { Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ConfirmDialog } from '@/app/studio/_components/ai-limits/confirm-dialog'
import { callApi, type ApiResult } from '@/lib/admin/ai-providers/browser-api'
import {
    applyProvidersPatch, emptyProvidersPatch, gatewayWrite, providersChanges, providersDraftFromView, providersProblems, providerWrites,
    type ProvidersPatch,
} from '@/lib/admin/ai-providers/providers-draft'
import { providerName } from '@/lib/admin/ai-providers/status'
import type { SettingsView, TestResult } from '@/lib/admin/ai-providers/types'
import { AddEndpointDialog } from './add-endpoint-dialog'
import { ChangesDialog } from './changes-dialog'
import { EndpointsCard } from './endpoints-card'
import { GatewayCard } from './gateway-card'
import { KeyDialog } from './key-dialog'
import type { KeyMode } from './key-row'
import { ProviderCard } from './provider-card'
import { RemoveKeyDialog } from './remove-key-dialog'
import { SectionSaveBar } from './save-bar'
import { TestDetailsDialog } from './test-details-dialog'
import { useProviderTests } from './use-provider-tests'
import { useViewState } from './use-view-state'
import { Toast, useWriter } from './use-writer'

type Dialog =
    | { t: 'key'; id: string; mode: KeyMode }
    | { t: 'remove-key'; id: string }
    | { t: 'details'; id: string }
    | { t: 'endpoint' }
    | { t: 'remove-endpoint'; id: string }
    | { t: 'gw-token' }
    | { t: 'gw-token-remove' }

const KEY_TITLE: Record<KeyMode, (name: string) => string> = {
    add: (n) => `Add ${n} key`, replace: (n) => `Replace ${n} key`, reentry: (n) => `Re-enter ${n} key`, override: (n) => `Set ${n} key in Studio`,
}

export function ProvidersClient({ initial, priced }: { initial: SettingsView; priced: string[] | null }) {
    const [view, setView] = useViewState(initial)
    const [patch, setPatch] = useState<ProvidersPatch>(emptyProvidersPatch)
    const [dialog, setDialog] = useState<Dialog | null>(null)
    const [confirming, setConfirming] = useState(false)
    const writer = useWriter(setView)
    const tests = useProviderTests()
    const draft = useMemo(() => applyProvidersPatch(providersDraftFromView(view), patch), [view, patch])
    const lines = providersChanges(view, draft)
    const problems = providersProblems(draft)
    const pricedSet = useMemo(() => (priced ? new Set(priced) : null), [priced])
    const builtin = view.providers.filter((p) => p.kind === 'builtin')
    const endpoints = view.providers.filter((p) => p.kind === 'compat')
    const closeDialog = () => { setDialog(null); writer.setError(null) }
    const edit = (change: (current: ProvidersPatch) => ProvidersPatch) => setPatch(change)
    const saved = (next: SettingsView) => { setView(next); setDialog(null) }

    async function save() {
        const writes = providerWrites(view, draft)
        const gateway = gatewayWrite(view, draft)
        const ok = await writer.run(async () => {
            let last: ApiResult<SettingsView> | null = null
            for (const write of writes) {
                last = await callApi<SettingsView>('PUT', `/providers/${write.id}`, write.body)
                if (!last.ok) return last
            }
            if (gateway) last = await callApi<SettingsView>('PUT', '/gateway', gateway)
            return last ?? callApi<SettingsView>('GET', '')
        })
        if (ok) { setPatch(emptyProvidersPatch()); setConfirming(false) }
    }

    const gw = view.gateway
    const gatewayCall = (body: Record<string, unknown>) => callApi<SettingsView>('PUT', '/gateway', { baseUrl: gw.baseUrl, paths: gw.paths, ...body })
    const afterWrite = (call: () => ReturnType<typeof callApi<SettingsView>>) => async () => { if (await writer.run(call)) setDialog(null) }
    const open = dialog
    const keyTarget = open?.t === 'key' ? view.providers.find((p) => p.id === open.id) : undefined
    const detailsTarget = open?.t === 'details' ? view.providers.find((p) => p.id === open.id) : undefined

    return (
        <>
            <p className="pm-note"><Lock className="pm-ic" aria-hidden="true" />Keys are encrypted when saved and never shown again; only the last 4 characters are kept. A key saved here wins over the one in the environment.</p>
            <div className="pm-provs">
                {builtin.map((p) => (
                    <ProviderCard
                        key={p.id} provider={p} enabled={draft.enabled[p.id]} baseUrl={draft.baseUrl[p.id]} problem={problems[p.id]} priced={pricedSet} test={tests.stateOf(p.id, p.lastTest)}
                        onEnabled={(on) => edit((c) => ({ ...c, enabled: { ...c.enabled, [p.id]: on } }))}
                        onBaseUrl={(url) => edit((c) => ({ ...c, baseUrl: { ...c.baseUrl, [p.id]: url } }))}
                        onKey={(mode) => setDialog({ t: 'key', id: p.id, mode })} onRemoveKey={() => setDialog({ t: 'remove-key', id: p.id })}
                        onTest={() => tests.test(p.id)} onDetails={() => setDialog({ t: 'details', id: p.id })}
                    />
                ))}
            </div>
            <EndpointsCard
                endpoints={endpoints} enabled={draft.enabled} baseUrl={draft.baseUrl} options={draft.options} problems={problems}
                tests={Object.fromEntries(endpoints.map((e) => [e.id, tests.stateOf(e.id, e.lastTest)]))}
                onEnabled={(id, on) => edit((c) => ({ ...c, enabled: { ...c.enabled, [id]: on } }))}
                onBaseUrl={(id, url) => edit((c) => ({ ...c, baseUrl: { ...c.baseUrl, [id]: url } }))}
                onOption={(id, option, on) => edit((c) => ({ ...c, options: { ...c.options, [id]: { ...draft.options[id], [option]: on } } }))}
                onKey={(id, mode) => setDialog({ t: 'key', id, mode })} onRemove={(id) => setDialog({ t: 'remove-endpoint', id })}
                onTest={tests.test} onDetails={(id) => setDialog({ t: 'details', id })} onAdd={() => setDialog({ t: 'endpoint' })}
            />
            <GatewayCard
                gateway={gw} baseUrl={draft.gateway.baseUrl} paths={draft.gateway.paths} problem={problems.gateway}
                onBaseUrl={(url) => edit((c) => ({ ...c, gateway: { ...c.gateway, baseUrl: url } }))}
                onPath={(id, path) => edit((c) => ({ ...c, gateway: { ...c.gateway, paths: { ...c.gateway.paths, [id]: path } } }))}
                onToken={() => setDialog({ t: 'gw-token' })} onRemoveToken={() => setDialog({ t: 'gw-token-remove' })}
            />
            {lines.length > 0 && (
                <SectionSaveBar section="providers" count={lines.length} blocked={Object.keys(problems).length > 0} failure={confirming ? null : writer.error}
                    onDiscard={() => setPatch(emptyProvidersPatch())} onSave={() => setConfirming(true)} />
            )}
            {confirming && <ChangesDialog lines={lines} busy={writer.busy} error={writer.error} onCancel={() => { setConfirming(false); writer.setError(null) }} onConfirm={save} />}
            {open?.t === 'key' && keyTarget && (
                <KeyDialog
                    title={KEY_TITLE[open.mode](providerName(view, keyTarget.id))} fieldLabel="API key" onClose={closeDialog} onSaved={saved}
                    hint={open.mode === 'reentry' ? 'The saved key could not be read after the secret key changed. Paste the same key again, or a new one.'
                        : open.mode === 'override' ? 'Saving here wins over the key in the environment. Remove the Studio key later to go back to it.' : undefined}
                    test={(apiKey) => callApi<TestResult>('POST', `/providers/${keyTarget.id}/test`, { apiKey })}
                    save={(apiKey) => callApi<SettingsView>('PUT', `/providers/${keyTarget.id}/key`, { apiKey })}
                />
            )}
            {open?.t === 'gw-token' && (
                <KeyDialog title="Gateway token" fieldLabel="Token" onClose={closeDialog} onSaved={saved} save={(token) => gatewayCall({ token })} />
            )}
            {open?.t === 'gw-token-remove' && (
                <ConfirmDialog title="Remove the gateway token?" confirmLabel="Remove token" busy={writer.busy} error={writer.error} onCancel={closeDialog} onConfirm={afterWrite(() => gatewayCall({ token: null }))} />
            )}
            {open?.t === 'remove-key' && (
                <RemoveKeyDialog view={view} id={open.id} busy={writer.busy} error={writer.error} onCancel={closeDialog} onConfirm={afterWrite(() => callApi<SettingsView>('DELETE', `/providers/${open.id}/key`))} />
            )}
            {open?.t === 'remove-endpoint' && (
                <ConfirmDialog title={`Remove ${open.id}?`} confirmLabel="Remove endpoint" busy={writer.busy} error={writer.error} onCancel={closeDialog} onConfirm={afterWrite(() => callApi<SettingsView>('DELETE', `/endpoints/${open.id.replace(/^compat-/, '')}`))}>
                    <p className="acl-hint">Its models disappear from the chains that use them; a chain with no other model stops working.</p>
                </ConfirmDialog>
            )}
            {open?.t === 'details' && detailsTarget && tests.stateOf(detailsTarget.id, detailsTarget.lastTest).result && (
                <TestDetailsDialog
                    name={providerName(view, detailsTarget.id)} result={tests.stateOf(detailsTarget.id, detailsTarget.lastTest).result as TestResult} onClose={closeDialog}
                    onTestAgain={() => { closeDialog(); void tests.test(detailsTarget.id) }}
                />
            )}
            {open?.t === 'endpoint' && (
                <AddEndpointDialog existing={endpoints.map((e) => e.id)} onClose={closeDialog} onAdded={(next, name) => { saved(next); void tests.test(`compat-${name}`) }} />
            )}
            <Toast message={writer.note} />
        </>
    )
}
