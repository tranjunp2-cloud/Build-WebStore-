'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DiscountFormHeader } from './discount-form-header'
import { DiscountDeleteDialog } from './discount-delete-dialog'
import { DiscountFormFields, type DiscountDraft, type DiscountFormErrors } from './discount-form-fields'
import { DiscountLivePreview } from './discount-live-preview'
import { DiscountSaveBar } from './discount-save-bar'
import { draftValueToStored } from '@/lib/discounts/draft-value'
import { MAX_FIXED_DISCOUNT_RM } from '@/lib/discounts/format'

export interface DiscountDoc {
    id: string
    code: string
    description?: string | null
    type: 'percentage' | 'fixed'
    value: number
    status: 'active' | 'inactive'
    usageCount: number
    usageLimit?: number | null
    startsAt?: string | null
    expiresAt?: string | null
    createdAt?: string
}

interface DiscountFormProps {
    discount?: DiscountDoc
    tenantName?: string
}

const toDateInput = (iso?: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const buildInit = (discount?: DiscountDoc): DiscountDraft => {
    if (!discount) {
        return { code: '', description: '', type: 'percentage', valueInput: '', status: 'active', usageLimit: '', startsAt: '', expiresAt: '' }
    }
    // Fixed: value stored as sen → display as RM float string
    const valueInput = discount.type === 'fixed'
        ? String((discount.value / 100).toFixed(2))
        : String(discount.value)
    return {
        code: discount.code,
        description: discount.description ?? '',
        type: discount.type,
        valueInput,
        status: discount.status,
        usageLimit: discount.usageLimit == null ? '' : String(discount.usageLimit),
        startsAt: toDateInput(discount.startsAt),
        expiresAt: toDateInput(discount.expiresAt),
    }
}

export function DiscountForm({ discount, tenantName }: DiscountFormProps) {
    const router = useRouter()
    const isNew = !discount

    const init = useMemo(() => buildInit(discount), [discount])
    const [draft, setDraft] = useState<DiscountDraft>(init)
    const [errors, setErrors] = useState<DiscountFormErrors>({})
    const [saving, setSaving] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    useEffect(() => { setDraft(init); setErrors({}) }, [init])

    const set = useCallback((k: keyof DiscountDraft, v: string) => {
        setDraft((d) => ({ ...d, [k]: v }))
    }, [])

    const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(init), [draft, init])

    // Warn on unload when dirty
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
        if (dirty) window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [dirty])

    const validate = (): boolean => {
        const e: DiscountFormErrors = {}
        const code = draft.code.trim().toUpperCase()
        if (!code) e.code = 'Code is required.'

        if (draft.valueInput === '' || draft.valueInput == null) {
            e.value = 'Value is required.'
        } else {
            const v = Number(draft.valueInput)
            if (isNaN(v)) e.value = 'Enter a number.'
            else if (draft.type === 'percentage' && (v < 0 || v > 100)) e.value = 'Percentage must be between 0 and 100.'
            else if (draft.type === 'fixed' && v < 0) e.value = 'Fixed amount must be ≥ 0.'
            else if (draft.type === 'fixed' && v > MAX_FIXED_DISCOUNT_RM) e.value = `Fixed amount is too large (max RM ${MAX_FIXED_DISCOUNT_RM.toLocaleString('en-MY')}).`
        }

        if (draft.usageLimit !== '' && Number(draft.usageLimit) < 1) e.usageLimit = 'Usage limit must be at least 1 (leave blank for unlimited).'
        if (draft.startsAt && draft.expiresAt && new Date(draft.startsAt) >= new Date(draft.expiresAt)) {
            e.dates = 'Start date must be before expiry date.'
        }

        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleSave = async () => {
        if (!validate()) {
            toast.error('Cannot save', { description: 'Please fix the highlighted fields before saving.' })
            return
        }

        setSaving(true)
        try {
            const payload: Record<string, unknown> = {
                code: draft.code.trim().toUpperCase(),
                description: draft.description || null,
                type: draft.type,
                value: draftValueToStored(draft.type, draft.valueInput),
                status: draft.status,
                usageLimit: draft.usageLimit === '' ? null : Number(draft.usageLimit),
                startsAt: draft.startsAt || null,
                expiresAt: draft.expiresAt || null,
            }

            const url = isNew ? '/api/v1/discounts' : `/api/v1/discounts/${discount!.id}`
            const method = isNew ? 'POST' : 'PUT'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const json = await res.json()

            if (!res.ok) {
                if (json?.error?.code === 'DUPLICATE_CODE') {
                    setErrors((e) => ({ ...e, code: 'This code is already in use for your tenant. Try a different code or append a number.' }))
                    toast.error('Duplicate code', { description: 'Try a different code or append a number.' })
                    return
                }
                throw new Error(json?.error?.message ?? 'Save failed')
            }

            // Clear dirty before navigation to avoid beforeunload warning
            setDraft(init)
            toast.success(isNew ? 'Discount created' : 'Discount saved')
            router.push('/discounts')
        } catch (err: any) {
            toast.error('Failed to save', { description: err.message })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        setDeleteOpen(false)
        setSaving(true)
        try {
            const res = await fetch(`/api/v1/discounts/${discount!.id}`, { method: 'DELETE' })
            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                throw new Error(json?.error?.message ?? 'Delete failed')
            }
            toast.success('Discount deleted')
            router.push('/discounts')
        } catch (err: any) {
            toast.error('Failed to delete', { description: err.message })
            setSaving(false)
        }
    }

    const handleRevert = () => { setDraft(init); setErrors({}) }

    const handleCancel = () => {
        router.push('/discounts')
    }

    return (
        <div className="flex flex-col min-h-0 pb-14">
            <DiscountFormHeader
                isNew={isNew}
                code={discount?.code}
                status={discount?.status}
                id={discount?.id}
                createdAt={discount?.createdAt}
                tenantName={tenantName}
                saving={saving}
                dirty={dirty}
                onBack={handleCancel}
                onSave={handleSave}
                onRevert={handleRevert}
                onDelete={!isNew ? () => setDeleteOpen(true) : undefined}
            />

            <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
                <div
                    className="rounded-lg border p-6"
                    style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
                >
                    <DiscountFormFields
                        draft={draft}
                        errors={errors}
                        isNew={isNew}
                        usageCount={discount?.usageCount ?? 0}
                        set={set}
                    />
                </div>
                <DiscountLivePreview
                    draft={draft}
                    tenantName={tenantName}
                    usageCount={discount?.usageCount ?? 0}
                    isNew={isNew}
                />
            </div>

            {!isNew && (
                <DiscountDeleteDialog
                    code={discount!.code}
                    usageCount={discount!.usageCount}
                    open={deleteOpen}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteOpen(false)}
                />
            )}

            <DiscountSaveBar
                dirty={dirty}
                isNew={isNew}
                saving={saving}
                onCancel={handleCancel}
                onSave={handleSave}
            />
        </div>
    )
}
