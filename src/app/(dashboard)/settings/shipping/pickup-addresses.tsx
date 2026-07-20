'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hasUsablePhone, normalizeMyPhone } from '@/lib/shipping/easyparcel/phone'
import { normalizeWarehouses, type Warehouse } from '@/lib/shipping/easyparcel/warehouse'

const EAST_MY_STATES = new Set(['Sabah', 'Sarawak', 'Labuan'])
const EP_INPUT = 'h-11 w-full rounded-lg border border-solid border-[hsl(var(--input-border))] bg-[hsl(var(--card))] px-3 text-[16px] text-[var(--dash-text)] outline-none transition-colors placeholder:text-[var(--dash-text-muted)] focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-[13px]'
const EP_SELECT = 'h-11 text-[16px] text-[var(--dash-text)] sm:h-10 sm:text-[13px]'

type GeoState = { id: number; name: string }
type GeoDistrict = { id: number; name: string }

const emptyForm = {
    label: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postcode: '',
    isDefault: false,
}
type FormState = typeof emptyForm
type FormField = 'label' | 'phone' | 'address1' | 'state' | 'city' | 'postcode'

function whLabel(warehouse: Warehouse, fallback = 'warehouse'): string {
    return warehouse.label || warehouse.name || fallback
}

function whAddressLine(warehouse: Warehouse): string {
    return [warehouse.address1, warehouse.address2, warehouse.city, warehouse.postcode, warehouse.state]
        .filter(Boolean)
        .join(', ')
}

function whKey(warehouse: Warehouse, index: number): string {
    return warehouse.id || `${whLabel(warehouse)}-${index}`
}

interface PickupAddressesProps {
    value: Warehouse[]
    onChange: (warehouses: Warehouse[]) => void
    onEditingChange?: (editing: boolean) => void
    active?: boolean
}

