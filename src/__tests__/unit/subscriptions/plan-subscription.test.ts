/**
 * Unit tests for plan-subscription utility module.
 *
 * TC-SUB-001..003: getPlanCode — SSO code+type → PlanCode mapping
 * TC-SUB-010..015: isSubscriptionActive — active/expired/canceled logic
 * TC-SUB-040..043: recordUsage / reduceUsage / getConsumed — usage tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getPlanCode,
  mapPlanCodeToTier,
  isSubscriptionActive,
  recordUsage,
  reduceUsage,
  getConsumed,
  clearUsage,
  upsertPlanSubscription,
} from '@/lib/subscriptions/plan-subscription'

// ── getPlanCode ───────────────────────────────────────────────────────────────

describe('getPlanCode', () => {
  // TC-SUB-001
  it('[TC-SUB-001] returns FREEMIUM for freemium code regardless of type', () => {
    expect(getPlanCode('freemium', 1)).toBe('FREEMIUM')
    expect(getPlanCode('freemium', 2)).toBe('FREEMIUM')
    expect(getPlanCode('FREEMIUM')).toBe('FREEMIUM')
    expect(getPlanCode('freemium', null)).toBe('FREEMIUM')
  })

  // TC-SUB-002
  it('[TC-SUB-002] appends _TM_USER for subscription_type=1', () => {
    expect(getPlanCode('professional', 1)).toBe('PROFESSIONAL_TM_USER')
    expect(getPlanCode('starter', 1)).toBe('STARTER_TM_USER')
    expect(getPlanCode('standard', 1)).toBe('STANDARD_TM_USER')
  })

  // TC-SUB-003
  it('[TC-SUB-003] appends _NON_TM_USER for subscription_type=2 or undefined/null', () => {
    expect(getPlanCode('professional', 2)).toBe('PROFESSIONAL_NON_TM_USER')
    expect(getPlanCode('starter')).toBe('STARTER_NON_TM_USER')
    expect(getPlanCode('standard', null)).toBe('STANDARD_NON_TM_USER')
  })
})

// ── mapPlanCodeToTier ─────────────────────────────────────────────────────────

describe('mapPlanCodeToTier', () => {
  it('maps FREEMIUM → free', () => expect(mapPlanCodeToTier('FREEMIUM')).toBe('free'))
  it('maps STARTER_* → starter', () => {
    expect(mapPlanCodeToTier('STARTER_TM_USER')).toBe('starter')
    expect(mapPlanCodeToTier('STARTER_NON_TM_USER')).toBe('starter')
  })
  it('maps STANDARD_* → pro', () => {
    expect(mapPlanCodeToTier('STANDARD_TM_USER')).toBe('pro')
    expect(mapPlanCodeToTier('STANDARD_NON_TM_USER')).toBe('pro')
  })
  it('maps PROFESSIONAL_* → business', () => {
    expect(mapPlanCodeToTier('PROFESSIONAL_TM_USER')).toBe('business')
    expect(mapPlanCodeToTier('PROFESSIONAL_NON_TM_USER')).toBe('business')
  })
})

// ── isSubscriptionActive ──────────────────────────────────────────────────────

describe('isSubscriptionActive', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString() // tomorrow
  const past = new Date(Date.now() - 86_400_000).toISOString()   // yesterday

  // TC-SUB-010
  it('[TC-SUB-010] returns true for active subscription with future endsAt', () => {
    expect(isSubscriptionActive({ endsAt: future, status: 'active' })).toBe(true)
  })

  // TC-SUB-011
  it('[TC-SUB-011] returns false when endsAt is in the past', () => {
    expect(isSubscriptionActive({ endsAt: past, status: 'active' })).toBe(false)
  })

  // TC-SUB-012: canceledAt without canceledImmediately = cancel at period end = still active
  it('[TC-SUB-012] returns true when canceledAt set but canceledImmediately is falsy (cancel at period end)', () => {
    expect(isSubscriptionActive({ endsAt: future, canceledAt: past, status: 'active' })).toBe(true)
  })

  // TC-SUB-013
  it('[TC-SUB-013] returns false when status is ended', () => {
    expect(isSubscriptionActive({ endsAt: future, status: 'ended' })).toBe(false)
  })

  // TC-SUB-014
  it('[TC-SUB-014] returns false when canceledImmediately=true (even with future endsAt)', () => {
    expect(
      isSubscriptionActive({
        endsAt: future,
        canceledAt: past,
        canceledImmediately: true,
        status: 'active',
      }),
    ).toBe(false)
  })

  // TC-SUB-015
  it('[TC-SUB-015] returns true when canceledAt set but canceledImmediately=false (cancel at period end)', () => {
    expect(
      isSubscriptionActive({
        endsAt: future,
        canceledAt: past,
        canceledImmediately: false,
        status: 'active',
      }),
    ).toBe(true)
  })
})

// ── recordUsage / reduceUsage / getConsumed ───────────────────────────────────

const makePayload = (findDocs: any[] = []) => ({
  find: vi.fn().mockResolvedValue({ docs: findDocs, totalDocs: findDocs.length }),
  create: vi.fn().mockResolvedValue({ id: 1 }),
  update: vi.fn().mockResolvedValue({}),
  delete: vi.fn().mockResolvedValue({}),
})

describe('recordUsage', () => {
  // TC-SUB-040
  it('[TC-SUB-040] creates new usage record when none exists', async () => {
    const payload = makePayload([]) // empty → no existing record
    await recordUsage(payload as any, 10, 'staff_limit', 1)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'plan-subscription-usages',
        data: expect.objectContaining({ subscription: 10, featureCode: 'staff_limit', used: 1 }),
      }),
    )
  })

  // TC-SUB-041
  it('[TC-SUB-041] increments existing usage record', async () => {
    const payload = makePayload([{ id: 5, used: 2 }]) // existing record with used=2
    await recordUsage(payload as any, 10, 'staff_limit', 1)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 5,
        data: expect.objectContaining({ used: 3 }),
      }),
    )
  })
})

describe('reduceUsage', () => {
  // TC-SUB-042
  it('[TC-SUB-042] decrements usage but floors at 0', async () => {
    const payload = makePayload([{ id: 5, used: 1 }])
    await reduceUsage(payload as any, 10, 'staff_limit', 2) // would go to -1, floor at 0
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ used: 0 }) }),
    )
  })

  it('does nothing when no usage record exists', async () => {
    const payload = makePayload([])
    await reduceUsage(payload as any, 10, 'staff_limit', 1)
    expect(payload.update).not.toHaveBeenCalled()
  })
})

describe('getConsumed', () => {
  // TC-SUB-043
  it('[TC-SUB-043] returns 0 when no usage record exists', async () => {
    const payload = makePayload([])
    const result = await getConsumed(payload as any, 10, 'staff_limit')
    expect(result).toBe(0)
  })

  it('returns the used count from existing record', async () => {
    const payload = makePayload([{ id: 5, used: 7 }])
    const result = await getConsumed(payload as any, 10, 'staff_limit')
    expect(result).toBe(7)
  })
})

describe('clearUsage', () => {
  it('[TC-SUB-044] deletes existing usage rows with overrideAccess enabled', async () => {
    const payload = makePayload([{ id: 5 }, { id: 6 }])

    await clearUsage(payload as any, 10)

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'plan-subscription-usages',
        overrideAccess: true,
        where: { subscription: { equals: 10 } },
      }),
    )
    expect(payload.delete).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'plan-subscription-usages',
        id: 5,
        overrideAccess: true,
      }),
    )
    expect(payload.delete).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'plan-subscription-usages',
        id: 6,
        overrideAccess: true,
      }),
    )
  })
})

describe('upsertPlanSubscription', () => {
  it('[TC-SUB-045] update-path clears stale usage with overrideAccess before recounting staff', async () => {
    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [{ id: 99 }] })
        .mockResolvedValueOnce({ docs: [{ id: 5 }, { id: 6 }] })
        .mockResolvedValueOnce({
          docs: [
            { id: 'owner', tenants: [{ tenant: 42, role: 'owner' }] },
            { id: 'staff-1', tenants: [{ tenant: 42, role: 'admin' }] },
          ],
        })
        .mockResolvedValueOnce({ docs: [] }),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    }

    await upsertPlanSubscription(payload as any, 42, {
      subscriptionCode: 'professional',
      subscriptionType: 1,
      startDate: '2026-07-01 00:00:00',
      endDate: '2026-08-01 00:00:00',
    })

    expect(payload.delete).toHaveBeenCalledTimes(2)
    expect(payload.delete).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'plan-subscription-usages',
        id: 5,
        overrideAccess: true,
      }),
    )
    expect(payload.delete).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'plan-subscription-usages',
        id: 6,
        overrideAccess: true,
      }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'plan-subscription-usages',
        overrideAccess: true,
        data: expect.objectContaining({
          subscription: 99,
          featureCode: 'staff_limit',
          used: 1,
        }),
      }),
    )
  })
  it('[TC-SUB-046] update-path keeps usage when the same plan is sent again (SSO retry)', async () => {
    const payload = {
      find: vi.fn().mockResolvedValueOnce({
        docs: [{ id: 99, plan: 'PROFESSIONAL_TM_USER', packCode: 'PROFESSIONAL' }],
      }),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    }

    await upsertPlanSubscription(payload as any, 42, {
      subscriptionCode: 'professional',
      subscriptionType: 1,
      startDate: '2026-07-01 00:00:00',
      endDate: '2026-08-01 00:00:00',
    })

    expect(payload.find).toHaveBeenCalledTimes(1)
    expect(payload.delete).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'plan-subscriptions',
        id: 99,
        data: expect.objectContaining({ plan: 'PROFESSIONAL_TM_USER', packCode: 'PROFESSIONAL' }),
      }),
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'tenants', id: 42, data: { plan: 'business' } }),
    )
  })

  it('[TC-SUB-047] update-path clears usage when only the TM type changes the plan', async () => {
    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [{ id: 99, plan: 'PROFESSIONAL_NON_TM_USER', packCode: 'PROFESSIONAL' }] })
        .mockResolvedValueOnce({ docs: [{ id: 5 }] })
        .mockResolvedValueOnce({ docs: [] }),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    }

    await upsertPlanSubscription(payload as any, 42, {
      subscriptionCode: 'professional',
      subscriptionType: 1,
    })

    expect(payload.delete).toHaveBeenCalledTimes(1)
    expect(payload.delete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'plan-subscription-usages', id: 5, overrideAccess: true }),
    )
  })
})
