import type { NavLinkItem } from './navigation-editor-types'

export function generateId(): string {
    return `nav_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ── Recursive read helpers ────────────────────────────────────────────────────

export function updateLinkInTree(
    links: NavLinkItem[],
    id: string,
    changes: Partial<NavLinkItem>,
): NavLinkItem[] {
    return links.map(link => {
        if (link.id === id) return { ...link, ...changes }
        if (link.children.length > 0)
            return { ...link, children: updateLinkInTree(link.children, id, changes) }
        return link
    })
}

export function deleteLinkInTree(links: NavLinkItem[], id: string): NavLinkItem[] {
    return links
        .filter(link => link.id !== id)
        .map(link => ({ ...link, children: deleteLinkInTree(link.children, id) }))
}

export function addChildInTree(
    links: NavLinkItem[],
    parentId: string,
    newItem: NavLinkItem,
): NavLinkItem[] {
    return links.map(link => {
        if (link.id === parentId)
            return { ...link, children: [...link.children, newItem] }
        if (link.children.length > 0)
            return { ...link, children: addChildInTree(link.children, parentId, newItem) }
        return link
    })
}

export type FindResult = {
    link: NavLinkItem
    siblings: NavLinkItem[]
    index: number
    parentId: string | null
}

export function findLinkAndParent(
    links: NavLinkItem[],
    id: string,
    parentId: string | null = null,
): FindResult | null {
    for (let i = 0; i < links.length; i++) {
        if (links[i].id === id)
            return { link: links[i], siblings: links, index: i, parentId }
        if (links[i].children.length > 0) {
            const found = findLinkAndParent(links[i].children, id, links[i].id)
            if (found) return found
        }
    }
    return null
}

export function moveItemInArray<T>(arr: T[], from: number, to: number): T[] {
    const next = [...arr]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
}

// ── Indent / outdent (same-parent) ───────────────────────────────────────────

export function indentLinkInTree(links: NavLinkItem[], id: string): NavLinkItem[] {
    for (let i = 0; i < links.length; i++) {
        if (links[i].id === id && i > 0) {
            const target = links[i]
            const newLinks = links.filter((_, idx) => idx !== i)
            newLinks[i - 1] = {
                ...newLinks[i - 1],
                children: [...(newLinks[i - 1].children || []), target],
            }
            return newLinks
        }
        if (links[i].children.length > 0) {
            const result = indentLinkInTree(links[i].children, id)
            if (result !== links[i].children)
                return links.map((l, idx) => (idx === i ? { ...l, children: result } : l))
        }
    }
    return links
}

export function outdentLinkInTree(links: NavLinkItem[], id: string): NavLinkItem[] | null {
    for (let i = 0; i < links.length; i++) {
        if (links[i].children.length > 0) {
            const childIdx = links[i].children.findIndex(c => c.id === id)
            if (childIdx !== -1) {
                const target = links[i].children[childIdx]
                const newChildren = links[i].children.filter((_, idx) => idx !== childIdx)
                const newLinks = [...links]
                newLinks[i] = { ...newLinks[i], children: newChildren }
                newLinks.splice(i + 1, 0, target)
                return newLinks
            }
            const result = outdentLinkInTree(links[i].children, id)
            if (result) return links.map((l, idx) => (idx === i ? { ...l, children: result } : l))
        }
    }
    return null
}

// ── Cross-parent move helpers (P2) ───────────────────────────────────────────

/**
 * Remove `activeId` from its current location (returns [item, updatedTree]).
 */
function pluck(
    links: NavLinkItem[],
    activeId: string,
): [NavLinkItem | null, NavLinkItem[]] {
    for (let i = 0; i < links.length; i++) {
        if (links[i].id === activeId) {
            const item = links[i]
            return [item, links.filter((_, idx) => idx !== i)]
        }
        if (links[i].children.length > 0) {
            const [found, newChildren] = pluck(links[i].children, activeId)
            if (found) {
                const newLinks = links.map((l, idx) =>
                    idx === i ? { ...l, children: newChildren } : l,
                )
                return [found, newLinks]
            }
        }
    }
    return [null, links]
}

/**
 * Nest `activeId` (a leaf — no children) into `parentId` as its last child.
 * Used by drag-to-nest when dropping a root leaf onto a root-with-children.
 */
export function nestAsChild(
    links: NavLinkItem[],
    activeId: string,
    parentId: string,
): NavLinkItem[] {
    if (activeId === parentId) return links
    const [item, withoutActive] = pluck(links, activeId)
    if (!item) return links
    return appendChildrenToParent(withoutActive, parentId, [item])
}

/**
 * Nest `activeId` into `parentId` AND flatten its children:
 * active (children stripped) + active.children → all become children of parentId.
 * Order: existing children of parentId, then active (no kids), then active's former kids.
 */
export function nestWithFlatten(
    links: NavLinkItem[],
    activeId: string,
    parentId: string,
): NavLinkItem[] {
    const [item, withoutActive] = pluck(links, activeId)
    if (!item) return links
    const flatItem = { ...item, children: [] }
    const promoChildren = item.children
    return appendChildrenToParent(withoutActive, parentId, [flatItem, ...promoChildren])
}

function appendChildrenToParent(
    links: NavLinkItem[],
    parentId: string,
    newChildren: NavLinkItem[],
): NavLinkItem[] {
    return links.map(l => {
        if (l.id === parentId)
            return { ...l, children: [...l.children, ...newChildren] }
        if (l.children.length > 0)
            return { ...l, children: appendChildrenToParent(l.children, parentId, newChildren) }
        return l
    })
}

/**
 * Move `activeId` to be a sibling of `overId`, inserting at `position`.
 * Works cross-parent (removes from current parent, inserts adjacent to over).
 */
export function moveAsSibling(
    links: NavLinkItem[],
    activeId: string,
    overId: string,
    position: 'before' | 'after',
): NavLinkItem[] {
    const [item, withoutActive] = pluck(links, activeId)
    if (!item) return links
    return insertAdjacentTo(withoutActive, item, overId, position)
}

function insertAdjacentTo(
    links: NavLinkItem[],
    item: NavLinkItem,
    overId: string,
    position: 'before' | 'after',
): NavLinkItem[] {
    // Check direct children first
    const overIdx = links.findIndex(l => l.id === overId)
    if (overIdx !== -1) {
        const insertAt = position === 'before' ? overIdx : overIdx + 1
        const next = [...links]
        next.splice(insertAt, 0, item)
        return next
    }
    // Recurse
    return links.map(l => {
        if (l.children.length > 0) {
            const childOverIdx = l.children.findIndex(c => c.id === overId)
            if (childOverIdx !== -1) {
                const insertAt = position === 'before' ? childOverIdx : childOverIdx + 1
                const newChildren = [...l.children]
                newChildren.splice(insertAt, 0, item)
                return { ...l, children: newChildren }
            }
            return { ...l, children: insertAdjacentTo(l.children, item, overId, position) }
        }
        return l
    })
}
