/**
 * Rubric scorer library — pure logic, no CLI/process side effects.
 *
 * Safe to import from Next.js server components. CLI wrapper at ./scorer.ts.
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
import type { MatrixReport, HarnessBlock } from '../types'

// Paths relative to process.cwd() (repo root). Works for both CLI (tsx) and
// Next.js server components — Next's __dirname points to .next/server bundle,
// which doesn't contain rubric-v1.json, hence avoid __dirname resolution.
const REPO_ROOT = process.cwd()
export const RUBRIC_PATH = path.resolve(REPO_ROOT, 'scripts/test-harness/rubric/rubric-v1.json')
export const MATRIX_PATH = path.resolve(REPO_ROOT, '.harness-out/matrix.json')
export const REPORT_PATH = path.resolve(REPO_ROOT, '.harness-out/rubric-report.json')

// Kept for potential future CLI-only usage; unused now but imported by scorer.ts before split.
void fileURLToPath

let _rubricCache: Rubric | null = null

/** Read rubric-v1.json. Memoized per process. */
export function loadRubric(): Rubric {
    if (_rubricCache) return _rubricCache
    const raw = fs.readFileSync(RUBRIC_PATH, 'utf8')
    _rubricCache = JSON.parse(raw) as Rubric
    return _rubricCache
}

/** Read matrix.json. Returns null if missing. */
export function readMatrix(): MatrixReport | null {
    if (!fs.existsSync(MATRIX_PATH)) return null
    try {
        return JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8')) as MatrixReport
    } catch {
        return null
    }
}

/** Read pre-computed rubric-report.json. Returns null if missing. */
export function readReport(): RubricReport | null {
    if (!fs.existsSync(REPORT_PATH)) return null
    try {
        return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) as RubricReport
    } catch {
        return null
    }
}

/** Check if report is stale (matrix newer than report). */
export function isReportStale(): boolean {
    if (!fs.existsSync(REPORT_PATH) || !fs.existsSync(MATRIX_PATH)) return false
    const r = fs.statSync(REPORT_PATH)
    const m = fs.statSync(MATRIX_PATH)
    return m.mtimeMs > r.mtimeMs
}

function evaluateCriterion(
    criterion: Criterion,
    blocks: HarnessBlock[],
    theme: Record<string, unknown>,
    allBlocks?: HarnessBlock[],
): CriterionResult {
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

export interface ScoreFixtureArgs {
    fixtureId: string
    category: string
    blocks: HarnessBlock[]
    theme: Record<string, unknown>
    allBlocks?: HarnessBlock[]
    rubric?: Rubric
}

/** Score a single fixture. Pure function — no fs/network. */
export function scoreFixture(args: ScoreFixtureArgs): FixtureScore {
    const rubric = args.rubric ?? loadRubric()
    const { fixtureId, category, blocks, theme, allBlocks } = args

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
        weightedRounded >= rubric.thresholds.pass
            ? 'pass'
            : weightedRounded >= rubric.thresholds.warn
                ? 'warn'
                : 'fail'

    return { fixtureId, category, dimensions, weighted: weightedRounded, status }
}

/** Score entire matrix. Pure function — does NOT write to disk. */
export function scoreAll(matrix: MatrixReport, rubric?: Rubric): RubricReport {
    const r = rubric ?? loadRubric()
    const fixtures: FixtureScore[] = matrix.results.map((res) => {
        const allBlocks = res.pages ? res.pages.flatMap((p) => p.blocks) : res.blocks
        return scoreFixture({
            fixtureId: res.fixture.id,
            category: res.fixture.category,
            blocks: res.blocks,
            theme: res.theme,
            allBlocks,
            rubric: r,
        })
    })

    const total = fixtures.length
    const pass = fixtures.filter((f) => f.status === 'pass').length
    const warn = fixtures.filter((f) => f.status === 'warn').length
    const fail = fixtures.filter((f) => f.status === 'fail').length
    const avgWeighted = total > 0 ? Math.round((fixtures.reduce((s, f) => s + f.weighted, 0) / total) * 100) / 100 : 0

    const perDimensionAvg: Record<string, number> = {}
    for (const dim of r.dimensions) {
        const avg = total > 0
            ? fixtures.reduce((s, f) => s + (f.dimensions.find((d) => d.id === dim.id)?.score ?? 0), 0) / total
            : 0
        perDimensionAvg[dim.id] = Math.round(avg * 100) / 100
    }

    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        rubric: { name: r.name, schemaVersion: r.schemaVersion },
        summary: { total, pass, warn, fail, avgWeighted, perDimensionAvg },
        fixtures,
    }
}

/** Write report JSON to disk. CLI-side helper. */
export function writeReport(report: RubricReport): string {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
    return REPORT_PATH
}
