'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AIAction, BlockData } from '@/types/editor'
import { useI18n } from '@/i18n'
import { listAllBlocks } from '@/lib/admin/block-registry-reader'
import { resolveBlockContent, hasLocaleContent } from '@/lib/ai/add-section-content'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useEditorStore, BLOCK_TYPE_TO_KEY } from '@/store/editorStore'

// ── Category display config (i18n labels + icons, Malay) ──────────────────────

const CATEGORY_DISPLAY: Record<string, { icon: string; label: string }> = {
    basics:   { icon: '📦', label: 'Asas' },
    content:  { icon: '📄', label: 'Kandungan' },
    media:    { icon: '🖼️', label: 'Media' },
    store:    { icon: '💼', label: 'Perniagaan' },
    commerce: { icon: '🛒', label: 'Perdagangan' },
    form:     { icon: '📝', label: 'Borang & Hubungi' },
    widgets:  { icon: '🔧', label: 'Widget' },
    layout:   { icon: '📐', label: 'Susun Atur' },
}

// Canonical display order — matches editor UX taxonomy
const CATEGORY_ORDER = ['basics', 'content', 'media', 'store', 'commerce', 'form', 'widgets', 'layout'] as const

// ── Icon overrides (slug → icon) ─────────────────────────────────────────────
// Provides a curated icon experience for known blocks, overrides meta.icon

