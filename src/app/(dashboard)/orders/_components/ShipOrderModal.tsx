'use client'

import React, { useState } from 'react'
import { Package, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ShipOrderModalProps {
    orderNumber: string
    isOpen: boolean
    isLoading: boolean
    onBack: () => void
    onConfirm: (trackingNumber: string) => void
}

export function ShipOrderModal({ orderNumber, isOpen, isLoading, onBack, onConfirm }: ShipOrderModalProps) {
    const { t } = useI18n()
    const s = t.dashboard.orders.ship
    const [trackingNumber, setTrackingNumber] = useState('')

    const isDisabled = trackingNumber.trim() === '' || isLoading

    function close() {
        if (isLoading) return
        setTrackingNumber('')
        onBack()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(v) => { if (!v) close() }}>
            <DialogContent
                className="max-w-md rounded-xl flex flex-col items-center [&>button]:hidden"
                // No separate description: the labeled tracking-number input is self-describing.
                // Tell Radix it's intentional so it doesn't log the missing-Description warning.
                aria-describedby={undefined}
                style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
            >
                {/* Icon */}
                <div
                    className="flex items-center justify-center h-16 w-16 rounded-full mb-2"
                    style={{ background: 'hsl(var(--primary)/0.1)' }}
                >
                    <Package size={26} strokeWidth={2.67} color="hsl(var(--primary))" />
                </div>

                {/* Heading */}
                <DialogTitle
                    className="w-full text-center truncate text-[20px] font-bold"
                    style={{ color: 'var(--dash-text)' }}
                >
                    {s.title} — {orderNumber}
                </DialogTitle>

                {/* Tracking input */}
                <div className="flex flex-col w-full gap-2 mt-2 mb-2">
                    <Label htmlFor="ship-tracking-input" style={{ color: 'var(--dash-text)' }}>
                        {s.trackingLabel} *
                    </Label>
                    <Input
                        id="ship-tracking-input"
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder={s.trackingPlaceholder}
                        disabled={isLoading}
                        autoFocus
                    />
                </div>

                {/* Buttons */}
                <div className="flex w-full gap-3">
                    <Button
                        type="button"
                        variant="dashSecondary"
                        onClick={close}
                        disabled={isLoading}
                        className="flex-1 h-[50px] rounded-lg text-[16px]"
                    >
                        {s.back}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => onConfirm(trackingNumber.trim())}
                        disabled={isDisabled}
                        className="flex-1 h-[50px] rounded-lg text-[16px]"
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isLoading ? s.confirming : s.confirm}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
