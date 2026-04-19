'use client'
/**
 * builder-library-pane.tsx
 * Left pane: filterable block list from registry.
 * Click "Add" appends to end of canvas. All 29+ blocks shown;
 * inspector-edit only for the 10 with SECTION_FIELD_SCHEMA.
 */
import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { listAllBlocks } from '@/lib/admin/block-registry-reader'
import { SCHEMA_SUPPORTED_TYPES } from '@/lib/admin/section-field-schema'
import { useBuilderStore } from '@/lib/admin/builder-store'

const ALL_BLOCKS = listAllBlocks()

const CATEGORY_LABELS: Record<string, string> = {
    hero: 'Hero', nav: 'Nav', content: 'Content', social: 'Social',
    media: 'Media', conversion: 'Conversion', commerce: 'Commerce',
    blog: 'Blog', utility: 'Utility', industry: 'Industry', other: 'Other',
}

export function BuilderLibraryPane() {
    const [query, setQuery] = useState('')
    const [activeCategory, setActiveCategory] = useState<string | null>(null)
    const { addBlock } = useBuilderStore()

    const filtered = ALL_BLOCKS.filter((b) => {
        const matchQ = query === '' ||
            b.name.toLowerCase().includes(query.toLowerCase()) ||
            b.slug.toLowerCase().includes(query.toLowerCase())
        const matchC = activeCategory === null || b.category === activeCategory
        return matchQ && matchC
    })

    const categories = Array.from(new Set(ALL_BLOCKS.map((b) => b.category)))

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-2 border-b flex-shrink-0 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">Blocks</p>
                {/* Search */}
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-6 pr-2 py-1 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>
                {/* Category filter chips */}
                <div className="flex flex-wrap gap-1">
                    <button
                        type="button"
                        onClick={() => setActiveCategory(null)}
                        className={[
                            'px-2 py-0.5 text-[10px] rounded-full border transition-colors',
                            activeCategory === null
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border hover:bg-muted',
                        ].join(' ')}
                    >
                        All
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                            className={[
                                'px-2 py-0.5 text-[10px] rounded-full border transition-colors',
                                activeCategory === cat
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'border-border hover:bg-muted',
                            ].join(' ')}
                        >
                            {CATEGORY_LABELS[cat] ?? cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Block list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filtered.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No blocks match.</p>
                )}
                {filtered.map((block) => {
                    const hasSchema = SCHEMA_SUPPORTED_TYPES.includes(block.slug)
                    return (
                        <div
                            key={block.slug}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted group"
                        >
                            <span className="text-sm flex-shrink-0" aria-hidden>{block.icon}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{block.name}</p>
                                {!hasSchema && (
                                    <p className="text-[10px] text-muted-foreground">Inspector: soon</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => addBlock(block.slug)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-opacity flex-shrink-0"
                                aria-label={`Add ${block.name}`}
                            >
                                <Plus size={13} />
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
