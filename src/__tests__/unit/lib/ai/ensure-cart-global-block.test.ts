/**
 * Unit Tests: generation-time cart auto-add — sites generated with commerce
 * blocks must persist a floating cartWidget into site.globalBlocks.
 * TC-IDs: TC-F01.CART-01 → TC-F01.CART-05
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F01-ai-chat-builder.md §3.x
 *
 * Bug: generate-site/apply-template never wrote globalBlocks, relying on the
 * render-time autoInject fallback; the editor normalizes unset globalBlocks to
 * null ("user deleted"), so freshly generated commerce sites showed no cart.
 */

import { describe, it, expect } from 'vitest'
import {
    ensureCartGlobalBlock,
    DEFAULT_CART_WIDGET_BLOCK,
} from '@/lib/ai/ensure-cart-global-block'

const commercePages = [
    { layout: [{ blockType: 'hero' }, { blockType: 'navigation' }] },
    { layout: [{ blockType: 'products-grid' }] },
]
const contentOnlyPages = [
    { layout: [{ blockType: 'hero' }, { blockType: 'about' }, { blockType: 'footer' }] },
]

describe('TC-F01.CART-01: commerce block present → default floating cart patch', () => {
    it('returns a globalBlocks patch with the default cartWidget', () => {
        const patch = ensureCartGlobalBlock(undefined, commercePages)
        expect(patch).toEqual({
            globalBlocks: {
                cartWidget: { blockType: 'cartWidget', variant: 'floating', label: 'Cart', showLabel: false },
            },
        })
    })

    it.each(['products-grid', 'products-featured', 'product-quick-view'])(
        'detects %s as commerce',
        (blockType) => {
            const patch = ensureCartGlobalBlock(undefined, [{ layout: [{ blockType }] }])
            expect(patch).toHaveProperty('globalBlocks.cartWidget')
        },
    )

    it('adds cart even when the user explicitly deleted it before (regeneration ships new commerce content)', () => {
        const patch = ensureCartGlobalBlock({ cartWidget: null }, commercePages)
        expect(patch).toEqual({ globalBlocks: { cartWidget: { ...DEFAULT_CART_WIDGET_BLOCK } } })
    })
})

describe('TC-F01.CART-02: no commerce block → no change', () => {
    it('returns an empty patch for content-only pages', () => {
        expect(ensureCartGlobalBlock(undefined, contentOnlyPages)).toEqual({})
    })

    it('returns an empty patch for empty/missing layouts', () => {
        expect(ensureCartGlobalBlock(undefined, [])).toEqual({})
        expect(ensureCartGlobalBlock(undefined, [{}, { layout: [] }])).toEqual({})
    })
})

describe('TC-F01.CART-03: already-configured cartWidget is never overwritten', () => {
    it('returns an empty patch when cartWidget object exists', () => {
        const existing = { cartWidget: { blockType: 'cartWidget', variant: 'floating', label: 'Giỏ hàng', showLabel: true } }
        expect(ensureCartGlobalBlock(existing, commercePages)).toEqual({})
    })
})

describe('TC-F01.CART-04: merge keeps other configured global blocks', () => {
    it('carries whatsappButton/socialWidget through the patch', () => {
        const existing = {
            whatsappButton: { blockType: 'whatsapp-button', phone: '+60123456789' },
            socialWidget: null,
        }
        const patch = ensureCartGlobalBlock(existing, commercePages) as { globalBlocks: Record<string, unknown> }
        expect(patch.globalBlocks.whatsappButton).toEqual(existing.whatsappButton)
        expect(patch.globalBlocks.socialWidget).toBeNull()
        expect(patch.globalBlocks.cartWidget).toEqual({ ...DEFAULT_CART_WIDGET_BLOCK })
    })
})

describe('TC-F01.CART-05: header cart suppresses the floating cart', () => {
    it('returns an empty patch when headerBlock.showCart is true', () => {
        expect(ensureCartGlobalBlock(undefined, commercePages, { showCart: true })).toEqual({})
    })

    it('still adds the cart when headerBlock has no cart config', () => {
        const patch = ensureCartGlobalBlock(undefined, commercePages, { blockType: 'navigation', links: [] })
        expect(patch).toHaveProperty('globalBlocks.cartWidget')
    })
})
