'use client'

import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2, Lock, MapPin, PlugZap, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PickupAddresses } from './pickup-addresses'
import { CourierPicker } from './courier-picker'
import { getAllowedCouriers, getDefaultWarehouse, type Warehouse } from '@/lib/shipping/easyparcel/warehouse'
import type { EasyParcelIntegrationConfig } from './easyparcel-settings-tab'

interface Props {
    tenantId: string
    initialEpConfig: EasyParcelIntegrationConfig | null
}

const STEPS = ['Connect', 'Pickup', 'Courier', 'Review'] as const

/**
 * Guided setup shown after OAuth but before activation. The merchant configures a pickup address and
 * a courier, then "Save & Activate" persists the config with enabled=true. Until then EP stays off
 * and checkout uses flat rate. Reuses PickupAddresses + CourierPicker from the management view.
 */
export function EpSetupStepper({ tenantId, initialEpConfig }: Props) {
    // Step index within STEPS: 0=Connect (done), 1=Pickup, 2=Courier, 3=Review. Starts at Pickup;
    // the merchant can Back to Connect to switch account / disconnect.
    const [step, setStep] = useState(1)
    const [warehouses, setWarehouses] = useState<Warehouse[]>(initialEpConfig?.warehouses ?? [])
    const [selectedCouriers, setSelectedCouriers] = useState<string[]>(() =>
        getAllowedCouriers(initialEpConfig),
    )
    const [isSaving, setIsSaving] = useState(false)
    const [isDisconnecting, setIsDisconnecting] = useState(false)

    function onToggle(id: string) {
        setSelectedCouriers(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
    }

    const pickupDone = warehouses.length > 0
    const courierDone = selectedCouriers.length > 0
    const canNext = step === 0 || (step === 1 && pickupDone) || (step === 2 && courierDone)
    const canActivate = pickupDone && courierDone

    async function handleDisconnect() {
        setIsDisconnecting(true)
        try {
            const res = await fetch(`/api/tenant/${tenantId}/easyparcel-disconnect`, { method: 'DELETE', credentials: 'include' })
            const json = await res.json()
            if (!res.ok || !json.success) { toast.error(json?.error?.message ?? 'Disconnect failed'); return }
            toast.success('EasyParcel disconnected')
            window.location.reload()
        } catch {
            toast.error('Network error. Please try again.')
        } finally {
            setIsDisconnecting(false)
        }
    }

    async function handleActivate() {
        if (!canActivate) return
        setIsSaving(true)
        try {
            const res = await fetch(`/api/tenant/${tenantId}/easyparcel-save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ enabled: true, warehouses, selectedCouriers }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json?.error?.message ?? 'Failed to activate')
            toast.success('EasyParcel activated')
            window.location.reload()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to activate')
        } finally {
            setIsSaving(false)
        }
    }

    const defaultWh = getDefaultWarehouse({ warehouses })

    return (
        <div className="mt-5 rounded-[16px] border border-white/[0.08] bg-[hsl(var(--secondary)/0.6)] overflow-hidden">
            {/* Step indicator */}
            <div className="flex items-center gap-2 p-6 pb-4">
                {STEPS.map((label, i) => {
                    const done = i < step
                    const current = i === step
                    return (
                        <div key={label} className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <span className={[
                                    'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                                    done ? 'bg-[hsl(var(--primary))] text-white'
                                        : current ? 'border-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                                            : 'border-2 border-white/[0.15] text-[var(--dash-text-muted)]',
                                ].join(' ')}>
                                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                                </span>
                                <span className={['text-[13px] font-medium', current || done ? 'text-[var(--dash-text)]' : 'text-[var(--dash-text-muted)]'].join(' ')}>{label}</span>
                            </div>
                            {i < STEPS.length - 1 && <span className="w-6 h-px bg-white/[0.12]" />}
                        </div>
                    )
                })}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

            {/* Step body */}
            <div className="p-6">
                {step === 0 && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <Lock className="h-4 w-4 text-[var(--dash-text-muted)] shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[13px] font-medium text-[var(--dash-text)] truncate">{initialEpConfig?.accountName || 'OAuth session active'}</p>
                                    {initialEpConfig?.accountEmail && <p className="text-[12px] text-[var(--dash-text-muted)] truncate">{initialEpConfig.accountEmail}</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button variant="outline" size="sm" onClick={() => { window.location.href = `/api/tenant/${tenantId}/easyparcel-oauth-start` }} className="flex items-center gap-1.5">
                                    <PlugZap className="h-3.5 w-3.5" /> Reconnect
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={isDisconnecting}
                                    className="flex items-center gap-1.5 border-[hsl(var(--destructive)/0.4)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)]">
                                    {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />} Disconnect
                                </Button>
                            </div>
                        </div>
                        <p className="text-[12px] text-[var(--dash-text-muted)]">
                            Reconnect to switch EasyParcel account, or disconnect to cancel setup.
                        </p>
                    </div>
                )}
                {step === 1 && <PickupAddresses value={warehouses} onChange={setWarehouses} />}
                {step === 2 && <CourierPicker tenantId={tenantId} active selected={selectedCouriers} onToggle={onToggle} />}
                {step === 3 && (
                    <div className="flex flex-col gap-4">
                        <p className="text-[14px] font-semibold text-[var(--dash-text)]">Review &amp; activate</p>
                        <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col gap-3">
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-[var(--dash-text-muted)] mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[13px] font-medium text-[var(--dash-text)]">{defaultWh.label || defaultWh.name || 'Pickup address'}</p>
                                    <p className="text-[12px] text-[var(--dash-text-muted)]">
                                        {[defaultWh.address1, defaultWh.city, defaultWh.postcode, defaultWh.state].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                            </div>
                            <div className="text-[13px] text-[var(--dash-text-muted)]">
                                Checkout couriers: <span className="text-[var(--dash-text)] font-medium">
                                    {selectedCouriers.length === 0
                                        ? '—'
                                        : selectedCouriers.length <= 3
                                            ? selectedCouriers.join(', ')
                                            : `${selectedCouriers.length} couriers selected`}
                                </span>
                            </div>
                        </div>
                        <p className="text-[12px] text-[var(--dash-text-muted)]">
                            Activating turns on live EasyParcel rates at checkout. Until you activate, checkout uses your flat rate.
                        </p>
                    </div>
                )}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

            {/* Footer nav */}
            <div className="flex items-center justify-between gap-4 px-6 py-5">
                <Button variant="dashSecondary" size="dash" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0 || isSaving} className="flex items-center gap-1.5">
                    <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                {step < 3 ? (
                    <Button variant="dashPrimary" size="dash" onClick={() => setStep(s => s + 1)} disabled={!canNext} className="flex items-center gap-1.5">
                        Next <ChevronRight className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button variant="dashPrimary" size="dash" onClick={handleActivate} disabled={!canActivate || isSaving} className="flex items-center gap-2">
                        {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Activating…</> : <><Check className="h-4 w-4" />Save &amp; Activate</>}
                    </Button>
                )}
            </div>
        </div>
    )
}
