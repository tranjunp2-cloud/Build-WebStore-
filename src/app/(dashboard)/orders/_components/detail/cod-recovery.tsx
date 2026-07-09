'use client'

import React, { useState } from 'react'
import { Truck, Package } from 'lucide-react'
import { useI18n } from '@/i18n'
import { SelfDeliveryZone } from './self-delivery-zone'

interface CodRecoveryProps {
  orderId: string | number
  onUpdate: () => void
}

/**
 * COD-blocked recovery options.
 * v1 scope:
 *   - "Ship manually" → SelfDeliveryZone (fully wired)
 *   - "Re-select EP prepaid" → disabled / coming soon (payment switch out of scope v1)
 */
export function CodRecovery({ orderId, onUpdate }: CodRecoveryProps) {
  const { t } = useI18n()
  const cr = t.dashboard.orders.codRecovery
  const [choice, setChoice] = useState<'ep' | 'manual' | null>(null)

  return (
    <div className="cod-recovery">
      <div className="cr-cap">{cr.question}</div>

      <div className="cr-options">
        {/* Re-select EP prepaid — disabled in v1, coming soon */}
        <button
          className={`cr-opt${choice === 'ep' ? ' on' : ''}`}
          onClick={() => setChoice('ep')}
          disabled
          title={cr.comingSoon}
          style={{ opacity: 0.45, cursor: 'not-allowed' }}
        >
          <span className="cr-radio" />
          <span className="cr-ic blue">
            <Truck style={{ width: 16, height: 16 }} />
          </span>
          <span className="cr-tx">
            <span className="cr-t">
              {cr.reselectEp}
              <span style={{
                marginLeft: 6,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '.03em',
                padding: '1px 6px',
                borderRadius: 999,
                background: 'rgba(148,163,184,.15)',
                color: '#94a3b8',
                verticalAlign: 'middle',
              }}>
                {cr.comingSoon}
              </span>
            </span>
            <span className="cr-d">{cr.reselectDesc}</span>
          </span>
        </button>

        {/* Ship manually — fully wired */}
        <button
          className={`cr-opt${choice === 'manual' ? ' on' : ''}`}
          onClick={() => setChoice('manual')}
        >
          <span className="cr-radio" />
          <span className="cr-ic slate">
            <Package style={{ width: 16, height: 16 }} />
          </span>
          <span className="cr-tx">
            <span className="cr-t">{cr.shipManually}</span>
            <span className="cr-d">{cr.shipManuallyDesc}</span>
          </span>
        </button>
      </div>

      {choice === 'manual' && (
        <div className="cr-panel">
          <SelfDeliveryZone
            orderId={orderId}
            selfDeliveryCourier={null}
            trackingNumber={null}
            onUpdate={onUpdate}
          />
        </div>
      )}
    </div>
  )
}
