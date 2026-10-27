'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Globe, Plus, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AIAction, BlockData } from '@/types/editor'
import { useI18n } from '@/i18n'
import { listAllBlocks } from '@/lib/admin/block-registry-reader'
import { resolveBlockContent, hasLocaleContent } from '@/lib/ai/add-section-content'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useEditorStore, BLOCK_TYPE_TO_KEY } from '@/store/editorStore'
import { BLOCK_ICONS, CATEGORY_ICONS, FALLBACK_BLOCK_ICON } from './block-library-icons'

// Malay fallback labels when the i18n category label is missing
const CATEGORY_FALLBACK_LABEL: Record<string, string> = {
    basics: 'Asas',
    content: 'Kandungan',
    media: 'Media',
    store: 'Perniagaan',
    commerce: 'Perdagangan',
    form: 'Borang & Hubungi',
    widgets: 'Widget',
    layout: 'Susun Atur',
}

// Canonical display order — matches editor UX taxonomy
const CATEGORY_ORDER = ['basics', 'content', 'media', 'store', 'commerce', 'form', 'widgets', 'layout'] as const

/** Lucide icon in a slate badge; turns teal while its row/card is hovered (group-hover). */
function IconBadge({ icon: Icon, size }: { icon: LucideIcon; size: 'group' | 'card' }) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex flex-none items-center justify-center border border-transparent text-slate-400 transition-[transform,color,background-color,border-color] duration-200',
                'group-hover:scale-105 group-hover:border-[rgba(45,212,191,.35)] group-hover:bg-[rgba(45,212,191,.12)] group-hover:text-[#5eead4]',
                size === 'group' ? 'h-6 w-6 rounded-[7px]' : 'h-9 w-9 rounded-lg bg-[#1e293b]',
            )}
        >
            <Icon className={size === 'group' ? 'h-[15px] w-[15px]' : 'h-[18px] w-[18px]'} />
        </span>
    )
}

interface BlockLibraryPanelProps {
    blocks: BlockData[]
    selectedBlock: number | null
    onBlockSelect: (index: number) => void
    onAIAction: (action: AIAction) => Promise<void> | void
    onEditGlobalBlock?: (blockType: string) => void
    /** F26-04: Called when user clicks "✨ AI" auto-translate button for a block type */
    onAutoTranslate?: (blockType: string) => Promise<void>
    /** F05 compact Tools sheet: touch has no hover/drag, so the desktop "click or drag"
     * hover hint is replaced with an always-visible "+" affordance. Desktop omits this
     * (defaults false) and keeps its existing hover-hint text unchanged. */
    isCompact?: boolean
}

