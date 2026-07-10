"use client"

import React, { useState, useEffect } from 'react'
import { RotateCcw, CreditCard, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import './side.css'

interface RefundDialogProps {
    orderNumber: string
    paymentMethodLabel: string
    refundAmountFormatted: string
    isOpen: boolean
    isLoading: boolean
    onBack: () => void
    onConfirm: (reason: string) => void
}

export function RefundDialog({
    orderNumber,
    paymentMethodLabel,
    refundAmountFormatted,
    isOpen,
    isLoading,
    onBack,
    onConfirm,
}: RefundDialogProps) {
    const { t, ti } = useI18n()
    const r = t.dashboard.orders.refund
    const [reason, setReason] = useState('')
    const [touched, setTouched] = useState(false)

    // Reset form when dialog closes
    useEffect(() => {
        if (!isOpen) { setReason(''); setTouched(false) }
    }, [isOpen])

    const isEmpty = reason.trim() === ''
    const showError = touched && isEmpty
    const isDisabled = isEmpty || isLoading

    function close() {
        if (isLoading) return
        setReason('')
        onBack()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(v) => { if (!v) close() }}>
            <DialogContent
                className="max-w-md rounded-xl flex flex-col items-center [&>button]:hidden z-[110]"
                overlayClassName="z-[110]"
                style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
            >
                {/* Icon circle */}
                <div className="cd-ico refund">
                    <RotateCcw size={26} />
                </div>

                {/* Title */}
                <DialogTitle
                    className="w-full text-center text-[20px] font-bold"
                    style={{ color: 'var(--dash-text)' }}
                >
                    {r.title} #{orderNumber}
                </DialogTitle>

                {/* Subtitle */}
                <DialogDescription
                    className="w-full text-center text-[14px]"
                    style={{ color: 'var(--dash-text-muted)' }}
                >
                    {r.sub}
                </DialogDescription>

                {/* Refund review block — full-total (no shipping deduction row) */}
                <div className="cd-review">
                    <div className="cdr-row">
                        <span className="cdr-k">
                            <CreditCard style={{ width: 14, height: 14 }} /> {r.refundTo}
                        </span>
                        <span className="cdr-v">{paymentMethodLabel}</span>
                    </div>
                    <div className="cdr-row cdr-total">
                        <span className="cdr-k">{r.amount}</span>
                        <span className="cdr-v">{refundAmountFormatted}</span>
                    </div>
                </div>

                {/* Reason field */}
                <div className="flex flex-col w-full gap-2 mb-2">
                    <Label style={{ color: 'var(--dash-text)' }}>
                        {r.reasonLabel} *
                    </Label>
                    <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        onBlur={() => setTouched(true)}
                        placeholder={r.reasonPlaceholder}
                        disabled={isLoading}
                        maxLength={500}
                        className={`h-28 text-[16px] ${showError ? 'border-[hsl(var(--destructive))]' : ''}`}
                    />
                    {showError && (
                        <span className="text-[12px]" style={{ color: 'hsl(var(--destructive))' }}>
                            {r.reasonRequired}
                        </span>
                    )}
                </div>

                {/* Footer buttons */}
                <div className="flex w-full gap-3">
                    <Button
                        type="button"
                        variant="dashSecondary"
                        onClick={close}
                        disabled={isLoading}
                        className="flex-1 h-[50px] rounded-lg text-[16px]"
                    >
                        {r.back}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => onConfirm(reason)}
                        disabled={isDisabled}
                        className="flex-1 h-[50px] rounded-lg text-[16px] gap-2"
                        style={{ background: 'rgb(59,130,246)', color: '#fff' }}
                    >
                        {isLoading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <RotateCcw className="w-4 h-4" />}
                        {ti(r.confirm, { amount: refundAmountFormatted })}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
