'use client'

/**
 * block-catalog-grid.tsx
 * Client component: 3-mode toggle (matrix / blocks / impact) + catalog grid.
 * Receives all block data from server component (no client fetch needed).
 */
import { useState, useMemo } from 'react'
import { BlockCard, type BlockCardData } from './block-card'

// Category display labels
const CATEGORY_LABELS: Record<string, string> = {
    nav: 'Navigation',
    hero: 'Hero',
    content: 'Content',
    social: 'Social Proof',
    media: 'Media',
    conversion: 'Conversion',
    commerce: 'Commerce',
    blog: 'Blog',
    utility: 'Utility',
    industry: 'Industry',
    other: 'Other',
}

// Preferred display order for categories
const CATEGORY_ORDER = [
    'nav', 'hero', 'content', 'social', 'media',
    'conversion', 'commerce', 'blog', 'industry', 'utility', 'other',
]

type Mode = 'matrix' | 'blocks' | 'impact'
type SortBy = 'usage' | 'variants' | 'name'

type Props = {
    blocks: BlockCardData[]
    showHidden?: boolean
}

export function BlockCatalogGrid({ blocks, showHidden = false }: Props) {
    const [mode, setMode] = useState<Mode>('blocks')
    const [search, setSearch] = useState('')
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const [sortBy, setSortBy] = useState<SortBy>('usage')

    // Visible blocks (respect hiddenFromCatalog flag unless showHidden)
    const visibleBlocks = useMemo(
        () => (showHidden ? blocks : blocks.filter((b) => !b.hiddenFromCatalog)),
        [blocks, showHidden],
    )

    // Distinct categories present in visible blocks
    const categories = useMemo(() => {
        const cats = new Set(visibleBlocks.map((b) => b.category))
        return CATEGORY_ORDER.filter((c) => cats.has(c))
    }, [visibleBlocks])

    // Apply search + category filter
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return visibleBlocks.filter((b) => {
            const matchesCategory = activeCategory === 'all' || b.category === activeCategory
            if (!matchesCategory) return false
            if (!q) return true
            return (
                b.slug.toLowerCase().includes(q) ||
                b.name.toLowerCase().includes(q) ||
                b.nameVi.toLowerCase().includes(q) ||
                b.description.toLowerCase().includes(q)
            )
        })
    }, [visibleBlocks, search, activeCategory])

    // Sorted blocks for table/list view
    const blocksSorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            if (sortBy === 'usage') return b.usageCount - a.usageCount
            if (sortBy === 'variants') return b.variants.length - a.variants.length
            return a.name.localeCompare(b.name)
        })
    }, [filtered, sortBy])

    // Group filtered blocks by category (preserve CATEGORY_ORDER)
    const grouped = useMemo(() => {
        const map = new Map<string, BlockCardData[]>()
        for (const b of filtered) {
            const list = map.get(b.category) ?? []
            list.push(b)
            map.set(b.category, list)
        }
        return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
            category: c,
            label: CATEGORY_LABELS[c] ?? c,
            blocks: map.get(c)!,
        }))
    }, [filtered])

    return (
        <div className="flex flex-col gap-0">
            {/* Mode toggle + search row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {/* Mode toggle */}
                <div className="b-modes">
                    <button
                        className={`b-mode-tab${mode === 'matrix' ? ' active' : ''}`}
                        onClick={() => setMode('matrix')}
                    >
                        Matrix
                    </button>
                    <button
                        className={`b-mode-tab${mode === 'blocks' ? ' active' : ''}`}
                        onClick={() => setMode('blocks')}
                    >
                        Block list
                    </button>
                    <button
                        className={`b-mode-tab${mode === 'impact' ? ' active' : ''}`}
                        onClick={() => setMode('impact')}
                    >
                        Impact sim
                    </button>
                </div>

                <div style={{ flex: 1 }} />

                {/* Search — shown in all modes */}
                <div className="search-wrap" style={{ maxWidth: 280 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                        placeholder="Search blocks..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Sort — blocks mode only */}
                {mode === 'blocks' && (
                    <select
                        className="select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortBy)}
                        style={{ height: 28, fontSize: 12 }}
                    >
                        <option value="usage">Sort: Usage</option>
                        <option value="variants">Sort: Variants</option>
                        <option value="name">Sort: Name</option>
                    </select>
                )}
            </div>

            {/* Category filter pills — shown in blocks mode */}
            {mode === 'blocks' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    <CategoryPill
                        label="All"
                        count={visibleBlocks.length}
                        active={activeCategory === 'all'}
                        onClick={() => setActiveCategory('all')}
                    />
                    {categories.map((cat) => (
                        <CategoryPill
                            key={cat}
                            label={CATEGORY_LABELS[cat] ?? cat}
                            count={visibleBlocks.filter((b) => b.category === cat).length}
                            active={activeCategory === cat}
                            onClick={() => setActiveCategory(cat)}
                        />
                    ))}
                </div>
            )}

            {/* ── Matrix mode ─────────────────────────────────────────── */}
            {mode === 'matrix' && (
                <div className="card" style={{ overflow: 'auto' }}>
                    <table className="b-matrix">
                        <thead>
                            <tr>
                                <th className="b-matrix-head-template">Block / Category</th>
                                {CATEGORY_ORDER.filter((c) => categories.includes(c)).map((cat) => (
                                    <th key={cat} className="b-matrix-head">
                                        <div style={{ transform: 'rotate(-20deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>
                                            {CATEGORY_LABELS[cat] ?? cat}
                                        </div>
                                    </th>
                                ))}
                                <th className="b-matrix-head" style={{ textAlign: 'right', paddingRight: 12 }}>Uses</th>
                            </tr>
                        </thead>
                        <tbody>
                            {blocksSorted.map((block, i) => {
                                const isEven = i % 2 === 0
                                const bgStyle = isEven
                                    ? { background: 'var(--bg-elev)' }
                                    : { background: 'var(--bg-sunk)' }
                                return (
                                    <tr key={block.slug} className="b-matrix-row">
                                        {/* Sticky name cell */}
                                        <td
                                            className="b-matrix-sticky"
                                            style={{
                                                padding: '8px 12px',
                                                borderBottom: '1px dashed var(--border)',
                                                ...bgStyle,
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 18 }}>{block.icon}</span>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {block.name}
                                                    </div>
                                                    <div className="muted" style={{ fontSize: 10 }}>{block.category}</div>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Category presence cells */}
                                        {CATEGORY_ORDER.filter((c) => categories.includes(c)).map((cat) => {
                                            const inCat = block.category === cat
                                            return (
                                                <td
                                                    key={cat}
                                                    className="b-matrix-cell"
                                                    style={bgStyle}
                                                >
                                                    {inCat ? (
                                                        <div
                                                            className="b-matrix-cell-filled"
                                                            style={{ background: 'var(--accent)', margin: '0 auto' }}
                                                            title={`${block.name} — ${cat}`}
                                                        >
                                                            ✓
                                                        </div>
                                                    ) : (
                                                        <div className="b-matrix-cell-empty" />
                                                    )}
                                                </td>
                                            )
                                        })}
                                        {/* Usage count */}
                                        <td
                                            style={{
                                                padding: '8px',
                                                borderBottom: '1px dashed var(--border)',
                                                textAlign: 'right',
                                                fontSize: 12,
                                                fontWeight: 500,
                                                ...bgStyle,
                                            }}
                                        >
                                            {block.usageCount}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: 'var(--bg-sunk)' }}>
                                <td
                                    className="b-matrix-sticky"
                                    style={{
                                        padding: '10px 12px',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: 'var(--text-3)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '.06em',
                                        background: 'var(--bg-sunk)',
                                    }}
                                >
                                    Count
                                </td>
                                {CATEGORY_ORDER.filter((c) => categories.includes(c)).map((cat) => (
                                    <td
                                        key={cat}
                                        style={{ padding: '10px 6px', textAlign: 'center', fontSize: 11, fontWeight: 600 }}
                                    >
                                        {visibleBlocks.filter((b) => b.category === cat).length}
                                    </td>
                                ))}
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* ── Blocks mode ─────────────────────────────────────────── */}
            {mode === 'blocks' && (
                <>
                    {/* Empty state */}
                    {grouped.length === 0 && (
                        <p className="muted" style={{ fontSize: 13, padding: '48px 0', textAlign: 'center' }}>
                            No blocks match your search.
                        </p>
                    )}

                    {/* Grouped grid */}
                    {grouped.map(({ category, label, blocks: groupBlocks }) => (
                        <section key={category} style={{ marginBottom: 24 }}>
                            <h2 style={{
                                fontSize: 11,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '.06em',
                                color: 'var(--text-3)',
                                marginBottom: 10,
                            }}>
                                {label}
                                <span style={{ marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', color: 'var(--text-4)' }}>
                                    ({groupBlocks.length})
                                </span>
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                {groupBlocks.map((block) => (
                                    <BlockCard key={block.slug} block={block} />
                                ))}
                            </div>
                        </section>
                    ))}
                </>
            )}

            {/* ── Impact mode — stub ──────────────────────────────────── */}
            {mode === 'impact' && (
                <div className="impact-sim-stub">
                    <span style={{ fontSize: 36 }}>⚡</span>
                    <p className="i-title">Impact Simulator</p>
                    <p className="i-sub">
                        Xem templates nào bị ảnh hưởng khi thay đổi variant của 1 block.
                    </p>
                    <span
                        className="chip chip-accent"
                        style={{ fontSize: 11, cursor: 'default', marginTop: 4 }}
                        title="Impact Simulator ships in F07"
                    >
                        Coming in F07
                    </span>
                </div>
            )}

        </div>
    )
}

// ── Internal sub-components ───────────────────────────────────────────────────

function CategoryPill({
    label,
    count,
    active,
    onClick,
}: {
    label: string
    count: number
    active: boolean
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={['chip', active ? 'chip-accent' : ''].filter(Boolean).join(' ')}
            style={{ cursor: 'pointer', userSelect: 'none' }}
        >
            {label}
            <span style={{ marginLeft: 4, opacity: 0.6 }}>{count}</span>
        </button>
    )
}
