/**
 * URL Scraper — Extracts business info from a website URL.
 *
 * Pipeline:  validateUrl → resolveAndValidate (SSRF) → fetchWithSafeguards
 *            → extractMetadata (OGS) → extractMainContent (Readability)
 *            → extractStructure (cheerio) → preprocessForAI
 *
 * Security:  SSRF prevention via DNS resolve + private IP blocklist.
 */

import dns from 'dns/promises'
import * as cheerio from 'cheerio'
import ogs from 'open-graph-scraper'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

// ── Types ────────────────────────────────────────────────────────────────

export type ScrapeResult = {
    url: string
    meta: {
        title: string
        description: string
        ogImage: string | null
        siteName: string | null
        locale: string | null
        themeColor: string | null
    }
    content: {
        headings: string[]
        mainText: string
        excerpt: string
        navLinks: { label: string; url: string }[]
    }
    raw: {
        preprocessedText: string
        charCount: number
    }
    confidence: 'high' | 'medium' | 'low'
    warnings: string[]
}

// ── Constants ────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_BODY_CHARS = 6_000
const MAX_META_CHARS = 500
const MAX_REDIRECTS = 3

const BLOCKED_IP_RANGES = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
]

// ── URL Validation ───────────────────────────────────────────────────────

export function validateUrl(input: string): URL {
    let url: URL
    try {
        url = new URL(input)
    } catch {
        throw new Error('Invalid URL format')
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid protocol — only HTTP and HTTPS are allowed')
    }
    if (url.username || url.password) {
        throw new Error('Credentials in URL are not allowed')
    }
    if (url.port && !['80', '443', ''].includes(url.port)) {
        throw new Error('Non-standard ports are not allowed')
    }

    return url
}

// ── SSRF Prevention ──────────────────────────────────────────────────────

export async function resolveAndValidate(hostname: string): Promise<void> {
    let address: string
    try {
        const result = await dns.lookup(hostname)
        address = result.address
    } catch {
        throw new Error(`Could not resolve hostname: ${hostname}`)
    }

    if (BLOCKED_IP_RANGES.some((r) => r.test(address))) {
        throw new Error('URL resolves to a blocked IP range')
    }
}

// ── Fetch with Safeguards ────────────────────────────────────────────────

export async function fetchWithSafeguards(url: URL): Promise<string> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
        const response = await fetch(url.href, {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'ECHPrimeBot/1.0 (website-analyzer)',
                Accept: 'text/html,application/xhtml+xml',
            },
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            throw new Error('URL does not point to a web page (non-HTML content)')
        }

        const contentLength = response.headers.get('content-length')
        if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
            throw new Error('Response too large (exceeds 5 MB)')
        }

        const html = await response.text()
        if (html.length > MAX_RESPONSE_BYTES) {
            throw new Error('Response too large (exceeds 5 MB)')
        }

        // Validate final URL after redirects (SSRF: redirect to private IP)
        const finalUrl = response.url || url.href
        if (finalUrl !== url.href) {
            const redirectedUrl = new URL(finalUrl)
            await resolveAndValidate(redirectedUrl.hostname)
        }

        return html
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Request timed out (10 seconds)')
        }
        throw error
    } finally {
        clearTimeout(timeout)
    }
}

// ── Metadata Extraction ──────────────────────────────────────────────────

export async function extractMetadata(html: string, url: string): Promise<ScrapeResult['meta']> {
    const $ = cheerio.load(html)

    // Try open-graph-scraper first
    let ogResult: Record<string, unknown> = {}
    try {
        const { result } = await ogs({ html })
        ogResult = result as Record<string, unknown>
    } catch {
        // OGS failure is non-fatal — fall back to cheerio
    }

    // Extract theme-color from meta tags
    const themeColor =
        $('meta[name="theme-color"]').attr('content') ||
        $('meta[name="msapplication-TileColor"]').attr('content') ||
        null

    // Extract locale from html lang attribute
    const locale = $('html').attr('lang') || null

    return {
        title:
            String(ogResult.ogTitle || '') ||
            $('title').text().trim() ||
            $('meta[property="og:title"]').attr('content') ||
            '',
        description:
            String(ogResult.ogDescription || '') ||
            $('meta[name="description"]').attr('content') ||
            $('meta[property="og:description"]').attr('content') ||
            '',
        ogImage: String(
            (ogResult.ogImage as { url?: string } | undefined)?.url ||
            $('meta[property="og:image"]').attr('content') ||
            ''
        ) || null,
        siteName: String(ogResult.ogSiteName || '') || $('meta[property="og:site_name"]').attr('content') || null,
        locale,
        themeColor,
    }
}

// ── Main Content Extraction ──────────────────────────────────────────────

