/**
 * GET /api/admin/ai-caps/status — quick view for the AI usage dashboard. Super-admin only.
 * { asOf, timezone: 'Asia/Kuala_Lumpur', day, month,
 *   caps: { saved, effective: { dailyUsd, monthlyUsd, alertPercents, pauseFreeAtPercent }, dailySource, envDailyUsd },
 *   platform: { todayUsd, monthUsd, dailyPercent, monthlyPercent, forecastMonthUsd, forecastMonthlyPercent, daysElapsed, daysInMonth, state },
 *   nearLimit: [{ tenantId, name, plan, source, limit: 'daily'|'monthly', spentUsd, limitUsd, percent }],
 *   blocked: [{ tenantId, name, plan, source, reason: 'shop-blocked'|'plan-off'|'daily-budget'|'monthly-budget' }],
 *   disabledPlans: [planCode], recentAlerts: [{ id, scope, periodKey, threshold, spentUsd, capUsd, tenantId, shopName, notifiedLark, createdAt }] }
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { loadCapsStatus } from '@/lib/admin/ai-caps/status'

export const GET = withSuperAdmin(async () => {
  try {
    return NextResponse.json(await loadCapsStatus())
  } catch (error) {
    console.error('[ai-caps/status] load failed', error)
    return NextResponse.json({ error: 'Could not load the AI caps status' }, { status: 500 })
  }
})
