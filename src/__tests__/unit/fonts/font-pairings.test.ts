import { describe, it, expect } from 'vitest'
import {
    FONT_PAIRINGS,
    getFontPairing,
    getFontsByCategory,
    getGoogleFontsUrl,
    getFontFamilies,
    type FontPairing,
} from '@/lib/fonts/pairings'

// ── TC-S1-011: 20 font pairings available ───────────────────────────────────
describe('[TC-S1-011] FONT_PAIRINGS — 20 curated pairings with complete metadata', () => {
    it('has exactly 20 font pairings', () => {
        // Assert
        expect(FONT_PAIRINGS).toHaveLength(20)
    })

    it('each pairing has all required fields', () => {
        const requiredFields: (keyof FontPairing)[] = [
            'id',
            'name',
            'category',
            'headingFont',
            'bodyFont',
            'headingWeight',
            'bodyWeight',
            'description',
        ]

        for (const pairing of FONT_PAIRINGS) {
            for (const field of requiredFields) {
                expect(pairing[field], `${pairing.id} missing field: ${field}`).toBeDefined()
            }
        }
    })

    it('all pairing IDs are unique', () => {
        // Arrange
        const ids = FONT_PAIRINGS.map((p) => p.id)

        // Assert
        const uniqueIds = new Set(ids)
        expect(uniqueIds.size).toBe(ids.length)
    })

    it('categories include modern, classic, playful, minimal, bold', () => {
        // Arrange
        const categories = new Set(FONT_PAIRINGS.map((p) => p.category))

        // Assert
        expect(categories).toContain('modern')
        expect(categories).toContain('classic')
        expect(categories).toContain('playful')
        expect(categories).toContain('minimal')
        expect(categories).toContain('bold')
    })

    it('each of the 5 categories has at least 2 pairings', () => {
        const allCategories = ['modern', 'classic', 'playful', 'minimal', 'bold'] as const

        for (const category of allCategories) {
            // Act
            const count = FONT_PAIRINGS.filter((p) => p.category === category).length

            // Assert
            expect(count, `category "${category}" has fewer than 2 pairings`).toBeGreaterThanOrEqual(2)
        }
    })
})

// ── TC-S1-011 continued: getFontPairing lookup ─────────────────────────────
describe('[TC-S1-011] getFontPairing() lookup', () => {
    it('returns correct pairing for "editorial"', () => {
        // Act
        const result = getFontPairing('editorial')

        // Assert
        expect(result).toBeDefined()
        expect(result!.headingFont).toBe('Playfair Display')
        expect(result!.bodyFont).toBe('Lora')
        expect(result!.category).toBe('classic')
    })

    it('returns correct pairing for "modern-clean"', () => {
        // Act
        const result = getFontPairing('modern-clean')

        // Assert
        expect(result).toBeDefined()
        expect(result!.headingFont).toBe('Inter')
        expect(result!.bodyFont).toBe('Inter')
    })

    it('returns undefined for nonexistent pairing ID', () => {
        // Act
        const result = getFontPairing('nonexistent')

        // Assert
        expect(result).toBeUndefined()
    })
})

// ── getFontsByCategory ──────────────────────────────────────────────────────
describe('[TC-S1-011] getFontsByCategory()', () => {
    it('returns at least 2 pairings for "modern" category', () => {
        // Act
        const modernPairings = getFontsByCategory('modern')

        // Assert
        expect(modernPairings.length).toBeGreaterThanOrEqual(2)
        for (const p of modernPairings) {
            expect(p.category).toBe('modern')
        }
    })

    it('returns correct count for "modern" category', () => {
        // Arrange
        const expectedCount = FONT_PAIRINGS.filter((p) => p.category === 'modern').length

        // Act
        const result = getFontsByCategory('modern')

        // Assert
        expect(result).toHaveLength(expectedCount)
    })

    it('returns correct count for "bold" category', () => {
        // Arrange
        const expectedCount = FONT_PAIRINGS.filter((p) => p.category === 'bold').length

        // Act
        const result = getFontsByCategory('bold')

        // Assert
        expect(result).toHaveLength(expectedCount)
    })

    it('returns empty array for an invalid/unknown category', () => {
        // Act — cast to satisfy TypeScript, simulating runtime invalid input
        const result = getFontsByCategory('invalid' as FontPairing['category'])

        // Assert
        expect(result).toHaveLength(0)
    })
})

