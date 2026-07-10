'use client'

import React, { useState } from 'react'
import { CheckCircle2, Info, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'

const SELF_COURIERS = [
  'Pos Laju',
  'J&T Express',
  'DHL eCommerce',
  'Ninja Van',
  'City-Link Express',
  'Skynet',
  'GDEX',
  'ABX Express',
  'Teleport',
]

interface SelfDeliveryZoneProps {
  orderId: string | number
  /** Already shipped via self-delivery — show locked read-only card */
  selfDeliveryCourier?: string | null
  trackingNumber?: string | null
  onUpdate: () => void
}

/**
 * Shown when EP is off or no courier selected, and order is not yet shipped.
 * Locked read-only view when selfDeliveryCourier is already set + status=shipped.
 */
export function SelfDeliveryZone({
  orderId,
  selfDeliveryCourier,
  trackingNumber,
  onUpdate,
}: SelfDeliveryZoneProps) {
  const { t } = useI18n()
  const sd = t.dashboard.orders.selfDelivery
  const [courier, setCourier] = useState('')
  const [awb, setAwb] = useState('')
  const [saving, setSaving] = useState(false)

  // Locked state — already shipped via self-delivery
  if (selfDeliveryCourier) {
    return (
      <div className="self-deliver">
        <div className="alert success ship-banner">
          <CheckCircle2 className="lead" style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1 }} />
          <div className="a-body">
            <div className="a-t">{sd.shippedTitle}</div>
            {sd.shippedBody}
          </div>
        </div>
        <div className="ship-track">
          <div className="sd-readrow">
            <div className="od-info-l">{sd.courier}</div>
            <div className="sd-courier-val">
              {selfDeliveryCourier}
              <span className="sd-self-badge">{sd.selfBadge}</span>
            </div>
          </div>
          {trackingNumber && (
            <div className="sd-readrow">
              <div className="od-info-l">{sd.trackingAwb}</div>
              <div className="copyfield">
                <span className="cf-v">{trackingNumber}</span>
                <button
                  className="cf-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(trackingNumber)
                    toast.success(sd.copied)
                  }}
                >
                  {sd.copy}
                </button>
              </div>
            </div>
          )}
          <div className="sd-disclaimer">
            <Info style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
            {sd.manualDisclaimer}
          </div>
        </div>
      </div>
    )
  }

  const canShip = courier.trim().length > 0 && awb.trim().length > 0

  const handleShip = async () => {
    if (!canShip) return
    setSaving(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/self-deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courier: courier.trim(), trackingNumber: awb.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error?.message ?? 'Failed to mark as shipped')
      }
      toast.success(sd.shipped)
      onUpdate()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : sd.shipFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="self-deliver">
      <div className="alert info sd-banner">
        <Info className="lead" style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1 }} />
        <div className="a-body">
          <div className="a-t">{sd.bannerTitle}</div>
          {sd.bannerBody}
        </div>
      </div>

      <div className="od-field">
        <label className="lbl" htmlFor="sd-courier">{sd.courierLabel}</label>
        <div className="sel">
          <select
            id="sd-courier"
            value={courier}
            onChange={e => setCourier(e.target.value)}
            disabled={saving}
          >
            <option value="" disabled>{sd.courierPlaceholder}</option>
            {SELF_COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <svg className="chev" viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16 }}>
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <div className="od-field">
        <label className="lbl" htmlFor="sd-awb">{sd.trackingLabel}</label>
        <div className="inp">
          <input
            id="sd-awb"
            value={awb}
            onChange={e => setAwb(e.target.value)}
            placeholder={sd.trackingPlaceholder}
            disabled={saving}
          />
        </div>
      </div>

      <button
        className="btn btn-primary btn-block"
        style={{ height: 40 }}
        disabled={!canShip || saving}
        onClick={handleShip}
      >
        {saving ? <span className="spin" /> : <Truck style={{ width: 15, height: 15 }} />}
        {sd.shipOrder}
      </button>
    </div>
  )
}
