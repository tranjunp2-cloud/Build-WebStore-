'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { resolveApiError } from '@/lib/ui/resolve-api-error'
import type { EmailTemplateType, EmailRecipient } from '@/lib/email/types'
import type { ContentFields } from '@/lib/email/template-default-fields'
import {
    saveEmailTemplateConfig,
    resetEmailTemplateConfig,
    getEmailTemplateSettings,
} from '../actions'
import { EmailTemplateListView } from './email-template-list-view'
import { EmailTemplateEditView } from './email-template-edit-view'
import { AgentChangedNotice, SaveConflictNotice } from '@/components/agent/agent-changed-notice'
import { useSaveVersion } from '@/lib/save-version/use-save-version'
import { isVersionConflict } from '@/lib/save-version/save-version'

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
    defaultsByType: Record<EmailTemplateType, { contentEn: ContentFields; contentMs: ContentFields }>
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

/**
 * Merges a saved CMS row's content with template defaults.
 * Per-field: uses the saved row value if non-empty, otherwise falls back to the default.
 * Returns empty string if neither exists, so inputs never show undefined.
 */
function withDefaults(rowContent: ContentFields | undefined, defaults: ContentFields): ContentFields {
    return {
        subject: rowContent?.subject || defaults.subject || '',
        greeting: rowContent?.greeting || defaults.greeting || '',
        ctaLabel: rowContent?.ctaLabel || defaults.ctaLabel || '',
        closing: rowContent?.closing || defaults.closing || '',
    }
}

type Draft = { contentEn: ContentFields; contentMs: ContentFields; enabled: boolean }

/** The editor's starting values for a template: its saved row over the defaults (or the defaults alone). */
function draftFromRow(row: TemplateRow | undefined, defaults: { contentEn: ContentFields; contentMs: ContentFields }): Draft {
    return {
        contentEn: withDefaults(row?.contentEn, defaults.contentEn),
        contentMs: withDefaults(row?.contentMs, defaults.contentMs),
        enabled: row ? row.enabled : true,
    }
}

/** Did what the editor is built on (not the timestamp) change between two reads of the same template? */
function rowChanged(a: TemplateRow | undefined, b: TemplateRow | undefined): boolean {
    const key = (r: TemplateRow | undefined) => JSON.stringify(r && [r.enabled, r.contentEn, r.contentMs])
    return key(a) !== key(b)
}

