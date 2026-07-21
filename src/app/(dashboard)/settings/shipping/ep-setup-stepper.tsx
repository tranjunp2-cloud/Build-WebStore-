'use client'

import { Fragment, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2, Lock, MapPin, PlugZap, RefreshCw, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { PickupAddresses } from './pickup-addresses'
import { EpWalletBanner } from './ep-wallet-banner'
import { getDefaultWarehouse, isWarehouseComplete, normalizeWarehouses, type Warehouse } from '@/lib/shipping/easyparcel/warehouse'
import type { EasyParcelIntegrationConfig } from './easyparcel-settings-tab'
import { getEasyParcelErrorMessage } from './easyparcel-error-message'

interface Props {
    tenantId: string
    initialEpConfig: EasyParcelIntegrationConfig | null
    isSyncing?: boolean
    onSyncFromEp?: () => Promise<void>
}

/**
 * Guided setup shown after OAuth but before activation. The merchant configures a pickup address,
 * then "Save & Activate" persists the config with enabled=true. Until then EP stays off and
 * checkout uses flat rate. Reuses PickupAddresses from the management view.
 */
export function EpSetupStepper({ tenantId, initialEpConfig, isSyncing = false, onSyncFromEp }: Props) {
    const { t } = useI18n()
    const copy = t.dashboard.settings.shipping.easyParcel
    const steps = [copy.stepConnect, copy.stepPickup, copy.stepReview]
    // Step index: 0=Connect (done), 1=Pickup, 2=Review. Starts at Pickup;
    // the merchant can Back to Connect to switch account / disconnect.
    const [step, setStep] = useState(1)
    const [warehouses, setWarehouses] = useState<Warehouse[]>(normalizeWarehouses(initialEpConfig?.warehouses ?? []))
    const [isSaving, setIsSaving] = useState(false)
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const [isEditingWarehouse, setIsEditingWarehouse] = useState(warehouses.length === 0)
    const [confirmAction, setConfirmAction] = useState<null | 'disconnect' | 'sync'>(null)

    const defaultWh = getDefaultWarehouse({ warehouses })
    const pickupDone = isWarehouseComplete(defaultWh)
    const canNext = !isEditingWarehouse && (step === 0 || (step === 1 && pickupDone))
    const canActivate = pickupDone && !isEditingWarehouse

    async function handleDisconnect() {
        setIsDisconnecting(true)
        try {
            const res = await fetch(`/api/tenant/${tenantId}/easyparcel-disconnect`, { method: 'DELETE', credentials: 'include' })
            const json = await res.json()
            if (!res.ok || !json.success) {
                toast.error(getEasyParcelErrorMessage(json?.error?.code, copy, copy.disconnectFailed))
                return
            }
            toast.success(copy.disconnected)
            window.location.reload()
        } catch {
            toast.error(copy.networkError)
        } finally {
            setIsDisconnecting(false)
            setConfirmAction(null)
        }
    }

    async function handleSyncFromEp() {
        try {
            await onSyncFromEp?.()
        } finally {
            setConfirmAction(null)
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
                body: JSON.stringify({ enabled: true, warehouses }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) {
                toast.error(getEasyParcelErrorMessage(json?.error?.code, copy, copy.saveFailed))
                return
            }
            toast.success(copy.activated)
            window.location.reload()
        } catch {
            toast.error(copy.networkError)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div
            data-easyparcel-state="setup"
            className="mt-5 min-w-0 overflow-hidden rounded-[16px]"
            style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
        >
            {/* Step indicator */}
            <div className="grid grid-cols-3 gap-2 p-4 sm:flex sm:items-center sm:gap-0 sm:p-6 sm:pb-4">
                {steps.map((label, i) => {
                    const done = i < step
                    const current = i === step
                    return (
                        <Fragment key={label}>
                            <div
                                className="relative flex min-w-0 flex-col items-center gap-1.5 text-center sm:shrink-0 sm:flex-row sm:text-left"
                                aria-current={current ? 'step' : undefined}
                            >
                                {i < steps.length - 1 && (
                                    <span
                                        data-step-connector-mobile
                                        className="absolute left-[calc(50%+12px)] right-[calc(-50%+12px)] top-3 h-px bg-[var(--dash-border)] sm:hidden"
                                    />
                                )}
                                <span className={[
                                    'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-solid text-[11px] font-bold',
                                    done ? 'bg-[hsl(var(--primary))] text-white'
                                        : current ? 'border-2 border-[hsl(var(--primary))] bg-[var(--dash-surface-hover)] text-[hsl(var(--primary))]'
                                            : 'border-2 border-[var(--dash-border)] bg-[var(--dash-surface-hover)] text-[var(--dash-text-muted)]',
                                ].join(' ')}>
                                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                                </span>
                                <span className={['relative z-10 min-w-0 break-words text-[12px] font-medium sm:whitespace-nowrap sm:text-[13px]', current || done ? 'text-[var(--dash-text)]' : 'text-[var(--dash-text-muted)]'].join(' ')}>{label}</span>
                            </div>
                            {i < steps.length - 1 && (
                                <span
                                    data-step-connector-desktop
                                    className="mx-3 hidden h-px min-w-6 flex-1 bg-[var(--dash-border)] sm:block"
                                />
                            )}
                        </Fragment>
                    )
                })}
            </div>

            <div className="border-t border-[var(--dash-border)]" />

            {/* Step body */}
            <div className="p-4 sm:p-6">
                {step === 0 && (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <div className="flex items-center gap-3 min-w-0">
                                <Lock className="h-4 w-4 text-[var(--dash-text-muted)] shrink-0" />
                                <div className="min-w-0">
                                    <p className="truncate text-[13px] font-medium text-[var(--dash-text)]">{initialEpConfig?.accountName || copy.oauthActive}</p>
                                    {initialEpConfig?.accountEmail && <p className="text-[12px] text-[var(--dash-text-muted)] truncate">{initialEpConfig.accountEmail}</p>}
                                </div>
                            </div>
                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                                <Button variant="outline" size="sm" onClick={() => { window.location.href = `/api/tenant/${tenantId}/easyparcel-oauth-start` }} className="h-11 w-full gap-1.5 sm:h-9 sm:w-auto">
                                    <PlugZap className="h-3.5 w-3.5" /> {copy.reconnect}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setConfirmAction('disconnect')} disabled={isDisconnecting}
                                    className="h-11 w-full gap-1.5 border-[hsl(var(--destructive)/0.4)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)] sm:h-9 sm:w-auto">
                                    {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />} {copy.disconnect}
                                </Button>
                            </div>
                        </div>
                        <p className="text-[12px] text-[var(--dash-text-muted)]">
                            {copy.switchAccountDescription}
                        </p>
                    </div>
                )}
                {step === 1 && (
                    <div className="flex flex-col gap-4">
                        {onSyncFromEp && (
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (isEditingWarehouse || warehouses.length > 0) setConfirmAction('sync')
                                        else void handleSyncFromEp()
                                    }}
                                    disabled={isSaving || isDisconnecting || isSyncing}
                                    className="h-11 w-full gap-1.5 sm:h-9 sm:w-auto"
                                >
                                    {isSyncing
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <RefreshCw className="h-3.5 w-3.5" />}
                                    {copy.syncFromEasyParcel}
                                </Button>
                            </div>
                        )}
                        <PickupAddresses value={warehouses} onChange={setWarehouses} onEditingChange={setIsEditingWarehouse} />
                    </div>
                )}
                {step === 2 && (
                    <div className="flex flex-col gap-4">
                        <p className="text-[14px] font-semibold text-[var(--dash-text)]">{copy.reviewActivate}</p>
                        <div className="flex flex-col gap-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-[var(--dash-text-muted)] mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[13px] font-medium text-[var(--dash-text)]">{defaultWh.label || defaultWh.name || copy.pickupFallback}</p>
                                    <p className="text-[12px] text-[var(--dash-text-muted)]">
                                        {[defaultWh.address1, defaultWh.city, defaultWh.postcode, defaultWh.state].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                            </div>
                            <div className="text-[13px] text-[var(--dash-text-muted)]">{copy.automaticCourier}</div>
                        </div>
                        <EpWalletBanner tenantId={tenantId} active />
                        <p className="text-[12px] text-[var(--dash-text-muted)]">
                            {copy.activationDescription}
                        </p>
                    </div>
                )}
            </div>

            <div className="border-t border-[var(--dash-border)]" />

            {/* Footer nav */}
            <div className="flex flex-col-reverse gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                <Button variant="dashSecondary" size="dash" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0 || isSaving || isSyncing || isEditingWarehouse} className="h-11 w-full gap-1.5 sm:w-auto">
                    <ChevronLeft className="h-4 w-4" /> {copy.back}
                </Button>
                {step < steps.length - 1 ? (
                    <Button variant="dashPrimary" size="dash" onClick={() => setStep(s => s + 1)} disabled={!canNext || isSyncing} className="h-11 w-full gap-1.5 sm:w-auto">
                        {copy.next} <ChevronRight className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button variant="dashPrimary" size="dash" onClick={handleActivate} disabled={!canActivate || isSaving || isSyncing} className="h-11 w-full gap-2 sm:w-auto">
                        {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />{copy.activating}</> : <><Check className="h-4 w-4" />{copy.saveAndActivate}</>}
                    </Button>
                )}
            </div>

            <ConfirmModal
                open={confirmAction !== null}
                variant={confirmAction === 'disconnect' ? 'danger' : 'default'}
                loading={confirmAction === 'disconnect' ? isDisconnecting : isSyncing}
                icon={confirmAction === 'disconnect'
                    ? <Unlink className="h-7 w-7 text-[hsl(var(--destructive))]" />
                    : <RefreshCw className="h-7 w-7 text-[hsl(var(--primary))]" />}
                title={confirmAction === 'disconnect' ? copy.disconnectTitle : copy.syncTitle}
                description={confirmAction === 'disconnect' ? copy.disconnectDescription : copy.syncDescription}
                confirmLabel={confirmAction === 'disconnect' ? copy.disconnect : copy.sync}
                cancelLabel={copy.cancel}
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => {
                    if (confirmAction === 'disconnect') void handleDisconnect()
                    else void handleSyncFromEp()
                }}
            />
        </div>
    )
}
