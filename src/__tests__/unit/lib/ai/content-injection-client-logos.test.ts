/**
 * TC-F01-CI-CLIENT-LOGOS-01..02 — buildBlockFromLibrary handles client-logos.
 *
 * Prevents regression of staging bug:
 *   [Structure Enforcer] no library content for required "client-logos"
 *
 * Root cause: content-injection.buildBlockFromLibrary() had no case handler
 * for `client-logos` block type, so Structure Enforcer could not inject the
 * mandatory block for recipes `tech-proof` and `biz-proof` (2 of 14 categories).
 */

import { describe, it, expect } from 'vitest'
import { buildBlockFromLibrary } from '@/lib/ai/content-injection'

describe('buildBlockFromLibrary — client-logos case handler', () => {
    it('TC-F01-CI-CLIENT-LOGOS-01 — returns a valid client-logos block for tech category', () => {
        const block = buildBlockFromLibrary('client-logos', 'tech', { seed: 42 })

        expect(block).not.toBeNull()
        expect(block!.blockType).toBe('client-logos')
        expect(Array.isArray(block!.logos)).toBe(true)
        expect((block!.logos as unknown[]).length).toBeGreaterThanOrEqual(1)
        expect((block!.logos as unknown[]).length).toBeLessThanOrEqual(6)
    })

    it('TC-F01-CI-CLIENT-LOGOS-02 — returns a valid client-logos block for business category', () => {
        const block = buildBlockFromLibrary('client-logos', 'business', { seed: 7 })

        expect(block).not.toBeNull()
        expect(block!.blockType).toBe('client-logos')
        // Each logo item matches ClientLogosConfigSchema: { url: string, alt: string }
        for (const logo of block!.logos as Array<{ url: string; alt: string }>) {
            expect(typeof logo.url).toBe('string')
            expect(typeof logo.alt).toBe('string')
            expect(logo.alt.length).toBeGreaterThan(0)
        }
    })
})
