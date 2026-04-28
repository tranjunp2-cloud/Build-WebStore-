/**
 * Unit Tests: extractPageLinks — build nav links from AI-generated page list
 * TC-ID: TC-NAV-DYN-01..05, TC-NAV-DYN-09, TC-NAV-DYN-10
 * Convention: docs/TEST_CONVENTION.md
 * Fix: GH-817
 */

import { describe, it, expect } from 'vitest'
import { extractPageLinks } from '@/lib/ai/apply-site-nav'

describe('extractPageLinks', () => {
    it('TC-NAV-DYN-01: returns null when pages is undefined', () => {
        expect(extractPageLinks(undefined)).toBeNull()
    })

    it('TC-NAV-DYN-02: returns null when pages is empty array', () => {
        expect(extractPageLinks([])).toBeNull()
    })

    it('TC-NAV-DYN-03: maps multi-page list to correct label/url pairs', () => {
        // Arrange
        const pages = [
            { title: 'Home', slug: '/', isHomepage: true },
            { title: 'Services', slug: 'services' },
        ]
        // Act
        const result = extractPageLinks(pages)
        // Assert
        expect(result).toEqual([
            { label: 'Home', url: '/' },
            { label: 'Services', url: '/services' },
        ])
    })

    it('TC-NAV-DYN-04: first page always gets url "/" regardless of isHomepage flag', () => {
        // Arrange — no isHomepage flag set; first item should still be treated as home
        const pages = [
            { title: 'Home', slug: '/' },
            { title: 'About', slug: '/about' },
        ]
        // Act
        const result = extractPageLinks(pages)
        // Assert
        expect(result![0].url).toBe('/')
    })

    it('TC-NAV-DYN-05: non-homepage pages get leading slash added to bare slug', () => {
        // Arrange
        const pages = [
            { title: 'Home', slug: '/', isHomepage: true },
            { title: 'Gallery', slug: 'gallery' },
            { title: 'Blog', slug: 'blog' },
        ]
        // Act
        const result = extractPageLinks(pages)!
        // Assert
        expect(result[1].url).toBe('/gallery')
        expect(result[2].url).toBe('/blog')
    })

    it('TC-NAV-DYN-09: strips double leading slash from slug', () => {
        // Arrange — AI occasionally emits slug with leading "/"
        const pages = [
            { title: 'Home', slug: '/', isHomepage: true },
            { title: 'About', slug: '/about' },
        ]
        // Act
        const result = extractPageLinks(pages)!
        // Assert — should be "/about" not "//about"
        expect(result[1].url).toBe('/about')
    })

    it('TC-NAV-DYN-10: falls back to "Page N" label when title is missing', () => {
        // Arrange
        const pages = [
            { title: 'Home', slug: '/', isHomepage: true },
            { slug: 'services' },  // no title
        ]
        // Act
        const result = extractPageLinks(pages)!
        // Assert
        expect(result[1].label).toBe('Page 2')
    })
})
