'use client'

/**
 * Pending orders — Coming Soon, default OFF in the Customize modal.
 * Renders an illustrative locked preview (clearly marked "Coming Soon").
 * All text driven by t.dashboard.revamp.orders.* and t.dashboard.revamp.comingSoon.
 */
import { useI18n } from '@/i18n'
import { SectionHead, ComingSoonCorner } from './atoms'

export function PendingOrders() {
    const { t, ti } = useI18n()
    const r = t.dashboard.revamp

    return (
        <div className="section">
            <SectionHead icon="package-check" title={r.orders.title} sub={r.orders.subtitle} />
            <div className="card cs-wrap locked" style={{ padding: 0 }}>
                <div className="cs-content card-pad">
                    <div className="tp-list">
                        {[1, 2, 3].map(i => (
                            <div className="tp-row" key={i} style={{ gridTemplateColumns: 'auto 1fr auto auto' }}>
                                <span className="tp-rank">#{20480 + i}</span>
                                <span className="tp-name">{ti(r.orders.mockOrder, { count: i + 1 })}</span>
                                <span className="cs-badge" style={{ background: 'var(--dr-warning-bg)', color: 'var(--dr-warning-fg)', borderColor: 'var(--dr-warning-bd)' }}>{r.orders.awaiting}</span>
                                <span className="tp-views">RM {120 + i * 40}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <ComingSoonCorner label={r.comingSoon} tip={r.orders.soonTip} />
                <div className="cs-lockzone" />
            </div>
        </div>
    )
}
