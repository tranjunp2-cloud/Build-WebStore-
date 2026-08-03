/**
 * Dashboard Utility Functions — F03
 * Pure functions extracted from dashboard page & components for unit-testability.
 */

// ─── TC-F03.08 ── Compact number formatting ──────────────────────────────────
/**
 * Format large numbers into compact short notation.
 * 1520 → "1.5K", 1_200_000 → "1.2M"
 */
export function formatCompactNumber(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return String(value)
}

// ─── TC-F03.27/28/29 ── Delta / growth-rate calculation ──────────────────────
/**
 * Calculate percentage change between two periods.
 * Returns a number: positive = growth, negative = decline, 0 = no change.
 * Edge case: prev === 0 → returns 100 when current > 0, else 0.
 */
export function calcDelta(current: number, prev: number): number {
    if (prev === 0) return current > 0 ? 100 : 0
    return ((current - prev) / prev) * 100
}

/** Return the delta classification: 'positive' | 'negative' | 'zero' */
export function getDeltaStatus(delta: number): 'positive' | 'negative' | 'zero' {
    if (delta > 0) return 'positive'
    if (delta < 0) return 'negative'
    return 'zero'
}

// ─── TC-F03.33/34 ── SEO Health Score status ─────────────────────────────────
/**
 * Classify an SEO score into a human-readable status.
 * >= 80 → 'good', >= 50 → 'warning', else → 'critical'
 */
export function getSeoScoreStatus(score: number): 'good' | 'warning' | 'critical' {
    if (score >= 80) return 'good'
    if (score >= 50) return 'warning'
    return 'critical'
}

/**
 * Return the Tailwind CSS color class for an SEO score (extracted from ScoreGauge component).
 * >= 80 → green, >= 50 → yellow, else → red
 */
export function getSeoScoreColorClass(score: number): string {
    if (score >= 80) return 'text-green-400'
    if (score >= 50) return 'text-yellow-400'
    return 'text-red-400'
}

// ─── TC-F03.39/40 ── AI Meta truncation ─────────────────────────────────────
/** Truncate SEO title to max 60 chars (Google standard) */
export function truncateSeoTitle(raw: string): string {
    return raw.length > 60 ? raw.slice(0, 60) : raw
}

/** Truncate SEO meta description to max 160 chars */
export function truncateSeoDescription(raw: string): string {
    return raw.length > 160 ? raw.slice(0, 160) : raw
}

// ─── TC-F03.47 ── Keyword limit validation ───────────────────────────────────
/** Max allowed tracked keywords per account */
export const MAX_KEYWORDS = 5

/**
 * Check if adding a new keyword is allowed.
 * Returns true when current count is below the limit.
 */
export function canAddKeyword(currentCount: number): boolean {
    return currentCount < MAX_KEYWORDS
}

// ─── TC-F03.22/24/25/26 ── Analytics doc processing ─────────────────────────
export type AnalyticsDoc = {
    event: string
    pageUrl?: string
    referrer?: string
    createdAt: string
}

/** Split analytics docs into views vs click-type events */
export function processAnalyticsDocs(docs: AnalyticsDoc[]): {
    views: number
    clicks: number
} {
    let views = 0
    let clicks = 0
    for (const doc of docs) {
        const isClick =
            doc.event === 'click' ||
            doc.event === 'add_to_cart' ||
            doc.event === 'checkout' ||
            doc.event === 'purchase'
        if (isClick) clicks++
        else views++
    }
    return { views, clicks }
}

// ─── TC-F03.24/25/26 ── Top list aggregation ─────────────────────────────────
export type PerformingItem = {
    id: string
    name: string
    url: string
    value: number
}

/**
 * Convert a URL-count map into a ranked top-10 list (matching analytics page logic).
 */
export function mapToTopList(data: Record<string, number>, limit = 10): PerformingItem[] {
    return Object.entries(data)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([url, value]) => ({
            id: url,
            name: url === '/' ? 'Home' : url.split('/').filter(Boolean).pop() || url,
            url,
            value,
        }))
}

// ─── TC-F03.16 ── Period persistence helpers ──────────────────────────────────
export type DashboardPeriod = 'today' | '7d' | '30d'
export const VALID_PERIODS: DashboardPeriod[] = ['today', '7d', '30d']

/** Validate & parse period query param, falling back to default '7d' */
export function parsePeriod(raw: string | undefined | null): DashboardPeriod {
    if (raw && VALID_PERIODS.includes(raw as DashboardPeriod)) {
        return raw as DashboardPeriod
    }
    return '7d'
}

