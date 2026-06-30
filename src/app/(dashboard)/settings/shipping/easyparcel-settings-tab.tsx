'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle, ShieldCheck, PlugZap, BadgePercent, Wallet, Printer, Lock, Search, RefreshCw, Unlink, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { PickupAddresses } from './pickup-addresses'
import type { Warehouse } from '@/lib/shipping/easyparcel/warehouse'

// Warn the merchant when the EP wallet can't comfortably cover a label purchase (RM).
const LOW_WALLET_THRESHOLD = 10

export interface EasyParcelIntegrationConfig {
    enabled?: boolean
    // accessToken is server-only, never returned to client
    warehouse?: Warehouse | null       // legacy single pickup (back-compat)
    warehouses?: Warehouse[]           // current multi pickup addresses
    selectedCourier?: string
    testedAt?: string
    accountName?: string | null
    accountEmail?: string | null
}

type TestStatus = 'idle' | 'testing' | 'connected' | 'invalid'

interface Props {
    tenantId: string
    initialEpConfig: EasyParcelIntegrationConfig | null
}

// Courier options come live from EP and use EP courier_id (e.g. "EP-CR0AP") so the saved value can
// filter quotations at checkout. No static fallback — the picker shows loading / no-data instead.
type CourierOption = { id: string; name: string; fullName?: string; priceFrom?: number | null }

