// @vitest-environment node
/**
 * TC-F01-SEO — SEO Infrastructure: middleware bypass, robots.txt, canonical URL
 *
 * Tests for BUG-F05-020 fixes:
 *   - Middleware SEO_PATHS bypass: /sitemap.xml and /robots.txt must NOT be
 *     bypassed by the pathname.includes('.') guard
 *   - robots.txt route: correct output format and tenant-aware Sitemap URL
 *   - Canonical URL resolution: correct baseUrl from middleware headers
 *
 * Ref: docs/qa/TEST-REPORT/F05-sumbug.md:344
 * Ref: docs/architecture/AI_BUILDER_SPEC.md (canonical 4pts, robots.txt 2pts)
 * Ref: docs/standards/WEBSITE_TEMPLATE_STANDARDS.md §6.3
 */
import { describe, it, expect } from 'vitest'

// ── Extracted predicates — mirror middleware.ts logic ──────────────────────
// Middleware runs in Edge Runtime (not importable in Vitest).
// We replicate the exact conditional tree here as pure functions.

const SEO_PATHS = ['/sitemap.xml', '/robots.txt']

/**
 * Mirrors middleware.ts static file bypass (lines 52-63):
 * SEO_PATHS skip the dot-check → fall through to subdomain/custom domain rewrite.
 */
function shouldBypassAsStaticFile(pathname: string): boolean {
    if (!SEO_PATHS.includes(pathname)) {
        if (
            pathname.startsWith('/_next') ||
            pathname.startsWith('/favicon') ||
            pathname.startsWith('/public') ||
            pathname.includes('.')
        ) {
            return true
        }
    }
    return false
}

/**
 * Mirrors canonical URL resolution in generateMetadata()
 * (src/app/sites/[slug]/[[...path]]/page.tsx)
 */
function resolveCanonicalUrl(
    slug: string,
    pagePath: string,
    headers: { 'x-tenant-hostname'?: string; 'x-tenant-slug'?: string },
    platformDomain = 'primeweb.app',
): string | undefined {
    const tenantHostname = headers['x-tenant-hostname']
    const tenantSlug = headers['x-tenant-slug']

    let baseUrl: string
    if (tenantHostname) {
        baseUrl = `https://${tenantHostname}`
    } else if (tenantSlug) {
        baseUrl = `https://${tenantSlug}.${platformDomain}`
    } else if (slug !== 'custom') {
        baseUrl = `https://${slug}.${platformDomain}`
    } else {
        baseUrl = ''
    }

    const canonicalPath = pagePath ? `/${pagePath}` : ''
    return baseUrl ? `${baseUrl}${canonicalPath}` : undefined
}

/**
 * Mirrors robots.txt body generation
 * (src/app/sites/[slug]/robots.txt/route.ts)
 */
function generateRobotsTxt(baseUrl: string): string {
    return [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /admin/',
        '',
        `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n')
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('[TC-F01-SEO] Middleware SEO_PATHS bypass [BUG-F05-020]', () => {
    it('[TC-F01-SEO-01] /sitemap.xml is NOT bypassed by dot-check', () => {
        expect(shouldBypassAsStaticFile('/sitemap.xml')).toBe(false)
    })

    it('[TC-F01-SEO-02] /robots.txt is NOT bypassed by dot-check', () => {
        expect(shouldBypassAsStaticFile('/robots.txt')).toBe(false)
    })

    it('[TC-F01-SEO-03] regular static files (.js, .css, .png) ARE still bypassed', () => {
        expect(shouldBypassAsStaticFile('/script.js')).toBe(true)
        expect(shouldBypassAsStaticFile('/style.css')).toBe(true)
        expect(shouldBypassAsStaticFile('/image.png')).toBe(true)
        expect(shouldBypassAsStaticFile('/font.woff2')).toBe(true)
    })

    it('[TC-F01-SEO-04] /_next paths ARE still bypassed', () => {
        expect(shouldBypassAsStaticFile('/_next/static/chunk.js')).toBe(true)
        expect(shouldBypassAsStaticFile('/_next/image/photo.webp')).toBe(true)
    })

    it('[TC-F01-SEO-05] /favicon paths ARE still bypassed', () => {
        expect(shouldBypassAsStaticFile('/favicon.ico')).toBe(true)
    })

    it('[TC-F01-SEO-06] /public paths ARE still bypassed', () => {
        expect(shouldBypassAsStaticFile('/public/logo.svg')).toBe(true)
    })

    it('[TC-F01-SEO-07] normal page paths without dots are NOT bypassed', () => {
        expect(shouldBypassAsStaticFile('/dashboard')).toBe(false)
        expect(shouldBypassAsStaticFile('/sites/mybakery/about')).toBe(false)
        expect(shouldBypassAsStaticFile('/')).toBe(false)
    })
})

describe('[TC-F01-SEO] robots.txt output format', () => {
    it('[TC-F01-SEO-08] contains correct directives and Sitemap URL for subdomain', () => {
        const body = generateRobotsTxt('https://mybakery.primeweb.app')
        expect(body).toContain('User-agent: *')
        expect(body).toContain('Allow: /')
        expect(body).toContain('Disallow: /api/')
        expect(body).toContain('Disallow: /admin/')
        expect(body).toContain('Sitemap: https://mybakery.primeweb.app/sitemap.xml')
    })

    it('[TC-F01-SEO-09] contains correct Sitemap URL for custom domain', () => {
        const body = generateRobotsTxt('https://mybakery.com')
        expect(body).toContain('Sitemap: https://mybakery.com/sitemap.xml')
    })
})

describe('[TC-F01-SEO] Canonical URL resolution', () => {
    it('[TC-F01-SEO-10] subdomain: resolves from x-tenant-slug header', () => {
        const url = resolveCanonicalUrl('mybakery', '', { 'x-tenant-slug': 'mybakery' })
        expect(url).toBe('https://mybakery.primeweb.app')
    })

    it('[TC-F01-SEO-11] subdomain subpage: appends path without double slash', () => {
        const url = resolveCanonicalUrl('mybakery', 'about', { 'x-tenant-slug': 'mybakery' })
        expect(url).toBe('https://mybakery.primeweb.app/about')
    })

    it('[TC-F01-SEO-12] custom domain: x-tenant-hostname takes priority', () => {
        const url = resolveCanonicalUrl('custom', 'about', {
            'x-tenant-hostname': 'mybakery.com',
            'x-tenant-slug': 'mybakery',
        })
        expect(url).toBe('https://mybakery.com/about')
    })

    it('[TC-F01-SEO-13] custom domain homepage: no trailing slash', () => {
        const url = resolveCanonicalUrl('custom', '', { 'x-tenant-hostname': 'mybakery.com' })
        expect(url).toBe('https://mybakery.com')
    })

    it('[TC-F01-SEO-14] fallback to slug param when no headers', () => {
        const url = resolveCanonicalUrl('mybakery', 'contact', {})
        expect(url).toBe('https://mybakery.primeweb.app/contact')
    })

    it('[TC-F01-SEO-15] returns undefined when slug is custom and no hostname header', () => {
        const url = resolveCanonicalUrl('custom', 'about', {})
        expect(url).toBeUndefined()
    })

    it('[TC-F01-SEO-16] respects custom PLATFORM_DOMAIN', () => {
        const url = resolveCanonicalUrl('mybakery', '', { 'x-tenant-slug': 'mybakery' }, 'myplatform.io')
        expect(url).toBe('https://mybakery.myplatform.io')
    })
})
