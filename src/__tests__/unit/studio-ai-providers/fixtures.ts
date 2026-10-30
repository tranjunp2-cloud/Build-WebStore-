import type { HistoryEntry, ProviderView, RuntimeView, SettingsView, TestResult } from '@/lib/admin/ai-providers/types'

export const okTest = (over: Partial<TestResult> = {}): TestResult => ({ ok: true, at: '2026-10-30T08:12:00.000Z', ms: 640, model: 'm', code: 'ok', message: 'ok', ...over })

export const provider = (over: Partial<ProviderView> & { id: string }): ProviderView => ({
  label: over.id, kind: 'builtin', enabled: true, enabledSource: 'studio',
  key: { state: 'env', last4: '9c1d', setBy: null, setAt: null },
  baseUrl: null, baseUrlSource: 'default', defaultBaseUrl: 'https://api.example.com/v1',
  options: {}, lastTest: okTest(), models: [], ...over,
})

const runtimeRow = (over: Partial<RuntimeView> & { key: RuntimeView['key'] }): RuntimeView => ({
  label: over.key, help: `${over.key} help`, type: 'int', min: 0, value: 1, source: 'default', default: 1, envName: 'ENV', ...over,
})

export const RUNTIME: RuntimeView[] = [
  runtimeRow({ key: 'runsPerDayPerShop', label: 'Copilot starts per shop per day', value: 200, default: 200, min: 1, envName: 'AI_DAILY_RUN_LIMIT_PER_ORG' }),
  runtimeRow({ key: 'queueMaxWaitMs', label: 'Longest wait in the queue', value: 90_000, default: 90_000, min: 1000, max: 290_000, envName: 'AI_QUEUE_MAX_WAIT_MS' }),
  runtimeRow({ key: 'runBudgetMs', label: 'Time for one copilot answer', value: 200_000, default: 200_000, min: 1000, max: 290_000, envName: 'AI_RUN_BUDGET_MS' }),
  runtimeRow({ key: 'suggestMode', label: 'Next-message suggestions', type: 'enum', options: ['rules', 'model', 'off'], value: 'rules', default: 'rules', source: 'env', envName: 'AI_SUGGEST_MODE' }),
  runtimeRow({ key: 'toolRouting', label: 'Send only the tools a message needs', type: 'bool', value: true, default: true, envName: 'AI_TOOL_ROUTING' }),
]

/** A healthy install: every tier on its first choice. */
export function healthyView(): SettingsView {
  const text = (chain: string[], effort: string | null) => ({ chain, chainSource: 'studio' as const, effort, effortSource: 'studio' as const, timeoutMs: 60_000, timeoutSource: 'default' as const })
  return {
    updatedAt: '2026-10-29T16:04:00.000Z',
    providers: [
      provider({ id: 'openai', label: 'OpenAI', models: ['gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-image-1'] }),
      provider({ id: 'anthropic', label: 'Anthropic', key: { state: 'set', last4: '4f2a', setBy: 'minh@primecommerce.asia', setAt: '2026-10-29T15:58:00.000Z' }, models: ['claude-haiku-5-5', 'claude-sonnet-5-5'] }),
      provider({ id: 'google', label: 'Google (Gemini)', enabled: false, enabledSource: 'default', key: { state: 'none', last4: null, setBy: null, setAt: null }, lastTest: null, models: ['gemini-3-pro'] }),
    ],
    gateway: { baseUrl: null, tokenSet: false, paths: { openai: 'openai', anthropic: 'anthropic' }, source: 'default' },
    routing: { tiers: {
      fast: text(['anthropic:claude-haiku-5-5', 'openai:gpt-5.4-nano'], 'low'),
      balanced: text(['anthropic:claude-haiku-5-5', 'openai:gpt-5.4-mini'], 'medium'),
      quality: text(['anthropic:claude-sonnet-5-5'], 'high'),
      image: { chain: ['openai:gpt-image-1'], chainSource: 'env', timeoutMs: 150_000, timeoutSource: 'default', format: 'webp', formatSource: 'default' },
    } },
    health: {
      fast: { serving: 'anthropic:claude-haiku-5-5', state: 'first-choice', skipped: [] },
      balanced: { serving: 'anthropic:claude-haiku-5-5', state: 'first-choice', skipped: [] },
      quality: { serving: 'anthropic:claude-sonnet-5-5', state: 'first-choice', skipped: [] },
      image: { serving: 'openai:gpt-image-1', state: 'first-choice', skipped: [] },
    },
    tasks: [
      { id: 'chat.reply', group: 'Chat replies', label: 'Copilot chat reply', defaultTier: 'fast', override: null },
      { id: 'product.description', group: 'Writing tools', label: 'Product description', defaultTier: 'balanced', override: 'fast' },
      { id: 'picture.generate', group: 'Pictures', label: 'Generate picture', defaultTier: 'image', override: null },
    ],
    runtime: RUNTIME,
  }
}

/** The wireframe's broken install: Quality on a fallback, Image with no model left. */
export function brokenView(): SettingsView {
  const view = healthyView()
  view.providers.push(provider({
    id: 'openrouter', label: 'OpenRouter', key: { state: 'needs-reentry', last4: null, setBy: 'minh@primecommerce.asia', setAt: '2026-10-12T00:00:00.000Z' }, lastTest: null,
  }))
  view.providers.push(provider({
    id: 'deepseek', label: 'DeepSeek', key: { state: 'set', last4: '77b0', setBy: 'hana@primecommerce.asia', setAt: '2026-10-22T00:00:00.000Z' },
    lastTest: okTest({ ok: false, code: 'quota', ms: 1140, model: 'deepseek-v4-flash', message: '429 Insufficient Balance' }),
  }))
  view.routing.tiers.quality.chain = ['openrouter:google/gemini-3-pro', 'anthropic:claude-sonnet-5-5']
  view.routing.tiers.image.chain = ['openrouter:openai/gpt-image-1']
  view.health.quality = { serving: 'anthropic:claude-sonnet-5-5', state: 'fallback', skipped: [{ model: 'openrouter:google/gemini-3-pro', reason: 'needs-reentry' }] }
  view.health.image = { serving: null, state: 'down', skipped: [{ model: 'openrouter:openai/gpt-image-1', reason: 'needs-reentry' }] }
  return view
}

export const HISTORY: HistoryEntry[] = [
  { id: 'h3', at: '2026-10-29T16:04:00.000Z', actor: { id: '1', email: 'minh@primecommerce.asia' }, area: 'routing', summary: 'Quality chain: haiku → sonnet', restorable: true },
  { id: 'h2', at: '2026-10-29T15:58:00.000Z', actor: { id: '1', email: 'minh@primecommerce.asia' }, area: 'keys', summary: 'Anthropic key replaced', restorable: false },
  { id: 'h1', at: '2026-10-27T10:05:00.000Z', actor: { id: '2', email: 'hana@primecommerce.asia' }, area: 'tasks', summary: 'Product description moved to Fast', restorable: true },
]
