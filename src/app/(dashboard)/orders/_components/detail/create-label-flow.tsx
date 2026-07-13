'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Info, Check, ExternalLink, RefreshCw, Wallet, TriangleAlert, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarUI } from '@/components/ui/calendar'
import { useI18n } from '@/i18n'
import {
  earliestPickupDate,
  isBusinessDateString,
  courierCutoffLabel,
} from '@/lib/shipping/easyparcel/pickup-schedule'
import type { EpWalletInfo } from './use-ep-shipping-info'
import { CourierLogo } from './courier-logo'

// Cosmetic 2-step display (single API call underneath)
type Step = 'idle' | 'submitting' | 'paying' | 'error' | 'wallet-low'

interface CreateLabelFlowProps {
  orderId: string | number
  courierId?: string | null
  courierName?: string | null
  /** Real courier logo URL (EP courier list) — CourierLogo falls back to monogram when absent. */
  courierLogoUrl?: string | null
  /** EP wallet balance (per-tenant cache) — shown under the cost line; note fallback when null. */
  wallet?: EpWalletInfo | null
  shippingFee?: number | null    // quoted at checkout (RM)
  // awbNo can be null: async-AWB couriers return awb_number null on a SUCCESSFUL submit
  onSuccess: (awbNo: string | null, labelUrl: string | null) => void
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
  courierLogoUrl,
  wallet,
  shippingFee,
  onSuccess,
  onCodBlocked,
}: CreateLabelFlowProps) {
  const { t, ti } = useI18n()
  const cl = t.dashboard.orders.createLabel
  const [step, setStep] = useState<Step>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // US-F36-07: pickup (courier collects, default) vs dropoff (merchant brings parcel).
  // The method is resolved server-side into a matching EP service VARIANT (EP has no
  // method flag on submit — the service_id decides collection). If the courier can't do
  // the chosen method on this route, the server rejects METHOD_NOT_SUPPORTED and the
  // option is disabled here.
  const [method, setMethod] = useState<'pickup' | 'dropoff'>('pickup')
  const [unsupported, setUnsupported] = useState<Array<'pickup' | 'dropoff'>>([])
  // Earliest date is cut-off aware per courier (shared helper — same math as the server clamp)
  const earliest = useMemo(() => earliestPickupDate(courierId ?? ''), [courierId])
  const [collectionDate, setCollectionDate] = useState(earliest)
  const dateIsBusiness = isBusinessDateString(collectionDate)
  const dateValid = collectionDate >= earliest && dateIsBusiness

  // "YYYY-MM-DD" string (API contract) ↔ local Date (react-day-picker works on Dates)
  const selectedDate = useMemo(() => new Date(`${collectionDate}T00:00:00`), [collectionDate])
  const earliestDate = useMemo(() => new Date(`${earliest}T00:00:00`), [earliest])
  const dateToStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  // Ref tracks the cosmetic timer so it can be cleared on unmount (avoids setState-on-unmounted warning)
  const cosmeticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dateOpen, setDateOpen] = useState(false)

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
        body: JSON.stringify({ collectionDate, method }),
      })
      if (cosmeticTimerRef.current) { clearTimeout(cosmeticTimerRef.current); cosmeticTimerRef.current = null }
      const data = await res.json()

      if (!res.ok) {
        const code = data?.error?.code ?? 'EASYPARCEL_ERROR'
        // Coerce to string — a non-string message (e.g. a passthrough EP error object)
        // rendered as a React child crashes the whole detail page.
        const rawMsg = data?.error?.message
        const msg = typeof rawMsg === 'string' ? rawMsg : 'Failed to create shipping label'
        if (code === 'COD_NOT_ELIGIBLE' && onCodBlocked) {
          // Live COD gate tripped (PD-021) — parent switches to the cod-blocked recovery panel
          setStep('idle')
          onCodBlocked()
        } else if (code === 'METHOD_NOT_SUPPORTED') {
          // Courier has no service variant for this method on this route. Trust the
          // server's supported[] (review #1582): it can be EMPTY (EP flag anomaly) —
          // never auto-flip onto a method that is itself unsupported, or the merchant
          // loops 422s with contradictory toasts.
          setStep('idle')
          const supported: string[] = Array.isArray(data?.error?.supported) ? data.error.supported : []
          const nowUnsupported = (['pickup', 'dropoff'] as const).filter((m) => !supported.includes(m))
          setUnsupported(nowUnsupported)
          const other = method === 'pickup' ? 'dropoff' : 'pickup'
          if (!nowUnsupported.includes(other)) setMethod(other)
          toast.error(
            nowUnsupported.length === 2
              ? cl.methodNoneSupported
              : method === 'pickup' ? cl.methodNoPickup : cl.methodNoDropoff,
          )
        } else if (code === 'EASYPARCEL_WALLET_LOW') {
          setStep('wallet-low')
          setErrorMsg(msg)
        } else {
          setStep('error')
          setErrorMsg(msg)
        }
        return
      }

      const { awbNo, labelUrl, collectionDate: usedDate, collectionDateShifted, serviceSwitched, methodResolved } = data.data ?? data
      toast.success(cl.labelCreated)
      // AC-3b: the server clamped the date (cut-off passed / weekend) — tell the merchant
      if (collectionDateShifted && typeof usedDate === 'string') {
        toast.info(ti(cl.dateShifted, { date: `${usedDate.slice(8, 10)}/${usedDate.slice(5, 7)}` }))
      }
      // Fail-open transparency (review #1582): the method-verification quote failed, so the
      // label booked with the stored service and the collection method was NOT confirmed.
      if (methodResolved === false) {
        toast.info(cl.methodUnverified)
      }
      // Money honesty: the stored service couldn't do the chosen method, so a same-courier
      // variant was booked — tell the merchant what the wallet was actually charged for.
      if (serviceSwitched?.serviceName) {
        toast.info(ti(cl.serviceSwitched, {
          service: serviceSwitched.serviceName,
          amount: typeof serviceSwitched.priceRm === 'number' ? `MYR ${serviceSwitched.priceRm.toFixed(2)}` : '—',
        }))
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
            {/* 32px ≈ optical match with the 34px .w-ico wallet tile — the white logo plate on a
                dark bg reads slightly larger than the tinted icon square at equal pixel size */}
            <CourierLogo courierId={courierId} courierName={courierName} logoUrl={courierLogoUrl} size={32} />
            {displayName}
          </span>
        </div>

        {/* Cost tile — quoted shipping fee on top, live wallet balance under the divider
            (design 260707); falls back to the "quoted at checkout" note while the balance
            is loading or when EP didn't return one. */}
        {shippingFee != null && (
          <div className="wallet">
            <span className="w-ico">
              <Wallet style={{ width: 18, height: 18 }} />
            </span>
            <div className="w-body">
              <div className="w-main">
                {ti(cl.epCost, { amount: `MYR ${shippingFee.toFixed(2)}` })}
              </div>
              {wallet ? (
                <div className="w-sub w-balance">
                  {cl.walletBalanceLabel}{' '}
                  <b>{wallet.currency} {Number(wallet.balance).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                </div>
              ) : (
                <div className="w-sub">{cl.epCostNote}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* US-F36-07: collection method + date, chosen BEFORE the label is bought.
          Columns stretch to the same height (wrapped tile text can't misalign the
          date input); the hint sits below the whole row, full-width. */}
      <div className="collect-row">
        <div className="collect-col">
          <div className="od-info-l" style={{ marginBottom: 6 }}>{cl.collectionMethod}</div>
          <div className="collect-methods" role="radiogroup" aria-label={cl.collectionMethod}>
            <button
              type="button"
              role="radio"
              aria-checked={method === 'pickup'}
              className={`collect-method${method === 'pickup' ? ' on' : ''}`}
              onClick={() => setMethod('pickup')}
              disabled={unsupported.includes('pickup')}
              title={unsupported.includes('pickup') ? cl.methodNoPickup : undefined}
            >
              <span className="cm-title">{cl.methodPickup}</span>
              <span className="cm-desc">{unsupported.includes('pickup') ? cl.methodNoPickup : cl.methodPickupDesc}</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={method === 'dropoff'}
              className={`collect-method${method === 'dropoff' ? ' on' : ''}`}
              onClick={() => setMethod('dropoff')}
              disabled={unsupported.includes('dropoff')}
              title={unsupported.includes('dropoff') ? cl.methodNoDropoff : undefined}
            >
              <span className="cm-title">{cl.methodDropoff}</span>
              <span className="cm-desc">{unsupported.includes('dropoff') ? cl.methodNoDropoff : cl.methodDropoffDesc}</span>
            </button>
          </div>
        </div>
        <div className="collect-col collect-date">
          <div className="od-info-l" style={{ marginBottom: 6 }}>{cl.collectionDateLabel}</div>
          {/* Date card mirrors the method tiles: value + its note live INSIDE the card.
              shadcn Calendar disables past dates + weekends right on the grid. */}
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="collect-date-card">
                <span className="cd-value">
                  {format(selectedDate, 'EEE, dd/MM/yyyy')}
                  <CalendarDays />
                </span>
                {!dateIsBusiness ? (
                  <span className="cd-note warn">
                    <TriangleAlert /> {cl.weekendWarning}
                  </span>
                ) : (
                  <span className="cd-note">
                    <Info />
                    {method === 'pickup'
                      ? ti(cl.cutoffHint, { time: courierCutoffLabel(courierId ?? '') })
                      : cl.dropoffHint}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="dash-shell w-auto p-0 border-[hsl(var(--border))] text-foreground"
              align="start"
              style={{ backgroundColor: 'var(--dash-bg)' }}
            >
              <CalendarUI
                mode="single"
                selected={selectedDate}
                defaultMonth={selectedDate}
                disabled={[{ before: earliestDate }, { dayOfWeek: [0, 6] }]}
                onSelect={(d) => {
                  if (d) setCollectionDate(dateToStr(d))
                  setDateOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
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
          // Also blocked when the SELECTED method is unsupported (both-methods-out case:
          // the auto-flip has nowhere to go, so without this the CTA would loop 422s)
          disabled={!dateValid || unsupported.includes(method)}
        >
          {cl.readyToShip}
        </button>
      </div>
    </div>
  )
}
