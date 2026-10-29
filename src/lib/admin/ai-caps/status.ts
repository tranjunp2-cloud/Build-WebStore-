import 'server-only'
/**
 * GET /api/admin/ai-caps/status: where the platform stands against its caps, which shops are close to (or at) their
 * own limits, and the latest alerts. Pure maths in `buildCapsStatus`; `loadCapsStatus` does the reads.
 */
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import { getAiPlatformConfig } from '@/lib/ai-platform/ai-config'
import type { AiCaps } from '@/lib/ai-platform/ai-config-schema'
import type { AiLimits } from '@/lib/ai-platform/limit-resolution'
import { type ReportsDb, num, rowsOf } from '@/lib/reports/report-db'
import type { CapsView } from '@/lib/admin/ai-settings/types'
import { resolveCaps } from './caps-config'
import { type LimitContext, limitsFor, loadLimitContext } from './effective-limits'
import { DAY_MS, daysInMalaysiaMonth, malaysiaDayKey, malaysiaMonthKey, malaysiaMonthStart } from './malaysia-time'
import { type PlatformSpend, type ShopSpend, loadPlatformSpend, loadShopSpend } from './spend-queries'

/** A shop is "near" its limit from this share of it. */
export const NEAR_LIMIT_PERCENT = 80
const RECENT_ALERTS = 20

export interface PlatformStatus {
  todayUsd: number
  monthUsd: number
  /** null when the cap is off */
  dailyPercent: number | null
  monthlyPercent: number | null
  /** month-to-date ÷ days elapsed (at least 1) × days in the month */
  forecastMonthUsd: number
  forecastMonthlyPercent: number | null
  daysElapsed: number
  daysInMonth: number
  /** what the platform guard is doing from these numbers: ok → Free paused first → everyone paused */
  state: 'ok' | 'free-paused' | 'all-paused'
}

export interface ShopLimitRow {
  tenantId: number
  name: string | null
  plan: string
  source: 'plan' | 'shop'
  /** which limit this row is about */
  limit: 'daily' | 'monthly'
  spentUsd: number
  limitUsd: number
  percent: number
}

export interface BlockedShop {
  tenantId: number
  name: string | null
  plan: string
  source: 'plan' | 'shop'
  reason: 'shop-blocked' | 'plan-off' | 'daily-budget' | 'monthly-budget'
}

export interface AlertRow {
  id: number
  scope: string
  periodKey: string
  threshold: number
  spentUsd: number
  capUsd: number
  tenantId: number | null
  shopName: string | null
  notifiedLark: boolean
  createdAt: string
}

export interface CapsStatus {
  asOf: string
  timezone: 'Asia/Kuala_Lumpur'
  day: string
  month: string
  caps: CapsView
  platform: PlatformStatus
  nearLimit: ShopLimitRow[]
  blocked: BlockedShop[]
  /** plan codes whose AI is switched off (ai_enabled = NO) */
  disabledPlans: string[]
  recentAlerts: AlertRow[]
}

const percentOf = (spent: number, cap: number | null): number | null => (cap !== null && cap > 0 ? Math.round((spent / cap) * 1000) / 10 : null)

export function platformStatus(spend: PlatformSpend, caps: CapsView['effective'], now: number): PlatformStatus {
  const daysInMonth = daysInMalaysiaMonth(now)
  const daysElapsed = Math.max(1, (now - malaysiaMonthStart(now).getTime()) / DAY_MS)
  const forecast = (spend.monthUsd / daysElapsed) * daysInMonth
  const dailyPercent = percentOf(spend.todayUsd, caps.dailyUsd)
  const monthlyPercent = percentOf(spend.monthUsd, caps.monthlyUsd)
  const hottest = Math.max(dailyPercent ?? 0, monthlyPercent ?? 0)
  const state = hottest >= 100 ? 'all-paused' : caps.pauseFreeAtPercent !== null && hottest >= caps.pauseFreeAtPercent ? 'free-paused' : 'ok'
  return {
    todayUsd: spend.todayUsd,
    monthUsd: spend.monthUsd,
    dailyPercent,
    monthlyPercent,
    forecastMonthUsd: forecast,
    forecastMonthlyPercent: percentOf(forecast, caps.monthlyUsd),
    daysElapsed: Math.round(daysElapsed * 100) / 100,
    daysInMonth,
    state,
  }
}

/** The shop's two spend limits (daily rolling, monthly) that are on, with spend against them. */
export function shopLimitRows(shop: ShopSpend, limits: AiLimits): ShopLimitRow[] {
  const rows: ShopLimitRow[] = []
  const base = { tenantId: shop.tenantId, name: shop.name, plan: limits.plan, source: limits.source }
  const add = (limit: ShopLimitRow['limit'], spentUsd: number, limitUsd: number | null) => {
    // a limit of 0 means "off for this shop": that is "blocked", not "near the limit"
    if (limitUsd === null || limitUsd <= 0) return
    rows.push({ ...base, limit, spentUsd, limitUsd, percent: Math.round((spentUsd / limitUsd) * 1000) / 10 })
  }
  add('daily', shop.rolling24hUsd, limits.aiBudgetUsd)
  add('monthly', shop.monthUsd, limits.aiBudgetUsdMonthly)
  return rows
}

