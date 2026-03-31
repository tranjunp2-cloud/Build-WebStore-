'use client'

import React, { useState, useCallback } from 'react'
import { GripVertical, Plus, Trash2, ChevronRight, ChevronDown, ExternalLink, FileText, Mail, Phone } from 'lucide-react'

export type NavLinkItem = {
    id: string
    label: string
    url: string
    type: 'page' | 'external' | 'email' | 'phone'
    children: NavLinkItem[]
}

interface NavigationEditorProps {
    links: NavLinkItem[]
    onUpdate: (links: NavLinkItem[]) => void
    pages?: { id: string; title: string; slug: string }[]
}

const LINK_TYPE_OPTIONS = [
    { value: 'page', label: 'Internal Page', icon: FileText },
    { value: 'external', label: 'External URL', icon: ExternalLink },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'phone', label: 'Phone', icon: Phone },
] as const

function generateId() {
    return `nav_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
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
}) {
    const [isExpanded, setIsExpanded] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const hasChildren = (link.children || []).length > 0

    const typeIcon = LINK_TYPE_OPTIONS.find(o => o.value === link.type)?.icon || ExternalLink
    const TypeIcon = typeIcon

    return (
        <div className="select-none">
            <div
                className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
                style={{ paddingLeft: `${depth * 20 + 8}px` }}
            >
                {/* Space for drag handle (hidden for now) */}
                <div className="w-3.5 shrink-0" />

                {/* Expand/collapse for parent items */}
                {hasChildren ? (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-0.5 -ml-1 text-gray-500 hover:text-gray-300">
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                ) : (
                    <span className="w-4" />
                )}

                {/* Type icon */}
                <TypeIcon className="w-3.5 h-3.5 text-gray-500 shrink-0" />

                {/* Label */}
                {isEditing ? (
                    <input
                        autoFocus
                        defaultValue={link.label}
                        onBlur={(e) => { onUpdate(link.id, { label: e.target.value }); setIsEditing(false) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        className="flex-1 min-w-0 bg-white/10 px-1.5 py-0.5 rounded text-xs text-white border border-cyan-500/30 outline-none"
                    />
                ) : (
                    <span
                        className="flex-1 min-w-0 truncate text-xs text-gray-300 cursor-text"
                        onDoubleClick={() => setIsEditing(true)}
                    >
                        {link.label}
                    </span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {depth < 2 && (
                        <button onClick={(e) => { e.stopPropagation(); onAddChild(link.id) }} title="Add sub-link" className="p-1 text-gray-500 hover:text-cyan-400 rounded">
                            <Plus className="w-3 h-3" />
                        </button>
                    )}
                    {!isFirst && (
                        <button onClick={(e) => { e.stopPropagation(); onMoveUp(link.id) }} title="Move up" className="p-1 text-gray-500 hover:text-gray-300 rounded text-[10px]">↑</button>
                    )}
                    {!isLast && (
                        <button onClick={(e) => { e.stopPropagation(); onMoveDown(link.id) }} title="Move down" className="p-1 text-gray-500 hover:text-gray-300 rounded text-[10px]">↓</button>
                    )}
                    {depth > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); onOutdent(link.id) }} title="Move left" className="p-1 text-gray-500 hover:text-gray-300 rounded text-[10px]">←</button>
                    )}
                    {depth < 2 && !isFirst && (
                        <button onClick={(e) => { e.stopPropagation(); onIndent(link.id) }} title="Make sub-item" className="p-1 text-gray-500 hover:text-gray-300 rounded text-[10px]">→</button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onDelete(link.id) }} className="p-1 text-gray-500 hover:text-red-400 rounded">
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* URL editor (inline below) */}
            {isEditing && (
                <div className="flex items-center gap-1.5 px-2 pb-1.5" style={{ paddingLeft: `${depth * 20 + 36}px` }}>
                    <select
                        value={link.type}
                        onChange={(e) => onUpdate(link.id, { type: e.target.value as NavLinkItem['type'] })}
                        className="h-6 text-[10px] bg-white/5 border border-white/10 rounded px-1 text-gray-400 outline-none"
                    >
                        {LINK_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    {link.type === 'page' && pages ? (
                        <select
                            value={link.url}
                            onChange={(e) => onUpdate(link.id, { url: e.target.value })}
                            className="flex-1 h-6 text-[10px] bg-white/5 border border-white/10 rounded px-1 text-gray-300 outline-none"
                        >
                            <option value="#">Select page</option>
                            {pages.map(p => <option key={p.id} value={`/${p.slug}`}>{p.title}</option>)}
                        </select>
                    ) : (
                        <input
                            defaultValue={link.url}
                            placeholder={link.type === 'email' ? 'mailto:...' : link.type === 'phone' ? 'tel:...' : 'https://...'}
                            onBlur={(e) => onUpdate(link.id, { url: e.target.value })}
                            className="flex-1 h-6 text-[10px] bg-white/5 border border-white/10 rounded px-1.5 text-gray-300 outline-none"
                        />
                    )}
                </div>
            )}

            {/* Children */}
            {isExpanded && hasChildren && (
                <div>
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
                        />
                    ))}
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

function addChildInTree(links: NavLinkItem[], parentId: string): NavLinkItem[] {
    if (!links) return []
    return links.map(link => {
        if (link.id === parentId) {
            return { ...link, children: [...(link.children || []), { id: generateId(), label: 'New Link', url: '#', type: 'external' as const, children: [] }] }
        }
        if (link.children && link.children.length > 0) return { ...link, children: addChildInTree(link.children, parentId) }
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
    const handleUpdate = useCallback((id: string, changes: Partial<NavLinkItem>) => {
        onUpdate(updateLinkInTree(links, id, changes))
    }, [links, onUpdate])

    const handleDelete = useCallback((id: string) => {
        onUpdate(deleteLinkInTree(links, id))
    }, [links, onUpdate])

    const handleAddChild = useCallback((parentId: string) => {
        onUpdate(addChildInTree(links, parentId))
    }, [links, onUpdate])

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
        onUpdate([...links, { id: generateId(), label: 'New Link', url: '#', type: 'external', children: [] }])
    }, [links, onUpdate])

    return (
        <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-gray-500">Navigation Links</label>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] py-1">
                {links.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-gray-600">No links yet. Add one below.</p>
                ) : (
                    links.map((link, idx) => (
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
                            pages={pages}
                        />
                    ))
                )}
            </div>
            <button
                onClick={handleAddRoot}
                className="w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
                + Add Link
            </button>
        </div>
    )
}
