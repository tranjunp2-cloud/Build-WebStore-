'use client'
/**
 * builder-header.tsx
 * Top bar: editable template name, status dropdown, save button.
 * Viewport switcher stub (desktop only for MVP).
 */
import { useState } from 'react'
import { Save, Loader2, Monitor, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useBuilderStore } from '@/lib/admin/builder-store'
import { clearAutoSave } from '@/lib/admin/builder-auto-save'

const STATUS_OPTIONS = ['draft', 'review', 'live', 'scheduled', 'archived'] as const
type TemplateStatus = typeof STATUS_OPTIONS[number]

interface Props {
    templateName: string
    templateStatus: TemplateStatus
    templateId: number
    onNameChange: (name: string) => void
    onStatusChange: (status: TemplateStatus) => void
}

export function BuilderHeader({
    templateName,
    templateStatus,
    templateId,
    onNameChange,
    onStatusChange,
}: Props) {
    const [saving, setSaving] = useState(false)
    const [changelog, setChangelog] = useState('')
    const { sections, dirty, markClean } = useBuilderStore()

    async function handleSave() {
        if (saving) return
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/templates/${templateId}/save-sections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections, changelog: changelog || undefined }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
            }
            markClean()
            clearAutoSave(templateId)
            setChangelog('')
            toast.success('Template saved')
        } catch (err) {
            toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setSaving(false)
        }
    }

    return (
        <header className="flex items-center gap-3 px-4 py-2 border-b bg-background flex-shrink-0">
            {/* Back link */}
            <Link
                href="/studio/templates"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
                <ArrowLeft size={13} />
                Templates
            </Link>

            <div className="w-px h-4 bg-border flex-shrink-0" />

            {/* Editable name */}
            <input
                type="text"
                value={templateName}
                onChange={(e) => onNameChange(e.target.value)}
                className="flex-1 min-w-0 text-sm font-medium bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-ring rounded px-1"
                aria-label="Template name"
            />

            {/* Dirty indicator */}
            {dirty && (
                <span className="text-[10px] text-amber-500 flex-shrink-0">Unsaved</span>
            )}

            {/* Viewport stub */}
            <div
                className="flex items-center gap-1 px-2 py-1 rounded border text-xs text-muted-foreground flex-shrink-0"
                title="Desktop view only (MVP)"
            >
                <Monitor size={12} />
                Desktop
            </div>

            {/* Status */}
            <select
                value={templateStatus}
                onChange={(e) => onStatusChange(e.target.value as TemplateStatus)}
                className="text-xs border border-input rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring flex-shrink-0"
                aria-label="Template status"
            >
                {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                ))}
            </select>

            {/* Changelog input */}
            <input
                type="text"
                placeholder="Save note (optional)"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                className="hidden md:block text-xs border border-input rounded px-2 py-1 bg-background w-40 focus:outline-none focus:ring-1 focus:ring-ring"
                maxLength={500}
            />

            {/* Save */}
            <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex-shrink-0"
            >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save
            </button>
        </header>
    )
}
