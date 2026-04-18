/**
 * Rubric scorer CLI — thin wrapper around scorer-lib.
 *
 * Usage: tsx scripts/test-harness/rubric/scorer.ts
 */

import { readMatrix, scoreAll, writeReport } from './scorer-lib'

function main(): void {
    const matrix = readMatrix()
    if (!matrix) {
        console.error('[rubric] matrix.json not found. Run `npm run harness:gen` first.')
        process.exit(1)
    }

    const report = scoreAll(matrix)
    const outputPath = writeReport(report)
    const r = report.summary

    console.log(`[rubric] ${r.total} fixtures: ${r.pass} pass, ${r.warn} warn, ${r.fail} fail, avg=${r.avgWeighted}/10`)
    console.log(`[rubric] per-dim avg:`)
    for (const [id, avg] of Object.entries(r.perDimensionAvg)) {
        console.log(`  - ${id}: ${avg.toFixed(1)}/10`)
    }
    console.log(`[rubric] wrote ${outputPath}`)

    const ranked = [...report.fixtures].sort((a, b) => b.weighted - a.weighted)
    console.log('\n[rubric] top 5:')
    ranked.slice(0, 5).forEach((f, i) => console.log(`  ${i + 1}. ${f.fixtureId} — ${f.weighted}/10 (${f.status})`))
    console.log('\n[rubric] bottom 5:')
    ranked.slice(-5).reverse().forEach((f, i) => console.log(`  ${i + 1}. ${f.fixtureId} — ${f.weighted}/10 (${f.status})`))
}

main()
