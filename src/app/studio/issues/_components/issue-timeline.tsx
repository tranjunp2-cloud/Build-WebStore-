'use client'

/**
 * IssueTimeline — chronological audit trail rendered from the timeline array.
 * Events: status_change, assignment_change, severity_change (+ future custom events).
 */
import type { IssueTimelineEntry } from './issue-types'

function actorLabel(actor: IssueTimelineEntry['actor']): string {
    if (!actor) return 'System'
    if (typeof actor === 'number') return `User #${actor}`
    return actor.email ?? `User #${actor.id}`
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(iso).toLocaleDateString()
}

function eventLabel(entry: IssueTimelineEntry): string {
    const d = entry.data ?? {}
    switch (entry.event) {
        case 'status_change':
            return `Status changed from "${d.from}" → "${d.to}"`
        case 'assignment_change':
            return d.to ? `Assigned to ${d.to}` : 'Assignee removed'
        case 'severity_change':
            return `Severity changed from "${d.from}" → "${d.to}"`
        default:
            return entry.event.replace(/_/g, ' ')
    }
}

type Props = { timeline: IssueTimelineEntry[] }

export function IssueTimeline({ timeline }: Props) {
    if (!timeline || timeline.length === 0) {
        return (
            <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>
                No timeline events yet.
            </p>
        )
    }

    // Show newest first
    const sorted = [...timeline].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    )

    return (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {sorted.map((entry, i) => (
                <li
                    key={entry.id ?? i}
                    style={{
                        display: 'flex',
                        gap: 10,
                        paddingBottom: i < sorted.length - 1 ? 12 : 0,
                        position: 'relative',
                    }}
                >
                    {/* Timeline dot + connector */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                marginTop: 4,
                                flexShrink: 0,
                            }}
                        />
                        {i < sorted.length - 1 && (
                            <div
                                style={{
                                    width: 1,
                                    flex: 1,
                                    background: 'var(--border)',
                                    marginTop: 3,
                                }}
                            />
                        )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
                            {eventLabel(entry)}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>
                            {actorLabel(entry.actor)} · {relativeTime(entry.at)}
                        </p>
                    </div>
                </li>
            ))}
        </ol>
    )
}
