/**
 * Unit tests for sync-tracking auto-complete behavior — F36 (GH-1333)
 *
 * When a parcel reaches 'delivered' status and order is in fulfillment state
 * (shipped/ready_to_ship), the sync-tracking job automatically promotes the
 * order to 'completed'. Guards: does NOT auto-complete pending orders or
 * already-terminal states.
 *
 * TC-F36.OD.029–032: Order auto-completion on delivery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncTrackingJob } from '@/lib/jobs/sync-tracking'

// Mock external deps at top level (vi.mock())
// F9 (review #1434): sync-tracking now batches AWBs via trackingStatus() instead of one
// tracking() call per order — mock the batch endpoint the code actually calls.
vi.mock('@/lib/shipping/easyparcel/client', () => ({
  trackingStatus: vi.fn(),
}))

vi.mock('@/lib/shipping/easyparcel/token-manager', () => ({
  getValidToken: vi.fn().mockResolvedValue('mock-token-12345'),
}))

// Do NOT mock status-map — it's pure and critical to test with real mapping
import { mapTrackingStatus } from '@/lib/shipping/easyparcel/status-map'
import { trackingStatus } from '@/lib/shipping/easyparcel/client'

describe('[TC-F36.OD.029–032] Sync-Tracking Auto-Complete on Delivery', () => {
  let mockPayload: any
  let mockTrackingStatus: any

  beforeEach(() => {
    mockTrackingStatus = trackingStatus as any
    mockTrackingStatus.mockClear()

    // Build a realistic payload mock with find() and update() signatures
    // matching Payload CMS structure
    mockPayload = {
      find: vi.fn(),
      update: vi.fn(),
      db: {
        drizzle: {
          transaction: vi.fn(async (
            operation: (db: { execute: ReturnType<typeof vi.fn> }) => Promise<unknown>,
          ) => operation({
            execute: vi.fn().mockResolvedValue({ rows: [{ id: 'order' }] }),
          })),
        },
        sessions: {},
      },
      logger: {
        warn: vi.fn(),
        error: vi.fn(),
      },
    }
  })

  // TC-F36.OD.029: Delivered + shipped → auto-complete
  it('[TC-F36.OD.029] delivered + order.status=shipped → sets status=completed', async () => {
    // Arrange
    const orderId = 'ord-001'
    const tenantId = 'ten-001'
    const trackingNumber = 'EP123456'

    const order = {
      id: orderId,
      tenant: tenantId,
      awbNo: trackingNumber,
      trackingNumber: trackingNumber,
      shippingTrackingStatus: 'in_transit',
      shippingTrackingHistory: [
        {
          status: 'in_transit',
          description: 'In Transit',
          eventTime: '2026-06-30T09:00:00Z',
        },
      ],
      status: 'shipped', // ← in-fulfillment state
    }

    const tenant = {
      id: tenantId,
      easyParcelIntegration: {
        accessToken: 'ep-token-abc',
      },
    }

    // Mock find() to return orders on first call, tenant on second
    let findCallCount = 0
    mockPayload.find.mockImplementation(() => {
      findCallCount++
      if (findCallCount === 1) {
        // First find: orders collection
        return Promise.resolve({
          docs: [order],
        })
      } else if (findCallCount === 2) {
        // Second find: tenants collection
        return Promise.resolve({
          docs: [tenant],
        })
      }
      return Promise.resolve({ docs: [] })
    })

    // Mock tracking response (documented shape): numeric latest_shipment_status_code
    // 5 → maps to 'delivered' via mapShipmentStatusCode
    mockTrackingStatus.mockResolvedValue({
      data: {
        results: [
          {
            status: 'success',
            awb_number: trackingNumber,
            latest_shipment_status_code: 5,
            latest_tracking_status: 'Delivered To Consignee',
          },
        ],
      },
    })

    mockPayload.update.mockResolvedValue({ id: orderId })

    // Act
    const result = await syncTrackingJob(mockPayload)

    // Assert
    expect(result.scanned).toBe(1)
    expect(result.updated).toBe(1)
    expect(result.errors).toBe(0)

    // Verify update was called with status: 'completed'
    expect(mockPayload.update).toHaveBeenCalledOnce()
    const updateCall = mockPayload.update.mock.calls[0][0]
    expect(updateCall.collection).toBe('orders')
    expect(updateCall.id).toBe(orderId)
    expect(updateCall.data.shippingTrackingStatus).toBe('delivered')
    expect(updateCall.data.status).toBe('completed') // ← auto-complete!
    expect(updateCall.data.shippingTrackingHistory).toHaveLength(2) // original + new entry
    expect(updateCall.data.shippingTrackingHistory[1].status).toBe('delivered')
  })

  // TC-F36.OD.030: Delivered + ready_to_ship → auto-complete
  it('[TC-F36.OD.030] delivered + order.status=ready_to_ship → sets status=completed', async () => {
    // Arrange
    const orderId = 'ord-002'
    const tenantId = 'ten-001'
    const trackingNumber = 'EP234567'

    const order = {
      id: orderId,
      tenant: tenantId,
      awbNo: trackingNumber,
      trackingNumber: trackingNumber,
      shippingTrackingStatus: 'in_transit',
      shippingTrackingHistory: [],
      status: 'ready_to_ship', // ← also in-fulfillment state
    }

    const tenant = {
      id: tenantId,
      easyParcelIntegration: {
        accessToken: 'ep-token-def',
      },
    }

    let findCallCount = 0
    mockPayload.find.mockImplementation(() => {
      findCallCount++
      if (findCallCount === 1) {
        return Promise.resolve({ docs: [order] })
      } else if (findCallCount === 2) {
        return Promise.resolve({ docs: [tenant] })
      }
      return Promise.resolve({ docs: [] })
    })

    mockTrackingStatus.mockResolvedValue({
      data: {
        results: [
          {
            status: 'success',
            awb_number: trackingNumber,
            latest_shipment_status_code: 5,
          },
        ],
      },
    })

    mockPayload.update.mockResolvedValue({ id: orderId })

    // Act
    const result = await syncTrackingJob(mockPayload)

    // Assert
    expect(result.updated).toBe(1)
    const updateCall = mockPayload.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('completed') // ← auto-complete for ready_to_ship too
    expect(updateCall.data.shippingTrackingStatus).toBe('delivered')
  })

  // TC-F36.OD.031: Delivered + pending (guard) → NO auto-complete
  it('[TC-F36.OD.031] delivered + order.status=pending → NO auto-complete (guard)', async () => {
    // Arrange
    const orderId = 'ord-003'
    const tenantId = 'ten-001'
    const trackingNumber = 'EP345678'

    const order = {
      id: orderId,
      tenant: tenantId,
      awbNo: trackingNumber,
      trackingNumber: trackingNumber,
      shippingTrackingStatus: 'processing',
      shippingTrackingHistory: [],
      status: 'pending', // ← NOT in fulfillment; should NOT auto-complete
    }

    const tenant = {
      id: tenantId,
      easyParcelIntegration: {
        accessToken: 'ep-token-ghi',
      },
    }

    let findCallCount = 0
    mockPayload.find.mockImplementation(() => {
      findCallCount++
      if (findCallCount === 1) {
        return Promise.resolve({ docs: [order] })
      } else if (findCallCount === 2) {
        return Promise.resolve({ docs: [tenant] })
      }
      return Promise.resolve({ docs: [] })
    })

    mockTrackingStatus.mockResolvedValue({
      data: {
        results: [
          {
            status: 'success',
            awb_number: trackingNumber,
            latest_shipment_status_code: 5,
          },
        ],
      },
    })

    mockPayload.update.mockResolvedValue({ id: orderId })

    // Act
    const result = await syncTrackingJob(mockPayload)

    // Assert
    expect(result.updated).toBe(1)
    const updateCall = mockPayload.update.mock.calls[0][0]
    // Tracking status updated, but NOT order.status
    expect(updateCall.data.shippingTrackingStatus).toBe('delivered')
    expect(updateCall.data.status).toBeUndefined() // ← NOT set to completed
  })

  // TC-F36.OD.032: In Transit + shipped (non-delivered) → NO auto-complete
  it('[TC-F36.OD.032] in_transit + order.status=shipped → NO auto-complete (wrong status)', async () => {
    // Arrange
    const orderId = 'ord-004'
    const tenantId = 'ten-001'
    const trackingNumber = 'EP456789'

    const order = {
      id: orderId,
      tenant: tenantId,
      awbNo: trackingNumber,
      trackingNumber: trackingNumber,
      shippingTrackingStatus: 'picked_up',
      shippingTrackingHistory: [
        {
          status: 'picked_up',
          description: 'Picked Up',
          eventTime: '2026-06-29T10:00:00Z',
        },
      ],
      status: 'shipped', // ← in fulfillment, but tracking NOT delivered yet
    }

    const tenant = {
      id: tenantId,
      easyParcelIntegration: {
        accessToken: 'ep-token-jkl',
      },
    }

    let findCallCount = 0
    mockPayload.find.mockImplementation(() => {
      findCallCount++
      if (findCallCount === 1) {
        return Promise.resolve({ docs: [order] })
      } else if (findCallCount === 2) {
        return Promise.resolve({ docs: [tenant] })
      }
      return Promise.resolve({ docs: [] })
    })

    // Return code 4 (In Transit), not 5 (Delivered)
    mockTrackingStatus.mockResolvedValue({
      data: {
        results: [
          {
            status: 'success',
            awb_number: trackingNumber,
            latest_shipment_status_code: 4,
          },
        ],
      },
    })

    mockPayload.update.mockResolvedValue({ id: orderId })

    // Act
    const result = await syncTrackingJob(mockPayload)

    // Assert
    expect(result.updated).toBe(1)
    const updateCall = mockPayload.update.mock.calls[0][0]
    // Tracking status updated to in_transit
    expect(updateCall.data.shippingTrackingStatus).toBe('in_transit')
    // But order status NOT auto-completed (only 'delivered' triggers auto-complete)
    expect(updateCall.data.status).toBeUndefined()
  })
})
