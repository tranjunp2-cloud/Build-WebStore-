/**
 * Shared data shapes for the F03 single-column dashboard (revamp).
 * Consumed by the server data fns (`*-data.ts`) and the revamp section components.
 */
import type { MissingSeoItem } from '@/components/dashboard/views/SEOView'
import type {
    SeoHealthIssue as ScoreSeoHealthIssue,
    SeoHealthIssueAction as ScoreSeoHealthIssueAction,
    SeoHealthIssueCode as ScoreSeoHealthIssueCode,
} from '@/lib/seo/local-seo-score-contract'

export type DashboardPeriodKey = 'today' | '7d' | '30d'

// ── At-a-glance ──────────────────────────────────────────────────────────────
export interface GlanceStat {
    value: number
    /** percentage delta vs previous period */
    delta: number
    /** render value as a percentage */
    unit?: '%'
    /** render value as MYR currency */
    currency?: boolean
}

export interface GlanceData {
    /** Date-range portion only, e.g. "18 – 24 Jun 2026" or "25 Jun 2026" for today. */
    rangeLabel: string
    stats: {
        views: GlanceStat
        leads: GlanceStat
        engage: GlanceStat
        revenue: GlanceStat
    }
    /** decorative sparkline series (raw daily values) per metric */
    sparks: {
        views: number[]
        leads: number[]
        engage: number[]
        revenue: number[]
    }
}

// ── Traffic & performance ────────────────────────────────────────────────────
export interface TrafficDay {
    /** ISO 'yyyy-MM-dd' (daily) */
    date: string
    views: number
    /** hour index 0-23 when isHourly */
    hour?: number
}

export interface TopPerfRow {
    name: string
    path: string
    views: number
    /** share of total for the tab, 1 dp */
    share: number
}

export interface TrafficData {
    total: number
    isHourly: boolean
    days: TrafficDay[]
    top: {
        pages: TopPerfRow[]
        blogs: TopPerfRow[]
        referrers: TopPerfRow[]
    }
    hasData: boolean
}

// ── SEO health + automation ──────────────────────────────────────────────────
export interface SeoIssue {
    sev: 'high' | 'med' | 'low'
    count: number
    /**
     * Which fix path this issue maps to:
     *  - 'title' | 'description' → AI-fixable (filters missingSeoItems by that field)
     *  - 'alt' → no auto-fix yet → links to product manager instead
     */
    fixType: 'title' | 'description' | 'alt'
}

export interface SeoData {
    score: number
    /** Structured breakdown using i18n keys for labels. */
    breakdown: { key: 'meta' | 'content' | 'technical'; pct: number }[]
    issues: SeoIssue[]
    topIssue: { count: number; fixType: 'title' | 'description' | 'alt' } | null
    missingSeoItems: MissingSeoItem[]
    siteId: string | number | null
}

/**
 * Target F37-04 view model for the isolated SEO Health card.
 *
 * This contract is intentionally additive while the legacy SeoData runtime remains
 * active. It contains semantic actions instead of URLs so the future integration layer
 * can build and authorize destinations without trusting backend-provided links.
 */
export type SeoHealthBucketKey =
    | 'business'
    | 'schema'
    | 'aiDiscoverability'
    | 'technical'

export type SeoHealthBucketStatus = 'good' | 'needsWork'

export interface SeoHealthBucketViewModel {
    progress: number
    status: SeoHealthBucketStatus
}

export interface SeoHealthBucketViewModels {
    business: SeoHealthBucketViewModel
    schema: SeoHealthBucketViewModel
    aiDiscoverability: SeoHealthBucketViewModel
    technical: SeoHealthBucketViewModel
}

export type SeoHealthIssueCode = ScoreSeoHealthIssueCode
export type SeoHealthIssueAction = ScoreSeoHealthIssueAction
export type SeoHealthIssueViewModel = ScoreSeoHealthIssue

export interface SeoHealthReadyViewModel {
    score: number
    aiFixableItemCount: number
    buckets: SeoHealthBucketViewModels
    /** Already deduplicated root-cause groups, in display order. */
    issues: readonly SeoHealthIssueViewModel[]
}

export type SeoHealthCardLoadState =
    | { state: 'loading' }
    | { state: 'error' }
    | ({ state: 'ready' } & SeoHealthReadyViewModel)

// ── Pending orders ──────────────────────────────────────────────────────────
export type PendingOrderCurrency = 'MYR' | 'USD' | 'SGD'

export interface PendingOrderRow {
    id: string | number
    orderNumber: string
    itemCount: number
    total: number
    currency: PendingOrderCurrency
    status: 'pending'
}

export interface PendingOrdersData {
    orders: PendingOrderRow[]
    totalCount: number
}

export type PendingOrdersLoadState =
    | ({ state: 'ready' } & PendingOrdersData)
    | { state: 'unavailable' }
