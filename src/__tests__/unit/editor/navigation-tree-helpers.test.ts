import { describe, it, expect } from 'vitest'

import {
    updateLinkInTree,
    deleteLinkInTree,
    addChildInTree,
    findLinkAndParent,
    indentLinkInTree,
    outdentLinkInTree,
    nestAsChild,
    nestWithFlatten,
    moveAsSibling,
} from '@/components/editor/navigation-tree-helpers'
import type { NavLinkItem } from '@/components/editor/navigation-editor-types'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a NavLinkItem with sensible defaults; children default to []. */
function link(id: string, children: NavLinkItem[] = []): NavLinkItem {
    return { id, label: id, url: '#', type: 'page', children }
}

/** Max nesting depth of a tree (root level = 1). */
function maxDepth(links: NavLinkItem[], level = 1): number {
    return links.reduce(
        (max, l) => Math.max(max, l.children.length ? maxDepth(l.children, level + 1) : level),
        level,
    )
}

/** Flatten all ids in document order — used to compare structures cheaply. */
function ids(links: NavLinkItem[]): string[] {
    return links.flatMap(l => [l.id, ...ids(l.children)])
}

// A representative tree: two roots, one with two children.
//   a
//   b
//     b1
//     b2
function sampleTree(): NavLinkItem[] {
    return [link('a'), link('b', [link('b1'), link('b2')])]
}

// ── TC-F05-NAV-01 — nestAsChild nests a leaf into a parent ──────────────────
describe('[TC-F05-NAV-01] nestAsChild nests a leaf into a parent', () => {
    it('removes the active leaf from root and appends it as the last child', () => {
        const tree = [link('a'), link('b', [link('b1')])]
        const out = nestAsChild(tree, 'a', 'b')
        // 'a' no longer at root.
        expect(out.map(l => l.id)).toEqual(['b'])
        // 'a' appended after existing children of 'b'.
        expect(out[0].children.map(c => c.id)).toEqual(['b1', 'a'])
    })
})

// ── TC-F05-NAV-02 — nestAsChild self-target is a no-op ──────────────────────
describe('[TC-F05-NAV-02] nestAsChild self-target → no-op', () => {
    it('returns the tree unchanged when activeId === parentId', () => {
        const tree = sampleTree()
        const out = nestAsChild(tree, 'a', 'a')
        expect(out).toBe(tree)
    })
})

// ── TC-F05-NAV-03 — nestAsChild unknown id is a no-op ───────────────────────
describe('[TC-F05-NAV-03] nestAsChild unknown active id → no-op', () => {
    it('returns the tree unchanged when activeId is not present', () => {
        const tree = sampleTree()
        const out = nestAsChild(tree, 'ghost', 'b')
        expect(out).toBe(tree)
    })
})

// ── TC-F05-NAV-04 — nestWithFlatten ordering ────────────────────────────────
describe('[TC-F05-NAV-04] nestWithFlatten produces the correct child order', () => {
    it('orders parent children as [existing, active-stripped, ...active former children]', () => {
        // target 'p' already has child 'p1'; active 'a' has children a1, a2.
        const tree = [link('p', [link('p1')]), link('a', [link('a1'), link('a2')])]
        const out = nestWithFlatten(tree, 'a', 'p')
        expect(out.map(l => l.id)).toEqual(['p'])
        expect(out[0].children.map(c => c.id)).toEqual(['p1', 'a', 'a1', 'a2'])
        // 'a' is stripped of its own children (now a sibling-level leaf).
        const a = out[0].children.find(c => c.id === 'a')!
        expect(a.children).toEqual([])
    })
})

// ── TC-F05-NAV-05 — nestWithFlatten keeps depth ≤ 2 ─────────────────────────
describe('[TC-F05-NAV-05] nestWithFlatten never creates a 3rd level', () => {
    it('result has max depth 2 even when the active item had its own children', () => {
        const tree = [link('p', [link('p1')]), link('a', [link('a1'), link('a2')])]
        expect(maxDepth(tree)).toBe(2)
        const out = nestWithFlatten(tree, 'a', 'p')
        expect(maxDepth(out)).toBe(2)
    })
})

// ── TC-F05-NAV-06 / 07 — moveAsSibling cross-parent ─────────────────────────
describe('[TC-F05-NAV-06] moveAsSibling cross-parent (after)', () => {
    it('moves the active item to sit after the over item under a different parent', () => {
        // a (root leaf) → after b1 (child of b)
        const tree = [link('a'), link('b', [link('b1'), link('b2')])]
        const out = moveAsSibling(tree, 'a', 'b1', 'after')
        expect(out.map(l => l.id)).toEqual(['b'])
        expect(out[0].children.map(c => c.id)).toEqual(['b1', 'a', 'b2'])
    })
})

