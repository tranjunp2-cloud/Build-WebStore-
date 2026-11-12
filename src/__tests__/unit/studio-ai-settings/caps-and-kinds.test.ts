/**
 * TC-AICAP-PW-090..099 — AI settings page data: plan on/off + monthly + website-setup limits per plan group, and the
 * platform caps block (load, save, preserve, remove, validate), through the same store and route as budget / pictures.
 * Real: settings-store, plan-groups, draft, caps-config, route, PlanFeatures hook errors. Faked: Payload local API, caches, SQL reads, session.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(), update: vi.fn(), create: vi.fn(), clearLimits: vi.fn(), clearConfig: vi.fn(),
  loadGroupStats: vi.fn(), loadUnpricedModels: vi.fn(), getCurrentUser: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: async () => ({ find: mocks.find, update: mocks.update, create: mocks.create }),
}))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/ai-platform/ai-config', () => ({ clearAiConfigCache: mocks.clearConfig }))
vi.mock('@/lib/ai-platform/plan-limits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai-platform/plan-limits')>()),
  clearAiLimitsCache: mocks.clearLimits,
}))
vi.mock('@/lib/admin/ai-settings/usage-queries', () => ({ loadGroupStats: mocks.loadGroupStats, loadUnpricedModels: mocks.loadUnpricedModels }))

import { PUT } from '@/app/api/admin/ai-settings/route'
import { describeLimitChanges, limitChanges } from '@/lib/admin/ai-settings/draft'
import { LIMIT_KINDS, normalizeLimit } from '@/lib/admin/ai-settings/plan-groups'
import { loadAiSettings, saveAiSettings } from '@/lib/admin/ai-settings/settings-store'
import type { AiSettingsData, LimitValues } from '@/lib/admin/ai-settings/types'
import { resolveCaps } from '@/lib/admin/ai-caps/caps-config'
import { ALL_PLAN_CODES, PLAN_GROUPS } from '@/lib/admin/ai-settings/plan-groups'

const found = (docs: unknown[]) => ({ docs })
const PRICES = { 'a:b': { input: 1, output: 2 } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.find.mockResolvedValue(found([]))
  mocks.update.mockResolvedValue({})
  mocks.create.mockResolvedValue({})
  mocks.loadGroupStats.mockResolvedValue([])
  mocks.loadUnpricedModels.mockResolvedValue([])
  mocks.getCurrentUser.mockResolvedValue({ id: 1, roles: ['super-admin'] })
})

describe('[TC-AICAP-PW-090] load', () => {
  it('returns all five limit kinds per plan code (missing rows: AI on, new budgets unlimited) and the caps next to a config without caps', async () => {
    // Arrange
    mocks.find.mockImplementation(async ({ where }: { where: { featureCode: { in?: string[] } } }) =>
      where.featureCode.in
        ? found([
            { planCode: 'FREEMIUM', featureCode: 'ai_enabled', value: 'NO' },
            { planCode: 'STARTER_TM_USER', featureCode: 'ai_budget_usd_monthly', value: '12' },
            { planCode: 'STARTER_TM_USER', featureCode: 'ai_site_budget_usd_daily', value: '0.3' },
          ])
        : found([{ settings: { prices: PRICES, caps: { dailyUsd: 40, monthlyUsd: 900, alertPercents: [60, 90], pauseFreeAtPercent: 85 } }, updatedAt: '2026-10-29T01:00:00Z' }]))
    // Act
    const data = await loadAiSettings()
    // Assert
    expect(Object.keys(data.limits).sort()).toEqual([...LIMIT_KINDS].sort())
    expect(data.limits.enabled).toMatchObject({ FREEMIUM: 'NO', STARTER_TM_USER: 'YES' })
    expect(data.limits.monthly).toMatchObject({ STARTER_TM_USER: '12', FREEMIUM: 'UNLIMITED' })
    expect(data.limits.site).toMatchObject({ STARTER_TM_USER: '0.3', STANDARD_TM_USER: 'UNLIMITED' })
    expect(data.limits.budget.STARTER_TM_USER).toBe('0.15')
    expect(data.config).toEqual({ prices: PRICES, images: {}, models: {} })
    expect(data.config).not.toHaveProperty('caps')
    expect(data.caps).toMatchObject({
      saved: { dailyUsd: 40, monthlyUsd: 900, alertPercents: [60, 90], pauseFreeAtPercent: 85 },
      effective: { dailyUsd: 40, monthlyUsd: 900, alertPercents: [60, 90], pauseFreeAtPercent: 85 },
      dailySource: 'settings',
    })
  })

  it('shows the env default as the effective daily cap while no caps block is saved', async () => {
    mocks.find.mockResolvedValue(found([]))
    const data = await loadAiSettings()
    expect(data.caps.saved).toBeNull()
    expect(data.caps.effective).toMatchObject({ monthlyUsd: null, alertPercents: [50, 80, 100] })
    expect(data.caps.dailySource).toMatch(/env|off/)
  })
})

describe('[TC-AICAP-PW-091] new limit kinds are saved like budget / pictures', () => {
  it('normalises ai_enabled to YES / NO and the budgets to a number or UNLIMITED, one write per code', async () => {
    mocks.find.mockImplementation(async ({ where }: { where: { and: Array<Record<string, { equals: string }>> } }) =>
      found([{ id: `row-${where.and[0].planCode.equals}-${where.and[1].featureCode.equals}` }]))
    const result = await saveAiSettings({
      limits: [
        { planCode: 'FREEMIUM', kind: 'enabled', value: ' no ' },
        { planCode: 'STARTER_TM_USER', kind: 'monthly', value: ' 12.5 ' },
        { planCode: 'STARTER_TM_USER', kind: 'site', value: 'unlimited' },
      ],
    })
    expect(result).toEqual({ ok: true, written: 3 })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'row-FREEMIUM-ai_enabled', data: { value: 'NO' } }))
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'row-STARTER_TM_USER-ai_budget_usd_monthly', data: { value: '12.5' } }))
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'row-STARTER_TM_USER-ai_site_budget_usd_daily', data: { value: 'UNLIMITED' } }))
    expect(mocks.clearLimits).toHaveBeenCalledTimes(1)
  })

  it('creates a missing row with the right feature code, and rejects bad values per field before writing anything', async () => {
    await saveAiSettings({ limits: [{ planCode: 'FREEMIUM', kind: 'site', value: '0.2' }] })
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: { planCode: 'FREEMIUM', featureCode: 'ai_site_budget_usd_daily', value: '0.2' } }))

    mocks.create.mockClear()
    const bad = await saveAiSettings({
      limits: [
        { planCode: 'FREEMIUM', kind: 'enabled', value: 'maybe' },
        { planCode: 'FREEMIUM', kind: 'monthly', value: '-1' },
        { planCode: 'FREEMIUM', kind: 'budget', value: '0.1' },
      ],
    })
    expect(bad.ok).toBe(false)
    expect((bad as { errors: Array<{ path: string[] }> }).errors.map((e) => e.path)).toEqual([['limits', 'FREEMIUM', 'enabled'], ['limits', 'FREEMIUM', 'monthly']])
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(normalizeLimit('enabled', 'yes')).toEqual({ value: 'YES' })
    expect(normalizeLimit('enabled', 'UNLIMITED')).toMatchObject({ error: expect.stringMatching(/YES or NO/) })
  })

  it('a group edit diffs and describes the new kinds', () => {
    const every = (value: string) => Object.fromEntries(ALL_PLAN_CODES.map((c) => [c, value])) as LimitValues['budget']
    const saved: LimitValues = { budget: every('1'), pictures: every('1'), monthly: every('UNLIMITED'), site: every('UNLIMITED'), enabled: every('YES') }
    const draft = structuredClone(saved)
    draft.enabled.FREEMIUM = 'NO'
    draft.monthly.STARTER_TM_USER = '10'
    draft.monthly.STARTER_NON_TM_USER = '10'
    expect(limitChanges(saved, draft)).toEqual([
      { planCode: 'STARTER_TM_USER', kind: 'monthly', value: '10' },
      { planCode: 'STARTER_NON_TM_USER', kind: 'monthly', value: '10' },
      { planCode: 'FREEMIUM', kind: 'enabled', value: 'NO' },
    ])
    const lines = describeLimitChanges({ limits: saved } as AiSettingsData, { limits: draft } as never)
    expect(lines).toEqual(['Free · AI: On → Off', 'Starter · Monthly AI budget: Unlimited → $10/month'])
    expect(PLAN_GROUPS).toHaveLength(4)
  })
})

describe('[TC-AICAP-PW-092] caps save', () => {
  const caps = { dailyUsd: 25, monthlyUsd: 600, alertPercents: [50, 90], pauseFreeAtPercent: 80 }

  it('writes only the caps block into the existing row and keeps prices / models as saved', async () => {
    mocks.find.mockResolvedValue(found([{ id: 'cfg', settings: { prices: PRICES, images: {}, models: { fast: 'a:b' } } }]))
    const result = await saveAiSettings({ caps })
    expect(result).toEqual({ ok: true, written: 1 })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'cfg', data: { settings: { prices: PRICES, images: {}, models: { fast: 'a:b' }, caps } } }))
    expect(mocks.clearConfig).toHaveBeenCalled()
    expect(mocks.clearLimits).toHaveBeenCalled()
  })

  it('a prices / chains save without caps leaves the saved caps in place', async () => {
    mocks.find.mockResolvedValue(found([{ id: 'cfg', settings: { prices: {}, caps } }]))
    await saveAiSettings({ config: { prices: PRICES, images: {}, models: {} } })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { settings: { prices: PRICES, images: {}, models: {}, caps } } }))
  })

  it('caps: null removes the block (back to the env default); the other keys stay', async () => {
    mocks.find.mockResolvedValue(found([{ id: 'cfg', settings: { prices: PRICES, caps } }]))
    await saveAiSettings({ caps: null })
    const settings = mocks.update.mock.calls[0]![0].data.settings
    expect(settings).toEqual({ prices: PRICES, images: {}, models: {} })
    expect(settings).not.toHaveProperty('caps')
  })

  it('creates the platform row under FREEMIUM when only caps are set and none exists', async () => {
    await saveAiSettings({ caps: { monthlyUsd: 100 } })
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ planCode: 'FREEMIUM', featureCode: 'ai_platform_config', settings: { prices: {}, images: {}, models: {}, caps: { monthlyUsd: 100 } } }),
    }))
  })

  it('reports invalid caps with a caps.* path and writes nothing (limits in the same request included)', async () => {
    const result = await saveAiSettings({
      limits: [{ planCode: 'FREEMIUM', kind: 'budget', value: '0.1' }],
      caps: { dailyUsd: -1, alertPercents: [90, 50] },
    })
    expect(result.ok).toBe(false)
    const paths = (result as { errors: Array<{ path: string[] }> }).errors.map((e) => e.path)
    expect(paths).toEqual([['caps', 'dailyUsd'], ['caps', 'alertPercents']])
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('resolves the effective caps like ai-platform: saved daily wins, null/0 off, absent → env', () => {
    expect(resolveCaps({ dailyUsd: 25 }, { AI_DAILY_BUDGET_USD: '5' }).effective.dailyUsd).toBe(25)
    expect(resolveCaps({}, { AI_DAILY_BUDGET_USD: '5' }).effective.dailyUsd).toBe(5)
  })
})

describe('[TC-AICAP-PW-093] route', () => {
  const put = (body: unknown) => new NextRequest('https://prime.test/api/admin/ai-settings', { method: 'PUT', body: JSON.stringify(body) })

  it('accepts a caps-only body and the new kinds, passes caps (including null) to the store', async () => {
    mocks.find.mockResolvedValue(found([]))
    const caps = { dailyUsd: 10 }
    expect((await PUT(put({ caps }))).status).toBe(200)
    expect(mocks.create).toHaveBeenCalledTimes(1)
    mocks.create.mockClear()
    expect((await PUT(put({ caps: null }))).status).toBe(200)
    expect((await PUT(put({ limits: [{ planCode: 'FREEMIUM', kind: 'enabled', value: 'NO' }] }))).status).toBe(200)
  })

  it('answers 400 for an unknown kind and for a body with nothing to save; 422 with caps paths for invalid caps', async () => {
    expect((await PUT(put({ limits: [{ planCode: 'FREEMIUM', kind: 'weekly', value: '1' }] }))).status).toBe(400)
    expect((await PUT(put({}))).status).toBe(400)
    const res = await PUT(put({ caps: { alertPercents: [0] } }))
    expect(res.status).toBe(422)
    expect((await res.json()).errors[0].path[0]).toBe('caps')
  })

  it('answers 401 / 403 before any store call', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)
    expect((await PUT(put({ caps: {} }))).status).toBe(401)
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 2, roles: ['tenant-owner'] })
    expect((await PUT(put({ caps: {} }))).status).toBe(403)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
