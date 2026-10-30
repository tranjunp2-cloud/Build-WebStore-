/**
 * Spend reads from ai_usage_logs for the caps status and alerts. A call's spend is its battery cost, else its cost
 * (the figure the limits page and ai-platform use). Enum-safe: columns that may be enums are cast ::text and never
 * compared with '' (feature / task); times are passed as ISO strings cast ::timestamptz.
 */
import { sql } from 'drizzle-orm'
import { type ReportsDb, num, rowsOf } from '@/lib/reports/report-db'
import { DAY_MS, malaysiaDayStart, malaysiaMonthStart } from './malaysia-time'

const SPEND = sql`COALESCE(l.battery_cost_usd, l.cost_usd, 0)`
/** Pictures count separately from the AI battery. */
const BATTERY_ONLY = sql`l.feature::text IS DISTINCT FROM 'pictures'`

export interface PlatformSpend {
  /** since Malaysia midnight */
  todayUsd: number
  /** since the 1st, Malaysia time */
  monthUsd: number
}

export async function loadPlatformSpend(handle: ReportsDb, now: number): Promise<PlatformSpend> {
  const dayStart = malaysiaDayStart(now).toISOString()
  const monthStart = malaysiaMonthStart(now).toISOString()
  const [row] = await rowsOf<{ today: unknown; month: unknown }>(
    handle,
    sql`SELECT
        COALESCE(SUM(${SPEND}) FILTER (WHERE l.created_at >= ${dayStart}::timestamptz), 0) AS today,
        COALESCE(SUM(${SPEND}), 0) AS month
      FROM ai_usage_logs l
      WHERE l.created_at >= ${monthStart}::timestamptz`,
  )
  return { todayUsd: num(row?.today), monthUsd: num(row?.month) }
}

export interface ShopSpend {
  tenantId: number
  name: string | null
  /** AI battery over the last 24 h */
  rolling24hUsd: number
  /** AI battery since the 1st, Malaysia time */
  monthUsd: number
}

const MAX_SHOPS = 5000

/** Every shop with AI battery spend in the last 24 h or this month. */
export async function loadShopSpend(handle: ReportsDb, now: number): Promise<ShopSpend[]> {
  const since24 = new Date(now - DAY_MS)
  const monthStart = malaysiaMonthStart(now)
  const from = new Date(Math.min(since24.getTime(), monthStart.getTime())).toISOString()
  const rows = await rowsOf<{ tenant_id: unknown; name: unknown; day_usd: unknown; month_usd: unknown }>(
    handle,
    sql`SELECT l.tenant_id, t.name,
        COALESCE(SUM(${SPEND}) FILTER (WHERE l.created_at >= ${since24.toISOString()}::timestamptz AND ${BATTERY_ONLY}), 0) AS day_usd,
        COALESCE(SUM(${SPEND}) FILTER (WHERE l.created_at >= ${monthStart.toISOString()}::timestamptz AND ${BATTERY_ONLY}), 0) AS month_usd
      FROM ai_usage_logs l
      LEFT JOIN tenants t ON t.id = l.tenant_id
      WHERE l.tenant_id IS NOT NULL AND l.created_at >= ${from}::timestamptz
      GROUP BY l.tenant_id, t.name
      LIMIT ${MAX_SHOPS}`,
  )
  return rows
    .map((row) => ({
      tenantId: num(row.tenant_id),
      name: typeof row.name === 'string' ? row.name : null,
      rolling24hUsd: num(row.day_usd),
      monthUsd: num(row.month_usd),
    }))
    .filter((shop) => shop.tenantId > 0 && (shop.rolling24hUsd > 0 || shop.monthUsd > 0))
}
