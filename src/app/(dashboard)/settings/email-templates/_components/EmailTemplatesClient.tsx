'use client'

import { useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import type { EmailTemplateType, EmailRecipient } from '@/lib/email/types'
import {
    saveEmailTemplateConfig,
    resetEmailTemplateConfig,
    type ContentFields,
} from '../actions'
import { EmailTemplateListView } from './email-template-list-view'
import { EmailTemplateEditView } from './email-template-edit-view'

export interface TemplateRow {
    id: string | number
    templateType: EmailTemplateType
    recipient: EmailRecipient
    enabled: boolean
    contentEn: ContentFields
    contentMs: ContentFields
    updatedAt?: string
}

export interface EmailTemplatesClientProps {
    tenantId?: string
    initialRows: any[]
}

function normalizeRows(raw: any[]): TemplateRow[] {
    return raw.map((r: any) => ({
        id: r.id,
        templateType: r.templateType as EmailTemplateType,
        recipient: r.recipient as EmailRecipient,
        enabled: r.enabled ?? true,
        contentEn: r.contentEn ?? {},
        contentMs: r.contentMs ?? {},
        updatedAt: r.updatedAt,
    }))
}

const EMPTY_CONTENT: ContentFields = {
    subject: '',
    greeting: '',
    ctaLabel: '',
    closing: '',
}

export function EmailTemplatesClient({ initialRows }: EmailTemplatesClientProps) {
    const { t, ti } = useI18n()
    const et = t.dashboard.settings.emailTemplates
    const [rows, setRows] = useState<TemplateRow[]>(() => normalizeRows(initialRows))
    const [audienceTab, setAudienceTab] = useState<'buyer' | 'seller'>('buyer')
    const [selectedTemplateId, setSelectedTemplateId] = useState<EmailTemplateType | null>(null)
    const [selectedRecipient, setSelectedRecipient] = useState<EmailRecipient | null>(null)
    const [locale, setLocale] = useState<'en' | 'ms'>('en')
    const [draft, setDraft] = useState<{
        contentEn: ContentFields
        contentMs: ContentFields
        enabled: boolean
    }>({ contentEn: { ...EMPTY_CONTENT }, contentMs: { ...EMPTY_CONTENT }, enabled: true })
    const [isDirty, setIsDirty] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [isSaving, startSaving] = useTransition()
    const [isSendingTest, setIsSendingTest] = useState(false)

    const findRow = (type: EmailTemplateType, recipient: EmailRecipient): TemplateRow | undefined =>
        rows.find((r) => r.templateType === type && r.recipient === recipient)

    function handleSelectTemplate(templateType: EmailTemplateType, recipient: EmailRecipient) {
        const row = findRow(templateType, recipient)
        setSelectedTemplateId(templateType)
        setSelectedRecipient(recipient)
        setLocale('en')
        setDraft({
            contentEn: row ? { ...row.contentEn } : { ...EMPTY_CONTENT },
            contentMs: row ? { ...row.contentMs } : { ...EMPTY_CONTENT },
            enabled: row ? row.enabled : true,
        })
        setIsDirty(false)
        setSaveError(null)
    }

    function handleBack() {
        setSelectedTemplateId(null)
        setSelectedRecipient(null)
        setIsDirty(false)
    }

    function handleFieldChange(loc: 'en' | 'ms', field: keyof ContentFields, value: string) {
        setDraft((prev) => {
            if (loc === 'en') {
                return { ...prev, contentEn: { ...prev.contentEn, [field]: value } }
            }
            return { ...prev, contentMs: { ...prev.contentMs, [field]: value } }
        })
        setIsDirty(true)
    }

    function handleEnabledChange(val: boolean) {
        setDraft((prev) => ({ ...prev, enabled: val }))
        setIsDirty(true)
    }

    function handleRevert() {
        if (!selectedTemplateId || !selectedRecipient) return
        const row = findRow(selectedTemplateId, selectedRecipient)
        setDraft({
            contentEn: row ? { ...row.contentEn } : { ...EMPTY_CONTENT },
            contentMs: row ? { ...row.contentMs } : { ...EMPTY_CONTENT },
            enabled: row ? row.enabled : true,
        })
        setIsDirty(false)
        setSaveError(null)
    }

    function handleSave() {
        if (!selectedTemplateId || !selectedRecipient) return
        startSaving(async () => {
            const result = await saveEmailTemplateConfig({
                templateType: selectedTemplateId,
                recipient: selectedRecipient,
                enabled: draft.enabled,
                contentEn: draft.contentEn,
                contentMs: draft.contentMs,
            })
            if (result.success) {
                const now = new Date().toISOString()
                setSaveError(null)
                setRows((prev) => {
                    const existing = prev.find(
                        (r) => r.templateType === selectedTemplateId && r.recipient === selectedRecipient
                    )
                    const updated: TemplateRow = {
                        id: existing?.id ?? `${selectedTemplateId}-${selectedRecipient}`,
                        templateType: selectedTemplateId,
                        recipient: selectedRecipient,
                        enabled: draft.enabled,
                        contentEn: { ...draft.contentEn },
                        contentMs: { ...draft.contentMs },
                        updatedAt: now,
                    }
                    if (existing) {
                        return prev.map((r) =>
                            r.templateType === selectedTemplateId && r.recipient === selectedRecipient
                                ? updated
                                : r
                        )
                    }
                    return [...prev, updated]
                })
                setIsDirty(false)
                toast.success(et.toast.saved)
            } else {
                setSaveError(result.error ?? et.toast.saveFailed)
                toast.error(result.error ?? et.toast.saveFailed)
                console.error('[EmailTemplatesClient] save failed:', result.error)
            }
        })
    }

    function handleReset() {
        if (!selectedTemplateId || !selectedRecipient) return
        startSaving(async () => {
            const result = await resetEmailTemplateConfig(selectedTemplateId, selectedRecipient)
            if (result.success) {
                setRows((prev) =>
                    prev.filter(
                        (r) => !(r.templateType === selectedTemplateId && r.recipient === selectedRecipient)
                    )
                )
                setDraft({ contentEn: { ...EMPTY_CONTENT }, contentMs: { ...EMPTY_CONTENT }, enabled: true })
                setIsDirty(false)
                toast.success(et.toast.reset)
            } else {
                toast.error(et.toast.resetFailed)
                console.error('[EmailTemplatesClient] reset failed:', result.error)
            }
        })
    }

    const handleSendTest = useCallback(async () => {
        if (!selectedTemplateId || !selectedRecipient || isSendingTest) return
        setIsSendingTest(true)
        try {
            const draftConfig = {
                enabled: draft.enabled,
                ...(locale === 'en' ? draft.contentEn : (draft.contentMs ?? draft.contentEn)),
            }
            const res = await fetch('/api/email-templates/send-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateType: selectedTemplateId, locale, draftConfig }),
            })
            if (res.ok) {
                const json = await res.json().catch(() => ({}))
                toast.success(ti(et.toast.testSent, { email: json.sentTo ?? '' }))
            } else {
                const json = await res.json().catch(() => ({}))
                toast.error(json.error ?? et.toast.testFailed)
                console.error('[SendTest] failed:', json)
            }
        } catch (err) {
            toast.error(et.toast.testFailed)
            console.error('[SendTest] error:', err)
        } finally {
            setIsSendingTest(false)
        }
    }, [selectedTemplateId, selectedRecipient, isSendingTest, draft, locale])

    const handleOpenInNewTab = useCallback(async () => {
        if (!selectedTemplateId) return
        try {
            const draftConfig = {
                enabled: draft.enabled,
                ...(locale === 'en' ? draft.contentEn : (draft.contentMs ?? draft.contentEn)),
            }
            const res = await fetch('/api/email-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateType: selectedTemplateId, locale, draftConfig }),
            })
            if (!res.ok) return
            const { subject, html } = await res.json()
            const win = window.open('', '_blank')
            if (win) {
                const safeSubject = (subject ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
                win.document.open()
                win.document.write(`<!DOCTYPE html><html><head><title>${safeSubject || 'Email Preview'}</title></head><body style="margin:0;background:#f1f5f9;font-family:sans-serif"><div style="background:#1e293b;color:#94a3b8;padding:12px 24px;font-size:12px;display:flex;align-items:center;gap:8px"><span style="color:#64748b">Subject:</span><span style="color:#f1f5f9;font-weight:600">${safeSubject}</span></div>${html}</body></html>`)
                win.document.close()
            }
        } catch (err) {
            console.error('[OpenInNewTab] error:', err)
        }
    }, [selectedTemplateId, draft, locale])

    function handleListToggle(
        templateType: EmailTemplateType,
        recipient: EmailRecipient,
        enabled: boolean
    ) {
        const row = findRow(templateType, recipient)
        // Optimistic update
        setRows((prev) => {
            const existing = prev.find((r) => r.templateType === templateType && r.recipient === recipient)
            if (existing) {
                return prev.map((r) =>
                    r.templateType === templateType && r.recipient === recipient
                        ? { ...r, enabled }
                        : r
                )
            }
            return [
                ...prev,
                {
                    id: `${templateType}-${recipient}`,
                    templateType,
                    recipient,
                    enabled,
                    contentEn: { ...EMPTY_CONTENT },
                    contentMs: { ...EMPTY_CONTENT },
                    updatedAt: new Date().toISOString(),
                },
            ]
        })

        // Persist in background
        saveEmailTemplateConfig({
            templateType,
            recipient,
            enabled,
            contentEn: row?.contentEn ?? EMPTY_CONTENT,
            contentMs: row?.contentMs,
        }).then((result) => {
            if (result.success) {
                toast.success(enabled ? et.toast.enabled : et.toast.disabled)
            } else {
                // Revert optimistic update on failure
                setRows((prev) =>
                    prev.map((r) =>
                        r.templateType === templateType && r.recipient === recipient
                            ? { ...r, enabled: !r.enabled }
                            : r
                    )
                )
                toast.error(result.error ?? et.toast.updateFailed)
                console.error('[EmailTemplatesClient] toggle failed:', result.error)
            }
        }).catch((err: unknown) => {
            toast.error(et.toast.updateFailed)
            console.error('[EmailTemplatesClient] toggle error:', err)
        })
    }

    if (selectedTemplateId && selectedRecipient) {
        return (
            <EmailTemplateEditView
                templateType={selectedTemplateId}
                recipient={selectedRecipient}
                existingRow={findRow(selectedTemplateId, selectedRecipient)}
                locale={locale}
                draft={draft}
                isDirty={isDirty}
                isSaving={isSaving}
                isSendingTest={isSendingTest}
                saveError={saveError}
                onBack={handleBack}
                onLocaleChange={setLocale}
                onFieldChange={handleFieldChange}
                onEnabledChange={handleEnabledChange}
                onSave={handleSave}
                onRevert={handleRevert}
                onReset={handleReset}
                onSendTest={handleSendTest}
                onOpenInNewTab={handleOpenInNewTab}
            />
        )
    }

    return (
        <EmailTemplateListView
            rows={rows}
            audienceTab={audienceTab}
            onTabChange={setAudienceTab}
            onSelectTemplate={handleSelectTemplate}
            onToggleEnabled={handleListToggle}
        />
    )
}
