/**
 * Contract of the ai-platform internal admin API (plans/261030-1000-studio-ai-providers/plan.md).
 * Shared by the server client, the proxy route and the Studio pages.
 */

export type Source = 'studio' | 'env' | 'default' | 'none'
export type TextTier = 'fast' | 'balanced' | 'quality'
export type TierId = TextTier | 'image'
export const TEXT_TIERS: readonly TextTier[] = ['fast', 'balanced', 'quality']
export const TIER_IDS: readonly TierId[] = ['fast', 'balanced', 'quality', 'image']

export type KeyState = 'set' | 'env' | 'none' | 'needs-reentry'
export type TestCode = 'ok' | 'invalid-key' | 'quota' | 'timeout' | 'not-found' | 'error'

export interface TestResult {
  ok: boolean
  at: string
  ms: number | null
  model: string
  code: TestCode
  message: string
}

export interface ProviderView {
  /** openai | anthropic | google | deepseek | openrouter | typesafe | compat-<name> */
  id: string
  label: string
  kind: 'builtin' | 'compat'
  enabled: boolean
  enabledSource: Source
  key: { state: KeyState; last4: string | null; setBy: string | null; setAt: string | null }
  baseUrl: string | null
  baseUrlSource: Source
  defaultBaseUrl: string | null
  options: { reasoning?: boolean; structuredOutputs?: boolean }
  lastTest: TestResult | null
  /** known models: price book + catalog + chains */
  models: string[]
}

export interface GatewayView {
  baseUrl: string | null
  tokenSet: boolean
  paths: Record<string, string>
  source: Source
}

export interface TextTierView {
  chain: string[]
  chainSource: Source
  effort: string | null
  effortSource: Source
  timeoutMs: number
  timeoutSource: Source
}

export interface ImageTierView {
  chain: string[]
  chainSource: Source
  timeoutMs: number
  timeoutSource: Source
  format: string | null
  formatSource: Source
}

export type SkipReason = 'disabled' | 'no-key' | 'needs-reentry' | 'last-test-failed' | 'unknown-provider'
export type TierState = 'first-choice' | 'fallback' | 'down'

export interface TierHealth {
  /** provider:model */
  serving: string | null
  state: TierState
  skipped: Array<{ model: string; reason: SkipReason }>
}

export interface TaskView {
  id: string
  group: string
  label: string
  defaultTier: string
  override: string | null
}

export type RuntimeKey =
  | 'runsPerDayPerShop' | 'tasksPerDayPerShop' | 'runsPerMinutePerUser' | 'maxRunningPerUser' | 'maxRunningPerShop'
  | 'queueMaxWaitMs' | 'modelTimeoutMs' | 'runBudgetMs' | 'threadRetentionDays' | 'suggestMode' | 'toolRouting' | 'logRequests'

export type RuntimeValue = number | string | boolean

export interface RuntimeView {
  key: RuntimeKey
  label: string
  help: string
  type: 'int' | 'enum' | 'bool'
  min?: number
  max?: number
  options?: string[]
  value: RuntimeValue
  source: Source
  default: RuntimeValue
  envName: string
}

export interface SettingsView {
  updatedAt: string | null
  providers: ProviderView[]
  gateway: GatewayView
  routing: { tiers: Record<TextTier, TextTierView> & { image: ImageTierView } }
  health: Record<TierId, TierHealth>
  tasks: TaskView[]
  runtime: RuntimeView[]
}

export type HistoryArea = 'providers' | 'keys' | 'endpoints' | 'gateway' | 'routing' | 'tasks' | 'runtime' | 'restore'
export const HISTORY_AREAS: readonly HistoryArea[] = ['providers', 'keys', 'endpoints', 'gateway', 'routing', 'tasks', 'runtime', 'restore']

export interface HistoryEntry {
  id: string
  at: string
  actor: { id: string; email: string }
  area: HistoryArea
  summary: string
  restorable: boolean
}

export interface FieldError {
  path: string
  message: string
}

/** Studio runs the queue wait and the answer budget inside one Vercel request. */
export const MAX_REQUEST_MS = 290_000
