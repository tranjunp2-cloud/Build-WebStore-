'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Package, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'

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
    const [mounted, setMounted] = useState(false)

    useEffect(() => { setMounted(true) }, [])

    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isLoading) { setTrackingNumber(''); onBack() } }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [isOpen, isLoading, onBack])

    if (!isOpen || !mounted) return null

    const isDisabled = trackingNumber.trim() === '' || isLoading

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !isLoading) { setTrackingNumber(''); onBack() } }}
        >
            <div
                className="flex flex-col items-center"
                style={{
                    width: 448,
                    background: 'var(--dash-surface)',
                    border: '1px solid var(--dash-border)',
                    borderRadius: 16,
                    padding: 25,
                    boxShadow: '0px 8px 24px 0px rgba(25, 32, 56, 0.1)',
                }}
            >
                {/* Icon */}
                <div
                    className="flex items-center justify-center"
                    style={{
                        width: 64, height: 64,
                        background: 'rgba(45, 212, 191, 0.1)',
                        borderRadius: 9999,
                        marginBottom: 16,
                    }}
                >
                    <Package size={26} strokeWidth={2.67} color="#2DD4BF" />
                </div>

                {/* Heading */}
                <h2
                    className="w-full text-center truncate"
                    style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 20, lineHeight: '1.4em', color: 'var(--dash-text)', marginBottom: 8 }}
                >
                    {s.title} — {orderNumber}
                </h2>

                {/* Tracking input */}
                <div className="flex flex-col w-full" style={{ gap: 8, marginBottom: 24 }}>
                    <label htmlFor="ship-tracking-input" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, lineHeight: '1.43em', color: 'var(--dash-text)' }}>
                        {s.trackingLabel} *
                    </label>
                    <input
                        id="ship-tracking-input"
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder={s.trackingPlaceholder}
                        disabled={isLoading}
                        autoFocus
                        style={{
                            height: 48,
                            padding: '12px 16px',
                            background: 'var(--dash-secondary-bg)',
                            border: '1px solid var(--dash-border)',
                            borderRadius: 12,
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 16,
                            color: 'var(--dash-text)',
                            outline: 'none',
                            width: '100%',
                        }}
                    />
                </div>

                {/* Buttons */}
                <div className="flex w-full" style={{ gap: 12, height: 50 }}>
                    <button
                        onClick={() => { if (!isLoading) { setTrackingNumber(''); onBack() } }}
                        disabled={isLoading}
                        className="flex items-center justify-center flex-1 transition-opacity hover:opacity-80"
                        style={{
                            border: '1px solid var(--dash-border)',
                            borderRadius: 16,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 16,
                            color: 'var(--dash-text)',
                            opacity: isLoading ? 0.5 : 1,
                        }}
                    >
                        {s.back}
                    </button>
                    <button
                        onClick={() => onConfirm(trackingNumber.trim())}
                        disabled={isDisabled}
                        className="flex items-center justify-center flex-1 gap-2 transition-opacity"
                        style={{
                            background: isDisabled ? 'rgba(45,212,191,0.4)' : '#2DD4BF',
                            borderRadius: 16,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 16,
                            color: isDisabled ? 'rgba(11,17,32,0.5)' : '#0B1120',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isLoading ? s.confirming : s.confirm}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