export function extractMainContent(html: string, url: string): { mainText: string; excerpt: string } {
    try {
        const dom = new JSDOM(html, { url })
        const reader = new Readability(dom.window.document)
        const article = reader.parse()

        if (article && article.textContent) {
            return {
                mainText: article.textContent.trim(),
                excerpt: article.excerpt?.trim() || article.textContent.slice(0, 200).trim(),
            }
        }
    } catch {
        // Readability failure is non-fatal
    }

    // Fallback: extract text from body
    const $ = cheerio.load(html)
    $('script, style, noscript, svg, iframe').remove()
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim()

    return {
        mainText: bodyText,
        excerpt: bodyText.slice(0, 200),
    }
}

// ── Structure Extraction ─────────────────────────────────────────────────

export function extractStructure(html: string): {
    headings: string[]
    navLinks: { label: string; url: string }[]
} {
    const $ = cheerio.load(html)

    // Extract headings (h1-h3)
    const headings: string[] = []
    $('h1, h2, h3').each((_, el) => {
        const text = $(el).text().trim()
        if (text && text.length > 1 && text.length < 200) {
            headings.push(text)
        }
    })

    // Extract nav links
    const navLinks: { label: string; url: string }[] = []
    $('nav a, header a').each((_, el) => {
        const label = $(el).text().trim()
        const href = $(el).attr('href') || ''
        if (label && label.length > 0 && label.length < 100 && href) {
            navLinks.push({ label, url: href })
        }
    })

    return {
        headings: headings.slice(0, 20),
        navLinks: navLinks.slice(0, 15),
    }
}

// ── Preprocess for AI ────────────────────────────────────────────────────

export function preprocessForAI(meta: ScrapeResult['meta'], content: ScrapeResult['content']): string {
    const metaHeader = [
        meta.title ? `Title: ${meta.title}` : '',
        meta.description ? `Description: ${meta.description}` : '',
        meta.siteName ? `Site: ${meta.siteName}` : '',
        meta.locale ? `Language: ${meta.locale}` : '',
        meta.themeColor ? `Theme Color: ${meta.themeColor}` : '',
        content.headings.length > 0 ? `Headings: ${content.headings.slice(0, 10).join(' | ')}` : '',
        content.navLinks.length > 0
            ? `Navigation: ${content.navLinks.slice(0, 8).map((l) => l.label).join(', ')}`
            : '',
    ]
        .filter(Boolean)
        .join('\n')
        .slice(0, MAX_META_CHARS)

    const bodyText = content.mainText.replace(/\s+/g, ' ').trim().slice(0, MAX_BODY_CHARS)

    return `--- META ---\n${metaHeader}\n\n--- CONTENT ---\n${bodyText}`
}

// ── Confidence Scoring ───────────────────────────────────────────────────

function calculateConfidence(meta: ScrapeResult['meta'], content: ScrapeResult['content']): {
    confidence: 'high' | 'medium' | 'low'
    warnings: string[]
} {
    const warnings: string[] = []
    let score = 0

    if (meta.title) score++
    else warnings.push('Could not extract page title')

    if (meta.description) score++
    else warnings.push('Could not extract page description')

    if (content.mainText.length > 500) score++
    else if (content.mainText.length > 100) {
        score += 0.5
        warnings.push('Limited text content found on this page')
    } else {
        warnings.push('Very little text content found — this may be an image-heavy or SPA site')
    }

    if (content.headings.length > 0) score++
    else warnings.push('No headings found on the page')

    if (score >= 3) return { confidence: 'high', warnings }
    if (score >= 1.5) return { confidence: 'medium', warnings }
    return { confidence: 'low', warnings }
}

// ── Main Entry Point ─────────────────────────────────────────────────────

export async function scrapeUrl(urlString: string): Promise<ScrapeResult> {
    // Step 1: Validate URL
    const url = validateUrl(urlString)

    // Step 2: SSRF check
    await resolveAndValidate(url.hostname)

    // Step 3: Fetch with safeguards
    const html = await fetchWithSafeguards(url)

    // Step 4: Extract metadata
    const meta = await extractMetadata(html, url.href)

    // Step 5: Extract main content
    const mainContent = extractMainContent(html, url.href)

    // Step 6: Extract structure
    const structure = extractStructure(html)

    const content: ScrapeResult['content'] = {
        headings: structure.headings,
        mainText: mainContent.mainText,
        excerpt: mainContent.excerpt,
        navLinks: structure.navLinks,
    }

    // Step 7: Preprocess for AI
    const preprocessedText = preprocessForAI(meta, content)

    // Step 8: Calculate confidence
    const { confidence, warnings } = calculateConfidence(meta, content)

    return {
        url: url.href,
        meta,
        content,
        raw: {
            preprocessedText,
            charCount: preprocessedText.length,
        },
        confidence,
        warnings,
    }
}
