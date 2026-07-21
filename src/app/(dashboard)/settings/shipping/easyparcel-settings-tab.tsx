'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import {
    BadgePercent,
    Loader2,
    Lock,
    PlugZap,
    Printer,
    RefreshCw,
    Search,
    ShieldCheck,
    Unlink,
    Wallet,
    XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Switch } from '@/components/ui/switch'
import { PickupAddresses } from './pickup-addresses'
import { EpWalletBanner } from './ep-wallet-banner'
import { EpSetupStepper } from './ep-setup-stepper'
import { getEasyParcelErrorMessage } from './easyparcel-error-message'
import {
    getDefaultWarehouse,
    isWarehouseComplete,
    normalizeWarehouses,
    type Warehouse,
} from '@/lib/shipping/easyparcel/warehouse'

export interface EasyParcelIntegrationConfig {
    enabled?: boolean
    warehouse?: Warehouse | null
    warehouses?: Warehouse[]
    selectedCourier?: string
    testedAt?: string
    accountName?: string | null
    accountEmail?: string | null
}

type TestStatus = 'idle' | 'testing' | 'connected' | 'invalid'

function EasyParcelBrandMark() {
    return (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F9278E] sm:h-[52px] sm:w-[52px]">
            <Image
                src="/integrations/easyparcel-box.png"
                alt="EasyParcel"
                width={32}
                height={36}
                className="h-8 w-auto sm:h-9"
            />
        </div>
    )
}

interface Props {
    tenantId: string
    initialEpConfig: EasyParcelIntegrationConfig | null
    onEnabledSaved?: (enabled: boolean) => void
}

function initialWarehouses(config: EasyParcelIntegrationConfig | null): Warehouse[] {
    const warehouses = normalizeWarehouses(config?.warehouses)
    if (warehouses.length > 0) return warehouses
    const legacy = config?.warehouse
    if (!legacy || !(legacy.address1 || legacy.postcode || legacy.name)) return []
    return normalizeWarehouses([{
        ...legacy,
        id: legacy.id || 'legacy',
        label: legacy.label || legacy.name,
        isDefault: true,
    }])
}

function settingsSnapshot(enabled: boolean, warehouses: Warehouse[]): string {
    return JSON.stringify({ enabled, warehouses: normalizeWarehouses(warehouses, { defaultFirst: false }) })
}

