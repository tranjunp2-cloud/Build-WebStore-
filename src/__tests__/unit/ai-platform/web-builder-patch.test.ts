/**
 * TC-AIWB-05 / 06 — page patches as data: apply, the version guard, and undo.
 * Real: site-patch.ts (runPagePatch, fingerprints, changedSince, undoRecord, restoreSections).
 */

import { describe, expect, it } from 'vitest'
import { blockHash, type PageBlock } from '@/lib/ai-platform/site/site-blocks'
import { changedSince, fingerprints, PagePatchError, type PagePatchOp, restoreSections, runPagePatch, undoRecord } from '@/lib/ai-platform/site/site-patch'
import { FAQ, FOOTER, HERO, LAYOUT, NAV, PRODUCTS } from './web-builder-fixtures'

const clone = <T>(value: T): T => structuredClone(value)
const NEW_FAQ = { blockType: 'faq', id: '00000000-0000-4000-8000-0000000000f1', variant: 'accordion', headline: 'Shipping', items: [{ question: 'Where?', answer: 'Everywhere' }] }

/** What the applier does: apply the ops, then record undo for the touched ids plus any inserted section. */
function apply(before: PageBlock[], ops: PagePatchOp[]) {
    const result = runPagePatch(before, ops)
    const inserted = ops.flatMap((op) => (op.op === 'insert_block' ? [String(op.block.id)] : []))
    const touched = new Set([...result.touched, ...inserted])
    return { after: result.next, touched, undo: undoRecord(before, result.next, touched) }
}

describe('apply then undo — exact round trip [TC-AIWB-06]', () => {
    it('restores the original layout after set_fields', () => {
        const { after, undo } = apply(clone(LAYOUT), [{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'Fresh' } }])

        expect(restoreSections(after, undo)).toEqual(LAYOUT)
    })

    it('removes an inserted section on undo', () => {
        const { after, undo } = apply(clone(LAYOUT), [{ op: 'insert_block', afterBlockId: '00000000-0000-4000-8000-0000000000b1', block: clone(NEW_FAQ) }])

        expect(after).toHaveLength(LAYOUT.length + 1)
        expect(restoreSections(after, undo)).toEqual(LAYOUT)
    })

    it('puts a removed section back where it was', () => {
        const { after, undo } = apply(clone(LAYOUT), [{ op: 'remove_block', blockId: '00000000-0000-4000-8000-0000000000c1' }])

        expect(after.map((b) => b.id)).not.toContain('00000000-0000-4000-8000-0000000000c1')
        expect(restoreSections(after, undo)).toEqual(LAYOUT)
    })

    it('moves a section back to its original order', () => {
        const { after, undo } = apply(clone(LAYOUT), [{ op: 'move_block', blockId: '00000000-0000-4000-8000-0000000000d1', afterBlockId: '00000000-0000-4000-8000-0000000000a1' }])

        expect(after.map((b) => b.id)).toEqual(['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000e1'])
        expect(restoreSections(after, undo)).toEqual(LAYOUT)
    })

    it('restores a mixed patch exactly', () => {
        const { after, undo } = apply(clone(LAYOUT), [
            { op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'New' } },
            { op: 'insert_block', afterBlockId: '00000000-0000-4000-8000-0000000000b1', block: clone(NEW_FAQ) },
            { op: 'remove_block', blockId: '00000000-0000-4000-8000-0000000000c1' },
            { op: 'move_block', blockId: '00000000-0000-4000-8000-0000000000d1', afterBlockId: '00000000-0000-4000-8000-0000000000a1' },
        ])

        expect(restoreSections(after, undo)).toEqual(LAYOUT)
    })
})

