/**
 * TC-AIS-LIM-001..008 — plan groups, limit (de)serialisation, 7-day spread and "would have hit" preview.
 * Real: plan-groups, limit-stats, ai-config-schema validators.
 */
import { describe, expect, it } from 'vitest'
import { PLAN_CODES } from '@/collections/PlanSubscriptions'
import {
  ALL_PLAN_CODES, PLAN_GROUPS, groupOfPlan, normalizeLimit, parseLimitDraft, serializeLimit, sharedValue,
} from '@/lib/admin/ai-settings/plan-groups'
import { buildGroupStats, hitSentence, percentile, spreadOf, wouldHaveHit } from '@/lib/admin/ai-settings/limit-stats'

describe('[TC-AIS-LIM-001] plan group → codes mapping', () => {
  it('maps Free/Starter/Standard/Professional to the agreed codes and covers every plan code once', () => {
    // Arrange / Act
    const byLabel = Object.fromEntries(PLAN_GROUPS.map((g) => [g.label, [...g.codes]]))
    // Assert
    expect(byLabel).toEqual({
      Free: ['FREEMIUM'],
      Starter: ['STARTER_TM_USER', 'STARTER_NON_TM_USER'],
      Standard: ['STANDARD_TM_USER', 'STANDARD_NON_TM_USER'],
      Professional: ['PROFESSIONAL_TM_USER', 'PROFESSIONAL_NON_TM_USER'],
    })
    expect([...ALL_PLAN_CODES].sort()).toEqual(PLAN_CODES.map((p) => p.value).sort())
  })

  it('finds a group by plan code and ignores unknown or null plans', () => {
    expect(groupOfPlan('STANDARD_NON_TM_USER')?.id).toBe('standard')
    expect(groupOfPlan('NOPE')).toBeNull()
    expect(groupOfPlan(null)).toBeNull()
  })
})

describe('[TC-AIS-LIM-002] unlimited / number serialisation', () => {
  it('serialises the switch to UNLIMITED and a typed value to its trimmed text', () => {
    expect(serializeLimit({ unlimited: true, value: '3' })).toBe('UNLIMITED')
    expect(serializeLimit({ unlimited: false, value: ' 0.25 ' })).toBe('0.25')
  })

  it('reads UNLIMITED and YES (any case) as unlimited and numbers as a typed value', () => {
    expect(parseLimitDraft('unlimited')).toEqual({ unlimited: true, value: '' })
    expect(parseLimitDraft('YES')).toEqual({ unlimited: true, value: '' })
    expect(parseLimitDraft('0.4')).toEqual({ unlimited: false, value: '0.4' })
    expect(parseLimitDraft(null)).toEqual({ unlimited: false, value: '' })
  })

  it('shares a value across a group only when its codes agree', () => {
    const starter = PLAN_GROUPS[1]
    expect(sharedValue(starter, { STARTER_TM_USER: '1', STARTER_NON_TM_USER: '1' })).toBe('1')
    expect(sharedValue(starter, { STARTER_TM_USER: '1', STARTER_NON_TM_USER: '2' })).toBeNull()
  })
})

describe('[TC-AIS-LIM-003] limit validation surfaces the shared problem sentence', () => {
  it('accepts numbers and UNLIMITED, normalising YES', () => {
    expect(normalizeLimit('budget', ' 0.5 ')).toEqual({ value: '0.5' })
    expect(normalizeLimit('budget', 'unlimited')).toEqual({ value: 'UNLIMITED' })
    expect(normalizeLimit('pictures', 'YES')).toEqual({ value: 'UNLIMITED' })
    expect(normalizeLimit('pictures', '0')).toEqual({ value: '0' })
  })

  it('rejects negatives, text, empty and fractional pictures with a message naming the feature', () => {
    for (const [kind, raw] of [['budget', '-1'], ['budget', 'abc'], ['budget', ''], ['pictures', '1.5']] as const) {
      const result = normalizeLimit(kind, raw)
      expect('error' in result && result.error).toContain(kind === 'budget' ? 'ai_budget_usd_daily' : 'ai_pictures_daily')
    }
  })
})

describe('[TC-AIS-LIM-004] spread over active shop-days', () => {
  it('interpolates percentiles of an ascending list', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(percentile([0, 10], 0.9)).toBeCloseTo(9)
    expect(percentile([], 0.5)).toBe(0)
  })

  it('ignores zero days and returns p50/p90/max', () => {
    expect(spreadOf([0, 0, 1, 2, 3])).toEqual({ p50: 2, p90: 2.8, max: 3 })
    expect(spreadOf([])).toEqual({ p50: 0, p90: 0, max: 0 })
  })
})

describe('[TC-AIS-LIM-005] per-group stats shape', () => {
  it('buckets shop-days by plan group, tracks each shop worst day and drops shops with no usage', () => {
    // Arrange
    const rows = [
      { tenantId: 1, name: 'A', plan: 'FREEMIUM', budget: 0.1, pictures: 0 },
      { tenantId: 1, name: 'A', plan: 'FREEMIUM', budget: 0.4, pictures: 2 },
      { tenantId: 2, name: null, plan: 'STARTER_TM_USER', budget: 0.2, pictures: 0 },
      { tenantId: 3, name: 'Idle', plan: 'STARTER_NON_TM_USER', budget: 0, pictures: 0 },
      { tenantId: 4, name: 'Other', plan: 'MYSTERY', budget: 9, pictures: 9 },
    ]
    // Act
    const stats = buildGroupStats(rows)
    // Assert
    expect(stats.map((s) => s.group)).toEqual(['free', 'starter', 'standard', 'professional'])
    expect(stats[0].shops).toEqual([{ id: 1, name: 'A', maxBudget: 0.4, maxPictures: 2 }])
    expect(stats[0].budget.max).toBe(0.4)
    expect(stats[1].shops).toEqual([{ id: 2, name: 'Shop #2', maxBudget: 0.2, maxPictures: 0 }])
    expect(stats[2].shops).toEqual([])
  })
})

describe('[TC-AIS-LIM-006] would-have-hit preview', () => {
  const shops = [
    { id: 1, name: 'Low', maxBudget: 0.1, maxPictures: 1 },
    { id: 2, name: 'Mid', maxBudget: 0.5, maxPictures: 4 },
    { id: 3, name: 'High', maxBudget: 1.2, maxPictures: 9 },
    { id: 4, name: 'Top', maxBudget: 2, maxPictures: 0 },
  ]

  it('counts shops whose worst day reached the limit, worst first, naming at most two', () => {
    const hit = wouldHaveHit(shops, 'budget', 0.5)
    expect(hit).toEqual({ count: 3, names: ['Top', 'High'] })
    expect(hitSentence(hit)).toBe('3 shops would have hit this limit last 7 days: Top, High and 1 more.')
  })

  it('counts pictures separately and treats unlimited as nobody', () => {
    expect(wouldHaveHit(shops, 'pictures', 4).count).toBe(2)
    expect(wouldHaveHit(shops, 'budget', null)).toEqual({ count: 0, names: [] })
    expect(hitSentence({ count: 0, names: [] })).toBe('No shop would have hit this limit last 7 days.')
  })

  it('a limit of 0 hits every shop that used the feature, and a bad number hits nobody', () => {
    expect(wouldHaveHit(shops, 'pictures', 0).count).toBe(3)
    expect(wouldHaveHit(shops, 'budget', Number.NaN).count).toBe(0)
    expect(hitSentence({ count: 1, names: ['Solo'] })).toBe('1 shop would have hit this limit last 7 days: Solo.')
  })
})
