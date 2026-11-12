import { recentAccessStatus, type RecentMerchantAccessEvent } from '@/lib/support/merchant-access-recent'

const stamp = (iso: string) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

function statusLabel(event: RecentMerchantAccessEvent, now: Date): string {
    const status = recentAccessStatus(event, now)
    if (status === 'opened') return `Opened at ${stamp(event.usedAt as string)}`
    return status === 'expired' ? 'Expired' : 'Unused'
}

/** The latest merchant access links: who made them, for which merchant, and whether they were opened. */
export function RecentMerchantAccess({ events, failed = false, now = new Date() }: { events: RecentMerchantAccessEvent[]; failed?: boolean; now?: Date }) {
    return (
        <section aria-labelledby="recent-access-title">
            <h2 id="recent-access-title" className="card-title" style={{ marginBottom: 8 }}>Recent access</h2>
            {failed ? (
                <p role="alert" className="page-sub">Could not load recent access. Try reloading the page.</p>
            ) : events.length === 0 ? (
                <p className="page-sub">No links created yet.</p>
            ) : (
                <div className="tbl-wrap">
                    <table className="tbl">
                        <thead>
                            <tr><th>Created</th><th>Created by</th><th>Merchant</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            {events.map((e) => (
                                <tr key={e.id}>
                                    <td>{stamp(e.createdAt)}</td>
                                    <td>{e.actorEmail}</td>
                                    <td>{e.targetEmail}</td>
                                    <td>{statusLabel(e, now)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}
