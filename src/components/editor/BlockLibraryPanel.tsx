'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { blockRegistry } from '@/blocks/registry'
import { cn } from '@/lib/utils'
import type { AIAction, BlockData } from '@/types/editor'
import { useI18n } from '@/i18n'

type LibraryCategoryId = 'basics' | 'store' | 'content' | 'form' | 'widgets' | 'media' | 'layout' | 'commerce'

type CategoryConfig = {
    id: LibraryCategoryId
    label: string
    icon: string
    blockTypes: string[]
}

/** BUG-F05-021: Blocks to hide from the library panel.
 *  - Duplicate functionality (have variant replacements)
 *  - Out of scope per PRD
 *  - Missing backend / tech constraints
 *  Kept in registry for backward compatibility with existing sites. */
const HIDDEN_BLOCKS = new Set([
    'gallery-masonry',   // → use gallery variant=masonry
    'pricing-table',     // → use pricing variant=table
    'accordion',         // → use faq variant=accordion
    'client-logos',      // → use logo-cloud
    'custom-html',       // out of scope: no HTML/CSS injection
    'breadcrumb',        // out of scope: should auto-generate
    'video-background',  // out of scope: duplicates video variant
    'before-after',      // out of scope: too niche
    'blog-list',         // missing: no CMS backend
    'download-cta',      // missing: no file hosting
    'google-maps',       // missing: requires API key config
    'countdown-timer',   // missing: client-side only, no persist
])

const categoryConfig: CategoryConfig[] = [
    { id: 'basics', label: 'Basics', icon: '📦', blockTypes: ['hero', 'cta', 'about', 'features', 'step-process', 'service-cards'] },
    { id: 'content', label: 'Content', icon: '📄', blockTypes: ['faq', 'testimonials', 'social-proof', 'portfolio-grid'] },
    { id: 'media', label: 'Media', icon: '🖼️', blockTypes: ['gallery', 'video', 'carousel'] },
    { id: 'store', label: 'Business', icon: '💼', blockTypes: ['pricing', 'feature-comparison', 'menu-food'] },
    { id: 'commerce', label: 'Commerce', icon: '🛒', blockTypes: ['products-grid', 'products-featured', 'cartWidget'] },
    { id: 'form', label: 'Form & Contact', icon: '📝', blockTypes: ['contact', 'newsletter', 'whatsapp-button'] },
    { id: 'widgets', label: 'Widgets', icon: '🔧', blockTypes: ['stats', 'logo-cloud', 'socialWidget', 'team'] },
    { id: 'layout', label: 'Layout', icon: '📐', blockTypes: ['divider', 'announcement-bar'] },
]

const itemIconOverrides: Record<string, string> = {
    'custom-html': '🧱',
    hero: '🎯',
    gallery: '🖼️',
    cta: '🔘',
    socialWidget: '💬',
    pricing: '💰',
    'pricing-table': '📊',
    'gallery-masonry': '🧱',
    'whatsapp-button': '💬',
    'google-maps': '📍',
    'social-proof': '⭐',
    'countdown-timer': '⏰',
    'before-after': '🔄',
    'feature-comparison': '📋',
    'download-cta': '📥',
    'video-background': '🎬',
    breadcrumb: '🔗',
    divider: '➖',
    'announcement-bar': '📢',
    'client-logos': '🏢',
    accordion: '📂',
    'step-process': '🔢',
    'portfolio-grid': '💼',
    'menu-food': '🍽️',
    'service-cards': '🛠️',
    carousel: '🎠',
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
    const { t } = useI18n()
    const bl = t.editor.blockLibrary
    const [query, setQuery] = useState('')
    const [expandedCategory, setExpandedCategory] = useState<LibraryCategoryId>('basics')

    const categories = useMemo(() => {
        const keyword = query.trim().toLowerCase()

        return categoryConfig.map(category => {
            const items = category.blockTypes
                .filter(bt => !HIDDEN_BLOCKS.has(bt))
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
            <div className="border-b border-white/[0.06] px-4 py-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder={bl.searchPlaceholder}
                        className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-9 pr-4 text-[13px] text-white placeholder:text-slate-500 outline-none transition-all focus:border-cyan-400/40 focus:bg-[#1E293B] focus:shadow-[0_0_0_1px_rgba(34,211,238,0.1)]"
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <div className="space-y-1">
                    {categories.map(category => {
                        const isExpanded = category.id === expandedCategory

                        return (
                            <section key={category.id}>
                                <button
                                    type="button"
                                    onClick={() => setExpandedCategory(prev => (prev === category.id ? prev : category.id))}
                                    className="flex h-9 w-full items-center justify-between rounded-lg px-2 text-left transition-colors hover:bg-white/[0.04]"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm leading-none">{category.icon}</span>
                                        <span className="text-[13px] font-medium text-slate-200">{category.label}</span>
                                        <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{category.totalCount}</span>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                                    )}
                                </button>

                                {isExpanded ? (
                                    <div className="mt-1 space-y-1 pb-2">
                                        {category.items.map(item => (
                                            <button
                                                key={item.type}
                                                type="button"
                                                draggable={true}
                                                onDragStart={(e) => {
                                                    const blockData = { blockType: item.type, variant: item.defaultVariant }
                                                    e.dataTransfer.setData('application/json', JSON.stringify(blockData))
                                                    e.dataTransfer.effectAllowed = 'copy'
                                                }}
                                                onClick={() => handleAddBlock(item.type, item.defaultVariant)}
                                                className="group flex w-full items-center gap-3 rounded-lg border border-transparent bg-white/[0.02] px-3 py-2.5 text-left transition-all hover:border-white/[0.08] hover:bg-white/[0.06] cursor-grab active:cursor-grabbing active:scale-[0.98]"
                                            >
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/15 to-cyan-500/15 text-lg">
                                                    {item.icon}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[13px] font-medium text-slate-200">{item.name}</p>
                                                    <p className="truncate text-[11px] text-slate-500">{item.description}</p>
                                                </div>
                                                <span className="shrink-0 text-[10px] text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
                                                    {bl.dragHint}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </section>
                        )
                    })}
                </div>
            </div>

            <div className="border-t border-white/[0.06] bg-[#0B1120]/60 px-4 py-3">
                <p className="text-center text-[11px] text-slate-500">
                    {bl.footerHint}
                </p>
            </div>
        </div>
    )
}
