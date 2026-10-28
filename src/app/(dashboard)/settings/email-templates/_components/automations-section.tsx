'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ClipboardCheck, Globe, MessageSquare, Package, Percent, Play, ShoppingCart, Sparkles, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { AUTOMATION_IDS, type AutomationId, type AutomationSettings } from '@/lib/automations/automation-config'
import type { AutomationPreview } from '@/lib/automations/automation-runner'
import { previewAutomationsAction, saveAutomationSettingsAction } from '../automation-actions'

const ICONS: Record<AutomationId, LucideIcon> = {
    discounts: Percent,
    stock: Package,
    orders_waiting: ShoppingCart,
    leads: MessageSquare,
    site_health: Globe,
}

const CARD_STYLE = { border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' } as const

interface Props {
    initial: AutomationSettings
    /** Owner or admin of the workspace; everyone else sees the settings read-only */
    canEdit: boolean
}

/** Settings > Email templates > Automations: which scheduled checks remind you (bell) and whether a digest email goes out. */
export function AutomationsSection({ initial, canEdit }: Props) {
    const { t, ti } = useI18n()
    const a = t.dashboard.settings.automations
    const [saved, setSaved] = useState(initial)
    const [draft, setDraft] = useState(initial)
    const [preview, setPreview] = useState<AutomationPreview | null>(null)
    const [isSaving, startSaving] = useTransition()
    const [isRunning, startRunning] = useTransition()

    const dirty = JSON.stringify([draft.enabled, draft.digest]) !== JSON.stringify([saved.enabled, saved.digest])

    const fail = (error: string) => void toast.error(a.errors[error as keyof typeof a.errors] ?? a.errors.failed)

    function save() {
        startSaving(async () => {
            const result = await saveAutomationSettingsAction({ enabled: draft.enabled, digest: draft.digest })
            if (!result.success) {
                fail(result.error)
                return
            }
            setSaved(result.data)
            setDraft(result.data)
            setPreview(null)
            toast.success(a.saved)
        })
    }

    function runNow() {
        startRunning(async () => {
            const result = await previewAutomationsAction()
            if (!result.success) {
                fail(result.error)
                return
            }
            setPreview(result.data)
        })
    }

    return (
        <section className="mt-10" data-testid="automations-section">
            <h2 className="text-xl font-bold text-[var(--dash-text)] mb-1">{a.title}</h2>
            <p className="text-sm text-[var(--dash-text-muted)] mb-4">{a.subtitle}</p>
            {!canEdit && <p className="text-xs text-[var(--dash-text-muted)] mb-3" role="note">{a.ownerOnly}</p>}

            <div className="flex flex-col overflow-hidden rounded-[16px]" style={CARD_STYLE}>
                {AUTOMATION_IDS.map((id, index) => {
                    const Icon = ICONS[id]
                    return (
                        <div key={id} className="flex items-center justify-between gap-4 p-4 sm:px-[25px]" style={index ? { borderTop: '1px solid var(--dash-border)' } : undefined}>
                            <div className="flex items-start gap-4 min-w-0">
                                <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px] bg-[hsl(var(--primary)/0.1)] shrink-0">
                                    <Icon className="h-[18px] w-[18px] text-[hsl(var(--primary))]" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-[15px] font-semibold text-[var(--dash-text)]">{a.items[id].title}</h3>
                                    <p className="mt-0.5 text-[13px] text-[var(--dash-text-muted)]">{a.items[id].desc}</p>
                                </div>
                            </div>
                            <Switch
                                checked={draft.enabled[id]}
                                disabled={!canEdit || isSaving}
                                onCheckedChange={(on) => setDraft((d) => ({ ...d, enabled: { ...d.enabled, [id]: on } }))}
                                aria-label={a.items[id].title}
                            />
                        </div>
                    )
                })}
            </div>

            <div className="mt-4 flex flex-col overflow-hidden rounded-[16px]" style={CARD_STYLE}>
                <div className="flex items-start justify-between gap-4 p-4 sm:px-[25px]">
                    <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold text-[var(--dash-text)]">{a.digestTitle}</h3>
                        <p className="mt-0.5 text-[13px] text-[var(--dash-text-muted)]">{a.digestDesc}</p>
                    </div>
                    <Switch
                        checked={draft.digest.enabled}
                        disabled={!canEdit || isSaving}
                        onCheckedChange={(on) => setDraft((d) => ({ ...d, digest: { ...d.digest, enabled: on } }))}
                        aria-label={a.digestTitle}
                    />
                </div>
                {draft.digest.enabled && (
                    <div className="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-[25px]" role="group" aria-label={a.frequency}>
                        <span className="text-[13px] text-[var(--dash-text-muted)] mr-1">{a.frequency}</span>
                        {(['daily', 'weekly'] as const).map((frequency) => (
                            <Button
                                key={frequency}
                                type="button"
                                size="sm"
                                variant={draft.digest.frequency === frequency ? 'default' : 'dashSecondary'}
                                aria-pressed={draft.digest.frequency === frequency}
                                disabled={!canEdit || isSaving}
                                onClick={() => setDraft((d) => ({ ...d, digest: { ...d.digest, frequency } }))}
                            >
                                {a[frequency]}
                            </Button>
                        ))}
                    </div>
                )}
            </div>

            <p className="mt-3 text-xs text-[var(--dash-text-muted)]">{a.quiet}</p>

            {canEdit && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button type="button" variant="dashPrimary" size="dash" disabled={!dirty || isSaving} onClick={save}>
                        {isSaving ? a.saving : a.save}
                    </Button>
                    <Button type="button" variant="dashSecondary" size="dash" disabled={dirty || isRunning} onClick={runNow} title={dirty ? a.saveFirst : undefined}>
                        <Play className="h-4 w-4" />{isRunning ? a.running : a.runNow}
                    </Button>
                </div>
            )}

            {preview && (
                <div className="mt-4 rounded-[16px] p-4 sm:px-[25px]" style={CARD_STYLE} role="status" data-testid="automations-preview">
                    <h3 className="text-[15px] font-semibold text-[var(--dash-text)]">{a.previewTitle}</h3>
                    <p className="mt-0.5 mb-3 text-xs text-[var(--dash-text-muted)]">{a.previewNote}</p>
                    {preview.reminders.length === 0 ? (
                        <p className="flex items-center gap-2 text-[13px] text-[var(--dash-text)]"><ClipboardCheck className="h-4 w-4" />{a.previewEmpty}</p>
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {preview.reminders.map((reminder) => (
                                <li key={reminder.automation} className="flex items-start justify-between gap-3" data-automation={reminder.automation}>
                                    <span className="min-w-0">
                                        <span className="block text-[14px] font-semibold text-[var(--dash-text)]">{reminder.title}</span>
                                        <span className="block text-[13px] text-[var(--dash-text-muted)]">{reminder.message}</span>
                                    </span>
                                    <Link className="shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold text-[hsl(var(--primary))]" href={reminder.actionUrl}>
                                        <Sparkles className="h-3.5 w-3.5" />{a.fix}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                    {preview.mondayOnly.length > 0 && (
                        <p className="mt-3 text-xs text-[var(--dash-text-muted)]">{ti(a.mondayOnly, { names: preview.mondayOnly.map((id) => a.items[id].title).join(', ') })}</p>
                    )}
                </div>
            )}
        </section>
    )
}
