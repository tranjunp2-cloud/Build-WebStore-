/**
 * TC-AIS-LIM-009..013 — editor draft: diffs, group writes, config round trip, chain/price validation.
 * Real: draft.ts, config-validation.ts, ai-config-schema.
 */
import { describe, expect, it } from 'vitest'
import { draftFromData, draftToConfig, describeChanges, limitChanges, configIfChanged } from '@/lib/admin/ai-settings/draft'
import { resolveCaps } from '@/lib/admin/ai-caps/caps-config'
import { validateConfig } from '@/lib/admin/ai-settings/config-validation'
import { ALL_PLAN_CODES } from '@/lib/admin/ai-settings/plan-groups'
import type { AiSettingsData, LimitValues } from '@/lib/admin/ai-settings/types'

const every = (value: string) => Object.fromEntries(ALL_PLAN_CODES.map((c) => [c, value])) as LimitValues['budget']
const limits = (budget: string, pictures: string): LimitValues => ({
  budget: every(budget),
  pictures: every(pictures),
  monthly: every('UNLIMITED'),
  site: every('UNLIMITED'),
  enabled: every('YES'),
})

const data = (): AiSettingsData => ({
  limits: limits('0.15', '3'),
  config: {
    prices: {
      'anthropic:claude-haiku-5-5': { input: 1, output: 5, cachedInput: 0.1, longContext: { aboveInputTokens: 200000, input: 2, output: 7.5 } },
    },
    images: { 'openai:gpt-image-1': 0.04 },
    models: { fast: 'anthropic:claude-haiku-5-5', image: 'openai:gpt-image-1' },
  },
  caps: resolveCaps(null, {}),
  configUpdatedAt: '2026-10-21T16:04:00.000Z',
  configInvalid: false,
  stats: [],
  unpriced: [{ model: 'anthropic:claude-haiku-5-5-2026', calls: 12 }],
})

describe('[TC-AIS-LIM-009] limit changes', () => {
  it('lists only the codes whose value differs, one entry per code', () => {
    // Arrange
    const draft = limits('0.15', '3')
    draft.budget.STARTER_TM_USER = '0.3'
    draft.budget.STARTER_NON_TM_USER = '0.3'
    draft.pictures.FREEMIUM = 'UNLIMITED'
    // Act
    const changes = limitChanges(limits('0.15', '3'), draft)
    // Assert
    expect(changes).toEqual([
      { planCode: 'STARTER_TM_USER', kind: 'budget', value: '0.3' },
      { planCode: 'STARTER_NON_TM_USER', kind: 'budget', value: '0.3' },
      { planCode: 'FREEMIUM', kind: 'pictures', value: 'UNLIMITED' },
    ])
  })
})

describe('[TC-AIS-LIM-010] config round trip', () => {
  it('rebuilds the saved config from the draft, keeping fields the table does not edit', () => {
    // Arrange
    const source = data()
    source.config.prices['anthropic:claude-haiku-5-5'].offPeakFactor = 0.5
    // Act
    const rebuilt = validateConfig(draftToConfig(draftFromData({ ...source, unpriced: [] })))
    // Assert
    expect(rebuilt).toEqual({ config: source.config })
  })

  it('reports no config change for an untouched draft', () => {
    expect(configIfChanged(data(), draftFromData(data()))).toBeUndefined()
    expect(describeChanges(data(), draftFromData(data()))).toEqual([])
  })
})

describe('[TC-AIS-LIM-011] unpriced models', () => {
  it('adds a blank row per unpriced model, left out of the save while input and output are blank', () => {
    // Arrange
    const draft = draftFromData(data())
    // Act
    const row = draft.prices.find((r) => r.key === 'anthropic:claude-haiku-5-5-2026')
    const config = draftToConfig(draft) as { prices: Record<string, unknown> }
    // Assert
    expect(row).toMatchObject({ fromUnpriced: true, input: '', output: '' })
    expect(Object.keys(config.prices)).toEqual(['anthropic:claude-haiku-5-5'])
    expect(describeChanges(data(), draft)).toEqual([])
  })

  it('saves it once priced and describes the change', () => {
    // Arrange
    const draft = draftFromData(data())
    const row = draft.prices.find((r) => r.fromUnpriced)!
    row.input = '1'
    row.output = '5'
    // Act / Assert
    expect(describeChanges(data(), draft)).toEqual(['Price added: anthropic:claude-haiku-5-5-2026'])
    expect(validateConfig(draftToConfig(draft))).toHaveProperty('config')
  })
})

describe('[TC-AIS-LIM-012] config validation errors are field-level', () => {
  it('points at the price field the schema rejects', () => {
    // Arrange
    const draft = draftFromData(data())
    draft.prices[0].input = 'abc'
    // Act
    const result = validateConfig(draftToConfig(draft))
    // Assert
    expect(result).toHaveProperty('errors')
    const errors = (result as { errors: Array<{ path: string[] }> }).errors
    expect(errors[0].path).toEqual(['config', 'prices', 'anthropic:claude-haiku-5-5', 'input'])
  })

  it('rejects a chain model that has no price, and an image model with no picture price', () => {
    // Arrange
    const draft = draftFromData(data())
    draft.chains.fast = ['anthropic:claude-haiku-5-5', 'openai:gpt-9']
    draft.chains.image = ['anthropic:claude-haiku-5-5']
    // Act
    const result = validateConfig(draftToConfig(draft)) as { errors: Array<{ path: string[]; message: string }> }
    // Assert
    expect(result.errors.map((e) => e.path.join('.'))).toEqual(['config.models.fast', 'config.models.image'])
    expect(result.errors[0].message).toContain('openai:gpt-9')
  })

  it('rejects a key that is not provider:model', () => {
    const result = validateConfig({ prices: { nonsense: { input: 1, output: 1 } }, images: {}, models: {} })
    expect(result).toHaveProperty('errors')
  })
})

describe('[TC-AIS-LIM-013] change descriptions', () => {
  it('describes group limit and chain changes in plain lines', () => {
    // Arrange
    const draft = draftFromData(data())
    draft.limits.budget.FREEMIUM = '0.08'
    draft.limits.pictures.STARTER_TM_USER = '5'
    draft.chains.fast = []
    // Act
    const lines = describeChanges(data(), draft)
    // Assert
    expect(lines).toEqual([
      'Free · AI budget: $0.15/day → $0.08/day',
      'Starter · Pictures: 3/day → differs by code',
      'Model chain fast: anthropic:claude-haiku-5-5 → none',
    ])
  })
})
