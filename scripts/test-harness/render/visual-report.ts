/**
 * Visual report merger — Phase 03
 *
 * Reads:
 *   .harness-out/structural-report.json
 *   .harness-out/visual-report.<project>.json   (one per Playwright project)
 *
 * Writes:
 *   .harness-out/combined-report.json           (structural + visual joined by fixtureId)
 *
 * Exit codes:
 *   0 — wrote the merged report
 *   1 — at least one fixture has either a structural fail OR a visual hole
 *   2 — input files missing / bad shape
 *
 * Phase 04 (HTML gallery) consumes combined-report.json.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { StructuralReport } from '../types'

type VisualRecord = {
  fixtureId: string
  category: string
  variant: string
  project: string
  screenshotPath: string
  hasHole: boolean
  largestRegionRatio: number
  largestRegionHeightPx: number
  imageWidth: number
  imageHeight: number
}

type VisualReportFile = {
  schemaVersion: 1
  generatedAt: string
  project: string
  records: VisualRecord[]
}

type CombinedFixture = {
  fixtureId: string
  category: string
  variant: string
  structural: {
    overallStatus: 'pass' | 'fail' | 'warn' | 'unknown'
    failedGuards: string[]
  }
  visual: {
    hasHole: boolean
    worstRatio: number
    perProject: Array<{
      project: string
      hasHole: boolean
      largestRegionRatio: number
      screenshotPath: string
    }>
  }
}

type CombinedReport = {
  schemaVersion: 1
  generatedAt: string
  summary: {
    totalFixtures: number
    structuralFail: number
    visualHole: number
    bothPass: number
  }
  fixtures: CombinedFixture[]
}

const HARNESS_OUT = path.resolve(process.cwd(), '.harness-out')
const STRUCTURAL_PATH = path.resolve(HARNESS_OUT, 'structural-report.json')
const COMBINED_PATH = path.resolve(HARNESS_OUT, 'combined-report.json')

function loadStructural(): StructuralReport | null {
  if (!fs.existsSync(STRUCTURAL_PATH)) return null
  return JSON.parse(fs.readFileSync(STRUCTURAL_PATH, 'utf8')) as StructuralReport
}

function loadVisualReports(): VisualRecord[] {
  if (!fs.existsSync(HARNESS_OUT)) return []
  // Match per-project + per-worker files written by harness.spec.ts:
  //   visual-report.<project>.w<index>.json
  // Old single shared file `visual-report.json` is ignored — it was racy.
  const files = fs
    .readdirSync(HARNESS_OUT)
    .filter((f) => /^visual-report\.[^.]+\.w\d+\.json$/.test(f))
  const all: VisualRecord[] = []
  for (const f of files) {
    try {
      const parsed = JSON.parse(
        fs.readFileSync(path.resolve(HARNESS_OUT, f), 'utf8'),
      ) as VisualReportFile
      if (Array.isArray(parsed.records)) all.push(...parsed.records)
    } catch (err) {
      console.warn(`[visual-report] skipping malformed file ${f}: ${(err as Error).message}`)
    }
  }
  return all
}

function main() {
  const structural = loadStructural()
  if (!structural) {
    console.error(
      `[visual-report] structural-report.json not found — run \`npm run harness:check\` first`,
    )
    process.exit(2)
  }

  const visualRecords = loadVisualReports()
  if (visualRecords.length === 0) {
    console.warn(
      `[visual-report] no visual-report.<project>.json files — visual section will be empty`,
    )
  }

  // Group visual records by fixtureId
  const byFixture = new Map<string, VisualRecord[]>()
  for (const r of visualRecords) {
    if (!byFixture.has(r.fixtureId)) byFixture.set(r.fixtureId, [])
    byFixture.get(r.fixtureId)!.push(r)
  }

  const fixtures: CombinedFixture[] = structural.fixtures.map((sf) => {
    const records = byFixture.get(sf.fixtureId) ?? []
    const failedGuards = sf.guards
      .filter((g) => g.status === 'fail')
      .map((g) => g.name)
    const hasHole = records.some((r) => r.hasHole)
    const worstRatio = records.reduce((m, r) => Math.max(m, r.largestRegionRatio), 0)
    return {
      fixtureId: sf.fixtureId,
      category: sf.category,
      variant: records[0]?.variant ?? 'unknown',
      structural: {
        overallStatus: sf.overallStatus,
        failedGuards,
      },
      visual: {
        hasHole,
        worstRatio,
        perProject: records.map((r) => ({
          project: r.project,
          hasHole: r.hasHole,
          largestRegionRatio: r.largestRegionRatio,
          screenshotPath: r.screenshotPath,
        })),
      },
    }
  })

  const summary = {
    totalFixtures: fixtures.length,
    structuralFail: fixtures.filter((f) => f.structural.overallStatus === 'fail').length,
    visualHole: fixtures.filter((f) => f.visual.hasHole).length,
    bothPass: fixtures.filter(
      (f) => f.structural.overallStatus !== 'fail' && !f.visual.hasHole,
    ).length,
  }

  const report: CombinedReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    summary,
    fixtures,
  }

  fs.mkdirSync(HARNESS_OUT, { recursive: true })
  fs.writeFileSync(COMBINED_PATH, JSON.stringify(report, null, 2), 'utf8')

  console.log(
    `\n[visual-report] ${summary.totalFixtures} fixtures: ` +
      `${summary.bothPass} clean, ${summary.structuralFail} structural-fail, ${summary.visualHole} visual-hole`,
  )
  console.log(`[visual-report] wrote ${COMBINED_PATH}`)

  if (summary.structuralFail > 0 || summary.visualHole > 0) process.exit(1)
  process.exit(0)
}

main()
