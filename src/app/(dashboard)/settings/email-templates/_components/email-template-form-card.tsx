'use client'

import { useI18n } from '@/i18n'
import { LocaleFlag } from '@/components/locale-flag'
import { EMAIL_TEMPLATE_VARIABLES, EmailTemplateType } from '@/lib/email/types'
import type { ContentFields } from '../actions'
import { CONTENT_FIELD_LIMITS } from '../validate-content-fields'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const LIMITS = CONTENT_FIELD_LIMITS

function hasOverLimit(fields: ContentFields | undefined): boolean {
    if (!fields) return false
    return (Object.keys(LIMITS) as (keyof typeof LIMITS)[]).some((k) => (fields[k] ?? '').length > LIMITS[k])
}

function CharCounter({ len, limit }: { len: number; limit: number }) {
    const cls = len > limit ? 'text-destructive' : len > limit * 0.9 ? 'text-warning' : 'text-slate-500'
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
    overLimitMessage?: string
    variables?: string[]
    insertVarLabel?: string
    onChange: (v: string) => void
}

function FieldRow({ label, required, hint, textarea, rows = 2, value, limit, overLimitMessage, variables = [], insertVarLabel, onChange }: FieldRowProps) {
    const len = value.length
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">
                    {label}{required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                <CharCounter len={len} limit={limit} />
            </div>
            {textarea ? (
                <Textarea
                    rows={rows}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="text-sm"
                />
            ) : (
                <Input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="text-sm"
                />
            )}
            {len > limit && overLimitMessage && (
                <p role="alert" className="text-xs text-destructive">{overLimitMessage}</p>
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
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.05] px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:text-slate-400 hover:border-[hsl(var(--primary)/0.6)] hover:bg-[hsl(var(--primary)/0.1)] hover:text-[hsl(var(--primary))] transition-colors"
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
    const overMsg = (name: string, limit: number) => et.fieldTooLong.replace('{field}', name).replace('{limit}', String(limit))
    const isOverLimit = hasOverLimit(draft.contentEn) || hasOverLimit(draft.contentMs)
    // Save can be blocked by the locale tab that is not currently shown: name it so the disabled state is explainable.
    const otherLocale = locale === 'en' ? 'ms' : 'en'
    const otherFields = otherLocale === 'en' ? draft.contentEn : (draft.contentMs ?? {})
    const fieldLabels = { subject: et.fieldSubject, greeting: et.fieldGreeting, ctaLabel: et.fieldCtaLabel, closing: et.fieldClosing }
    const otherOverKey = (Object.keys(LIMITS) as (keyof typeof LIMITS)[]).find((k) => (otherFields?.[k] ?? '').length > LIMITS[k])
    const otherLocaleMsg = otherOverKey
        ? overMsg(`${fieldLabels[otherOverKey]} (${otherLocale.toUpperCase()})`, LIMITS[otherOverKey])
        : null
    const vars = EMAIL_TEMPLATE_VARIABLES[templateType] ?? []

    return (
        <div className="self-start rounded-xl border border-solid border-slate-200 dark:border-white/[0.15] bg-white dark:bg-[hsl(var(--card))] p-6 space-y-5">
            {/* Status row */}
            <div className="flex items-start justify-between rounded-lg border border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03] px-4 py-3">
                <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{et.sendingStatus}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {draft.enabled ? et.statusLive : et.statusPaused}
                    </p>
                    {isCritical && (
                        <p className="text-xs text-warning dark:text-warning mt-1">{et.statusCritical}</p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Switch
                        checked={draft.enabled}
                        disabled={isCritical}
                        onCheckedChange={onEnabledChange}
                    />
                    <span className={`text-xs font-medium ${draft.enabled ? 'text-success dark:text-success' : 'text-slate-500 dark:text-slate-400'}`}>
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
                        <Button
                            key={l}
                            type="button"
                            onClick={() => onLocaleChange(l)}
                            variant="ghost"
                            size="sm"
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all h-auto ${locale === l
                                ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow hover:bg-white dark:hover:bg-white/[0.12]'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <LocaleFlag locale={l} className="w-4 rounded-[2px]" />
                            {l.toUpperCase()}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Subject */}
            <FieldRow
                label={et.fieldSubject}
                hint={et.hintSubject}
                value={cur.subject ?? ''}
                limit={LIMITS.subject}
                overLimitMessage={overMsg(et.fieldSubject, LIMITS.subject)}
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
                overLimitMessage={overMsg(et.fieldGreeting, LIMITS.greeting)}
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
                overLimitMessage={overMsg(et.fieldCtaLabel, LIMITS.ctaLabel)}
                onChange={(v) => onFieldChange(locale, 'ctaLabel', v)}
            />

            {/* Closing */}
            <FieldRow
                label={et.fieldClosing}
                textarea
                rows={3}
                value={cur.closing ?? ''}
                limit={LIMITS.closing}
                overLimitMessage={overMsg(et.fieldClosing, LIMITS.closing)}
                variables={vars.filter((v) => /brand|support|seller/i.test(v))}
                insertVarLabel={et.insertVar}
                onChange={(v) => onFieldChange(locale, 'closing', v)}
            />

            {otherLocaleMsg && (
                <p role="alert" data-testid="other-locale-limit-error" className="text-xs text-destructive">{otherLocaleMsg}</p>
            )}

            {/* Save footer */}
            <div className="border-t border-slate-100 dark:border-white/[0.06] pt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    {isDirty ? et.unsavedChanges : et.allChangesSaved}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                    {isDirty && (
                        <Button
                            type="button"
                            onClick={onRevert}
                            disabled={isSaving}
                            variant="dashSecondary"
                            size="dash"
                            className="text-xs"
                        >
                            {et.revert}
                        </Button>
                    )}
                    <Button
                        type="button"
                        onClick={onSave}
                        disabled={!isDirty || isSaving || isOverLimit}
                        variant="dashPrimary"
                        size="dash"
                        className="text-xs"
                    >
                        {isSaving ? et.saving : et.saveChanges}
                    </Button>
                </div>
            </div>
        </div>
    )
}
