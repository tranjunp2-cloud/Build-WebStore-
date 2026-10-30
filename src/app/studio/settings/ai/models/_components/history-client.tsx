'use client'

import { History, KeyRound, Route, ServerCog, SlidersHorizontal, ListTree } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ConfirmDialog } from '@/app/studio/_components/ai-limits/confirm-dialog'
import { callApi, describeFailure } from '@/lib/admin/ai-providers/browser-api'
import { fmtWhen } from '@/lib/admin/ai-providers/format'
import type { HistoryArea, HistoryEntry, SettingsView } from '@/lib/admin/ai-providers/types'
import { useSynced } from './use-view-state'
import { Toast } from './use-writer'

const FILTERS: ReadonlyArray<{ key: string; label: string; areas: readonly HistoryArea[] | null }> = [
    { key: 'all', label: 'All', areas: null },
    { key: 'providers', label: 'Providers', areas: ['providers', 'keys', 'endpoints', 'gateway'] },
    { key: 'routing', label: 'Routing', areas: ['routing'] },
    { key: 'tasks', label: 'Tasks', areas: ['tasks'] },
    { key: 'runtime', label: 'Runtime', areas: ['runtime'] },
]
const ICON = { providers: ServerCog, keys: KeyRound, endpoints: ServerCog, gateway: ServerCog, routing: Route, tasks: ListTree, runtime: SlidersHorizontal, restore: History } as const

export function HistoryClient({ initial }: { initial: HistoryEntry[] }) {
    const router = useRouter()
    const [entries, setEntries] = useSynced(initial)
    const [filter, setFilter] = useState('all')
    const [target, setTarget] = useState<HistoryEntry | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [note, setNote] = useState<string | null>(null)
    const areas = FILTERS.find((item) => item.key === filter)?.areas ?? null
    const shown = areas ? entries.filter((entry) => areas.includes(entry.area)) : entries
    // entries newer than the chosen one that the restore undoes (keys are never restored)
    const undone = target ? entries.slice(0, entries.indexOf(target)).filter((entry) => entry.area !== 'keys') : []

    async function restore() {
        if (!target) return
        setBusy(true)
        setError(null)
        const result = await callApi<SettingsView>('POST', `/history/${encodeURIComponent(target.id)}/restore`, {})
        if (!result.ok) {
            setBusy(false)
            return setError(describeFailure(result))
        }
        const fresh = await callApi<{ entries: HistoryEntry[] }>('GET', '/history?limit=100')
        setBusy(false)
        if (fresh.ok) setEntries(fresh.data.entries)
        setTarget(null)
        setNote('Version restored. Takes effect within 1 min.')
        setTimeout(() => setNote(null), 4000)
        router.refresh()
    }

    return (
        <section className="aiq-card" aria-label="History">
            <div className="aiq-card-head">
                <div><div className="aiq-card-title">History</div><div className="aiq-card-sub">Who changed what. Secret values are never shown.</div></div>
                <nav className="pm-boxed" aria-label="Filter by area">
                    {FILTERS.map((item) => (
                        <a key={item.key} href="#" aria-current={filter === item.key ? 'page' : undefined} onClick={(e) => { e.preventDefault(); setFilter(item.key) }}>{item.label}</a>
                    ))}
                </nav>
            </div>
            {shown.length === 0
                ? <p className="pm-empty">{entries.length ? 'No changes in this area.' : 'No changes yet. Until someone saves a section here, every value comes from the environment.'}</p>
                : <ol className="pm-tl">
                    {shown.map((entry) => {
                        const Icon = ICON[entry.area] ?? History
                        const current = entry === entries[0]
                        return (
                            <li key={entry.id}>
                                <span className="pm-tl-dot"><Icon className="pm-ic" aria-hidden="true" /></span>
                                <div className="pm-tl-body">
                                    <div className="pm-tl-top"><b>{entry.summary}{current && <> <span className="badge acl-tone-mute pm-nodot">Current</span></>}</b><time dateTime={entry.at}>{fmtWhen(entry.at)}</time></div>
                                    <div className="pm-tl-who">
                                        <span>{entry.actor.email}</span>
                                        {entry.restorable && !current && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setError(null); setTarget(entry) }}><History className="pm-ic" aria-hidden="true" />Restore this version</button>}
                                        {!entry.restorable && entry.area === 'keys' && <span>Keys can&apos;t be restored; replace the key instead.</span>}
                                    </div>
                                </div>
                            </li>
                        )
                    })}
                </ol>}
            {target && (
                <ConfirmDialog title={`Restore the version from ${fmtWhen(target.at)}?`} confirmLabel="Restore this version" busy={busy} error={error} onCancel={() => setTarget(null)} onConfirm={restore}>
                    <p className="acl-hint">Settings go back to how they were right after “{target.summary}”. {undone.length ? 'These changes made since then are undone:' : 'Nothing was changed after it.'}</p>
                    {undone.length > 0 && (
                        <ul className="pm-diff">
                            {undone.map((entry) => <li key={entry.id}><b>{entry.summary}</b><span>Changed {fmtWhen(entry.at)} by {entry.actor.email}</span></li>)}
                        </ul>
                    )}
                    <p className="acl-hint">Keys stay as they are. Takes effect within 1 min. The restore is saved as a new change, so it can be undone too.</p>
                </ConfirmDialog>
            )}
            <Toast message={note} />
        </section>
    )
}
