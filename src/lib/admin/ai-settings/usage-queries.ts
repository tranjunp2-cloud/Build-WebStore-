import 'server-only'
/**
 * Last-7-day reads from ai_usage_logs for the limits page.
 * Plan source: ai_usage_logs.plan (stamped when the call was synced); rows without it fall back to the tenant's
 * current main plan_subscription, then FREEMIUM.
 */
import config from '@payload-config'
import { getPayload } from 'payload'
import { sql } from 'drizzle-orm'
import { buildGroupStats, type ShopDayRow } from './limit-stats'
import type { GroupStats, UnpricedModel } from './types'

const MAX_SHOP_DAYS = 50_000
const toNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Per shop per day: AI battery spend (everything but pictures) and picture count. Same figures the limits enforce. */
export async function loadGroupStats(): Promise<GroupStats[]> {
  const payload = await getPayload({ config })
  const result = (await payload.db.drizzle.execute(sql`
    WITH current_plan AS (
      SELECT DISTINCT ON (tenant_id) tenant_id, plan::text AS plan
      FROM plan_subscriptions
      WHERE name = 'main' AND status::text NOT IN ('ended', 'canceled') AND ends_at > now()
        AND NOT (canceled_at IS NOT NULL AND canceled_immediately)
      ORDER BY tenant_id, created_at DESC
    )
    SELECT l.tenant_id, t.name, COALESCE(l.plan, cp.plan, 'FREEMIUM') AS plan,
      date_trunc('day', l.created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date::text AS day,
      COALESCE(SUM(COALESCE(l.battery_cost_usd, l.cost_usd, 0)) FILTER (WHERE l.feature::text IS DISTINCT FROM 'pictures'), 0) AS budget,
      COUNT(*) FILTER (WHERE l.feature = 'pictures') AS pictures
    FROM ai_usage_logs l
    LEFT JOIN current_plan cp ON cp.tenant_id = l.tenant_id
    LEFT JOIN tenants t ON t.id = l.tenant_id
    WHERE l.created_at >= now() - interval '7 days' AND l.tenant_id IS NOT NULL
    GROUP BY l.tenant_id, t.name, COALESCE(l.plan, cp.plan, 'FREEMIUM'), date_trunc('day', l.created_at AT TIME ZONE 'Asia/Kuala_Lumpur')
    LIMIT ${MAX_SHOP_DAYS}
  `)) as { rows: Array<Record<string, unknown>> }
  const rows: ShopDayRow[] = result.rows.map((row) => ({
    tenantId: toNumber(row.tenant_id),
    name: typeof row.name === 'string' ? row.name : null,
    plan: typeof row.plan === 'string' ? row.plan : null,
    budget: toNumber(row.budget),
    pictures: toNumber(row.pictures),
  }))
  return buildGroupStats(rows)
}

/** Models with calls this week that had no price on file (cost_usd NULL), most calls first. */
export async function loadUnpricedModels(): Promise<UnpricedModel[]> {
  const payload = await getPayload({ config })
  const result = (await payload.db.drizzle.execute(sql`
    SELECT CASE WHEN provider IS NULL OR provider = '' THEN model ELSE provider || ':' || model END AS model, COUNT(*) AS calls
    FROM ai_usage_logs
    WHERE created_at >= now() - interval '7 days' AND cost_usd IS NULL AND model <> 'unknown'
    GROUP BY 1
    ORDER BY calls DESC
    LIMIT 50
  `)) as { rows: Array<Record<string, unknown>> }
  return result.rows.flatMap((row) =>
    typeof row.model === 'string' && row.model ? [{ model: row.model, calls: toNumber(row.calls) }] : [],
  )
}
