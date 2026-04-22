'use client'
/**
 * Template detail drawer — matches bundle .drawer design.
 * Tabs: Overview | Quality | Issues | Versions | History
 *
 * Two modes:
 *   - overlay (default): fixed right panel + scrim, triggered from table/grid view
 *   - inline: rendered as .card inside split view, no scrim/fixed positioning
 */
import { useState } from 'react'
import { X, ExternalLink, Rocket, Copy } from 'lucide-react'
import { TemplateStatusPill } from './template-status-pill'
import { QualityTab } from './quality-tab'
import { IssuesTabEmbed } from '@/app/studio/_components/issues-tab-embed'
import { VersionsTabEmbed } from './versions-tab-embed'
import type { AdminTemplate } from '@/lib/admin/templates-query'

type Props = {
    template: AdminTemplate
    onClose: () => void
    /** When true: renders as card (no fixed overlay, no scrim) */
    inline?: boolean
    onPublish?: () => void
}

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'quality',  label: 'Quality' },
    { id: 'issues',   label: 'Issues' },
    { id: 'versions', label: 'Versions' },
    { id: 'history',  label: 'History' },
] as const

type TabId = (typeof TABS)[number]['id']

export function TemplateDrawer({ template, onClose, inline = false, onPublish }: Props) {
    const [tab, setTab] = useState<TabId>('overview')

    const categoryList = Array.isArray(template.category)
        ? template.category.join(', ')
        : (template.category ?? '—')

    const tagList = template.tags?.map(t => t.tag).filter(Boolean) ?? []

    const head = (
        <div className="drawer-head">
            <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    TEMPLATE
                </div>
                <div className="drawer-title">
                    {template.name}
                </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TemplateStatusPill status={template.status} />
                <button className="icon-btn" onClick={onClose} aria-label="Close drawer">
                    <X size={15} />
                </button>
            </div>
        </div>
    )

    const tabNav = (
        <div className="drawer-tabs">
            {TABS.map(t => (
                <button
                    key={t.id}
                    className={`drawer-tab${tab === t.id ? ' active' : ''}`}
                    onClick={() => setTab(t.id)}
                >
                    {t.label}
                </button>
            ))}
        </div>
    )

    const body = (
        <div className="drawer-body scroll-thin">
            {/* Overview */}
            {tab === 'overview' && (
                <>
                    {/* Thumbnail */}
                    {template.thumbnail?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={template.thumbnail.url}
                            alt={template.name}
                            style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover', borderRadius: 'var(--radius)', marginBottom: 16 }}
                        />
                    ) : (
                        <div className="ph ph-thumb" style={{ marginBottom: 16 }}>
                            <span>
                                {template.name}
                                <small>live preview · view-only</small>
                            </span>
                        </div>
                    )}

                    {/* Meta grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 12 }}>
                        {[
                            { label: 'Status',   value: <TemplateStatusPill status={template.status} /> },
                            { label: 'Category', value: categoryList },
                            { label: 'Uses',     value: (template.usageCount ?? 0).toLocaleString() },
                            { label: 'Created',  value: new Date(template.createdAt).toLocaleDateString() },
                            { label: 'Updated',  value: new Date(template.updatedAt).toLocaleDateString() },
                            { label: 'Featured', value: template.isFeatured ? 'Yes' : 'No' },
                        ].map(({ label, value }) => (
                            <div key={label}>
                                <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>
                                    {label}
                                </div>
                                <div>{value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Description */}
                    {template.description && (
                        <div className="field">
                            <label>Description</label>
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--text)' }}>
                                {template.description}
                            </p>
                        </div>
                    )}

                    {/* Scheduled for */}
                    {template.scheduledFor && (
                        <div className="field">
                            <label>Scheduled for</label>
                            <p style={{ margin: 0, fontSize: 13 }}>
                                {new Date(template.scheduledFor).toLocaleString()}
                            </p>
                        </div>
                    )}

                    {/* Tags */}
                    {tagList.length > 0 && (
                        <div className="field">
                            <label>Tags</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {tagList.map(tag => (
                                    <span key={tag} className="chip">#{tag}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Preview URL */}
                    {template.previewUrl && (
                        <div className="field">
                            <label>Preview URL</label>
                            <a
                                href={template.previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 12 }}
                            >
                                Open preview <ExternalLink size={11} />
                            </a>
                        </div>
                    )}
                </>
            )}

            {tab === 'quality' && (
                <QualityTab templateId={template.id} />
            )}

            {tab === 'issues' && (
                <IssuesTabEmbed relatedType="template" relatedId={String(template.id)} />
            )}

            {tab === 'versions' && (
                <VersionsTabEmbed templateId={Number(template.id)} />
            )}

            {tab === 'history' && (
                <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
                    Version history coming soon.
                </div>
            )}
        </div>
    )

    const foot = (
        <div className="drawer-foot">
            <button className="btn btn-ghost" style={{ marginRight: 'auto' }}>
                <X size={13} /> Delete
            </button>
            <button className="btn" onClick={onClose}>Close</button>
            <button className="btn">
                <Copy size={13} /> Clone
            </button>
            {template.status !== 'live' && (
                <button className="btn btn-primary" onClick={onPublish}>
                    <Rocket size={13} /> Publish
                </button>
            )}
        </div>
    )

    /* ── Inline mode (split view card) ─────────────────────── */
    if (inline) {
        return (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {head}
                {tabNav}
                {body}
                {foot}
            </div>
        )
    }

    /* ── Overlay mode (fixed right drawer + scrim) ──────────── */
    return (
        <>
            <div className="drawer-scrim" onClick={onClose} />
            <div className="drawer">
                {head}
                {tabNav}
                {body}
                {foot}
            </div>
        </>
    )
}