export function PickupAddresses({ value, onChange, onEditingChange, active = false }: PickupAddressesProps) {
    const { t, ti } = useI18n()
    const copy = t.dashboard.settings.shipping.easyParcel
    const warehouses = useMemo(() => normalizeWarehouses(value, { defaultFirst: false }), [value])
    const [formOpen, setFormOpen] = useState(warehouses.length === 0)
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [form, setForm] = useState<FormState>(
        warehouses.length === 0 ? { ...emptyForm, isDefault: true } : emptyForm,
    )
    const [showErrors, setShowErrors] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<{ warehouse: Warehouse; key: string } | null>(null)

    const [states, setStates] = useState<GeoState[]>([])
    const [statesLoading, setStatesLoading] = useState(true)
    const [selectedStateId, setSelectedStateId] = useState('')
    const [districts, setDistricts] = useState<GeoDistrict[]>([])
    const [districtsLoading, setDistrictsLoading] = useState(false)
    const [selectedDistrictId, setSelectedDistrictId] = useState('')
    const [postcodeOpts, setPostcodeOpts] = useState<string[]>([])
    const [postcodesLoading, setPostcodesLoading] = useState(false)
    const prefersReducedMotion = useReducedMotion()
    const mustBeDefault = editingKey === null && !warehouses.some((warehouse) => warehouse.isDefault)

    useEffect(() => {
        onEditingChange?.(formOpen)
    }, [formOpen, onEditingChange])

    useEffect(() => {
        fetch('/api/geo/states')
            .then((response) => response.json())
            .then((data) => setStates(Array.isArray(data) ? data : []))
            .catch(() => setStates([]))
            .finally(() => setStatesLoading(false))
    }, [])

    useEffect(() => {
        if (!formOpen || states.length === 0 || !form.state) return
        const selectedState = states.find((state) => state.name === form.state)
        if (!selectedState) return
        setSelectedStateId(String(selectedState.id))
        setDistrictsLoading(true)
        fetch(`/api/geo/districts?stateId=${selectedState.id}`)
            .then((response) => response.json())
            .then((data: GeoDistrict[]) => {
                const nextDistricts = Array.isArray(data) ? data : []
                setDistricts(nextDistricts)
                const selectedDistrict = nextDistricts.find((district) => district.name === form.city)
                if (!selectedDistrict) return
                setSelectedDistrictId(String(selectedDistrict.id))
                setPostcodesLoading(true)
                fetch(`/api/geo/postcodes?districtId=${selectedDistrict.id}`)
                    .then((response) => response.json())
                    .then((postcodes) => setPostcodeOpts(Array.isArray(postcodes) ? postcodes : []))
                    .catch(() => setPostcodeOpts([]))
                    .finally(() => setPostcodesLoading(false))
            })
            .catch(() => setDistricts([]))
            .finally(() => setDistrictsLoading(false))
    // Reconcile persisted state/city only when an editor opens or the state list arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formOpen, states])

    function handleStateChange(stateId: string) {
        setSelectedStateId(stateId)
        const selectedState = states.find((state) => state.id === Number(stateId))
        setForm((current) => ({ ...current, state: selectedState?.name || '', city: '', postcode: '' }))
        setSelectedDistrictId('')
        setDistricts([])
        setPostcodeOpts([])
        setDistrictsLoading(true)
        fetch(`/api/geo/districts?stateId=${stateId}`)
            .then((response) => response.json())
            .then((data) => setDistricts(Array.isArray(data) ? data : []))
            .catch(() => setDistricts([]))
            .finally(() => setDistrictsLoading(false))
    }

    function handleDistrictChange(districtId: string) {
        setSelectedDistrictId(districtId)
        const selectedDistrict = districts.find((district) => district.id === Number(districtId))
        setForm((current) => ({ ...current, city: selectedDistrict?.name || '', postcode: '' }))
        setPostcodeOpts([])
        setPostcodesLoading(true)
        fetch(`/api/geo/postcodes?districtId=${districtId}`)
            .then((response) => response.json())
            .then((data) => setPostcodeOpts(Array.isArray(data) ? data : []))
            .catch(() => setPostcodeOpts([]))
            .finally(() => setPostcodesLoading(false))
    }

    function resetForm() {
        setForm(emptyForm)
        setEditingKey(null)
        setFormOpen(false)
        setShowErrors(false)
        setSelectedStateId('')
        setSelectedDistrictId('')
        setDistricts([])
        setPostcodeOpts([])
    }

    function openAdd() {
        setForm({ ...emptyForm, isDefault: !warehouses.some((warehouse) => warehouse.isDefault) })
        setEditingKey(null)
        setShowErrors(false)
        setSelectedStateId('')
        setSelectedDistrictId('')
        setDistricts([])
        setPostcodeOpts([])
        setFormOpen(true)
    }

    function openEdit(warehouse: Warehouse, index: number) {
        setForm({
            label: whLabel(warehouse),
            phone: warehouse.phone || '',
            address1: warehouse.address1 || '',
            address2: warehouse.address2 || '',
            city: warehouse.city || '',
            state: warehouse.state || '',
            postcode: warehouse.postcode || '',
            isDefault: !!warehouse.isDefault,
        })
        setEditingKey(whKey(warehouse, index))
        setShowErrors(false)
        setFormOpen(true)
    }

    const errors: Partial<Record<FormField, string>> = {}
    if (!form.label.trim()) errors.label = copy.required
    if (!hasUsablePhone(form.phone)) errors.phone = copy.invalidPhone
    if (!form.address1.trim()) errors.address1 = copy.required
    if (!form.state.trim()) errors.state = copy.required
    if (!form.city.trim()) errors.city = copy.required
    if (!/^\d{5}$/.test(form.postcode)) errors.postcode = copy.invalidPostcode
    const formValid = Object.keys(errors).length === 0

    function fieldError(field: FormField) {
        if (!showErrors || !errors[field]) return null
        return <p id={`pa-${field}-error`} className="text-[12px] text-[hsl(var(--destructive))]">{errors[field]}</p>
    }

    function commit() {
        setShowErrors(true)
        if (!formValid) return
        const existing = editingKey
            ? warehouses.find((warehouse, index) => whKey(warehouse, index) === editingKey)
            : undefined
        const entry: Warehouse = {
            id: existing?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now())),
            label: form.label.trim(),
            phone: normalizeMyPhone(form.phone),
            address1: form.address1.trim(),
            address2: form.address2.trim() || undefined,
            city: form.city.trim(),
            state: form.state.trim(),
            postcode: form.postcode.trim(),
            country: 'MY',
            isDefault: mustBeDefault || form.isDefault,
        }
        let next = editingKey
            ? warehouses.map((warehouse, index) => (whKey(warehouse, index) === editingKey ? entry : warehouse))
            : [...warehouses, entry]
        if (entry.isDefault) {
            next = next.map((warehouse) => ({
                ...warehouse,
                isDefault: warehouse === entry,
            }))
        }
        onChange(normalizeWarehouses(next, { defaultFirst: false }))
        resetForm()
    }

    function removePending() {
        if (!pendingDelete) return
        const next = warehouses.filter((warehouse, index) => whKey(warehouse, index) !== pendingDelete.key)
        onChange(normalizeWarehouses(next, { defaultFirst: false }))
        setPendingDelete(null)
    }

    function setDefault(key: string) {
        onChange(normalizeWarehouses(warehouses.map((warehouse, index) => ({
            ...warehouse,
            isDefault: whKey(warehouse, index) === key,
        })), { defaultFirst: false }))
    }

    const defaultWarehouse = warehouses.find((warehouse) => warehouse.isDefault) ?? warehouses[0]
    const showEastMalaysiaWarning = defaultWarehouse && EAST_MY_STATES.has(defaultWarehouse.state?.trim() || '')
    const deletingLastActive = active && warehouses.length === 1
    const formPanel = formOpen ? (
        <div data-pickup-address-form className="flex min-w-0 flex-col gap-4 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:p-5">
            <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
                <span className="text-[11px] font-bold uppercase text-[var(--dash-text-muted)]">
                    {editingKey ? copy.editAddress : copy.addPickupAddress}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor="pa-label" className="text-[12px] text-[var(--dash-text)]">{copy.fieldLabel}</Label>
                    <input id="pa-label" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                        placeholder={copy.labelPlaceholder} className={EP_INPUT} aria-invalid={showErrors && !!errors.label}
                        aria-describedby={showErrors && errors.label ? 'pa-label-error' : undefined} />
                    {fieldError('label')}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor="pa-phone" className="text-[12px] text-[var(--dash-text)]">{copy.senderPhone}</Label>
                    <input id="pa-phone" value={form.phone} onChange={(event) => setForm((current) => ({
                        ...current,
                        phone: event.target.value.replace(/\D/g, '').slice(0, 15),
                    }))} inputMode="numeric" autoComplete="tel" placeholder={copy.phonePlaceholder} className={EP_INPUT}
                        aria-invalid={showErrors && !!errors.phone} aria-describedby={showErrors && errors.phone ? 'pa-phone-error' : undefined} />
                    {fieldError('phone')}
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pa-address1" className="text-[12px] text-[var(--dash-text)]">{copy.addressLine1}</Label>
                <input id="pa-address1" value={form.address1} onChange={(event) => setForm((current) => ({ ...current, address1: event.target.value }))}
                    placeholder={copy.addressLine1} className={EP_INPUT} aria-invalid={showErrors && !!errors.address1}
                    aria-describedby={showErrors && errors.address1 ? 'pa-address1-error' : undefined} />
                {fieldError('address1')}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pa-address2" className="text-[12px] text-[var(--dash-text)]">
                    {copy.addressLine2} <span className="font-normal text-[var(--dash-text-muted)]">({copy.optional})</span>
                </Label>
                <input id="pa-address2" value={form.address2} onChange={(event) => setForm((current) => ({ ...current, address2: event.target.value }))}
                    placeholder={copy.addressLine2} className={EP_INPUT} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor="pa-state" className="text-[12px] text-[var(--dash-text)]">{copy.state}</Label>
                    <Select value={selectedStateId || undefined} onValueChange={handleStateChange} disabled={statesLoading}>
                        <SelectTrigger id="pa-state" className={EP_SELECT} aria-invalid={showErrors && !!errors.state}>
                            <SelectValue placeholder={statesLoading ? copy.loading : copy.selectState} />
                        </SelectTrigger>
                        <SelectContent>{states.map((state) => <SelectItem key={state.id} value={String(state.id)}>{state.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {fieldError('state')}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor="pa-city" className="text-[12px] text-[var(--dash-text)]">{copy.city}</Label>
                    <Select value={selectedDistrictId || undefined} onValueChange={handleDistrictChange} disabled={!selectedStateId || districtsLoading}>
                        <SelectTrigger id="pa-city" className={EP_SELECT} aria-invalid={showErrors && !!errors.city}>
                            <SelectValue placeholder={districtsLoading ? copy.loading : copy.selectCity} />
                        </SelectTrigger>
                        <SelectContent>{districts.map((district) => <SelectItem key={district.id} value={String(district.id)}>{district.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {fieldError('city')}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor="pa-postcode" className="text-[12px] text-[var(--dash-text)]">{copy.postcode}</Label>
                    <Select value={form.postcode || undefined} onValueChange={(postcode) => setForm((current) => ({ ...current, postcode }))}
                        disabled={!selectedDistrictId || postcodesLoading}>
                        <SelectTrigger id="pa-postcode" className={EP_SELECT} aria-invalid={showErrors && !!errors.postcode}>
                            <SelectValue placeholder={postcodesLoading ? copy.loading : copy.selectPostcode} />
                        </SelectTrigger>
                        <SelectContent>{postcodeOpts.map((postcode) => <SelectItem key={postcode} value={postcode}>{postcode}</SelectItem>)}</SelectContent>
                    </Select>
                    {fieldError('postcode')}
                </div>
            </div>

            <label className={`flex min-h-11 select-none items-center gap-2 ${mustBeDefault ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <Checkbox
                    checked={mustBeDefault || form.isDefault}
                    disabled={mustBeDefault}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, isDefault: checked === true }))}
                    className="h-5 w-5"
                    style={{
                        border: `1px solid ${mustBeDefault || form.isDefault ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}`,
                        background: mustBeDefault || form.isDefault ? 'hsl(var(--primary))' : 'transparent',
                    }}
                />
                <span className="text-[12px] text-[var(--dash-text-muted)]">{copy.setAsDefault}</span>
            </label>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button variant="dashSecondary" size="dash" onClick={resetForm} className="h-11 w-full sm:w-auto">{copy.cancel}</Button>
                <Button variant="dashPrimary" size="dash" onClick={commit} className="h-11 w-full sm:w-auto">
                    {editingKey ? copy.updateAddress : copy.addAddress}
                </Button>
            </div>
        </div>
    ) : null

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--dash-text)]">
                        {copy.pickupTitle} <span className="font-normal text-[var(--dash-text-muted)]">· {copy.pickupOrigin}</span>
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--dash-text-muted)]">{copy.pickupDescription}</p>
                </div>
                {!formOpen && (
                    <Button variant="outline" size="sm" onClick={openAdd} className="h-11 w-full gap-1.5 sm:h-9 sm:w-auto">
                        <Plus className="h-3.5 w-3.5" /> {copy.addAddress}
                    </Button>
                )}
            </div>

            {showEastMalaysiaWarning && (
                <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.08)] px-4 py-3 text-[12px] leading-relaxed text-[hsl(var(--warning))]">
                    <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
                    <span>{copy.eastMalaysiaWarning}</span>
                </div>
            )}

            {warehouses.map((warehouse, index) => {
                const key = whKey(warehouse, index)
                const selected = !!warehouse.isDefault
                return (
                    <Fragment key={key}>
                        <motion.div
                            layout="position"
                            transition={prefersReducedMotion
                                ? { duration: 0 }
                                : { type: 'spring', stiffness: 420, damping: 36 }}
                            data-warehouse-key={key}
                            data-selected={selected}
                            className="flex min-w-0 items-start gap-3 rounded-lg p-3 sm:p-4"
                            style={selected
                                ? { border: '1px solid hsl(var(--primary))', background: 'hsl(var(--primary)/0.06)' }
                                : { border: '1px solid var(--dash-border)', background: 'var(--dash-surface)' }}
                        >
                            <Checkbox
                                checked={selected}
                                onCheckedChange={() => setDefault(key)}
                                disabled={formOpen}
                                aria-label={copy.setDefaultAria}
                                className="mt-3 h-5 w-5"
                                style={{
                                    border: `1px solid ${selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}`,
                                    background: selected ? 'hsl(var(--primary))' : 'transparent',
                                }}
                            />
                            <div className="min-w-0 flex-1 py-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="break-words text-[13px] font-semibold text-[var(--dash-text)]">{whLabel(warehouse, copy.pickupFallback)}</span>
                                    {selected && (
                                        <span className="flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--primary))]">
                                            <Star className="h-3 w-3" /> {copy.defaultLabel}
                                        </span>
                                    )}
                                </div>
                                {whAddressLine(warehouse) && (
                                    <p className="mt-0.5 break-words text-[12px] leading-relaxed text-[var(--dash-text-muted)]">
                                        {whAddressLine(warehouse)}
                                    </p>
                                )}
                            </div>
                            {!formOpen && <div className="flex shrink-0 items-center gap-1">
                                <button type="button" onClick={() => openEdit(warehouse, index)} aria-label={copy.editAddressAria}
                                    className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--dash-text-muted)] hover:bg-[var(--dash-surface-hover)] hover:text-[var(--dash-text)]">
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => setPendingDelete({ warehouse, key })} aria-label={copy.deleteAddressAria}
                                    className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--dash-text-muted)] hover:bg-[hsl(var(--destructive)/0.08)] hover:text-[hsl(var(--destructive))]">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>}
                        </motion.div>
                        {editingKey === key && formPanel}
                    </Fragment>
                )
            })}

            {editingKey === null && formPanel}

            <ConfirmModal
                open={pendingDelete !== null}
                title={copy.deleteTitle}
                description={pendingDelete
                    ? ti(deletingLastActive ? copy.deleteLastDescription : copy.deleteDescription, { label: whLabel(pendingDelete.warehouse, copy.pickupFallback) })
                    : undefined}
                confirmLabel={copy.delete}
                cancelLabel={copy.cancel}
                onCancel={() => setPendingDelete(null)}
                onConfirm={removePending}
            />
        </div>
    )
}