export function classifyShops(shops: readonly ShopSpend[], context: LimitContext, now: number): { nearLimit: ShopLimitRow[]; blocked: BlockedShop[] } {
  const nearLimit: ShopLimitRow[] = []
  const blocked: BlockedShop[] = []
  for (const shop of shops) {
    const limits = limitsFor(context, shop.tenantId, now)
    const base = { tenantId: shop.tenantId, name: shop.name, plan: limits.plan, source: limits.source }
    if (!limits.enabled) {
      blocked.push({ ...base, reason: limits.source === 'shop' ? 'shop-blocked' : 'plan-off' })
      continue
    }
    const zeroBudget = (limits.aiBudgetUsd !== null && limits.aiBudgetUsd <= 0) || (limits.aiBudgetUsdMonthly !== null && limits.aiBudgetUsdMonthly <= 0)
    if (zeroBudget) {
      blocked.push({ ...base, reason: limits.aiBudgetUsd !== null && limits.aiBudgetUsd <= 0 ? 'daily-budget' : 'monthly-budget' })
      continue
    }
    for (const row of shopLimitRows(shop, limits)) {
      if (row.percent >= 100) blocked.push({ ...base, reason: row.limit === 'daily' ? 'daily-budget' : 'monthly-budget' })
      else if (row.percent >= NEAR_LIMIT_PERCENT) nearLimit.push(row)
    }
  }
  nearLimit.sort((a, b) => b.percent - a.percent)
  return { nearLimit, blocked }
}

/** Shops with an active "blocked" override that spent nothing lately never show up in spend rows: add them. */
function addBlockedOverrides(blocked: BlockedShop[], context: LimitContext, now: number): BlockedShop[] {
  const seen = new Set(blocked.map((shop) => `${shop.tenantId}:${shop.reason}`))
  for (const [tenantId, override] of context.overrides) {
    if (override.mode !== 'blocked' || (override.expiresAt && override.expiresAt.getTime() <= now) || seen.has(`${tenantId}:shop-blocked`)) continue
    blocked.push({ tenantId, name: override.shopName, plan: limitsFor(context, tenantId, now, false).plan, source: 'shop', reason: 'shop-blocked' })
  }
  return blocked
}

export async function loadRecentAlerts(handle: ReportsDb, limit = RECENT_ALERTS): Promise<AlertRow[]> {
  const rows = await rowsOf<Record<string, unknown>>(
    handle,
    sql`SELECT a.id, a.scope::text AS scope, a.period_key, a.threshold, a.spent_usd, a.cap_usd, a.tenant_id, t.name AS shop_name,
        a.notified_lark, a.created_at
      FROM ai_cap_alerts a LEFT JOIN tenants t ON t.id = a.tenant_id
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${limit}`,
  )
  return rows.map((row) => ({
    id: num(row.id),
    scope: String(row.scope),
    periodKey: String(row.period_key),
    threshold: num(row.threshold),
    spentUsd: num(row.spent_usd),
    capUsd: num(row.cap_usd),
    tenantId: row.tenant_id === null || row.tenant_id === undefined ? null : num(row.tenant_id),
    shopName: typeof row.shop_name === 'string' ? row.shop_name : null,
    notifiedLark: row.notified_lark === true,
    createdAt: new Date(String(row.created_at)).toISOString(),
  }))
}

/** Saved caps; an unreadable config row means "no caps block" (the env default applies), as ai-platform sees it. */
export async function loadSavedCaps(): Promise<AiCaps | null> {
  try {
    return (await getAiPlatformConfig()).caps ?? null
  } catch (error) {
    console.warn('[ai-caps] platform config unreadable; using the env default:', error instanceof Error ? error.message : error)
    return null
  }
}

export async function loadCapsStatus(now: number = Date.now()): Promise<CapsStatus> {
  const handle = (await getPayload({ config })) as unknown as ReportsDb
  const caps = resolveCaps(await loadSavedCaps())
  const [spend, shops] = await Promise.all([loadPlatformSpend(handle, now), loadShopSpend(handle, now)])
  const [context, recentAlerts] = await Promise.all([loadLimitContext(handle, shops.map((shop) => shop.tenantId)), loadRecentAlerts(handle)])
  const { nearLimit, blocked } = classifyShops(shops, context, now)
  const disabledPlans = [...context.planValues.entries()]
    .filter(([, values]) => String(values.ai_enabled ?? '').trim().toUpperCase() === 'NO')
    .map(([plan]) => plan)
    .sort()
  return {
    asOf: new Date(now).toISOString(),
    timezone: 'Asia/Kuala_Lumpur',
    day: malaysiaDayKey(now),
    month: malaysiaMonthKey(now),
    caps,
    platform: platformStatus(spend, caps.effective, now),
    nearLimit,
    blocked: addBlockedOverrides(blocked, context, now),
    disabledPlans,
    recentAlerts,
  }
}
