"use client"

import React, { useState, useEffect } from 'react'
import { ZoomIn, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { xenditChannelLabel } from '@/lib/email/templates/shared/email-utils'
import { useI18n } from '@/i18n'
import './side.css'

// ── Icon helpers ──────────────────────────────────────────────────────────────
const IconCreditCard = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.33" y="3.33" width="13.33" height="9.33" rx="1.33" stroke="hsl(var(--info))" strokeWidth="1.33" />
        <path d="M1.33 6.67h13.33" stroke="hsl(var(--info))" strokeWidth="1.33" />
    </svg>
)

const IconCheckCircle = ({ color }: { color: string }) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="6.666" stroke={color} strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.333 8L7.333 10L11.333 5.333" stroke={color} strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

const IconXCircle = ({ color }: { color: string }) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="6.666" stroke={color} strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 6L10 10M10 6L6 10" stroke={color} strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

const IconWarning = ({ color }: { color: string }) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="6.666" stroke={color} strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.333 8L7.333 10L11.333 5.333" stroke={color} strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

// ── Format helpers (reuse logic from OrderDetailPanel) ────────────────────────
function fmtPaymentMethod(
    method: string | null | undefined,
    labels: Record<string, string>,
    xenditChannelCode?: string | null,
): string {
    if (method === 'ewallet') return xenditChannelLabel(xenditChannelCode)
    return labels[method ?? ''] ?? method ?? '—'
}

function fmtPaymentStatus(
    status: string | null | undefined,
    labels: Record<string, string>,
): string {
    return labels[status ?? ''] ?? status ?? '—'
}

// ── Status color derivation (mirrors PaymentInformation logic) ────────────────
type StatusTheme = { color: string; bg: string; IconComp: React.FC }

function resolveStatusTheme(orderStatus: string, paymentStatus: string): StatusTheme {
    const paid = ['ready_to_ship', 'shipped', 'completed'].includes(orderStatus) ||
        paymentStatus?.toLowerCase() === 'paid'
    const cancelled = ['cancelled', 'refunded'].includes(orderStatus)

    if (paid) {
        const c = 'hsl(var(--success))'
        return {
            color: c,
            bg: 'hsl(var(--success)/0.1)',
            IconComp: () => <IconCheckCircle color={c} />,
        }
    }
    if (cancelled) {
        const c = 'hsl(var(--destructive))'
        return {
            color: c,
            bg: 'hsl(var(--destructive)/0.1)',
            IconComp: () => <IconXCircle color={c} />,
        }
    }
    const c = 'hsl(var(--warning))'
    return {
        color: c,
        bg: 'hsl(var(--warning)/0.1)',
        IconComp: () => <IconWarning color={c} />,
    }
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface PaymentCardOrder {
    status: string
    paymentMethod: string
    paymentStatus: string
    xenditChannelCode?: string | null
    paymentProofImage?: string | { url?: string } | null
}

export function PaymentCard({ order }: { order: PaymentCardOrder }) {
    const { t } = useI18n()
    const d = t.dashboard.orders.detail
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- i18n nested labels not typed
    const methodLabels = (d as any).paymentMethods as Record<string, string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusLabels = (d as any).paymentStatuses as Record<string, string>

    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [proofHovered, setProofHovered] = useState(false)

    useEffect(() => {
        if (!lightboxOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLightboxOpen(false)
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [lightboxOpen])

    const proofUrl = order.paymentProofImage
        ? typeof order.paymentProofImage === 'string'
            ? order.paymentProofImage
            : order.paymentProofImage?.url || ''
        : null

    const theme = resolveStatusTheme(order.status, order.paymentStatus)

    return (
        <section className="od-card">
            <div className="od-cap">{d.paymentInfoTitle}</div>

            {/* Method row */}
            <div className="od-info">
                <span className="od-info-ic">
                    <IconCreditCard />
                </span>
                <div className="od-info-tx">
                    <div className="od-info-l">{d.method}</div>
                    <div className="od-info-v">
                        {fmtPaymentMethod(order.paymentMethod, methodLabels, order.xenditChannelCode)}
                    </div>
                </div>
            </div>

            {/* Status row */}
            <div className="od-info">
                <span
                    className="od-info-ic"
                    style={{ background: theme.bg, color: theme.color }}
                >
                    <theme.IconComp />
                </span>
                <div className="od-info-tx">
                    <div className="od-info-l">{d.paymentStatus}</div>
                    <div className="od-info-v" style={{ color: theme.color, fontWeight: 600 }}>
                        {fmtPaymentStatus(order.paymentStatus, statusLabels)}
                    </div>
                </div>
            </div>

            {/* Payment proof lightbox — only for bank_transfer */}
            {order.paymentMethod === 'bank_transfer' && (
                <>
                    <div
                        className="side-proof-thumb"
                        onClick={() => { if (proofUrl) { setProofHovered(false); setLightboxOpen(true) } }}
                        onMouseEnter={() => setProofHovered(true)}
                        onMouseLeave={() => setProofHovered(false)}
                        style={{ cursor: proofUrl ? 'pointer' : 'default' }}
                    >
                        {proofUrl ? (
                            <>
                                <Image src={proofUrl} alt="Payment Receipt" fill className="object-cover" />
                                <div
                                    className="side-proof-overlay"
                                    style={{ opacity: proofHovered ? 1 : 0 }}
                                >
                                    <ZoomIn size={24} color="#fff" />
                                </div>
                            </>
                        ) : (
                            <div className="side-proof-empty">{d.noReceipt}</div>
                        )}
                    </div>

                    {lightboxOpen && proofUrl && createPortal(
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-label="Payment proof full view"
                            onClick={() => setLightboxOpen(false)}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 9999,
                                background: 'rgba(0,0,0,0.9)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <button
                                aria-label="Close"
                                onClick={() => setLightboxOpen(false)}
                                style={{
                                    position: 'absolute',
                                    top: 16,
                                    right: 16,
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: 8,
                                    cursor: 'pointer',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <X size={20} />
                            </button>
                            <img
                                src={proofUrl}
                                alt="Payment proof full view"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    maxWidth: '90vw',
                                    maxHeight: '90vh',
                                    objectFit: 'contain',
                                    borderRadius: 12,
                                }}
                            />
                        </div>,
                        document.body,
                    )}
                </>
            )}
        </section>
    )
}
