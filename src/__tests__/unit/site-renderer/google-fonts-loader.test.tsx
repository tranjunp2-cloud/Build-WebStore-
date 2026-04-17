import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import React from 'react'

import { GoogleFontsLoader } from '@/components/site-renderer/GoogleFontsLoader'

// ── Helpers ───────────────────────────────────────────────────────────────
//
// React 19 hoists <link> elements to <head>. After cleanup they persist
// in <head> until manually removed. We query document-wide to find them.

function getAllLinks(): HTMLLinkElement[] {
    return Array.from(document.querySelectorAll('link'))
}

function getStylesheetHref(): string {
    const link = document.querySelector('link[rel="stylesheet"]')
    return link?.getAttribute('href') ?? ''
}

// ═══════════════════════════════════════════════════════════════════════════

describe('[TC-F04.13] GoogleFontsLoader — Font URL Generation', () => {
    beforeEach(() => {
        document.querySelectorAll('link').forEach((el) => el.remove())
    })

    afterEach(() => {
        cleanup()
        document.querySelectorAll('link').forEach((el) => el.remove())
    })

    it('TC-F04.13-01: renders preconnect + stylesheet links', () => {
        render(<GoogleFontsLoader />)
        const links = getAllLinks()
        const preconnects = links.filter((l) => l.rel === 'preconnect')
        const stylesheets = links.filter((l) => l.rel === 'stylesheet')
        expect(preconnects.length).toBeGreaterThanOrEqual(1)
        expect(stylesheets).toHaveLength(1)
    })

    it('TC-F04.13-02: has preconnect to fonts.googleapis.com', () => {
        render(<GoogleFontsLoader />)
        const link = document.querySelector('link[rel="preconnect"][href="https://fonts.googleapis.com"]')
        expect(link).toBeTruthy()
    })

    it('TC-F04.13-03: has preconnect to fonts.gstatic.com', () => {
        render(<GoogleFontsLoader />)
        const link = document.querySelector('link[href="https://fonts.gstatic.com"]')
        expect(link).toBeTruthy()
    })

    it('TC-F04.13-04: has stylesheet link to Google Fonts API', () => {
        render(<GoogleFontsLoader />)
        const href = getStylesheetHref()
        expect(href).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?/)
    })

    it('TC-F04.13-05: uses Outfit as default heading font', () => {
        render(<GoogleFontsLoader />)
        expect(getStylesheetHref()).toContain('family=Outfit')
    })

    it('TC-F04.13-06: uses Inter as default body font', () => {
        render(<GoogleFontsLoader />)
        expect(getStylesheetHref()).toContain('family=Inter')
    })

    it('TC-F04.13-07: default URL contains both Outfit and Inter', () => {
        render(<GoogleFontsLoader />)
        const matches = getStylesheetHref().match(/family=/g) ?? []
        expect(matches).toHaveLength(2)
    })

    it('TC-F04.13-08: includes custom fontHeading in URL', () => {
        render(<GoogleFontsLoader fontHeading="Poppins" />)
        expect(getStylesheetHref()).toContain('family=Poppins')
    })

    it('TC-F04.13-09: includes custom fontBody in URL', () => {
        render(<GoogleFontsLoader fontHeading="Poppins" fontBody="Lato" />)
        expect(getStylesheetHref()).toContain('family=Lato')
    })

    it('TC-F04.13-10: custom fonts replace defaults', () => {
        render(<GoogleFontsLoader fontHeading="Poppins" fontBody="Lato" />)
        const href = getStylesheetHref()
        expect(href).not.toContain('family=Outfit')
        expect(href).not.toContain('family=Inter')
    })

    it('TC-F04.13-11: deduplicates when heading === body', () => {
        render(<GoogleFontsLoader fontHeading="Roboto" fontBody="Roboto" />)
        const matches = getStylesheetHref().match(/family=Roboto/g) ?? []
        expect(matches).toHaveLength(1)
    })

    it('TC-F04.13-12: still renders stylesheet when deduplicated', () => {
        render(<GoogleFontsLoader fontHeading="Roboto" fontBody="Roboto" />)
        const stylesheets = getAllLinks().filter((l) => l.rel === 'stylesheet')
        expect(stylesheets).toHaveLength(1)
    })

    it('TC-F04.13-13: encodes spaces as + in font names', () => {
        render(<GoogleFontsLoader fontHeading="Playfair Display" fontBody="Source Sans Pro" />)
        const href = getStylesheetHref()
        expect(href).toContain('family=Playfair+Display')
        expect(href).toContain('family=Source+Sans+Pro')
    })

    it('TC-F04.13-14: single-word font names need no encoding', () => {
        render(<GoogleFontsLoader fontHeading="Merriweather" fontBody="Nunito" />)
        const href = getStylesheetHref()
        expect(href).toContain('family=Merriweather')
        expect(href).toContain('family=Nunito')
    })

    it('TC-F04.13-15: URL includes Vietnamese subset', () => {
        render(<GoogleFontsLoader />)
        expect(getStylesheetHref()).toContain('subset=latin,vietnamese')
    })

    it('TC-F04.13-16: Vietnamese subset with custom fonts', () => {
        render(<GoogleFontsLoader fontHeading="Poppins" fontBody="Lato" />)
        expect(getStylesheetHref()).toContain('subset=latin,vietnamese')
    })

    it('TC-F04.13-17: URL includes display=swap', () => {
        render(<GoogleFontsLoader />)
        expect(getStylesheetHref()).toContain('display=swap')
    })

    it('TC-F04.13-18: display=swap with deduplicated fonts', () => {
        render(<GoogleFontsLoader fontHeading="Roboto" fontBody="Roboto" />)
        expect(getStylesheetHref()).toContain('display=swap')
    })

    it('TC-F04.13-19: URL requests weight variants 300-900', () => {
        render(<GoogleFontsLoader />)
        expect(getStylesheetHref()).toContain('wght@300;400;500;600;700;800;900')
    })

    it('TC-F04.13-20: full URL for two distinct fonts', () => {
        render(<GoogleFontsLoader fontHeading="Poppins" fontBody="Lato" />)
        expect(getStylesheetHref()).toBe(
            'https://fonts.googleapis.com/css2?' +
            'family=Poppins:wght@300;400;500;600;700;800;900' +
            '&family=Lato:wght@300;400;500;600;700;800;900' +
            '&subset=latin,vietnamese&display=swap'
        )
    })

    it('TC-F04.13-21: full URL for deduplicated single font', () => {
        render(<GoogleFontsLoader fontHeading="Roboto" fontBody="Roboto" />)
        expect(getStylesheetHref()).toBe(
            'https://fonts.googleapis.com/css2?' +
            'family=Roboto:wght@300;400;500;600;700;800;900' +
            '&subset=latin,vietnamese&display=swap'
        )
    })

    // ── TC-F04.13-22 / 23: Empty string fallback ──────────────────────────────

    it('TC-F04.13-22: empty string fontHeading="" falls back to default Outfit', () => {
        // Arrange — empty string is falsy, component uses || 'Outfit'
        render(<GoogleFontsLoader fontHeading="" />)

        // Assert
        expect(getStylesheetHref()).toContain('family=Outfit')
    })

    it('TC-F04.13-23: empty string fontBody="" falls back to default Inter', () => {
        // Arrange — empty string is falsy, component uses || 'Inter'
        render(<GoogleFontsLoader fontBody="" />)

        // Assert
        expect(getStylesheetHref()).toContain('family=Inter')
    })

    // ── TC-F04.13-24: HTML injection in font name ─────────────────────────────

    it('TC-F04.13-24: font name with HTML/script tags is sanitized (no raw HTML in URL)', () => {
        render(<GoogleFontsLoader fontHeading='<script>alert(1)</script>' />)
        const href = getStylesheetHref()

        // Assert — script tags stripped by sanitizer
        expect(href).not.toContain('<script>')
        expect(href).not.toContain('</script>')
        expect(href).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?/)
    })

    // ── TC-F04.13-25: Ampersand in font name ─────────────────────────────────

    it('TC-F04.13-25: font name with ampersand does not break URL parameter boundary', () => {
        // Arrange — font name contains & which could split URL params if unhandled
        render(<GoogleFontsLoader fontHeading="Outfit & Co" />)
        const href = getStylesheetHref()

        // Assert — the ampersand must be encoded (as %26) so it does not
        // prematurely terminate the family= query parameter
        expect(href).not.toMatch(/family=Outfit & Co/)
        // The href must still contain "Outfit" as part of the family value
        expect(href).toContain('Outfit')
    })
})
