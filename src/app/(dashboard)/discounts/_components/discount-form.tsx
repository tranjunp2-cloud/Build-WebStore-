'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DiscountFormHeader } from './discount-form-header'
import { DiscountFormFields, type DiscountDraft, type DiscountFormErrors } from './discount-form-fields'
import { computeEffectiveDiscountStatus } from '@/lib/discounts/effective-status'
import { discountActivationBlocks } from '@/lib/discounts/activation-guard'
import { DiscountLivePreview } from './discount-live-preview'
import { DiscountSaveBar } from './discount-save-bar'
import { draftValueToStored } from '@/lib/discounts/draft-value'
import { MAX_FIXED_DISCOUNT_RM } from '@/lib/discounts/format'
import { useI18n } from '@/i18n'
import { useAgentRecordSync } from '@/lib/agent-changes/use-agent-record-sync'
import { AgentChangedNotice, SaveConflictNotice } from '@/components/agent/agent-changed-notice'
import { useSaveVersion } from '@/lib/save-version/use-save-version'
import { toDiscountDoc } from '../_lib/to-discount-doc'

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
    updatedAt?: string
}

interface DiscountFormProps {
    discount?: DiscountDoc
    tenantName?: string
}

const toDateInput = (iso?: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    // Read back in KL timezone — expiresAt is stored pinned to end-of-day KL (15:59:59 UTC).
    // Using getDate() (browser-local) shifts the date by +1 day for UTC+9+ browsers.
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kuala_Lumpur',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}`
}

const buildInit = (discount?: DiscountDoc): DiscountDraft => {
    if (!discount) {
        return { code: '', description: '', type: 'percentage', valueInput: '', status: 'active', usageLimit: '', startsAt: '', expiresAt: '' }
    }
    // Fixed: value stored as sen → display as RM float string
    const valueInput = discount.type === 'fixed'
        ? String((discount.value / 100).toFixed(2))
        : String(discount.value)
    // An EXPIRED discount shows Inactive in the editable dropdown on load — expiry is irreversible
    // until the merchant extends the date, and the cron persists it inactive anyway, so reflecting
    // it avoids a stale "Active". Used-up is NOT normalised: its DB status stays active (capacity can
    // reopen on a slot release), so the dropdown keeps the raw value and the save guard enforces the
    // limit. Scheduled stays raw so future-dated campaigns remain schedulable. (GH-1282 decision: B.)
    const effective = computeEffectiveDiscountStatus({
        status: discount.status,
        startsAt: discount.startsAt,
        expiresAt: discount.expiresAt,
        usageLimit: discount.usageLimit,
        usageCount: discount.usageCount,
    })
    const status = effective === 'expired' ? 'inactive' : discount.status
    return {
        code: discount.code,
        description: discount.description ?? '',
        type: discount.type,
        valueInput,
        status,
        usageLimit: discount.usageLimit == null ? '' : String(discount.usageLimit),
        startsAt: toDateInput(discount.startsAt),
        expiresAt: toDateInput(discount.expiresAt),
    }
}

