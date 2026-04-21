'use client'

/**
 * block-detail-tabs.tsx
 * 6-tab client component for block detail page (matches bundle builder-block-detail.jsx):
 * Variants / Schema / Content Presets / AI & Prompts / Usage / History
 * Phase 03: Presets + History tabs wired to real endpoints (no more F07 stubs).
 */
import { useState, useEffect } from 'react'
import { VariantGallery } from './variant-gallery'
import { BlockSchemaInspector } from './block-schema-inspector'
import type { BlockPresetStub } from '@/app/api/admin/blocks/[slug]/presets/route'
import type { BlockHistoryEvent } from '@/app/api/admin/blocks/[slug]/history/route'

type VariantOverride = {
    variantName: string
    previewUrlOverride?: string | null
    notes?: string | null
    enabled?: boolean
    displayName?: string | null
}

type UsedByTemplate = {
    id: number | string
    name: string
    slug?: string
    category?: string[]
}

export type BlockDetailData = {
    slug: string
    name: string
    nameVi: string
    description: string
    icon: string
    category: string
    variants: string[]
    defaultVariant: string
    editableFields: string[]
    aiVisible: boolean
    usageCount: number
    descriptionOverride: string | null
    descriptionOverrideVi: string | null
    curatedPreviewUrl: string | null
    hiddenFromCatalog: boolean
    variantOverrides: VariantOverride[]
    usedByTemplates: UsedByTemplate[]
}

type Tab = 'variants' | 'schema' | 'presets' | 'ai' | 'usage' | 'history'

type Props = {
    block: BlockDetailData
}

