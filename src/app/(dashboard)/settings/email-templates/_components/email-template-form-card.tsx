'use client'

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
            className={`relative inline-flex shrink-0 rounded-full transition-colors ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${on ? 'bg-green-500' : 'bg-slate-600'}`}
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
    onChange: (v: string) => void
}

function FieldRow({ label, required, hint, textarea, rows = 2, value, limit, variables = [], onChange }: FieldRowProps) {
    const len = value.length
    const inputCls = 'w-full rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20'
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">
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
            {hint && <p className="text-xs text-slate-500">{hint}</p>}
            {variables.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {variables.map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => onChange(value + `{${v}}`)}
                            title={`Insert {${v}}`}
                            className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.05] px-2 py-0.5 font-mono text-[11px] text-slate-400 hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-blue-400 transition-colors"
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
}: Props) {
    const cur = locale === 'en' ? draft.contentEn : (draft.contentMs ?? {})
    const vars = EMAIL_TEMPLATE_VARIABLES[templateType] ?? []

    return (
        <div className="rounded-xl border border-white/[0.08] bg-[#1a2540] p-6 space-y-5">
            {/* Status row */}
            <div className="flex items-start justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                <div>
                    <p className="text-sm font-medium text-white">Sending status</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {draft.enabled
                            ? 'Live — this email is sent in production.'
                            : 'Paused — no buyers will receive this email.'}
                    </p>
                    {isCritical && (
                        <p className="text-xs text-amber-400 mt-1">Security-critical — cannot be disabled</p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                    <SimpleToggle on={draft.enabled} locked={isCritical} onChange={onEnabledChange} />
                    <span className={`text-xs font-medium ${draft.enabled ? 'text-green-400' : 'text-slate-400'}`}>
                        {draft.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
            </div>

            <hr className="border-white/[0.06]" />

            {/* Locale row */}
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-white">Content locale</p>
                    <p className="text-xs text-slate-400 mt-0.5">Each locale stores its own copy. Visitors get the closest match.</p>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-white/[0.06] p-1 shrink-0 ml-4">
                    {(['en', 'ms'] as const).map((l) => (
                        <button
                            key={l}
                            type="button"
                            onClick={() => onLocaleChange(l)}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${locale === l
                                ? 'bg-white/[0.12] text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span>{l === 'en' ? '🇬🇧' : '🇲🇾'}</span>
                            {l.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Subject */}
            <FieldRow
                label="Subject"
                required
                hint="Shown in the inbox preview. Keep it under 60 chars for mobile."
                value={cur.subject ?? ''}
                limit={LIMITS.subject}
                variables={vars}
                onChange={(v) => onFieldChange(locale, 'subject', v)}
            />

            {/* Greeting */}
            <FieldRow
                label="Greeting"
                required
                textarea
                rows={2}
                value={cur.greeting ?? ''}
                limit={LIMITS.greeting}
                variables={vars.filter((v) => /name/i.test(v))}
                onChange={(v) => onFieldChange(locale, 'greeting', v)}
            />

            {/* CTA Label */}
            <FieldRow
                label="CTA Label"
                hint={`Button text. Use a strong verb — "Track Order", "Confirm", "Open Inbox".`}
                value={cur.ctaLabel ?? ''}
                limit={LIMITS.ctaLabel}
                onChange={(v) => onFieldChange(locale, 'ctaLabel', v)}
            />

            {/* Closing */}
            <FieldRow
                label="Closing"
                textarea
                rows={3}
                value={cur.closing ?? ''}
                limit={LIMITS.closing}
                variables={vars.filter((v) => /brand|support|seller/i.test(v))}
                onChange={(v) => onFieldChange(locale, 'closing', v)}
            />

            {/* Save row */}
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
                <span className="text-xs text-slate-400">
                    {isDirty ? 'Unsaved changes' : 'All changes saved'}
                </span>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={!isDirty || isSaving}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? '...' : '✓'} Save Changes
                </button>
            </div>
        </div>
    )
}
