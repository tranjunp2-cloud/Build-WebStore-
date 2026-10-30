/**
 * TC-AIS-LIM-019..020 — 7-day usage SQL: shape of the per shop per day query, unpriced model listing.
 * Real: usage-queries, limit-stats. Faked: Payload drizzle.execute (SQL text is captured and checked).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({ db: { drizzle: { execute } } }) }))

import { loadGroupStats, loadUnpricedModels } from '@/lib/admin/ai-settings/usage-queries'

const queryText = (call: number) => new PgDialect().sqlToQuery(execute.mock.calls[call][0]).sql

beforeEach(() => vi.clearAllMocks())

describe('[TC-AIS-LIM-019] per shop per day stats query', () => {
  it('sums battery cost for non-picture rows, counts picture rows, falls back to the current plan, and groups by plan group', async () => {
    // Arrange
    execute.mockResolvedValue({
      rows: [
        { tenant_id: 1, name: 'Kedai', plan: 'FREEMIUM', day: '2026-10-28', budget: '0.20', pictures: '1' },
        { tenant_id: 1, name: 'Kedai', plan: 'FREEMIUM', day: '2026-10-29', budget: '0.60', pictures: '3' },
        { tenant_id: 2, name: 'Batik', plan: 'PROFESSIONAL_TM_USER', day: '2026-10-29', budget: '0.46', pictures: '0' },
      ],
    })
    // Act
    const stats = await loadGroupStats()
    // Assert
    const text = queryText(0)
    expect(text).toContain("feature = 'pictures'")
    // feature and plan are Postgres enums on Payload-pushed tables: compare as text, never against ''
    expect(text).toContain("l.feature::text IS DISTINCT FROM 'pictures'")
    expect(text).toContain('plan::text AS plan')
    expect(text).toContain("AT TIME ZONE 'Asia/Kuala_Lumpur'")
    expect(text).toContain('COALESCE(l.plan, cp.plan')
    expect(text).toContain("interval '7 days'")
    expect(text).toContain('COALESCE(l.battery_cost_usd, l.cost_usd')
    expect(stats[0].shops).toEqual([{ id: 1, name: 'Kedai', maxBudget: 0.6, maxPictures: 3 }])
    expect(stats[0].budget).toMatchObject({ p50: 0.4, max: 0.6 })
    expect(stats[3].shops).toEqual([{ id: 2, name: 'Batik', maxBudget: 0.46, maxPictures: 0 }])
  })

  it('propagates a database failure', async () => {
    execute.mockRejectedValue(new Error('timeout'))
    await expect(loadGroupStats()).rejects.toThrow('timeout')
  })
})

describe('[TC-AIS-LIM-020] unpriced models', () => {
  it('lists models with NULL cost this week as provider:model with call counts', async () => {
    // Arrange
    execute.mockResolvedValue({ rows: [{ model: 'anthropic:claude-haiku-5-5-2026', calls: '12' }, { model: null, calls: '3' }, { model: 'legacy', calls: 1 }] })
    // Act
    const unpriced = await loadUnpricedModels()
    // Assert
    expect(unpriced).toEqual([{ model: 'anthropic:claude-haiku-5-5-2026', calls: 12 }, { model: 'legacy', calls: 1 }])
    expect(queryText(0)).toContain('cost_usd IS NULL')
    expect(queryText(0)).toContain("interval '7 days'")
  })
})
