/**
 * API Route Tests for POST /api/orders/[id]/mark-shipment-cancelled — F36 (GH-1333)
 * Merchant attest that the EP shipment was cancelled on the EasyParcel dashboard
 * (EP dispatches no webhook for dashboard cancels — verified live 2026-07-10).
 *
 * TC-F36.159–161 (docs/qa/F36-easyparcel-delivery.md §3.18d)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
const mockExecute = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(() =>
    Promise.resolve({
      findByID: mockFindByID,
      update: mockUpdate,
      db: { drizzle: { execute: mockExecute } },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    })
  ),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
  withAuth: (fn: any) => (req: any, ctx: any) => {
    const mockUser = { id: 'user-1', email: 'test@example.com' }
    return fn(mockUser, req, ctx)
  },
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
  withFeatureGuard: (_feature: string) => (fn: any) => fn,
}))

import { POST } from '@/app/api/orders/[id]/mark-shipment-cancelled/route'

// ─── Helpers ──────────────────────────────────────────────────────────

function callPost(orderId: string | number) {
  const request = new Request('http://localhost/api/orders/128/mark-shipment-cancelled', {
    method: 'POST',
  })
  const context = { params: Promise.resolve({ id: String(orderId) }) }
  return POST(request as any, context as any)
}

describe('POST /api/orders/[id]/mark-shipment-cancelled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // TC-F36.159: happy path — clears EP fields without adding a customer-facing tracking event
  it('[TC-F36.159] ready_to_ship + real shipment → 200, CAS clears fields without tracking history', async () => {
    // Arrange
    mockFindByID.mockResolvedValue({
      id: 128,
      status: 'ready_to_ship',
      easyParcelOrderNo: 'ES-2607-NM4HA',
      awbNo: 'POS12345',
      shippingTrackingHistory: [
        { status: 'pending_pickup', description: 'Waiting for Pickup', eventTime: '2026-07-10T07:00:00Z' },
      ],
    })
    mockExecute.mockResolvedValue({ rows: [{ id: 128 }] })
    // Act
    const res = await callPost(128)
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.clearedShipmentNo).toBe('ES-2607-NM4HA')
    // Order returns to 'confirmed' — re-opens BOTH exits (create-label + /cancel)
    expect(body.data.status).toBe('confirmed')
    expect(mockExecute).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // TC-F36.160: guards
  it('[TC-F36.160] no EP shipment → 422 NO_EP_SHIPMENT, nothing written', async () => {
    mockFindByID.mockResolvedValue({ id: 128, status: 'ready_to_ship', easyParcelOrderNo: null })

    const res = await callPost(128)
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('NO_EP_SHIPMENT')
    expect(mockExecute).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('[TC-F36.160] CLAIM: sentinel (in-flight create-label) → 422 NO_EP_SHIPMENT', async () => {
    mockFindByID.mockResolvedValue({
      id: 128,
      status: 'ready_to_ship',
      easyParcelOrderNo: 'CLAIM:1760000000000:ab12cd',
    })

    const res = await callPost(128)
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('NO_EP_SHIPMENT')
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('[TC-F36.160] status !== ready_to_ship (e.g. shipped) → 422 INVALID_TRANSITION', async () => {
    mockFindByID.mockResolvedValue({
      id: 128,
      status: 'shipped',
      easyParcelOrderNo: 'ES-2607-NM4HA',
    })

    const res = await callPost(128)
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('INVALID_TRANSITION')
    expect(mockExecute).not.toHaveBeenCalled()
  })

  // TC-F36.161: CAS miss branches
  it('[TC-F36.161] CAS miss + shipment already cleared by concurrent request → 200 alreadyMarked (idempotent)', async () => {
    mockFindByID
      .mockResolvedValueOnce({ id: 128, status: 'ready_to_ship', easyParcelOrderNo: 'ES-2607-NM4HA' })
      .mockResolvedValueOnce({ id: 128, status: 'ready_to_ship', easyParcelOrderNo: null }) // recheck
    mockExecute.mockResolvedValue({ rows: [] })

    const res = await callPost(128)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.alreadyMarked).toBe(true)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('[TC-F36.161] CAS miss + order moved on (still holds a shipment) → 409 CONFLICT', async () => {
    mockFindByID
      .mockResolvedValueOnce({ id: 128, status: 'ready_to_ship', easyParcelOrderNo: 'ES-2607-NM4HA' })
      .mockResolvedValueOnce({ id: 128, status: 'shipped', easyParcelOrderNo: 'ES-2607-NM4HA' }) // recheck
    mockExecute.mockResolvedValue({ rows: [] })

    const res = await callPost(128)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('[TC-F36.160] order not found → 404', async () => {
    mockFindByID.mockResolvedValue(null)

    const res = await callPost(999)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })
})
