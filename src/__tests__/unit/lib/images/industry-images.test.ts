/**
 * TC-GH-727-03e..03i — industry-images wrapper unit tests
 * GH-727 Phase 04: s3Map is keyed by slot name ('hero[0]', 'gallery[0]', etc.)
 * — no category or photoId in the key. Getters fall back to CDN when key absent.
 */

import { describe, it, expect } from 'vitest'
import { getHeroImage, getGalleryImages, IMAGE_LIBRARY } from '@/lib/images/industry-images'
import { buildSiteAltKey } from '@/lib/images/image-library-keys'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getHeroImage — S3 preference', () => {
    it('TC-GH-727-03e: returns S3 URL when s3Map has matching slot key', () => {
        // Arrange — Phase 04: key is slot name, not full altKey
        const s3Url = 'https://s3.example.com/imglib-restaurant-hero-0.jpg'
        const s3Map = { 'hero[0]': s3Url }

        // Act
        const result = getHeroImage('restaurant', 0, s3Map)

        // Assert
        expect(result).toBe(s3Url)
    })

    it('TC-GH-727-03f: returns CDN URL when s3Map is empty (no match)', () => {
        // Arrange
        const s3Map = {}

        // Act
        const result = getHeroImage('restaurant', 0, s3Map)

        // Assert
        expect(result).toBe(IMAGE_LIBRARY['restaurant']!.hero[0]!)
    })

    it('TC-GH-727-03g: returns CDN URL when s3Map is undefined (backward compat)', () => {
        // Act — no s3Map arg
        const result = getHeroImage('restaurant', 0)

        // Assert
        expect(result).toBe(IMAGE_LIBRARY['restaurant']!.hero[0]!)
    })
})

describe('getGalleryImages — partial s3Map', () => {
    it('TC-GH-727-03h: slots with matching slot key return S3; unmatched slots return CDN', () => {
        // Arrange — only slots 0 and 2 have S3 copies
        const s3Url0 = 'https://s3.example.com/gallery-0.jpg'
        const s3Url2 = 'https://s3.example.com/gallery-2.jpg'
        const s3Map = {
            'gallery[0]': s3Url0,
            'gallery[2]': s3Url2,
        }

        // Act
        const results = getGalleryImages('restaurant', 6, s3Map)

        // Assert
        expect(results[0]).toBe(s3Url0)                                          // slot 0 → S3
        expect(results[1]).toBe(IMAGE_LIBRARY['restaurant']!.gallery[1]!)        // slot 1 → CDN
        expect(results[2]).toBe(s3Url2)                                          // slot 2 → S3
        expect(results[3]).toBe(IMAGE_LIBRARY['restaurant']!.gallery[3]!)        // slot 3 → CDN
        expect(results[4]).toBe(IMAGE_LIBRARY['restaurant']!.gallery[4]!)        // slot 4 → CDN
        expect(results[5]).toBe(IMAGE_LIBRARY['restaurant']!.gallery[5]!)        // slot 5 → CDN
    })
})

describe('seeder/resolver/consumer contract (Phase 04)', () => {
    it('TC-GH-727-03i: buildSiteAltKey → resolver strips prefix → slot name → consumer lookup round-trips correctly', () => {
        const siteId = 42
        const slot = 'hero[0]'

        // Seeder writes: buildSiteAltKey(siteId, slot)
        const altKey = buildSiteAltKey(siteId, slot)
        expect(altKey).toBe('imglib:s42:hero[0]')
        expect(altKey).toMatch(/^imglib:s\d+:/)

        // Resolver strips prefix → slot name
        const prefix = `imglib:s${siteId}:`
        const resolvedSlot = altKey.slice(prefix.length)
        expect(resolvedSlot).toBe(slot)

        // Consumer (industry-images) looks up by slot name
        const s3Map = { [resolvedSlot]: 'https://s3.example.com/hero.jpg' }
        const result = getHeroImage('restaurant', 0, s3Map)
        expect(result).toBe('https://s3.example.com/hero.jpg')
    })
})
