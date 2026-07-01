'use client'

import { useEffect, useState } from 'react'
import { Loader2, XCircle, Wallet, ExternalLink } from 'lucide-react'

type CourierOption = { id: string; name: string; fullName?: string; priceFrom?: number | null }

// Warn the merchant when the EP wallet can't comfortably cover a label purchase (RM).
const LOW_WALLET_THRESHOLD = 10

// Deterministic colored badge (initials) per courier — mirrors the hifi mock's logo chips.
const COURIER_BADGE_COLORS = ['#eab308', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#f97316', '#14b8a6', '#64748b']
function courierBadge(name: string): { initials: string; color: string } {
    const words = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean)
    const initials = (words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
    return { initials, color: COURIER_BADGE_COLORS[h % COURIER_BADGE_COLORS.length] }
}

interface CourierPickerProps {
    tenantId: string
    /** Fetch couriers only once the connection is usable. */
    active: boolean
    selectedCourier: string
    onSelect: (id: string) => void
}

/**
 * "Courier for checkout" picker — fetches the tenant's live COD-capable couriers (with 'from' prices)
 * and shows the wallet balance banner. Used by both the setup stepper and the management view.
 */
export function CourierPicker({ tenantId, active, selectedCourier, onSelect }: CourierPickerProps) {
    const [couriers, setCouriers] = useState<CourierOption[]>([])
    const [loading, setLoading] = useState(false)
    const [codOnly, setCodOnly] = useState(false)
    const [walletBalance, setWalletBalance] = useState<string | null>(null)
    const [walletLow, setWalletLow] = useState(false)

    useEffect(() => {
        if (!active) return
        let cancelled = false
        setLoading(true)
        fetch(`/api/tenant/${tenantId}/easyparcel-couriers`, { credentials: 'include' })
            .then(r => r.json())
            .then(j => {
                if (cancelled) return
                if (j?.success && Array.isArray(j.data?.couriers)) {
                    setCouriers(j.data.couriers)
                    setCodOnly(j.data.codFiltered === true)
                    const w = j.data.wallet
                    if (w?.balance != null) {
                        setWalletBalance(`${w.currency ?? 'MYR'} ${w.balance}`)
                        setWalletLow(Number(w.balance) < LOW_WALLET_THRESHOLD)
                    }
                } else {
                    setCouriers([])
                }
            })
            .catch(() => { if (!cancelled) setCouriers([]) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [active, tenantId])

    return (
        <div className="flex flex-col gap-4">
            <div>
                <p className="text-[14px] font-semibold text-[var(--dash-text)]">
                    Courier for checkout <span className="text-[var(--dash-text-muted)] font-normal">· Pick one</span>
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--dash-text-muted)]">
                    Buyers are quoted only this courier's live rate.
                    {codOnly && ' Only couriers that support COD are listed.'}
                </p>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-[13px] text-[var(--dash-text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    Loading couriers from EasyParcel…
                </div>
            ) : couriers.length === 0 ? (
                <div className="flex items-center gap-2 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-[13px] text-[var(--dash-text-muted)]">
                    <XCircle className="h-4 w-4 shrink-0" />
                    No courier data available. Add a pickup address and check your EasyParcel connection.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {couriers.map(courier => {
                        const isSelected = selectedCourier === courier.id
                        const badge = courierBadge(courier.name)
                        return (
                            <button key={courier.id} type="button" role="radio" aria-checked={isSelected}
                                onClick={() => onSelect(courier.id)}
                                className={[
                                    'flex items-center gap-3 rounded-[12px] border px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
                                    isSelected
                                        ? 'border-[hsl(var(--primary)/0.5)] bg-[hsl(var(--primary)/0.06)]'
                                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]',
                                ].join(' ')}>
                                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2"
                                    style={{ borderColor: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--input-border))' }}>
                                    {isSelected && <span className="h-[8px] w-[8px] rounded-full bg-[hsl(var(--primary))]" />}
                                </span>
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[12px] font-bold text-white"
                                    style={{ background: badge.color }}>{badge.initials}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[13px] font-semibold text-[var(--dash-text)] truncate">{courier.name}</span>
                                    {courier.priceFrom != null ? (
                                        <span className="block text-[12px] text-[var(--dash-text-muted)]">from RM {courier.priceFrom.toFixed(2)}</span>
                                    ) : courier.fullName && courier.fullName !== courier.name ? (
                                        <span className="block text-[12px] text-[var(--dash-text-muted)] truncate">{courier.fullName}</span>
                                    ) : null}
                                </span>
                            </button>
                        )
                    })}
                </div>
            )}

            {walletBalance && (() => {
                const walletNum = parseFloat(walletBalance.replace(/[^0-9.]/g, ''))
                const cheapest = couriers.reduce<number | null>((m, c) => (c.priceFrom != null && (m == null || c.priceFrom < m) ? c.priceFrom : m), null)
                const ordersLeft = Number.isFinite(walletNum) && cheapest && cheapest > 0 ? Math.floor(walletNum / cheapest) : null
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
            })()}
        </div>
    )
}
