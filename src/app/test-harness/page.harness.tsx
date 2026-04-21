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
import { readReport } from '../../../scripts/test-harness/rubric/scorer-lib'
import type { FixtureScore } from '../../../scripts/test-harness/rubric/rubric.schema'

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

  const blueprints = pickUniqueBlueprints(matrix, scoreMap)
  const categories = Array.from(new Set(blueprints.map((b) => b.category))).sort()

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Template Quality Triage — {blueprints.length} blueprints</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan: <code>plans/260419-2231-GH-1-per-template-quality-fix</code>. Click any card to open full render in a new tab; return here to tag verdict. Rubric dot: 🟢 pass, 🟡 warn, 🔴 fail, ⚪ no score.
          </p>
        </div>
        <TriagePanel totalCount={blueprints.length} fixtureIds={blueprints.map((b) => b.fixtureId)} />
      </header>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {categories.map((c) => (
          <Badge key={c} variant="secondary">
            {c} ({blueprints.filter((b) => b.category === c).length})
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {blueprints.map((bp) => (
          <Card key={bp.fixtureId} className="p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate font-medium">
                  <span title={bp.score ? `rubric: ${bp.score.status}` : 'no rubric score'}>{scoreDot(bp.score)}</span>
                  <span className="truncate">{bp.presetName}</span>
                </div>
                <div className="text-xs text-muted-foreground">{bp.category}</div>
              </div>
              <Badge variant="outline" className="shrink-0 text-xs">
                {bp.blockCount} blocks
              </Badge>
            </div>
            <div className="mb-3 line-clamp-2 text-xs text-muted-foreground">
              {bp.blockTypes.slice(0, 8).join(' → ')}
              {bp.blockTypes.length > 8 ? ` → +${bp.blockTypes.length - 8} more` : ''}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/test-harness/${bp.fixtureId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-accent"
              >
                Open render ↗
              </Link>
              <span data-triage-slot={bp.fixtureId} className="ml-auto text-xs text-muted-foreground">
                verdict?
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
