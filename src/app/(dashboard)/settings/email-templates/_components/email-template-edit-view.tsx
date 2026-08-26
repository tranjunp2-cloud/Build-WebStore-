'use client'

import { useMemo } from 'react'
import { ArrowLeft, Mail, AlertTriangle, Send, ExternalLink } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { EmailTemplateType, EmailRecipient } from '@/lib/email/types'
import type { ContentFields } from '../actions'
import type { TemplateRow } from './EmailTemplatesClient'
import { EmailTemplateFormCard } from './email-template-form-card'
import { EmailPreviewPane } from './EmailPreviewPane'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

const CRITICAL_TYPES: EmailTemplateType[] = ['otp-verification', 'forgot-password', 'password-changed']

function toLabel(type: EmailTemplateType): string {
    return type
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
}

function relTime(iso: string | undefined, neverLabel: string, lastEditedTpl: string, ti: (tpl: string, vars: Record<string, string | number>) => string): string {
    if (!iso) return neverLabel
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return ti(lastEditedTpl, { time: `${mins}m ago` })
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return ti(lastEditedTpl, { time: `${hrs}h ago` })
    return ti(lastEditedTpl, { time: `${Math.floor(hrs / 24)}d ago` })
}

interface Props {
    templateType: EmailTemplateType
    recipient: EmailRecipient
    existingRow: TemplateRow | undefined
    locale: 'en' | 'ms'
    draft: { contentEn: ContentFields; contentMs: ContentFields; enabled: boolean }
    isDirty: boolean
    isSaving: boolean
    isSendingTest: boolean
    saveError: string | null
    onBack: () => void
    onLocaleChange: (locale: 'en' | 'ms') => void
    onFieldChange: (locale: 'en' | 'ms', field: keyof ContentFields, value: string) => void
    onEnabledChange: (val: boolean) => void
    onSave: () => void
    onRevert: () => void
    onReset: () => void
    onSendTest: () => void
    onOpenInNewTab: () => void
}

export function EmailTemplateEditView({
    templateType,
    recipient,
    existingRow,
    locale,
    draft,
    isDirty,
    isSaving,
    isSendingTest,
    saveError,
    onBack,
    onLocaleChange,
    onFieldChange,
    onEnabledChange,
    onSave,
    onRevert,
    onReset,
    onSendTest,
    onOpenInNewTab,
}: Props) {
    const { t, ti } = useI18n()
    const et = t.dashboard.settings.emailTemplates
    const isCritical = CRITICAL_TYPES.includes(templateType)
    const isCustomized = Boolean(existingRow)

    const draftConfig = useMemo(() => ({
        enabled: draft.enabled,
        ...(locale === 'en' ? draft.contentEn : (draft.contentMs ?? draft.contentEn)),
    }), [draft.enabled, draft.contentEn, draft.contentMs, locale])

    return (
        <div className="w-full">
            {/* Header — mobile (<md): info row + action buttons stack as 2 explicit rows
                (buttons full-width) instead of relying on flex-wrap, which could crush the
                title/badge/metadata column when both action buttons demand their own space
                on the same line (GH-1499 issue 3). md+: back to a single row, unchanged. */}
            <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center">
                <div className="flex items-center gap-3 min-w-0">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    onClick={onBack}
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{et.backToList}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--info))] to-[hsl(var(--primary))] shrink-0">
                        <Mail className="h-5 w-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-bold text-white">{toLabel(templateType)}</h2>
                            {isCustomized && (
                                <span className="bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded">
                                    {et.customized}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                            <span>{recipient === 'buyer' ? et.buyerFacing : et.sellerFacing}</span>
                            <span>·</span>
                            <span>{relTime(existingRow?.updatedAt, et.neverEdited, et.lastEdited, ti)}</span>
                            <span>·</span>
                            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                                tpl_{templateType}
                            </code>
                        </div>
                    </div>
                </div>

                {/* Header action buttons — full-width on mobile, own row; inline+shrink-0 from md */}
                <TooltipProvider>
                    <div className="flex items-center gap-2 md:shrink-0">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    onClick={onSendTest}
                                    disabled={isSendingTest}
                                    variant="dashSecondary"
                                    size="dash"
                                    className="flex-1 md:flex-none text-xs"
                                >
                                    <Send className="h-3.5 w-3.5" />
                                    {isSendingTest ? et.sending : et.sendTest}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{et.sendTestTitle}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    onClick={onOpenInNewTab}
                                    variant="dashSecondary"
                                    size="dash"
                                    className="flex-1 md:flex-none text-xs"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    {et.openInNewTab}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{et.openInNewTabTitle}</TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            </div>

            {/* Save error banner */}
            {saveError && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {saveError}
                </div>
            )}

            {/* Split layout — only true desktop (xl, ≥1280px) gets the 2-column split; phone
                AND tablet/iPad (mini/Air/Pro, all <1280px) stack to 1 column so neither the
                form nor the preview gets squeezed into a too-narrow side-by-side column. */}
            <div className="grid gap-6 grid-cols-1 xl:grid-cols-[minmax(360px,4fr)_minmax(420px,6fr)]">
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
                    onRevert={onRevert}
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
