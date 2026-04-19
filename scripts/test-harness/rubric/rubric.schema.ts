/**
 * Template Quality Rubric — TypeScript schema.
 *
 * Rubric evaluates 56 blueprint templates against Wix-professional standard.
 * Reference: plans/260418-1730-template-quality-rubric/plan.md
 */

export type CheckType = 'presence' | 'count' | 'ratio' | 'enum' | 'custom'

/** Presence check — block type exists in fixture. */
export interface PresenceCheck {
    type: 'presence'
    /** Block type to look for. Accepts comma-separated list for alternatives. */
    blockType: string
}

/** Count check — array field on a block has ≥ min items. */
export interface CountCheck {
    type: 'count'
    blockType: string
    /** Data field path (e.g. 'features', 'items', 'testimonials'). */
    field: string
    min: number
}

/** Ratio check — value of `numerator` field ≥ min % of `denominator`. */
export interface RatioCheck {
    type: 'ratio'
    /** JSON path against block data (e.g. 'blocks.withHeadline'). */
    numerator: string
    denominator: string
    /** Min ratio 0-1. */
    min: number
}

/** Enum check — block's variant/field is one of allowed values. */
export interface EnumCheck {
    type: 'enum'
    blockType: string
    field: string
    in: string[]
}

/** Custom check — evaluator function by name (registered in evaluators/). */
export interface CustomCheck {
    type: 'custom'
    /** Evaluator identifier — must match a key in evaluators/evaluator-index.ts. */
    evaluator: string
}

export type Check = PresenceCheck | CountCheck | RatioCheck | EnumCheck | CustomCheck

/** One scoring criterion within a dimension. */
export interface Criterion {
    /** Stable id for report drilldown. */
    id: string
    label: string
    check: Check
    /** Points if check passes fully. */
    passPoints: number
    /** Optional points if partially met (e.g. count=2 where min=3). */
    partialPoints?: number
    /** Human-readable help text. */
    description?: string
}

/** A scoring dimension with weighted criteria. */
export interface Dimension {
    id: string
    name: string
    weight: number
    description: string
    criteria: Criterion[]
}

/** Top-level rubric. */
export interface Rubric {
    schemaVersion: 1
    name: string
    description: string
    dimensions: Dimension[]
    thresholds: {
        /** Minimum weighted score (0-10) for "pass" status. */
        pass: number
        /** Minimum weighted score for "warn" — below = "fail". */
        warn: number
    }
}

/** Per-criterion evaluation result. */
export interface CriterionResult {
    criterionId: string
    label: string
    status: 'pass' | 'partial' | 'fail'
    points: number
    maxPoints: number
    reason?: string
}

/** Per-dimension score for one fixture. */
export interface DimensionScore {
    id: string
    name: string
    weight: number
    score: number /* 0-10 */
    maxPoints: number
    earnedPoints: number
    criteria: CriterionResult[]
}

/** Per-fixture overall score. */
export interface FixtureScore {
    fixtureId: string
    category: string
    dimensions: DimensionScore[]
    /** Weighted average across dimensions, 0-10. */
    weighted: number
    status: 'pass' | 'warn' | 'fail'
}

/** Top-level scorer report. */
export interface RubricReport {
    schemaVersion: 1
    generatedAt: string
    rubric: {
        name: string
        schemaVersion: number
    }
    summary: {
        total: number
        pass: number
        warn: number
        fail: number
        avgWeighted: number
        perDimensionAvg: Record<string, number>
    }
    fixtures: FixtureScore[]
}
