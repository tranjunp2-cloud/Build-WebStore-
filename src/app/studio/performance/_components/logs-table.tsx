/**
 * The Logs table. Seven columns so it fits a 1280px screen without sideways scrolling (Duration lives in the drawer).
 * A row opens the drawer through ?log=<id>; every cell links to it so the whole row is clickable without client JS.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AREA_GROUP_LABELS } from '@/lib/admin/ai-usage/groups'
import { fmtCompact, fmtUsd, fmtWhen } from '@/lib/admin/ai-usage/format'
import type { LogRow } from '@/lib/admin/ai-usage/log-queries'
import { OutcomeBadge, UnpricedBadge } from './au-parts'

type Props = { rows: LogRow[]; selectedId?: number; hrefFor: (id: number) => string }

export function LogsTable({ rows, selectedId, hrefFor }: Props) {
    return (
        <table className="tbl au-logs">
            <thead><tr><th>Time</th><th>Shop</th><th>What · Area</th><th>Model</th><th className="num">Tokens in / out</th><th className="num">Cost</th><th>Status</th></tr></thead>
            <tbody>
                {rows.map((r) => {
                    const href = hrefFor(r.id)
                    const cell = (children: ReactNode, first = false) => (
                        <Link href={href} scroll={false} className="au-rowlink au-trunc" {...(first ? { 'aria-label': `Open details: ${r.taskLabel}, ${r.shop ?? 'no shop'}` } : { tabIndex: -1, 'aria-hidden': true })}>{children}</Link>
                    )
                    return (
                        <tr key={r.id} className={r.id === selectedId ? 'au-sel' : undefined} aria-selected={r.id === selectedId}>
                            <td>{cell(fmtWhen(r.at), true)}</td>
                            <td className="au-wrapcell">{cell(<><span className="au-name__main">{r.shop ?? 'No shop'}</span><span className="au-name__sub">{r.userEmail ?? 'Scheduled job'}</span></>)}</td>
                            <td className="au-wrapcell">{cell(<><span className="au-name__main">{r.taskLabel} <span className="au-dim" style={{ fontWeight: 400 }}>· {AREA_GROUP_LABELS[r.areaGroup]}</span></span><span className="au-name__sub">{r.summary ?? '—'}</span></>)}</td>
                            <td className="au-mono">{cell(r.model)}</td>
                            <td className="num">{cell(<><span className="au-name__main" style={{ fontWeight: 400 }}>{fmtCompact(r.tokensIn)} / {fmtCompact(r.tokensOut)}</span><span className="au-name__sub">{r.cachedTokensIn === null ? 'no cache data' : `${fmtCompact(r.cachedTokensIn)} cached`}</span></>)}</td>
                            <td className="num">{r.costUsd === null ? <UnpricedBadge /> : fmtUsd(r.costUsd, 4)}</td>
                            <td>{r.outcome === 'ok' ? <span className="au-dim">OK</span> : <OutcomeBadge outcome={r.outcome} />}</td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}
