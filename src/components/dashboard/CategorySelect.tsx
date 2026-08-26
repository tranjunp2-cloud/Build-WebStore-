'use client'

import { useState, useRef, useEffect, useId, useMemo, type KeyboardEvent } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

export type Category = {
    id: string | number
    name: string
    breadcrumbs?: string
    parent?: { id: string | number } | string | number | null
}

interface CategorySelectProps {
    categories: Category[]
    selectedIds: (string | number)[]
    onChange: (ids: (string | number)[]) => void
    error?: string
    className?: string
    disabled?: boolean
    triggerId?: string
    ariaLabel?: string
    ariaLabelledBy?: string
    errorId?: string
}

function getParentId(cat: Category): string | number | null {
    if (!cat.parent) return null
    if (typeof cat.parent === 'object') return (cat.parent as { id: string | number }).id
    return cat.parent as string | number
}

function ColPanel({
    items, level, selectedId, selectedLeafId, onMouseEnter, onSelect, hasChildrenFn,
}: {
    items: Category[]
    level: number
    selectedId: string | number | null
    selectedLeafId: string | number | null
    onMouseEnter: (cat: Category) => void
    onSelect: (cat: Category) => void
    hasChildrenFn: (id: string | number) => boolean
}) {
    return (
        <div className="w-full min-w-0 max-h-60 overflow-y-auto bg-[hsl(var(--popover))] p-2 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent md:w-[220px] md:min-w-[220px] md:shrink-0">
            {items.map(cat => {
                const hasChildren = hasChildrenFn(cat.id)
                return (
                    <button
                        type="button"
                        role="treeitem"
                        key={cat.id}
                        tabIndex={-1}
                        aria-level={level}
                        data-category-id={String(cat.id)}
                        data-category-parent-id={getParentId(cat) == null ? undefined : String(getParentId(cat))}
                        aria-expanded={hasChildren ? selectedId === cat.id : undefined}
                        aria-selected={!hasChildren ? selectedLeafId === cat.id : undefined}
                        onMouseEnter={() => onMouseEnter(cat)}
                        onClick={(e) => { e.stopPropagation(); onSelect(cat) }}
                        className={cn(
                            'group flex w-full items-center justify-between gap-3 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-[14px] cursor-pointer transition-colors select-none outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]',
                            selectedId === cat.id
                                ? 'bg-[hsl(var(--primary))]/14 text-[hsl(var(--primary))] font-semibold shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.22)]'
                                : 'text-popover-foreground hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.08]'
                        )}
                    >
                        <span className="truncate">{cat.name}</span>
                        {hasChildren && <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-colors group-hover:text-[hsl(var(--primary))]/80', selectedId === cat.id && 'text-[hsl(var(--primary))]')} />}
                    </button>
                )
            })}
        </div>
    )
}

export function CategorySelect({
    categories,
    selectedIds,
    onChange,
    error,
    className,
    disabled = false,
    triggerId,
    ariaLabel,
    ariaLabelledBy,
    errorId,
}: CategorySelectProps) {
    const { t } = useI18n()
    const [isOpen, setIsOpen] = useState(false)
    const [hoveredL1, setHoveredL1] = useState<string | number | null>(null)
    const [hoveredL2, setHoveredL2] = useState<string | number | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const mobileTreeRef = useRef<HTMLDivElement>(null)
    const desktopTreeRef = useRef<HTMLDivElement>(null)
    const hydratedRef = useRef(false)
    const generatedId = useId()
    const resolvedTriggerId = triggerId ?? `category-select-${generatedId}`
    const treeId = `${resolvedTriggerId}-tree`
    const resolvedErrorId = error ? (errorId ?? `${resolvedTriggerId}-error`) : undefined

    const { l1, isLeaf } = useMemo(() => {
        const parentIds = new Set<string | number>()
        categories.forEach(c => { const pid = getParentId(c); if (pid != null) parentIds.add(pid) })
        return {
            l1: categories.filter(c => getParentId(c) == null),
            isLeaf: (id: string | number) => !parentIds.has(id),
        }
    }, [categories])

    const l2 = useMemo(
        () => hoveredL1 != null ? categories.filter(c => getParentId(c) === hoveredL1) : [],
        [categories, hoveredL1]
    )
    const l3 = useMemo(
        () => hoveredL2 != null ? categories.filter(c => getParentId(c) === hoveredL2) : [],
        [categories, hoveredL2]
    )

    useEffect(() => {
        if (selectedIds.length === 0) {
            setHoveredL1(null)
            setHoveredL2(null)
            hydratedRef.current = false
        }
    }, [selectedIds])

    useEffect(() => {
        if (hydratedRef.current || categories.length === 0 || selectedIds.length === 0) return
        hydratedRef.current = true
        const leaf = categories.find(c => c.id === selectedIds[0])
        if (!leaf) return
        const pid = getParentId(leaf)
        if (pid == null) {
            setHoveredL1(leaf.id)
        } else {
            const parent = categories.find(c => c.id === pid)
            if (!parent) return
            const gid = getParentId(parent)
            setHoveredL1(gid ?? pid)
            if (gid != null) setHoveredL2(pid)
        }
    }, [categories, selectedIds])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    useEffect(() => {
        if (disabled) setIsOpen(false)
    }, [disabled])
    const afterRender = (operation: () => void) => setTimeout(operation, 0)


    const selectLeaf = (cat: Category) => {
        if (disabled) return
        onChange([cat.id])
        setIsOpen(false)
        afterRender(() => triggerRef.current?.focus())
    }

    const handleL1Hover = (cat: Category) => { setHoveredL1(cat.id); setHoveredL2(null) }
    const handleL1Select = (cat: Category) => {
        if (isLeaf(cat.id)) selectLeaf(cat)
        else { setHoveredL1(cat.id); setHoveredL2(null) }
    }

    const handleL2Hover = (cat: Category) => setHoveredL2(cat.id)
    const handleL2Select = (cat: Category) => {
        if (isLeaf(cat.id)) selectLeaf(cat)
        else setHoveredL2(cat.id)
    }

    const handleL3Select = (cat: Category) => selectLeaf(cat)

    const getActiveTree = () => {
        const prefersDesktop = typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(min-width: 768px)').matches
        return prefersDesktop
            ? (desktopTreeRef.current ?? mobileTreeRef.current)
            : (mobileTreeRef.current ?? desktopTreeRef.current)
    }

    const getTreeItems = () => Array.from(
        getActiveTree()?.querySelectorAll<HTMLButtonElement>('[role="treeitem"]') ?? [],
    )

    const focusTreeItem = (predicate: (item: HTMLButtonElement) => boolean) => {
        getTreeItems().find(predicate)?.focus()
    }

    const openAndFocus = (position: 'first' | 'last' | 'selected' = 'selected') => {
        setIsOpen(true)
        afterRender(() => {
            const items = getTreeItems()
            if (position === 'last') {
                items.at(-1)?.focus()
                return
            }
            if (position === 'selected' && selectedIds[0] != null) {
                const selected = items.find(item =>
                    item.dataset.categoryId === String(selectedIds[0]) &&
                    item.getAttribute('aria-selected') === 'true'
                )
                if (selected) {
                    selected.focus()
                    return
                }
            }
            items[0]?.focus()
        })
    }

    const handleTriggerClick = () => {
        if (disabled) return
        if (isOpen) setIsOpen(false)
        else openAndFocus()
    }

    const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (disabled || !['ArrowDown', 'ArrowUp'].includes(event.key)) return
        event.preventDefault()
        openAndFocus(event.key === 'ArrowUp' ? 'last' : 'first')
    }

    const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const current = (event.target as HTMLElement).closest<HTMLButtonElement>('[role="treeitem"]')
        if (!current) return

        const items = getTreeItems()
        const currentIndex = items.indexOf(current)
        if (event.key === 'Tab') {
            setIsOpen(false)
            return
        }
        if (event.key === 'Escape') {
            event.preventDefault()
            setIsOpen(false)
            afterRender(() => triggerRef.current?.focus())
            return
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            const nextIndex = event.key === 'Home'
                ? 0
                : event.key === 'End'
                    ? items.length - 1
                    : event.key === 'ArrowDown'
                        ? Math.min(currentIndex + 1, items.length - 1)
                        : Math.max(currentIndex - 1, 0)
            items[nextIndex]?.focus()
            return
        }

        const category = categories.find(item => String(item.id) === current.dataset.categoryId)
        if (!category) return
        const parentId = getParentId(category)

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (isLeaf(category.id)) selectLeaf(category)
            else if (parentId == null) handleL1Select(category)
            else handleL2Select(category)
            return
        }

        if (event.key === 'ArrowRight' && !isLeaf(category.id)) {
            event.preventDefault()
            if (parentId == null) handleL1Select(category)
            else handleL2Select(category)
            afterRender(() => focusTreeItem(item =>
                item.dataset.categoryParentId === String(category.id)
            ))
            return
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault()
            if (!isLeaf(category.id) && current.getAttribute('aria-expanded') === 'true') {
                if (parentId == null) {
                    setHoveredL1(null)
                    setHoveredL2(null)
                } else {
                    setHoveredL2(null)
                }
                return
            }
            if (parentId != null) {
                afterRender(() => focusTreeItem(item =>
                    item.dataset.categoryId === String(parentId)
                ))
            }
        }
    }

    const selectedCat = categories.find(c => c.id === selectedIds[0])
    const label = selectedCat
        ? (selectedCat.breadcrumbs?.replace(/ > /g, ' / ') ?? selectedCat.name)
        : null

    const l2SelectedId = hoveredL2 ?? (l2.some(c => c.id === selectedIds[0]) ? selectedIds[0] : null)

    const getMobileIndentClass = (depth: number) => {
        if (depth === 1) return 'pl-7'
        if (depth === 2) return 'pl-11'
        return 'pl-3'
    }

    const renderMobileRow = (
        cat: Category,
        depth: number,
        selectedId: string | number | null,
        onSelect: (cat: Category) => void,
        expanded = false,
    ) => {
        const hasChildren = !isLeaf(cat.id)
        return (
            <button
                type="button"
                role="treeitem"
                key={cat.id}
                tabIndex={-1}
                data-category-id={String(cat.id)}
                data-category-parent-id={getParentId(cat) == null ? undefined : String(getParentId(cat))}
                aria-level={depth + 1}
                aria-expanded={hasChildren ? expanded : undefined}
                aria-selected={!hasChildren ? selectedIds[0] === cat.id : undefined}
                onClick={(e) => { e.stopPropagation(); onSelect(cat) }}
                className={cn(
                    'group flex w-full items-center justify-between gap-3 rounded-lg border-0 bg-transparent py-2.5 pr-3 text-left text-[14px] cursor-pointer transition-colors select-none outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]',
                    getMobileIndentClass(depth),
                    selectedId === cat.id
                        ? 'bg-[hsl(var(--primary))]/14 text-[hsl(var(--primary))] font-semibold shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.22)]'
                        : 'text-popover-foreground hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.08]'
                )}
            >
                <span className="truncate">{cat.name}</span>
                {hasChildren && <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-all group-hover:text-[hsl(var(--primary))]/80', selectedId === cat.id && 'text-[hsl(var(--primary))]', expanded && 'rotate-90')} />}
            </button>
        )
    }

    return (
        <div ref={containerRef} className={cn('relative', disabled && 'opacity-60', className)}>
            <button
                ref={triggerRef}
                id={resolvedTriggerId}
                type="button"
                role="combobox"
                disabled={disabled}
                onClick={handleTriggerClick}
                onKeyDown={handleTriggerKeyDown}
                aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? t.dashboard.products.form.categories.select)}
                aria-labelledby={ariaLabelledBy}
                aria-haspopup="tree"
                aria-expanded={isOpen}
                aria-controls={isOpen ? treeId : undefined}
                aria-invalid={Boolean(error)}
                aria-describedby={resolvedErrorId}
                className={cn(
                    'flex h-9 w-full items-center rounded-lg border border-solid bg-[hsl(var(--card))] px-3 py-2 text-left text-base md:text-sm text-[hsl(var(--foreground))] shadow-none outline-none cursor-pointer transition-colors focus-visible:outline-none focus-visible:border-[hsl(var(--ring))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed',
                    error ? 'border-[hsl(var(--destructive))]' : 'border-[hsl(var(--input-border))]',
                    isOpen && !error && 'ring-1 ring-[hsl(var(--ring))]'
                )}
            >
                <span className={label ? 'font-semibold text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}>
                    {label ?? t.dashboard.products.form.categories.select}
                </span>
                <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform', isOpen && 'rotate-180')} />
            </button>

            {isOpen && (
                <div
                    id={treeId}
                    role="tree"
                    aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? t.dashboard.products.form.categories.select)}
                    aria-labelledby={ariaLabelledBy}
                    onKeyDown={handleTreeKeyDown}
                    className="absolute left-0 z-50 mt-2 flex w-full min-w-full max-w-full flex-col overflow-hidden rounded-xl border border-solid border-[hsl(var(--input-border))] bg-[hsl(var(--popover))] shadow-2xl ring-1 ring-white/5 animate-in fade-in slide-in-from-top-1 md:w-max md:max-w-[calc(100vw-2rem)] md:min-w-full md:flex-row md:overflow-x-auto md:overflow-y-hidden md:overscroll-x-contain md:divide-x md:divide-[hsl(var(--border))]/70 md:scrollbar-thin md:scrollbar-thumb-white/15 md:scrollbar-track-transparent"
                    style={{ minWidth: '100%', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                >
                    <div ref={mobileTreeRef} className="space-y-1 p-2 md:hidden">
                        {l1.map(cat => {
                            const mobileL2 = categories.filter(child => getParentId(child) === cat.id)
                            return (
                                <div key={cat.id}>
                                    {renderMobileRow(cat, 0, hoveredL1, handleL1Select, hoveredL1 === cat.id && mobileL2.length > 0)}
                                    {hoveredL1 === cat.id && mobileL2.length > 0 && (
                                        <div className="mt-1 space-y-1">
                                            {mobileL2.map(child => {
                                                const mobileL3 = categories.filter(grandchild => getParentId(grandchild) === child.id)
                                                return (
                                                    <div key={child.id}>
                                                        {renderMobileRow(child, 1, hoveredL2 ?? (selectedIds[0] === child.id ? child.id : null), handleL2Select, hoveredL2 === child.id && mobileL3.length > 0)}
                                                        {hoveredL2 === child.id && mobileL3.length > 0 && (
                                                            <div className="mt-1 space-y-1">
                                                                {mobileL3.map(grandchild => renderMobileRow(grandchild, 2, selectedIds[0] ?? null, handleL3Select))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    <div ref={desktopTreeRef} className="hidden md:flex md:flex-row">
                        <ColPanel
                            items={l1}
                            level={1}
                            selectedId={hoveredL1}
                            selectedLeafId={selectedIds[0] ?? null}
                            onMouseEnter={handleL1Hover}
                            onSelect={handleL1Select}
                            hasChildrenFn={id => !isLeaf(id)}
                        />
                        {l2.length > 0 && (
                            <ColPanel
                                items={l2}
                                level={2}
                                selectedId={l2SelectedId}
                                selectedLeafId={selectedIds[0] ?? null}
                                onMouseEnter={handleL2Hover}
                                onSelect={handleL2Select}
                                hasChildrenFn={id => !isLeaf(id)}
                            />
                        )}
                        {l3.length > 0 && (
                            <ColPanel
                                items={l3}
                                level={3}
                                selectedId={selectedIds[0] ?? null}
                                selectedLeafId={selectedIds[0] ?? null}
                                onMouseEnter={() => {}}
                                onSelect={handleL3Select}
                                hasChildrenFn={() => false}
                            />
                        )}
                    </div>
                </div>
            )}

            {error && <p id={resolvedErrorId} role="alert" className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    )
}
