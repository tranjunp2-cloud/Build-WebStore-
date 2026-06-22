'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X, ZoomIn } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { RejectPaymentModal } from './RejectPaymentModal'

function ProofLightbox({ url, onClose }: { url: string; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    return createPortal(
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            <button
                onClick={onClose}
                style={{
                    position: 'absolute', top: 16, right: 16,
                    background: 'rgba(255,255,255,0.1)', border: 'none',
                    borderRadius: 8, padding: 8, cursor: 'pointer', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
            >
                <X size={20} />
            </button>
            <img
                src={url}
                alt="Payment proof full view"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }}
            />
        </div>,
        document.body
    )
}

interface ManualPaymentVerificationBlockProps {
    order: {
        id: string | number
        paymentReference?: string
        paymentRejectionReason?: string
        paymentStatus: string
        paymentMethod: string
        total: number
        currency: string
        customerName: string
        paymentProofImage?: string | { url?: string } | null
        paymentVerifiedAt?: string
        paymentVerifiedBy?: string | { id: string; email?: string } | null
    }
    onUpdate: () => void
}

function formatCurrency(amount: number, currency: string): string {
    return currency === 'MYR' ? `RM ${amount.toFixed(2)}` : `${currency} ${amount.toFixed(2)}`
}

function getProofUrl(img: string | { url?: string } | null | undefined): string | null {
    if (!img) return null
    if (typeof img === 'string') return img
    return img.url ?? null
}

function ProofImageThumbnail({ url, onOpen, labelStyle, label }: { url: string; onOpen: () => void; labelStyle: React.CSSProperties; label: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...labelStyle, fontSize: 11 }}>{label}</span>
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={onOpen}>
                <img
                    src={url}
                    alt="Payment proof"
                    style={{
                        width: '100%',
                        maxHeight: 200,
                        objectFit: 'cover',
                        borderRadius: 10,
                        border: '1px solid var(--dash-border)',
                        display: 'block',
                    }}
                />
                <div
                    style={{
                        position: 'absolute', inset: 0, borderRadius: 10,
                        background: 'rgba(0,0,0,0)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.35)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0)' }}
                >
                    <ZoomIn size={28} color="#fff" style={{ opacity: 0.9 }} />
                </div>
            </div>
        </div>
    )
}

