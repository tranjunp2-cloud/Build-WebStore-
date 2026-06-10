'use client'
/**
 * builder-library-pane.tsx
 * Left pane: filterable block list with category rail.
 * Ported DOM from builder-library.jsx. Zustand wiring unchanged.
 */
import { useState } from 'react'
import {
    ChevronRight, Compass, Crown, Factory, FileText, Image as ImageIcon,
    LayoutGrid, Megaphone, MessageCircle, Newspaper, Package, ShoppingCart, Wrench,
} from 'lucide-react'
import { listAllBlocks } from '@/lib/admin/block-registry-reader'
import { useBuilderStore } from '@/lib/admin/builder-store'

const ALL_BLOCKS = listAllBlocks()

// Category metadata for the sidebar rail
const BLOCK_CATEGORIES = [
    { id: 'all',        name: 'All',        Icon: LayoutGrid },
    { id: 'hero',       name: 'Hero',       Icon: Crown },
    { id: 'nav',        name: 'Nav',        Icon: Compass },
    { id: 'content',    name: 'Content',    Icon: FileText },
    { id: 'social',     name: 'Social',     Icon: MessageCircle },
    { id: 'media',      name: 'Media',      Icon: ImageIcon },
    { id: 'conversion', name: 'Conversion', Icon: Megaphone },
    { id: 'commerce',   name: 'Commerce',   Icon: ShoppingCart },
    { id: 'blog',       name: 'Blog',       Icon: Newspaper },
    { id: 'utility',    name: 'Utility',    Icon: Wrench },
    { id: 'industry',   name: 'Industry',   Icon: Factory },
    { id: 'other',      name: 'Other',      Icon: Package },
]

export function BuilderLibraryPane() {
    const [query, setQuery]     = useState('')
    const [cat, setCat]         = useState('all')
    const [collapsed, setCollapsed] = useState(false)
    const { addBlock }          = useBuilderStore()

    const countByCat = (id: string) =>
        id === 'all' ? ALL_BLOCKS.length : ALL_BLOCKS.filter((b) => b.category === id).length

    const filtered = ALL_BLOCKS.filter((b) => {
        const matchCat = cat === 'all' || b.category === cat
        const matchQ   = query === '' ||
            b.name.toLowerCase().includes(query.toLowerCase()) ||
            b.slug.toLowerCase().includes(query.toLowerCase()) ||
            b.description.toLowerCase().includes(query.toLowerCase())
        return matchCat && matchQ
    })

    /* ── Collapsed rail ── */
    if (collapsed) {
        return (
            <aside className="b-library">
                <div className="b-pane-head" style={{ padding: '0 6px', justifyContent: 'center' }}>
                    <button
                        type="button"
                        className="b-pane-collapse-btn"
                        onClick={() => setCollapsed(false)}
                        title="Expand library"
                    >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                </div>
                <div className="b-lib-collapsed">
                    {BLOCK_CATEGORIES.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            className={cat === c.id ? 'active' : ''}
                            title={c.name}
                            onClick={() => { setCat(c.id); setCollapsed(false) }}
                        >
                            <c.Icon className="h-4 w-4" aria-hidden />
                        </button>
                    ))}
                </div>
            </aside>
        )
    }

    /* ── Expanded ── */
    return (
        <aside className="b-library">
            {/* Pane header */}
            <div className="b-pane-head">
                Block Library
                <span className="sub">{ALL_BLOCKS.length} blocks</span>
                <button
                    type="button"
                    className="b-pane-collapse-btn"
                    onClick={() => setCollapsed(true)}
                    title="Collapse library"
                    style={{ transform: 'rotate(180deg)' }}
                >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
            </div>

            {/* Search */}
            <div className="b-search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                    type="text"
                    placeholder="Search blocks, types…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            {/* Category list */}
            <div className="b-cat-list scroll-thin">
                {BLOCK_CATEGORIES.map((c) => (
                    <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        className={'b-cat-row' + (cat === c.id ? ' active' : '')}
                        onClick={() => setCat(c.id)}
                        onKeyDown={(e) => e.key === 'Enter' && setCat(c.id)}
                    >
                        <span className="cat-icon"><c.Icon className="h-4 w-4" aria-hidden /></span>
                        <span>{c.name}</span>
                        <span className="count">{countByCat(c.id)}</span>
                    </div>
                ))}
            </div>

            {/* Block list */}
            <div className="b-block-list scroll-thin">
                {filtered.length === 0 && (
                    <div style={{ padding: '20px 12px', fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                        No blocks found
                    </div>
                )}
                {filtered.map((block) => (
                    <div
                        key={block.slug}
                        role="button"
                        tabIndex={0}
                        className="b-block-card"
                        onClick={() => addBlock(block.slug)}
                        onKeyDown={(e) => e.key === 'Enter' && addBlock(block.slug)}
                        title="Click to add to canvas"
                    >
                        <div className="b-bc-head">
                            <div className="b-bc-icon">{block.icon}</div>
                            <div className="b-bc-name">{block.name}</div>
                            <div className="b-bc-meta">{block.variants.length}v</div>
                        </div>
                        <div className="b-bc-desc">{block.description}</div>
                        <div className="b-bc-variants">
                            {block.variants.slice(0, 3).map((v) => (
                                <span key={v} className="b-bc-variant">{v}</span>
                            ))}
                            {block.variants.length > 3 && (
                                <span className="b-bc-variant more">+{block.variants.length - 3}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    )
}
