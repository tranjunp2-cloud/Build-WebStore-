/**
 * TC-AIPROV-PW-007..008, 016, 017, 018 — pure logic behind the Studio pages: rail badges, tier states, chain options,
 * routing / tasks / runtime / providers drafts and their request bodies.
 */
import { describe, expect, it } from 'vitest'
import { chainOptions } from '@/lib/admin/ai-providers/chain-options'
import { typedRefProblem } from '@/app/studio/settings/ai/models/_components/chain-row'
import { applyProvidersPatch, emptyProvidersPatch, gatewayWrite, providersChanges, providersDraftFromView, providersProblems, providerWrites } from '@/lib/admin/ai-providers/providers-draft'
import { routingBody, routingChanges, routingDraftFromView, routingProblems } from '@/lib/admin/ai-providers/routing-draft'
import { fmtRuntime, runtimeBody, runtimeChanges, runtimeDraftFromView, runtimeProblems, resetEntry } from '@/lib/admin/ai-providers/runtime-draft'
import { computeBadges, providerStatus, servingWithout, tierState } from '@/lib/admin/ai-providers/status'
import { tasksBody, tasksChanges, tasksDraftFromView } from '@/lib/admin/ai-providers/tasks-draft'
import { brokenView, healthyView, okTest, provider } from './fixtures'

describe('[TC-AIPROV-PW-007] rail badges', () => {
  it('has none on a healthy install and when the view is missing', () => {
    expect(computeBadges(healthyView())).toEqual({ providers: 0, routing: 0 })
    expect(computeBadges(null)).toEqual({ providers: 0, routing: 0 })
  })
  it('counts providers that need re-entry, failed their test, or have no key but sit in a chain, and tiers that are down or on a fallback', () => {
    // openrouter needs re-entry + used, deepseek test failed (enabled); quality on fallback, image down
    expect(computeBadges(brokenView())).toEqual({ providers: 2, routing: 2 })
    const view = healthyView()
    view.routing.tiers.fast.chain = ['google:gemini-3-pro']
    expect(computeBadges(view).providers).toBe(1)
  })
  it('ignores a disabled provider whose key is fine and counts each provider once', () => {
    const view = healthyView()
    view.providers.push(provider({ id: 'deepseek', enabled: false, lastTest: okTest({ ok: false, code: 'quota' }) }))
    expect(computeBadges(view).providers).toBe(0)
    view.providers.push(provider({ id: 'openrouter', key: { state: 'needs-reentry', last4: null, setBy: null, setAt: null }, lastTest: okTest({ ok: false, code: 'error' }) }))
    expect(computeBadges(view).providers).toBe(1)
  })
})

describe('[TC-AIPROV-PW-008] tier and provider states', () => {
  it('maps tier health to a tone and words', () => {
    expect(tierState('first-choice')).toEqual({ tone: 'ok', text: 'First choice' })
    expect(tierState('fallback')).toEqual({ tone: 'warn', text: 'On fallback' })
    expect(tierState('down')).toEqual({ tone: 'danger', text: 'Not working' })
  })
  it('reports key and test problems on the provider', () => {
    const view = brokenView()
    const by = (id: string) => providerStatus(view.providers.find((p) => p.id === id)!)
    expect(by('openrouter')).toEqual({ tone: 'danger', text: 'Needs re-entry' })
    expect(by('deepseek')).toEqual({ tone: 'warn', text: 'Quota exceeded' })
    expect(by('google')).toEqual({ tone: 'mute', text: 'No key' })
    expect(by('openai')).toEqual({ tone: 'ok', text: 'OK · 640 ms' })
  })
  it('finds which model answers when a provider drops out', () => {
    const view = healthyView()
    expect(servingWithout(view, 'fast', 'anthropic')).toBe('openai:gpt-5.4-nano')
    expect(servingWithout(view, 'quality', 'anthropic')).toBeNull()
  })
})

describe('chain options', () => {
  it('lists usable providers, splits picture models, flags missing prices and a model already used', () => {
    const view = healthyView()
    const groups = chainOptions(view, 'fast', view.routing.tiers.fast.chain, 1, new Set(['openai:gpt-5.4-nano']))
    expect(groups.map((g) => g.id)).toEqual(['openai', 'anthropic'])
    const openai = groups[0].options
    expect(openai.map((o) => o.model)).toEqual(['gpt-5.4-mini', 'gpt-5.4-nano'])
    expect(openai[0].notes).toContain('no price: usage counts $0')
    expect(groups[1].options.find((o) => o.model === 'claude-haiku-5-5')?.taken).toBe(true)
    expect(chainOptions(view, 'image', ['openai:gpt-image-1'], 0, null)[0].options.map((o) => o.model)).toEqual(['gpt-image-1'])
  })
})

describe('[TC-AIPROV-PW-021] self-hosted endpoint models', () => {
  it('offers the models an endpoint listed, even when it needs no key; a typed id must name a known provider', () => {
    // Arrange
    const view = healthyView()
    view.providers.push(provider({ id: 'compat-vllm', kind: 'compat', key: { state: 'none', last4: null, setBy: null, setAt: null }, models: ['llama-3.1-70b'] }))
    // Act
    const groups = chainOptions(view, 'quality', [], 0, null)
    // Assert
    const vllm = groups.find((g) => g.id === 'compat-vllm')
    expect(vllm?.options.map((o) => o.model)).toEqual(['llama-3.1-70b'])
    expect(vllm?.options[0].notes).toEqual([])
    expect(typedRefProblem(view, 'compat-vllm:qwen-2.5-72b')).toBeNull()
    expect(typedRefProblem(view, 'llama')).toMatch(/provider:model/)
    expect(typedRefProblem(view, 'compat-nope:x')).toMatch(/No provider "compat-nope"/)
  })
})

