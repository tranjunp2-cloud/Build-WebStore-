/**
 * AI Gen Test Harness — index route (Phase 01 of plan 260419-2231).
 *
 * Lists all blueprint fixtures (deduped to seed=0) in a grid so PM can eyeball
 * 56 blueprints in one sitting + tag triage verdicts. If a rubric score report
 * exists (`.harness-out/report.json` from staging scorer), per-card status dot
 * surfaces pass/warn/fail to help PM prioritize attention.
 *
 * Gated same way as `/test-harness/[fixtureId]`: only loaded when
 * `ENABLE_HARNESS=1` (see next.config.ts pageExtensions).
 *
 * Run locally:
 *   npm run harness:gen            # writes .harness-out/matrix.json
 *   ENABLE_HARNESS=1 npm run dev   # includes this file in routes
 *   open http://localhost:3000/test-harness
 */

import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TriagePanel } from './_components/triage-panel.harness-client'
import type { MatrixReport, HarnessResult } from '../../../scripts/test-harness/types'
import { readReport, loadRubric } from '../../../scripts/test-harness/rubric/scorer-lib'
import type { FixtureScore, DimensionScore } from '../../../scripts/test-harness/rubric/rubric.schema'
import { getFixHint } from '../../../scripts/test-harness/rubric/fix-hints'

export const dynamic = 'force-dynamic'

type BlueprintCard = {
  fixtureId: string
  category: string
  presetName: string
  blockCount: number
  blockTypes: string[]
  firstSeedResult: HarnessResult
  score?: FixtureScore
}

function loadMatrix(): MatrixReport | null {
  const matrixPath = path.resolve(process.cwd(), '.harness-out/matrix.json')
  if (!fs.existsSync(matrixPath)) return null
  try {
    const raw = fs.readFileSync(matrixPath, 'utf8')
    return JSON.parse(raw) as MatrixReport
  } catch {
    return null
  }
}

