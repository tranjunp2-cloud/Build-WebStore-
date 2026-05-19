/**
 * Unit Tests — mergeGlobalBlocks pure helper
 * Coverage Map:
 *   TC-F10-GBL-001 → null prev + patch object → returns patch
 *   TC-F10-GBL-002 → patch key === null → removes that key only
 *   TC-F10-GBL-003 → patch === null → full wipe returns null
 *   TC-F10-GBL-004 → new config replaces key, other keys preserved
 */

import { describe, it, expect } from 'vitest'
import { mergeGlobalBlocks } from '@/lib/sites/merge-global-blocks'

const CART = { blockType: 'cartWidget', variant: 'floating', items: [] }
const WA = { blockType: 'whatsapp-button', phoneNumber: '+60123456789' }
const SOCIAL = { blockType: 'socialWidget', links: { facebook: 'https://fb.com' } }

describe('mergeGlobalBlocks', () => {
    // ── TC-F10-GBL-001 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-001] null prev + patch with cartWidget → returns patch object', () => {
        // Arrange
        const prev = null
        const patch = { cartWidget: CART }

        // Act
        const result = mergeGlobalBlocks(prev, patch)

        // Assert
        expect(result).toEqual({ cartWidget: CART })
    })

    // ── TC-F10-GBL-002 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-002] patch key === null removes only that key; others preserved', () => {
        // Arrange
        const prev = { cartWidget: CART, whatsappButton: WA }
        const patch = { cartWidget: null }

        // Act
        const result = mergeGlobalBlocks(prev, patch)

        // Assert
        expect(result).toEqual({ whatsappButton: WA })
        expect(result).not.toHaveProperty('cartWidget')
    })

    // ── TC-F10-GBL-003 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-003] patch === null → full wipe returns null', () => {
        // Arrange
        const prev = { cartWidget: CART, whatsappButton: WA, socialWidget: SOCIAL }

        // Act
        const result = mergeGlobalBlocks(prev, null)

        // Assert
        expect(result).toBeNull()
    })

    // ── TC-F10-GBL-004 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-004] new cart config replaces cartWidget; other keys untouched', () => {
        // Arrange
        const newCart = { blockType: 'cartWidget', variant: 'floating', showCount: true }
        const prev = { cartWidget: CART, whatsappButton: WA, socialWidget: SOCIAL }
        const patch = { cartWidget: newCart }

        // Act
        const result = mergeGlobalBlocks(prev, patch)

        // Assert
        expect(result?.cartWidget).toEqual(newCart)
        expect(result?.whatsappButton).toEqual(WA)
        expect(result?.socialWidget).toEqual(SOCIAL)
    })

    it('omitted patch key leaves prev key unchanged', () => {
        const prev = { cartWidget: CART, whatsappButton: WA }
        const patch = { socialWidget: SOCIAL }
        const result = mergeGlobalBlocks(prev, patch)
        expect(result?.cartWidget).toEqual(CART)
        expect(result?.whatsappButton).toEqual(WA)
        expect(result?.socialWidget).toEqual(SOCIAL)
    })

    it('removing all keys returns null', () => {
        const prev = { cartWidget: CART }
        const result = mergeGlobalBlocks(prev, { cartWidget: null })
        expect(result).toBeNull()
    })

    it('null prev + empty patch object returns null (no keys)', () => {
        const result = mergeGlobalBlocks(null, {})
        expect(result).toBeNull()
    })
})