export function EasyParcelSettingsTab({ tenantId, initialEpConfig, onEnabledSaved }: Props) {
    const { t } = useI18n()
    const copy = t.dashboard.settings.shipping.easyParcel
    const connected = !!initialEpConfig?.testedAt
    const startingWarehouses = useMemo(() => initialWarehouses(initialEpConfig), [initialEpConfig])
    const [enabled, setEnabled] = useState(initialEpConfig?.enabled ?? false)
    const [warehouses, setWarehouses] = useState<Warehouse[]>(startingWarehouses)
    const [savedSnapshot, setSavedSnapshot] = useState(() => (
        settingsSnapshot(initialEpConfig?.enabled ?? false, startingWarehouses)
    ))
    const [testStatus, setTestStatus] = useState<TestStatus>(connected ? 'connected' : 'idle')
    const [isEditingWarehouse, setIsEditingWarehouse] = useState(startingWarehouses.length === 0)
    const [isSaving, setIsSaving] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const [tokenDead, setTokenDead] = useState(false)
    const [confirm, setConfirm] = useState<null | 'disconnect' | 'sync'>(null)
    const searchParams = useSearchParams()

    useEffect(() => {
        const oauthResult = searchParams?.get('ep')
        if (oauthResult === 'connected') {
            setTestStatus('connected')
            toast.success(copy.oauthConnected)
        } else if (oauthResult === 'error') {
            toast.error(copy.oauthFailed)
        } else {
            return
        }

        const url = new URL(window.location.href)
        url.searchParams.delete('ep')
        url.searchParams.set('tab', 'easyparcel')
        window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`)
    // OAuth params are one-shot values consumed on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const canonicalWarehouses = useMemo(
        () => normalizeWarehouses(warehouses, { defaultFirst: false }),
        [warehouses],
    )
    const warehouseComplete = isWarehouseComplete(getDefaultWarehouse({ warehouses: canonicalWarehouses }))
    const localReady = warehouseComplete
    const isDirty = settingsSnapshot(enabled, canonicalWarehouses) !== savedSnapshot
    const canSave = connected
        && isDirty
        && !isSaving
        && !isSyncing
        && !isDisconnecting
        && !isEditingWarehouse
        && (!enabled || warehouseComplete)
    const hasWarehouse = canonicalWarehouses.length > 0

    function handleToggleEnabled() {
        if (!enabled && !localReady) {
            toast.error(copy.addCompleteBeforeActivating)
            return
        }
        setEnabled((current) => !current)
    }

    async function handleTestConnection() {
        setTestStatus('testing')
        try {
            const response = await fetch(`/api/tenant/${tenantId}/easyparcel-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            })
            const json = await response.json()
            if (!response.ok || !json.success) {
                const code = json?.error?.code
                if (code === 'EP_NOT_CONNECTED' || code === 'AUTH_EXPIRED') {
                    setTokenDead(true)
                }
                toast.error(getEasyParcelErrorMessage(code, copy, copy.connectionTestFailed))
                setTestStatus('idle')
                return
            }
            setTestStatus('connected')
            toast.success(copy.connectionVerified)
        } catch {
            setTestStatus('idle')
            toast.error(copy.networkError)
        }
    }

    async function handleSyncFromEp() {
        setIsSyncing(true)
        try {
            const response = await fetch(`/api/tenant/${tenantId}/easyparcel-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ syncWarehouse: true }),
            })
            const json = await response.json()
            if (!response.ok || !json.success) {
                toast.error(getEasyParcelErrorMessage(json?.error?.code, copy, copy.syncFailed))
                return
            }
            if (!json.data?.warehouseApplied) {
                toast.info(copy.noPickupInEasyParcel)
                return
            }
            toast.success(copy.syncSuccess)
            window.location.reload()
        } catch {
            toast.error(copy.networkError)
        } finally {
            setIsSyncing(false)
            setConfirm(null)
        }
    }

    async function handleDisconnect() {
        setIsDisconnecting(true)
        try {
            const response = await fetch(`/api/tenant/${tenantId}/easyparcel-disconnect`, {
                method: 'DELETE',
                credentials: 'include',
            })
            const json = await response.json()
            if (!response.ok || !json.success) {
                toast.error(getEasyParcelErrorMessage(json?.error?.code, copy, copy.disconnectFailed))
                return
            }
            toast.success(copy.disconnected)
            window.location.reload()
        } catch {
            toast.error(copy.networkError)
        } finally {
            setIsDisconnecting(false)
            setConfirm(null)
        }
    }

    function handleWarehousesChange(next: Warehouse[]) {
        const normalized = normalizeWarehouses(next, { defaultFirst: false })
        setWarehouses(normalized)
        if (normalized.length === 0) setEnabled(false)
    }

    async function handleSave() {
        if (!canSave) return
        setIsSaving(true)
        try {
            const response = await fetch(`/api/tenant/${tenantId}/easyparcel-save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ enabled, warehouses: canonicalWarehouses }),
            })
            const json = await response.json()
            if (!response.ok || !json.success) {
                toast.error(getEasyParcelErrorMessage(json?.error?.code, copy, copy.saveFailed))
                return
            }

            const savedEnabled = json.data?.enabled === true
            // Draft order stays stable until Save succeeds. The API response is canonical
            // default-first; applying it here triggers PickupAddresses' layout animation.
            const savedWarehouses = normalizeWarehouses(json.data?.warehouses ?? canonicalWarehouses)
            setEnabled(savedEnabled)
            setWarehouses(savedWarehouses)
            setSavedSnapshot(settingsSnapshot(savedEnabled, savedWarehouses))
            onEnabledSaved?.(savedEnabled)
            toast.success(copy.settingsSaved)
        } catch {
            toast.error(copy.networkError)
        } finally {
            setIsSaving(false)
        }
    }

    const persistedSetup = startingWarehouses.length > 0
    const benefits = [
        { icon: BadgePercent, title: copy.benefitRatesTitle, description: copy.benefitRatesDescription },
        { icon: Wallet, title: copy.benefitWalletTitle, description: copy.benefitWalletDescription },
        { icon: Printer, title: copy.benefitLabelsTitle, description: copy.benefitLabelsDescription },
        { icon: ShieldCheck, title: copy.benefitFallbackTitle, description: copy.benefitFallbackDescription },
    ]

    if (!connected) {
        return (
            <div
                data-easyparcel-state="disconnected"
                className="mt-5 min-w-0 overflow-hidden rounded-[16px]"
                style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
            >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                        <EasyParcelBrandMark />
                        <div className="min-w-0">
                            <h3 className="text-[18px] font-bold text-[var(--dash-text)]">{copy.connectTitle}</h3>
                            <p className="mt-1 break-words text-[13px] leading-relaxed text-[var(--dash-text-muted)]">{copy.connectDescription}</p>
                        </div>
                    </div>
                    <span className="w-fit shrink-0 rounded-full bg-[var(--dash-surface)] px-3 py-1 text-[12px] font-semibold text-[var(--dash-text-muted)]">
                        {copy.statusOff}
                    </span>
                </div>

                <div className="border-t border-[var(--dash-border)]" />
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-6">
                    {benefits.map(({ icon: Icon, title, description }, index) => (
                        <div key={title || index} className="flex min-w-0 items-start gap-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--primary)/0.15)] bg-[hsl(var(--primary)/0.1)]">
                                <Icon className="h-4 w-4 text-[hsl(var(--primary))]" />
                            </div>
                            <div className="min-w-0">
                                <p className="break-words text-[13px] font-semibold text-[var(--dash-text)]">{title}</p>
                                <p className="mt-1 break-words text-[12px] leading-relaxed text-[var(--dash-text-muted)]">{description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-[var(--dash-border)]" />
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
                    <Button variant="dashPrimary" size="dash"
                        onClick={() => { window.location.href = `/api/tenant/${tenantId}/easyparcel-oauth-start` }}
                        className="h-11 w-full gap-2 sm:w-auto">
                        <PlugZap className="h-4 w-4" /> {copy.setupConnection}
                    </Button>
                    <p className="text-[13px] leading-relaxed text-[var(--dash-text-muted)]">{copy.flatRateWhileOff}</p>
                </div>
            </div>
        )
    }

    if (!persistedSetup) {
        return (
            <EpSetupStepper
                tenantId={tenantId}
                initialEpConfig={initialEpConfig}
                isSyncing={isSyncing}
                onSyncFromEp={handleSyncFromEp}
            />
        )
    }

    return (
        <div
            data-easyparcel-state="management"
            className="mt-5 min-w-0 overflow-hidden rounded-[16px]"
            style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
        >
            <div
                data-testid="easyparcel-connected-header"
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 p-4 sm:gap-4 sm:p-6"
            >
                <div className="self-center">
                    <EasyParcelBrandMark />
                </div>
                <div className="min-w-0">
                    <h3 className="text-[18px] font-bold text-[var(--dash-text)]">{copy.connectTitle}</h3>
                    <p className="mt-1 break-words text-[13px] leading-relaxed text-[var(--dash-text-muted)]">{copy.connectDescription}</p>
                </div>
                <Switch
                    checked={enabled}
                    onCheckedChange={handleToggleEnabled}
                    disabled={isSaving || isSyncing || isDisconnecting}
                    aria-label={copy.toggleLabel}
                    className="mt-1 shrink-0"
                />
            </div>

            <div className="border-t border-[var(--dash-border)]" />
            <div className="flex flex-col gap-4 p-4 sm:p-6">
                {enabled && !localReady && (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.1)] px-4 py-3 text-[13px] leading-relaxed text-[hsl(var(--warning))]">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {copy.notReadyNotice}
                    </div>
                )}
                {!enabled && (
                    <div className="flex items-start gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-3 text-[13px] leading-relaxed text-[var(--dash-text-muted)]">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0" /> {copy.offNotice}
                    </div>
                )}
                <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                        <Lock className="h-4 w-4 shrink-0 text-[var(--dash-text-muted)]" />
                        <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-[var(--dash-text)]">{initialEpConfig?.accountName || copy.oauthActive}</p>
                            {initialEpConfig?.accountEmail && <p className="truncate text-[12px] text-[var(--dash-text-muted)]">{initialEpConfig.accountEmail}</p>}
                        </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        {tokenDead && (
                            <Button variant="outline" size="sm" onClick={() => { window.location.href = `/api/tenant/${tenantId}/easyparcel-oauth-start` }}
                                className="h-11 w-full gap-1.5 border-[hsl(var(--warning)/0.4)] text-[hsl(var(--warning))] sm:h-9 sm:w-auto">
                                <PlugZap className="h-3.5 w-3.5" /> {copy.reconnect}
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => (hasWarehouse ? setConfirm('sync') : handleSyncFromEp())}
                            disabled={isSaving || isSyncing || isDisconnecting} title={copy.syncTooltip} className="h-11 w-full gap-1.5 sm:h-9 sm:w-auto">
                            {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            {copy.syncFromEasyParcel}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setConfirm('disconnect')} disabled={isSaving || isSyncing || isDisconnecting}
                            className="h-11 w-full gap-1.5 border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.06)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.12)] sm:h-9 sm:w-auto">
                            {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                            {copy.disconnect}
                        </Button>
                    </div>
                </div>
                <EpWalletBanner tenantId={tenantId} active />

                {testStatus === 'invalid' && (
                    <div role="alert" className="flex items-center gap-2 rounded-lg border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-4 py-3 text-[13px] text-[hsl(var(--destructive))]">
                        <XCircle className="h-4 w-4 shrink-0" /> {copy.connectionFailedInline}
                    </div>
                )}
            </div>

            <div className="border-t border-[var(--dash-border)]" />
            <div className="flex flex-col gap-5 p-4 sm:p-6" style={{ opacity: testStatus === 'testing' ? 0.5 : 1, pointerEvents: testStatus === 'testing' ? 'none' : undefined }}>
                <PickupAddresses
                    value={canonicalWarehouses}
                    onChange={handleWarehousesChange}
                    onEditingChange={setIsEditingWarehouse}
                    active={enabled}
                />
            </div>

            {!isEditingWarehouse && (isDirty || (enabled && !warehouseComplete)) && (
                <>
                    <div className="border-t border-[var(--dash-border)]" />
                    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6 sm:py-5">
                        {testStatus !== 'connected' ? (
                            <Button variant="dashPrimary" size="dash" onClick={handleTestConnection} disabled={testStatus === 'testing'} className="h-11 w-full gap-2 sm:w-auto">
                                {testStatus === 'testing' ? <><Loader2 className="h-4 w-4 animate-spin" />{copy.testingConnection}</> : <><Search className="h-4 w-4" />{copy.testConnection}</>}
                            </Button>
                        ) : (
                            <Button variant="dashPrimary" size="dash" onClick={handleSave} disabled={!canSave} className="h-11 w-full gap-2 sm:w-auto">
                                {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />{copy.saving}</> : copy.saveSettings}
                            </Button>
                        )}
                        {enabled && !warehouseComplete && <p className="text-[12px] text-[hsl(var(--destructive))]">{copy.completePickupFirst}</p>}
                    </div>
                </>
            )}

            <ConfirmModal
                open={confirm !== null}
                variant={confirm === 'disconnect' ? 'danger' : 'default'}
                loading={confirm === 'disconnect' ? isDisconnecting : isSyncing}
                icon={confirm === 'disconnect'
                    ? <Unlink className="h-7 w-7 text-[hsl(var(--destructive))]" />
                    : <RefreshCw className="h-7 w-7 text-[hsl(var(--primary))]" />}
                title={confirm === 'disconnect' ? copy.disconnectTitle : copy.syncTitle}
                description={confirm === 'disconnect' ? copy.disconnectDescription : copy.syncDescription}
                confirmLabel={confirm === 'disconnect' ? copy.disconnect : copy.sync}
                cancelLabel={copy.cancel}
                onCancel={() => setConfirm(null)}
                onConfirm={() => { if (confirm === 'disconnect') handleDisconnect(); else handleSyncFromEp() }}
            />
        </div>
    )
}
