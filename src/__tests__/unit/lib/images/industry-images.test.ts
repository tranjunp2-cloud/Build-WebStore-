/**
 * TC-GH-727-03e..03i — industry-images wrapper unit tests
 * GH-727 Phase 03: getters prefer s3Map URL when key matches; fall back to CDN otherwise.
 */

import { describe, it, expect } from 'vitest'
import { getHeroImage, getGalleryImages, IMAGE_LIBRARY } from '@/lib/images/industry-images'
import { buildAltKey, extractPhotoId } from '@/lib/images/image-library-keys'

// ── Constants ─────────────────────────────────────────────────────────────────

// restaurant hero[0] CDN URL — derived from IMAGE_LIBRARY to avoid hardcoding.
const RESTAURANT_HERO_0_CDN = IMAGE_LIBRARY['restaurant']!.hero[0]!
const RESTAURANT_HERO_0_PHOTO_ID = extractPhotoId(RESTAURANT_HERO_0_CDN)
const RESTAURANT_HERO_0_KEY = buildAltKey('restaurant', 'hero[0]', RESTAURANT_HERO_0_PHOTO_ID)

const RESTAURANT_GALLERY_0_CDN = IMAGE_LIBRARY['restaurant']!.gallery[0]!
const RESTAURANT_GALLERY_0_KEY = buildAltKey('restaurant', 'gallery[0]', extractPhotoId(RESTAURANT_GALLERY_0_CDN))

const RESTAURANT_GALLERY_2_CDN = IMAGE_LIBRARY['restaurant']!.gallery[2]!
const RESTAURANT_GALLERY_2_KEY = buildAltKey('restaurant', 'gallery[2]', extractPhotoId(RESTAURANT_GALLERY_2_CDN))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getHeroImage — S3 preference', () => {
    it('TC-GH-727-03e: returns S3 URL when s3Map has matching altKey', () => {
        // Arrange
        const s3Url = 'https://s3.example.com/imglib-restaurant-hero-0.jpg'
        const s3Map = { [RESTAURANT_HERO_0_KEY]: s3Url }

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
        expect(result).toBe(RESTAURANT_HERO_0_CDN)
    })

    it('TC-GH-727-03g: returns CDN URL when s3Map is undefined (backward compat)', () => {
        // Act — no s3Map arg (zero-arg compat)
        const result = getHeroImage('restaurant', 0)

        // Assert
        expect(result).toBe(RESTAURANT_HERO_0_CDN)
    })
})

describe('getGalleryImages — partial s3Map', () => {
    it('TC-GH-727-03h: slots with matching key return S3; unmatched slots return CDN', () => {
        // Arrange — only slots 0 and 2 have S3 copies
        const s3Url0 = 'https://s3.example.com/gallery-0.jpg'
        const s3Url2 = 'https://s3.example.com/gallery-2.jpg'
        const s3Map = {
            [RESTAURANT_GALLERY_0_KEY]: s3Url0,
            [RESTAURANT_GALLERY_2_KEY]: s3Url2,
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

describe('key format sanity — seeder/resolver contract', () => {
    it('TC-GH-727-03i: buildAltKey(extractPhotoId(cdnUrl)) matches expected seeder altKey format for restaurant hero[0]', () => {
        // Arrange — replicate exactly what the seeder writes for restaurant hero[0]
        const cdnUrl = IMAGE_LIBRARY['restaurant']!.hero[0]!
        const photoId = extractPhotoId(cdnUrl)
        const altKey = buildAltKey('restaurant', 'hero[0]', photoId)

        // Assert — key must start with imglib: and contain all three segments
        expect(altKey).toMatch(/^imglib:restaurant:hero\[0\]:[a-zA-Z0-9-]+$/)
        // Photo ID extracted must match the known ID from the CDN URL
        expect(photoId).toBe('1517248135467-4c7edcad34c4')
        expect(altKey).toBe('imglib:restaurant:hero[0]:1517248135467-4c7edcad34c4')
    })
})
