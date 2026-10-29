import Link from 'next/link'
import { ALERT_SCOPE_LABEL, fmtCapUsd, fmtSpendUsd } from '@/lib/admin/ai-usage/caps-display'
import { fmtWhen } from '@/lib/admin/ai-usage/format'
import type { AlertRow } from '@/lib/admin/ai-caps/status'
import '../../../_components/ai-limits/ai-limits.css'
import styles from '../ai-settings.module.css'

/** "Recent alerts": the latest cap alerts (one row each time a threshold was crossed). */
export function AlertsSection({ alerts, failure }: { alerts: AlertRow[] | null; failure: string | null }) {
    return (
        <section className="aiq-card" id="alerts" aria-labelledby="alerts-title">
            <div className="aiq-card-head">
                <div>
                    <div className="aiq-card-title" id="alerts-title">Recent alerts</div>
                    <div className="aiq-card-sub">Written when spend crosses an alert threshold, once per threshold per day (or month). Lark gets a message when it is set up.</div>
                </div>
            </div>
            {failure && <div className={styles.notice} role="alert"><b>Could not load alerts</b><p className={styles.small}>{failure}</p></div>}
            {!failure && alerts?.length === 0 && <p className="acl-state">No alerts yet.</p>}
            {!failure && alerts && alerts.length > 0 && (
                <div className="acl-table-wrap">
                    <table className="tbl">
                        <thead><tr><th>When</th><th>Scope</th><th>Shop</th><th className="num">Threshold</th><th className="num">Spent / cap</th><th>Lark</th></tr></thead>
                        <tbody>{alerts.map((a) => (
                            <tr key={a.id}>
                                <td>{fmtWhen(a.createdAt)}</td>
                                <td>{ALERT_SCOPE_LABEL[a.scope] ?? a.scope}</td>
                                <td>{a.tenantId === null ? '—' : <Link href={`/studio/performance/shops/${a.tenantId}`}>{a.shopName ?? `Shop #${a.tenantId}`}</Link>}</td>
                                <td className="num">{a.threshold} %</td>
                                <td className="num">{fmtSpendUsd(a.spentUsd)} / {fmtCapUsd(a.capUsd)}</td>
                                <td>{a.notifiedLark ? 'Sent' : '—'}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </section>
    )
}
