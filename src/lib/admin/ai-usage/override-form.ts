/**
 * Editor state of one shop's AI override: strings in, the PUT body (or field sentences) out. Pure + client-safe.
 * Mirrors ShopLimitInputSchema: reason required, custom needs at least one number, an empty number keeps the plan's.
 */
import type { AiLimits } from '@/lib/ai-platform/limit-resolution'
import type { LimitValues } from '@/lib/admin/ai-settings/types'

export type OverrideMode = 'custom' | 'unlimited' | 'blocked'
export const OVERRIDE_MODES: ReadonlyArray<{ id: OverrideMode; label: string; help: string }> = [
    { id: 'custom', label: 'Custom', help: 'Set the limits below. A field left empty keeps the plan\'s value.' },
    { id: 'unlimited', label: 'Unlimited', help: 'No AI budget limits for this shop. Platform caps still apply.' },
    { id: 'blocked', label: 'Blocked', help: 'AI is refused for this shop, whatever its plan says.' },
]

export type OverrideNumberKey = 'aiBudgetUsd' | 'picturesPerDay' | 'aiBudgetUsdMonthly' | 'siteBudgetUsd'
export const OVERRIDE_NUMBER_FIELDS: ReadonlyArray<{ key: OverrideNumberKey; label: string; unit: '$' | ''; integer: boolean }> = [
    { key: 'aiBudgetUsd', label: 'AI budget per day', unit: '$', integer: false },
    { key: 'picturesPerDay', label: 'Pictures per day', unit: '', integer: true },
    { key: 'aiBudgetUsdMonthly', label: 'Monthly AI budget', unit: '$', integer: false },
    { key: 'siteBudgetUsd', label: 'Website setup budget per day', unit: '$', integer: false },
]

export interface OverrideForm extends Record<OverrideNumberKey, string> {
    mode: OverrideMode
    reason: string
    /** YYYY-MM-DD, Malaysia time; '' = until removed */
    expiresOn: string
}
export type OverrideFormKey = keyof OverrideForm | 'form'
export type OverrideErrors = Partial<Record<OverrideFormKey, string>>

/** The slice of a saved override the editor starts from (matches OverrideView). */
export interface OverrideSource {
    mode: OverrideMode
    aiBudgetUsd: number | null
    picturesPerDay: number | null
    aiBudgetUsdMonthly: number | null
    siteBudgetUsd: number | null
    reason: string
    expiresAt: string | null
}

export type OverrideBody = { mode: OverrideMode; reason: string; expiresAt: string | null } & Partial<Record<OverrideNumberKey, number | null>>

export const emptyOverrideForm = (): OverrideForm => ({
    mode: 'custom', aiBudgetUsd: '', picturesPerDay: '', aiBudgetUsdMonthly: '', siteBudgetUsd: '', reason: '', expiresOn: '',
})

const MALAYSIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' })
const orBlank = (value: number | null) => (value === null ? '' : String(value))

export function formFromOverride(source: OverrideSource): OverrideForm {
    return {
        mode: source.mode,
        aiBudgetUsd: orBlank(source.aiBudgetUsd), picturesPerDay: orBlank(source.picturesPerDay),
        aiBudgetUsdMonthly: orBlank(source.aiBudgetUsdMonthly), siteBudgetUsd: orBlank(source.siteBudgetUsd),
        reason: source.reason,
        expiresOn: source.expiresAt ? MALAYSIA.format(new Date(source.expiresAt)) : '',
    }
}

const validDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(new Date(`${day}T00:00:00+08:00`).getTime())

export function validateOverrideForm(form: OverrideForm, now: number = Date.now()): { errors: OverrideErrors; body: OverrideBody | null } {
    const errors: OverrideErrors = {}
    const numbers: Partial<Record<OverrideNumberKey, number | null>> = {}
    if (!form.reason.trim()) errors.reason = 'Say why this shop has its own limits.'
    else if (form.reason.trim().length > 500) errors.reason = 'Keep it under 500 characters.'
    if (form.mode === 'custom') {
        for (const field of OVERRIDE_NUMBER_FIELDS) {
            const raw = form[field.key].trim()
            if (raw === '') { numbers[field.key] = null; continue }
            const value = Number(raw)
            if (!Number.isFinite(value) || value < 0) errors[field.key] = 'Enter a number, 0 or more.'
            else if (field.integer && !Number.isInteger(value)) errors[field.key] = 'Enter a whole number.'
            else numbers[field.key] = value
        }
        if (!OVERRIDE_NUMBER_FIELDS.some((field) => form[field.key].trim() !== '') ) errors.mode = 'A custom override needs at least one limit. Leave a field empty to keep the plan\'s value.'
    }
    let expiresAt: string | null = null
    if (form.expiresOn) {
        if (!validDay(form.expiresOn)) errors.expiresOn = 'Pick a valid date.'
        else {
            expiresAt = `${form.expiresOn}T23:59:59+08:00`
            if (new Date(expiresAt).getTime() <= now) errors.expiresOn = 'Pick today or a later day.'
        }
    }
    if (Object.keys(errors).length) return { errors, body: null }
    return { errors, body: { mode: form.mode, ...(form.mode === 'custom' ? numbers : {}), reason: form.reason.trim(), expiresAt } }
}

/** 422 `{errors:[{path,message}]}` → one sentence per form field (unknown paths land on `form`). */
export function mapServerErrors(errors: ReadonlyArray<{ path: string[]; message: string }>): OverrideErrors {
    const known = new Set<string>(['mode', 'reason', 'expiresAt', ...OVERRIDE_NUMBER_FIELDS.map((field) => field.key)])
    const out: OverrideErrors = {}
    for (const error of errors) {
        const head = error.path[0] === 'expiresAt' ? 'expiresOn' : (error.path[0] ?? '')
        const key = (known.has(error.path[0] ?? '') ? head : 'form') as OverrideFormKey
        if (!out[key]) out[key] = error.message
    }
    return out
}

/** Plan values shown next to the override fields ("Plan: $0.15"), keyed like the form. */
export type PlanHints = Partial<Record<OverrideNumberKey, string>>

const hint = (value: number | null, unit: '$' | '') => (value === null ? 'Unlimited' : `${unit}${value}`)
export const hintsFromLimits = (limits: AiLimits): PlanHints => ({
    aiBudgetUsd: hint(limits.aiBudgetUsd, '$'), picturesPerDay: hint(limits.picturesPerDay, ''),
    aiBudgetUsdMonthly: hint(limits.aiBudgetUsdMonthly, '$'), siteBudgetUsd: hint(limits.siteBudgetUsd, '$'),
})

/** Same hints from the settings page's stored strings. */
export function hintsFromStored(values: LimitValues, plan: string): PlanHints {
    const read = (kind: 'budget' | 'pictures' | 'monthly' | 'site', unit: '$' | '') => {
        const stored = (values[kind] as Record<string, string | undefined>)[plan]
        if (stored === undefined) return undefined
        return /^(unlimited|yes)$/i.test(stored.trim()) ? 'Unlimited' : `${unit}${stored.trim()}`
    }
    return { aiBudgetUsd: read('budget', '$'), picturesPerDay: read('pictures', ''), aiBudgetUsdMonthly: read('monthly', '$'), siteBudgetUsd: read('site', '$') }
}
