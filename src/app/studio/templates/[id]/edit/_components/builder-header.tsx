'use client'
/**
 * builder-header.tsx
 * Top bar: editable template name, status pill, mode tabs (Builder/Catalog),
 * viewport switcher stub, Save and Publish buttons.
 * Ported from builder.jsx header + builder.css .b-topbar rules.
 */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useBuilderStore } from '@/lib/admin/builder-store'
import { clearAutoSave } from '@/lib/admin/builder-auto-save'
import { canEditTemplateContent, canSetTemplateStatus } from '@/lib/admin/studio-permissions'
import { useStudioCan, useStudioRoles } from '../../../../_components/studio-permissions-context'

const STATUS_OPTIONS = ['draft', 'review', 'live', 'scheduled', 'archived'] as const
type TemplateStatus = typeof STATUS_OPTIONS[number]
type BuilderMode = 'builder' | 'catalog' | 'block-detail'

interface Props {
    templateName: string
    templateStatus: TemplateStatus
    templateId: number
    onNameChange: (name: string) => void
    /** Resolves true when the server accepted the new status. */
    onStatusChange: (status: TemplateStatus) => Promise<boolean>
    mode: BuilderMode
    onModeChange: (mode: 'builder' | 'catalog') => void
}

export function BuilderHeader({
    templateName,
    templateStatus,
    templateId,
    onNameChange,
    onStatusChange,
    mode,
    onModeChange,
}: Props) {
    const [saving, setSaving] = useState(false)
    const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
    const { sections, dirty, markClean } = useBuilderStore()
    const roles = useStudioRoles()
    const can = useStudioCan()
    const canEditContent = canEditTemplateContent(roles, templateStatus)
    const canPublish = can('template.review')
    const canSendForReview = templateStatus === 'draft' && canSetTemplateStatus(roles, 'draft', 'review')

    async function handleSave(): Promise<boolean> {
        if (saving) return false
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/templates/${templateId}/save-sections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
            }
            markClean()
            clearAutoSave(templateId)
            toast.success('Template saved')
            return true
        } catch (err) {
            toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
            return false
        } finally {
            setSaving(false)
        }
    }

    async function handlePublish() {
        // Save first: a live template no longer accepts content saves, and a reviewer has none to make.
        if (saving) return
        if (canEditContent && dirty && !(await handleSave())) return
        if (await onStatusChange('live')) toast.success('Published')
    }

    async function handleSendForReview() {
        if (saving) return
        if (dirty && !(await handleSave())) return
        if (await onStatusChange('review')) toast.success('Sent for review')
    }

    return (
        <header className="b-topbar">
            {/* Back link */}
            <Link href="/studio/templates" className="b-back">
                ← Templates
            </Link>

            {/* Breadcrumb */}
            <div className="b-crumb">
                <span>Studio</span>
                <span className="b-crumb-sep">/</span>
                <span>Templates</span>
                <span className="b-crumb-sep">/</span>
                <strong>Builder</strong>
            </div>

            <span className="b-divider" aria-hidden />

            {/* Editable template name */}
            <input
                type="text"
                className="b-title-input"
                value={templateName}
                onChange={(e) => onNameChange(e.target.value)}
                readOnly={!canEditContent}
                aria-label="Template name"
            />

            {/* Status pill */}
            <span className={`b-status-pill ${templateStatus}`}>
                <span className="dot" />
                {templateStatus}
            </span>

            {/* Viewport switcher */}
            <div className="b-seg b-vp-seg">
                <button
                    type="button"
                    className={viewport === 'desktop' ? 'active' : ''}
                    onClick={() => setViewport('desktop')}
                >
                    ▢ Desktop
                </button>
                <button
                    type="button"
                    className={viewport === 'tablet' ? 'active' : ''}
                    onClick={() => setViewport('tablet')}
                    title="Tablet view (visual only)"
                >
                    ▯ Tablet
                </button>
                <button
                    type="button"
                    className={viewport === 'mobile' ? 'active' : ''}
                    onClick={() => setViewport('mobile')}
                    title="Mobile view (visual only)"
                >
                    ▮ Mobile
                </button>
            </div>

            <span className="b-spacer" />

            {/* Section count */}
            <span className="b-section-count">
                {sections.length} section{sections.length !== 1 ? 's' : ''}
            </span>

            {/* Dirty indicator */}
            {dirty && (
                <span className="b-unsaved-badge">Unsaved</span>
            )}

            {/* Mode tabs: Builder / Block Catalog */}
            <div className="b-mode-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    className={`b-mode-tab${mode === 'builder' ? ' active' : ''}`}
                    onClick={() => onModeChange('builder')}
                    aria-selected={mode === 'builder'}
                >
                    ▦ Builder
                </button>
                <button
                    type="button"
                    role="tab"
                    className={`b-mode-tab${mode === 'catalog' || mode === 'block-detail' ? ' active' : ''}`}
                    onClick={() => onModeChange('catalog')}
                    aria-selected={mode === 'catalog' || mode === 'block-detail'}
                >
                    ⚙ Block Catalog
                </button>
            </div>

            {/* Save */}
            {canEditContent && (
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="b-btn"
                    aria-label="Save template"
                >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                    Save
                </button>
            )}

            {/* Send for review: content editors hand a draft to the reviewer */}
            {canSendForReview && (
                <button
                    type="button"
                    onClick={handleSendForReview}
                    disabled={saving}
                    className="b-btn"
                    aria-label="Send template for review"
                >
                    Send for review
                </button>
            )}

            {/* Publish */}
            {canPublish && (
                <button
                    type="button"
                    onClick={handlePublish}
                    disabled={saving}
                    className="b-btn primary"
                    aria-label="Publish template"
                >
                    🚀 Publish
                </button>
            )}
        </header>
    )
}