describe('[TC-F05-NAV-07] moveAsSibling inserts before the over item', () => {
    it('inserts the active item immediately before the over item', () => {
        const tree = [link('a'), link('b', [link('b1'), link('b2')])]
        const out = moveAsSibling(tree, 'a', 'b2', 'before')
        expect(out[0].children.map(c => c.id)).toEqual(['b1', 'a', 'b2'])
    })
})

// ── TC-F05-NAV-08 — indent/outdent round-trip ───────────────────────────────
describe('[TC-F05-NAV-08] indent then outdent round-trips the structure', () => {
    it('indenting an item under its previous sibling, then outdenting, restores root order', () => {
        const tree = [link('x'), link('y')]
        // indent 'y' → becomes child of 'x'
        const indented = indentLinkInTree(tree, 'y')
        expect(indented.map(l => l.id)).toEqual(['x'])
        expect(indented[0].children.map(c => c.id)).toEqual(['y'])
        // outdent 'y' → back to root, right after 'x'
        const out = outdentLinkInTree(indented, 'y')
        expect(out).not.toBeNull()
        expect(ids(out!)).toEqual(ids(tree))
    })
})

// ── TC-F05-NAV-09 — indent first item is a no-op ────────────────────────────
describe('[TC-F05-NAV-09] indentLinkInTree at index 0 → no-op', () => {
    it('returns the tree unchanged when the item has no previous sibling', () => {
        const tree = [link('x'), link('y')]
        const out = indentLinkInTree(tree, 'x')
        expect(out).toBe(tree)
    })
})

// ── TC-F05-NAV-10 — outdent promotes a child to root ────────────────────────
describe('[TC-F05-NAV-10] outdentLinkInTree promotes a child to root level', () => {
    it('removes the child from its parent and inserts it right after the parent', () => {
        const tree = [link('p', [link('c')]), link('q')]
        const out = outdentLinkInTree(tree, 'c')
        expect(out).not.toBeNull()
        expect(out!.map(l => l.id)).toEqual(['p', 'c', 'q'])
        expect(out![0].children).toEqual([])
    })

    it('returns null when the id is not nested under any parent', () => {
        const tree = [link('p', [link('c')])]
        expect(outdentLinkInTree(tree, 'p')).toBeNull()
    })
})

// ── TC-F05-NAV-11 — deleteLinkInTree deep delete ────────────────────────────
describe('[TC-F05-NAV-11] deleteLinkInTree removes a node at any depth', () => {
    it('deletes a nested child while keeping the rest intact', () => {
        const tree = sampleTree()
        const out = deleteLinkInTree(tree, 'b1')
        expect(ids(out)).toEqual(['a', 'b', 'b2'])
    })

    it('deletes a root node and all its descendants', () => {
        const tree = sampleTree()
        const out = deleteLinkInTree(tree, 'b')
        expect(ids(out)).toEqual(['a'])
    })
})

// ── TC-F05-NAV-12 — update / addChild / findLinkAndParent ───────────────────
describe('[TC-F05-NAV-12] update / addChild / findLinkAndParent', () => {
    it('updateLinkInTree patches a deeply nested node only', () => {
        const tree = sampleTree()
        const out = updateLinkInTree(tree, 'b2', { label: 'Renamed' })
        const b2 = findLinkAndParent(out, 'b2')!.link
        expect(b2.label).toBe('Renamed')
        // sibling untouched
        expect(findLinkAndParent(out, 'b1')!.link.label).toBe('b1')
    })

    it('addChildInTree appends to the right parent', () => {
        const tree = sampleTree()
        const out = addChildInTree(tree, 'b', link('b3'))
        const b = findLinkAndParent(out, 'b')!.link
        expect(b.children.map(c => c.id)).toEqual(['b1', 'b2', 'b3'])
    })

    it('findLinkAndParent returns parentId and index for a nested node', () => {
        const tree = sampleTree()
        const found = findLinkAndParent(tree, 'b2')
        expect(found).not.toBeNull()
        expect(found!.parentId).toBe('b')
        expect(found!.index).toBe(1)
    })

    it('findLinkAndParent returns null for an unknown id', () => {
        expect(findLinkAndParent(sampleTree(), 'ghost')).toBeNull()
    })
})
