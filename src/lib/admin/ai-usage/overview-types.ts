import type { AreaGroup, PlanGroup } from './groups'

export interface KpiTotals {
    cost: number
    calls: number
    shops: number
    errors: number
    /** Calls that answered but produced nothing usable (not counted as errors). */
    refused: number
    tokensIn: number
    cachedTokensIn: number
    unpriced: number
}

export interface SeriesPoint {
    key: string
    cost: number
    calls: number
    shops: number
    errors: number
    tokensIn: number
    cachedTokensIn: number
}

export interface BucketByArea {
    key: string
    total: number
    byArea: Record<AreaGroup, number>
}

export interface PlanRow {
    plan: PlanGroup
    shops: number
    cost: number
    p50: number | null
    p90: number | null
    max: number | null
}

export interface TopShop {
    tenantId: number
    name: string
    plan: PlanGroup
    cost: number
    calls: number
    avgPerDay: number
    maxDay: number
    maxDayKey: string | null
    errors: number
}

export interface BreakdownRow {
    key: string
    label: string
    /** Task rows: area group; model rows: provider. */
    sub: string | null
    calls: number
    unpriced: number
    avgPerCall: number | null
    cost: number
    cacheHit: number | null
    errorRate: number
}

export interface ErrorRow {
    code: string
    label: string | null
    model: string
    count: number
    lastSeen: string
}

export const TOP_SHOP_SORTS = ['cost', 'calls', 'avg', 'max', 'errors'] as const
export type TopShopSort = (typeof TOP_SHOP_SORTS)[number]
