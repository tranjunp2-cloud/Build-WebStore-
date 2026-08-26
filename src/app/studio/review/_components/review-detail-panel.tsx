'use client'
/**
 * review-detail-panel.tsx
 * Right panel for the review split-layout.
 * Shows: thumbnail summary, pre-publish / DNA checks, decision buttons, template info.
 * All action callbacks come from ReviewQueue (state lives there).
 */
import { Eye, Pencil, RotateCcw } from 'lucide-react'
import type { ComplianceResult } from '@/lib/admin/dna-compliance'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    pending:  { label: 'Pending',           color: 'var(--warn)',    bg: 'rgba(217,119,6,0.08)' },
    approved: { label: 'Approved',          color: 'var(--success)', bg: 'rgba(5,150,105,0.08)' },
    changes:  { label: 'Changes requested', color: 'var(--danger)',  bg: 'rgba(220,38,38,0.08)' },
    rejected: { label: 'Rejected',          color: 'var(--text-3)',  bg: 'var(--bg-sunk)' },
}

export interface ReviewDetailItem {
    id: string
    templateId: string
    name: string
    category: string[]
    status: 'pending' | 'approved' | 'changes' | 'rejected'
    version: string
    updatedAt: string
    dnaCache?: ComplianceResult | null
}

interface Props {
    item: ReviewDetailItem
    decisionNote: string
    approving: boolean
    onNoteChange: (note: string) => void
    onApprove: () => void
    onRequestChanges: () => void
}

export function ReviewDetailPanel({
    item, decisionNote, approving,
    onNoteChange, onApprove, onRequestChanges,
}: Props) {
    const statusMeta = STATUS_META[item.status]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header card — thumbnail + meta */}
            <div className="card">
                <div style={{ padding: 20, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div
                        className="ph"
                        style={{ aspectRatio: '16/10', width: 120, flexShrink: 0, padding: 0, fontSize: 9 }}
                    >
                        <span style={{ opacity: 0.6 }}>{item.name.slice(0, 8)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>{item.name}</h2>
                            <span className="mono muted" style={{ fontSize: 12 }}>{item.version}</span>
                            <span
                                className="rw-status-badge"
                                style={{ color: statusMeta.color, background: statusMeta.bg }}
                            >
                                {statusMeta.label}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                            <span>
                                <b style={{ color: 'var(--text-2)' }}>{item.category.join(', ') || '—'}</b>
                                {' '}· category
                            </span>
                            <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button className="btn btn-sm btn-ghost">
                            <Eye size={12} /> Preview
                        </button>
                        <button className="btn btn-sm btn-ghost">
                            <Pencil size={12} /> Open in builder
                        </button>
                    </div>
                </div>
            </div>

            {/* Checks + Decision grid */}
            <div className="rw-detail-grid">
                {/* Pre-publish / DNA checks */}
                <div className="card">
                    <div className="card-head">
                        <span className="card-title">Pre-publish checks</span>
                        <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }}>
                            <RotateCcw size={12} /> Re-run
                        </button>
                    </div>
                    <div style={{ padding: '0 16px 16px' }}>
                        {item.dnaCache ? (
                            <>
                                <div className="rw-check-row">
                                    <span
                                        className="rw-check-icon"
                                        style={{ background: item.dnaCache.pass ? 'var(--success)' : 'var(--danger)' }}
                                    >
                                        {item.dnaCache.pass ? '✓' : '!'}
                                    </span>
                                    <div style={{ flex: 1, fontSize: 13 }}>
                                        <div style={{ fontWeight: 500 }}>DNA Compliance Score</div>
                                        <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>
                                            Score: {item.dnaCache.score}/100 · {item.dnaCache.pass ? 'Passed' : 'Failed'}
                                        </div>
                                    </div>
                                </div>
                                {item.dnaCache.violations.slice(0, 5).map((v, i) => (
                                    <div key={i} className="rw-check-row">
                                        <span
                                            className="rw-check-icon"
                                            style={{ background: v.severity === 'error' ? 'var(--danger)' : 'var(--warn)' }}
                                        >
                                            {v.severity === 'error' ? '!' : '⚠'}
                                        </span>
                                        <div style={{ flex: 1, fontSize: 13 }}>
                                            <div style={{ fontWeight: 500 }}>{v.type}</div>
                                            <div style={{ color: v.severity === 'error' ? 'var(--danger)' : 'var(--warn)', fontSize: 11, marginTop: 2 }}>
                                                {v.message}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {item.dnaCache.violations.length === 0 && (
                                    <div style={{ padding: '10px 0', fontSize: 13, color: 'var(--text-3)' }}>
                                        ✓ No violations found
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ padding: '20px 0', fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>
                                No compliance data available
                            </div>
                        )}
                    </div>
                </div>

                {/* Decision + template info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="card">
                        <div className="card-head">
                            <span className="card-title">Decision</span>
                        </div>
                        <div style={{ padding: '0 16px 16px' }}>
                            <textarea
                                className="input"
                                placeholder="Notes for author (optional)…"
                                value={decisionNote}
                                onChange={e => onNoteChange(e.target.value)}
                                style={{
                                    width: '100%', minHeight: 72, fontSize: 12,
                                    resize: 'vertical', padding: 10, marginBottom: 10,
                                    height: 'auto',
                                }}
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <button
                                    className="btn"
                                    style={{ color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
                                    onClick={onRequestChanges}
                                    disabled={approving}
                                >
                                    ↻ Request changes
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={onApprove}
                                    disabled={approving}
                                >
                                    {approving ? 'Approving…' : '✓ Approve'}
                                </button>
                            </div>
                            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
                                {item.dnaCache && !item.dnaCache.pass
                                    ? <>⚠ DNA compliance failed — can still approve</>
                                    : <>✓ Checks passed</>}
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-head">
                            <span className="card-title">Template info</span>
                        </div>
                        <div style={{ padding: '8px 16px 16px' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Categories</div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {item.category.length > 0
                                    ? item.category.map(c => (
                                        <span key={c} className="chip chip-solid" style={{ fontSize: 10 }}>{c}</span>
                                    ))
                                    : <span className="muted" style={{ fontSize: 12 }}>No categories</span>
                                }
                            </div>
                            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
                                Updated {new Date(item.updatedAt).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
