'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { RubricReport, FixtureScore } from '../../../../scripts/test-harness/rubric/rubric.schema'

type StatusFilter = 'all' | 'pass' | 'warn' | 'fail'
type SortBy = 'score-desc' | 'score-asc' | 'id' | 'issues-desc'

interface Props { report: RubricReport }

const DK = {
  bg: '#0a0a0a',
  surface: '#111111',
  border: '#262626',
  text: '#e5e5e5',
  textSub: '#a1a1aa',
  textMuted: '#71717a',
  pass: '#10b981',
  warn: '#f59e0b',
  fail: '#ef4444',
  accent: '#7c3aed',
} as const

const STATUS_COLOR = { pass: DK.pass, warn: DK.warn, fail: DK.fail } as const
const STATUS_BG    = { pass: '#052e16', warn: '#451a03', fail: '#450a0a' } as const
const STATUS_ICON  = { pass: '✓', warn: '⚠', fail: '✗' } as const

// ─── DimBar ───────────────────────────────────────────────────────────────────
/** Horizontal score bar — label + fill + value */
function DimBar({ name, weight, score }: { name: string; weight?: number; score: number }) {
    const pct = score * 10
    const color = score >= 7 ? DK.pass : score >= 5 ? DK.warn : DK.fail
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

// ─── DimensionHealthGrid ──────────────────────────────────────────────────────
/** Richer dimension overview row with target delta indicator */
function DimensionHealthGrid({ perDimensionAvg }: { perDimensionAvg: Record<string, number> }) {
    const TARGET = 7.0
    const sorted = Object.entries(perDimensionAvg).sort(([, a], [, b]) => a - b)
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sorted.map(([id, avg]) => {
                const color = avg >= 7 ? DK.pass : avg >= 5 ? DK.warn : DK.fail
                const delta = avg - TARGET
                const pct = avg * 10
                return (
                    <div key={id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 44px 60px', gap: 8, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
                        <span style={{ fontSize: 10, color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {id}
                        </span>
                        <div style={{ background: '#1a1a1a', height: 8, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
                            {/* target 7.0 marker */}
                            <div style={{ position: 'absolute', top: 0, bottom: 0, left: '70%', width: 1, background: '#52525b' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                            {avg.toFixed(1)}
                        </span>
                        <span style={{
                            fontSize: 10, fontVariantNumeric: 'tabular-nums', textAlign: 'right',
                            color: delta >= 0 ? DK.pass : delta >= -2 ? DK.warn : DK.fail,
                            fontWeight: delta < 0 ? 700 : 400,
                        }}>
                            {delta >= 0 ? '+' : ''}{delta.toFixed(1)} vs 7
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ f }: { f: FixtureScore }) {
    const [openDim, setOpenDim] = useState<string | null>(null)
    const color = STATUS_COLOR[f.status]
    const bg    = STATUS_BG[f.status]
    const isFail = f.status === 'fail'
    const isWarn = f.status === 'warn'

    const failingCriteria = f.dimensions.reduce(
        (sum, d) => sum + d.criteria.filter((c) => c.status !== 'pass').length,
        0,
    )

    const worstDim = [...f.dimensions].sort((a, b) => a.score - b.score)[0]

    return (
        <article
            style={{
                background: isFail ? '#1a0808' : DK.surface,
                border: `1px solid ${isFail ? '#7f1d1d' : isWarn ? '#78350f' : DK.border}`,
                borderLeft: `4px solid ${color}`,
                borderRadius: 10,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
            }}
        >
            {/* ── header row: ID + status + score + issue count ── */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* fixture ID + link */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <a
                            href={f.fixtureId.startsWith('ai-') ? `/test-harness/ai/${f.category}` : `/test-harness/${f.fixtureId}`}
                            target="_blank"
                            style={{ fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace', color: '#60a5fa', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}
                        >
                            {f.fixtureId}
                        </a>
                    </div>
                    {/* status + issue row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', background: '#1a1a1a', borderRadius: 3, color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {f.category}
                        </span>
                        <span style={{ fontSize: 10, padding: '2px 8px', background: bg, color, borderRadius: 4, fontWeight: 700, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span>{STATUS_ICON[f.status]}</span>
                            {f.status.toUpperCase()}
                        </span>
                        {failingCriteria > 0 && (
                            <span style={{
                                fontSize: 11, padding: '2px 8px',
                                background: isFail ? '#7f1d1d' : '#451a03',
                                color: isFail ? '#fca5a5' : '#fcd34d',
                                border: `1px solid ${isFail ? '#991b1b' : '#92400e'}`,
                                borderRadius: 4, fontWeight: 700,
                            }}>
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
                {/* score — large */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{f.weighted.toFixed(1)}</span>
                    <span style={{ fontSize: 11, color: '#71717a' }}>/10</span>
                </div>
            </header>

            {/* ── dimension bars always visible, click to expand criteria ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {f.dimensions.map((d) => {
                    const hasDimIssues = d.criteria.some((c) => c.status !== 'pass')
                    const isOpen = openDim === d.id || (hasDimIssues && (isFail || isWarn))
                    return (
                        <div key={d.id}>
                            <button
                                type="button"
                                onClick={() => setOpenDim(openDim === d.id ? null : d.id)}
                                style={{ width: '100%', background: 'transparent', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
                                title="Click to expand criteria detail"
                            >
                                <DimBar name={d.name} weight={d.weight} score={d.score} />
                            </button>
                            {isOpen && (
                                <ul style={{ listStyle: 'none', margin: '6px 0', padding: '6px 8px', background: '#09090b', borderRadius: 4, fontSize: 10 }}>
                                    {d.criteria.map((c) => (
                                        <li key={c.criterionId} style={{ padding: '3px 0', display: 'grid', gridTemplateColumns: '16px 1fr 40px', gap: 6, borderBottom: '1px solid #1a1a1a' }}>
                                            <span style={{ color: c.status === 'pass' ? DK.pass : c.status === 'partial' ? DK.warn : DK.fail, fontWeight: 700, textAlign: 'center', fontFamily: 'ui-monospace, monospace' }}>
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
                    )
                })}
            </div>
        </article>
    )
}

// ─── NeedsAttentionPanel ──────────────────────────────────────────────────────
/** Sticky left panel: KPI + dimension health overview */
function StickyOverviewPanel({
    total, pass, warn, fail, avgWeighted, perDimensionAvg,
}: {
    total: number; pass: number; warn: number; fail: number; avgWeighted: number; perDimensionAvg: Record<string, number>
}) {
    const needsFix = warn + fail
    return (
        <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 60, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
            {/* KPI mini cards */}
            <div style={{ background: DK.surface, border: `1px solid ${DK.border}`, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: DK.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Overview</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 11, color: DK.textSub }}>Avg score</span>
                        <span style={{ fontSize: 20, fontWeight: 700, color: DK.accent, fontVariantNumeric: 'tabular-nums' }}>{avgWeighted.toFixed(2)}/10</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: DK.textSub }}>Total</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: DK.text }}>{total}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: DK.pass }}>Pass</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: DK.pass, fontVariantNumeric: 'tabular-nums' }}>{pass}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: DK.warn }}>Warn</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: warn > 0 ? DK.warn : DK.textMuted, fontVariantNumeric: 'tabular-nums' }}>{warn}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: DK.fail }}>Fail</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: fail > 0 ? DK.fail : DK.textMuted, fontVariantNumeric: 'tabular-nums' }}>{fail}</span>
                    </div>
                    {needsFix > 0 && (
                        <div style={{ marginTop: 4, padding: '6px 10px', background: fail > 0 ? '#1a0808' : '#1a1000', border: `1px solid ${fail > 0 ? '#7f1d1d' : '#78350f'}`, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: fail > 0 ? '#fca5a5' : '#fcd34d' }}>Needs fix</span>
                            <span style={{ fontSize: 18, fontWeight: 700, color: fail > 0 ? DK.fail : DK.warn, fontVariantNumeric: 'tabular-nums' }}>{needsFix}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Dimension Health */}
            <div style={{ background: DK.surface, border: `1px solid ${DK.border}`, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: DK.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Dimension Health</span>
                    <span style={{ fontSize: 9, color: '#52525b' }}>│ = 7.0 target</span>
                </div>
                <DimensionHealthGrid perDimensionAvg={perDimensionAvg} />
            </div>
        </div>
    )
}

// ─── AdminClient ──────────────────────────────────────────────────────────────
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

    // "Needs Attention" fixtures: fail + warn, sorted score asc (worst first)
    const attentionFixtures = useMemo(
        () => [...report.fixtures]
            .filter((f) => f.status === 'fail' || f.status === 'warn')
            .sort((a, b) => a.weighted - b.weighted),
        [report.fixtures],
    )

    const filterPill = (active: boolean, danger?: boolean, warning?: boolean): React.CSSProperties => ({
        background: active ? (danger ? '#450a0a' : warning ? '#451a03' : '#1e1b4b') : '#171717',
        border: `1px solid ${active ? (danger ? DK.fail : warning ? DK.warn : DK.accent) : DK.border}`,
        color: active ? '#fff' : '#a1a1aa',
        padding: '6px 14px',
        borderRadius: 20,
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap' as const,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontWeight: active ? 700 : 400,
        transition: 'all 0.15s',
    })

    const sortBtn = (active: boolean): React.CSSProperties => ({
        background: active ? '#1e1b4b' : '#171717',
        border: `1px solid ${active ? DK.accent : DK.border}`,
        color: active ? '#fff' : '#a1a1aa',
        padding: '5px 12px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 11,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap' as const,
    })

    return (
        <div style={{ background: DK.bg, color: DK.text, minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

            {/* ── sticky header ── */}
            <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#0d0d0d', borderBottom: '1px solid #262626', padding: '10px 24px' }}>
                <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Debug Console</span>
                        <span style={{ fontSize: 11, color: '#71717a' }}>
                            Rubric {report.rubric.name} · scored {new Date(report.generatedAt).toLocaleString()}
                        </span>
                        {fail > 0 && (
                            <span style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #dc2626', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                                {fail} fail · needs fix
                            </span>
                        )}
                    </div>
                    <Link href="/test-harness" style={{ color: '#60a5fa', fontSize: 12, textDecoration: 'none' }}>
                        ← Blueprint Gallery
                    </Link>
                </div>
            </div>

            <div style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 24px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>

                {/* ── left sticky panel ── */}
                <StickyOverviewPanel
                    total={total}
                    pass={pass}
                    warn={warn}
                    fail={fail}
                    avgWeighted={avgWeighted}
                    perDimensionAvg={perDimensionAvg}
                />

                {/* ── right main panel ── */}
                <div style={{ flex: 1, minWidth: 0 }}>

                    {/* ── Needs Attention section ── */}
                    {attentionFixtures.length > 0 && (
                        <section style={{ marginBottom: 24 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                background: '#1a0808', border: '1px solid #7f1d1d',
                                borderRadius: '8px 8px 0 0', padding: '10px 16px',
                            }}>
                                <span style={{ fontSize: 14 }}>⚠</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5' }}>Needs Attention</span>
                                {fail > 0 && (
                                    <span style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #dc2626', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                                        {fail} fail
                                    </span>
                                )}
                                {warn > 0 && (
                                    <span style={{ background: '#451a03', color: '#fcd34d', border: '1px solid #92400e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                                        {warn} warn
                                    </span>
                                )}
                                <span style={{ fontSize: 11, color: '#a1a1aa', marginLeft: 4 }}>sorted worst-first · fix priority queue</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10, padding: '12px 0', background: '#0f0808', border: '1px solid #7f1d1d', borderTop: 0, borderRadius: '0 0 8px 8px', paddingInline: 12 }}>
                                {attentionFixtures.map((f) => (
                                    <Card key={`att-${f.fixtureId}`} f={f} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── filter bar ── */}
                    <div style={{ background: DK.surface, border: `1px solid ${DK.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                        {/* row 1: status filter — big pill buttons */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ fontSize: 10, color: DK.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 2 }}>Status</span>
                            <button type="button" style={filterPill(status === 'all')} onClick={() => setStatus('all')}>
                                All <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{total}</span>
                            </button>
                            <button type="button" style={filterPill(status === 'pass')} onClick={() => setStatus('pass')}>
                                <span style={{ color: status === 'pass' ? DK.pass : '#52525b' }}>✓</span> Pass <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: DK.pass }}>{pass}</span>
                            </button>
                            <button type="button" style={filterPill(status === 'warn', false, true)} onClick={() => setStatus('warn')}>
                                <span style={{ color: status === 'warn' ? DK.warn : '#52525b' }}>⚠</span> Warn <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: DK.warn }}>{warn}</span>
                            </button>
                            <button type="button" style={filterPill(status === 'fail', true)} onClick={() => setStatus('fail')}>
                                <span style={{ color: status === 'fail' ? DK.fail : '#52525b' }}>✗</span> Fail <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: DK.fail }}>{fail}</span>
                            </button>
                            {/* sort controls */}
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: DK.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 2 }}>Sort</span>
                                <button type="button" style={sortBtn(sort === 'score-desc')} onClick={() => setSort('score-desc')}>Score ↓</button>
                                <button type="button" style={sortBtn(sort === 'score-asc')} onClick={() => setSort('score-asc')}>Score ↑</button>
                                <button type="button" style={sortBtn(sort === 'issues-desc')} onClick={() => setSort('issues-desc')}>Issues ↓</button>
                                <button type="button" style={sortBtn(sort === 'id')} onClick={() => setSort('id')}>ID A–Z</button>
                            </div>
                        </div>
                        {/* row 2: category + search */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: DK.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 2 }}>Category</span>
                            <button type="button" style={sortBtn(category === 'all')} onClick={() => setCategory('all')}>All</button>
                            {categories.map((c) => {
                                const catFail = report.fixtures.filter((f) => f.category === c && f.status === 'fail').length
                                const catWarn = report.fixtures.filter((f) => f.category === c && f.status === 'warn').length
                                const hasFail = catFail > 0
                                const hasWarn = catWarn > 0
                                return (
                                    <button key={c} type="button" style={{
                                        ...sortBtn(category === c),
                                        background: category === c ? (hasFail ? '#450a0a' : hasWarn ? '#451a03' : '#1e1b4b') : (hasFail ? '#1a0808' : hasWarn ? '#1a1000' : '#171717'),
                                        border: `1px solid ${hasFail ? '#991b1b' : hasWarn ? '#92400e' : (category === c ? DK.accent : DK.border)}`,
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                    }} onClick={() => setCategory(c)}>
                                        {hasFail && <span style={{ width: 5, height: 5, borderRadius: '50%', background: DK.fail, display: 'inline-block', flexShrink: 0 }} />}
                                        {!hasFail && hasWarn && <span style={{ width: 5, height: 5, borderRadius: '50%', background: DK.warn, display: 'inline-block', flexShrink: 0 }} />}
                                        {c}
                                        {catFail > 0 && <span style={{ fontSize: 9, color: '#fca5a5', fontWeight: 700 }}>{catFail}F</span>}
                                        {catWarn > 0 && <span style={{ fontSize: 9, color: '#fcd34d' }}>{catWarn}W</span>}
                                    </button>
                                )
                            })}
                            {/* search — full width end */}
                            <div style={{ marginLeft: 'auto' }}>
                                <input
                                    type="text"
                                    placeholder="Search fixture ID..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{
                                        background: DK.bg, border: `1px solid ${DK.border}`, color: DK.text,
                                        padding: '7px 12px', borderRadius: 8, fontSize: 13,
                                        fontFamily: 'ui-monospace, monospace', width: 260,
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ fontSize: 11, color: DK.textMuted, marginBottom: 12 }}>
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
        </div>
    )
}
