/** Plain-language status of providers and tiers, computed from a SettingsView. */
import type { ProviderView, SettingsView, SkipReason, TestCode, TierId, TierState } from './types'

export type Tone = 'ok' | 'warn' | 'danger' | 'mute' | 'info'

export const TIER_META: Record<TierId, { name: string; use: string }> = {
  fast: { name: 'Fast', use: 'Chat replies, translate, short suggestions' },
  balanced: { name: 'Balanced', use: 'Product descriptions, blog posts, migration mapping' },
  quality: { name: 'Quality', use: 'Site plan and page blocks' },
  image: { name: 'Image', use: 'Pictures' },
}

export const EFFORTS: ReadonlyArray<{ value: string; label: string; help: string }> = [
  { value: 'default', label: 'Default', help: 'Send nothing; each model uses its own setting.' },
  { value: 'none', label: 'None', help: 'No thinking. Fastest and cheapest.' },
  { value: 'minimal', label: 'Minimal', help: 'Barely thinks. Short, simple answers.' },
  { value: 'low', label: 'Low', help: 'Quick thinking. Good for chat replies.' },
  { value: 'medium', label: 'Medium', help: 'Thinks a bit. Good for most writing.' },
  { value: 'high', label: 'High', help: 'Thinks longer. Better plans, slower and costlier.' },
  { value: 'xhigh', label: 'Extra high', help: 'Very long thinking. Slow; use for hard planning only.' },
  { value: 'max', label: 'Max', help: 'Longest the model allows. Rarely worth it.' },
]

export const effortOf = (value: string | null) => EFFORTS.find((item) => item.value === (value ?? 'default')) ?? EFFORTS[0]

export const IMAGE_FORMATS = ['png', 'jpeg', 'webp'] as const

export const splitRef = (ref: string): [string, string] => {
  const i = ref.indexOf(':')
  return i < 0 ? ['', ref] : [ref.slice(0, i), ref.slice(i + 1)]
}

export const fmtMs = (ms: number | null): string => (ms === null ? '' : `${Math.round(ms).toLocaleString('en-US')} ms`)

export function providerName(view: SettingsView, id: string): string {
  const provider = view.providers.find((item) => item.id === id)
  if (!provider) return id
  return provider.kind === 'compat' ? provider.id : provider.label
}

const TEST_LABEL: Record<TestCode, string> = {
  ok: 'OK', 'invalid-key': 'Invalid key', quota: 'Quota exceeded', timeout: 'Timeout', 'not-found': 'Model not found', error: 'Test failed',
}
export const testLabel = (code: TestCode): string => TEST_LABEL[code]

/** Why a failed test counts against a provider, in a short phrase. */
const TEST_REASON: Record<TestCode, string> = {
  ok: 'ok', 'invalid-key': 'invalid key', quota: 'quota exceeded', timeout: 'no answer in time', 'not-found': 'model not found', error: 'request failed',
}

export function skipText(reason: SkipReason, provider: ProviderView | undefined): string {
  switch (reason) {
    case 'disabled': return 'provider is off'
    case 'no-key': return 'no key'
    case 'needs-reentry': return 'key needs re-entry'
    case 'unknown-provider': return 'provider not set up'
    case 'last-test-failed': return `last test failed${provider?.lastTest ? `: ${TEST_REASON[provider.lastTest.code]}` : ''}`
  }
}

export function providerStatus(p: ProviderView): { tone: Tone; text: string } {
  if (p.key.state === 'none') return { tone: 'mute', text: 'No key' }
  if (!p.enabled) return { tone: 'mute', text: 'Off' }
  if (p.key.state === 'needs-reentry') return { tone: 'danger', text: 'Needs re-entry' }
  const test = p.lastTest
  if (test && !test.ok) return { tone: test.code === 'quota' ? 'warn' : 'danger', text: testLabel(test.code) }
  return { tone: 'ok', text: !test ? 'Not tested yet' : test.ms === null ? 'OK' : `OK · ${fmtMs(test.ms)}` }
}

const TIER_STATE: Record<TierState, { tone: Tone; text: string }> = {
  'first-choice': { tone: 'ok', text: 'First choice' },
  fallback: { tone: 'warn', text: 'On fallback' },
  down: { tone: 'danger', text: 'Not working' },
}
export const tierState = (state: TierState) => TIER_STATE[state]

/** Provider ids that appear in any chain. */
export function usedProviderIds(view: SettingsView): Set<string> {
  const used = new Set<string>()
  for (const tier of Object.values(view.routing.tiers)) for (const ref of tier.chain) used.add(splitRef(ref)[0])
  return used
}

/** Problems per left-rail section: providers that need you, tiers that are down or on a fallback. */
export function computeBadges(view: SettingsView | null): { providers: number; routing: number } {
  if (!view) return { providers: 0, routing: 0 }
  const used = usedProviderIds(view)
  const providers = view.providers.filter((p) => {
    if (p.key.state === 'needs-reentry') return p.enabled || used.has(p.id)
    if (p.key.state === 'none') return used.has(p.id)
    return p.enabled && p.lastTest !== null && !p.lastTest.ok
  }).length
  const routing = (Object.values(view.health) as Array<{ state: TierState }>).filter((tier) => tier.state !== 'first-choice').length
  return { providers, routing }
}

/** Which model would answer a tier if provider `pid` stopped working (null = none). Used before removing a key. */
export function servingWithout(view: SettingsView, tier: TierId, pid: string): string | null {
  for (const ref of view.routing.tiers[tier].chain) {
    const [id] = splitRef(ref)
    const provider = view.providers.find((p) => p.id === id)
    if (id === pid || !provider || !provider.enabled) continue
    if (provider.key.state === 'none' || provider.key.state === 'needs-reentry') continue
    if (provider.lastTest && !provider.lastTest.ok) continue
    return ref
  }
  return null
}

export const ENV_KEY: Record<string, string> = {
  openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY', openrouter: 'OPENROUTER_API_KEY', typesafe: 'TYPESAFE_API_KEY',
}