export function BlockDetailTabs({ block }: Props) {
    const [tab, setTab] = useState<Tab>('variants')

    const tabDefs: { id: Tab; label: string; count?: number }[] = [
        { id: 'variants', label: 'Variants', count: block.variants.length },
        { id: 'schema', label: 'Schema & fields', count: block.editableFields.length },
        { id: 'presets', label: 'Content presets' },
        { id: 'ai', label: 'AI & prompts' },
        { id: 'usage', label: 'Usage', count: block.usageCount },
        { id: 'history', label: 'History' },
    ]

    return (
        <div>
            {/* Tab bar */}
            <div className="b-detail-tabs">
                {tabDefs.map(({ id, label, count }) => (
                    <button
                        key={id}
                        className={`b-detail-tab${tab === id ? ' active' : ''}`}
                        onClick={() => setTab(id)}
                    >
                        {label}
                        {count !== undefined && (
                            <span className="b-tab-count">{count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Variants ─────────────────────────────────────────────── */}
            {tab === 'variants' && (
                <VariantGallery
                    blockSlug={block.slug}
                    blockName={block.name}
                    variants={block.variants}
                    defaultVariant={block.defaultVariant}
                    editableFields={block.editableFields}
                    curatedPreviewUrl={block.curatedPreviewUrl}
                    variantOverrides={block.variantOverrides}
                />
            )}

            {/* ── Schema ───────────────────────────────────────────────── */}
            {tab === 'schema' && (
                <BlockSchemaInspector
                    blockSlug={block.slug}
                    editableFields={block.editableFields}
                    defaultVariant={block.defaultVariant}
                    variants={block.variants}
                />
            )}

            {/* ── Content Presets ───────────────────────────────────────── */}
            {tab === 'presets' && (
                <ContentPresetsTab blockSlug={block.slug} />
            )}

            {/* ── AI & Prompts ──────────────────────────────────────────── */}
            {tab === 'ai' && (
                <AiTab block={block} />
            )}

            {/* ── Usage ────────────────────────────────────────────────── */}
            {tab === 'usage' && (
                <UsageTab block={block} />
            )}

            {/* ── History ───────────────────────────────────────────────── */}
            {tab === 'history' && (
                <HistoryTab blockSlug={block.slug} />
            )}
        </div>
    )
}

// ── AI & Prompts tab ──────────────────────────────────────────────────────────

function AiTab({ block }: { block: BlockDetailData }) {
    const estimatedTokens = block.editableFields.length * 18 + block.variants.length * 12
    const tokenPct = Math.min(100, (estimatedTokens / 400) * 100)

    const promptTemplate = `Block: ${block.slug}
Description: ${block.description}
Variants: ${block.variants.join(', ')}
Fields: ${block.editableFields.join(', ')}

Usage guideline:
- Use this block when the user wants to display ${block.name.toLowerCase()}.
- Default variant is "${block.defaultVariant}".
- Be concise in headline (under 60 chars).`

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* AI visibility toggle */}
            <div className="b-ai-card">
                <div className="b-group-title">Visibility cho AI generator</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                    <div className={`b-switch${block.aiVisible ? ' on' : ''}`} title="Read-only — set via registry" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                            {block.aiVisible ? 'AI có thể tạo block này' : 'Chỉ dùng manual'}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                            {block.aiVisible
                                ? 'AI generator nhìn thấy block trong system prompt và có thể tự thêm vào layout'
                                : 'Block này không xuất hiện trong AI prompt — chỉ admin mới thêm được'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Context window cost */}
            <div className="b-ai-card">
                <div className="b-group-title">Context window cost</div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                            ~{estimatedTokens} tk
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>token ước tính trong prompt</div>
                    </div>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-sunk)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${tokenPct}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                    </div>
                </div>
            </div>

            {/* Prompt template */}
            <div className="b-ai-card" style={{ gridColumn: '1 / -1' }}>
                <div className="b-group-title">Prompt template (system message context)</div>
                <textarea
                    readOnly
                    defaultValue={promptTemplate}
                    style={{
                        width: '100%',
                        minHeight: 140,
                        padding: 10,
                        fontFamily: 'var(--mono)',
                        fontSize: 11.5,
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-sunk)',
                        color: 'var(--text)',
                        resize: 'vertical',
                        lineHeight: 1.5,
                        boxSizing: 'border-box',
                    }}
                />
                <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
                    Prompt editor và quick actions sẽ live-editable trong F07.
                </p>
            </div>
        </div>
    )
}

// ── Usage tab ─────────────────────────────────────────────────────────────────

function UsageTab({ block }: { block: BlockDetailData }) {
    if (block.usedByTemplates.length === 0) {
        return (
            <div className="empty-state">
                <p style={{ margin: 0 }}>Block này chưa được dùng trong template nào.</p>
            </div>
        )
    }

    return (
        <>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
                Block <strong style={{ color: 'var(--text)' }}>{block.slug}</strong> đang được dùng trong{' '}
                <strong style={{ color: 'var(--text)' }}>{block.usedByTemplates.length} templates</strong>
            </p>
            <div className="b-usage-list">
                {block.usedByTemplates.map((t) => (
                    <div key={t.id} className="b-usage-row">
                        <div className="thumb" />
                        <div>
                            <div className="n">{t.name}</div>
                            {t.category && t.category.length > 0 && (
                                <div className="s">{t.category.join(', ')}</div>
                            )}
                        </div>
                        <span className="sp" />
                        <span className="var-pill">{block.defaultVariant || 'default'}</span>
                    </div>
                ))}
            </div>
        </>
    )
}

// ── Content Presets tab ───────────────────────────────────────────────────────

function ContentPresetsTab({ blockSlug }: { blockSlug: string }) {
    const [presets, setPresets] = useState<BlockPresetStub[] | null>(null)
    const [note, setNote] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        fetch(`/api/admin/blocks/${encodeURIComponent(blockSlug)}/presets`)
            .then((r) => r.json())
            .then((d) => {
                if (cancelled) return
                if (d.error) { setError(d.error); return }
                setPresets(d.data ?? [])
                setNote(d.meta?.note ?? null)
            })
            .catch(() => { if (!cancelled) setError('Failed to load presets') })
        return () => { cancelled = true }
    }, [blockSlug])

    if (error) {
        return <div className="empty-state"><p style={{ margin: 0, color: 'var(--danger)' }}>{error}</p></div>
    }

    if (!presets) {
        return <div className="empty-state"><p style={{ margin: 0 }}>Loading presets...</p></div>
    }

    if (presets.length === 0) {
        return (
            <div className="empty-state">
                <p style={{ margin: 0 }}>{note ?? 'No presets configured for this block type yet.'}</p>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                    Full preset editor available in F07.
                </p>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {presets.map((p) => (
                <div
                    key={p.id}
                    style={{
                        padding: '10px 14px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        background: 'var(--bg-sunk)',
                    }}
                >
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{p.label}</div>
                    {p.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{p.description}</div>
                    )}
                    <span className="chip" style={{ fontSize: 10, marginTop: 6, cursor: 'default' }}>{p.source}</span>
                </div>
            ))}
        </div>
    )
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryTab({ blockSlug }: { blockSlug: string }) {
    const [events, setEvents] = useState<BlockHistoryEvent[] | null>(null)
    const [note, setNote] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        fetch(`/api/admin/blocks/${encodeURIComponent(blockSlug)}/history`)
            .then((r) => r.json())
            .then((d) => {
                if (cancelled) return
                if (d.error) { setError(d.error); return }
                setEvents(d.data ?? [])
                setNote(d.meta?.note ?? null)
            })
            .catch(() => { if (!cancelled) setError('Failed to load history') })
        return () => { cancelled = true }
    }, [blockSlug])

    if (error) {
        return <div className="empty-state"><p style={{ margin: 0, color: 'var(--danger)' }}>{error}</p></div>
    }

    if (!events) {
        return <div className="empty-state"><p style={{ margin: 0 }}>Loading history...</p></div>
    }

    if (events.length === 0) {
        return (
            <div className="empty-state">
                <p style={{ margin: 0 }}>{note ?? 'No version history found for this block yet.'}</p>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                    History appears once the block is used in a saved template version. Diff viewer: F07.
                </p>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {events.map((ev, i) => {
                const date = new Date(ev.occurredAt)
                const dateStr = isNaN(date.getTime())
                    ? ev.occurredAt
                    : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                const isLast = i === events.length - 1
                return (
                    <div
                        key={ev.id}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '80px 1fr',
                            gap: '0 12px',
                            paddingBottom: isLast ? 0 : 12,
                            marginBottom: isLast ? 0 : 12,
                            borderBottom: isLast ? 'none' : '1px dashed var(--border)',
                        }}
                    >
                        <div style={{ fontSize: 11, color: 'var(--text-3)', paddingTop: 2 }}>{dateStr}</div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                                Version {ev.versionNumber} saved
                                {' — '}
                                <span style={{ color: 'var(--text-2)' }}>{ev.templateName}</span>
                            </div>
                            {ev.changelog && (
                                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
                                    {ev.changelog}
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
