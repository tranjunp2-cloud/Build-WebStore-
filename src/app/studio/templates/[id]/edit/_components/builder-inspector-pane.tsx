'use client'
/**
 * builder-inspector-pane.tsx
 * Right pane: 4-tab inspector for the selected section.
 * Tabs: Content | Variant | Settings | AI — ported from builder-inspector.jsx.
 * Functional wiring (Zustand + SectionFieldRenderer) unchanged.
 * Phase D: added onOpenBlockDetail prop for inline block-detail overlay shortcut.
 * Phase P3: AI tab shows editable per-template prompt override section.
 */
import { useState, useRef } from 'react'
import {
    AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, Eye,
    FileText, LayoutGrid, Pencil, Settings, Sparkles,
} from 'lucide-react'
import { useBuilderStore } from '@/lib/admin/builder-store'
import type { BlockPromptOverride } from '@/lib/admin/builder-store'
import { getFieldSchema } from '@/lib/admin/section-field-schema'
import { getBlockBySlug } from '@/lib/admin/block-registry-reader'
import { SectionFieldRenderer } from './section-field-renderer'

type Tab = 'content' | 'variant' | 'settings' | 'ai'

// ── Empty state ───────────────────────────────────────────────────────────────

function InspectorEmpty() {
    return (
        <div className="b-insp-empty">
            <div className="ico"><Settings className="h-6 w-6" aria-hidden /></div>
            <div style={{ color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>
                No section selected
            </div>
            <div>
                Click a section on the canvas to edit its variant, content, and settings.
            </div>
        </div>
    )
}

// ── Variant tab ───────────────────────────────────────────────────────────────

function VariantTab({ variants, currentVariant, onSelect, canEdit }: {
    variants: string[]
    currentVariant: string
    onSelect: (v: string) => void
    canEdit: boolean
}) {
    return (
        <>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 12 }}>
                Choose a layout variant for this block.
            </div>
            <div className="b-variant-grid">
                {variants.map((v) => (
                    <div
                        key={v}
                        role="button"
                        tabIndex={0}
                        className={'b-variant-card' + (currentVariant === v ? ' active' : '')}
                        onClick={canEdit ? () => onSelect(v) : undefined}
                        onKeyDown={canEdit ? (e) => e.key === 'Enter' && onSelect(v) : undefined}
                    >
                        <div className="b-variant-preview" />
                        <div className="b-variant-name">{v}</div>
                    </div>
                ))}
                {variants.length === 0 && (
                    <div style={{ gridColumn: 'span 2', fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>
                        No variants registered for this block.
                    </div>
                )}
            </div>
        </>
    )
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab({ visible, onToggleVisible, canEdit }: {
    visible: boolean
    onToggleVisible: () => void
    canEdit: boolean
}) {
    return (
        <>
            <div className="b-group">
                <div className="b-group-title">Visibility</div>
                <div className="b-field">
                    <div className="b-field-label">
                        Show section
                        <div
                            role="switch"
                            aria-checked={visible}
                            tabIndex={0}
                            className={'b-switch' + (visible ? ' on' : '')}
                            style={{ marginLeft: 'auto' }}
                            onClick={canEdit ? onToggleVisible : undefined}
                            onKeyDown={canEdit ? (e) => e.key === 'Enter' && onToggleVisible() : undefined}
                        />
                    </div>
                </div>
            </div>
            <div className="b-group">
                <div className="b-group-title">Device visibility</div>
                <div className="b-seg" style={{ width: '100%' }}>
                    <button type="button" className="active" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>Desktop <Check className="h-3 w-3" aria-hidden /></button>
                    <button type="button" className="active" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>Tablet <Check className="h-3 w-3" aria-hidden /></button>
                    <button type="button" className="active" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>Mobile <Check className="h-3 w-3" aria-hidden /></button>
                </div>
            </div>
            <div className="b-group">
                <div className="b-group-title">Advanced</div>
                <div className="b-field">
                    <div className="b-field-label">
                        Anchor ID <span className="b-field-type">string</span>
                    </div>
                    <input type="text" placeholder="e.g. #features" />
                </div>
                <div className="b-field">
                    <div className="b-field-label">
                        Custom class <span className="b-field-type">string</span>
                    </div>
                    <input type="text" placeholder="custom-class-name" />
                </div>
            </div>
        </>
    )
}

// ── AI tab ────────────────────────────────────────────────────────────────────

type AiTabProps = {
    blockSlug: string
    aiVisible: boolean
    templateId: number
    existingOverride: BlockPromptOverride | null
    canEdit: boolean
}

function AiTab({ blockSlug, aiVisible, templateId, existingOverride, canEdit }: AiTabProps) {
    const { setBlockPromptOverride } = useBuilderStore()
    const [expanded, setExpanded] = useState(existingOverride !== null)
    const [promptValue, setPromptValue] = useState(existingOverride?.prompt ?? '')
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState<string | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    async function handleSave() {
        const trimmed = promptValue.trim()
        if (!trimmed) return
        setSaving(true)
        setSaveMsg(null)
        try {
            const res = await fetch(`/api/admin/templates/${templateId}/block-prompts`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blockSlug, prompt: trimmed }),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const { data } = await res.json() as { data: Record<string, BlockPromptOverride> }
            const saved = data[blockSlug]
            if (saved) setBlockPromptOverride(blockSlug, saved)
            setSaveMsg('Saved')
        } catch {
            setSaveMsg('Save failed')
        } finally {
            setSaving(false)
            setTimeout(() => setSaveMsg(null), 2000)
        }
    }

    async function handleReset() {
        setSaving(true)
        setSaveMsg(null)
        try {
            const res = await fetch(`/api/admin/templates/${templateId}/block-prompts`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blockSlug, prompt: null }),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            setBlockPromptOverride(blockSlug, null)
            setPromptValue('')
            setSaveMsg('Reset to default')
            setExpanded(false)
        } catch {
            setSaveMsg('Reset failed')
        } finally {
            setSaving(false)
            setTimeout(() => setSaveMsg(null), 2000)
        }
    }

    const hasOverride = useBuilderStore((s) => blockSlug in s.blockPromptOverrides)
    const liveOverride = useBuilderStore((s) => s.blockPromptOverrides[blockSlug] ?? null)

    return (
        <>
            <div className="b-group">
                <div className="b-group-title">AI visibility</div>
                <div style={{
                    padding: 10,
                    background: 'var(--bg-sunk)',
                    borderRadius: 6,
                    fontSize: 11.5,
                    color: 'var(--text-2)',
                }}>
                    {aiVisible
                        ? 'AI can generate this block automatically when creating templates.'
                        : <><strong>Manual only</strong> — AI will not auto-generate this block.</>}
                </div>
            </div>

            {/* AI prompt override — collapsible section */}
            <div className="b-group">
                <div
                    className="b-group-title"
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setExpanded((v) => !v)}
                >
                    {expanded
                        ? <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                        : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                    AI prompt override
                    {hasOverride && (
                        <span className="b-pill-ai" style={{ fontSize: 10, marginLeft: 'auto' }}>
                            active
                        </span>
                    )}
                </div>

                {expanded && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                            Override the AI generation instructions for <strong>{blockSlug}</strong> in
                            this template. Leave empty to use the global registry default.
                        </div>
                        <div
                            style={{
                                fontSize: 10.5,
                                color: 'var(--warning, #b45309)',
                                background: 'color-mix(in srgb, var(--warning, #f59e0b) 10%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--warning, #f59e0b) 30%, transparent)',
                                borderRadius: 4,
                                padding: '6px 8px',
                                lineHeight: 1.45,
                            }}
                        >
                            <AlertTriangle className="inline-block h-3.5 w-3.5" style={{ verticalAlign: '-2px', marginRight: 3 }} aria-hidden /> Chỉ áp dụng khi gen mode = <strong>AI-first</strong> (env
                            <code style={{ fontFamily: 'var(--mono)', padding: '0 3px' }}>GEN_MODE=ai-first</code>
                            {' '}hoặc user cung cấp extra instructions / reference prompt). Template-first
                            (default path với 56 blueprints) dùng content từ industry library, bỏ qua override.
                        </div>
                        <textarea
                            ref={textareaRef}
                            style={{ minHeight: 90, fontSize: 11.5, resize: 'vertical' }}
                            placeholder={`e.g. "Generate hero for a B2B SaaS product — focus on ROI and efficiency…"`}
                            value={promptValue}
                            maxLength={4000}
                            readOnly={!canEdit}
                            onChange={(e) => setPromptValue(e.target.value)}
                        />
                        <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right' }}>
                            {promptValue.length}/4000
                        </div>
                        {canEdit && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                                className="b-btn"
                                style={{ height: 28, padding: '0 12px', fontSize: 11 }}
                                disabled={saving || !promptValue.trim()}
                                onClick={handleSave}
                            >
                                {saving ? 'Saving…' : 'Save override'}
                            </button>
                            {hasOverride && (
                                <button
                                    className="b-btn ghost"
                                    style={{ height: 28, padding: '0 10px', fontSize: 11, color: 'var(--danger)' }}
                                    disabled={saving}
                                    onClick={handleReset}
                                >
                                    Reset to default
                                </button>
                            )}
                            {saveMsg && (
                                <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>
                                    {saveMsg}
                                </span>
                            )}
                        </div>}
                        {liveOverride?.updatedAt && (
                            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                                Last saved:{' '}
                                {new Date(liveOverride.updatedAt).toLocaleString('vi-VN')}
                                {liveOverride.updatedBy ? ` by ${liveOverride.updatedBy}` : ''}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}

// ── Main inspector ────────────────────────────────────────────────────────────

interface BuilderInspectorPaneProps {
    onOpenBlockDetail?: (slug: string) => void
    templateId?: number
    /** False makes every field, variant, visibility switch and prompt override read-only. */
    canEdit?: boolean
}

export function BuilderInspectorPane({ onOpenBlockDetail, templateId, canEdit = true }: BuilderInspectorPaneProps = {}) {
    const [tab, setTab] = useState<Tab>('content')
    const [collapsed, setCollapsed] = useState(false)
    const { sections, selectedId, updateSelected, blockPromptOverrides, templateId: storeTemplateId } = useBuilderStore()
    const resolvedTemplateId = templateId ?? storeTemplateId
    const section = sections.find((s) => s.id === selectedId) ?? null
    const blockMeta = section ? getBlockBySlug(section.blockType) : null
    const schema    = section ? getFieldSchema(section.blockType) : null

    /* ── Collapsed rail ── */
    if (collapsed) {
        return (
            <aside className="b-inspector">
                <div className="b-pane-head" style={{ padding: '0 6px', justifyContent: 'center' }}>
                    <button
                        type="button"
                        className="b-pane-collapse-btn"
                        onClick={() => setCollapsed(false)}
                        title="Expand inspector"
                        style={{ transform: 'rotate(180deg)' }}
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                    </button>
                </div>
                <div className="b-insp-collapsed">
                    <button type="button" title="Content"><Pencil className="h-4 w-4" aria-hidden /></button>
                    <button type="button" title="Variant"><LayoutGrid className="h-4 w-4" aria-hidden /></button>
                    <button type="button" title="Settings"><Settings className="h-4 w-4" aria-hidden /></button>
                    <button type="button" title="AI"><Sparkles className="h-4 w-4" aria-hidden /></button>
                </div>
            </aside>
        )
    }

    /* ── No section selected ── */
    if (!section || !blockMeta) {
        return (
            <aside className="b-inspector">
                <div className="b-pane-head">
                    Inspector
                    <button
                        type="button"
                        className="b-pane-collapse-btn"
                        style={{ marginLeft: 'auto' }}
                        onClick={() => setCollapsed(true)}
                    >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                </div>
                <div className="b-insp-body">
                    <InspectorEmpty />
                </div>
            </aside>
        )
    }

    const humanLabel = section.blockType
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

    return (
        <aside className="b-inspector">
            {/* Pane header */}
            <div className="b-pane-head">
                Inspector
                <span className="sub">{section.blockType}</span>
                <button
                    type="button"
                    className="b-pane-collapse-btn"
                    onClick={() => setCollapsed(true)}
                >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
            </div>

            {/* Tab bar */}
            <div className="b-insp-tabs">
                <button
                    type="button"
                    className={tab === 'content' ? 'active' : ''}
                    onClick={() => setTab('content')}
                >
                    Content
                </button>
                <button
                    type="button"
                    className={tab === 'variant' ? 'active' : ''}
                    onClick={() => setTab('variant')}
                >
                    Variant ({blockMeta.variants.length})
                </button>
                <button
                    type="button"
                    className={tab === 'settings' ? 'active' : ''}
                    onClick={() => setTab('settings')}
                >
                    Settings
                </button>
                <button
                    type="button"
                    className={tab === 'ai' ? 'active' : ''}
                    onClick={() => setTab('ai')}
                >
                    AI
                </button>
            </div>

            {/* Body */}
            <div className="b-insp-body scroll-thin">
                {/* Section header card */}
                <div className="b-insp-header">
                    <div className="ico">{blockMeta.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="title">{blockMeta.name}</div>
                        <div className="sub">{section.blockType}</div>
                    </div>
                    {onOpenBlockDetail ? (
                        <button
                            type="button"
                            className="b-btn ghost b-insp-docs-link"
                            title="View block docs inline"
                            style={{ height: 28, padding: '0 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            onClick={() => onOpenBlockDetail(section.blockType)}
                        >
                            <FileText className="h-3.5 w-3.5" aria-hidden /> View block docs
                        </button>
                    ) : (
                        <a
                            href={`/studio/blocks/${section.blockType}`}
                            className="b-btn ghost"
                            title="View block details and all variants"
                            style={{ height: 28, padding: '0 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                            <Eye className="h-3.5 w-3.5" aria-hidden /> Details
                        </a>
                    )}
                </div>

                {/* ── Content tab ── */}
                {tab === 'content' && (
                    <>
                        <div className="b-group">
                            <div className="b-group-title">Section label</div>
                            <div className="b-field">
                                <div className="b-field-label">
                                    Block type <span className="b-field-type">string</span>
                                </div>
                                <input
                                    type="text"
                                    value={humanLabel}
                                    readOnly
                                    style={{ opacity: 0.7 }}
                                />
                            </div>
                        </div>

                        {schema && schema.length > 0 ? (
                            <div className="b-group">
                                <div className="b-group-title">
                                    Editable fields ({schema.length})
                                </div>
                                {schema.map((spec) => (
                                    <SectionFieldRenderer
                                        key={spec.name}
                                        spec={spec}
                                        value={section.config[spec.name]}
                                        onChange={(val) => updateSelected({ [spec.name]: val })}
                                        readOnly={!canEdit}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="b-group">
                                <div className="b-group-title">Editable fields</div>
                                <div style={{
                                    padding: '14px 12px',
                                    background: 'var(--bg-sunk)',
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    color: 'var(--text-3)',
                                    textAlign: 'center',
                                }}>
                                    Field schema for <strong>{section.blockType}</strong> coming soon.
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ── Variant tab ── */}
                {tab === 'variant' && (
                    <VariantTab
                        variants={blockMeta.variants}
                        currentVariant={section.config['variant'] as string ?? blockMeta.defaultVariant}
                        onSelect={(v) => updateSelected({ variant: v })}
                        canEdit={canEdit}
                    />
                )}

                {/* ── Settings tab ── */}
                {tab === 'settings' && (
                    <SettingsTab
                        canEdit={canEdit}
                        visible={section.config['visible'] !== false}
                        onToggleVisible={() =>
                            updateSelected({ visible: !(section.config['visible'] !== false) })
                        }
                    />
                )}

                {/* ── AI tab ── */}
                {tab === 'ai' && (
                    <AiTab
                        blockSlug={section.blockType}
                        aiVisible={blockMeta.aiVisible}
                        templateId={resolvedTemplateId}
                        existingOverride={blockPromptOverrides[section.blockType] ?? null}
                        canEdit={canEdit}
                    />
                )}
            </div>
        </aside>
    )
}
