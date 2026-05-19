"use client"

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'

interface CancelOrderModalProps {
    orderNumber: string
    isOpen: boolean
    isLoading: boolean
    onBack: () => void
    onConfirm: (reason: string) => void
}

export function CancelOrderModal({ orderNumber, isOpen, isLoading, onBack, onConfirm }: CancelOrderModalProps) {
    const { t } = useI18n()
    const c = t.dashboard.orders.cancel
    const [reason, setReason] = useState('')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!isOpen || !mounted) return null

    // Determine if button should be disabled (empty reason or currently loading)
    const isDisabled = reason.trim() === '' || isLoading

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity"
            style={{
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
            }}
        >
            <div
                className="flex flex-col items-center"
                style={{
                    width: 448,
                    background: 'var(--dash-surface)',
                    border: '1px solid var(--dash-border)',
                    borderRadius: 16,
                    padding: 25,
                    boxShadow: '0px 8px 24px 0px rgba(25, 32, 56, 0.1)'
                }}
            >
                {/* Icon Circle */}
                <div
                    className="flex items-center justify-center"
                    style={{
                        width: 64,
                        height: 64,
                        background: 'rgba(240, 177, 0, 0.1)',
                        borderRadius: 33554400, // as drawn in figma
                        marginBottom: 16
                    }}
                >
                    <AlertTriangle size={26} strokeWidth={2.67} color="#F0B100" />
                </div>

                {/* Heading */}
                <h2
                    className="w-full text-center truncate"
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 700,
                        fontSize: 20,
                        lineHeight: '1.4em',
                        color: 'var(--dash-text)',
                        marginBottom: 8
                    }}
                >
                    {c.title} {orderNumber}
                </h2>

                {/* Paragraph */}
                <p
                    className="w-full text-center"
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: 14,
                        lineHeight: '1.4285714285714286em',
                        color: 'var(--dash-text-muted)',
                        marginBottom: 24
                    }}
                >
                    {c.orderLabel} {orderNumber}
                </p>

                {/* Form Field */}
                <div className="flex flex-col w-full" style={{ gap: 8, marginBottom: 24 }}>
                    <label
                        style={{
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 14,
                            lineHeight: '1.4285714285714286em',
                            color: 'var(--dash-text)'
                        }}
                    >
                        {c.reasonLabel} *
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={c.reasonPlaceholder}
                        disabled={isLoading}
                        style={{
                            height: 128,
                            padding: '12px 16px',
                            background: 'var(--dash-secondary-bg)',
                            border: '1px solid var(--dash-border)',
                            borderRadius: 16,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 400,
                            fontSize: 16,
                            lineHeight: '1.5em',
                            color: 'var(--dash-text)',
                            resize: 'none',
                            outline: 'none',
                        }}
                    />
                </div>

                {/* Buttons Row */}
                <div className="flex w-full" style={{ gap: 12, height: 50 }}>
                    <button
                        onClick={() => {
                            if (!isLoading) {
                                setReason('')
                                onBack()
                            }
                        }}
                        disabled={isLoading}
                        className="flex items-center justify-center flex-1 transition-opacity hover:opacity-80"
                        style={{
                            border: '1px solid var(--dash-border)',
                            borderRadius: 16,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 16,
                            lineHeight: '1.5em',
                            color: 'var(--dash-text)',
                            opacity: isLoading ? 0.5 : 1
                        }}
                    >
                        {c.back}
                    </button>
                    <button
                        onClick={() => onConfirm(reason)}
                        disabled={isDisabled}
                        className="flex items-center justify-center flex-1 transition-opacity gap-2"
                        style={{
                            background: isDisabled ? 'rgba(251, 44, 54, 0.5)' : 'rgba(251, 44, 54, 1)',
                            borderRadius: 16,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 16,
                            lineHeight: '1.5em',
                            color: isDisabled ? 'rgba(255, 255, 255, 0.5)' : '#FFFFFF',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                        {isLoading ? c.confirming : c.confirm}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
