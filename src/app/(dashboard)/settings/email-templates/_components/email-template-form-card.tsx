'use client'

import { useI18n } from '@/i18n'
import { LocaleFlag } from '@/components/locale-flag'
import { EMAIL_TEMPLATE_VARIABLES, EmailTemplateType } from '@/lib/email/types'
import type { ContentFields } from '../actions'

const LIMITS = { subject: 200, greeting: 500, ctaLabel: 100, closing: 2000 }

function SimpleToggle({ on, locked, onChange }: { on: boolean; locked?: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={locked}
            onClick={() => !locked && onChange(!on)}
            style={{ width: 36, height: 20 }}
            className={`relative inline-flex shrink-0 rounded-full transition-colors ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${on ? 'bg-green-500' : 'bg-slate-400 dark:bg-slate-600'}`}
        >
            <span
                style={{ width: 16, height: 16, top: 2, left: 2 }}
                className={`pointer-events-none absolute rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`}
            />
        </button>
    )
}

function CharCounter({ len, limit }: { len: number; limit: number }) {
    const cls = len > limit ? 'text-red-400' : len > limit * 0.9 ? 'text-amber-400' : 'text-slate-500'
    return <span className={`text-xs tabular-nums ${cls}`}>{len}/{limit}</span>
}

interface FieldRowProps {
    label: string
    required?: boolean
    hint?: string
    textarea?: boolean
    rows?: number
    value: string
    limit: number
    variables?: string[]
    insertVarLabel?: string
    onChange: (v: string) => void
}

function FieldRow({ label, required, hint, textarea, rows = 2, value, limit, variables = [], insertVarLabel, onChange }: FieldRowProps) {
    const len = value.length
    const inputCls = 'w-full rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20'
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                <CharCounter len={len} limit={limit} />
            </div>
            {textarea ? (
                <textarea
                    rows={rows}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${inputCls} resize-none`}
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={inputCls}
                />
            )}
            {hint && <p className="text-xs text-slate-500 dark:text-slate-500">{hint}</p>}
            {variables.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {variables.map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => onChange(value + `{${v}}`)}
                            title={insertVarLabel ? insertVarLabel.replace('{var}', `{${v}}`) : `Insert {${v}}`}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.05] px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:text-slate-400 hover:border-blue-400/60 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                            +{`{${v}}`}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

interface Props {
    templateType: EmailTemplateType
    locale: 'en' | 'ms'
    draft: { contentEn: ContentFields; contentMs: ContentFields; enabled: boolean }
    isDirty: boolean
    isSaving: boolean
    isCritical: boolean
    onLocaleChange: (locale: 'en' | 'ms') => void
    onFieldChange: (locale: 'en' | 'ms', field: keyof ContentFields, value: string) => void
    onEnabledChange: (val: boolean) => void
    onSave: () => void
    onRevert: () => void
}

export function EmailTemplateFormCard({
    templateType,
    locale,
    draft,
    isDirty,
    isSaving,
    isCritical,
    onLocaleChange,
    onFieldChange,
    onEnabledChange,
    onSave,
    onRevert,
}: Props) {
    const { t } = useI18n()
    const et = t.dashboard.settings.emailTemplates
    const cur = locale === 'en' ? draft.contentEn : (draft.contentMs ?? {})
    const vars = EMAIL_TEMPLATE_VARIABLES[templateType] ?? []

    return (
        <div className="self-start rounded-xl border border-solid border-slate-200 dark:border-white/[0.15] bg-white dark:bg-[#1a2540] p-6 space-y-5">
            {/* Status row */}
            <div className="flex items-start justify-between rounded-lg border border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03] px-4 py-3">
                <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{et.sendingStatus}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {draft.enabled ? et.statusLive : et.statusPaused}
                    </p>
                    {isCritical && (
                        <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">{et.statusCritical}</p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                    <SimpleToggle on={draft.enabled} locked={isCritical} onChange={onEnabledChange} />
                    <span className={`text-xs font-medium ${draft.enabled ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {draft.enabled ? et.enabled : et.disabled}
                    </span>
                </div>
            </div>

            <hr className="border-slate-100 dark:border-white/[0.06]" />

            {/* Locale row */}
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{et.contentLocale}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{et.localeDesc}</p>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] p-1 shrink-0 ml-4">
                    {(['en', 'ms'] as const).map((l) => (
                        <button
                            key={l}
                            type="button"
                            onClick={() => onLocaleChange(l)}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${locale === l
                                ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <LocaleFlag locale={l} className="w-4 rounded-[2px]" />
                            {l.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Subject */}
            <FieldRow
                label={et.fieldSubject}
                required
                hint={et.hintSubject}
                value={cur.subject ?? ''}
                limit={LIMITS.subject}
                variables={vars}
                insertVarLabel={et.insertVar}
                onChange={(v) => onFieldChange(locale, 'subject', v)}
            />

            {/* Greeting */}
            <FieldRow
                label={et.fieldGreeting}
                required
                textarea
                rows={2}
                value={cur.greeting ?? ''}
                limit={LIMITS.greeting}
                variables={vars.filter((v) => /name/i.test(v))}
                insertVarLabel={et.insertVar}
                onChange={(v) => onFieldChange(locale, 'greeting', v)}
            />

            {/* CTA Label */}
            <FieldRow
                label={et.fieldCtaLabel}
                hint={et.hintCtaLabel}
                value={cur.ctaLabel ?? ''}
                limit={LIMITS.ctaLabel}
                onChange={(v) => onFieldChange(locale, 'ctaLabel', v)}
            />

            {/* Closing */}
            <FieldRow
                label={et.fieldClosing}
                textarea
                rows={3}
                value={cur.closing ?? ''}
                limit={LIMITS.closing}
                variables={vars.filter((v) => /brand|support|seller/i.test(v))}
                insertVarLabel={et.insertVar}
                onChange={(v) => onFieldChange(locale, 'closing', v)}
            />

            {/* Save footer */}
            <div className="border-t border-slate-100 dark:border-white/[0.06] pt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    {isDirty ? et.unsavedChanges : et.allChangesSaved}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                    {isDirty && (
                        <button
                            type="button"
                            onClick={onRevert}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
                        >
                            {et.revert}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={!isDirty || isSaving}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                    >
                        {isSaving ? et.saving : et.saveChanges}
                    </button>
                </div>
            </div>
        </div>
    )
}
