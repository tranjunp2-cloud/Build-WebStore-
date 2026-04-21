'use client'
/**
 * builder-inspector-pane.tsx
 * Right pane: 4-tab inspector for the selected section.
 * Tabs: Content | Variant | Settings | AI — ported from builder-inspector.jsx.
 * Functional wiring (Zustand + SectionFieldRenderer) unchanged.
 * Phase D: added onOpenBlockDetail prop for inline block-detail overlay shortcut.
 */
import { useState } from 'react'
import { useBuilderStore } from '@/lib/admin/builder-store'
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

function AiTab({ blockSlug, aiVisible }: { blockSlug: string; aiVisible: boolean }) {
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
                    marginBottom: 10,
                }}>
                    {aiVisible
                        ? 'AI can generate this block automatically when creating templates.'
                        : <><strong>Manual only</strong> — AI will not auto-generate this block.</>}
                </div>
            </div>
            <div className="b-group">
                <div className="b-group-title">Prompt hint (AI)</div>
                <textarea
                    style={{ minHeight: 80 }}
                    placeholder={`Prompt hint when AI generates ${blockSlug}…`}
                />
            </div>
        </>
    )
}

// ── Main inspector ────────────────────────────────────────────────────────────

interface BuilderInspectorPaneProps {
    onOpenBlockDetail?: (slug: string) => void
}

export function BuilderInspectorPane({ onOpenBlockDetail }: BuilderInspectorPaneProps = {}) {
    const [tab, setTab] = useState<Tab>('content')
    const [collapsed, setCollapsed] = useState(false)
    const { sections, selectedId, updateSelected } = useBuilderStore()
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
                    />
                )}
            </div>
        </aside>
    )
}
