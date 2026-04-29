/**
 * AI Gen Test Harness — Blueprint Gallery (QC Overview)
 *
 * Lists all 56 blueprint presets (deduped to seed=0) in a dark-mode grid.
 * Per-card: rubric score bar, status border, weakest dimension inline.
 * Per-category: health summary chips (X pass / Y warn / Z fail).
 *
 * Run locally:
 *   npm run harness:gen            # writes .harness-out/matrix.json
 *   ENABLE_HARNESS=1 npm run dev   # includes .harness.tsx routes
 *   open http://localhost:3000/test-harness
 */

import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { TriagePanel } from './_components/triage-panel.harness-client'
import type { MatrixReport, HarnessResult } from '../../../scripts/test-harness/types'
import { readReport, loadRubric } from '../../../scripts/test-harness/rubric/scorer-lib'
import type { FixtureScore, DimensionScore } from '../../../scripts/test-harness/rubric/rubric.schema'
import { getFixHint } from '../../../scripts/test-harness/rubric/fix-hints'

export const dynamic = 'force-dynamic'

// ─── dark theme tokens ────────────────────────────────────────────────────────
const DK = {
  bg: '#0a0a0a',
  surface: '#111111',
  surfaceHover: '#161616',
  border: '#262626',
  borderStrong: '#3f3f46',
  text: '#f5f5f5',
  textSub: '#a1a1aa',
  textMuted: '#71717a',
  pass: '#10b981',
  warn: '#f59e0b',
  fail: '#ef4444',
  accent: '#7c3aed',
  ai: { bg: '#0f0a2e', card: '#13103a', border: '#4c1d95', text: '#c4b5fd', sub: '#8b5cf6' },
} as const

// ─── data types ───────────────────────────────────────────────────────────────
type BlueprintCard = {
  fixtureId: string
  category: string
  presetName: string
  blockCount: number
  blockTypes: string[]
  firstSeedResult: HarnessResult
  score?: FixtureScore
}

type AiCacheMeta = { cachedAt: string; siteName: string; blocksCount: number }

// ─── data loaders (no rendering) ─────────────────────────────────────────────
function loadMatrix(): MatrixReport | null {
  const p = path.resolve(process.cwd(), '.harness-out/matrix.json')
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) as MatrixReport } catch { return null }
}

function pickUniqueBlueprints(matrix: MatrixReport, scoreMap: Map<string, FixtureScore>): BlueprintCard[] {
  const byPreset = new Map<string, HarnessResult>()
  for (const r of matrix.results) {
    if (r.fixture.source !== 'blueprint') continue
    const idx = r.fixture.presetIndex
    if (idx === undefined) continue
    const key = `${r.fixture.category}:${idx}`
    const ex = byPreset.get(key)
    if (!ex || r.fixture.compositionSeed < ex.fixture.compositionSeed) byPreset.set(key, r)
  }
  return Array.from(byPreset.values())
    .map((r) => ({
      fixtureId: r.fixture.id,
      category: r.fixture.category,
      presetName: r.fixture.id.replace(/-seed\d+$/, '').replace(`${r.fixture.category}-blueprint-`, ''),
      blockCount: r.blocks.length,
      blockTypes: r.blocks.map((b) => b.blockType),
      firstSeedResult: r,
      score: scoreMap.get(r.fixture.id),
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.presetName.localeCompare(b.presetName))
}

function readAiCachedMap(): Map<string, AiCacheMeta> {
  const dir = path.resolve(process.cwd(), '.harness-out/ai-cache')
  const out = new Map<string, AiCacheMeta>()
  if (!fs.existsSync(dir)) return out
  try {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue
      const cat = file.replace(/\.json$/, '')
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as {
          cachedAt?: string; output?: { siteName?: string; blocks?: unknown[] }; siteName?: string; blocks?: unknown[]
        }
        const o = raw.output ?? raw
        const stat = fs.statSync(path.join(dir, file))
        out.set(cat, { cachedAt: raw.cachedAt ?? stat.mtime.toISOString(), siteName: (o.siteName as string) ?? '(unnamed)', blocksCount: Array.isArray(o.blocks) ? o.blocks.length : 0 })
      } catch { /* skip malformed */ }
    }
  } catch { /* skip dir read error */ }
  return out
}

