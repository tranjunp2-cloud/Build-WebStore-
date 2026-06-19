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
    const [touched, setTouched] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Reset form state whenever modal closes so stale errors don't persist on re-open
    useEffect(() => {
        if (!isOpen) {
            setReason('')
            setTouched(false)
        }
    }, [isOpen])

    if (!isOpen || !mounted) return null

    const isEmpty = reason.trim() === ''
    const showError = touched && isEmpty
    // Determine if button should be disabled (empty reason or currently loading)
    const isDisabled = isEmpty || isLoading

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
                        background: 'hsl(var(--warning)/0.1)',
                        borderRadius: 33554400, // as drawn in figma
                        marginBottom: 16
                    }}
                >
                    <AlertTriangle size={26} strokeWidth={2.67} color="hsl(var(--warning))" />
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
                        marginBottom: 12
                    }}
                >
                    {c.orderLabel} {orderNumber}
                </p>

                {/* Warning — restock notice (TC-F10-03-10) */}
                <p
                    className="w-full text-center"
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: 13,
                        lineHeight: '1.4em',
                        color: 'hsl(var(--warning))',
                        marginBottom: 24
                    }}
                >
                    {c.warning}
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
                        onBlur={() => setTouched(true)}
                        placeholder={c.reasonPlaceholder}
                        disabled={isLoading}
                        maxLength={500}
                        style={{
                            height: 128,
                            padding: '12px 16px',
                            background: 'var(--dash-secondary-bg)',
                            border: `1px solid ${showError ? 'hsl(var(--destructive))' : 'hsl(var(--input-border))'}`,
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
                    <div className="flex justify-between items-center" style={{ minHeight: 16 }}>
                        {showError ? (
                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'hsl(var(--destructive))' }}>
                                {c.reasonRequired}
                            </span>
                        ) : <span />}
                        <span
                            title={c.reasonMaxLength}
                            aria-label={c.reasonMaxLength}
                            style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: reason.length >= 450 ? 'hsl(var(--destructive))' : 'var(--dash-text-muted)' }}
                        >
                            {reason.length}/500
                        </span>
                    </div>
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
                            background: 'hsl(var(--destructive))',
                            borderRadius: 16,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            fontSize: 16,
                            lineHeight: '1.5em',
                            color: '#FFFFFF',
                            opacity: isDisabled ? 0.5 : 1,
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
