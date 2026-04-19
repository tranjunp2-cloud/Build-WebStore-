'use client'

/**
 * block-catalog-grid.tsx
 * Client component: search + category filter + grouped grid of BlockCards.
 * Receives all block data from server component (no client fetch needed).
 */
import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
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

type Props = {
    blocks: BlockCardData[]
    showHidden?: boolean
}

export function BlockCatalogGrid({ blocks, showHidden = false }: Props) {
    const [search, setSearch] = useState('')
    const [activeCategory, setActiveCategory] = useState<string>('all')

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
        <div className="flex flex-col gap-6">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <Input
                    placeholder="Search blocks..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-xs bg-white/5 border-white/20 text-white placeholder:text-white/40"
                />

                {/* Category pills */}
                <div className="flex flex-wrap gap-2">
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
            </div>

            {/* Empty state */}
            {grouped.length === 0 && (
                <p className="text-sm text-white/40 py-12 text-center">
                    No blocks match your search.
                </p>
            )}

            {/* Grouped grid */}
            {grouped.map(({ category, label, blocks: groupBlocks }) => (
                <section key={category}>
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
                        {label}
                        <span className="ml-2 normal-case tracking-normal font-normal text-white/30">
                            ({groupBlocks.length})
                        </span>
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {groupBlocks.map((block) => (
                            <BlockCard key={block.slug} block={block} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    )
}

// ── Internal sub-component ────────────────────────────────────────────────────

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
            className={[
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white',
            ].join(' ')}
        >
            {label}
            <span className={active ? 'text-indigo-200' : 'text-white/30'}>{count}</span>
        </button>
    )
}