export function EmailTemplatesClient({ initialRows, defaultsByType }: EmailTemplatesClientProps) {
    const { t, ti } = useI18n()
    const et = t.dashboard.settings.emailTemplates
    const sub = t.common.subscriptionErrors
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
    // the assistant changed the open template while it has unsaved edits: nothing is overwritten until the merchant picks
    const [stale, setStale] = useState(false)
    useEffect(() => { if (!isDirty) setStale(false) }, [isDirty])
    // The open template's row version, sent with each save: its updatedAt, or null when the editor started from the
    // built-in default (a row created meanwhile is then a conflict, too).
    const version = useSaveVersion()

    // The page was rendered again on the server (the assistant changed a template): take the new rows. An open
    // editor for a changed template reloads silently, or, with unsaved edits, asks first.
    const [seenRows, setSeenRows] = useState(initialRows)
    if (initialRows !== seenRows) {
        setSeenRows(initialRows)
        const next = normalizeRows(initialRows)
        setRows(next)
        if (selectedTemplateId && selectedRecipient) {
            const sameRow = (r: TemplateRow) => r.templateType === selectedTemplateId && r.recipient === selectedRecipient
            const fresh = next.find(sameRow)
            if (rowChanged(rows.find(sameRow), fresh)) {
                if (isDirty) setStale(true)
                else {
                    setDraft(draftFromRow(fresh, defaultsByType[selectedTemplateId]))
                    version.set(fresh ? fresh.updatedAt : null)
                }
            } else version.set(fresh ? fresh.updatedAt : null)
        }
    }

    const findRow = (type: EmailTemplateType, recipient: EmailRecipient): TemplateRow | undefined =>
        rows.find((r) => r.templateType === type && r.recipient === recipient)

    function handleSelectTemplate(templateType: EmailTemplateType, recipient: EmailRecipient) {
        const row = findRow(templateType, recipient)
        setSelectedTemplateId(templateType)
        setSelectedRecipient(recipient)
        setLocale('en')
        setDraft(draftFromRow(row, defaultsByType[templateType]))
        setIsDirty(false)
        setSaveError(null)
        version.set(row ? row.updatedAt : null)
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
        setDraft(draftFromRow(findRow(selectedTemplateId, selectedRecipient), defaultsByType[selectedTemplateId]))
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
                expectedUpdatedAt: version.current(),
            })
            if (version.refused(result)) return
            if (result.success) {
                setSaveError(null)
                version.set(result.updatedAt)
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
                        updatedAt: result.updatedAt,
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
                const errMsg = resolveApiError(result, et.toast.saveFailed, sub)
                setSaveError(errMsg)
                toast.error(errMsg)
                console.error('[EmailTemplatesClient] save failed:', result.error)
            }
        })
    }

    // Load the latest: the editor's template as it is saved now; the edits are dropped.
    async function handleLoadLatest() {
        if (!selectedTemplateId || !selectedRecipient) return
        const res = await getEmailTemplateSettings()
        if (!res.success || !res.rows) {
            console.error('[EmailTemplatesClient] load latest failed:', res.error)
            return
        }
        const next = normalizeRows(res.rows)
        const row = next.find((r) => r.templateType === selectedTemplateId && r.recipient === selectedRecipient)
        setRows(next)
        setDraft(draftFromRow(row, defaultsByType[selectedTemplateId]))
        setIsDirty(false)
        setSaveError(null)
        version.set(row ? row.updatedAt : null)
    }

    function handleReset() {
        if (!selectedTemplateId || !selectedRecipient) return
        // Capture before async so closure sees the correct template id
        const typeId = selectedTemplateId
        startSaving(async () => {
            const result = await resetEmailTemplateConfig(typeId, selectedRecipient)
            if (result.success) {
                setRows((prev) =>
                    prev.filter(
                        (r) => !(r.templateType === typeId && r.recipient === selectedRecipient)
                    )
                )
                const typeDefaults = defaultsByType[typeId]
                setDraft({
                    contentEn: { ...typeDefaults.contentEn },
                    contentMs: { ...typeDefaults.contentMs },
                    enabled: true,
                })
                setIsDirty(false)
                version.set(null)
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
        // Open the tab SYNCHRONOUSLY inside the click gesture so popup blockers (Safari) allow it,
        // and WITHOUT `noopener` — `window.open(..., 'noopener')` returns null, which previously left
        // a blank about:blank tab because the document.write block never ran.
        const win = window.open('', '_blank')
        if (!win) {
            toast.error(et.toast.popupBlocked)
            return
        }
        win.opener = null // sever opener access without relying on the noopener flag
        win.document.write('<!DOCTYPE html><title>Loading…</title><body style="margin:0;font-family:sans-serif;padding:24px;color:#64748b">Loading preview…</body>')
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
            if (!res.ok) throw new Error(`Preview API ${res.status}`)
            const { subject, html } = await res.json()
            const safeSubject = (subject ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            win.document.open()
            win.document.write(`<!DOCTYPE html><html><head><title>${safeSubject || 'Email Preview'}</title></head><body style="margin:0;background:#f1f5f9;font-family:sans-serif"><div style="background:#1e293b;color:#94a3b8;padding:12px 24px;font-size:12px;display:flex;align-items:center;gap:8px"><span style="color:#64748b">Subject:</span><span style="color:#f1f5f9;font-weight:600">${safeSubject}</span></div>${html}</body></html>`)
            win.document.close()
        } catch (err) {
            console.error('[OpenInNewTab] error:', err)
            win.document.open()
            win.document.write('<!DOCTYPE html><title>Preview failed</title><body style="margin:0;font-family:sans-serif;padding:24px;color:#ef4444">Failed to load preview. Please close this tab and try again.</body>')
            win.document.close()
            toast.error(et.toast.previewFailed)
        }
    }, [selectedTemplateId, draft, locale, et])

    function handleListToggle(
        templateType: EmailTemplateType,
        recipient: EmailRecipient,
        enabled: boolean
    ) {
        const row = findRow(templateType, recipient)
        const previousEnabled = row?.enabled ?? true  // capture pre-click value for accurate rollback
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
            expectedUpdatedAt: row ? row.updatedAt : null,
        }).then(async (result) => {
            if (result.success) {
                const same = (r: TemplateRow) => r.templateType === templateType && r.recipient === recipient
                setRows((prev) => prev.map((r) => (same(r) ? { ...r, updatedAt: result.updatedAt } : r)))
                toast.success(enabled ? et.toast.enabled : et.toast.disabled)
            } else {
                // Revert to pre-click value (not !r.enabled which races under rapid toggles)
                setRows((prev) =>
                    prev.map((r) =>
                        r.templateType === templateType && r.recipient === recipient
                            ? { ...r, enabled: previousEnabled }
                            : r
                    )
                )
                if (isVersionConflict(result)) {
                    // changed elsewhere since the list was read: nothing was written; show the rows as they are now
                    toast.error(t.dashboard.agentChanged.changedElsewhere)
                    const fresh = await getEmailTemplateSettings()
                    if (fresh.success && fresh.rows) setRows(normalizeRows(fresh.rows))
                    return
                }
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
                notice={version.conflicted
                    ? <SaveConflictNotice record="template" onLoadLatest={handleLoadLatest} onSaveAnyway={() => { version.overwrite(); handleSave() }} />
                    : stale ? <AgentChangedNotice record="template" onReload={handleRevert} onKeep={() => setStale(false)} /> : undefined}
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
