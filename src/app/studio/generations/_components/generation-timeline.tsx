'use client'

/**
 * GenerationTimeline — event list for the detail drawer Timeline tab.
 *
 * Uses outputSnapshot.events[] if present (captured from SSEEvent stream).
 * Falls back to synthesizing 3-5 events from the record's own fields.
 */

import type { GenerationRecord } from './generation-types'

type TimelineEvent = {
    label: string
    detail?: string
    ok: boolean
    ts?: string
}

function synthesizeEvents(record: GenerationRecord): TimelineEvent[] {
    const events: TimelineEvent[] = []

    events.push({
        label: 'Generation started',
        detail: `endpoint: ${record.endpoint}${record.category ? ` | category: ${record.category}` : ''}`,
        ok: true,
        ts: record.createdAt,
    })

    if (record.promptHash) {
        events.push({
            label: 'Prompt captured',
            detail: `mode: ${record.promptMode} | hash: ${record.promptHash.slice(0, 12)}…`,
            ok: true,
        })
    }

    if (record.status === 'running') {
        events.push({ label: 'OpenAI call in progress…', ok: true })
    } else if (record.status === 'success') {
        const blocks = record.selectedBlocks?.length ?? 0
        events.push({ label: 'OpenAI call completed', detail: `${blocks} blocks selected`, ok: true })
        if (record.durationMs) {
            events.push({
                label: 'Output saved',
                detail: `total: ${record.durationMs}ms${record.costUsd ? ` | cost: $${record.costUsd.toFixed(6)}` : ''}`,
                ok: true,
                ts: record.completedAt ?? undefined,
            })
        }
    } else if (record.status === 'failed') {
        events.push({
            label: 'Generation failed',
            detail: record.errorLog?.slice(0, 160) ?? 'Unknown error',
            ok: false,
            ts: record.completedAt ?? undefined,
        })
    }

    return events
}

function parseSnapshotEvents(snapshot: Record<string, unknown>): TimelineEvent[] | null {
    const raw = snapshot.events
    if (!Array.isArray(raw) || raw.length === 0) return null

    return raw
        .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
        .map((e) => ({
            label: String(e.label ?? e.step ?? e.event ?? 'Step'),
            detail: e.detail ? String(e.detail) : undefined,
            ok: e.ok !== false,
            ts: e.ts ? String(e.ts) : undefined,
        }))
}

type Props = { record: GenerationRecord }

export function GenerationTimeline({ record }: Props) {
    const snapshotEvents = record.outputSnapshot
        ? parseSnapshotEvents(record.outputSnapshot)
        : null
    const events = snapshotEvents ?? synthesizeEvents(record)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {events.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    {/* Timeline track */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0, paddingTop: 3 }}>
                        <span style={{
                            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                            background: ev.ok ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)',
                        }} />
                        {i < events.length - 1 && (
                            <div style={{ width: 2, flex: 1, marginTop: 4, background: 'var(--border)' }} />
                        )}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>
                            {ev.label}
                        </p>
                        {ev.detail && (
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-2)', wordBreak: 'break-all' }}>
                                {ev.detail}
                            </p>
                        )}
                        {ev.ts && (
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-3)' }}>
                                {new Date(ev.ts).toLocaleString()}
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
