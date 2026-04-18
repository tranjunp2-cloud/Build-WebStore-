/**
 * Rubric scorer — evaluates each fixture against rubric-v1.json,
 * writes .harness-out/rubric-report.json.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CUSTOM_EVALUATORS, evaluatePresence, evaluateCount, evaluateEnum } from './evaluators'
import type {
    Rubric,
    Criterion,
    CriterionResult,
    DimensionScore,
    FixtureScore,
    RubricReport,
} from './rubric.schema'
import type { MatrixReport } from '../types'

// Resolve paths — works with tsx ESM + CJS fallback.
const MODULE_DIR = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(MODULE_DIR, '../../..')
const RUBRIC_PATH = path.resolve(MODULE_DIR, 'rubric-v1.json')
const MATRIX_PATH = path.resolve(REPO_ROOT, '.harness-out/matrix.json')
const OUTPUT_PATH = path.resolve(REPO_ROOT, '.harness-out/rubric-report.json')

function loadRubric(): Rubric {
    const raw = fs.readFileSync(RUBRIC_PATH, 'utf8')
    return JSON.parse(raw) as Rubric
}

function loadMatrix(): MatrixReport {
    const raw = fs.readFileSync(MATRIX_PATH, 'utf8')
    return JSON.parse(raw) as MatrixReport
}

function evaluateCriterion(criterion: Criterion, blocks: any[], theme: any, allBlocks?: any[]): CriterionResult {
    const ctx = { blocks, theme, allBlocks }
    let result: { pass: boolean; partial?: boolean; reason?: string } = { pass: false }

    switch (criterion.check.type) {
        case 'presence':
            result = evaluatePresence(blocks, criterion.check.blockType, allBlocks)
            break
        case 'count':
            result = evaluateCount(blocks, criterion.check.blockType, criterion.check.field, criterion.check.min)
            break
        case 'enum':
            result = evaluateEnum(blocks, criterion.check.blockType, criterion.check.field, criterion.check.in)
            break
        case 'custom': {
            const evaluator = CUSTOM_EVALUATORS[criterion.check.evaluator]
            if (!evaluator) {
                return {
                    criterionId: criterion.id,
                    label: criterion.label,
                    status: 'fail',
                    points: 0,
                    maxPoints: criterion.passPoints,
                    reason: `missing evaluator: ${criterion.check.evaluator}`,
                }
            }
            result = evaluator(ctx)
            break
        }
        default:
            return {
                criterionId: criterion.id,
                label: criterion.label,
                status: 'fail',
                points: 0,
                maxPoints: criterion.passPoints,
                reason: 'unsupported check type',
            }
    }

    const points = result.pass
        ? criterion.passPoints
        : result.partial
            ? criterion.partialPoints ?? Math.floor(criterion.passPoints / 2)
            : 0
    const status: CriterionResult['status'] = result.pass ? 'pass' : result.partial ? 'partial' : 'fail'

    return {
        criterionId: criterion.id,
        label: criterion.label,
        status,
        points,
        maxPoints: criterion.passPoints,
        reason: result.reason,
    }
}

function scoreFixture(rubric: Rubric, fixtureId: string, category: string, blocks: any[], theme: any, allBlocks?: any[]): FixtureScore {
    const dimensions: DimensionScore[] = rubric.dimensions.map((dim) => {
        const criteriaResults = dim.criteria.map((c) => evaluateCriterion(c, blocks, theme, allBlocks))
        const earnedPoints = criteriaResults.reduce((s, r) => s + r.points, 0)
        const maxPoints = criteriaResults.reduce((s, r) => s + r.maxPoints, 0)
        const score = maxPoints > 0 ? (earnedPoints / maxPoints) * 10 : 0
        return {
            id: dim.id,
            name: dim.name,
            weight: dim.weight,
            score: Math.round(score * 10) / 10,
            maxPoints,
            earnedPoints,
            criteria: criteriaResults,
        }
    })

    const totalWeight = rubric.dimensions.reduce((s, d) => s + d.weight, 0)
    const weighted = dimensions.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight
    const weightedRounded = Math.round(weighted * 10) / 10

    const status: FixtureScore['status'] =
        weightedRounded >= rubric.thresholds.pass ? 'pass' : weightedRounded >= rubric.thresholds.warn ? 'warn' : 'fail'

    return { fixtureId, category, dimensions, weighted: weightedRounded, status }
}

export function runScorer(): RubricReport {
    const rubric = loadRubric()
    const matrix = loadMatrix()

    const fixtures: FixtureScore[] = matrix.results.map((r) => {
        // Flatten all pages' blocks for cross-page presence checks
        const allBlocks = r.pages ? r.pages.flatMap((p) => p.blocks) : r.blocks
        return scoreFixture(rubric, r.fixture.id, r.fixture.category, r.blocks, r.theme, allBlocks)
    })

    const total = fixtures.length
    const pass = fixtures.filter((f) => f.status === 'pass').length
    const warn = fixtures.filter((f) => f.status === 'warn').length
    const fail = fixtures.filter((f) => f.status === 'fail').length
    const avgWeighted = Math.round((fixtures.reduce((s, f) => s + f.weighted, 0) / total) * 100) / 100

    const perDimensionAvg: Record<string, number> = {}
    for (const dim of rubric.dimensions) {
        const avg = fixtures.reduce((s, f) => s + (f.dimensions.find((d) => d.id === dim.id)?.score ?? 0), 0) / total
        perDimensionAvg[dim.id] = Math.round(avg * 100) / 100
    }

    const report: RubricReport = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        rubric: { name: rubric.name, schemaVersion: rubric.schemaVersion },
        summary: { total, pass, warn, fail, avgWeighted, perDimensionAvg },
        fixtures,
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2))
    return report
}

// CLI entry point — tsx ./scorer.ts
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('scorer.ts')) {
    const report = runScorer()
    const r = report.summary
    console.log(`[rubric] ${r.total} fixtures: ${r.pass} pass, ${r.warn} warn, ${r.fail} fail, avg=${r.avgWeighted}/10`)
    console.log(`[rubric] per-dim avg:`)
    for (const [id, avg] of Object.entries(r.perDimensionAvg)) {
        console.log(`  - ${id}: ${avg.toFixed(1)}/10`)
    }
    console.log(`[rubric] wrote ${OUTPUT_PATH}`)

    // Terminal quick summary: top 5 + bottom 5
    const ranked = [...report.fixtures].sort((a, b) => b.weighted - a.weighted)
    console.log('\n[rubric] top 5:')
    ranked.slice(0, 5).forEach((f, i) => console.log(`  ${i + 1}. ${f.fixtureId} — ${f.weighted}/10 (${f.status})`))
    console.log('\n[rubric] bottom 5:')
    ranked.slice(-5).reverse().forEach((f, i) => console.log(`  ${i + 1}. ${f.fixtureId} — ${f.weighted}/10 (${f.status})`))
}
