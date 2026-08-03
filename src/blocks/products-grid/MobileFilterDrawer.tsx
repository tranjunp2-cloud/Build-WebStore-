'use client'

import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { useI18n } from '@/i18n'
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import type { ActiveProductFilters, ProductFilterBounds, SidebarCategory } from './filter-types'

interface MobileFilterDrawerProps {
    activeFilters: ActiveProductFilters
    bounds: ProductFilterBounds
    categories: SidebarCategory[]
    filterButtonLabel: string
    onApplyFilters: (mutate: (params: URLSearchParams) => void, event?: React.SyntheticEvent<HTMLElement>) => void
    pricePrefix: string
    primaryColor: string
    saveButtonLabel: string
    sections: {
        title: string
        search: string
        categories: string
        price: string
    }
    searchPlaceholder: string
}

interface CategoryTreeNode extends SidebarCategory {
    children: CategoryTreeNode[]
}

const OVERLAY_STYLE = { backgroundColor: 'rgba(15, 23, 42, 0.5)' }
const MOBILE_CATEGORY_INDENT = 14

function clamp(value: number, lower: number, upper: number) {
    return Math.min(Math.max(value, lower), upper)
}

function cloneAttributeFilters(attributeFilters: Record<string, string[]>) {
    return Object.fromEntries(
        Object.entries(attributeFilters).map(([key, values]) => [key, [...values]]),
    )
}

function normalizeRange(activeMinPrice: string | null, activeMaxPrice: string | null, minBound: number, maxBound: number) {
    const rawMin = activeMinPrice ? Number(activeMinPrice) : minBound
    const rawMax = activeMaxPrice ? Number(activeMaxPrice) : maxBound
    const normalizedMin = clamp(Number.isFinite(rawMin) ? rawMin : minBound, minBound, maxBound)
    const normalizedMax = clamp(Number.isFinite(rawMax) ? rawMax : maxBound, minBound, maxBound)

    return {
        min: Math.min(normalizedMin, normalizedMax),
        max: Math.max(normalizedMin, normalizedMax),
    }
}

