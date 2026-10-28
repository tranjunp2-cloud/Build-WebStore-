/**
 * TC-AICP-136 (prime-web side) — a record picked with "Use" in a chat card is an element chip of kind
 * `product` / `post`: it has a label in every dashboard language and is never a place on the canvas.
 */
import { describe, expect, it } from 'vitest'
import { agentPanelLabels } from '@/components/agent/agent-panel-labels'
import { elementRevealTarget } from '@/lib/editor/reveal/reveal-target'

describe('record chips (product / post) [TC-AICP-136]', () => {
    it.each([
        ['ms', 'Produk', 'Catatan'],
        ['vi', 'Sản phẩm', 'Bài viết'],
    ])('are named in %s', (locale, product, post) => {
        const kinds = (agentPanelLabels(locale).composer as { elementKinds: Record<string, string> }).elementKinds
        expect(kinds.product).toBe(product)
        expect(kinds.post).toBe(post)
    })

    it('light nothing up on the canvas: no section, no path, only the page level', () => {
        for (const kind of ['product', 'post'] as const) {
            const target = elementRevealTarget({ kind, label: 'Batik Scarf', recordId: '42' } as never)
            expect(target.surface).toBe('page')
            expect(target.blockId).toBeUndefined()
            expect(target.path).toBeUndefined()
        }
    })
})
