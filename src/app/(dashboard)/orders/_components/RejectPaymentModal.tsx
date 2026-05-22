'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface RejectPaymentModalProps {
    orderId: string | number
    onSuccess: () => void
    onClose: () => void
}

type RejectionReason = 'image_blurry' | 'wrong_amount' | 'duplicate_order' | 'other'

const REASONS: { value: RejectionReason; label: string }[] = [
    { value: 'image_blurry', label: 'Ảnh mờ — Receipt unclear' },
    { value: 'wrong_amount', label: 'Sai số tiền — Wrong amount' },
    { value: 'duplicate_order', label: 'Trùng đơn — Duplicate order' },
    { value: 'other', label: 'Khác — Other reason' },
]

export function RejectPaymentModal({ orderId, onSuccess, onClose }: RejectPaymentModalProps) {
    const [reason, setReason] = useState<RejectionReason>('image_blurry')
    const [detail, setDetail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [detailError, setDetailError] = useState('')
    const [mounted, setMounted] = useState(false)

    useEffect(() => { setMounted(true) }, [])

    if (!mounted) return null

    const validate = () => {
        if (reason === 'other' && detail.trim().length < 10) {
            setDetailError('Detail must be at least 10 characters')
            return false
        }
        setDetailError('')
        return true
    }

    const handleSubmit = async () => {
        if (!validate()) return
        setIsLoading(true)
        try {
            const res = await fetch(`/api/orders/${orderId}/reject-payment`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, detail: reason === 'other' ? detail : undefined }),
            })
            if (!res.ok) {
                const body = await res.json()
                throw new Error(body?.error?.message ?? 'Rejection failed')
            }
            toast.success('Payment rejected')
            onSuccess()
        } catch (err: any) {
            console.error('[RejectPaymentModal]', err)
            toast.error(err.message ?? 'Failed to reject payment')
        } finally {
            setIsLoading(false)
        }
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.7)' }}
        >
            <div
                className="flex flex-col w-full max-w-md"
                style={{
                    background: 'var(--dash-surface)',
                    border: '1px solid var(--dash-border)',
                    borderRadius: 16,
                    padding: 24,
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--dash-text)' }}>
                        Reject Payment
                    </span>
                    <button onClick={onClose} disabled={isLoading} className="hover:opacity-70 transition-opacity">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M5 5L15 15M15 5L5 15" stroke="var(--dash-text-muted)" strokeWidth="1.67" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {/* Reason radios */}
                <div className="flex flex-col gap-3 mb-4">
                    {REASONS.map(r => (
                        <label
                            key={r.value}
                            className="flex items-center gap-3 cursor-pointer"
                            style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--dash-text)' }}
                        >
                            <input
                                type="radio"
                                name="rejection-reason"
                                value={r.value}
                                checked={reason === r.value}
                                onChange={() => { setReason(r.value); setDetailError('') }}
                                disabled={isLoading}
                                className="accent-red-500"
                            />
                            {r.label}
                        </label>
                    ))}
                </div>

                {/* Detail textarea — shown only for 'other' */}
                {reason === 'other' && (
                    <div className="flex flex-col gap-1 mb-4">
                        <label style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--dash-text)' }}>
                            Details *
                        </label>
                        <textarea
                            value={detail}
                            onChange={e => { setDetail(e.target.value); setDetailError('') }}
                            placeholder="Describe the issue (min 10 characters)..."
                            disabled={isLoading}
                            rows={3}
                            style={{
                                padding: '10px 14px',
                                background: 'var(--dash-secondary-bg)',
                                border: `1px solid ${detailError ? '#FB2C36' : 'var(--dash-border)'}`,
                                borderRadius: 12,
                                fontFamily: 'Inter, sans-serif',
                                fontSize: 14,
                                color: 'var(--dash-text)',
                                resize: 'none',
                                outline: 'none',
                            }}
                        />
                        {detailError && (
                            <span style={{ fontSize: 12, color: '#FB2C36' }}>{detailError}</span>
                        )}
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center transition-opacity hover:opacity-80"
                        style={{
                            height: 48,
                            borderRadius: 12,
                            border: '1px solid var(--dash-border)',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 15,
                            color: 'var(--dash-text)',
                            opacity: isLoading ? 0.5 : 1,
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                        style={{
                            height: 48,
                            borderRadius: 12,
                            background: isLoading ? 'rgba(251, 44, 54, 0.5)' : 'rgba(251, 44, 54, 1)',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 15,
                            color: '#FFFFFF',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isLoading ? 'Rejecting...' : 'Reject Payment'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
