/** Shared fixtures of the AI caps UI tests: a status as GET /api/admin/ai-caps/status returns it, and a shop's limit view. */
import type { CapsStatus } from '@/lib/admin/ai-caps/status'
import type { ShopLimitView } from '@/lib/admin/ai-caps/shop-overrides'
import type { AiLimits } from '@/lib/ai-platform/limit-resolution'
import type { CapsView } from '@/lib/admin/ai-settings/types'

export const capsView = (over: Partial<CapsView['effective']> = {}, extra: Partial<CapsView> = {}): CapsView => ({
    saved: { dailyUsd: 20, monthlyUsd: 500, alertPercents: [50, 80, 100], pauseFreeAtPercent: 80 },
    effective: { dailyUsd: 20, monthlyUsd: 500, alertPercents: [50, 80, 100], pauseFreeAtPercent: 80, ...over },
    dailySource: 'settings',
    envDailyUsd: 20,
    ...extra,
})

export const status = (over: Partial<CapsStatus> = {}, platform: Partial<CapsStatus['platform']> = {}): CapsStatus => ({
    asOf: '2026-10-29T06:12:00.000Z',
    timezone: 'Asia/Kuala_Lumpur',
    day: '2026-10-29',
    month: '2026-10',
    caps: capsView(),
    platform: {
        todayUsd: 8, monthUsd: 210, dailyPercent: 40, monthlyPercent: 42, forecastMonthUsd: 340, forecastMonthlyPercent: 68,
        daysElapsed: 9.2, daysInMonth: 31, state: 'ok', ...platform,
    },
    nearLimit: [{ tenantId: 7, name: 'Kedai Runcit', plan: 'STARTER_TM_USER', source: 'plan', limit: 'daily', spentUsd: 0.13, limitUsd: 0.15, percent: 86.7 }],
    blocked: [{ tenantId: 9, name: 'Kopi Tiam', plan: 'FREEMIUM', source: 'shop', reason: 'shop-blocked' }],
    disabledPlans: [],
    recentAlerts: [{ id: 1, scope: 'platform-daily', periodKey: '2026-10-29', threshold: 50, spentUsd: 10.1, capUsd: 20, tenantId: null, shopName: null, notifiedLark: true, createdAt: '2026-10-29T03:00:00.000Z' }],
    ...over,
})

export const aiLimits = (over: Partial<AiLimits> = {}): AiLimits => ({
    plan: 'STARTER_TM_USER', aiBudgetUsd: 0.15, picturesPerDay: 3, enabled: true, aiBudgetUsdMonthly: null, siteBudgetUsd: null, source: 'plan', ...over,
})

export const shopView = (over: Partial<ShopLimitView> = {}): ShopLimitView => ({
    tenantId: 7, shopName: 'Kedai Runcit', plan: 'STARTER_TM_USER', override: null, planLimits: aiLimits(), effective: aiLimits(), ...over,
})

export const customOverride = (over: Record<string, unknown> = {}) => ({
    mode: 'custom' as const, aiBudgetUsd: 0.5, picturesPerDay: null, aiBudgetUsdMonthly: 12, siteBudgetUsd: null,
    reason: 'Pilot customer', expiresAt: null, expired: false, setBy: { id: 1, email: 'owner@primeweb.local' }, updatedAt: '2026-10-29T01:00:00.000Z', ...over,
})