/** Return number of days for a given period token */
export function periodToDays(period: DashboardPeriod): number {
    if (period === 'today') return 1
    if (period === '30d') return 30
    return 7
}

// ─── TC-F03.34 ── SEO Category Breakdown (extracted from CategoryBreakdown) ──
export type SEOIssue = {
    type: 'error' | 'warning' | 'info'
    field: string
    message: string
    autoFixable: boolean
}

export type PageAnalysis = {
    pageId: string | number
    title: string
    slug: string
    score: number
    issues: SEOIssue[]
}

/** Classify all issues from multiple pages into the 3 SEO category buckets */
export function classifySeoCategoryIssues(pages: PageAnalysis[]) {
    const allIssues = pages.flatMap(p => p.issues)
    return {
        meta: allIssues.filter(i => i.field === 'metaTitle' || i.field === 'metaDescription'),
        content: allIssues.filter(i => i.field === 'content'),
        technical: allIssues.filter(
            i => i.field === 'images' || i.field === 'schema' || i.field === 'speed'
        ),
    }
}

// ─── US-05 / TC-F03.42/45 ── AI Fix All — selections & Rollback/Undo ─────────
export type BatchFix = {
    targetId: string
    collection: 'pages' | 'products'
    seo: { title?: string; description?: string }
}

/**
 * Determine if keyboard shortcut Ctrl/Cmd+Z should trigger undo.
 * Returns true only when there are backed-up fixes to revert.
 */
export function shouldTriggerUndo(
    event: { ctrlKey: boolean; metaKey: boolean; key: string },
    backupLength: number
): boolean {
    return (event.ctrlKey || event.metaKey) && event.key === 'z' && backupLength > 0
}

/**
 * Filter proposed fixes to only those approved by the user (Before/After modal).
 */
export function filterApprovedFixes<T extends { id: string }>(
    fixes: T[],
    approvedIds: Set<string>
): T[] {
    return fixes.filter(f => approvedIds.has(f.id))
}

// ─── US-01 ── AI Smart Insights (extracted from AISmartInsights component) ───
export type InsightType = 'up' | 'down' | 'neutral'

export type AIInsight = {
    message: string
    type: InsightType
}

/**
 * Generate AI Smart Insight message from views comparison.
 * Returns null when both values are 0 (no data to show the banner).
 */
export function generateAIInsight(views: number, prevViews: number): AIInsight | null {
    if (views === 0 && prevViews === 0) return null

    if (prevViews === 0 && views > 0) {
        return {
            message: 'Traffic is picking up! You have new visitors compared to the previous period.',
            type: 'up',
        }
    }

    const diff = views - prevViews
    const percent = Math.round((Math.abs(diff) / prevViews) * 100)

    if (diff > 0) {
        if (percent > 50) {
            return {
                message: `🚀 Viral alert! Traffic has surged by ${percent}% recently.`,
                type: 'up',
            }
        }
        return {
            message: `Trending: Traffic is up ${percent}% compared to the previous period.`,
            type: 'up',
        }
    }

    if (diff < 0) {
        if (percent > 30) {
            return {
                message: `⚠️ Warning: Significant traffic drop (${percent}%). Check your site's health and SEO rankings.`,
                type: 'down',
            }
        }
        return {
            message: `Traffic dropped by ${percent}% compared to the previous period. Consider checking your SEO or running a campaign.`,
            type: 'down',
        }
    }

    return { message: 'Traffic is stable compared to the previous period.', type: 'neutral' }
}

// ─── TC-F03.48 ── Rank Tracker Cron — deterministic mock rank ────────────────
/**
 * Generate a consistent "mock" rank based on the keyword string.
 * Deterministic hash ensures stable tracking in demo/MVP mode.
 * Range: 1–50.
 */
export function getMockRank(keyword: string): number {
    const hash = keyword.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return (hash % 50) + 1
}

// ─── F03 Revamp ── Single-column dashboard block model ───────────────────────
/**
 * Block IDs for the single-column dashboard stream (matches the Claude design).
 * Each block is a full-width section; `glance` holds the 4 stat cards as a unit.
 */
export type DashboardBlockId = 'onboarding' | 'glance' | 'traffic' | 'seo' | 'tools' | 'orders'

const ALL_BLOCK_IDS: DashboardBlockId[] = ['onboarding', 'glance', 'traffic', 'seo', 'tools', 'orders']