function timeAgo(iso: string): string {
  if (iso === 'legacy-cache') return 'legacy'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'unknown'
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function weakestDim(score?: FixtureScore): DimensionScore | null {
  if (!score?.dimensions.length) return null
  return [...score.dimensions].sort((a, b) => a.score - b.score)[0]
}

// ─── mini components ──────────────────────────────────────────────────────────

/** 8px colored dot indicating rubric status */
function StatusDot({ score }: { score?: FixtureScore }) {
  const color = !score ? '#404040' : score.status === 'pass' ? DK.pass : score.status === 'warn' ? DK.warn : DK.fail
  const title = score ? `${score.status}: ${score.weighted.toFixed(1)}/10` : 'no rubric score'
  return (
    <span
      title={title}
      style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}
    />
  )
}

/** Thin score progress bar — always visible under preset name */
function ScoreBar({ score }: { score?: FixtureScore }) {
  if (!score) return null
  const color = score.status === 'pass' ? DK.pass : score.status === 'warn' ? DK.warn : DK.fail
  return (
    <div style={{ height: 3, background: DK.border, borderRadius: 2, overflow: 'hidden', margin: '5px 0 7px' }}>
      <div style={{ height: '100%', width: `${score.weighted * 10}%`, background: color }} />
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function HarnessIndexPage() {
  const matrix = loadMatrix()

  if (!matrix) {
    return (
      <div style={{ background: DK.bg, color: DK.text, minHeight: '100vh', padding: 40, fontFamily: 'ui-monospace, monospace' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Harness matrix not found</h1>
        <p style={{ color: DK.textSub }}>
          Run{' '}
          <code style={{ background: '#1c1c1c', padding: '2px 8px', borderRadius: 4 }}>npm run harness:gen</code>
          {' '}to generate{' '}
          <code style={{ background: '#1c1c1c', padding: '2px 8px', borderRadius: 4 }}>.harness-out/matrix.json</code>
        </p>
      </div>
    )
  }

  const report = readReport()
  const scoreMap = new Map<string, FixtureScore>()
  if (report) report.fixtures.forEach((f) => scoreMap.set(f.fixtureId, f))

  const aiCacheMap = readAiCachedMap()
  const aiCached = new Set(aiCacheMap.keys())
  const blueprints = pickUniqueBlueprints(matrix, scoreMap)
  const categories = Array.from(new Set(blueprints.map((b) => b.category))).sort()

  const rubric = (() => { try { return loadRubric() } catch { return null } })()
  const dimDescriptions = new Map<string, string>()
  if (rubric) for (const d of rubric.dimensions) dimDescriptions.set(d.id, d.description ?? '')

  const totalFixtures = matrix.results.length
  const blueprintCount = matrix.results.filter((r) => r.fixture.source === 'blueprint').length
  const legacyCount = totalFixtures - blueprintCount
  const rubricAvg = report?.summary.avgWeighted ?? null
  const rubricPass = report?.summary.pass ?? 0
  const rubricWarn = report?.summary.warn ?? 0
  const rubricFail = report?.summary.fail ?? 0

  return (
    <div style={{ background: DK.bg, color: DK.text, minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── sticky top bar ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#0d0d0d', borderBottom: `1px solid ${DK.border}`, padding: '10px 24px' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Blueprint Gallery</span>
            <span style={{ fontSize: 11, color: DK.textMuted }}>
              {blueprints.length} blueprints · {categories.length} categories · {totalFixtures} fixtures ({blueprintCount} blueprint + {legacyCount} legacy)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: DK.pass, fontWeight: 600 }}>{rubricPass} pass</span>
              <span style={{ color: DK.border, margin: '0 6px' }}>·</span>
              <span style={{ color: rubricWarn > 0 ? DK.warn : DK.textMuted, fontWeight: rubricWarn > 0 ? 600 : 400 }}>{rubricWarn} warn</span>
              <span style={{ color: DK.border, margin: '0 6px' }}>·</span>
              <span style={{ color: rubricFail > 0 ? DK.fail : DK.textMuted, fontWeight: rubricFail > 0 ? 700 : 400 }}>{rubricFail} fail</span>
            </span>
            {rubricAvg !== null && (
              <span style={{ fontSize: 15, fontWeight: 700, color: DK.accent, fontVariantNumeric: 'tabular-nums' }}>{rubricAvg.toFixed(2)}/10</span>
            )}
            <Link href="/test-harness/admin" style={{ background: DK.accent, color: '#fff', padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Debug Console →
            </Link>
            <TriagePanel totalCount={blueprints.length} fixtureIds={blueprints.map((b) => b.fixtureId)} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 24px' }}>

        {/* ── KPI cards ── */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
          {([
            { label: 'Rubric Avg', value: rubricAvg !== null ? `${rubricAvg.toFixed(2)}/10` : '—', sub: report ? `rubric ${report.rubric?.name ?? ''}` : 'run harness:score', color: DK.accent },
            { label: 'Pass ≥ 7.0', value: rubricPass, sub: 'score distribution', color: DK.pass },
            { label: 'Warn 5–6.9', value: rubricWarn, sub: 'score distribution', color: DK.warn },
            { label: 'Fail < 5.0', value: rubricFail, sub: rubricFail === 0 ? 'none — clean' : 'needs fix!', color: rubricFail > 0 ? DK.fail : DK.textMuted },
            { label: 'Harness Errors', value: matrix.summary.composerErrors, sub: matrix.summary.composerErrors === 0 ? '0 compose failures' : 'needs fix', color: matrix.summary.composerErrors > 0 ? DK.fail : DK.pass },
          ] as const).map((s) => (
            <div key={s.label} style={{ background: DK.surface, border: `1px solid ${DK.border}`, borderTop: `3px solid ${s.color}`, borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: DK.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: DK.textMuted, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </section>

        {/* ── category jump chips ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: DK.textMuted, marginRight: 4 }}>Jump to:</span>
          {categories.map((c) => {
            const catBps = blueprints.filter((b) => b.category === c)
            const hasIssues = catBps.some((b) => b.score && b.score.status !== 'pass')
            const cached = aiCached.has(c)
            return (
              <a
                key={c}
                href={`#cat-${c}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 20, fontSize: 11,
                  textDecoration: 'none', transition: 'opacity 0.15s',
                  background: hasIssues ? '#1f1008' : '#1a1a1a',
                  border: `1px solid ${hasIssues ? '#5c3010' : DK.border}`,
                  color: hasIssues ? '#fcd34d' : DK.textSub,
                  fontWeight: hasIssues ? 600 : 400,
                }}
              >
                {hasIssues && <span style={{ width: 5, height: 5, borderRadius: '50%', background: DK.warn, display: 'inline-block', flexShrink: 0 }} />}
                {c} ({catBps.length})
                {cached && <span style={{ fontSize: 9, background: DK.accent, color: '#fff', padding: '1px 5px', borderRadius: 3 }}>AI</span>}
              </a>
            )
          })}
        </div>

        {/* ── AI-First Gen section ── */}
        <section style={{ marginBottom: 24, background: DK.ai.bg, border: `1px solid ${DK.ai.border}`, borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: DK.ai.text, margin: 0 }}>AI-First Gen · Real OpenAI per business</h2>
              <p style={{ fontSize: 11, color: DK.ai.sub, margin: '4px 0 0', lineHeight: 1.5 }}>
                GPT-4o personalizes hero + SEO per business sample. Cached = instant; Fresh = 5–15s, costs $.
                Each page has <strong style={{ color: DK.ai.text }}>Inspect Prompts + Output</strong> drawer bottom-right.
              </p>
            </div>
            <span style={{ flexShrink: 0, background: DK.accent, color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 4, letterSpacing: 0.5, fontFamily: 'ui-monospace, monospace' }}>COSTS $</span>
          </div>

          {aiCacheMap.size > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: DK.ai.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Cached ({aiCacheMap.size} gen&apos;d)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {Array.from(aiCacheMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([cat, meta]) => (
                  <Link
                    key={`ai-cached-${cat}`}
                    href={`/test-harness/ai/${cat}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', flexDirection: 'column', gap: 3, borderRadius: 6, padding: '10px 12px', background: DK.ai.card, border: `1px solid ${DK.ai.border}`, color: DK.ai.text, textDecoration: 'none' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{cat}</span>
                      <span style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: DK.ai.sub }}>{meta.blocksCount} blk</span>
                    </div>
                    <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#a78bfa' }} title={meta.siteName}>{meta.siteName}</div>
                    <div style={{ fontSize: 10, color: '#6d28d9', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{timeAgo(meta.cachedAt)}</span>
                      <span>↗ open + prompts</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {categories.filter((c) => !aiCached.has(c)).length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: DK.ai.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Fresh — {categories.filter((c) => !aiCached.has(c)).length} not yet gen&apos;d (clicking fires OpenAI call)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {categories.filter((c) => !aiCached.has(c)).map((c) => (
                  <Link
                    key={`ai-fresh-${c}`}
                    href={`/test-harness/ai/${c}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'ui-monospace, monospace', textTransform: 'capitalize', textDecoration: 'none', background: '#07051a', color: DK.ai.sub, border: `1px solid ${DK.ai.border}` }}
                    title="Fresh — sẽ gọi OpenAI (5–15s, tốn $)"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Template-First heading ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Template-First Blueprints</h2>
          <span style={{ background: '#052e16', color: '#34d399', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Free · Instant</span>
          <span style={{ fontSize: 12, color: DK.textMuted }}>— composer output, no GPT, click card to render</span>
        </div>

        {/* ── Category sections ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {categories.map((cat) => {
            const catBps = blueprints.filter((b) => b.category === cat)
            const catScored = catBps.map((b) => b.score).filter((s): s is FixtureScore => !!s)
            const catPass = catScored.filter((s) => s.status === 'pass').length
            const catWarn = catScored.filter((s) => s.status === 'warn').length
            const catFail = catScored.filter((s) => s.status === 'fail').length
            const catAvg = catScored.length ? catScored.reduce((s, x) => s + x.weighted, 0) / catScored.length : null
            const cached = aiCached.has(cat)
            const hasIssues = catWarn + catFail > 0

            return (
              <section key={cat} id={`cat-${cat}`} style={{ scrollMarginTop: 60 }}>
                {/* category header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${hasIssues ? '#3d2010' : DK.border}`, paddingBottom: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize', color: '#fff', margin: 0 }}>{cat}</h3>
                  <span style={{ fontSize: 11, color: DK.textMuted }}>{catBps.length} presets</span>
                  {catAvg !== null && (
                    <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: DK.textMuted }}>avg {catAvg.toFixed(2)}/10</span>
                  )}
                  {/* health chips */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {catPass > 0 && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#052e16', color: DK.pass, fontWeight: 600 }}>{catPass} pass</span>}
                    {catWarn > 0 && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#451a03', color: DK.warn, fontWeight: 700 }}>{catWarn} warn</span>}
                    {catFail > 0 && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#450a0a', color: DK.fail, fontWeight: 700 }}>{catFail} fail</span>}
                  </div>
                  {/* AI gen link */}
                  <Link
                    href={`/test-harness/ai/${cat}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 5, fontSize: 10, fontFamily: 'ui-monospace, monospace', textDecoration: 'none', background: cached ? DK.ai.card : DK.surface, color: cached ? DK.ai.text : DK.textMuted, border: `1px solid ${cached ? DK.ai.border : DK.border}` }}
                  >
                    {cached ? 'CACHED' : 'FRESH'} · AI gen {cat} →
                  </Link>
                </div>

                {/* blueprint cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                  {catBps.map((bp) => {
                    const weakest = weakestDim(bp.score)
                    const statusColor = bp.score
                      ? bp.score.status === 'pass' ? DK.pass : bp.score.status === 'warn' ? DK.warn : DK.fail
                      : '#404040'

                    return (
                      <div
                        key={bp.fixtureId}
                        style={{
                          background: DK.surface,
                          border: `1px solid ${DK.border}`,
                          borderLeft: `3px solid ${statusColor}`,
                          borderRadius: 8,
                          padding: '12px 14px',
                        }}
                      >
                        {/* card header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <StatusDot score={bp.score} />
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#f5f5f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {bp.presetName}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {bp.score && (
                              <span style={{ fontSize: 17, fontWeight: 700, color: statusColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                                {bp.score.weighted.toFixed(1)}
                              </span>
                            )}
                            <span style={{ fontSize: 10, color: DK.textMuted, background: '#1a1a1a', border: `1px solid ${DK.border}`, padding: '2px 6px', borderRadius: 4 }}>
                              {bp.blockCount} blk
                            </span>
                          </div>
                        </div>

                        <ScoreBar score={bp.score} />

                        {/* block list */}
                        <div style={{ fontSize: 10, color: DK.textMuted, marginBottom: 8, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {bp.blockTypes.slice(0, 8).join(' › ')}
                          {bp.blockTypes.length > 8 ? ` › +${bp.blockTypes.length - 8}` : ''}
                        </div>

                        {weakest && (
                          <WeakestDrawer dim={weakest} description={dimDescriptions.get(weakest.id) ?? ''} />
                        )}

                        {/* actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Link
                            href={`/test-harness/${bp.fixtureId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 5, fontSize: 11, textDecoration: 'none', background: '#1a1a1a', border: `1px solid ${DK.border}`, color: DK.textSub }}
                          >
                            Open render ↗
                          </Link>
                          <span data-triage-slot={bp.fixtureId} style={{ marginLeft: 'auto', fontSize: 11, color: DK.textMuted }}>
                            verdict?
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── WeakestDrawer ────────────────────────────────────────────────────────────
/**
 * Expandable weakest-dimension breakdown — uses native <details> so no JS.
 * Dark mode version: shows issue count badge in summary; full criteria list in body.
 */
function WeakestDrawer({ dim, description }: { dim: DimensionScore; description: string }) {
  const weakColor = dim.score < 6 ? DK.fail : dim.score < 7.5 ? DK.warn : '#71717a'
  const failed = [...dim.criteria]
    .filter((c) => c.points < c.maxPoints)
    .sort((a, b) => (b.maxPoints - b.points) - (a.maxPoints - a.points))
  const criterionIcon = (status: 'pass' | 'partial' | 'fail') =>
    status === 'fail' ? '✗' : status === 'partial' ? '◐' : '✓'

  return (
    <details
      style={{ borderRadius: 5, border: `1px solid ${weakColor}40`, background: weakColor + '12', fontSize: 10, marginBottom: 8 }}
    >
      <summary
        style={{ padding: '5px 8px', cursor: 'pointer', listStyle: 'none', color: weakColor, display: 'flex', alignItems: 'center', gap: 5, outline: 'none' }}
      >
        <span>▶</span>
        Weakest: <strong style={{ marginLeft: 2 }}>{dim.name}</strong>
        <span style={{ marginLeft: 4, opacity: 0.8 }}>{dim.score.toFixed(1)}/10</span>
        {failed.length > 0 && (
          <span style={{ marginLeft: 6, background: weakColor + '30', padding: '1px 5px', borderRadius: 3 }}>
            {failed.length} issue{failed.length > 1 ? 's' : ''} — expand to fix
          </span>
        )}
      </summary>
      <div style={{ padding: 8, background: '#0d0d0d', borderTop: `1px solid ${weakColor}30` }}>
        {description && (
          <div style={{ marginBottom: 6, padding: '4px 8px', background: '#1a1a1a', borderRadius: 4, color: '#a1a1aa', lineHeight: 1.5 }}>
            <strong style={{ color: '#d4d4d8' }}>Measures:</strong> {description}
          </div>
        )}
        {failed.length > 0 ? (
          <div>
            <div style={{ marginBottom: 5, fontWeight: 600, color: '#d4d4d8' }}>
              Lost points ({failed.length} criteria) — fix priority top-down:
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {failed.slice(0, 5).map((c) => {
                const hint = getFixHint(c.criterionId)
                return (
                  <li
                    key={c.criterionId}
                    style={{ padding: '4px 8px', borderRadius: 4, background: c.status === 'fail' ? '#1a0808' : '#1a1000', display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: c.status === 'fail' ? '#fca5a5' : '#fcd34d', fontWeight: 500 }}>
                        <span style={{ fontFamily: 'ui-monospace, monospace', marginRight: 4 }}>{criterionIcon(c.status)}</span>
                        {c.label}
                      </span>
                      <span style={{ fontSize: 9, color: DK.textMuted, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>{c.points}/{c.maxPoints}</span>
                    </div>
                    {c.reason && (
                      <div style={{ color: '#71717a', fontSize: 9, fontStyle: 'italic' }}>{c.reason}</div>
                    )}
                    {hint && (
                      <div style={{ background: '#0c1a2e', color: '#93c5fd', padding: '3px 6px', borderRadius: 3, borderLeft: '2px solid #3b82f6', marginTop: 2 }}>
                        Fix: {hint}
                      </div>
                    )}
                  </li>
                )
              })}
              {failed.length > 5 && (
                <li style={{ fontSize: 9, color: DK.textMuted, padding: '2px 4px' }}>
                  +{failed.length - 5} more issues — see Debug Console for full list
                </li>
              )}
            </ul>
          </div>
        ) : (
          <div style={{ color: DK.pass }}>All criteria passed — dim scored {dim.score.toFixed(1)}/10</div>
        )}
      </div>
    </details>
  )
}
