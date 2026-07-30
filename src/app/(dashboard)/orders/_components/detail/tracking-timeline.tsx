'use client'

// Tracking event timeline for EP shipped/completed orders.
// Renders order.shippingTrackingHistory sorted DESC (newest first).
// Courier descriptions are rendered verbatim beneath the mapped status title,
// matching the Figma timeline. CMS-created shipment events stay single-line.

import { useI18n } from '@/i18n'
import { formatTrackingEventDisplay } from '@/lib/shipping/tracking-event-display'

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
  collectionMethod?: 'pickup' | 'dropoff' | null
}

interface TrackingTimelineProps {
  events: TrackingEvent[]
  collectionMethod?: 'pickup' | 'dropoff' | null
}

export function TrackingTimeline({ events, collectionMethod }: TrackingTimelineProps) {
  const { t } = useI18n()
  const tk = t.dashboard.orders.tracking

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
        const display = formatTrackingEventDisplay(ev, collectionMethod, tk)
        return (
          <div
            key={`${ev.status}-${ev.eventTime}-${i}`}
            className={`tl-row done${isFirst ? ' live' : ''}`}
          >
            <span className="tl-dot" />
            <div className="tl-body">
              <div className="tl-head">
                <span className="tl-t">{display.title}</span>
                <span className="tl-d">{fmtEventTime(ev.eventTime)}</span>
              </div>
              {display.note && <div className="tl-note">{display.note}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
