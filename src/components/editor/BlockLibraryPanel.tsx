'use client'

import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
    BarChart3, Blocks, BookOpen, Briefcase, Building2, ChevronDown, ChevronRight, CircleHelp, Eye, FileText,
    FormInput, GalleryHorizontal, Globe, ImageIcon, Images, LayoutGrid, LayoutTemplate, Mail, MailPlus, Megaphone,
    MessageCircle, MessageSquareQuote, Minus, MousePointerClick, Newspaper, Palette, PanelTop, Plus, Puzzle, Rows3,
    Scale, Search, Share2, ShoppingBag, ShoppingCart, Star, Tag, Type, Users, UtensilsCrossed, Video, Wrench,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/components/ui/focus-ring'
import type { AIAction, BlockData } from '@/types/editor'
import { useI18n } from '@/i18n'
import { listAllBlocks } from '@/lib/admin/block-registry-reader'
import { resolveBlockContent, hasLocaleContent } from '@/lib/ai/add-section-content'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useEditorStore, BLOCK_TYPE_TO_KEY } from '@/store/editorStore'

// ── Category display config (i18n labels + icons, Malay) ──────────────────────

const CATEGORY_DISPLAY: Record<string, { icon: LucideIcon; label: string }> = {
    basics:   { icon: LayoutTemplate, label: 'Asas' },
    content:  { icon: FileText, label: 'Kandungan' },
    media:    { icon: ImageIcon, label: 'Media' },
    store:    { icon: Briefcase, label: 'Perniagaan' },
    commerce: { icon: ShoppingCart, label: 'Perdagangan' },
    form:     { icon: FormInput, label: 'Borang & Hubungi' },
    widgets:  { icon: Puzzle, label: 'Widget' },
    layout:   { icon: Rows3, label: 'Susun Atur' },
}

// Canonical display order — matches editor UX taxonomy
const CATEGORY_ORDER = ['basics', 'content', 'media', 'store', 'commerce', 'form', 'widgets', 'layout'] as const

// ── Block icons (slug → lucide icon) ─────────────────────────────────────────
// Replaces the emoji in each block's meta.icon; unknown slugs fall back to their category icon.

const BLOCK_ICONS: Record<string, LucideIcon> = {
    hero: PanelTop,
    features: LayoutGrid,
    about: BookOpen,
    'service-cards': Wrench,
    cta: MousePointerClick,
    testimonials: MessageSquareQuote,
    faq: CircleHelp,
    'blog-list': Newspaper,
    'custom-html': Type,
    'portfolio-grid': Palette,
    gallery: Images,
    'gallery-masonry': Images,
    video: Video,
    'video-background': Video,
    carousel: GalleryHorizontal,
    pricing: Tag,
    'pricing-table': Tag,
    'feature-comparison': Scale,
    'menu-food': UtensilsCrossed,
    'products-grid': ShoppingBag,
    'products-featured': Star,
    'product-quick-view': Eye,
    cartWidget: ShoppingCart,
    contact: Mail,
    newsletter: MailPlus,
    'whatsapp-button': MessageCircle,
    stats: BarChart3,
    team: Users,
    'logo-cloud': Building2,
    'client-logos': Building2,
    socialWidget: Share2,
    divider: Minus,
    'announcement-bar': Megaphone,
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
                icon: CATEGORY_DISPLAY[cat]?.icon ?? Blocks,
                label: categoryLabels[cat] || CATEGORY_DISPLAY[cat]?.label || cat,
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
                    icon: BLOCK_ICONS[b.slug] ?? category.icon,
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
            <div className="border-b border-white/[0.06] px-4 py-3">
                {/* Shared <Input> mặc định — bg theo --card (trắng ở light, tối ở dark) + viền --input-border. */}
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                    <Input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={bl.searchPlaceholder}
                        className="pl-9 pr-3 text-[13px]"
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
                                    aria-expanded={isExpanded}
                                    className={cn('flex h-9 w-full items-center justify-between rounded-lg px-2 text-left transition-colors hover:bg-[var(--editor-overlay-hover)]', FOCUS_RING)}
                                >
                                    <div className="flex items-center gap-2">
                                        <category.icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
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
                                                    "group flex w-full items-center gap-3 rounded-lg border border-transparent bg-white/[0.02] px-3 py-2.5 text-left transition-all",
                                                    FOCUS_RING,
                                                    isAlreadyGlobal
                                                        ? "opacity-60 hover:border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
                                                        : "hover:border-white/[0.08] hover:bg-white/[0.06] cursor-grab active:cursor-grabbing active:scale-[0.98]",
                                                )}
                                            >
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[var(--editor-text-muted)]">
                                                    <item.icon className="h-4 w-4" aria-hidden />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="truncate text-[13px] font-medium text-slate-200">{item.name}</p>
                                                        {/* Page scope is the norm, so only the exception (shared on every page) gets a badge. */}
                                                        {item.scope === 'global' ? (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="inline-flex shrink-0 cursor-default items-center gap-1 rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[var(--editor-text-muted)]">
                                                                        <Globe className="h-2.5 w-2.5" aria-hidden />
                                                                        {bl.globalScopeLabel}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="right">
                                                                    {item.scopeTooltip ?? bl.globalScopeTooltipDefault}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ) : null}
                                                    </div>
                                                    {/* F26-03: locale-aware preview text (no interactive children in button) */}
                                                    <p className="truncate text-[11px] text-slate-500">{item.previewText}</p>
                                                </div>
                                                {!isAlreadyGlobal && (
                                                    isCompact ? (
                                                        <Plus className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                                                    ) : (
                                                        <span className="shrink-0 text-[10px] text-slate-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
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
        </div>
        </TooltipProvider>
    )
}
