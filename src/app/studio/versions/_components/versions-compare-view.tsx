'use client'
/**
 * versions-compare-view.tsx
 * Side-by-side diff viewer for two selected versions.
 * Mock diff data mirrors bundle approach (no real diff API yet).
 */
import type { VersionEntry } from './versions-timeline'

// Static diff mock — bundle uses fake data; mirrors same approach for now
const MOCK_DIFFS = [
    { block: 'hero',         field: 'title',           old: 'Old title',   newVal: 'New title',        kind: 'changed' },
    { block: 'hero',         field: 'variant',         old: 'hero-center', newVal: 'hero-split',       kind: 'variant' },
    { block: 'features',     field: 'items[2]',        old: null,          newVal: 'New feature item', kind: 'added' },
    { block: 'testimonials', field: 'items[0].quote',  old: 'Old quote',   newVal: 'New quote',        kind: 'changed' },
    { block: 'cta',          field: 'ctaLabel',        old: 'Explore',     newVal: 'Get started',      kind: 'changed' },
    { block: 'cta',          field: 'secondaryCta',    old: 'Learn more',  newVal: null,               kind: 'removed' },
    { block: 'footer',       field: 'social.tiktok',   old: null,          newVal: '@brand',           kind: 'added' },
]

function formatDateShort(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
    })
}

interface Props {
    versions: VersionEntry[]
    vAId: number | string | null
    vBId: number | string | null
    showTemplateName?: boolean
    onBack: () => void
    onChangeA: (id: string) => void
    onChangeB: (id: string) => void
}

export function VersionsCompareView({ versions, vAId, vBId, showTemplateName, onBack, onChangeA, onChangeB }: Props) {
    const vA = versions.find(v => v.id === vAId) ?? versions[1] ?? versions[0]
    const vB = versions.find(v => v.id === vBId) ?? versions[0]

    const diffCounts = {
        added:   MOCK_DIFFS.filter(d => d.kind === 'added').length,
        removed: MOCK_DIFFS.filter(d => d.kind === 'removed').length,
        changed: MOCK_DIFFS.filter(d => d.kind === 'changed' || d.kind === 'variant').length,
    }

    return (
        <>
            {/* Mode switcher header */}
            <div className="page-head" style={{ marginBottom: 16 }}>
                <div />
                <div className="page-actions">
                    <div className="seg">
                        <button onClick={onBack}>History</button>
                        <button className="active">Compare</button>
                    </div>
                </div>
            </div>

            {/* Version selector bar */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        Comparing
                    </span>
                    <select className="select" value={String(vA.id)} onChange={e => onChangeA(e.target.value)}>
                        {versions.map(v => (
                            <option key={v.id} value={String(v.id)}>
                                v{v.versionNumber} · {formatDateShort(v.createdAt)}
                            </option>
                        ))}
                    </select>
                    <span style={{ color: 'var(--text-3)' }}>→</span>
                    <select className="select" value={String(vB.id)} onChange={e => onChangeB(e.target.value)}>
                        {versions.map(v => (
                            <option key={v.id} value={String(v.id)}>
                                v{v.versionNumber} · {formatDateShort(v.createdAt)}
                            </option>
                        ))}
                    </select>
                    <div style={{ flex: 1 }} />
                    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                        <span style={{ color: 'var(--success)' }}>+{diffCounts.added} added</span>
                        <span style={{ color: 'var(--danger)' }}>−{diffCounts.removed} removed</span>
                        <span style={{ color: 'var(--accent)' }}>~{diffCounts.changed} changed</span>
                    </div>
                </div>
            </div>

            {/* Side-by-side previews */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {[vA, vB].map((v, i) => (
                    <div key={i} className="card">
                        <div className="card-head">
                            <span className="mono" style={{ fontWeight: 600 }}>v{v.versionNumber}</span>
                            <span className="card-sub">{formatDateShort(v.createdAt)}</span>
                        </div>
                        <div style={{ padding: 16 }}>
                            <div className="ph" style={{ aspectRatio: '16/10' }}>
                                <span>
                                    {showTemplateName && v.templateName ? v.templateName : `v${v.versionNumber}`}
                                    <small style={{ display: 'block', fontSize: 10, opacity: 0.7, marginTop: 2 }}>
                                        {formatDateShort(v.createdAt)}
                                    </small>
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Field-level diff table */}
            <div className="card">
                <div className="card-head">
                    <span className="card-title">Field-level diff</span>
                    <span className="card-sub">
                        {MOCK_DIFFS.length} changes across {new Set(MOCK_DIFFS.map(d => d.block)).size} blocks
                    </span>
                </div>
                <div style={{ padding: 0 }}>
                    {MOCK_DIFFS.map((d, i) => (
                        <div
                            key={i}
                            className="vt-diff-row"
                            style={{ borderBottom: i < MOCK_DIFFS.length - 1 ? '1px dashed var(--border)' : 'none' }}
                        >
                            <span className="chip chip-solid" style={{ fontSize: 10 }}>{d.block}</span>
                            <span className="mono muted">{d.field}</span>
                            <div style={{
                                padding: '4px 8px', borderRadius: 3, fontSize: 12,
                                background: d.old ? 'rgba(220,38,38,0.08)' : 'transparent',
                                color: d.old ? 'var(--danger)' : 'var(--text-3)',
                                textDecoration: d.old ? 'line-through' : 'none',
                            }}>
                                {d.old ?? <span style={{ fontStyle: 'italic' }}>— not set —</span>}
                            </div>
                            <div style={{
                                padding: '4px 8px', borderRadius: 3, fontSize: 12,
                                background: d.newVal ? 'rgba(5,150,105,0.08)' : 'transparent',
                                color: d.newVal ? 'var(--success)' : 'var(--text-3)',
                            }}>
                                {d.newVal ?? <span style={{ fontStyle: 'italic' }}>— not set —</span>}
                            </div>
                            <span
                                className="vt-diff-kind"
                                style={{
                                    background: d.kind === 'added'   ? 'rgba(5,150,105,0.1)'  :
                                                d.kind === 'removed' ? 'rgba(220,38,38,0.1)'  :
                                                d.kind === 'variant' ? 'rgba(8,145,178,0.1)'  : 'rgba(37,99,235,0.1)',
                                    color: d.kind === 'added'   ? 'var(--success)' :
                                           d.kind === 'removed' ? 'var(--danger)'  :
                                           d.kind === 'variant' ? '#0891B2'        : 'var(--accent)',
                                }}
                            >
                                {d.kind}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}
