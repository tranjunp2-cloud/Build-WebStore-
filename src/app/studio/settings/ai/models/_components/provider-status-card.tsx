import { Server } from 'lucide-react'
import Link from 'next/link'
import { fmtWhen } from '@/lib/admin/ai-providers/format'
import { providerName, providerStatus } from '@/lib/admin/ai-providers/status'
import type { HistoryEntry, ProviderView, SettingsView } from '@/lib/admin/ai-providers/types'
import { ToneBadge } from './badges'

const KEY_NOTE = { set: 'Key saved in Studio', env: 'Key from environment', none: 'No key set', 'needs-reentry': 'Key needs re-entry' } as const
const initials = (p: ProviderView) => p.label.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()

/** Status of every provider, and the last change made in Studio. */
export function ProviderStatusCard({ view, last }: { view: SettingsView; last: HistoryEntry | null | undefined }) {
    const rows = view.providers.map((p) => ({ p, status: providerStatus(p) }))
    const ready = rows.filter((r) => r.status.tone === 'ok').length
    const needYou = rows.filter((r) => r.p.enabled && (r.status.tone === 'danger' || r.status.tone === 'warn')).length
    const off = rows.filter((r) => r.status.tone === 'mute').length
    return (
        <section className="aiq-card" aria-label="Providers">
            <div className="aiq-card-head">
                <div><div className="aiq-card-title">Providers</div><div className="aiq-card-sub">{ready} ready · {needYou} need you · {off} off or without a key</div></div>
                <Link className="pm-link" href="/studio/settings/ai/models/providers">Manage providers</Link>
            </div>
            <ul className="pm-rows pm-rows-2">
                {rows.map(({ p, status }) => (
                    <li key={p.id}>
                        <span className="pm-tile">{p.kind === 'compat' ? <Server className="pm-ic" aria-hidden="true" /> : initials(p)}</span>
                        <div className="pm-row-main"><b className={p.kind === 'compat' ? 'pm-mono' : undefined}>{providerName(view, p.id)}</b><span>{KEY_NOTE[p.key.state]}</span></div>
                        <ToneBadge tone={status.tone}>{status.text}</ToneBadge>
                    </li>
                ))}
            </ul>
            <div className="pm-card-foot">
                {last
                    ? <><span>Last change: <b>{last.summary}</b> · {last.actor.email} · {fmtWhen(last.at)}</span><Link className="pm-link" href="/studio/settings/ai/models/history">See history</Link></>
                    : <span>No changes saved in Studio yet.</span>}
            </div>
        </section>
    )
}
