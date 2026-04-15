/**
 * TC-F01-FP-01 — Font pairing resolver
 * Source: plans/260412-2156-ai-gen-website-audit/phase-06-step-2-font-pairing-resolver.md
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { resolveFontPairing, __FONT_PAIRINGS_FOR_TEST } from '@/lib/ai/font-pairings'
import { CATEGORY_PRESETS } from '@/lib/ai/theme-presets'

const ALLOWED_HEADING_FONTS = ['Outfit', 'Inter', 'Playfair Display', 'DM Sans', 'Poppins', 'Raleway']
const ALLOWED_BODY_FONTS = ['Inter', 'DM Sans', 'Lato', 'Open Sans', 'Nunito']

describe('resolveFontPairing — all known ids', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        warnSpy.mockRestore()
    })

    it('resolves every preset fontPairingId across all 14 categories without warning', () => {
        const allPresets = Object.values(CATEGORY_PRESETS).flat()
        expect(allPresets.length).toBeGreaterThan(0)

        for (const preset of allPresets) {
            const result = resolveFontPairing(preset.fontPairingId)
            expect(result.fontHeading).toBeTruthy()
            expect(result.fontBody).toBeTruthy()
        }

        expect(warnSpy).not.toHaveBeenCalled()
    })

    it('every mapped font is in the Payload allowlist', () => {
        for (const [id, pair] of Object.entries(__FONT_PAIRINGS_FOR_TEST)) {
            expect(ALLOWED_HEADING_FONTS).toContain(pair.fontHeading)
            expect(ALLOWED_BODY_FONTS).toContain(pair.fontBody)
            expect(id).toMatch(/^[a-z-]+$/)
        }
    })

    it('returns default + warns on unknown id', () => {
        const result = resolveFontPairing('totally-made-up-id')
        expect(result).toEqual({ fontHeading: 'Inter', fontBody: 'Inter' })
        expect(warnSpy).toHaveBeenCalledOnce()
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('totally-made-up-id'))
    })

    it('returns default + warns on empty string', () => {
        const result = resolveFontPairing('')
        expect(result).toEqual({ fontHeading: 'Inter', fontBody: 'Inter' })
        expect(warnSpy).toHaveBeenCalledOnce()
    })
})
