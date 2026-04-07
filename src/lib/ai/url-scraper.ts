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
    images: ExtractedImage[]
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
const MAX_BODY_CHARS = 15_000  // v2: increased from 6,000 for richer extraction
const MAX_META_CHARS = 1_500   // v2: increased from 500
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
        headings: headings.slice(0, 50),
        navLinks: navLinks.slice(0, 30),
    }
}

// ── Section Extraction (v2) ──────────────────────────────────────────────

export function extractSections(html: string): string {
    const dom = new JSDOM(html)
    const document = dom.window.document
    const sections: string[] = []

    document.querySelectorAll('section').forEach(section => {
        const heading = section.querySelector('h1,h2,h3')?.textContent?.trim()
        const text = section.querySelector('p')?.textContent?.trim()
        if (heading && heading.length > 1) sections.push(`[Section] ${heading}: ${text?.slice(0, 200) || ''}`)
    })

    document.querySelectorAll('.testimonial, .review, .quote, [class*="testimonial"], [class*="review"]').forEach(el => {
        const quote = el.querySelector('p, blockquote')?.textContent?.trim()
        const author = el.querySelector('.author, .name, cite')?.textContent?.trim()
        if (quote && quote.length > 10) sections.push(`[Testimonial] "${quote.slice(0, 200)}" — ${author || 'Anonymous'}`)
    })

    document.querySelectorAll('.pricing, [class*="price"], [class*="plan"]').forEach(el => {
        const name = el.querySelector('h2,h3,h4,.plan-name')?.textContent?.trim()
        const price = el.querySelector('.price, [class*="price"]')?.textContent?.trim()
        if (name || price) sections.push(`[Pricing] ${name || 'Plan'}: ${price || ''}`)
    })

    document.querySelectorAll('details, .faq, [class*="faq"], .accordion').forEach(el => {
        const question = el.querySelector('summary, .question, h3, h4')?.textContent?.trim()
        const answer = el.querySelector('p, .answer')?.textContent?.trim()
        if (question) sections.push(`[FAQ] Q: ${question} A: ${answer?.slice(0, 150) || ''}`)
    })

    document.querySelectorAll('.feature, .service, [class*="feature"], [class*="service"]').forEach(el => {
        const title = el.querySelector('h3,h4,.title')?.textContent?.trim()
        const desc = el.querySelector('p,.description')?.textContent?.trim()
        if (title && title.length > 1) sections.push(`[Feature] ${title}: ${desc?.slice(0, 150) || ''}`)
    })

    return sections.slice(0, 30).join('\n')
}

export function extractFooter(html: string): string {
    const dom = new JSDOM(html)
    const footer = dom.window.document.querySelector('footer')
    if (!footer) return ''
    const links = Array.from(footer.querySelectorAll('a'))
        .map(a => a.textContent?.trim())
        .filter((t): t is string => !!t && t.length > 0 && t.length < 100)
        .slice(0, 20)
    const copyright = footer.querySelector('[class*="copyright"], small')?.textContent?.trim()
    return `[Footer] Links: ${links.join(', ')}${copyright ? ` | ${copyright}` : ''}`
}

export function extractJsonLd(html: string): string {
    const dom = new JSDOM(html)
    const scripts = dom.window.document.querySelectorAll('script[type="application/ld+json"]')
    const items: string[] = []
    scripts.forEach(script => {
        try {
            const raw = JSON.parse(script.textContent || '')
            const dataItems = Array.isArray(raw) ? raw : raw['@graph'] ? raw['@graph'] : [raw]
            for (const data of dataItems) {
                if (!data || typeof data !== 'object') continue
                const type = data['@type']
                if (type === 'Organization' && data.name) items.push(`[Org] ${data.name}: ${(data.description || '').slice(0, 150)}`)
                if (type === 'Product' && data.name) items.push(`[Product] ${data.name}: ${data.offers?.price || ''}`)
                if (type === 'FAQPage' && Array.isArray(data.mainEntity)) {
                    for (const faq of data.mainEntity.slice(0, 10)) {
                        items.push(`[FAQ] ${faq.name || ''}: ${(faq.acceptedAnswer?.text || '').slice(0, 100)}`)
                    }
                }
            }
        } catch { /* ignore malformed JSON-LD */ }
    })
    return items.slice(0, 15).join('\n')
}

export type ExtractedImage = { url: string; alt: string; section: string }

export function extractImageUrls(html: string, baseUrl: string): ExtractedImage[] {
    const $ = cheerio.load(html)
    const images: ExtractedImage[] = []
    const seen = new Set<string>()
    $('img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || ''
        if (!src || src.startsWith('data:')) return
        let absoluteUrl: string
        try { absoluteUrl = new URL(src, baseUrl).href } catch { return }
        if (seen.has(absoluteUrl)) return
        seen.add(absoluteUrl)
        const alt = $(el).attr('alt')?.trim() || ''
        const parent = $(el).closest('section, [class*="hero"], [class*="about"], [class*="gallery"], header')
        const cls = parent.attr('class') || ''
        const section = cls.includes('hero') ? 'hero' : cls.includes('about') ? 'about' : cls.includes('gallery') ? 'gallery' : 'content'
        images.push({ url: absoluteUrl, alt, section })
    })
    return images.slice(0, 10)
}

// ── Preprocess for AI (v2 — enriched) ───────────────────────────────────

export function preprocessForAI(meta: ScrapeResult['meta'], content: ScrapeResult['content'], html?: string, baseUrl?: string): string {
    const metaHeader = [
        meta.title ? `Title: ${meta.title}` : '',
        meta.description ? `Description: ${meta.description}` : '',
        meta.siteName ? `Site: ${meta.siteName}` : '',
        meta.locale ? `Language: ${meta.locale}` : '',
        meta.themeColor ? `Theme Color: ${meta.themeColor}` : '',
        content.headings.length > 0 ? `Headings: ${content.headings.slice(0, 20).join(' | ')}` : '',
        content.navLinks.length > 0
            ? `Navigation: ${content.navLinks.slice(0, 15).map((l) => l.label).join(', ')}`
            : '',
    ]
        .filter(Boolean)
        .join('\n')
        .slice(0, MAX_META_CHARS)

    const bodyText = content.mainText.replace(/\s+/g, ' ').trim().slice(0, 12_000)
    const parts = ['--- META ---', metaHeader, '', '--- MAIN CONTENT ---', bodyText]

    if (html) {
        const sections = extractSections(html)
        const footer = extractFooter(html)
        const jsonLd = extractJsonLd(html)
        if (sections) parts.push('', '--- SECTIONS ---', sections)
        if (jsonLd) parts.push('', '--- STRUCTURED DATA ---', jsonLd)
        if (footer) parts.push('', '--- FOOTER ---', footer)
    }

    return parts.join('\n').slice(0, MAX_BODY_CHARS + MAX_META_CHARS + 3000)
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

    // Step 7: Extract images (v2)
    const images = extractImageUrls(html, url.href)

    // Step 8: Preprocess for AI (v2 — enriched)
    const preprocessedText = preprocessForAI(meta, content, html, url.href)

    // Step 9: Calculate confidence
    const { confidence, warnings } = calculateConfidence(meta, content)

    return {
        url: url.href,
        meta,
        content,
        images,
        raw: {
            preprocessedText,
            charCount: preprocessedText.length,
        },
        confidence,
        warnings,
    }
}