// ── TC-S1-012: getGoogleFontsUrl ────────────────────────────────────────────
describe('[TC-S1-012] getGoogleFontsUrl()', () => {
    it('generates URL with correct font families and weights', () => {
        // Arrange
        const boldImpact = getFontPairing('bold-impact')!

        // Act
        const url = getGoogleFontsUrl(boldImpact)

        // Assert
        expect(url).toContain('Oswald')
        expect(url).toContain('Source+Sans+3')
        expect(url).toContain('wght@700')
        expect(url).toContain('display=swap')
    })

    it('skips system fonts (Helvetica Neue) in URL', () => {
        // Arrange
        const minimalSwiss = getFontPairing('minimal-swiss')!

        // Act
        const url = getGoogleFontsUrl(minimalSwiss)

        // Assert — Helvetica Neue should NOT appear in URL
        expect(url).not.toContain('Helvetica')
        // But Inter (body) should
        expect(url).toContain('Inter')
    })

    it('does not duplicate font when heading and body are the same', () => {
        // Arrange
        const modernClean = getFontPairing('modern-clean')!

        // Act
        const url = getGoogleFontsUrl(modernClean)

        // Assert — Inter should appear only once
        const interMatches = url.match(/family=Inter/g)
        expect(interMatches).toHaveLength(1)
    })

    it('generates valid Google Fonts API URL format', () => {
        // Arrange
        const editorial = getFontPairing('editorial')!

        // Act
        const url = getGoogleFontsUrl(editorial)

        // Assert
        expect(url).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?/)
        expect(url).toContain('display=swap')
    })

    it('encodes spaces in font names with + for URL safety', () => {
        // Arrange — 'Playfair Display' contains a space
        const editorial = getFontPairing('editorial')!

        // Act
        const url = getGoogleFontsUrl(editorial)

        // Assert — spaces must be replaced, raw spaces are invalid in URLs
        expect(url).not.toContain('Playfair Display')
        expect(url).toContain('Playfair+Display')
    })
})

// ── TC-S1-011: getFontFamilies ──────────────────────────────────────────────
describe('[TC-S1-011] getFontFamilies()', () => {
    it('returns 2 unique families when heading and body fonts differ', () => {
        // Arrange — 'editorial': Playfair Display / Lora
        const pairing = getFontPairing('editorial')!

        // Act
        const families = getFontFamilies(pairing)

        // Assert
        expect(families).toHaveLength(2)
        expect(families).toContain('Playfair Display')
        expect(families).toContain('Lora')
    })

    it('returns 1 family when heading and body are the same font', () => {
        // Arrange — 'modern-clean': Inter / Inter
        const pairing = getFontPairing('modern-clean')!

        // Act
        const families = getFontFamilies(pairing)

        // Assert — no duplicate
        expect(families).toHaveLength(1)
        expect(families[0]).toBe('Inter')
    })

    it('always places headingFont first in the returned array', () => {
        // Arrange — 'bold-impact': Oswald (heading) / Source Sans 3 (body)
        const pairing = getFontPairing('bold-impact')!

        // Act
        const families = getFontFamilies(pairing)

        // Assert
        expect(families[0]).toBe('Oswald')
        expect(families[1]).toBe('Source Sans 3')
    })

    it('includes system fonts in families list (getFontFamilies does not filter)', () => {
        // Arrange — 'minimal-swiss': Helvetica Neue (system) / Inter
        const pairing = getFontPairing('minimal-swiss')!

        // Act
        const families = getFontFamilies(pairing)

        // Assert — getFontFamilies returns all families; filtering is getGoogleFontsUrl's job
        expect(families).toContain('Helvetica Neue')
        expect(families).toContain('Inter')
        expect(families).toHaveLength(2)
    })
})
