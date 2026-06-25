/**
 * Pending orders — Coming Soon (F10), default OFF in the Customize modal.
 * Renders an illustrative locked preview (clearly marked "Coming Soon").
 */
import { SectionHead, ComingSoonCorner } from './atoms'

export function PendingOrders() {
    return (
        <div className="section">
            <SectionHead icon="package-check" title="Pending orders" sub="Orders awaiting fulfilment" />
            <div className="card cs-wrap locked" style={{ padding: 0 }}>
                <div className="cs-content card-pad">
                    <div className="tp-list">
                        {[1, 2, 3].map(i => (
                            <div className="tp-row" key={i} style={{ gridTemplateColumns: 'auto 1fr auto auto' }}>
                                <span className="tp-rank">#{20480 + i}</span>
                                <span className="tp-name">Customer order · {i + 1} items</span>
                                <span className="cs-badge" style={{ background: 'var(--dr-warning-bg)', color: 'var(--dr-warning-fg)', borderColor: 'var(--dr-warning-bd)' }}>Awaiting</span>
                                <span className="tp-views">RM {120 + i * 40}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <ComingSoonCorner label="Coming Soon" tip="Order fulfilment queue is in development — landing F10." />
                <div className="cs-lockzone" />
            </div>
        </div>
    )
}
