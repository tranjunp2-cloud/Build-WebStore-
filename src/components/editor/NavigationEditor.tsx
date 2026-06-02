'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { Plus, Trash2, ChevronRight, ChevronDown, ExternalLink, FileText, GripVertical } from 'lucide-react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import { isValidExternalNavigationUrl } from '@/lib/navigation-url'

export type NavLinkItem = {
    id: string
    label: string
    url: string
    type: 'page' | 'external'
    children: NavLinkItem[]
}

interface NavigationEditorProps {
    links: NavLinkItem[]
    onUpdate: (links: NavLinkItem[]) => void
    pages?: { id: string; title: string; slug: string }[]
}

const LINK_TYPE_OPTIONS = [
    { value: 'page', icon: FileText },
    { value: 'external', icon: ExternalLink },
] as const

const SYSTEM_PAGE_SLUGS = new Set(['404', '/404'])

function generateId() {
    return `nav_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function normalizePageOptionUrl(slug: string) {
    if (!slug || slug === '/') return '/'
    return slug.startsWith('/') ? slug : `/${slug}`
}

function validateLinkLabel(value: string) {
    return value.trim().length > 0
}

function validateLinkUrl(link: NavLinkItem, value: string) {
    if (link.type === 'page') {
        return value.trim().length > 0 && value !== '#'
    }
    return value.trim().length > 0 && isValidExternalNavigationUrl(value.trim())
}

type NavTranslations = {
    internalPage: string
    externalUrl: string
    selectPage: string
    addSubLink: string
    moveUp: string
    moveDown: string
    moveLeft: string
    makeSubItem: string
    newLink: string
    title: string
    noLinks: string
    addLink: string
}

function NavLinkRow({
    link,
    depth,
    onUpdate,
    onDelete,
    onAddChild,
    onMoveUp,
    onMoveDown,
    onIndent,
    onOutdent,
    isFirst,
    isLast,
    pages,
    nav,
    openPanelId,
    onSetOpenPanelId,
}: {
    link: NavLinkItem
    depth: number
    onUpdate: (id: string, changes: Partial<NavLinkItem>) => void
    onDelete: (id: string) => void
    onAddChild: (parentId: string) => void
    onMoveUp: (id: string) => void
    onMoveDown: (id: string) => void
    onIndent: (id: string) => void
    onOutdent: (id: string) => void
    isFirst: boolean
    isLast: boolean
    pages?: { id: string; title: string; slug: string }[]
    nav: NavTranslations
    openPanelId: string | null
    onSetOpenPanelId: (id: string | null) => void
}) {
    const { t } = useI18n()
    const nv = t.editor.navigationValidation
    const [isExpanded, setIsExpanded] = useState(true)
    const [isRenaming, setIsRenaming] = useState(false)
    const isPanelOpen = openPanelId === link.id

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id })
    const dragStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
    const setIsPanelOpen = useCallback((val: boolean) => onSetOpenPanelId(val ? link.id : null), [link.id, onSetOpenPanelId])
    const hasChildren = (link.children || []).length > 0

    const linkTypeOptions = useMemo(() => [
        { value: 'page', label: nav.internalPage, icon: FileText },
        { value: 'external', label: nav.externalUrl, icon: ExternalLink },
    ], [nav])

    const typeIcon = linkTypeOptions.find(o => o.value === link.type)?.icon || ExternalLink
    const TypeIcon = typeIcon

    useEffect(() => {
        if (!isPanelOpen && isRenaming) {
            setIsRenaming(false)
        }
    }, [isPanelOpen, isRenaming])

    const handleLabelCommit = useCallback((rawValue: string) => {
        const value = rawValue.trim()
        if (!validateLinkLabel(value)) {
            toast.error(nv.labelRequired)
            return
        }

        onUpdate(link.id, { label: value })
    }, [link.id, onUpdate])

    const handleUrlCommit = useCallback((rawValue: string) => {
        const value = rawValue.trim()
        if (!validateLinkUrl(link, value)) {
            if (link.type === 'page') {
                toast.error(nv.selectPageError)
            } else if (!value) {
                toast.error(nv.urlRequired)
            } else {
                toast.error(nv.invalidUrl)
            }
            return
        }

        onUpdate(link.id, { url: value })
    }, [link, onUpdate])

    return (
        <div ref={setNodeRef} style={dragStyle} className="select-none">
            <div
                className={`group flex items-center gap-2 rounded px-2 hover:bg-white/[0.03] transition-colors ${depth === 0 ? 'h-9' : 'h-8'}`}
            >
                {/* Drag handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="shrink-0 cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-slate-300 transition-colors touch-none"
                    aria-label="Drag to reorder"
                >
                    <GripVertical className="w-3.5 h-3.5" />
                </div>

                {/* Expand/collapse chevron for parent items */}
                {hasChildren ? (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-0.5 text-slate-500 hover:text-slate-300">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                ) : null}

                {/* Label */}
                {isRenaming ? (
                    <input
                        autoFocus
                        defaultValue={link.label}
                        onBlur={(e) => {
                            handleLabelCommit(e.target.value)
                            setIsRenaming(false)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            if (e.key === 'Escape') setIsRenaming(false)
                        }}
                        className="flex-1 min-w-0 bg-white/10 px-1.5 py-0.5 rounded text-sm text-white border border-cyan-500/30 outline-none"
                    />
                ) : (
                    <span
                        className={`flex-1 min-w-0 truncate cursor-text ${depth === 0 ? 'text-sm text-slate-50' : 'text-xs text-slate-400'}`}
                        onDoubleClick={() => {
                            setIsPanelOpen(true)
                            setIsRenaming(true)
                        }}
                    >
                        {link.label}
                        {(!link.url || link.url === '#') && (
                            <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" title={nv.noDestination} />
                        )}
                    </span>
                )}

                {/* Edit button — always visible per Figma */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        setIsPanelOpen(!isPanelOpen)
                    }}
                    className="shrink-0 text-xs text-slate-500 hover:text-amber-400 transition-colors"
                >
                    ✏️
                </button>
            </div>

            {/* Expanded edit panel: URL + type + actions */}
            {isPanelOpen && (
                <div
                    className="px-3 pb-2.5 pt-1 space-y-2"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-1.5">
                        <div className="relative flex-1 min-w-0">
                            <TypeIcon className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-cyan-300" />
                            <select
                                value={link.type}
                                onChange={(e) => {
                                    const nextType = e.target.value as NavLinkItem['type']
                                    onUpdate(link.id, {
                                        type: nextType,
                                        url: nextType === 'page' ? (link.url.startsWith('/') ? link.url : '#') : (link.url === '#' ? '' : link.url),
                                    })
                                }}
                                className="h-7 w-full cursor-pointer appearance-none rounded-md border border-cyan-400/20 bg-slate-900/80 pl-6 pr-6 text-[11px] font-medium text-slate-200 transition-colors hover:border-cyan-300/40 focus:border-cyan-300 focus:outline-none"
                                aria-label={nv.linkType}
                            >
                                {linkTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-cyan-200/70" />
                        </div>
                    </div>
                    {link.type === 'page' && pages ? (
                        <div className="relative min-w-0">
                            <select
                                value={link.url}
                                onChange={(e) => {
                                    const value = e.target.value
                                    if (!validateLinkUrl(link, value)) {
                                        toast.error(nv.selectPageError)
                                        return
                                    }
                                    onUpdate(link.id, { url: value })
                                }}
                                className="h-7 w-full cursor-pointer appearance-none rounded-md border border-white/10 bg-white/[0.05] pl-2.5 pr-6 text-[11px] text-slate-200 transition-colors hover:border-white/20 focus:border-cyan-300 focus:outline-none"
                                aria-label={nv.pageDestination}
                            >
                                <option value="#">{nav.selectPage}</option>
                                {pages.map(p => <option key={p.id} value={normalizePageOptionUrl(p.slug)}>{p.title}</option>)}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                        </div>
                    ) : (
                        <input
                            defaultValue={link.url}
                            placeholder={nv.urlPlaceholder}
                            onBlur={(e) => handleUrlCommit(e.target.value)}
                            className="h-7 w-full min-w-0 rounded-md border border-white/10 bg-white/[0.05] px-2.5 text-[11px] text-slate-200 outline-none transition-colors placeholder:text-slate-500 hover:border-white/20 focus:border-cyan-300"
                        />
                    )}
                    <div className="flex items-center gap-0.5 pt-0.5">
                        {depth < 1 && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); onAddChild(link.id) }} title={nav.addSubLink} className="p-1 text-slate-500 hover:text-cyan-400 rounded transition-colors">
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {!isFirst && <button type="button" onClick={() => onMoveUp(link.id)} title={nav.moveUp} className="p-1 text-slate-500 hover:text-slate-200 rounded text-[11px] transition-colors">↑</button>}
                        {!isLast && <button type="button" onClick={() => onMoveDown(link.id)} title={nav.moveDown} className="p-1 text-slate-500 hover:text-slate-200 rounded text-[11px] transition-colors">↓</button>}
                        {depth > 0 && <button type="button" onClick={() => onOutdent(link.id)} title={nav.moveLeft} className="p-1 text-slate-500 hover:text-slate-200 rounded text-[11px] transition-colors">←</button>}
                        {depth < 1 && !isFirst && <button type="button" onClick={() => onIndent(link.id)} title={nav.makeSubItem} className="p-1 text-slate-500 hover:text-slate-200 rounded text-[11px] transition-colors">→</button>}
                        <div className="flex-1" />
                        <button type="button" onClick={() => onDelete(link.id)} className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Children with tree connector (left border) per Figma */}
            {isExpanded && hasChildren && (
                <div className="ml-6 border-l-2 border-blue-500/[0.04] pl-2.5">
                    <SortableContext items={link.children.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        {link.children.map((child, idx) => (
                            <NavLinkRow
                                key={child.id}
                                link={child}
                                depth={depth + 1}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onAddChild={onAddChild}
                                onMoveUp={onMoveUp}
                                onMoveDown={onMoveDown}
                                onIndent={onIndent}
                                onOutdent={onOutdent}
                                isFirst={idx === 0}
                                isLast={idx === link.children.length - 1}
                                pages={pages}
                                nav={nav}
                                openPanelId={openPanelId}
                                onSetOpenPanelId={onSetOpenPanelId}
                            />
                        ))}
                    </SortableContext>
                </div>
            )}
        </div>
    )
}

// Deep tree helpers
function updateLinkInTree(links: NavLinkItem[], id: string, changes: Partial<NavLinkItem>): NavLinkItem[] {
    if (!links) return []
    return links.map(link => {
        if (link.id === id) return { ...link, ...changes }
        if (link.children && link.children.length > 0) return { ...link, children: updateLinkInTree(link.children, id, changes) }
        return link
    })
}

function deleteLinkInTree(links: NavLinkItem[], id: string): NavLinkItem[] {
    if (!links) return []
    return links
        .filter(link => link.id !== id)
        .map(link => ({ ...link, children: deleteLinkInTree(link.children || [], id) }))
}

function addChildInTree(links: NavLinkItem[], parentId: string, newLinkLabel: string): NavLinkItem[] {
    if (!links) return []
    return links.map(link => {
        if (link.id === parentId) {
            return { ...link, children: [...(link.children || []), { id: generateId(), label: newLinkLabel, url: '#', type: 'page' as const, children: [] }] }
        }
        if (link.children && link.children.length > 0) return { ...link, children: addChildInTree(link.children, parentId, newLinkLabel) }
        return link
    })
}

function findLinkAndParent(links: NavLinkItem[], id: string, parentId: string | null = null): { link: NavLinkItem; siblings: NavLinkItem[]; index: number, parentId: string | null } | null {
    for (let i = 0; i < links.length; i++) {
        if (links[i].id === id) return { link: links[i], siblings: links, index: i, parentId }
        if (links[i].children && links[i].children.length > 0) {
            const found = findLinkAndParent(links[i].children, id, links[i].id)
            if (found) return found
        }
    }
    return null
}

function moveItemInArray<T>(arr: T[], from: number, to: number): T[] {
    const next = [...arr]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
}

function indentLinkInTree(links: NavLinkItem[], id: string): NavLinkItem[] {
    if (!links) return []
    for (let i = 0; i < links.length; i++) {
        if (links[i].id === id && i > 0) {
            const target = links[i]
            const newLinks = links.filter((_, idx) => idx !== i)
            newLinks[i - 1] = { ...newLinks[i - 1], children: [...(newLinks[i - 1].children || []), target] }
            return newLinks
        }
        if (links[i].children && links[i].children.length > 0) {
            const result = indentLinkInTree(links[i].children, id)
            if (result !== links[i].children) {
                return links.map((l, idx) => idx === i ? { ...l, children: result } : l)
            }
        }
    }
    return links
}

function outdentLinkInTree(links: NavLinkItem[], id: string, parentArray: NavLinkItem[] | null = null, parentIndex: number = -1): NavLinkItem[] | null {
    if (!links) return null
    for (let i = 0; i < links.length; i++) {
        if (links[i].children && links[i].children.length > 0) {
            const childIdx = links[i].children.findIndex(c => c.id === id)
            if (childIdx !== -1) {
                const target = links[i].children[childIdx]
                const newChildren = links[i].children.filter((_, idx) => idx !== childIdx)
                const newLinks = [...links]
                newLinks[i] = { ...newLinks[i], children: newChildren }
                newLinks.splice(i + 1, 0, target)
                return newLinks
            }
            const result = outdentLinkInTree(links[i].children, id, links, i)
            if (result) {
                return links.map((l, idx) => idx === i ? { ...l, children: result } : l)
            }
        }
    }
    return null
}

export function NavigationEditor({ links, onUpdate, pages }: NavigationEditorProps) {
    const { t } = useI18n()
    const nav = t.editor.navigation
    const [openPanelId, setOpenPanelId] = useState<string | null>(null)
    const linkablePages = useMemo(
        () => pages?.filter(page => !SYSTEM_PAGE_SLUGS.has(page.slug)),
        [pages],
    )

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const activeFound = findLinkAndParent(links, String(active.id))
        const overFound = findLinkAndParent(links, String(over.id))
        if (!activeFound || !overFound) return
        // Only allow reorder within the same parent; cross-parent moves use indent/outdent buttons
        if (activeFound.parentId !== overFound.parentId) return

        const reordered = arrayMove(activeFound.siblings, activeFound.index, overFound.index)

        if (activeFound.parentId === null) {
            onUpdate(reordered)
        } else {
            const rebuild = (items: NavLinkItem[]): NavLinkItem[] =>
                items.map(item => {
                    if (item.id === activeFound.parentId) return { ...item, children: reordered }
                    if (item.children?.length) return { ...item, children: rebuild(item.children) }
                    return item
                })
            onUpdate(rebuild(links))
        }
    }, [links, onUpdate])

    const handleUpdate = useCallback((id: string, changes: Partial<NavLinkItem>) => {
        onUpdate(updateLinkInTree(links, id, changes))
    }, [links, onUpdate])

    const handleDelete = useCallback((id: string) => {
        onUpdate(deleteLinkInTree(links, id))
    }, [links, onUpdate])

    const handleAddChild = useCallback((parentId: string) => {
        onUpdate(addChildInTree(links, parentId, nav.newLink))
    }, [links, onUpdate, nav.newLink])

    const handleMoveUp = useCallback((id: string) => {
        const found = findLinkAndParent(links, id)
        if (!found || found.index === 0) return
        const movedSiblings = moveItemInArray(found.siblings, found.index, found.index - 1)
        
        if (found.parentId === null) {
            onUpdate(movedSiblings)
        } else {
            const rebuild = (items: NavLinkItem[]): NavLinkItem[] =>
                items.map(item => {
                    if (item.id === found.parentId) return { ...item, children: movedSiblings }
                    if (item.children && item.children.length > 0) return { ...item, children: rebuild(item.children) }
                    return item
                })
            onUpdate(rebuild(links))
        }
    }, [links, onUpdate])

    const handleMoveDown = useCallback((id: string) => {
        const found = findLinkAndParent(links, id)
        if (!found || found.index >= found.siblings.length - 1) return
        const movedSiblings = moveItemInArray(found.siblings, found.index, found.index + 1)
        
        if (found.parentId === null) {
            onUpdate(movedSiblings)
        } else {
            const rebuild = (items: NavLinkItem[]): NavLinkItem[] =>
                items.map(item => {
                    if (item.id === found.parentId) return { ...item, children: movedSiblings }
                    if (item.children && item.children.length > 0) return { ...item, children: rebuild(item.children) }
                    return item
                })
            onUpdate(rebuild(links))
        }
    }, [links, onUpdate])

    const handleIndent = useCallback((id: string) => {
        onUpdate(indentLinkInTree(links, id))
    }, [links, onUpdate])

    const handleOutdent = useCallback((id: string) => {
        const result = outdentLinkInTree(links, id)
        if (result) onUpdate(result)
    }, [links, onUpdate])

    const handleAddRoot = useCallback(() => {
        onUpdate([...links, { id: generateId(), label: nav.newLink, url: '#', type: 'page', children: [] }])
    }, [links, onUpdate, nav.newLink])

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="flex flex-col gap-2">
                <div className="rounded-xl border border-blue-500/[0.04] bg-slate-800/30 px-3 pt-3 pb-px">
                    {links.length === 0 ? (
                        <p className="px-2 py-4 text-center text-xs text-slate-600">{nav.noLinks}</p>
                    ) : (
                        <SortableContext items={links.map(l => l.id)} strategy={verticalListSortingStrategy}>
                            {links.map((link, idx) => (
                                <NavLinkRow
                                    key={link.id}
                                    link={link}
                                    depth={0}
                                    onUpdate={handleUpdate}
                                    onDelete={handleDelete}
                                    onAddChild={handleAddChild}
                                    onMoveUp={handleMoveUp}
                                    onMoveDown={handleMoveDown}
                                    onIndent={handleIndent}
                                    onOutdent={handleOutdent}
                                    isFirst={idx === 0}
                                    isLast={idx === links.length - 1}
                                    pages={linkablePages}
                                    nav={nav}
                                    openPanelId={openPanelId}
                                    onSetOpenPanelId={setOpenPanelId}
                                />
                            ))}
                        </SortableContext>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleAddRoot}
                    className="w-full h-9 rounded-[10px] border border-blue-500/[0.07] text-sm font-medium text-slate-50 hover:bg-white/[0.03] transition-colors"
                >
                    {nav.addLink}
                </button>
            </div>
        </DndContext>
    )
}