function pickUniqueBlueprints(matrix: MatrixReport, scoreMap: Map<string, FixtureScore>): BlueprintCard[] {
  const byPreset = new Map<string, HarnessResult>()
  for (const r of matrix.results) {
    if (r.fixture.source !== 'blueprint') continue
    const presetIndex = r.fixture.presetIndex
    if (presetIndex === undefined) continue
    const key = `${r.fixture.category}:${presetIndex}`
    const existing = byPreset.get(key)
    if (!existing || r.fixture.compositionSeed < existing.fixture.compositionSeed) {
      byPreset.set(key, r)
    }
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

function scoreDot(score?: FixtureScore): string {
  if (!score) return '⚪'
  return score.status === 'pass' ? '🟢' : score.status === 'warn' ? '🟡' : '🔴'
}

/** Lowest-scoring dimension — signal area for improvement, full DimensionScore for detail drill-down. */
function weakestDim(score?: FixtureScore): DimensionScore | null {
  if (!score || !score.dimensions.length) return null
  const sorted = [...score.dimensions].sort((a, b) => a.score - b.score)
  return sorted[0]
}

type AiCacheMeta = {
  cachedAt: string
  siteName: string
  blocksCount: number
}

/** Read AI cache dir — returns map category → meta (null if dir empty). */
function readAiCachedMap(): Map<string, AiCacheMeta> {
  const dir = path.resolve(process.cwd(), '.harness-out/ai-cache')
  const out = new Map<string, AiCacheMeta>()
  if (!fs.existsSync(dir)) return out
  try {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue
      const category = file.replace(/\.json$/, '')
      try {
        const full = path.join(dir, file)
        const raw = JSON.parse(fs.readFileSync(full, 'utf8')) as {
          cachedAt?: string
          output?: { siteName?: string; blocks?: unknown[] }
          siteName?: string
          blocks?: unknown[]
        }
        // v2 wrapped (input/output/cachedAt) or v1 legacy (flat GenerationResult)
        const out_ = raw.output ?? (raw as { siteName?: string; blocks?: unknown[] })
        const stat = fs.statSync(full)
        out.set(category, {
          cachedAt: raw.cachedAt ?? stat.mtime.toISOString(),
          siteName: (out_.siteName as string) ?? '(unnamed)',
          blocksCount: Array.isArray(out_.blocks) ? out_.blocks.length : 0,
        })
      } catch {
        // skip malformed file
      }
    }
  } catch {
    // skip dir read error
  }
  return out
}

/** Short relative time — "2h ago", "3d ago". */
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

export default function HarnessIndexPage() {
  const matrix = loadMatrix()

  if (!matrix) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace' }}>
        <h1>harness matrix not found</h1>
        <p>
          Run <code>npm run harness:gen</code> first to generate{' '}
          <code>.harness-out/matrix.json</code>.
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

  // Rubric dimension descriptions — explains what each dim measures, helps team know
  // what to fix when a dim scores low. Loaded once per request; rubric is memoized.
  const rubric = (() => {
    try {
      return loadRubric()
    } catch {
      return null
    }
  })()
  const dimDescriptions = new Map<string, string>()
  if (rubric) {
    for (const d of rubric.dimensions) dimDescriptions.set(d.id, d.description ?? '')
  }

  const totalFixtures = matrix.results.length
  const blueprintCount = matrix.results.filter((r) => r.fixture.source === 'blueprint').length
  const legacyCount = totalFixtures - blueprintCount
  const rubricAvg = report?.summary.avgWeighted ?? null
  const rubricPass = report?.summary.pass ?? 0
  const rubricWarn = report?.summary.warn ?? 0
  const rubricFail = report?.summary.fail ?? 0

  const statCard: React.CSSProperties = {
    background: 'hsl(var(--card, 0 0% 100%))',
    border: '1px solid hsl(var(--border, 214 32% 91%))',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  }
  const statLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: 'hsl(var(--muted-foreground, 215 16% 47%))',
  }
  const statValue: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
  }
  const statSubtle: React.CSSProperties = {
    fontSize: 11,
    color: 'hsl(var(--muted-foreground, 215 16% 47%))',
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* HEADER — compact, single row. Stats row below. */}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">Template Quality Triage</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {blueprints.length} blueprints · {categories.length} categories · {totalFixtures} fixtures ({blueprintCount} blueprint + {legacyCount} legacy)
            {' · '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">plans/260419-2231-GH-1-per-template-quality-fix</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/test-harness/admin"
            className="inline-flex items-center rounded-md px-3 py-2 text-xs font-semibold no-underline shadow-sm transition"
            style={{ background: '#7c3aed', color: '#fff' }}
          >
            📊 Admin Dashboard
          </Link>
          <TriagePanel totalCount={blueprints.length} fixtureIds={blueprints.map((b) => b.fixtureId)} />
        </div>
      </header>

      {/* STATS ROW — 5 KPI cards: overall health signal at a glance. */}
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div style={statCard}>
          <span style={statLabel}>Rubric Avg</span>
          <span style={{ ...statValue, color: '#7c3aed' }}>
            {rubricAvg !== null ? `${rubricAvg.toFixed(2)}/10` : '—'}
          </span>
          <span style={statSubtle}>{report ? `wix-pro ${report.rubric?.name ?? ''}` : 'score missing'}</span>
        </div>
        <div style={statCard}>
          <span style={statLabel}>Score Distribution</span>
          <span style={statValue}>
            <span style={{ color: '#10b981' }}>{rubricPass}</span>
            <span style={{ ...statSubtle, margin: '0 4px' }}>·</span>
            <span style={{ color: '#f59e0b' }}>{rubricWarn}</span>
            <span style={{ ...statSubtle, margin: '0 4px' }}>·</span>
            <span style={{ color: '#ef4444' }}>{rubricFail}</span>
          </span>
          <span style={statSubtle}>🟢 pass · 🟡 warn · 🔴 fail</span>
        </div>
        <div style={statCard}>
          <span style={statLabel}>AI Cached</span>
          <span style={statValue}>
            {aiCached.size}<span style={statSubtle}> / {categories.length}</span>
          </span>
          <span style={statSubtle}>💾 ready · ✨ costs $</span>
        </div>
        <div style={statCard}>
          <span style={statLabel}>Blueprints to Review</span>
          <span style={statValue}>{blueprints.length}</span>
          <span style={statSubtle}>OK / Minor / Major (counter top-right)</span>
        </div>
        <div style={statCard}>
          <span style={statLabel}>Harness Errors</span>
          <span style={{ ...statValue, color: matrix.summary.composerErrors > 0 ? '#ef4444' : '#10b981' }}>
            {matrix.summary.composerErrors}
          </span>
          <span style={statSubtle}>{matrix.summary.composerErrors === 0 ? '0 compose failures' : 'needs fix'}</span>
        </div>
      </section>

      {/* QUICK LEGEND + CATEGORY CHIPS */}
      <section className="mb-5 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold">Rubric:</span>
        <span>🟢 pass</span>
        <span>🟡 warn</span>
        <span>🔴 fail</span>
        <span>⚪ none</span>
        <span className="mx-2 text-muted-foreground">·</span>
        <span className="font-semibold">Categories:</span>
        {categories.map((c) => {
          const count = blueprints.filter((b) => b.category === c).length
          const cached = aiCached.has(c)
          return (
            <a
              key={c}
              href={`#cat-${c}`}
              className="rounded-md px-2 py-0.5 text-xs no-underline hover:opacity-80"
              style={{
                background: cached ? '#ede9fe' : 'hsl(var(--muted, 210 40% 96%))',
                color: cached ? '#4c1d95' : 'hsl(var(--muted-foreground, 215 16% 47%))',
                fontWeight: cached ? 600 : 400,
              }}
              title={cached ? 'AI cached — scroll to section' : 'AI not cached'}
            >
              {cached ? '💾' : ''} {c} ({count})
            </a>
          )
        })}
      </section>

      {/* AI-FIRST — distinct purple panel. Cached = mini card with meta; fresh = pill */}
      <section
        className="mb-6 rounded-lg p-4"
        style={{ background: '#faf5ff', border: '1.5px solid #d8b4fe' }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#581c87' }}>
              🤖 AI-First Gen · Real OpenAI per business
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: '#6b21a8' }}>
              GPT-4o personalizes content per business sample · click 💾 card to open cached output (instant) or ✨ pill to trigger fresh gen (5–15s, costs $) · opened page has <strong>Inspect Prompts + Output</strong> drawer bottom-right
            </p>
          </div>
          <span
            className="shrink-0 rounded px-2 py-1 text-[10px] font-mono font-semibold"
            style={{ background: '#7c3aed', color: '#fff' }}
          >
            COSTS $
          </span>
        </div>
        {aiCacheMap.size > 0 && (
          <div className="mb-3">
            <div
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: '#581c87' }}
            >
              💾 Cached — {aiCacheMap.size} gen'd
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from(aiCacheMap.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cat, meta]) => (
                  <Link
                    key={`ai-cached-${cat}`}
                    href={`/test-harness/ai/${cat}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col gap-0.5 rounded-md px-3 py-2 no-underline"
                    style={{
                      background: '#ede9fe',
                      color: '#4c1d95',
                      border: '1px solid #a78bfa',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold capitalize">💾 {cat}</span>
                      <span className="text-[10px] font-mono opacity-70">
                        {meta.blocksCount} blocks
                      </span>
                    </div>
                    <div
                      className="truncate text-[11px] font-medium"
                      title={meta.siteName}
                    >
                      {meta.siteName}
                    </div>
                    <div className="flex items-center justify-between text-[10px] opacity-70">
                      <span>gen'd {timeAgo(meta.cachedAt)}</span>
                      <span>↗ open + prompts</span>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        )}
        {categories.filter((c) => !aiCached.has(c)).length > 0 && (
          <div>
            <div
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: '#581c87' }}
            >
              ✨ Fresh — not yet gen'd ({categories.filter((c) => !aiCached.has(c)).length}) · clicking fires OpenAI call
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
              {categories
                .filter((c) => !aiCached.has(c))
                .map((c) => (
                  <Link
                    key={`ai-fresh-${c}`}
                    href={`/test-harness/ai/${c}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-mono capitalize no-underline"
                    style={{
                      background: '#fff',
                      color: '#4c1d95',
                      border: '1px solid #c4b5fd',
                    }}
                    title="Fresh — sẽ gọi OpenAI (5–15s, tốn $)"
                  >
                    <span>✨</span>
                    <span>{c}</span>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </section>

      {/* TEMPLATE-FIRST heading */}
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold">📐 Template-First Blueprints</h2>
        <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase text-white">
          Free · Instant
        </span>
        <span className="text-xs text-muted-foreground">— precomposed from matrix.json, click card to render</span>
      </div>

      {/* Grouped by category — anchor id on each heading for chip jumping. */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const catBlueprints = blueprints.filter((b) => b.category === cat)
          const catScores = catBlueprints
            .map((b) => b.score?.weighted)
            .filter((x): x is number => typeof x === 'number')
          const catAvg = catScores.length
            ? catScores.reduce((s, x) => s + x, 0) / catScores.length
            : null
          const cached = aiCached.has(cat)
          return (
            <section key={cat} id={`cat-${cat}`} className="scroll-mt-6">
              <div className="mb-3 flex items-center gap-3 border-b pb-2">
                <h3 className="text-base font-semibold capitalize">{cat}</h3>
                <Badge variant="secondary" className="text-xs">
                  {catBlueprints.length} presets
                </Badge>
                {catAvg !== null && (
                  <Badge variant="outline" className="text-xs" title="Avg rubric score">
                    avg {catAvg.toFixed(2)}/10
                  </Badge>
                )}
                <Link
                  href={`/test-harness/ai/${cat}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto rounded px-2 py-1 text-xs font-mono no-underline"
                  style={{
                    background: cached ? '#ede9fe' : '#fff',
                    color: '#4c1d95',
                    border: `1px solid ${cached ? '#a78bfa' : '#c4b5fd'}`,
                    fontWeight: cached ? 600 : 400,
                  }}
                  title={cached ? 'Cached AI gen — mở tức thì' : 'Fresh AI gen — tốn $'}
                >
                  {cached ? '💾' : '✨'} AI gen {cat}
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {catBlueprints.map((bp) => {
                  const weakest = weakestDim(bp.score)
                  return (
                    <Card key={bp.fixtureId} className="p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate font-medium">
                            <span
                              title={
                                bp.score
                                  ? `rubric ${bp.score.status}: ${bp.score.weighted.toFixed(1)}/10`
                                  : 'no rubric score'
                              }
                            >
                              {scoreDot(bp.score)}
                            </span>
                            <span className="truncate">{bp.presetName}</span>
                            {bp.score && (
                              <span className="ml-1 shrink-0 font-mono text-[10px] text-muted-foreground">
                                {bp.score.weighted.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {bp.blockCount} blocks
                        </Badge>
                      </div>
                      <div className="mb-2 line-clamp-2 text-xs text-muted-foreground">
                        {bp.blockTypes.slice(0, 8).join(' → ')}
                        {bp.blockTypes.length > 8 ? ` → +${bp.blockTypes.length - 8} more` : ''}
                      </div>
                      {weakest && (
                        <WeakestDrawer
                          dim={weakest}
                          description={dimDescriptions.get(weakest.id) ?? ''}
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/test-harness/${bp.fixtureId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-accent"
                        >
                          Open render ↗
                        </Link>
                        <span
                          data-triage-slot={bp.fixtureId}
                          className="ml-auto text-xs text-muted-foreground"
                        >
                          verdict?
                        </span>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** Expandable "Weakest dimension" drawer — native <details> so no JS.
 * Summary shows dim name + score; body explains description + lists failed/partial
 * criteria with their reason so team knows exactly what to fix. */
function WeakestDrawer({ dim, description }: { dim: DimensionScore; description: string }) {
  // Color by score severity — same as old inline badge
  const weakColor = dim.score < 6 ? '#ef4444' : dim.score < 7.5 ? '#f59e0b' : '#71717a'
  // Only show criteria that didn't earn full points (sorted by impact: biggest gap first)
  const failed = [...dim.criteria]
    .filter((c) => c.points < c.maxPoints)
    .sort((a, b) => (b.maxPoints - b.points) - (a.maxPoints - a.points))
  const criterionIcon = (status: 'pass' | 'partial' | 'fail'): string =>
    status === 'fail' ? '✗' : status === 'partial' ? '⚠' : '✓'

  return (
    <details
      className="mb-3 rounded border text-[10px]"
      style={{
        borderColor: weakColor + '40',
        background: weakColor + '10',
        color: weakColor,
      }}
    >
      <summary
        className="cursor-pointer px-2 py-1 outline-none"
        style={{ listStyle: 'none' }}
        title="Click to expand — explains what's measured + what to fix"
      >
        ⚠ Weakest: <strong>{dim.name}</strong> {dim.score.toFixed(1)}/10
        <span style={{ opacity: 0.6, marginLeft: 6 }}>
          ({dim.earnedPoints}/{dim.maxPoints} pts · weight {dim.weight}) · click to fix
        </span>
      </summary>
      <div
        className="space-y-2 px-2 pb-2 pt-1"
        style={{ color: '#27272a', background: '#fff', borderTop: `1px solid ${weakColor}30` }}
      >
        {description && (
          <div
            className="rounded px-2 py-1.5 leading-relaxed"
            style={{ background: '#f4f4f5', color: '#3f3f46' }}
          >
            <strong style={{ color: '#18181b' }}>What it measures:</strong> {description}
          </div>
        )}
        {failed.length > 0 ? (
          <div>
            <div className="mb-1 font-semibold" style={{ color: '#18181b' }}>
              Lost points on {failed.length} criteria — fix priority top-down:
            </div>
            <ul className="m-0 list-none space-y-1 pl-0">
              {failed.slice(0, 5).map((c) => {
                const hint = getFixHint(c.criterionId)
                return (
                  <li
                    key={c.criterionId}
                    className="flex items-start gap-2 rounded px-1.5 py-1"
                    style={{
                      background:
                        c.status === 'fail'
                          ? '#fef2f2'
                          : c.status === 'partial'
                            ? '#fffbeb'
                            : '#f4f4f5',
                    }}
                  >
                    <span
                      className="shrink-0 font-mono"
                      style={{
                        color:
                          c.status === 'fail'
                            ? '#dc2626'
                            : c.status === 'partial'
                              ? '#d97706'
                              : '#16a34a',
                      }}
                    >
                      {criterionIcon(c.status)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span style={{ color: '#18181b', fontWeight: 500 }}>{c.label}</span>
                        <span className="shrink-0 font-mono" style={{ color: '#71717a' }}>
                          {c.points}/{c.maxPoints}
                        </span>
                      </div>
                      {c.reason && (
                        <div className="mt-0.5 leading-relaxed" style={{ color: '#52525b' }}>
                          <span style={{ color: '#9ca3af' }}>evidence:</span> {c.reason}
                        </div>
                      )}
                      {hint && (
                        <div
                          className="mt-1 rounded px-2 py-1 leading-relaxed"
                          style={{
                            background: '#dbeafe',
                            color: '#1e40af',
                            borderLeft: '2px solid #3b82f6',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>🔧 Fix:</span> {hint}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
              {failed.length > 5 && (
                <li className="px-1.5 text-[10px]" style={{ color: '#71717a' }}>
                  … +{failed.length - 5} more criteria with lost points (see admin dashboard)
                </li>
              )}
            </ul>
          </div>
        ) : (
          <div style={{ color: '#16a34a' }}>All criteria passed — dim scored {dim.score.toFixed(1)}/10 on check thresholds.</div>
        )}
      </div>
    </details>
  )
}