// Deterministic colored badge (initials) per courier — mirrors the hifi mock's logo chips.
const COURIER_BADGE_COLORS = ['#eab308', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#f97316', '#14b8a6', '#64748b']
function courierBadge(name: string): { initials: string; color: string } {
    const words = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean)
    const initials = (words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
    return { initials, color: COURIER_BADGE_COLORS[h % COURIER_BADGE_COLORS.length] }
}

const BENEFIT_TILES = [
    { icon: BadgePercent, title: 'Live courier rates', desc: 'Quote J&T, Pos Laju, Ninja Van and more in real time at checkout.' },
    { icon: Wallet, title: 'No platform markup', desc: 'Shipping is deducted straight from your own EasyParcel wallet.' },
    { icon: Printer, title: 'One-click AWB labels', desc: 'Generate air waybills and book pickups without leaving an order.' },
    { icon: ShieldCheck, title: 'Flat-rate safety net', desc: 'Your flat rates stay on as an automatic fallback if the API ever fails.' },
]

export function EasyParcelSettingsTab({ tenantId, initialEpConfig }: Props) {
    const [enabled, setEnabled] = useState(initialEpConfig?.enabled ?? false)
    const [testStatus, setTestStatus] = useState<TestStatus>(
        initialEpConfig?.testedAt ? 'connected' : 'idle',
    )
    const [walletBalance, setWalletBalance] = useState<string | null>(null)
    const [walletLow, setWalletLow] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const [confirm, setConfirm] = useState<null | 'disconnect' | 'sync'>(null)

    // Pickup addresses (multi). Seed from legacy single `warehouse` if no array exists yet.
    const [warehouses, setWarehouses] = useState<Warehouse[]>(() => {
        const list = initialEpConfig?.warehouses
        if (Array.isArray(list) && list.length > 0) return list
        const legacy = initialEpConfig?.warehouse
        if (legacy && (legacy.address1 || legacy.postcode || legacy.name)) {
            return [{ ...legacy, id: 'legacy', label: legacy.name || 'Pickup address', isDefault: true }]
        }
        return []
    })

    const [selectedCourier, setSelectedCourier] = useState(
        initialEpConfig?.selectedCourier ?? '',
    )
    const [couriers, setCouriers] = useState<CourierOption[]>([])
    const [couriersLoading, setCouriersLoading] = useState(false)
    const [codOnly, setCodOnly] = useState(false)

    const [isSaving, setIsSaving] = useState(false)

    const searchParams = useSearchParams()

    // Handle OAuth callback query params
    useEffect(() => {
        const ep = searchParams.get('ep')
        if (ep === 'connected') {
            setTestStatus('connected')
            toast.success('EasyParcel connected successfully!')
            if (typeof window !== 'undefined') {
                window.history.replaceState({}, '', '/settings/shipping')
            }
        } else if (ep === 'error') {
            toast.error('EasyParcel connection failed. Please try again.')
            if (typeof window !== 'undefined') {
                window.history.replaceState({}, '', '/settings/shipping')
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Load live courier list from EP once connected. Show loading while fetching; on failure/empty
    // the picker renders a "no data" state (no static fallback).
    useEffect(() => {
        if (testStatus !== 'connected') return
        let cancelled = false
        setCouriersLoading(true)
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
            .finally(() => { if (!cancelled) setCouriersLoading(false) })
        return () => { cancelled = true }
    }, [testStatus, tenantId])

    // At least one pickup address is required (each is validated inside the add form). A specific
    // courier must also be chosen so checkout never offers a non-COD courier to COD buyers.
    const warehouseComplete = warehouses.length > 0
    const hasWarehouse = warehouses.length > 0
    const courierMissing = !selectedCourier
    const canSave = testStatus === 'connected' && !isSaving && warehouseComplete && !courierMissing

    async function handleTestConnection() {
        setTestStatus('testing')
        try {
            const res = await fetch(`/api/tenant/${tenantId}/easyparcel-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            })
            const json = await res.json()
            if (!res.ok || !json.success) {
                const code = json?.error?.code
                if (code === 'EP_NOT_CONNECTED') {
                    setTestStatus('idle')
                    toast.error('EasyParcel not connected. Please connect via OAuth.')
                } else {
                    setTestStatus('idle')
                    toast.error(json?.error?.message ?? 'Connection test failed')
                }
                return
            }
            const { balance, currency } = json.data ?? {}
            setWalletBalance(balance ? `${currency ?? 'MYR'} ${balance}` : null)
            setWalletLow(balance != null && Number(balance) < LOW_WALLET_THRESHOLD)
            setTestStatus('connected')
            toast.success('EasyParcel connection verified!')
        } catch {
            setTestStatus('idle')
            toast.error('Network error. Please try again.')
        }
    }

    // Pull EP's default pickup address into the local warehouse (server writes it, then we reload so
    // the geo-cascade selects reconcile via the same path as connect-time seeding).
    async function handleSyncFromEp() {
        setIsSyncing(true)
        try {
            const res = await fetch(`/api/tenant/${tenantId}/easyparcel-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ syncWarehouse: true }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) {
                toast.error(json?.error?.message ?? 'Sync failed')
                return
            }
            if (!json.data?.warehouseApplied) {
                toast.info('No pickup address is configured in EasyParcel yet — set one in your EasyParcel account first.')
                return
            }
            toast.success('Synced pickup address from EasyParcel')
            window.location.reload()
        } catch {
            toast.error('Network error. Please try again.')
        } finally {
            setIsSyncing(false)
            setConfirm(null)
        }
    }

    // Clear the EP OAuth session for this tenant. Warehouse/courier config is kept server-side.
    async function handleDisconnect() {
        setIsDisconnecting(true)
        try {
            const res = await fetch(`/api/tenant/${tenantId}/easyparcel-disconnect`, {
                method: 'DELETE',
                credentials: 'include',
            })
            const json = await res.json()
            if (!res.ok || !json.success) {
                toast.error(json?.error?.message ?? 'Disconnect failed')
                return
            }
            toast.success('EasyParcel disconnected')
            window.location.reload()
        } catch {
            toast.error('Network error. Please try again.')
        } finally {
            setIsDisconnecting(false)
            setConfirm(null)
        }
    }

    async function handleSave() {
        if (!canSave) return
        setIsSaving(true)
        try {
            const data = {
                easyParcelIntegration: {
                    enabled,
                    warehouses,
                    selectedCourier,
                },
            }

            const res = await fetch(`/api/tenants/${tenantId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json?.errors?.[0]?.message ?? 'Failed to save')
            toast.success('EasyParcel settings saved')
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save settings')
        } finally {
            setIsSaving(false)
        }
    }

    // --- Intro card (EP disabled) ---
    if (!enabled) {
        return (
            <div className="mt-5 rounded-[16px] border border-white/[0.08] bg-[hsl(var(--secondary)/0.6)] overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] shrink-0" style={{ background: 'linear-gradient(135deg, rgb(16,185,129) 0%, rgb(13,148,136) 100%)' }}>
                            <PlugZap className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-[18px] font-bold text-[var(--dash-text)]">Connect EasyParcel</h3>
                            <p className="mt-1 text-[13px] text-[var(--dash-text-muted)]">
                                Each store uses its own EasyParcel account. Charges are deducted straight from your wallet — no platform markup.
                            </p>
                        </div>
                    </div>
                    <span style={{
                        background: 'rgba(107,114,128,0.18)',
                        color: 'rgb(107,114,128)',
                        borderRadius: 20,
                        padding: '4px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                    }}>
                        OFF
                    </span>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

                {/* Feature tiles 2×2 */}
                <div className="grid grid-cols-2 gap-3 p-6">
                    {BENEFIT_TILES.map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="flex items-start gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.03] p-4">
                            <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px] bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.15)] shrink-0">
                                <Icon className="h-4 w-4 text-[hsl(var(--primary))]" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[13px] font-semibold text-[var(--dash-text)]">{title}</span>
                                <span className="text-[12px] text-[var(--dash-text-muted)] leading-[1.5]">{desc}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

                {/* Footer */}
                <div className="flex items-center gap-5 p-6">
                    <Button
                        variant="dashPrimary" size="dash"
                        onClick={() => { window.location.href = `/api/tenant/${tenantId}/easyparcel-oauth-start` }}
                        className="flex items-center gap-2 shrink-0"
                    >
                        <PlugZap className="h-4 w-4" />
                        Setup Connection
                    </Button>
                    <p className="text-[13px] text-[var(--dash-text-muted)]">
                        While off, checkout uses your <strong className="text-[var(--dash-text)]">Flat Rate</strong> shipping.
                    </p>
                </div>
            </div>
        )
    }

    // --- Full settings (EP enabled) ---
    return (
        <div className="mt-5 rounded-[16px] border border-white/[0.08] bg-[hsl(var(--secondary)/0.6)] overflow-hidden">

            {/* ─── Header ───────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 p-6">
                <div className="flex items-center gap-4">
                    <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] shrink-0" style={{ background: 'linear-gradient(135deg, rgb(16,185,129) 0%, rgb(13,148,136) 100%)' }}>
                        <PlugZap className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-[18px] font-bold text-[var(--dash-text)]">Connect EasyParcel</h3>
                        <p className="mt-1 text-[13px] text-[var(--dash-text-muted)]">
                            Each store uses its own EasyParcel account. Charges are deducted straight from your wallet — no platform markup.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    aria-pressed={enabled}
                    onClick={() => setEnabled(v => !v)}
                    className={`w-[44px] h-[24px] rounded-full border relative transition-all duration-200 shrink-0${!enabled ? ' bg-white/10 border-white/[0.08]' : ''}`}
                    style={enabled ? {
                        background: 'linear-gradient(135deg, hsl(var(--info)) 0%, hsl(var(--primary)) 100%)',
                        boxShadow: '0 0 12px hsl(var(--info)/0.40)',
                        borderColor: 'transparent',
                    } : undefined}
                >
                    <span className={`absolute top-1/2 -translate-y-1/2 left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-all duration-200${enabled ? ' translate-x-[20px]' : ''}`} />
                </button>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

            {/* ─── API Credentials / OAuth Connection ──────────────── */}
            <div className="p-6 flex flex-col gap-4">
                {testStatus === 'connected' ? (
                    <>
                        <div className="flex items-center gap-2 rounded-[10px] border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] px-4 py-3 text-[13px] text-[rgb(16,185,129)]">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            {couriers.length > 0 ? `Connected to EasyParcel — ${couriers.length} couriers available` : 'Connected to EasyParcel'}
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <Lock className="h-4 w-4 text-[var(--dash-text-muted)] shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[13px] font-medium text-[var(--dash-text)] truncate">
                                        {initialEpConfig?.accountName || 'OAuth session active'}
                                    </p>
                                    {initialEpConfig?.accountEmail && (
                                        <p className="text-[12px] text-[var(--dash-text-muted)] truncate">{initialEpConfig.accountEmail}</p>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => (hasWarehouse ? setConfirm('sync') : handleSyncFromEp())}
                                disabled={isSyncing}
                                className="flex items-center gap-1.5 shrink-0"
                                title="Pull the default pickup address configured in your EasyParcel account"
                            >
                                {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                Sync from EasyParcel
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col gap-3">
                        <p className="text-[13px] text-[var(--dash-text-muted)]">
                            You&apos;ll be redirected to EasyParcel to authorize access. Your credentials are stored securely and never exposed.
                        </p>
                        <div>
                            <Button
                                variant="dashPrimary" size="dash"
                                onClick={() => { window.location.href = `/api/tenant/${tenantId}/easyparcel-oauth-start` }}
                                className="flex items-center gap-2"
                            >
                                <PlugZap className="h-4 w-4" />
                                Connect with EasyParcel
                            </Button>
                        </div>
                    </div>
                )}

                {testStatus === 'invalid' && (
                    <div role="alert" className="flex items-center gap-2 rounded-[10px] border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-4 py-3 text-[13px] text-[hsl(var(--destructive))]">
                        <XCircle className="h-4 w-4 shrink-0" />
                        Connection failed. Please try reconnecting.
                    </div>
                )}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

            {/* ─── Pickup Addresses ─────────────────────────── */}
            <div className="p-6 flex flex-col gap-5" style={{ opacity: testStatus === 'testing' ? 0.5 : 1, pointerEvents: testStatus === 'testing' ? 'none' : undefined }}>
                <PickupAddresses value={warehouses} onChange={setWarehouses} />
                {testStatus === 'connected' && (
                    <div>
                        <Button
                            variant="outline"
                            onClick={() => setConfirm('disconnect')}
                            disabled={isDisconnecting}
                            className="flex items-center gap-2 border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.06)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.12)]"
                        >
                            {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                            Disconnect Account
                        </Button>
                    </div>
                )}
            </div>

            {testStatus === 'connected' && <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />}

            {/* ─── Courier picker — only after connection verified ── */}
            {testStatus === 'connected' && (
                <div className="p-6 flex flex-col gap-4">
                    <div>
                        <p className="text-[14px] font-semibold text-[var(--dash-text)]">
                            Courier for checkout <span className="text-[var(--dash-text-muted)] font-normal">· Pick one</span>
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--dash-text-muted)]">
                            Buyers are quoted only this courier's live rate.
                            {codOnly && ' Only couriers that support COD are listed.'}
                        </p>
                    </div>
                    {couriersLoading ? (
                        <div className="flex items-center gap-2 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-[13px] text-[var(--dash-text-muted)]">
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                            Loading couriers from EasyParcel…
                        </div>
                    ) : couriers.length === 0 ? (
                        <div className="flex items-center gap-2 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-[13px] text-[var(--dash-text-muted)]">
                            <XCircle className="h-4 w-4 shrink-0" />
                            No courier data available. Check your EasyParcel connection and try again.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {couriers.map(courier => {
                                const isSelected = selectedCourier === courier.id
                                const badge = courierBadge(courier.name)
                                return (
                                    <button key={courier.id} type="button" role="radio" aria-checked={isSelected}
                                        onClick={() => setSelectedCourier(courier.id)}
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
            )}

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

            {/* ─── Footer action ────────────────────────────── */}
            <div className="flex items-center gap-4 px-6 py-5">
                {testStatus !== 'connected' ? (
                    <Button
                        variant="dashPrimary" size="dash"
                        onClick={handleTestConnection}
                        disabled={testStatus === 'testing'}
                        className="flex items-center gap-2 shrink-0"
                    >
                        {testStatus === 'testing' ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Testing connection…</>
                        ) : (
                            <><Search className="h-4 w-4" />Test connection</>
                        )}
                    </Button>
                ) : (
                    <>
                        <Button variant="dashPrimary" size="dash" onClick={handleSave} disabled={!canSave} className="flex items-center gap-2 shrink-0">
                            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : 'Save Settings'}
                        </Button>
                        {!warehouseComplete && (
                            <p className="text-[12px] text-[hsl(var(--destructive))]">
                                Add at least one pickup address first.
                            </p>
                        )}
                        {warehouseComplete && courierMissing && (
                            <p className="text-[12px] text-[hsl(var(--destructive))]">
                                Select a courier for checkout first.
                            </p>
                        )}
                    </>
                )}
            </div>

            <ConfirmModal
                open={confirm !== null}
                variant={confirm === 'disconnect' ? 'danger' : 'default'}
                loading={confirm === 'disconnect' ? isDisconnecting : isSyncing}
                icon={confirm === 'disconnect'
                    ? <Unlink className="h-7 w-7 text-[hsl(var(--destructive))]" />
                    : <RefreshCw className="h-7 w-7 text-[hsl(var(--primary))]" />}
                title={confirm === 'disconnect' ? 'Disconnect EasyParcel?' : 'Sync from EasyParcel?'}
                description={confirm === 'disconnect'
                    ? 'You will need to reconnect to quote live rates and buy labels. Your pickup address and courier settings are kept.'
                    : 'Replace your saved pickup address with the one configured in EasyParcel?'}
                confirmLabel={confirm === 'disconnect' ? 'Disconnect' : 'Sync'}
                cancelLabel="Cancel"
                onCancel={() => setConfirm(null)}
                onConfirm={() => { if (confirm === 'disconnect') handleDisconnect(); else handleSyncFromEp() }}
            />
        </div>
    )
}
