/**
 * The platform caps as they apply: `ai_platform_config.settings.caps` over the env default. Pure (env passed in).
 * Same rules ai-platform uses: dailyUsd absent → AI_DAILY_BUDGET_USD (unset = 20, 0 = off); null = off.
 */
import type { AiCaps } from '@/lib/ai-platform/ai-config-schema'
import type { CapsView } from '@/lib/admin/ai-settings/types'

export const DEFAULT_ALERT_PERCENTS: readonly number[] = [50, 80, 100]
const DEFAULT_DAILY_USD = 20

/** AI_DAILY_BUDGET_USD of this deployment; null = off. Unset or unreadable → 20. */
export function envDailyBudgetUsd(env: Readonly<Record<string, string | undefined>> = process.env): number | null {
  const raw = env.AI_DAILY_BUDGET_USD?.trim()
  if (!raw) return DEFAULT_DAILY_USD
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return DEFAULT_DAILY_USD
  return value === 0 ? null : value
}

export function resolveCaps(saved: AiCaps | null | undefined, env: Readonly<Record<string, string | undefined>> = process.env): CapsView {
  const envDailyUsd = envDailyBudgetUsd(env)
  let dailyUsd: number | null
  let dailySource: CapsView['dailySource']
  if (saved?.dailyUsd === undefined) {
    dailyUsd = envDailyUsd
    dailySource = envDailyUsd === null ? 'off' : 'env'
  } else {
    dailyUsd = saved.dailyUsd === 0 ? null : saved.dailyUsd
    dailySource = dailyUsd === null ? 'off' : 'settings'
  }
  const monthly = saved?.monthlyUsd ?? null
  return {
    saved: saved ?? null,
    effective: {
      dailyUsd,
      monthlyUsd: monthly === 0 ? null : monthly,
      alertPercents: [...(saved?.alertPercents ?? DEFAULT_ALERT_PERCENTS)].sort((a, b) => a - b),
      pauseFreeAtPercent: saved?.pauseFreeAtPercent ?? null,
    },
    dailySource,
    envDailyUsd,
  }
}