export function DiscountForm({ discount: loaded, tenantName }: DiscountFormProps) {
    const router = useRouter()
    const { t, ti } = useI18n()
    const dv = t.dashboard.discounts.validation
    const dt = t.dashboard.discounts.toast

    // The record on screen: the server-rendered one, replaced when the assistant changes it
    const [discount, setDiscount] = useState(loaded)
    useEffect(() => { setDiscount(loaded) }, [loaded])
    const isNew = !discount
    // the discount's updatedAt as loaded: sent with each save so a newer change is never written over
    const version = useSaveVersion(loaded?.updatedAt)
    const setVersion = version.set
    useEffect(() => { setVersion(discount?.updatedAt) }, [discount, setVersion])

    const init = useMemo(() => buildInit(discount), [discount])
    const [draft, setDraft] = useState<DiscountDraft>(init)
    const [errors, setErrors] = useState<DiscountFormErrors>({})
    const [saving, setSaving] = useState(false)

    useEffect(() => { setDraft(init); setErrors({}) }, [init])

    const set = useCallback((k: keyof DiscountDraft, v: string) => {
        setDraft((d) => ({ ...d, [k]: v }))
    }, [])

    const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(init), [draft, init])

    // Fetch the discount again; a new `discount` rebuilds `init`, which resets the draft. A deleted one leaves for the
    // list, as the server page does. A failed background fetch keeps the form as it is.
    const reload = useCallback(async () => {
        if (!discount) return
        try {
            const res = await fetch(`/api/v1/discounts/${discount.id}`, { credentials: 'include' })
            if (res.status === 404) { router.replace('/discounts'); return }
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const json = await res.json()
            setDiscount(toDiscountDoc(json.data))
        } catch (err) {
            console.error('[Discount reload]', err)
        }
    }, [discount?.id, router])
    const sync = useAgentRecordSync({ kind: 'store_discount', id: discount?.id, dirty, reload })

    // Warn on unload when dirty
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
        if (dirty) window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [dirty])

    const validate = useCallback((): boolean => {
        const e: DiscountFormErrors = {}
        const code = draft.code.trim().toUpperCase()
        if (!code) e.code = dv.codeRequired

        if (draft.valueInput === '' || draft.valueInput == null) {
            e.value = dv.valueRequired
        } else {
            const v = Number(draft.valueInput)
            if (isNaN(v)) e.value = dv.valueNotNumber
            else if (draft.type === 'percentage' && (v < 0 || v > 100)) e.value = dv.percentageRange
            else if (draft.type === 'fixed' && v < 0) e.value = dv.fixedNegative
            else if (draft.type === 'fixed' && v > MAX_FIXED_DISCOUNT_RM) {
                e.value = ti(dv.fixedTooLarge, { max: MAX_FIXED_DISCOUNT_RM.toLocaleString('en-MY') })
            }
        }

        if (draft.usageLimit !== '' && Number(draft.usageLimit) < 1) e.usageLimit = dv.usageLimitMin
        if (draft.startsAt && draft.expiresAt && new Date(draft.startsAt) >= new Date(draft.expiresAt)) {
            e.dates = dv.datesOrder
        }

        // Reactivation guards — a discount can't be saved Active while it is already unusable.
        // Error lands on the offending field: expiry date (last date field) or usage limit.
        // Uses end-of-day-KL semantics so a same-day expiry stays valid (matches persistence + badge).
        if (draft.status === 'active') {
            const block = discountActivationBlocks({
                expiresAt: draft.expiresAt || null,
                usageLimit: draft.usageLimit === '' ? null : Number(draft.usageLimit),
                usageCount: discount?.usageCount ?? 0,
            })
            if (block.expired && !e.dates) e.dates = dv.expiredCannotActivate
            if (block.atLimit && !e.usageLimit) e.usageLimit = dv.atLimitCannotActivate
        }

        setErrors(e)
        return Object.keys(e).length === 0
    }, [draft, dv, ti, discount])

    const handleSave = async () => {
        if (!validate()) {
            toast.error(dt.cannotSave, { description: dt.cannotSaveDesc })
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
                body: JSON.stringify(isNew ? payload : { ...payload, expectedUpdatedAt: version.current() }),
            })

            const json = await res.json()

            if (!res.ok) {
                if (version.refused(json)) return
                if (json?.error?.code === 'DUPLICATE_CODE') {
                    setErrors((e) => ({ ...e, code: dt.duplicateCodeField }))
                    toast.error(dt.duplicateCode, { description: dt.duplicateCodeDesc })
                    return
                }
                throw new Error(json?.error?.message ?? dt.saveFailed)
            }

            version.set(json.data?.updatedAt)
            // Clear dirty before navigation to avoid beforeunload warning
            setDraft(init)
            toast.success(isNew ? dt.created : dt.saved)
            router.push('/discounts')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : dt.saveFailed
            toast.error(dt.saveFailed, { description: message })
        } finally {
            setSaving(false)
        }
    }

    const handleRevert = () => { setDraft(init); setErrors({}) }

    const handleCancel = () => {
        router.push('/discounts')
    }

    // GH-1538 review (levietducprime): pb-14 (56px) < save-bar footprint
    // (~50px bar + bottom-4) — could clip the last field when the fixed
    // bar is showing and the page is scrolled to bottom. Matches pb-24
    // already used by ProductForm/customers-detail/shipping.
    return (
        <div className="flex flex-col min-h-0 pb-24">
            {version.conflicted ? (
                <div className="pb-4">
                    <SaveConflictNotice record="discount" onLoadLatest={sync.reloadNow} onSaveAnyway={() => { version.overwrite(); void handleSave() }} />
                </div>
            ) : sync.stale && (
                <div className="pb-4">
                    <AgentChangedNotice record="discount" onReload={sync.reloadNow} onKeep={sync.keepMine} />
                </div>
            )}
            <DiscountFormHeader
                isNew={isNew}
                code={discount?.code}
                status={discount?.status}
                startsAt={discount?.startsAt}
                expiresAt={discount?.expiresAt}
                usageLimit={discount?.usageLimit}
                usageCount={discount?.usageCount}
                id={discount?.id}
                createdAt={discount?.createdAt}
                tenantName={tenantName}
                dirty={dirty}
                onBack={handleCancel}
                onRevert={handleRevert}
            />

            <div className="pt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
                <div
                    className="rounded-lg border border-solid p-6"
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

            {/* GH-1509 bug #11: was always mounted (only the Save button disabled when clean),
                so it showed up on first load before any edit. Match Payments/Shipping — only
                render while there's something unsaved. */}
            {dirty && (
                <DiscountSaveBar
                    isNew={isNew}
                    saving={saving}
                    onCancel={handleCancel}
                    onSave={handleSave}
                />
            )}
        </div>
    )
}
