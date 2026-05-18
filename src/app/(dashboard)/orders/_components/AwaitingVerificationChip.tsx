'use client'

import React, { useEffect, useState } from 'react'

export function AwaitingVerificationChip() {
    const [count, setCount] = useState<number | null>(null)

    useEffect(() => {
        let cancelled = false
        fetch('/api/orders?where[paymentStatus][equals]=pending_verification&where[paymentMethod][equals]=bank_transfer&limit=0')
            .then(r => r.json())
            .then(data => {
                if (!cancelled) setCount(data?.totalDocs ?? 0)
            })
            .catch(err => {
                console.error('[AwaitingVerificationChip] fetch failed', err)
                if (!cancelled) setCount(0)
            })
        return () => { cancelled = true }
    }, [])

    if (count === null || count === 0) return null

    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: 8,
                background: 'rgba(245, 158, 11, 0.08)',
                cursor: 'default',
                alignSelf: 'flex-start',
            }}
        >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.666" stroke="#F59E0B" strokeWidth="1.33" />
                <path d="M8 5v3.5l2 1" stroke="#F59E0B" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span
                style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#F59E0B',
                }}
            >
                Awaiting Verification ({count})
            </span>
        </div>
    )
}