/** Default visible blocks, in order. `orders` intentionally remains OFF by default. */
export const DEFAULT_DASHBOARD_BLOCKS: DashboardBlockId[] = ['onboarding', 'glance', 'traffic', 'seo', 'tools']

/** Legacy stat-pref names saved before the revamp (stat-level granularity is gone). */
const LEGACY_STAT_NAMES = new Set(['views', 'leads', 'engagement', 'revenue'])

/**
 * Runtime migration (no DB change) for `dashboardPreferences`. Returns the ordered
 * list of VISIBLE block IDs that drives the stream render order.
 *  1. null/empty → DEFAULT_DASHBOARD_BLOCKS
 *  2. legacy stat-name data (views/leads/engagement) → reset to DEFAULT (granularity changed)
 *  3. otherwise: keep valid block IDs in saved order, drop unknowns + duplicates
 */
export function normalizeDashboardBlocks(raw: string[] | null | undefined): DashboardBlockId[] {
    if (!raw || raw.length === 0) return [...DEFAULT_DASHBOARD_BLOCKS]

    // Old stat-level prefs → reset (blocks are section-level now)
    if (raw.some(item => LEGACY_STAT_NAMES.has(item))) return [...DEFAULT_DASHBOARD_BLOCKS]

    const visible: DashboardBlockId[] = []
    for (const item of raw) {
        const id = item as DashboardBlockId
        if (ALL_BLOCK_IDS.includes(id) && !visible.includes(id)) visible.push(id)
    }
    return visible.length > 0 ? visible : [...DEFAULT_DASHBOARD_BLOCKS]
}

export interface DashboardBlockMeta {
    id: DashboardBlockId
    /** lucide icon name (matches design) */
    icon: string
    /** key under i18n `dashboard.overview.customizeModal.blocks.*` */
    labelKey: string
    /** Coming Soon block rendered with a locked preview. */
    soon?: boolean
}

/** Metadata for every block in the Customize modal + stream (drives render + labels). */
export const ALL_BLOCKS: DashboardBlockMeta[] = [
    { id: 'onboarding', icon: 'list-checks', labelKey: 'onboarding' },
    { id: 'glance', icon: 'layout-grid', labelKey: 'glance' },
    { id: 'traffic', icon: 'bar-chart-3', labelKey: 'traffic' },
    { id: 'seo', icon: 'search-check', labelKey: 'seo' },
    { id: 'tools', icon: 'wrench', labelKey: 'tools' },
    { id: 'orders', icon: 'package-check', labelKey: 'orders' },
]

export interface CustomizeBlockRow extends DashboardBlockMeta {
    visible: boolean
}

/**
 * Build the full ordered list for the Customize modal from saved visible blocks.
 *
 * Fixed-schema layout: every block keeps a stable position in the ALL_BLOCKS frame.
 * Toggling a block OFF only flips its visibility — hidden blocks stay anchored at their
 * canonical schema slot (NOT appended to the bottom), so they never jump position across
 * save/reopen. Visible slots are filled in the saved order, preserving drag-reordering.
 */
export function buildCustomizeRows(visibleBlocks: DashboardBlockId[]): CustomizeBlockRow[] {
    const visibleSet = new Set(visibleBlocks)
    const rows: CustomizeBlockRow[] = []
    let vi = 0 // pointer into the saved visible order
    for (const meta of ALL_BLOCKS) {
        if (visibleSet.has(meta.id)) {
            // This canonical slot is a "visible slot" → fill with the next saved visible block
            const id = visibleBlocks[vi++]
            const m = ALL_BLOCKS.find(b => b.id === id) ?? meta
            rows.push({ ...m, visible: true })
        } else {
            // Hidden block stays anchored at its canonical schema position
            rows.push({ ...meta, visible: false })
        }
    }
    return rows
}

// ─── Analytics ── Referrer domain extraction (from analytics/page.tsx) ────────
/**
 * Extract a clean referrer domain from a raw referrer string.
 * Returns null for invalid, internal (localhost / internalHost), or empty referrers.
 * Falls back to treating short strings as UTM source labels.
 */
export function extractReferrerDomain(referrer: string, internalHost?: string): string | null {
    if (!referrer) return null
    try {
        const url = new URL(referrer)
        if (!url.hostname) return null
        if (url.hostname.includes('localhost')) return null
        if (internalHost && url.hostname.includes(internalHost)) return null
        return url.hostname.replace(/^www\./, '')
    } catch {
        // Not a valid URL — treat as UTM source string if short and not a path
        if (referrer.length < 100 && !referrer.startsWith('/')) {
            return referrer
        }
        return null
    }
}
