'use client'

import type React from 'react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { SidebarCategory } from '../filter-types'
import { FILTER_CARD_CLASS_NAME, FILTER_CARD_STYLE } from './card-style'

interface CategoryTreeProps {
    categories: SidebarCategory[]
    activeCategoryIds: string[]
    onUpdateFilter: (params: URLSearchParams, event?: React.SyntheticEvent<HTMLElement>) => void
    primaryColor: string
    searchParams: string
    title: string
}

interface CategoryNode extends SidebarCategory {
    children: CategoryNode[]
}

const CATEGORY_INDENT_STEP = 4
const CATEGORY_ROW_BORDER = '1px solid rgba(var(--brand-primary-rgb), 0.16)'

function buildTree(categories: SidebarCategory[]): CategoryNode[] {
    const nodes = new Map<string, CategoryNode>()

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

    const sortNodes = (items: CategoryNode[]) => {
        items.sort((left, right) => left.name.localeCompare(right.name))
        items.forEach((item) => sortNodes(item.children))
    }

    const roots = Array.from(nodes.values()).filter((node) => !node.parent)
    sortNodes(roots)
    return roots
}

export function CategoryTree({ categories, activeCategoryIds, onUpdateFilter, primaryColor, searchParams, title }: CategoryTreeProps) {
    const tree = useMemo(() => buildTree(categories), [categories])
    const activeCategorySet = useMemo(() => new Set(activeCategoryIds), [activeCategoryIds])

    const handleClick = (categoryId: string, event: React.MouseEvent<HTMLButtonElement>) => {
        const params = new URLSearchParams(searchParams)
        const currentIds = Array.from(new Set(
            params.getAll('categoryId').map((value) => value.trim()).filter(Boolean),
        ))
        const nextIds = currentIds.includes(categoryId)
            ? currentIds.filter((id) => id !== categoryId)
            : [...currentIds, categoryId]

        params.delete('categoryId')
        nextIds.forEach((id) => params.append('categoryId', id))
        onUpdateFilter(params, event)
    }

    const isActiveBranch = (node: CategoryNode): boolean => (
        activeCategorySet.has(node.id) || node.children.some((child) => isActiveBranch(child))
    )

    const defaultExpandedIds = useMemo(() => {
        const expanded = new Set<string>()

        const visit = (node: CategoryNode): boolean => {
            if (node.children.length === 0) return activeCategorySet.has(node.id)
            const containsActive = activeCategorySet.has(node.id) || node.children.some((child) => visit(child))
            if (containsActive) expanded.add(node.id)
            return containsActive
        }

        tree.forEach((node) => {
            visit(node)
        })

        return expanded
    }, [activeCategorySet, tree])

    const [expandedIds, setExpandedIds] = useState<Set<string>>(defaultExpandedIds)

    useEffect(() => {
        setExpandedIds((current) => {
            const next = new Set(current)
            defaultExpandedIds.forEach((id) => next.add(id))
            return next
        })
    }, [defaultExpandedIds])

    const toggleNode = (nodeId: string) => {
        setExpandedIds((current) => {
            const next = new Set(current)
            if (next.has(nodeId)) next.delete(nodeId)
            else next.add(nodeId)
            return next
        })
    }

    const renderNode = (node: CategoryNode, depth: number) => {
        const isActive = activeCategorySet.has(node.id)
        const activeBranch = isActiveBranch(node)
        const hasChildren = node.children.length > 0
        const isExpanded = hasChildren && expandedIds.has(node.id)

        return (
            <Fragment key={node.id}>
                <li>
                    <div
                        className="group flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors duration-200 hover:bg-[rgba(var(--brand-primary-rgb),0.08)]"
                        style={{
                            paddingLeft: `${depth * CATEGORY_INDENT_STEP + 12}px`,
                            borderTop: CATEGORY_ROW_BORDER,
                        }}
                    >
                        <button
                            type="button"
                            aria-pressed={isActive}
                            className="min-w-0 flex-1 text-left transition-colors duration-200 group-hover:text-[var(--hover-color)]"
                            style={{
                                color: isActive ? primaryColor : 'var(--text-primary)',
                                fontWeight: depth === 0 || activeBranch ? 700 : 600,
                                opacity: depth === 0 ? 1 : 0.88,
                                ['--hover-color' as string]: primaryColor,
                            }}
                            title={node.breadcrumbs ?? node.name}
                            onClick={(event) => handleClick(node.id, event)}
                        >
                            <span className="block truncate text-[15px] leading-6">{node.name}</span>
                        </button>

                        {hasChildren ? (
                            <button
                                type="button"
                                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
                                aria-expanded={isExpanded}
                                className="shrink-0 rounded-sm p-1 text-[18px] leading-none transition-all duration-200 group-hover:text-[var(--hover-color)]"
                                style={{ color: isActive ? primaryColor : 'var(--text-secondary)', ['--hover-color' as string]: primaryColor }}
                                onClick={() => toggleNode(node.id)}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`block transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                >
                                    ›
                                </span>
                            </button>
                        ) : null}
                    </div>
                </li>

                {hasChildren && isExpanded && (
                    <li>
                        <ul
                            className="space-y-0"
                            style={{ marginLeft: `${depth * CATEGORY_INDENT_STEP + 4}px` }}
                        >
                            {node.children.map((child) => renderNode(child, depth + 1))}
                        </ul>
                    </li>
                )}
            </Fragment>
        )
    }

    return (
        <section className={FILTER_CARD_CLASS_NAME} style={FILTER_CARD_STYLE}>
            <div className="mb-5 flex items-center gap-4">
                <span className="flex items-center gap-1" aria-hidden="true">
                    <span className="h-[4px] w-6 rounded-full" style={{ backgroundColor: primaryColor }} />
                    <span className="h-[4px] w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                </span>
                <h4 className="text-[15px] font-extrabold tracking-[0.01em] text-[var(--text-primary)]">{title}</h4>
            </div>

            <ul className="space-y-0">
                {tree.map((node) => renderNode(node, 0))}
            </ul>
        </section>
    )
}
