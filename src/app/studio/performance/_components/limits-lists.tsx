import Link from 'next/link'
import { ALERT_SCOPE_LABEL, BLOCK_REASON_LABEL, fmtCapUsd, fmtSpendUsd, planLabelOfCode } from '@/lib/admin/ai-usage/caps-display'
import { fmtPercent, fmtWhen } from '@/lib/admin/ai-usage/format'
import { planSwitches } from '@/lib/admin/ai-usage/plan-switch'
import type { CapsStatus } from '@/lib/admin/ai-caps/status'
import { CapMeter } from '../../_components/ai-limits/cap-meter'

const SHOWN = 5
const shopName = (name: string | null, id: number) => name ?? `Shop #${id}`
const shopHref = (id: number) => `/studio/performance/shops/${id}`

/** Near limit · Blocked / off · Recent alerts (server-safe, no state). */
export function LimitsLists({ status }: { status: CapsStatus }) {
    const alertPercents = status.caps.effective.alertPercents
    const offPlans = planSwitches(status.disabledPlans).filter((plan) => !plan.on)
    // a shop only blocked because its plan is off is already covered by the plan line
    const shops = status.blocked.filter((shop) => shop.reason !== 'plan-off')
    const offCount = offPlans.length + shops.length
    const alerts = status.recentAlerts.slice(0, SHOWN)
    return (
        <div className="acl-lists">
            <section aria-label="Near limit">
                <h3>Near limit <span>{status.nearLimit.length}</span></h3>
                {status.nearLimit.length === 0 ? <p className="acl-empty">No shop is close to its own limit.</p> : (
                    <ul className="acl-list">{status.nearLimit.slice(0, SHOWN).map((row) => (
                        <li key={`${row.tenantId}-${row.limit}`}>
                            <div><Link href={shopHref(row.tenantId)}>{shopName(row.name, row.tenantId)}</Link><small>{fmtPercent(row.percent, 0)}%</small></div>
                            <CapMeter small percent={row.percent} alertPercents={alertPercents} label={`${shopName(row.name, row.tenantId)} ${row.limit} budget used`} />
                            <small>{fmtSpendUsd(row.spentUsd)} of {fmtCapUsd(row.limitUsd)} {row.limit === 'daily' ? 'per day' : 'this month'} · {planLabelOfCode(row.plan)}{row.source === 'shop' ? ' · override' : ''}</small>
                        </li>
                    ))}</ul>
                )}
                {status.nearLimit.length > SHOWN && <span className="acl-more au-dim">+{status.nearLimit.length - SHOWN} more</span>}
            </section>
            <section aria-label="Blocked or off">
                <h3>Blocked / off <span>{offCount}</span></h3>
                {offCount === 0 ? <p className="acl-empty">Nothing is blocked. AI is on for every plan.</p> : (
                    <ul className="acl-list">
                        {offPlans.map((plan) => (
                            <li key={plan.id}><div><b>{plan.label} plan</b><small>{plan.mixed ? 'off for some codes' : 'AI off'}</small></div></li>
                        ))}
                        {shops.slice(0, SHOWN).map((shop) => (
                            <li key={`${shop.tenantId}-${shop.reason}`}>
                                <div><Link href={shopHref(shop.tenantId)}>{shopName(shop.name, shop.tenantId)}</Link><small>{planLabelOfCode(shop.plan)}</small></div>
                                <small>{BLOCK_REASON_LABEL[shop.reason]}</small>
                            </li>
                        ))}
                    </ul>
                )}
                {shops.length > SHOWN && <span className="acl-more au-dim">+{shops.length - SHOWN} more shops</span>}
            </section>
            <section aria-label="Recent alerts">
                <h3>Recent alerts <span>{status.recentAlerts.length}</span></h3>
                {alerts.length === 0 ? <p className="acl-empty">No alert yet. One is written when spend crosses a threshold.</p> : (
                    <ul className="acl-list">{alerts.map((alert) => (
                        <li key={alert.id}>
                            <div><b>{ALERT_SCOPE_LABEL[alert.scope] ?? alert.scope} {alert.threshold}%</b><small>{fmtWhen(alert.createdAt)}</small></div>
                            <small>
                                {alert.tenantId !== null && <><Link href={shopHref(alert.tenantId)}>{shopName(alert.shopName, alert.tenantId)}</Link> · </>}
                                {fmtSpendUsd(alert.spentUsd)} of {fmtCapUsd(alert.capUsd)}
                            </small>
                        </li>
                    ))}</ul>
                )}
                <Link className="au-link acl-more" href="/studio/settings/ai#alerts">{status.recentAlerts.length > SHOWN ? 'Show all alerts' : 'Alerts on the settings page'}</Link>
            </section>
        </div>
    )
}
