'use client'

import { useEffect, useState } from 'react'
import { MapPin, Check, Star, Pencil, Trash2, Plus, AlertTriangle } from 'lucide-react'

// EasyParcel COD is West-Malaysia domestic only — an East-MY origin can't collect COD via courier.
const EAST_MY_STATES = new Set(['Sabah', 'Sarawak', 'Labuan'])
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { Warehouse } from '@/lib/shipping/easyparcel/warehouse'

const EP_INPUT = "w-full h-9 rounded-md px-3 text-[13px] outline-none transition-colors [border:1px_solid_hsl(var(--input-border))] focus:[border-color:hsl(var(--primary))] focus:[box-shadow:0_0_0_3px_hsl(var(--ring)/0.25)] placeholder:text-[var(--dash-text-muted)] disabled:cursor-not-allowed disabled:opacity-50"
const EP_INPUT_STYLE = { background: 'transparent', color: 'var(--dash-text)' } as const

type GeoState = { id: number; name: string }
type GeoDistrict = { id: number; name: string }

const emptyForm = { label: '', phone: '', address1: '', city: '', state: '', postcode: '', isDefault: false }
type FormState = typeof emptyForm

/** Label shown on a saved card (new shape uses `label`, legacy used `name`). */
function whLabel(w: Warehouse): string {
    return w.label || w.name || 'Pickup address'
}
function whAddressLine(w: Warehouse): string {
    return [w.address1, w.city, w.postcode, w.state].filter(Boolean).join(', ')
}

interface PickupAddressesProps {
    value: Warehouse[]
    onChange: (warehouses: Warehouse[]) => void
}

/**
 * Manage the tenant's EasyParcel pickup addresses (origins). One is the default couriers collect
 * from; the order flow uses it as the shipment sender. Phone is required because EP's submit_orders
 * mandates a sender phone, even though it isn't shown in the hifi mock.
 */
