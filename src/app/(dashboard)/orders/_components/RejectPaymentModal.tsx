'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

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

    return (
        <Dialog open onOpenChange={(v) => { if (!v && !isLoading) onClose() }}>
            <DialogContent
                className="max-w-md rounded-xl"
                // No separate description: the labeled reason radios are self-describing.
                // Tell Radix it's intentional so it doesn't log the missing-Description warning.
                aria-describedby={undefined}
                style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
            >
                {/* Header */}
                <DialogTitle className="text-[18px] font-bold" style={{ color: 'var(--dash-text)' }}>
                    {rp.title}
                </DialogTitle>

                {/* Reason label */}
                <p className="text-[13px] font-semibold -mb-1" style={{ color: 'var(--dash-text-muted)' }}>
                    {rp.reasonLabel}
                </p>

                {/* Reason radios */}
                <div className="flex flex-col gap-2">
                    {REASONS.map(r => {
                        const isSelected = reason === r.value
                        return (
                            <button
                                key={r.value}
                                type="button"
                                disabled={isLoading}
                                onClick={() => { setReason(r.value); setDetailError('') }}
                                className="flex items-center gap-3 w-full text-left transition-all rounded-lg"
                                style={{
                                    padding: '10px 14px',
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
                                <span className="text-[14px]" style={{ color: 'var(--dash-text)' }}>
                                    {r.label}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Detail textarea — shown only for 'other' */}
                {reason === 'other' && (
                    <div className="flex flex-col gap-1">
                        <Label style={{ color: 'var(--dash-text)' }}>
                            {rp.detailLabel} *
                        </Label>
                        <Textarea
                            value={detail}
                            onChange={e => { setDetail(e.target.value); setDetailError('') }}
                            placeholder={rp.detailPlaceholder}
                            disabled={isLoading}
                            rows={3}
                            className={detailError ? 'border-[hsl(var(--destructive))]' : ''}
                        />
                        {detailError && (
                            <span className="text-[12px]" style={{ color: 'hsl(var(--destructive))' }}>{detailError}</span>
                        )}
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                    <Button
                        type="button"
                        variant="dashSecondary"
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 h-12 rounded-lg text-[15px]"
                    >
                        {rp.back}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="flex-1 h-12 rounded-lg text-[15px]"
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isLoading ? rp.submitting : rp.submit}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
