/**
 * Phase 02 CLI — consume matrix.json, run guards, emit structural-report.json.
 *
 * Usage:
 *   pnpm tsx scripts/test-harness/check.ts
 *   pnpm tsx scripts/test-harness/check.ts --fail-fast
 *   pnpm tsx scripts/test-harness/check.ts --matrix=.harness-out/matrix.json
 *
 * Exit codes:
 *   0 — all pass/warn
 *   1 — at least one fixture failed a structural guard
 *   2 — invalid input (missing matrix.json, bad schema)
 */

// Must run before registry/composer imports in standalone Node.
import './register-css.cjs'

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { MatrixReport, StructuralReport, GuardStatus } from './types'
import { runAllGuards } from './assertions'
import { computeVarietyMetrics } from './assertions/variety-metrics'

type CliArgs = {
  matrix: string
  out: string
  failFast: boolean
  verbose: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {}
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    if (m) args[m[1]!] = m[2] ?? 'true'
  }
  return {
    matrix:
      args.matrix ??
      path.resolve(process.cwd(), '.harness-out/matrix.json'),
    out:
      args.out ??
      path.resolve(process.cwd(), '.harness-out/structural-report.json'),
    failFast: args['fail-fast'] === 'true',
    verbose: args.verbose === 'true',
  }
}

function statusBadge(s: GuardStatus): string {
  return s === 'pass' ? '✓' : s === 'warn' ? '⚠' : '✗'
}

async function main() {
  const args = parseArgs(process.argv)

  if (!fs.existsSync(args.matrix)) {
    console.error(
      `[check] matrix not found at ${args.matrix} — run \`pnpm harness:gen\` first`,
    )
    process.exit(2)
  }

  const matrix = JSON.parse(fs.readFileSync(args.matrix, 'utf8')) as MatrixReport
  if (matrix.schemaVersion !== 1) {
    console.error(`[check] unsupported schemaVersion ${matrix.schemaVersion}`)
    process.exit(2)
  }

  console.log(
    `[check] reading ${matrix.results.length} fixtures from ${args.matrix}`,
  )

  const fixtures: StructuralReport['fixtures'] = []
  let pass = 0
  let warn = 0
  let fail = 0
  const failDetails: string[] = []

  for (const result of matrix.results) {
    const report = runAllGuards(result)
    fixtures.push(report)

    if (report.overallStatus === 'pass') pass++
    else if (report.overallStatus === 'warn') warn++
    else {
      fail++
      const failures = report.guards
        .filter((g) => g.status === 'fail')
        .map((g) => `${g.name}: ${g.reason}`)
        .join(' | ')
      failDetails.push(`  ${report.fixtureId}\n    → ${failures}`)
      if (args.failFast) break
    }
  }

  // Cross-fixture variety metrics
  const { metrics, warnings: varietyWarnings } = computeVarietyMetrics(
    matrix.results,
  )

  const structural: StructuralReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    summary: { total: matrix.results.length, pass, fail, warn },
    fixtures,
    varietyMetrics: metrics,
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true })
  fs.writeFileSync(args.out, JSON.stringify(structural, null, 2), 'utf8')

  // Console summary
  console.log(
    `\n[check] summary: ${statusBadge('pass')} pass=${pass}  ${statusBadge('warn')} warn=${warn}  ${statusBadge('fail')} fail=${fail}  (of ${matrix.results.length})`,
  )

  if (fail > 0) {
    console.log('\n[check] failure details:')
    console.log(failDetails.slice(0, 30).join('\n'))
    if (failDetails.length > 30) {
      console.log(`  ... and ${failDetails.length - 30} more (see structural-report.json)`)
    }
  }

  if (varietyWarnings.length > 0) {
    console.log('\n[check] variety warnings:')
    for (const w of varietyWarnings) {
      console.log(`  ⚠ ${w.category} ${w.metric}: ${w.actual} < ${w.expected}`)
    }
  }

  console.log(`\n[check] wrote ${args.out}`)

  if (fail > 0) process.exit(1)
  process.exit(0)
}

main().catch((err) => {
  console.error('[check] fatal:', err)
  process.exit(2)
})
