import 'server-only'
/**
 * Reads and writes per-shop AI overrides for Prime Studio. Writes go through the Payload local API so the
 * collection hook validates them; reads are SQL (list with shop name + plan). Callers must have checked super-admin.
 */
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import { type AiLimits, isOverrideActive } from '@/lib/ai-platform/limit-resolution'
import { clearAiLimitsCacheFor } from '@/lib/ai-platform/plan-limits'
import { type ShopLimitInput, normalizeShopLimit, shopLimitProblem } from '@/lib/ai-platform/shop-limit-schema'
import { type ReportsDb, rowsOf } from '@/lib/reports/report-db'
import { type LimitContext, type OverrideRow, limitsFor, loadLimitContext, loadOverrides } from './effective-limits'

export interface OverrideView {
  mode: OverrideRow['mode']
  aiBudgetUsd: number | null
  picturesPerDay: number | null
  aiBudgetUsdMonthly: number | null
  siteBudgetUsd: number | null
  reason: string
  /** ISO time; null = until removed */
  expiresAt: string | null
  /** past its expiry: ignored, the plan applies */
  expired: boolean
  setBy: { id: number; email: string | null } | null
  updatedAt: string | null
}

export interface ShopOverrideListItem extends OverrideView {
  tenantId: number
  shopName: string | null
  plan: string
}

export interface ShopLimitView {
  tenantId: number
  shopName: string | null
  plan: string
  override: OverrideView | null
  /** the plan's limits alone */
  planLimits: AiLimits
  /** what applies now (override on top of the plan) */
  effective: AiLimits
}

const handle = async (): Promise<ReportsDb> => (await getPayload({ config })) as unknown as ReportsDb

function viewOf(row: OverrideRow, now: number): OverrideView {
  return {
    mode: row.mode,
    aiBudgetUsd: row.aiBudgetUsd,
    picturesPerDay: row.picturesPerDay,
    aiBudgetUsdMonthly: row.aiBudgetUsdMonthly,
    siteBudgetUsd: row.siteBudgetUsd,
    reason: row.reason,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    expired: !isOverrideActive(row, now),
    setBy: row.setById === null ? null : { id: row.setById, email: row.setByEmail },
    updatedAt: row.updatedAt,
  }
}

/** Active and expired overrides, newest change first. */
export async function listShopOverrides(now: number = Date.now()): Promise<ShopOverrideListItem[]> {
  const db = await handle()
  const overrides = [...(await loadOverrides(db)).values()]
  const context: LimitContext = await loadLimitContext(db, overrides.map((row) => row.tenantId))
  return overrides.map((row) => ({
    ...viewOf(row, now),
    tenantId: row.tenantId,
    shopName: row.shopName,
    plan: limitsFor(context, row.tenantId, now, false).plan,
  }))
}

/** One shop's plan, override and effective limits; null when the shop does not exist. */
export async function getShopLimitView(tenantId: number, now: number = Date.now()): Promise<ShopLimitView | null> {
  const db = await handle()
  const [tenant] = await rowsOf<{ name: string | null }>(db, sql`SELECT name FROM tenants WHERE id = ${tenantId}`)
  if (!tenant) return null
  const context = await loadLimitContext(db, [tenantId])
  const row = context.overrides.get(tenantId)
  const planLimits = limitsFor(context, tenantId, now, false)
  return {
    tenantId,
    shopName: typeof tenant.name === 'string' ? tenant.name : null,
    plan: planLimits.plan,
    override: row ? viewOf(row, now) : null,
    planLimits,
    effective: limitsFor(context, tenantId, now),
  }
}

export type SaveOverrideResult = { ok: true } | { ok: false; status: 404 | 422; message: string }

/** Creates or replaces the shop's override; the shop's cached limits are dropped on this instance. */
export async function saveShopOverride(tenantId: number, input: ShopLimitInput, userId: number | string, now: number = Date.now()): Promise<SaveOverrideResult> {
  const data = normalizeShopLimit(input)
  const problem = shopLimitProblem(data)
  if (problem) return { ok: false, status: 422, message: problem }
  if (data.expiresAt && new Date(data.expiresAt).getTime() <= now) return { ok: false, status: 422, message: 'The end time must be in the future.' }
  const payload = await getPayload({ config })
  const [tenant] = await rowsOf<{ id: number }>(payload as unknown as ReportsDb, sql`SELECT id FROM tenants WHERE id = ${tenantId}`)
  if (!tenant) return { ok: false, status: 404, message: 'Shop not found.' }
  const existing = await payload.find({
    collection: 'ai-shop-limits', overrideAccess: true, depth: 0, limit: 1, pagination: false,
    where: { tenant: { equals: tenantId } },
  })
  const fields = { ...data, setBy: userId }
  if (existing.docs[0]) {
    await payload.update({ collection: 'ai-shop-limits', id: existing.docs[0].id, data: fields, overrideAccess: true })
  } else {
    await payload.create({ collection: 'ai-shop-limits', data: { tenant: tenantId, ...fields }, overrideAccess: true })
  }
  clearAiLimitsCacheFor(tenantId)
  return { ok: true }
}

/** Removes the override (the plan applies again); false when the shop had none. */
export async function removeShopOverride(tenantId: number): Promise<boolean> {
  const payload = await getPayload({ config })
  const existing = await payload.find({
    collection: 'ai-shop-limits', overrideAccess: true, depth: 0, limit: 1, pagination: false,
    where: { tenant: { equals: tenantId } },
  })
  if (!existing.docs[0]) return false
  await payload.delete({ collection: 'ai-shop-limits', id: existing.docs[0].id, overrideAccess: true })
  clearAiLimitsCacheFor(tenantId)
  return true
}