export function ManualPaymentVerificationBlock({ order, onUpdate }: ManualPaymentVerificationBlockProps) {
    const { t } = useI18n()
    const pv = t.dashboard.orders.paymentVerification
    const [isApproving, setIsApproving] = useState(false)
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
    const [lightboxOpen, setLightboxOpen] = useState(false)

    const proofUrl = getProofUrl(order.paymentProofImage)

    const handleApprove = async () => {
        setIsApproving(true)
        try {
            const res = await fetch(`/api/orders/${order.id}/approve-payment`, { method: 'PATCH' })
            if (!res.ok) {
                const body = await res.json()
                throw new Error(body?.error?.message ?? 'Approval failed')
            }
            toast.success('Payment approved')
            onUpdate()
        } catch (err: any) {
            console.error('[ManualPaymentVerificationBlock] approve', err)
            toast.error(err.message ?? 'Failed to approve payment')
        } finally {
            setIsApproving(false)
        }
    }

    const cardStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--dash-surface)',
        border: '1px solid var(--dash-border)',
        borderRadius: 16,
        padding: 17,
        gap: 12,
    }

    const labelStyle: React.CSSProperties = {
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontSize: 12,
        letterSpacing: '0.025em',
        textTransform: 'uppercase',
        color: 'var(--dash-text-muted)',
    }

    const valueStyle: React.CSSProperties = {
        fontFamily: 'Inter, sans-serif',
        fontWeight: 400,
        fontSize: 14,
        color: 'var(--dash-text)',
    }

    if (order.paymentStatus === 'pending_verification') {
        return (
            <>
                <div style={cardStyle}>
                    <span style={labelStyle}>{pv.title}</span>

                    {/* Reference code */}
                    {order.paymentReference && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ ...labelStyle, fontSize: 11 }}>{pv.referenceCode}</span>
                            <span
                                style={{
                                    fontFamily: 'monospace',
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: 'hsl(var(--primary))',
                                    background: 'hsl(var(--primary)/0.08)',
                                    borderRadius: 8,
                                    padding: '6px 12px',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                {order.paymentReference}
                            </span>
                        </div>
                    )}

                    {/* Proof image */}
                    {proofUrl ? (
                        <ProofImageThumbnail url={proofUrl} onOpen={() => setLightboxOpen(true)} labelStyle={labelStyle} label={pv.paymentReceipt} />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ ...labelStyle, fontSize: 11 }}>{pv.paymentReceipt}</span>
                            <div style={{
                                height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'var(--dash-secondary-bg)', borderRadius: 10,
                                border: '1px solid var(--dash-border)',
                            }}>
                                <span style={{ ...valueStyle, color: 'var(--dash-text-muted)', fontSize: 12 }}>
                                    {pv.noReceipt}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Amount + buyer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ ...labelStyle, fontSize: 11 }}>{pv.amountExpected}</span>
                            <span style={{ ...valueStyle, fontWeight: 700, color: 'hsl(var(--primary))', fontSize: 16 }}>
                                {formatCurrency(order.total, order.currency)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right' }}>
                            <span style={{ ...labelStyle, fontSize: 11 }}>{pv.buyer}</span>
                            <span style={valueStyle}>{order.customerName}</span>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <button
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                        style={{
                            height: 48,
                            width: '100%',
                            borderRadius: 12,
                            background: 'linear-gradient(90deg,#3b82f6 0%,#2dd4bf 100%)',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 15,
                            color: '#FFFFFF',
                            opacity: isApproving ? 0.5 : 1,
                            cursor: isApproving ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isApproving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isApproving ? pv.approving : pv.approve}
                    </button>

                    <button
                        onClick={() => setIsRejectModalOpen(true)}
                        disabled={isApproving}
                        className="flex items-center justify-center transition-opacity hover:opacity-80"
                        style={{
                            height: 48,
                            width: '100%',
                            borderRadius: 12,
                            border: '1px solid hsl(var(--destructive)/0.4)',
                            background: 'transparent',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 15,
                            color: 'hsl(var(--destructive))',
                            cursor: isApproving ? 'not-allowed' : 'pointer',
                            opacity: isApproving ? 0.4 : 1,
                        }}
                    >
                        {pv.reject}
                    </button>
                </div>

                {isRejectModalOpen && (
                    <RejectPaymentModal
                        orderId={order.id}
                        onSuccess={() => { setIsRejectModalOpen(false); onUpdate() }}
                        onClose={() => setIsRejectModalOpen(false)}
                    />
                )}

                {lightboxOpen && proofUrl && (
                    <ProofLightbox url={proofUrl} onClose={() => setLightboxOpen(false)} />
                )}
            </>
        )
    }

    if (order.paymentStatus === 'paid') {
        const verifierEmail =
            order.paymentVerifiedBy && typeof order.paymentVerifiedBy === 'object'
                ? order.paymentVerifiedBy.email
                : null

        const verifiedDate = order.paymentVerifiedAt
            ? new Date(order.paymentVerifiedAt).toLocaleString()
            : null

        return (
            <div style={cardStyle}>
                <span style={labelStyle}>{pv.title}</span>

                {/* Green badge */}
                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        background: 'hsl(var(--success)/0.1)',
                        border: '1px solid hsl(var(--success)/0.3)',
                        borderRadius: 8,
                        alignSelf: 'flex-start',
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6.666" stroke="hsl(var(--success))" strokeWidth="1.33" />
                        <path d="M5.333 8L7.333 10L11.333 5.333" stroke="hsl(var(--success))" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: 'hsl(var(--success))' }}>
                        {pv.verified}
                    </span>
                </div>

                {verifiedDate && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ ...labelStyle, fontSize: 11 }}>{pv.verifiedAt}</span>
                        <span style={valueStyle}>{verifiedDate}</span>
                    </div>
                )}

                {verifierEmail && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ ...labelStyle, fontSize: 11 }}>{pv.verifiedBy}</span>
                        <span style={valueStyle}>{verifierEmail}</span>
                    </div>
                )}

                {proofUrl && <ProofImageThumbnail url={proofUrl} onOpen={() => setLightboxOpen(true)} labelStyle={labelStyle} label={pv.paymentReceipt} />}

                {lightboxOpen && proofUrl && (
                    <ProofLightbox url={proofUrl} onClose={() => setLightboxOpen(false)} />
                )}
            </div>
        )
    }

    // Other statuses (awaiting_payment, cancelled, refunded…) — show proof if uploaded
    if (proofUrl) {
        return (
            <div style={cardStyle}>
                <span style={labelStyle}>{pv.title}</span>
                <ProofImageThumbnail url={proofUrl} onOpen={() => setLightboxOpen(true)} labelStyle={labelStyle} label={pv.paymentReceipt} />
                {lightboxOpen && (
                    <ProofLightbox url={proofUrl} onClose={() => setLightboxOpen(false)} />
                )}
            </div>
        )
    }

    return null
}
