/**
 * Rubric scorer library — pure logic, no CLI/process side effects.
 *
 * Safe to import from Next.js server components. CLI wrapper at ./scorer.ts.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CUSTOM_EVALUATORS, evaluatePresence, evaluateCount, evaluateEnum, normalizeForHash } from './evaluators'
import { isVariantSentinel, resolveVariantSentinel } from './variant-pools'
import type { UniquenessContext } from './evaluators'
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

export type RubricVersion = 'v1' | 'v1.1' | 'v1.2' | 'v1.3'
export const DEFAULT_RUBRIC_VERSION: RubricVersion = 'v1.3'

const RUBRIC_VERSIONS: readonly RubricVersion[] = ['v1', 'v1.1', 'v1.2', 'v1.3']

/**
 * Absolute path of a rubric definition file.
 *
 * The path is a literal folder + `rubric-${version}.json` on purpose: bundlers
 * (Turbopack/nft) turn it into the bounded glob
 * `scripts/test-harness/rubric/rubric-*.json`. A value looked up from a map
 * (`RUBRIC_FILES[version]`) is opaque to them and made Turbopack trace the
 * whole project into every function importing this module (e.g.
 * /api/admin/templates/bulk), risking Vercel's 250 MB function limit.
 */
export function rubricPath(version: RubricVersion = DEFAULT_RUBRIC_VERSION): string {
    if (!RUBRIC_VERSIONS.includes(version)) throw new Error(`Unknown rubric version: ${String(version)}`)
    return path.join(REPO_ROOT, 'scripts/test-harness/rubric', `rubric-${version}.json`)
}

export function reportPath(version: RubricVersion = DEFAULT_RUBRIC_VERSION): string {
    return path.resolve(REPO_ROOT, `.harness-out/rubric-report-${version}.json`)
}

export const MATRIX_PATH = path.resolve(REPO_ROOT, '.harness-out/matrix.json')
/** Back-compat path — latest version's report copied here for legacy tooling. */
export const LATEST_REPORT_PATH = path.resolve(REPO_ROOT, '.harness-out/rubric-report.json')

// Kept for potential future CLI-only usage; unused now but imported by scorer.ts before split.
void fileURLToPath

const _rubricCache: Partial<Record<RubricVersion, Rubric>> = {}

/**
 * Walk all enum criteria in the rubric and resolve any sentinel strings
 * (e.g. "@hero.nonDefault") to concrete string[] pools in-place.
 * Called once per rubric version at load time before caching.
 * Older rubric versions (v1/v1.1/v1.2) use literal string[] — isVariantSentinel
 * returns false for them, so they pass through unchanged.
 */
function resolveSentinelsInRubric(rubric: Rubric): void {
    for (const dim of rubric.dimensions) {
        for (const crit of dim.criteria) {
            if (crit.check.type === 'enum') {
                const check = crit.check as { in: string[] | string }
                if (isVariantSentinel(check.in)) {
                    check.in = resolveVariantSentinel(check.in)
                }
            }
        }
    }
}

/** Read rubric JSON. Memoized per version per process. */
export function loadRubric(version: RubricVersion = DEFAULT_RUBRIC_VERSION): Rubric {
    const cached = _rubricCache[version]
    if (cached) return cached
    const p = rubricPath(version)
    const raw = fs.readFileSync(p, 'utf8')
    const parsed = JSON.parse(raw) as Rubric
    resolveSentinelsInRubric(parsed)
    _rubricCache[version] = parsed
    return parsed
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

/** Read pre-computed rubric-report-{version}.json. Returns null if missing. */
export function readReport(version: RubricVersion = DEFAULT_RUBRIC_VERSION): RubricReport | null {
    const p = reportPath(version)
    if (!fs.existsSync(p)) return null
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8')) as RubricReport
    } catch {
        return null
    }
}

/** Check if report is stale (matrix newer than report). */
export function isReportStale(version: RubricVersion = DEFAULT_RUBRIC_VERSION): boolean {
    const p = reportPath(version)
    if (!fs.existsSync(p) || !fs.existsSync(MATRIX_PATH)) return false
    const r = fs.statSync(p)
    const m = fs.statSync(MATRIX_PATH)
    return m.mtimeMs > r.mtimeMs
}

