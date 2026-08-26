'use client'

import { useEffect, useState } from 'react'
import { Wallet, ExternalLink } from 'lucide-react'
import { useI18n } from '@/i18n'

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
    const { t, ti } = useI18n()
    const copy = t.dashboard.settings.shipping.easyParcel
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
        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.08)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2 text-[13px] leading-relaxed text-[hsl(var(--warning))] sm:items-center">
                <Wallet className="h-4 w-4 shrink-0" />
                <span className="break-words">
                    <strong>{ti(copy.walletBalance, { balance: walletBalance })}</strong>
                    {ordersLeft != null && ` ${ti(copy.walletOrders, { count: ordersLeft })}`}
                    {walletLow && ` ${copy.walletLow}`}
                </span>
            </div>
            <a href="https://app.easyparcel.com" target="_blank" rel="noopener noreferrer"
                className="flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg text-[13px] font-medium text-[hsl(var(--warning))] hover:opacity-80 sm:min-h-0">
                {copy.topUp} <ExternalLink className="h-3.5 w-3.5" />
            </a>
        </div>
    )
}
