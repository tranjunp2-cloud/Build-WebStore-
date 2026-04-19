'use client'
/**
 * Grid view — matches bundle .grid-view + .tpl-card design.
 * Cards: 16:10 thumbnail placeholder | status pill | checkbox | title + meta | footer actions
 */
import { useCallback } from 'react'
import { Eye, Copy, Star } from 'lucide-react'
import { TemplateStatusPill } from './template-status-pill'
import { TemplateRowActionsMenu } from './template-row-actions-menu'
import type { AdminTemplate, TemplatesFilter } from '@/lib/admin/templates-query'

type Props = {
    templates: AdminTemplate[]
    selected: Set<string | number>
    onSelect: (s: Set<string | number>) => void
    onFilterChange: (updated: Partial<TemplatesFilter>) => void
    loading: boolean
    filter: TemplatesFilter
}

export function TemplatesGridView({ templates, selected, onSelect, onFilterChange, loading }: Props) {
    const handleRefresh = () => onFilterChange({})

    const toggleOne = useCallback((id: string | number) => {
        const next = new Set(selected)
        next.has(id) ? next.delete(id) : next.add(id)
        onSelect(next)
    }, [selected, onSelect])

    if (loading) {
        return (
            <div className="grid-view">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div
                        key={i}
                        className="tpl-card"
                        style={{ opacity: 0.4 }}
                    >
                        <div className="ph ph-thumb" />
                        <div className="tpl-body">
                            <div style={{ height: 13, background: 'var(--bg-sunk)', borderRadius: 4, width: '70%', marginBottom: 6 }} />
                            <div style={{ height: 11, background: 'var(--bg-sunk)', borderRadius: 4, width: '50%' }} />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (templates.length === 0) {
        return (
            <div className="empty-state">
                <h3>No templates found</h3>
                <p>Try adjusting the filters or create a new template.</p>
            </div>
        )
    }

    return (
        <div className="grid-view">
            {templates.map(t => {
                const isSelected = selected.has(t.id)
                const catStr = Array.isArray(t.category)
                    ? t.category[0]
                    : (t.category ?? '—')
                const tagStr = Array.isArray(t.tags)
                    ? t.tags.map(x => `#${x.tag}`).join(' ')
                    : ''

                return (
                    <div
                        key={t.id}
                        className={`tpl-card${isSelected ? ' selected' : ''}`}
                    >
                        {/* Checkbox — top-left, visible on hover or selected */}
                        <input
                            type="checkbox"
                            className="cbx tpl-cbx"
                            checked={isSelected}
                            onChange={() => toggleOne(t.id)}
                            onClick={e => e.stopPropagation()}
                            aria-label={`Select ${t.name}`}
                        />

                        {/* Status pill — top-right */}
                        <div className="tpl-status">
                            <TemplateStatusPill status={t.status} />
                        </div>

                        {/* Thumbnail */}
                        <div
                            onClick={() => toggleOne(t.id)}
                            style={{ cursor: 'pointer' }}
                        >
                            {t.thumbnail?.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={t.thumbnail.url}
                                    alt={t.name}
                                    className="ph-thumb"
                                    style={{
                                        width: '100%',
                                        aspectRatio: '16/10',
                                        objectFit: 'cover',
                                        display: 'block',
                                        borderBottom: '1px dashed var(--border-dashed)',
                                    }}
                                />
                            ) : (
                                <div className="ph ph-thumb">
                                    <span>
                                        {t.name}
                                        <small>{catStr} · 16:10</small>
                                    </span>
                                </div>
                            )}

                            {/* Card body */}
                            <div className="tpl-body">
                                <div className="tpl-title">
                                    {t.isFeatured && (
                                        <Star size={12} style={{ color: 'var(--warn)' }} />
                                    )}
                                    {t.name}
                                </div>
                                <div className="tpl-meta">
                                    <span>{catStr}</span>
                                    {tagStr && (
                                        <>
                                            <span className="dot" />
                                            <span className="muted" style={{ fontSize: 11 }}>{tagStr}</span>
                                        </>
                                    )}
                                </div>
                                {t.usageCount !== undefined && t.usageCount !== null && (
                                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                                        {t.usageCount > 0 ? `${t.usageCount.toLocaleString()} uses` : 'Unused'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Card footer */}
                        <div className="tpl-foot">
                            <button
                                className="btn btn-xs btn-ghost"
                                onClick={() => toggleOne(t.id)}
                                title="Select / preview"
                            >
                                <Eye size={12} /> Preview
                            </button>
                            <div style={{ flex: 1 }} />
                            <span className="muted" style={{ fontSize: 11 }}>
                                {new Date(t.updatedAt).toLocaleDateString()}
                            </span>
                            <div onClick={e => e.stopPropagation()}>
                                <TemplateRowActionsMenu template={t} onRefresh={handleRefresh} />
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
