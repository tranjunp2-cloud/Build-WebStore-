'use client'

import { useEffect, useState } from 'react'
import { Wallet, ExternalLink } from 'lucide-react'

// Warn the merchant when the EP wallet can't comfortably cover a label purchase (RM).
const LOW_WALLET_THRESHOLD = 10

interface EpWalletBannerProps {
    tenantId: string
    /** Only fetch when the EP connection is active. */
    active: boolean
}

/**
 * Displays the EasyParcel wallet balance and a low-balance warning.
 * Fetches from /api/tenant/{tenantId}/easyparcel-couriers (same endpoint as before;
 * wallet data is a sidecar on that response).
 */
export function EpWalletBanner({ tenantId, active }: EpWalletBannerProps) {
    const [walletBalance, setWalletBalance] = useState<string | null>(null)
    const [walletLow, setWalletLow] = useState(false)
    const [cheapestRate, setCheapestRate] = useState<number | null>(null)

    useEffect(() => {
        if (!active) return
        let cancelled = false
        fetch(`/api/tenant/${tenantId}/easyparcel-couriers`, { credentials: 'include' })
            .then(r => r.json())
            .then(j => {
                if (cancelled) return
                if (j?.success) {
                    const w = j.data?.wallet
                    if (w?.balance != null) {
                        setWalletBalance(`${w.currency ?? 'MYR'} ${w.balance}`)
                        setWalletLow(Number(w.balance) < LOW_WALLET_THRESHOLD)
                    }
                    // Compute cheapest courier rate for "orders left" estimate
                    if (Array.isArray(j.data?.couriers)) {
                        const cheapest = (j.data.couriers as Array<{ priceFrom?: number | null }>)
                            .reduce<number | null>((m, c) => (c.priceFrom != null && (m == null || c.priceFrom < m) ? c.priceFrom : m), null)
                        setCheapestRate(cheapest)
                    }
                }
            })
            .catch(() => { /* silent — banner is informational only */ })
        return () => { cancelled = true }
    }, [active, tenantId])

    if (!walletBalance) return null

    const walletNum = parseFloat(walletBalance.replace(/[^0-9.]/g, ''))
    const ordersLeft = Number.isFinite(walletNum) && cheapestRate && cheapestRate > 0
        ? Math.floor(walletNum / cheapestRate)
        : null

    return (
        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.08)] px-4 py-3">
            <div className="flex items-center gap-2 text-[13px] text-[hsl(var(--warning))]">
                <Wallet className="h-4 w-4 shrink-0" />
                <span>
                    <strong>Wallet balance: {walletBalance}</strong>
                    {ordersLeft != null && ` — enough for about ${ordersLeft} order${ordersLeft === 1 ? '' : 's'}.`}
                    {walletLow && ' Top up to avoid interruptions.'}
                </span>
            </div>
            <a href="https://app.easyparcel.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[13px] font-medium text-[hsl(var(--warning))] hover:opacity-80 shrink-0">
                Top up <ExternalLink className="h-3.5 w-3.5" />
            </a>
        </div>
    )
}
