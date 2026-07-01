'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, XCircle, ShieldCheck, PlugZap, BadgePercent, Wallet, Printer, Lock, Search, RefreshCw, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { PickupAddresses } from './pickup-addresses'
import { CourierPicker } from './courier-picker'
import { EpSetupStepper } from './ep-setup-stepper'
import { getAllowedCouriers, getDefaultWarehouse, isWarehouseComplete, type Warehouse } from '@/lib/shipping/easyparcel/warehouse'

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
    const [isSyncing, setIsSyncing] = useState(false)
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const [tokenDead, setTokenDead] = useState(false)
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

    const [selectedCouriers, setSelectedCouriers] = useState<string[]>(() =>
        getAllowedCouriers(initialEpConfig),
    )

    function onToggle(id: string) {
        setSelectedCouriers(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
    }

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

    // At least one pickup address is required (each is validated inside the add form). A specific
    // courier must also be chosen so checkout never offers a non-COD courier to COD buyers.
    const warehouseComplete = warehouses.length > 0
    const hasWarehouse = warehouses.length > 0
    const courierMissing = selectedCouriers.length === 0
    const canSave = testStatus === 'connected' && !isSaving && warehouseComplete && !courierMissing

    // Ready = default pickup complete (incl. phone) + at least one courier chosen. Mirrors server isEpReady
    // (minus token, which the client can't see). Drives the toggle guard + not-ready badge.
    const localReady = isWarehouseComplete(getDefaultWarehouse({ warehouses })) && selectedCouriers.length > 0

    // Master toggle: activate/deactivate EP for checkout. Persists immediately; can only turn ON when
    // ready. Sends the full group so Payload doesn't drop warehouses/courier.
    async function handleToggleEnabled() {
        const next = !enabled
        if (next && !localReady) {
            toast.error('Add a complete pickup address and select a courier before activating.')
            return
        }
        const prev = enabled
        setEnabled(next)
        try {
            const res = await fetch(`/api/tenant/${tenantId}/easyparcel-save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ enabled: next, warehouses, selectedCouriers }),
            })
            if (!res.ok) throw new Error()
            toast.success(next ? 'EasyParcel activated' : 'EasyParcel deactivated — checkout uses flat rate')
        } catch {
            setEnabled(prev)
            toast.error('Failed to update. Please try again.')
        }
    }

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
                    setTokenDead(true)
                    toast.error('EasyParcel session expired. Please reconnect.')
                } else {
                    setTestStatus('idle')
                    toast.error(json?.error?.message ?? 'Connection test failed')
                }
                return
            }
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

    // Persist pickup-address mutations immediately. The inline "Add/Update/Delete/Set default"
    // actions only change local state; without this they'd need a separate "Save Settings" click
    // to reach the DB, which reads as "editing the address does nothing".
    async function handleWarehousesChange(next: Warehouse[]) {
        setWarehouses(next)
        if (testStatus !== 'connected') return
        try {
            const res = await fetch(`/api/tenant/${tenantId}/easyparcel-save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ enabled, warehouses: next, selectedCouriers }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json?.error?.message ?? 'Failed to save')
            toast.success('Pickup address saved')
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save pickup address')
        }
    }

    async function handleSave() {
        if (!canSave) return
        setIsSaving(true)
        try {
            const res = await fetch(`/api/tenant/${tenantId}/easyparcel-save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ enabled, warehouses, selectedCouriers }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json?.error?.message ?? 'Failed to save')
            toast.success('EasyParcel settings saved')
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save settings')
        } finally {
            setIsSaving(false)
        }
    }

    // Connection state: "connected" = completed OAuth at least once (testedAt set, cleared on
    // disconnect). "persistedSetup" = a pickup + courier were saved (only via Save & Activate or a
    // management save). Drives which of the 3 views renders.
    const connected = !!initialEpConfig?.testedAt
    const persistedSetup =
        ((initialEpConfig?.warehouses?.length ?? 0) > 0 || !!initialEpConfig?.warehouse?.address1) &&
        getAllowedCouriers(initialEpConfig).length > 0

    // --- Not connected → intro card ---
    if (!connected) {
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

    // --- Connected but not yet configured → guided setup stepper ---
    if (!persistedSetup) {
        return <EpSetupStepper tenantId={tenantId} initialEpConfig={initialEpConfig} />
    }

    // --- Configured (active or toggled off) → management view ---
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
                    onClick={handleToggleEnabled}
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
                        {enabled && !localReady && (
                            <div role="alert" className="flex items-center gap-2 rounded-[10px] border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.1)] px-4 py-3 text-[13px] text-[hsl(var(--warning))]">
                                <XCircle className="h-4 w-4 shrink-0" />
                                Not ready — checkout is using flat rate. Add a complete default pickup address (incl. phone) and select a courier.
                            </div>
                        )}
                        {!enabled && (
                            <div className="flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[13px] text-[var(--dash-text-muted)]">
                                <Lock className="h-4 w-4 shrink-0" />
                                EasyParcel is off — checkout uses your flat rate. Toggle on to activate.
                            </div>
                        )}
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
                            <div className="flex items-center gap-2 shrink-0">
                                {tokenDead && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => { window.location.href = `/api/tenant/${tenantId}/easyparcel-oauth-start` }}
                                        className="flex items-center gap-1.5 border-[hsl(var(--warning)/0.4)] text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.08)]"
                                    >
                                        <PlugZap className="h-3.5 w-3.5" />
                                        Reconnect
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => (hasWarehouse ? setConfirm('sync') : handleSyncFromEp())}
                                    disabled={isSyncing}
                                    className="flex items-center gap-1.5"
                                    title="Pull the default pickup address configured in your EasyParcel account"
                                >
                                    {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                    Sync from EasyParcel
                                </Button>
                            </div>
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
                <PickupAddresses value={warehouses} onChange={handleWarehousesChange} />
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
                <div className="p-6">
                    <CourierPicker tenantId={tenantId} active selected={selectedCouriers} onToggle={onToggle} />
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
