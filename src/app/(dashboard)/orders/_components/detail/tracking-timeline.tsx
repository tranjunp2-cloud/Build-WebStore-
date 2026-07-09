'use client'

// Tracking event timeline for EP shipped/completed orders.
// Renders order.shippingTrackingHistory sorted DESC (newest first).
// Status raw strings → friendly labels via inline map (client-safe;
// status-map.ts is server-only).

import { useI18n } from '@/i18n'

function fmtEventTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

export interface TrackingEvent {
  status?: string | null
  description?: string | null
  eventTime?: string | null
}

export function TrackingTimeline({ events }: { events: TrackingEvent[] }) {
  const { t } = useI18n()
  const tk = t.dashboard.orders.tracking

  // Keyed by the INTERNAL enum values stored in shippingTrackingHistory[].status
  // (sync-tracking.ts writes mapped.internal, not the human label).
  const FRIENDLY: Record<string, string> = {
    'order_created':      tk.statusOrderCreated,
    'pending_pickup':     tk.statusPendingPickup,
    'picked_up':          tk.statusPickedUp,
    'in_transit':         tk.statusInTransit,
    'out_for_delivery':   tk.statusOutForDelivery,
    'delivered':          tk.statusDelivered,
    'failed_delivery':    tk.statusFailedDelivery,
    'returned_to_sender': tk.statusReturnedToSender,
    'lost':               tk.statusLost,
    'cancelled':          tk.statusCancelled,
    'exception':          tk.statusException,
    'processing':         tk.statusProcessing,
  }

  function friendlyStatus(raw: string | null | undefined): string {
    if (!raw) return tk.statusProcessing
    return FRIENDLY[raw] ?? raw
  }

  if (!events || events.length === 0) {
    return (
      <div className="track-timeline">
        <div className="tl-row" style={{ color: 'var(--dash-text-muted)', fontSize: 13 }}>
          {tk.awaitingUpdate}
        </div>
      </div>
    )
  }

  // Sort DESC by eventTime (newest first)
  const sorted = [...events].sort((a, b) => {
    const ta = a.eventTime ? new Date(a.eventTime).getTime() : 0
    const tb = b.eventTime ? new Date(b.eventTime).getTime() : 0
    return tb - ta
  })

  return (
    <div className="track-timeline">
      {sorted.map((ev, i) => {
        const isFirst = i === 0 // newest = "live" marker
        return (
          <div
            key={`${ev.status}-${ev.eventTime}-${i}`}
            className={`tl-row done${isFirst ? ' live' : ''}`}
          >
            <span className="tl-dot" />
            <div className="tl-body">
              <div className="tl-head">
                <span className="tl-t">{friendlyStatus(ev.status)}</span>
                <span className="tl-d">{fmtEventTime(ev.eventTime)}</span>
              </div>
              {ev.description && (
                <div className="tl-note">{ev.description}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
