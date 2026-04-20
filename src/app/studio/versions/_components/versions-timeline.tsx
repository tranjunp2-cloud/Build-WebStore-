'use client'
/**
 * versions-timeline.tsx
 * Bundle design Batch 2: history timeline + compare mode.
 * Rollback buttons disabled with tooltip (deferred to F07).
 * Compare view extracted to versions-compare-view.tsx.
 */
import { useState } from 'react'
import { Eye, GitBranch, Plus } from 'lucide-react'
import { VersionsCompareView } from './versions-compare-view'

export interface VersionEntry {
    id: number | string
    versionNumber: number
    changelog?: string | null
    createdAt: string
    templateName?: string
}

interface Props {
    versions: VersionEntry[]
    showTemplateName?: boolean
}

const KIND_COLOR: Record<string, string> = {
    content:   'var(--accent)',
    structure: '#7C3AED',
    variant:   '#0891B2',
    style:     '#EC4899',
    schema:    '#D97706',
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}

function formatDateShort(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
    })
}

function kindFromVersion(vNum: number): string {
    const kinds = Object.keys(KIND_COLOR)
    return kinds[vNum % kinds.length]
}

export function VersionsTimeline({ versions, showTemplateName = false }: Props) {
    const [mode, setMode]           = useState<'history' | 'compare'>('history')
    const [selectedId, setSelectedId] = useState<number | string | null>(null)
    const [compareA, setCompareA]   = useState<number | string | null>(null)
    const [compareB, setCompareB]   = useState<number | string | null>(null)

    if (versions.length === 0) {
        return (
            <div className="empty-state" style={{ margin: 24 }}>
                <p>No versions yet.</p>
                <p style={{ fontSize: 13 }}>Save a template in the builder to create the first version.</p>
            </div>
        )
    }

    const selectedVersion = versions.find(v => v.id === selectedId) ?? null

    if (mode === 'compare') {
        return (
            <VersionsCompareView
                versions={versions}
                vAId={compareA}
                vBId={compareB}
                showTemplateName={showTemplateName}
                onBack={() => setMode('history')}
                onChangeA={id => setCompareA(id)}
                onChangeB={id => setCompareB(id)}
            />
        )
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
            {/* LEFT: timeline */}
            <div className="card">
                <div className="card-head">
                    <span className="card-title">Timeline</span>
                    <span className="card-sub">{versions.length} versions</span>
                    <div style={{ marginLeft: 'auto' }}>
                        <div className="seg">
                            <button className="active">History</button>
                            <button onClick={() => setMode('compare')}>Compare</button>
                        </div>
                    </div>
                </div>
                <div style={{ padding: '0 16px 16px' }}>
                    {versions.map((v, i) => {
                        const kind    = kindFromVersion(v.versionNumber)
                        const kindCol = KIND_COLOR[kind]
                        const isCur   = i === 0
                        const isSelected = v.id === selectedId
                        return (
                            <div
                                key={v.id}
                                className="vt-timeline-item"
                                style={{ borderLeft: i === versions.length - 1 ? 'none' : '2px dashed var(--border)' }}
                                onClick={() => setSelectedId(v.id)}
                            >
                                <div className="vt-dot" style={{
                                    background: isCur ? 'var(--accent)' : 'var(--bg-elev)',
                                    border: `2px solid ${isCur ? 'var(--accent)' : kindCol}`,
                                }} />
                                <div className={`vt-version-card${isSelected ? ' vt-version-card--selected' : ''}`}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>v{v.versionNumber}</span>
                                        {isCur && <span className="chip chip-accent" style={{ fontSize: 10, padding: '1px 6px' }}>CURRENT</span>}
                                        <span style={{
                                            fontSize: 10, padding: '1px 6px', borderRadius: 3,
                                            background: kindCol, color: '#fff', fontWeight: 600,
                                            textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap',
                                        }}>{kind.slice(0, 4)}</span>
                                        <div style={{ flex: 1 }} />
                                        <span className="muted" style={{ fontSize: 11 }}>{formatDateShort(v.createdAt)}</span>
                                    </div>
                                    {v.changelog && (
                                        <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text)' }}>{v.changelog}</div>
                                    )}
                                    {showTemplateName && v.templateName && (
                                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{v.templateName}</div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-3)' }}>
                                        <span className="mono">{formatDate(v.createdAt)}</span>
                                        <div style={{ flex: 1 }} />
                                        {!isCur && (
                                            <>
                                                <button className="btn btn-xs btn-ghost" onClick={e => e.stopPropagation()}>
                                                    <Eye size={10} />
                                                </button>
                                                <button className="btn btn-xs btn-ghost" onClick={e => {
                                                    e.stopPropagation()
                                                    setCompareA(v.id)
                                                    setCompareB(versions[0].id)
                                                    setMode('compare')
                                                }}>⇔ Compare</button>
                                                <div className="vt-rollback-wrap">
                                                    <button
                                                        className="btn btn-xs" disabled
                                                        aria-label="Rollback (coming in F07)"
                                                        style={{ opacity: 0.45, cursor: 'not-allowed' }}
                                                        onClick={e => e.stopPropagation()}
                                                    >↶ Rollback</button>
                                                    <span className="vt-rollback-tooltip">Coming in F07</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* RIGHT: version details + branches */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="card">
                    <div className="card-head"><span className="card-title">Version details</span></div>
                    {selectedVersion ? (
                        <div style={{ padding: 16 }}>
                            <div className="ph" style={{ aspectRatio: '16/10', marginBottom: 12 }}>
                                <span>Preview<small style={{ display: 'block', fontSize: 10, opacity: 0.7, marginTop: 2 }}>
                                    v{selectedVersion.versionNumber} · {formatDateShort(selectedVersion.createdAt)}
                                </small></span>
                            </div>
                            {selectedVersion.changelog && (
                                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: 'var(--text)' }}>
                                    {selectedVersion.changelog}
                                </div>
                            )}
                            <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{formatDate(selectedVersion.createdAt)}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 12 }}>
                                <div>
                                    <div className="vt-detail-label">Type</div>
                                    <span style={{
                                        padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                                        textTransform: 'uppercase',
                                        background: KIND_COLOR[kindFromVersion(selectedVersion.versionNumber)],
                                        color: '#fff',
                                    }}>{kindFromVersion(selectedVersion.versionNumber)}</span>
                                </div>
                                <div>
                                    <div className="vt-detail-label">Version</div>
                                    <span className="mono">v{selectedVersion.versionNumber}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => {
                                    setCompareA(selectedVersion.id)
                                    setCompareB(versions[0].id)
                                    setMode('compare')
                                }}>⇔ Compare with current</button>
                                <div className="vt-rollback-wrap">
                                    <button className="btn btn-sm btn-primary" disabled
                                        style={{ opacity: 0.45, cursor: 'not-allowed' }}
                                        aria-label="Rollback (coming in F07)">↶ Rollback</button>
                                    <span className="vt-rollback-tooltip">Coming in F07</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                            Click a version on the left to view details
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="card-head">
                        <span className="card-title">
                            <GitBranch size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                            Branches
                        </span>
                    </div>
                    <div style={{ padding: '0 16px 16px' }}>
                        {(['main', 'experiment/dark-hero', 'beta/v2'] as const).map((b, i) => (
                            <div key={b} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 0',
                                borderBottom: i < 2 ? '1px dashed var(--border)' : 'none',
                                fontSize: 13,
                            }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                    background: i === 0 ? 'var(--success)' : 'var(--text-3)' }} />
                                <span className="mono" style={{ flex: 1 }}>{b}</span>
                                {i === 0 && <span className="chip chip-accent" style={{ fontSize: 10, padding: '1px 6px' }}>DEFAULT</span>}
                                <span className="muted" style={{ fontSize: 11 }}>
                                    {i === 0 ? '12h ago' : i === 1 ? '2d ago' : '1w ago'}
                                </span>
                            </div>
                        ))}
                        <button className="btn btn-sm btn-ghost" style={{ width: '100%', marginTop: 8 }}>
                            <Plus size={12} /> New branch
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
