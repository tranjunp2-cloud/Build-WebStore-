'use client'

import { useState } from 'react'
import { callApi } from '@/lib/admin/ai-providers/browser-api'
import { canOverride, groupTasks, OVERRIDE_TIERS, tasksBody, tasksChanges, tasksDraftFromView, tierName, type TasksDraft } from '@/lib/admin/ai-providers/tasks-draft'
import type { SettingsView } from '@/lib/admin/ai-providers/types'
import { ChangesDialog } from './changes-dialog'
import { SectionSaveBar } from './save-bar'
import { useViewState } from './use-view-state'
import { Toast, useWriter } from './use-writer'

export function TasksClient({ initial }: { initial: SettingsView }) {
    const [view, setView] = useViewState(initial)
    const [draft, setDraft] = useState<TasksDraft>(() => tasksDraftFromView(initial))
    const [confirming, setConfirming] = useState(false)
    const writer = useWriter(setView)
    const lines = tasksChanges(view, draft)
    const groups = groupTasks(view.tasks)

    async function save() {
        const ok = await writer.run(() => callApi<SettingsView>('PUT', '/tasks', tasksBody(draft)), undefined, (next) => setDraft(tasksDraftFromView(next)))
        if (ok) setConfirming(false)
    }

    return (
        <>
            <section className="aiq-card" aria-label="Task tiers">
                <div className="pm-tbl-wrap">
                    <table className="pm-tbl">
                        <thead><tr><th>Task</th><th>Default</th><th>Uses</th></tr></thead>
                        <tbody>
                            {groups.map(({ group, tasks }) => [
                                <tr key={`g-${group}`} className="pm-grp"><td colSpan={3}>{group}</td></tr>,
                                ...tasks.map((task) => (
                                    <tr key={task.id}>
                                        <td className="pm-task"><b>{task.label}</b><span className="pm-mono">{task.id}</span></td>
                                        <td className="pm-dim">{tierName(task.defaultTier)}</td>
                                        <td>
                                            {canOverride(task)
                                                ? <div className="pm-field-row">
                                                    <select
                                                        className="pm-select pm-task-sel" aria-label={`Tier for ${task.label}`} value={draft[task.id] ?? ''}
                                                        onChange={(e) => setDraft({ ...draft, [task.id]: e.target.value || null })}
                                                    >
                                                        <option value="">Default ({tierName(task.defaultTier)})</option>
                                                        {OVERRIDE_TIERS.map((tier) => <option key={tier} value={tier}>{tierName(tier)}</option>)}
                                                    </select>
                                                    {draft[task.id] && <button type="button" className="pm-link" onClick={() => setDraft({ ...draft, [task.id]: null })}>Reset</button>}
                                                </div>
                                                : <span className="pm-dim pm-small">Image only: no other tier makes pictures</span>}
                                        </td>
                                    </tr>
                                )),
                            ])}
                        </tbody>
                    </table>
                </div>
            </section>
            {lines.length > 0 && <SectionSaveBar section="tasks" count={lines.length} failure={confirming ? null : writer.error} onDiscard={() => setDraft(tasksDraftFromView(view))} onSave={() => setConfirming(true)} />}
            {confirming && <ChangesDialog lines={lines} busy={writer.busy} error={writer.error} onCancel={() => { setConfirming(false); writer.setError(null) }} onConfirm={save} />}
            <Toast message={writer.note} />
        </>
    )
}
