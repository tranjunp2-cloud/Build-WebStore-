/**
 * API Route Tests for POST /api/orders/[id]/self-deliver — F36 (GH-1333)
 * Tests self-delivery courier + tracking number persistence, status validation.
 *
 * TC-F36.A01–F36.A08: Route validation, status gates, persistence, error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(() =>
    Promise.resolve({
      findByID: mockFindByID,
      update: mockUpdate,
    })
  ),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
  withAuth: (fn: any) => (req: any, ctx: any) => {
    // Mock user object for authentication
    const mockUser = { id: 'user-1', email: 'test@example.com' }
    return fn(mockUser, req, ctx)
  },
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
  withFeatureGuard: (feature: string) => (fn: any) => fn,
}))
vi.mock('@/collections/Orders', () => ({
  ORDER_STATUS_TRANSITIONS: {},
}))

import { POST } from '@/app/api/orders/[id]/self-deliver/route'

// ─── Helpers ──────────────────────────────────────────────────────────

function callPost(orderId: string | number, body: unknown) {
  const request = new Request('http://localhost/api/orders/123/self-deliver', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const context = { params: Promise.resolve({ id: String(orderId) }) }
  return POST(request, context as any)
}

describe('POST /api/orders/[id]/self-deliver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // TC-F36.A01: Happy path — valid courier + tracking, confirmed → shipped
  it('[TC-F36.A01] Valid courier + tracking, status=confirmed → 200, persists data, sets shipped', async () => {
    mockFindByID.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      orderNumber: 'ORD-001',
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(1, {
      courier: 'J&T Express',
      trackingNumber: 'JT123456789MY',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('shipped')
    expect(body.data.selfDeliveryCourier).toBe('J&T Express')
    expect(body.data.trackingNumber).toBe('JT123456789MY')
    expect(body.data.shippingTrackingStatus).toBe('pending_pickup')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'orders',
        id: 1,
        data: {
          selfDeliveryCourier: 'J&T Express',
          trackingNumber: 'JT123456789MY',
          shippingTrackingStatus: 'pending_pickup',
          status: 'shipped',
        },
      })
    )
  })

  // TC-F36.A02: Happy path — ready_to_ship status → also allowed
  it('[TC-F36.A02] Valid courier + tracking, status=ready_to_ship → 200, shipped', async () => {
    mockFindByID.mockResolvedValue({
      id: 2,
      status: 'ready_to_ship',
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(2, {
      courier: 'GDex',
      trackingNumber: 'GDEX-999-MY',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('shipped')
  })

  // TC-F36.A03: Missing courier field → 422 VALIDATION_ERROR
  it('[TC-F36.A03] Missing courier → 422 VALIDATION_ERROR', async () => {
    mockFindByID.mockResolvedValue({
      id: 3,
      status: 'confirmed',
    })

    const res = await callPost(3, {
      trackingNumber: 'TRACK-123',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toMatch(/courier/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // TC-F36.A04: Missing trackingNumber field → 422 VALIDATION_ERROR
  it('[TC-F36.A04] Missing trackingNumber → 422 VALIDATION_ERROR', async () => {
    mockFindByID.mockResolvedValue({
      id: 4,
      status: 'confirmed',
    })

    const res = await callPost(4, {
      courier: 'J&T Express',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toMatch(/trackingNumber/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // TC-F36.A05: Empty string courier → 422 (trimmed empty)
  it('[TC-F36.A05] Empty courier (after trim) → 422 VALIDATION_ERROR', async () => {
    mockFindByID.mockResolvedValue({
      id: 5,
      status: 'confirmed',
    })

    const res = await callPost(5, {
      courier: '   ',
      trackingNumber: 'TRACK-123',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // TC-F36.A06: Invalid JSON body → 400 INVALID_BODY
  it('[TC-F36.A06] Invalid JSON body → 400 INVALID_BODY', async () => {
    const res = await new Promise((resolve) => {
      POST(
        new Request('http://localhost/api/orders/6/self-deliver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-valid-json',
        }),
        { params: Promise.resolve({ id: '6' }) } as any,
      ).then(resolve)
    })

    const body = await (res as any).json()
    expect((res as any).status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INVALID_BODY')
  })

  // TC-F36.A07: Order not found → 404 NOT_FOUND
  it('[TC-F36.A07] Order not found → 404 NOT_FOUND', async () => {
    mockFindByID.mockResolvedValue(null)

    const res = await callPost(999, {
      courier: 'J&T Express',
      trackingNumber: 'JT123456789MY',
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // TC-F36.A08: Invalid status (e.g., pending) → 422 INVALID_TRANSITION
  it('[TC-F36.A08] Status=pending (invalid for self-deliver) → 422 INVALID_TRANSITION', async () => {
    mockFindByID.mockResolvedValue({
      id: 8,
      status: 'pending',
    })

    const res = await callPost(8, {
      courier: 'J&T Express',
      trackingNumber: 'JT123456789MY',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INVALID_TRANSITION')
    expect(body.error.message).toMatch(/confirmed|ready_to_ship/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // TC-F36.A09: Shipped status (already shipped) → 422 INVALID_TRANSITION
  it('[TC-F36.A09] Status=shipped (already shipped) → 422 INVALID_TRANSITION', async () => {
    mockFindByID.mockResolvedValue({
      id: 9,
      status: 'shipped',
    })

    const res = await callPost(9, {
      courier: 'J&T Express',
      trackingNumber: 'JT123456789MY',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('INVALID_TRANSITION')
  })

  // TC-F36.A10: Cancelled status → 422 INVALID_TRANSITION
  it('[TC-F36.A10] Status=cancelled → 422 INVALID_TRANSITION', async () => {
    mockFindByID.mockResolvedValue({
      id: 10,
      status: 'cancelled',
    })

    const res = await callPost(10, {
      courier: 'J&T Express',
      trackingNumber: 'JT123456789MY',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('INVALID_TRANSITION')
  })

  // TC-F36.A11: Courier with whitespace → trimmed before storage
  it('[TC-F36.A11] Courier with leading/trailing whitespace → trimmed', async () => {
    mockFindByID.mockResolvedValue({
      id: 11,
      status: 'confirmed',
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(11, {
      courier: '  J&T Express  ',
      trackingNumber: 'JT123456789MY',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.selfDeliveryCourier).toBe('J&T Express')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          selfDeliveryCourier: 'J&T Express',
        }),
      })
    )
  })

  // TC-F36.A12: Tracking number with special characters → preserved
  it('[TC-F36.A12] Special characters in tracking number → preserved as-is', async () => {
    mockFindByID.mockResolvedValue({
      id: 12,
      status: 'confirmed',
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(12, {
      courier: 'Custom Courier',
      trackingNumber: 'TRK-123-ABC-!@#$%',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.trackingNumber).toBe('TRK-123-ABC-!@#$%')
  })

  // TC-F36.A13: Payload.update throws → 500 INTERNAL_ERROR
  it('[TC-F36.A13] Payload.update throws → 500 INTERNAL_ERROR', async () => {
    mockFindByID.mockResolvedValue({
      id: 13,
      status: 'confirmed',
    })
    mockUpdate.mockRejectedValue(new Error('Database error'))

    const res = await callPost(13, {
      courier: 'J&T Express',
      trackingNumber: 'JT123456789MY',
    })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  // TC-F36.A14: Numeric order ID (string that is number)
  it('[TC-F36.A14] Numeric order ID → converted and persisted correctly', async () => {
    mockFindByID.mockResolvedValue({
      id: 14,
      status: 'confirmed',
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost('14', {
      courier: 'J&T Express',
      trackingNumber: 'JT123456789MY',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 14 })
    )
  })

  // TC-F36.A15: UUID order ID → passed as string
  it('[TC-F36.A15] UUID order ID → passed as-is string', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    mockFindByID.mockResolvedValue({
      id: uuid,
      status: 'confirmed',
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(uuid, {
      courier: 'J&T Express',
      trackingNumber: 'JT123456789MY',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: uuid })
    )
  })
})
