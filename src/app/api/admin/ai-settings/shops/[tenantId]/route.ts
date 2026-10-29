/**
 * One shop's AI override (Prime Studio). Super-admin only.
 * GET    → { tenantId, shopName, plan, override: OverrideView | null, planLimits: AiLimits, effective: AiLimits }  (404 unknown shop)
 * PUT    → body { mode: 'custom'|'unlimited'|'blocked', aiBudgetUsd?, picturesPerDay?, aiBudgetUsdMonthly?, siteBudgetUsd?
 *          (number ≥ 0 or null = keep the plan's; custom needs at least one), reason (required), expiresAt? (ISO, future, null = until removed) }
 *          → the GET shape. 400 bad JSON / id, 422 { errors: [{ path, message }] } when invalid, 404 unknown shop.
 * DELETE → { ok: true } and the plan applies again; 404 when the shop had no override.
 * The shop's cached limits are dropped on the instance that served the write; other instances pick it up within 60 s.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { getShopLimitView, removeShopOverride, saveShopOverride } from '@/lib/admin/ai-caps/shop-overrides'
import { ShopLimitInputSchema } from '@/lib/ai-platform/shop-limit-schema'

const parseTenantId = (params: Record<string, string> | undefined): number | null => {
  const raw = params?.tenantId ?? ''
  return /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null
}

const badId = () => NextResponse.json({ error: 'Invalid shop id' }, { status: 400 })
const notFound = () => NextResponse.json({ error: 'Shop not found' }, { status: 404 })

export const GET = withSuperAdmin(async (_req, { params }) => {
  const tenantId = parseTenantId(params)
  if (tenantId === null) return badId()
  try {
    const view = await getShopLimitView(tenantId)
    return view ? NextResponse.json(view) : notFound()
  } catch (error) {
    console.error('[ai-settings/shops] load failed', error)
    return NextResponse.json({ error: 'Could not load the shop override' }, { status: 500 })
  }
})

export const PUT = withSuperAdmin(async (req: NextRequest, { user, params }) => {
  const tenantId = parseTenantId(params)
  if (tenantId === null) return badId()
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 })
  }
  const body = ShopLimitInputSchema.safeParse(json)
  if (!body.success) {
    return NextResponse.json(
      { errors: body.error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message })) },
      { status: 422 },
    )
  }
  try {
    const saved = await saveShopOverride(tenantId, body.data, Number.isFinite(Number(user.id)) ? Number(user.id) : user.id)
    if (!saved.ok) {
      return saved.status === 404 ? notFound() : NextResponse.json({ errors: [{ path: ['mode'], message: saved.message }] }, { status: 422 })
    }
    // the write is done; a failed re-read must not look like a failed save
    const view = await getShopLimitView(tenantId).catch((error) => {
      console.error('[ai-settings/shops] reload after save failed', error)
      return null
    })
    return NextResponse.json(view ?? { ok: true })
  } catch (error) {
    console.error('[ai-settings/shops] save failed', error)
    return NextResponse.json({ error: 'Could not save the shop override' }, { status: 500 })
  }
})

export const DELETE = withSuperAdmin(async (_req, { params }) => {
  const tenantId = parseTenantId(params)
  if (tenantId === null) return badId()
  try {
    return (await removeShopOverride(tenantId)) ? NextResponse.json({ ok: true }) : notFound()
  } catch (error) {
    console.error('[ai-settings/shops] delete failed', error)
    return NextResponse.json({ error: 'Could not remove the shop override' }, { status: 500 })
  }
})
