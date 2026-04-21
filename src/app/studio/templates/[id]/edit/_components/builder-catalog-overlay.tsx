'use client'
/**
 * builder-catalog-overlay.tsx
 * Inline Block Catalog overlay rendered inside /studio/templates/[id]/edit.
 * Replaces the builder shell subtree (Zustand state preserved in parent).
 * Ported from bundle builder-catalog.jsx (117 lines).
 *
 * Phase B: builder-inline-overlays-deep plan.
 */
import { useState, useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import { listAllBlocks } from '@/lib/admin/block-registry-reader'

interface Props {
    onOpenBlockDetail: (slug: string) => void
    onBack: () => void
}

export function BuilderCatalogOverlay({ onOpenBlockDetail, onBack }: Props) {
    const blocks = useMemo(() => listAllBlocks(), [])
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')

    // Derive unique category list from blocks
    const categories = useMemo(() => {
        const set = new Set(blocks.map((b) => b.category))
        return Array.from(set).sort()
    }, [blocks])

    const filtered = useMemo(() => {
        return blocks.filter((b) => {
            if (categoryFilter !== 'all' && b.category !== categoryFilter) return false
            if (search && !b.name.toLowerCase().includes(search.toLowerCase()) &&
                !b.nameVi.toLowerCase().includes(search.toLowerCase())) return false
            return true
        })
    }, [blocks, categoryFilter, search])

    return (
        <div className="b-catalog-overlay">
            {/* Header: back + title + search + filter */}
            <div className="b-catalog-head">
                <button type="button" className="b-btn ghost b-catalog-back" onClick={onBack}>
                    <ArrowLeft size={14} />
                    Back to Builder
                </button>
                <h2 className="b-catalog-title">Block Catalog</h2>
                <span className="b-spacer" />
                <input
                    type="search"
                    placeholder="Search blocks..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="b-catalog-search"
                    aria-label="Search blocks"
                />
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="b-catalog-filter"
                    aria-label="Filter by category"
                >
                    <option value="all">All categories</option>
                    {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </div>

            {/* Block table */}
            <div className="b-catalog-body">
                <table className="b-catalog-tbl">
                    <thead>
                        <tr>
                            <th>Block</th>
                            <th>Variants</th>
                            <th>Category</th>
                            <th>AI</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((b) => (
                            <tr
                                key={b.slug}
                                className="b-catalog-row"
                                onClick={() => onOpenBlockDetail(b.slug)}
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && onOpenBlockDetail(b.slug)}
                                aria-label={`View details for ${b.name}`}
                            >
                                <td>
                                    <span className="b-catalog-icon" aria-hidden>{b.icon}</span>
                                    <span className="b-catalog-name">{b.nameVi ?? b.name}</span>
                                    <code className="b-catalog-slug">{b.slug}</code>
                                </td>
                                <td className="b-catalog-num">{b.variants.length}</td>
                                <td>
                                    <span className="chip">{b.category}</span>
                                </td>
                                <td>
                                    {b.aiVisible
                                        ? <span className="b-pill-ai">AI</span>
                                        : <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Manual</span>}
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        className="b-btn ghost"
                                        onClick={(e) => { e.stopPropagation(); onOpenBlockDetail(b.slug) }}
                                    >
                                        View →
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={5} className="b-catalog-empty">
                                    No blocks match your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
