'use client'

import { Fragment, useState } from 'react'
import { callApi } from '@/lib/admin/ai-providers/browser-api'
import {
    groupRuntime, runtimeBody, runtimeChanges, runtimeDraftFromView, runtimeProblems, type RuntimeDraft,
} from '@/lib/admin/ai-providers/runtime-draft'
import type { SettingsView } from '@/lib/admin/ai-providers/types'
import { ChangesDialog } from './changes-dialog'
import { RuntimeRow } from './runtime-row'
import { SectionSaveBar } from './save-bar'
import { useViewState } from './use-view-state'
import { Toast, useWriter } from './use-writer'

export function RuntimeClient({ initial }: { initial: SettingsView }) {
    const [view, setView] = useViewState(initial)
    const [draft, setDraft] = useState<RuntimeDraft>(() => runtimeDraftFromView(initial))
    const [confirming, setConfirming] = useState(false)
    const writer = useWriter(setView)
    const lines = runtimeChanges(view, draft)
    const problems = runtimeProblems(view, draft)
    const base = runtimeDraftFromView(view)

    async function save() {
        const ok = await writer.run(() => callApi<SettingsView>('PUT', '/runtime', runtimeBody(view, draft)), undefined, (next) => setDraft(runtimeDraftFromView(next)))
        if (ok) setConfirming(false)
    }

    return (
        <>
            <section className="aiq-card" aria-label="Runtime settings">
                {groupRuntime(view).map((group, i) => (
                    <Fragment key={group.title}>
                        {i > 0 && <div style={{ borderTop: '1px solid var(--border)' }} />}
                        <div className="pm-grouptitle">{group.title}</div>
                        {group.rows.map((row) => (
                            <RuntimeRow
                                key={row.key} row={row} entry={draft[row.key] ?? base[row.key] ?? { value: String(row.value), reset: false }} problem={problems[row.key]}
                                onChange={(entry) => setDraft({ ...draft, [row.key]: entry })}
                            />
                        ))}
                    </Fragment>
                ))}
            </section>
            {lines.length > 0 && (
                <SectionSaveBar section="runtime" count={lines.length} blocked={Object.keys(problems).length > 0} failure={confirming ? null : writer.error}
                    onDiscard={() => setDraft(runtimeDraftFromView(view))} onSave={() => setConfirming(true)} />
            )}
            {confirming && <ChangesDialog lines={lines} busy={writer.busy} error={writer.error} onCancel={() => { setConfirming(false); writer.setError(null) }} onConfirm={save} />}
            <Toast message={writer.note} />
        </>
    )
}
