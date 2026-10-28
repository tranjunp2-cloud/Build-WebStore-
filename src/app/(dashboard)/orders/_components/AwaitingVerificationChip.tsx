'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAgentChanges } from '@/lib/agent-changes/use-agent-changes'

export function AwaitingVerificationChip() {
    const [count, setCount] = useState<number | null>(null)

    // `silent` = an assistant-driven refetch: a failure keeps the count on screen
    const load = useCallback((silent = false) => {
        let cancelled = false
        fetch('/api/orders?paymentStatus=pending_verification&paymentMethod=bank_transfer&limit=0')
            .then(r => r.json())
            .then(data => {
                if (!cancelled) setCount(data?.totalDocs ?? 0)
            })
            .catch(err => {
                console.error('[AwaitingVerificationChip] fetch failed', err)
                if (!cancelled && !silent) setCount(0)
            })
        return () => { cancelled = true }
    }, [])

    useEffect(() => load(), [load])

    // The assistant checked or rejected a payment: the chip count moves with it
    useAgentChanges({ kinds: ['store_order'] }, () => { load(true) })

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