const BLOCK_ICON_OVERRIDES: Record<string, string> = {
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

interface BlockLibraryPanelProps {
    blocks: BlockData[]
    selectedBlock: number | null
    onBlockSelect: (index: number) => void
    onAIAction: (action: AIAction) => Promise<void> | void
    onEditGlobalBlock?: (blockType: string) => void
    /** F26-07: Whether language switcher is already added to the nav header */
    navShowLanguageSwitcher?: boolean
    /** F26-07: Called when user adds/removes language switcher from header */
    onNavLanguageSwitcherChange?: (show: boolean) => void
    /** F26-04: Called when user clicks "✨ AI" auto-translate button for a block type */
    onAutoTranslate?: (blockType: string) => Promise<void>
}

export function BlockLibraryPanel({
    blocks,
    selectedBlock,
    onAIAction,
    onEditGlobalBlock,
    navShowLanguageSwitcher = false,
    onNavLanguageSwitcherChange,
    onAutoTranslate,
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
            .filter(b => b.aiVisible !== false)
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
                icon: CATEGORY_DISPLAY[cat]?.icon ?? '📦',
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
                    icon: BLOCK_ICON_OVERRIDES[b.slug] || b.icon || '🧩',
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

    // F26-07: Language Switcher search index — mirrors category item filter logic
    // Includes all searchable terms so "language", "switcher", "BM", "nav", etc. surface the block
    const navLangSwitcherSearchable = 'language switcher en bm toggle nav bar header navigation bahasa melayu'
    const navMatchesSearch = !query.trim() || navLangSwitcherSearchable.includes(query.trim().toLowerCase())

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
                    {/* ── Navigation header-locked components ──────────────── */}
                    {navMatchesSearch && (
                    <section>
                        <button
                            type="button"
                            onClick={() => setExpandedCategory(prev => (prev === 'nav' ? prev : 'nav'))}
                            className="flex h-9 w-full items-center justify-between rounded-lg px-2 text-left transition-colors hover:bg-white/[0.04]"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm leading-none">🌐</span>
                                {/* TODO(F27): i18n this string */}
                                <span className="text-[13px] font-medium text-slate-200">Navigation</span>
                                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-500">1</span>
                            </div>
                            {(expandedCategory === 'nav' || !!query.trim()) ? (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                            ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                            )}
                        </button>
                        {(expandedCategory === 'nav' || !!query.trim()) && (
                        <div className="mt-1 space-y-1 pb-2">
                            <Tooltip>
                            <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={() => onNavLanguageSwitcherChange?.(!navShowLanguageSwitcher)}
                                className={cn(
                                    "group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-all",
                                    navShowLanguageSwitcher
                                        ? "bg-cyan-500/[0.08] border-cyan-500/20 hover:bg-cyan-500/[0.12]"
                                        : "bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.06]",
                                )}
                            >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/15 to-cyan-500/15 text-lg">
                                    🌏
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        {/* TODO(F27): i18n this string */}
                                        <p className="truncate text-[13px] font-medium text-slate-200">Language Switcher</p>
                                        <span
                                            className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none"
                                            style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee' }}
                                        >
                                            🔒 Header
                                        </span>
                                    </div>
                                    {/* TODO(F27): i18n this string */}
                                    <p className="truncate text-[11px] text-slate-500">EN | BM toggle in nav bar</p>
                                </div>
                                <span className={cn(
                                    "shrink-0 text-[10px] font-medium transition-colors",
                                    navShowLanguageSwitcher ? "text-cyan-400" : "text-slate-600 opacity-0 group-hover:opacity-100",
                                )}>
                                    {navShowLanguageSwitcher ? 'Added ✓' : 'Add'}
                                </span>
                            </button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                {navShowLanguageSwitcher
                                    ? 'Click to remove language switcher from header'
                                    : 'Adds EN | BM toggle directly into the navigation bar'}
                            </TooltipContent>
                            </Tooltip>
                        </div>
                        )}
                    </section>
                    )}

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
                                                    isAlreadyGlobal
                                                        ? "opacity-60 hover:border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
                                                        : "hover:border-white/[0.08] hover:bg-white/[0.06] cursor-grab active:cursor-grabbing active:scale-[0.98]",
                                                )}
                                            >
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/15 to-cyan-500/15 text-lg">
                                                    {item.icon}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="truncate text-[13px] font-medium text-slate-200">{item.name}</p>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                {item.scope === 'global' ? (
                                                                    <span
                                                                        className="shrink-0 cursor-default rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none"
                                                                        style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee' }}
                                                                    >
                                                                        🌐 {bl.globalScopeLabel}
                                                                    </span>
                                                                ) : (
                                                                    <span
                                                                        className="shrink-0 cursor-default rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none"
                                                                        style={{ background: 'rgba(148,163,184,0.10)', color: '#94a3b8' }}
                                                                    >
                                                                        📄 {bl.pageScopeLabel}
                                                                    </span>
                                                                )}
                                                            </TooltipTrigger>
                                                            <TooltipContent side="right">
                                                                {item.scope === 'global'
                                                                    ? (item.scopeTooltip ?? bl.globalScopeTooltipDefault)
                                                                    : (item.scopeTooltip ?? bl.pageScopeTooltipDefault)}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                    {/* F26-03: locale-aware preview text (no interactive children in button) */}
                                                    <p className="truncate text-[11px] text-slate-500">{item.previewText}</p>
                                                </div>
                                                {!isAlreadyGlobal && (
                                                    <span className="shrink-0 text-[10px] text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
                                                        {bl.dragHint}
                                                    </span>
                                                )}
                                            </button>
                                            </TooltipTrigger>
                                            {isAlreadyGlobal && (
                                                <TooltipContent side="right">
                                                    {bl.alreadyAddedHint ?? 'Already added — click to edit settings'}
                                                </TooltipContent>
                                            )}
                                            </Tooltip>
                                            {/* F26-04: auto-translate affordance — shows when BM not authored + not yet AI-translated */}
                                            {item.needsTranslation && !translatedTypes.has(item.type) && (
                                                <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        type="button"
                                                        disabled={pendingTranslateTypes.has(item.type)}
                                                        className="absolute bottom-2 left-[60px] z-10 text-[9px] font-semibold text-amber-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-wait transition-colors px-1"
                                                        onClick={async () => {
                                                            if (!onAutoTranslate || pendingTranslateTypes.has(item.type)) return
                                                            setPendingTranslateTypes(prev => new Set(prev).add(item.type))
                                                            try {
                                                                await onAutoTranslate(item.type)
                                                                setTranslatedTypes(prev => new Set(prev).add(item.type))
                                                            } catch {
                                                                // AC-3: non-blocking error — EN content remains in place
                                                                toast.error('Auto-translate failed. English content will be used instead.')
                                                            } finally {
                                                                setPendingTranslateTypes(prev => {
                                                                    const next = new Set(prev)
                                                                    next.delete(item.type)
                                                                    return next
                                                                })
                                                            }
                                                        }}
                                                    >{pendingTranslateTypes.has(item.type) ? '⏳' : '✨ AI'}</button>
                                                </TooltipTrigger>
                                                <TooltipContent side="right">
                                                    Auto-translate to Bahasa Melayu
                                                </TooltipContent>
                                                </Tooltip>
                                            )}
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

            <div className="border-t border-white/[0.06] bg-[#0B1120]/60 px-4 py-3">
                <p className="text-center text-[11px] text-slate-500">
                    {bl.footerHint}
                </p>
            </div>
        </div>
        </TooltipProvider>
    )
}
