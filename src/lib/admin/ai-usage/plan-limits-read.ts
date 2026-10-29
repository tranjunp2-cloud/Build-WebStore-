/** Daily AI limits per plan, read from `plan-features` (same parsing and fallbacks the runtime uses). */
import type { Payload } from 'payload'
import { AI_BUDGET_FEATURE, AI_PICTURES_FEATURE } from '@/lib/ai-platform/ai-config-schema'
import { DEFAULT_AI_LIMITS, parseLimit } from '@/lib/ai-platform/plan-limits'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { KNOWN_PLAN_GROUPS, PLAN_CODES_BY_GROUP, type PlanGroup } from './groups'

export interface DailyLimits {
    /** USD per rolling 24 h; null = unlimited */
    budgetUsd: number | null
    /** pictures per rolling 24 h; null = unlimited */
    picturesPerDay: number | null
    /** The plan codes of the group disagree (e.g. TM and non-TM users differ); the first code is shown. */
    varies: boolean
}

type FeatureRow = { planCode?: string | null; featureCode?: string | null; value?: string | null }

export function limitsForCode(rows: FeatureRow[], code: string): { budgetUsd: number | null; picturesPerDay: number | null } {
    const valueOf = (feature: string) => rows.find((r) => r.planCode === code && r.featureCode === feature)?.value
    const budget = parseLimit(valueOf(AI_BUDGET_FEATURE), false)
    const pictures = parseLimit(valueOf(AI_PICTURES_FEATURE), true)
    const defaults = DEFAULT_AI_LIMITS[code as PlanCode]
    return {
        budgetUsd: budget === undefined ? (defaults?.aiBudgetUsd ?? null) : budget,
        picturesPerDay: pictures === undefined ? (defaults?.picturesPerDay ?? null) : pictures,
    }
}

export function groupLimits(rows: FeatureRow[], group: Exclude<PlanGroup, 'unknown'>): DailyLimits {
    const per = PLAN_CODES_BY_GROUP[group].map((code) => limitsForCode(rows, code))
    const head = per[0]
    const varies = per.some((l) => l.budgetUsd !== head.budgetUsd || l.picturesPerDay !== head.picturesPerDay)
    return { ...head, varies }
}

export async function loadFeatureRows(payload: Pick<Payload, 'find'>): Promise<FeatureRow[]> {
    const result = await payload.find({
        collection: 'plan-features',
        overrideAccess: true,
        where: { featureCode: { in: [AI_BUDGET_FEATURE, AI_PICTURES_FEATURE] } },
        limit: 100,
        pagination: false,
        depth: 0,
    })
    return result.docs as unknown as FeatureRow[]
}

export async function getLimitsByGroup(payload: Pick<Payload, 'find'>): Promise<Record<Exclude<PlanGroup, 'unknown'>, DailyLimits>> {
    const rows = await loadFeatureRows(payload)
    return Object.fromEntries(KNOWN_PLAN_GROUPS.map((g) => [g, groupLimits(rows, g as Exclude<PlanGroup, 'unknown'>)])) as Record<Exclude<PlanGroup, 'unknown'>, DailyLimits>
}
