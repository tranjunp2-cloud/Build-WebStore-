"use client"

import React, { useState, useEffect } from 'react'
import { AlertTriangle, Info, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface CancelOrderModalProps {
    orderNumber: string
    isOpen: boolean
    isLoading: boolean
    /** Mobile-only contextual note. Desktop callers omit this to preserve their modal. */
    mobileCancelNote?: string
    onBack: () => void
    onConfirm: (reason: string) => void
}

export function CancelOrderModal({ orderNumber, isOpen, isLoading, mobileCancelNote, onBack, onConfirm }: CancelOrderModalProps) {
    const { t } = useI18n()
    const c = t.dashboard.orders.cancel
    const [reason, setReason] = useState('')
    const [touched, setTouched] = useState(false)

    // Reset form state whenever modal closes so stale errors don't persist on re-open
    useEffect(() => {
        if (!isOpen) {
            setReason('')
            setTouched(false)
        }
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
                // z-[110] keeps the modal above the orders drawer (backdrop z-[100], panel z-[101]).
                className="max-w-md rounded-xl flex flex-col items-center [&>button]:hidden z-[110]"
                overlayClassName="z-[110]"
                style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
            >
                {/* Icon Circle */}
                <div
                    className="flex items-center justify-center h-16 w-16 rounded-full mb-2"
                    style={{ background: 'hsl(var(--warning)/0.1)' }}
                >
                    <AlertTriangle size={26} strokeWidth={2.67} color="hsl(var(--warning))" />
                </div>

                {/* Heading */}
                <DialogTitle
                    className="w-full text-center truncate text-[20px] font-bold"
                    style={{ color: 'var(--dash-text)' }}
                >
                    {c.title} {orderNumber}
                </DialogTitle>

                {/* Paragraph */}
                <DialogDescription className="w-full text-center text-[14px]" style={{ color: 'var(--dash-text-muted)' }}>
                    {c.orderLabel} {orderNumber}
                </DialogDescription>

                {/* Warning — restock notice (TC-F10-03-10) */}
                <p className="w-full text-center text-[13px] mt-1 mb-2" style={{ color: 'hsl(var(--warning))' }}>
                    {c.warning}
                </p>

                {mobileCancelNote && (
                    <p className="flex w-full items-start gap-2 text-[13px] leading-5" style={{ color: 'var(--dash-text-muted)' }}>
                        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                        {mobileCancelNote}
                    </p>
                )}

                {/* Form Field */}
                <div className="flex flex-col w-full gap-2 mb-2">
                    <Label style={{ color: 'var(--dash-text)' }}>
                        {c.reasonLabel} *
                    </Label>
                    <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        onBlur={() => setTouched(true)}
                        placeholder={c.reasonPlaceholder}
                        disabled={isLoading}
                        maxLength={500}
                        className={`h-32 text-[16px] ${showError ? 'border-[hsl(var(--destructive))]' : ''}`}
                    />
                    <div className="flex justify-between items-center" style={{ minHeight: 16 }}>
                        {showError ? (
                            <span className="text-[12px]" style={{ color: 'hsl(var(--destructive))' }}>
                                {c.reasonRequired}
                            </span>
                        ) : <span />}
                        <span
                            title={c.reasonMaxLength}
                            aria-label={c.reasonMaxLength}
                            className="text-[12px]"
                            style={{ color: reason.length >= 450 ? 'hsl(var(--destructive))' : 'var(--dash-text-muted)' }}
                        >
                            {reason.length}/500
                        </span>
                    </div>
                </div>

                {/* Buttons Row */}
                <div className="flex w-full gap-3">
                    <Button
                        type="button"
                        variant="dashSecondary"
                        onClick={close}
                        disabled={isLoading}
                        className="flex-1 h-[50px] rounded-lg text-[16px]"
                    >
                        {c.back}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => onConfirm(reason)}
                        disabled={isDisabled}
                        className="flex-1 h-[50px] rounded-lg text-[16px]"
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                        {isLoading ? c.confirming : c.confirm}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
