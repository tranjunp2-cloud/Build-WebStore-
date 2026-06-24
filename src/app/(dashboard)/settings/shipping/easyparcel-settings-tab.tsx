'use client'

import { useState } from 'react'
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, ShieldCheck, Zap, Timer, Wallet, Printer, MapPin, Lock, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MY_STATES } from '@/lib/shipping'

interface WarehouseData {
    name?: string
    phone?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
}

export interface EasyParcelIntegrationConfig {
    enabled?: boolean
    // apiKey and authKey are NEVER returned from server
    detectedEnv?: 'production' | 'demo'
    warehouse?: WarehouseData | null
    selectedCourier?: string
    testedAt?: string
}

type TestStatus = 'idle' | 'testing' | 'connected' | 'invalid'

interface Props {
    tenantId: string
    initialEpConfig: EasyParcelIntegrationConfig | null
}

const COURIERS = [
    { id: 'flash', name: 'Flash Express', description: 'Fast nationwide delivery' },
    { id: 'jnt', name: 'J&T Express', description: 'Reliable door-to-door' },
    { id: 'poslaju', name: 'Pos Laju', description: 'Malaysia postal express' },
    { id: 'dhl', name: 'DHL eCommerce', description: 'Trusted global courier' },
] as const

const BENEFIT_TILES = [
    { icon: Timer, title: 'Live courier rates', desc: 'Quote J&T, Pos Laju, Ninja Van and more in real time at checkout.' },
    { icon: Wallet, title: 'No platform markup', desc: 'Shipping is deducted straight from your own EasyParcel wallet.' },
    { icon: Printer, title: 'One-click AWB labels', desc: 'Generate air waybills and book pickups without leaving an order.' },
    { icon: ShieldCheck, title: 'Flat-rate safety net', desc: 'Your flat rates stay on as an automatic fallback if the API ever fails.' },
]

