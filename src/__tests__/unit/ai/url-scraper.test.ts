/**
 * Unit Tests: URL Scraper — SSRF prevention, URL validation, content extraction
 * TC-IDs from: docs/testcases/url-to-website.md
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    validateUrl,
    resolveAndValidate,
    extractMetadata,
    extractMainContent,
    extractStructure,
    preprocessForAI,
    type ScrapeResult,
} from '@/lib/ai/url-scraper'

// ── Mock dns ─────────────────────────────────────────────────────────────
const mockLookup = vi.fn()

vi.mock('dns/promises', () => ({
    default: {
        lookup: (...args: unknown[]) => mockLookup(...args),
    },
    lookup: (...args: unknown[]) => mockLookup(...args),
}))

beforeEach(() => {
    vi.clearAllMocks()
})

// ── URL Validation ───────────────────────────────────────────────────────

describe('validateUrl', () => {
    // TC-URL-001: Valid HTTPS URL accepted
    it('TC-URL-001: accepts valid HTTPS URL', () => {
        const url = validateUrl('https://example.com')
        expect(url).toBeInstanceOf(URL)
        expect(url.href).toBe('https://example.com/')
    })

    // TC-URL-002: HTTP URL accepted
    it('TC-URL-002: accepts valid HTTP URL', () => {
        const url = validateUrl('http://example.com')
        expect(url.protocol).toBe('http:')
    })

    // TC-URL-003: Invalid URL format rejected
    it('TC-URL-003: rejects invalid URL format', () => {
        expect(() => validateUrl('')).toThrow('Invalid URL format')
        expect(() => validateUrl('abc')).toThrow('Invalid URL format')
        expect(() => validateUrl('not-a-url')).toThrow('Invalid URL format')
    })

    // TC-URL-004: Non-HTTP protocol rejected
    it('TC-URL-004: rejects non-HTTP protocols', () => {
        expect(() => validateUrl('ftp://files.com')).toThrow('Invalid protocol')
        expect(() => validateUrl('file:///etc/passwd')).toThrow('Invalid protocol')
    })

    // TC-URL-005: URL with credentials rejected
    it('TC-URL-005: rejects URL with embedded credentials', () => {
        expect(() => validateUrl('https://admin:pass@evil.com')).toThrow('Credentials in URL are not allowed')
    })

    // TC-URL-006: Non-standard port rejected
    it('TC-URL-006: rejects non-standard ports', () => {
        expect(() => validateUrl('https://evil.com:8080')).toThrow('Non-standard ports are not allowed')
        expect(() => validateUrl('https://evil.com:3000')).toThrow('Non-standard ports are not allowed')
    })

    // TC-URL-007: URL > 2048 chars — validated at Zod level, not here
    it('TC-URL-007: accepts standard ports 80, 443', () => {
        expect(validateUrl('https://example.com:443')).toBeInstanceOf(URL)
        expect(validateUrl('http://example.com:80')).toBeInstanceOf(URL)
    })
})

// ── SSRF Prevention ──────────────────────────────────────────────────────

describe('resolveAndValidate', () => {
    // TC-URL-008: Loopback IP blocked (127.0.0.1)
    it('TC-URL-008: blocks loopback IP 127.0.0.1', async () => {
        mockLookup.mockResolvedValue({ address: '127.0.0.1' })
        await expect(resolveAndValidate('evil.com')).rejects.toThrow('blocked IP range')
    })

    // TC-URL-009: RFC1918 blocked (10.x)
    it('TC-URL-009: blocks RFC1918 private IP 10.x.x.x', async () => {
        mockLookup.mockResolvedValue({ address: '10.0.0.1' })
        await expect(resolveAndValidate('target.com')).rejects.toThrow('blocked IP range')
    })

    // TC-URL-010: RFC1918 blocked (172.16-31.x)
    it('TC-URL-010: blocks RFC1918 private IP 172.16.x.x', async () => {
        mockLookup.mockResolvedValue({ address: '172.16.0.1' })
        await expect(resolveAndValidate('target.com')).rejects.toThrow('blocked IP range')
    })

    // TC-URL-011: RFC1918 blocked (192.168.x)
    it('TC-URL-011: blocks RFC1918 private IP 192.168.x.x', async () => {
        mockLookup.mockResolvedValue({ address: '192.168.1.1' })
        await expect(resolveAndValidate('target.com')).rejects.toThrow('blocked IP range')
    })

    // TC-URL-013: Link-local blocked (169.254.x)
    it('TC-URL-013: blocks link-local IP 169.254.x.x', async () => {
        mockLookup.mockResolvedValue({ address: '169.254.1.1' })
        await expect(resolveAndValidate('target.com')).rejects.toThrow('blocked IP range')
    })

    // TC-URL-014: IPv6 loopback blocked (::1)
    it('TC-URL-014: blocks IPv6 loopback ::1', async () => {
        mockLookup.mockResolvedValue({ address: '::1' })
        await expect(resolveAndValidate('target.com')).rejects.toThrow('blocked IP range')
    })

    it('allows public IP addresses', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34' })
        await expect(resolveAndValidate('example.com')).resolves.toBeUndefined()
    })

    it('throws when DNS resolution fails', async () => {
        mockLookup.mockRejectedValue(new Error('ENOTFOUND'))
        await expect(resolveAndValidate('nonexistent.invalid')).rejects.toThrow('Could not resolve hostname')
    })
})

// ── Metadata Extraction ──────────────────────────────────────────────────

describe('extractMetadata', () => {
    // TC-URL-022: Meta tags extracted correctly
    it('TC-URL-022: extracts title, description, OG image from HTML', async () => {
        const html = `
            <html lang="ms">
            <head>
                <title>Kedai Kopi ABC</title>
                <meta name="description" content="Kedai kopi terbaik di KL">
                <meta property="og:image" content="https://example.com/og.jpg">
                <meta property="og:site_name" content="Kopi ABC">
                <meta name="theme-color" content="#FF5722">
            </head>
            <body><h1>Welcome</h1></body>
            </html>
        `
        const meta = await extractMetadata(html, 'https://kedai-kopi.com')

        expect(meta.title).toBe('Kedai Kopi ABC')
        expect(meta.description).toBe('Kedai kopi terbaik di KL')
        expect(meta.locale).toBe('ms')
        expect(meta.themeColor).toBe('#FF5722')
    })

    it('handles HTML without meta tags gracefully', async () => {
        const html = '<html><head></head><body>Hello</body></html>'
        const meta = await extractMetadata(html, 'https://example.com')

        expect(meta.title).toBe('')
        expect(meta.description).toBe('')
        expect(meta.locale).toBeNull()
    })
})

// ── Main Content Extraction ──────────────────────────────────────────────

describe('extractMainContent', () => {
    // TC-URL-023: Main content extracted via Readability
    it('TC-URL-023: extracts main text from article-like content', () => {
        const html = `
            <html>
            <head><title>Test</title></head>
            <body>
                <article>
                    <h1>About Our Business</h1>
                    <p>We are a leading provider of quality services in Malaysia. Our team has over 10 years of experience serving customers across Southeast Asia. We specialize in web development, digital marketing, and e-commerce solutions.</p>
                    <p>Our mission is to help small businesses grow online with affordable and professional websites.</p>
                </article>
            </body>
            </html>
        `
        const result = extractMainContent(html, 'https://example.com')

        expect(result.mainText).toContain('leading provider')
        expect(result.mainText.length).toBeGreaterThan(100)
        expect(result.excerpt.length).toBeGreaterThan(0)
    })

    it('falls back to body text when Readability fails', () => {
        const html = '<html><body><p>Simple page content</p></body></html>'
        const result = extractMainContent(html, 'https://example.com')

        expect(result.mainText).toContain('Simple page content')
    })
})

// ── Structure Extraction ─────────────────────────────────────────────────

describe('extractStructure', () => {
    it('extracts headings h1-h3', () => {
        const html = `
            <html><body>
                <h1>Main Title</h1>
                <h2>Section One</h2>
                <h3>Subsection</h3>
                <h4>Should not be included</h4>
            </body></html>
        `
        const { headings } = extractStructure(html)

        expect(headings).toContain('Main Title')
        expect(headings).toContain('Section One')
        expect(headings).toContain('Subsection')
        expect(headings).not.toContain('Should not be included')
    })

    it('extracts nav links from <nav> and <header>', () => {
        const html = `
            <html><body>
                <nav>
                    <a href="/">Home</a>
                    <a href="/about">About</a>
                    <a href="/contact">Contact</a>
                </nav>
            </body></html>
        `
        const { navLinks } = extractStructure(html)

        expect(navLinks).toHaveLength(3)
        expect(navLinks[0]).toEqual({ label: 'Home', url: '/' })
    })

    it('limits headings to 50 and navLinks to 30', () => {
        const headings = Array.from({ length: 60 }, (_, i) => `<h2>H${i}</h2>`).join('')
        const html = `<html><body>${headings}</body></html>`
        const result = extractStructure(html)

        expect(result.headings.length).toBeLessThanOrEqual(50)
    })
})

// ── Preprocess for AI ────────────────────────────────────────────────────

describe('preprocessForAI', () => {
    // TC-URL-013: preprocessForAI truncates to ~6500 chars
    it('TC-URL-013: truncates long content to within limits', () => {
        const meta: ScrapeResult['meta'] = {
            title: 'Test Business',
            description: 'A great business',
            ogImage: null,
            siteName: 'TestBiz',
            locale: 'en',
            themeColor: '#FF0000',
        }
        const content: ScrapeResult['content'] = {
            headings: ['Heading 1', 'Heading 2'],
            mainText: 'A'.repeat(10000),
            excerpt: 'Short excerpt',
            navLinks: [{ label: 'Home', url: '/' }],
        }

        const html = '<html><body><p>' + 'A'.repeat(10000) + '</p></body></html>'
        const result = preprocessForAI(meta, content, html, 'https://example.com')

        // v2: Meta (1500) + body (12000) + sections → capped at ~19500
        expect(result.length).toBeLessThanOrEqual(20000)
        expect(result).toContain('--- META ---')
        expect(result).toContain('--- MAIN CONTENT ---')
        expect(result).toContain('Test Business')
    })

    it('includes meta header fields', () => {
        const meta: ScrapeResult['meta'] = {
            title: 'Kedai Kopi',
            description: 'Best coffee in KL',
            ogImage: null,
            siteName: null,
            locale: 'ms',
            themeColor: '#8B4513',
        }
        const content: ScrapeResult['content'] = {
            headings: ['Welcome', 'Menu'],
            mainText: 'We serve the best coffee.',
            excerpt: '',
            navLinks: [{ label: 'Home', url: '/' }, { label: 'Menu', url: '/menu' }],
        }

        const result = preprocessForAI(meta, content)

        expect(result).toContain('Title: Kedai Kopi')
        expect(result).toContain('Language: ms')
        expect(result).toContain('Theme Color: #8B4513')
        expect(result).toContain('Headings: Welcome | Menu')
        expect(result).toContain('Navigation: Home, Menu')
    })
})

// ── Content Safety ───────────────────────────────────────────────────────

describe('content safety integration', () => {
    it('checkUrlSafety blocks localhost', async () => {
        const { checkUrlSafety } = await import('@/lib/ai/content-safety')

        expect(checkUrlSafety('http://localhost/admin').safe).toBe(false)
        expect(checkUrlSafety('http://127.0.0.1').safe).toBe(false)
        expect(checkUrlSafety('http://0.0.0.0').safe).toBe(false)
    })

    it('checkUrlSafety allows valid URLs', async () => {
        const { checkUrlSafety } = await import('@/lib/ai/content-safety')

        expect(checkUrlSafety('https://example.com').safe).toBe(true)
        expect(checkUrlSafety('https://kedai-kopi.com.my').safe).toBe(true)
    })

    it('checkScrapedContentSafety blocks unsafe content', async () => {
        const { checkScrapedContentSafety } = await import('@/lib/ai/content-safety')

        expect(checkScrapedContentSafety('normal business content').safe).toBe(true)
        expect(checkScrapedContentSafety('buy cocaine here').safe).toBe(false)
    })
})