export function BlockLibraryPanel({
    blocks,
    selectedBlock,
    onAIAction,
    onEditGlobalBlock,
    onAutoTranslate,
    isCompact = false,
}: BlockLibraryPanelProps) {
    const { t } = useI18n()
    const bl = t.editor.blockLibrary
    const categoryLabels = bl.categories as Record<string, string>
    const blockTranslations = bl.blocks as Record<string, { name: string; description: string; scopeTooltip?: string }>
    const [query, setQuery] = useState('')
    const [expandedCategory, setExpandedCategory] = useState<string>('basics')
    // F26-04: block types that have been AI-translated this session (icon disappears after translate)
    const [translatedTypes, setTranslatedTypes] = useState<Set<string>>(new Set())
    const [pendingTranslateTypes, setPendingTranslateTypes] = useState<Set<string>>(new Set())

    // Registry is module-lifetime stable — memo with [] deps to avoid new array ref every render.
    // categoryLabels comes from i18n (stable ref); included in deps for correctness.
    const baseCategories = useMemo(() => {
        const allBlocks = listAllBlocks()
            .filter(b => b.aiVisible !== false || b.slug === 'custom-html')
            .filter(b => !b.isSystem)
            .filter(b => b.category !== 'archive')
        const byCategory = new Map<string, typeof allBlocks>()
        for (const b of allBlocks) {
            const arr = byCategory.get(b.category) ?? []
            arr.push(b)
            byCategory.set(b.category, arr)
        }
        return CATEGORY_ORDER
            .filter(cat => byCategory.has(cat))
            .map(cat => ({
                id: cat,
                icon: CATEGORY_ICONS[cat] ?? FALLBACK_BLOCK_ICON,
                label: categoryLabels[cat] || CATEGORY_FALLBACK_LABEL[cat] || cat,
                blocks: byCategory.get(cat)!,
            }))
    }, [categoryLabels])

    // F26-03: read active locale to drive locale-aware block previews
    const activeLocale = useEditorStore(state => state.activeLocale)

    const categories = useMemo(() => {
        const keyword = query.trim().toLowerCase()

        return baseCategories.map(category => {
            const items = category.blocks.map(b => {
                const baseName = blockTranslations?.[b.slug]?.name || b.name
                const baseDescription = blockTranslations?.[b.slug]?.description || b.description

                // F26-03: locale-aware preview text — show BM headline when locale is 'ms'
                let previewText = baseDescription
                let needsTranslation = false
                if (activeLocale === 'ms') {
                    if (hasLocaleContent(b.slug, 'ms')) {
                        const resolved = resolveBlockContent(b.slug, 'ms', '')
                        const bmPreview = String(
                            resolved.content?.headline
                            ?? resolved.content?.sectionLabelBase
                            ?? ''
                        )
                        if (bmPreview) previewText = bmPreview
                    } else {
                        needsTranslation = true
                    }
                }

                return {
                    type: b.slug,
                    name: baseName,
                    description: baseDescription,
                    previewText,
                    needsTranslation,
                    icon: BLOCK_ICONS[b.slug] ?? FALLBACK_BLOCK_ICON,
                    defaultVariant: b.defaultVariant || b.variants?.[0] || 'default',
                    scope: b.scope ?? 'page',
                    scopeTooltip: blockTranslations?.[b.slug]?.scopeTooltip ?? b.scopeTooltip,
                }
            }).filter(item => {
                if (!keyword) return true
                return (
                    item.name.toLowerCase().includes(keyword)
                    || item.previewText.toLowerCase().includes(keyword)  // F26-03: BM preview searchable
                    || item.type.toLowerCase().includes(keyword)
                )
            })

            return {
                ...category,
                items,
                totalCount: category.blocks.length,
            }
        }).filter(category => category.items.length > 0 || !query.trim())
    }, [query, baseCategories, blockTranslations, activeLocale])

    const globalBlocks = useEditorStore(state => state.globalBlocks)
    const updateGlobalBlock = useEditorStore(state => state.updateGlobalBlock)

    const handleAddBlock = (blockType: string, variant: string) => {
        const key = BLOCK_TYPE_TO_KEY[blockType]
        if (variant === 'floating' && key) {
            // Floating global block → goes into site.globalBlocks, not page.layout
            updateGlobalBlock(key, { blockType, variant: 'floating' })
            return
        }
        const afterIndex = selectedBlock ?? (blocks.length - 1)
        void onAIAction({
            action: 'add_block',
            afterIndex,
            block: { blockType, variant },
        })
    }

    return (
        <TooltipProvider delayDuration={200}>
        <div className="flex h-full flex-col bg-[var(--editor-surface)]">
            <div className="flex-none px-3.5 pb-1.5 pt-3.5">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={bl.searchPlaceholder}
                        className="h-10 w-full rounded-[10px] border border-slate-400/[.18] bg-[#141d2e] pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-teal-400/50"
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-3 pt-1.5">
                <div className="flex flex-col gap-0.5">
                    {categories.map(category => {
                        const isExpanded = category.id === expandedCategory

                        return (
                            <section key={category.id}>
                                <button
                                    type="button"
                                    onClick={() => setExpandedCategory(prev => (prev === category.id ? prev : category.id))}
                                    aria-expanded={isExpanded}
                                    className="group flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm font-medium text-white transition-colors hover:bg-white/[.03]"
                                >
                                    <IconBadge icon={category.icon} size="group" />
                                    {category.label}
                                    <span className="rounded-[5px] bg-[#1e293b] px-1.5 text-[11px] leading-[17px] text-slate-400">{category.totalCount}</span>
                                    <ChevronRight
                                        className={cn('ml-auto h-[15px] w-[15px] text-slate-400 transition-transform duration-200', isExpanded && 'rotate-90')}
                                        aria-hidden
                                    />
                                </button>

                                {isExpanded ? (
                                    <div className="flex flex-col gap-1 pb-2.5 pt-1">
                                        {category.items.map(item => {
                                            const globalKey = BLOCK_TYPE_TO_KEY[item.type]
                                            const isAlreadyGlobal = item.scope === 'global' && item.defaultVariant === 'floating'
                                                && !!globalKey && !!globalBlocks?.[globalKey]
                                            return (
                                            // F26-03: relative wrapper so ✨ AI button sits as a sibling (not child) of the block button
                                            <div key={item.type} className="relative">
                                            <Tooltip open={isAlreadyGlobal ? undefined : false}>
                                            <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                draggable={!isAlreadyGlobal}
                                                onDragStart={(e) => {
                                                    if (isAlreadyGlobal) { e.preventDefault(); return }
                                                    const blockData = { blockType: item.type, variant: item.defaultVariant }
                                                    e.dataTransfer.setData('application/json', JSON.stringify(blockData))
                                                    e.dataTransfer.effectAllowed = 'copy'
                                                }}
                                                onClick={() => {
                                                    if (isAlreadyGlobal) { onEditGlobalBlock?.(item.type) }
                                                    else handleAddBlock(item.type, item.defaultVariant)
                                                }}
                                                className={cn(
                                                    "group flex w-full items-center gap-3 rounded-[10px] border border-transparent bg-[#141d2e] px-[11px] py-[7px] text-left transition-[background-color,border-color,transform] duration-200 hover:border-[rgba(45,212,191,.3)] hover:bg-[rgba(45,212,191,.08)]",
                                                    isAlreadyGlobal
                                                        ? "cursor-pointer opacity-60"
                                                        : "cursor-grab active:scale-[0.98] active:cursor-grabbing",
                                                )}
                                            >
                                                <IconBadge icon={item.icon} size="card" />
                                                <div className="flex min-w-0 flex-1 flex-col gap-px">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <p className="truncate text-sm font-medium leading-5 text-white">{item.name}</p>
                                                        {item.scope === 'global' && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span
                                                                        className="inline-flex shrink-0 cursor-default items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none"
                                                                        style={{ background: 'hsl(var(--info)/0.12)', color: 'hsl(var(--info))' }}
                                                                    >
                                                                        <Globe className="h-2.5 w-2.5" aria-hidden />
                                                                        {bl.globalScopeLabel}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="right">
                                                                    {item.scopeTooltip ?? bl.globalScopeTooltipDefault}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                    {/* F26-03: locale-aware preview text (no interactive children in button) */}
                                                    <p className="truncate text-xs leading-4 text-slate-400">{item.previewText}</p>
                                                </div>
                                                {!isAlreadyGlobal && (
                                                    isCompact ? (
                                                        <Plus className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                                                    ) : (
                                                        <span className="shrink-0 whitespace-nowrap text-[10px] leading-[14px] text-slate-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                                            {bl.dragHint}
                                                        </span>
                                                    )
                                                )}
                                            </button>
                                            </TooltipTrigger>
                                            {isAlreadyGlobal && (
                                                <TooltipContent side="right">
                                                    {bl.alreadyAddedHint ?? 'Already added — click to edit settings'}
                                                </TooltipContent>
                                            )}
                                            </Tooltip>
                                            </div>
                                            )
                                        })}
                                    </div>
                                ) : null}
                            </section>
                        )
                    })}
                </div>
            </div>

            {!isCompact && (
                <p className="m-0 flex-none px-3.5 pb-3.5 pt-2.5 text-center text-[11px] leading-4 text-slate-400">
                    {bl.footerHint}
                </p>
            )}
        </div>
        </TooltipProvider>
    )
}
