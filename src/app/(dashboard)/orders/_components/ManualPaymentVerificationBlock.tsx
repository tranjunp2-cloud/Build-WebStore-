'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { RejectPaymentModal } from './RejectPaymentModal'

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

export function ManualPaymentVerificationBlock({ order, onUpdate }: ManualPaymentVerificationBlockProps) {
    const [isApproving, setIsApproving] = useState(false)
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)

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
        background: 'rgba(30, 41, 59, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
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
        color: 'rgba(248, 250, 252, 0.6)',
    }

    const valueStyle: React.CSSProperties = {
        fontFamily: 'Inter, sans-serif',
        fontWeight: 400,
        fontSize: 14,
        color: '#F8FAFC',
    }

    if (order.paymentStatus === 'pending_verification') {
        return (
            <>
                <div style={cardStyle}>
                    <span style={labelStyle}>Payment Verification</span>

                    {/* Reference code */}
                    {order.paymentReference && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ ...labelStyle, fontSize: 11 }}>Reference Code</span>
                            <span
                                style={{
                                    fontFamily: 'monospace',
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: '#2DD4BF',
                                    background: 'rgba(45, 212, 191, 0.08)',
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ ...labelStyle, fontSize: 11 }}>Payment Receipt</span>
                        {proofUrl ? (
                            <img
                                src={proofUrl}
                                alt="Payment proof"
                                onClick={() => window.open(proofUrl, '_blank')}
                                style={{
                                    width: '100%',
                                    maxHeight: 200,
                                    objectFit: 'cover',
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                }}
                            />
                        ) : (
                            <div
                                style={{
                                    height: 80,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: 10,
                                    border: '1px solid rgba(255,255,255,0.08)',
                                }}
                            >
                                <span style={{ ...valueStyle, color: 'rgba(248,250,252,0.4)', fontSize: 12 }}>
                                    No receipt uploaded
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Amount + buyer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ ...labelStyle, fontSize: 11 }}>Amount Expected</span>
                            <span style={{ ...valueStyle, fontWeight: 700, color: '#2DD4BF', fontSize: 16 }}>
                                {formatCurrency(order.total, order.currency)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right' }}>
                            <span style={{ ...labelStyle, fontSize: 11 }}>Buyer</span>
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
                            background: isApproving
                                ? 'rgba(16, 185, 129, 0.4)'
                                : 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 15,
                            color: '#FFFFFF',
                            cursor: isApproving ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isApproving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isApproving ? 'Approving...' : 'Approve Payment'}
                    </button>

                    <button
                        onClick={() => setIsRejectModalOpen(true)}
                        disabled={isApproving}
                        className="flex items-center justify-center transition-opacity hover:opacity-80"
                        style={{
                            height: 48,
                            width: '100%',
                            borderRadius: 12,
                            border: '1px solid rgba(251, 44, 54, 0.4)',
                            background: 'transparent',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 15,
                            color: '#FF6467',
                            cursor: isApproving ? 'not-allowed' : 'pointer',
                            opacity: isApproving ? 0.4 : 1,
                        }}
                    >
                        Reject Payment
                    </button>
                </div>

                {isRejectModalOpen && (
                    <RejectPaymentModal
                        orderId={order.id}
                        onSuccess={() => { setIsRejectModalOpen(false); onUpdate() }}
                        onClose={() => setIsRejectModalOpen(false)}
                    />
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
                <span style={labelStyle}>Payment Verification</span>

                {/* Green badge */}
                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 8,
                        alignSelf: 'flex-start',
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6.666" stroke="#10B981" strokeWidth="1.33" />
                        <path d="M5.333 8L7.333 10L11.333 5.333" stroke="#10B981" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: '#10B981' }}>
                        Payment Verified
                    </span>
                </div>

                {verifiedDate && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ ...labelStyle, fontSize: 11 }}>Verified At</span>
                        <span style={valueStyle}>{verifiedDate}</span>
                    </div>
                )}

                {verifierEmail && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ ...labelStyle, fontSize: 11 }}>Verified By</span>
                        <span style={valueStyle}>{verifierEmail}</span>
                    </div>
                )}
            </div>
        )
    }

    return null
}
