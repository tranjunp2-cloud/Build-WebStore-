'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { RubricReport, FixtureScore } from '../../../../scripts/test-harness/rubric/rubric.schema'

type StatusFilter = 'all' | 'pass' | 'warn' | 'fail'
type SortBy = 'score-desc' | 'score-asc' | 'id' | 'issues-desc'

interface Props { report: RubricReport }

const STATUS_COLOR = { pass: '#10b981', warn: '#f59e0b', fail: '#ef4444' } as const
const STATUS_BG    = { pass: '#052e16', warn: '#451a03', fail: '#450a0a' } as const

/** Horizontal score bar — 130px label, fill, value */
function DimBar({ name, weight, score }: { name: string; weight?: number; score: number }) {
    const pct = score * 10
    const color = score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444'
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 40px', gap: 8, alignItems: 'center', fontSize: 11 }}>
            <span style={{ color: '#d4d4d8', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
                {weight !== undefined && weight > 0 && <span style={{ color: '#52525b', marginLeft: 4 }}>w{weight}</span>}
            </span>
            <div style={{ background: '#27272a', height: 5, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color }} />
            </div>
            <span style={{ fontSize: 10, color: '#a1a1aa', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' }}>
                {score.toFixed(1)}
            </span>
        </div>
    )
}

function Card({ f }: { f: FixtureScore }) {
    const [openDim, setOpenDim] = useState<string | null>(null)
    const color = STATUS_COLOR[f.status]
    const bg    = STATUS_BG[f.status]

    // Total criteria not passing (fail + partial)
    const failingCriteria = f.dimensions.reduce(
        (sum, d) => sum + d.criteria.filter((c) => c.status !== 'pass').length,
        0,
    )

    // Worst dimension for quick reference
    const worstDim = [...f.dimensions].sort((a, b) => a.score - b.score)[0]

    return (
        <article
            style={{
                background: '#111111',
                border: '1px solid #262626',
                borderLeft: `3px solid ${color}`,
                borderRadius: 10,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
            }}
        >
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <a
                        href={f.fixtureId.startsWith('ai-') ? `/test-harness/ai/${f.category}` : `/test-harness/${f.fixtureId}`}
                        target="_blank"
                        style={{ fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace', color: '#60a5fa', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                        {f.fixtureId}
                    </a>
                    <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <span style={{ fontSize: 9, padding: '2px 6px', background: '#1a1a1a', borderRadius: 3, color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {f.category}
                        </span>
                        <span style={{ fontSize: 9, padding: '2px 6px', background: bg, color, borderRadius: 3, fontWeight: 700, letterSpacing: 0.5 }}>
                            {f.status.toUpperCase()}
                        </span>
                        {failingCriteria > 0 && (
                            <span style={{ fontSize: 9, padding: '2px 6px', background: '#1f1007', color: '#fcd34d', borderRadius: 3, fontWeight: 600 }}>
                                {failingCriteria} issue{failingCriteria > 1 ? 's' : ''}
                            </span>
                        )}
                        {worstDim && worstDim.score < 7 && (
                            <span style={{ fontSize: 9, padding: '2px 6px', background: '#1a1a1a', color: '#a1a1aa', borderRadius: 3 }}>
                                worst: {worstDim.name} {worstDim.score.toFixed(1)}
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{f.weighted.toFixed(1)}</span>
                    <span style={{ fontSize: 11, color: '#71717a' }}>/10</span>
                </div>
            </header>

            {/* Dimension bars — click to expand criteria */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {f.dimensions.map((d) => (
                    <div key={d.id}>
                        <button
                            type="button"
                            onClick={() => setOpenDim(openDim === d.id ? null : d.id)}
                            style={{ width: '100%', background: 'transparent', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
                            title="Click to expand criteria detail"
                        >
                            <DimBar name={d.name} weight={d.weight} score={d.score} />
                        </button>
                        {openDim === d.id && (
                            <ul style={{ listStyle: 'none', margin: '6px 0', padding: '6px 8px', background: '#09090b', borderRadius: 4, fontSize: 10 }}>
                                {d.criteria.map((c) => (
                                    <li key={c.criterionId} style={{ padding: '3px 0', display: 'grid', gridTemplateColumns: '16px 1fr 40px', gap: 6, borderBottom: '1px solid #1a1a1a' }}>
                                        <span style={{ color: c.status === 'pass' ? '#10b981' : c.status === 'partial' ? '#f59e0b' : '#ef4444', fontWeight: 700, textAlign: 'center', fontFamily: 'ui-monospace, monospace' }}>
                                            {c.status === 'pass' ? '✓' : c.status === 'partial' ? '◐' : '✗'}
                                        </span>
                                        <span style={{ color: '#d4d4d8' }}>
                                            {c.label}
                                            {c.reason && <div style={{ color: '#71717a', fontSize: 9, fontStyle: 'italic', marginTop: 1 }}>{c.reason}</div>}
                                        </span>
                                        <span style={{ fontSize: 10, color: '#71717a', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                                            {c.points}/{c.maxPoints}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ))}
            </div>
        </article>
    )
}

export function AdminClient({ report }: Props) {
    const [status, setStatus] = useState<StatusFilter>('all')
    const [category, setCategory] = useState<string | 'all'>('all')
    const [sort, setSort] = useState<SortBy>('score-desc')
    const [search, setSearch] = useState('')

    const categories = useMemo(
        () => Array.from(new Set(report.fixtures.map((f) => f.category))).sort(),
        [report.fixtures],
    )

    const filtered = useMemo(() => {
        let list = [...report.fixtures]
        if (status !== 'all') list = list.filter((f) => f.status === status)
        if (category !== 'all') list = list.filter((f) => f.category === category)
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            list = list.filter((f) => f.fixtureId.toLowerCase().includes(q))
        }
        list.sort((a, b) => {
            if (sort === 'score-desc') return b.weighted - a.weighted
            if (sort === 'score-asc') return a.weighted - b.weighted
            if (sort === 'issues-desc') {
                const aIssues = a.dimensions.reduce((s, d) => s + d.criteria.filter((c) => c.status !== 'pass').length, 0)
                const bIssues = b.dimensions.reduce((s, d) => s + d.criteria.filter((c) => c.status !== 'pass').length, 0)
                return bIssues - aIssues
            }
            return a.fixtureId.localeCompare(b.fixtureId)
        })
        return list
    }, [report.fixtures, status, category, sort, search])

    const { total, pass, warn, fail, avgWeighted, perDimensionAvg } = report.summary

    // Sorted worst→best for the dimension overview
    const sortedDims = Object.entries(perDimensionAvg).sort(([, a], [, b]) => a - b)

    const filterBtn = (active: boolean, danger?: boolean): React.CSSProperties => ({
        background: active ? (danger ? '#450a0a' : '#1e1b4b') : '#171717',
        border: `1px solid ${active ? (danger ? '#ef4444' : '#7c3aed') : '#262626'}`,
        color: active ? '#fff' : '#a1a1aa',
        padding: '5px 12px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap' as const,
    })

    return (
        <div style={{ background: '#0a0a0a', color: '#e5e5e5', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

            {/* ── sticky header ── */}
            <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#0d0d0d', borderBottom: '1px solid #262626', padding: '10px 24px' }}>
                <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                    <div>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Debug Console</span>
                        <span style={{ fontSize: 11, color: '#71717a', marginLeft: 12 }}>
                            Rubric {report.rubric.name} · scored {new Date(report.generatedAt).toLocaleString()}
                        </span>
                    </div>
                    <Link href="/test-harness" style={{ color: '#60a5fa', fontSize: 12, textDecoration: 'none' }}>
                        ← Blueprint Gallery
                    </Link>
                </div>
            </div>

            <div style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 24px' }}>

                {/* ── KPI cards ── */}
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
                    {[
                        { label: 'Total Fixtures', value: total, color: '#e5e5e5' },
                        { label: 'Pass ≥ 7.0', value: pass, color: '#10b981' },
                        { label: 'Warn 5–6.9', value: warn, color: '#f59e0b' },
                        { label: 'Fail < 5.0', value: fail, color: fail > 0 ? '#ef4444' : '#52525b' },
                        { label: 'Avg Weighted', value: avgWeighted.toFixed(2), color: '#a78bfa' },
                    ].map((s) => (
                        <div key={s.label} style={{ background: '#111111', border: '1px solid #262626', borderTop: `3px solid ${s.color}`, borderRadius: 8, padding: 14 }}>
                            <div style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                        </div>
                    ))}
                </section>

                {/* ── dimension averages (sorted worst → best) ── */}
                <section style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                        Dimension Averages — sorted worst → best
                    </h2>
                    <div style={{ background: '#111111', border: '1px solid #262626', borderRadius: 8, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {sortedDims.map(([id, avg]) => (
                            <DimBar key={id} name={id} score={avg} />
                        ))}
                    </div>
                </section>

                {/* ── filter bar ── */}
                <div style={{ background: '#111111', border: '1px solid #262626', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                    {/* row 1: status + sort + search */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>Status</span>
                            <button type="button" style={filterBtn(status === 'all')} onClick={() => setStatus('all')}>All {total}</button>
                            <button type="button" style={filterBtn(status === 'pass')} onClick={() => setStatus('pass')}>Pass {pass}</button>
                            <button type="button" style={filterBtn(status === 'warn')} onClick={() => setStatus('warn')}>Warn {warn}</button>
                            <button type="button" style={filterBtn(status === 'fail', true)} onClick={() => setStatus('fail')}>Fail {fail}</button>
                        </div>
                        <div style={{ width: 1, height: 20, background: '#262626', margin: '0 4px' }} />
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>Sort</span>
                            <button type="button" style={filterBtn(sort === 'score-desc')} onClick={() => setSort('score-desc')}>Score ↓</button>
                            <button type="button" style={filterBtn(sort === 'score-asc')} onClick={() => setSort('score-asc')}>Score ↑</button>
                            <button type="button" style={filterBtn(sort === 'issues-desc')} onClick={() => setSort('issues-desc')}>Issues ↓</button>
                            <button type="button" style={filterBtn(sort === 'id')} onClick={() => setSort('id')}>ID A–Z</button>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            <input
                                type="text"
                                placeholder="Search fixture ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{
                                    background: '#0a0a0a', border: '1px solid #262626', color: '#e5e5e5',
                                    padding: '5px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'ui-monospace, monospace', width: 220,
                                }}
                            />
                        </div>
                    </div>
                    {/* row 2: category */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>Category</span>
                        <button type="button" style={filterBtn(category === 'all')} onClick={() => setCategory('all')}>All</button>
                        {categories.map((c) => {
                            const catFail = report.fixtures.filter((f) => f.category === c && f.status === 'fail').length
                            const catWarn = report.fixtures.filter((f) => f.category === c && f.status === 'warn').length
                            return (
                                <button key={c} type="button" style={filterBtn(category === c)} onClick={() => setCategory(c)}>
                                    {c}
                                    {catFail > 0 && <span style={{ marginLeft: 4, color: '#ef4444', fontSize: 9 }}>•{catFail}F</span>}
                                    {catWarn > 0 && <span style={{ marginLeft: catFail > 0 ? 2 : 4, color: '#f59e0b', fontSize: 9 }}>•{catWarn}W</span>}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div style={{ fontSize: 11, color: '#71717a', marginBottom: 12 }}>
                    Showing {filtered.length} / {total} fixtures
                </div>

                {/* ── fixtures grid ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
                    {filtered.map((f) => (
                        <Card key={f.fixtureId} f={f} />
                    ))}
                </div>
            </div>
        </div>
    )
}