export function PickupAddresses({ value, onChange }: PickupAddressesProps) {
    const warehouses = Array.isArray(value) ? value : []

    // When no pickup address exists yet (e.g. EP account had none to sync), open the add form by default.
    const [formOpen, setFormOpen] = useState(warehouses.length === 0)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<FormState>(warehouses.length === 0 ? { ...emptyForm, isDefault: true } : emptyForm)

    // Geo cascade: state → city → postcode
    const [states, setStates] = useState<GeoState[]>([])
    const [statesLoading, setStatesLoading] = useState(true)
    const [selectedStateId, setSelectedStateId] = useState('')
    const [districts, setDistricts] = useState<GeoDistrict[]>([])
    const [districtsLoading, setDistrictsLoading] = useState(false)
    const [selectedDistrictId, setSelectedDistrictId] = useState('')
    const [postcodeOpts, setPostcodeOpts] = useState<string[]>([])
    const [postcodesLoading, setPostcodesLoading] = useState(false)

    useEffect(() => {
        fetch('/api/geo/states')
            .then(r => r.json())
            .then(data => setStates(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setStatesLoading(false))
    }, [])

    // When the form opens for editing, reconcile the geo selects to the saved state/city.
    useEffect(() => {
        if (!formOpen || states.length === 0 || !form.state) return
        const st = states.find(s => s.name === form.state)
        if (!st) return
        setSelectedStateId(String(st.id))
        setDistrictsLoading(true)
        fetch(`/api/geo/districts?stateId=${st.id}`)
            .then(r => r.json())
            .then((data: GeoDistrict[]) => {
                const list = Array.isArray(data) ? data : []
                setDistricts(list)
                const d = list.find(x => x.name === form.city)
                if (d) {
                    setSelectedDistrictId(String(d.id))
                    setPostcodesLoading(true)
                    fetch(`/api/geo/postcodes?districtId=${d.id}`)
                        .then(r => r.json())
                        .then(p => setPostcodeOpts(Array.isArray(p) ? p : []))
                        .catch(() => {})
                        .finally(() => setPostcodesLoading(false))
                }
            })
            .catch(() => {})
            .finally(() => setDistrictsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formOpen, states])

    function handleStateChange(stateId: string) {
        setSelectedStateId(stateId)
        const st = states.find(s => s.id === Number(stateId))
        setForm(f => ({ ...f, state: st?.name || '', city: '', postcode: '' }))
        setSelectedDistrictId('')
        setDistricts([])
        setPostcodeOpts([])
        if (!stateId) return
        setDistrictsLoading(true)
        fetch(`/api/geo/districts?stateId=${stateId}`)
            .then(r => r.json())
            .then(data => setDistricts(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setDistrictsLoading(false))
    }

    function handleDistrictChange(districtId: string) {
        setSelectedDistrictId(districtId)
        const d = districts.find(x => x.id === Number(districtId))
        setForm(f => ({ ...f, city: d?.name || '', postcode: '' }))
        setPostcodeOpts([])
        if (!districtId) return
        setPostcodesLoading(true)
        fetch(`/api/geo/postcodes?districtId=${districtId}`)
            .then(r => r.json())
            .then(data => setPostcodeOpts(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setPostcodesLoading(false))
    }

    function resetForm() {
        setForm(emptyForm)
        setEditingId(null)
        setFormOpen(false)
        setSelectedStateId('')
        setSelectedDistrictId('')
        setDistricts([])
        setPostcodeOpts([])
    }

    function openAdd() {
        setForm({ ...emptyForm, isDefault: warehouses.length === 0 })
        setEditingId(null)
        setSelectedStateId('')
        setSelectedDistrictId('')
        setDistricts([])
        setPostcodeOpts([])
        setFormOpen(true)
    }

    function openEdit(w: Warehouse) {
        setForm({
            label: whLabel(w),
            phone: w.phone || '',
            address1: w.address1 || '',
            city: w.city || '',
            state: w.state || '',
            postcode: w.postcode || '',
            isDefault: !!w.isDefault,
        })
        setEditingId(w.id ?? null)
        setFormOpen(true)
    }

    const phoneDigits = form.phone.replace(/\D/g, '')
    const formErrors: string[] = []
    if (!form.label.trim()) formErrors.push('Label')
    if (!phoneDigits || phoneDigits.length < 8) formErrors.push('Phone')
    if (!form.address1.trim()) formErrors.push('Address line 1')
    if (!form.state.trim()) formErrors.push('State')
    if (!form.postcode.trim()) formErrors.push('Postcode')
    const formValid = formErrors.length === 0

    function commit() {
        if (!formValid) return
        const entry: Warehouse = {
            id: editingId ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(warehouses.length + 1)),
            label: form.label.trim(),
            phone: form.phone.trim(),
            address1: form.address1.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            postcode: form.postcode.trim(),
            country: 'MY',
            isDefault: form.isDefault,
        }
        let next = editingId
            ? warehouses.map(w => (w.id === editingId ? entry : w))
            : [...warehouses, entry]
        // Exactly one default: if this entry is default, clear others. If none is default, force first.
        if (entry.isDefault) next = next.map(w => ({ ...w, isDefault: w.id === entry.id }))
        if (!next.some(w => w.isDefault) && next.length > 0) next[0] = { ...next[0], isDefault: true }
        onChange(next)
        resetForm()
    }

    function remove(id: string | undefined) {
        let next = warehouses.filter(w => w.id !== id)
        if (!next.some(w => w.isDefault) && next.length > 0) next[0] = { ...next[0], isDefault: true }
        onChange(next)
    }

    function setDefault(id: string | undefined) {
        onChange(warehouses.map(w => ({ ...w, isDefault: w.id === id })))
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[14px] font-semibold text-[var(--dash-text)]">
                        Pickup addresses <span className="text-[var(--dash-text-muted)] font-normal">· origin</span>
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--dash-text-muted)]">
                        Saved warehouse / pickup locations — used for calculating charges &amp; arranging pickup. Pick which one couriers collect from. The postcode validates during &ldquo;Test connection&rdquo;.
                    </p>
                </div>
                {!formOpen && (
                    <Button variant="outline" size="sm" onClick={openAdd} className="shrink-0 flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Add address
                    </Button>
                )}
            </div>

            {/* East-Malaysia origin warning: EasyParcel COD is West-MY domestic only. */}
            {(() => {
                const dw = warehouses.find(w => w.isDefault) ?? warehouses[0]
                if (!dw || !EAST_MY_STATES.has((dw.state ?? '').trim())) return null
                return (
                    <div className="flex items-start gap-2 rounded-[10px] border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.08)] px-4 py-3 text-[12px] text-[hsl(var(--warning))]">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-px" />
                        <span>Cash on Delivery via EasyParcel isn’t available from East Malaysia (Sabah / Sarawak / Labuan). COD orders will fall back to standard delivery — you arrange delivery and collect cash yourself.</span>
                    </div>
                )
            })()}

            {/* Saved address cards */}
            {warehouses.map(w => {
                const selected = !!w.isDefault
                return (
                    <div key={w.id ?? whLabel(w)}
                        className={[
                            'flex items-start gap-3 rounded-[12px] border p-4',
                            selected ? 'border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.05)]' : 'border-white/[0.08] bg-white/[0.02]',
                        ].join(' ')}>
                        <button type="button" onClick={() => setDefault(w.id)} aria-label="Set as default pickup"
                            className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2"
                            style={{ borderColor: selected ? 'hsl(var(--primary))' : 'hsl(var(--input-border))' }}>
                            {selected && <span className="h-[8px] w-[8px] rounded-full bg-[hsl(var(--primary))]" />}
                        </button>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[13px] font-semibold text-[var(--dash-text)]">{whLabel(w)}</span>
                                {selected && (
                                    <span className="flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--primary))]">
                                        <Star className="h-3 w-3" /> Default
                                    </span>
                                )}
                            </div>
                            {whAddressLine(w) && <p className="mt-0.5 text-[12px] text-[var(--dash-text-muted)]">{whAddressLine(w)}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => openEdit(w)} aria-label="Edit pickup address"
                                className="p-1.5 rounded-md text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] hover:bg-white/[0.05]">
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => remove(w.id)} aria-label="Delete pickup address"
                                className="p-1.5 rounded-md text-[var(--dash-text-muted)] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)]">
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                )
            })}

            {/* Add / Edit form */}
            {formOpen && (
                <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
                        <span className="text-[11px] font-bold tracking-widest text-[var(--dash-text-muted)] uppercase">
                            {editingId ? 'Edit pickup address' : 'Add pickup address'}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="pa-label" className="text-[12px] text-[var(--dash-text)]">Label</Label>
                            <input id="pa-label" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                                placeholder="e.g. HQ Warehouse" className={EP_INPUT} style={EP_INPUT_STYLE} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="pa-phone" className="text-[12px] text-[var(--dash-text)]">
                                Sender phone <span className="text-[hsl(var(--destructive))]">*</span>
                            </Label>
                            <input id="pa-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                inputMode="tel" placeholder="e.g. 0123456789" className={EP_INPUT} style={EP_INPUT_STYLE} />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="pa-addr1" className="text-[12px] text-[var(--dash-text)]">Address line 1</Label>
                        <input id="pa-addr1" value={form.address1} onChange={e => setForm(f => ({ ...f, address1: e.target.value }))}
                            placeholder="Address line 1" className={EP_INPUT} style={EP_INPUT_STYLE} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="pa-state" className="text-[12px] text-[var(--dash-text)]">State</Label>
                            <select id="pa-state" value={selectedStateId} onChange={e => handleStateChange(e.target.value)} disabled={statesLoading}
                                className={EP_INPUT} style={EP_INPUT_STYLE}>
                                <option value="">{statesLoading ? 'Loading…' : '— Select State —'}</option>
                                {states.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="pa-city" className="text-[12px] text-[var(--dash-text)]">City</Label>
                            <select id="pa-city" value={selectedDistrictId} onChange={e => handleDistrictChange(e.target.value)} disabled={!selectedStateId || districtsLoading}
                                className={EP_INPUT} style={EP_INPUT_STYLE}>
                                <option value="">{districtsLoading ? 'Loading…' : '— Select City —'}</option>
                                {districts.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="pa-postcode" className="text-[12px] text-[var(--dash-text)]">Postcode</Label>
                            <select id="pa-postcode" value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} disabled={!selectedDistrictId || postcodesLoading}
                                className={EP_INPUT} style={EP_INPUT_STYLE}>
                                <option value="">{postcodesLoading ? 'Loading…' : '— Select —'}</option>
                                {postcodeOpts.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>

                    <button type="button" onClick={() => setForm(f => ({ ...f, isDefault: !f.isDefault }))} className="flex items-center gap-2 cursor-pointer select-none">
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                            border: form.isDefault ? '1.5px solid hsl(var(--primary))' : '1.5px solid hsl(var(--input-border))',
                            background: form.isDefault ? 'hsl(var(--primary))' : 'transparent',
                        }}>
                            {form.isDefault && <Check className="h-3 w-3 text-white" style={{ strokeWidth: 3 }} />}
                        </span>
                        <span className="text-[12px] text-[var(--dash-text-muted)]">Set as default pickup address</span>
                    </button>

                    <div className="flex items-center justify-end gap-3">
                        <Button variant="dashSecondary" size="dash" onClick={resetForm}>Cancel</Button>
                        <Button variant="dashPrimary" size="dash" onClick={commit} disabled={!formValid} className="flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5" />
                            {editingId ? 'Update address' : 'Add address'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
