'use client'
/**
 * Split view — table (compact) on left + drawer panel on right.
 * Bundle: grid layout with minmax(0,1fr) 420px, gap 16px.
 * Click row name → drawer opens. Click X → closes.
 */
import { useState } from 'react'
import { TemplatesTableView } from './templates-table-view'
import { TemplateDrawer } from './template-drawer'
import type { AdminTemplate, TemplatesFilter } from '@/lib/admin/templates-query'

type Props = {
    templates: AdminTemplate[]
    selected: Set<string | number>
    onSelect: (s: Set<string | number>) => void
    onFilterChange: (updated: Partial<TemplatesFilter>) => void
    loading: boolean
    filter: TemplatesFilter
}

export function TemplatesSplitView({ templates, selected, onSelect, onFilterChange, loading, filter }: Props) {
    const [activeId, setActiveId] = useState<string | number | null>(
        () => templates[0]?.id ?? null,
    )
    const activeTemplate = templates.find(t => t.id === activeId) ?? null

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 420px', gap: 16 }}>
            {/* Left: compact table */}
            <TemplatesTableView
                templates={templates}
                selected={selected}
                onSelect={onSelect}
                onFilterChange={onFilterChange}
                loading={loading}
                filter={filter}
                compact
                activeId={activeId}
                onRowClick={id => setActiveId(prev => prev === id ? null : id)}
            />

            {/* Right: side peek panel */}
            {activeTemplate ? (
                <div style={{ position: 'sticky', top: 72, alignSelf: 'start' }}>
                    <TemplateDrawer
                        template={activeTemplate}
                        onClose={() => setActiveId(null)}
                        inline
                    />
                </div>
            ) : (
                <div
                    className="card"
                    style={{
                        padding: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-3)',
                        fontSize: 13,
                        minHeight: 200,
                    }}
                >
                    Select a template to preview
                </div>
            )}
        </div>
    )
}
