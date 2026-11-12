/** Right-side detail drawer for one AI call (?log=<id>). Server-rendered; "Other calls in this reply" = same run_id. */
import Link from 'next/link'
import { X } from 'lucide-react'
import { AREA_GROUP_LABELS, PLAN_GROUP_LABELS } from '@/lib/admin/ai-usage/groups'
import { fmtDuration, fmtFull, fmtInt, fmtUsd, fmtWhen } from '@/lib/admin/ai-usage/format'
import type { LogRow } from '@/lib/admin/ai-usage/log-queries'
import { OutcomeBadge, UnpricedBadge } from './au-parts'
import { DrawerKeys } from './log-drawer-keys'

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
    return <div className={wide ? 'au-span2' : undefined}><dt className="pk-drawer-dt">{label}</dt><dd className="pk-drawer-dd">{children}</dd></div>
}

export function LogDrawer({ log, siblings, closeHref, hrefFor }: { log: LogRow; siblings: LogRow[]; closeHref: string; hrefFor: (id: number) => string }) {
    const cost = log.costUsd === null ? <UnpricedBadge /> : fmtUsd(log.costUsd, 6)
    return (
        <>
            <DrawerKeys closeHref={closeHref} targetId="au-drawer" />
            <Link href={closeHref} scroll={false} className="au-scrim" aria-label="Close details" tabIndex={-1} />
            <aside id="au-drawer" className="pk-drawer au-drawer" role="dialog" aria-modal="true" aria-labelledby="au-drawer-title" tabIndex={-1}>
                <div className="pk-drawer-hd">
                    <div style={{ minWidth: 0 }}>
                        <h2 id="au-drawer-title" className="pk-drawer-title">{log.taskLabel}</h2>
                        <div className="au-dim au-small">{AREA_GROUP_LABELS[log.areaGroup]} · {fmtWhen(log.at)}</div>
                    </div>
                    <Link href={closeHref} scroll={false} className="pk-drawer-close" aria-label="Close"><X size={15} /></Link>
                </div>
                <div className="pk-drawer-body">
                    {log.summary && <p className="pk-drawer-desc">{log.summary}</p>}
                    {log.outcome !== 'ok' && (
                        <div className={`au-errbox${log.outcome === 'refused' ? ' au-warnbox' : ''}`}>
                            {log.outcome === 'refused' ? 'The model answered but produced nothing usable (no draft, no question).' : <><strong className="au-mono">{log.errorCode ?? 'error'}</strong>{log.errorLabel ? `: ${log.errorLabel}` : ''}{log.errorDetail && <div className="au-mono au-small au-errdetail">{log.errorDetail}</div>}</>}
                        </div>
                    )}
                    <dl className="pk-drawer-dl au-dl">
                        <Field label="Time">{fmtFull(log.at)}</Field>
                        <Field label="Outcome"><OutcomeBadge outcome={log.outcome} /></Field>
                        <Field label="Shop">{log.tenantId ? <Link className="au-link" href={`/studio/performance/shops/${log.tenantId}`}>{log.shop ?? `Shop #${log.tenantId}`}</Link> : '—'}</Field>
                        <Field label="User">{log.userEmail ?? 'Scheduled job'}</Field>
                        <Field label="Plan">{PLAN_GROUP_LABELS[log.plan]}{log.planCode && <span className="au-dim au-mono"> {log.planCode}</span>}</Field>
                        <Field label="Page">{log.pageTitle ?? log.pagePath ?? '—'}</Field>
                        <Field label="Model"><span className="au-mono">{log.provider ? `${log.provider}:` : ''}{log.model}</span></Field>
                        <Field label="Duration">{fmtDuration(log.durationMs)}</Field>
                        <Field label="Tokens in">{fmtInt(log.tokensIn)}{log.cachedTokensIn !== null && <span className="au-dim"> ({fmtInt(log.cachedTokensIn)} cached)</span>}</Field>
                        <Field label="Tokens out">{fmtInt(log.tokensOut)}</Field>
                        <Field label="Cost">{cost}</Field>
                        <Field label="Battery cost">{log.batteryCostUsd === null ? '—' : fmtUsd(log.batteryCostUsd, 6)}</Field>
                        <Field label="Cache hit">{log.cacheHitPercent === null ? 'n/a' : `${Math.round(log.cacheHitPercent)}%`}</Field>
                        <Field label="Task id"><span className="au-mono">{log.task ?? '—'}</span></Field>
                        <Field label="Run" wide><span className="au-mono">{log.runId ?? '—'}</span></Field>
                        <Field label="Chat" wide><span className="au-mono">{log.threadId ?? '—'}</span></Field>
                        <Field label="Log id"><span className="au-mono">{log.id}</span></Field>
                    </dl>
                    <h3 className="au-h3">Other calls in this reply</h3>
                    {!log.runId ? <p className="au-dim au-small">This call is not part of a chat reply.</p>
                        : siblings.length === 0 ? <p className="au-dim au-small">No other calls in this reply.</p> : (
                            <ul className="au-list au-mini-list">
                                {siblings.map((s) => (
                                    <li key={s.id}><Link href={hrefFor(s.id)} scroll={false} className="au-list__row">
                                        <span className="au-list__text"><strong className="au-trunc">{s.taskLabel}</strong><span className="au-dim au-small au-trunc">{s.model} · {fmtWhen(s.at)}</span></span>
                                        <span className="au-list__right"><b>{s.costUsd === null ? 'Unpriced' : fmtUsd(s.costUsd)}</b><span>{s.outcome === 'ok' ? '' : s.outcome}</span></span>
                                    </Link></li>
                                ))}
                            </ul>
                        )}
                </div>
                {log.tenantId && <div className="au-drawer-foot"><Link className="btn btn-sm" href={`/studio/performance/shops/${log.tenantId}`}>Open shop</Link></div>}
            </aside>
        </>
    )
}
