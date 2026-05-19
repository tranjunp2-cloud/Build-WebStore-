/**
 * Unit Tests — applyGlobalBlock pure helper
 * Coverage Map:
 *   TC-F10-GBL-010 → globalEntry present → injected with __editorBlockIndex: -1, variant: 'floating'
 *   TC-F10-GBL-011 → globalEntry present + stale floating in page layout → deduplicated
 *   TC-F10-GBL-012 → globalEntry present + INLINE in page layout → both preserved
 *   TC-F10-GBL-013 → globalEntry null + page-scan hit → BC fallback fires
 *   TC-F10-GBL-014 → globalEntry null + no page-scan + autoInject=true + commerce → auto-inject
 *   TC-F10-GBL-015 → globalEntry null + no page-scan + autoInject=false → nothing added
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/site-renderer/extract-first-global-block', () => ({
    extractFirstGlobalBlock: vi.fn(),
}))
vi.mock('@/lib/site-renderer/detect-commerce-presence', () => ({
    detectCommercePresence: vi.fn(),
}))
vi.mock('@/lib/site-renderer/has-header-cart', () => ({
    hasHeaderCart: vi.fn(),
}))

import { applyGlobalBlock } from '@/lib/site-renderer/apply-global-block'
import { extractFirstGlobalBlock } from '@/lib/site-renderer/extract-first-global-block'
import { detectCommercePresence } from '@/lib/site-renderer/detect-commerce-presence'
import { hasHeaderCart } from '@/lib/site-renderer/has-header-cart'

const mockExtract = vi.mocked(extractFirstGlobalBlock)
const mockDetect = vi.mocked(detectCommercePresence)
const mockHasCart = vi.mocked(hasHeaderCart)

const PAGES = [{ layout: [{ blockType: 'hero' }] }]

describe('applyGlobalBlock', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockExtract.mockReturnValue(null)
        mockDetect.mockReturnValue(false)
        mockHasCart.mockReturnValue(false)
    })

    // ── TC-F10-GBL-010 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-010] globalEntry present → injected with __editorBlockIndex: -1 and variant floating', () => {
        // Arrange
        const nextBlocks = [{ blockType: 'hero' }]
        const globalEntry = { blockType: 'cartWidget', showCount: true }

        // Act
        const result = applyGlobalBlock(nextBlocks, 'cartWidget', globalEntry, PAGES)

        // Assert
        const injected = result.find(b => b.blockType === 'cartWidget')
        expect(injected).toBeDefined()
        expect(injected?.__editorBlockIndex).toBe(-1)
        expect(injected?.variant).toBe('floating')
    })

    // ── TC-F10-GBL-011 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-011] globalEntry present + stale floating in layout → deduplicated, only 1 in output', () => {
        // Arrange
        const staleFloating = { blockType: 'cartWidget', variant: 'floating', stale: true }
        const nextBlocks = [{ blockType: 'hero' }, staleFloating]
        const globalEntry = { blockType: 'cartWidget', showCount: true }

        // Act
        const result = applyGlobalBlock(nextBlocks, 'cartWidget', globalEntry, PAGES)

        // Assert
        const cartBlocks = result.filter(b => b.blockType === 'cartWidget')
        expect(cartBlocks).toHaveLength(1)
        expect(cartBlocks[0].stale).toBeUndefined()
        expect(cartBlocks[0].__editorBlockIndex).toBe(-1)
    })

    // ── TC-F10-GBL-012 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-012] globalEntry present + INLINE in layout → inline preserved alongside global floating', () => {
        // Arrange
        const inlineCart = { blockType: 'cartWidget', variant: 'inline' }
        const nextBlocks = [{ blockType: 'hero' }, inlineCart]
        const globalEntry = { blockType: 'cartWidget', showCount: true }

        // Act
        const result = applyGlobalBlock(nextBlocks, 'cartWidget', globalEntry, PAGES)

        // Assert
        const cartBlocks = result.filter(b => b.blockType === 'cartWidget')
        expect(cartBlocks).toHaveLength(2)
        expect(cartBlocks.some(b => b.variant === 'inline')).toBe(true)
        expect(cartBlocks.some(b => b.__editorBlockIndex === -1)).toBe(true)
    })

    // ── TC-F10-GBL-013 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-013] globalEntry null + page-scan hit → BC fallback injects from page', () => {
        // Arrange
        const scannedBlock = { blockType: 'whatsapp-button', phoneNumber: '+60123456789' }
        mockExtract.mockReturnValue(scannedBlock)
        const nextBlocks = [{ blockType: 'hero' }]

        // Act
        const result = applyGlobalBlock(nextBlocks, 'whatsapp-button', null, PAGES)

        // Assert
        const wa = result.find(b => b.blockType === 'whatsapp-button')
        expect(wa).toBeDefined()
        expect(wa?.variant).toBe('floating')
        expect(wa?.__editorBlockIndex).toBe(-1)
        expect(wa?.phoneNumber).toBe('+60123456789')
    })

    // ── TC-F10-GBL-014 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-014] globalEntry null + no page-scan + autoInject + commerce → auto-inject', () => {
        // Arrange
        mockExtract.mockReturnValue(null)
        mockDetect.mockReturnValue(true)
        mockHasCart.mockReturnValue(false)
        const nextBlocks = [{ blockType: 'hero' }]

        // Act
        const result = applyGlobalBlock(nextBlocks, 'cartWidget', null, PAGES, {
            autoInject: true,
            siteHeaderBlock: null,
        })

        // Assert
        const cart = result.find(b => b.blockType === 'cartWidget')
        expect(cart).toBeDefined()
        expect(cart?.variant).toBe('floating')
        expect(cart?.__editorBlockIndex).toBe(-1)
    })

    // ── TC-F10-GBL-015 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-015] globalEntry null + no page-scan + autoInject=false → nothing added', () => {
        // Arrange
        mockExtract.mockReturnValue(null)
        mockDetect.mockReturnValue(true)
        const nextBlocks = [{ blockType: 'hero' }]

        // Act
        const result = applyGlobalBlock(nextBlocks, 'cartWidget', null, PAGES, {
            autoInject: false,
        })

        // Assert
        expect(result).toHaveLength(1)
        expect(result.find(b => b.blockType === 'cartWidget')).toBeUndefined()
    })

    it('globalEntry undefined falls through to BC path', () => {
        mockExtract.mockReturnValue(null)
        const nextBlocks = [{ blockType: 'hero' }]
        const result = applyGlobalBlock(nextBlocks, 'cartWidget', undefined, PAGES)
        expect(result).toHaveLength(1)
    })

    it('BC: already floating in nextBlocks + page-scan hit → no second inject', () => {
        mockExtract.mockReturnValue({ blockType: 'cartWidget', variant: 'floating' })
        const nextBlocks = [
            { blockType: 'hero' },
            { blockType: 'cartWidget', variant: 'floating', __editorBlockIndex: -1 },
        ]
        const result = applyGlobalBlock(nextBlocks, 'cartWidget', null, PAGES)
        const carts = result.filter(b => b.blockType === 'cartWidget')
        expect(carts).toHaveLength(1)
    })
})
