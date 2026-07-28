'use client'

/**
 * FulfillmentZone — shipping fulfillment left-column zone.
 * Derives design state from the real order object (no mocks).
 * State machine mirrors phase-03 spec table.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Truck, Copy, Printer, CalendarClock,
  CheckCircle2, XCircle, Clock, Info, BanknoteIcon,
  MapPin, BadgeCheck,
} from 'lucide-react'
import './fulfillment.css'
import { useI18n } from '@/i18n'
import { CourierLogo, courierById } from './courier-logo'
import { useCourierLogos, useEpWallet, invalidateEpShippingInfo } from './use-ep-shipping-info'
import { CreateLabelFlow } from './create-label-flow'
import { PrintLabelModal } from './print-label-modal'
import { SelfDeliveryZone } from './self-delivery-zone'
import { CodRecovery } from './cod-recovery'
import { MissingWeightForm } from './missing-weight-form'
import { TrackingTimeline, type TrackingEvent } from './tracking-timeline'

// ── Order shape consumed by this component ────────────────────────────────────
// Extends OrderDetail with EP + self-delivery fields via any-cast at the call site.
export interface FulfillmentOrder {
  id: string | number
  status: string
  orderNumber: string
  paymentMethod?: string | null
  shippingFee?: number | null
  codAmount?: number | null
  shippingAddress?: { city?: string | null; state?: string | null } | null
  // EP fields
  awbNo?: string | null
  easyParcelOrderNo?: string | null
  labelUrl?: string | null
  labelUrls?: { A4?: string | null; A6?: string | null } | null
  shippingCourier?: string | null
  shippingCourierName?: string | null
  shippingServiceId?: string | null
  parcelWeight?: number | null
  pickupScheduledAt?: string | null
  collectionMethod?: 'pickup' | 'dropoff' | null
  pickupSlot?: string | null
  labelPrintedAt?: string | null
  shippingTrackingHistory?: Array<{
    status?: string | null
    description?: string | null
    eventTime?: string | null
  }> | null
  // Self-delivery
  selfDeliveryCourier?: string | null
  trackingNumber?: string | null
  // Cancel info
  cancelReason?: string | null
  cancelledAt?: string | null
  // Tenant integration config (depth=2 resolved)
  tenant?: {
    id?: string | number
    easyParcelIntegration?: {
      enabled?: boolean
      selectedCouriers?: string[]
      selectedCourier?: string
    }
  } | string | number | null
}

export function optimisticShipmentCreatedEvent(
  awbNo: string | null,
  at: Date = new Date(),
): TrackingEvent {
  return {
    status: 'pending_pickup',
    description: awbNo ? `Shipment created — ${awbNo}` : 'Shipment created',
    eventTime: at.toISOString(),
  }
}

export function mergeOptimisticTrackingEvent(
  events: TrackingEvent[] | null | undefined,
  optimistic: TrackingEvent | null,
): TrackingEvent[] {
  const persisted = events ?? []
  if (!optimistic) return persisted

  const optimisticTime = optimistic.eventTime ? new Date(optimistic.eventTime).getTime() : NaN
  const alreadyPersisted = persisted.some((event) => {
    if (event.status !== optimistic.status || event.description !== optimistic.description) return false
    const eventTime = event.eventTime ? new Date(event.eventTime).getTime() : NaN
    return Number.isFinite(eventTime) && Number.isFinite(optimisticTime) && Math.abs(eventTime - optimisticTime) < 60_000
  })

  return alreadyPersisted ? persisted : [...persisted, optimistic]
}

// ── Design state derivation ───────────────────────────────────────────────────
type FulfillState =
  | 'pending'
  | 'cod-blocked'
  | 'missing-data'
  | 'ready'
  | 'success'
  | 'shipping'
  | 'completed'
  | 'cancelled'
  | 'self-delivery'
  | 'self-shipped'

export function deriveFulfillState(order: FulfillmentOrder): FulfillState {
  const { status, awbNo, parcelWeight, selfDeliveryCourier } = order

  if (status === 'cancelled' || status === 'refunded') return 'cancelled'
  if (status === 'completed') return 'completed'

  // Self-shipped: manual courier already set + shipped
  if (selfDeliveryCourier && status === 'shipped') return 'self-shipped'

  // EP shipped/transit
  if (status === 'shipped') return 'shipping'

  // EP label already created → success/ready-to-ship holding state.
  // Gate on the shipment number, not the AWB: submit can return awb_number null (the
  // courier generates it asynchronously, e.g. Pos) while the shipment IS created and the
  // wallet charged — keying on awbNo alone re-offers "Ready to Ship" for a bought label.
  // A CLAIM: sentinel is an in-flight create-label request, not a created shipment.
  const epShipmentNo =
    order.easyParcelOrderNo && !order.easyParcelOrderNo.startsWith('CLAIM:')
      ? order.easyParcelOrderNo
      : null
  if ((awbNo || epShipmentNo) && status === 'ready_to_ship') return 'success'

  // Pending states (COD / awaiting confirmation) — must run BEFORE EP-config branch so that
  // an unconfirmed order in an EP-off/no-courier tenant shows "Confirm order", not self-delivery.
  if (status === 'pending' || status === 'new') return 'pending'

  // Resolve EP config from depth=2 tenant
  const tenantEp =
    typeof order.tenant === 'object' && order.tenant !== null
      ? (order.tenant as { easyParcelIntegration?: { enabled?: boolean; selectedCouriers?: string[]; selectedCourier?: string } }).easyParcelIntegration
      : null
  const epEnabled = tenantEp?.enabled === true
  const hasCourier = !!(order.shippingCourier)

  // If EP is off or no courier → self-delivery flow
  if (!epEnabled || !hasCourier) {
    // Already self-shipped but selfDeliveryCourier not yet set? Fall through to self-delivery form.
    return selfDeliveryCourier ? 'self-shipped' : 'self-delivery'
  }

  // NOTE (PD-021): 'cod-blocked' is no longer derivable statically — COD eligibility is
  // per-route LIVE from the EP quotation. It is entered via the COD_NOT_ELIGIBLE error
  // from /create-label (see forceCodBlocked in FulfillmentZone).

  // Missing weight — EP on + courier + confirmed but no parcel weight
  if (status === 'confirmed' && epEnabled && hasCourier && !parcelWeight) {
    return 'missing-data'
  }

  // Ready to ship via EP
  if (status === 'confirmed' && epEnabled && hasCourier && !awbNo) return 'ready'

  // Fallback — treat confirmed with EP on as ready
  return 'ready'
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtMYR(rm: number): string {
  return 'MYR ' + rm.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Main export ───────────────────────────────────────────────────────────────
export function FulfillmentZone({
  order,
  onUpdate,
  onLabelCreated,
}: {
  order: FulfillmentOrder
  onUpdate: () => void
  // Silent reconcile after label creation — refresh order state in place WITHOUT the
  // full-page reload (router.refresh) that onUpdate does. The success card renders
  // optimistically and the AWB fills in via polling, so no reload is needed. Falls
  // back to onUpdate when not provided.
  onLabelCreated?: () => void
}) {
  const { t, ti } = useI18n()
  const f = t.dashboard.orders.fulfillment
  const pk = t.dashboard.orders.pickup
  const [confirming, setConfirming] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)

  // After label created: optimistically show awbNo + labelUrl before refetch
  const [localAwb, setLocalAwb] = useState<string | null>(null)
  const [localLabelUrl, setLocalLabelUrl] = useState<string | null>(null)
  // Async-AWB case: create-label succeeded with awbNo null — flip to success immediately
  // (the refetched order carries easyParcelOrderNo, but don't wait a round-trip to show it)
  const [localCreated, setLocalCreated] = useState(false)
  const [optimisticTrackingEvent, setOptimisticTrackingEvent] = useState<TrackingEvent | null>(null)

  // Mark-shipment-cancelled (merchant attest — EP sends no webhook for dashboard cancels):
  // two-step inline confirm, then clear EP fields server-side → zone falls back to 'ready'
  // so the merchant re-creates a label through the normal existing flow.
  // Drop stale optimistic label state when the refetched order's EP fields are gone —
  // e.g. an EP cancel webhook auto-reopened the order to 'confirmed' (review #1582:
  // otherwise localCreated forces 'success' forever on this mount). Deps don't change in the post-create window
  // (order prop still stale), so the fresh optimistic state survives until refetch lands.
  useEffect(() => {
    if (!order.easyParcelOrderNo && !order.awbNo) {
      setLocalCreated(false)
      setLocalAwb(null)
      setLocalLabelUrl(null)
      setOptimisticTrackingEvent(null)
    }
  }, [order.easyParcelOrderNo, order.awbNo])

  // Missing-data override: user clicked "Ready to Ship" but EP returned MISSING_*
  const [forceMissing, setForceMissing] = useState(false)
  // COD-blocked override: create-label returned COD_NOT_ELIGIBLE (live R1/R2/R3 gate, PD-021)
  const [forceCodBlocked, setForceCodBlocked] = useState(false)

  // Resolve display values
  const awbNo = localAwb ?? order.awbNo ?? null
  const labelUrl = localLabelUrl ?? order.labelUrl ?? null
  const courierId = order.shippingCourier ?? null
  const courierDef = courierById(courierId)
  // Prefer the friendly name persisted at checkout; fall back to hardcoded COURIERS lookup, then raw code
  const courierName = order.shippingCourierName ?? courierDef?.name ?? order.shippingCourier ?? null
  // Real courier logo from EP courier list (per-tenant module cache) — monogram fallback when absent
  const tenantId = typeof order.tenant === 'object' && order.tenant !== null ? order.tenant.id : order.tenant
  const courierLogos = useCourierLogos(tenantId)
  const courierLogoUrl = courierId ? courierLogos?.get(courierId) ?? null : null
  const epWallet = useEpWallet(tenantId)

  // Collection date and method are persisted by create-label and locked once the label exists.
  const collectionDisplay = (() => {
    if (!order.pickupScheduledAt) return null
    const d = new Date(order.pickupScheduledAt)
    const dm = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    const slot = order.pickupSlot === 'am' ? pk.slotMorning : order.pickupSlot === 'pm' ? pk.slotAfternoon : ''
    return slot ? `${dm} · ${slot}` : dm
  })()

  // ── Confirm order (pending → confirmed) ──────────────────────────────────
  const handleConfirmOrder = useCallback(async () => {
    setConfirming(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error?.message ?? 'Failed to confirm order')
      }
      toast.success(f.orderConfirmed)
      onUpdate()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : f.confirmFailed)
    } finally {
      setConfirming(false)
    }
  }, [order.id, onUpdate, f])

  const derived = forceCodBlocked ? 'cod-blocked' : forceMissing ? 'missing-data' : deriveFulfillState(order)
  // Optimistic success after create-label with a null AWB (async-AWB couriers): the stale
  // `order` prop has no easyParcelOrderNo yet, so derive still says 'ready' until refetch.
  const state = localCreated && derived === 'ready' ? 'success' : derived

  // ── Pending ───────────────────────────────────────────────────────────────
  if (state === 'pending') {
    const isCod = order.paymentMethod === 'cod' || (order.codAmount != null && order.codAmount > 0)
    const collectAmt = order.codAmount != null ? fmtMYR(order.codAmount / 100) : null
    const addr = order.shippingAddress
    const dest = [addr?.city, addr?.state].filter(Boolean).join(', ')

    return (
      <div className="action-zone">
        <div className="alert warning">
          <Clock className="lead" style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1 }} />
          <div className="a-body">
            <div className="a-t">{f.awaitingConfirmation}</div>
            {isCod ? f.codBodyConfirm : f.bodyConfirm}
          </div>
        </div>

        <div className="ship-meta">
          {isCod && collectAmt && (
            <div className="od-info">
              <span className="od-info-ic amber">
                <BanknoteIcon style={{ width: 16, height: 16 }} />
              </span>
              <div className="od-info-tx">
                <div className="od-info-l">{f.payment}</div>
                <div className="od-info-v amber">{ti(f.codCollect, { amount: collectAmt })}</div>
              </div>
            </div>
          )}
          {dest && (
            <div className="od-info">
              <span className="od-info-ic">
                <MapPin style={{ width: 16, height: 16 }} />
              </span>
              <div className="od-info-tx">
                <div className="od-info-l">{f.destination}</div>
                <div className="od-info-v">{dest}</div>
              </div>
            </div>
          )}
        </div>

        <div className="ship-foot">
          <div className="help">
            <Info style={{ width: 12, height: 12 }} />
            {f.confirmHint}
          </div>
          <button
            className="btn btn-grad ship-cta ship-cta-fixed"
            style={{ height: 40 }}
            onClick={handleConfirmOrder}
            disabled={confirming}
          >
            {confirming ? <span className="spin" /> : null}
            {f.confirmOrder}
          </button>
        </div>
      </div>
    )
  }

  // ── Cancelled / Refunded ──────────────────────────────────────────────────
  // Both collapse to the 'cancelled' fulfill-state (no shipping action left), but a
  // refunded order must NOT read as "cancelled" — swap the copy on the real status.
  if (state === 'cancelled') {
    const isRefunded = order.status === 'refunded'
    return (
      <div className="action-zone">
        <div className="alert error">
          <XCircle className="lead" style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1 }} />
          <div className="a-body">
            <div className="a-t">{isRefunded ? f.orderRefunded : f.orderCancelled}</div>
            {isRefunded
              ? f.refundedBody
              : order.cancelledAt
                ? ti(f.cancelledOn, { date: fmtDate(order.cancelledAt) })
                : f.cancelledFallback}
            {!isRefunded && order.cancelReason ? ti(f.cancelReason, { reason: order.cancelReason }) : ''}
          </div>
        </div>
      </div>
    )
  }

  // ── COD blocked ───────────────────────────────────────────────────────────
  if (state === 'cod-blocked') {
    const cl = t.dashboard.orders.createLabel
    return (
      <div className="action-zone">
        <button className="btn btn-grad btn-block ship-cta disabled" style={{ height: 40 }} disabled>
          {cl.readyToShip}
        </button>
        <div className="alert warning">
          <Info className="lead" style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1 }} />
          <div className="a-body">
            <div className="a-t">{f.codBlockedTitle}</div>
            {f.codBlockedBody}
          </div>
        </div>
        <CodRecovery orderId={order.id} onUpdate={onUpdate} />
      </div>
    )
  }

  // ── Missing data (no parcel weight) ───────────────────────────────────────
  if (state === 'missing-data') {
    const cl = t.dashboard.orders.createLabel
    return (
      <div className="action-zone">
        <button className="btn btn-grad btn-block ship-cta disabled" style={{ height: 40 }} disabled>
          {cl.readyToShip}
        </button>
        <MissingWeightForm
          orderId={order.id}
          shippingFee={order.shippingFee}
          onSuccess={(newAwb, newLabel) => {
            setLocalAwb(newAwb)
            setLocalLabelUrl(newLabel)
            setLocalCreated(true)
            setOptimisticTrackingEvent(optimisticShipmentCreatedEvent(newAwb))
            setForceMissing(false)
            // Wallet was charged for the label — invalidate the cached balance (parity with
            // the main CreateLabelFlow success path).
            invalidateEpShippingInfo(tenantId)
            ;(onLabelCreated ?? onUpdate)()
          }}
          onError={(code) => {
            // If EP returns a different error from the weight form, just surface it
            if (code !== 'MISSING_WEIGHT') toast.error('EasyParcel error: ' + code)
          }}
        />
      </div>
    )
  }

  // ── Self-delivery form ────────────────────────────────────────────────────
  if (state === 'self-delivery') {
    return (
      <SelfDeliveryZone
        orderId={order.id}
        selfDeliveryCourier={null}
        trackingNumber={null}
        onUpdate={onUpdate}
      />
    )
  }

  // ── Self-shipped (locked read-only) ───────────────────────────────────────
  if (state === 'self-shipped') {
    return (
      <SelfDeliveryZone
        orderId={order.id}
        selfDeliveryCourier={order.selfDeliveryCourier}
        trackingNumber={order.trackingNumber}
        onUpdate={onUpdate}
      />
    )
  }

  // ── Ready: EP label flow ──────────────────────────────────────────────────
  if (state === 'ready') {
    return (
      <>
        <CreateLabelFlow
          orderId={order.id}
          courierId={courierId}
          courierName={courierName}
          courierLogoUrl={courierLogoUrl}
          shippingFee={order.shippingFee}
          wallet={epWallet}
          onSuccess={(newAwb, newLabel) => {
            setLocalAwb(newAwb)
            setLocalLabelUrl(newLabel)
            setLocalCreated(true)
            setOptimisticTrackingEvent(optimisticShipmentCreatedEvent(newAwb))
            // Wallet was charged for the label — refetch balance on next read
            invalidateEpShippingInfo(tenantId)
            // Silent reconcile (no page reload): the success card is already shown
            // optimistically; an async AWB fills in via polling.
            ;(onLabelCreated ?? onUpdate)()
          }}
          onCodBlocked={() => setForceCodBlocked(true)}
        />
        {printOpen && (
          <PrintLabelModal
            orderId={order.id}
            awbNo={awbNo}
            labelUrl={labelUrl}
            labelUrls={order.labelUrls}
            courierId={courierId}
            courierName={courierName}
            onClose={() => setPrintOpen(false)}
          />
        )}
      </>
    )
  }

  // ── Success: label created, ready to ship ─────────────────────────────────
  if (state === 'success') {
    const events = mergeOptimisticTrackingEvent(order.shippingTrackingHistory, optimisticTrackingEvent)

    return (
      <>
        <div className="ship-result">
          <div className="alert success ship-banner">
            <CheckCircle2 className="lead" style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1 }} />
            <div className="a-body">
              <div className="a-t">{f.labelCreatedBanner}</div>
              {courierName
                ? ti(f.handToCourier, { courier: courierName })
                : f.handToCourierFallback}
            </div>
          </div>

          <div className="ship-track">
            <div className="st-row">
              <div className="st-field" style={{ gap: 6 }}>
                <div className="od-info-l">{f.courier}</div>
                <div className="st-courier">
                  <CourierLogo courierId={courierId} courierName={courierName} logoUrl={courierLogoUrl} size={22} />
                  {courierName ?? f.courier}
                </div>
              </div>

              {awbNo ? (
                <div className="st-field grow">
                  <div className="od-info-l">{f.trackingAwb}</div>
                  <div className="copyfield">
                    <span className="cf-v">{awbNo}</span>
                    <button
                      className="cf-btn"
                      onClick={() => { navigator.clipboard.writeText(awbNo); toast.success(f.copied) }}
                    >
                      <Copy style={{ width: 13, height: 13 }} /> {f.copy}
                    </button>
                  </div>
                </div>
              ) : (
                // Async-AWB couriers (e.g. Pos): shipment created + wallet charged, AWB
                // generated later and lands via webhook backfill (surfaced by polling —
                // no page reload). Spinner marks the AWB spot as actively loading; Print
                // unlocks once it arrives.
                <div className="st-field grow">
                  <div className="od-info-l">{f.trackingAwb}</div>
                  <div style={{ fontSize: 13, opacity: 0.75, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="spin" style={{ width: 13, height: 13, flexShrink: 0 }} /> {f.awbPending}
                  </div>
                </div>
              )}

              <div className="st-actions">
                <button
                  className="btn btn-primary"
                  style={{ backgroundColor: 'rgb(59, 130, 246)' }}
                  onClick={() => setPrintOpen(true)}
                  // PD-F13a: gate on awbNo, not labelUrl — PrintLabelModal never reads
                  // labelUrl, it probes /api/orders/[id]/label?format= off awbNo. A valid
                  // label state can have labelUrls populated but top-level labelUrl null,
                  // which would leave Print permanently disabled if gated on labelUrl.
                  disabled={!awbNo}
                >
                  <Printer style={{ width: 15, height: 15 }} /> {f.printLabel}
                </button>

                {/* US-F36-07: collection date is chosen before buying the label —
                    once the label exists it is locked (no post-label re-scheduling). */}
                {collectionDisplay && (
                  <div className="sched-locked">
                    <CalendarClock style={{ width: 15, height: 15 }} />{' '}
                    {ti(order.collectionMethod === 'dropoff' ? f.dropoffLocked : f.pickupLocked, {
                      label: collectionDisplay,
                    })}
                  </div>
                )}

                {/* Stamped by the print modal's "Mark as printed" (labelPrintedAt) */}
                {order.labelPrintedAt && (
                  <div className="printed-tag" title={fmtDate(order.labelPrintedAt)}>
                    <Printer /> {ti(f.printedAt, { date: fmtDate(order.labelPrintedAt) })}
                  </div>
                )}
              </div>

            </div>

            <TrackingTimeline events={events} collectionMethod={order.collectionMethod} />
          </div>

          {/* The manual "Mark shipment cancelled" button was removed from the UI (2026-07-13):
              EP now dispatches cancel webhooks and applyTrackingUpdate auto-reopens the order
              to 'confirmed'. The POST /api/orders/[id]/mark-shipment-cancelled route is kept
              as a manual/emergency fallback for the rare case a cancel webhook never arrives. */}
        </div>

        {printOpen && (
          <PrintLabelModal
            orderId={order.id}
            awbNo={awbNo}
            labelUrl={labelUrl}
            labelUrls={order.labelUrls}
            courierId={courierId}
            courierName={courierName}
            onClose={() => setPrintOpen(false)}
            onPrinted={onUpdate}
          />
        )}
      </>
    )
  }

  // ── Shipping / Completed: tracking timeline ───────────────────────────────
  if (state === 'shipping' || state === 'completed') {
    const isCompleted = state === 'completed'
    const events = order.shippingTrackingHistory ?? []

    return (
      <>
        <div className="ship-result">
          <div className={`alert ${isCompleted ? 'success' : 'info'} ship-banner`}>
            {isCompleted
              ? <BadgeCheck className="lead" style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1 }} />
              : <Truck className="lead" style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1 }} />}
            <div className="a-body">
              <div className="a-t">{isCompleted ? f.delivered : f.inTransit}</div>
              {isCompleted
                ? f.deliveredBody
                : courierName
                  ? ti(f.inTransitBody, { courier: courierName })
                  : f.inTransitBodyFallback}
            </div>
          </div>

          <div className="ship-track">
            <div className="st-row">
              <div className="st-field" style={{ gap: 6 }}>
                <div className="od-info-l">{f.courier}</div>
                <div className="st-courier">
                  <CourierLogo courierId={courierId} courierName={courierName} logoUrl={courierLogoUrl} size={22} />
                  {courierName ?? f.courier}
                </div>
              </div>

              {awbNo && (
                <div className="st-field grow">
                  <div className="od-info-l">{f.trackingAwb}</div>
                  <div className="copyfield">
                    <span className="cf-v">{awbNo}</span>
                    <button
                      className="cf-btn"
                      onClick={() => { navigator.clipboard.writeText(awbNo); toast.success(f.copied) }}
                    >
                      <Copy style={{ width: 13, height: 13 }} /> {f.copy}
                    </button>
                  </div>
                </div>
              )}

              <div className="st-actions">
                <button
                  className="btn btn-primary"
                  style={{ backgroundColor: 'rgb(59, 130, 246)' }}
                  onClick={() => setPrintOpen(true)}
                  // PD-F13a: see success-branch comment above — gate on awbNo, not labelUrl.
                  disabled={!awbNo}
                >
                  <Printer style={{ width: 15, height: 15 }} /> {f.printLabel}
                </button>
              </div>
            </div>

            {/* Tracking timeline */}
            <TrackingTimeline events={events} collectionMethod={order.collectionMethod} />
          </div>
        </div>

        {printOpen && (
          <PrintLabelModal
            orderId={order.id}
            awbNo={awbNo}
            labelUrl={labelUrl}
            labelUrls={order.labelUrls}
            courierId={courierId}
            courierName={courierName}
            onClose={() => setPrintOpen(false)}
          />
        )}
      </>
    )
  }

  // Fallback — should never reach here
  return null
}
