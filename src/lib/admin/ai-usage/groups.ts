/**
 * The two groupings the AI usage screens use. Each is declared once as data and turned into both a TS function
 * (for tests and row labels) and a SQL CASE (for grouping in the database), so they cannot drift apart.
 */
import { type SQL, sql } from 'drizzle-orm'

// ── Area groups ─────────────────────────────────────────────────────────────

export type AreaGroup = 'website-setup' | 'pictures' | 'assistant' | 'writing' | 'migration' | 'background'

export const AREA_GROUP_LABELS: Record<AreaGroup, string> = {
    'website-setup': 'Website setup',
    pictures: 'Pictures',
    assistant: 'Assistant',
    writing: 'Writing tools',
    migration: 'Migration',
    background: 'Background',
}
export const AREA_GROUPS = Object.keys(AREA_GROUP_LABELS) as AreaGroup[]

/** Checked in order; a call lands in the first rule that matches, else Assistant. */
const AREA_RULES: ReadonlyArray<{ column: 'area' | 'feature'; value: string; group: AreaGroup }> = [
    { column: 'area', value: 'website-setup', group: 'website-setup' },
    { column: 'area', value: 'migration', group: 'migration' },
    { column: 'area', value: 'background', group: 'background' },
    { column: 'feature', value: 'pictures', group: 'pictures' },
    { column: 'feature', value: 'writing', group: 'writing' },
]

export function areaGroupOf(row: { area?: string | null; feature?: string | null }): AreaGroup {
    for (const rule of AREA_RULES) if (row[rule.column] === rule.value) return rule.group
    return 'assistant'
}

export const isAreaGroup = (value: unknown): value is AreaGroup =>
    typeof value === 'string' && (AREA_GROUPS as string[]).includes(value)

/** SQL CASE giving the area group of a row of `ai_usage_logs` (columns `area`, `feature`; no alias prefix). */
export function areaGroupSql(): SQL {
    const whens = AREA_RULES.map((rule) =>
        rule.column === 'area' ? sql`WHEN area = ${rule.value} THEN ${rule.group}` : sql`WHEN feature = ${rule.value} THEN ${rule.group}`,
    )
    return sql`(CASE ${sql.join(whens, sql` `)} ELSE 'assistant' END)`
}

/** WHERE fragment for "this call belongs to area group G" (mirrors the CASE above). */
export const inAreaGroupSql = (group: AreaGroup): SQL => sql`${areaGroupSql()} = ${group}`

// ── Plan groups ─────────────────────────────────────────────────────────────

export type PlanGroup = 'free' | 'starter' | 'standard' | 'professional' | 'unknown'

export const PLAN_GROUP_LABELS: Record<PlanGroup, string> = {
    free: 'Free',
    starter: 'Starter',
    standard: 'Standard',
    professional: 'Professional',
    unknown: 'Unknown',
}
export const PLAN_GROUPS = Object.keys(PLAN_GROUP_LABELS) as PlanGroup[]
/** Plan groups with a real plan (what limits are set for). */
export const KNOWN_PLAN_GROUPS: PlanGroup[] = ['free', 'starter', 'standard', 'professional']

export const PLAN_CODES_BY_GROUP: Record<Exclude<PlanGroup, 'unknown'>, string[]> = {
    free: ['FREEMIUM'],
    starter: ['STARTER_TM_USER', 'STARTER_NON_TM_USER'],
    standard: ['STANDARD_TM_USER', 'STANDARD_NON_TM_USER'],
    professional: ['PROFESSIONAL_TM_USER', 'PROFESSIONAL_NON_TM_USER'],
}

export function planGroupOf(code: string | null | undefined): PlanGroup {
    if (!code) return 'unknown'
    for (const group of KNOWN_PLAN_GROUPS) if (PLAN_CODES_BY_GROUP[group as Exclude<PlanGroup, 'unknown'>].includes(code)) return group
    return 'unknown'
}

export const isPlanGroup = (value: unknown): value is PlanGroup =>
    typeof value === 'string' && (PLAN_GROUPS as string[]).includes(value)

/** SQL CASE giving the plan group of a row's `plan` column; NULL or unrecognised codes → 'unknown'. */
export function planGroupSql(column: SQL = sql`plan`): SQL {
    const whens = KNOWN_PLAN_GROUPS.map((group) => {
        const codes = PLAN_CODES_BY_GROUP[group as Exclude<PlanGroup, 'unknown'>]
        return sql`WHEN ${column} IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)}) THEN ${group}`
    })
    return sql`(CASE ${sql.join(whens, sql` `)} ELSE 'unknown' END)`
}
