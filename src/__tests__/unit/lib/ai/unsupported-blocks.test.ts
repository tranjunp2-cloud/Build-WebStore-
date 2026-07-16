/**
 * TC-F01-UB-01 — Unsupported blocks drop list
 * Shared between happy path (openai-generator) and fallback path (fallback-adapter).
 * Source: plan-2156 phase-06 regression fix (fc0020d + 9bf02d4 interaction).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
    BLOCKS_REQUIRE_MEDIA_PIPELINE,
    BLOCKS_NOT_IN_PAYLOAD,
    BLOCKS_TEMP_HIDDEN,
    isUnsupportedBlock,
    filterUnsupportedBlocks,
} from '@/lib/ai/unsupported-blocks'

describe('isUnsupportedBlock', () => {
    it('returns true for every block in MEDIA_PIPELINE list', () => {
        for (const t of BLOCKS_REQUIRE_MEDIA_PIPELINE) {
            expect(isUnsupportedBlock(t)).toBe(true)
        }
    })

    it('returns true for every block in NOT_IN_PAYLOAD list', () => {
        for (const t of BLOCKS_NOT_IN_PAYLOAD) {
            expect(isUnsupportedBlock(t)).toBe(true)
        }
    })

    it('menu-display, property-card, pricing-table are in BLOCKS_TEMP_HIDDEN [TC-F01-UB-01]', () => {
        expect(BLOCKS_TEMP_HIDDEN.has('menu-display')).toBe(true)
        expect(BLOCKS_TEMP_HIDDEN.has('property-card')).toBe(true)
        expect(BLOCKS_TEMP_HIDDEN.has('pricing-table')).toBe(true)
    })

    it('isUnsupportedBlock returns true for GH-1024 hidden blocks', () => {
        expect(isUnsupportedBlock('menu-display')).toBe(true)
        expect(isUnsupportedBlock('property-card')).toBe(true)
        expect(isUnsupportedBlock('pricing-table')).toBe(true)
    })

    it('returns false for supported blocks', () => {
        for (const t of ['hero', 'navigation', 'footer', 'faq', 'features', 'pricing', 'testimonials']) {
            expect(isUnsupportedBlock(t)).toBe(false)
        }
    })

    it('returns false for empty / unknown', () => {
        expect(isUnsupportedBlock('')).toBe(false)
        expect(isUnsupportedBlock('totally-made-up')).toBe(false)
    })
})

describe('filterUnsupportedBlocks', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        warnSpy.mockRestore()
    })

    it('drops unsupported + keeps supported in order', () => {
        const input = [
            { blockType: 'hero' },
            { blockType: 'review-cards' },
            { blockType: 'features' },
            { blockType: 'footer' },
        ]
        const out = filterUnsupportedBlocks(input, 'fallback')
        expect(out).toEqual([
            { blockType: 'hero' },
            { blockType: 'features' },
            { blockType: 'footer' },
        ])
        expect(warnSpy).toHaveBeenCalledTimes(1)
    })

    it('replaces unsupported blocks with supported equivalents when mapped', () => {
        const input = [
            { blockType: 'menu-display', customField: 123 },
            { blockType: 'booking-widget' },
            { blockType: 'pricing-table' },
        ]
        const out = filterUnsupportedBlocks(input, 'fallback')
        expect(out).toEqual([
            { blockType: 'menu-food', customField: 123 },
            { blockType: 'contact' },
            { blockType: 'pricing' },
        ])
        expect(warnSpy).toHaveBeenCalledTimes(3)
    })

    it('logs fallback prefix when context="fallback"', () => {
        filterUnsupportedBlocks([{ blockType: 'review-cards' }], 'fallback')
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[Fallback]'))
    })

    it('logs AI prefix when context="ai"', () => {
        filterUnsupportedBlocks([{ blockType: 'review-cards' }], 'ai')
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[AI]'))
    })

    it('drops blocks with missing/invalid blockType', () => {
        const input = [
            { blockType: 'hero' },
            { blockType: '' },
            { notBlockType: 'x' } as unknown as { blockType?: string },
        ]
        const out = filterUnsupportedBlocks(input, 'ai')
        expect(out).toEqual([{ blockType: 'hero' }])
    })
})
