/**
 * Component tests for TrackingTimeline — F36 (GH-1333)
 * Tests sorting, verbatim courier descriptions, status fallback, and empty state rendering.
 *
 * TC-F36.C01–F36.C07: Tracking timeline rendering + internationalization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrackingTimeline, TrackingEvent } from '@/app/(dashboard)/orders/_components/detail/tracking-timeline'

// Mock useI18n hook (returns English labels for testing)
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      dashboard: {
        orders: {
          tracking: {
            statusOrderCreated: 'Order Created',
            statusPendingPickup: 'Pending Pickup',
            statusPickedUp: 'Picked Up',
            statusInTransit: 'In Transit',
            statusOutForDelivery: 'Out for Delivery',
            statusDelivered: 'Delivered',
            statusFailedDelivery: 'Failed Delivery',
            statusReturnedToSender: 'Returned to Sender',
            statusLost: 'Lost',
            statusCancelled: 'Cancelled',
            statusException: 'Exception',
            statusProcessing: 'Processing',
            awaitingUpdate: 'Awaiting Update',
          },
        },
      },
    },
  }),
}))

describe('TrackingTimeline', () => {
  // TC-F36.C01: Empty events array → shows "Awaiting Update" message
  it('[TC-F36.C01] Empty events array → shows "Awaiting Update" message', () => {
    render(<TrackingTimeline events={[]} />)
    expect(screen.getByText('Awaiting Update')).toBeInTheDocument()
  })

  // TC-F36.C02: Null/undefined events → shows empty state
  it('[TC-F36.C02] null events → shows "Awaiting Update" message', () => {
    render(<TrackingTimeline events={null as any} />)
    expect(screen.getByText('Awaiting Update')).toBeInTheDocument()
  })

  // TC-F36.C03: Courier description is the timeline title, without rewriting
  it('[TC-F36.C03] Single event renders the courier description verbatim', () => {
    const events: TrackingEvent[] = [
      {
        status: 'delivered',
        eventTime: '2026-07-01T10:30:00Z',
        description: 'Package delivered',
      },
    ]
    render(<TrackingTimeline events={events} />)
    expect(screen.getByText('Package delivered')).toBeInTheDocument()
    expect(screen.queryByText('Delivered')).not.toBeInTheDocument()
  })

  // TC-F36.C04: Multiple events sorted DESC by eventTime (newest first)
  it('[TC-F36.C04] Multiple events sorted DESC (newest first)', () => {
    const events: TrackingEvent[] = [
      {
        status: 'order_created',
        eventTime: '2026-06-28T08:00:00Z',
      },
      {
        status: 'picked_up',
        eventTime: '2026-06-29T14:30:00Z',
      },
      {
        status: 'in_transit',
        eventTime: '2026-06-30T09:15:00Z',
      },
      {
        status: 'delivered',
        eventTime: '2026-07-01T10:30:00Z',
      },
    ]
    render(<TrackingTimeline events={events} />)

    const timeline = screen.getByText('Delivered').closest('.tl-row')
    expect(timeline?.classList.contains('live')).toBe(true) // Newest should have 'live' class

    const rows = screen.getAllByText(/Order Created|Picked Up|In Transit|Delivered/)
    // Verify order: Delivered (newest) should be first rendered item
    expect(rows[0]).toHaveTextContent('Delivered')
  })

  // TC-F36.C05: All known status labels map correctly
  it('[TC-F36.C05] All known status strings map to friendly labels', () => {
    const internalStatuses = [
      'order_created',
      'pending_pickup',
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'failed_delivery',
      'returned_to_sender',
      'lost',
      'cancelled',
      'exception',
    ]

    const friendlyLabels = [
      'Order Created',
      'Pending Pickup',
      'Picked Up',
      'In Transit',
      'Out for Delivery',
      'Delivered',
      'Failed Delivery',
      'Returned to Sender',
      'Lost',
      'Cancelled',
      'Exception',
    ]

    const events: TrackingEvent[] = internalStatuses.map((status, i) => ({
      status,
      eventTime: new Date(Date.now() - i * 3600000).toISOString(),
    }))

    render(<TrackingTimeline events={events} />)

    // Verify each friendly label is rendered (mapped from internal status)
    friendlyLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  // TC-F36.C06: Unknown status falls back to raw string
  it('[TC-F36.C06] Unknown status string renders as-is (fallback)', () => {
    const events: TrackingEvent[] = [
      {
        status: 'CustomUnknownStatus',
        eventTime: '2026-07-01T10:30:00Z',
      },
    ]
    render(<TrackingTimeline events={events} />)
    expect(screen.getByText('CustomUnknownStatus')).toBeInTheDocument()
  })

  // TC-F36.C07: Description still wins when the internal status is absent
  it('[TC-F36.C07] Missing status → renders the courier description', () => {
    const events: TrackingEvent[] = [
      {
        eventTime: '2026-07-01T10:30:00Z',
        description: 'In progress',
      },
    ]
    render(<TrackingTimeline events={events} />)
    expect(screen.getByText('In progress')).toBeInTheDocument()
    expect(screen.queryByText('Processing')).not.toBeInTheDocument()
  })

  // TC-F36.C08: Event time formatting — day/month/year · HH:mm
  it('[TC-F36.C08] Event time formats as DD/Mon/YYYY · HH:mm', () => {
    const events: TrackingEvent[] = [
      {
        status: 'delivered',
        eventTime: '2026-07-01T14:30:00Z',
      },
    ]
    render(<TrackingTimeline events={events} />)
    // Format: "1 Jul 2026 · HH:mm" (en-GB locale) — check for date separator and content
    const timeElement = screen.getByText(/Jul 2026.*:/)
    expect(timeElement).toBeInTheDocument()
  })

  // TC-F36.C09: Event without eventTime → shows no timestamp
  it('[TC-F36.C09] Missing eventTime → no timestamp displayed', () => {
    const events: TrackingEvent[] = [
      {
        status: 'Processing',
        description: 'Order processing',
      },
    ]
    render(<TrackingTimeline events={events} />)
    expect(screen.getByText('Order processing')).toBeInTheDocument()
    // Should render without crash, empty time string
    expect(screen.queryByText(/\d{1,2}\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/)).not.toBeInTheDocument()
  })

  // TC-F36.C10: Description field optional — renders when present
  it('[TC-F36.C10] Description renders when present', () => {
    const events: TrackingEvent[] = [
      {
        status: 'in_transit',
        eventTime: '2026-06-30T09:15:00Z',
        description: 'Left distribution center',
      },
    ]
    render(<TrackingTimeline events={events} />)
    expect(screen.getByText('Left distribution center')).toBeInTheDocument()
    expect(screen.queryByText('In Transit')).not.toBeInTheDocument()
  })

  it('[TC-F36.C10b] EP Schedule In Arrangement is not rewritten as Waiting for Pickup', () => {
    render(<TrackingTimeline events={[{
      status: 'pending_pickup',
      description: 'Schedule In Arrangement',
      eventTime: '2026-07-28T03:23:50.000Z',
    }]} />)

    expect(screen.getByText('Schedule In Arrangement')).toBeInTheDocument()
    expect(screen.queryByText('Pending Pickup')).not.toBeInTheDocument()
  })

  // TC-F36.C11: Description field skipped when missing
  it('[TC-F36.C11] No description → no note element rendered', () => {
    const events: TrackingEvent[] = [
      {
        status: 'delivered',
        eventTime: '2026-07-01T10:30:00Z',
      },
    ]
    render(<TrackingTimeline events={events} />)
    expect(screen.getByText('Delivered')).toBeInTheDocument()
    expect(screen.queryByText(/Note|note|description/i)).not.toBeInTheDocument()
  })

  // TC-F36.C12: Multiple events with mixed order → properly sorted
  it('[TC-F36.C12] Mixed event order → all sorted DESC by eventTime', () => {
    const events: TrackingEvent[] = [
      { status: 'picked_up', eventTime: '2026-06-29T14:30:00Z' },
      { status: 'delivered', eventTime: '2026-07-01T10:30:00Z' },
      { status: 'order_created', eventTime: '2026-06-28T08:00:00Z' },
      { status: 'in_transit', eventTime: '2026-06-30T09:15:00Z' },
    ]
    render(<TrackingTimeline events={events} />)

    const rows = screen.getAllByText(/Order Created|Picked Up|In Transit|Delivered/)
    // First rendered should be Delivered (newest: 2026-07-01)
    expect(rows[0]).toHaveTextContent('Delivered')
    // Last rendered should be Order Created (oldest: 2026-06-28)
    expect(rows[rows.length - 1]).toHaveTextContent('Order Created')
  })

  // TC-F36.C13: Event with null descriptions
  it('[TC-F36.C13] null description → no note rendered', () => {
    const events: TrackingEvent[] = [
      {
        status: 'in_transit',
        eventTime: '2026-06-30T09:15:00Z',
        description: null,
      },
    ]
    render(<TrackingTimeline events={events} />)
    expect(screen.getByText('In Transit')).toBeInTheDocument()
    // No description note should render
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  // TC-F36.C14: Newest event gets 'live' marker class
  it('[TC-F36.C14] Newest event (first in sorted list) gets "live" class marker', () => {
    const events: TrackingEvent[] = [
      { status: 'order_created', eventTime: '2026-06-28T08:00:00Z' },
      { status: 'delivered', eventTime: '2026-07-01T10:30:00Z' },
    ]
    render(<TrackingTimeline events={events} />)

    const deliveredRow = screen.getByText('Delivered').closest('.tl-row')
    expect(deliveredRow?.classList.contains('live')).toBe(true)

    const createdRow = screen.getByText('Order Created').closest('.tl-row')
    expect(createdRow?.classList.contains('live')).toBe(false)
  })
})
