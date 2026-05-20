/**
 * Rubric scorer CLI — thin wrapper around scorer-lib.
 *
 * Usage:
 *   tsx scripts/test-harness/rubric/scorer.ts               # default v1.1
 *   tsx scripts/test-harness/rubric/scorer.ts --rubric=v1
 *   tsx scripts/test-harness/rubric/scorer.ts --rubric=both  # run both versions
 */

import { readMatrix, scoreAll, writeReport, loadRubric, DEFAULT_RUBRIC_VERSION } from './scorer-lib'
import type { RubricVersion } from './scorer-lib'

function parseVersionArg(): RubricVersion | 'all' {
    const arg = process.argv.find((a) => a.startsWith('--rubric='))
    if (!arg) return DEFAULT_RUBRIC_VERSION
    const val = arg.split('=')[1]
    if (val === 'v1' || val === 'v1.1' || val === 'v1.2' || val === 'v1.3' || val === 'all' || val === 'both') {
        return val === 'both' ? 'all' : (val as RubricVersion | 'all')
    }
    console.error(`[rubric] invalid --rubric=${val}. Use v1 | v1.1 | v1.2 | v1.3 | all.`)
    process.exit(1)
}

function runOne(version: RubricVersion): void {
    const matrix = readMatrix()
    if (!matrix) {
        console.error('[rubric] matrix.json not found. Run `npm run harness:gen` first.')
        process.exit(1)
    }

    const rubric = loadRubric(version)
    const report = scoreAll(matrix, rubric)
    const outputPath = writeReport(report, version)
    const r = report.summary

    console.log(`\n[rubric ${version}] ${r.total} fixtures: ${r.pass} pass, ${r.warn} warn, ${r.fail} fail, avg=${r.avgWeighted}/10`)
    console.log(`[rubric ${version}] per-dim avg:`)
    for (const [id, avg] of Object.entries(r.perDimensionAvg)) {
        console.log(`  - ${id}: ${avg.toFixed(1)}/10`)
    }
    console.log(`[rubric ${version}] wrote ${outputPath}`)

    const ranked = [...report.fixtures].sort((a, b) => b.weighted - a.weighted)
    console.log(`\n[rubric ${version}] top 5:`)
    ranked.slice(0, 5).forEach((f, i) => console.log(`  ${i + 1}. ${f.fixtureId} — ${f.weighted}/10 (${f.status})`))
    console.log(`\n[rubric ${version}] bottom 5:`)
    ranked.slice(-5).reverse().forEach((f, i) => console.log(`  ${i + 1}. ${f.fixtureId} — ${f.weighted}/10 (${f.status})`))
}

const target = parseVersionArg()
if (target === 'all') {
    runOne('v1')
    runOne('v1.1')
    runOne('v1.2')
    runOne('v1.3')
} else {
    runOne(target)
}
