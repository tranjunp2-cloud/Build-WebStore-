"use client"

import React, { useState } from 'react'
import { Info, CheckCircle2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { CancelOrderModal } from '../CancelOrderModal'
import { RefundDialog } from './refund-dialog'
import { xenditChannelLabel } from '@/lib/email/templates/shared/email-utils'
import { useI18n } from '@/i18n'
import './side.css'

// ── Terminal / pre-ship state logic ──────────────────────────────────────────
const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'refunded'])

// BR-Cancel-02 (chốt 2026-07-07): cancel chỉ trước khi mua label — pending/confirmed
// (+ tương đương Stripe: new/paid/processing). Đơn ready_to_ship trở đi KHÔNG hủy qua
// /cancel; tiền hàng + cước xử lý qua refund flow (US-F36-11 Phase D).
function isCancelAllowed(status: string): boolean {
    if (TERMINAL_STATUSES.has(status)) return false
    return ['pending', 'new', 'confirmed', 'paid', 'processing'].includes(status)
}

function isRefundAllowed(status: string): boolean {
    return ['shipped', 'completed'].includes(status)
}

// Show card for all statuses except cancelled/payment_failed (nothing actionable).
// refunded: shows disabled "Refunded" button so merchant has visibility.
function shouldShowCard(status: string): boolean {
    return !['cancelled', 'payment_failed'].includes(status)
}

function fmtPaymentMethod(
    method: string | null | undefined,
    labels: Record<string, string>,
    xenditChannelCode?: string | null,
): string {
    if (method === 'ewallet') return xenditChannelLabel(xenditChannelCode)
    return labels[method ?? ''] ?? method ?? '—'
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface OrderActionsCardOrder {
    id: string | number
    orderNumber: string
    status: string
    total: number
    currency: string
    paymentMethod: string
    xenditChannelCode?: string | null
    awbNo?: string | null
    shippingTrackingStatus?: string | null
}

export function OrderActionsCard({
    order,
    onUpdate,
}: {
    order: OrderActionsCardOrder
    onUpdate: () => void
}) {
    const { t, ti } = useI18n()
    const d = t.dashboard.orders.detail
    const r = t.dashboard.orders.refund
    const f = t.dashboard.orders.fulfillment

    const [isLoading, setIsLoading] = useState(false)
    const [cancelOpen, setCancelOpen] = useState(false)
    const [refundOpen, setRefundOpen] = useState(false)

    const { status, id, orderNumber, awbNo, total, currency, paymentMethod, xenditChannelCode } = order

    if (!shouldShowCard(status)) return null

    const canCancel = isCancelAllowed(status)
    const canRefund = isRefundAllowed(status)
    const isRefunded = status === 'refunded'

    // Pre-format for dialog and note
    const methodLabels = (d as any).paymentMethods as Record<string, string>
    const paymentMethodLabel = fmtPaymentMethod(paymentMethod, methodLabels, xenditChannelCode)
    const refundAmountFormatted = `${currency} ${total.toFixed(2)}`

    const handleRefundConfirm = async (reason: string) => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/orders/${id}/refund`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                console.error('Failed to refund order:', data.error)
                throw new Error('API_ERROR')
            }
            toast.success(t.dashboard.orders.toast.updated)
            setRefundOpen(false)
            onUpdate()
        } catch (err: unknown) {
            console.error('Refund order error:', err)
            toast.error(t.dashboard.orders.toast.updateFailed)
        } finally {
            setIsLoading(false)
        }
    }

    const handleCancel = async (reason: string) => {
        // BR-Cancel-02: cancel chỉ tồn tại trước khi mua label — không còn nhánh
        // "đơn có AWB" nào tới được đây, nên toast nhắc hủy AWB trên EP đã gỡ.
        setIsLoading(true)
        try {
            const res = await fetch(`/api/orders/${id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                console.error('Failed to cancel order:', data.error)
                throw new Error('API_ERROR')
            }
            toast.success(t.dashboard.orders.toast.updated)
            setCancelOpen(false)
            onUpdate()
        } catch (err: unknown) {
            console.error('Cancel order error:', err)
            toast.error(t.dashboard.orders.toast.updateFailed)
        } finally {
            setIsLoading(false)
        }
    }

    // Whether ANY actionable button shows (cancel / refund / refunded chip)
    const hasAction = canCancel || canRefund || isRefunded

    // Note copy: conditional per status. When no action is available (e.g. ready_to_ship
    // — label bought, courier not yet collected) the generic "cancelling a paid order…"
    // copy is misleading (there's no Cancel button), so show a state-specific note.
    const actionNote = isRefunded
        ? ti(r.noteRefunded, { amount: refundAmountFormatted })
        : canRefund
        ? r.noteCanRefund
        : canCancel
        ? d.orderActionsNote
        : d.orderActionsLocked

    return (
        <>
            <section className="od-card">
                <div className="od-cap">{d.orderActionsTitle}</div>

                {/* Actions row only when there's a button — an empty row leaves dead space.
                    2-col when cancel+refund both visible, 1-col otherwise. */}
                {hasAction && (
                <div className={`pay-actions${canCancel ? '' : ' single'}`}>
                    {canCancel && (
                        <button
                            className="btn-danger-soft"
                            disabled={isLoading}
                            onClick={() => setCancelOpen(true)}
                        >
                            {t.dashboard.orders.actions.cancelOrder}
                        </button>
                    )}
                    {/* Refund button: enabled (btn-refund-soft) or done (btn-outline disabled) */}
                    {isRefunded ? (
                        <button className="btn-outline" disabled>
                            <CheckCircle2 style={{ width: 15, height: 15 }} />
                            {r.refunded}
                        </button>
                    ) : canRefund ? (
                        <button
                            className="btn-refund-soft"
                            disabled={isLoading}
                            onClick={() => setRefundOpen(true)}
                        >
                            <RotateCcw style={{ width: 15, height: 15 }} />
                            {r.button}
                        </button>
                    ) : null}
                </div>
                )}

                <p className="od-action-note">
                    <Info style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
                    {actionNote}
                </p>
            </section>

            <CancelOrderModal
                orderNumber={orderNumber}
                isOpen={cancelOpen}
                isLoading={isLoading}
                onBack={() => setCancelOpen(false)}
                onConfirm={handleCancel}
            />

            <RefundDialog
                orderNumber={orderNumber}
                paymentMethodLabel={paymentMethodLabel}
                refundAmountFormatted={refundAmountFormatted}
                isOpen={refundOpen}
                isLoading={isLoading}
                onBack={() => setRefundOpen(false)}
                onConfirm={handleRefundConfirm}
            />
        </>
    )
}
