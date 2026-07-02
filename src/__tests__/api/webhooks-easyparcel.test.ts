/**
 * API Route Tests for POST /api/webhooks/easyparcel — F36 (GH-1333)
 * Tests EasyParcel webhook receiver: auth, payload extraction, order matching, tracking updates.
 *
 * TC-F36.OD.033–TC-F36.OD.040: Webhook auth, field extraction, order matching, status updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFind = vi.fn()
const mockUpdate = vi.fn()
const mockLoggerWarn = vi.fn()
const mockLoggerInfo = vi.fn()
const mockLoggerError = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(() =>
    Promise.resolve({
      find: mockFind,
      update: mockUpdate,
      logger: {
        warn: mockLoggerWarn,
        info: mockLoggerInfo,
        error: mockLoggerError,
      },
    })
  ),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { POST } from '@/app/api/webhooks/easyparcel/route'
import { applyTrackingUpdate } from '@/lib/shipping/easyparcel/apply-tracking-update'

// ─── Helpers ──────────────────────────────────────────────────────────

function callPost(secret: string | null, body: Record<string, unknown>) {
  const searchParams = secret ? `?secret=${encodeURIComponent(secret)}` : ''
  const request = new Request(`http://localhost/api/webhooks/easyparcel${searchParams}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return POST(request)
}

describe('POST /api/webhooks/easyparcel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.EASYPARCEL_WEBHOOK_SECRET
  })

  afterEach(() => {
    delete process.env.EASYPARCEL_WEBHOOK_SECRET
  })

  // ───────────────────────────────────────────────────────────────────
  // TC-F36.OD.033: Env secret unset → 503
  // ───────────────────────────────────────────────────────────────────
  it('[TC-F36.OD.033] env secret unset → 503 Webhook not configured', async () => {
    // Arrange: env unset (via beforeEach)

    // Act
    const res = await callPost('any-secret', { awb_number: 'JT123', status_code: 'Delivered' })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(503)
    expect(body.error).toBe('Webhook not configured')
    expect(mockFind).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ───────────────────────────────────────────────────────────────────
  // TC-F36.OD.034: Wrong secret → 401, payload.find not called
  // ───────────────────────────────────────────────────────────────────
  it('[TC-F36.OD.034] wrong secret → 401 Unauthorized, payload.find not called', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'correct-secret'

    // Act
    const res = await callPost('wrong-secret', { awb_number: 'JT123', status_code: 'Delivered' })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
    expect(mockFind).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ───────────────────────────────────────────────────────────────────
  // TC-F36.OD.035: Valid secret + flat payload + order found (shipped) +
  // delivered status → 200 matched:true, applyTrackingUpdate called
  // ───────────────────────────────────────────────────────────────────
  it('[TC-F36.OD.035] valid secret + flat {awb_number, status_code:"Delivered"} + order found (shipped) → 200 matched:true, update via applyTrackingUpdate', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 'order-1',
          status: 'shipped',
          shippingTrackingStatus: 'out_for_delivery',
          shippingTrackingHistory: [],
        },
      ],
    })
    mockUpdate.mockResolvedValue({ id: 'order-1' })

    // Act
    const res = await callPost('my-secret', {
      awb_number: 'JT987654321',
      status_code: 'Delivered',
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.matched).toBe(true)
    expect(body.result).toBe('updated')

    // Verify find called with correct criteria (awbNo and trackingNumber)
    expect(mockFind).toHaveBeenCalledWith({
      collection: 'orders',
      where: { or: [{ awbNo: { equals: 'JT987654321' } }, { trackingNumber: { equals: 'JT987654321' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    // Verify update was called (applyTrackingUpdate calls payload.update internally)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'orders',
        id: 'order-1',
      })
    )
  })

  // ───────────────────────────────────────────────────────────────────
  // TC-F36.OD.045: REAL EP payload (docs 2026-06, topic shipment.tracking.update)
  // numeric latest_shipment_status_code:5 → mapped to delivered + auto-complete
  // ───────────────────────────────────────────────────────────────────
  it('[TC-F36.OD.045] real tracking-update payload with latest_shipment_status_code:5 → delivered + auto-complete', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 'order-45',
          status: 'shipped',
          shippingTrackingStatus: 'in_transit',
          shippingTrackingHistory: [],
        },
      ],
    })
    mockUpdate.mockResolvedValue({ id: 'order-45' })

    // Act — mirrors the "Tracking Status Update Sample" from EP docs
    const res = await callPost('my-secret', {
      topic: 'shipment.tracking.update',
      shipment_number: 'ES-2504-G7FDF',
      awb_number: '238725129086',
      latest_shipment_status_code: 5,
      latest_tracking_status: 'Deliverd To Suntech',
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.matched).toBe(true)
    expect(body.result).toBe('updated')
    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg.data.shippingTrackingStatus).toBe('delivered')
    expect(updateArg.data.status).toBe('completed')
  })

  // ───────────────────────────────────────────────────────────────────
  // TC-F36.OD.046: REAL EP payload (topic shipment.status.update) numeric
  // shipment_status_code:0 (Cancel) → mapped to cancelled, no auto-complete
  // ───────────────────────────────────────────────────────────────────
  it('[TC-F36.OD.046] real status-update payload with shipment_status_code:0 → cancelled tracking, no auto-complete', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 'order-46',
          status: 'ready_to_ship',
          shippingTrackingStatus: 'pending_pickup',
          shippingTrackingHistory: [],
        },
      ],
    })
    mockUpdate.mockResolvedValue({ id: 'order-46' })

    // Act — mirrors the "Shipment Status Update Sample" from EP docs
    const res = await callPost('my-secret', {
      topic: 'shipment.status.update',
      awb_number: '238725129086',
      event_date: '2017-10-28 11:40:00',
      shipment_number: 'ES-2504-G7FDF',
      shipment_status: 'Cancelled',
      shipment_status_code: 0,
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.matched).toBe(true)
    expect(body.result).toBe('updated')
    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg.data.shippingTrackingStatus).toBe('cancelled')
    expect(updateArg.data.status).toBeUndefined()
  })

  // ───────────────────────────────────────────────────────────────────
  // TC-F36.OD.048: ondemand.* topic → unsupported, applyTrackingUpdate NOT
  // called. Ondemand codes conflict with shipment codes (ondemand 5 =
  // "Cancelled by Driver" vs shipment 5 = "Delivered") — guarding this
  // prevents a delivered/cancelled-by-driver status mix-up.
  // ───────────────────────────────────────────────────────────────────
  it('[TC-F36.OD.048] topic "ondemand.status.update" with status 5 → 200 reason:"unsupported_topic", update not called', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'

    // Act — ondemand code 5 means "Cancelled by Driver", NOT "Delivered"
    const res = await callPost('my-secret', {
      topic: 'ondemand.status.update',
      awb_number: 'OD-123456',
      shipment_status_code: 5,
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.matched).toBe(false)
    expect(body.reason).toBe('unsupported_topic')
    expect(mockFind).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ───────────────────────────────────────────────────────────────────
  // TC-F36.OD.036: Nested payload {shipments:[{awb, status:'In Transit'}]} →
  // extracted, matched, update called (no auto-complete for in_transit)
  // ───────────────────────────────────────────────────────────────────
  it('[TC-F36.OD.036] nested {shipments:[{awb, status:"In Transit"}]} → extracted, matched, in_transit + no auto-complete', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 'order-2',
          status: 'shipped',
          shippingTrackingStatus: 'picked_up',
          shippingTrackingHistory: [],
        },
      ],
    })
    mockUpdate.mockResolvedValue({ id: 'order-2' })

    // Act
    const res = await callPost('my-secret', {
      shipments: [
        {
          awb: 'FLASH123456',
          status: 'In Transit',
        },
      ],
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.matched).toBe(true)

    // Verify find was called with extracted awb
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          or: [
            { awbNo: { equals: 'FLASH123456' } },
            { trackingNumber: { equals: 'FLASH123456' } },
          ],
        },
      })
    )

    // Verify update was called with in_transit status
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shippingTrackingStatus: 'in_transit',
        }),
      })
    )
  })

  // ───────────────────────────────────────────────────────────────────
  // TC-F36.OD.037: No matching order → 200 matched:false reason:'order_not_found',
  // update NOT called
  // ───────────────────────────────────────────────────────────────────
  it('[TC-F36.OD.037] no matching order → 200 matched:false reason:"order_not_found", update not called', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'
    mockFind.mockResolvedValue({ docs: [] })

    // Act
    const res = await callPost('my-secret', {
      awb_number: 'UNKNOWN-AWB-999',
      status_code: 'Delivered',
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.matched).toBe(false)
    expect(body.reason).toBe('order_not_found')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ───────────────────────────────────────────────────────────────────
  // TC-F36.OD.038: Missing awb/status fields → 200 matched:false reason:'missing_fields'
  // ───────────────────────────────────────────────────────────────────
  it('[TC-F36.OD.038] missing awb field → 200 matched:false reason:"missing_fields"', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'

    // Act
    const res = await callPost('my-secret', {
      status_code: 'Delivered',
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.matched).toBe(false)
    expect(body.reason).toBe('missing_fields')
    expect(mockFind).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('[TC-F36.OD.038b] missing status field → 200 matched:false reason:"missing_fields"', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'

    // Act
    const res = await callPost('my-secret', {
      awb_number: 'JT123456',
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.matched).toBe(false)
    expect(body.reason).toBe('missing_fields')
    expect(mockFind).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ───────────────────────────────────────────────────────────────────
  // TC-F36.OD.039: Idempotent — same status as current → 200 matched:true
  // result:'unchanged', update NOT called
  // ───────────────────────────────────────────────────────────────────
  it('[TC-F36.OD.039] idempotent: current status already "delivered" → 200 matched:true result:"unchanged", update not called', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 'order-3',
          status: 'completed',
          shippingTrackingStatus: 'delivered',
          shippingTrackingHistory: [
            {
              status: 'delivered',
              description: 'Delivered',
              eventTime: '2026-07-01T10:00:00Z',
            },
          ],
        },
      ],
    })

    // Act (webhook sends Delivered again)
    const res = await callPost('my-secret', {
      awb_number: 'JT987654321',
      status_code: 'Delivered',
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.matched).toBe(true)
    expect(body.result).toBe('unchanged')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ───────────────────────────────────────────────────────────────────
  // TC-F36.OD.040: payload.find throws → 500 Internal error
  // ───────────────────────────────────────────────────────────────────
  it('[TC-F36.OD.040] payload.find throws → 500 Internal error', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'
    mockFind.mockRejectedValue(new Error('Database connection error'))

    // Act
    const res = await callPost('my-secret', {
      awb_number: 'JT123456',
      status_code: 'Delivered',
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(500)
    expect(body.error).toBe('Internal error')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ───────────────────────────────────────────────────────────────────
  // Additional edge cases
  // ───────────────────────────────────────────────────────────────────

  it('[TC-F36.OD.041] invalid JSON body → 200 matched:false reason:"invalid_json"', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'

    // Act
    const request = new Request('http://localhost/api/webhooks/easyparcel?secret=my-secret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{',
    })
    const res = await POST(request)
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.matched).toBe(false)
    expect(body.reason).toBe('invalid_json')
  })

  it('[TC-F36.OD.042] order found by trackingNumber (alternative key) → matched and update', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 'order-4',
          status: 'shipped',
          shippingTrackingStatus: 'out_for_delivery',
          shippingTrackingHistory: [],
        },
      ],
    })
    mockUpdate.mockResolvedValue({ id: 'order-4' })

    // Act (payload has tracking_no instead of awb_number)
    const res = await callPost('my-secret', {
      tracking_no: 'OLD-TRACK-123',
      status: 'Picked Up',
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.matched).toBe(true)

    // Verify find searched by tracking_no value
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { or: [{ awbNo: { equals: 'OLD-TRACK-123' } }, { trackingNumber: { equals: 'OLD-TRACK-123' } }] },
      })
    )
  })

  it('[TC-F36.OD.043] nested {data: {awb, status}} → extracted from data scope', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 'order-5',
          status: 'shipped',
          shippingTrackingStatus: 'picked_up',
          shippingTrackingHistory: [],
        },
      ],
    })
    mockUpdate.mockResolvedValue({ id: 'order-5' })

    // Act
    const res = await callPost('my-secret', {
      data: {
        awb_number: 'DATA-AWB-888',
        status_code: 'In Transit',
      },
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.matched).toBe(true)
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { or: [{ awbNo: { equals: 'DATA-AWB-888' } }, { trackingNumber: { equals: 'DATA-AWB-888' } }] },
      })
    )
  })

  it('[TC-F36.OD.044] ready_to_ship order + delivered → auto-complete to completed', async () => {
    // Arrange
    process.env.EASYPARCEL_WEBHOOK_SECRET = 'my-secret'
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 'order-6',
          status: 'ready_to_ship',
          shippingTrackingStatus: 'out_for_delivery',
          shippingTrackingHistory: [],
        },
      ],
    })
    mockUpdate.mockResolvedValue({ id: 'order-6' })

    // Act
    const res = await callPost('my-secret', {
      awb_number: 'READY-TO-SHIP-ORD',
      status_code: 'Delivered',
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.matched).toBe(true)

    // Verify auto-complete happens for ready_to_ship too
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shippingTrackingStatus: 'delivered',
          status: 'completed',
        }),
      })
    )
  })
})

// ─── Unit tests for applyTrackingUpdate ────────────────────────────────────

describe('applyTrackingUpdate (unit)', () => {
  const mockPayloadWithoutUpdate = {
    logger: { debug: vi.fn() },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[TC-F36.OD.045] unchanged status (already in_transit) → skips update, returns "unchanged"', async () => {
    // Arrange
    const mockPayload = {
      update: vi.fn(),
      logger: { debug: vi.fn() },
    }
    const order = {
      id: 'order-a',
      status: 'shipped',
      shippingTrackingStatus: 'in_transit',
      shippingTrackingHistory: [],
    }

    // Act
    const result = await applyTrackingUpdate(mockPayload as any, order, 'In Transit')

    // Assert
    expect(result).toBe('unchanged')
    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  it('[TC-F36.OD.046] unknown EP status → maps to "unknown", update called', async () => {
    // Arrange
    const mockPayload = {
      update: vi.fn().mockResolvedValue({}),
      logger: { debug: vi.fn() },
    }
    const order = {
      id: 'order-b',
      status: 'shipped',
      shippingTrackingStatus: 'picked_up',
      shippingTrackingHistory: [],
    }

    // Act
    const result = await applyTrackingUpdate(mockPayload as any, order, 'UnknownStatusCode')

    // Assert
    expect(result).toBe('updated')
    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shippingTrackingStatus: 'unknown',
        }),
      })
    )
  })

  it('[TC-F36.OD.047] history appended with ISO eventTime', async () => {
    // Arrange
    const mockPayload = {
      update: vi.fn().mockResolvedValue({}),
      logger: { debug: vi.fn() },
    }
    const existingEntry = {
      status: 'picked_up',
      description: 'Parcel Picked Up',
      eventTime: '2026-07-01T08:00:00Z',
    }
    const order = {
      id: 'order-d',
      status: 'shipped',
      shippingTrackingStatus: 'picked_up',
      shippingTrackingHistory: [existingEntry],
    }

    // Act
    const result = await applyTrackingUpdate(mockPayload as any, order, 'In Transit')

    // Assert
    expect(result).toBe('updated')
    const updateCall = mockPayload.update.mock.calls[0]?.[0]
    const historyArray = updateCall?.data?.shippingTrackingHistory as any[]
    expect(historyArray).toHaveLength(2)
    expect(historyArray[0]).toEqual(existingEntry)
    expect(historyArray[1]).toMatchObject({
      status: 'in_transit',
      description: 'In Transit',
    })
    expect(historyArray[1].eventTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
  })
})