function formatAttributeLabel(value: string) {
    return value
        .split(/[_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function buildCategoryTree(categories: SidebarCategory[]): CategoryTreeNode[] {
    const nodes = new Map<string, CategoryTreeNode>()

    categories.forEach((category) => {
        if (!nodes.has(category.id)) nodes.set(category.id, { ...category, children: [] })
    })

    nodes.forEach((node) => {
        if (!node.parent) return
        const parent = nodes.get(node.parent)
        if (parent && !parent.children.some((child) => child.id === node.id)) {
            parent.children.push(node)
        }
    })

    const sortNodes = (items: CategoryTreeNode[]) => {
        items.sort((left, right) => left.name.localeCompare(right.name))
        items.forEach((item) => sortNodes(item.children))
    }

    const roots = Array.from(nodes.values()).filter((node) => !node.parent)
    sortNodes(roots)
    return roots
}

function removeExpandedSubtree(expandedIds: Set<string>, node: CategoryTreeNode) {
    expandedIds.delete(node.id)
    node.children.forEach((child) => removeExpandedSubtree(expandedIds, child))
}

export function MobileFilterDrawer({
    activeFilters,
    bounds,
    categories,
    filterButtonLabel,
    onApplyFilters,
    pricePrefix,
    primaryColor,
    saveButtonLabel,
    sections,
    searchPlaceholder,
}: MobileFilterDrawerProps) {
    const { t } = useI18n()
    const productText = t.storefront.products as Record<string, string | undefined>
    const [open, setOpen] = useState(false)
    const minBound = Math.floor(bounds.minPrice)
    const maxBound = Math.max(Math.ceil(bounds.maxPrice), minBound + 1)
    const categoryTree = useMemo(() => buildCategoryTree(categories), [categories])
    const [draftSearch, setDraftSearch] = useState(activeFilters.search ?? '')
    const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>(activeFilters.categoryIds)
    const [draftAttributeFilters, setDraftAttributeFilters] = useState<Record<string, string[]>>(() => cloneAttributeFilters(activeFilters.attributeFilters))
    const [rangeValues, setRangeValues] = useState(() => normalizeRange(activeFilters.minPrice, activeFilters.maxPrice, minBound, maxBound))
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const draftCategorySet = useMemo(() => new Set(draftCategoryIds), [draftCategoryIds])
    const activeCategorySet = useMemo(() => new Set(activeFilters.categoryIds), [activeFilters.categoryIds])

    const defaultExpandedIds = useMemo(() => {
        const expanded = new Set<string>()

        const visit = (node: CategoryTreeNode): boolean => {
            if (node.children.length === 0) return activeCategorySet.has(node.id)
            const containsActive = activeCategorySet.has(node.id) || node.children.some((child) => visit(child))
            if (containsActive) expanded.add(node.id)
            return containsActive
        }

        categoryTree.forEach((node) => {
            visit(node)
        })

        return expanded
    }, [activeCategorySet, categoryTree])

    useEffect(() => {
        if (!open) return

        setDraftSearch(activeFilters.search ?? '')
        setDraftCategoryIds(activeFilters.categoryIds)
        setDraftAttributeFilters(cloneAttributeFilters(activeFilters.attributeFilters))
        setRangeValues(normalizeRange(activeFilters.minPrice, activeFilters.maxPrice, minBound, maxBound))
        setExpandedIds(new Set(defaultExpandedIds))
    }, [activeFilters, defaultExpandedIds, maxBound, minBound, open])

    const minPercent = useMemo(() => ((rangeValues.min - minBound) / (maxBound - minBound)) * 100, [maxBound, minBound, rangeValues.min])
    const maxPercent = useMemo(() => ((rangeValues.max - minBound) / (maxBound - minBound)) * 100, [maxBound, minBound, rangeValues.max])

    const toggleCategory = (categoryId: string) => {
        setDraftCategoryIds((current) => (
            current.includes(categoryId)
                ? current.filter((id) => id !== categoryId)
                : [...current, categoryId]
        ))
    }

    const toggleExpanded = (node: CategoryTreeNode, siblings: CategoryTreeNode[]) => {
        setExpandedIds((current) => {
            const next = new Set(current)
            if (next.has(node.id)) {
                removeExpandedSubtree(next, node)
            } else {
                siblings.forEach((sibling) => {
                    if (sibling.id !== node.id) removeExpandedSubtree(next, sibling)
                })
                next.add(node.id)
            }
            return next
        })
    }

    const toggleAttributeValue = (key: string, value: string) => {
        setDraftAttributeFilters((current) => {
            const existing = current[key] ?? []
            const nextValues = existing.includes(value)
                ? existing.filter((item) => item !== value)
                : [...existing, value]

            if (nextValues.length === 0) {
                const next = { ...current }
                delete next[key]
                return next
            }

            return { ...current, [key]: nextValues }
        })
    }

    const renderCategoryNode = (node: CategoryTreeNode, depth: number, siblings: CategoryTreeNode[]) => {
        const hasChildren = node.children.length > 0
        const isExpanded = hasChildren && expandedIds.has(node.id)
        const isChecked = draftCategorySet.has(node.id)

        return (
            <React.Fragment key={node.id}>
                <div
                    className="flex min-w-0 items-center gap-3"
                    style={{ paddingLeft: depth > 0 ? Math.min(depth, 2) * MOBILE_CATEGORY_INDENT : 0 }}
                >
                    <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleCategory(node.id)}
                        aria-label={node.name}
                        className="h-5 w-5 rounded-[6px] border-[hsl(var(--input-border))] border-solid bg-transparent data-[state=checked]:border-[var(--brand-primary)] data-[state=checked]:bg-[var(--brand-primary)] [&_svg]:h-3 [&_svg]:w-3"
                    />
                    <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        title={node.breadcrumbs ?? node.name}
                        onClick={() => toggleCategory(node.id)}
                    >
                        <span className="block truncate text-[15px] font-medium leading-7 text-[var(--text-primary)]">{node.name}</span>
                    </button>
                    {hasChildren ? (
                        <button
                            type="button"
                            aria-label={((isExpanded ? productText.collapseCategory : productText.expandCategory) || (isExpanded ? 'Collapse' : 'Expand')) + ' ' + node.name}
                            aria-expanded={isExpanded}
                            className="shrink-0 rounded-sm p-1 text-[18px] leading-none text-[var(--text-secondary)] transition-transform duration-200"
                            onClick={() => toggleExpanded(node, siblings)}
                        >
                            <span aria-hidden="true" className={'block transition-transform' + (isExpanded ? ' rotate-90' : '')}>
                                ›
                            </span>
                        </button>
                    ) : null}
                </div>
                {hasChildren && isExpanded ? (
                    <div className="mt-1 space-y-3">
                        {node.children.map((child) => renderCategoryNode(child, depth + 1, node.children))}
                    </div>
                ) : null}
            </React.Fragment>
        )
    }

    const applyFilters = (event: React.SyntheticEvent<HTMLElement>) => {
        const trimmedSearch = draftSearch.trim()

        onApplyFilters((params) => {
            Array.from(params.keys())
                .filter((key) => key.startsWith('attr_'))
                .forEach((key) => params.delete(key))
            params.delete('page')
            params.delete('search')
            params.delete('categoryId')
            params.delete('minPrice')
            params.delete('maxPrice')

            if (trimmedSearch) params.set('search', trimmedSearch)
            draftCategoryIds.forEach((categoryId) => params.append('categoryId', categoryId))
            if (rangeValues.min > minBound) params.set('minPrice', String(rangeValues.min))
            if (rangeValues.max < maxBound) params.set('maxPrice', String(rangeValues.max))
            Object.entries(draftAttributeFilters).forEach(([key, values]) => {
                values.forEach((value) => params.append('attr_' + key, value))
            })
        }, event)
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <button
                type="button"
                className="flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
                onClick={() => setOpen(true)}
            >
                <SlidersHorizontal className="h-[14px] w-[14px]" />
                <span>{filterButtonLabel}</span>
            </button>

            <DialogPortal>
                <DialogOverlay className="z-50 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" style={OVERLAY_STYLE} />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[24px] px-5 pb-6 pt-2 shadow-[0_-8px_12px_rgba(0,0,0,0.15)] outline-none duration-200 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-full"
                    style={{
                        backgroundColor: 'var(--surface-primary)',
                        borderTop: '1px solid var(--divider)',
                    }}
                >
                    <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ backgroundColor: 'var(--divider)' }} />

                    <div className="mb-5 flex items-center justify-between gap-4">
                        <DialogTitle className="text-[18px] font-extrabold text-[var(--text-primary)]">{sections.title}</DialogTitle>
                        <DialogClose asChild>
                            <button
                                type="button"
                                aria-label={productText.closeFilters || 'Close filters'}
                                className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-[rgba(var(--brand-primary-rgb),0.08)]"
                                style={{ backgroundColor: 'var(--surface-secondary)' }}
                            >
                                <X className="h-[14px] w-[14px] text-[var(--text-secondary)]" />
                            </button>
                        </DialogClose>
                    </div>

                    <div className="space-y-5">
                        <section className="space-y-2.5">
                            <h4 className="text-[13px] font-bold text-[var(--text-secondary)]">{sections.search}</h4>
                            <div
                                className="flex items-center gap-2 rounded-[8px] border px-3 py-2.5"
                                style={{
                                    backgroundColor: 'var(--surface-secondary)',
                                    borderColor: 'var(--divider)',
                                }}
                            >
                                <Search className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                                <input
                                    type="search"
                                    value={draftSearch}
                                    onChange={(event) => setDraftSearch(event.target.value)}
                                    placeholder={searchPlaceholder}
                                    aria-label={searchPlaceholder}
                                    className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-[14px] text-[var(--text-primary)] shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 placeholder:text-[var(--text-secondary)] [&::-ms-clear]:hidden [&::-webkit-search-cancel-button]:hidden"
                                />
                                {draftSearch ? (
                                    <button
                                        type="button"
                                        aria-label={productText.clearSearch || 'Clear search'}
                                        className="shrink-0 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                        onClick={() => setDraftSearch('')}
                                    >
                                        <X className="h-[14px] w-[14px]" />
                                    </button>
                                ) : null}
                            </div>
                        </section>

                        {categoryTree.length > 0 ? (
                            <section className="space-y-3">
                                <h4 className="text-[13px] font-bold text-[var(--text-secondary)]">{sections.categories}</h4>
                                <div
                                    className="max-h-[260px] space-y-3 overflow-y-auto pr-2 [scrollbar-color:rgba(var(--brand-primary-rgb),0.35)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(var(--brand-primary-rgb),0.28)] [&::-webkit-scrollbar-thumb:hover]:bg-[rgba(var(--brand-primary-rgb),0.42)]"
                                >
                                    {categoryTree.map((category) => renderCategoryNode(category, 0, categoryTree))}
                                </div>
                            </section>
                        ) : null}

                        {bounds.attributes.map((attribute) => (
                            <section key={attribute.key} className="space-y-3">
                                <h4 className="text-[13px] font-bold text-[var(--text-secondary)]">{formatAttributeLabel(attribute.key)}</h4>
                                <div className="space-y-3">
                                    {attribute.values.map((value) => {
                                        const isChecked = (draftAttributeFilters[attribute.key] ?? []).includes(value)

                                        return (
                                            <label key={value} className="flex items-center gap-2.5">
                                                <Checkbox
                                                    checked={isChecked}
                                                    onCheckedChange={() => toggleAttributeValue(attribute.key, value)}
                                                    aria-label={value}
                                                    className="h-5 w-5 rounded-[5px] border-[hsl(var(--input-border))] border-solid data-[state=checked]:bg-[var(--brand-primary)] data-[state=checked]:border-[var(--brand-primary)] [&_svg]:h-3 [&_svg]:w-3"
                                                />
                                                <span className="min-w-0 flex-1 text-[14px] font-medium text-[var(--text-primary)]">{value}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </section>
                        ))}

                        {maxBound > minBound ? (
                            <section className="space-y-3">
                                <div className="flex items-center justify-between gap-4 text-[13px] font-bold">
                                    <h4 className="text-[var(--text-secondary)]">{sections.price}</h4>
                                    <p style={{ color: primaryColor }}>{pricePrefix}{rangeValues.min} - {pricePrefix}{rangeValues.max}</p>
                                </div>
                                <div className="relative h-6">
                                    <div
                                        className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
                                        style={{
                                            background: 'linear-gradient(to right, var(--divider) 0%, var(--divider) ' + minPercent + '%, ' + primaryColor + ' ' + minPercent + '%, ' + primaryColor + ' ' + maxPercent + '%, var(--divider) ' + maxPercent + '%, var(--divider) 100%)',
                                        }}
                                    />
                                    <input
                                        type="range"
                                        min={minBound}
                                        max={maxBound}
                                        value={rangeValues.min}
                                        aria-label="Mobile minimum price"
                                        onChange={(event) => {
                                            const nextMin = Math.min(Number(event.target.value), rangeValues.max)
                                            setRangeValues((current) => ({ ...current, min: nextMin }))
                                        }}
                                        className="pointer-events-none absolute left-0 top-1/2 h-6 w-full -translate-y-1/2 appearance-none border-0 bg-transparent outline-none [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-8px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--slider-thumb)] [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(15,23,42,0.08)] [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--slider-thumb)]"
                                        style={{ ['--slider-thumb' as string]: primaryColor }}
                                    />
                                    <input
                                        type="range"
                                        min={minBound}
                                        max={maxBound}
                                        value={rangeValues.max}
                                        aria-label="Mobile maximum price"
                                        onChange={(event) => {
                                            const nextMax = Math.max(Number(event.target.value), rangeValues.min)
                                            setRangeValues((current) => ({ ...current, max: nextMax }))
                                        }}
                                        className="pointer-events-none absolute left-0 top-1/2 h-6 w-full -translate-y-1/2 appearance-none border-0 bg-transparent outline-none [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-8px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--slider-thumb)] [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(15,23,42,0.08)] [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--slider-thumb)]"
                                        style={{ ['--slider-thumb' as string]: primaryColor }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-[12px] font-medium text-[var(--text-secondary)]">
                                    <span>{pricePrefix}{minBound}</span>
                                    <span>{pricePrefix}{maxBound}</span>
                                </div>
                            </section>
                        ) : null}

                        <button
                            type="button"
                            className="flex w-full items-center justify-center rounded-[10px] px-4 py-[14px] text-[15px] font-bold text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: primaryColor }}
                            onClick={(event) => applyFilters(event)}
                        >
                            {saveButtonLabel}
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPortal>
        </Dialog>
    )
}
