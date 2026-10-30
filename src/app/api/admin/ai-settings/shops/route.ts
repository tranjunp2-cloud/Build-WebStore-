/**
 * GET /api/admin/ai-settings/shops — every per-shop AI override, active and expired, newest change first:
 *   { overrides: [{ tenantId, shopName, plan, mode, aiBudgetUsd, picturesPerDay, aiBudgetUsdMonthly, siteBudgetUsd,
 *                   reason, expiresAt, expired, setBy: { id, email } | null, updatedAt }] }
 * Super-admin only.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { listShopOverrides } from '@/lib/admin/ai-caps/shop-overrides'

export const GET = withSuperAdmin(async () => {
  try {
    return NextResponse.json({ overrides: await listShopOverrides() })
  } catch (error) {
    console.error('[ai-settings/shops] list failed', error)
    return NextResponse.json({ error: 'Could not load shop overrides' }, { status: 500 })
  }
})
