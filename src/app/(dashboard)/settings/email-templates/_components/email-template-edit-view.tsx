'use client'

import { useMemo } from 'react'
import { ArrowLeft, Mail, AlertTriangle, Undo2, Check } from 'lucide-react'
import type { EmailTemplateType, EmailRecipient } from '@/lib/email/types'
import type { ContentFields } from '../actions'
import type { TemplateRow } from './EmailTemplatesClient'
import { EmailTemplateFormCard } from './email-template-form-card'
import { EmailPreviewPane } from './EmailPreviewPane'

const CRITICAL_TYPES: EmailTemplateType[] = ['otp-verification', 'forgot-password', 'password-changed']

function toLabel(type: EmailTemplateType): string {
    return type
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
}

function relTime(iso?: string): string {
    if (!iso) return 'Never'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

interface Props {
    templateType: EmailTemplateType
    recipient: EmailRecipient
    existingRow: TemplateRow | undefined
    locale: 'en' | 'ms'
    draft: { contentEn: ContentFields; contentMs: ContentFields; enabled: boolean }
    isDirty: boolean
    isSaving: boolean
    onBack: () => void
    onLocaleChange: (locale: 'en' | 'ms') => void
    onFieldChange: (locale: 'en' | 'ms', field: keyof ContentFields, value: string) => void
    onEnabledChange: (val: boolean) => void
    onSave: () => void
    onRevert: () => void
    onReset: () => void
}

export function EmailTemplateEditView({
    templateType,
    recipient,
    existingRow,
    locale,
    draft,
    isDirty,
    isSaving,
    onBack,
    onLocaleChange,
    onFieldChange,
    onEnabledChange,
    onSave,
    onRevert,
    onReset,
}: Props) {
    const isCritical = CRITICAL_TYPES.includes(templateType)
    const isCustomized = Boolean(existingRow)

    const draftConfig = useMemo(() => ({
        enabled: draft.enabled,
        ...(locale === 'en' ? draft.contentEn : (draft.contentMs ?? draft.contentEn)),
    }), [draft.enabled, draft.contentEn, draft.contentMs, locale])

    return (
        <div className="max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.06] text-slate-400 hover:bg-white/10 hover:text-white transition-colors shrink-0"
                    title="Back to list"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 shrink-0">
                    <Mail className="h-5 w-5 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-white">{toLabel(templateType)}</h2>
                        {isCustomized && (
                            <span className="bg-blue-500/15 text-blue-400 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded">
                                Customized
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                        <span>{recipient === 'buyer' ? 'Buyer-facing' : 'Seller-facing'}</span>
                        <span>·</span>
                        <span>Last edited {relTime(existingRow?.updatedAt)}</span>
                        <span>·</span>
                        <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                            tpl_{templateType}
                        </code>
                    </div>
                </div>
            </div>

            {/* Dirty bar */}
            {isDirty && (
                <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2.5">
                    <span className="flex items-center gap-2 text-sm text-amber-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Unsaved changes on this template.
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onRevert}
                            className="flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                            Revert
                        </button>
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            <Check className="h-3.5 w-3.5" />
                            Save changes
                        </button>
                    </div>
                </div>
            )}

            {/* Split layout */}
            <div
                className="grid gap-6"
                style={{ gridTemplateColumns: 'minmax(360px, 4fr) minmax(420px, 6fr)' }}
            >
                <EmailTemplateFormCard
                    templateType={templateType}
                    locale={locale}
                    draft={draft}
                    isDirty={isDirty}
                    isSaving={isSaving}
                    isCritical={isCritical}
                    onLocaleChange={onLocaleChange}
                    onFieldChange={onFieldChange}
                    onEnabledChange={onEnabledChange}
                    onSave={onSave}
                />
                <EmailPreviewPane
                    templateType={templateType}
                    locale={locale}
                    draftConfig={draftConfig}
                    onReset={onReset}
                />
            </div>
        </div>
    )
}
