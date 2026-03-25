'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { blockRegistry } from '@/blocks/registry'
import { cn } from '@/lib/utils'
import type { AIAction, BlockData } from '@/types/editor'

type LibraryCategoryId = 'basics' | 'store' | 'content' | 'form' | 'widgets'

type CategoryConfig = {
    id: LibraryCategoryId
    label: string
    icon: string
    blockTypes: string[]
}

const categoryConfig: CategoryConfig[] = [
    { id: 'basics', label: 'Basics', icon: '📦', blockTypes: ['custom-html', 'hero', 'gallery', 'cta'] },
    { id: 'store', label: 'Store', icon: '🛍️', blockTypes: ['products-grid', 'products-featured', 'pricing'] },
    { id: 'content', label: 'Content', icon: '📄', blockTypes: ['about', 'blog-list', 'faq'] },
    { id: 'form', label: 'Form', icon: '📝', blockTypes: ['contact', 'newsletter'] },
    { id: 'widgets', label: 'Widgets', icon: '🔧', blockTypes: ['stats', 'logo-cloud'] },
]

const itemIconOverrides: Record<string, string> = {
    'custom-html': '📝',
    hero: '🎯',
    gallery: '🖼️',
    cta: '🔘',
}

function getBlockMeta(blockType: string) {
    const meta = blockRegistry.getBlockMeta(blockType)
    return {
        type: blockType,
        name: meta?.name || blockType,
        description: meta?.description || 'Reusable page block',
        icon: itemIconOverrides[blockType] || meta?.icon || '🧩',
        defaultVariant: meta?.defaultVariant || meta?.variants?.[0] || 'default',
    }
}

interface BlockLibraryPanelProps {
    blocks: BlockData[]
    selectedBlock: number | null
    onBlockSelect: (index: number) => void
    onAIAction: (action: AIAction) => Promise<void> | void
}

export function BlockLibraryPanel({
    blocks,
    selectedBlock,
    onAIAction,
}: BlockLibraryPanelProps) {
    const [query, setQuery] = useState('')
    const [expandedCategory, setExpandedCategory] = useState<LibraryCategoryId>('basics')

    const categories = useMemo(() => {
        const keyword = query.trim().toLowerCase()

        return categoryConfig.map(category => {
            const items = category.blockTypes
                .map(getBlockMeta)
                .filter(item => {
                    if (!keyword) return true
                    return (
                        item.name.toLowerCase().includes(keyword)
                        || item.description.toLowerCase().includes(keyword)
                        || item.type.toLowerCase().includes(keyword)
                    )
                })

            return {
                ...category,
                items,
                totalCount: category.blockTypes.length,
            }
        }).filter(category => category.items.length > 0 || !keyword)
    }, [query])

    const handleAddBlock = (blockType: string, variant: string) => {
        const afterIndex = selectedBlock ?? (blocks.length - 1)
        void onAIAction({
            action: 'add_block',
            afterIndex,
            block: {
                blockType,
                variant,
            },
        })
    }

    return (
        <div className="flex h-full flex-col bg-[#0F172A]">
            <div className="border-b border-[rgba(59,130,246,0.07)] px-4 py-4">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="Search..."
                        className="h-9 w-full rounded-xl border border-[rgba(59,130,246,0.04)] bg-[#1E293B] pl-10 pr-4 text-sm text-white placeholder:text-slate-400 outline-none transition-colors focus:border-cyan-500/30"
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-3">
                    {categories.map(category => {
                        const isExpanded = category.id === expandedCategory

                        return (
                            <section key={category.id} className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setExpandedCategory(prev => (prev === category.id ? prev : category.id))}
                                    className="flex h-10 w-full items-center justify-between rounded-xl px-2 text-left transition-colors hover:bg-white/5"
                                >
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-base leading-none">{category.icon}</span>
                                        <span className="font-medium text-white">{category.label}</span>
                                        <span className="text-xs text-slate-400">({category.totalCount})</span>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-slate-400" />
                                    )}
                                </button>

                                {isExpanded ? (
                                    <div className="space-y-3 pl-2">
                                        {category.items.map(item => (
                                            <button
                                                key={item.type}
                                                type="button"
                                                onClick={() => handleAddBlock(item.type, item.defaultVariant)}
                                                className="group flex w-full flex-col gap-2 rounded-xl border border-[rgba(59,130,246,0.04)] bg-[#1E293B] px-[13px] py-[13px] text-left transition-colors hover:border-cyan-500/25 hover:bg-[#223049]"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(59,130,246,0.2),rgba(45,212,191,0.2))] text-[20px]">
                                                        {item.icon}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium text-white">{item.name}</p>
                                                        <p className="truncate text-xs text-slate-400">{item.description}</p>
                                                    </div>
                                                </div>
                                                <p className="max-h-0 overflow-hidden text-xs font-medium text-slate-400 opacity-0 transition-all duration-150 group-hover:max-h-4 group-hover:opacity-100 group-focus-visible:max-h-4 group-focus-visible:opacity-100">
                                                    💡 Hold to drag
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </section>
                        )
                    })}
                </div>
            </div>

            <div className="border-t border-[rgba(59,130,246,0.07)] bg-[rgba(11,17,32,0.5)] px-4 py-4">
                <p className="flex items-center gap-2 text-xs text-slate-400">
                    <span aria-hidden="true" className="text-sm">🧊</span>
                    Drag and drop blocks into Preview to add to the page
                </p>
            </div>
        </div>
    )
}