describe('the version guard [TC-AIWB-05]', () => {
    it('reports a touched section whose content changed since the patch was drafted', () => {
        const drafted = clone(LAYOUT)
        const draftedFingerprints = fingerprints(drafted, ['00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1'])
        const edited = clone(LAYOUT).map((b) => (b.id === '00000000-0000-4000-8000-0000000000b1' ? { ...b, headline: 'Edited by the merchant' } : b))

        expect(changedSince(edited, draftedFingerprints)).toEqual(['00000000-0000-4000-8000-0000000000b1'])
    })

    it('reports nothing when the touched sections are as drafted', () => {
        const expected = fingerprints(LAYOUT, ['00000000-0000-4000-8000-0000000000b1'])

        expect(changedSince(clone(LAYOUT), expected)).toEqual([])
    })

    it('reports a touched section that was removed since', () => {
        const expected = fingerprints(LAYOUT, ['00000000-0000-4000-8000-0000000000c1'])

        expect(changedSince(LAYOUT.filter((b) => b.id !== '00000000-0000-4000-8000-0000000000c1'), expected)).toEqual(['00000000-0000-4000-8000-0000000000c1'])
    })

    it('marks the sections a patch touches (edited, removed, moved, and the anchors it places after)', () => {
        const { touched } = apply(clone(LAYOUT), [
            { op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'x' } },
            { op: 'remove_block', blockId: '00000000-0000-4000-8000-0000000000c1' },
            { op: 'insert_block', afterBlockId: '00000000-0000-4000-8000-0000000000d1', block: clone(NEW_FAQ) },
        ])

        expect([...touched].sort()).toEqual([HERO.id, FAQ.id, NEW_FAQ.id, PRODUCTS.id].sort())
    })

    it('refuses a patch that names a section which is not on the page', () => {
        expect(() => runPagePatch(clone(LAYOUT), [{ op: 'remove_block', blockId: 'ghost' }])).toThrow(PagePatchError)
    })
})

describe('undo after the page moved on [TC-AIWB-06]', () => {
    it('refuses to undo when a touched section was edited after the patch', () => {
        const { after, undo } = apply(clone(LAYOUT), [{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'Fresh' } }])
        const edited = after.map((b) => (b.id === '00000000-0000-4000-8000-0000000000b1' ? { ...b, headline: 'Changed again' } : b))

        expect(() => restoreSections(edited, undo)).toThrow(PagePatchError)
        expect(() => restoreSections(edited, undo)).toThrow(/was edited after the assistant changed it/)
    })

    it('still undoes when only untouched sections changed, and keeps those changes', () => {
        const { after, undo } = apply(clone(LAYOUT), [{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'Fresh' } }])
        const withFooterEdit = after.map((b) => (b.id === '00000000-0000-4000-8000-0000000000e1' ? { ...b, copyrightText: '© 2026 Kedai Batik' } : b))

        const restored = restoreSections(withFooterEdit, undo)

        expect(restored.find((b) => b.id === '00000000-0000-4000-8000-0000000000b1')).toEqual(HERO)
        expect(restored.find((b) => b.id === '00000000-0000-4000-8000-0000000000e1')).toEqual({ ...FOOTER, copyrightText: '© 2026 Kedai Batik' })
    })

    it('refuses to undo an inserted section that was edited since', () => {
        const { after, undo } = apply(clone(LAYOUT), [{ op: 'insert_block', afterBlockId: '00000000-0000-4000-8000-0000000000b1', block: clone(NEW_FAQ) }])
        const edited = after.map((b) => (b.id === '00000000-0000-4000-8000-0000000000f1' ? { ...b, headline: 'Edited' } : b))

        expect(() => restoreSections(edited, undo)).toThrow(/was edited after the assistant changed it/)
    })

    it('keeps the fingerprint of a section as the record stores it (undo is keyed on the stored content)', () => {
        const { undo } = apply(clone(LAYOUT), [{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'Fresh' } }])

        expect(undo.find((u) => u.blockId === '00000000-0000-4000-8000-0000000000b1')?.after).toBe(blockHash({ ...HERO, headline: 'Fresh' }))
        expect(undo.find((u) => u.blockId === '00000000-0000-4000-8000-0000000000b1')?.before).toEqual(HERO)
    })

    it('keeps the product section and the navigation out of an undo that did not touch them', () => {
        const { undo } = apply(clone(LAYOUT), [{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'Fresh' } }])

        expect(undo.map((u) => u.blockId)).toEqual(['00000000-0000-4000-8000-0000000000b1'])
        expect(undo.map((u) => u.blockId)).not.toContain(PRODUCTS.id)
        expect(undo.map((u) => u.blockId)).not.toContain(NAV.id)
        expect(undo.map((u) => u.blockId)).not.toContain(FAQ.id)
    })
})

// The frame of the page stays put: runPagePatch refuses to move or remove the navigation/footer.
describe('the footer stays last [TC-AIWB-05]', () => {
    it('refuses to move the footer (site-patch.ts runPagePatch)', () => {
        expect(() => runPagePatch(clone(LAYOUT), [{ op: 'move_block', blockId: FOOTER.id, afterBlockId: null }])).toThrow(PagePatchError)
    })

    it('keeps the footer last when a section is inserted after it', () => {
        const { next } = runPagePatch(clone(LAYOUT), [{ op: 'insert_block', afterBlockId: FOOTER.id, block: { id: '00000000-0000-4000-8000-0000000000aa', blockType: 'faq' } }])

        expect(next.at(-1)?.blockType).toBe('footer')
    })
})
