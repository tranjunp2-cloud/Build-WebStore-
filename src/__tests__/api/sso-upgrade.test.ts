/**
 * API tests for SSO upgrade/downgrade endpoints.
 *
 * TC-SUB-020: upgrade returns 401 without Bearer token
 * TC-SUB-021: upgrade updates plan + period for existing subscription
 * TC-SUB-022: upgrade creates subscription if none exists
 * TC-SUB-023: downgrade follows identical flow (plan change, no hierarchy check)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (must be top-level) ─────────────────────────────────────────────────

const mockFind = vi.fn()
const mockUpdate = vi.fn()
const mockCreate = vi.fn()
const mockDelete = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(() =>
    Promise.resolve({ find: mockFind, update: mockUpdate, create: mockCreate, delete: mockDelete }),
  ),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/subscriptions/plan-subscription', async (importOriginal) => {
  // Keep pure helpers real; mock only async DB calls to isolate route logic
  const real = await importOriginal<typeof import('@/lib/subscriptions/plan-subscription')>()
  return {
    ...real,
    upsertPlanSubscription: vi.fn().mockResolvedValue(undefined),
  }
})

import { PUT as upgradeHandler } from '@/app/api/v1/sso/upgrade/route'
import { PUT as downgradeHandler } from '@/app/api/v1/sso/downgrade/route'
import { getCurrentUser } from '@/lib/auth'
import { upsertPlanSubscription } from '@/lib/subscriptions/plan-subscription'

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockUpsert = vi.mocked(upsertPlanSubscription)

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: object, bearerToken = 'valid-token') {
  return {
    headers: { get: (h: string) => (h === 'authorization' ? `Bearer ${bearerToken}` : null) },
    json: () => Promise.resolve(body),
  } as any
}

function makeRequestNoAuth(body: object) {
  return {
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  } as any
}

const superAdmin = { id: 1, email: 'admin@test.com', roles: ['super-admin'] }
const tenantUser = { id: 2, tenants: [{ tenant: { id: 10 }, role: 'owner' }] }

const validBody = {
  email: 'owner@example.com',
  subscription_code: 'professional',
  subscription_type: 1,
  start_date: '2026-06-01',
  end_date: '2027-06-01',
}

// ── Upgrade Tests ─────────────────────────────────────────────────────────────

describe('PUT /api/v1/sso/upgrade [TC-SUB-020..022]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFind.mockReset()
    mockUpdate.mockReset()
    mockCreate.mockReset()
  })

  // TC-SUB-020
  it('[TC-SUB-020] returns 401 when Authorization header is missing', async () => {
    const res = await upgradeHandler(makeRequestNoAuth(validBody))
    expect(res.status).toBe(401)
  })

  it('[TC-SUB-020b] returns 401 when token is invalid', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null)
    const res = await upgradeHandler(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('[TC-SUB-020c] returns 403 for non-super-admin user', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 9, roles: ['tenant-owner'] } as any)
    const res = await upgradeHandler(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 when email is missing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(superAdmin as any)
    const res = await upgradeHandler(makeRequest({ subscription_code: 'professional' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when subscription_code is invalid', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(superAdmin as any)
    const res = await upgradeHandler(makeRequest({ ...validBody, subscription_code: 'INVALID_CODE' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when user has no owner tenant (staff-only tenant memberships)', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(superAdmin as any)
    mockFind.mockResolvedValueOnce({ docs: [{ id: 2, tenants: [{ tenant: { id: 10 }, role: 'staff' }] }] })
    const res = await upgradeHandler(makeRequest(validBody))
    expect(res.status).toBe(404)
  })

  it('returns 404 when user is not found', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(superAdmin as any)
    mockFind.mockResolvedValueOnce({ docs: [] }) // user not found
    const res = await upgradeHandler(makeRequest(validBody))
    expect(res.status).toBe(404)
  })

  it('returns 404 when user has no tenant', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(superAdmin as any)
    mockFind.mockResolvedValueOnce({ docs: [{ id: 2, tenants: [] }] }) // no tenant
    const res = await upgradeHandler(makeRequest(validBody))
    expect(res.status).toBe(404)
  })

  // TC-SUB-021 + TC-SUB-022
  it('[TC-SUB-021] returns 200 and calls upsertPlanSubscription for existing user', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(superAdmin as any)
    mockFind.mockResolvedValueOnce({ docs: [tenantUser] })

    const res = await upgradeHandler(makeRequest(validBody))

    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.anything(),
      10,
      expect.objectContaining({
        subscriptionCode: 'professional',
        subscriptionType: 1,
        startDate: '2026-06-01',
        endDate: '2027-06-01',
      }),
    )
    const body = await res.json()
    expect(body.message).toBe('Subscription upgraded')
  })
})

// ── Downgrade Tests ───────────────────────────────────────────────────────────

describe('PUT /api/v1/sso/downgrade [TC-SUB-023]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFind.mockReset()
  })

  // TC-SUB-023
  it('[TC-SUB-023] follows identical flow to upgrade — calls upsertPlanSubscription', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(superAdmin as any)
    mockFind.mockResolvedValueOnce({ docs: [tenantUser] })

    const res = await downgradeHandler(makeRequest(validBody))

    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalled()
    const body = await res.json()
    expect(body.message).toBe('Subscription downgraded')
  })

  it('[TC-SUB-023b] returns 401 without token (same auth guard as upgrade)', async () => {
    const res = await downgradeHandler(makeRequestNoAuth(validBody))
    expect(res.status).toBe(401)
  })
})
