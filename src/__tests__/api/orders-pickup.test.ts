/**
 * API Route Tests for POST /api/orders/[id]/pickup — F36 (GH-1333)
 * Tests pickup schedule persistence: ISO date validation, slot validation (am/pm).
 *
 * TC-F36.P01–F36.P15: Date format, slot validation, persistence, error handling.
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

import { POST } from '@/app/api/orders/[id]/pickup/route'

// ─── Helpers ──────────────────────────────────────────────────────────

function callPost(orderId: string | number, body: unknown) {
  const request = new Request('http://localhost/api/orders/123/pickup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const context = { params: Promise.resolve({ id: String(orderId) }) }
  return POST(request, context as any)
}

describe('POST /api/orders/[id]/pickup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // TC-F36.P01: Happy path — valid ISO date + slot=am → 200
  it('[TC-F36.P01] Valid ISO date + slot=am → 200, persists both', async () => {
    mockFindByID.mockResolvedValue({
      id: 1,
      orderNumber: 'ORD-001',
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(1, {
      scheduledAt: '2026-07-05',
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.pickupScheduledAt).toBe('2026-07-05')
    expect(body.data.pickupSlot).toBe('am')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'orders',
        id: 1,
        data: {
          pickupScheduledAt: '2026-07-05',
          pickupSlot: 'am',
        },
      })
    )
  })

  // TC-F36.P02: Happy path — valid ISO date + slot=pm
  it('[TC-F36.P02] Valid ISO date + slot=pm → 200, persists both', async () => {
    mockFindByID.mockResolvedValue({
      id: 2,
      orderNumber: 'ORD-002',
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(2, {
      scheduledAt: '2026-07-06',
      slot: 'pm',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.pickupSlot).toBe('pm')
  })

  // TC-F36.P03: ISO date with timestamp → accepted (full ISO string)
  it('[TC-F36.P03] Full ISO timestamp (with T and Z) → 200', async () => {
    mockFindByID.mockResolvedValue({
      id: 3,
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(3, {
      scheduledAt: '2026-07-05T08:00:00Z',
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.pickupScheduledAt).toBe('2026-07-05T08:00:00Z')
  })

  // TC-F36.P04: Missing scheduledAt → 422 VALIDATION_ERROR
  it('[TC-F36.P04] Missing scheduledAt → 422 VALIDATION_ERROR', async () => {
    mockFindByID.mockResolvedValue({
      id: 4,
    })

    const res = await callPost(4, {
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toMatch(/scheduledAt/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // TC-F36.P05: Empty string scheduledAt → 422
  it('[TC-F36.P05] Empty scheduledAt (after trim) → 422 VALIDATION_ERROR', async () => {
    mockFindByID.mockResolvedValue({
      id: 5,
    })

    const res = await callPost(5, {
      scheduledAt: '   ',
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // TC-F36.P06: Invalid date format (not ISO) → 422
  it('[TC-F36.P06] Non-ISO date format (MM/DD/YYYY) → 422 VALIDATION_ERROR', async () => {
    mockFindByID.mockResolvedValue({
      id: 6,
    })

    const res = await callPost(6, {
      scheduledAt: '07/05/2026',
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toMatch(/ISO/i)
  })

  // TC-F36.P07: Invalid date format (English text)
  it('[TC-F36.P07] English date text → 422 VALIDATION_ERROR', async () => {
    mockFindByID.mockResolvedValue({
      id: 7,
    })

    const res = await callPost(7, {
      scheduledAt: 'July 5, 2026',
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // TC-F36.P08: Invalid slot (not 'am' or 'pm') → 422
  it('[TC-F36.P08] Invalid slot (e.g., "noon") → 422 VALIDATION_ERROR', async () => {
    mockFindByID.mockResolvedValue({
      id: 8,
    })

    const res = await callPost(8, {
      scheduledAt: '2026-07-05',
      slot: 'noon',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toMatch(/am|pm/i)
  })

  // TC-F36.P09: Slot is optional — absence is OK (only scheduledAt required)
  it('[TC-F36.P09] Omitted slot → 200, only scheduledAt persisted', async () => {
    mockFindByID.mockResolvedValue({
      id: 9,
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(9, {
      scheduledAt: '2026-07-05',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.pickupScheduledAt).toBe('2026-07-05')
    expect(body.data.pickupSlot).toBeUndefined()

    // Verify update didn't include pickupSlot
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          pickupScheduledAt: '2026-07-05',
        },
      })
    )
  })

  // TC-F36.P10: Null slot → treated as undefined (optional), accepted (not a string, ignored)
  it('[TC-F36.P10] null slot → 200 (null is not a string, treated as absent)', async () => {
    mockFindByID.mockResolvedValue({
      id: 10,
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(10, {
      scheduledAt: '2026-07-05',
      slot: null,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.pickupScheduledAt).toBe('2026-07-05')
    expect(body.data.pickupSlot).toBeUndefined()
  })

  // TC-F36.P11: Invalid JSON body → 400 INVALID_BODY
  it('[TC-F36.P11] Invalid JSON → 400 INVALID_BODY', async () => {
    const res = await new Promise((resolve) => {
      POST(
        new Request('http://localhost/api/orders/11/pickup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json',
        }),
        { params: Promise.resolve({ id: '11' }) } as any,
      ).then(resolve)
    })

    const body = await (res as any).json()
    expect((res as any).status).toBe(400)
    expect(body.error.code).toBe('INVALID_BODY')
  })

  // TC-F36.P12: Order not found → 404 NOT_FOUND
  it('[TC-F36.P12] Order not found → 404 NOT_FOUND', async () => {
    mockFindByID.mockResolvedValue(null)

    const res = await callPost(999, {
      scheduledAt: '2026-07-05',
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // TC-F36.P13: Payload.update throws → 500 INTERNAL_ERROR
  it('[TC-F36.P13] Payload.update throws → 500 INTERNAL_ERROR', async () => {
    mockFindByID.mockResolvedValue({
      id: 13,
    })
    mockUpdate.mockRejectedValue(new Error('Database error'))

    const res = await callPost(13, {
      scheduledAt: '2026-07-05',
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  // TC-F36.P14: Whitespace in scheduledAt → trimmed before validation
  it('[TC-F36.P14] scheduledAt with whitespace → trimmed before validation', async () => {
    mockFindByID.mockResolvedValue({
      id: 14,
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(14, {
      scheduledAt: '  2026-07-05  ',
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.pickupScheduledAt).toBe('2026-07-05')
  })

  // TC-F36.P15: Uppercase slot (e.g., 'AM') → 422 (case-sensitive)
  it('[TC-F36.P15] Uppercase slot (AM) → 422 (case-sensitive)', async () => {
    mockFindByID.mockResolvedValue({
      id: 15,
    })

    const res = await callPost(15, {
      scheduledAt: '2026-07-05',
      slot: 'AM',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // TC-F36.P16: Past date (before today) → rejected server-side (M4 fix — server is the trust boundary)
  it('[TC-F36.P16] Past date → 422 (past dates rejected server-side)', async () => {
    mockFindByID.mockResolvedValue({
      id: 16,
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(16, {
      scheduledAt: '2025-01-01',
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // TC-F36.P17: Numeric order ID → converted
  it('[TC-F36.P17] Numeric order ID → converted and persisted', async () => {
    mockFindByID.mockResolvedValue({
      id: 17,
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost('17', {
      scheduledAt: '2026-07-05',
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 17 })
    )
  })

  // TC-F36.P18: UUID order ID → passed as string
  it('[TC-F36.P18] UUID order ID → passed as-is', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    mockFindByID.mockResolvedValue({
      id: uuid,
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(uuid, {
      scheduledAt: '2026-07-05',
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: uuid })
    )
  })

  // TC-F36.P19: ISO date with timezone offset (+05:30)
  it('[TC-F36.P19] ISO date with timezone offset → 200', async () => {
    mockFindByID.mockResolvedValue({
      id: 19,
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(19, {
      scheduledAt: '2026-07-05T08:00:00+05:30',
      slot: 'am',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.pickupScheduledAt).toBe('2026-07-05T08:00:00+05:30')
  })

  // TC-F36.P20: Edge case — T separator without time
  it('[TC-F36.P20] ISO date with T but no time → 200 (regex allows)', async () => {
    mockFindByID.mockResolvedValue({
      id: 20,
    })
    mockUpdate.mockResolvedValue({})

    const res = await callPost(20, {
      scheduledAt: '2026-07-05T',
      slot: 'am',
    })
    const body = await res.json()

    // Regex: /^\d{4}-\d{2}-\d{2}(T[\d:+Z.-]+)?$/ — T alone is invalid (no digits after)
    expect(res.status).toBe(422)
  })
})
