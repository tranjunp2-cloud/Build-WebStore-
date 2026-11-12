/**
 * Unit Tests: URL Scraper — fetchWithSafeguards and scrapeUrl integration
 * TC-IDs from: docs/testcases/url-to-website.md
 * Convention: docs/TEST_CONVENTION.md
 *
 * Covers lines 104-153 (fetchWithSafeguards) and 318-361 (scrapeUrl pipeline)
 * which were 0% covered in the previous run.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock dns (must be at top) ─────────────────────────────────────────────────

const mockLookup = vi.fn()

vi.mock('dns/promises', () => ({
    default: {
        lookup: (...args: unknown[]) => mockLookup(...args),
    },
    lookup: (...args: unknown[]) => mockLookup(...args),
}))

// ── Mock open-graph-scraper ──────────────────────────────────────────────────

vi.mock('open-graph-scraper', () => ({
    default: vi.fn().mockResolvedValue({ result: {} }),
}))

import { fetchWithSafeguards, scrapeUrl, validateUrl } from '@/lib/ai/url-scraper'

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildMockResponse(overrides: Partial<{
    ok: boolean
    status: number
    statusText: string
    contentType: string
    contentLength: string | null
    html: string
    url: string
}> = {}) {
    const {
        ok = true,
        status = 200,
        statusText = 'OK',
        contentType = 'text/html; charset=utf-8',
        contentLength = null,
        html = '<html><head><title>Test</title></head><body><h1>Hello</h1><p>Content here.</p></body></html>',
        url: responseUrl = '',
    } = overrides

    return {
        ok,
        status,
        statusText,
        url: responseUrl,
        headers: {
            get: (name: string) => {
                if (name === 'content-type') return contentType
                if (name === 'content-length') return contentLength
                return null
            },
        },
        text: vi.fn().mockResolvedValue(html),
        // the scraper reads the body as a stream (byte cap while it arrives)
        body: new Response(html).body,
    }
}

// ── fetchWithSafeguards ───────────────────────────────────────────────────────

describe('fetchWithSafeguards', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        vi.clearAllMocks()
        // Default DNS: public IP
        mockLookup.mockResolvedValue({ address: '93.184.216.34' })
        fetchSpy = vi.spyOn(global, 'fetch')
    })

    afterEach(() => {
        fetchSpy.mockRestore()
    })

    // TC-URL-015: Valid HTML page fetched successfully
    it('TC-URL-015: returns HTML string for a valid HTML response', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(buildMockResponse({ html: '<html><body>Hello World</body></html>' }) as unknown as Response)

        // Act
        const url = validateUrl('https://example.com')
        const result = await fetchWithSafeguards(url)

        // Assert
        expect(result).toContain('Hello World')
    })

    // TC-URL-016: Non-200 status throws
    it('TC-URL-016: throws on non-2xx HTTP status', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(buildMockResponse({ ok: false, status: 404, statusText: 'Not Found' }) as unknown as Response)

        // Act & Assert
        const url = validateUrl('https://example.com')
        await expect(fetchWithSafeguards(url)).rejects.toThrow('HTTP 404')
    })

    // TC-URL-017: Non-HTML content type rejected
    it('TC-URL-017: throws when content-type is not HTML', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(buildMockResponse({ contentType: 'application/json' }) as unknown as Response)

        // Act & Assert
        const url = validateUrl('https://api.example.com')
        await expect(fetchWithSafeguards(url)).rejects.toThrow('non-HTML content')
    })

    // TC-URL-018: PDF content type rejected
    it('TC-URL-018: throws when content-type is PDF', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(buildMockResponse({ contentType: 'application/pdf' }) as unknown as Response)

        // Act & Assert
        const url = validateUrl('https://example.com/file.pdf')
        await expect(fetchWithSafeguards(url)).rejects.toThrow('non-HTML content')
    })

    // TC-URL-019: content-length too large rejected
    it('TC-URL-019: throws when content-length exceeds 5 MB', async () => {
        // Arrange — 6 MB content-length
        fetchSpy.mockResolvedValue(buildMockResponse({
            contentLength: String(6 * 1024 * 1024),
        }) as unknown as Response)

        // Act & Assert
        const url = validateUrl('https://heavy-site.com')
        await expect(fetchWithSafeguards(url)).rejects.toThrow('Response too large')
    })

    // TC-URL-020: Response body too large rejected
    it('TC-URL-020: throws when response body exceeds 5 MB', async () => {
        // Arrange — body larger than 5 MB
        const bigHtml = 'x'.repeat(6 * 1024 * 1024)
        fetchSpy.mockResolvedValue(buildMockResponse({ html: bigHtml }) as unknown as Response)

        // Act & Assert
        const url = validateUrl('https://huge-site.com')
        await expect(fetchWithSafeguards(url)).rejects.toThrow('Response too large')
    })

    // TC-URL-021: Request timeout
    it('TC-URL-021: throws "Request timed out" when fetch is aborted', async () => {
        // Arrange — simulate AbortError
        const abortError = new Error('The operation was aborted')
        abortError.name = 'AbortError'
        fetchSpy.mockRejectedValue(abortError)

        // Act & Assert
        const url = validateUrl('https://slow-site.com')
        await expect(fetchWithSafeguards(url)).rejects.toThrow('Request timed out')
    })

    // TC-URL-022: XHTML content type accepted
    it('TC-URL-022: accepts application/xhtml content type', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(buildMockResponse({
            contentType: 'application/xhtml+xml',
            html: '<html><body>XHTML page</body></html>',
        }) as unknown as Response)

        // Act
        const url = validateUrl('https://xhtml-site.com')
        const result = await fetchWithSafeguards(url)

        // Assert
        expect(result).toContain('XHTML page')
    })

    // TC-URL-023: non-AbortError re-thrown as-is
    it('TC-URL-023: re-throws non-abort errors unchanged', async () => {
        // Arrange
        fetchSpy.mockRejectedValue(new Error('Network connection refused'))

        // Act & Assert
        const url = validateUrl('https://down-site.com')
        await expect(fetchWithSafeguards(url)).rejects.toThrow('Network connection refused')
    })
})

// ── scrapeUrl — full pipeline ─────────────────────────────────────────────────

describe('scrapeUrl', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>

    const SAMPLE_HTML = `
        <html lang="en">
        <head>
            <title>Kedai Kopi ABC</title>
            <meta name="description" content="Best coffee shop in KL.">
            <meta property="og:site_name" content="Kopi ABC">
            <meta name="theme-color" content="#8B4513">
        </head>
        <body>
            <header>
                <nav>
                    <a href="/">Home</a>
                    <a href="/menu">Menu</a>
                    <a href="/about">About</a>
                </nav>
            </header>
            <main>
                <h1>Welcome to Kedai Kopi ABC</h1>
                <h2>Our Menu</h2>
                <p>We serve the finest coffee and traditional Malaysian breakfast in Kuala Lumpur.
                   Our signature Kopi-O and Teh Tarik have been loved by locals for over 20 years.
                   Visit us daily from 7am to 3pm for fresh brewed coffee and warm toasts.</p>
            </main>
        </body>
        </html>
    `

    beforeEach(() => {
        vi.clearAllMocks()
        // DNS resolves to public IP
        mockLookup.mockResolvedValue({ address: '93.184.216.34' })
        fetchSpy = vi.spyOn(global, 'fetch')
        fetchSpy.mockResolvedValue(buildMockResponse({ html: SAMPLE_HTML }) as unknown as Response)
    })

    afterEach(() => {
        fetchSpy.mockRestore()
    })

    // TC-URL-024: Full pipeline returns ScrapeResult
    it('TC-URL-024: returns complete ScrapeResult structure for valid URL', async () => {
        // Act
        const result = await scrapeUrl('https://kedai-kopi.com')

        // Assert — all fields present
        expect(result.url).toBe('https://kedai-kopi.com/')
        expect(result.meta).toBeDefined()
        expect(result.content).toBeDefined()
        expect(result.raw).toBeDefined()
        expect(result.confidence).toMatch(/^(high|medium|low)$/)
        expect(Array.isArray(result.warnings)).toBe(true)
    })

    // TC-URL-025: URL normalized to absolute form
    it('TC-URL-025: normalizes URL with trailing slash', async () => {
        // Act
        const result = await scrapeUrl('https://example.com')

        // Assert
        expect(result.url).toBe('https://example.com/')
    })

    // TC-URL-026: metadata extracted from page
    it('TC-URL-026: extracts title and description from HTML', async () => {
        // Act
        const result = await scrapeUrl('https://kedai-kopi.com')

        // Assert
        expect(result.meta.title).toBe('Kedai Kopi ABC')
        expect(result.meta.description).toContain('coffee')
    })

    // TC-URL-027: nav links extracted from header/nav
    it('TC-URL-027: extracts navigation links from header', async () => {
        // Act
        const result = await scrapeUrl('https://kedai-kopi.com')

        // Assert
        expect(result.content.navLinks.length).toBeGreaterThan(0)
        expect(result.content.navLinks.some(l => l.label === 'Home')).toBe(true)
    })

    // TC-URL-028: headings extracted
    it('TC-URL-028: extracts h1 and h2 headings', async () => {
        // Act
        const result = await scrapeUrl('https://kedai-kopi.com')

        // Assert
        expect(result.content.headings).toContain('Welcome to Kedai Kopi ABC')
        expect(result.content.headings).toContain('Our Menu')
    })

    // TC-URL-029: preprocessed text contains META and CONTENT sections
    it('TC-URL-029: raw.preprocessedText contains META and CONTENT sections', async () => {
        // Act
        const result = await scrapeUrl('https://kedai-kopi.com')

        // Assert
        expect(result.raw.preprocessedText).toContain('--- META ---')
        expect(result.raw.preprocessedText).toContain('--- MAIN CONTENT ---')
        expect(result.raw.charCount).toBeGreaterThan(0)
    })

    // TC-URL-030: confidence is "high" when title + description + content + headings present
    it('TC-URL-030: confidence is "high" for content-rich page', async () => {
        // Act
        const result = await scrapeUrl('https://kedai-kopi.com')

        // Assert — high confidence for pages with title + description + headings + text
        expect(result.confidence).toBe('high')
        // warnings may include OGS-related notes but confidence still high
        expect(result.confidence).not.toBe('low')
    })

    // TC-URL-031: blocked private IP throws from scrapeUrl
    it('TC-URL-031: throws when URL resolves to private IP', async () => {
        // Arrange — DNS returns loopback
        mockLookup.mockResolvedValue({ address: '127.0.0.1' })

        // Act & Assert
        await expect(scrapeUrl('https://internal.corp')).rejects.toThrow('blocked IP range')
    })

    // TC-URL-032: invalid URL format throws from scrapeUrl
    it('TC-URL-032: throws for invalid URL format', async () => {
        // Act & Assert
        await expect(scrapeUrl('not-a-url')).rejects.toThrow('Invalid URL format')
    })

    // TC-URL-033: low confidence for minimal content page
    it('TC-URL-033: returns low confidence for near-empty pages', async () => {
        // Arrange — minimal HTML with no title/description/headings/content
        const sparseHtml = '<html><body><p>Hi</p></body></html>'
        fetchSpy.mockResolvedValue(buildMockResponse({ html: sparseHtml }) as unknown as Response)

        // Act
        const result = await scrapeUrl('https://sparse.com')

        // Assert
        expect(result.confidence).toBe('low')
        expect(result.warnings.length).toBeGreaterThan(0)
    })

    // TC-URL-034: low confidence warning when page has very little text content
    it('TC-URL-034: returns low confidence for page with almost no text content', async () => {
        // Arrange — page with no title, no description, and minimal text
        const thinHtml = `
            <html>
            <head></head>
            <body><p>Hi</p></body>
            </html>
        `
        fetchSpy.mockResolvedValue(buildMockResponse({ html: thinHtml }) as unknown as Response)

        // Act
        const result = await scrapeUrl('https://thin-content.com')

        // Assert — no title, no description, no headings, tiny content = low
        expect(result.confidence).toBe('low')
        expect(result.warnings.length).toBeGreaterThan(0)
    })
})
