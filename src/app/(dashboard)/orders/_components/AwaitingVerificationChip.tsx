'use client'

import React, { useEffect } from 'react'
import { useAwaitingVerificationCount } from './orders-queries'

export function AwaitingVerificationChip() {
    // checking or rejecting a payment moves it (orders list invalidation); a failed read shows nothing
    const query = useAwaitingVerificationCount()
    const count = query.data ?? (query.isError ? 0 : null)
    useEffect(() => {
        if (query.error) console.error('[AwaitingVerificationChip] fetch failed', query.error)
    }, [query.error])

    if (count === null || count === 0) return null

    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                border: '1px solid hsl(var(--warning)/0.4)',
                borderRadius: 8,
                background: 'hsl(var(--warning)/0.08)',
                cursor: 'default',
                alignSelf: 'flex-start',
            }}
        >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.666" stroke="hsl(var(--warning))" strokeWidth="1.33" />
                <path d="M8 5v3.5l2 1" stroke="hsl(var(--warning))" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span
                style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'hsl(var(--warning))',
                }}
            >
                Awaiting Verification ({count})
            </span>
        </div>
    )
}
