/**
 * Bulk reads for resolving many shops' limits at once (Studio status, alert job, one shop's view). Same rule as the
 * token path (`resolveAiLimits`), reading plan rows, overrides and plans over one SQL handle. Enum-safe casts (::text).
 */
import { sql, type SQL } from 'drizzle-orm'
import { PLAN_CODES, type PlanCode } from '@/collections/PlanSubscriptions'
import { AI_PLAN_LIMIT_FEATURES } from '@/lib/ai-platform/ai-config-schema'
import { type AiLimits, type ShopOverride, resolveAiLimits, toShopOverride } from '@/lib/ai-platform/limit-resolution'
import { currentPlanByTenant } from '@/lib/ai-platform/usage-sync-plan'
import { type ReportsDb, rowsOf } from '@/lib/reports/report-db'

export interface OverrideRow extends ShopOverride {
  id: number
  tenantId: number
  shopName: string | null
  reason: string
  setById: number | null
  setByEmail: string | null
  updatedAt: string | null
}

export interface LimitContext {
  /** plan code → feature code → stored text */
  planValues: Map<string, Record<string, string>>
  overrides: Map<number, OverrideRow>
  planByTenant: Map<number, string>
}

const asPlan = (plan: string | undefined | null): PlanCode =>
  PLAN_CODES.find((candidate) => candidate.value === plan)?.value ?? 'FREEMIUM'

export async function loadPlanValues(handle: ReportsDb): Promise<Map<string, Record<string, string>>> {
  const features: SQL = sql.join(AI_PLAN_LIMIT_FEATURES.map((code) => sql`${code}`), sql`, `)
  const rows = await rowsOf<{ plan_code: string; feature_code: string; value: string | null }>(
    handle,
    sql`SELECT plan_code::text AS plan_code, feature_code, value FROM plan_features WHERE feature_code IN (${features})`,
  )
  const byPlan = new Map<string, Record<string, string>>()
  for (const row of rows) {
    const values = byPlan.get(row.plan_code) ?? {}
    if (typeof row.value === 'string') values[row.feature_code] = row.value
    byPlan.set(row.plan_code, values)
  }
  return byPlan
}

/** Every override row (active and expired); `tenantId` narrows to one shop. */
export async function loadOverrides(handle: ReportsDb, tenantId?: number): Promise<Map<number, OverrideRow>> {
  const where = tenantId === undefined ? sql`` : sql`WHERE o.tenant_id = ${tenantId}`
  const rows = await rowsOf<Record<string, unknown>>(
    handle,
    sql`SELECT o.id, o.tenant_id, o.mode::text AS mode, o.ai_budget_usd, o.pictures_per_day, o.ai_budget_usd_monthly,
        o.site_budget_usd, o.reason, o.expires_at, o.set_by_id, u.email AS set_by_email, o.updated_at, t.name AS shop_name
      FROM ai_shop_limits o
      LEFT JOIN users u ON u.id = o.set_by_id
      LEFT JOIN tenants t ON t.id = o.tenant_id
      ${where}
      ORDER BY o.updated_at DESC
      LIMIT 2000`,
  )
  const map = new Map<number, OverrideRow>()
  for (const row of rows) {
    const resolved = toShopOverride({
      mode: row.mode,
      aiBudgetUsd: row.ai_budget_usd,
      picturesPerDay: row.pictures_per_day,
      aiBudgetUsdMonthly: row.ai_budget_usd_monthly,
      siteBudgetUsd: row.site_budget_usd,
      expiresAt: row.expires_at,
    })
    const tenant = Number(row.tenant_id)
    if (!resolved || !Number.isFinite(tenant)) continue
    map.set(tenant, {
      ...resolved,
      id: Number(row.id),
      tenantId: tenant,
      shopName: typeof row.shop_name === 'string' ? row.shop_name : null,
      reason: typeof row.reason === 'string' ? row.reason : '',
      setById: row.set_by_id === null || row.set_by_id === undefined ? null : Number(row.set_by_id),
      setByEmail: typeof row.set_by_email === 'string' ? row.set_by_email : null,
      updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
    })
  }
  return map
}

/** Plan rows + overrides + the current plan of `tenantIds` and of every shop that has an override. */
export async function loadLimitContext(handle: ReportsDb, tenantIds: readonly number[]): Promise<LimitContext> {
  const [planValues, overrides] = await Promise.all([loadPlanValues(handle), loadOverrides(handle)])
  const planByTenant = await currentPlanByTenant(handle, [...new Set([...tenantIds, ...overrides.keys()])])
  return { planValues, overrides, planByTenant }
}

/** The shop's limits as they apply at `now`; `withOverride: false` gives its plan's limits alone. */
export function limitsFor(context: LimitContext, tenantId: number, now: number, withOverride = true): AiLimits {
  const plan = asPlan(context.planByTenant.get(tenantId))
  return resolveAiLimits({
    plan,
    values: context.planValues.get(plan) ?? {},
    override: withOverride ? (context.overrides.get(tenantId) ?? null) : null,
    now,
  })
}
