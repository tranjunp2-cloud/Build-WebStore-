/**
 * TC-AIS-LIM-014..020 — saveAiSettings / loadAiSettings: group writes, create-if-missing, validation before any
 * write, collection-hook errors, platform config validation, cache clearing.
 * Real: settings-store, validators, PlanFeatures hook errors (ValidationError). Faked: Payload local API, caches, SQL reads.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from 'payload'

const mocks = vi.hoisted(() => ({
  find: vi.fn(), update: vi.fn(), create: vi.fn(), clearLimits: vi.fn(), clearConfig: vi.fn(),
  loadGroupStats: vi.fn(), loadUnpricedModels: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: async () => ({ find: mocks.find, update: mocks.update, create: mocks.create }),
}))
vi.mock('@/lib/ai-platform/ai-config', () => ({ clearAiConfigCache: mocks.clearConfig }))
vi.mock('@/lib/ai-platform/plan-limits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai-platform/plan-limits')>()),
  clearAiLimitsCache: mocks.clearLimits,
}))
vi.mock('@/lib/admin/ai-settings/usage-queries', () => ({
  loadGroupStats: mocks.loadGroupStats, loadUnpricedModels: mocks.loadUnpricedModels,
}))

import { loadAiSettings, saveAiSettings } from '@/lib/admin/ai-settings/settings-store'

const found = (docs: unknown[]) => ({ docs })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.find.mockResolvedValue(found([]))
  mocks.update.mockResolvedValue({})
  mocks.create.mockResolvedValue({})
})

describe('[TC-AIS-LIM-014] group save writes every code', () => {
  it('updates existing rows for both codes of a group and clears both caches', async () => {
    // Arrange
    mocks.find.mockImplementation(async ({ where }: { where: { and: Array<Record<string, { equals: string }>> } }) =>
      found([{ id: `row-${where.and[0].planCode.equals}` }]))
    // Act
    const result = await saveAiSettings({
      limits: [
        { planCode: 'STARTER_TM_USER', kind: 'budget', value: '0.3' },
        { planCode: 'STARTER_NON_TM_USER', kind: 'budget', value: ' unlimited ' },
      ],
    })
    // Assert
    expect(result).toEqual({ ok: true, written: 2 })
    expect(mocks.update).toHaveBeenCalledTimes(2)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ collection: 'plan-features', id: 'row-STARTER_TM_USER', data: { value: '0.3' }, overrideAccess: true }))
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'row-STARTER_NON_TM_USER', data: { value: 'UNLIMITED' } }))
    expect(mocks.clearLimits).toHaveBeenCalledTimes(1)
    expect(mocks.clearConfig).toHaveBeenCalledTimes(1)
  })

  it('creates the row when the seed has not run', async () => {
    // Act
    await saveAiSettings({ limits: [{ planCode: 'FREEMIUM', kind: 'pictures', value: '2' }] })
    // Assert
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'plan-features', overrideAccess: true,
      data: { planCode: 'FREEMIUM', featureCode: 'ai_pictures_daily', value: '2' },
    }))
  })
})

describe('[TC-AIS-LIM-015] validation errors surface per field and block every write', () => {
  it('returns a field error for each bad limit and writes nothing, not even the valid one', async () => {
    // Act
    const result = await saveAiSettings({
      limits: [
        { planCode: 'FREEMIUM', kind: 'budget', value: '0.1' },
        { planCode: 'STARTER_TM_USER', kind: 'budget', value: '-3' },
        { planCode: 'STANDARD_TM_USER', kind: 'pictures', value: '1.5' },
      ],
    })
    // Assert
    expect(result.ok).toBe(false)
    const errors = (result as { errors: Array<{ path: string[]; message: string }> }).errors
    expect(errors.map((e) => e.path)).toEqual([['limits', 'STARTER_TM_USER', 'budget'], ['limits', 'STANDARD_TM_USER', 'pictures']])
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.clearLimits).not.toHaveBeenCalled()
  })

  it('rejects an unknown plan code', async () => {
    const result = await saveAiSettings({ limits: [{ planCode: 'GOLD' as never, kind: 'budget', value: '1' }] })
    expect(result).toMatchObject({ ok: false, errors: [{ path: ['limits', 'GOLD', 'budget'] }] })
  })
})

describe('[TC-AIS-LIM-016] collection hook errors are mapped', () => {
  it('turns a PlanFeatures ValidationError into a field error and still clears caches for earlier writes', async () => {
    // Arrange
    mocks.find.mockResolvedValue(found([{ id: 1 }]))
    mocks.update
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new ValidationError({ collection: 'plan-features', errors: [{ message: 'hook says no', path: 'value' }] }))
    // Act
    const result = await saveAiSettings({
      limits: [
        { planCode: 'FREEMIUM', kind: 'budget', value: '0.1' },
        { planCode: 'STARTER_TM_USER', kind: 'budget', value: '0.2' },
      ],
    })
    // Assert
    expect(result).toEqual({ ok: false, errors: [{ path: ['limits', 'STARTER_TM_USER', 'budget'], message: 'hook says no' }] })
    expect(mocks.clearLimits).toHaveBeenCalledTimes(1)
  })

  it('rethrows unexpected database failures', async () => {
    mocks.find.mockRejectedValue(new Error('db down'))
    await expect(saveAiSettings({ limits: [{ planCode: 'FREEMIUM', kind: 'budget', value: '1' }] })).rejects.toThrow('db down')
  })
})

describe('[TC-AIS-LIM-017] platform config save', () => {
  const config = {
    prices: { 'anthropic:claude-haiku-5-5': { input: 1, output: 5 } },
    images: {},
    models: { fast: 'anthropic:claude-haiku-5-5' },
  }

  it('validates with the platform schema and returns paths of bad fields', async () => {
    // Act
    const result = await saveAiSettings({ config: { ...config, prices: { 'anthropic:claude-haiku-5-5': { input: -1, output: 5 } } } })
    // Assert
    expect(result).toMatchObject({ ok: false, errors: [{ path: ['config', 'prices', 'anthropic:claude-haiku-5-5', 'input'] }] })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('updates the single platform row in place', async () => {
    // Arrange
    mocks.find.mockResolvedValue(found([{ id: 'cfg' }]))
    // Act
    const result = await saveAiSettings({ config })
    // Assert
    expect(result).toEqual({ ok: true, written: 1 })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'cfg', data: { settings: config } }))
    expect(mocks.clearConfig).toHaveBeenCalled()
  })

  it('creates the row under FREEMIUM when none exists', async () => {
    await saveAiSettings({ config })
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ planCode: 'FREEMIUM', featureCode: 'ai_platform_config', settings: config }),
    }))
  })
})

describe('[TC-AIS-LIM-018] loading current values', () => {
  it('fills a missing limit row with the default ai-platform enforces and reads the config row', async () => {
    // Arrange
    mocks.find.mockImplementation(async ({ where }: { where: { featureCode: { in?: string[]; equals?: string } } }) =>
      where.featureCode.in
        ? found([{ planCode: 'FREEMIUM', featureCode: 'ai_budget_usd_daily', value: 'UNLIMITED' }])
        : found([{ settings: { prices: { 'a:b': { input: 1, output: 2 } } }, updatedAt: '2026-10-21T16:04:00Z' }]))
    mocks.loadGroupStats.mockResolvedValue([])
    mocks.loadUnpricedModels.mockResolvedValue([{ model: 'a:c', calls: 4 }])
    // Act
    const data = await loadAiSettings()
    // Assert
    expect(data.limits.budget.FREEMIUM).toBe('UNLIMITED')
    expect(data.limits.budget.STARTER_TM_USER).toBe('0.15')
    expect(data.limits.pictures.PROFESSIONAL_NON_TM_USER).toBe('20')
    expect(data.config.prices['a:b']).toEqual({ input: 1, output: 2 })
    expect(data.configUpdatedAt).toBe('2026-10-21T16:04:00.000Z')
    expect(data.configInvalid).toBe(false)
    expect(data.unpriced).toEqual([{ model: 'a:c', calls: 4 }])
  })

  it('starts from an empty config and flags an invalid stored row', async () => {
    mocks.find.mockImplementation(async ({ where }: { where: { featureCode: { in?: string[] } } }) =>
      where.featureCode.in ? found([]) : found([{ settings: { prices: 5 } }]))
    mocks.loadGroupStats.mockResolvedValue([])
    mocks.loadUnpricedModels.mockResolvedValue([])
    const data = await loadAiSettings()
    expect(data.configInvalid).toBe(true)
    expect(data.config).toEqual({ prices: {}, images: {}, models: {} })
  })
})