export function EasyParcelSettingsTab({ tenantId, initialEpConfig }: Props) {
    const [enabled, setEnabled] = useState(initialEpConfig?.enabled ?? false)
    const [apiKey, setApiKey] = useState('')
    const [authKey, setAuthKey] = useState('')
    const [showApiKey, setShowApiKey] = useState(false)
    const [showAuthKey, setShowAuthKey] = useState(false)
    const [testStatus, setTestStatus] = useState<TestStatus>(
        initialEpConfig?.testedAt ? 'connected' : 'idle',
    )
    const [detectedEnv, setDetectedEnv] = useState<'production' | 'demo' | undefined>(
        initialEpConfig?.detectedEnv,
    )

    // Warehouse fields
    const wh = initialEpConfig?.warehouse ?? {}
    const [whName, setWhName] = useState(wh.name ?? '')
    const [whPhone, setWhPhone] = useState(wh.phone ?? '')
    const [whAddr1, setWhAddr1] = useState(wh.address1 ?? '')
    const [whAddr2, setWhAddr2] = useState(wh.address2 ?? '')
    const [whCity, setWhCity] = useState(wh.city ?? '')
    const [whState, setWhState] = useState(wh.state ?? '')
    const [whPostcode, setWhPostcode] = useState(wh.postcode ?? '')

    const [selectedCourier, setSelectedCourier] = useState(
        initialEpConfig?.selectedCourier ?? 'flash',
    )

    const [isSaving, setIsSaving] = useState(false)
    const [editingCredentials, setEditingCredentials] = useState(false)
    const [showAddressForm, setShowAddressForm] = useState(
        !(initialEpConfig?.warehouse?.name || initialEpConfig?.warehouse?.address1),
    )

    // Credentials already set (server never returns them, but testedAt signals they exist)
    const credentialsAlreadySet = Boolean(initialEpConfig?.testedAt)

    const canSave = testStatus === 'connected' && !isSaving

    async function handleTestConnection() {
        // Allow re-test only if new keys entered, or credentials already set (re-test with existing keys not possible client-side)
        const usingNewKeys = apiKey.trim() !== '' || authKey.trim() !== ''
        if (!usingNewKeys && !credentialsAlreadySet) {
            toast.error('Enter your API Key and Auth Key first')
            return
        }
        // If credentials already set and no new keys, skip — can't re-test without keys on client
        if (!usingNewKeys && credentialsAlreadySet) {
            toast.info('Connection already verified. Enter new credentials to re-test.')
            return
        }

        setTestStatus('testing')
        try {
            const res = await fetch(`/api/tenant/${tenantId}/easyparcel-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ apiKey: apiKey.trim(), authKey: authKey.trim() }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) {
                const code = json?.error?.code
                if (code === 'INVALID_KEY') {
                    setTestStatus('invalid')
                } else {
                    setTestStatus('idle')
                    toast.error(json?.error?.message ?? 'Connection test failed')
                }
                return
            }
            setDetectedEnv(json.data.env)
            setTestStatus('connected')
            setEditingCredentials(false)
            toast.success(`Connected to EasyParcel (${json.data.env})`)
        } catch {
            setTestStatus('idle')
            toast.error('Network error. Please try again.')
        }
    }

    async function handleSave() {
        if (!canSave) return
        setIsSaving(true)
        try {
            const data: Record<string, unknown> = {
                easyParcelIntegration: {
                    enabled,
                    warehouse: {
                        name: whName,
                        phone: whPhone,
                        address1: whAddr1,
                        address2: whAddr2,
                        city: whCity,
                        state: whState,
                        postcode: whPostcode,
                        country: 'MY',
                    },
                    selectedCourier,
                    // Include new keys only if user entered them
                    ...(apiKey.trim() !== '' ? { apiKey: apiKey.trim() } : {}),
                    ...(authKey.trim() !== '' ? { authKey: authKey.trim() } : {}),
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
            // Clear sensitive fields after save
            setApiKey('')
            setAuthKey('')
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
                        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.2)] shrink-0">
                            <Zap className="h-6 w-6 text-[rgb(16,185,129)]" />
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
                        onClick={() => setEnabled(true)}
                        className="flex items-center gap-2 shrink-0"
                        style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', color: '#fff', fontWeight: 600, borderRadius: 10, padding: '10px 20px' }}
                    >
                        <Zap className="h-4 w-4" />
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
    const hasWarehouse = !!(whName || whAddr1 || whPostcode)
    const credentialsLocked = testStatus === 'connected' && !editingCredentials
    const warehouseAddress = [whAddr1, whAddr2, whCity, whPostcode, whState].filter(Boolean).join(', ')

    return (
        <div className="mt-5 rounded-[16px] border border-white/[0.08] bg-[hsl(var(--secondary)/0.6)] overflow-hidden">

            {/* ─── Header ───────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 p-6">
                <div className="flex items-center gap-4">
                    <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.2)] shrink-0">
                        <Zap className="h-6 w-6 text-[rgb(16,185,129)]" />
                    </div>
                    <div>
                        <h3 className="text-[18px] font-bold text-[var(--dash-text)]">Connect EasyParcel</h3>
                        <p className="mt-1 text-[13px] text-[var(--dash-text-muted)]">
                            Each store uses its own EasyParcel account. Charges are deducted straight from your wallet — no platform markup.
                        </p>
                    </div>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable EasyParcel" />
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

            {/* ─── API Credentials ──────────────────────────── */}
            <div className="p-6 flex flex-col gap-4">
                {credentialsLocked ? (
                    <div className="flex items-center justify-between gap-4 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                        <div className="flex items-center gap-3">
                            <Lock className="h-4 w-4 text-[var(--dash-text-muted)] shrink-0" />
                            <div>
                                <p className="text-[13px] font-medium text-[var(--dash-text)]">Credentials locked while connected</p>
                                {detectedEnv && (
                                    <p className="text-[12px] text-[var(--dash-text-muted)]">
                                        Environment: <span className="text-[rgb(16,185,129)]">{detectedEnv}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setEditingCredentials(true); setTestStatus('idle') }}
                            className="flex items-center gap-1.5 shrink-0"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit credentials
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="ep-api-key" className="text-[13px] text-[var(--dash-text)]">API Key</Label>
                                    <span className="text-[11px] text-[var(--dash-text-muted)]">ⓘ Field: api</span>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="ep-api-key"
                                        type={showApiKey ? 'text' : 'password'}
                                        autoComplete="off"
                                        placeholder={credentialsAlreadySet ? '•••••••••••••••••' : 'Enter API Key'}
                                        value={apiKey}
                                        onChange={e => { setApiKey(e.target.value); if (testStatus !== 'idle') setTestStatus('idle') }}
                                        className="pr-10 min-h-[44px] rounded-[10px]"
                                    />
                                    <button type="button" aria-label={showApiKey ? 'Hide API Key' : 'Show API Key'}
                                        onClick={() => setShowApiKey(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors">
                                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="ep-auth-key" className="text-[13px] text-[var(--dash-text)]">Auth Key</Label>
                                    <span className="text-[11px] text-[var(--dash-text-muted)]">ⓘ Field: authentication</span>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="ep-auth-key"
                                        type={showAuthKey ? 'text' : 'password'}
                                        autoComplete="off"
                                        placeholder={credentialsAlreadySet ? '•••••••••••••••••' : 'Enter Auth Key'}
                                        value={authKey}
                                        onChange={e => { setAuthKey(e.target.value); if (testStatus !== 'idle') setTestStatus('idle') }}
                                        className="pr-10 min-h-[44px] rounded-[10px]"
                                    />
                                    <button type="button" aria-label={showAuthKey ? 'Hide Auth Key' : 'Show Auth Key'}
                                        onClick={() => setShowAuthKey(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors">
                                        {showAuthKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {testStatus === 'invalid' && (
                            <div role="alert" className="flex items-center gap-2 rounded-[10px] border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-4 py-3 text-[13px] text-[hsl(var(--destructive))]">
                                <XCircle className="h-4 w-4 shrink-0" />
                                Invalid credentials. Please check your API Key and Auth Key in your EasyParcel dashboard.
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <Button variant="outline" onClick={handleTestConnection} disabled={testStatus === 'testing'} className="min-w-[160px]">
                                {testStatus === 'testing' ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Testing connection…</>
                                ) : editingCredentials ? (
                                    'Re-test Connection'
                                ) : (
                                    'Test Connection'
                                )}
                            </Button>
                            <p className="text-[11px] text-[var(--dash-text-muted)]">
                                EasyParcel requires identity verification on their platform. Prime does not handle KYC.
                            </p>
                        </div>
                    </>
                )}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

            {/* ─── Pickup Addresses ─────────────────────────── */}
            <div className="p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[14px] font-semibold text-[var(--dash-text)]">
                            Pickup addresses <span className="text-[var(--dash-text-muted)] font-normal">· origin</span>
                        </p>
                        <p className="mt-1 text-[12px] text-[var(--dash-text-muted)]">
                            Saved warehouse / pickup locations — used for calculating charges &amp; arranging pickup. PrimeWeb keeps them for you; the postcode validates during &ldquo;Test connection&rdquo;.
                        </p>
                    </div>
                    {hasWarehouse && !showAddressForm && (
                        <Button variant="outline" size="sm" onClick={() => setShowAddressForm(true)} className="shrink-0">
                            + Add address
                        </Button>
                    )}
                </div>

                {/* Address card */}
                {hasWarehouse && !showAddressForm && (
                    <div className="flex items-start gap-3 rounded-[12px] border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.05)] p-4">
                        <div className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-[hsl(var(--primary))]">
                            <div className="h-[8px] w-[8px] rounded-full bg-[hsl(var(--primary))]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[13px] font-semibold text-[var(--dash-text)]">{whName || 'Pickup Warehouse'}</span>
                                <span style={{ background: 'rgba(16,185,129,0.15)', color: 'rgb(16,185,129)', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Active</span>
                            </div>
                            {warehouseAddress && (
                                <p className="mt-0.5 text-[12px] text-[var(--dash-text-muted)]">{warehouseAddress}</p>
                            )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowAddressForm(true)} className="text-[12px] shrink-0">
                            Edit
                        </Button>
                    </div>
                )}

                {/* Add / Edit inline form */}
                {(showAddressForm || !hasWarehouse) && (
                    <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-5 flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
                            <span className="text-[11px] font-bold tracking-widest text-[var(--dash-text-muted)] uppercase">
                                {hasWarehouse ? 'Edit pickup address' : 'Add pickup address'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="wh-name" className="text-[12px] text-[var(--dash-text)]">Label</Label>
                                <Input id="wh-name" value={whName} onChange={e => setWhName(e.target.value)}
                                    placeholder="e.g. HQ Warehouse" className="min-h-[40px] rounded-[10px]" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="wh-phone" className="text-[12px] text-[var(--dash-text)]">Phone</Label>
                                <Input id="wh-phone" value={whPhone} onChange={e => setWhPhone(e.target.value)}
                                    placeholder="e.g. 601112345678" className="min-h-[40px] rounded-[10px]" />
                            </div>
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="wh-addr1" className="text-[12px] text-[var(--dash-text)]">Address line 1</Label>
                                <Input id="wh-addr1" value={whAddr1} onChange={e => setWhAddr1(e.target.value)}
                                    placeholder="Address line 1" className="min-h-[40px] rounded-[10px]" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="wh-state" className="text-[12px] text-[var(--dash-text)]">State</Label>
                                <select id="wh-state" value={whState} onChange={e => setWhState(e.target.value)}
                                    className="min-h-[40px] rounded-[10px] border border-input bg-background px-3 text-[14px] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-ring">
                                    <option value="">State</option>
                                    {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="wh-city" className="text-[12px] text-[var(--dash-text)]">City</Label>
                                <Input id="wh-city" value={whCity} onChange={e => setWhCity(e.target.value)}
                                    placeholder="City" className="min-h-[40px] rounded-[10px]" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="wh-postcode" className="text-[12px] text-[var(--dash-text)]">Postcode</Label>
                                <Input id="wh-postcode" value={whPostcode} onChange={e => setWhPostcode(e.target.value)}
                                    placeholder="e.g. 47500" className="min-h-[40px] rounded-[10px]" maxLength={5} inputMode="numeric" />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-1">
                            {hasWarehouse && (
                                <Button variant="ghost" size="sm" onClick={() => setShowAddressForm(false)}>Cancel</Button>
                            )}
                            <Button size="sm" onClick={() => setShowAddressForm(false)}
                                style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', color: '#fff', fontWeight: 600 }}
                                className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {hasWarehouse ? 'Update address' : 'Add address'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

            {/* ─── Courier picker ────────────────────────────── */}
            <div className="p-6 flex flex-col gap-4">
                <div>
                    <p className="text-[14px] font-semibold text-[var(--dash-text)]">
                        Courier for checkout <span className="text-[var(--dash-text-muted)] font-normal">· Pick one</span>
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--dash-text-muted)]">
                        Buyers are quoted this courier's live rate. All listed couriers support COD.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {COURIERS.map(courier => {
                        const isSelected = selectedCourier === courier.id
                        return (
                            <button key={courier.id} type="button" role="radio" aria-checked={isSelected}
                                onClick={() => setSelectedCourier(courier.id)}
                                className={[
                                    'flex items-center gap-3 rounded-[12px] border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
                                    isSelected
                                        ? 'border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--primary)/0.08)]'
                                        : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15]',
                                ].join(' ')}>
                                <div className={['flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border-2',
                                    isSelected ? 'border-[hsl(var(--primary))]' : 'border-white/[0.3]'].join(' ')}>
                                    {isSelected && <div className="h-[7px] w-[7px] rounded-full bg-[hsl(var(--primary))]" />}
                                </div>
                                <div>
                                    <p className={['text-[13px] font-semibold',
                                        isSelected ? 'text-[hsl(var(--primary))]' : 'text-[var(--dash-text)]'].join(' ')}>
                                        {courier.name}
                                    </p>
                                    <p className="text-[11px] text-[var(--dash-text-muted)]">{courier.description}</p>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

            {/* ─── Save footer ──────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 px-6 py-5">
                <p className="text-[12px] text-[var(--dash-text-muted)]">
                    {testStatus !== 'connected'
                        ? 'Test the connection successfully to enable saving.'
                        : 'Settings saved to your tenant profile.'}
                </p>
                <Button onClick={handleSave} disabled={!canSave}>
                    {isSaving ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                    ) : (
                        'Save Settings'
                    )}
                </Button>
            </div>
        </div>
    )
}
