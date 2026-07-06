'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Info, Check, ExternalLink, RefreshCw, Lock, Wallet, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import {
  earliestPickupDate,
  isBusinessDateString,
  courierCutoffLabel,
} from '@/lib/shipping/easyparcel/pickup-schedule'
import { CourierLogo } from './courier-logo'

// Cosmetic 2-step display (single API call underneath)
type Step = 'idle' | 'submitting' | 'paying' | 'error' | 'wallet-low'

interface CreateLabelFlowProps {
  orderId: string | number
  courierId?: string | null
  courierName?: string | null
  shippingFee?: number | null    // quoted at checkout (RM)
  onSuccess: (awbNo: string, labelUrl: string | null) => void
  /** Server rejected with COD_NOT_ELIGIBLE (live R1/R2/R3 gate) — parent shows the COD recovery panel. */
  onCodBlocked?: () => void
}

/**
 * Ready-to-ship flow: CourierPreset + cost line + CTA.
 * Single POST to /create-label; cosmetic submitting→paying phases.
 * Handles EASYPARCEL_WALLET_LOW → wallet-low error state.
 * Wallet balance omitted (API doesn't return it).
 */
export function CreateLabelFlow({
  orderId,
  courierId,
  courierName,
  shippingFee,
  onSuccess,
  onCodBlocked,
}: CreateLabelFlowProps) {
  const { t, ti } = useI18n()
  const cl = t.dashboard.orders.createLabel
  const [step, setStep] = useState<Step>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // US-F36-07: pickup (courier collects, default) vs dropoff (merchant brings parcel).
  // Both send the same collection_date to EP (AC-1) — no separate pickup endpoint.
  const [method, setMethod] = useState<'pickup' | 'dropoff'>('pickup')
  // Earliest date is cut-off aware per courier (shared helper — same math as the server clamp)
  const earliest = useMemo(() => earliestPickupDate(courierId ?? ''), [courierId])
  const [collectionDate, setCollectionDate] = useState(earliest)
  const dateIsBusiness = isBusinessDateString(collectionDate)
  const dateValid = collectionDate >= earliest && dateIsBusiness
  // Ref tracks the cosmetic timer so it can be cleared on unmount (avoids setState-on-unmounted warning)
  const cosmeticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (cosmeticTimerRef.current) clearTimeout(cosmeticTimerRef.current)
    }
  }, [])

  const handleShip = async () => {
    setStep('submitting')
    setErrorMsg(null)

    // Cosmetic phase 2 after ~1.4 s
    cosmeticTimerRef.current = setTimeout(() => setStep('paying'), 1400)

    try {
      const res = await fetch(`/api/orders/${orderId}/create-label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionDate }),
      })
      if (cosmeticTimerRef.current) { clearTimeout(cosmeticTimerRef.current); cosmeticTimerRef.current = null }
      const data = await res.json()

      if (!res.ok) {
        const code = data?.error?.code ?? 'EASYPARCEL_ERROR'
        const msg = data?.error?.message ?? 'Failed to create shipping label'
        if (code === 'COD_NOT_ELIGIBLE' && onCodBlocked) {
          // Live COD gate tripped (PD-021) — parent switches to the cod-blocked recovery panel
          setStep('idle')
          onCodBlocked()
        } else if (code === 'EASYPARCEL_WALLET_LOW') {
          setStep('wallet-low')
          setErrorMsg(msg)
        } else {
          setStep('error')
          setErrorMsg(msg)
        }
        return
      }

      const { awbNo, labelUrl, collectionDate: usedDate, collectionDateShifted } = data.data ?? data
      toast.success(cl.labelCreated)
      // AC-3b: the server clamped the date (cut-off passed / weekend) — tell the merchant
      if (collectionDateShifted && typeof usedDate === 'string') {
        toast.info(ti(cl.dateShifted, { date: `${usedDate.slice(8, 10)}/${usedDate.slice(5, 7)}` }))
      }
      onSuccess(awbNo, labelUrl ?? null)
    } catch {
      if (cosmeticTimerRef.current) { clearTimeout(cosmeticTimerRef.current); cosmeticTimerRef.current = null }
      setStep('error')
      setErrorMsg(cl.networkError)
    }
  }

  const busy = step === 'submitting' || step === 'paying'
  const displayName = courierName ?? courierId ?? 'Preset courier'

  // ── Error: wallet low ─────────────────────────────────────────────
  if (step === 'wallet-low') {
    return (
      <div className="action-zone">
        <button className="btn btn-grad btn-block ship-cta disabled" style={{ height: 40 }} disabled>
          {cl.readyToShip}
        </button>
        <div className="alert error" role="alert">
          <ExternalLink className="lead" style={{ width: 17, height: 17 }} />
          <div className="a-body">
            <div className="a-t">{cl.walletLowTitle}</div>
            {errorMsg ?? cl.walletLowFallback}
          </div>
        </div>
        <div className="ship-actions">
          <a
            href="https://app.easyparcel.com/my/my-account/wallet"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            <ExternalLink style={{ width: 15, height: 15 }} /> {cl.topUpWallet}
          </a>
          <button
            className="btn btn-outline"
            onClick={() => { setStep('idle'); setErrorMsg(null) }}
          >
            <RefreshCw style={{ width: 15, height: 15 }} /> {cl.tryAgain}
          </button>
        </div>
      </div>
    )
  }

  // ── Error: generic ────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div className="action-zone">
        <div className="alert error" role="alert">
          <div className="a-body">
            <div className="a-t">{cl.failedTitle}</div>
            {errorMsg}
          </div>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => { setStep('idle'); setErrorMsg(null) }}
        >
          <RefreshCw style={{ width: 15, height: 15 }} /> {cl.tryAgain}
        </button>
      </div>
    )
  }

  // ── Busy: cosmetic 2-step display ─────────────────────────────────
  if (busy) {
    return (
      <div className="action-zone">
        <button className="btn btn-grad btn-block ship-cta disabled" style={{ height: 40 }} disabled>
          <span className="spin" />
          {step === 'submitting' ? cl.reserving : cl.charging}
        </button>
        <div className="ship-steps">
          <div className={`ship-step${step !== 'paying' ? ' active' : ' done'}`}>
            <span className="s-dot">
              {step === 'paying'
                ? <Check style={{ width: 13, height: 13 }} />
                : <span className="spin" />}
            </span>
            <span className="s-txt">{cl.stepReserving}</span>
          </div>
          <div className={`ship-step${step === 'paying' ? ' active' : ''}`}>
            <span className="s-dot">
              {step === 'paying' ? <span className="spin" /> : '2'}
            </span>
            <span className="s-txt">{cl.stepCharging}</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Ready: courier preset + cost + CTA ───────────────────────────
  return (
    <div className="action-zone">
      <div className="ship-meta">
        {/* Courier preset tile */}
        <div className="courier-preset">
          <span className="cp-l">{cl.courierLabel}</span>
          <span className="cp-v">
            <CourierLogo courierId={courierId} courierName={courierName} size={20} />
            {displayName}
            <span className="preset-tag">
              <Lock style={{ width: 10, height: 10 }} /> {cl.fromSettings}
            </span>
          </span>
        </div>

        {/* Cost line — show quoted shipping fee; wallet balance omitted (API doesn't return it) */}
        {shippingFee != null && (
          <div className="wallet">
            <span className="w-ico">
              <Wallet style={{ width: 18, height: 18 }} />
            </span>
            <div className="w-body">
              <div className="w-main">
                {ti(cl.epCost, { amount: `MYR ${shippingFee.toFixed(2)}` })}
              </div>
              <div className="w-sub">{cl.epCostNote}</div>
            </div>
          </div>
        )}
      </div>

      {/* US-F36-07: collection method + date, chosen BEFORE the label is bought */}
      <div className="ship-meta">
        <div>
          <div className="od-info-l" style={{ marginBottom: 6 }}>{cl.collectionMethod}</div>
          <div className="sched-slots" role="radiogroup" aria-label={cl.collectionMethod}>
            <button
              type="button"
              role="radio"
              aria-checked={method === 'pickup'}
              className={`sched-slot${method === 'pickup' ? ' on' : ''}`}
              onClick={() => setMethod('pickup')}
            >
              <span className="ss-time">{cl.methodPickup}</span>
              <span className="ss-name">{cl.methodPickupDesc}</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={method === 'dropoff'}
              className={`sched-slot${method === 'dropoff' ? ' on' : ''}`}
              onClick={() => setMethod('dropoff')}
            >
              <span className="ss-time">{cl.methodDropoff}</span>
              <span className="ss-name">{cl.methodDropoffDesc}</span>
            </button>
          </div>
        </div>
        <div>
          <div className="od-info-l" style={{ marginBottom: 6 }}>{cl.collectionDateLabel}</div>
          <div className="sched-custom" style={{ marginTop: 0 }}>
            <input
              type="date"
              value={collectionDate}
              min={earliest}
              onChange={(e) => setCollectionDate(e.target.value)}
            />
            {!dateIsBusiness ? (
              <div className="sched-warn">
                <TriangleAlert /> {cl.weekendWarning}
              </div>
            ) : (
              <div className="help" style={{ marginTop: 6 }}>
                <Info style={{ width: 12, height: 12 }} />
                {method === 'pickup'
                  ? ti(cl.cutoffHint, { time: courierCutoffLabel(courierId ?? '') })
                  : cl.dropoffHint}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ship-foot">
        <div className="help">
          <Info style={{ width: 12, height: 12 }} />
          {cl.shipHint}
        </div>
        <button
          className="btn btn-grad ship-cta ship-cta-fixed"
          style={{ height: 40 }}
          onClick={handleShip}
          disabled={!dateValid}
        >
          {cl.readyToShip}
        </button>
      </div>
    </div>
  )
}
