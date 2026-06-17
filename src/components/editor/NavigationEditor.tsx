'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Plus, Layers } from 'lucide-react'
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
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useI18n } from '@/i18n'
import type { NavLinkItem, DropTarget } from './navigation-editor-types'

// Inline 2-level-guard confirmation shown at the top of the editor panel.
type FlattenAsk = {
    activeId: string
    targetId: string
    activeName: string
    count: number
    targetName: string
} | null
import {
    generateId,
    updateLinkInTree,
    deleteLinkInTree,
    addChildInTree,
    findLinkAndParent,
    moveItemInArray,
    indentLinkInTree,
    outdentLinkInTree,
    nestAsChild,
    nestWithFlatten,
    moveAsSibling,
} from './navigation-tree-helpers'
import { NavLinkRow, C } from './navigation-link-row'

// Re-export so SettingsPanel can still do: import { NavigationEditor, type NavLinkItem }
export type { NavLinkItem }

const SYSTEM_PAGE_SLUGS = new Set(['404', '/404'])

interface NavigationEditorProps {
    links: NavLinkItem[]
    onUpdate: (links: NavLinkItem[]) => void
    pages?: { id: string; title: string; slug: string }[]
}

export function NavigationEditor({ links, onUpdate, pages }: NavigationEditorProps) {
    const { t } = useI18n()
    const nav = t.editor.navigation

    const [openPanelId, setOpenPanelId] = useState<string | null>(null)
    const [editingNameId, setEditingNameId] = useState<string | null>(null)
    const [dropTarget, setDropTarget] = useState<DropTarget>(null)
    const [flattenAsk, setFlattenAsk] = useState<FlattenAsk>(null)

    // 2-level guard: instead of a big modal, surface a compact inline confirm
    // box at the top of the editor panel.
    const notifyFlatten = useCallback(
        (activeId: string, targetId: string, activeName: string, count: number, targetName: string) => {
            setFlattenAsk({ activeId, targetId, activeName, count, targetName })
        },
        [],
    )

    const handleFlattenConfirm = useCallback(() => {
        if (!flattenAsk) return
        // The confirm box is inline (not a blocking modal) — the tree behind it
        // stays editable. If the user deleted/moved active or target before
        // confirming, nestWithFlatten would pluck active but fail to re-attach it
        // (target gone) → subtree lost. Bail out unless both still exist.
        const activeStillThere = findLinkAndParent(links, flattenAsk.activeId)
        const targetStillThere = findLinkAndParent(links, flattenAsk.targetId)
        if (activeStillThere && targetStillThere) {
            onUpdate(nestWithFlatten(links, flattenAsk.activeId, flattenAsk.targetId))
        }
        setFlattenAsk(null)
    }, [flattenAsk, links, onUpdate])

    // Click outside the builder → close any open config panel + name editor.
    // Fixes "panel stays stuck open and can't be dismissed".
    const rootRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!openPanelId && !editingNameId) return
        const handler = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null
            // Toasts (sonner) render outside rootRef — clicking one must not
            // close the panel the user is still editing.
            if (target?.closest('[data-sonner-toaster]')) return
            if (rootRef.current && !rootRef.current.contains(target as Node)) {
                setOpenPanelId(null)
                setEditingNameId(null)
            }
        }
        document.addEventListener('pointerdown', handler)
        return () => document.removeEventListener('pointerdown', handler)
    }, [openPanelId, editingNameId])

    const linkablePages = useMemo(
        () => pages?.filter(p => !SYSTEM_PAGE_SLUGS.has(p.slug)),
        [pages],
    )

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    // ── DnD: visual hover feedback ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleDragOver = useCallback((event: any) => {
        const active = event.active as { id: string | number }
        const over = event.over as { id: string | number } | null
        if (!over || active.id === over.id) { setDropTarget(null); return }
        const overFound = findLinkAndParent(links, String(over.id))
        const activeFound = findLinkAndParent(links, String(active.id))
        if (!overFound || !activeFound) { setDropTarget(null); return }
        // "child" intent: root item hovering a root item that already has children
        if (activeFound.parentId === null && overFound.parentId === null && overFound.link.children.length > 0) {
            setDropTarget({ id: String(over.id), mode: 'child' })
        } else {
            setDropTarget({ id: String(over.id), mode: 'sibling' })
        }
    }, [links])

    // ── DnD: apply drop ───────────────────────────────────────────────────────
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setDropTarget(null)
        const { active, over } = event
        if (!over || active.id === over.id) return

        const activeFound = findLinkAndParent(links, String(active.id))
        const overFound = findLinkAndParent(links, String(over.id))
        if (!activeFound || !overFound) return

        const activeId = String(active.id)
        const overId = String(over.id)
        const activeIsRoot = activeFound.parentId === null
        const overIsRoot = overFound.parentId === null

        // Can't drop an item into its own subtree — would orphan + lose it
        // (nestWithFlatten/moveAsSibling target id no longer exists after pluck).
        // Max depth is 2, so the only descendant of `active` is a direct child.
        if (overFound.parentId === activeId) return

        // Root dropped ONTO a root-with-children → NEST as its child.
        // Mirrors the 'child' drop highlight in handleDragOver; must run BEFORE
        // the same-parent reorder branch (both are root → parentId null → equal),
        // otherwise the nest intent silently degrades to a reorder.
        if (activeIsRoot && overIsRoot && overFound.link.children.length > 0) {
            // Depth guard: active with children would create level-3 → flatten confirm.
            if (activeFound.link.children.length > 0) {
                notifyFlatten(
                    activeId,
                    overId,
                    activeFound.link.label || 'Untitled',
                    activeFound.link.children.length,
                    overFound.link.label || 'Untitled',
                )
                return
            }
            onUpdate(nestAsChild(links, activeId, overId))
            return
        }

        // Same parent → simple reorder
        if (activeFound.parentId === overFound.parentId) {
            const reordered = moveItemInArray(activeFound.siblings, activeFound.index, overFound.index)
            if (activeFound.parentId === null) {
                onUpdate(reordered)
            } else {
                const rebuild = (items: NavLinkItem[]): NavLinkItem[] =>
                    items.map(item => {
                        if (item.id === activeFound.parentId) return { ...item, children: reordered }
                        if (item.children.length) return { ...item, children: rebuild(item.children) }
                        return item
                    })
                onUpdate(rebuild(links))
            }
            return
        }

        // Child → root: promote
        if (!activeIsRoot && overIsRoot) {
            onUpdate(moveAsSibling(links, activeId, overId, 'after'))
            return
        }

        // Root → child-wrap: nest (with flatten confirm if active has children)
        if (activeIsRoot && !overIsRoot) {
            const overParentId = overFound.parentId!
            if (activeFound.link.children.length > 0) {
                const overParentFound = findLinkAndParent(links, overParentId)
                notifyFlatten(
                    activeId,
                    overParentId,
                    activeFound.link.label || 'Untitled',
                    activeFound.link.children.length,
                    overParentFound?.link.label || 'Untitled',
                )
                return
            }
            onUpdate(moveAsSibling(links, activeId, overId, 'after'))
            return
        }

        onUpdate(moveAsSibling(links, activeId, overId, 'after'))
    }, [links, onUpdate, notifyFlatten])

    // ── Tree mutations ────────────────────────────────────────────────────────

    const handleUpdate = useCallback(
        (id: string, changes: Partial<NavLinkItem>) =>
            onUpdate(updateLinkInTree(links, id, changes)),
        [links, onUpdate],
    )

    const handleDelete = useCallback(
        (id: string) => {
            if (openPanelId === id) setOpenPanelId(null)
            onUpdate(deleteLinkInTree(links, id))
        },
        [links, onUpdate, openPanelId],
    )

    const handleAddChild = useCallback(
        (parentId: string) => {
            const newItem: NavLinkItem = { id: generateId(), label: '', url: '#', type: 'page', children: [] }
            onUpdate(addChildInTree(links, parentId, newItem))
            setOpenPanelId(newItem.id)
            setEditingNameId(newItem.id)
        },
        [links, onUpdate],
    )

    const handleMoveUp = useCallback(
        (id: string) => {
            const found = findLinkAndParent(links, id)
            if (!found || found.index === 0) return
            const moved = moveItemInArray(found.siblings, found.index, found.index - 1)
            if (found.parentId === null) {
                onUpdate(moved)
            } else {
                const rebuild = (items: NavLinkItem[]): NavLinkItem[] =>
                    items.map(item => {
                        if (item.id === found.parentId) return { ...item, children: moved }
                        if (item.children.length) return { ...item, children: rebuild(item.children) }
                        return item
                    })
                onUpdate(rebuild(links))
            }
        },
        [links, onUpdate],
    )

    const handleMoveDown = useCallback(
        (id: string) => {
            const found = findLinkAndParent(links, id)
            if (!found || found.index >= found.siblings.length - 1) return
            const moved = moveItemInArray(found.siblings, found.index, found.index + 1)
            if (found.parentId === null) {
                onUpdate(moved)
            } else {
                const rebuild = (items: NavLinkItem[]): NavLinkItem[] =>
                    items.map(item => {
                        if (item.id === found.parentId) return { ...item, children: moved }
                        if (item.children.length) return { ...item, children: rebuild(item.children) }
                        return item
                    })
                onUpdate(rebuild(links))
            }
        },
        [links, onUpdate],
    )

    const handleIndent = useCallback(
        (id: string) => {
            const found = findLinkAndParent(links, id)
            if (!found || found.index === 0) return
            const newParent = found.siblings[found.index - 1]
            if (found.link.children.length > 0) {
                notifyFlatten(
                    id,
                    newParent.id,
                    found.link.label || 'Untitled',
                    found.link.children.length,
                    newParent.label || 'Untitled',
                )
                return
            }
            onUpdate(indentLinkInTree(links, id))
        },
        [links, onUpdate, notifyFlatten],
    )

    const handleOutdent = useCallback(
        (id: string) => {
            const result = outdentLinkInTree(links, id)
            if (result) onUpdate(result)
        },
        [links, onUpdate],
    )

    const handleAddRoot = useCallback(() => {
        const newItem: NavLinkItem = { id: generateId(), label: '', url: '#', type: 'page', children: [] }
        onUpdate([...links, newItem])
        setOpenPanelId(newItem.id)
        setEditingNameId(newItem.id)
    }, [links, onUpdate])

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                {/* No background / no horizontal padding → rows align flush with the
                    "Navigation Links" section label (SettingsPanel provides the panel chrome). */}
                <div ref={rootRef}>
                    {/* 2-level guard — compact inline confirm at top of the panel */}
                    {flattenAsk && (
                        <div style={{
                            marginBottom: 10, padding: 10, borderRadius: 8,
                            border: '1px solid rgba(245,185,69,0.45)', background: 'rgba(245,185,69,0.10)',
                            display: 'flex', gap: 8, alignItems: 'flex-start',
                        }}>
                            <Layers size={15} color={C.warning} style={{ flexShrink: 0, marginTop: 1 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                                    {nav.flattenTitle}
                                </div>
                                <div style={{ fontSize: 11, color: C.text2, lineHeight: 1.5, marginBottom: 8 }}>
                                    {nav.flattenBody
                                        .replace('{name}', flattenAsk.activeName)
                                        .replace(/\{count\}/g, String(flattenAsk.count))
                                        .replace(/\{target\}/g, flattenAsk.targetName)}
                                </div>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                    <button
                                        type="button"
                                        onClick={() => setFlattenAsk(null)}
                                        style={{
                                            padding: '4px 10px', borderRadius: 6, fontSize: 11,
                                            border: `1px solid ${C.borderStrong}`, background: 'transparent',
                                            color: C.text2, cursor: 'pointer',
                                        }}
                                    >
                                        {nav.flattenCancel}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleFlattenConfirm}
                                        style={{
                                            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                                            border: `1px solid ${C.info}`, background: C.info,
                                            color: '#fff', cursor: 'pointer',
                                        }}
                                    >
                                        {nav.flattenConfirm}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {links.length === 0 ? (
                        <p style={{ textAlign: 'center', fontSize: 12, color: C.text3, padding: '16px 0' }}>
                            {nav.noLinks}
                        </p>
                    ) : (
                        <SortableContext items={links.map(l => l.id)} strategy={verticalListSortingStrategy}>
                            {links.map((link, idx) => (
                                <NavLinkRow
                                    key={link.id}
                                    link={link}
                                    depth={0}
                                    isFirst={idx === 0}
                                    isLast={idx === links.length - 1}
                                    siblingCount={links.length}
                                    openPanelId={openPanelId}
                                    editingNameId={editingNameId}
                                    dropTarget={dropTarget}
                                    pages={linkablePages}
                                    onUpdate={handleUpdate}
                                    onDelete={handleDelete}
                                    onAddChild={handleAddChild}
                                    onMoveUp={handleMoveUp}
                                    onMoveDown={handleMoveDown}
                                    onIndent={handleIndent}
                                    onOutdent={handleOutdent}
                                    onSetOpenPanelId={setOpenPanelId}
                                    onSetEditingNameId={setEditingNameId}
                                />
                            ))}
                        </SortableContext>
                    )}

                    {/* "+ Add link" primary button (.add-btn.primary) */}
                    <button
                        type="button"
                        onClick={handleAddRoot}
                        style={{
                            width: '100%', marginTop: 14, padding: 9, borderRadius: 8,
                            border: `1px solid ${C.info}`,
                            background: C.infoBg, color: C.info,
                            fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            transition: 'background 0.12s, border-color 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.20)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = C.infoBg }}
                    >
                        <Plus size={14} />
                        {nav.addLink.replace(/^\+\s*/, '')}
                    </button>
                </div>
        </DndContext>
    )
}
