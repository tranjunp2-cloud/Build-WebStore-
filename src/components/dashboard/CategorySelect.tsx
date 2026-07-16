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
        <div className="min-w-[160px] max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {items.map(cat => {
                const hasChildren = hasChildrenFn(cat.id)
                return (
                    <div
                        key={cat.id}
                        onMouseEnter={() => onMouseEnter(cat)}
                        onClick={(e) => { e.stopPropagation(); onSelect(cat) }}
                        className={cn(
                            "flex items-center justify-between px-4 py-2.5 text-[14px] cursor-pointer transition-colors select-none",
                            selectedId === cat.id
                                ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] font-medium"
                                : "text-popover-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                        )}
                    >
                        <span className="truncate">{cat.name}</span>
                        {hasChildren && <ChevronRight className="h-3.5 w-3.5 shrink-0 ml-2 opacity-60" />}
                    </div>
                )
            })}
        </div>
    )
}

export function CategorySelect({ categories, selectedIds, onChange, error, className }: CategorySelectProps) {
    const { t } = useI18n()
    const [isOpen, setIsOpen] = useState(false)
    const [hoveredL1, setHoveredL1] = useState<string | number | null>(null)
    const [hoveredL2, setHoveredL2] = useState<string | number | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const hydratedRef = useRef(false)

    // parentIds and isLeaf only depend on categories — separate from hover state
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

    // Reset hover state when selection is cleared externally (e.g. form reset)
    useEffect(() => {
        if (selectedIds.length === 0) {
            setHoveredL1(null)
            setHoveredL2(null)
            hydratedRef.current = false
        }
    }, [selectedIds])

    // Edit mode: hydrate hovered state from existing selection
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

    // Close panel on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const selectLeaf = (cat: Category) => {
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

    // Breadcrumb: use server-generated field, replace " > " separator with " / "
    const selectedCat = categories.find(c => c.id === selectedIds[0])
    const label = selectedCat
        ? (selectedCat.breadcrumbs?.replace(/ > /g, ' / ') ?? selectedCat.name)
        : null

    // Col 2 highlights: hovered L2 (for L3 drill-down) or selected leaf if it's in l2
    const l2SelectedId = hoveredL2 ?? (l2.some(c => c.id === selectedIds[0]) ? selectedIds[0] : null)

    return (
        <div ref={containerRef} className={cn("relative", className)}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex min-h-[48px] w-full items-center rounded-lg border bg-[hsl(var(--card))] px-4 py-3 text-[16px] outline-none cursor-pointer transition-colors",
                    error ? "border-[hsl(var(--destructive))]" : "border-[hsl(var(--input-border))]",
                    isOpen && !error && "ring-1 ring-[hsl(var(--ring))]"
                )}
            >
                <span className={label ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"}>
                    {label ?? t.dashboard.products.form.categories.select}
                </span>
                <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform", isOpen && "rotate-180")} />
            </div>

            {isOpen && (
                <div
                    className="absolute z-50 mt-1 left-0 flex flex-row divide-x divide-border border border-border animate-in fade-in slide-in-from-top-1"
                    style={{ minWidth: '100%', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                >
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
            )}

            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    )
}
