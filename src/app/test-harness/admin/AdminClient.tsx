'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { RubricReport, FixtureScore } from '../../../../scripts/test-harness/rubric/rubric.schema'

type StatusFilter = 'all' | 'pass' | 'warn' | 'fail'
type SortBy = 'score-desc' | 'score-asc' | 'id'

interface Props {
    report: RubricReport
}

const STATUS_COLOR = { pass: '#10b981', warn: '#f59e0b', fail: '#ef4444' } as const

function DimBar({ name, weight, score }: { name: string; weight: number; score: number }) {
    const pct = score * 10
    const color = score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444'
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 36px', gap: 8, alignItems: 'center', fontSize: 11 }}>
            <span style={{ color: '#d4d4d8', fontSize: 10 }}>
                {name} <span style={{ color: '#71717a' }}>w{weight}</span>
            </span>
            <span style={{ background: '#27272a', height: 5, borderRadius: 3, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: color }} />
            </span>
            <span style={{ fontSize: 10, color: '#a1a1aa', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                {score.toFixed(1)}
            </span>
        </div>
    )
}

function Card({ f }: { f: FixtureScore }) {
    const [openDim, setOpenDim] = useState<string | null>(null)
    const color = STATUS_COLOR[f.status]

    return (
        <article
            style={{
                background: '#171717',
                border: '1px solid #262626',
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
                        style={{
                            fontSize: 11,
                            fontFamily: 'ui-monospace, Menlo, monospace',
                            color: '#60a5fa',
                            textDecoration: 'none',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {f.fixtureId}
                    </a>
                    <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
                        <span style={{ fontSize: 9, padding: '2px 6px', background: '#262626', borderRadius: 3, color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {f.category}
                        </span>
                        <span style={{ fontSize: 9, padding: '2px 6px', background: color, borderRadius: 3, color: '#fff', fontWeight: 700, letterSpacing: 0.5 }}>
                            {f.status.toUpperCase()}
                        </span>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{f.weighted.toFixed(1)}</span>
                    <span style={{ fontSize: 11, color: '#71717a' }}>/10</span>
                </div>
            </header>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {f.dimensions.map((d) => (
                    <div key={d.id}>
                        <button
                            type="button"
                            onClick={() => setOpenDim(openDim === d.id ? null : d.id)}
                            style={{ width: '100%', background: 'transparent', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
                        >
                            <DimBar name={d.name} weight={d.weight} score={d.score} />
                        </button>
                        {openDim === d.id && (
                            <ul style={{ listStyle: 'none', margin: '6px 0', padding: '6px 8px', background: '#09090b', borderRadius: 4, fontSize: 11 }}>
                                {d.criteria.map((c) => (
                                    <li key={c.criterionId} style={{ padding: '2px 0', display: 'grid', gridTemplateColumns: '16px 1fr 40px', gap: 6 }}>
                                        <span style={{ color: c.status === 'pass' ? '#10b981' : c.status === 'partial' ? '#f59e0b' : '#ef4444', fontWeight: 700, textAlign: 'center' }}>
                                            {c.status === 'pass' ? '✓' : c.status === 'partial' ? '◐' : '✗'}
                                        </span>
                                        <span style={{ color: '#d4d4d8' }}>
                                            {c.label}
                                            {c.reason && <div style={{ color: '#71717a', fontSize: 10, fontStyle: 'italic' }}>{c.reason}</div>}
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
            return a.fixtureId.localeCompare(b.fixtureId)
        })
        return list
    }, [report.fixtures, status, category, sort, search])

    const { total, pass, warn, fail, avgWeighted, perDimensionAvg } = report.summary

    const btnStyle = (active: boolean): React.CSSProperties => ({
        background: active ? '#7c3aed' : '#171717',
        border: `1px solid ${active ? '#7c3aed' : '#262626'}`,
        color: '#fff',
        padding: '6px 12px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: 'inherit',
    })

    return (
        <div style={{ background: '#0a0a0a', color: '#e5e5e5', minHeight: '100vh', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 16 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4, color: '#fff' }}>
                        Template Quality — Admin
                    </h1>
                    <div style={{ color: '#71717a', fontSize: 12 }}>
                        Rubric {report.rubric.name} · scored {new Date(report.generatedAt).toLocaleString()}
                    </div>
                </div>
                <Link href="/test-harness" style={{ color: '#60a5fa', fontSize: 13, textDecoration: 'none' }}>
                    ← Back to Index
                </Link>
            </header>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
                {[
                    { label: 'Total', value: total, color: '#e5e5e5' },
                    { label: 'Pass ≥7', value: pass, color: '#10b981' },
                    { label: 'Warn 5–6.9', value: warn, color: '#f59e0b' },
                    { label: 'Fail <5', value: fail, color: '#ef4444' },
                    { label: 'Avg Weighted', value: avgWeighted.toFixed(2), color: '#a78bfa' },
                ].map((s) => (
                    <div key={s.label} style={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.value}</div>
                    </div>
                ))}
            </section>

            <section style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    Dimension Averages
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {Object.entries(perDimensionAvg).map(([id, avg]) => (
                        <div key={id} style={{ background: '#171717', border: '1px solid #262626', borderRadius: 6, padding: '8px 12px' }}>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{id}</div>
                            <div style={{ fontSize: 18, fontWeight: 600, color: avg >= 7 ? '#10b981' : avg >= 5 ? '#f59e0b' : '#ef4444' }}>
                                {avg.toFixed(1)}/10
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 16 }}>
                <span style={{ color: '#71717a', fontSize: 12, marginRight: 4 }}>Status:</span>
                <button type="button" style={btnStyle(status === 'all')} onClick={() => setStatus('all')}>All {total}</button>
                <button type="button" style={btnStyle(status === 'pass')} onClick={() => setStatus('pass')}>Pass {pass}</button>
                <button type="button" style={btnStyle(status === 'warn')} onClick={() => setStatus('warn')}>Warn {warn}</button>
                <button type="button" style={btnStyle(status === 'fail')} onClick={() => setStatus('fail')}>Fail {fail}</button>
                <span style={{ margin: '0 8px', color: '#404040' }}>|</span>
                <span style={{ color: '#71717a', fontSize: 12, marginRight: 4 }}>Sort:</span>
                <button type="button" style={btnStyle(sort === 'score-desc')} onClick={() => setSort('score-desc')}>Score ↓</button>
                <button type="button" style={btnStyle(sort === 'score-asc')} onClick={() => setSort('score-asc')}>Score ↑</button>
                <button type="button" style={btnStyle(sort === 'id')} onClick={() => setSort('id')}>ID</button>
                <span style={{ margin: '0 8px', color: '#404040' }}>|</span>
                <input
                    type="text"
                    placeholder="Search fixture id..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        background: '#171717',
                        border: '1px solid #262626',
                        color: '#fff',
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontFamily: 'inherit',
                        width: 240,
                    }}
                />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                <span style={{ color: '#71717a', fontSize: 12, alignSelf: 'center', marginRight: 4 }}>Category:</span>
                <button type="button" style={btnStyle(category === 'all')} onClick={() => setCategory('all')}>All</button>
                {categories.map((c) => (
                    <button key={c} type="button" style={btnStyle(category === c)} onClick={() => setCategory(c)}>{c}</button>
                ))}
            </div>

            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 10 }}>
                Showing {filtered.length} / {total}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
                {filtered.map((f) => (
                    <Card key={f.fixtureId} f={f} />
                ))}
            </div>
        </div>
    )
}
