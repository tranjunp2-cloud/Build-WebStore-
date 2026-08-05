"use client"

import React from 'react'
import { BadgeCheck, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CompleteOrderDialogProps {
    orderNumber: string
    isOpen: boolean
    isLoading: boolean
    onBack: () => void
    onConfirm: () => void
}

export function CompleteOrderDialog({
    orderNumber,
    isOpen,
    isLoading,
    onBack,
    onConfirm,
}: CompleteOrderDialogProps) {
    const { t, ti } = useI18n()
    const c = t.dashboard.orders.complete

    function close() {
        if (!isLoading) onBack()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
            <DialogContent
                className="max-w-md rounded-xl flex flex-col items-center [&>button]:hidden z-[110]"
                overlayClassName="z-[110]"
                style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
            >
                <div
                    className="cd-ico"
                    style={{ background: 'rgba(16, 185, 129, 0.14)', color: 'rgb(52, 211, 153)' }}
                >
                    <BadgeCheck size={26} />
                </div>

                <DialogTitle
                    className="w-full text-center text-[20px] font-bold"
                    style={{ color: 'var(--dash-text)' }}
                >
                    {ti(c.title, { orderNumber })}
                </DialogTitle>

                <DialogDescription
                    className="w-full text-center text-[14px]"
                    style={{ color: 'var(--dash-text-muted)' }}
                >
                    {c.description}
                </DialogDescription>

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
                        variant="dashPrimary"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="flex-1 h-[50px] rounded-lg text-[16px] gap-2"
                    >
                        {isLoading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <BadgeCheck className="w-4 h-4" />}
                        {c.confirm}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
