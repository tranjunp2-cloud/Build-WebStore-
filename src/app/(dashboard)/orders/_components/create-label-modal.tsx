'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface CreateLabelModalProps {
    order: {
        id: string | number
        shippingCourier?: string | null
        parcelWeight?: number | null  // grams
        shippingFee?: number          // RM — quoted at checkout
        codAmountSen?: number | null  // sen integer from DB; > 0 = COD order
    }
    isOpen: boolean
    onClose: () => void
    onSuccess: (awbNo: string, labelUrl: string | null) => void
}

type Step = 'idle' | 'submitting' | 'paying' | 'error'

const S = {
    input: {
        background: 'var(--dash-surface)',
        border: '1px solid var(--dash-border)',
        borderRadius: 8,
        height: 40,
        padding: '8px 12px',
        color: 'var(--dash-text)',
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        outline: 'none',
        width: '100%',
    } as React.CSSProperties,
    label: { fontSize: 12, color: 'var(--dash-text-muted)', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
    infoCard: {
        background: 'rgba(59,130,246,0.07)',
        border: '1px solid rgba(59,130,246,0.15)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 13,
        color: 'var(--dash-text-muted)',
        fontFamily: 'Inter, sans-serif',
    } as React.CSSProperties,
    fieldGroup: { display: 'flex', flexDirection: 'column', gap: 4 } as React.CSSProperties,
}

export function CreateLabelModal({ order, isOpen, onClose, onSuccess }: CreateLabelModalProps) {
    const [step, setStep] = useState<Step>('idle')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [weightGrams, setWeightGrams] = useState<number>(order.parcelWeight ?? 500)
    const [collectionDate, setCollectionDate] = useState<string>(() => new Date().toISOString().split('T')[0])
    const todayStr = new Date().toISOString().split('T')[0]
    const codAmountSen = order.codAmountSen ?? 0

    const handleOpenChange = (open: boolean) => {
        if (!open) { setStep('idle'); setErrorMsg(null); onClose() }
    }

    const handleBuyLabel = async () => {
        setStep('submitting')
        setErrorMsg(null)
        try {
            const res = await fetch(`/api/orders/${order.id}/create-label`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parcelWeightGrams: weightGrams,
                    collectionDate,
                    ...(codAmountSen > 0 ? { codAmountRm: codAmountSen / 100 } : {}),
                }),
            })
            if (res.status !== 500 && res.status !== 404) setStep('paying')
            const data = await res.json()
            if (!res.ok) {
                const errCode = data?.error?.code ?? 'EASYPARCEL_ERROR'
                const errMsg = data?.error?.message ?? 'Failed to create shipping label'
                setErrorMsg(errCode === 'EASYPARCEL_WALLET_LOW' ? `Insufficient balance. ${errMsg}` : errMsg)
                setStep('error')
                return
            }
            const { awbNo, labelUrl } = data.data ?? data
            onSuccess(awbNo, labelUrl ?? null)
            setStep('idle')
        } catch {
            setErrorMsg('Network error. Please check your connection and try again.')
            setStep('error')
        }
    }

    const isLoading = step === 'submitting' || step === 'paying'
    const stepLabel = step === 'submitting' ? 'Reserving order…' : step === 'paying' ? 'Charging wallet…' : 'Buy Label'

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent style={{ background: 'var(--dash-secondary-bg)', border: '1px solid var(--dash-border)', borderRadius: 16, maxWidth: 440 }}>
                <DialogHeader>
                    <DialogTitle style={{ color: 'var(--dash-text)', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18 }}>
                        Create Shipping Label
                    </DialogTitle>
                </DialogHeader>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                    {/* Courier — read only */}
                    <div style={S.fieldGroup}>
                        <span style={S.label}>Courier</span>
                        <span style={{ fontSize: 14, color: 'var(--dash-text)', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                            {order.shippingCourier ?? 'Standard Delivery'}
                        </span>
                    </div>

                    {/* Parcel weight — editable */}
                    <div style={S.fieldGroup}>
                        <label htmlFor="parcel-weight" style={S.label}>Parcel Weight (grams)</label>
                        <input
                            id="parcel-weight"
                            type="number"
                            min={1}
                            value={weightGrams}
                            onChange={e => setWeightGrams(Math.max(1, Number(e.target.value)))}
                            disabled={isLoading}
                            style={S.input}
                        />
                    </div>

                    {/* Pickup date */}
                    <div style={S.fieldGroup}>
                        <label htmlFor="pickup-date" style={S.label}>Pickup Date</label>
                        <input
                            id="pickup-date"
                            type="date"
                            min={todayStr}
                            value={collectionDate}
                            onChange={e => setCollectionDate(e.target.value)}
                            disabled={isLoading}
                            style={S.input}
                        />
                    </div>

                    {/* COD amount — shown only for COD orders */}
                    {codAmountSen > 0 && (
                        <div style={S.infoCard}>
                            COD Amount: <strong style={{ color: 'var(--dash-text)' }}>RM {(codAmountSen / 100).toFixed(2)}</strong>
                        </div>
                    )}

                    {/* Quoted shipping fee */}
                    {order.shippingFee != null && (
                        <div style={S.infoCard}>
                            Quoted shipping fee: <strong style={{ color: 'var(--dash-text)' }}>RM {order.shippingFee.toFixed(2)}</strong>
                        </div>
                    )}

                    {/* Error alert */}
                    {step === 'error' && errorMsg && (
                        <div role="alert" style={{ background: 'hsl(var(--destructive)/0.1)', border: '1px solid hsl(var(--destructive)/0.3)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontSize: 13, color: 'hsl(var(--destructive))', fontFamily: 'Inter, sans-serif' }}>{errorMsg}</span>
                            <button
                                onClick={() => { setStep('idle'); setErrorMsg(null) }}
                                style={{ alignSelf: 'flex-start', fontSize: 12, color: 'hsl(var(--primary))', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <Button variant="dashSecondary" onClick={() => handleOpenChange(false)} disabled={isLoading} className="flex-1 h-11 rounded-xl text-[14px]">
                            Cancel
                        </Button>
                        <Button variant="dashPrimary" onClick={handleBuyLabel} disabled={isLoading || step === 'error'} className="flex-1 h-11 rounded-xl text-[14px] gap-2">
                            {isLoading && <Loader2 className="animate-spin" size={16} />}
                            {stepLabel}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
