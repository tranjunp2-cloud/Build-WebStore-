'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'

interface RejectPaymentModalProps {
    orderId: string | number
    onSuccess: () => void
    onClose: () => void
}

type RejectionReason = 'image_blurry' | 'wrong_amount' | 'duplicate_order' | 'other'

export function RejectPaymentModal({ orderId, onSuccess, onClose }: RejectPaymentModalProps) {
    const { t } = useI18n()
    const rp = t.dashboard.orders.rejectPayment

    const REASONS: { value: RejectionReason; label: string }[] = [
        { value: 'image_blurry', label: rp.reasons.imageBlurry },
        { value: 'wrong_amount', label: rp.reasons.wrongAmount },
        { value: 'duplicate_order', label: rp.reasons.duplicateOrder },
        { value: 'other', label: rp.reasons.other },
    ]

    const [reason, setReason] = useState<RejectionReason>('image_blurry')
    const [detail, setDetail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [detailError, setDetailError] = useState('')
    const [mounted, setMounted] = useState(false)

    useEffect(() => { setMounted(true) }, [])

    if (!mounted) return null

    const validate = () => {
        if (reason === 'other' && detail.trim().length < 10) {
            setDetailError(rp.detailError)
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
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
                        {rp.title}
                    </span>
                    <button onClick={onClose} disabled={isLoading} className="hover:opacity-70 transition-opacity">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M5 5L15 15M15 5L5 15" stroke="var(--dash-text-muted)" strokeWidth="1.67" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {/* Reason label */}
                <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--dash-text-muted)', marginBottom: 12 }}>
                    {rp.reasonLabel}
                </p>

                {/* Reason radios */}
                <div className="flex flex-col gap-2 mb-4">
                    {REASONS.map(r => {
                        const isSelected = reason === r.value
                        return (
                            <button
                                key={r.value}
                                type="button"
                                disabled={isLoading}
                                onClick={() => { setReason(r.value); setDetailError('') }}
                                className="flex items-center gap-3 w-full text-left transition-all"
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    border: `1px solid ${isSelected ? 'hsl(var(--destructive)/0.4)' : 'hsl(var(--input-border))'}`,
                                    background: isSelected ? 'hsl(var(--destructive)/0.06)' : 'transparent',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <div
                                    className="flex shrink-0 items-center justify-center rounded-full transition-all"
                                    style={{
                                        width: 18, height: 18,
                                        border: `2px solid ${isSelected ? 'hsl(var(--destructive))' : 'var(--dash-text-muted)'}`,
                                    }}
                                >
                                    {isSelected && (
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'hsl(var(--destructive))' }} />
                                    )}
                                </div>
                                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--dash-text)' }}>
                                    {r.label}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Detail textarea — shown only for 'other' */}
                {reason === 'other' && (
                    <div className="flex flex-col gap-1 mb-4">
                        <label style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--dash-text)' }}>
                            {rp.detailLabel} *
                        </label>
                        <textarea
                            value={detail}
                            onChange={e => { setDetail(e.target.value); setDetailError('') }}
                            placeholder={rp.detailPlaceholder}
                            disabled={isLoading}
                            rows={3}
                            style={{
                                padding: '10px 14px',
                                background: 'var(--dash-secondary-bg)',
                                border: `1px solid ${detailError ? 'var(--dash-error)' : 'var(--dash-border)'}`,
                                borderRadius: 12,
                                fontFamily: 'Inter, sans-serif',
                                fontSize: 14,
                                color: 'var(--dash-text)',
                                resize: 'none',
                                outline: 'none',
                            }}
                        />
                        {detailError && (
                            <span style={{ fontSize: 12, color: 'var(--dash-error)' }}>{detailError}</span>
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
                        {rp.back}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                        style={{
                            height: 48,
                            borderRadius: 12,
                            background: 'hsl(var(--destructive))',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 15,
                            color: '#FFFFFF',
                            opacity: isLoading ? 0.5 : 1,
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isLoading ? rp.submitting : rp.submit}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
