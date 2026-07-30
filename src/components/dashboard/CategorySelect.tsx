'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
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
}

function getParentId(cat: Category): string | number | null {
    if (!cat.parent) return null
    if (typeof cat.parent === 'object') return (cat.parent as { id: string | number }).id
    return cat.parent as string | number
}

function ColPanel({
    items, selectedId, onMouseEnter, onSelect, hasChildrenFn,
}: {
    items: Category[]
    selectedId: string | number | null
    onMouseEnter: (cat: Category) => void
    onSelect: (cat: Category) => void
    hasChildrenFn: (id: string | number) => boolean
}) {
    return (
        <div className="w-full min-w-0 max-h-60 overflow-y-auto bg-[hsl(var(--popover))] p-2 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent md:w-[220px] md:min-w-[220px] md:shrink-0">
            {items.map(cat => {
                const hasChildren = hasChildrenFn(cat.id)
                return (
                    <div
                        key={cat.id}
                        onMouseEnter={() => onMouseEnter(cat)}
                        onClick={(e) => { e.stopPropagation(); onSelect(cat) }}
                        className={cn(
                            'group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[14px] cursor-pointer transition-colors select-none outline-none',
                            selectedId === cat.id
                                ? 'bg-[hsl(var(--primary))]/14 text-[hsl(var(--primary))] font-semibold shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.22)]'
                                : 'text-popover-foreground hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.08]'
                        )}
                    >
                        <span className="truncate">{cat.name}</span>
                        {hasChildren && <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-colors group-hover:text-[hsl(var(--primary))]/80', selectedId === cat.id && 'text-[hsl(var(--primary))]')} />}
                    </div>
                )
            })}
        </div>
    )
}

export function CategorySelect({ categories, selectedIds, onChange, error, className, disabled = false }: CategorySelectProps) {
    const { t } = useI18n()
    const [isOpen, setIsOpen] = useState(false)
    const [hoveredL1, setHoveredL1] = useState<string | number | null>(null)
    const [hoveredL2, setHoveredL2] = useState<string | number | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const hydratedRef = useRef(false)

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

    const selectLeaf = (cat: Category) => {
        if (disabled) return
        onChange([cat.id])
        setIsOpen(false)
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
            <div
                key={cat.id}
                onClick={(e) => { e.stopPropagation(); onSelect(cat) }}
                className={cn(
                    'group flex items-center justify-between gap-3 rounded-lg py-2.5 pr-3 text-[14px] cursor-pointer transition-colors select-none outline-none',
                    getMobileIndentClass(depth),
                    selectedId === cat.id
                        ? 'bg-[hsl(var(--primary))]/14 text-[hsl(var(--primary))] font-semibold shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.22)]'
                        : 'text-popover-foreground hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.08]'
                )}
            >
                <span className="truncate">{cat.name}</span>
                {hasChildren && <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-all group-hover:text-[hsl(var(--primary))]/80', selectedId === cat.id && 'text-[hsl(var(--primary))]', expanded && 'rotate-90')} />}
            </div>
        )
    }

    return (
        <div ref={containerRef} className={cn('relative', disabled && 'pointer-events-none opacity-60', className)}>
            <div
                onClick={() => {
                    if (!disabled) setIsOpen(!isOpen)
                }}
                aria-disabled={disabled}
                className={cn(
                    'flex h-9 w-full items-center rounded-lg border border-solid bg-[hsl(var(--card))] px-3 py-2 text-base md:text-sm text-[hsl(var(--foreground))] shadow-none outline-none cursor-pointer transition-colors focus-visible:outline-none focus-visible:border-[hsl(var(--ring))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]',
                    error ? 'border-[hsl(var(--destructive))]' : 'border-[hsl(var(--input-border))]',
                    isOpen && !error && 'ring-1 ring-[hsl(var(--ring))]'
                )}
            >
                <span className={label ? 'font-semibold text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}>
                    {label ?? t.dashboard.products.form.categories.select}
                </span>
                <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform', isOpen && 'rotate-180')} />
            </div>

            {isOpen && (
                <div
                    className="absolute left-0 z-50 mt-2 flex w-full min-w-full max-w-full flex-col overflow-hidden rounded-xl border border-solid border-[hsl(var(--input-border))] bg-[hsl(var(--popover))] shadow-2xl ring-1 ring-white/5 animate-in fade-in slide-in-from-top-1 md:w-max md:max-w-[calc(100vw-2rem)] md:min-w-full md:flex-row md:overflow-x-auto md:overflow-y-hidden md:overscroll-x-contain md:divide-x md:divide-[hsl(var(--border))]/70 md:scrollbar-thin md:scrollbar-thumb-white/15 md:scrollbar-track-transparent"
                    style={{ minWidth: '100%', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                >
                    <div className="space-y-1 p-2 md:hidden">
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
                    <div className="hidden md:flex md:flex-row">
                        <ColPanel
                            items={l1}
                            selectedId={hoveredL1}
                            onMouseEnter={handleL1Hover}
                            onSelect={handleL1Select}
                            hasChildrenFn={id => !isLeaf(id)}
                        />
                        {l2.length > 0 && (
                            <ColPanel
                                items={l2}
                                selectedId={l2SelectedId}
                                onMouseEnter={handleL2Hover}
                                onSelect={handleL2Select}
                                hasChildrenFn={id => !isLeaf(id)}
                            />
                        )}
                        {l3.length > 0 && (
                            <ColPanel
                                items={l3}
                                selectedId={selectedIds[0] ?? null}
                                onMouseEnter={() => {}}
                                onSelect={handleL3Select}
                                hasChildrenFn={() => false}
                            />
                        )}
                    </div>
                </div>
            )}

            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    )
}