describe('[TC-AIPROV-PW-014] routing draft', () => {
  it('sends only the tiers and fields that changed, in ms, with effort null for Default', () => {
    const view = healthyView()
    const draft = routingDraftFromView(view)
    draft.fast.chain = ['anthropic:claude-haiku-5-5']
    draft.balanced.effort = 'default'
    draft.quality.timeoutSec = '120'
    draft.image.format = 'png'
    expect(routingBody(view, draft)).toEqual({ tiers: {
      fast: { chain: ['anthropic:claude-haiku-5-5'] }, balanced: { effort: null }, quality: { timeoutMs: 120_000 }, image: { format: 'png' },
    } })
    expect(routingChanges(view, draft)).toEqual([
      'Fast chain: claude-haiku-5-5 → gpt-5.4-nano → claude-haiku-5-5', 'Balanced effort: Medium → Default', 'Quality timeout: 60 s → 120 s', 'Image format: webp → png',
    ])
  })
  it('ignores blank rows in the body and blocks empty, duplicated and out-of-range tiers', () => {
    const view = healthyView()
    const draft = routingDraftFromView(view)
    draft.fast.chain = [...draft.fast.chain, '']
    expect(routingBody(view, draft).tiers).toEqual({})
    draft.balanced.chain = []
    draft.quality.chain = ['a:b', 'a:b']
    draft.image.timeoutSec = '291'
    expect(Object.keys(routingProblems(draft))).toEqual(['balanced', 'quality', 'image'])
    expect(routingProblems(routingDraftFromView(view))).toEqual({})
  })
})

describe('[TC-AIPROV-PW-016] runtime validation', () => {
  it('fails queue wait + answer time above 290 s on both fields and passes at exactly 290 s', () => {
    const view = healthyView()
    const draft = runtimeDraftFromView(view)
    expect(runtimeProblems(view, draft)).toEqual({})
    draft.queueMaxWaitMs = { value: '120', reset: false }
    const problems = runtimeProblems(view, draft)
    expect(problems.queueMaxWaitMs).toContain('under 290 s (now 320 s)')
    expect(problems.runBudgetMs).toBe(problems.queueMaxWaitMs)
    draft.queueMaxWaitMs = { value: '90', reset: false }
    expect(runtimeProblems(view, draft)).toEqual({})
  })
  it('rejects non-numbers and values outside min / max', () => {
    const view = healthyView()
    const draft = runtimeDraftFromView(view)
    draft.runsPerDayPerShop = { value: 'abc', reset: false }
    draft.queueMaxWaitMs = { value: '0.1', reset: false }
    draft.runBudgetMs = { value: '300', reset: false }
    const problems = runtimeProblems(view, draft)
    expect(problems.runsPerDayPerShop).toBe('Enter a whole number.')
    expect(problems.queueMaxWaitMs).toBe('At least 1 s.')
    expect(problems.runBudgetMs).toBe('At most 290 s.')
  })
})

describe('[TC-AIPROV-PW-017] runtime body', () => {
  it('keeps Studio values, sends null for env/default ones and for resets, converts seconds to ms', () => {
    const view = healthyView()
    view.runtime[0].source = 'studio'
    view.runtime[0].value = 150
    const draft = runtimeDraftFromView(view)
    draft.queueMaxWaitMs = { value: '60', reset: false }
    draft.suggestMode = { value: 'off', reset: false }
    draft.toolRouting = resetEntry(view.runtime[4])
    expect(runtimeBody(view, draft).values).toEqual({
      runsPerDayPerShop: 150, queueMaxWaitMs: 60_000, runBudgetMs: null, suggestMode: 'off', toolRouting: null,
    })
    expect(runtimeChanges(view, draft)).toEqual(['Longest wait in the queue: 90 s → 60 s', 'Next-message suggestions: rules → off'])
    expect(fmtRuntime(view.runtime[1], 60_000)).toBe('60 s')
  })
})

describe('[TC-AIPROV-PW-018] tasks draft', () => {
  it('lists moved tasks and sends the whole override map with null for cleared ones', () => {
    const view = healthyView()
    const draft = tasksDraftFromView(view)
    expect(tasksChanges(view, draft)).toEqual([])
    draft['chat.reply'] = 'quality'
    draft['product.description'] = null
    expect(tasksChanges(view, draft)).toEqual(['Copilot chat reply: Fast (default) → Quality', 'Product description: Fast → Balanced (default)'])
    expect(tasksBody(draft).overrides).toEqual({ 'chat.reply': 'quality', 'product.description': null, 'picture.generate': null })
  })
})

describe('providers draft', () => {
  it('writes only what changed and keeps unsaved edits when the view changes', () => {
    const view = healthyView()
    const patch = emptyProvidersPatch()
    patch.enabled.anthropic = false
    patch.baseUrl.openai = ' https://proxy.example.com/v1 '
    patch.gateway = { baseUrl: 'https://gw.example.com', paths: { openai: 'oai' } }
    const draft = applyProvidersPatch(providersDraftFromView(view), patch)
    expect(providerWrites(view, draft)).toEqual([{ id: 'openai', body: { baseUrl: 'https://proxy.example.com/v1' } }, { id: 'anthropic', body: { enabled: false } }])
    expect(gatewayWrite(view, draft)).toEqual({ baseUrl: 'https://gw.example.com', paths: { openai: 'oai', anthropic: 'anthropic' } })
    expect(providersChanges(view, draft)).toContain('Anthropic: turned off')
    expect(providersProblems(applyProvidersPatch(providersDraftFromView(view), { ...emptyProvidersPatch(), baseUrl: { openai: 'nope' } }))).toEqual({ openai: expect.stringContaining('https://') })
  })
})