function evaluateCriterion(
    criterion: Criterion,
    blocks: HarnessBlock[],
    theme: Record<string, unknown>,
    allBlocks?: HarnessBlock[],
    category?: string,
    fixtureId?: string,
    uniqueness?: UniquenessContext,
): CriterionResult {
    const ctx = { blocks, theme, allBlocks, category, fixtureId, uniqueness }
    let result: { pass: boolean; partial?: boolean; reason?: string } = { pass: false }

    switch (criterion.check.type) {
        case 'presence':
            result = evaluatePresence(blocks, criterion.check.blockType, allBlocks)
            break
        case 'count':
            result = evaluateCount(blocks, criterion.check.blockType, criterion.check.field, criterion.check.min)
            break
        case 'enum':
            // By load time, any sentinel string has already been resolved to string[] by resolveSentinelsInRubric.
            result = evaluateEnum(blocks, criterion.check.blockType, criterion.check.field, criterion.check.in as string[])
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
    uniqueness?: UniquenessContext
}

/** Score a single fixture. Pure function — no fs/network. */
export function scoreFixture(args: ScoreFixtureArgs): FixtureScore {
    const rubric = args.rubric ?? loadRubric()
    const { fixtureId, category, blocks, theme, allBlocks, uniqueness } = args

    const dimensions: DimensionScore[] = rubric.dimensions.map((dim) => {
        const criteriaResults = dim.criteria.map((c) => evaluateCriterion(c, blocks, theme, allBlocks, category, fixtureId, uniqueness))
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

/** Build uniqueness context by aggregating hero/CTA fields across all fixtures. */
export function buildUniquenessContext(matrix: MatrixReport): UniquenessContext {
    const ctx: UniquenessContext = { headlineCounts: {}, subheadlineCounts: {}, ctaCounts: {} }
    for (const r of matrix.results) {
        const hero = r.blocks.find((b) => b.blockType === 'hero')
        const h = normalizeForHash(hero?.data?.headline)
        if (h) ctx.headlineCounts[h] = (ctx.headlineCounts[h] ?? 0) + 1
        const sub = normalizeForHash(hero?.data?.subheadline ?? hero?.data?.subHeadline)
        if (sub) ctx.subheadlineCounts[sub] = (ctx.subheadlineCounts[sub] ?? 0) + 1
        // CTAs: collect from hero + nav + cta blocks
        for (const b of r.blocks) {
            const arr = (b.data?.ctaButtons ?? b.data?.buttons) as Array<{ label?: unknown }> | undefined
            if (Array.isArray(arr)) {
                for (const c of arr) {
                    const lbl = normalizeForHash(c?.label)
                    if (lbl) ctx.ctaCounts[lbl] = (ctx.ctaCounts[lbl] ?? 0) + 1
                }
            }
            const cta = b.data?.ctaButton as { label?: unknown } | undefined
            if (cta) {
                const lbl = normalizeForHash(cta.label)
                if (lbl) ctx.ctaCounts[lbl] = (ctx.ctaCounts[lbl] ?? 0) + 1
            }
        }
    }
    return ctx
}

/** Score entire matrix. Pure function — does NOT write to disk. */
export function scoreAll(matrix: MatrixReport, rubric?: Rubric): RubricReport {
    const r = rubric ?? loadRubric()
    const uniqueness = buildUniquenessContext(matrix)
    const fixtures: FixtureScore[] = matrix.results.map((res) => {
        const allBlocks = res.pages ? res.pages.flatMap((p) => p.blocks) : res.blocks
        return scoreFixture({
            fixtureId: res.fixture.id,
            category: res.fixture.category,
            blocks: res.blocks,
            theme: res.theme,
            allBlocks,
            rubric: r,
            uniqueness,
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
export function writeReport(report: RubricReport, version: RubricVersion = DEFAULT_RUBRIC_VERSION): string {
    const p = reportPath(version)
    const json = JSON.stringify(report, null, 2)
    fs.writeFileSync(p, json)
    // Also update legacy rubric-report.json so tools not passing version still see latest default
    if (version === DEFAULT_RUBRIC_VERSION) {
        fs.writeFileSync(LATEST_REPORT_PATH, json)
    }
    return p
}
