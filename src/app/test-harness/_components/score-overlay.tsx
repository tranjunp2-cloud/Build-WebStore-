'use client'

import { useState } from 'react'
import type { FixtureScore, DimensionScore, CriterionResult } from '../../../../scripts/test-harness/rubric/rubric.schema'

interface ScoreOverlayProps {
    score: FixtureScore
}

const STATUS_COLOR = { pass: '#10b981', warn: '#f59e0b', fail: '#ef4444' } as const
const STATUS_LABEL = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' } as const

function StatusIcon({ status }: { status: 'pass' | 'partial' | 'fail' }) {
    const char = status === 'pass' ? '✓' : status === 'partial' ? '◐' : '✗'
    const color = status === 'pass' ? '#10b981' : status === 'partial' ? '#f59e0b' : '#ef4444'
    return (
        <span style={{ color, fontWeight: 700, width: 14, textAlign: 'center', display: 'inline-block' }}>
            {char}
        </span>
    )
}

function DimensionRow({ dim, open, toggle }: { dim: DimensionScore; open: boolean; toggle: () => void }) {
    const pct = dim.score * 10
    const color = dim.score >= 7 ? '#10b981' : dim.score >= 5 ? '#f59e0b' : '#ef4444'
    return (
        <div style={{ marginBottom: 4 }}>
            <button
                type="button"
                onClick={toggle}
                style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 40px 14px',
                    gap: 8,
                    alignItems: 'center',
                    background: 'transparent',
                    border: 0,
                    color: '#fff',
                    padding: '4px 0',
                    cursor: 'pointer',
                    font: 'inherit',
                    textAlign: 'left',
                }}
            >
                <span style={{ fontSize: 11, color: '#d4d4d8' }}>
                    {dim.name} <span style={{ color: '#71717a', fontSize: 10 }}>w{dim.weight}</span>
                </span>
                <span
                    style={{
                        background: '#27272a',
                        height: 6,
                        borderRadius: 3,
                        overflow: 'hidden',
                    }}
                >
                    <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: color }} />
                </span>
                <span style={{ fontSize: 10, color: '#a1a1aa', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                    {dim.score.toFixed(1)}
                </span>
                <span style={{ fontSize: 10, color: '#71717a' }}>{open ? '▾' : '▸'}</span>
            </button>
            {open && (
                <ul
                    style={{
                        listStyle: 'none',
                        margin: '4px 0 8px',
                        padding: '6px 8px',
                        background: '#18181b',
                        borderRadius: 4,
                        fontSize: 11,
                    }}
                >
                    {dim.criteria.map((c: CriterionResult) => (
                        <li key={c.criterionId} style={{ padding: '2px 0', display: 'grid', gridTemplateColumns: '16px 1fr 40px', gap: 6 }}>
                            <StatusIcon status={c.status} />
                            <span style={{ color: '#d4d4d8' }}>
                                {c.label}
                                {c.reason && (
                                    <div style={{ color: '#71717a', fontSize: 10, fontStyle: 'italic', marginTop: 1 }}>
                                        {c.reason}
                                    </div>
                                )}
                            </span>
                            <span style={{ fontSize: 10, color: '#71717a', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                                {c.points}/{c.maxPoints}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export function ScoreOverlay({ score }: ScoreOverlayProps) {
    const [expanded, setExpanded] = useState(false)
    const [openDims, setOpenDims] = useState<Set<string>>(new Set())
    const color = STATUS_COLOR[score.status]

    function toggleDim(id: string) {
        setOpenDims((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    if (!expanded) {
        return (
            <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label="Expand score details"
                style={{
                    position: 'fixed',
                    right: 10,
                    bottom: 10,
                    zIndex: 9999,
                    background: '#18181b',
                    color: '#fff',
                    border: `2px solid ${color}`,
                    borderRadius: 999,
                    padding: '8px 14px',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                }}
            >
                <span style={{ color, fontSize: 14 }}>●</span>
                <span>{score.weighted.toFixed(1)}/10</span>
                <span style={{ fontSize: 10, color, letterSpacing: 0.5 }}>{STATUS_LABEL[score.status]}</span>
            </button>
        )
    }

    return (
        <div
            style={{
                position: 'fixed',
                right: 10,
                bottom: 10,
                zIndex: 9999,
                background: '#09090b',
                color: '#fafafa',
                border: `2px solid ${color}`,
                borderRadius: 12,
                padding: 16,
                width: 360,
                maxHeight: '80vh',
                overflowY: 'auto',
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: 12,
                boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                <div>
                    <div style={{ fontSize: 10, color: '#71717a', fontFamily: 'ui-monospace, monospace', marginBottom: 2 }}>
                        {score.fixtureId}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 28, fontWeight: 700 }}>{score.weighted.toFixed(1)}</span>
                        <span style={{ fontSize: 12, color: '#71717a' }}>/ 10</span>
                        <span
                            style={{
                                background: color,
                                color: '#fff',
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 3,
                                letterSpacing: 0.5,
                            }}
                        >
                            {STATUS_LABEL[score.status]}
                        </span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    aria-label="Collapse score"
                    style={{
                        background: 'transparent',
                        border: 0,
                        color: '#a1a1aa',
                        fontSize: 18,
                        cursor: 'pointer',
                        padding: 4,
                        lineHeight: 1,
                    }}
                >
                    ×
                </button>
            </div>

            <div>
                {score.dimensions.map((d) => (
                    <DimensionRow key={d.id} dim={d} open={openDims.has(d.id)} toggle={() => toggleDim(d.id)} />
                ))}
            </div>

            <div
                style={{
                    borderTop: '1px solid #27272a',
                    paddingTop: 8,
                    marginTop: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 10,
                    color: '#71717a',
                }}
            >
                <a
                    href="/test-harness/admin"
                    target="_blank"
                    style={{ color: '#a78bfa', textDecoration: 'none' }}
                >
                    Dashboard →
                </a>
                <span>Rubric wix-pro-v1</span>
            </div>
        </div>
    )
}
