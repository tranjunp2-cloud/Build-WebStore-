import type { PlanCode } from '@/collections/PlanSubscriptions'
import type { AiCaps, AiPlatformConfig } from '@/lib/ai-platform/ai-config-schema'
import type { LimitKind } from './plan-groups'

export type LimitValues = Record<LimitKind, Record<PlanCode, string>>

export interface ShopUsage {
  id: number
  name: string
  /** highest AI-battery USD spent in one day over the window */
  maxBudget: number
  /** most pictures generated in one day over the window */
  maxPictures: number
}

export interface Spread {
  p50: number
  p90: number
  max: number
}

export interface GroupStats {
  group: string
  shops: ShopUsage[]
  budget: Spread
  pictures: Spread
}

export interface UnpricedModel {
  model: string
  calls: number
}

/** Platform caps as saved and as they apply. `saved` null = no caps block (env default for the daily cap, no monthly cap). */
export interface CapsView {
  saved: AiCaps | null
  effective: {
    /** null = off */
    dailyUsd: number | null
    monthlyUsd: number | null
    alertPercents: number[]
    pauseFreeAtPercent: number | null
  }
  /** where the effective daily cap comes from */
  dailySource: 'settings' | 'env' | 'off'
  /** AI_DAILY_BUDGET_USD of this deployment (null = off); what applies while `saved.dailyUsd` is absent */
  envDailyUsd: number | null
}

export interface AiSettingsData {
  limits: LimitValues
  /** prices, pictures and model chains (caps are in `caps`) */
  config: AiPlatformConfig
  caps: CapsView
  /** ISO time the platform config row last changed; null when none exists */
  configUpdatedAt: string | null
  /** true when the stored config row failed validation (the editor starts from an empty config) */
  configInvalid: boolean
  stats: GroupStats[]
  unpriced: UnpricedModel[]
}

export interface FieldError {
  /** e.g. ['limits','STARTER_TM_USER','budget'] or ['config','prices','openai:x','input'] */
  path: string[]
  message: string
}

export interface LimitChange {
  planCode: PlanCode
  kind: LimitKind
  value: string
}
