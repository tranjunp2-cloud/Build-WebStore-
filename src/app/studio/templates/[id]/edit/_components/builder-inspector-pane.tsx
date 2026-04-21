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
            <div className="ico">⚙</div>
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

function VariantTab({ variants, currentVariant, onSelect }: {
    variants: string[]
    currentVariant: string
    onSelect: (v: string) => void
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
                        onClick={() => onSelect(v)}
                        onKeyDown={(e) => e.key === 'Enter' && onSelect(v)}
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

function SettingsTab({ visible, onToggleVisible }: {
    visible: boolean
    onToggleVisible: () => void
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
                            onClick={onToggleVisible}
                            onKeyDown={(e) => e.key === 'Enter' && onToggleVisible()}
                        />
                    </div>
                </div>
            </div>
            <div className="b-group">
                <div className="b-group-title">Device visibility</div>
                <div className="b-seg" style={{ width: '100%' }}>
                    <button type="button" className="active" style={{ flex: 1 }}>Desktop ✓</button>
                    <button type="button" className="active" style={{ flex: 1 }}>Tablet ✓</button>
                    <button type="button" className="active" style={{ flex: 1 }}>Mobile ✓</button>
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
}

function AiTab({ blockSlug, aiVisible, templateId, existingOverride }: AiTabProps) {
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
                    <span>{expanded ? '▾' : '▸'}</span>
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
                        <textarea
                            ref={textareaRef}
                            style={{ minHeight: 90, fontSize: 11.5, resize: 'vertical' }}
                            placeholder={`e.g. "Generate hero for a B2B SaaS product — focus on ROI and efficiency…"`}
                            value={promptValue}
                            maxLength={4000}
                            onChange={(e) => setPromptValue(e.target.value)}
                        />
                        <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right' }}>
                            {promptValue.length}/4000
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                        </div>
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
}

export function BuilderInspectorPane({ onOpenBlockDetail, templateId }: BuilderInspectorPaneProps = {}) {
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
                        ‹
                    </button>
                </div>
                <div className="b-insp-collapsed">
                    <button type="button" title="Content">✏</button>
                    <button type="button" title="Variant">⊞</button>
                    <button type="button" title="Settings">⚙</button>
                    <button type="button" title="AI">✨</button>
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
                        ›
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
                    ›
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
                            style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                            onClick={() => onOpenBlockDetail(section.blockType)}
                        >
                            📄 View block docs
                        </button>
                    ) : (
                        <a
                            href={`/studio/blocks/${section.blockType}`}
                            className="b-btn ghost"
                            title="View block details and all variants"
                            style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                        >
                            👁 Details
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
                    />
                )}

                {/* ── Settings tab ── */}
                {tab === 'settings' && (
                    <SettingsTab
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
                    />
                )}
            </div>
        </aside>
    )
}
